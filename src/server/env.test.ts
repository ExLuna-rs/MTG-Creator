import { describe, expect, it } from "vitest";
import { parseAuthEnv, parseServerEnv } from "./env";

describe("parseServerEnv", () => {
  it("accepte une URL PostgreSQL valide", () => {
    const env = parseServerEnv({
      DATABASE_URL: "postgres://mtg:secret@db:5432/mtg",
    });
    expect(env.DATABASE_URL).toBe("postgres://mtg:secret@db:5432/mtg");
  });

  it("refuse une URL absente", () => {
    expect(() => parseServerEnv({})).toThrow();
  });

  it("refuse une valeur qui n'est pas une URL", () => {
    expect(() => parseServerEnv({ DATABASE_URL: "pas une url" })).toThrow();
  });
});

describe("parseAuthEnv", () => {
  const valid = {
    BETTER_AUTH_SECRET: "x".repeat(32),
    BETTER_AUTH_URL: "http://localhost:3000",
    SMTP_URL: "smtp://mailpit:1025",
  };

  it("accepte une configuration complète et donne un expéditeur par défaut", () => {
    const env = parseAuthEnv(valid);
    expect(env.SMTP_URL).toBe("smtp://mailpit:1025");
    expect(env.MAIL_FROM).toBe("MTG Creator <no-reply@localhost>");
  });

  it("refuse un secret trop court", () => {
    expect(() =>
      parseAuthEnv({ ...valid, BETTER_AUTH_SECRET: "trop-court" }),
    ).toThrow();
  });

  it("refuse une adresse d'envoi qui n'est pas SMTP", () => {
    expect(() =>
      parseAuthEnv({ ...valid, SMTP_URL: "https://mailpit:1025" }),
    ).toThrow();
  });

  it("refuse une adresse du site qui n'est pas HTTP", () => {
    expect(() =>
      parseAuthEnv({ ...valid, BETTER_AUTH_URL: "ftp://exemple.fr" }),
    ).toThrow();
  });
});
