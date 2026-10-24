"use client";

import { EllipsisVertical, FolderPlus, LoaderCircle, X } from "lucide-react";
import {
  type DragEvent,
  type FormEvent,
  type ReactNode,
  type RefObject,
  useId,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import { Menu } from "@/components/ui/menu";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

// Colonne de rangement commune aux dossiers de « Mes decks » et aux classeurs
// de la collection : vues fixes, dossiers avec leur menu (renommer,
// supprimer), création d'un dossier, et dépôt d'un élément glissé.

export interface FolderItem {
  id: string;
  name: string;
  count: number;
}

type Query = Record<string, string | string[]>;

type FolderError = "duplicate" | "tooMany" | "network";

export interface FolderNavLabels {
  nav: string;
  section: string;
  create: string;
  menu: (name: string) => string;
  rename: string;
  remove: string;
  createTitle: string;
  renameTitle: (name: string) => string;
  name: string;
  nameHint: string;
  createSubmit: string;
  renameSubmit: string;
  cancel: string;
  close: string;
  removeTitle: (name: string) => string;
  removeText: (count: number) => string;
  removeConfirm: string;
  removed: (name: string) => string;
  errors: Record<FolderError, string>;
}

/** Vue fixe de la colonne (« Tous les decks », « Sans dossier »…). */
export interface FixedView {
  key: string;
  label: string;
  icon: ReactNode;
  count: number;
}

export async function sendJson(url: string, method: string, body?: unknown) {
  try {
    const response = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    return { ok: response.ok, error: data.error };
  } catch {
    return { ok: false, error: "network" };
  }
}

const dialogClassName =
  "m-auto w-[min(28rem,calc(100vw-2rem))] rounded-lg border bg-background p-0 text-foreground shadow-lg backdrop:bg-black/50";

/** Fenêtre de saisie du nom d'un dossier (création ou renommage). */
function NameDialog({
  dialog,
  title,
  submitLabel,
  initialName,
  maxLength,
  labels,
  onSubmit,
}: {
  dialog: RefObject<HTMLDialogElement | null>;
  title: string;
  submitLabel: string;
  initialName: string;
  maxLength: number;
  labels: FolderNavLabels;
  /** Renvoie le code d'erreur, ou null si c'est enregistré. */
  onSubmit: (name: string) => Promise<string | null>;
}) {
  const id = useId();
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<FolderError | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const failure = await onSubmit(name.trim());
    setPending(false);
    if (failure) {
      setError(
        failure === "duplicate" || failure === "tooMany" ? failure : "network",
      );
      return;
    }
    dialog.current?.close();
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby={`${id}-title`}
      onClose={() => {
        setName(initialName);
        setError(null);
      }}
      className={dialogClassName}
    >
      <form onSubmit={submit} className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-4">
          <h2 id={`${id}-title`} className="font-semibold text-lg">
            {title}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => dialog.current?.close()}
            aria-label={labels.close}
            className="-mt-1 -mr-2"
          >
            <X aria-hidden />
          </Button>
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`${id}-name`} className="font-medium text-sm">
            {labels.name}
          </label>
          <input
            id={`${id}-name`}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setError(null);
            }}
            required
            maxLength={maxLength}
            aria-describedby={`${id}-hint`}
            aria-invalid={error !== null}
            className="h-10 w-full rounded-md border border-input bg-transparent px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive sm:text-sm"
          />
          <p id={`${id}-hint`} className="text-muted-foreground text-xs">
            {labels.nameHint}
          </p>
        </div>
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {labels.errors[error]}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => dialog.current?.close()}>
            {labels.cancel}
          </Button>
          <Button type="submit" disabled={pending || !name.trim()}>
            {pending && <LoaderCircle className="animate-spin" aria-hidden />}
            {submitLabel}
          </Button>
        </div>
      </form>
    </dialog>
  );
}

