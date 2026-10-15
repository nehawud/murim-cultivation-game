"use strict";

/* =====================================================================
   combat.js — enemy generation (region-anchored), personality-driven AI,
   poison, reinforcement, escort NPCs, and the combat loop.
   ===================================================================== */

/* ============================== GENERATION ============================== */

function pickRankForRegion(region) {
  const [lo, hi] = region.rankIdx;
  let rank = lo + Math.floor(Math.random() * (hi - lo + 1));
  const threat = threatOf(region.id);
  if (threat >= 60 && rank < ENEMY_RANKS.length - 1) rank += 1;
  if (threat >= 100 && rank < ENEMY_RANKS.length - 1) rank += 1;
  return rank;
}

function buildEnemy(region, rankIdx, typeId, personalityId, opts = {}) {
  const base = ENEMY_RANKS[rankIdx];
  const type = ENEMY_TYPES[typeId];
  const per = PERSONALITIES[personalityId];
  const boss = !!opts.boss;

  const hpMul = type.hpMul * (opts.hpMul || 1) * (boss ? 1.0 : 1.0);
  const hp = Math.round(base.hp * hpMul);
  return {
    name: opts.name || type.name,
    typeId, rankIdx, boss,
    rankName: base.name,
    personality: personalityId,
    personalityName: per.name,
    personalityDesc: per.desc,
    hp, maxHp: hp,
    atk: Math.round(base.atk * type.atkMul * (per.atkMul || 1) * (opts.atkMul || 1)),
    qi: Math.round(base.qi * (opts.qiMul || 1)),
    xp: Math.round(base.xp * (opts.xpMul || 1)),
    drops: type.drops.slice(),
    manuals: type.manuals.slice(),
    questId: opts.questId || null,
    fleeHp: opts.bossFlee != null ? opts.bossFlee : null,
    enraged: false,
    calledHelp: false,
  };
}

function randomPersonality(type) {
  return type.behaviors[Math.floor(Math.random() * type.behaviors.length)];
}

function randomEnemyType(region) {
  return region.enemyTypes[Math.floor(Math.random() * region.enemyTypes.length)];
}

/* Spawn a normal enemy in a region (hostile attention). */
function spawnEnemyInRegion(region, opts = {}) {
  const typeId = opts.typeId || randomEnemyType(region);
  const rank = opts.rankIdx != null ? opts.rankIdx : pickRankForRegion(region);
  const per = opts.personality || randomPersonality(ENEMY_TYPES[typeId]);
  state.enemy = buildEnemy(region, rank, typeId, per, opts);
  state.combatLog = [];
  addCombatLog(`A ${state.enemy.name} (${state.enemy.rankName}) blocks your path!`, "bad");
  afterEnemySpawn();
  return state.enemy.name;
}

function spawnBountyHunter() {
  const region = currentRegion();
  const type = ENEMY_TYPES.assassin;
  const rank = Math.max(0, playerCombatRankIdx());
  const per = Math.random() < 0.5 ? "cunning" : "ruthless";
  state.enemy = buildEnemy(region, rank, "assassin", per, { name: "Bounty Hunter" });
  state.combatLog = [];
  addCombatLog(`A Bounty Hunter (${state.enemy.rankName}) ambushes you!`, "bad");
  afterEnemySpawn();
}

/* Ambushers strike before you can act. */
function afterEnemySpawn() {
  const per = PERSONALITIES[state.enemy.personality];
  if (per.ambush) {
    addCombatLog(`The ${state.enemy.name} strikes from the shadows — an ambush!`, "bad");
    enemyTurn();
  }
}

const hunt = () => {
  if (state.enemy) return;
  const spec = questTargetSpawn();
  if (spec) spawnEnemyInRegion(currentRegion(), spec);
  else spawnEnemyInRegion(currentRegion());
  save(); render();
};

/* ============================== PLAYER TURN ============================== */

