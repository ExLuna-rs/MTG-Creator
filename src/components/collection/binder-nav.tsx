"use client";

import { BookOpen, Inbox, LayoutGrid } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useId, useState } from "react";
import { type FolderItem, FolderNav } from "@/components/organizer/folder-nav";
import { Toast, type ToastMessage } from "@/components/ui/toast";
import { MAX_BINDER_NAME_LENGTH } from "@/domain/collection/binders";
import { useRouter } from "@/i18n/navigation";

type Query = Record<string, string | string[]>;

/** Vue de la collection : toute la collection, les non rangés, ou l'id d'un classeur. */
export type BinderViewKey = "all" | "none" | (string & {});

interface BinderCounts {
  all: number;
  none: number;
}

/**
 * Colonne des classeurs de la collection (ordinateur) : toute la collection,
 * les classeurs avec leur menu, les non rangés, et la création d'un classeur.
 */
export function BinderNav({
  binders,
  counts,
  view,
  query,
}: {
  binders: readonly FolderItem[];
  counts: BinderCounts;
  view: BinderViewKey;
  /** Autres paramètres de la page, gardés d'un classeur à l'autre. */
  query: Query;
}) {
  const t = useTranslations("Binders");
  const [message, setMessage] = useState<ToastMessage | null>(null);
  const hide = useCallback(() => setMessage(null), []);
  return (
    <>
      <FolderNav
        pathname="/collection"
        param="binder"
        apiBase="/api/binders"
        maxNameLength={MAX_BINDER_NAME_LENGTH}
        labels={{
          nav: t("nav"),
          section: t("section"),
          create: t("create"),
          menu: (name) => t("menu", { name }),
          rename: t("rename"),
          remove: t("remove"),
          createTitle: t("createTitle"),
          renameTitle: (name) => t("renameTitle", { name }),
          name: t("name"),
          nameHint: t("nameHint", { max: MAX_BINDER_NAME_LENGTH }),
          createSubmit: t("createSubmit"),
          renameSubmit: t("renameSubmit"),
          cancel: t("cancel"),
          close: t("close"),
          removeTitle: (name) => t("removeTitle", { name }),
          removeText: (count) => t("removeText", { count }),
          removeConfirm: t("removeConfirm"),
          removed: (name) => t("removed", { name }),
          errors: {
            duplicate: t("errors.duplicate"),
            tooMany: t("errors.tooMany"),
            network: t("errors.network"),
          },
        }}
        leading={[
          {
            key: "all",
            label: t("all"),
            icon: <LayoutGrid className="size-4" />,
            count: counts.all,
          },
        ]}
        trailing={[
          {
            key: "none",
            label: t("unsorted"),
            icon: <Inbox className="size-4" />,
            count: counts.none,
          },
        ]}
        folders={binders}
        folderIcon={<BookOpen className="size-4" />}
        view={view}
        query={query}
        onNotify={(title) => setMessage({ title })}
      />
      <Toast message={message} onClose={hide} closeLabel={t("close")} />
    </>
  );
}

/** Choix du classeur sur téléphone, où la colonne est masquée. */
export function BinderSelect({
  binders,
  counts,
  view,
  query,
}: {
  binders: readonly FolderItem[];
  counts: BinderCounts;
  view: BinderViewKey;
  query: Query;
}) {
  const t = useTranslations("Binders");
  const router = useRouter();
  const id = useId();
  return (
    <div className="space-y-1 md:hidden">
      <label htmlFor={id} className="font-medium text-sm">
        {t("viewLabel")}
      </label>
      <select
        id={id}
        value={view}
        onChange={(event) => {
          const binder = event.target.value;
          router.replace(
            {
              pathname: "/collection",
              query: binder === "all" ? query : { ...query, binder },
            },
            { scroll: false },
          );
        }}
        className="block h-10 w-full rounded-md border border-input bg-background px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:text-sm"
      >
        <option value="all">
          {t("all")} ({counts.all})
        </option>
        {binders.map((binder) => (
          <option key={binder.id} value={binder.id}>
            {binder.name} ({binder.count})
          </option>
        ))}
        <option value="none">
          {t("unsorted")} ({counts.none})
        </option>
      </select>
    </div>
  );
}
