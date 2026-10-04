import "server-only";
import { createTransport, type Transporter } from "nodemailer";
import { getAuthEnv } from "@/server/env";
import type { EmailContent } from "./templates";

// Conservé sur globalThis pour survivre au rechargement à chaud.
const globalForMail = globalThis as unknown as { mailer?: Transporter };

function getTransport() {
  globalForMail.mailer ??= createTransport(getAuthEnv().SMTP_URL);
  return globalForMail.mailer;
}

/** Envoie un email (Mailpit en développement, fournisseur SMTP en production). */
export async function sendEmail(to: string, content: EmailContent) {
  await getTransport().sendMail({
    from: getAuthEnv().MAIL_FROM,
    to,
    subject: content.subject,
    text: content.text,
    html: content.html,
  });
}
