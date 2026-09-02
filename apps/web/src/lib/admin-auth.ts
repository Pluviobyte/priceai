import { createHmac, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE_NAME = "price_radar_admin";

export type AdminRole = "system_admin" | "operations" | "reviewer";

export interface AdminSession {
  sub: string;
  role: AdminRole;
}

interface SessionPayload extends AdminSession {
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

export function createAdminToken(session: AdminSession = { sub: "admin", role: "system_admin" }, now = Date.now()): string {
  const secret = sessionSecret();
  if (!secret) throw new Error("admin_session_secret_not_configured");
  const payload = Buffer.from(
    JSON.stringify({ ...session, exp: now + 8 * 60 * 60_000 } satisfies SessionPayload),
  ).toString("base64url");
  return `${payload}.${signature(payload, secret)}`;
}

export function readAdminToken(token: string | undefined, now = Date.now()): AdminSession | null {
  const secret = sessionSecret();
  if (!secret || !token) return null;
  const [payload, suppliedSignature, extra] = token.split(".");
  if (!payload || !suppliedSignature || extra) return null;
  if (!safeEqual(signature(payload, secret), suppliedSignature)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SessionPayload;
    return typeof parsed.sub === "string" && parsed.sub.length > 0 && ["system_admin", "operations", "reviewer"].includes(parsed.role) && Number.isFinite(parsed.exp) && parsed.exp > now ? { sub: parsed.sub, role: parsed.role } : null;
  } catch {
    return null;
  }
}

export function verifyAdminToken(token: string | undefined, now = Date.now()): boolean { return readAdminToken(token, now) !== null; }

export function verifyAdminPassword(password: string): boolean {
  const configured = process.env.ADMIN_PASSWORD;
  return Boolean(configured && configured.length >= 12 && safeEqual(password, configured));
}

export function verifyAdminCredentials(username: string, password: string): AdminSession | null {
  const configured = process.env.ADMIN_USERS_JSON;
  if (configured) {
    try {
      const users = JSON.parse(configured) as Array<{ username?: unknown; password?: unknown; passwordHash?: unknown; role?: unknown }>;
      const user = users.find((item) => {
        if (item.username !== username) return false;
        if (typeof item.passwordHash === "string") {
          const [algorithm, salt, expected] = item.passwordHash.split("$");
          if (algorithm !== "scrypt" || !salt || !expected) return false;
          try { return safeEqual(scryptSync(password, Buffer.from(salt, "base64url"), 64).toString("base64url"), expected); }
          catch { return false; }
        }
        return process.env.NODE_ENV !== "production" && typeof item.password === "string" && safeEqual(password, item.password);
      });
      if (user && typeof user.username === "string" && (user.role === "system_admin" || user.role === "operations" || user.role === "reviewer")) return { sub: user.username, role: user.role };
    } catch { return null; }
    return null;
  }
  return username === "admin" && verifyAdminPassword(password) ? { sub: "admin", role: "system_admin" } : null;
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const token = (await cookies()).get(ADMIN_COOKIE_NAME)?.value;
  return readAdminToken(token);
}

export async function isAdminAuthenticated(roles?: readonly AdminRole[]): Promise<boolean> {
  const session = await getAdminSession();
  return Boolean(session && (!roles || roles.includes(session.role)));
}

export function requestHasSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  return origin === new URL(request.url).origin;
}

export function getAdminRequestSession(request: Request): AdminSession | null {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const token = cookieHeader
    .split(";")
    .map((part) => part.trim().split("="))
    .find(([name]) => name === ADMIN_COOKIE_NAME)?.[1];
  return readAdminToken(token);
}

export function isAdminRequest(request: Request, roles?: readonly AdminRole[]): boolean {
  const session = getAdminRequestSession(request);
  return Boolean(session && (!roles || roles.includes(session.role)));
}
