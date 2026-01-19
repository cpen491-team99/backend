import mqtt from "mqtt";
import readline from "readline";

const brokerUrl = process.env.MQTT_URL ?? "mqtt://127.0.0.1:1883";

// allow: npx ts-node tools/mqtt-dev-client/index.ts agentA
const agentId = process.argv[2] ?? `agent-${Math.floor(Math.random() * 1000)}`;

let currentRoom: string | null = null;

// Last Will: if this client crashes, broker publishes offline (retained)
const client = mqtt.connect(brokerUrl, {
  clientId: `dev-${agentId}`,
  will: {
    topic: `agents/${agentId}/status`,
    payload: JSON.stringify({ status: "offline", ts: Date.now() }),
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
    console.log(`[buffered] ${topic} (outbox=${outbox.length})`);
  }
}

function flushOutbox() {
  if (outbox.length === 0) return;
  console.log(`[outbox] flushing ${outbox.length} buffered message(s)`);
  while (outbox.length > 0) {
    const msg = outbox.shift()!;
    client.publish(msg.topic, msg.payload, msg.options);
  }
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.setPrompt(`[${agentId}]> `);

// helper: subscribe to global updates
function subscribeBase() {
  client.subscribe(["rooms/state", "rooms/+/members"], (err) => {
    if (err) console.error(`[MQTT][${agentId}] subscribe error:`, err);
    else console.log(`[MQTT][${agentId}] subscribed to rooms/state + rooms/+/members`);
  });
}

// helper: subscribe/unsubscribe room chat
function subRoomChat(roomId: string) {
  client.subscribe(`rooms/${roomId}/chat/out`, (err) => {
    if (err) console.error(`[MQTT][${agentId}] subscribe chat error:`, err);
    else console.log(`[MQTT][${agentId}] subscribed to rooms/${roomId}/chat/out`);
  });
}
function unsubRoomChat(roomId: string) {
  client.unsubscribe(`rooms/${roomId}/chat/out`);
}

// presence (online retained) + heartbeat
function publishOnline() {
  safePublish(
    `agents/${agentId}/status`,
    JSON.stringify({ status: "online", ts: Date.now() }),
    { qos: 0, retain: true }
  );
}

// IMPORTANT: if you're exiting and currently disconnected,
// buffering "offline" is pointless (it will never flush), so only send if connected.
function publishOfflineBestEffort() {
  if (!client.connected) {
    console.log(`[MQTT][${agentId}] offline status not sent (already disconnected)`);
    return;
  }
  client.publish(
    `agents/${agentId}/status`,
    JSON.stringify({ status: "offline", ts: Date.now() }),
    { qos: 0, retain: true }
  );
}

let hbTimer: NodeJS.Timeout | null = null;
function startHeartbeat() {
  if (hbTimer) clearInterval(hbTimer);
  hbTimer = setInterval(() => {
    safePublish(`agents/${agentId}/heartbeat`, "1", { qos: 0, retain: false });
  }, 5000);
}
function stopHeartbeat() {
  if (hbTimer) clearInterval(hbTimer);
  hbTimer = null;
}

function showHelp() {
  console.log("Commands:");
  console.log("  join <roomId>     (e.g., join lobby)");
  console.log("  leave             (leave current room, stay online)");
  console.log("  say <message>     (send chat to current room)");
  console.log("  exit              (offline + disconnect)");
}

function prompt() {
  rl.prompt();
}

client.on("connect", () => {
  console.log(`[MQTT][${agentId}] connected: ${brokerUrl}`);

  // Re-subscribe on every connect (important after reconnect)
  subscribeBase();

  // Re-subscribe to current room chat (important after reconnect)
  if (currentRoom) {
    subRoomChat(currentRoom);
  }

  // Online + heartbeat should resume on reconnect
  publishOnline();
  startHeartbeat();

  // Re-join room after reconnect so backend restores membership
  if (currentRoom) {
    safePublish(
      `rooms/${currentRoom}/join`,
      JSON.stringify({ agentId, ts: Date.now() })
    );
  }

  // Now flush anything user typed while offline
  flushOutbox();

  showHelp();
  prompt();
});

// optional: visibility into connection state
client.on("reconnect", () => {
  console.log(`[MQTT][${agentId}] reconnecting...`);
});
client.on("offline", () => {
  console.log(`[MQTT][${agentId}] went offline`);
});
client.on("close", () => {
  console.log(`[MQTT][${agentId}] connection closed`);
});

// keep prompt clean when messages arrive
client.on("message", (topic, payload) => {
  const text = payload.toString();

  // Print message, then re-show prompt
  process.stdout.write("\n");

  // Pretty-print chat
  const m = topic.match(/^rooms\/([^/]+)\/chat\/out$/);
  if (m) {
    try {
      const data = JSON.parse(text) as { roomId: string; from: string; msg: string };
      console.log(`[CHAT][${data.roomId}] ${data.from}: ${data.msg}`);
    } catch {
      console.log(`[MQTT][${agentId}] ${topic}: ${text}`);
    }
  } else {
    console.log(`[MQTT][${agentId}] ${topic}: ${text}`);
  }

  prompt();
});

rl.on("line", (line) => {
  const cmd = line.trim();
  if (!cmd) return prompt();

  if (cmd === "exit") {
    // best effort only; if disconnected, last will / timeout cleanup handles it
    publishOfflineBestEffort();
    stopHeartbeat();
    rl.close();
    client.end(true);
    process.exit(0);
  }

  const join = cmd.match(/^join\s+(\S+)$/);
  if (join) {
    const roomId = join[1];

    // if already in a room, leave it first
    if (currentRoom) {
      safePublish(
        `rooms/${currentRoom}/leave`,
        JSON.stringify({ agentId, ts: Date.now() })
      );
      unsubRoomChat(currentRoom);
    }

    safePublish(
      `rooms/${roomId}/join`,
      JSON.stringify({ agentId, ts: Date.now() })
    );
    currentRoom = roomId;
    subRoomChat(roomId);

    console.log(`[DEV][${agentId}] joined ${roomId}`);
    return prompt();
  }

  if (cmd === "leave") {
    if (!currentRoom) {
      console.log(`[DEV][${agentId}] not in a room`);
      return prompt();
    }

    safePublish(
      `rooms/${currentRoom}/leave`,
      JSON.stringify({ agentId, ts: Date.now() })
    );
    unsubRoomChat(currentRoom);

    console.log(`[DEV][${agentId}] left ${currentRoom}`);
    currentRoom = null;
    return prompt();
  }

  const say = cmd.match(/^say\s+(.+)$/);
  if (say) {
    if (!currentRoom) {
      console.log(`[DEV][${agentId}] join a room first`);
      return prompt();
    }

    const msg = say[1];
    safePublish(
      `rooms/${currentRoom}/chat/in`,
      JSON.stringify({
        roomId: currentRoom,
        from: agentId,
        type: "text",
        msg,
        ts: Date.now(),
      })
    );

    return prompt();
  }

  console.log(`[DEV][${agentId}] unknown command: ${cmd}`);
  showHelp();
  prompt();
});

let lastErrLog = 0;

client.on("error", (err: any) => {
  // emit ECONNREFUSED repeatedly while reconnecting
  const code = err?.code;
  const now = Date.now();

  // Log at most once every 3 seconds for connection-refused errors
  if (code === "ECONNREFUSED") {
    if (now - lastErrLog > 3000) {
      console.log(`[MQTT][${agentId}] broker unavailable (ECONNREFUSED)`);
      lastErrLog = now;
    }
    return;
  }

  console.error(`[MQTT][${agentId}] error:`, err);
});

// optional: graceful Ctrl+C (this is NOT a crash simulation anymore)
process.on("SIGINT", () => {
  publishOfflineBestEffort();
  stopHeartbeat();
  rl.close();
  client.end(true);
  process.exit(0);
});
