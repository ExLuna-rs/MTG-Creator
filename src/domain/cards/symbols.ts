/** Morceau d'un texte de carte : du texte, ou un symbole comme « {2/W} ». */
export type TextToken =
  | { kind: "text"; text: string }
  | { kind: "symbol"; symbol: string };

/** Découpe un coût ou un texte Oracle en texte et symboles {…}. */
export function tokenizeSymbols(text: string): TextToken[] {
  const tokens: TextToken[] = [];
  let last = 0;
  for (const match of text.matchAll(/\{[^{}]+\}/g)) {
    if (match.index > last) {
      tokens.push({ kind: "text", text: text.slice(last, match.index) });
    }
    tokens.push({ kind: "symbol", symbol: match[0] });
    last = match.index + match[0].length;
  }
  if (last < text.length) tokens.push({ kind: "text", text: text.slice(last) });
  return tokens;
}

/** Suffixes des classes de mana-font (« ms-… ») utilisées pour les symboles. */
export const SUPPORTED_SYMBOL_CLASSES = [
  ...Array.from({ length: 21 }, (_, n) => String(n)),
  "100",
  "1000000",
  ..."wubrgcsxyzephdl".split(""),
  "tap",
  "untap",
  "1-2",
  "infinity",
  "tk",
  "acorn",
  "chaos",
  "planeswalker",
  // Hybrides, hybrides à 2, hybrides incolores
  ..."wu wb ub ur br bg rw rg gw gu".split(" "),
  ..."2w 2u 2b 2r 2g".split(" "),
  ..."cw cu cb cr cg".split(" "),
  // Phyrexians et hybrides phyrexians
  ..."wp up bp rp gp".split(" "),
  ..."wup wbp ubp urp brp bgp rwp rgp gwp gup".split(" "),
];

const SUPPORTED = new Set(SUPPORTED_SYMBOL_CLASSES);

const SPECIAL: Record<string, string> = {
  T: "tap",
  Q: "untap",
  "½": "1-2",
  "∞": "infinity",
  A: "acorn",
  PW: "planeswalker",
};

export interface SymbolIcon {
  /** Classe mana-font, par exemple « ms-wu ». */
  className: string;
  /** Demi-symbole (« {HW} » : un demi-mana blanc). */
  half: boolean;
}

/** Icône mana-font d'un symbole, ou null s'il n'y en a pas. */
export function symbolIcon(symbol: string): SymbolIcon | null {
  const inner = symbol.slice(1, -1).toUpperCase();
  const half = /^H[WUBRG]$/.test(inner);
  const key = half
    ? inner.slice(1).toLowerCase()
    : (SPECIAL[inner] ?? inner.replaceAll("/", "").toLowerCase());
  if (!SUPPORTED.has(key)) return null;
  return { className: `ms-${key}`, half };
}
