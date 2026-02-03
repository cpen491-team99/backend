import mqtt from "mqtt";
import { initSchema, saveChatroom, saveUser, saveAgent, saveMessage } from "../../Database/admin_store.js";

let client = null;
// precreated rooms
const ROOMS = ["lobby", "forest", "kitchen"];
// room -> members (store agentIds)
const roomMembers = new Map(ROOMS.map((r) => [r, new Set()]));
// agent -> current room (at most 1 room per agent for v0)
const agentRoom = new Map();
// agent -> username (for logging / membership display)
const agentUsername = new Map();
// last heartbeat seen
const lastSeen = new Map();

function now() {
    return Date.now();
}

function who(agentId) {
    const u = agentUsername.get(agentId);
    return u ? `${u}(${agentId})` : agentId;
}

// ---- DB helpers (admin DB) ----
/**
 * DB startup init:
 * Seed the precreated chatrooms into DB (MERGE)
 */
async function dbInitAndSeedRooms() {
    try {
        await initSchema();
        for (const r of ROOMS)
            await saveChatroom({ id: r, roomname: r });
        console.log(`[DB] schema ensured + chatrooms seeded: ${ROOMS.join(', ')}`);
    }
    catch (err) {
        console.error('[DB] init/seed error:', err);
    }
}

/**
 * Save user + agent:
 *
 * If userId is missing, we generate a deterministic fallback user id: "u_<agentId>"
 */
async function dbUpsertUserAndAgent(params) {
    const uid = params.userId ?? `u_${params.agentId}`;
    const username = params.username ?? agentUsername.get(params.agentId) ?? null;
    try {
        await saveUser({ id: uid, username: username ?? uid, email: null, preferences: null });
        await saveAgent({ id: params.agentId, uid, agentname: username ?? params.agentId, persona: null });
    }
    catch (err) {
        console.error(`[DB] save user/agent failed (uid=${uid}, agent=${params.agentId}):`, err);
    }
}


/**
 * Save a chat message:
 * - Ensures chatroom node exists (MERGE)
 * - Writes Message node + relationships:
 *
 * senderIsUser=false because our chat sender is an Agent (fromAgentId).
 */
async function dbSaveChatMessage(params) {
    try {
        await saveChatroom({ id: params.chatroomId, roomname: params.chatroomId });
        await saveMessage({
            id: params.messageId,
            text: params.text,
            senderId: params.senderAgentId,
            chatroomId: params.chatroomId,
            sentAt: params.sentAtMs ? new Date(params.sentAtMs).toISOString() : null,
            senderIsUser: false,
        });
    }
    catch (err) {
        console.error(`[DB] save message failed (room=${params.chatroomId}, from=${params.senderAgentId}):`, err);
    }
}
// ---- end DB helpers ----

// ---- MQTT publish helpers
/**
 * Publish global room list + counts to "rooms/state" (retained).
 * Frontend clients can subscribe to this to show available rooms.
 */
function publishRoomsState() {
    if (!client)
        return;
    const rooms = ROOMS.map((id) => ({
        id,
        count: roomMembers.get(id)?.size ?? 0,
    }));
    client.publish("rooms/state", JSON.stringify({ rooms, ts: now() }), {
        qos: 0,
        retain: true,
    });
}

/**
 * Publish membership list for a room to "rooms/<roomId>/members" (retained).
 * Frontend clients can subscribe to this for live member lists.
 */
function publishRoomMembers(roomId) {
    if (!client)
        return;
    const members = Array.from(roomMembers.get(roomId) ?? []).map((agentId) => ({
        agentId,
        username: agentUsername.get(agentId) ?? null,
    }));
    client.publish(`rooms/${roomId}/members`, JSON.stringify({ roomId, members, ts: now() }), { qos: 0, retain: true });
}

/**
 * Remove agent from its current room (if any), then publish updates.
 */
