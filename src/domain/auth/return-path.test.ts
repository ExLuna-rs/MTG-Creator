import { describe, expect, it } from "vitest";
import { safeReturnPath } from "./return-path";

describe("safeReturnPath", () => {
  it("garde les chemins internes", () => {
    expect(safeReturnPath("/settings")).toBe("/settings");
    expect(safeReturnPath("/decks/abc-123")).toBe("/decks/abc-123");
  });

  it("revient à l'accueil pour toute autre valeur", () => {
    expect(safeReturnPath(undefined)).toBe("/");
    expect(safeReturnPath(["/settings"])).toBe("/");
    expect(safeReturnPath("")).toBe("/");
    expect(safeReturnPath("settings")).toBe("/");
    expect(safeReturnPath("https://evil.example")).toBe("/");
    expect(safeReturnPath("//evil.example")).toBe("/");
    expect(safeReturnPath("/\\evil.example")).toBe("/");
    expect(safeReturnPath("/settings?x=1")).toBe("/");
  });
});
