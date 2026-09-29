import mongoose, { Schema, Document } from "mongoose";

export interface IDailyReport extends Document {
  employeeId: mongoose.Types.ObjectId;
  branchId?: mongoose.Types.ObjectId;
  reportDate: Date; // Normalized to YYYY-MM-DD
  reportDescription: string; // Fixed: lowercase string type
  callsAttended: number;
  callsAnswered: number;
  conversions: number;
  totalCallDurationSeconds: number;
  workCompleted: string;
  dailyFeedback?: string;
  additionalData?: Record<string, any>;
  submittedAt: Date;
  status: "SUBMITTED" | "LATE";
  createdAt: Date;
  updatedAt: Date;
}

const DailyReportSchema: Schema = new Schema(
  {
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    branchId: {
      type: Schema.Types.ObjectId,
      ref: "Branch",
      index: true, // Added index for faster branch-wise management filtering
    },
    reportDate: {
      type: Date,
      required: true,
      index: true,
    },
    reportDescription: {
      type: String,
      required: true,
      trim: true,
    },
    callsAttended: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    callsAnswered: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    conversions: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    totalCallDurationSeconds: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    workCompleted: {
      type: String,
      required: true,
      trim: true,
    },
    dailyFeedback: {
      type: String,
      trim: true,
      default: "",
    },
    additionalData: {
      type: Schema.Types.Mixed,
      default: {},
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ["SUBMITTED", "LATE"],
      default: "SUBMITTED",
    },
  },
  {
    timestamps: true,
  },
);

// Prevent duplicate report submissions per employee on the same date
DailyReportSchema.index({ employeeId: 1, reportDate: 1 }, { unique: true });

export const DailyReport = mongoose.model<IDailyReport>(
  "DailyReport",
  DailyReportSchema,
);
