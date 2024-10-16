import { UPDATE_USER } from "@repo/messages";
import { randomUUID } from "crypto";
import "dotenv/config";
import { WebSocket } from "ws";
import { userJWT } from "./utils/auth";

export class User {
  public socket: WebSocket;
  public userId: string;
  public name: string;
  public isGuest?: boolean;

  constructor(socket: WebSocket, user: userJWT) {
    this.socket = socket;
    this.userId = user.userId;
    this.name = user.name;
    this.isGuest = user.isGuest;
  }
}

class Worker {
  public socket: WebSocket;
  public workerId: string;

  constructor(socket: WebSocket) {
    this.socket = socket;
    this.workerId = randomUUID();
  }
}

class SocketManager {
  public static instance: SocketManager;
  private users: User[];
  private workers: Worker[];
  private workerSecret: string;

  constructor() {
    this.users = [];
    this.workers = [];
    this.workerSecret = process.env.WORKER_SECRET || "worker_secret";
  }

  public static getInstance(): SocketManager {
    if (!SocketManager.instance) {
      SocketManager.instance = new SocketManager();
    }
    return SocketManager.instance;
  }

  // User
  addUser(user: User) {
    this.users.push(user);
    this.userHandler(user);
  }
  removeUser(user: User) {
    this.users = this.users.filter((u) => u !== user);
  }
  private userHandler(user: User) {
    user.socket.on("message", (data: string) => {
      const message = JSON.parse(data.toString());
    });
  }

  sendMessage(payload: any, userId: string) {
    const user = this.users.find((u) => u.userId === userId);
    if (user) {
      user.socket.send(JSON.stringify({ type: UPDATE_USER, payload }));
    }
  }

  // Worker
  authenticate(secret: string) {
    return this.workerSecret === secret;
  }
  addWorker(ws: WebSocket) {
    const worker = new Worker(ws);
    this.workers.push(worker);
    this.workerHandler(worker);
    return worker;
  }
  removeWorker(worker: Worker) {
    this.workers = this.workers.filter((w) => w !== worker);
  }
  workerHandler(worker: Worker) {
    worker.socket.on("message", (data: string) => {
      const message = JSON.parse(data.toString());

      if (message.type === UPDATE_USER) {
        console.log("UPDATE_USER", message.payload);
        
        this.sendMessage(message.payload.result, message.payload.userId);
      }
    });
  }
}

export default SocketManager.getInstance();
