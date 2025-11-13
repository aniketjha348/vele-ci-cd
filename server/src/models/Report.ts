import mongoose, { Schema, Document } from 'mongoose';

export interface IReport extends Document {
  reporterId: string;
  reportedSocketId: string; // Anonymous socket ID
  reportedUserId?: string; // Only if admin needs to investigate
  reason: string;
  description?: string;
  chatLog?: string[]; // Last few messages for context
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
  createdAt: Date;
}

const ReportSchema = new Schema<IReport>(
  {
    reporterId: {
      type: String,
      required: true,
    },
    reportedSocketId: {
      type: String,
      required: true,
    },
    reportedUserId: String,
    reason: {
      type: String,
      required: true,
      enum: ['harassment', 'spam', 'inappropriate_content', 'scam', 'other'],
    },
    description: String,
    chatLog: [String],
    status: {
      type: String,
      enum: ['pending', 'reviewed', 'resolved', 'dismissed'],
      default: 'pending',
    },
  },
  {
    timestamps: true,
  }
);

ReportSchema.index({ reporterId: 1, createdAt: -1 });
ReportSchema.index({ status: 1 });

export default mongoose.model<IReport>('Report', ReportSchema);

