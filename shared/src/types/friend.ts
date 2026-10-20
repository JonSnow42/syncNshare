import { UserDTO } from './user';

export type FriendshipStatus = 'pending' | 'accepted' | 'declined';

export interface FriendRequestDTO {
  id: string;
  requester: UserDTO;
  recipient: UserDTO;
  status: FriendshipStatus;
  createdAt: string;
}

export interface FriendSummaryDTO {
  friendshipId: string;
  friend: UserDTO;
  establishedAt: string;
}

export interface UserSearchDTO {
  id: string;
  displayName: string;
  email: string;
  avatar?: string;
  friendshipStatus?: 'none' | 'pending_sent' | 'pending_received' | 'friends';
}
