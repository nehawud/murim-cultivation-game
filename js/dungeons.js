"use strict";

/* =====================================================================
   dungeons.js — dungeons and hidden realms: procedurally-generated runs
   (ancient ruins, secret realms, inheritance trials, guarded vaults),
   elite/boss floors, room events, accumulated loot, and the periodic
   opening/closing of secret realms on the world tick.

   A run lives in state.dungeon; combat floors reuse the normal enemy /
   combat loop (state.enemy) and advance via hooks called from combat.js.
   Loot is only banked when you finish or retreat — die and you lose it.
   ===================================================================== */

const SECRET_REALM_MIN_MS = 20 * 60 * 1000;   /* stays open 20-60 minutes */
const SECRET_REALM_MAX_MS = 60 * 60 * 1000;
const SECRET_REALM_MAX_OPEN = 2;
const SECRET_REALM_TICK_CHANCE = 0.18;        /* per world tick */

/* ============================== LOOKUPS ============================== */

function dungeonSiteById(id) {
  return DUNGEON_SITES.find((s) => s.id === id) || SECRET_REALMS.find((s) => s.id === id) || null;
}
function secretRealmById(id) { return SECRET_REALMS.find((s) => s.id === id) || null; }
function dungeonTypeOf(site) { return site && DUNGEON_TYPES[site.type] ? DUNGEON_TYPES[site.type] : null; }

function dungeonSitesInRegion(regionId) { return DUNGEON_SITES.filter((s) => s.region === regionId); }

/* ============================== SECRET REALMS ============================== */

/* A secret realm currently open in a region, or null (also null once expired). */
function openSecretRealmIn(regionId, now = Date.now()) {
  const r = (state.secretRealms || {})[regionId];
  if (!r || r.expiresAt <= now) return null;
  const site = secretRealmById(r.siteId);
  return site ? { regionId, site, openedAt: r.openedAt, expiresAt: r.expiresAt, msLeft: r.expiresAt - now } : null;
}

function openSecretRealmList(now = Date.now()) {
  const out = [];
  for (const regionId of Object.keys(state.secretRealms || {})) {
    const sr = openSecretRealmIn(regionId, now);
    if (sr) out.push(sr);
  }
  return out;
}

/* Expire realms whose time has run out. */
function secretRealmTick(now = Date.now()) {
  for (const regionId of Object.keys(state.secretRealms || {})) {
    const r = state.secretRealms[regionId];
    if (!secretRealmById(r.siteId) || r.expiresAt <= now) delete state.secretRealms[regionId];
  }
}

/* Occasionally open a new secret realm in some region. */
function maybeOpenSecretRealm(now = Date.now()) {
  if (openSecretRealmList(now).length >= SECRET_REALM_MAX_OPEN) return;
  if (Math.random() > SECRET_REALM_TICK_CHANCE) return;
  const closed = SECRET_REALMS.filter((s) => !openSecretRealmIn(s.region, now));
  if (!closed.length) return;
  const site = closed[Math.floor(Math.random() * closed.length)];
  const ttl = SECRET_REALM_MIN_MS + Math.floor(Math.random() * (SECRET_REALM_MAX_MS - SECRET_REALM_MIN_MS));
  state.secretRealms[site.region] = { siteId: site.id, openedAt: now, expiresAt: now + ttl };
  addLog(`🌌 A secret realm opens: ${site.name} in ${regionById(site.region).name}. It will not stay open long.`, "gold");
}

/* Called from worldTick. */
function dungeonsTick(now = Date.now()) {
  secretRealmTick(now);
  maybeOpenSecretRealm(now);
}

/* ============================== RUN LIFECYCLE ============================== */

/* Entrances the player can use right now (fixed sites here + an open secret realm). */
function dungeonAvailableSites(regionId = state.region) {
  const out = dungeonSitesInRegion(regionId).map((site) => ({ site, secret: null }));
  const sr = openSecretRealmIn(regionId);
  if (sr) out.unshift({ site: sr.site, secret: sr });
  return out;
}

