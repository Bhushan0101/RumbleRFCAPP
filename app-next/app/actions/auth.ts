"use server";

import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn, signOut } from "@/lib/auth";

export type AuthState = { ok: boolean; message: string };

export async function signInAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { ok: false, message: "Enter your email and password." };
  try {
    await signIn("credentials", { email, password, redirect: false });
  } catch (e) {
    if (e instanceof AuthError) {
      return { ok: false, message: "Invalid email or password." };
    }
    throw e;
  }
  redirect("/portal");
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}

// -------- Password reset: self-serve, token-based ------------------------

export type ResetState = { ok: boolean; message: string };

const RESET_TOKEN_TTL_SECONDS = 10 * 60;

function randomToken(bytes = 32): string {
  // URL-safe base64 of N random bytes. Node crypto is already on the server.
  const { randomBytes } = require("node:crypto") as typeof import("node:crypto");
  return randomBytes(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function requestPasswordReset(
  _prev: ResetState,
  formData: FormData,
): Promise<ResetState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, message: "Enter a valid email address." };
  }
  const { prisma } = await import("@/lib/prisma");
  const { sendMail, SITE_URL } = await import("@/lib/mail");
  const user = await prisma.portalUser.findUnique({ where: { email } });

  // Only send the reset email if the account exists. We deliberately return
  // the same success message either way so the endpoint doesn't reveal
  // whether an email is registered (account-enumeration guard).
  if (user) {
    // Invalidate any previous unused tokens for this user so only the latest
    // email's link works — matches typical reset-flow expectations.
    await prisma.passwordReset.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    const token = randomToken(32);
    const expiresAt = Math.floor(Date.now() / 1000) + RESET_TOKEN_TTL_SECONDS;
    await prisma.passwordReset.create({
      data: { token, userId: user.id, expiresAt },
    });

    const link = `${SITE_URL}/portal/reset-password?token=${token}`;
    await sendMail({
      to: email,
      subject: "W.U.C.O: reset your password",
      body:
        `Hi ${user.name},\n\n` +
        `We received a request to reset your W.U.C.O password. ` +
        `Open this link within 10 minutes to pick a new password:\n\n` +
        `${link}\n\n` +
        `The link works once and expires 10 minutes after it was sent.\n\n` +
        `If you didn't request this, you can ignore this email — your current ` +
        `password keeps working.\n\n— W.U.C.O Ireland`,
      category: "verification_submitted",
    });
  }

  return {
    ok: true,
    message:
      "If that email is registered, a reset link has been sent. The link works once and expires after 10 minutes — check your inbox.",
  };
}

// --------- Completing the reset ------------------------------------------
// The token must exist, be unused, and still be within its 10-minute window.
export async function completePasswordReset(
  _prev: ResetState,
  formData: FormData,
): Promise<ResetState> {
  const token = String(formData.get("token") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (!token) return { ok: false, message: "Missing reset token." };
  if (password.length < 10) {
    return { ok: false, message: "Pick a password with at least 10 characters." };
  }
  if (password !== confirm) {
    return { ok: false, message: "Passwords don't match." };
  }

  const { prisma } = await import("@/lib/prisma");
  const { hashPassword } = await import("@/lib/password");
  const { sendMail } = await import("@/lib/mail");

  const row = await prisma.passwordReset.findUnique({
    where: { token },
    include: { user: true },
  });
  if (!row) return { ok: false, message: "This link is invalid." };
  if (row.usedAt) {
    return { ok: false, message: "This link has already been used." };
  }
  if (row.expiresAt * 1000 < Date.now()) {
    return { ok: false, message: "This link has expired. Request a new one." };
  }

  const { salt, hash } = await hashPassword(password);
  const now = new Date();
  await prisma.$transaction([
    prisma.portalUser.update({
      where: { id: row.userId },
      data: { salt, passwordHash: hash },
    }),
    prisma.passwordReset.update({
      where: { token },
      data: { usedAt: now },
    }),
    // Also mark every other outstanding token for this user as used so none
    // of them survive a successful reset.
    prisma.passwordReset.updateMany({
      where: { userId: row.userId, usedAt: null, NOT: { token } },
      data: { usedAt: now },
    }),
    // Nuke any active sessions so the old password can't be used anywhere.
    prisma.session.deleteMany({ where: { userId: row.userId } }),
  ]);

  await sendMail({
    to: row.user.email,
    subject: "W.U.C.O: your password was reset",
    body:
      `Hi ${row.user.name},\n\n` +
      `Your W.U.C.O password was just reset. If this wasn't you, reply to this ` +
      `email right away.\n\n— W.U.C.O Ireland`,
    category: "verification_submitted",
  });

  return {
    ok: true,
    message: "Your password has been updated. You can sign in with it now.",
  };
}
