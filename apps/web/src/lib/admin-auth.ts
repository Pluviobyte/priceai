import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE_NAME = "price_radar_admin";

interface SessionPayload {
  sub: "admin";
  exp: number;
}

function sessionSecret(): string | undefined {
  const value = process.env.ADMIN_SESSION_SECRET;
  return value && value.length >= 32 ? value : undefined;
}

function signature(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function createAdminToken(now = Date.now()): string {
  const secret = sessionSecret();
  if (!secret) throw new Error("admin_session_secret_not_configured");
  const payload = Buffer.from(
    JSON.stringify({ sub: "admin", exp: now + 8 * 60 * 60_000 } satisfies SessionPayload),
  ).toString("base64url");
  return `${payload}.${signature(payload, secret)}`;
}

export function verifyAdminToken(token: string | undefined, now = Date.now()): boolean {
  const secret = sessionSecret();
  if (!secret || !token) return false;
  const [payload, suppliedSignature, extra] = token.split(".");
  if (!payload || !suppliedSignature || extra) return false;
  if (!safeEqual(signature(payload, secret), suppliedSignature)) return false;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SessionPayload;
    return parsed.sub === "admin" && Number.isFinite(parsed.exp) && parsed.exp > now;
  } catch {
    return false;
  }
}

export function verifyAdminPassword(password: string): boolean {
  const configured = process.env.ADMIN_PASSWORD;
  return Boolean(configured && configured.length >= 12 && safeEqual(password, configured));
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const token = (await cookies()).get(ADMIN_COOKIE_NAME)?.value;
  return verifyAdminToken(token);
}

export function requestHasSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  return origin === new URL(request.url).origin;
}

export function isAdminRequest(request: Request): boolean {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const token = cookieHeader
    .split(";")
    .map((part) => part.trim().split("="))
    .find(([name]) => name === ADMIN_COOKIE_NAME)?.[1];
  return verifyAdminToken(token);
}
