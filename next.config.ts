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
    // La caméra sert au scan des cartes (page /scan), sur le site lui-même.
    value: "camera=(self), microphone=(), geolocation=()",
  },
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
];

// Adresse publique du site en développement (tunnel HTTPS pour le scan au
// téléphone, voir README) : le serveur de développement doit la laisser
// charger ses ressources (rechargement à chaud), comme localhost.
function publicHostname(): string[] {
  try {
    return [new URL(process.env.BETTER_AUTH_URL ?? "").hostname];
  } catch {
    return [];
  }
}

const nextConfig: NextConfig = {
  // Image autonome pour Docker : seul le nécessaire est copié dans l'image.
  output: "standalone",
  poweredByHeader: false,
  // Les images des cartes viennent du CDN Scryfall : l'optimiseur d'images
  // de Next.js (qui a connu plusieurs failles) n'est pas utilisé.
  images: { unoptimized: true },
  // En développement uniquement : autorise 127.0.0.1 et l'adresse publique,
  // en plus de localhost, à charger les ressources du serveur de développement.
  allowedDevOrigins: ["127.0.0.1", ...publicHostname()],
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Fichiers de la reconnaissance de caractères (≈ 7 Mo, scripts/copy-ocr-assets.mts) :
      // gardés en cache par le navigateur entre deux visites de la page de scan.
      {
        source: "/tesseract/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=604800" }],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
