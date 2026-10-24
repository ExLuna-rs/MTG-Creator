"use client";

import {
  EllipsisVertical,
  Folder,
  Inbox,
  LayoutGrid,
  Star,
} from "lucide-react";
import { useTranslations } from "next-intl";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import {
  type FolderItem,
  FolderNav,
  sendJson,
} from "@/components/organizer/folder-nav";
import { Menu } from "@/components/ui/menu";
import { Toast, type ToastMessage } from "@/components/ui/toast";
import { MAX_FOLDER_NAME_LENGTH } from "@/domain/deck/deck-list";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { deleteDeckAction } from "@/server/decks/actions";

export type { FolderItem } from "@/components/organizer/folder-nav";

/** Type des données glissées : l'identifiant d'un deck. */
const DECK_DRAG_TYPE = "application/x-mtg-creator-deck";

/** Vue de « Mes decks » : tous, favoris, sans dossier, ou l'id d'un dossier. */
export type FolderViewKey = "all" | "favorites" | "none" | (string & {});

/** Range un deck (dossier, favori). */
function placeDeck(
  deckId: string,
  placement: { folderId?: string | null; favorite?: boolean },
) {
  return sendJson(`/api/decks/${deckId}`, "PATCH", placement);
}

/** Affiche une notification de la page, une à la fois. */
const ShowToast = createContext<(message: ToastMessage) => void>(() => {});

/** Une seule notification pour toute la page « Mes decks ». */
export function DeckOrganizer({ children }: { children: ReactNode }) {
  const t = useTranslations("DecksPage");
  const [message, setMessage] = useState<ToastMessage | null>(null);
  const hide = useCallback(() => setMessage(null), []);
  return (
    <ShowToast value={setMessage}>
      {children}
      <Toast message={message} onClose={hide} closeLabel={t("closeMessage")} />
    </ShowToast>
  );
}

/**
 * Colonne des dossiers de « Mes decks » (ordinateur) : vues, dossiers avec
 * leur menu, création d'un dossier. On y dépose un deck pour le ranger.
 */
export function DeckFolders({
  folders,
  counts,
  view,
  query,
}: {
  folders: readonly FolderItem[];
  counts: { all: number; favorites: number; none: number };
  view: FolderViewKey;
  /** Autres paramètres de la page, gardés d'une vue à l'autre. */
  query: Record<string, string>;
}) {
  const t = useTranslations("DecksPage");
  const router = useRouter();
  const showToast = useContext(ShowToast);

  async function drop(folder: string, deckId: string) {
    const placement =
      folder === "favorites"
        ? { favorite: true }
        : { folderId: folder === "none" ? null : folder };
    const result = await placeDeck(deckId, placement);
    if (!result.ok) return showToast({ title: t("errors.network") });
    router.refresh();
  }

  return (
    <FolderNav
      pathname="/decks"
      param="folder"
      apiBase="/api/deck-folders"
      maxNameLength={MAX_FOLDER_NAME_LENGTH}
      labels={{
        nav: t("views"),
        section: t("folders"),
        create: t("newFolder"),
        menu: (name) => t("folderMenu", { name }),
        rename: t("renameFolder"),
        remove: t("deleteFolder"),
        createTitle: t("createFolderTitle"),
        renameTitle: (name) => t("renameFolderTitle", { name }),
        name: t("folderName"),
        nameHint: t("folderNameHint", { max: MAX_FOLDER_NAME_LENGTH }),
        createSubmit: t("createFolder"),
        renameSubmit: t("saveFolder"),
        cancel: t("cancel"),
        close: t("close"),
        removeTitle: (name) => t("deleteFolderTitle", { name }),
        removeText: (count) => t("deleteFolderText", { count }),
        removeConfirm: t("deleteFolderConfirm"),
        removed: (name) => t("folderDeleted", { name }),
        errors: {
          duplicate: t("errors.duplicate"),
          tooMany: t("errors.tooMany"),
          network: t("errors.network"),
        },
      }}
      leading={[
        {
          key: "all",
          label: t("allDecks"),
          icon: <LayoutGrid className="size-4" />,
          count: counts.all,
        },
        {
          key: "favorites",
          label: t("favorites"),
          icon: <Star className="size-4" />,
          count: counts.favorites,
        },
      ]}
      trailing={[
        {
          key: "none",
          label: t("noFolder"),
          icon: <Inbox className="size-4" />,
          count: counts.none,
        },
      ]}
      folders={folders}
      folderIcon={<Folder className="size-4" />}
      view={view}
      query={query}
      dragType={DECK_DRAG_TYPE}
      onDrop={drop}
      onNotify={(title) => showToast({ title })}
    />
  );
}

