import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../../config/index.js';
import { User, WhatsAppConnection } from '../../database/models/index.js';

let io: Server | null = null;

interface AuthenticatedSocket extends Socket {
  userId?: string;
}

export function initSocket(server: HttpServer): Server {
  io = new Server(server, {
    cors: {
      origin: config.corsOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // JWT Authentication middleware for Socket.IO
  io.use(async (socket: AuthenticatedSocket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers.authorization?.split(' ')[1] ||
      (socket.handshake.query?.token as string);

    if (!token) {
      return next(new Error('Autenticação necessária'));
    }

    try {
      const decoded = jwt.verify(token, config.jwt.secret) as { id: string };
      const user = await User.findByPk(decoded.id);

      if (!user || user.status === 'suspended') {
        return next(new Error('Usuário inválido ou suspenso'));
      }

      socket.userId = user.id;
      next();
    } catch (err) {
      next(new Error('Token inválido'));
    }
  });

  io.on('connection', async (socket: AuthenticatedSocket) => {
    const userId = socket.userId;
    if (userId) {
      socket.join(`user_${userId}`);

      try {
        const userConnections = await WhatsAppConnection.findAll({
          where: { userId },
          attributes: ['id'],
        });
        for (const conn of userConnections) {
          socket.join(`conn_${conn.id}`);
        }
      } catch (err) {
        console.error('Error auto-joining user connections:', err);
      }
    }

    // Allow joining specific connection rooms only if owned by this user
    socket.on('join_connection', async (connectionId: string) => {
      if (!userId) return;
      const connection = await WhatsAppConnection.findOne({
        where: { id: connectionId, userId },
      });
      if (connection) {
        socket.join(`conn_${connectionId}`);
      }
    });

    socket.on('leave_connection', (connectionId: string) => {
      socket.leave(`conn_${connectionId}`);
    });
  });

  return io;
}

export function getIO(): Server | null {
  return io;
}

export function emitToUser(userId: string, event: string, data: any) {
  if (io) {
    io.to(`user_${userId}`).emit(event, data);
  }
}

export function emitToConnection(connectionId: string, event: string, data: any) {
  if (io) {
    io.to(`conn_${connectionId}`).emit(event, data);
  }
}
