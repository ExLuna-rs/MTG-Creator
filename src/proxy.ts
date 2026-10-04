import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Redirige vers /fr ou /en selon la langue du navigateur.
// Aucune règle d'autorisation ici : elles vivent au plus près des données.
export default createMiddleware(routing);

export const config = {
  // Toutes les pages, sauf l'API, les fichiers internes de Next.js
  // et les fichiers statiques (tout chemin contenant un point).
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
