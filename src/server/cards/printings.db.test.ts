import { describe, expect, it } from "vitest";
import { getPrintings, getSets, listPrintings, searchSets } from "./printings";

// Tests sur une vraie base PostgreSQL remplie du jeu de test.
const SOL_RING = "6ad8011d-3471-4369-9d68-b264cc027487";

describe("listPrintings", () => {
  it("liste les éditions papier, des plus récentes aux plus anciennes", async () => {
    const printings = await listPrintings(SOL_RING);
    expect(printings.length).toBeGreaterThan(2);
    const dates = printings.map((printing) => printing.releasedAt);
    expect(dates).toEqual([...dates].sort().reverse());
    expect(printings.at(-1)).toMatchObject({
      setCode: "lea",
      collectorNumber: "269",
      special: false,
    });
    expect(printings.some((printing) => printing.special)).toBe(true);
  });

  it("ne renvoie rien pour une carte inconnue", async () => {
    expect(await listPrintings("00000000-0000-0000-0000-000000000000")).toEqual(
      [],
    );
  });
});

describe("getPrintings", () => {
  it("renvoie les éditions demandées avec leur carte", async () => {
    const [first] = await listPrintings(SOL_RING);
    const found = await getPrintings([first.id, first.id]);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ id: first.id, oracleId: SOL_RING });
    expect(await getPrintings([])).toEqual([]);
  });
});

describe("searchSets", () => {
  it("trouve une extension par son code ou son nom", async () => {
    expect((await searchSets("LEA"))[0]).toMatchObject({
      code: "lea",
      name: "Limited Edition Alpha",
    });
    // Nom qui commence par la saisie d'abord, puis les plus récentes.
    expect(
      (await searchSets("limited edition")).map((set) => set.code),
    ).toEqual(["leb", "lea", "2ed"]);
    expect((await searchSets("alpha")).map((set) => set.code)).toContain("lea");
  });

  it("ignore une saisie vide", async () => {
    expect(await searchSets("  ")).toEqual([]);
  });
});

describe("getSets", () => {
  it("renvoie les extensions connues parmi les codes donnés", async () => {
    const sets = await getSets(["lea", "zzz"]);
    expect(sets.map((set) => set.code)).toEqual(["lea"]);
  });
});
