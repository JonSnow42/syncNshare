import { ChatMessageDTO } from '@syncnshare/shared';
import { ChatMessage } from '../models/ChatMessage';
import { Room } from '../models/Room';
import { RoomMember } from '../models/RoomMember';
import { ForbiddenError, NotFoundError } from '../utils/errors';

export async function sendMessage(
  roomId: string,
  userId: string,
  content: string
): Promise<ChatMessageDTO> {
  const room = await Room.findById(roomId);
  if (!room || !room.isActive) {
    throw new NotFoundError('Room not found or no longer active.');
  }

  // Check membership
  const member = await RoomMember.findOne({ room: room._id, user: userId });
  if (!member) {
    throw new ForbiddenError('You must join the room to send chat messages.');
  }

  const message = await ChatMessage.create({
    room: room._id,
    sender: userId,
    content: content.trim(),
  });

  await message.populate('sender');

  const senderDoc = message.sender as any;
  return {
    id: message._id.toString(),
    roomId,
    sender: senderDoc.toDTO ? senderDoc.toDTO() : senderDoc,
    content: message.content,
    createdAt: message.createdAt.toISOString(),
  };
}

export async function getRoomMessages(roomId: string, limit = 50): Promise<ChatMessageDTO[]> {
  const messages = await ChatMessage.find({ room: roomId })
    .populate('sender')
    .sort({ createdAt: -1 })
    .limit(limit);

  // Return chronologically (oldest to newest)
  messages.reverse();

  return messages.map((m: any) => ({
    id: m._id.toString(),
    roomId,
    sender: m.sender.toDTO ? m.sender.toDTO() : m.sender,
    content: m.content,
    createdAt: m.createdAt.toISOString(),
  }));
}
