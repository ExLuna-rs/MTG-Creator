import { type APIRequestContext, expect } from "@playwright/test";

// Lecture des emails envoyés par l'application, via l'API de Mailpit.
const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://localhost:8025";

type MailpitSearch = {
  messages: { ID: string; Subject: string }[];
};

/** Nombre d'emails de sujet `subject` envoyés à `to`. */
export async function emailCount(
  request: APIRequestContext,
  to: string,
  subject: string,
): Promise<number> {
  const response = await request.get(`${MAILPIT_URL}/api/v1/search`, {
    params: { query: `to:"${to}" subject:"${subject}"` },
  });
  const { messages } = (await response.json()) as MailpitSearch;
  return messages.length;
}

/**
 * Attend l'email de sujet `subject` envoyé à `to`, et renvoie le lien qu'il
 * contient (le plus récent si plusieurs emails correspondent).
 */
export async function emailLink(
  request: APIRequestContext,
  to: string,
  subject: string,
): Promise<string> {
  let messageId: string | undefined;
  await expect
    .poll(
      async () => {
        const response = await request.get(`${MAILPIT_URL}/api/v1/search`, {
          params: { query: `to:"${to}" subject:"${subject}"` },
        });
        const { messages } = (await response.json()) as MailpitSearch;
        messageId = messages[0]?.ID;
        return messageId;
      },
      { message: `email « ${subject} » pour ${to}` },
    )
    .toBeTruthy();

  const response = await request.get(
    `${MAILPIT_URL}/api/v1/message/${messageId}`,
  );
  const { Text } = (await response.json()) as { Text: string };
  const link = Text.match(/https?:\/\/\S+/)?.[0];
  if (!link) throw new Error(`Aucun lien dans l'email « ${subject} »`);
  return link;
}
