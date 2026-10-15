"use strict";

/* =====================================================================
   sects.js — sect membership, the 10-rank progression, contribution
   points, sect missions, the contribution shop, disciple challenges,
   inheritance, rivalries, intrigue and war.
   ===================================================================== */

const SECT_MISSION_REFRESH_MS = 6 * 3600 * 1000;

/* ============================== VIEW HELPERS ============================== */

const currentSect = () => (state.sect ? sectById(state.sect) : null);
const sectGrade = (sect) => (sect ? SECT_GRADES[sect.grade] : null);
const sectRankInfo = (rank) => SECT_RANKS[clamp(rank, 1, SECT_RANKS.length) - 1];
const nextSectRank = () => (state.sect && state.sectRank < SECT_RANKS.length ? SECT_RANKS[state.sectRank] : null);
const sectRegionName = (sect) => (sect && regionById(sect.region) ? regionById(sect.region).name : "unknown lands");
const areSectRivals = (aId, bId) => { const a = sectById(aId); return !!(a && a.rivals.includes(bId)); };

/* Top ranks also need raw strength, not just contribution. */
function sectCombatGateOk(rank) {
  if (rank < 7) return true;
  return playerCombatRankIdx() >= rank - 3;
}

/* ============================== JOIN / LEAVE ============================== */

function canJoinSect(id) {
  const s = sectById(id);
  if (!s) return { ok: false, reason: "Unknown sect." };
  if (state.sect === id) return { ok: false, reason: "You are already a member." };
  if (state.sect) return { ok: false, reason: "You must leave your current sect first." };
  if (state.region !== s.region) return { ok: false, reason: `Travel to ${sectRegionName(s)} to seek admission.` };
  if (s.bloodline && state.bloodline !== s.bloodline) {
    return { ok: false, reason: `Only the ${gachaClanById(s.bloodline).name} bloodline may enter.` };
  }
  if (s.hidden && !state.sectFlags["found_" + id]) return { ok: false, reason: "You have not yet discovered this hidden sect." };
  if (playerCombatRankIdx() < (s.reqCombatRank || 0)) {
    return { ok: false, reason: `Requires the strength of a ${ENEMY_RANKS[s.reqCombatRank].name}.` };
  }
  return { ok: true };
}

function joinSect(id) {
  const c = canJoinSect(id);
  if (!c.ok) { addLog(c.reason, "bad"); render(); return; }
  const s = sectById(id);
  state.sect = id;
  state.sectRank = 1;
  state.contribution = 0;
  state.sectMissions = [];
  refreshSectMissions(true);
  adjustStanding(s.id, 15);
  addLog(`You pass the entrance trial and are accepted into the ${s.name} as an Outer Disciple!`, "gold");
  save(); render();
}

function leaveSect() {
  if (!state.sect) return;
  const s = currentSect();
  adjustStanding(s.id, -40);
  state.sectFlags["abandoned_" + s.id] = true;
  state.sectHistory.unshift({ sect: s.name, rank: state.sectRank, contribution: state.contribution, result: "left", when: Date.now() });
  addLog(`You sever ties with the ${s.name}. Its members will remember your departure.`, "bad");
  state.sect = null;
  state.sectRank = 1;
  state.contribution = 0;
  state.sectMissions = [];
  save(); render();
}

/* ============================== CONTRIBUTION / RANKS ============================== */

function addContribution(n, reason) {
  if (!state.sect || n <= 0) return;
  state.contribution += n;
  if (reason) addLog(`+${n} sect contribution (${reason}).`, "good");
  checkSectPromotion();
}

function checkSectPromotion() {
  while (true) {
    const next = nextSectRank();
    if (!next) return;
    if (state.contribution < next.req) return;
    if (!sectCombatGateOk(next.rank)) {
      addLog(`The ${currentSect().name} would promote you, but you lack the strength for the rank of ${next.name}.`, "bad");
      return;
    }
    state.sectRank = next.rank;
    addLog(`Promotion! You rise to ${next.name} of the ${currentSect().name}. (${next.role})`, "gold");
  }
}

/* ============================== MISSIONS ============================== */

function sectMissionDay() { return Math.floor(Date.now() / SECT_MISSION_REFRESH_MS); }

