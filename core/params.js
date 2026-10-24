// Collegamento tra config/params.json e le costanti del motore (BALL, MOVE, AI, RULES).
// Il motore ha i propri valori predefiniti (servono al browser, che non legge il file); applyParams()
// li sovrascrive da params.json negli strumenti Node, diffParams() segnala ogni scostamento.
import { BALL, MOVE, AI, RULES, MATCH } from './sim.js';

/** [percorso in params.json, oggetto del motore, chiave]. */
export const PARAM_MAP = [
  ['movimento.corsa_m_s', MOVE, 'run'], ['movimento.sprint_m_s', MOVE, 'sprint'], ['movimento.accelerazione_costante_tempo_s', MOVE, 'tau'],
  ['movimento.sterzata_rad_s_da_fermo', MOVE, 'turnRate0'], ['movimento.sterzata_rad_s_a_velocita_max', MOVE, 'turnRateMax'],
  ['movimento.virata_oltre_90_gradi_perdita_velocita', MOVE, 'turnLoss'],
  ['movimento.stamina.sprint_durata_s', MOVE, 'sprintSeconds'], ['movimento.stamina.recupero_s', MOVE, 'recoverSeconds'],
  ['movimento.stamina.riduzione_velocita_max_a_serbatoio_basso', MOVE, 'lowStaminaLoss'],
  ['movimento.controllo_palla.distanza_base_m', MOVE, 'ballGap'], ['movimento.controllo_palla.distanza_per_velocita_s', MOVE, 'ballGapPerSpeed'],
  ['movimento.contrasto.raggio_m', MOVE, 'tackleRadius'], ['movimento.contrasto.successo_base', MOVE, 'tackleBase'],
  ['movimento.urti.distanza_minima_m', MOVE, 'minGap'], ['movimento.urti.velocita_relativa_stordimento_m_s', MOVE, 'stunSpeed'],
  ['movimento.urti.stordimento_s', MOVE, 'stunSeconds'], ['movimento.velocita_con_palla_fattore', MOVE, 'carryFactor'],
  ['palla_modello.resistenza_aria_1_s', BALL, 'airDrag'], ['palla_modello.rotolamento_decel_m_s2', BALL, 'rollDecel'],
  ['palla_modello.rotolamento_quadratico_1_m', BALL, 'rollQuad'], ['palla_modello.rimbalzo', BALL, 'restitution'],
  ['ia.decisioni_hz', AI, 'hz'], ['ia.ritardo_reazione_s', AI, 'reaction'], ['ia.tasso_errore_passaggio', AI, 'passError'],
  ['ia.innesco_pressing_m', AI, 'pressTrigger'], ['ia.raggio_secondo_pressatore_m', AI, 'secondPress'],
  ['ia.distanza_minima_compagni_m', AI, 'mateGap'], ['ia.propensione_rischio', AI, 'risk'],
  ['ia.distanza_minima_scalata_m', AI, 'minScaled'], ['ia.riferimento_lunghezza_campo_m', AI, 'refLength'],
  ['portiere.raggio_parata_m', AI, 'keeperReach'], ['portiere.distanza_uscita_m', AI, 'keeperExit'],
  ['portiere.errore_bisettrice_m', AI, 'keeperError'], ['portiere.piazzamento_max_m', AI, 'keeperStand'],
  ['regole.fallo_probabilita', RULES, 'foulProb'], ['regole.fallo_cautela_in_area', RULES, 'areaCaution'], ['regole.fallo_giallo_su_fallo', RULES, 'yellowShare'],
  ['regole.fallo_rosso_su_fallo', RULES, 'redShare'], ['regole.distanza_barriera_m', RULES, 'wallDistance'],
  ['regole.distanza_calcio_inizio_m', RULES, 'kickoffDistance'], ['regole.fallo_azzurro_su_fallo', RULES, 'blueShare'], ['regole.azzurro_proteste_su_fallo', RULES, 'protestShare'],
  ['regole.azzurro_secondi', RULES, 'blueSeconds'], ['regole.portiere_trattenuta_secondi', RULES, 'gkHoldSeconds'], ['regole.ostruzione_tasso', RULES, 'obstructRate'], ['regole.gioco_pericoloso_m', RULES, 'dangerDist'], ['regole.fuorigioco_attivo', RULES, 'offside'], ['regole.area_piccola_profondita_m', RULES, 'smallAreaDepth'], ['regole.area_piccola_larghezza_m', RULES, 'smallAreaWidth'], ['regole.gioco_pericoloso_tasso', RULES, 'dangerRate'], ['regole.giocatori_minimi', RULES, 'minPlayers'],
  ...Object.keys({ shootRange: 0, shootEager: 0, shotAngle: 0, shotAnglePerM: 0, tackleEager: 0, markWeight: 0, containDist: 0, forceShot: 0, laneWidth: 0, shotMargin: 0, shotFarPost: 0, longBall: 0, keeperLong: 0, tackleFoul: 0, passSlip: 0, shieldSeconds: 0, longMin: 0, passSpeed0: 0, tackleDist: 0,
    sprintFree: 0, defenderLimit: 0, passBase: 0, passPressed: 0, passMin: 0, pressedDist: 0, pressedErrMul: 0, decisionNoise: 0, formSpread: 0, formSpeed: 0, formTackle: 0, attackDepth: 0, blockDepth: 0 }).map(k => [`ia_taratura.${k}`, AI, k]),
];

const DEFAULTS = PARAM_MAP.map(([, obj, key]) => obj[key]); // valori del motore all'importazione, prima di applyParams
const get = (params, path) => path.split('.').reduce((o, k) => o?.[k], params);

/** Sovrascrive le costanti del motore con i valori di params.json; un valore mancante o non numerico e' un errore. */
export function applyParams(params) {
  for (const [path, obj, key] of PARAM_MAP) {
    const v = get(params, path);
    if (!Number.isFinite(v)) throw new Error(`params.json: manca o non e' numerico "${path}"`);
    obj[key] = v;
  }
}

/** Voci in cui params.json differisce dai predefiniti del motore: { path, json, motore }. */
export function diffParams(params) {
  return PARAM_MAP.map(([path], i) => ({ path, json: get(params, path), motore: DEFAULTS[i] })).filter(r => r.json !== r.motore);
}
