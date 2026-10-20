import { Types } from 'mongoose';
import { PlaybackStateDTO, QueueItemDTO } from '@syncnshare/shared';
import { PlaybackState, IPlaybackState } from '../models/PlaybackState';
import { Room } from '../models/Room';
import { QueueItem } from '../models/QueueItem';
import { ForbiddenError, NotFoundError } from '../utils/errors';

function calculateCurrentPosition(playback: IPlaybackState): number {
  if (!playback.isPlaying) {
    return playback.positionSeconds;
  }
  const elapsed = (Date.now() - playback.serverTimestamp) / 1000;
  return playback.positionSeconds + Math.max(0, elapsed);
}

export async function getPlaybackState(roomId: string): Promise<PlaybackStateDTO> {
  const playback = await PlaybackState.findOne({ room: roomId }).populate({
    path: 'currentTrack',
    populate: { path: 'addedBy' },
  });

  if (!playback) {
    throw new NotFoundError('Playback state not found.');
  }

  let currentTrackDTO: QueueItemDTO | null = null;
  if (playback.currentTrack) {
    const ct: any = playback.currentTrack;
    currentTrackDTO = {
      id: ct._id.toString(),
      roomId,
      provider: ct.provider,
      mediaId: ct.mediaId,
      url: ct.url,
      title: ct.title,
      artist: ct.artist,
      durationSeconds: ct.durationSeconds,
      thumbnailUrl: ct.thumbnailUrl,
      addedBy: ct.addedBy?.toDTO ? ct.addedBy.toDTO() : ct.addedBy,
      order: ct.order,
      createdAt: ct.createdAt.toISOString(),
    };
  }

  return {
    roomId,
    currentTrack: currentTrackDTO,
    isPlaying: playback.isPlaying,
    positionSeconds: calculateCurrentPosition(playback),
    serverTimestamp: Date.now(),
    updatedAt: playback.updatedAt.toISOString(),
  };
}

export async function playTrack(
  roomId: string,
  userId: string,
  trackId?: string,
  position?: number
): Promise<PlaybackStateDTO> {
  const room = await Room.findById(roomId);
  if (!room) throw new NotFoundError('Room not found.');

  // Only host can control playback
  if (room.host.toString() !== userId) {
    throw new ForbiddenError('Only the room host can control playback.');
  }

  let playback = await PlaybackState.findOne({ room: roomId });
  if (!playback) {
    playback = await PlaybackState.create({
      room: room._id,
      currentTrack: null,
      isPlaying: false,
      positionSeconds: 0,
      serverTimestamp: Date.now(),
    });
  }

  if (trackId) {
    const track = await QueueItem.findOne({ _id: trackId, room: roomId });
    if (!track) throw new NotFoundError('Queue item not found.');
    playback.currentTrack = track._id as Types.ObjectId;
    playback.positionSeconds = typeof position === 'number' ? Math.max(0, position) : 0;
  } else if (!playback.currentTrack) {
    // If no current track, select the first in queue
    const firstTrack = await QueueItem.findOne({ room: roomId }).sort({ order: 1 });
    if (firstTrack) {
      playback.currentTrack = firstTrack._id as Types.ObjectId;
      playback.positionSeconds = 0;
    }
  } else if (typeof position === 'number') {
    playback.positionSeconds = Math.max(0, position);
  }

  playback.isPlaying = true;
  playback.serverTimestamp = Date.now();
  await playback.save();

  return getPlaybackState(roomId);
}

export async function pauseTrack(
  roomId: string,
  userId: string,
  position?: number
): Promise<PlaybackStateDTO> {
  const room = await Room.findById(roomId);
  if (!room) throw new NotFoundError('Room not found.');

  if (room.host.toString() !== userId) {
    throw new ForbiddenError('Only the room host can control playback.');
  }

  const playback = await PlaybackState.findOne({ room: roomId });
  if (!playback) throw new NotFoundError('Playback state not found.');

  const actualPosition =
    typeof position === 'number' ? Math.max(0, position) : calculateCurrentPosition(playback);

  playback.isPlaying = false;
  playback.positionSeconds = actualPosition;
  playback.serverTimestamp = Date.now();
  await playback.save();

  return getPlaybackState(roomId);
}

export async function seekTrack(
  roomId: string,
  userId: string,
  position: number
): Promise<PlaybackStateDTO> {
  const room = await Room.findById(roomId);
  if (!room) throw new NotFoundError('Room not found.');

  if (room.host.toString() !== userId) {
    throw new ForbiddenError('Only the room host can control playback.');
  }

  const playback = await PlaybackState.findOne({ room: roomId });
  if (!playback) throw new NotFoundError('Playback state not found.');

  playback.positionSeconds = Math.max(0, position);
  playback.serverTimestamp = Date.now();
  await playback.save();

  return getPlaybackState(roomId);
}

export async function skipNextTrack(roomId: string, userId: string): Promise<PlaybackStateDTO> {
  const room = await Room.findById(roomId);
  if (!room) throw new NotFoundError('Room not found.');

  if (room.host.toString() !== userId) {
    throw new ForbiddenError('Only the room host can control playback.');
  }

  const playback = await PlaybackState.findOne({ room: roomId });
  if (!playback) throw new NotFoundError('Playback state not found.');

  let nextTrack: any = null;
  if (playback.currentTrack) {
    const current = await QueueItem.findById(playback.currentTrack);
    if (current) {
      nextTrack = await QueueItem.findOne({
        room: roomId,
        order: { $gt: current.order },
      }).sort({ order: 1 });
    }
  }

  if (!nextTrack) {
    // Loop to first track or stop
    nextTrack = await QueueItem.findOne({ room: roomId }).sort({ order: 1 });
  }

  playback.currentTrack = nextTrack ? (nextTrack._id as Types.ObjectId) : null;
  playback.positionSeconds = 0;
  playback.serverTimestamp = Date.now();
  playback.isPlaying = !!nextTrack;
  await playback.save();

  return getPlaybackState(roomId);
}
