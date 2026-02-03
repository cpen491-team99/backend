import mqtt, { MqttClient } from "mqtt";
import { initSchema, saveChatroom, saveUser, saveAgent, saveMessage } from "../../Database/admin_store.js";
import { listMessagesByChatroom, listMessagesBySender } from "../../Database/admin_query.js";
import { initSchema as initMemorySchema, createAgent as createMemoryAgent, createLocation as createMemoryLocation, createMemory } from "../../Database/db_store.js";
import { MemoryEmbedder } from "../../MemoryEmbedder.js";
// NOTE: For this database-test backend, we intentionally do NOT close the Neo4j driver during runtime.
// Close the driver only when shutting down the process.


let client: MqttClient | null = null;

// precreated rooms
const ROOMS = ["library", "cafe", "park", "sports-court", "private-room"] as const;
type RoomId = (typeof ROOMS)[number];

const PRIVATE_ROOM_ID = "private-room" as const;

function shouldWriteToMemoryDb(roomId: string) {
  return roomId !== PRIVATE_ROOM_ID;
}

// room -> members (store agentIds)
const roomMembers = new Map<string, Set<string>>(
  ROOMS.map((r) => [r, new Set<string>()])
);

// agent -> current room (at most 1 room per agent for v0)
const agentRoom = new Map<string, string>();

// agent -> username (for logging / membership display)
const agentUsername = new Map<string, string>();

// last heartbeat seen
const lastSeen = new Map<string, number>();

function now() {
  return Date.now();
}

function who(agentId: string) {
  const u = agentUsername.get(agentId);
  return u ? `${u}(${agentId})` : agentId;
}

// ---- DB helpers (admin DB) ----
async function dbInitAndSeedRooms() {
  try {
    await initSchema();
    for (const r of ROOMS) await saveChatroom({ id: r, roomname: r });
    console.log(`[DB] schema ensured + chatrooms seeded: ${ROOMS.join(', ')}`);
  } catch (err) {
    console.error('[DB] init/seed error:', err);
  }
}

async function dbUpsertUserAndAgent(params: { userId?: string; agentId: string; username?: string }) {
  // Test convention:
  // - userId stored in DB should equal frontend username (for now)
  // - agentname stored in DB should equal agentId
  const uid = params.username ?? params.userId ?? `u_${params.agentId}`;
  const username = params.username ?? uid;

  try {
    await saveUser({ id: uid, username, email: null, preferences: null });
    await saveAgent({ id: params.agentId, uid, agentname: params.agentId, persona: null });
  } catch (err) {
    console.error(`[DB] save user/agent failed (uid=${uid}, agent=${params.agentId}):`, err);
  }
}

async function dbSaveChatMessage(params: {
  messageId: string;
  chatroomId: string;
  senderAgentId: string;
  text: string;
  sentAtMs?: number;
}) {
  try {
    await saveChatroom({ id: params.chatroomId, roomname: params.chatroomId });
    await saveMessage({
      id: params.messageId,
      text: params.text,
      senderId: params.senderAgentId,
      chatroomId: params.chatroomId,
      sentAt: params.sentAtMs ? new Date(params.sentAtMs).toISOString() : null,
      senderIsUser: false,
      //senderIsUser: true,
    });
  } catch (err) {
    console.error(`[DB] save message failed (room=${params.chatroomId}, from=${params.senderAgentId}):`, err);
  }
}
// ---- end DB helpers ----


// ---- Memory DB helpers (vector store / semantic memory DB) ----
// This uses db_store.js (runQuery -> NEO4J_URI/NEO4J_USERNAME/NEO4J_PASSWORD)
// and MemoryEmbedder.js to generate embeddings.
// We intentionally keep this "best-effort": memory DB failures should NOT break MQTT or admin DB logging.

const memoryEmbedder = new MemoryEmbedder();
let memoryEmbedderInitPromise: Promise<void> | null = null;

async function memoryDbInitAndSeedLocations() {
  try {
    await initMemorySchema();
    for (const r of ROOMS) {
      // Use room name as both l_id and name (consistent with our test conventions)
      await createMemoryLocation({ l_id: r, name: r });
    }
    console.log(`[MEMDB] schema ensured + locations seeded: ${ROOMS.join(", ")}`);
  } catch (err) {
    console.error("[MEMDB] init/seed error:", err);
  }
}

