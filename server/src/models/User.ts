import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  email: string;
  password: string;
  username: string;
  tier: 'free' | 'premium' | 'pro';
  coins: number;
  xp: number;
  level: number;
  streak: number;
  lastLoginDate?: Date;
  skipsUsed: number;
  lastSkipResetDate?: Date;
  subscription?: {
    status: 'active' | 'canceled' | 'expired';
    tier: 'premium' | 'pro';
    startDate: Date;
    endDate?: Date;
    stripeSubscriptionId?: string;
    razorpaySubscriptionId?: string;
  };
  avatar?: string;
  nickname?: string; // Random/anonymous nickname for chats
  verified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    username: {
      type: String,
      required: true,
      trim: true,
    },
    tier: {
      type: String,
      enum: ['free', 'premium', 'pro'],
      default: 'free',
    },
    coins: {
      type: Number,
      default: 100,
    },
    xp: {
      type: Number,
      default: 0,
    },
    level: {
      type: Number,
      default: 1,
    },
    streak: {
      type: Number,
      default: 0,
    },
    lastLoginDate: {
      type: Date,
    },
    skipsUsed: {
      type: Number,
      default: 0,
    },
    lastSkipResetDate: {
      type: Date,
    },
    subscription: {
      status: {
        type: String,
        enum: ['active', 'canceled', 'expired'],
      },
      tier: {
        type: String,
        enum: ['premium', 'pro'],
      },
      startDate: Date,
      endDate: Date,
      stripeSubscriptionId: String,
      razorpaySubscriptionId: String,
    },
    avatar: String,
    nickname: String,
    verified: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IUser>('User', UserSchema);

