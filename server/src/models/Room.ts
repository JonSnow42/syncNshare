import mongoose, { Document, Model, Schema, Types } from 'mongoose';
import crypto from 'crypto';
import { RoomVisibility } from '@syncnshare/shared';

export interface IRoom extends Document {
  name: string;
  description: string;
  visibility: RoomVisibility;
  host: Types.ObjectId;
  coverGradient: string;
  capacity: number;
  isActive: boolean;
  inviteCode: string;
  createdAt: Date;
  updatedAt: Date;
}

const RoomSchema = new Schema<IRoom>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 60,
    },
    description: {
      type: String,
      default: '',
      maxlength: 250,
    },
    visibility: {
      type: String,
      enum: ['public', 'private'],
      default: 'public',
      index: true,
    },
    host: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    coverGradient: {
      type: String,
      default: 'from-violet-600 to-indigo-900',
    },
    capacity: {
      type: Number,
      default: 50,
      min: 2,
      max: 200,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    inviteCode: {
      type: String,
      unique: true,
      index: true,
      default: () => crypto.randomBytes(4).toString('hex'), // 8-char hex code
    },
  },
  {
    timestamps: true,
  }
);

export const Room: Model<IRoom> = mongoose.model<IRoom>('Room', RoomSchema);
