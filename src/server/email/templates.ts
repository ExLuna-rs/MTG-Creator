import { createTranslator, type Locale } from "next-intl";
import en from "../../../messages/en.json";
import fr from "../../../messages/fr.json";

const MESSAGES = { fr, en } as const;

/** Un email prêt à envoyer : version texte et version HTML. */
export type EmailContent = {
  subject: string;
  text: string;
  html: string;
};

export type AccountEmailKind =
  | "verifyEmail"
  | "resetPassword"
  | "accountExists";

/** Échappe le texte inséré dans le HTML (le pseudo est choisi par l'utilisateur). */
export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * Email lié au compte (confirmation de l'adresse, mot de passe oublié,
 * inscription avec une adresse déjà enregistrée),
 * dans la langue de l'utilisateur. `url` est le lien à suivre.
 */
export function accountEmail(
  kind: AccountEmailKind,
  { locale, name, url }: { locale: Locale; name: string; url: string },
): EmailContent {
  const t = createTranslator({
    locale,
    messages: MESSAGES[locale],
    namespace: "Emails",
  });
  const subject = t(`${kind}.subject`);
  const greeting = t("greeting", { name });
  const body = t(`${kind}.body`);
  const action = t(`${kind}.action`);
  const ignore = t(`${kind}.ignore`);
  const signature = t("signature");

  const text = [greeting, "", body, "", url, "", ignore, "", signature].join(
    "\n",
  );

  const html = `<!doctype html>
<html lang="${locale}">
<body style="font-family: system-ui, sans-serif; color: #18181b; line-height: 1.5;">
<p>${escapeHtml(t("greeting", { name }))}</p>
<p>${escapeHtml(body)}</p>
<p><a href="${escapeHtml(url)}" style="display: inline-block; padding: 10px 16px; border-radius: 6px; background: #18181b; color: #ffffff; text-decoration: none;">${escapeHtml(action)}</a></p>
<p style="font-size: 13px; color: #52525b;">${escapeHtml(t("linkFallback"))}<br><a href="${escapeHtml(url)}">${escapeHtml(url)}</a></p>
<p style="font-size: 13px; color: #52525b;">${escapeHtml(ignore)}</p>
<p>${escapeHtml(signature)}</p>
</body>
</html>`;

  return { subject, text, html };
}
