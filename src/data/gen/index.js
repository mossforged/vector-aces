// Merges the generated per-batch data files (see tools/xwing-import). Hand-written; tiny on purpose.
import * as base from './base.js';
import * as dominion from './dominion.js';
import * as league from './league.js';
import * as syndicate from './syndicate.js';
import * as large from './large.js';
import { DAMAGE_ORIGINALS, SLOT_ORIGINALS } from './originals-static.js';

const batches = [base, dominion, league, syndicate, large];
const merge = key => Object.assign({}, ...batches.map(b => b[key]));

export const GEN_SHIPS = merge('SHIPS');
export const GEN_PILOTS = merge('PILOTS');
export const GEN_UPGRADES = merge('UPGRADES');
export const GEN_CONDITIONS = merge('CONDITIONS');
export const ORIGINAL_NAMES = {
  ships: Object.assign({}, ...batches.map(b => b.ORIGINALS.ships)),
  pilots: Object.assign({}, ...batches.map(b => b.ORIGINALS.pilots)),
  upgrades: Object.assign({}, ...batches.map(b => b.ORIGINALS.upgrades)),
  conditions: Object.assign({}, ...batches.map(b => b.ORIGINALS.conditions)),
  images: Object.assign({}, ...batches.map(b => b.ORIGINALS.images || {})),
  damage: DAMAGE_ORIGINALS,
  slots: SLOT_ORIGINALS,
};
