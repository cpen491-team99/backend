import express from "express";
import { initBackendMqtt } from "./dist/src/mqtt/backendClient.js";

const app = express();


const host = "127.0.0.1";
// 3000 3001 8080
const port = 8080;

initBackendMqtt();

app.get("/", (_req, res) => res.send("Server is running."));
app.get("/health", (_req, res) => res.json({ ok: true }));

const server = app.listen(port, host, () => {
  console.log(`Listening on http://${host}:${port}`);
});

server.on("error", (err) => {
  console.error("Server listen error:", err);
});
