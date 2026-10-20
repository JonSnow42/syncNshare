import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export interface IRoomInvitation extends Document {
  room: Types.ObjectId;
  inviter: Types.ObjectId;
  invitee: Types.ObjectId;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: Date;
  updatedAt: Date;
}

const RoomInvitationSchema = new Schema<IRoomInvitation>(
  {
    room: {
      type: Schema.Types.ObjectId,
      ref: 'Room',
      required: true,
      index: true,
    },
    inviter: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    invitee: {
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

RoomInvitationSchema.index({ room: 1, invitee: 1 }, { unique: true });

export const RoomInvitation: Model<IRoomInvitation> = mongoose.model<IRoomInvitation>(
  'RoomInvitation',
  RoomInvitationSchema
);
