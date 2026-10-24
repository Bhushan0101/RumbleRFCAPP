import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";

export const { auth, handlers, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 },
  pages: { signIn: "/portal/sign-in" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email =
          typeof credentials?.email === "string"
            ? credentials.email.trim().toLowerCase()
            : "";
        const password =
          typeof credentials?.password === "string" ? credentials.password : "";
        if (!email || !password || password.length > 128) return null;
        const user = await prisma.portalUser.findUnique({ where: { email } });
        if (!user) return null;
        if (!verifyPassword(password, user.salt, user.passwordHash)) return null;
        return {
          id: String(user.id),
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: string }).role ?? "fighter";
        token.uid = Number((user as { id?: string }).id);
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { role?: string }).role = token.role as string;
        (session.user as { id?: number }).id = token.uid as number;
      }
      return session;
    },
  },
});

declare module "next-auth" {
  interface User {
    role?: string;
  }
  interface Session {
    user: {
      id?: number;
      role?: string;
    } & { name?: string | null; email?: string | null; image?: string | null };
  }
}
