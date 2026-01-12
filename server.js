const express = require("express");

// require TS output
const { initBackendMqtt } = require("./dist/src/mqtt/backendClient");

const app = express();
const host = "localhost";
const port = 3000;

// init mqtt startup
initBackendMqtt();

app.get("/", (req, res) => {
  res.send("Server is running.");
});

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.listen(port, host, () => {
  console.log(`Listening on http://${host}:${port}`);
});
