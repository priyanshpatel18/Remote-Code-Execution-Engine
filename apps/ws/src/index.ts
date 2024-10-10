import { CONNECTED, HEARTBEAT } from "@repo/messages";
import { IncomingMessage } from "http";
import url from "url";
import { WebSocket, WebSocketServer } from "ws";
import socketManager from "./SocketManager";
import { extractAuthUser } from "./utils/auth";

const PORT: number = Number(process.env.PORT) || 8080;
const wss = new WebSocketServer({ port: PORT, host: "0.0.0.0" });

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

console.log(`LISTENING ON PORT ${PORT}`);
