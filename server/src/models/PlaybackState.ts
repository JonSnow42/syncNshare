import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export interface IPlaybackState extends Document {
  room: Types.ObjectId;
  currentTrack: Types.ObjectId | null;
  isPlaying: boolean;
  positionSeconds: number;
  serverTimestamp: number;
  updatedAt: Date;
}

const PlaybackStateSchema = new Schema<IPlaybackState>(
  {
    room: {
      type: Schema.Types.ObjectId,
      ref: 'Room',
      required: true,
      unique: true,
      index: true,
    },
    currentTrack: {
      type: Schema.Types.ObjectId,
      ref: 'QueueItem',
      default: null,
    },
    isPlaying: {
      type: Boolean,
      default: false,
    },
    positionSeconds: {
      type: Number,
      default: 0,
    },
    serverTimestamp: {
      type: Number,
      default: () => Date.now(),
    },
  },
  {
    timestamps: true,
  }
);

export const PlaybackState: Model<IPlaybackState> = mongoose.model<IPlaybackState>(
  'PlaybackState',
  PlaybackStateSchema
);
