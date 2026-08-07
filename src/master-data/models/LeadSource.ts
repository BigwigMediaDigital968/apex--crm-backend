import mongoose, { Schema, Document } from "mongoose";

export interface ILeadSource extends Document {
  name: string;

  code: string;

  description?: string;

  isActive: boolean;

  createdBy: mongoose.Types.ObjectId;

  createdAt: Date;

  updatedAt: Date;
}

const leadSourceSchema = new Schema<ILeadSource>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    code: {
      type: String,
      required: true,
      uppercase: true,
      unique: true,
      trim: true,
    },

    description: String,

    isActive: {
      type: Boolean,
      default: true,
    },

    createdBy: {
      type: Schema.Types.ObjectId,

      ref: "User",

      required: true,
    },
  },
  {
    timestamps: true,
  },
);

leadSourceSchema.index({
  name: 1,
});

export const LeadSource = mongoose.model<ILeadSource>(
  "LeadSource",
  leadSourceSchema,
);
