import mongoose, { Schema, Document } from 'mongoose';

export interface IBlock extends Document {
  blockerId: string;
  blockedSocketId: string; // Anonymous socket ID
  blockedUserId?: string; // For admin tracking
  createdAt: Date;
}

const BlockSchema = new Schema<IBlock>(
  {
    blockerId: {
      type: String,
      required: true,
    },
    blockedSocketId: {
      type: String,
      required: true,
    },
    blockedUserId: String,
  },
  {
    timestamps: true,
  }
);

BlockSchema.index({ blockerId: 1, blockedSocketId: 1 }, { unique: true });

export default mongoose.model<IBlock>('Block', BlockSchema);

