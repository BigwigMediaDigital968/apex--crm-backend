import mongoose from "mongoose";

const isTransactionUnsupported = (error: any) =>
  error?.code === 20 || error?.message?.includes("replica set");

/**
 * Runs `action` inside a MongoDB transaction. Uses Mongoose's
 * `connection.transaction`, which retries transient errors (write conflicts,
 * unknown commit results) and resets document state between attempts — so
 * `action` must be safe to re-run. Falls back to running without a session
 * on a standalone (non-replica-set) server, e.g. a local dev mongod.
 */
export const runTransaction = async <T>(
  action: (session?: mongoose.ClientSession) => Promise<T>,
): Promise<T> => {
  try {
    return await mongoose.connection.transaction((session) => action(session));
  } catch (error) {
    if (isTransactionUnsupported(error)) return action();
    throw error;
  }
};