function pickDungeonRoom(site) {
  const keys = Object.keys(DUNGEON_ROOMS);
  let total = 0;
  const weighted = [];
  for (const k of keys) {
    let w = DUNGEON_ROOMS[k].weight;
    if (k === "elite" && site.type === "vault") w += 8;   /* vaults are elite-heavy */
    weighted.push([k, w]);
    total += w;
  }
  let r = Math.random() * total;
  for (const [k, w] of weighted) { r -= w; if (r < 0) return k; }
  return "combat";
}

function emptyLoot() {
  return { silver: 0, materials: {}, manuals: [], pills: 0, gear: [], spins: 0, essence: 0, techs: [] };
}

function startDungeon(siteId) {
  if (state.enemy) { addLog("You cannot enter a dungeon mid-battle.", "bad"); render(); return; }
  if (state.dungeon) { addLog("You are already inside a dungeon.", "bad"); render(); return; }
  const site = dungeonSiteById(siteId);
  if (!site || site.region !== state.region) { addLog("You must travel to that site first.", "bad"); render(); return; }
  const type = dungeonTypeOf(site);
  if (!type) return;

  /* entering a secret realm consumes its opening */
  if (site.type === "secret_realm") delete state.secretRealms[site.region];

  const floors = type.minFloors + Math.floor(Math.random() * (type.maxFloors - type.minFloors + 1));
  const plan = [];
  for (let i = 1; i <= floors; i++) {
    if (i === floors) plan.push(site.type === "trial" ? "trial" : "boss");
    else plan.push(pickDungeonRoom(site));
  }

  state.dungeon = {
    siteId: site.id, regionId: site.region, name: site.name, type: site.type,
    floor: 1, floors, cleared: 0, awaiting: false, plan, loot: emptyLoot(),
  };
  addLog(`You enter ${site.name} — ${type.name} (${floors} floors).`, "gold");
  enterDungeonFloor();
  save();
  render();
}

/* Present the current floor's content. Combat floors spawn an enemy; other
   floors resolve at once and wait for the player to descend or retreat. */
function enterDungeonFloor() {
  const run = state.dungeon;
  if (!run) return;
  run.awaiting = false;
  const kind = run.plan[run.floor - 1];
  switch (kind) {
    case "combat": spawnDungeonEnemy(false, false); break;
    case "elite":  spawnDungeonEnemy(true, false); break;
    case "boss":
    case "trial":  spawnDungeonEnemy(false, true); break;
    case "treasure": resolveDungeonTreasure(); break;
    case "hazard":   resolveDungeonHazard(); break;
    case "rest":     resolveDungeonRest(); break;
    case "lore":     resolveDungeonLore(); break;
  }
  save();
}

function spawnDungeonEnemy(elite, boss) {
  const run = state.dungeon;
  const site = dungeonSiteById(run.siteId);
  const region = regionById(run.regionId);
  const [lo, hi] = site.rankIdx;
  /* deeper floors drift toward the high end of the range */
  const drift = Math.floor((run.floor - 1) / 3);
  const rank = clamp(lo + Math.floor(Math.random() * (hi - lo + 1)) + drift, 0, ENEMY_RANKS.length - 1);
  const typeId = boss ? "boss" : randomEnemyType(region);
  const per = boss ? "ruthless" : randomPersonality(ENEMY_TYPES[typeId]);
  const opts = { boss: !!boss };
  if (elite) { opts.hpMul = 1.7; opts.atkMul = 1.25; opts.xpMul = 1.4; }
  if (boss) { opts.hpMul = 2.1; opts.atkMul = 1.4; opts.xpMul = 2; opts.name = site.boss || `${ENEMY_TYPES[typeId].name} Warden`; }
  const enemy = buildEnemy(region, rank, typeId, per, opts);
  enemy.elite = !!elite && !boss;
  enemy.dungeon = true;
  enemy.dungeonFloor = run.floor;
  state.enemy = enemy;
  state.combatLog = [];
  const who = boss
    ? (run.plan[run.floor - 1] === "trial" ? "the trial's guardian" : "the dungeon's lord")
    : elite ? "an elite guardian" : "a guardian";
  addCombatLog(`Floor ${run.floor}: ${enemy.name} (${enemy.rankName}) — ${who} — bars the way!`, "bad");
  afterEnemySpawn();
}