function makeSectMission(tmpl) {
  const lvl = state.sectRank;
  const m = { id: uid(), type: tmpl.type, label: tmpl.label, progress: 0, done: false };
  if (tmpl.type === "kill") { m.target = 2 + lvl; m.contrib = 40 + lvl * 20; }
  else if (tmpl.type === "gather") { m.target = 3 + lvl; m.contrib = 35 + lvl * 15; }
  else if (tmpl.type === "donate") { m.target = 100 + lvl * 90; m.contrib = 40 + lvl * 15; }
  else if (tmpl.type === "cultivate") { m.target = qiRequirement(state.realm, Math.min(STAGES_PER_REALM, state.stage)); m.contrib = 50 + lvl * 20; }
  m.label = m.label.replace("{region}", currentRegion().name);
  return m;
}

function refreshSectMissions(force) {
  if (!state.sect) return;
  const day = sectMissionDay();
  if (!force && state.sectMissions.length && state.sectMissionsDay === day) return;
  const pool = SECT_MISSION_TEMPLATES.slice();
  state.sectMissions = [];
  for (let i = 0; i < 3 && pool.length; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    state.sectMissions.push(makeSectMission(pool.splice(idx, 1)[0]));
  }
  state.sectMissionsDay = day;
}

function turnInSectMission(id) {
  const m = state.sectMissions.find((x) => x.id === id);
  if (!m) return;
  if (m.type === "donate") {
    if (state.silver < m.target) { addLog(`You need ${m.target} silver to complete this donation.`, "bad"); render(); return; }
    state.silver -= m.target;
  } else if (m.type === "cultivate") {
    if (state.qi < m.target) { addLog(`You need ${m.target.toLocaleString()} qi to complete this cultivation task.`, "bad"); render(); return; }
    state.qi -= m.target;
  } else if (!m.done) {
    addLog(`Not yet complete (${Math.min(m.progress, m.target)}/${m.target}).`, "bad"); render(); return;
  }
  const gain = warContributionBonus(m.contrib);
  state.sectMissions = state.sectMissions.filter((x) => x.id !== id);
  addLog(`Mission complete: ${m.label}.`, "gold");
  addContribution(gain, "sect mission");
  maybeSectInheritance();
  save(); render();
}

/* Called wherever the active quest board is notified, so sect missions progress too. */
function sectEvent(type, data = {}) {
  if (!state.sect) return;
  for (const m of state.sectMissions) {
    if (m.done) continue;
    if (m.type === "kill" && type === "kill") { m.progress += 1; if (m.progress >= m.target) m.done = true; }
    else if (m.type === "gather" && type === "gather") { m.progress += 1; if (m.progress >= m.target) m.done = true; }
  }
  if (type === "explore") maybeDiscoverHiddenSect();
}

/* ============================== SHOP ============================== */

function buySectItem(id) {
  const item = SECT_SHOP.find((x) => x.id === id);
  if (!item) return;
  if (state.contribution < item.cost) {
    addLog(`You need ${item.cost} contribution (have ${state.contribution}).`, "bad"); render(); return;
  }
  const s = currentSect();
  if (item.kind === "manual") {
    if (state.manuals.includes(item.ref)) { addLog("You already own that manual.", "bad"); render(); return; }
    state.manuals.push(item.ref);
  } else if (item.kind === "pill") {
    state.pills += item.amount || 1;
  } else if (item.kind === "material") {
    addMaterial(item.ref, item.amount || 1);
  } else if (item.kind === "weapon") {
    const tier = Math.max(1, (sectGrade(s) ? sectGrade(s).tier : 0) + 2);
    const it = rollItem(tier);
    state.inventory.push(it);
    addLog(`The sect armory issues you ${it.name} (${RARITIES[it.rarity].name}).`, "gold");
  } else if (item.kind === "technique") {
    const manualId = (s.manuals || [])[0];
    if (!manualId) { addLog("Your sect holds no secret art for you to purchase.", "bad"); render(); return; }
    if (state.manuals.includes(manualId)) { addLog("You already hold your sect's secret art.", "bad"); render(); return; }
    state.manuals.push(manualId);
    addLog(`You exchange contribution for the sect's secret art: ${MANUALS[manualId].name}.`, "gold");
  }
  state.contribution -= item.cost;
  if (item.kind !== "weapon" && item.kind !== "technique") addLog(`Purchased ${item.name} for ${item.cost} contribution.`, "good");
  save(); render();
}

/* ============================== TRAINING / CHALLENGES ============================== */

