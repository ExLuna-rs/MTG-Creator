import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, asc, desc, eq, gt, lt, or, sql } from "drizzle-orm";
import type { CardImageUris } from "@/domain/cards/card";
import { normalizeCardName } from "@/domain/cards/normalize";
import {
  MAX_COLLECTION_QUANTITY,
  type ScanListChange,
} from "@/domain/collection/schema";
import { cleanScannedName, type ScanCandidate } from "@/domain/scan/ocr-name";
import { getDb } from "@/server/db";
import {
  cards,
  collectionCards,
  scannedCards,
  scanSessions,
  users,
} from "@/server/db/schema";
import type { DbExecutor } from "./collection";

// Scan de cartes vers la collection, depuis le téléphone de l'utilisateur
// connecté ou depuis un téléphone relié par QR code.

/** Durée de vie d'un lien de scan sans activité du téléphone. */
export const SCAN_SESSION_IDLE_MS = 60 * 60 * 1000;
/** Durée de vie maximale d'un lien de scan, même utilisé. */
export const SCAN_SESSION_MAX_MS = 12 * 60 * 60 * 1000;
/** Le téléphone est dit connecté s'il a fait une requête depuis ce délai. */
export const SCAN_SESSION_ONLINE_MS = 90 * 1000;
/** Lignes affichées de la liste de scan (les plus récentes). */
const MAX_SCAN_LIST = 500;
/** Liens de scan gardés par utilisateur (les plus récents). */
const MAX_SCAN_SESSIONS = 5;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Crée un lien de scan pour relier un téléphone à la collection. Le jeton
 * n'est renvoyé qu'ici : la base n'en garde que l'empreinte.
 */
export async function createScanSession(
  userId: string,
  now = new Date(),
): Promise<{ id: string; token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const db = getDb();
  const [session] = await db
    .insert(scanSessions)
    .values({
      userId,
      tokenHash: hashToken(token),
      expiresAt: new Date(now.getTime() + SCAN_SESSION_IDLE_MS),
      createdAt: now,
    })
    .returning({ id: scanSessions.id, expiresAt: scanSessions.expiresAt });

  // Ménage : liens expirés, et au-delà des plus récents.
  const kept = db
    .select({ id: scanSessions.id })
    .from(scanSessions)
    .where(eq(scanSessions.userId, userId))
    .orderBy(desc(scanSessions.createdAt))
    .limit(MAX_SCAN_SESSIONS);
  await db
    .delete(scanSessions)
    .where(
      and(
        eq(scanSessions.userId, userId),
        or(
          lt(scanSessions.expiresAt, now),
          sql`${scanSessions.id} not in (${kept})`,
        ),
      ),
    );
  return { ...session, token };
}

/** Utilisateur qui scanne : connecté, ou relié par un lien de scan. */
export interface ScanActor {
  userId: string;
  userName: string;
  scanSessionId: string | null;
}

/**
 * Lien de scan correspondant au jeton, s'il n'a pas expiré. Chaque
 * utilisation repousse son expiration (dans la limite de sa durée maximale)
 * et indique à l'ordinateur que le téléphone est connecté.
 */
export async function findScanSession(
  token: string,
  now = new Date(),
): Promise<ScanActor | null> {
  const db = getDb();
  const [session] = await db
    .select({
      id: scanSessions.id,
      userId: scanSessions.userId,
      userName: users.name,
      createdAt: scanSessions.createdAt,
    })
    .from(scanSessions)
    .innerJoin(users, eq(users.id, scanSessions.userId))
    .where(
      and(
        eq(scanSessions.tokenHash, hashToken(token)),
        gt(scanSessions.expiresAt, now),
      ),
    )
    .limit(1);
  if (!session) return null;

  const expiresAt = Math.min(
    now.getTime() + SCAN_SESSION_IDLE_MS,
    session.createdAt.getTime() + SCAN_SESSION_MAX_MS,
  );
  await db
    .update(scanSessions)
    .set({ lastSeenAt: now, expiresAt: new Date(expiresAt) })
    .where(eq(scanSessions.id, session.id));
  return {
    userId: session.userId,
    userName: session.userName,
    scanSessionId: session.id,
  };
}

export interface ScanSessionStatus {
  /** Le téléphone a fait une requête récemment. */
  connected: boolean;
  expired: boolean;
}

