import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ManaSymbol, ManaText } from "./mana-text";

describe("ManaSymbol", () => {
  it.each([
    ["{1}", "ms-1"],
    ["{2}", "ms-2"],
    ["{10}", "ms-10"],
    ["{X}", "ms-x"],
    ["{2/W}", "ms-2w"],
  ])("garde la classe de %s", (symbol, className) => {
    const html = renderToStaticMarkup(<ManaSymbol symbol={symbol} />);
    expect(html).toContain(`class="ms ms-cost ${className} mx-px"`);
  });
});

describe("ManaText", () => {
  it("affiche le mana générique devant le mana coloré", () => {
    const html = renderToStaticMarkup(<ManaText text="{2}{W}" />);
    expect(html).toContain('class="ms ms-cost ms-2 mx-px"');
    expect(html).toContain('class="ms ms-cost ms-w mx-px"');
  });
});
