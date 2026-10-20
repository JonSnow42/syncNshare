import { Server as SocketIOServer, Socket } from 'socket.io';
import cookie from 'cookie';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  UserDTO,
} from '@syncnshare/shared';
import { verifyToken, COOKIE_NAME } from '../utils/jwt';
import { User } from '../models/User';
import { presenceService } from '../services/presence.service';
import * as roomService from '../services/room.service';
import * as queueService from '../services/queue.service';
import * as playbackService from '../services/playback.service';
import * as chatService from '../services/chat.service';
import { logger } from '../utils/logger';

export type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, { user: UserDTO }>;

export function setupSocketIO(io: SocketIOServer<ClientToServerEvents, ServerToClientEvents, Record<string, never>, { user: UserDTO }>): void {
  // Authentication middleware for Socket.IO
  io.use(async (socket, next) => {
    try {
      let token = socket.handshake.auth?.token;

      if (!token && socket.handshake.headers.cookie) {
        const parsedCookies = cookie.parse(socket.handshake.headers.cookie);
        token = parsedCookies[COOKIE_NAME];
      }

      if (!token) {
        return next(new Error('Authentication required for real-time connection.'));
      }

      const payload = verifyToken(token);
      if (!payload?.userId) {
        return next(new Error('Invalid or expired authentication token.'));
      }

      const user = await User.findById(payload.userId);
      if (!user) {
        return next(new Error('User account not found.'));
      }

      socket.data.user = user.toDTO();
      presenceService.trackUser(socket.id, user.toDTO());
      next();
    } catch (err) {
      logger.warn({ err }, 'Socket handshake authentication rejected');
      next(new Error('Authentication failed.'));
    }
  });

  io.on('connection', (socket: TypedSocket) => {
    const user = socket.data.user;
    logger.info({ socketId: socket.id, userId: user.id }, 'Socket connected and authenticated');

    // 1. Join room
    socket.on('room:join', async ({ roomId }, callback) => {
      try {
        await roomService.joinRoom(roomId, user.id);
        const roomDetail = await roomService.getRoomDetail(roomId, user.id);
        const channel = `room:${roomId}`;

        socket.join(channel);
        presenceService.userJoinRoom(socket.id, roomId);

        const activeUsers = presenceService.getRoomPresence(roomId);

        // Notify other room listeners of presence update
        io.to(channel).emit('room:presence', {
          roomId,
          activeCount: activeUsers.length,
          activeUsers,
        });

        // Send full room state to newly joined socket
        socket.emit('room:state', {
          room: roomDetail.room,
          members: roomDetail.members,
          queue: roomDetail.queue,
          playback: roomDetail.playback,
          activeUsers,
        });

        if (callback) callback({ ok: true });
      } catch (err: any) {
        logger.warn({ err: err.message, roomId, userId: user.id }, 'Failed to join room via socket');
        socket.emit('error', { code: 'JOIN_ERROR', message: err.message || 'Could not join room' });
        if (callback) callback({ ok: false, error: err.message });
      }
    });

    // 2. Leave room
    socket.on('room:leave', async ({ roomId }, callback) => {
      try {
        const channel = `room:${roomId}`;
        socket.leave(channel);
        presenceService.userLeaveRoom(socket.id, roomId);

        const activeUsers = presenceService.getRoomPresence(roomId);
        io.to(channel).emit('room:presence', {
          roomId,
          activeCount: activeUsers.length,
          activeUsers,
        });

        if (callback) callback({ ok: true });
      } catch (err: any) {
        if (callback) callback({ ok: false, error: err.message });
      }
    });

    // 3. Invite friend to room
    socket.on('room:invite', async ({ roomId, targetUserId }, callback) => {
      try {
        const invitation = await roomService.inviteFriendToRoom(roomId, user.id, targetUserId);

        // Notify invited friend across their active sockets
        const targetSocketIds = presenceService.getUserSocketIds(targetUserId);
        for (const sId of targetSocketIds) {
          io.to(sId).emit('room:invitation', invitation);
        }

        if (callback) callback({ ok: true });
      } catch (err: any) {
        if (callback) callback({ ok: false, error: err.message });
      }
    });

    // 4. Add to queue
    socket.on('queue:add', async ({ roomId, url }, callback) => {
      try {
        const item = await queueService.addQueueItem(roomId, user.id, url);
        const [updatedQueue, updatedPlayback] = await Promise.all([
          queueService.getRoomQueue(roomId),
          playbackService.getPlaybackState(roomId),
        ]);

        const channel = `room:${roomId}`;
        io.to(channel).emit('queue:updated', {
          roomId,
          queue: updatedQueue,
          currentTrack: updatedPlayback.currentTrack,
        });

        io.to(channel).emit('playback:updated', {
          roomId,
          state: updatedPlayback,
        });

        if (callback) callback({ ok: true, item });
      } catch (err: any) {
        socket.emit('error', { code: 'QUEUE_ADD_ERROR', message: err.message });
        if (callback) callback({ ok: false, error: err.message });
      }
    });

    // 5. Remove from queue
    socket.on('queue:remove', async ({ roomId, itemId }, callback) => {
      try {
        await queueService.removeQueueItem(roomId, user.id, itemId);
        const [updatedQueue, updatedPlayback] = await Promise.all([
          queueService.getRoomQueue(roomId),
          playbackService.getPlaybackState(roomId),
        ]);

        const channel = `room:${roomId}`;
        io.to(channel).emit('queue:updated', {
          roomId,
          queue: updatedQueue,
          currentTrack: updatedPlayback.currentTrack,
        });

        io.to(channel).emit('playback:updated', {
          roomId,
          state: updatedPlayback,
        });

        if (callback) callback({ ok: true });
      } catch (err: any) {
        socket.emit('error', { code: 'QUEUE_REMOVE_ERROR', message: err.message });
        if (callback) callback({ ok: false, error: err.message });
      }
    });

    // 6. Reorder queue
    socket.on('queue:reorder', async ({ roomId, itemIds }, callback) => {
      try {
        const updatedQueue = await queueService.reorderQueue(roomId, user.id, itemIds);
        const playback = await playbackService.getPlaybackState(roomId);

        io.to(`room:${roomId}`).emit('queue:updated', {
          roomId,
          queue: updatedQueue,
          currentTrack: playback.currentTrack,
        });

        if (callback) callback({ ok: true });
      } catch (err: any) {
        socket.emit('error', { code: 'QUEUE_REORDER_ERROR', message: err.message });
        if (callback) callback({ ok: false, error: err.message });
      }
    });

    // 7. Playback: Play (Host Only)
    socket.on('playback:play', async ({ roomId, trackId, position }, callback) => {
      try {
        const state = await playbackService.playTrack(roomId, user.id, trackId, position);
        io.to(`room:${roomId}`).emit('playback:updated', { roomId, state });
        if (callback) callback({ ok: true });
      } catch (err: any) {
        socket.emit('error', { code: 'PLAYBACK_ERROR', message: err.message });
        if (callback) callback({ ok: false, error: err.message });
      }
    });

    // 8. Playback: Pause (Host Only)
    socket.on('playback:pause', async ({ roomId, position }, callback) => {
      try {
        const state = await playbackService.pauseTrack(roomId, user.id, position);
        io.to(`room:${roomId}`).emit('playback:updated', { roomId, state });
        if (callback) callback({ ok: true });
      } catch (err: any) {
        socket.emit('error', { code: 'PLAYBACK_ERROR', message: err.message });
        if (callback) callback({ ok: false, error: err.message });
      }
    });

    // 9. Playback: Seek (Host Only)
    socket.on('playback:seek', async ({ roomId, position }, callback) => {
      try {
        const state = await playbackService.seekTrack(roomId, user.id, position);
        io.to(`room:${roomId}`).emit('playback:updated', { roomId, state });
        if (callback) callback({ ok: true });
      } catch (err: any) {
        socket.emit('error', { code: 'PLAYBACK_ERROR', message: err.message });
        if (callback) callback({ ok: false, error: err.message });
      }
    });

    // 10. Chat Message
    socket.on('chat:send', async ({ roomId, content }, callback) => {
      try {
        const message = await chatService.sendMessage(roomId, user.id, content);
        io.to(`room:${roomId}`).emit('chat:message', message);
        if (callback) callback({ ok: true });
      } catch (err: any) {
        socket.emit('error', { code: 'CHAT_ERROR', message: err.message });
        if (callback) callback({ ok: false, error: err.message });
      }
    });

    // Disconnect handling
    socket.on('disconnect', () => {
      const { leftRooms } = presenceService.removeSocket(socket.id);
      logger.info({ socketId: socket.id, userId: user.id, leftRooms }, 'Socket disconnected');

      for (const roomId of leftRooms) {
        const activeUsers = presenceService.getRoomPresence(roomId);
        io.to(`room:${roomId}`).emit('room:presence', {
          roomId,
          activeCount: activeUsers.length,
          activeUsers,
        });
      }
    });
  });
}
