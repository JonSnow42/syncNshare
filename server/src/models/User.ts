import mongoose, { Document, Model, Schema } from 'mongoose';
import { UserDTO } from '@syncnshare/shared';

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  displayName: string;
  avatar?: string;
  bio?: string;
  createdAt: Date;
  updatedAt: Date;
  toDTO(): UserDTO;
}

const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 32,
    },
    avatar: {
      type: String,
      default: '',
    },
    bio: {
      type: String,
      default: '',
      maxlength: 200,
    },
  },
  {
    timestamps: true,
  }
);

UserSchema.methods.toDTO = function (): UserDTO {
  return {
    id: this._id.toString(),
    email: this.email,
    displayName: this.displayName,
    avatar: this.avatar,
    bio: this.bio,
    createdAt: this.createdAt.toISOString(),
  };
};

export const User: Model<IUser> = mongoose.model<IUser>('User', UserSchema);
