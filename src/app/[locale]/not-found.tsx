import { useTranslations } from "next-intl";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default function NotFoundPage() {
  const t = useTranslations("NotFoundPage");

  return (
    <div className="mx-auto flex max-w-6xl flex-col items-start gap-4 px-4 py-24">
      <h1 className="font-semibold text-3xl tracking-tight">{t("title")}</h1>
      <p className="text-muted-foreground">{t("description")}</p>
      <Link href="/" className={buttonVariants({ variant: "outline" })}>
        {t("backHome")}
      </Link>
    </div>
  );
}
