import { Fragment } from "react";
import { symbolIcon, tokenizeSymbols } from "@/domain/cards/symbols";
import { cn } from "@/lib/utils";
import "@/styles/mana.css";

/**
 * Un symbole comme « {2/W} », dessiné avec la police Mana. Le texte du
 * symbole reste lisible par les lecteurs d'écran et lors d'un copier-coller.
 */
export function ManaSymbol({ symbol }: { symbol: string }) {
  const icon = symbolIcon(symbol);
  if (!icon) return <span>{symbol}</span>;

  const glyph = (
    <i
      className={cn("ms ms-cost", icon.className, !icon.half && "mx-px")}
      aria-hidden
    />
  );
  return (
    <span className="whitespace-nowrap">
      {icon.half ? <span className="ms-half">{glyph}</span> : glyph}
      <span className="sr-only">{symbol}</span>
    </span>
  );
}

/** Texte de carte dont les symboles {…} sont remplacés par des icônes. */
export function ManaText({ text }: { text: string }) {
  return tokenizeSymbols(text).map((token, index) => (
    // Les morceaux d'un texte figé n'ont pas d'identité propre : leur
    // position suffit comme clé.
    // biome-ignore lint/suspicious/noArrayIndexKey: liste figée
    <Fragment key={index}>
      {token.kind === "symbol" ? (
        <ManaSymbol symbol={token.symbol} />
      ) : (
        token.text
      )}
    </Fragment>
  ));
}

/** Texte Oracle : un paragraphe par ligne, symboles en icônes. */
export function OracleText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {text.split("\n").map((line, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: lignes d'un texte figé
        <p key={index}>
          <ManaText text={line} />
        </p>
      ))}
    </div>
  );
}
