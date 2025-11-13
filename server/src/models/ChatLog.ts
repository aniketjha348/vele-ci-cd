import mongoose, { Schema, Document } from 'mongoose';

export interface IChatLog extends Document {
  userId1: string;
  userId2: string;
  socketId1: string;
  socketId2: string;
  messages: Array<{
    message: string;
    timestamp: Date;
    socketId: string;
    moderated: boolean;
    flagged?: boolean;
  }>;
  duration: number; // in seconds
  endedBy?: string; // socketId
  createdAt: Date;
}

const ChatLogSchema = new Schema<IChatLog>(
  {
    userId1: {
      type: String,
      required: true,
    },
    userId2: {
      type: String,
      required: true,
    },
    socketId1: String,
    socketId2: String,
    messages: [
      {
        message: String,
        timestamp: Date,
        socketId: String,
        moderated: Boolean,
        flagged: Boolean,
      },
    ],
    duration: Number,
    endedBy: String,
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
ChatLogSchema.index({ userId1: 1, createdAt: -1 });
ChatLogSchema.index({ userId2: 1, createdAt: -1 });

export default mongoose.model<IChatLog>('ChatLog', ChatLogSchema);

