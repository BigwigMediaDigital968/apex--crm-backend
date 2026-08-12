import { User, type IUser } from "../models/User.js";

import { comparePassword } from "../utils/password.js";

import { generateAccessToken } from "../utils/jwt.js";

import { AppError } from "../utils/AppError.js";

import { createSession } from "./session.service.js";

export const loginUser = async (
  email: string,
  password: string,
  userAgent?: string,
  ipAddress?: string,
) => {
  const user = (await User.findOne({
    email: email.toLowerCase(),
  })
    .select("+password")
    .exec()) as IUser | null;

  if (!user) {
    throw new AppError("Invalid email or password", 401, "INVALID_CREDENTIALS");
  }

  if (!user.isActive) {
    throw new AppError(
      "Your account has been deactivated",
      403,
      "ACCOUNT_INACTIVE",
    );
  }

  const passwordMatches = await comparePassword(password, user.password);

  if (!passwordMatches) {
    throw new AppError("Invalid email or password", 401, "INVALID_CREDENTIALS");
  }

  user.lastLoginAt = new Date();

  await user.save();

  const accessToken = generateAccessToken(user._id.toString());

  const refreshToken = await createSession({
    userId: user._id.toString(),
    userAgent,
    ipAddress,
  });

  return {
    accessToken,
    refreshToken,

    user: {
      _id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      branches: (user.branches || []).map((branch) => branch.toString()),
    },
  };
};
