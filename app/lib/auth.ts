import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { db, createId, now } from "@/app/lib/db";

export const SESSION_COOKIE = "ai_ofm_session";
const SESSION_DAYS = 30;

export type UserRecord = {
  id: string;
  username: string;
  passwordHash: string;
  passwordSalt: string;
  createdAt: string;
  updatedAt: string;
};

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function normalizeUsername(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

export function validateCredentials(username: string, password: string) {
  if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
    return "Логин: 3-32 символа, латиница, цифры, точка, дефис или подчёркивание.";
  }
  if (password.length < 8 || password.length > 128) {
    return "Пароль должен содержать от 8 до 128 символов.";
  }
  return null;
}

export function createPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return {
    salt,
    hash: scryptSync(password, salt, 64).toString("hex")
  };
}

export function verifyPassword(password: string, user: UserRecord) {
  const actual = scryptSync(password, user.passwordSalt, 64);
  const expected = Buffer.from(user.passwordHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const createdAt = now();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
  db.prepare(
    "INSERT INTO sessions (id, userId, tokenHash, expiresAt, createdAt) VALUES (?, ?, ?, ?, ?)"
  ).run(createId(), userId, tokenHash(token), expiresAt, createdAt);
  return { token, expiresAt };
}

export function setSessionCookie(response: { cookies: { set: Function } }, token: string, expiresAt: string) {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(expiresAt)
  });
}

export function clearSessionCookie(response: { cookies: { set: Function } }) {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0)
  });
}

export function getCurrentUser() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const user = db.prepare(
    `SELECT users.* FROM sessions
     JOIN users ON users.id = sessions.userId
     WHERE sessions.tokenHash = ? AND sessions.expiresAt > ?`
  ).get(tokenHash(token), now()) as UserRecord | undefined;

  return user || null;
}

export function deleteCurrentSession() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (token) db.prepare("DELETE FROM sessions WHERE tokenHash = ?").run(tokenHash(token));
}

export function claimUnownedData(userId: string) {
  db.exec("BEGIN IMMEDIATE;");
  try {
    db.prepare("UPDATE profiles SET userId = ? WHERE userId IS NULL").run(userId);
    db.prepare("UPDATE wavespeed_models SET userId = ? WHERE userId IS NULL").run(userId);
    db.prepare("UPDATE wavespeed_generations SET userId = ? WHERE userId IS NULL").run(userId);
    db.exec("COMMIT;");
  } catch (error) {
    db.exec("ROLLBACK;");
    throw error;
  }
}
