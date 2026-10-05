import { ChartColumn, Search, Share2, ShieldCheck } from "lucide-react";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

const MANA_COLORS = [
  "bg-mana-w",
  "bg-mana-u",
  "bg-mana-b",
  "bg-mana-r",
  "bg-mana-g",
];

const FEATURES = [
  { key: "search", icon: Search },
  { key: "rules", icon: ShieldCheck },
  { key: "stats", icon: ChartColumn },
  { key: "share", icon: Share2 },
] as const;

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations("HomePage");

  return (
    <>
      <section className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
        <div className="flex max-w-2xl flex-col items-start gap-6">
          <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1 font-medium text-muted-foreground text-xs">
            <span className="flex gap-1" aria-hidden>
              {MANA_COLORS.map((color) => (
                <span key={color} className={`size-2 rounded-full ${color}`} />
              ))}
            </span>
            {t("badge")}
          </span>
          <h1 className="text-balance font-semibold text-4xl tracking-tight sm:text-5xl">
            {t("title")}
          </h1>
          <p className="text-pretty text-lg text-muted-foreground">
            {t("subtitle")}
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/decks/new" className={buttonVariants({ size: "lg" })}>
              {t("createDeck")}
            </Link>
            <Link
              href="/cards"
              className={buttonVariants({ size: "lg", variant: "outline" })}
            >
              {t("searchCards")}
            </Link>
          </div>
        </div>
      </section>

      <section
        aria-labelledby="features-title"
        className="border-t bg-muted/40"
      >
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2
            id="features-title"
            className="font-semibold text-2xl tracking-tight"
          >
            {t("featuresTitle")}
          </h2>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {FEATURES.map(({ key, icon: Icon }) => (
              <li
                key={key}
                className="rounded-xl border bg-card p-6 text-card-foreground"
              >
                <Icon className="size-5 text-primary" aria-hidden />
                <h3 className="mt-4 font-medium">
                  {t(`features.${key}.title`)}
                </h3>
                <p className="mt-2 text-muted-foreground text-sm">
                  {t(`features.${key}.description`)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
