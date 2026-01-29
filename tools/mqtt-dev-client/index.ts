import mqtt from "mqtt";
import readline from "readline";

const brokerUrl = process.env.MQTT_URL ?? "mqtt://127.0.0.1:49160";

// NEW: allow 2 params: username + agentId
// usage: node dist/tools/mqtt-dev-client/index.js <username> <agentId>
const username = process.argv[2] ?? `user-${Math.floor(Math.random() * 1000)}`;
const agentId = process.argv[3] ?? `agent-${Math.floor(Math.random() * 1000)}`;

const displayId = `${username}(${agentId})`;

let currentRoom: string | null = null;

// Last Will: if this client crashes, broker publishes offline (retained)
const client = mqtt.connect(brokerUrl, {
  clientId: `dev-${agentId}`,
  will: {
    topic: `agents/${agentId}/status`,
    payload: JSON.stringify({ status: "offline", username, agentId, ts: Date.now() }),
    qos: 0,
    retain: true,
  },
});

type BufferedMessage = {
  topic: string;
  payload: string;
  options?: any;
};

const outbox: BufferedMessage[] = [];

function safePublish(topic: string, payload: string, options: any = {}) {
  if (client.connected) {
    client.publish(topic, payload, options);
  } else {
    outbox.push({ topic, payload, options });
    console.log(`[buffered][${displayId}] ${topic} (outbox=${outbox.length})`);
  }
}

