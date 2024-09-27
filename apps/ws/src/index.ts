import { CONNECTED, HEARTBEAT } from "@repo/messages";
import url from "url";
import { WebSocket, WebSocketServer } from "ws";
import { extractAuthUser } from "./utils/auth";
import socketManager from "./SocketManager";

const PORT: number = Number(process.env.PORT) || 8080;
const wss = new WebSocketServer({ port: 8080 });

wss.on("connection", (ws: WebSocket, req: Request) => {
  const queryParams = url.parse(req.url, true).query;
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
