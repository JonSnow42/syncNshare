import mongoose, { Document, Model, Schema, Types } from 'mongoose';
import { FriendshipStatus } from '@syncnshare/shared';

export interface IFriendship extends Document {
  requester: Types.ObjectId;
  recipient: Types.ObjectId;
  status: FriendshipStatus;
  createdAt: Date;
  updatedAt: Date;
}

const FriendshipSchema = new Schema<IFriendship>(
  {
    requester: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    recipient: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined'],
      default: 'pending',
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate friendships between the same two users
FriendshipSchema.index({ requester: 1, recipient: 1 }, { unique: true });

export const Friendship: Model<IFriendship> = mongoose.model<IFriendship>('Friendship', FriendshipSchema);
