import { createHash } from "crypto";

export const bucketForUser = (userId: string, flagKey: string) => {
  const hash = createHash("sha256").update(`${userId}:${flagKey}`).digest("hex");
  const first8HexChars = hash.slice(0, 8);
  return parseInt(first8HexChars, 16) % 100;
};
