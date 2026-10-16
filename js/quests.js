"use strict";

/* =====================================================================
   quests.js — six quest categories, difficulty ladder, objectives,
   turn-in, hardcore failure, reputation/faction consequences, and the
   starter main-story chain.
   ===================================================================== */

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/* quest givers map to bond-tracked figures */
const GIVER_NPC = {
  "Village Elder": "elder_rong",
  "Herbalist": "herbalist_yun",
  "Caravan Master": "caravan_lao",
  "Meditation Master": "meditation_wu",
};
function creditGiver(q, action) {
  if (typeof changeBond !== "function") return;
  const id = GIVER_NPC[q.giver];
  if (!id) return;
  if (typeof meetNpc === "function") meetNpc(id);
  changeBond(id, action);
}

/* ============================== MAIN STORY ============================== */

const MAIN_QUESTS = [
  {
    key: "willow_q1", region: "willow_creek", difficulty: "E", category: "main",
    title: "Trouble at Willow Creek", giver: "Village Elder", requires: [],
    desc: "Travelers vanish along the northern road. The elder asks you to look into it.",
    objectives: [
      { type: "travel", region: "northern_road", desc: "Travel to the Northern Road" },
      { type: "kill", typeId: "bandit", region: "northern_road", count: 2, desc: "Drive off the bandits (2)" },
    ],
    rewards: { silver: 24, qi: 50, xp: 40, renown: 6, alignment: 5 },
    flagsOnDone: { willow_q1_done: true }, next: "willow_q2",
  },
  {
    key: "willow_q2", region: "willow_creek", difficulty: "D", category: "main",
    title: "The Northern Outpost", giver: "Village Elder", requires: ["willow_q1_done"],
    desc: "Evidence points to a bandit outpost hidden in Blackwood Forest.",
    objectives: [
      { type: "kill", typeId: "bandit", region: "blackwood_forest", count: 3, desc: "Clear the outpost guards (3)" },
      { type: "collect", material: "stolen_goods", count: 1, desc: "Recover stolen goods (1)" },
    ],
    rewards: { silver: 45, qi: 110, xp: 90, renown: 10, alignment: 6 },
    flagsOnDone: { willow_q2_done: true }, next: "willow_q3",
  },
  {
    key: "willow_q3", region: "willow_creek", difficulty: "C", category: "main",
    title: "The Black Fang", giver: "Village Elder", requires: ["willow_q2_done"],
    desc: "Black Fang, the outpost chief, must be stopped. He may try to run.",
    objectives: [
      { type: "defeat_boss", bossKey: "black_fang", desc: "Defeat Black Fang" },
    ],
    capture: true,
    rewards: { silver: 90, qi: 220, xp: 160, renown: 20, alignment: 8, manual: "m_iron" },
    flagsOnDone: { willow_q3_done: true }, onFailFlag: "black_fang_escaped", next: null,
  },
];

function mainQuestByKey(key) { return MAIN_QUESTS.find((q) => q.key === key); }

function nextMainQuest() {
  for (const t of MAIN_QUESTS) {
    if (!t.requires.every((f) => state.flags[f])) continue;
    const doneFlag = Object.keys(t.flagsOnDone || {})[0];
    if (doneFlag && state.flags[doneFlag]) continue;
    if (state.activeQuest && state.activeQuest.key === t.key) return null;
    if (state._mainOffer && state._mainOffer.key === t.key) return state._mainOffer;
    state._mainOffer = instantiateMain(t);
    return state._mainOffer;
  }
  return null;
}

function instantiateMain(t) {
  return {
    id: uid(), key: t.key, category: "main", regionId: t.region, difficulty: t.difficulty,
    title: t.title, giver: t.giver, desc: t.desc, capture: !!t.capture,
    objectives: t.objectives.map((o) => ({ ...o, done: false, progress: 0 })),
    rewards: { ...t.rewards }, status: "offered", deadline: null,
    flagsOnDone: t.flagsOnDone, onFailFlag: t.onFailFlag, next: t.next,
    requires: t.requires,
  };
}

/* ============================== BOARD ============================== */

const BOARD_REFRESH_MS = 6 * 3600 * 1000;