/* Spend time in the training grounds: small contribution, risk of a challenge. */
function sectTrain() {
  if (!state.sect) { addLog("You are not a member of any sect.", "bad"); render(); return; }
  const s = currentSect();
  const gain = 10 + state.sectRank * 5;
  addContribution(gain, "training");
  addLog(`You drill in the ${s.name} training grounds.`, "good");
  maybeSectInheritance();
  if (!maybeSectChallenge()) { save(); render(); return; }
  save(); render();
}

function maybeSectChallenge() {
  if (!state.sect || state.enemy) return false;
  const chance = 0.10 + state.sectRank * 0.02;
  if (Math.random() > chance) return false;
  const s = currentSect();
  const region = currentRegion();
  const rank = Math.max(0, playerCombatRankIdx());
  const rival = s.rivals.length && Math.random() < 0.55 ? sectById(s.rivals[0]) : null;
  const name = rival ? `${rival.name} Disciple` : `${s.name} Rival Disciple`;
  state.enemy = buildEnemy(region, rank, "sect_member", "aggressive", { name });
  state.enemy.sectChallenge = true;
  state.combatLog = [];
  addCombatLog(`${name} challenges your position within the ${s.name}!`, "bad");
  afterEnemySpawn();
  return true;
}

function resolveSectChallenge(won) {
  if (!state.sect) return;
  if (won) {
    addContribution(70 + state.sectRank * 15, "defended your rank");
    addLog("You defend your standing — your contribution rises.", "good");
  } else {
    state.contribution = Math.max(0, state.contribution - 50);
    if (state.sectRank > 1 && Math.random() < 0.5) {
      state.sectRank -= 1;
      addLog(`Beaten in a challenge, you are demoted to ${sectRankInfo(state.sectRank).name}.`, "bad");
    } else {
      addLog("Beaten in a challenge, you lose contribution.", "bad");
    }
  }
}

/* ============================== INHERITANCE ============================== */

function maybeSectInheritance() {
  if (!state.sect || state.sectRank < 6) return false;
  const s = currentSect();
  if (!s.techniques.length) return false;
  const techId = s.techniques[0];
  if (state.techniques.includes(techId)) return false;
  const manualId = (s.manuals || []).find((mId) => MANUALS[mId] && MANUALS[mId].teaches === techId) || (s.manuals || [])[0];
  if (!manualId || state.manuals.includes(manualId)) return false;
  if (Math.random() > 0.15) return false;
  state.manuals.push(manualId);
  addLog(`An elder quietly presses a ${MANUALS[manualId].name} into your hands — a secret inheritance.`, "gold");
  return true;
}

/* ============================== DISCOVERY ============================== */

function maybeDiscoverHiddenSect() {
  if (state.sect) return;
  for (const s of SECTS) {
    if (!s.hidden || state.sectFlags["found_" + s.id]) continue;
    if (s.region !== state.region) continue;
    if (Math.random() > 0.12) continue;
    state.sectFlags["found_" + s.id] = true;
    addLog(`You stumble upon the concealed ${s.name}! (You may seek admission here.)`, "gold");
    return;
  }
}

/* ============================== WAR / INTRIGUE ============================== */

const warContributionBonus = (n) => (state.sectFlags.warUntil && Date.now() < state.sectFlags.warUntil ? Math.round(n * 1.5) : n);

function maybeSectWar() {
  if (!state.sect) return;
  const s = currentSect();
  if (!s.rivals.length) return;
  if (state.sectFlags.warUntil && Date.now() < state.sectFlags.warUntil) return;
  if (Math.random() > 0.04) return;
  const enemy = sectById(s.rivals[Math.floor(Math.random() * s.rivals.length)]);
  state.sectFlags.warUntil = Date.now() + 30 * 60 * 1000;
  state.sectFlags.warWith = enemy.id;
  adjustStanding(enemy.id, -10);
  addLog(`Sect war! The ${s.name} clashes with the ${enemy.name}. Contributions earned in the next half hour are worth more.`, "bad");
}

function maybeSectIntrigue() {
  if (!state.sect) return;
  if (Math.random() > 0.08) return;
  if (Math.random() < 0.5) {
    state.contribution += 25;
    addLog("An elder favors you quietly; you gain 25 contribution.", "good");
  } else {
    state.contribution = Math.max(0, state.contribution - 20);
    addLog("Court intrigue turns against you; you lose 20 contribution.", "bad");
  }
}

/* Periodic sect simulation driven from the world tick. */
function sectTick() {
  if (!state.sect) return;
  maybeSectWar();
  maybeSectIntrigue();
  maybeDiscoverHiddenSect();
  refreshSectMissions(false);
}
