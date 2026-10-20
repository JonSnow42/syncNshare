import mongoose, { Document, Model, Schema, Types } from 'mongoose';
import { MediaProvider } from '@syncnshare/shared';

export interface IQueueItem extends Document {
  room: Types.ObjectId;
  provider: MediaProvider;
  mediaId: string;
  url: string;
  title: string;
  artist: string;
  durationSeconds: number;
  thumbnailUrl: string;
  addedBy: Types.ObjectId;
  order: number;
  createdAt: Date;
}

const QueueItemSchema = new Schema<IQueueItem>(
  {
    room: {
      type: Schema.Types.ObjectId,
      ref: 'Room',
      required: true,
      index: true,
    },
    provider: {
      type: String,
      enum: ['youtube', 'direct_audio'],
      required: true,
    },
    mediaId: {
      type: String,
      required: true,
    },
    url: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    artist: {
      type: String,
      default: '',
    },
    durationSeconds: {
      type: Number,
      default: 0,
    },
    thumbnailUrl: {
      type: String,
      default: '',
    },
    addedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    order: {
      type: Number,
      required: true,
      default: 0,
      index: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

QueueItemSchema.index({ room: 1, order: 1 });

export const QueueItem: Model<IQueueItem> = mongoose.model<IQueueItem>('QueueItem', QueueItemSchema);