/** État d'un lien de scan de l'utilisateur, ou null s'il n'existe pas. */
export async function getScanSessionStatus(
  userId: string,
  scanSessionId: string,
  now = new Date(),
): Promise<ScanSessionStatus | null> {
  const [session] = await getDb()
    .select({
      expiresAt: scanSessions.expiresAt,
      lastSeenAt: scanSessions.lastSeenAt,
    })
    .from(scanSessions)
    .where(
      and(eq(scanSessions.id, scanSessionId), eq(scanSessions.userId, userId)),
    )
    .limit(1);
  if (!session) return null;
  return {
    connected:
      session.lastSeenAt !== null &&
      now.getTime() - session.lastSeenAt.getTime() < SCAN_SESSION_ONLINE_MS,
    expired: session.expiresAt <= now,
  };
}

/** Supprime un lien de scan de l'utilisateur : le téléphone est déconnecté. */
export async function deleteScanSession(
  userId: string,
  scanSessionId: string,
): Promise<boolean> {
  const deleted = await getDb()
    .delete(scanSessions)
    .where(
      and(eq(scanSessions.id, scanSessionId), eq(scanSessions.userId, userId)),
    )
    .returning({ id: scanSessions.id });
  return deleted.length > 0;
}

// -----------------------------------------------------------------------------
// Liste de scan : cartes en attente, ajoutées ensemble à la collection
// -----------------------------------------------------------------------------

/** Une ligne de la liste de scan. */
export interface ScanListItem {
  id: number;
  oracleId: string;
  name: string;
  imageUris: CardImageUris | null;
  quantity: number;
}

const listColumns = {
  id: scannedCards.id,
  oracleId: scannedCards.oracleId,
  name: cards.name,
  imageUris: cards.imageUris,
  quantity: scannedCards.quantity,
};

/** Liste de scan de l'utilisateur, de la carte la plus récente à la plus ancienne. */
export async function getScanList(userId: string): Promise<ScanListItem[]> {
  return getDb()
    .select(listColumns)
    .from(scannedCards)
    .innerJoin(cards, eq(cards.oracleId, scannedCards.oracleId))
    .where(eq(scannedCards.userId, userId))
    .orderBy(desc(scannedCards.createdAt), desc(scannedCards.id))
    .limit(MAX_SCAN_LIST);
}

async function cardExists(db: DbExecutor, oracleId: string) {
  const [card] = await db
    .select({ oracleId: cards.oracleId })
    .from(cards)
    .where(eq(cards.oracleId, oracleId))
    .limit(1);
  return Boolean(card);
}

/**
 * Ajoute un exemplaire d'une carte à la liste de scan (la carte remonte en
 * tête de liste). Renvoie la ligne, ou null si la carte est inconnue.
 */
export async function addToScanList(
  userId: string,
  oracleId: string,
  db: DbExecutor = getDb(),
): Promise<ScanListItem | null> {
  if (!(await cardExists(db, oracleId))) return null;
  const [row] = await db
    .insert(scannedCards)
    .values({ userId, oracleId, quantity: 1 })
    .onConflictDoUpdate({
      target: [scannedCards.userId, scannedCards.oracleId],
      set: {
        quantity: sql`least(${scannedCards.quantity} + 1, ${MAX_COLLECTION_QUANTITY})`,
        createdAt: new Date(),
      },
    })
    .returning({ id: scannedCards.id });
  return getScanListItem(db, userId, row.id);
}

async function getScanListItem(
  db: DbExecutor,
  userId: string,
  id: number,
): Promise<ScanListItem | null> {
  const [item] = await db
    .select(listColumns)
    .from(scannedCards)
    .innerJoin(cards, eq(cards.oracleId, scannedCards.oracleId))
    .where(and(eq(scannedCards.id, id), eq(scannedCards.userId, userId)))
    .limit(1);
  return item ?? null;
}

export type UpdateScanListResult =
  | { ok: true; item: ScanListItem | null }
  | { ok: false; error: "notFound" | "unknownCard" };

/**
 * Corrige une ligne de la liste de scan : autre carte (carte mal reconnue)
 * et / ou autre quantité. Une quantité nulle retire la ligne ; une carte
 * déjà présente dans la liste reçoit les exemplaires de la ligne corrigée.
 */
