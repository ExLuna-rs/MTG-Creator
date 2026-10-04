import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import { routing } from "./routing";

type Messages = { [key: string]: string | Messages };

/** Liste les clés de traduction sous la forme "Section.cle". */
function flattenKeys(messages: Messages, prefix = ""): string[] {
  return Object.entries(messages).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === "string" ? [path] : flattenKeys(value, path);
  });
}

function flattenValues(messages: Messages): string[] {
  return Object.values(messages).flatMap((value) =>
    typeof value === "string" ? [value] : flattenValues(value),
  );
}

describe("traductions", () => {
  it("couvrent toutes les langues de l'application", () => {
    expect([...routing.locales].sort()).toEqual(["en", "fr"]);
  });

  it("ont les mêmes clés en français et en anglais", () => {
    expect(flattenKeys(en).sort()).toEqual(flattenKeys(fr).sort());
  });

  it("n'ont aucun texte vide", () => {
    for (const messages of [fr, en]) {
      for (const value of flattenValues(messages)) {
        expect(value.trim()).not.toBe("");
      }
    }
  });
});
