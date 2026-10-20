import mongoose, { Document, Model, Schema, Types } from 'mongoose';
import { RoomMemberRole } from '@syncnshare/shared';

export interface IRoomMember extends Document {
  room: Types.ObjectId;
  user: Types.ObjectId;
  role: RoomMemberRole;
  joinedAt: Date;
}

const RoomMemberSchema = new Schema<IRoomMember>(
  {
    room: {
      type: Schema.Types.ObjectId,
      ref: 'Room',
      required: true,
      index: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ['host', 'member'],
      default: 'member',
      required: true,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
  }
);

RoomMemberSchema.index({ room: 1, user: 1 }, { unique: true });

export const RoomMember: Model<IRoomMember> = mongoose.model<IRoomMember>('RoomMember', RoomMemberSchema);
