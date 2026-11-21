// Minimal service used to demonstrate the JFrog security gates; the code itself is irrelevant.
const http = require("node:http");
const ms = require("ms");

const startedAt = Date.now();
http
  .createServer((_req, res) => {
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ service: "orders-web", uptime: ms(Date.now() - startedAt) }));
  })
  .listen(process.env.PORT || 3000);
