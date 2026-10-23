import { describe, expect, it } from "vitest";
import { cardHref, marketLinks, pageWithQuery, parseBackLink } from "./links";

describe("parseBackLink", () => {
  it("garde la recherche de cartes et ses paramètres", () => {
    expect(parseBackLink("/cards?q=sol&color=W&color=U")).toEqual({
      page: "cards",
      href: "/cards?q=sol&color=W&color=U",
    });
    expect(parseBackLink("/cards")).toEqual({ page: "cards", href: "/cards" });
  });

  it("garde la collection", () => {
    expect(parseBackLink("/collection?q=bolt&sort=price")).toEqual({
      page: "collection",
      href: "/collection?q=bolt&sort=price",
    });
  });

  it("réécrit les paramètres", () => {
    expect(parseBackLink("/cards?q=a b&x=<script>").href).toBe(
      "/cards?q=a+b&x=%3Cscript%3E",
    );
  });

  it("revient à la recherche pour toute autre valeur", () => {
    const fallback = { page: "cards", href: "/cards" };
    expect(parseBackLink(undefined)).toEqual(fallback);
    expect(parseBackLink(["/collection"])).toEqual(fallback);
    expect(parseBackLink("")).toEqual(fallback);
    expect(parseBackLink("/settings")).toEqual(fallback);
    expect(parseBackLink("https://evil.example/cards")).toEqual(fallback);
    expect(parseBackLink("//evil.example/cards")).toEqual(fallback);
    expect(parseBackLink("/cards/../settings")).toEqual(fallback);
    expect(parseBackLink(`/cards?q=${"a".repeat(2000)}`)).toEqual(fallback);
  });
});

describe("pageWithQuery et cardHref", () => {
  it("construit le chemin de retour, puis le lien de la fiche", () => {
    const from = pageWithQuery("cards", { q: "sol ring", color: ["W", "U"] });
    expect(from).toBe("/cards?q=sol+ring&color=W&color=U");
    expect(parseBackLink(from).href).toBe(from);
    expect(cardHref("abc", from)).toBe(
      "/cards/abc?from=%2Fcards%3Fq%3Dsol%2Bring%26color%3DW%26color%3DU",
    );
    expect(pageWithQuery("collection", {})).toBe("/collection");
    expect(cardHref("abc")).toBe("/cards/abc");
  });
});

describe("marketLinks", () => {
  it("cherche la face avant sur Cardmarket et TCGplayer", () => {
    const links = marketLinks(
      "Delver of Secrets // Insectile Aberration",
      "fr",
    );
    expect(links.cardmarket).toBe(
      "https://www.cardmarket.com/fr/Magic/Products/Search?searchString=Delver+of+Secrets",
    );
    expect(links.tcgplayer).toBe(
      "https://www.tcgplayer.com/search/magic/product?productLineName=magic&q=Delver+of+Secrets",
    );
    expect(marketLinks("Sol Ring", "en").cardmarket).toContain("/en/Magic/");
  });
});
