// src/utils/stringeeToken.ts
import jwt from "jsonwebtoken";

export const generateStringeeToken = (userId: string): string => {
  const apiKeySid = process.env.STRINGEE_API_KEY_SID!;
  const apiSecret = process.env.STRINGEE_API_KEY_SECRET!;

  const now = Math.floor(Date.now() / 1000);
  const exp = now + 3600; // 1 hour validity

  const payload = {
    jti: `${apiKeySid}-${now}`,
    iss: apiKeySid,
    exp: exp,
    userId: userId, // Internal Mongo User ID
  };

  return jwt.sign(payload, apiSecret, { algorithm: "HS256" });
};
