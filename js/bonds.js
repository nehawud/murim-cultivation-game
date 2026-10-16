/* =====================================================================
   BONDS MODULE
   Three separate layers, never collapsed into one number:
     1) Bond score   (-100..+100) — personal trust / hostility.
     2) Bond type    — the nature of the tie (rival, master, sworn...).
     3) Faction rep  — already handled by state.standing (a whole sect's view).
   Relationships change from ACTIONS, not random drift. Rivals train and
   challenge; nemeses remember and hunt.
   ===================================================================== */

/* ---------------- state ---------------- */

function ensureNpcState(id) {
  if (!state.npcs) state.npcs = {};
  if (!state.npcs[id]) state.npcs[id] = { score: 0, type: null, met: false, region: null, history: [], wins: 0, losses: 0, power: 0, status: "active" };
  const st = state.npcs[id];
  if (!Array.isArray(st.history)) st.history = [];
  if (typeof st.wins !== "number") st.wins = 0;
  if (typeof st.losses !== "number") st.losses = 0;
  if (typeof st.power !== "number") st.power = 0;
  return st;
}

const bondOf = (id) => (state.npcs && state.npcs[id] ? state.npcs[id].score : 0);

function bondBand(score) {
  for (const b of BOND_BANDS) if (score >= b.min && score <= b.max) return b;
  return BOND_BANDS[3];
}

/* Explicit type wins; otherwise derive a sensible generic type from score. */
function bondTypeOf(id) {
  const st = state.npcs && state.npcs[id];
  const n = npcById(id);
  if (st && st.type) return st.type;
  if (!st || !st.met) return "stranger";
  const band = bondBand(st.score);
  if (band.name === "Nemesis") return "nemesis";
  if (band.name === "Hostile Enemy") return "enemy";
  if (st.score >= 61) return "ally";
  if (st.score >= 41) return "friend";
  if (st.score >= 21) return "acquaintance";
  if (st.score < -20) return "enemy";
  return "neutral";
}

const bondTypeName = (id) => BOND_TYPES[bondTypeOf(id)].name;
const bondBandName = (id) => bondBand(bondOf(id)).name;

function setBondType(id, type, note) {
  const st = ensureNpcState(id);
  if (st.type === type) return;
  st.type = type;
  const n = npcById(id);
  if (n) addLog(`${n.name}: your relationship is now "${BOND_TYPES[type].name}"${note ? ` — ${note}` : ""}.`, "gold");
}

/* ---------------- action-driven changes ---------------- */

function changeBond(id, action, opts = {}) {
  const n = npcById(id);
  if (!n) return 0;
  const st = ensureNpcState(id);
  const def = BOND_ACTIONS[action];
  let delta = opts.delta != null ? opts.delta : (def ? def.delta : 0);
  if (opts.mult) delta = Math.round(delta * opts.mult);
  if (!delta && !opts.force) return 0;

  const before = st.score;
  st.score = clamp(st.score + delta, -100, 100);
  st.met = true;
  if (!st.region) st.region = state.region;
  const label = opts.label || (def && def.label) || action;
  st.history.unshift({ t: Date.now(), text: `${label} (${delta >= 0 ? "+" : ""}${delta})` });
  if (st.history.length > 20) st.history.pop();
  st.status = st.type === "nemesis" ? "hunting" : "active";

  addLog(`${n.name}: ${label} (${delta >= 0 ? "+" : ""}${delta}).`, delta >= 0 ? "good" : "bad");

  /* severe betrayals re-forge the tie itself */
  if (action === "betrayed_sworn") setBondType(id, "nemesis", "a broken oath is never forgotten");
  else if (st.score <= -81) setBondType(id, "nemesis", "their grudge is absolute");
  else if (st.score <= -51 && !st.type) setBondType(id, "enemy");

  /* morally-weighted interactions feed the karma ledger */
  if (typeof karmaFromBondAction === "function") karmaFromBondAction(action);

  return delta;
}