/**
 * Carte d'un deck dans « Mes decks » : on la glisse sur un dossier ; l'étoile
 * et le menu « ⋯ » la rangent sans ouvrir le deck.
 */
export function DeckTile({
  deck,
  folders,
  children,
}: {
  deck: {
    id: string;
    name: string;
    favorite: boolean;
    folderId: string | null;
  };
  folders: readonly FolderItem[];
  /** Lien vers l'éditeur, avec le contenu de la carte. */
  children: ReactNode;
}) {
  const t = useTranslations("DecksPage");
  const router = useRouter();
  const showToast = useContext(ShowToast);
  const deleteForm = useRef<HTMLFormElement>(null);
  const [dragging, setDragging] = useState(false);
  const [favorite, setFavorite] = useState(deck.favorite);
  // La page rechargée fait foi : l'étoile suit la valeur enregistrée.
  const [savedFavorite, setSavedFavorite] = useState(deck.favorite);
  if (deck.favorite !== savedFavorite) {
    setSavedFavorite(deck.favorite);
    setFavorite(deck.favorite);
  }

  async function move(folderId: string | null) {
    const result = await placeDeck(deck.id, { folderId });
    if (!result.ok) return showToast({ title: t("errors.network") });
    const folder = folders.find((item) => item.id === folderId);
    showToast({
      title: folder
        ? t("moved", { name: deck.name, folder: folder.name })
        : t("movedOut", { name: deck.name }),
    });
    router.refresh();
  }

  return (
    <li
      className={cn("relative min-w-0", dragging && "opacity-50")}
      data-deck={deck.name}
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData(DECK_DRAG_TYPE, deck.id);
        event.dataTransfer.effectAllowed = "move";
        setDragging(true);
      }}
      onDragEnd={() => setDragging(false)}
    >
      {children}
      <div className="absolute top-2 right-2 flex">
        <button
          type="button"
          aria-pressed={favorite}
          aria-label={
            favorite
              ? t("unfavorite", { name: deck.name })
              : t("favorite", { name: deck.name })
          }
          title={
            favorite
              ? t("unfavorite", { name: deck.name })
              : t("favorite", { name: deck.name })
          }
          onClick={async () => {
            const next = !favorite;
            setFavorite(next);
            const result = await placeDeck(deck.id, { favorite: next });
            if (!result.ok) {
              setFavorite(!next);
              showToast({ title: t("errors.network") });
              return;
            }
            router.refresh();
          }}
          className="grid size-8 place-items-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-pressed:text-amber-500"
        >
          <Star
            className={cn("size-4", favorite && "fill-current")}
            aria-hidden
          />
        </button>
        <Menu
          label={t("deckMenu", { name: deck.name })}
          heading={folders.length > 0 ? t("moveTo") : undefined}
          trigger={<EllipsisVertical className="size-4" aria-hidden />}
          triggerClassName="grid size-8 place-items-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
          items={[
            ...folders.map((folder) => ({
              key: folder.id,
              label: folder.name,
              checked: deck.folderId === folder.id,
              onSelect: () => move(folder.id),
            })),
            {
              key: "none",
              label: t("noFolder"),
              checked: deck.folderId === null,
              onSelect: () => move(null),
            },
            {
              key: "delete",
              label: t("deleteDeck"),
              destructive: true,
              separated: true,
              onSelect: () => {
                if (window.confirm(t("deleteDeckConfirm"))) {
                  deleteForm.current?.requestSubmit();
                }
              },
            },
          ]}
        />
      </div>
      <form ref={deleteForm} action={deleteDeckAction} hidden>
        <input type="hidden" name="deckId" value={deck.id} />
      </form>
    </li>
  );
}
