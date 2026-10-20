import { Types } from 'mongoose';
import { UserDTO, FriendRequestDTO, FriendSummaryDTO, UserSearchDTO } from '@syncnshare/shared';
import { User } from '../models/User';
import { Friendship } from '../models/Friendship';
import { AppError, ConflictError, NotFoundError } from '../utils/errors';

export async function sendFriendRequest(
  requesterId: string,
  recipientId: string
): Promise<FriendRequestDTO> {
  if (requesterId === recipientId) {
    throw new AppError('You cannot send a friend request to yourself.', 400);
  }

  const recipient = await User.findById(recipientId);
  if (!recipient) {
    throw new NotFoundError('User not found.');
  }

  const requester = await User.findById(requesterId);
  if (!requester) {
    throw new NotFoundError('Requester not found.');
  }

  // Check existing in either direction
  const existing = await Friendship.findOne({
    $or: [
      { requester: requesterId, recipient: recipientId },
      { requester: recipientId, recipient: requesterId },
    ],
  });

  if (existing) {
    if (existing.status === 'accepted') {
      throw new ConflictError('You are already friends with this user.');
    }
    if (existing.status === 'pending') {
      if (existing.requester.toString() === requesterId) {
        throw new ConflictError('Friend request has already been sent.');
      } else {
        // They sent us a request, let's accept it!
        existing.status = 'accepted';
        await existing.save();
        return {
          id: existing._id.toString(),
          requester: requester.toDTO(),
          recipient: recipient.toDTO(),
          status: 'accepted',
          createdAt: existing.createdAt.toISOString(),
        };
      }
    }
    // If declined previously, reset to pending
    existing.requester = new Types.ObjectId(requesterId);
    existing.recipient = new Types.ObjectId(recipientId);
    existing.status = 'pending';
    await existing.save();
    return {
      id: existing._id.toString(),
      requester: requester.toDTO(),
      recipient: recipient.toDTO(),
      status: 'pending',
      createdAt: existing.createdAt.toISOString(),
    };
  }

  const friendship = await Friendship.create({
    requester: requesterId,
    recipient: recipientId,
    status: 'pending',
  });

  return {
    id: friendship._id.toString(),
    requester: requester.toDTO(),
    recipient: recipient.toDTO(),
    status: 'pending',
    createdAt: friendship.createdAt.toISOString(),
  };
}

export async function respondFriendRequest(
  userId: string,
  requestId: string,
  action: 'accept' | 'decline'
): Promise<{ ok: boolean; status: string }> {
  const friendship = await Friendship.findById(requestId);
  if (!friendship) {
    throw new NotFoundError('Friend request not found.');
  }

  // Only the recipient can accept or decline
  if (friendship.recipient.toString() !== userId) {
    throw new AppError('Only the recipient of the request can respond.', 403);
  }

  if (friendship.status !== 'pending') {
    throw new AppError('Friend request has already been processed.', 400);
  }

  if (action === 'accept') {
    friendship.status = 'accepted';
    await friendship.save();
    return { ok: true, status: 'accepted' };
  } else {
    friendship.status = 'declined';
    await friendship.save();
    return { ok: true, status: 'declined' };
  }
}

export async function listFriends(userId: string): Promise<FriendSummaryDTO[]> {
  const friendships = await Friendship.find({
    status: 'accepted',
    $or: [{ requester: userId }, { recipient: userId }],
  })
    .populate('requester')
    .populate('recipient')
    .sort({ updatedAt: -1 });

  return friendships.map((f) => {
    const isRequester = f.requester._id.toString() === userId;
    const friendDoc = (isRequester ? f.recipient : f.requester) as any;
    return {
      friendshipId: f._id.toString(),
      friend: friendDoc.toDTO ? friendDoc.toDTO() : {
        id: friendDoc._id.toString(),
        displayName: friendDoc.displayName,
        email: friendDoc.email,
        avatar: friendDoc.avatar,
        bio: friendDoc.bio,
        createdAt: friendDoc.createdAt.toISOString(),
      },
      establishedAt: f.updatedAt.toISOString(),
    };
  });
}

export async function listPendingRequests(
  userId: string
): Promise<{ incoming: FriendRequestDTO[]; outgoing: FriendRequestDTO[] }> {
  const incoming = await Friendship.find({
    recipient: userId,
    status: 'pending',
  })
    .populate('requester')
    .populate('recipient')
    .sort({ createdAt: -1 });

  const outgoing = await Friendship.find({
    requester: userId,
    status: 'pending',
  })
    .populate('requester')
    .populate('recipient')
    .sort({ createdAt: -1 });

  const mapRequest = (f: any): FriendRequestDTO => ({
    id: f._id.toString(),
    requester: f.requester.toDTO ? f.requester.toDTO() : f.requester,
    recipient: f.recipient.toDTO ? f.recipient.toDTO() : f.recipient,
    status: f.status,
    createdAt: f.createdAt.toISOString(),
  });

  return {
    incoming: incoming.map(mapRequest),
    outgoing: outgoing.map(mapRequest),
  };
}

export async function removeFriend(userId: string, targetUserId: string): Promise<void> {
  const deleted = await Friendship.findOneAndDelete({
    status: 'accepted',
    $or: [
      { requester: userId, recipient: targetUserId },
      { requester: targetUserId, recipient: userId },
    ],
  });

  if (!deleted) {
    throw new NotFoundError('Friendship not found.');
  }
}

export async function searchUsers(
  currentUserId: string,
  query: string,
  limit = 10
): Promise<UserSearchDTO[]> {
  const safeRegex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

  const users = await User.find({
    _id: { $ne: currentUserId },
    $or: [{ displayName: safeRegex }, { email: safeRegex }],
  })
    .limit(limit)
    .select('_id displayName email avatar');

  if (users.length === 0) return [];

  // Check relationship status with each found user
  const otherIds = users.map((u) => u._id);
  const friendships = await Friendship.find({
    $or: [
      { requester: currentUserId, recipient: { $in: otherIds } },
      { requester: { $in: otherIds }, recipient: currentUserId },
    ],
  });

  return users.map((u) => {
    const f = friendships.find(
      (rel) =>
        (rel.requester.toString() === currentUserId && rel.recipient.toString() === u._id.toString()) ||
        (rel.recipient.toString() === currentUserId && rel.requester.toString() === u._id.toString())
    );

    let friendshipStatus: UserSearchDTO['friendshipStatus'] = 'none';
    if (f) {
      if (f.status === 'accepted') friendshipStatus = 'friends';
      else if (f.status === 'pending') {
        friendshipStatus = f.requester.toString() === currentUserId ? 'pending_sent' : 'pending_received';
      }
    }

    return {
      id: u._id.toString(),
      displayName: u.displayName,
      email: u.email,
      avatar: u.avatar,
      friendshipStatus,
    };
  });
}
