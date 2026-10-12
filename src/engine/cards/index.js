// All card behaviour, merged by id. Card steps are registered into the engine's step table
// as "card:<id>:<name>". Add a new file here when a category grows large.
import pilots from './pilots.js';
import elite from './elite.js';
import gear from './gear.js';
import weapons from './weapons.js';
import { STEPS } from '../flow.js';

export const CARDS = { ...pilots, ...elite, ...gear, ...weapons };

for (const [id, def] of Object.entries(CARDS)) {
  def.id = id;
  for (const [name, fn] of Object.entries(def.steps || {})) STEPS[`card:${id}:${name}`] = fn;
}
