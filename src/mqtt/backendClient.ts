import mqtt, { MqttClient } from "mqtt";

let client: MqttClient | null = null;

// precreated rooms
const ROOMS = ["lobby", "forest", "kitchen"] as const;
type RoomId = (typeof ROOMS)[number];

// room -> members
const roomMembers = new Map<string, Set<string>>(
  ROOMS.map((r) => [r, new Set<string>()])
);

// agent -> current room (at most 1 room per agent for v0)
const agentRoom = new Map<string, string>();

// last heartbeat seen
const lastSeen = new Map<string, number>();

function now() {
  return Date.now();
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

  const members = Array.from(roomMembers.get(roomId) ?? []);
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

  const brokerUrl = process.env.MQTT_URL ?? "mqtt://127.0.0.1:1883";
  client = mqtt.connect(brokerUrl, { clientId: "backend-client" });

  client.on("connect", () => {
    console.log(`[MQTT][backend] connected: ${brokerUrl}`);

    // subscribe to topics
    client!.subscribe(
      [
        "rooms/+/join",
        "rooms/+/leave",
        "rooms/+/chat/in",
        "agents/+/status",
        "agents/+/heartbeat",
      ],
      (err) => {
        if (err) console.error("[MQTT][backend] subscribe error:", err);
        else console.log("[MQTT][backend] subscribed to room + presence + chat topics");
      }
    );

    // publish initial room list (precreated rooms)
    publishRoomsState();
    for (const r of ROOMS) publishRoomMembers(r);
  });

  client.on("message", (topic, payload) => {
    const msgStr = payload.toString();
    // rooms/<roomId>/join
    {
      const m = topic.match(/^rooms\/([^/]+)\/join$/);
      if (m) {
        const roomId = m[1];
        try {
          const data = JSON.parse(msgStr) as { agentId: string };
          if (data?.agentId) {
            console.log(`[ROOMS] ${data.agentId} -> join ${roomId}`);
            joinRoom(data.agentId, roomId);
          }
        } catch {
          console.warn("[ROOMS] bad join payload:", msgStr);
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
          const data = JSON.parse(msgStr) as { status: "online" | "offline" };
          if (data?.status === "offline") {
            console.log(`[PRESENCE] ${agentId} offline -> remove from room`);
            removeAgentFromRoom(agentId);
          } else if (data?.status === "online") {
            // mark seen on online too
            lastSeen.set(agentId, now());
            console.log(`[PRESENCE] ${agentId} online`);
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
        return;
      }
    }

    // rooms/<roomId>/leave
    {
      const m = topic.match(/^rooms\/([^/]+)\/leave$/);
      if (m) {
        const roomId = m[1];
        try {
          const data = JSON.parse(msgStr) as { agentId: string };
          if (data?.agentId) {
            console.log(`[ROOMS] ${data.agentId} -> leave ${roomId}`);

            // only remove if they're actually in that room (safe)
            const curRoom = agentRoom.get(data.agentId);
            if (curRoom === roomId) {
              removeAgentFromRoom(data.agentId);
            } else {
              // optional log
              console.log(
                `[ROOMS] ignore leave: ${data.agentId} not in ${roomId} (in ${curRoom ?? "none"})`
              );
            }
          }
        } catch {
          console.warn("[ROOMS] bad leave payload:", msgStr);
        }
        return;
      }
    }

    // rooms/<roomId>/chat/in  -> validate membership -> broadcast rooms/<roomId>/chat/out
    {
      const m = topic.match(/^rooms\/([^/]+)\/chat\/in$/);
      if (m) {
        const roomId = m[1];

        try {
          const data = JSON.parse(msgStr) as {
            roomId?: string;
            from: string;
            type?: "text";
            msg: string;
            ts?: number;
            id?: string;
          };

          const from = data?.from;
          const msg = data?.msg;

          if (!from || typeof msg !== "string") {
            console.warn("[CHAT] bad chat payload:", msgStr);
            return;
          }

          // Validate sender is currently in this room
          const curRoom = agentRoom.get(from);
          if (curRoom !== roomId) {
            console.warn(`[CHAT] reject: ${from} tried to chat in ${roomId} but is in ${curRoom ?? "none"}`);
            return;
          }

          console.log(`[CHAT][IN][${roomId}] ${from}: ${msg}`);

          const out = {
            roomId,
            from,
            type: data.type ?? "text",
            msg,
            ts: data.ts ?? now(),
            id: data.id ?? `${from}-${now()}`,
            serverTs: now(),
          };

          // console.log(`[CHAT][OUT][${roomId}] broadcast from ${from}`);

          client!.publish(`rooms/${roomId}/chat/out`, JSON.stringify(out), {
            qos: 0,
            retain: false, // chat messages should NOT be retained
          });

          return;
        } catch {
          console.warn("[CHAT] bad chat payload:", msgStr);
          return;
        }
      }
    }
  });

  // optional: heartbeat timeout cleanup (extra safety even with LWT)
  setInterval(() => {
    const t = now();
    for (const [agentId, seen] of lastSeen.entries()) {
      if (t - seen > 20000) {
        // 20s without heartbeat => treat as gone
        console.log(`[PRESENCE] ${agentId} heartbeat timeout -> remove from room`);
        lastSeen.delete(agentId);
        removeAgentFromRoom(agentId);
      }
    }
  }, 5000);

  let lastErrLog = 0;

  client.on("error", (err: any) => {
    const code = err?.code;
    const now = Date.now();

    if (code === "ECONNREFUSED") {
      if (now - lastErrLog > 3000) {
        console.log("[MQTT][backend] broker unavailable (ECONNREFUSED)");
        lastErrLog = now;
      }
      return;
    }

    console.error("[MQTT][backend] error:", err);
  });

  return client;
}