function regionDifficulty(region) {
  const base = Math.round((region.rankIdx[0] + region.rankIdx[1]) / 2);
  const idx = clamp(base + (Math.random() < 0.3 ? 1 : 0), 0, DIFFICULTY_ORDER.length - 1);
  return DIFFICULTY_ORDER[idx];
}

function rewardFor(difficulty, extra = {}) {
  const d = DIFFICULTIES[difficulty];
  return {
    silver: randInt(d.silver[0], d.silver[1]),
    qi: Math.round(d.qi * (0.9 + Math.random() * 0.3)),
    xp: Math.round(d.xp * (0.9 + Math.random() * 0.3)),
    renown: d.rep,
    alignment: 0,
    ...extra,
  };
}

const randInt = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));

function ensureBoard(region) {
  const last = state.questBoardDay[region.id] || 0;
  const stale = Date.now() - last > BOARD_REFRESH_MS;
  if (!stale && state.questBoard[region.id] && state.questBoard[region.id].length) return;
  state.questBoard[region.id] = generateBoard(region);
  state.questBoardDay[region.id] = Date.now();
}

function generateBoard(region) {
  const quests = [];
  const count = 3 + Math.floor(Math.random() * 2);
  const makers = [makeBounty, makeCollection, makeEscort, makeCultivation, makeFaction];
  const used = new Set();
  for (let i = 0; i < count; i++) {
    const maker = pick(makers);
    const q = maker(region);
    if (q && !used.has(q.title)) { used.add(q.title); quests.push(q); }
  }
  /* a path-gated deed, posted only to those who walk that road */
  if (typeof pathQuestBoard === "function") {
    const pq = pathQuestBoard(region);
    if (pq && !used.has(pq.title)) { used.add(pq.title); quests.push(pq); }
  }
  return quests;
}

/* ---- Bounty ---- */
const BANDIT_NAMES = ["Scar", "One-Eye", "Rat", "Crow", "Cutter", "Grim", "Vulture", "Hook", "Snake", "Rusty"];
const BANDIT_TITLES = ["the Butcher", "the Swift", "the Silent", "the Wolf", "the Fang", "the Red", "the Shadow", "the Knife"];

function makeBounty(region) {
  const difficulty = regionDifficulty(region);
  const rank = clamp((region.rankIdx[0] + region.rankIdx[1]) >> 1, 0, 7);
  const target = pick(BANDIT_NAMES) + " " + pick(BANDIT_TITLES);
  const typeId = region.enemyTypes.includes("bandit") ? "bandit" : randomEnemyType(region);
  const hours = 48 - DIFFICULTY_ORDER.indexOf(difficulty) * 4;
  return {
    id: uid(), key: null, category: "bounty", regionId: region.id, difficulty,
    title: `Wanted: ${target}`, giver: "Bounty Office",
    desc: `A wanted ${ENEMY_TYPES[typeId].name.toLowerCase()} known as ${target} has been seen near ${region.name}. Bring them in — alive or dead.`,
    capture: true,
    objectives: [{ type: "defeat_target", desc: `Track down and defeat ${target}`, done: false, progress: 0 }],
    targetSpec: { name: target, typeId, rankIdx: rank, boss: rank >= 4, personality: "ruthless" },
    rewards: rewardFor(difficulty, { renown: DIFFICULTIES[difficulty].rep + 3, alignment: 4 }),
    deadline: Date.now() + hours * 3600 * 1000,
    status: "offered", failFlag: "bounty_relocated",
  };
}

/* ---- Collection ---- */
function makeCollection(region) {
  const difficulty = regionDifficulty(region);
  const materialId = pick(region.materials);
  const tier = DIFFICULTY_ORDER.indexOf(difficulty);
  const count = 3 + tier + randInt(0, 2);
  return {
    id: uid(), key: null, category: "collection", regionId: region.id, difficulty,
    title: `Gather ${count}× ${MATERIALS[materialId].name}`, giver: "Herbalist",
    desc: `The apothecary needs ${count} ${MATERIALS[materialId].name} from ${region.name}.`,
    objectives: [{ type: "collect", material: materialId, count, desc: `Collect ${count}× ${MATERIALS[materialId].name}`, done: false, progress: 0 }],
    rewards: rewardFor(difficulty, { materials: { [materialId]: Math.ceil(count / 2) } }),
    deadline: null, status: "offered",
  };
}

