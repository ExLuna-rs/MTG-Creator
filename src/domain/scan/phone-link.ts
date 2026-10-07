/**
 * Le QR code du scan reprend l'adresse par laquelle l'ordinateur a ouvert
 * l'application. Le téléphone ne peut pas s'en servir dans deux cas :
 * - `local` : l'adresse désigne la machine elle-même (localhost, 127.0.0.1) ;
 *   sur le téléphone, elle désigne… le téléphone ;
 * - `insecure` : l'adresse est en HTTP ; hors localhost, le navigateur du
 *   téléphone refuse alors l'accès à la caméra.
 */
export type PhoneLinkProblem = "local" | "insecure";

const LOOPBACK = /^(localhost|.+\.localhost|127(\.\d{1,3}){3}|\[::1\])$/i;

export function phoneLinkProblem(origin: string): PhoneLinkProblem | null {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return null;
  }
  if (LOOPBACK.test(url.hostname)) return "local";
  if (url.protocol !== "https:") return "insecure";
  return null;
}
