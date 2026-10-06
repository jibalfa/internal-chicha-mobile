import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { AuthSession, RoleType, ROLES } from "@/types";

const SECRET_KEY = new TextEncoder().encode(
  process.env.JWT_SECRET || "chicha-mobile-secret-jwt-key-super-secure-2026-production"
);

const SESSION_COOKIE_NAME = "chicha_session";
const SESSION_EXPIRATION_HOURS = 24;

export async function createSessionToken(payload: AuthSession): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_EXPIRATION_HOURS}h`)
    .sign(SECRET_KEY);
}

export async function verifySessionToken(token: string): Promise<AuthSession | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    return {
      userId: payload.userId as string,
      name: payload.name as string,
      username: payload.username as string,
      role: payload.role as RoleType,
    };
  } catch (error) {
    return null;
  }
}

export async function getSession(): Promise<AuthSession | null> {
  const cookieStore = cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return await verifySessionToken(token);
}

export async function setSessionCookie(token: string) {
  const cookieStore = cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_EXPIRATION_HOURS * 60 * 60,
  });
}

export async function clearSessionCookie() {
  const cookieStore = cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function authenticateUser(username: string, passwordPlain: string) {
  const user = await prisma.user.findUnique({
    where: { username: username.trim().toLowerCase() },
  });

  if (!user || !user.isActive) {
    return { success: false, error: "Username atau password salah, atau akun dinonaktifkan." };
  }

  const isPasswordValid = await bcrypt.compare(passwordPlain, user.password);
  if (!isPasswordValid) {
    return { success: false, error: "Username atau password salah." };
  }

  const session: AuthSession = {
    userId: user.id,
    name: user.name,
    username: user.username,
    role: user.role as RoleType,
  };

  const token = await createSessionToken(session);
  return { success: true, session, token, user };
}

// Role permission check helper
export function hasPermission(
  userRole: RoleType,
  requiredRoles: RoleType[]
): boolean {
  if (userRole === ROLES.OWNER) return true; // Owner has full access
  return requiredRoles.includes(userRole);
}
