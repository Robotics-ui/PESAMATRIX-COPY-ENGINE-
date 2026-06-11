import jwt from "jsonwebtoken";

const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY = "7d";

export type TokenPayload = {
  userId: string;
  role: "admin" | "subscriber";
};

function getAccessSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return secret;
}

function getRefreshSecret(): string {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) throw new Error("JWT_REFRESH_SECRET is not set");
  return secret;
}

export function signAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, getAccessSecret(), { expiresIn: ACCESS_TOKEN_EXPIRY });
}

export function signRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, getRefreshSecret(), { expiresIn: REFRESH_TOKEN_EXPIRY });
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, getAccessSecret()) as TokenPayload;
}

export function verifyRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, getRefreshSecret()) as TokenPayload;
}