function removeAgentFromRoom(agentId) {
    const curRoom = agentRoom.get(agentId);
    if (!curRoom)
        return;
    roomMembers.get(curRoom)?.delete(agentId);
    agentRoom.delete(agentId);
    publishRoomMembers(curRoom);
    publishRoomsState();
}

/**
 * Join a room:
 * - validate room exists
 * - enforce “only one room per agent”
 * - publish updated members + room counts
 */
function joinRoom(agentId, roomId) {
    if (!roomMembers.has(roomId)) {
        console.warn(`[ROOMS] unknown room '${roomId}' (ignored)`);
        return;
    }
    // ensure agent is in only one room
    removeAgentFromRoom(agentId);
    roomMembers.get(roomId).add(agentId);
    agentRoom.set(agentId, roomId);
    publishRoomMembers(roomId);
    publishRoomsState();
}

// ---- MQTT backend init
export function initBackendMqtt() {
    if (client)
        return client; // prevent double init
    const brokerUrl = process.env.MQTT_URL ?? "mqtt://127.0.0.1:49160";
    client = mqtt.connect(brokerUrl, { clientId: "backend-client" });
    client.on("connect", () => {
        console.log(`[MQTT][backend] connected: ${brokerUrl}`);
        client.subscribe([
            "rooms/+/join",
            "rooms/+/leave",
            "rooms/+/chat/in",
            "agents/+/status",
            "agents/+/heartbeat",
        ], (err) => {
            if (err)
                console.error("[MQTT][backend] subscribe error:", err);
            else
                console.log("[MQTT][backend] subscribed to room + presence + chat topics");
        });

        // Publish initial retained state so clients can discover rooms immediately.
        publishRoomsState();
        for (const r of ROOMS)
            publishRoomMembers(r);

        // DB: ensure constraints + seed chatrooms
        void dbInitAndSeedRooms();
    });

    client.on("message", (topic, payload) => {
        const msgStr = payload.toString();
        // rooms/<roomId>/join
        {
            const m = topic.match(/^rooms\/([^/]+)\/join$/);
            if (m) {
                const roomId = m[1];
                try {
                    const data = JSON.parse(msgStr);
                    if (data?.agentId) {
                        if (data.username)
                            agentUsername.set(data.agentId, data.username);
                        console.log(`[ROOMS] ${who(data.agentId)} -> join ${roomId}`);
                        joinRoom(data.agentId, roomId);
                        // DB: best-effort upsert (in case status wasn't sent)
                        void dbUpsertUserAndAgent({ userId: data.userId, agentId: data.agentId, username: data.username });
                    }
                }
                catch {
                    console.warn("[ROOMS] bad join payload:", msgStr);
                }
                return;
            }
        }
        // rooms/<roomId>/leave
        {
            const m = topic.match(/^rooms\/([^/]+)\/leave$/);
            if (m) {
                const roomId = m[1];
                try {
                    const data = JSON.parse(msgStr);
                    if (data?.agentId) {
                        if (data.username)
                            agentUsername.set(data.agentId, data.username);
                        console.log(`[ROOMS] ${who(data.agentId)} -> leave ${roomId}`);
                        const curRoom = agentRoom.get(data.agentId);
                        if (curRoom === roomId) {
                            removeAgentFromRoom(data.agentId);
                        }
                        else {
                            console.log(`[ROOMS] ignore leave: ${who(data.agentId)} not in ${roomId} (in ${curRoom ?? "none"})`);
                        }
                    }
                }
                catch {
                    console.warn("[ROOMS] bad leave payload:", msgStr);
                }
                return;
            }
        }
        // agents/<agentId>/status
        {
            const m = topic.match(/^agents\/([^/]+)\/status$/);
            if (m) {
                const agentId = m[1];
                try {
                    const data = JSON.parse(msgStr);
                    if (data.username)
                        agentUsername.set(agentId, data.username);
                    if (data?.status === "offline") {
                        console.log(`[PRESENCE] ${who(agentId)} offline -> remove from room`);
                        removeAgentFromRoom(agentId);
                    }
                    else if (data?.status === "online") {
                        lastSeen.set(agentId, now());
                        console.log(`[PRESENCE] ${who(agentId)} online`);
                        // DB: save user + agent when we see online
                        void dbUpsertUserAndAgent({ userId: data.userId, agentId, username: data.username ?? data.agentname });
                    }
                }
                catch {
                    console.warn("[PRESENCE] bad status payload:", msgStr);
                }
                return;
            }
        }
        // agents/<agentId>/heartbeat
        {
            const m = topic.match(/^agents\/([^/]+)\/heartbeat$/);
            if (m) {
                const agentId = m[1];
                lastSeen.set(agentId, now());
                // heartbeat is JSON now (but tolerate old "1")
                try {
                    const data = JSON.parse(msgStr);
                    if (data?.username)
                        agentUsername.set(agentId, data.username);
                }
                catch {
                    // ignore
                }
                return;
            }
        }
        // rooms/<roomId>/chat/in -> validate membership -> broadcast rooms/<roomId>/chat/out
        {
            const m = topic.match(/^rooms\/([^/]+)\/chat\/in$/);
            if (m) {
                const roomId = m[1];
                try {
                    const data = JSON.parse(msgStr);
                    const fromAgentId = data?.fromAgentId;
                    const msg = data?.msg;
                    if (!fromAgentId || typeof msg !== "string") {
                        console.warn("[CHAT] bad chat payload:", msgStr);
                        return;
                    }
                    if (data.fromUsername)
                        agentUsername.set(fromAgentId, data.fromUsername);
                    // Validate sender is currently in this room
                    const curRoom = agentRoom.get(fromAgentId);
                    if (curRoom !== roomId) {
                        console.warn(`[CHAT] reject: ${who(fromAgentId)} tried to chat in ${roomId} but is in ${curRoom ?? "none"}`);
                        return;
                    }
                    console.log(`[CHAT][IN][${roomId}] ${who(fromAgentId)}: ${msg}`);
                    const out = {
                        roomId,
                        fromAgentId,
                        fromUsername: agentUsername.get(fromAgentId) ?? data.fromUsername ?? null,
                        type: data.type ?? "text",
                        msg,
                        ts: data.ts ?? now(),
                        id: data.id ?? `${fromAgentId}-${now()}`,
                        serverTs: now(),
                    };
                    client.publish(`rooms/${roomId}/chat/out`, JSON.stringify(out), {
                        qos: 0,
                        retain: false,
                    });
                    // DB: best-effort save message (and ensure sender exists)
                    void dbUpsertUserAndAgent({ userId: data.fromUserId, agentId: fromAgentId, username: out.fromUsername ?? undefined });
                    void dbSaveChatMessage({
                        messageId: out.id,
                        chatroomId: roomId,
                        senderAgentId: fromAgentId,
                        text: msg,
                        sentAtMs: out.ts,
                    });
                    return;
                }
                catch {
                    console.warn("[CHAT] bad chat payload:", msgStr);
                    return;
                }
            }
        }
    });
    /* ------------------------------
     * Heartbeat timeout cleanup:
     * If agent hasn’t heartbeated for > 20s, treat as offline and remove from room.
     * ------------------------------ */
    setInterval(() => {
        const t = now();
        for (const [agentId, seen] of lastSeen.entries()) {
            if (t - seen > 20000) {
                console.log(`[PRESENCE] ${who(agentId)} heartbeat timeout -> remove from room`);
                lastSeen.delete(agentId);
                removeAgentFromRoom(agentId);
            }
        }
    }, 5000);
    client.on("error", (err) => {
        // reduce spam for ECONNREFUSED
        const code = err?.code;
        if (code === "ECONNREFUSED") {
            console.log("[MQTT][backend] broker unavailable (ECONNREFUSED)");
            return;
        }
        console.error("[MQTT][backend] error:", err);
    });
    return client;
}
