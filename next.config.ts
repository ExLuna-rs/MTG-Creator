import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// En-têtes de sécurité envoyés sur toutes les réponses. La CSP complète
// (avec nonce pour les scripts) arrive avec la mise en production.
const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
];

const nextConfig: NextConfig = {
  // Image autonome pour Docker : seul le nécessaire est copié dans l'image.
  output: "standalone",
  poweredByHeader: false,
  // Les images des cartes viennent du CDN Scryfall : l'optimiseur d'images
  // de Next.js (qui a connu plusieurs failles) n'est pas utilisé.
  images: { unoptimized: true },
  // En développement uniquement : autorise les tests de bout en bout (service
  // Docker « app ») et 127.0.0.1, en plus de localhost, à charger les
  // ressources du serveur de développement.
  allowedDevOrigins: ["app", "127.0.0.1"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default withNextIntl(nextConfig);