/* ============================== ROOM RESOLVERS ============================== */

function resolveDungeonTreasure() {
  const run = state.dungeon;
  const site = dungeonSiteById(run.siteId);
  const region = regionById(run.regionId);
  const silver = 40 + site.rankIdx[1] * 30 + run.floor * 20 + Math.floor(Math.random() * 40);
  run.loot.silver += silver;
  const mat = region.materials[Math.floor(Math.random() * region.materials.length)];
  run.loot.materials[mat] = (run.loot.materials[mat] || 0) + 1 + Math.floor(Math.random() * 2);
  let extra = "";
  if (Math.random() < 0.5) { run.loot.materials.rare_material = (run.loot.materials.rare_material || 0) + 1; extra += ", rare relic fragments"; }
  if (Math.random() < 0.25) { run.loot.gear.push(rollItem(site.rankIdx[1] + 1)); extra += ", an armament"; }
  if (Math.random() < 0.20) { run.loot.pills += 1; extra += ", a breakthrough pill"; }
  run.awaiting = true;
  addLog(`Floor ${run.floor} treasure: ${silver} silver, ${MATERIALS[mat].name}${extra}.`, "good");
}

function resolveDungeonHazard() {
  const run = state.dungeon;
  const dmg = Math.round(stats().maxHp * (0.12 + Math.random() * 0.18));
  state.hp = Math.max(1, state.hp - dmg);   /* a trap never quite kills — but it hurts */
  run.awaiting = true;
  addLog(`Floor ${run.floor}: an old trap springs — you take ${dmg} damage, but press on.`, "bad");
}

function resolveDungeonRest() {
  const run = state.dungeon;
  const s = stats();
  const heal = Math.round(s.maxHp * 0.4);
  state.hp = Math.min(s.maxHp, state.hp + heal);
  const qi = 60 + run.floor * 30;
  state.qi += qi;
  run.awaiting = true;
  addLog(`Floor ${run.floor}: a sealed spring — you recover ${heal} HP and ${qi} qi.`, "good");
}

function resolveDungeonLore() {
  const run = state.dungeon;
  const qi = 40 + run.floor * 25;
  state.qi += qi;
  gainXp(10 + run.floor * 5);
  run.awaiting = true;
  const line = DUNGEON_LORE[Math.floor(Math.random() * DUNGEON_LORE.length)];
  addLog(`Floor ${run.floor}: an inscription — ${line} (+qi, +xp)`, "");
}

/* ============================== DESCEND / END ============================== */

function dungeonDescend() {
  const run = state.dungeon;
  if (!run) return;
  if (state.enemy) return;
  if (!run.awaiting) return;
  if (run.floor >= run.floors) { finishDungeon(); return; }
  run.floor += 1;
  enterDungeonFloor();
  save();
  render();
}

/* Called from combat.js when a dungeon enemy is slain. */
function onDungeonFloorCleared(enemy) {
  const run = state.dungeon;
  if (!run) return;
  run.cleared += 1;

  if (enemy.elite) {
    run.loot.silver += 60 + run.floor * 40;
    if (Math.random() < 0.4) run.loot.pills += 1;
    if (Math.random() < 0.3) run.loot.materials.rare_material = (run.loot.materials.rare_material || 0) + 1;
    addLog(`You cut down the elite guardian of floor ${run.floor} — bonus spoils claimed.`, "gold");
  }

  if (run.floor >= run.floors) { finishDungeon(); return; }

  run.awaiting = true;
  addLog(`Floor ${run.floor} cleared. The path descends farther (${run.floors - run.floor} left).`, "good");
}