/* ---- Escort ---- */
const NPC_NAMES = ["Merchant Lao", "Healer Yun", "Scholar Bai", "Widow Chen", "Pilgrim Wei", "Courier Tan"];

function makeEscort(region) {
  const difficulty = regionDifficulty(region);
  const tier = DIFFICULTY_ORDER.indexOf(difficulty);
  const name = pick(NPC_NAMES);
  const waves = 1 + Math.min(3, tier);
  const npcHp = 120 + tier * 90;
  return {
    id: uid(), key: null, category: "escort", regionId: region.id, difficulty,
    title: `Escort ${name}`, giver: "Caravan Master",
    desc: `See ${name} safely through ${region.name}. Expect ambushes — they cannot defend themselves.`,
    objectives: [{ type: "escort", desc: `Protect ${name} through ${waves} ambush(es)`, done: false, progress: 0, waves }],
    escort: { name, hp: npcHp, maxHp: npcHp, waves },
    rewards: rewardFor(difficulty, { alignment: 5, standing: { merchant_guild: 3 } }),
    deadline: null, status: "offered",
  };
}

/* ---- Cultivation ---- */
function makeCultivation(region) {
  const difficulty = regionDifficulty(region);
  const qiTarget = DIFFICULTIES[difficulty].qi * 2;
  return {
    id: uid(), key: null, category: "cultivation", regionId: region.id, difficulty,
    title: "Deepen Your Cultivation", giver: "Meditation Master",
    desc: `The master bids you accumulate ${qiTarget.toLocaleString()} qi in reserve and hold it steady.`,
    objectives: [{ type: "hold_qi", target: qiTarget, desc: `Hold ${qiTarget.toLocaleString()} qi`, done: false, progress: 0 }],
    rewards: rewardFor(difficulty, { pills: 1 }),
    deadline: null, status: "offered",
  };
}

/* ---- Faction ---- */
function makeFaction(region) {
  const faction = region.faction;
  if (!faction || faction === "civilians") return null;
  if (standingLevel(faction).cls === "worst") return null;
  const difficulty = regionDifficulty(region);
  const rival = region.enemyTypes.find((t) => t === "sect_member") || randomEnemyType(region);
  const tier = DIFFICULTY_ORDER.indexOf(difficulty);
  const count = 2 + tier;
  return {
    id: uid(), key: null, category: "faction", regionId: region.id, difficulty,
    title: `${FACTIONS[faction].name}: Duty`,
    giver: FACTIONS[faction].name,
    desc: `Prove yourself to the ${FACTIONS[faction].name} by dealing with ${count} hostile ${ENEMY_TYPES[rival].name.toLowerCase()}s.`,
    objectives: [{ type: "kill", typeId: rival, region: region.id, count, desc: `Defeat ${count} ${ENEMY_TYPES[rival].name.toLowerCase()}s here`, done: false, progress: 0 }],
    rewards: rewardFor(difficulty, { standing: { [faction]: 8 } }),
    deadline: null, status: "offered", faction,
  };
}

/* ============================== LIFECYCLE ============================== */

function findQuest(qid) {
  if (state.activeQuest && state.activeQuest.id === qid) return state.activeQuest;
  if (state._mainOffer && state._mainOffer.id === qid) return state._mainOffer;
  for (const list of Object.values(state.questBoard)) {
    const q = list.find((x) => x.id === qid);
    if (q) return q;
  }
  return null;
}

function acceptQuest(qid) {
  if (state.activeQuest) { addLog("Finish or abandon your current quest first.", "bad"); render(); return; }
  const q = findQuest(qid);
  if (!q) return;

  q.status = "active";
  state.activeQuest = q;
  for (const list of Object.values(state.questBoard)) {
    const i = list.findIndex((x) => x.id === qid);
    if (i >= 0) list.splice(i, 1);
  }
  addLog(`Quest accepted: ${q.title} (${q.difficulty} — ${DIFFICULTIES[q.difficulty].name}).`, "gold");

  if (q.escort) startEscort(q.id, q.escort.name, q.escort.hp, q.escort.waves);
  syncObjectives();
  save(); render();
}

