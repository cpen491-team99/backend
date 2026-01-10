const express = require("express");

const app = express();
const host = "localhost";
const port = 3000;

app.get("/", (req, res) => {
  res.send("Server is running.");
});

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.listen(port, host, () => {
  console.log(`Listening on http://${host}:${port}`);
});