function playerAttack(techId) {
  if (!state.enemy) return;
  const tech = TECHNIQUES[techId];
  if (!tech || tech.passive) return;
  if (isUltimate(techId) && techCooldownLeft(techId) > 0) {
    addCombatLog(`${tech.name} is still recharging (${techCooldownLeft(techId)} more).`, "bad");
    render();
    return;
  }
  if (tech.qiCost > state.qi) { addCombatLog(`Not enough qi for ${tech.name}.`, "bad"); render(); return; }

  const s = stats();
  state.qi -= tech.qiCost;
  state.guarding = null;
  let dmg = techDamage(techId, s);
  let crit = false;
  if (Math.random() < s.crit) { dmg = Math.round(dmg * 2); crit = true; }

  const per = PERSONALITIES[state.enemy.personality];
  if (per.blockChance && Math.random() < per.blockChance) {
    dmg = Math.round(dmg * 0.5);
    addCombatLog(`The ${state.enemy.name} blocks — your strike is deflected.`, "");
  }

  state.enemy.hp = Math.max(0, state.enemy.hp - dmg);
  const band = masteryBandName(masteryOf(techId));
  addCombatLog(`You used ${tech.name} [${band}] for ${dmg} damage${crit ? " (CRITICAL!)" : ""}.`, "good");

  gainMastery(techId, isUltimate(techId) ? 2 : 1);
  putOnCooldown(techId);

  if (state.enemy.hp <= 0) { winCombat(); save(); render(); return; }
  enemyTurn();
  save(); render();
}

/* defensive/movement turn: blunt the next blow and possibly counter */
function playerGuard(techId) {
  if (!state.enemy) return;
  const id = techId || bestGuardTech();
  const tech = id ? TECHNIQUES[id] : null;
  const s = stats();
  if (tech && tech.qiCost > state.qi) { addCombatLog(`Not enough qi to raise ${tech.name}.`, "bad"); render(); return; }
  if (tech) {
    state.qi -= tech.qiCost;
    state.guarding = { id, reduction: guardReduction(id), counter: Math.max(0, masteryMult(id) - 0.5) };
    addCombatLog(`You raise ${tech.name} [${masteryBandName(masteryOf(id))}], bracing for the blow.`, "good");
    gainMastery(id, 1);
  } else {
    state.guarding = { id: null, reduction: 0.15, counter: 0 };
    addCombatLog("You brace yourself behind your arms.", "");
  }
  enemyTurn();
  save(); render();
}

/* ============================== ENEMY TURN ============================== */

function enemyTurn() {
  if (!state.enemy) return;
  const enemy = state.enemy;
  const per = PERSONALITIES[enemy.personality];
  const s = stats();

  if (typeof tickCooldowns === "function") tickCooldowns();

  /* poison on the player ticks each round */
  if (state.poison > 0) {
    const pdmg = Math.max(1, Math.round(s.maxHp * 0.04));
    state.hp = Math.max(0, state.hp - pdmg);
    state.poison -= 1;
    addCombatLog(`Poison burns through you for ${pdmg} damage.`, "bad");
    if (state.hp <= 0) { loseCombat(); return; }
  }

  let dmg = enemy.atk;
  if (enemy.enraged) dmg = Math.round(dmg * 1.5);
  if (per.lowHpBonus && state.hp < s.maxHp * 0.4) dmg = Math.round(dmg * per.lowHpBonus);

  /* protective call for help, once */
  if (per.reinforce && !enemy.calledHelp && enemy.hp < enemy.maxHp * 0.5) {
    enemy.calledHelp = true;
    enemy.enraged = true;
    addCombatLog(`The ${enemy.name} shouts for aid and fights harder!`, "bad");
  }

  /* escort: some enemies target the defenseless charge */
  if (state.escort && state.escort.hp > 0) {
    const targetsNpc = per.lowHpBonus ? true : Math.random() < 0.35;
    if (targetsNpc) {
      state.escort.hp = Math.max(0, state.escort.hp - dmg);
      addCombatLog(`The ${enemy.name} strikes ${state.escort.name} for ${dmg} damage!`, "bad");
      if (state.escort.hp <= 0) { failEscort("Your charge is slain."); return; }
      return;
    }
  }

  const b = computeBonuses();
  const dodgeChance = b.dodgePct + (typeof passiveTechBonus === "function" ? passiveTechBonus("dodge") : 0);
  if (dodgeChance > 0 && Math.random() < dodgeChance) {
    addCombatLog(`You slip aside — the ${enemy.name}'s attack misses!`, "good");
    return;
  }

  /* a raised guard blunts the blow and may counter */
  if (state.guarding) {
    const g = state.guarding;
    if (g.reduction > 0) {
      dmg = Math.round(dmg * (1 - g.reduction));
      addCombatLog(`Your guard blunts the strike (${Math.round(g.reduction * 100)}% reduced).`, "good");
    }
    if (g.counter > 0 && Math.random() < g.counter) {
      const cd = Math.round(dmg * 1.2 + s.attack * 0.5);
      enemy.hp = Math.max(0, enemy.hp - cd);
      addCombatLog(`You turn the force back — counter for ${cd} damage!`, "good");
      state.guarding = null;
      if (enemy.hp <= 0) { winCombat(); return; }
    } else {
      state.guarding = null;
    }
  }

  state.hp = Math.max(0, state.hp - dmg);
  addCombatLog(`The ${enemy.name} strikes you for ${dmg} damage.`, "bad");

  /* cunning poisons the player */
  if (per.poison && Math.random() < 0.4 && state.poison <= 0) {
    state.poison = 3;
    addCombatLog(`The ${enemy.name} poisons you! (☠ 3 turns)`, "bad");
  }

  if (state.hp <= 0) { loseCombat(); return; }

  /* cowardly (or a named boss) flees when badly hurt */
  const fleeAt = enemy.fleeHp != null ? enemy.fleeHp : per.fleeHp;
  if (fleeAt && enemy.hp < enemy.maxHp * fleeAt) {
    addCombatLog(`The ${enemy.name} loses their nerve and flees!`, "");
    const qid = enemy.questId;
    const nm = enemy.name;
    state.enemy = null;
    state.poison = 0;
    if (qid) questEvent("target_fled", { questId: qid, name: nm });
  }
}

