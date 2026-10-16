"use strict";

/* =====================================================================
   worldevents.js — dynamic, region-scoped, time-limited events: bandit
   invasions, sect wars, wandering merchants, mysterious strangers, rare
   beasts, contested treasure, and world bosses.
   ===================================================================== */

const eventLabel = (id) => (FACTIONS[id] ? FACTIONS[id].name : (sectById(id) ? sectById(id).name : id));

function weightedPick(pairs) {
  let total = 0;
  for (const [, w] of pairs) total += w;
  let r = Math.random() * total;
  for (const [k, w] of pairs) { r -= w; if (r <= 0) return k; }
  return pairs[0][0];
}

/* ============================== QUERIES ============================== */

const activeWorldEvents = () => (state.worldEvents || []).filter((e) => e && !e.resolved && e.endsAt > Date.now());
const worldEventsIn = (regionId) => activeWorldEvents().filter((e) => e.regionId === regionId);
const worldEventById = (id) => activeWorldEvents().find((e) => e.id === id);

/* ============================== LIFECYCLE ============================== */

function worldEventsTick() {
  if (!Array.isArray(state.worldEvents)) state.worldEvents = [];
  const now = Date.now();
  for (const ev of state.worldEvents) {
    if (ev.resolved) continue;
    if (now >= ev.endsAt) {
      ev.resolved = true;
      addLog(`The ${WORLD_EVENT_TYPES[ev.kind].name} in ${regionById(ev.regionId).name} has passed.`, "");
      continue;
    }
    applyEventTick(ev);
  }
  state.worldEvents = state.worldEvents.filter((e) => !e.resolved);

  if (activeWorldEvents().length >= WORLD_EVENT_MAX_ACTIVE) return;
  if (Math.random() < WORLD_EVENT_SPAWN_CHANCE) rollWorldEvent();
}

function applyEventTick(ev) {
  if (ev.kind === "bandit_invasion") addThreat(ev.regionId, 1);
}

function rollWorldEvent() {
  const kind = weightedPick(EVENT_SPAWN_WEIGHTS);
  const region = pickEventRegion();
  return spawnWorldEvent(kind, region.id);
}

function pickEventRegion() {
  const mine = playerCombatRankIdx();
  const pool = REGIONS.filter((r) => r.rankIdx[0] <= mine + 2 && r.rankIdx[1] >= mine - 1);
  return pick(pool.length ? pool : REGIONS);
}

function spawnWorldEvent(kind, regionId, opts = {}) {
  const def = WORLD_EVENT_TYPES[kind];
  if (!def) return null;
  if (!Array.isArray(state.worldEvents)) state.worldEvents = [];
  const region = regionById(regionId || pickEventRegion().id);
  const hours = randInt(def.duration[0], def.duration[1]);
  const ev = {
    id: uid(), kind, regionId: region.id,
    title: opts.title || def.name, desc: def.desc,
    startedAt: Date.now(), endsAt: Date.now() + hours * 3600 * 1000,
    data: {}, resolved: false,
  };
  populateEvent(ev, region);
  state.worldEvents.push(ev);
  addLog(`${def.icon} ${def.name} begins in ${region.name}!`, "gold");
  return ev;
}

function populateEvent(ev, region) {
  switch (ev.kind) {
    case "bandit_invasion":
      addThreat(region.id, 30);
      break;
    case "sect_war": {
      const pool = SECTS.filter((s) => s.region !== region.id);
      const a = pool.length ? pick(pool) : pick(SECTS);
      const b = pick(SECTS.filter((s) => s.id !== a.id));
      ev.data.sides = [{ id: a.id, name: a.name }, { id: b.id, name: b.name }];
      break;
    }
    case "traveling_merchant":
      ev.data.wares = pickN(EVENT_MERCHANT_WARES, 3).map((w) => ({ ...w }));
      ev.data.sold = [];
      break;
    case "mysterious_stranger":
      ev.data.stranger = pick(EVENT_STRANGERS);
      break;
    case "rare_beast":
      ev.data.beast = pick(RARE_BEASTS);
      break;
    case "contested_treasure":
      ev.data.treasure = pick(CONTESTED_TREASURES);
      ev.data.guardian = false;
      break;
    case "world_boss":
      ev.data.boss = pick(WORLD_BOSSES);
      break;
  }
}

