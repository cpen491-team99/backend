import mqtt, { MqttClient } from "mqtt";

let client: MqttClient | null = null;

export function initBackendMqtt() {
  if (client) return client; // prevent double init

  const brokerUrl = process.env.MQTT_URL ?? "mqtt://localhost:1883";
  client = mqtt.connect(brokerUrl, { clientId: "backend-client" });

  client.on("connect", () => {
    console.log(`[MQTT][backend] connected: ${brokerUrl}`);

    client!.subscribe("test/in", (err) => {
      if (err) console.error("[MQTT][backend] subscribe error:", err);
      else console.log("[MQTT][backend] subscribed to test/in");
    });
  });

  client.on("message", (topic, payload) => {
    const msg = payload.toString();
    console.log(`[MQTT][backend] received ${topic}: ${msg}`);

    // Simple “echo/bridge” behavior
    client!.publish("test/out", `backend saw: ${msg}`);
  });

  client.on("error", (err) => {
    console.error("[MQTT][backend] error:", err);
  });

  return client;
}
