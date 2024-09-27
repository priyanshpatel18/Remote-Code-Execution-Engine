import "dotenv/config";
import jwt from "jsonwebtoken";
import { WebSocket } from "ws";
import { User } from "../SocketManager";

const SECRET_KEY = process.env.SECRET_KEY || "my_secret_key";

export interface userJWT {
  userId: string;
  name: string;
  isGuest?: boolean;
}

export const extractAuthUser = (token: string, ws: WebSocket): User => {
  const decoded = jwt.verify(token, SECRET_KEY!) as userJWT;
  return new User(ws, decoded);
};
