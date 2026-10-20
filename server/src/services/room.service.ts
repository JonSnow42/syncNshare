import { Types } from 'mongoose';
import {
  CreateRoomInput,
  RoomSummaryDTO,
  RoomDetailDTO,
  RoomInvitationDTO,
  RoomMemberDTO,
} from '@syncnshare/shared';
import { Room, IRoom } from '../models/Room';
import { RoomMember } from '../models/RoomMember';
import { RoomInvitation } from '../models/RoomInvitation';
import { PlaybackState } from '../models/PlaybackState';
import { QueueItem } from '../models/QueueItem';
import { Friendship } from '../models/Friendship';
import { User } from '../models/User';
import { presenceService } from './presence.service';
import { AppError, ForbiddenError, NotFoundError } from '../utils/errors';

export async function createRoom(hostId: string, input: CreateRoomInput): Promise<RoomSummaryDTO> {
  const host = await User.findById(hostId);
  if (!host) {
    throw new NotFoundError('Host user not found.');
  }

  const room = await Room.create({
    name: input.name,
    description: input.description || '',
    visibility: input.visibility || 'public',
    host: host._id,
    capacity: input.capacity || 50,
    coverGradient: input.coverGradient || 'from-violet-600 to-indigo-900',
    isActive: true,
  });

  // Create initial Host membership
  await RoomMember.create({
    room: room._id,
    user: host._id,
    role: 'host',
  });

  // Create authoritative initial PlaybackState
  await PlaybackState.create({
    room: room._id,
    currentTrack: null,
    isPlaying: false,
    positionSeconds: 0,
    serverTimestamp: Date.now(),
  });

  return {
    id: room._id.toString(),
    name: room.name,
    description: room.description,
    visibility: room.visibility,
    host: host.toDTO(),
    coverGradient: room.coverGradient,
    capacity: room.capacity,
    memberCount: 1,
    activeListenerCount: 0,
    currentTrack: null,
    isPlaying: false,
    inviteCode: room.inviteCode,
    createdAt: room.createdAt.toISOString(),
  };
}

