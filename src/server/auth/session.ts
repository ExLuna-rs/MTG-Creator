import "server-only";
import { headers } from "next/headers";
import type { Locale } from "next-intl";
import { redirect } from "@/i18n/navigation";
import { getAuth } from "./auth";

/** Session de la requête en cours, ou null si personne n'est connecté. */
export async function getCurrentSession() {
  // headers() d'abord : la page devient dynamique avant toute lecture de la
  // configuration (absente pendant le build de l'image).
  const requestHeaders = await headers();
  return getAuth().api.getSession({ headers: requestHeaders });
}

export type CurrentSession = NonNullable<
  Awaited<ReturnType<typeof getCurrentSession>>
>;

/**
 * Moyens de connexion de l'utilisateur connecté : « credential » (email et
 * mot de passe), « google »…
 */
export async function getSignInMethods(): Promise<string[]> {
  const requestHeaders = await headers();
  const accounts = await getAuth().api.listUserAccounts({
    headers: requestHeaders,
  });
  return accounts.map((account) => account.providerId);
}

/**
 * Session obligatoire : sans elle, redirige vers la page de connexion, qui
 * ramènera ensuite sur `returnTo` (chemin sans la langue, par exemple
 * « /settings »).
 */
export async function requireSession(
  locale: Locale,
  returnTo: string,
): Promise<CurrentSession> {
  const session = await getCurrentSession();
  if (!session) {
    return redirect({
      href: { pathname: "/sign-in", query: { next: returnTo } },
      locale,
    });
  }
  return session;
}