function pickN(arr, n) {
  const copy = arr.slice();
  const out = [];
  while (copy.length && out.length < n) out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
  return out;
}

function endWorldEvent(ev, reason) {
  if (ev) { ev.resolved = true; ev.reason = reason || "resolved"; }
}

/* ============================== HUNT TARGETS ============================== */

/* If a huntable event (beast / world boss) is active in the current region,
   return a spawn spec so `hunt()` can offer the fight. */
function worldEventHuntTarget() {
  const here = worldEventsIn(state.region);
  const beastEv = here.find((e) => e.kind === "rare_beast" && !e.data._engaged);
  if (beastEv) {
    const b = beastEv.data.beast;
    beastEv.data._engaged = true;
    return { name: b.name, typeId: b.typeId, rankIdx: clamp(playerCombatRankIdx(), 0, ENEMY_RANKS.length - 1), personality: b.personality, hpMul: b.hpMul, atkMul: b.atkMul, xpMul: b.xpMul, questId: null, worldEventId: beastEv.id };
  }
  const bossEv = here.find((e) => e.kind === "world_boss" && !e.data._engaged);
  if (bossEv) {
    const b = bossEv.data.boss;
    bossEv.data._engaged = true;
    return { name: b.name, typeId: "sect_member", rankIdx: ENEMY_RANKS.length - 1, personality: b.personality, hpMul: b.hpMul, atkMul: b.atkMul, boss: true, bossFlee: null, worldEventId: bossEv.id };
  }
  return null;
}

function onWorldEventEnemyDefeated(enemy) {
  const ev = worldEventById(enemy.worldEventId);
  if (!ev) return;
  grantEventReward(ev);
  endWorldEvent(ev, "defeated");
}

function grantEventReward(ev) {
  const reward =
    ev.kind === "rare_beast" ? ev.data.beast.reward :
    ev.kind === "world_boss" ? ev.data.boss.reward :
    ev.kind === "contested_treasure" ? ev.data.treasure.reward : null;
  if (reward) applyEventReward(reward);
  if (ev.kind === "rare_beast" && typeof grantTitle === "function") grantTitle("beast_slayer");
  if (ev.kind === "world_boss") {
    if (typeof grantTitle === "function") grantTitle(ev.data.boss.titleId);
    addLog(`A world boss has fallen to your hand — bards will sing of it.`, "gold");
  }
}

function applyEventReward(r) {
  if (r.silver) state.silver += r.silver;
  if (r.qi) state.qi += r.qi;
  if (r.xp) gainXp(r.xp);
  if (r.renown || r.alignment) adjustReputation({ renown: r.renown || 0, alignment: r.alignment || 0 });
  if (r.pills) state.pills += r.pills;
  if (r.manual && !state.manuals.includes(r.manual)) state.manuals.push(r.manual);
  if (r.materials) for (const [m, c] of Object.entries(r.materials)) addMaterial(m, c);
}

/* ============================== INTERACTIONS ============================== */

function buyEventWare(evId, wareId) {
  const ev = worldEventById(evId);
  if (!ev || ev.kind !== "traveling_merchant") return;
  const ware = (ev.data.wares || []).find((w) => w.id === wareId);
  if (!ware) return;
  if ((ev.data.sold || []).includes(wareId)) { addLog("That ware is already sold.", "bad"); render(); return; }
  if (state.silver < ware.cost) { addLog(`You need ${ware.cost} silver for ${ware.name}.`, "bad"); render(); return; }
  state.silver -= ware.cost;
  ev.data.sold.push(wareId);
  if (ware.kind === "material") addMaterial(ware.ref, ware.amount || 1);
  else if (ware.kind === "pill") state.pills += ware.amount || 1;
  else if (ware.kind === "manual" && !state.manuals.includes(ware.ref)) state.manuals.push(ware.ref);
  addLog(`You buy ${ware.name} from the traveling merchant.`, "good");
  save(); render();
}