/* ============================== RESOLUTION ============================== */

function rollItem(tier) {
  const slot = SLOTS[Math.floor(Math.random() * SLOTS.length)];
  const bases = EQUIP_BASES[slot];
  const maxBase = Math.min(bases.length, 1 + Math.floor(tier / 2));
  const base = bases[Math.floor(Math.random() * maxBase)];

  let rarity = 0;
  const roll = Math.random();
  if (roll < 0.02 + tier * 0.012) rarity = 4;
  else if (roll < 0.08 + tier * 0.025) rarity = 3;
  else if (roll < 0.22 + tier * 0.03) rarity = 2;
  else if (roll < 0.5) rarity = 1;

  const scale = RARITIES[rarity].mult * (1 + tier * 0.15);
  const statsOut = {};
  for (const [k, v] of Object.entries(base.stats)) statsOut[k] = roundStat(k, v * scale);
  return { id: uid(), slot, name: base.name, rarity, stats: statsOut };
}
function roundStat(key, value) {
  if (key === "crit" || key.endsWith("Pct")) return Math.round(value * 1000) / 1000;
  return Math.round(value);
}

function winCombat() {
  const enemy = state.enemy;
  if (!enemy) return;
  const b = computeBonuses();
  const rank = ENEMY_RANKS[enemy.rankIdx];

  const qiGain = Math.round(enemy.qi * (1 + b.qiKillPct));
  state.qi += qiGain;
  state.defeated += 1;
  state.totalKillsByType[enemy.typeId] = (state.totalKillsByType[enemy.typeId] || 0) + 1;

  /* first regional boss of a region awards clan spins */
  if (enemy.boss) {
    const flag = `boss_region_${state.region}`;
    if (!state.flags[flag]) {
      state.flags[flag] = true;
      grantSpins(2, "first regional boss");
    }
  }

  addCombatLog(`You have slain the ${enemy.name}!`, "gold");
  addLog(`You defeated the ${enemy.name} (${enemy.rankName}) and absorbed ${qiGain.toLocaleString()} qi.`, "gold");

  gainXp(enemy.xp);

  /* reputation by foe */
  applyKillReputation(enemy);

  /* coins / goods */
  if (Math.random() < 0.6) {
    const matId = enemy.drops[Math.floor(Math.random() * enemy.drops.length)];
    addMaterial(matId, 1);
  }
  if (Math.random() < 0.4) state.silver += 5 + enemy.rankIdx * 6;

  /* manuals */
  if (enemy.manuals.length && Math.random() < 0.40 + b.dropPct) {
    const manualId = enemy.manuals[Math.floor(Math.random() * enemy.manuals.length)];
    state.manuals.push(manualId);
    addLog(`The ${enemy.name} dropped a ${MANUALS[manualId].name}!`, "gold");
  }
  /* pills */
  if (Math.random() < 0.10 + b.gearPct) {
    state.pills += 1;
    addLog("A rare Breakthrough Pill was found among the spoils!", "gold");
  }
  /* gear */
  if (Math.random() < 0.38 + b.gearPct) {
    const item = rollItem(rank.threat);
    state.inventory.push(item);
    addLog(`You found equipment: ${item.name} (${RARITIES[item.rarity].name}).`, "gold");
  }

  if (enemy.boss) {
    adjustReputation({ renown: 40 + enemy.rankIdx * 10, alignment: 3 });
    addLog(`A tale is born — the ${enemy.name} has fallen to your hand!`, "gold");
  }

  /* a won battle cleanses a little corruption from the region */
  if (["bandit", "assassin", "rogue_cultivator"].includes(enemy.typeId)) {
    clearBanditPressure(2);
  }

  const questId = enemy.questId;
  const wasChallenge = !!enemy.sectChallenge;
  if (typeof onEnemyDefeated === "function") onEnemyDefeated(enemy);
  state.enemy = null;
  state.poison = 0;

  questEvent("kill", { enemy, questId, typeId: enemy.typeId, rankIdx: enemy.rankIdx, boss: enemy.boss, name: enemy.name });
  if (wasChallenge && typeof resolveSectChallenge === "function") resolveSectChallenge(true);

  if (state.escort) advanceEscort();
  save(); render();
}