/** Fenêtre de confirmation de la suppression d'un dossier. */
function RemoveDialog({
  dialog,
  folder,
  labels,
  onConfirm,
}: {
  dialog: RefObject<HTMLDialogElement | null>;
  folder: FolderItem;
  labels: FolderNavLabels;
  onConfirm: () => Promise<boolean>;
}) {
  const id = useId();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <dialog
      ref={dialog}
      aria-labelledby={`${id}-title`}
      onClose={() => setFailed(false)}
      className={dialogClassName}
    >
      <div className="space-y-4 p-5">
        <h2 id={`${id}-title`} className="font-semibold text-lg">
          {labels.removeTitle(folder.name)}
        </h2>
        <p className="text-sm">{labels.removeText(folder.count)}</p>
        {failed && (
          <p role="alert" className="text-destructive text-sm">
            {labels.errors.network}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => dialog.current?.close()}>
            {labels.cancel}
          </Button>
          <Button
            variant="outline"
            disabled={pending}
            className="border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={async () => {
              setPending(true);
              const ok = await onConfirm();
              setPending(false);
              if (ok) dialog.current?.close();
              else setFailed(true);
            }}
          >
            {pending && <LoaderCircle className="animate-spin" aria-hidden />}
            {labels.removeConfirm}
          </Button>
        </div>
      </div>
    </dialog>
  );
}

