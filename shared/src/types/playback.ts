import { QueueItemDTO } from './queue';

export interface PlaybackStateDTO {
  roomId: string;
  currentTrack: QueueItemDTO | null;
  isPlaying: boolean;
  positionSeconds: number;
  serverTimestamp: number; // Date.now() Epoch milliseconds
  updatedAt: string;
}
