/* =====================================================================
   TECHNIQUES MODULE
   The martial-arts framework layered on top of the cultivation system.
   Every technique has five defining properties: category, grade, qi
   cost, mastery progression, and acquisition requirements. Rarity
   (how hard it is to obtain) is tracked separately from grade (how
   powerful it is). Mastery (1-100) is trained through use and is
   independent of cultivation rank.
   ===================================================================== */

/* ---------------- lookups ---------------- */

const techCat = (id) => TECH_CATEGORIES[TECHNIQUES[id].category];
const techRarityObj = (id) => TECH_RARITIES[TECHNIQUES[id].rarity];
const techGradeObj = (id) => TECH_GRADES[TECHNIQUES[id].grade];

function techGradeLabel(id) {
  const t = TECHNIQUES[id];
  return `${TECH_GRADES[t.grade].name} · ${TECH_SUBGRADES[t.sub] || "Middle"}`;
}
const isUltimate = (id) => TECHNIQUES[id].type === "ultimate";
const isPassiveTech = (id) => !!TECHNIQUES[id].passive || TECHNIQUES[id].type === "passive";

/* subgrade adds a small step on top of the grade's base power */
const SUBGRADE_BONUS = { low: 0, middle: 0.03, high: 0.07, peak: 0.12 };
function gradeBonus(id) {
  const t = TECHNIQUES[id];
  return TECH_GRADES[t.grade].mult + (SUBGRADE_BONUS[t.sub] || 0);
}

/* ---------------- mastery ---------------- */

function masteryOf(id) {
  if (!isLearned(id)) return 0;
  const v = state.mastery[id];
  return v == null ? 1 : v;
}

function masteryBand(level) {
  let band = MASTERY_BANDS[0];
  for (const b of MASTERY_BANDS) if (level >= b.min) band = b;
  return band;
}
const masteryBandName = (level) => masteryBand(level).name;
const masteryMult = (id) => masteryBand(masteryOf(id)).mult;

/* progress within the current band, for UI bars (0-100) */
function masteryBandPct(id) {
  const lvl = masteryOf(id);
  if (lvl >= MASTERY_MAX) return 100;
  const band = masteryBand(lvl);
  const idx = MASTERY_BANDS.indexOf(band);
  const next = MASTERY_BANDS[idx + 1];
  const hi = next ? next.min : MASTERY_MAX + 1;
  return pct(lvl - band.min, hi - band.min);
}

function gainMastery(id, n = 1) {
  if (!isLearned(id) || n <= 0) return;
  const before = masteryOf(id);
  if (before >= MASTERY_MAX) return;
  const after = Math.min(MASTERY_MAX, before + n);
  state.mastery[id] = after;
  if (masteryBandName(after) !== masteryBandName(before)) {
    const band = masteryBand(after);
    addLog(`Your ${TECHNIQUES[id].name} reaches ${band.name}${band.feature ? ` — ${band.feature} unlocked` : ""}! (${after}/${MASTERY_MAX})`, "gold");
  }
}

/* ---------------- power ---------------- */

function techPowerMult(id) {
  return (1 + gradeBonus(id)) * masteryMult(id);
}

/* final damage for an offensive technique, used by combat */
function techDamage(id, s) {
  const t = TECHNIQUES[id];
  return Math.round((t.dmg + s.attack) * s.dmgMult * techPowerMult(id));
}

/* ---------------- passive technique contributions ---------------- */

function passiveTechBonus(stat) {
  let sum = 0;
  for (const id of state.techniques) {
    const t = TECHNIQUES[id];
    if (t && t[stat]) sum += t[stat] * masteryMult(id);
  }
  return sum;
}

/* ---------------- comprehension ---------------- */

const COMPREHENSION_BASE = { mortal: 1.0, yellow: 1.0, profound: 0.9, earth: 0.8, heaven: 0.7, saint: 0.6, emperor: 0.5, divine: 0.4 };

function comprehensionChance(id) {
  const t = TECHNIQUES[id];
  const base = COMPREHENSION_BASE[t.grade] ?? 0.8;
  const fromControl = Math.min(0.3, stats().qiControl / 300);
  return clamp(base + fromControl, 0.2, 0.98);
}

const attemptComprehension = (id) => Math.random() < comprehensionChance(id);

/* ---------------- qi deviation ---------------- */

function triggerQiDeviation(seconds, reason) {
  state.qiDeviation = Math.max(state.qiDeviation || 0, seconds);
  addLog(`Qi deviation! Your cultivation is disrupted for a time — ${reason}`, "bad");
}

/* slow qi recovery while deviating (applied in the passive loop) */
const qiDeviationMult = () => ((state.qiDeviation || 0) > 0 ? 0.5 : 1);

/* ---------------- compatibility / conflicts ---------------- */

function activeConflicts() {
  const out = [];
  for (const c of TECH_CONFLICTS) {
    if (isLearned(c.a) && isLearned(c.b)) out.push(c);
  }
  return out;
}

/* each active conflict saps qi recovery and martial force */
function conflictPenalty() {
  const n = activeConflicts().length;
  return { qiMult: 1 - 0.15 * n, dmgMult: 1 - 0.05 * n, count: n };
}

/* ---------------- defensive / counter ---------------- */

/* passive guard from formation/defensive arts scales with mastery */
function passiveGuard() {
  let g = 0;
  for (const id of state.techniques) {
    const t = TECHNIQUES[id];
    if (t && t.guard) g += t.guard * masteryMult(id);
  }
  return g;
}

/* best learned technique that can be actively used to guard */
function bestGuardTech() {
  let best = null;
  for (const id of state.techniques) {
    const t = TECHNIQUES[id];
    if (t && t.type === "active" && t.guard) {
      if (!best || t.guard * masteryMult(id) > TECHNIQUES[best].guard * masteryMult(best)) best = id;
    }
  }
  return best;
}

/* how much of an incoming blow a guarding technique blunts */
function guardReduction(id) {
  const t = TECHNIQUES[id];
  return clamp((t.guard || 0) * masteryMult(id), 0, 0.75);
}

/* ---------------- cooldowns (ultimates) ---------------- */

const techCooldownLeft = (id) => state.cooldowns[id] || 0;
function tickCooldowns() {
  for (const k of Object.keys(state.cooldowns)) {
    if (state.cooldowns[k] > 0) {
      state.cooldowns[k] -= 1;
      if (state.cooldowns[k] <= 0) delete state.cooldowns[k];
    }
  }
}
function putOnCooldown(id) {
  const t = TECHNIQUES[id];
  if (t.type === "ultimate" && t.cooldown) state.cooldowns[id] = t.cooldown;
}

/* ---------------- acquisition ---------------- */

const acquisitionText = (id) => TECHNIQUES[id].from || "Unknown origins.";
