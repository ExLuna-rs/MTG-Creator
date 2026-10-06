import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, asc, desc, eq, gt, lt, or, sql } from "drizzle-orm";
import type { CardImageUris } from "@/domain/cards/card";
import { normalizeCardName } from "@/domain/cards/normalize";
import { cleanScannedName, type ScanCandidate } from "@/domain/scan/ocr-name";
import { getDb } from "@/server/db";
import { cards, scannedCards, scanSessions, users } from "@/server/db/schema";
import { changeCollectionCard } from "./collection";

// Scan de cartes vers la collection, depuis le téléphone de l'utilisateur
// connecté ou depuis un téléphone relié par QR code.

/** Durée de vie d'un lien de scan sans activité du téléphone. */
export const SCAN_SESSION_IDLE_MS = 60 * 60 * 1000;
/** Durée de vie maximale d'un lien de scan, même utilisé. */
export const SCAN_SESSION_MAX_MS = 12 * 60 * 60 * 1000;
/** Le téléphone est dit connecté s'il a fait une requête depuis ce délai. */
export const SCAN_SESSION_ONLINE_MS = 90 * 1000;
/** Cartes scannées renvoyées à l'ordinateur (les plus récentes). */
const MAX_LISTED_SCANS = 200;
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

/** Carte ajoutée par un scan, telle qu'affichée sur l'ordinateur et le téléphone. */
export interface ScannedCard {
  id: number;
  oracleId: string;
  name: string;
  imageUris: CardImageUris | null;
}

export interface ScanSessionStatus {
  /** Le téléphone a fait une requête récemment. */
  connected: boolean;
  expired: boolean;
  /**
   * Cartes scannées par ce téléphone, des plus anciennes aux plus récentes
   * (les ajouts annulés n'y sont plus).
   */
  cards: ScannedCard[];
}

/** État d'un lien de scan de l'utilisateur, ou null s'il n'existe pas. */
export async function getScanSessionStatus(
  userId: string,
  scanSessionId: string,
  now = new Date(),
): Promise<ScanSessionStatus | null> {
  const db = getDb();
  const [session] = await db
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

  const rows = await db
    .select({
      id: scannedCards.id,
      oracleId: scannedCards.oracleId,
      name: cards.name,
      imageUris: cards.imageUris,
    })
    .from(scannedCards)
    .innerJoin(cards, eq(cards.oracleId, scannedCards.oracleId))
    .where(
      and(
        eq(scannedCards.userId, userId),
        eq(scannedCards.scanSessionId, scanSessionId),
      ),
    )
    .orderBy(desc(scannedCards.id))
    .limit(MAX_LISTED_SCANS);
  return {
    connected:
      session.lastSeenAt !== null &&
      now.getTime() - session.lastSeenAt.getTime() < SCAN_SESSION_ONLINE_MS,
    expired: session.expiresAt <= now,
    cards: rows.reverse(),
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

export type AddScannedCardResult =
  | { ok: true; card: ScannedCard; quantity: number }
  | { ok: false; error: "unknownCard" };

/** Ajoute un exemplaire de la carte scannée à la collection. */
export async function addScannedCard(
  actor: ScanActor,
  oracleId: string,
): Promise<AddScannedCardResult> {
  return getDb().transaction(async (tx) => {
    const change = await changeCollectionCard(actor.userId, oracleId, 1, tx);
    if (!change.ok) return change;
    const [row] = await tx
      .insert(scannedCards)
      .values({
        userId: actor.userId,
        scanSessionId: actor.scanSessionId,
        oracleId,
      })
      .returning({ id: scannedCards.id });
    const [card] = await tx
      .select({ name: cards.name, imageUris: cards.imageUris })
      .from(cards)
      .where(eq(cards.oracleId, oracleId));
    return {
      ok: true,
      card: { id: row.id, oracleId, ...card },
      quantity: change.quantity,
    };
  });
}

/**
 * Annule l'ajout d'une carte scannée par l'utilisateur : l'exemplaire est
 * retiré de la collection. Renvoie la nouvelle quantité, ou null si ce scan
 * n'existe pas (ou appartient à quelqu'un d'autre).
 */
export async function undoScannedCard(
  actor: ScanActor,
  scannedCardId: number,
): Promise<number | null> {
  return getDb().transaction(async (tx) => {
    const [row] = await tx
      .delete(scannedCards)
      .where(
        and(
          eq(scannedCards.id, scannedCardId),
          eq(scannedCards.userId, actor.userId),
          // Un téléphone relié n'annule que ses propres scans.
          actor.scanSessionId
            ? eq(scannedCards.scanSessionId, actor.scanSessionId)
            : undefined,
        ),
      )
      .returning({ oracleId: scannedCards.oracleId });
    if (!row) return null;
    const change = await changeCollectionCard(
      actor.userId,
      row.oracleId,
      -1,
      tx,
    );
    return change.ok ? change.quantity : 0;
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