/* Called from combat.js on defeat (escaped=false) or a successful flee (escaped=true). */
function onDungeonEnd(escaped) {
  const run = state.dungeon;
  if (!run) return;
  if (escaped) {
    bankDungeonLoot();
    addLog(`You flee ${run.name}, clutching what you found (${run.cleared} floor(s) cleared).`, "bad");
  } else {
    addLog(`You are driven from ${run.name}. Your gathered spoils are lost in the dark.`, "bad");
  }
  state.dungeon = null;
  save();
}

function dungeonRetreat() {
  const run = state.dungeon;
  if (!run) return;
  if (state.enemy) { addLog("You cannot retreat while a guardian bars the way — fight or flee.", "bad"); render(); return; }
  bankDungeonLoot();
  addLog(`You leave ${run.name} with your spoils (${run.cleared} floor(s) cleared).`, "");
  state.dungeon = null;
  save();
  render();
}

function finishDungeon() {
  const run = state.dungeon;
  if (!run) return;
  const site = dungeonSiteById(run.siteId);

  /* final spoils */
  run.loot.silver += 120 + site.rankIdx[1] * 60;
  run.loot.materials.rare_material = (run.loot.materials.rare_material || 0) + 2;
  run.loot.spins += (site.type === "trial" || site.type === "secret_realm") ? 2 : 1;
  if (site.inheritance && site.inheritance.length) grantInheritance(site, run);

  bankDungeonLoot();
  state.dungeonsCleared += 1;
  adjustReputation({ renown: 30 + site.rankIdx[1] * 8, alignment: 2 });
  addLog(`🏆 You clear ${run.name}! The depths fall silent behind you.`, "gold");
  state.dungeon = null;
  save();
  render();
}

function grantInheritance(site, run) {
  const unknown = site.inheritance.filter((id) => !isLearned(id));
  if (unknown.length) {
    const techId = unknown[Math.floor(Math.random() * unknown.length)];
    state.techniques.push(techId);
    if (state.mastery[techId] == null) state.mastery[techId] = 1;
    run.loot.techs.push(techId);
    addLog(`Ancient inheritance! You comprehend ${TECHNIQUES[techId].name}.`, "gold");
    return;
  }
  /* every art already known — convert to a study manual and essence */
  const known = site.inheritance[Math.floor(Math.random() * site.inheritance.length)];
  const manualId = Object.keys(MANUALS).find((mid) => MANUALS[mid].teaches === known);
  if (manualId) run.loot.manuals.push(manualId);
  run.loot.essence += 40;
  addLog("The trial offers an art you already hold — its essence still enriches you.", "gold");
}

function bankDungeonLoot() {
  const run = state.dungeon;
  if (!run) return;
  const l = run.loot;
  if (l.silver) state.silver += l.silver;
  for (const [m, c] of Object.entries(l.materials)) addMaterial(m, c);
  for (const mid of l.manuals) state.manuals.push(mid);
  if (l.pills) state.pills += l.pills;
  for (const g of l.gear) state.inventory.push(g);
  if (l.spins) grantSpins(l.spins, "dungeon spoils");
  if (l.essence) state.clanEssence += l.essence;
}

/* ============================== UI HELPERS ============================== */

/* Human-readable list of everything banked so far in the current run. */
function dungeonLootText(loot) {
  if (!loot) return "—";
  const parts = [];
  if (loot.silver) parts.push(`${loot.silver} silver`);
  for (const [m, c] of Object.entries(loot.materials)) if (c > 0) parts.push(`${c}× ${MATERIALS[m].name}`);
  if (loot.pills) parts.push(`${loot.pills} pill(s)`);
  if (loot.manuals.length) for (const mid of loot.manuals) parts.push(MANUALS[mid].name);
  if (loot.gear.length) parts.push(`${loot.gear.length} armament(s)`);
  if (loot.techs.length) for (const t of loot.techs) parts.push("★ " + TECHNIQUES[t].name);
  if (loot.spins) parts.push(`${loot.spins} clan spin(s)`);
  if (loot.essence) parts.push(`${loot.essence} essence`);
  return parts.length ? parts.join(", ") : "nothing yet";
}
