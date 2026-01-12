"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mqtt_1 = __importDefault(require("mqtt"));
const readline_1 = __importDefault(require("readline"));
const brokerUrl = process.env.MQTT_URL ?? "mqtt://localhost:1883";
const client = mqtt_1.default.connect(brokerUrl, { clientId: "dev-frontend-client" });
let prompting = false;
const rl = readline_1.default.createInterface({
    input: process.stdin,
    output: process.stdout,
});
function prompt() {
    if (prompting)
        return;
    prompting = true;
    rl.question("> type message to send (or 'exit'): ", (line) => {
        prompting = false;
        const msg = line.trim();
        if (!msg)
            return prompt();
        if (msg.toLowerCase() === "exit") {
            rl.close();
            client.end(true);
            process.exit(0);
        }
        client.publish("test/in", msg);
        console.log(`[MQTT][dev] published to test/in: ${msg}`);
        prompt();
    });
}
client.on("connect", () => {
    console.log(`[MQTT][dev] connected: ${brokerUrl}`);
    client.subscribe("test/out", (err) => {
        if (err)
            console.error("[MQTT][dev] subscribe error:", err);
        else
            console.log("[MQTT][dev] subscribed to test/out");
    });
    // Publish once to trigger backend
    client.publish("test/in", "hello from dev client");
    console.log("[MQTT][dev] published to test/in");
    // Send type message
    console.log("Ready. Messages you type will be sent to test/in.");
    prompt();
});
client.on("message", (topic, payload) => {
    console.log(`[MQTT][dev] received ${topic}: ${payload.toString()}`);
    prompt();
});
client.on("error", (err) => {
    console.error("[MQTT][dev] error:", err);
});