function ensureMemoryEmbedderInit() {
  if (!memoryEmbedderInitPromise) {
    memoryEmbedderInitPromise = memoryEmbedder.init().catch((err: any) => {
      console.error("[EMBED] init failed:", err);
      throw err;
    });
  }
  return memoryEmbedderInitPromise;
}

async function memoryDbUpsertAgent(params: { agentId: string; name?: string }) {
  try {
    // For now, keep agent name == agentId (same convention as admin DB)
    await createMemoryAgent({ a_id: params.agentId, name: params.agentId, persona: null });
  } catch (err) {
    console.error(`[MEMDB] createAgent failed (agent=${params.agentId}):`, err);
  }
}

async function memoryDbCreateChatMemory(params: {
  memoryId: string;       // agentId + Date.now() (we use out.id)
  text: string;
  speakerAgentId: string;
  roomId: string;         // chatroom name
  msgType?: string;       // "chat" default
  audienceIds: string[];  // other agents in same room
  tsMs?: number;
}) {
  try {
    // Ensure embedder is ready (async, best-effort)
    await ensureMemoryEmbedderInit();

    // Build base memory object using the embedder
    const base = await memoryEmbedder.createMemoryObject(
      params.text,
      params.speakerAgentId,
      params.audienceIds, // goes into metadata.audience in the embedder
      params.roomId,
      params.msgType ?? "chat"
    );

    // Backend overrides (we do NOT modify MemoryEmbedder.js):
    // - id should be agentId + Date.now()
    // - rename metadata.audience -> metadata.audienceIds (db_store expects audienceIds)
    // - add metadata.search_text + speaker_name for db_store
    (base as any).id = params.memoryId;

    const meta: any = (base as any).metadata ?? {};
    meta.audienceIds = meta.audience ?? params.audienceIds;
    delete meta.audience;

    meta.speaker_name = params.speakerAgentId;  // keep name==agentId for now
    meta.search_text = params.text;             // simple search text for now
    // timestamp is already epoch seconds in embedder; keep it.

    (base as any).metadata = meta;

    // Store in memory DB
    await createMemory(base as any);
  } catch (err) {
    console.error(`[MEMDB] createMemory failed (room=${params.roomId}, from=${params.speakerAgentId}):`, err);
  }
}
// ---- end Memory DB helpers ----


// ---- Admin DB query helpers (history) ----
// neo4j-driver may return DateTime objects in properties; stringify them for JSON transport.
function normalizeAdminMessages(messages: any[]) {
  return messages.map((m: any) => {
    const out: any = { ...m };
    for (const k of ["sentAt", "createdAt"]) {
      if (out[k] && typeof out[k] !== "string") {
        out[k] = typeof out[k].toString === "function" ? out[k].toString() : String(out[k]);
      }
    }
    return out;
  });
}
// ---- end Admin DB query helpers ----

// ---- Memory query helper (lazy import) ----
// We lazy-import because db_query.js uses top-level await to init the embedder.
type FindMemoriesFn = (textQuery: string, currentAgentId: string) => Promise<any>;
let _findMemories: FindMemoriesFn | null = null;

async function getFindMemories(): Promise<FindMemoriesFn> {
  if (_findMemories) return _findMemories;
  const mod = await import("../../Database/db_query.js");
  _findMemories = mod.findMemories as FindMemoriesFn;
  return _findMemories;
}



function publishRoomsState() {
  if (!client) return;

  const rooms = ROOMS.map((id) => ({
    id,
    count: roomMembers.get(id)?.size ?? 0,
  }));

  client.publish("rooms/state", JSON.stringify({ rooms, ts: now() }), {
    qos: 0,
    retain: true,
  });
}

function publishRoomMembers(roomId: string) {
  if (!client) return;

  const members = Array.from(roomMembers.get(roomId) ?? []).map((agentId) => ({
    agentId,
    username: agentUsername.get(agentId) ?? null,
  }));

  client.publish(
    `rooms/${roomId}/members`,
    JSON.stringify({ roomId, members, ts: now() }),
    { qos: 0, retain: true }
  );
}

