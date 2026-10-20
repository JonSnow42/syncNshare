import { Types } from 'mongoose';
import { QueueItemDTO } from '@syncnshare/shared';
import { QueueItem, IQueueItem } from '../models/QueueItem';
import { Room } from '../models/Room';
import { RoomMember } from '../models/RoomMember';
import { PlaybackState } from '../models/PlaybackState';
import { resolveMediaMetadata } from './metadata.service';
import { AppError, ForbiddenError, NotFoundError } from '../utils/errors';

export async function addQueueItem(
  roomId: string,
  userId: string,
  url: string
): Promise<QueueItemDTO> {
  const room = await Room.findById(roomId);
  if (!room || !room.isActive) {
    throw new NotFoundError('Room not found or no longer active.');
  }

  // Ensure user is member
  const isMember = await RoomMember.findOne({ room: room._id, user: userId });
  if (!isMember) {
    throw new ForbiddenError('You must join the room before adding songs.');
  }

  // Resolve media metadata safely
  const media = await resolveMediaMetadata(url);

  // Get current highest order in the room queue
  const lastItem = await QueueItem.findOne({ room: room._id }).sort({ order: -1 });
  const nextOrder = lastItem ? lastItem.order + 1 : 0;

  const queueItem = await QueueItem.create({
    room: room._id,
    provider: media.provider,
    mediaId: media.mediaId,
    url: media.url,
    title: media.title,
    artist: media.artist,
    durationSeconds: media.durationSeconds,
    thumbnailUrl: media.thumbnailUrl,
    addedBy: userId,
    order: nextOrder,
  });

  await queueItem.populate('addedBy');

  // If playback state currently has no currentTrack, set it to this newly added track
  const playback = await PlaybackState.findOne({ room: room._id });
  if (playback && !playback.currentTrack) {
    playback.currentTrack = queueItem._id as Types.ObjectId;
    playback.positionSeconds = 0;
    playback.serverTimestamp = Date.now();
    await playback.save();
  }

  const addedByDoc = queueItem.addedBy as any;
  return {
    id: queueItem._id.toString(),
    roomId,
    provider: queueItem.provider,
    mediaId: queueItem.mediaId,
    url: queueItem.url,
    title: queueItem.title,
    artist: queueItem.artist,
    durationSeconds: queueItem.durationSeconds,
    thumbnailUrl: queueItem.thumbnailUrl,
    addedBy: addedByDoc.toDTO ? addedByDoc.toDTO() : addedByDoc,
    order: queueItem.order,
    createdAt: queueItem.createdAt.toISOString(),
  };
}

export async function removeQueueItem(
  roomId: string,
  userId: string,
  itemId: string
): Promise<{ ok: boolean; nextTrackId?: string | null }> {
  const room = await Room.findById(roomId);
  if (!room) {
    throw new NotFoundError('Room not found.');
  }

  const item = await QueueItem.findById(itemId);
  if (!item || item.room.toString() !== roomId) {
    throw new NotFoundError('Queue item not found in this room.');
  }

  const isHost = room.host.toString() === userId;
  const isAdder = item.addedBy.toString() === userId;

  if (!isHost && !isAdder) {
    throw new ForbiddenError('Only the host or the user who queued this song can remove it.');
  }

  await QueueItem.findByIdAndDelete(itemId);

  // If the removed item was currently playing, switch to next track or null
  const playback = await PlaybackState.findOne({ room: room._id });
  let nextTrackId: string | null = null;
  if (playback && playback.currentTrack?.toString() === itemId) {
    const nextItem = await QueueItem.findOne({ room: room._id }).sort({ order: 1 });
    playback.currentTrack = nextItem ? (nextItem._id as Types.ObjectId) : null;
    playback.isPlaying = false;
    playback.positionSeconds = 0;
    playback.serverTimestamp = Date.now();
    await playback.save();
    nextTrackId = nextItem ? nextItem._id.toString() : null;
  }

  // Re-sequence remaining items
  const remaining = await QueueItem.find({ room: room._id }).sort({ order: 1 });
  for (let i = 0; i < remaining.length; i++) {
    if (remaining[i].order !== i) {
      remaining[i].order = i;
      await remaining[i].save();
    }
  }

  return { ok: true, nextTrackId };
}

export async function reorderQueue(
  roomId: string,
  userId: string,
  itemIds: string[]
): Promise<QueueItemDTO[]> {
  const room = await Room.findById(roomId);
  if (!room) {
    throw new NotFoundError('Room not found.');
  }

  // Only host or authorized members
  const member = await RoomMember.findOne({ room: room._id, user: userId });
  if (!member) {
    throw new ForbiddenError('Only room members can reorder the queue.');
  }

  for (let i = 0; i < itemIds.length; i++) {
    await QueueItem.findOneAndUpdate(
      { _id: itemIds[i], room: room._id },
      { order: i }
    );
  }

  return getRoomQueue(roomId);
}

export async function getRoomQueue(roomId: string): Promise<QueueItemDTO[]> {
  const items = await QueueItem.find({ room: roomId }).populate('addedBy').sort({ order: 1 });

  return items.map((q: any) => ({
    id: q._id.toString(),
    roomId,
    provider: q.provider,
    mediaId: q.mediaId,
    url: q.url,
    title: q.title,
    artist: q.artist,
    durationSeconds: q.durationSeconds,
    thumbnailUrl: q.thumbnailUrl,
    addedBy: q.addedBy.toDTO ? q.addedBy.toDTO() : q.addedBy,
    order: q.order,
    createdAt: q.createdAt.toISOString(),
  }));
}