function meetStranger(evId) {
  const ev = worldEventById(evId);
  if (!ev || ev.kind !== "mysterious_stranger") return;
  const s = ev.data.stranger;
  openEvent(s.name, `${s.name} — ${s.flavor} They gesture you closer. What do you do?`,
    [
      { label: "Hear them out", action: () => strangerChoice(evId, "help") },
      { label: "Buy their information (50 silver)", action: () => strangerChoice(evId, "buy") },
      { label: "Walk away", action: () => closeEvent() },
    ]);
}

function strangerChoice(evId, choice) {
  closeEvent();
  const ev = worldEventById(evId);
  if (!ev) return;
  const s = ev.data.stranger;
  if (choice === "buy") {
    if (state.silver < 50) { addLog("You cannot afford the information.", "bad"); render(); return; }
    state.silver -= 50;
    state.insight += 1;
    addLog(`${s.name} shares a fragment of insight. (+1 Insight)`, "good");
    endWorldEvent(ev, "consulted");
  } else if (choice === "help") {
    if (Math.random() < 0.6) {
      const r = { silver: 120 + playerCombatRankIdx() * 40, renown: 12 };
      if (Math.random() < 0.3) r.manual = "m_thunder";
      applyEventReward(r);
      adjustReputation({ alignment: 4 });
      addLog(`${s.name} rewards your aid handsomely.`, "gold");
      endWorldEvent(ev, "aided");
    } else {
      addLog(`${s.name}'s request was a trap!`, "bad");
      spawnEnemyInRegion(currentRegion(), { name: `${s.name}'s Blade`, typeId: "assassin", questId: null });
    }
  }
  save(); render();
}

function claimContestedTreasure(evId) {
  const ev = worldEventById(evId);
  if (!ev || ev.kind !== "contested_treasure" || state.enemy) return;
  if (Math.random() < 0.55) {
    ev.data.guardian = true;
    addLog(`A guardian stirs as you reach for ${ev.data.treasure.name}!`, "bad");
    spawnEnemyInRegion(currentRegion(), { name: `Guardian of ${ev.data.treasure.name}`, hpMul: 1.4, atkMul: 1.15, worldEventId: ev.id });
  } else {
    applyEventReward(ev.data.treasure.reward);
    addLog(`You claim ${ev.data.treasure.name}.`, "gold");
    endWorldEvent(ev, "claimed");
    save(); render();
  }
}

function supportSectSide(evId, factionId) {
  const ev = worldEventById(evId);
  if (!ev || ev.kind !== "sect_war") return;
  const sides = ev.data.sides || [];
  if (!sides.some((s) => s.id === factionId)) return;
  const other = sides.find((s) => s.id !== factionId);
  adjustStanding(factionId, 10);
  if (other) adjustStanding(other.id, -10);
  adjustReputation({ renown: 10 + playerCombatRankIdx() * 2, alignment: 0 });
  addLog(`You throw your lot in with the ${eventLabel(factionId)} in the sect war.`, "good");
  endWorldEvent(ev, "sided");
  save(); render();
}

/* ============================== BANDIT INVASION ============================== */

/* Killing raiders can break an invasion once the region's unrest falls. */
function tryEndInvasion() {
  const here = worldEventsIn(state.region);
  for (const ev of here) {
    if (ev.kind !== "bandit_invasion") continue;
    if (threatOf(ev.regionId) <= 30) {
      applyEventReward({ silver: 150 + playerCombatRankIdx() * 40, renown: 14 });
      addLog(`You break the bandit invasion of ${regionById(ev.regionId).name}!`, "gold");
      endWorldEvent(ev, "broken");
    }
  }
}