/* ---------------- meeting / discovery ---------------- */

function meetNpc(id, note) {
  const n = npcById(id);
  if (!n) return;
  const st = ensureNpcState(id);
  if (st.met) return;
  st.met = true;
  st.region = state.region;
  addLog(`You meet ${n.name} — ${n.role}${n.realm ? ` (${n.realm})` : ""}. ${note || ""}`.trim(), "gold");
}

function investigateNpc(id) {
  const n = npcById(id);
  if (!n) return;
  const st = ensureNpcState(id);
  if (st.met) { addLog(`${n.name} is already known to you.`, ""); render(); return; }
  const cost = 20;
  if (state.silver < cost) { addLog(`Investigating ${n.name} costs ${cost} silver (you have ${state.silver}).`, "bad"); render(); return; }
  state.silver -= cost;
  meetNpc(id, "You piece together their identity from rumours and records.");
  save(); render();
}

/* ---------------- interactions (gifts, favors, sparring, reconciliation) ----------------
   Benefits are real but cost relationship capital: training draws down the bond,
   gifts build it. Keeping a tie healthy is an ongoing choice, not a one-off unlock. */

function giftNpc(id, tier) {
  const n = npcById(id);
  const g = BOND_GIFTS.find((x) => x.tier === tier);
  if (!n || !g) return;
  if (typeof npcKarmaReaction === "function") {
    const r = npcKarmaReaction(id);
    if (r && r.refuses) { addLog(r.text, "bad"); render(); return; }
  }
  const st = ensureNpcState(id);
  if (state.silver < g.cost) { addLog(`A ${g.name} costs ${g.cost} silver (you have ${state.silver}).`, "bad"); render(); return; }
  state.silver -= g.cost;
  st.gifts = (st.gifts || 0) + 1;
  const mult = 1 / (1 + st.gifts * 0.2); /* the same gift means less the more you lean on it */
  const gain = Math.max(1, Math.round(g.gain * mult));
  changeBond(id, null, { delta: gain, label: `You gave them a ${g.name}`, force: true });
  save(); render();
}

function canSeekTraining(id) {
  const type = bondTypeOf(id);
  if (["master", "sworn", "disciple"].includes(type)) return true;
  if (["friend", "ally", "close_friend"].includes(type)) return true;
  return bondOf(id) >= 41;
}

function seekTraining(id) {
  const n = npcById(id);
  if (!n) return;
  if (typeof npcKarmaReaction === "function") {
    const r = npcKarmaReaction(id);
    if (r && r.refuses) { addLog(r.text, "bad"); render(); return; }
  }
  if (!canSeekTraining(id)) { addLog(`${n.name} will not train an outsider. Deepen the bond first.`, "bad"); render(); return; }
  const cost = 6; /* training is a favor — it spends goodwill */
  if (bondOf(id) - cost < -100) { addLog(`${n.name} has no goodwill left to spend.`, "bad"); render(); return; }
  const st = ensureNpcState(id);
  st.trained = (st.trained || 0) + 1;
  const mult = 1 / (1 + (st.trained - 1) * 0.25);
  const xp = Math.max(3, Math.round((15 + state.realm * 8) * mult));
  changeBond(id, "trained_with_them", { force: true });
  changeBond(id, null, { delta: -cost, label: "they invested effort in you", force: true });
  gainXp(xp);
  addLog(`${n.name} guides your cultivation. (+${xp} xp)`, "good");
  save(); render();
}

function canSpar(id) {
  const type = bondTypeOf(id);
  return type === "rival" || bondOf(id) >= 21;
}

