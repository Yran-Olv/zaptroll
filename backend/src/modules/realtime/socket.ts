import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../../config/index.js';
import { User, WhatsAppConnection } from '../../database/models/index.js';
import { RpgAccessCodeService } from '../rpg/services/RpgAccessCodeService.js';

let io: Server | null = null;

interface AuthenticatedSocket extends Socket {
  userId?: string;
  battleId?: string;
  battleRole?: string;
  battlePhone?: string;
  battleParticipantId?: string;
  battleCode?: string;
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

  // JWT / Code Authentication middleware for Socket.IO
  io.use(async (socket: AuthenticatedSocket, next) => {
    // 1. Autenticação prioritária pelo Código Seguro Base62 (/a/{codigo})
    const rawCode =
      socket.handshake.auth?.code ||
      socket.handshake.headers['x-access-code'] ||
      (socket.handshake.query?.code as string);

    if (rawCode) {
      try {
        const clientIp = socket.handshake.address;
        const userAgent = socket.handshake.headers['user-agent'] as string;
        const validation = await RpgAccessCodeService.validateCode(rawCode, clientIp, userAgent);

        if (!validation.valid || !validation.record) {
          return next(new Error('Código de acesso inválido ou expirado.'));
        }

        const access = validation.record;
        socket.battleId = access.battleId;
        socket.battleRole = access.role;
        socket.battlePhone = access.phone || undefined;
        socket.battleParticipantId = access.participantId || undefined;
        socket.battleCode = access.code;
        return next();
      } catch (err: any) {
        return next(new Error('Erro ao validar código de acesso.'));
      }
    }

    const battleId =
      socket.handshake.auth?.battleId ||
      (socket.handshake.query?.battleId as string);

    // Suporte legado a conexão direta com battleId
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

      // Suporte a token JWT de arena
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
      // Sala pública da batalha (recebe eventos públicos de animação e início de turno)
      socket.join(`battle_${socket.battleId}_public`);
      socket.join(`battle_${socket.battleId}`); // alias de retrocompatibilidade

      if (socket.battleRole === 'fighter') {
        // Sala privada estrita do jogador (recebe cartas secretas e confirmação pessoal)
        if (socket.battleParticipantId) {
          socket.join(`battle_${socket.battleId}_player_${socket.battleParticipantId}`);
        }
        if (socket.battlePhone) {
          socket.join(`battle_${socket.battleId}_player_${socket.battlePhone}`);
        }
        console.log(`[Socket] ⚔️ Lutador autenticado na arena battle_${socket.battleId} (participante: ${socket.battleParticipantId || socket.battlePhone})`);
      } else {
        console.log(`[Socket] 👁️ Espectador conectado à arena battle_${socket.battleId} (código: ${socket.battleCode || 'anon'})`);
      }
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