function abandonQuest() {
  const q = state.activeQuest;
  if (!q) return;
  if (!confirm(`Abandon "${q.title}"? Any progress is lost.`)) return;
  state.activeQuest = null;
  state.escort = null;
  addLog(`You abandon the quest: ${q.title}.`, "bad");
  creditGiver(q, "abandoned");
  if (q.category === "faction" && q.faction) {
    adjustStanding(q.faction, -4);
    addLog(`The ${FACTIONS[q.faction].name} notes your failure.`, "bad");
  }
  save(); render();
}

function turnInQuest() {
  const q = state.activeQuest;
  if (!q) return;
  syncObjectives();
  if (!allObjectivesDone(q)) { addLog("Not all objectives are complete.", "bad"); render(); return; }
  if (q.regionId !== state.region) { addLog(`Return to ${regionById(q.regionId).name} to report.`, "bad"); render(); return; }
  completeQuest(q);
}

function completeQuest(q) {
  const r = q.rewards || {};
  if (r.silver) state.silver += r.silver;
  if (r.qi) state.qi += r.qi;
  if (r.xp) gainXp(r.xp);
  if (r.pills) state.pills += r.pills;
  if (r.manual) state.manuals.push(r.manual);
  if (r.materials) for (const [m, c] of Object.entries(r.materials)) addMaterial(m, c);
  if (r.standing) for (const [f, v] of Object.entries(r.standing)) adjustStanding(f, v);
  adjustReputation({ renown: r.renown || 0, alignment: r.alignment || 0 });
  if (typeof onQuestCompleted === "function") onQuestCompleted(q);

  for (const [f, v] of Object.entries(q.flagsOnDone || {})) state.flags[f] = v;

  if (q.category === "main") grantSpins(3, "main questline");
  else if (q.category === "bounty" && DIFFICULTY_ORDER.indexOf(q.difficulty) >= DIFFICULTY_ORDER.indexOf("B")) {
    grantSpins(1, "difficult bounty");
  }

  q.status = "completed";
  if (state._mainOffer && state._mainOffer.key === q.key) state._mainOffer = null;
  state.activeQuest = null;
  state.escort = null;
  state.questLog.unshift({ title: q.title, difficulty: q.difficulty, result: "completed", when: Date.now() });
  creditGiver(q, q.category === "escort" ? "kept_promise" : "quest_helped");
  addLog(`Quest complete: ${q.title}! (+${r.silver || 0} silver, +${r.renown || 0} renown)`, "gold");
  save(); render();
}

function failQuest(q, reason) {
  if (!q) return;
  q.status = "failed";
  if (state._mainOffer && state._mainOffer.key === q.key) state._mainOffer = null;
  if (state.activeQuest && state.activeQuest.id === q.id) state.activeQuest = null;
  state.escort = null;
  if (q.onFailFlag) state.flags[q.onFailFlag] = true;
  if (q.category === "faction" && q.faction) adjustStanding(q.faction, -6);
  state.questLog.unshift({ title: q.title, difficulty: q.difficulty, result: "failed", when: Date.now(), reason });
  creditGiver(q, "abandoned");
  addLog(`Quest failed: ${q.title}. ${reason || ""}`, "bad");
  save(); render();
}

/* ============================== OBJECTIVES ============================== */

function allObjectivesDone(q) { return q.objectives.every((o) => o.done); }

function syncObjectives() {
  const q = state.activeQuest;
  if (!q) return;
  for (const o of q.objectives) {
    if (o.done) continue;
    if (o.type === "collect") {
      o.progress = Math.min(o.count, materialCount(o.material));
      if (o.progress >= o.count) o.done = true;
    } else if (o.type === "hold_qi") {
      o.progress = Math.floor(state.qi);
      if (state.qi >= o.target) o.done = true;
    } else if (o.type === "reach") {
      if (globalIndex() >= o.target) o.done = true;
    } else if (o.type === "travel") {
      if (state.region === o.region) o.done = true;
    }
  }
}

