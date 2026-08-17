import mongoose, {
  Document,
  Schema,
} from "mongoose";

import {
  ATTENDANCE_STATUS,
  type AttendanceStatus,
} from "../constants/attendanceStatus.js";

import {
  ATTENDANCE_MODE,
  type AttendanceMode,
} from "../constants/attendanceMode.js";

export interface IAttendance extends Document {
  employee: mongoose.Types.ObjectId;

  branch: mongoose.Types.ObjectId;

  attendanceDate: Date;

  status: AttendanceStatus;

  mode: AttendanceMode;

  checkInAt?: Date;

  checkOutAt?: Date;

  checkInLatitude?: number;

  checkInLongitude?: number;

  checkInDistanceMeters?: number;

  checkOutLatitude?: number;

  checkOutLongitude?: number;

  checkOutDistanceMeters?: number;

  totalWorkingMinutes?: number;

  lateMinutes?: number;

  earlyCheckoutMinutes?: number;

  remarks?: string;

  isRegularized: boolean;

  regularizedBy?: mongoose.Types.ObjectId;

  regularizedAt?: Date;

  createdAt: Date;

  updatedAt: Date;
}

const attendanceSchema =
  new Schema<IAttendance>(
    {
      employee: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
      },

      branch: {
        type: Schema.Types.ObjectId,
        ref: "Branch",
        required: true,
        index: true,
      },

      attendanceDate: {
        type: Date,
        required: true,
        index: true,
      },

      status: {
        type: String,
        enum: Object.values(ATTENDANCE_STATUS),
        required: true,
        index: true,
      },

      mode: {
        type: String,
        enum: Object.values(ATTENDANCE_MODE),
        required: true,
        default: ATTENDANCE_MODE.WFO,
      },

      checkInAt: {
        type: Date,
      },

      checkOutAt: {
        type: Date,
      },

      checkInLatitude: {
        type: Number,
      },

      checkInLongitude: {
        type: Number,
      },

      checkInDistanceMeters: {
        type: Number,
      },

      checkOutLatitude: {
        type: Number,
      },

      checkOutLongitude: {
        type: Number,
      },

      checkOutDistanceMeters: {
        type: Number,
      },

      totalWorkingMinutes: {
        type: Number,
        default: 0,
      },

      lateMinutes: {
        type: Number,
        default: 0,
      },

      earlyCheckoutMinutes: {
        type: Number,
        default: 0,
      },

      remarks: {
        type: String,
        trim: true,
        maxlength: 2000,
      },

      isRegularized: {
        type: Boolean,
        default: false,
        index: true,
      },

      regularizedBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
      },

      regularizedAt: {
        type: Date,
      },
    },
    {
      timestamps: true,
    },
  );

  attendanceSchema.index(
  {
    employee: 1,
    attendanceDate: 1,
  },
  {
    unique: true,
  },
);

attendanceSchema.index({
  branch: 1,
  attendanceDate: -1,
});

attendanceSchema.index({
  employee: 1,
  attendanceDate: -1,
});

attendanceSchema.index({
  branch: 1,
  status: 1,
  attendanceDate: -1,
});

export const Attendance =
  mongoose.model<IAttendance>(
    "Attendance",
    attendanceSchema,
  );