function sparNpc(id) {
  const n = npcById(id);
  if (!n) return;
  if (!canSpar(id)) { addLog(`${n.name} has no interest in sparring with you.`, "bad"); render(); return; }
  const st = ensureNpcState(id);
  const myPower = playerCombatRankIdx();
  const theirPower = st.power != null ? st.power : 0;
  const winChance = clamp(0.5 + (myPower - theirPower) * 0.15, 0.2, 0.9);
  const won = Math.random() < winChance;
  if (st.type === "rival") recordRivalOutcome(id, won);
  else changeBond(id, "sparred_friendly", { force: true });
  if (won) {
    const silver = 5 + state.realm * 3, xp = 8 + state.realm * 3;
    state.silver += silver; gainXp(xp);
    addLog(`You take the spar against ${n.name}. (+${silver} silver, +${xp} xp)`, "gold");
  } else {
    addLog(`${n.name} takes the spar. You learn from the loss.`, "bad");
  }
  save(); render();
}

function canReconcile(id) {
  const type = bondTypeOf(id);
  return type === "enemy" || type === "nemesis";
}

function reconcileNpc(id) {
  const n = npcById(id);
  if (!n) return;
  if (!canReconcile(id)) { addLog(`There is nothing to set right with ${n.name} right now.`, "", ); render(); return; }
  const st = ensureNpcState(id);
  const honor = (state.reputation && state.reputation.honor) || 0;
  let chance = 0.1 + honor / 400 + (bondOf(id) + 100) / 400;
  if (st.type === "nemesis") chance -= 0.15;
  chance = clamp(chance, 0.05, 0.85);
  if (Math.random() < chance) {
    changeBond(id, "reconciled", { force: true });
    setBondType(id, st.type === "nemesis" ? "enemy" : "neutral", "old grudges yield, for now");
    st.status = "active";
    addLog(`${n.name} accepts your overture. Blood feuds ease into cold caution.`, "good");
  } else {
    changeBond(id, null, { delta: -3, label: "your overture was spurned", force: true });
    addLog(`${n.name} spits at your offer of peace.`, "bad");
  }
  save(); render();
}

/* available interactions for the journal UI */
function npcInteractions(id) {
  const out = [];
  if (typeof npcRefusesPlayer === "function" && npcRefusesPlayer(id)) {
    return [{ action: "none", label: "Refuses to deal with you", disabled: true }];
  }
  for (const g of BOND_GIFTS) out.push({ action: "gift", tier: g.tier, label: `Gift: ${g.name} (${g.cost}s)`, disabled: state.silver < g.cost });
  if (canSeekTraining(id)) out.push({ action: "train", label: "Seek Training (−6 bond)" });
  if (canSpar(id)) out.push({ action: "spar", label: "Spar" });
  if (canReconcile(id)) out.push({ action: "reconcile", label: "Attempt Reconciliation" });
  return out;
}

/* ---------------- rivals ---------------- */

function makeRival(id) {
  const n = npcById(id);
  if (!n) return;
  const st = ensureNpcState(id);
  st.rival = true;
  st.met = true;
  st.power = st.power || playerCombatRankIdx();
  setBondType(id, "rival", "a worthy rival");
}

function recordRivalOutcome(id, playerWon) {
  const st = ensureNpcState(id);
  if (playerWon) {
    st.wins += 1;
    changeBond(id, "defeated_rival", { force: true });
    /* mutual respect can soften a rivalry over time */
    if (st.wins + st.losses >= 3 && st.score >= 20) setBondType(id, "ally", "your rivalry has become mutual respect");
  } else {
    st.losses += 1;
    st.obsession = (st.obsession || 0) + 1;
    if ((st.obsession || 0) >= 2 && st.type !== "nemesis") st.status = "obsessed";
  }
}

/* rivals train in the background between meetings */
function rivalsTick() {
  for (const [id, st] of Object.entries(state.npcs || {})) {
    if (st.type !== "rival" && st.type !== "nemesis") continue;
    if (st.type === "rival") {
      /* occasional growth toward the player's tier */
      if (Math.random() < 0.25) st.power = clamp((st.power || 0) + 1, 0, 7);
    }
  }
}

