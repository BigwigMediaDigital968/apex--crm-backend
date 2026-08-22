import jwt from "jsonwebtoken";

export const generateStringeeToken = (userId: string): string => {
  const apiKeySid = process.env.STRINGEE_API_KEY_SID;
  const apiSecret = process.env.STRINGEE_API_KEY_SECRET;

  if (!apiKeySid || !apiSecret) {
    throw new Error("Stringee API key SID or Secret missing in environment variables");
  }

  const now = Math.floor(Date.now() / 1000);
  const exp = now + 3600; // 1 hour validity

  const payload = {
    jti: `${apiKeySid}-${now}`,
    iss: apiKeySid,
    exp: exp,
    userId: userId,
  };

  // ✅ Stringee requires cty: "stringeeapi;v=1" in header options
  return jwt.sign(payload, apiSecret, {
    algorithm: "HS256",
    header: {
      alg: "HS256",
      typ: "JWT",
      cty: "stringeeapi;v=1",
    },
  });
};