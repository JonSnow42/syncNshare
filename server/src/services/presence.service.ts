import { UserDTO } from '@syncnshare/shared';

interface ConnectedSocket {
  socketId: string;
  user: UserDTO;
  rooms: Set<string>;
}

class PresenceService {
  private sockets = new Map<string, ConnectedSocket>();
  private userToSockets = new Map<string, Set<string>>();
  private roomToUsers = new Map<string, Map<string, UserDTO>>();

  public trackUser(socketId: string, user: UserDTO): void {
    const existing = this.sockets.get(socketId);
    if (existing) {
      existing.user = user;
      return;
    }

    this.sockets.set(socketId, {
      socketId,
      user,
      rooms: new Set(),
    });

    let userSockets = this.userToSockets.get(user.id);
    if (!userSockets) {
      userSockets = new Set();
      this.userToSockets.set(user.id, userSockets);
    }
    userSockets.add(socketId);
  }

  public userJoinRoom(socketId: string, roomId: string): { user: UserDTO; changed: boolean } | null {
    const conn = this.sockets.get(socketId);
    if (!conn) return null;

    conn.rooms.add(roomId);

    let roomUsers = this.roomToUsers.get(roomId);
    if (!roomUsers) {
      roomUsers = new Map();
      this.roomToUsers.set(roomId, roomUsers);
    }

    const changed = !roomUsers.has(conn.user.id);
    roomUsers.set(conn.user.id, conn.user);

    return { user: conn.user, changed };
  }

  public userLeaveRoom(socketId: string, roomId: string): { user: UserDTO; changed: boolean } | null {
    const conn = this.sockets.get(socketId);
    if (!conn) return null;

    conn.rooms.delete(roomId);

    const roomUsers = this.roomToUsers.get(roomId);
    if (!roomUsers) return null;

    // Check if user has other open sockets in this room
    const otherSockets = this.userToSockets.get(conn.user.id);
    let hasOtherInRoom = false;
    if (otherSockets) {
      for (const sId of otherSockets) {
        if (sId !== socketId && this.sockets.get(sId)?.rooms.has(roomId)) {
          hasOtherInRoom = true;
          break;
        }
      }
    }

    let changed = false;
    if (!hasOtherInRoom) {
      changed = roomUsers.delete(conn.user.id);
      if (roomUsers.size === 0) {
        this.roomToUsers.delete(roomId);
      }
    }

    return { user: conn.user, changed };
  }

  public removeSocket(socketId: string): { user: UserDTO | null; leftRooms: string[] } {
    const conn = this.sockets.get(socketId);
    if (!conn) return { user: null, leftRooms: [] };

    const { user, rooms } = conn;
    const leftRooms: string[] = [];

    for (const roomId of rooms) {
      const res = this.userLeaveRoom(socketId, roomId);
      if (res && res.changed) {
        leftRooms.push(roomId);
      }
    }

    this.sockets.delete(socketId);

    const userSockets = this.userToSockets.get(user.id);
    if (userSockets) {
      userSockets.delete(socketId);
      if (userSockets.size === 0) {
        this.userToSockets.delete(user.id);
      }
    }

    return { user, leftRooms };
  }

  public getRoomPresence(roomId: string): UserDTO[] {
    const roomUsers = this.roomToUsers.get(roomId);
    if (!roomUsers) return [];
    return Array.from(roomUsers.values());
  }

  public getSocketUser(socketId: string): UserDTO | null {
    return this.sockets.get(socketId)?.user || null;
  }

  public getUserSocketIds(userId: string): string[] {
    const sockets = this.userToSockets.get(userId);
    return sockets ? Array.from(sockets) : [];
  }
}

export const presenceService = new PresenceService();
