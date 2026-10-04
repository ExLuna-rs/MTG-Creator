import { describe, expect, it } from "vitest";
import { parseServerEnv } from "./env";

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
