import mongoose, { Schema, Document, Types, Model, ObjectId } from "mongoose";


export interface IContestParticipant extends Document{

    contest:  mongoose.Types.ObjectId;
    user:  mongoose.Types.ObjectId;
    branch: mongoose.Types.ObjectId;
    joinedAt: Date;
    status: "joined" | "withdrawn" | "removed";
}

const contestParticipantSchema = new Schema<IContestParticipant>(
  {
    contest: { type: Schema.Types.ObjectId, ref: "Contest", required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    branch: { type: Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    joinedAt: { type: Date, required: true },
    status :{
      type: String,
      enum: ["joined", "withdrawn", "removed"],
      default: "joined",
    },
  },
  { timestamps: true },
);

contestParticipantSchema.index({ contest: 1, user: 1 }, { unique: true });
contestParticipantSchema.index({ user: 1, contest: 1 });


export const ContestParticipant: Model<IContestParticipant> =
  mongoose.models.ContestParticipant ||
  mongoose.model<IContestParticipant>(
    "ContestParticipant",
    contestParticipantSchema,
  );