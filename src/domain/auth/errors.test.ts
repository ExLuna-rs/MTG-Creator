import { describe, expect, it } from "vitest";
import { authErrorKey } from "./errors";

describe("authErrorKey", () => {
  it("traduit les codes connus de Better Auth", () => {
    expect(authErrorKey({ code: "INVALID_EMAIL_OR_PASSWORD" })).toBe(
      "invalidCredentials",
    );
    expect(authErrorKey({ code: "EMAIL_NOT_VERIFIED", status: 403 })).toBe(
      "emailNotVerified",
    );
    expect(authErrorKey({ code: "TOKEN_EXPIRED" })).toBe("invalidToken");
    expect(authErrorKey({ code: "INVALID_NAME" })).toBe("nameLength");
  });

  it("reconnaît la limitation des tentatives par son statut HTTP", () => {
    expect(authErrorKey({ status: 429 })).toBe("tooManyRequests");
  });

  it("renvoie une erreur générique pour le reste", () => {
    expect(authErrorKey({ code: "SOMETHING_NEW", status: 500 })).toBe(
      "unknown",
    );
    expect(authErrorKey({})).toBe("unknown");
    expect(authErrorKey(null)).toBe("unknown");
  });
});
