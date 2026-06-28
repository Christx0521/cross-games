import { io, type Socket } from "socket.io-client";
import { API_BASE } from "./api.ts";

let socket: Socket | null = null;

// Socket compartido, autenticado vía cookie de sesión (withCredentials).
export function getSocket(): Socket {
  if (!socket) {
    socket = io(API_BASE, { withCredentials: true, autoConnect: true });
  }
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}
