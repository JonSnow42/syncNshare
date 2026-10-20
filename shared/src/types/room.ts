import { UserDTO } from './user';
import { QueueItemDTO } from './queue';
import { PlaybackStateDTO } from './playback';

export type RoomVisibility = 'public' | 'private';
export type RoomMemberRole = 'host' | 'member';

export interface RoomMemberDTO {
  user: UserDTO;
  role: RoomMemberRole;
  joinedAt: string;
  isOnline: boolean;
}

export interface RoomSummaryDTO {
  id: string;
  name: string;
  description?: string;
  visibility: RoomVisibility;
  host: UserDTO;
  coverGradient: string;
  capacity: number;
  memberCount: number;
  activeListenerCount: number;
  currentTrack: QueueItemDTO | null;
  isPlaying: boolean;
  inviteCode?: string;
  createdAt: string;
}

export interface RoomDetailDTO {
  room: RoomSummaryDTO;
  members: RoomMemberDTO[];
  queue: QueueItemDTO[];
  playback: PlaybackStateDTO;
  isHost: boolean;
  isMember: boolean;
}

export interface RoomInvitationDTO {
  id: string;
  room: {
    id: string;
    name: string;
    description?: string;
    coverGradient: string;
  };
  inviter: UserDTO;
  invitee: UserDTO;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
}
