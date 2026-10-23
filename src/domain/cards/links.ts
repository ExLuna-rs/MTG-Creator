/** Pages d'où l'on peut ouvrir une fiche carte, et y revenir. */
export const BACK_PAGES = ["cards", "collection"] as const;

export type BackPage = (typeof BACK_PAGES)[number];

export interface BackLink {
  page: BackPage;
  /** Chemin sans la langue, avec la recherche d'origine (`/cards?q=sol`). */
  href: string;
}

const DEFAULT_BACK_LINK: BackLink = { page: "cards", href: "/cards" };
const MAX_BACK_LENGTH = 1000;

/**
 * Lit le paramètre `from` d'une fiche carte : la page d'où l'on vient, avec
 * ses paramètres de recherche. Seules la recherche de cartes et la
 * collection sont acceptées, et les paramètres sont réécrits : un lien
 * piégé ne peut pas renvoyer ailleurs.
 */
export function parseBackLink(value: unknown): BackLink {
  if (typeof value !== "string" || value.length > MAX_BACK_LENGTH) {
    return DEFAULT_BACK_LINK;
  }
  const mark = value.indexOf("?");
  const path = mark < 0 ? value : value.slice(0, mark);
  const query = mark < 0 ? "" : value.slice(mark + 1);
  const page = BACK_PAGES.find((name) => path === `/${name}`);
  if (!page) return DEFAULT_BACK_LINK;
  const search = new URLSearchParams(query).toString();
  return { page, href: search ? `${path}?${search}` : path };
}

/** Chemin d'une page avec ses paramètres de recherche, pour `from`. */
export function pageWithQuery(
  page: BackPage,
  query: Record<string, string | string[]>,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    for (const item of Array.isArray(value) ? value : [value]) {
      params.append(key, item);
    }
  }
  const search = params.toString();
  return search ? `/${page}?${search}` : `/${page}`;
}

/** Lien vers la fiche d'une carte, qui saura revenir à `from`. */
export function cardHref(oracleId: string, from?: string): string {
  const path = `/cards/${oracleId}`;
  return from ? `${path}?${new URLSearchParams({ from })}` : path;
}

/**
 * Recherche de la carte sur Cardmarket et TCGplayer. On cherche par le nom
 * (face avant d'une carte double) plutôt que par une édition précise : les
 * marchés listent alors toutes les éditions, triables par prix.
 */
export function marketLinks(
  name: string,
  locale: string,
): { cardmarket: string; tcgplayer: string } {
  const front = name.split(" // ")[0] ?? name;
  const language = locale === "fr" ? "fr" : "en";
  return {
    cardmarket: `https://www.cardmarket.com/${language}/Magic/Products/Search?${new URLSearchParams({ searchString: front })}`,
    tcgplayer: `https://www.tcgplayer.com/search/magic/product?${new URLSearchParams({ productLineName: "magic", q: front })}`,
  };
}
