import { inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

// Client de Better Auth pour le navigateur : appelle les routes /api/auth/…
// du même site.
export const authClient = createAuthClient({
  plugins: [
    inferAdditionalFields({
      user: { locale: { type: "string", required: false } },
    }),
  ],
});
