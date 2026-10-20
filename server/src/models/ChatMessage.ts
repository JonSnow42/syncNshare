import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export interface IChatMessage extends Document {
  room: Types.ObjectId;
  sender: Types.ObjectId;
  content: string;
  createdAt: Date;
}

const ChatMessageSchema = new Schema<IChatMessage>(
  {
    room: {
      type: Schema.Types.ObjectId,
      ref: 'Room',
      required: true,
      index: true,
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

ChatMessageSchema.index({ room: 1, createdAt: 1 });

export const ChatMessage: Model<IChatMessage> = mongoose.model<IChatMessage>(
  'ChatMessage',
  ChatMessageSchema
);
