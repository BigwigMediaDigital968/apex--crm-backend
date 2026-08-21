// src/socket/index.ts
import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";

let io: Server | null = null;

export const initSocket = (server: HttpServer): Server => {
  io = new Server(server, {
    cors: {
      origin: "*", // Adjust CORS configuration according to your setup
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket: Socket) => {
    const userId = socket.handshake.query.userId as string;
    const role = socket.handshake.query.role as string;

    if (userId) {
      socket.join(`user:${userId}`);
    }

    if (role) {
      socket.join(`role:${role}`);
    }

    socket.on("disconnect", () => {
      // Automatic cleanup handled by socket.io
    });
  });

  return io;
};

export const getIO = (): Server | null => {
  return io;
};