function applyKillReputation(enemy) {
  const region = currentRegion();
  if (enemy.typeId === "bandit" || enemy.typeId === "assassin") {
    adjustReputation({ renown: 6 + enemy.rankIdx * 3, alignment: 2 });
    if (region.faction === "civilians") adjustStanding("merchant_guild", 2);
  } else if (enemy.typeId === "rogue_cultivator") {
    adjustReputation({ renown: 4 + enemy.rankIdx * 2 });
  } else if (enemy.typeId === "sect_member") {
    adjustReputation({ renown: 3 + enemy.rankIdx * 2 });
    const sect = region.faction;
    if (sect && FACTIONS[sect] && FACTIONS[sect].type === "clan") adjustStanding(sect, -5);
  }
}

function loseCombat() {
  const lost = Math.floor(state.qi * 0.1);
  state.qi = Math.max(0, state.qi - lost);
  state.hp = stats().maxHp;
  state.poison = 0;
  addLog(`You are gravely wounded and retreat, losing ${lost.toLocaleString()} qi.`, "bad");
  const hadEscort = !!state.escort;
  const enemy = state.enemy;
  const wasChallenge = !!(enemy && enemy.sectChallenge);
  if (enemy && typeof onPlayerDefeated === "function") onPlayerDefeated(enemy);
  state.enemy = null;
  if (wasChallenge && typeof resolveSectChallenge === "function") resolveSectChallenge(false);
  if (hadEscort) failEscort("You fell in battle; your charge was lost.");
  questEvent("player_defeated", {});
  save(); render();
}

function flee() {
  if (!state.enemy) return;
  const per = PERSONALITIES[state.enemy.personality];
  const chance = per.noFlee ? 0.35 : 0.5;
  if (Math.random() < chance) {
    addLog(`You slip away from the ${state.enemy.name}.`, "");
    const hadEscort = !!state.escort;
    state.enemy = null;
    state.poison = 0;
    if (hadEscort) failEscort("You abandoned your charge to flee.");
    save(); render();
    return;
  }
  addCombatLog("You failed to escape!", "bad");
  enemyTurn();
  save(); render();
}

/* ============================== ESCORT ============================== */

function startEscort(questId, name, maxHp, waves) {
  state.escort = { questId, name, hp: maxHp, maxHp, waves, wavesDone: 0 };
}

function advanceEscort() {
  const e = state.escort;
  if (!e) return;
  e.wavesDone += 1;
  if (e.wavesDone >= e.waves) {
    addLog(`${e.name} reaches safety, unharmed as far as it matters.`, "good");
    state.escort = null;
    questEvent("escort_complete", { questId: e.questId });
  } else {
    addLog(`The journey continues — ${e.waves - e.wavesDone} more ambush(es) expected.`, "");
    spawnEscortWave();
  }
}

function spawnEscortWave() {
  const region = currentRegion();
  const e = state.escort;
  const rank = Math.min(ENEMY_RANKS.length - 1, region.rankIdx[0] + Math.floor(Math.random() * (region.rankIdx[1] - region.rankIdx[0] + 1)));
  const typeId = randomEnemyType(region);
  const per = randomPersonality(ENEMY_TYPES[typeId]);
  state.enemy = buildEnemy(region, rank, typeId, per, { questId: e ? e.questId : null });
  state.combatLog = [];
  addCombatLog(`Ambush! A ${state.enemy.name} (${state.enemy.rankName}) attacks the caravan.`, "bad");
  afterEnemySpawn();
}

function failEscort(reason) {
  const e = state.escort;
  state.escort = null;
  state.enemy = null;
  state.poison = 0;
  addLog(reason, "bad");
  if (e) questEvent("escort_failed", { questId: e.questId, reason });
}
