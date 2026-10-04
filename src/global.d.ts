import type messages from "../messages/fr.json";
import type { routing } from "./i18n/routing";

// Typage des langues et des clés de traduction pour next-intl.
declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof messages;
  }
}
