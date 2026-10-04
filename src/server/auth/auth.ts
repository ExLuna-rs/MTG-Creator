import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { hasLocale, type Locale } from "next-intl";
import { displayNameSchema, localeSchema } from "@/domain/auth/forms";
import { routing } from "@/i18n/routing";
import { getDb } from "@/server/db";
import { accounts, sessions, users, verifications } from "@/server/db/schema";
import { sendEmail } from "@/server/email/mailer";
import { type AccountEmailKind, accountEmail } from "@/server/email/templates";
import { getAuthEnv } from "@/server/env";

/** Langue des emails d'un utilisateur : sa langue préférée. */
function userLocale(user: { locale?: unknown }): Locale {
  return hasLocale(routing.locales, user.locale)
    ? user.locale
    : routing.defaultLocale;
}

/**
 * Envoie un email de compte sans l'attendre : la réponse met le même temps,
 * que l'adresse existe ou non (pas de déduction des comptes existants).
 */
function sendAccountEmail(
  kind: AccountEmailKind,
  user: { email: string; name: string; locale?: unknown },
  url: string,
) {
  const content = accountEmail(kind, {
    locale: userLocale(user),
    name: user.name,
    url,
  });
  sendEmail(user.email, content).catch((error: unknown) => {
    console.error(`Échec de l'envoi de l'email « ${kind} »`, error);
  });
}

/** Refuse un pseudo invalide, à la création comme à la modification. */
function assertValidName(name: unknown) {
  if (name === undefined) return;
  if (!displayNameSchema.safeParse(name).success) {
    throw new APIError("BAD_REQUEST", {
      code: "INVALID_NAME",
      message: "Invalid display name",
    });
  }
}

function createAuth() {
  const env = getAuthEnv();

  return betterAuth({
    appName: "MTG Creator",
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(getDb(), {
      provider: "pg",
      schema: {
        user: users,
        session: sessions,
        account: accounts,
        verification: verifications,
      },
    }),
    emailAndPassword: {
      enabled: true,
      // Pas de session tant que l'adresse n'est pas confirmée.
      requireEmailVerification: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      // Un mot de passe réinitialisé déconnecte tous les appareils.
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        sendAccountEmail("resetPassword", user, url);
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      // Une tentative de connexion sans adresse confirmée renvoie le lien :
      // c'est le formulaire de connexion qui le demande, pour choisir la
      // page d'arrivée (voir sign-in-form.tsx).
      sendOnSignIn: false,
      autoSignInAfterVerification: true,
      expiresIn: 60 * 60 * 24,
      sendVerificationEmail: async ({ user, url }) => {
        sendAccountEmail("verifyEmail", user, url);
      },
    },
    user: {
      additionalFields: {
        locale: {
          type: "string",
          required: false,
          defaultValue: routing.defaultLocale,
          input: true,
          validator: { input: localeSchema },
        },
      },
      deleteUser: { enabled: true },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            assertValidName(user.name);
          },
        },
        update: {
          before: async (user) => {
            assertValidName(user.name);
          },
        },
      },
    },
    advanced: {
      // En production, le trafic arrive uniquement par le tunnel Cloudflare,
      // qui renseigne l'adresse IP réelle du visiteur dans cet en-tête
      // (limitation des tentatives de connexion par adresse).
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
    },
    telemetry: { enabled: false },
    // Doit rester le dernier plugin : écrit les cookies depuis les Server Actions.
    plugins: [nextCookies()],
  });
}

export type Auth = ReturnType<typeof createAuth>;

// Conservé sur globalThis pour survivre au rechargement à chaud.
const globalForAuth = globalThis as unknown as { auth?: Auth };

/** Instance de Better Auth, créée au premier appel (pas au build). */
export function getAuth(): Auth {
  globalForAuth.auth ??= createAuth();
  return globalForAuth.auth;
}
