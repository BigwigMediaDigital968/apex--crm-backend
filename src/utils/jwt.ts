import jwt from "jsonwebtoken";

import { env } from "../config/env.js";

export interface AccessTokenPayload {
  sub: string;
  iat?: number;
  exp?: number;
}

export const generateAccessToken = (
  userId: string,
): string => {
  return jwt.sign(
    {
      sub: userId,
    },
    env.jwtSecret,
    {
      expiresIn:
        env.jwtExpiresIn,
    } as jwt.SignOptions,
  );
};

export const verifyAccessToken = (
  token: string,
): AccessTokenPayload => {
  const decoded =
    jwt.verify(
      token,
      env.jwtSecret,
    ) as AccessTokenPayload;

  if (!decoded.sub) {
    throw new Error(
      "Invalid access token payload",
    );
  }

  return decoded;
};