"use strict";

/* =====================================================================
   world.js — regions, travel, factions/standing, reputation, exploration,
   material gathering, and the light world-threat simulation.
   ===================================================================== */

/* ============================== REGIONS ============================== */

function regionById(id) { return REGIONS.find((r) => r.id === id) || REGIONS[0]; }
function currentRegion() { return regionById(state.region); }

function regionDanger(region) {
  const [lo, hi] = region.rankIdx;
  const my = playerCombatRankIdx();
  if (my > hi + 1) return "trivial";
  if (my > hi) return "easy";
  if (my >= lo) return "fitting";
  if (my >= lo - 1) return "dangerous";
  return "deadly";
}

const DANGER_LABEL = { trivial: "Beneath You", easy: "Easy", fitting: "Suited to You", dangerous: "Dangerous", deadly: "Deadly" };

function regionAtWar(region) {
  return region.faction && (state.standing[region.faction] || 0) <= -50;
}

function travelTo(id) {
  const region = regionById(id);
  if (id === state.region) return;

  const myRank = playerCombatRankIdx();
  const [, hi] = region.rankIdx;
  if (myRank < hi - 2) {
    const ok = confirm(
      `⚠ WARNING\n\n${region.name} is ${DANGER_LABEL[regionDanger(region)].toLowerCase()} for a cultivator of your level.\n` +
      `The enemies here (up to ${ENEMY_RANKS[hi].name}) could kill you.\n\nTravel anyway?`
    );
    if (!ok) return;
  }

  if (regionAtWar(region)) {
    addLog(`You enter ${region.name}, where the ${FACTIONS[region.faction].name} considers you an enemy.`, "bad");
    adjustStanding(region.faction, -2);
  } else {
    addLog(`You travel to ${region.name}.`, "");
  }

  applyClanRivalry(region);

  state.region = id;
  state.enemy = null;
  state.escort = null;

  /* arriving where a known figure lives introduces you */
  if (typeof npcById === "function") {
    for (const n of NPCS) {
      if (n.region === id && n.known) {
        const st = state.npcs[n.id];
        if (!st || !st.met) meetNpc(n.id, `You call upon them in ${region.name}.`);
      }
    }
  }

  questEvent("travel", { regionId: id });

  /* criminal notoriety draws bounty hunters on the road */
  if (state.reputation.alignment <= -30 && Math.random() < 0.35) {
    addLog("A bounty hunter steps from the roadside, blade drawn!", "bad");
    spawnBountyHunter();
  }

  /* world reacts: enter a region whose threat festers */
  maybeRegionEvent(region);

  save();
  render();
}

/* ============================== REPUTATION ============================== */

function reputationTitle() {
  const a = state.reputation.alignment;
  if (a >= 80) return "Sainted Hero";
  if (a >= 50) return "Righteous Hero";
  if (a >= 20) return "Honorable";
  if (a > -20) return "Neutral";
  if (a > -50) return "Feared";
  if (a > -80) return "Sinister";
  return "Demon of the Dark Path";
}

function renownTitle() {
  const r = state.reputation.renown;
  if (r >= 2500) return "Mythic";
  if (r >= 1000) return "Legendary";
  if (r >= 400) return "Renowned";
  if (r >= 150) return "Famous";
  if (r >= 50) return "Known";
  return "Unknown";
}

function adjustReputation({ renown = 0, alignment = 0 }) {
  state.reputation.renown = Math.max(0, state.reputation.renown + renown);
  state.reputation.alignment = clamp(state.reputation.alignment + alignment, -100, 100);
}

function standingLevel(id) {
  const v = state.standing[id] || 0;
  if (v >= 80) return { label: "Allied", cls: "great" };
  if (v >= 50) return { label: "Honored", cls: "great" };
  if (v >= 20) return { label: "Friendly", cls: "good" };
  if (v > -20) return { label: "Neutral", cls: "" };
  if (v > -50) return { label: "Unfriendly", cls: "bad" };
  if (v > -80) return { label: "Hostile", cls: "bad" };
  return { label: "Hated", cls: "worst" };
}

function adjustStanding(id, delta) {
  if (!id || id === "civilians") return; // civilians tracked via alignment
  state.standing[id] = clamp((state.standing[id] || 0) + delta, -100, 100);
}

function factionName(id) { return id && FACTIONS[id] ? FACTIONS[id].name : "no one"; }

/* ============================== CLANS (bloodline) ============================== */

/* Clan rivalry: traveling into a region held by a rival faction sours relations. */
function applyClanRivalry(region) {
  if (!region.faction) return;
  if (!clanRivalsFaction(region.faction)) return;
  const bl = getBloodline();
  addLog(`The ${FACTIONS[region.faction].name} eyes the ${bl.name} bloodline with hostility.`, "bad");
  adjustStanding(region.faction, -3);
}

/* ============================== EXPLORATION ============================== */