export async function listPublicRooms(search?: string): Promise<RoomSummaryDTO[]> {
  const query: any = {
    visibility: 'public',
    isActive: true,
  };

  if (search && search.trim()) {
    query.name = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  }

  const rooms = await Room.find(query).populate('host').sort({ createdAt: -1 }).limit(50);

  const roomIds = rooms.map((r) => r._id);
  const [memberCounts, playbackStates] = await Promise.all([
    RoomMember.aggregate([
      { $match: { room: { $in: roomIds } } },
      { $group: { _id: '$room', count: { $sum: 1 } } },
    ]),
    PlaybackState.find({ room: { $in: roomIds } }).populate({
      path: 'currentTrack',
      populate: { path: 'addedBy' },
    }),
  ]);

  const memberCountMap = new Map<string, number>();
  memberCounts.forEach((m) => memberCountMap.set(m._id.toString(), m.count));

  const playbackMap = new Map<string, any>();
  playbackStates.forEach((p) => playbackMap.set(p.room.toString(), p));

  return rooms.map((room) => {
    const rId = room._id.toString();
    const playback = playbackMap.get(rId);
    const activeUsers = presenceService.getRoomPresence(rId);

    let currentTrackDTO = null;
    if (playback?.currentTrack) {
      const ct = playback.currentTrack;
      currentTrackDTO = {
        id: ct._id.toString(),
        roomId: rId,
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

    const hostDoc = room.host as any;
    return {
      id: rId,
      name: room.name,
      description: room.description,
      visibility: room.visibility,
      host: hostDoc.toDTO ? hostDoc.toDTO() : hostDoc,
      coverGradient: room.coverGradient,
      capacity: room.capacity,
      memberCount: memberCountMap.get(rId) || 1,
      activeListenerCount: activeUsers.length,
      currentTrack: currentTrackDTO,
      isPlaying: playback?.isPlaying || false,
      createdAt: room.createdAt.toISOString(),
    };
  });
}

export async function getRoomDetail(roomId: string, userId?: string): Promise<RoomDetailDTO> {
  const room = await Room.findById(roomId).populate('host');
  if (!room || !room.isActive) {
    throw new NotFoundError('Room not found or no longer active.');
  }

  const isHost = userId ? room.host._id.toString() === userId : false;

  // Authorization check for private rooms
  let isMember = false;
  if (userId) {
    const memberDoc = await RoomMember.findOne({ room: room._id, user: userId });
    isMember = !!memberDoc;
  }

  if (room.visibility === 'private' && !isHost && !isMember) {
    // Check if there is an accepted invitation
    if (userId) {
      const inv = await RoomInvitation.findOne({
        room: room._id,
        invitee: userId,
        status: 'accepted',
      });
      if (inv) {
        isMember = true;
      }
    }

    if (!isMember) {
      throw new ForbiddenError('This room is private. You need an invitation or invite code to enter.');
    }
  }

  const [members, queue, playback] = await Promise.all([
    RoomMember.find({ room: room._id }).populate('user'),
    QueueItem.find({ room: room._id }).populate('addedBy').sort({ order: 1 }),
    PlaybackState.findOne({ room: room._id }).populate({
      path: 'currentTrack',
      populate: { path: 'addedBy' },
    }),
  ]);

  const activePresence = presenceService.getRoomPresence(roomId);
  const activeUserIds = new Set(activePresence.map((u) => u.id));

  const memberDTOs: RoomMemberDTO[] = members.map((m: any) => ({
    user: m.user.toDTO ? m.user.toDTO() : m.user,
    role: m.role,
    joinedAt: m.joinedAt.toISOString(),
    isOnline: activeUserIds.has(m.user._id.toString()),
  }));

  const queueDTOs = queue.map((q: any) => ({
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

  let currentTrackDTO = null;
  if (playback?.currentTrack) {
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
      addedBy: ct.addedBy.toDTO ? ct.addedBy.toDTO() : ct.addedBy,
      order: ct.order,
      createdAt: ct.createdAt.toISOString(),
    };
  }

  const hostDoc = room.host as any;
  const roomSummary: RoomSummaryDTO = {
    id: room._id.toString(),
    name: room.name,
    description: room.description,
    visibility: room.visibility,
    host: hostDoc.toDTO ? hostDoc.toDTO() : hostDoc,
    coverGradient: room.coverGradient,
    capacity: room.capacity,
    memberCount: members.length,
    activeListenerCount: activePresence.length,
    currentTrack: currentTrackDTO,
    isPlaying: playback?.isPlaying || false,
    inviteCode: isHost || isMember ? room.inviteCode : undefined,
    createdAt: room.createdAt.toISOString(),
  };

  const playbackDTO = {
    roomId,
    currentTrack: currentTrackDTO,
    isPlaying: playback?.isPlaying || false,
    positionSeconds: playback?.positionSeconds || 0,
    serverTimestamp: playback?.serverTimestamp || Date.now(),
    updatedAt: playback?.updatedAt ? playback.updatedAt.toISOString() : new Date().toISOString(),
  };

  return {
    room: roomSummary,
    members: memberDTOs,
    queue: queueDTOs,
    playback: playbackDTO,
    isHost,
    isMember,
  };
}

export async function joinRoom(
  roomId: string,
  userId: string,
  inviteCode?: string
): Promise<{ ok: boolean; role: string }> {
  const room = await Room.findById(roomId);
  if (!room || !room.isActive) {
    throw new NotFoundError('Room not found or no longer active.');
  }

  const isHost = room.host.toString() === userId;

  // Check if already a member
  const existing = await RoomMember.findOne({ room: room._id, user: userId });
  if (existing) {
    return { ok: true, role: existing.role };
  }

  // If private room, require host, invite code or accepted invitation
  if (room.visibility === 'private' && !isHost) {
    const hasValidInviteCode = inviteCode && inviteCode.trim() === room.inviteCode;
    const invitation = await RoomInvitation.findOne({
      room: room._id,
      invitee: userId,
      status: 'accepted',
    });

    if (!hasValidInviteCode && !invitation) {
      throw new ForbiddenError('Private room requires an invite or valid invite code.');
    }
  }

  // Capacity check
  const memberCount = await RoomMember.countDocuments({ room: room._id });
  if (memberCount >= room.capacity) {
    throw new AppError('This room has reached maximum listener capacity.', 400);
  }

  await RoomMember.create({
    room: room._id,
    user: userId,
    role: isHost ? 'host' : 'member',
  });

  return { ok: true, role: isHost ? 'host' : 'member' };
}

export async function leaveRoom(roomId: string, userId: string): Promise<void> {
  const room = await Room.findById(roomId);
  if (!room) return;

  if (room.host.toString() === userId) {
    // If host leaves, pause playback
    await PlaybackState.findOneAndUpdate(
      { room: room._id },
      { isPlaying: false, serverTimestamp: Date.now() }
    );
  }

  await RoomMember.findOneAndDelete({ room: room._id, user: userId });
}

export async function inviteFriendToRoom(
  roomId: string,
  inviterId: string,
  friendUserId: string
): Promise<RoomInvitationDTO> {
  const room = await Room.findById(roomId);
  if (!room || !room.isActive) {
    throw new NotFoundError('Room not found.');
  }

  // Check that inviter is host or member
  const inviterMember = await RoomMember.findOne({ room: room._id, user: inviterId });
  if (!inviterMember) {
    throw new ForbiddenError('Only room members can invite friends.');
  }

  // Check Friendship
  const friendship = await Friendship.findOne({
    status: 'accepted',
    $or: [
      { requester: inviterId, recipient: friendUserId },
      { requester: friendUserId, recipient: inviterId },
    ],
  });

  if (!friendship) {
    throw new ForbiddenError('You can only invite accepted friends.');
  }

  const [inviter, invitee] = await Promise.all([
    User.findById(inviterId),
    User.findById(friendUserId),
  ]);

  if (!inviter || !invitee) {
    throw new NotFoundError('User not found.');
  }

  // Check if invitation already exists
  let invitation = await RoomInvitation.findOne({ room: room._id, invitee: friendUserId });
  if (invitation) {
    if (invitation.status === 'accepted') {
      throw new AppError('Friend is already an accepted member of this room.', 400);
    }
    invitation.status = 'pending';
    invitation.inviter = new Types.ObjectId(inviterId);
    await invitation.save();
  } else {
    invitation = await RoomInvitation.create({
      room: room._id,
      inviter: inviterId,
      invitee: friendUserId,
      status: 'pending',
    });
  }

  return {
    id: invitation._id.toString(),
    room: {
      id: room._id.toString(),
      name: room.name,
      description: room.description,
      coverGradient: room.coverGradient,
    },
    inviter: inviter.toDTO(),
    invitee: invitee.toDTO(),
    status: invitation.status,
    createdAt: invitation.createdAt.toISOString(),
  };
}

export async function listPendingInvitations(userId: string): Promise<RoomInvitationDTO[]> {
  const invitations = await RoomInvitation.find({
    invitee: userId,
    status: 'pending',
  })
    .populate('room')
    .populate('inviter')
    .populate('invitee')
    .sort({ createdAt: -1 });

  return invitations.map((inv: any) => ({
    id: inv._id.toString(),
    room: {
      id: inv.room._id.toString(),
      name: inv.room.name,
      description: inv.room.description,
      coverGradient: inv.room.coverGradient,
    },
    inviter: inv.inviter.toDTO ? inv.inviter.toDTO() : inv.inviter,
    invitee: inv.invitee.toDTO ? inv.invitee.toDTO() : inv.invitee,
    status: inv.status,
    createdAt: inv.createdAt.toISOString(),
  }));
}

export async function respondToInvitation(
  invitationId: string,
  userId: string,
  action: 'accept' | 'decline'
): Promise<{ ok: boolean; roomId: string }> {
  const invitation = await RoomInvitation.findById(invitationId).populate('room');
  if (!invitation) {
    throw new NotFoundError('Invitation not found.');
  }

  if (invitation.invitee.toString() !== userId) {
    throw new ForbiddenError('You are not authorized to respond to this invitation.');
  }

  invitation.status = action === 'accept' ? 'accepted' : 'declined';
  await invitation.save();

  if (action === 'accept') {
    // Add user as member
    await RoomMember.findOneAndUpdate(
      { room: invitation.room._id, user: userId },
      { room: invitation.room._id, user: userId, role: 'member' },
      { upsert: true }
    );
  }

  return { ok: true, roomId: invitation.room._id.toString() };
}
