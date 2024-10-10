import { CONNECTED, HEARTBEAT } from "@repo/messages";
import { IncomingMessage } from "http";
import url from "url";
import { WebSocket, WebSocketServer } from "ws";
import socketManager from "./SocketManager";
import { extractAuthUser } from "./utils/auth";

// Certificate
import fs from "fs";
import https from "https";

// HTTPS Server
const server = https.createServer({
  cert: fs.readFileSync(process.env.SSL_CERT || ""),
  key: fs.readFileSync(process.env.SSL_KEY || ""),
});

// WebSocket Server
const wss = new WebSocketServer({ server });

wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
  const parsedUrl = url.parse(req.url || "", true);
  const queryParams = parsedUrl.query;

  const token = queryParams.token;
  const workerSecret = queryParams.workerSecret;

  if (workerSecret && typeof workerSecret === "string") {
    if (socketManager.authenticate(workerSecret as string)) {
      const worker = socketManager.addWorker(ws);
      ws.send(JSON.stringify({ type: CONNECTED, workerId: worker.workerId }));
    }
    return;
  }

  if (!token || typeof token !== "string") {
    ws.close(4001, "Token not provided");
    return;
  }

  const user = extractAuthUser(token, ws);
  socketManager.addUser(user);
  ws.send(JSON.stringify({ type: CONNECTED, payload: user.userId }));

  // Heartbeat Algorithm
  ws.on("message", (data: string) => {
    const message = JSON.parse(data.toString());

    if (message.type === HEARTBEAT) {
      ws.send(JSON.stringify({ type: HEARTBEAT }));
    }
  });

  ws.on("close", () => {
    socketManager.removeUser(user);
  });
});

// Start Server
const PORT: number = Number(process.env.PORT) || 443;
server.listen(PORT, () => {
  console.log(`WebSocket server is running on wss://ws.priyanshpatel.site`);
});
