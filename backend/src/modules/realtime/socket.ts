import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../../config/index.js';
import { User, WhatsAppConnection } from '../../database/models/index.js';

let io: Server | null = null;

interface AuthenticatedSocket extends Socket {
  userId?: string;
  battleId?: string;
  battleRole?: string;
  battlePhone?: string;
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
    const battleId =
      socket.handshake.auth?.battleId ||
      (socket.handshake.query?.battleId as string);

    // Suporte a conexão direta da WebView de RPG sem login
    if (battleId) {
      socket.battleId = battleId;
      socket.battleRole = (socket.handshake.auth?.role || socket.handshake.query?.role || 'fighter') as string;
      socket.battlePhone = (socket.handshake.auth?.phone || socket.handshake.query?.phone) as string;
      return next();
    }

    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers.authorization?.split(' ')[1] ||
      (socket.handshake.query?.token as string);

    if (!token) {
      return next(new Error('Autenticação necessária'));
    }

    try {
      const decoded = jwt.verify(token, config.jwt.secret) as any;

      // Suporte a token de acesso à arena de RPG
      if (decoded.battleId && (decoded.role === 'fighter' || decoded.role === 'spectator')) {
        socket.battleId = decoded.battleId;
        socket.battleRole = decoded.role;
        socket.battlePhone = decoded.phone;
        return next();
      }

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
    if (socket.battleId) {
      socket.join(`battle_${socket.battleId}`);
      console.log(`[Socket] Cliente conectado à arena RPG battle_${socket.battleId} (papel: ${socket.battleRole})`);
    }

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

export function emitToBattle(battleId: string, event: string, data: any) {
  if (io) {
    io.to(`battle_${battleId}`).emit(event, data);
  }
}
