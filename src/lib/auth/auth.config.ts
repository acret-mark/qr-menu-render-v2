import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { queryOne } from "@/lib/db/client";
import { verifyPassword, createSession, touchSession } from "@/lib/auth/password";
import { lookupConfirmationToken, consumeConfirmationToken } from "@/lib/auth/confirmation";

/**
 * Auth.js v5, Credentials provider — replaces Supabase Auth (GoTrue).
 * See specs/Hapag-SRS.md §12.11 and reference/render-and-authjs-replacement.md
 * for the full "why": password hashing, sessions, and email-confirmation
 * consumption are all explicit app code here instead of a managed service.
 */

export class InvalidCredentialsSignin extends CredentialsSignin {
  code = "invalid-credentials";
}

export class UnconfirmedEmailSignin extends CredentialsSignin {
  code = "unconfirmed-email";
}

export class InvalidConfirmationTokenSignin extends CredentialsSignin {
  code = "invalid-confirmation-token";
}

type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  email_verified: Date | null;
};

async function isAdminUser(userId: string): Promise<boolean> {
  const row = await queryOne<{ id: string }>(
    `select id from admin_users where id = $1`,
    [userId]
  );
  return row !== null;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
        // "owner" (default) or "admin" — checked before a session is ever
        // created, so a non-admin credential is rejected up front rather
        // than after signing in (specs/007-admin-login).
        loginContext: {},
        // Present only for the post-email-confirmation auto-sign-in
        // (013-email-confirmation) — mutually exclusive with email/password.
        confirmationToken: {},
      },
      async authorize(credentials) {
        const confirmationToken = credentials?.confirmationToken
          ? String(credentials.confirmationToken)
          : null;

        if (confirmationToken) {
          const lookup = await lookupConfirmationToken(confirmationToken);
          if (!lookup.valid) {
            throw new InvalidConfirmationTokenSignin();
          }

          const user = await queryOne<UserRow>(
            `select id, email, password_hash, email_verified from users where id = $1`,
            [lookup.userId]
          );
          if (!user) {
            throw new InvalidConfirmationTokenSignin();
          }

          await consumeConfirmationToken(confirmationToken, user.id);
          return { id: user.id, email: user.email, isAdmin: await isAdminUser(user.id) };
        }

        const email = String(credentials?.email ?? "")
          .trim()
          .toLowerCase();
        const password = String(credentials?.password ?? "");
        const loginContext = credentials?.loginContext === "admin" ? "admin" : "owner";

        if (!email || !password) {
          throw new InvalidCredentialsSignin();
        }

        const user = await queryOne<UserRow>(
          `select id, email, password_hash, email_verified from users where email = $1`,
          [email]
        );

        if (!user || !(await verifyPassword(password, user.password_hash))) {
          throw new InvalidCredentialsSignin();
        }

        const admin = await isAdminUser(user.id);

        if (loginContext === "admin") {
          if (!admin) {
            throw new InvalidCredentialsSignin();
          }
        } else if (!user.email_verified) {
          throw new UnconfirmedEmailSignin();
        }

        return { id: user.id, email: user.email, isAdmin: admin };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // Initial sign-in only — `user` is undefined on every later call.
        token.sessionToken = await createSession(user.id as string);
        token.isAdmin = (user as { isAdmin?: boolean }).isAdmin ?? false;
      }
      return token;
    },
    async session({ session, token }) {
      const sessionToken = token.sessionToken as string | undefined;
      if (!sessionToken) {
        return { ...session, user: undefined };
      }

      // Re-validated against the sessions table on every request — a
      // deleted row (revokeAllSessions on password change, or an admin
      // action) invalidates the session immediately even though the JWT
      // cookie itself is still technically valid and unexpired.
      const row = await touchSession(sessionToken);
      if (!row) {
        return { ...session, user: undefined };
      }

      session.user = {
        ...session.user,
        id: row.user_id,
        isAdmin: Boolean(token.isAdmin),
      };
      return session;
    },
  },
});