function flushOutbox() {
  if (!client.connected || outbox.length === 0) return;
  console.log(`[outbox][${displayId}] flushing ${outbox.length} buffered message(s)`);
  while (outbox.length) {
    const m = outbox.shift()!;
    client.publish(m.topic, m.payload, m.options);
  }
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.setPrompt(`[${displayId}]> `);

// helper: subscribe to global updates
function subscribeBase() {
  client.subscribe(["rooms/state", "rooms/+/members", "rooms/+/history/response/+", "senders/history/response/+"], (err) => {
    if (err) console.error(`[MQTT][${displayId}] subscribe error:`, err);
    else console.log(`[MQTT][${displayId}] subscribed to rooms/state + rooms/+/members`);
  });
}

// helper: subscribe/unsubscribe room chat
function subRoomChat(roomId: string) {
  client.subscribe(`rooms/${roomId}/chat/out`, (err) => {
    if (err) console.error(`[MQTT][${displayId}] subscribe chat error:`, err);
    else console.log(`[MQTT][${displayId}] subscribed to rooms/${roomId}/chat/out`);
  });
}
function unsubRoomChat(roomId: string) {
  client.unsubscribe(`rooms/${roomId}/chat/out`);
}

// presence (online retained) + heartbeat
function publishOnline() {
  safePublish(
    `agents/${agentId}/status`,
    JSON.stringify({ status: "online", username, agentId, ts: Date.now() }),
    { qos: 0, retain: true }
  );
}
function publishOffline() {
  safePublish(
    `agents/${agentId}/status`,
    JSON.stringify({ status: "offline", username, agentId, ts: Date.now() }),
    { qos: 0, retain: true }
  );
}

let hbTimer: NodeJS.Timeout | null = null;
function startHeartbeat() {
  hbTimer = setInterval(() => {
    // include identity so backend can keep mapping fresh
    safePublish(
      `agents/${agentId}/heartbeat`,
      JSON.stringify({ username, agentId, ts: Date.now() }),
      { qos: 0, retain: false }
    );
  }, 5000);
}

function showHelp() {
  console.log("Commands:");
  console.log("  join <roomId>     (e.g., join lobby)");
  console.log("  leave             (leave current room, stay online)");
  console.log("  say <message>     (send chat to current room)");
  console.log("  exit              (offline + disconnect)");
  console.log("  history room <roomId> [limit] [beforeISO]");
  console.log("  history agent <agentId> [limit] [beforeISO]");
  console.log("  history user <username> [limit] [beforeISO]");
}

function prompt() {
  rl.prompt();
}

client.on("connect", () => {
  console.log(`[MQTT][${displayId}] connected: ${brokerUrl}`);

  // Re-subscribe on every connect
  subscribeBase();
  // Re-subscribe to chat/out topic for current room (UI/logging)
  if (currentRoom) subRoomChat(currentRoom);
  // Re-announce online status
  publishOnline();
  // Heartbeat
  startHeartbeat();

  if (currentRoom) {
    safePublish(
      `rooms/${currentRoom}/join`,
      JSON.stringify({ agentId, username, ts: Date.now() })
    );
  }
  flushOutbox();

  showHelp();
  prompt();
});

client.on("reconnect", () => {
  console.log(`[MQTT][${displayId}] reconnecting...`);
});

client.on("close", () => {
  console.log(`[MQTT][${displayId}] connection closed`);
});

client.on("message", (topic, payload) => {
  const text = payload.toString();
  process.stdout.write("\n");

  // Pretty-print chat
  const m = topic.match(/^rooms\/([^/]+)\/chat\/out$/);
  if (m) {
    try {
      const data = JSON.parse(text) as { roomId: string; fromAgentId: string; fromUsername?: string; msg: string };
      const who = data.fromUsername ? `${data.fromUsername}(${data.fromAgentId})` : data.fromAgentId;
      console.log(`[CHAT][${data.roomId}] ${who}: ${data.msg}`);
    } catch {
      console.log(`[MQTT][${displayId}] ${topic}: ${text}`);
    }

  // Pretty-print history responses
  const hr = topic.match(/^rooms\/([^/]+)\/history\/response\/([^/]+)$/);
  if (hr) {
    try {
      const data = JSON.parse(text) as { requestId: string; roomId: string; messages: any[]; nextBefore?: any; error?: string };
      if (data.error) {
        console.log(`[HISTORY][room=${data.roomId}] error: ${data.error}`);
      } else {
        console.log(`[HISTORY][room=${data.roomId}] ${data.messages?.length ?? 0} message(s)`);
        for (const m of data.messages ?? []) {
          const when = m.sentAt ?? "";
          const sender = m.senderId ?? "";
          const msg = m.text ?? "";
          console.log(`  - ${when} ${sender}: ${msg}`);
        }
        if (data.nextBefore) console.log(`[HISTORY] nextBefore=${data.nextBefore}`);
      }
    } catch {
      console.log(`[MQTT][${displayId}] ${topic}: ${text}`);
    }
    prompt();
    return;
  }

  const hs = topic.match(/^senders\/history\/response\/([^/]+)$/);
  if (hs) {
    try {
      const data = JSON.parse(text) as { requestId: string; senderType: string; senderId: string; messages: any[]; nextBefore?: any; error?: string };
      if (data.error) {
        console.log(`[HISTORY][sender=${data.senderType}:${data.senderId}] error: ${data.error}`);
      } else {
        console.log(`[HISTORY][sender=${data.senderType}:${data.senderId}] ${data.messages?.length ?? 0} message(s)`);
        for (const m of data.messages ?? []) {
          const when = m.sentAt ?? "";
          const room = m.chatroomId ?? "";
          const msg = m.text ?? "";
          console.log(`  - ${when} [${room}] ${msg}`);
        }
        if (data.nextBefore) console.log(`[HISTORY] nextBefore=${data.nextBefore}`);
      }
    } catch {
      console.log(`[MQTT][${displayId}] ${topic}: ${text}`);
    }
    prompt();
    return;
  }

  } else {
    console.log(`[MQTT][${displayId}] ${topic}: ${text}`);
  }

  prompt();
});

rl.on("line", (line) => {
  const cmd = line.trim();
  if (!cmd) return prompt();

  if (cmd === "exit") {
    publishOffline();
    if (hbTimer) clearInterval(hbTimer);
    rl.close();
    client.end(true);
    process.exit(0);
  }

  const join = cmd.match(/^join\s+(\S+)$/);
  if (join) {
    const roomId = join[1];

    if (currentRoom) {
      safePublish(
        `rooms/${currentRoom}/leave`,
        JSON.stringify({ agentId, username, ts: Date.now() })
      );
      unsubRoomChat(currentRoom);
    }

    safePublish(
      `rooms/${roomId}/join`,
      JSON.stringify({ agentId, username, ts: Date.now() })
    );
    currentRoom = roomId;
    subRoomChat(roomId);

    console.log(`[DEV][${displayId}] joined ${roomId}`);
    return prompt();
  }

  if (cmd === "leave") {
    if (!currentRoom) {
      console.log(`[DEV][${displayId}] not in a room`);
      return prompt();
    }

    safePublish(
      `rooms/${currentRoom}/leave`,
      JSON.stringify({ agentId, username, ts: Date.now() })
    );
    unsubRoomChat(currentRoom);

    console.log(`[DEV][${displayId}] left ${currentRoom}`);
    currentRoom = null;
    return prompt();
  }

  const say = cmd.match(/^say\s+(.+)$/);
  if (say) {
    if (!currentRoom) {
      console.log(`[DEV][${displayId}] join a room first`);
      return prompt();
    }

    const msg = say[1];
    safePublish(
      `rooms/${currentRoom}/chat/in`,
      JSON.stringify({
        roomId: currentRoom,
        fromAgentId: agentId,
        fromUsername: username,
        type: "text",
        msg,
        ts: Date.now(),
      })
    );

    return prompt();
  }


  const histRoom = cmd.match(/^history\s+room\s+(\S+)(?:\s+(\d+))?(?:\s+(.+))?$/);
  if (histRoom) {
    const roomId = histRoom[1];
    const limit = histRoom[2] ? Number(histRoom[2]) : 20;
    const before = histRoom[3]?.trim() ? histRoom[3].trim() : null;
    const requestId = `${agentId}-${Date.now()}`;

    safePublish(
      `rooms/${roomId}/history/request`,
      JSON.stringify({ requestId, limit, before }),
      { qos: 0, retain: false }
    );

    console.log(`[DEV][${displayId}] requested room history: room=${roomId} requestId=${requestId}`);
    return prompt();
  }

  const histSender = cmd.match(/^history\s+(agent|user)\s+(\S+)(?:\s+(\d+))?(?:\s+(.+))?$/);
  if (histSender) {
    const senderType = histSender[1] as "agent" | "user";
    const senderId = histSender[2];
    const limit = histSender[3] ? Number(histSender[3]) : 20;
    const before = histSender[4]?.trim() ? histSender[4].trim() : null;
    const requestId = `${agentId}-${Date.now()}`;

    safePublish(
      `senders/history/request`,
      JSON.stringify({ requestId, senderType, senderId, limit, before }),
      { qos: 0, retain: false }
    );

    console.log(`[DEV][${displayId}] requested sender history: ${senderType}=${senderId} requestId=${requestId}`);
    return prompt();
  }

  console.log(`[DEV][${displayId}] unknown command: ${cmd}`);
  showHelp();
  prompt();
});

let lastErrLog = 0;

client.on("error", (err: any) => {
  const code = err?.code;
  const now = Date.now();

  if (code === "ECONNREFUSED") {
    // log at most once every 3 seconds while broker is down
    if (now - lastErrLog > 3000) {
      console.log(`[MQTT][${displayId}] broker unavailable (ECONNREFUSED)`);
      lastErrLog = now;
    }
    return;
  }

  console.error(`[MQTT][${displayId}] error:`, err);
});

// optional: graceful Ctrl+C
process.on("SIGINT", () => {
  publishOffline();
  if (hbTimer) clearInterval(hbTimer);
  client.end(true, () => process.exit(0));
});
