import { UserDTO } from './user';
import { RoomSummaryDTO, RoomMemberDTO } from './room';
import { QueueItemDTO } from './queue';
import { PlaybackStateDTO } from './playback';
import { ChatMessageDTO } from './chat';
import { RoomInvitationDTO } from './room';

export interface RoomPresenceData {
  roomId: string;
  activeCount: number;
  activeUsers: UserDTO[];
}

export interface ClientToServerEvents {
  'room:join': (payload: { roomId: string }, callback?: (res: { ok: boolean; error?: string }) => void) => void;
  'room:leave': (payload: { roomId: string }, callback?: (res: { ok: boolean; error?: string }) => void) => void;
  'room:invite': (payload: { roomId: string; targetUserId: string }, callback?: (res: { ok: boolean; error?: string }) => void) => void;
  'queue:add': (payload: { roomId: string; url: string }, callback?: (res: { ok: boolean; item?: QueueItemDTO; error?: string }) => void) => void;
  'queue:remove': (payload: { roomId: string; itemId: string }, callback?: (res: { ok: boolean; error?: string }) => void) => void;
  'queue:reorder': (payload: { roomId: string; itemIds: string[] }, callback?: (res: { ok: boolean; error?: string }) => void) => void;
  'playback:play': (payload: { roomId: string; trackId?: string; position?: number }, callback?: (res: { ok: boolean; error?: string }) => void) => void;
  'playback:pause': (payload: { roomId: string; position?: number }, callback?: (res: { ok: boolean; error?: string }) => void) => void;
  'playback:seek': (payload: { roomId: string; position: number }, callback?: (res: { ok: boolean; error?: string }) => void) => void;
  'chat:send': (payload: { roomId: string; content: string }, callback?: (res: { ok: boolean; error?: string }) => void) => void;
}

export interface ServerToClientEvents {
  'room:state': (data: {
    room: RoomSummaryDTO;
    members: RoomMemberDTO[];
    queue: QueueItemDTO[];
    playback: PlaybackStateDTO;
    activeUsers: UserDTO[];
  }) => void;
  'room:updated': (room: RoomSummaryDTO) => void;
  'room:presence': (data: RoomPresenceData) => void;
  'room:invitation': (invitation: RoomInvitationDTO) => void;
  'queue:updated': (data: { roomId: string; queue: QueueItemDTO[]; currentTrack: QueueItemDTO | null }) => void;
  'playback:updated': (data: { roomId: string; state: PlaybackStateDTO }) => void;
  'chat:message': (message: ChatMessageDTO) => void;
  'notification:new': (notification: { type: string; title: string; message: string; data?: any }) => void;
  'error': (error: { code: string; message: string }) => void;
}
