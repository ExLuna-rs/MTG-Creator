/**
 * Ajout automatique pendant le scan en continu. Une image est lue environ
 * chaque seconde : une carte est ajoutée quand elle est reconnue sur deux
 * lectures de suite (une lecture isolée peut être fausse), puis n'est plus
 * ajoutée tant qu'elle reste devant la caméra. Pour ajouter un deuxième
 * exemplaire de la même carte, il suffit de la retirer du cadre : une lecture
 * sans carte reconnue réarme l'ajout.
 */
export interface AutoAddState {
  /** Carte reconnue à la lecture précédente. */
  pending: string | null;
  /** Dernière carte ajoutée, tant qu'elle n'a pas quitté le cadre. */
  added: string | null;
}

export const INITIAL_AUTO_ADD: AutoAddState = { pending: null, added: null };

/**
 * Nouvel état après une lecture (`oracleId` : carte reconnue avec assurance,
 * ou null), et carte à ajouter le cas échéant.
 */
export function nextAutoAdd(
  state: AutoAddState,
  oracleId: string | null,
): { state: AutoAddState; add: string | null } {
  if (!oracleId) return { state: INITIAL_AUTO_ADD, add: null };
  if (oracleId === state.added) {
    return { state: { pending: oracleId, added: oracleId }, add: null };
  }
  if (oracleId === state.pending) {
    return { state: { pending: oracleId, added: oracleId }, add: oracleId };
  }
  return { state: { pending: oracleId, added: state.added }, add: null };
}