/** Une ligne de la colonne, cible du glisser-déposer quand `onDrop` est donné. */
function Row({
  href,
  current,
  icon,
  label,
  count,
  dragType,
  onDrop,
  actions,
}: {
  href: { pathname: "/decks" | "/collection"; query: Query };
  current: boolean;
  icon: ReactNode;
  label: string;
  count: number;
  dragType?: string;
  onDrop?: (id: string) => void;
  actions?: ReactNode;
}) {
  const [over, setOver] = useState(false);
  const accepts = (event: DragEvent) =>
    dragType !== undefined &&
    onDrop !== undefined &&
    event.dataTransfer.types.includes(dragType);
  return (
    <li
      className={cn(
        "flex items-center rounded-md",
        current && "bg-primary/10",
        over && "outline-2 outline-primary outline-dashed -outline-offset-2",
      )}
      onDragOver={(event) => {
        if (!accepts(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        setOver(false);
        if (!accepts(event) || !dragType) return;
        event.preventDefault();
        onDrop?.(event.dataTransfer.getData(dragType));
      }}
    >
      <Link
        href={href}
        aria-current={current ? "page" : undefined}
        className={cn(
          "flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50",
          current && "font-semibold",
        )}
      >
        <span className="shrink-0 text-muted-foreground" aria-hidden>
          {icon}
        </span>
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <span className="text-muted-foreground text-xs tabular-nums">
          {count}
        </span>
      </Link>
      {actions}
    </li>
  );
}

/**
 * Colonne de rangement : vues fixes en tête, dossiers, vues fixes en fin de
 * liste (« Sans dossier »), puis « Nouveau dossier ». Les vues et les
 * dossiers sont des liens qui gardent les autres paramètres de la page.
 */
export function FolderNav({
  pathname,
  param,
  apiBase,
  maxNameLength,
  labels,
  leading,
  trailing,
  folders,
  folderIcon,
  view,
  query,
  dragType,
  onDrop,
  onNotify,
}: {
  pathname: "/decks" | "/collection";
  /** Paramètre d'URL de la vue (« folder », « binder »). */
  param: string;
  /** Route des dossiers (POST), et de chacun (`/{id}` : PATCH, DELETE). */
  apiBase: string;
  maxNameLength: number;
  labels: FolderNavLabels;
  /** Vues avant les dossiers ; la première n'ajoute pas de paramètre. */
  leading: readonly FixedView[];
  trailing: readonly FixedView[];
  folders: readonly FolderItem[];
  folderIcon: ReactNode;
  view: string;
  query: Query;
  /** Type des données glissées acceptées, et ce qu'en fait chaque vue. */
  dragType?: string;
  onDrop?: (view: string, id: string) => void;
  onNotify: (message: string) => void;
}) {
  const router = useRouter();
  const createDialog = useRef<HTMLDialogElement>(null);
  const renameDialog = useRef<HTMLDialogElement>(null);
  const removeDialog = useRef<HTMLDialogElement>(null);
  const [target, setTarget] = useState<FolderItem | null>(null);
  const defaultView = leading[0]?.key;

  const href = (key: string) => ({
    pathname,
    query: key === defaultView ? query : { ...query, [param]: key },
  });

  function open(dialog: RefObject<HTMLDialogElement | null>) {
    // Laisse React afficher la fenêtre du dossier choisi avant de l'ouvrir.
    requestAnimationFrame(() => dialog.current?.showModal());
  }

  const fixedRow = (item: FixedView, droppable: boolean) => (
    <Row
      key={item.key}
      href={href(item.key)}
      current={view === item.key}
      icon={item.icon}
      label={item.label}
      count={item.count}
      dragType={droppable ? dragType : undefined}
      onDrop={droppable ? (id) => onDrop?.(item.key, id) : undefined}
    />
  );

  return (
    <nav aria-label={labels.nav} className="space-y-4">
      <ul className="space-y-0.5">
        {leading.map((item, index) => fixedRow(item, index > 0))}
      </ul>
      <div className="space-y-1">
        <h2 className="px-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
          {labels.section}
        </h2>
        <ul className="space-y-0.5">
          {folders.map((folder) => (
            <Row
              key={folder.id}
              href={href(folder.id)}
              current={view === folder.id}
              icon={folderIcon}
              label={folder.name}
              count={folder.count}
              dragType={dragType}
              onDrop={(id) => onDrop?.(folder.id, id)}
              actions={
                <Menu
                  label={labels.menu(folder.name)}
                  trigger={<EllipsisVertical className="size-4" aria-hidden />}
                  triggerClassName="grid size-7 place-items-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  items={[
                    {
                      key: "rename",
                      label: labels.rename,
                      onSelect: () => {
                        setTarget(folder);
                        open(renameDialog);
                      },
                    },
                    {
                      key: "remove",
                      label: labels.remove,
                      destructive: true,
                      onSelect: () => {
                        setTarget(folder);
                        open(removeDialog);
                      },
                    },
                  ]}
                />
              }
            />
          ))}
          {trailing.map((item) => fixedRow(item, true))}
        </ul>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-primary"
          onClick={() => createDialog.current?.showModal()}
        >
          <FolderPlus aria-hidden />
          {labels.create}
        </Button>
      </div>

      <NameDialog
        dialog={createDialog}
        title={labels.createTitle}
        submitLabel={labels.createSubmit}
        initialName=""
        maxLength={maxNameLength}
        labels={labels}
        onSubmit={async (name) => {
          const result = await sendJson(apiBase, "POST", { name });
          if (!result.ok) return result.error ?? "network";
          router.refresh();
          return null;
        }}
      />
      {target && (
        <NameDialog
          key={`rename-${target.id}`}
          dialog={renameDialog}
          title={labels.renameTitle(target.name)}
          submitLabel={labels.renameSubmit}
          initialName={target.name}
          maxLength={maxNameLength}
          labels={labels}
          onSubmit={async (name) => {
            const result = await sendJson(`${apiBase}/${target.id}`, "PATCH", {
              name,
            });
            if (!result.ok) return result.error ?? "network";
            router.refresh();
            return null;
          }}
        />
      )}
      {target && (
        <RemoveDialog
          key={`remove-${target.id}`}
          dialog={removeDialog}
          folder={target}
          labels={labels}
          onConfirm={async () => {
            const result = await sendJson(`${apiBase}/${target.id}`, "DELETE");
            if (!result.ok) return false;
            onNotify(labels.removed(target.name));
            if (view === target.id) router.replace(href(defaultView ?? ""));
            else router.refresh();
            return true;
          }}
        />
      )}
    </nav>
  );
}