function removeAgentFromRoom(agentId: string) {
  const curRoom = agentRoom.get(agentId);
  if (!curRoom) return;

  roomMembers.get(curRoom)?.delete(agentId);
  agentRoom.delete(agentId);

  publishRoomMembers(curRoom);
  publishRoomsState();
}

function joinRoom(agentId: string, roomId: string) {
  if (!roomMembers.has(roomId)) {
    console.warn(`[ROOMS] unknown room '${roomId}' (ignored)`);
    return;
  }

  // ensure agent is in only one room
  removeAgentFromRoom(agentId);

  roomMembers.get(roomId)!.add(agentId);
  agentRoom.set(agentId, roomId);

  publishRoomMembers(roomId);
  publishRoomsState();
}

export function initBackendMqtt() {
  if (client) return client; // prevent double init

  const brokerUrl = process.env.MQTT_URL ?? "mqtt://127.0.0.1:49160";
  client = mqtt.connect(brokerUrl, { clientId: "backend-client" });

  client.on("connect", () => {
    console.log(`[MQTT][backend] connected: ${brokerUrl}`);

    client!.subscribe(
      [
        "rooms/+/join",
        "rooms/+/leave",
        "rooms/+/chat/in",
        "agents/+/status",
        "agents/+/heartbeat",
        // History query request topics (Admin DB)
        "rooms/+/history/request",
        "senders/history/request",
        // NEW: memory search request
        "agents/+/memory/find/request",
      ],
      (err) => {
        if (err) console.error("[MQTT][backend] subscribe error:", err);
        else console.log("[MQTT][backend] subscribed to room + presence + chat topics");
      }
    );

    publishRoomsState();
    for (const r of ROOMS) publishRoomMembers(r);

    // DB (admin): ensure constraints + seed chatrooms
    void dbInitAndSeedRooms();

    // DB (memory): ensure constraints + seed locations (rooms)
    void memoryDbInitAndSeedLocations();

    // Embeddings: kick off embedder init (best-effort)
    void ensureMemoryEmbedderInit();
  });

  client.on("message", (topic, payload) => {
    const msgStr = payload.toString();

    // rooms/<roomId>/join
    {
      const m = topic.match(/^rooms\/([^/]+)\/join$/);
      if (m) {
        const roomId = m[1];
        try {
          const data = JSON.parse(msgStr) as { agentId: string; username?: string; userId?: string };
          if (data?.agentId) {
            if (data.username) agentUsername.set(data.agentId, data.username);
            console.log(`[ROOMS] ${who(data.agentId)} -> join ${roomId}`);
            joinRoom(data.agentId, roomId);
            // DB: best-effort upsert (in case status wasn't sent)
            void dbUpsertUserAndAgent({ userId: data.userId, agentId: data.agentId, username: data.username });
            // Memory DB: ensure Agent exists (best-effort)
            void memoryDbUpsertAgent({ agentId: data.agentId });
          }
        } catch {
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
          const data = JSON.parse(msgStr) as { agentId: string; username?: string; userId?: string };
          if (data?.agentId) {
            if (data.username) agentUsername.set(data.agentId, data.username);

            console.log(`[ROOMS] ${who(data.agentId)} -> leave ${roomId}`);

            const curRoom = agentRoom.get(data.agentId);
            if (curRoom === roomId) {
              removeAgentFromRoom(data.agentId);
            } else {
              console.log(
                `[ROOMS] ignore leave: ${who(data.agentId)} not in ${roomId} (in ${curRoom ?? "none"})`
              );
            }
          }
        } catch {
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
          const data = JSON.parse(msgStr) as { status: "online" | "offline"; username?: string; userId?: string; agentname?: string };
          if (data.username) agentUsername.set(agentId, data.username);

          if (data?.status === "offline") {
            console.log(`[PRESENCE] ${who(agentId)} offline -> remove from room`);
            removeAgentFromRoom(agentId);
          } else if (data?.status === "online") {
            lastSeen.set(agentId, now());
            console.log(`[PRESENCE] ${who(agentId)} online`);
            // DB (admin): save user + agent when we see online
            void dbUpsertUserAndAgent({ userId: data.userId, agentId, username: data.username ?? data.agentname });
            // DB (memory): ensure Agent exists (best-effort)
            void memoryDbUpsertAgent({ agentId });
          }
        } catch {
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
          const data = JSON.parse(msgStr) as { username?: string };
          if (data?.username) agentUsername.set(agentId, data.username);
        } catch {
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
          const data = JSON.parse(msgStr) as {
            roomId?: string;
            fromAgentId: string;
            fromUsername?: string;
            fromUserId?: string;
            type?: "text";
            msg: string;
            ts?: number;
            id?: string;
          };

          const fromAgentId = data?.fromAgentId;
          const msg = data?.msg;

          if (!fromAgentId || typeof msg !== "string") {
            console.warn("[CHAT] bad chat payload:", msgStr);
            return;
          }

          if (data.fromUsername) agentUsername.set(fromAgentId, data.fromUsername);

          // Validate sender is currently in this room
          const curRoom = agentRoom.get(fromAgentId);
          if (curRoom !== roomId) {
            console.warn(
              `[CHAT] reject: ${who(fromAgentId)} tried to chat in ${roomId} but is in ${curRoom ?? "none"}`
            );
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

          client!.publish(`rooms/${roomId}/chat/out`, JSON.stringify(out), {
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

          // Memory DB: save as semantic Memory (embedding + audienceIds)
          if (shouldWriteToMemoryDb(roomId)) {
            const audienceIds = Array.from(roomMembers.get(roomId) ?? []).filter((id) => id !== fromAgentId);
            void memoryDbCreateChatMemory({
              memoryId: out.id,
              text: msg,
              speakerAgentId: fromAgentId,
              roomId,
              msgType: out.type,
              audienceIds,
              tsMs: out.ts,
            });
          } else {
            console.log(`[MEMDB] skip memory write for private room (room=${roomId})`);
          }

          // const audienceIds = Array.from(roomMembers.get(roomId) ?? []).filter((id) => id !== fromAgentId);
          // void memoryDbCreateChatMemory({
          //   memoryId: out.id,
          //   text: msg,
          //   speakerAgentId: fromAgentId,
          //   roomId,
          //   msgType: out.type,
          //   audienceIds,
          //   tsMs: out.ts,
          // });

          return;
        } catch {
          console.warn("[CHAT] bad chat payload:", msgStr);
          return;
        }
      }
    }

    // rooms/<roomId>/history/request  (Admin DB)
    // Request payload: { requestId: string, limit?: number, before?: string|null }
    // Response topic: rooms/<roomId>/history/response/<requestId>
    {
      const m = topic.match(/^rooms\/([^/]+)\/history\/request$/);
      if (m) {
        const roomId = m[1];
        try {
          const data = JSON.parse(msgStr) as { requestId: string; limit?: number; before?: string | null };
          const requestId = data?.requestId ?? `req-${now()}`;
          const limit = Math.max(1, Math.min(Number(data?.limit ?? 20), 100));
          const before = data?.before ?? null;
          const beforeArg = typeof before === "string" ? undefined : before;

          Promise.resolve()
            .then(() => listMessagesByChatroom({ chatroomId: roomId, before: beforeArg, limit }))
            .then((messages: any[]) => {
              const norm = normalizeAdminMessages(messages);
              const nextBefore = norm.length ? (norm[norm.length - 1].sentAt ?? null) : null;

              client!.publish(
                `rooms/${roomId}/history/response/${requestId}`,
                JSON.stringify({ requestId, roomId, messages: norm, nextBefore, ts: now() }),
                { qos: 0, retain: false }
              );
            })
            .catch((err: any) => {
              console.error(`[HISTORY] room history query failed (room=${roomId}):`, err);
              client!.publish(
                `rooms/${roomId}/history/response/${requestId}`,
                JSON.stringify({ requestId, roomId, messages: [], error: "query_failed", ts: now() }),
                { qos: 0, retain: false }
              );
            });
        } catch {
          console.warn("[HISTORY] bad room history request payload:", msgStr);
        }
        return;
      }
    }

    // senders/history/request  (Admin DB)
    // Request payload: { requestId: string, senderType: "user"|"agent", senderId: string, limit?: number, before?: string|null }
    // Response topic: senders/history/response/<requestId>
    {
      const m = topic.match(/^senders\/history\/request$/);
      if (m) {
        try {
          const data = JSON.parse(msgStr) as {
            requestId: string;
            senderType: "user" | "agent";
            senderId: string;
            limit?: number;
            before?: string | null;
          };

          const requestId = data?.requestId ?? `req-${now()}`;
          const senderType = data?.senderType ?? "agent";
          const senderId = data?.senderId;
          const limit = Math.max(1, Math.min(Number(data?.limit ?? 20), 100));
          const before = data?.before ?? null;

          if (!senderId) {
            client!.publish(
              `senders/history/response/${requestId}`,
              JSON.stringify({ requestId, senderType, senderId: null, messages: [], error: "missing_senderId", ts: now() }),
              { qos: 0, retain: false }
            );
            return;
          }

          const senderIsUser = senderType === "user";
          const beforeArg = typeof before === "string" ? undefined : before;

          Promise.resolve()
            .then(() => listMessagesBySender({ senderId, senderIsUser, before: beforeArg, limit }))
            .then((messages: any[]) => {
              const norm = normalizeAdminMessages(messages);
              const nextBefore = norm.length ? (norm[norm.length - 1].sentAt ?? null) : null;

              client!.publish(
                `senders/history/response/${requestId}`,
                JSON.stringify({ requestId, senderType, senderId, messages: norm, nextBefore, ts: now() }),
                { qos: 0, retain: false }
              );
            })
            .catch((err: any) => {
              console.error(`[HISTORY] sender history query failed (sender=${senderId}, type=${senderType}):`, err);
              client!.publish(
                `senders/history/response/${requestId}`,
                JSON.stringify({ requestId, senderType, senderId, messages: [], error: "query_failed", ts: now() }),
                { qos: 0, retain: false }
              );
            });
        } catch {
          console.warn("[HISTORY] bad sender history request payload:", msgStr);
        }
        return;
      }
    }

    // agents/<agentId>/memory/find/request
    {
      const m = topic.match(/^agents\/([^/]+)\/memory\/find\/request$/);
      if (m) {
        const requesterAgentId = m[1];

        let data: any;
        try {
          data = JSON.parse(msgStr);
        } catch {
          console.warn("[MEMORY] bad find request payload:", msgStr);
          return;
        }

        const { requestId, textQuery } = data ?? {};
        if (!requestId || typeof textQuery !== "string" || !textQuery.trim()) {
          console.warn("[MEMORY] invalid find request:", msgStr);
          return;
        }

        // async IIFE — this is the key fix
        (async () => {
          try {
            const findMemories = await getFindMemories();
            const result = await findMemories(textQuery, requesterAgentId);

            const records = (result?.records ?? []).map((r: any) => ({
              text: r.get("text"),
              from: r.get("from"),
              location: r.get("location"),
              score: r.get("score"),
            }));

            const respTopic = `agents/${requesterAgentId}/memory/find/response/${requestId}`;
            client!.publish(
              respTopic,
              JSON.stringify({
                requestId,
                agentId: requesterAgentId,
                textQuery,
                results: records,
                ts: now(),
              }),
              { qos: 0, retain: false }
            );
          } catch (err) {
            console.error("[MEMORY] find handler error:", err);
          }
        })();

        return;
      }
    }

  });

  // heartbeat timeout cleanup
  setInterval(() => {
    const t = now();
    for (const [agentId, seen] of lastSeen.entries()) {
      if (t - seen > 900000000) {
        console.log(`[PRESENCE] ${who(agentId)} heartbeat timeout -> remove from room`);
        lastSeen.delete(agentId);
        removeAgentFromRoom(agentId);
      }
    }
  }, 5000);

  client.on("error", (err: any) => {
    // optional: reduce spam for ECONNREFUSED
    const code = err?.code;
    if (code === "ECONNREFUSED") {
      console.log("[MQTT][backend] broker unavailable (ECONNREFUSED)");
      return;
    }
    console.error("[MQTT][backend] error:", err);
  });

  return client;
}