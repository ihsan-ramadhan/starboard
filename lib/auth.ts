import "server-only";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

const SESSION_COOKIE = "starboard_session";
const SESSION_TTL_DAYS = 7;

export type SessionUser = {
  id: string;
  username: string;
  email: string;
  role: string;
  deptColor: string | null;
};

export async function login(
  identifier: string,
  password: string
): Promise<string | null> {
  const clean = identifier.trim();
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { username: { equals: clean, mode: "insensitive" } },
        { email: { equals: clean, mode: "insensitive" } },
      ],
    },
  });
  if (!user) return null;

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return null;

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000);

  await prisma.session.create({ data: { userId: user.id, token, expiresAt } });
  return token;
}

export async function logout(token: string): Promise<void> {
  await prisma.session.deleteMany({ where: { token } });
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token },
    include: {
      user: {
        include: { department: true },
      },
    },
  });
  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { token } }).catch(() => {});
    return null;
  }

  const u = session.user;
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    role: u.role,
    deptColor: u.department?.color ?? null,
  };
}

export async function setSessionCookie(token: string | null): Promise<void> {
  const store = await cookies();
  if (token) {
    store.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_TTL_DAYS * 86_400,
    });
  } else {
    store.delete(SESSION_COOKIE);
  }
}