function exploreRegion() {
  const region = currentRegion();

  /* an active escort or a criminal record may interrupt */
  if (state.enemy) return;

  const roll = Math.random();
  if (roll < 0.15) {
    if (Math.random() < 0.25 && discoverBloodline()) {
      /* inherited a lost bloodline — the ruin was a grave-vault */
    } else {
      const manualId = randomManualForRegion(region);
      if (manualId) {
        state.manuals.push(manualId);
        addLog(`Ruins! In a hollow you find a ${MANUALS[manualId].name}.`, "gold");
      } else {
        addMaterial("copper", 3);
        addLog("You find only scattered coins in the ruins.", "");
      }
    }
  } else if (roll < 0.35) {
    const mat = region.materials[Math.floor(Math.random() * region.materials.length)];
    const found = spawnEnemyInRegion(region);
    addLog(`You gather a ${MATERIALS[mat].name}... and disturb ${found}`, "bad");
    addMaterial(mat, 1);
  } else if (roll < 0.80) {
    const mat = region.materials[Math.floor(Math.random() * region.materials.length)];
    const qty = 1 + Math.floor(Math.random() * 2);
    addMaterial(mat, qty);
    gainXp(4 + state.realm);
    addLog(`You explore and gather ${qty}× ${MATERIALS[mat].name}.`, "good");
    /* a chance to recover a missing page of an incomplete manual you carry */
    if (Math.random() < 0.2) {
      const inc = state.manuals.find((id) => MANUALS[id].incomplete && (state.techFragments[id] || 0) < MANUALS[id].pages);
      if (inc) {
        const m = MANUALS[inc];
        state.techFragments[inc] = (state.techFragments[inc] || 0) + 1;
        const got = state.techFragments[inc];
        addLog(got >= m.pages ? `You recover the final missing page of the ${m.name}!` : `You recover a torn page of the ${m.name} (${got}/${m.pages}).`, got >= m.pages ? "gold" : "good");
      }
    }
  } else {
    /* an encounter on the road */
    addLog("Your wandering draws hostile attention.", "bad");
    spawnEnemyInRegion(region);
  }

  /* exploring lowers a little threat — you're culling the wilds */
  reduceThreat(region.id, 1);
  questEvent("gather", {});
  if (typeof sectEvent === "function") sectEvent("explore", {});
  save();
  render();
}

function randomManualForRegion(region) {
  const [lo, hi] = region.rankIdx;
  const pool = [];
  for (let i = lo; i <= hi; i++) {
    const rank = ENEMY_RANKS[i];
    const types = region.enemyTypes.map((t) => ENEMY_TYPES[t]);
    for (const type of types) for (const m of (type.manuals || [])) pool.push(m);
  }
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

/* ============================== THREAT ============================== */

function threatOf(regionId) { return state.worldThreat[regionId] || 0; }
function reduceThreat(regionId, amount) {
  state.worldThreat[regionId] = Math.max(0, threatOf(regionId) - amount);
}
function addThreat(regionId, amount) {
  state.worldThreat[regionId] = Math.min(100, threatOf(regionId) + amount);
}

/* A bandit-heavy region festers over time; high threat escalates its spawns. */
function worldTick() {
  for (const region of REGIONS) {
    const isLawless = region.enemyTypes.includes("bandit") || region.enemyTypes.includes("rogue_cultivator");
    if (!isLawless) continue;
    if (!["civilians", "merchant_guild"].includes(region.faction) && region.faction) continue;
    const growth = 1 + Math.floor(region.rankIdx[1] * 0.5);
    const before = threatOf(region.id);
    addThreat(region.id, 1);
    const after = threatOf(region.id);
    if (before < 60 && after >= 60) {
      addLog(`Rumors travel: bandits grow bold around ${region.name}. The roads grow dangerous.`, "bad");
    } else if (before < 100 && after >= 100) {
      addLog(`Crisis! ${region.name} is overrun by bandits. Merchants have stopped using its roads.`, "bad");
    }
  }
  if (typeof sectTick === "function") sectTick();
  if (typeof bondsTick === "function") bondsTick();
  if (typeof dungeonsTick === "function") dungeonsTick();
}

/* Fires when entering a region in unrest. */
function maybeRegionEvent(region) {
  const threat = threatOf(region.id);
  if (threat >= 80 && region.id === state.region) {
    addLog(`The unrest in ${region.name} is palpable — a raiding band is nearby.`, "bad");
  }
}

/* A cleared area calms: callers pass how much bandit pressure they removed. */
function clearBanditPressure(amount) {
  reduceThreat(state.region, amount);
}

/* ============================== MERCHANTS ============================== */

function merchantRefuses() {
  return (state.standing.merchant_guild || 0) <= -20;
}

function buyPill() {
  if (!currentRegion().hub) { addLog("Only cities have apothecaries selling pills.", "bad"); render(); return; }
  if (merchantRefuses()) { addLog("The apothecary refuses to serve a criminal.", "bad"); render(); return; }
  const price = 60;
  if (state.silver < price) { addLog(`You need ${price} silver for a Breakthrough Pill.`, "bad"); render(); return; }
  state.silver -= price;
  state.pills += 1;
  addLog(`You buy a Breakthrough Pill for ${price} silver.`, "good");
  save(); render();
}

function sellMaterials() {
  if (!currentRegion().hub) { addLog("Only cities have merchants buying goods.", "bad"); render(); return; }
  if (merchantRefuses()) { addLog("No merchant here will trade with you.", "bad"); render(); return; }
  let total = 0;
  let soldKinds = 0;
  for (const [id, count] of Object.entries(state.materials)) {
    if (count <= 0) continue;
    total += MATERIALS[id].value * count;
    soldKinds++;
    delete state.materials[id];
  }
  if (!total) { addLog("You have no goods to sell.", "bad"); render(); return; }
  state.silver += total;
  addLog(`You sell ${soldKinds} kind(s) of goods for ${total} silver.`, "good");
  save(); render();
}