export async function updateScanListItem(
  userId: string,
  id: number,
  change: ScanListChange,
): Promise<UpdateScanListResult> {
  return getDb().transaction(async (tx) => {
    const [row] = await tx
      .select({
        oracleId: scannedCards.oracleId,
        quantity: scannedCards.quantity,
      })
      .from(scannedCards)
      .where(and(eq(scannedCards.id, id), eq(scannedCards.userId, userId)))
      .for("update");
    if (!row) return { ok: false, error: "notFound" } as const;

    const quantity = change.quantity ?? row.quantity;
    const oracleId = change.oracleId ?? row.oracleId;
    if (quantity === 0) {
      await tx.delete(scannedCards).where(eq(scannedCards.id, id));
      return { ok: true, item: null } as const;
    }
    if (oracleId === row.oracleId) {
      await tx
        .update(scannedCards)
        .set({ quantity })
        .where(eq(scannedCards.id, id));
      return { ok: true, item: await getScanListItem(tx, userId, id) } as const;
    }

    if (!(await cardExists(tx, oracleId))) {
      return { ok: false, error: "unknownCard" } as const;
    }
    await tx.delete(scannedCards).where(eq(scannedCards.id, id));
    const [merged] = await tx
      .insert(scannedCards)
      .values({ userId, oracleId, quantity })
      .onConflictDoUpdate({
        target: [scannedCards.userId, scannedCards.oracleId],
        set: {
          quantity: sql`least(${scannedCards.quantity} + ${quantity}, ${MAX_COLLECTION_QUANTITY})`,
        },
      })
      .returning({ id: scannedCards.id });
    return {
      ok: true,
      item: await getScanListItem(tx, userId, merged.id),
    } as const;
  });
}

/**
 * Ajoute toute la liste de scan à la collection, puis la vide. Renvoie le
 * nombre d'exemplaires ajoutés.
 */
export async function commitScanList(userId: string): Promise<number> {
  return getDb().transaction(async (tx) => {
    const rows = await tx
      .delete(scannedCards)
      .where(eq(scannedCards.userId, userId))
      .returning({
        oracleId: scannedCards.oracleId,
        quantity: scannedCards.quantity,
      });
    if (rows.length === 0) return 0;
    await tx
      .insert(collectionCards)
      .values(rows.map((row) => ({ ...row, userId })))
      .onConflictDoUpdate({
        target: [collectionCards.userId, collectionCards.oracleId],
        set: {
          quantity: sql`least(${collectionCards.quantity} + excluded.quantity, ${MAX_COLLECTION_QUANTITY})`,
          updatedAt: new Date(),
        },
      });
    return rows.reduce((sum, row) => sum + row.quantity, 0);
  });
}

/** Carte proposée pour un nom lu par la caméra. */
export interface ScanMatch extends ScanCandidate {
  typeLine: string;
  imageUris: CardImageUris | null;
}

const MAX_SCAN_MATCHES = 3;

/**
 * Cartes dont le nom ressemble le plus au texte lu sur la bande du nom.
 * Pour une carte à deux faces, seule la face avant est imprimée en haut :
 * on mesure la ressemblance avec la partie la plus proche du nom complet.
 */
export async function matchScannedName(text: string): Promise<ScanMatch[]> {
  const normalized = normalizeCardName(cleanScannedName(text));
  if (!normalized) return [];
  const doubleFaced = sql`${cards.name} like '% // %'`;
  const similarity = sql<number>`case when ${doubleFaced}
    then word_similarity(${normalized}, ${cards.searchName})
    else similarity(${normalized}, ${cards.searchName}) end`;
  return getDb()
    .select({
      oracleId: cards.oracleId,
      name: cards.name,
      typeLine: cards.typeLine,
      imageUris: cards.imageUris,
      similarity,
    })
    .from(cards)
    .where(
      or(
        sql`${normalized} % ${cards.searchName}`,
        and(doubleFaced, sql`${normalized} <% ${cards.searchName}`),
      ),
    )
    .orderBy(
      sql`${similarity} desc`,
      sql`${cards.edhrecRank} asc nulls last`,
      asc(cards.name),
    )
    .limit(MAX_SCAN_MATCHES);
}
