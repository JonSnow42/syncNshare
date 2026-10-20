import { UserDTO } from './user';

export type MediaProvider = 'youtube' | 'direct_audio';

export interface QueueItemDTO {
  id: string;
  roomId: string;
  provider: MediaProvider;
  mediaId: string;
  url: string;
  title: string;
  artist: string;
  durationSeconds: number;
  thumbnailUrl: string;
  addedBy: UserDTO;
  order: number;
  createdAt: string;
}
