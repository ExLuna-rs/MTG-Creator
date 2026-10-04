import { Readable } from "node:stream";
import { setTimeout as sleep } from "node:timers/promises";
import { describe, expect, it } from "vitest";
import { readLines } from "./read-lines";

async function collect(lines: AsyncIterable<string>): Promise<string[]> {
  const result: string[] = [];
  for await (const line of lines) result.push(line);
  return result;
}

describe("readLines", () => {
  it("découpe des morceaux arbitraires en lignes", async () => {
    const stream = Readable.from(["a\nb", "c\r\nd", "\n", "é", "\n\nfin"]);
    expect(await collect(readLines(stream))).toEqual([
      "a",
      "bc",
      "d",
      "é",
      "",
      "fin",
    ]);
  });

  it("gère un caractère multi-octets coupé entre deux morceaux", async () => {
    const bytes = new TextEncoder().encode("Jötun\nNazgûl\n");
    const stream = Readable.from([bytes.slice(0, 2), bytes.slice(2)]);
    expect(await collect(readLines(stream))).toEqual(["Jötun", "Nazgûl"]);
  });

  it("ne perd aucune ligne si la lecture commence plus tard", async () => {
    const content = Array.from({ length: 1000 }, (_, i) => `ligne ${i}`).join(
      "\n",
    );
    const lines = readLines(Readable.from([content]));
    await sleep(20);
    const result = await collect(lines);
    expect(result).toHaveLength(1000);
    expect(result[0]).toBe("ligne 0");
  });
});