function questEvent(type, data = {}) {
  if (typeof sectEvent === "function") sectEvent(type, data);
  const q = state.activeQuest;
  if (!q) return;

  switch (type) {
    case "kill": {
      for (const o of q.objectives) {
        if (o.done) continue;
        if (o.type === "kill" && o.typeId === data.typeId) {
          if (o.region && o.region !== state.region) continue;
          o.progress += 1;
          if (o.progress >= o.count) o.done = true;
        }
        if (o.type === "defeat_target" && data.questId === q.id) {
          handleTargetDefeated(q, data);
        }
        if (o.type === "defeat_boss" && q.key) {
          const bossKey = q.objectives.find((x) => x.type === "defeat_boss");
          if (bossKey && data.name && NAMED_BOSSES[bossKey.bossKey] && data.name === NAMED_BOSSES[bossKey.bossKey].name) {
            handleTargetDefeated(q, data);
          }
        }
      }
      break;
    }
    case "target_fled": {
      if (data.questId === q.id) {
        failQuest(q, `${data.name} escaped into the wilds. They may return...`);
      }
      break;
    }
    case "travel": syncObjectives(); break;
    case "gather": syncObjectives(); break;
    case "stage": syncObjectives(); break;
    case "escort_complete": {
      for (const o of q.objectives) if (o.type === "escort") { o.done = true; o.progress = o.waves; }
      break;
    }
    case "escort_failed": {
      if (data.questId === q.id) failQuest(q, data.reason || "Your charge was lost.");
      return;
    }
    case "player_defeated": {
      /* consolation: hold_qi retains progress, others unaffected */
      syncObjectives();
      break;
    }
  }
  save();
}

function handleTargetDefeated(q, data) {
  const obj = q.objectives.find((o) => o.type === "defeat_target" || o.type === "defeat_boss");
  if (!obj || obj.done) return;
  if (q.capture) {
    offerBountyChoice(q, data.name);
  } else {
    obj.done = true; obj.progress = 1;
  }
}

function offerBountyChoice(q, targetName) {
  openEvent(
    "A Choice",
    `${targetName} is beaten and helpless before you. Their fate — and your reward — is now your decision.`,
    [
      { label: "Kill them", action: () => resolveBounty(q, "kill") },
      { label: "Capture them alive", action: () => resolveBounty(q, "capture") },
    ]
  );
}

function resolveBounty(q, choice) {
  closeEvent();
  const obj = q.objectives.find((o) => o.type === "defeat_target" || o.type === "defeat_boss");
  if (obj) { obj.done = true; obj.progress = 1; }
  if (choice === "capture") {
    q.rewards.silver = (q.rewards.silver || 0) + 60;
    q.rewards.alignment = (q.rewards.alignment || 0) + 5;
    addLog("You bind the criminal and haul them to the authorities. A greater reward awaits.", "good");
  } else {
    q.rewards.renown = (q.rewards.renown || 0) + 8;
    q.rewards.alignment = (q.rewards.alignment || 0) - 4;
    addLog("You end their life. Some doors open; others close.", "");
  }
  addLog(`${q.title}: objective fulfilled. Return to turn it in.`, "gold");
  save(); render();
}

/* ============================== HARD-CORE FAILURE ============================== */

function checkDeadlines() {
  const q = state.activeQuest;
  if (!q || !q.deadline) return;
  if (Date.now() > q.deadline) {
    const earlier = q;
    state.activeQuest = null;
    addLog(`Time ran out on "${earlier.title}". The target may have moved on.`, "bad");
    failQuest(earlier, "The window closed.");
  }
}

/* ============================== QUEST TARGET SPAWN ============================== */

/* Called by hunt(): if an active quest awaits a target, spawn it. */
function questTargetSpawn() {
  const q = state.activeQuest;
  if (!q || q._targetSpawned) return null;

  if (q.targetSpec) {
    q._targetSpawned = true;
    return { ...q.targetSpec, questId: q.id, bossFlee: 0.25 };
  }

  const bossObj = q.objectives.find((o) => o.type === "defeat_boss" && o.bossKey);
  if (bossObj) {
    const b = NAMED_BOSSES[bossObj.bossKey];
    const rankIdx = Math.max(0, ENEMY_RANKS.findIndex((r) => r.id === b.rankPreferred));
    q._targetSpawned = true;
    return {
      name: b.name, typeId: b.type, rankIdx, personality: b.personality,
      boss: true, questId: q.id, bossFlee: 0.25, hpMul: 1.6, atkMul: 1.15, xpMul: 2,
    };
  }
  return null;
}