/* called whenever the player reaches a new realm */
function maybeRivalChallenge() {
  const rivals = Object.entries(state.npcs || {}).filter(([id, st]) => {
    const n = npcById(id);
    return n && (st.type === "rival") && st.met;
  });
  if (!rivals.length) return;
  const [id, st] = rivals[Math.floor(Math.random() * rivals.length)];
  if (Math.random() > 0.6) return; /* not every rival rushes you */
  const n = npcById(id);
  const region = currentRegion();
  const rank = clamp(Math.max(playerCombatRankIdx(), st.power || 0), 0, ENEMY_RANKS.length - 1);
  const typeId = Object.keys(ENEMY_TYPES)[0];
  state.enemy = buildEnemy(region, rank, pickRivalType(), "ruthless", { name: n.name, boss: false, hpMul: 1.1, atkMul: 1.05 });
  state.enemy.rivalId = id;
  state.enemy.isRival = true;
  state.combatLog = [];
  addCombatLog(`${n.name} (${state.enemy.rankName}) blocks your path — "A new realm? Let's see if you've earned it!"`, "bad");
  addLog(`${n.name} challenges you, hungry to test your new strength.`, "bad");
  afterEnemySpawn();
}

function pickRivalType() {
  const ids = Object.keys(ENEMY_TYPES);
  const martial = ids.find((k) => ENEMY_TYPES[k].name === "Martial Artist");
  return martial || ids[0];
}

/* ---------------- nemeses & revenge ---------------- */

/* An important defeat may earn you an enemy who remembers — if word reaches them. */
function createNemesis(sourceId, opts = {}) {
  const src = npcById(sourceId);
  const name = opts.name || (src ? `${src.name}'s kin` : "A vengeful foe");
  const id = opts.id || ("nemesis_" + (src ? src.id : uid()));
  if (!npcById(id)) {
    NPCS.push({ id, name, realm: opts.realm || (src ? src.realm : "True Qi Realm"), sect: opts.sect || (src ? src.sect : null), region: opts.region || state.region, role: opts.role || "Avenger", known: true, important: true, tags: ["nemesis"] });
  }
  const st = ensureNpcState(id);
  st.score = -100;
  st.type = "nemesis";
  st.met = true;
  st.status = "hunting";
  st.power = clamp((opts.power != null ? opts.power : playerCombatRankIdx() - 1), 0, 7);
  addLog(`${name} swears vengeance against you — a nemesis is born.`, "bad");
  return id;
}

/* Nemeses grow and, once they can find you, send an ambush. */
function nemesisTick() {
  for (const [id, st] of Object.entries(state.npcs || {})) {
    if (st.type !== "nemesis") continue;
    st.power = clamp((st.power || 0) + (Math.random() < 0.15 ? 1 : 0), 0, 7);
  }
  /* knowledge gate: a nemesis only finds you if your renown makes you known */
  if (state.enemy) return;
  const renown = state.reputation.renown || 0;
  const hunters = Object.entries(state.npcs || {}).filter(([id, st]) => st.type === "nemesis" && st.status === "hunting");
  if (!hunters.length) return;
  /* every ~world tick, a small chance they track you down (scaled by renown) */
  const chance = Math.min(0.25, 0.03 + renown / 4000);
  if (Math.random() > chance) return;
  const [id, st] = hunters[Math.floor(Math.random() * hunters.length)];
  const n = npcById(id);
  const rank = clamp(Math.max(playerCombatRankIdx(), st.power || 0), 0, ENEMY_RANKS.length - 1);
  state.enemy = buildEnemy(currentRegion(), rank, "assassin", "ruthless", { name: (n ? n.name : "Avenger") + "'s blade", hpMul: 1.15, atkMul: 1.1 });
  state.enemy.nemesisId = id;
  state.enemy.isNemesis = true;
  state.combatLog = [];
  addCombatLog(`An avenger sent by ${n ? n.name : "a nemesis"} ambushes you!`, "bad");
  addLog(`A hireling of your nemesis ${n ? n.name : ""} strikes without warning.`, "bad");
  afterEnemySpawn();
}

