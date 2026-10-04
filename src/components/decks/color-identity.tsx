import { useTranslations } from "next-intl";
import { ManaSymbol } from "@/components/cards/mana-text";
import { maskToColors } from "@/domain/cards/colors";

/** Identité couleur sous forme de symboles de mana ({C} si incolore). */
export function ColorIdentity({ mask }: { mask: number }) {
  const t = useTranslations("Colors");
  const colors = maskToColors(mask);
  const symbols = colors.length > 0 ? colors : (["C"] as const);
  return (
    <span
      className="inline-flex items-center"
      title={symbols.map((color) => t(color)).join(", ")}
    >
      {symbols.map((color) => (
        <ManaSymbol key={color} symbol={`{${color}}`} />
      ))}
    </span>
  );
}
