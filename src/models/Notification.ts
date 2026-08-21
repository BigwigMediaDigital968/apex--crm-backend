import mongoose, { Document, Schema, Types, Model } from "mongoose";

export const NOTIFICATION_TYPES = {
  EMPLOYEE_CREATED: "EMPLOYEE_CREATED",
  BRANCH_ASSIGNED: "BRANCH_ASSIGNED",
  TASK_ASSIGNED: "TASK_ASSIGNED",
  REVENUE_VERIFIED: "REVENUE_VERIFIED",
  LEAD_ASSIGNED: "LEAD_ASSIGNED",
  SYSTEM_ALERT: "SYSTEM_ALERT",
} as const;

export type NotificationType = keyof typeof NOTIFICATION_TYPES;

export interface INotification extends Document {
  recipient: Types.ObjectId;
  sender?: Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  entityId?: Types.ObjectId; // E.g., taskId, employeeId, leadId
  entityType?: string; // "Task", "User", "Lead"
  isRead: boolean;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    recipient: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    sender: { type: Schema.Types.ObjectId, ref: "User" },
    type: {
      type: String,
      enum: Object.values(NOTIFICATION_TYPES),
      required: true,
    },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    entityId: { type: Schema.Types.ObjectId },
    entityType: { type: String },
    isRead: { type: Boolean, default: false, index: true },
    readAt: { type: Date },
  },
  { timestamps: true },
);

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

export const Notification: Model<INotification> =
  mongoose.models.Notification ||
  mongoose.model<INotification>("Notification", notificationSchema);