/* ---------------- combat hooks ---------------- */

function onEnemyDefeated(enemy) {
  if (enemy.isRival && enemy.rivalId) {
    recordRivalOutcome(enemy.rivalId, true);
    const reward = 20 + state.realm * 10;
    state.silver += reward;
    addLog(`You best ${npcById(enemy.rivalId).name}. Victory is noted; rivalries sharpen rivals. (+${reward} silver)`, "gold");
  }
  if (enemy.isNemesis && enemy.nemesisId) {
    /* slaying an avenger enrages the nemesis but sates the immediate threat */
    const st = ensureNpcState(enemy.nemesisId);
    st.status = "hunting";
    addLog(`You cut down your nemesis's agent. ${npcById(enemy.nemesisId) ? npcById(enemy.nemesisId).name : "They"} will not forget this.`, "bad");
  }
  /* defeating a named/important foe may draw revenge from kin or sect */
  if ((enemy.isRival || enemy.isNemesis) && Math.random() < 0.15) {
    /* no-op: those paths already have their own bookkeeping */
  } else if (enemy.boss && !enemy.isRival && !enemy.isNemesis && Math.random() < 0.4) {
    createNemesis(null, { name: `${enemy.name}'s kin`, realm: enemy.rankName, region: state.region, role: "Avenger", power: Math.max(0, enemy.rankIdx - 1) });
  }
}

function onPlayerDefeated(enemy) {
  if (enemy.isRival && enemy.rivalId) {
    recordRivalOutcome(enemy.rivalId, false);
    addLog(`${npcById(enemy.rivalId).name} stands over you, triumphant. The rivalry deepens.`, "bad");
  }
}

/* ---------------- world tick ---------------- */

function bondsTick() {
  rivalsTick();
  nemesisTick();
}

function onRealmAdvance() {
  maybeRivalChallenge();
}

/* ---------------- benefits & journal views ---------------- */

function bondBenefits(id) {
  const type = bondTypeOf(id);
  const band = bondBand(bondOf(id));
  const out = [];
  if (type === "master") out.push("Exclusive training and techniques");
  if (type === "disciple") out.push("Can gather resources and assist on missions");
  if (type === "sworn") out.push("Shared quests and cooperative abilities");
  if (type === "rival") out.push("Unique challenges and rewards for victories");
  if (type === "nemesis" || type === "enemy") out.push("A threat that may strike when you least expect it");
  if (band.name === "Friendly" || band.name === "Trusted Ally" || band.name === "Close Bond" || band.name === "Absolute Trust") out.push("Information, small gifts, and assistance");
  if (band.name === "Trusted Ally" || band.name === "Close Bond" || band.name === "Absolute Trust") out.push("Cooperative quests and combat support");
  if (band.name === "Close Bond" || band.name === "Absolute Trust") out.push("Emergency assistance or rare personal quests");
  return out;
}

function isKnownToPlayer(id) {
  const n = npcById(id);
  const st = state.npcs[id];
  return !!(n && n.known) || !!(st && st.met);
}

function journalGroups() {
  const allies = [], rivals = [], enemies = [], figures = [];
  for (const n of NPCS) {
    const st = state.npcs[n.id];
    const met = isKnownToPlayer(n.id);
    if (!met) { figures.push(n); continue; }
    const type = bondTypeOf(n.id);
    if (["rival"].includes(type)) rivals.push(n);
    else if (["enemy", "nemesis"].includes(type)) enemies.push(n);
    else if (["ally", "friend", "close_friend", "sworn", "master", "disciple"].includes(type) || bondOf(n.id) >= 41) allies.push(n);
    else figures.push(n);
  }
  return { allies, rivals, enemies, figures };
}
