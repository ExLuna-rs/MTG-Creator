import { useTranslations } from "next-intl";

const FAN_CONTENT_POLICY_URL =
  "https://company.wizards.com/en/legal/fancontentpolicy";
const SCRYFALL_URL = "https://scryfall.com";

const linkClassName =
  "underline underline-offset-2 hover:text-foreground focus-visible:text-foreground";

export function SiteFooter() {
  const t = useTranslations("Footer");

  return (
    <footer className="border-t">
      <div className="mx-auto max-w-6xl space-y-2 px-4 py-6 text-muted-foreground text-xs leading-relaxed">
        <p>
          {t.rich("fanContent", {
            policy: (chunks) => (
              <a
                href={FAN_CONTENT_POLICY_URL}
                className={linkClassName}
                target="_blank"
                rel="noopener noreferrer"
              >
                {chunks}
              </a>
            ),
          })}
        </p>
        <p>
          {t.rich("scryfall", {
            link: (chunks) => (
              <a
                href={SCRYFALL_URL}
                className={linkClassName}
                target="_blank"
                rel="noopener noreferrer"
              >
                {chunks}
              </a>
            ),
          })}
        </p>
      </div>
    </footer>
  );
}
