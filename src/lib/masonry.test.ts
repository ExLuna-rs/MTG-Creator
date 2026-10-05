import { describe, expect, it } from "vitest";
import { masonry } from "./masonry";

describe("répartition en maçonnerie", () => {
  it("place chaque élément dans la colonne la moins haute", () => {
    const items = [
      { id: "a", height: 5 },
      { id: "b", height: 1 },
      { id: "c", height: 1 },
      { id: "d", height: 2 },
      { id: "e", height: 1 },
    ];
    const columns = masonry(items, (item) => item.height, 3);
    expect(columns.map((column) => column.map((item) => item.id))).toEqual([
      ["a"],
      ["b", "d"],
      ["c", "e"],
    ]);
  });

  it("garde au moins une colonne", () => {
    expect(masonry([1, 2], () => 1, 0)).toEqual([[1, 2]]);
  });
});
