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
    userId: userId,
  };

  // ✅ Add cty to header options (Mandatory for Stringee)
  return jwt.sign(payload, apiSecret, {
    algorithm: "HS256",
    header: {
      alg: "HS256",
      typ: "JWT",
      cty: "stringeeapi;v=1",
    },
  });
};
