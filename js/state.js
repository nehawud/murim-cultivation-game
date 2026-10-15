"use strict";

/* =====================================================================
   state.js — the save state, derivation of stats, progression helpers,
   logging. Shared global `state` object used by all other modules.
   ===================================================================== */

const SAVE_KEY = "murim_cultivation_save_v3";
const OFFLINE_CAP_HOURS = 8;
const OFFLINE_EFFICIENCY = 0.5;

const startRegion = () => REGIONS[0].id;

function defaultState() {
  return {
    version: 3,
    createdAt: Date.now(),
    lastSeen: Date.now(),

    /* progression */
    level: 1,
    xp: 0,
    skillPoints: 0,
    realm: 0,
    stage: 1,
    qi: 0,
    hp: 100,
    pills: 0,
    insight: 0,
    silver: 0,

    /* martial */
    techniques: ["basic"],
    mastery: { basic: 1 },
    cooldowns: {},
    qiDeviation: 0,
    techFragments: {},
    manuals: [],
    skills: {},
    equipment: { weapon: null, armor: null, charm: null },
    inventory: [],

    /* world */
    region: startRegion(),
    materials: {},
    reputation: { renown: 0, alignment: 0 },
    standing: {},
    worldThreat: {},

    /* dungeons & hidden realms */
    dungeon: null,
    secretRealms: {},
    dungeonsCleared: 0,

    /* bonds & relationships (per-NPC score + type, separate from faction standing) */
    npcs: {
      elder_rong: { score: 12, type: null, met: true, region: "willow_creek", history: [], wins: 0, losses: 0, power: 0, status: "active" },
      jin_wei:    { score: 5, type: "rival", met: true, region: "riverside_city", history: [], wins: 0, losses: 0, power: 1, status: "competing" },
    },

    /* clan bloodline gacha */
    bloodline: null,
    clanInventory: [],
    clanEssence: 0,
    spins: 0,
    spinsTotal: 0,
    pityLegendary: 0,
    pityMythical: 0,
    clanLocked: false,
    bloodlineLevel: 0,
    talent: null,
    spinSettings: { confirmEpic: true, confirmLegendary: true, confirmMythical: true },
    lastSpin: null,

    /* sects */
    sect: null,
    sectRank: 1,
    contribution: 0,
    sectMissions: [],
    sectMissionsDay: 0,
    sectHistory: [],
    sectFlags: {},

    /* quests */
    questBoard: {},      // regionId -> [quest]
    questBoardDay: {},   // regionId -> last refresh timestamp
    activeQuest: null,
    questLog: [],        // completed/failed summaries
    flags: {},           // story flags

    /* misc */
    defeated: 0,
    totalKillsByType: {},
    log: [],
    enemy: null,
    combatLog: [],
    poison: 0,
    escort: null,
  };
}

/* Cross-browser storage: Safari on file:// and Private mode (and some in-app
   browsers) throw on localStorage. Probe once, fall back to memory, report it. */
const storage = (function () {
  let ls = null;
  try { ls = localStorage; } catch { ls = null; }
  let available = false;
  try {
    if (ls) { ls.setItem("__murim_probe__", "1"); ls.removeItem("__murim_probe__"); available = true; }
  } catch { available = false; }
  const mem = {};
  return {
    available,
    getItem(k) { try { return available && ls ? ls.getItem(k) : (k in mem ? mem[k] : null); } catch { return k in mem ? mem[k] : null; } },
    setItem(k, v) { try { if (available && ls) ls.setItem(k, v); else mem[k] = v; } catch { mem[k] = v; } },
    removeItem(k) { try { if (available && ls) ls.removeItem(k); else delete mem[k]; } catch { delete mem[k]; } },
  };
})();

let state = load();

function load() {
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    const s = Object.assign(defaultState(), parsed);
    s.enemy = null;
    s.combatLog = [];
    s.poison = 0;
    s.escort = null;
    if (!Array.isArray(s.techniques)) s.techniques = ["basic"];
    if (!s.techniques.includes("basic")) s.techniques.unshift("basic");
    if (!s.mastery || typeof s.mastery !== "object") s.mastery = {};
    for (const id of s.techniques) if (s.mastery[id] == null) s.mastery[id] = 1;
    if (!s.cooldowns || typeof s.cooldowns !== "object") s.cooldowns = {};
    if (typeof s.qiDeviation !== "number") s.qiDeviation = 0;
    if (!s.techFragments || typeof s.techFragments !== "object") s.techFragments = {};
    if (!s.npcs || typeof s.npcs !== "object") s.npcs = {};
    if (!s.skills || typeof s.skills !== "object") s.skills = {};
    if (!s.equipment || typeof s.equipment !== "object") s.equipment = { weapon: null, armor: null, charm: null };
    for (const slot of SLOTS) if (!(slot in s.equipment)) s.equipment[slot] = null;
    if (!Array.isArray(s.inventory)) s.inventory = [];
    if (!Array.isArray(s.manuals)) s.manuals = [];
    if (!s.reputation) s.reputation = { renown: 0, alignment: 0 };
    if (!s.standing) s.standing = {};
    if (!s.materials) s.materials = {};
    if (!s.worldThreat) s.worldThreat = {};
    if (!s.secretRealms || typeof s.secretRealms !== "object") s.secretRealms = {};
    if (typeof s.dungeonsCleared !== "number") s.dungeonsCleared = 0;
    if (s.dungeon && typeof s.dungeon === "object") {
      if (!s.dungeon.loot) s.dungeon.loot = { silver: 0, materials: {}, manuals: [], pills: 0, gear: [], spins: 0, essence: 0, techs: [] };
      if (!Array.isArray(s.dungeon.plan) || !s.dungeon.plan.length) s.dungeon = null;
      else s.dungeon.awaiting = true; /* reloading reopens the current floor */
    } else {
      s.dungeon = null;
    }
    if (!s.questBoard) s.questBoard = {};
    if (!s.questBoardDay) s.questBoardDay = {};
    if (!s.questLog) s.questLog = [];
    if (!s.flags) s.flags = {};
    if (!s.totalKillsByType) s.totalKillsByType = {};
    if (!Array.isArray(s.clanInventory)) s.clanInventory = [];
    if (typeof s.clanEssence !== "number") s.clanEssence = 0;
    if (typeof s.spins !== "number") s.spins = 0;
    if (typeof s.spinsTotal !== "number") s.spinsTotal = 0;
    if (typeof s.pityLegendary !== "number") s.pityLegendary = 0;
    if (typeof s.pityMythical !== "number") s.pityMythical = 0;
    if (typeof s.bloodlineLevel !== "number") s.bloodlineLevel = 0;
    if (!s.spinSettings || typeof s.spinSettings !== "object") s.spinSettings = { confirmEpic: true, confirmLegendary: true, confirmMythical: true };
    if (typeof s.spinSettings.confirmEpic !== "boolean") s.spinSettings.confirmEpic = true;
    if (typeof s.spinSettings.confirmLegendary !== "boolean") s.spinSettings.confirmLegendary = true;
    if (typeof s.spinSettings.confirmMythical !== "boolean") s.spinSettings.confirmMythical = true;
    if (!Array.isArray(s.sectMissions)) s.sectMissions = [];
    if (typeof s.sectMissionsDay !== "number") s.sectMissionsDay = 0;
    if (!Array.isArray(s.sectHistory)) s.sectHistory = [];
    if (!s.sectFlags || typeof s.sectFlags !== "object") s.sectFlags = {};
    if (typeof s.sectRank !== "number") s.sectRank = 1;
    if (typeof s.contribution !== "number") s.contribution = 0;
    if (s.sect && !sectById(s.sect)) s.sect = null;
    if (s.bloodline && !gachaClanById(s.bloodline)) s.bloodline = null;
    if (typeof s.region !== "string" || !REGIONS.some((r) => r.id === s.region)) s.region = startRegion();
    if (typeof s.realm !== "number") s.realm = 0;
    if (typeof s.stage !== "number") s.stage = 1;
    if (typeof s.silver !== "number") s.silver = 0;
    return s;
  } catch {
    return defaultState();
  }
}

function save() {
  state.lastSeen = Date.now();
  try { storage.setItem(SAVE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
}

/* ============================== PROGRESSION ============================== */

const globalIndex = () => state.realm * STAGES_PER_REALM + (state.stage - 1);
const stageName = () => REALMS[state.realm].stages[state.stage - 1];
const tierOf = () => REALMS[state.realm].tier;
const maxedOut = () => state.realm === REALMS.length - 1 && state.stage === STAGES_PER_REALM;

function stageGroup(stage) {
  if (stage <= 3) return "Early";
  if (stage <= 6) return "Middle";
  if (stage <= 8) return "Late";
  return "Peak";
}

function qiRequirement(realm, stage) {
  return Math.round(120 * Math.pow(1.75, realm) * Math.pow(1.22, stage - 1));
}

function rankPower() {
  return 6 + Math.round(globalIndex() * 2.2 + (tierOf() - 1) * 25);
}

function pillsRequired(realm) { return 1 + Math.floor(realm / 2); }
function controlReq(realm) { return 12 + realm * 16; }
function foundationReq(realm) { return 8 + realm * 12; }

/* The player's position on the world's ENEMY_RANK ladder (0..7). */
function playerCombatRankIdx() {
  const r = state.realm;
  if (r <= 0) return 0;
  if (r <= 1) return 1;
  if (r <= 3) return 2;
  if (r <= 5) return 3;
  if (r <= 7) return 4;
  if (r <= 9) return 5;
  if (r <= 11) return 6;
  return 7;
}

/* ============================== DERIVED ============================== */

const $ = (id) => document.getElementById(id);
const isLearned = (id) => state.techniques.includes(id);
const equippedItems = () => SLOTS.map((s) => state.equipment[s]).filter(Boolean);
const uid = () => Math.random().toString(36).slice(2, 9);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function xpToLevel(lvl) { return Math.round(60 * Math.pow(lvl, 1.6)); }

function passiveTechQi() { return state.techniques.reduce((s, id) => s + (TECHNIQUES[id].autoQi || 0), 0); }
function totalSkillLevels() { return Object.values(state.skills).reduce((a, b) => a + b, 0); }
function internalTechs() { return state.techniques.filter((id) => TECHNIQUES[id].school === "Internal").length; }

function computeBonuses() {
  const b = {
    maxHp: 0, attack: 0, crit: 0, qiPerSec: 0, gather: 0, qiControl: 0, foundation: 0,
    maxHpPct: 0, attackPct: 0, gatherPct: 0, dmgPct: 0, qiKillPct: 0, dropPct: 0, gearPct: 0,
    dodgePct: 0, xpPct: 0,
  };
  for (const [id, lvl] of Object.entries(state.skills)) {
    const s = SKILLS[id];
    if (s && lvl > 0) b[s.stat] = (b[s.stat] || 0) + s.per * lvl;
  }
  for (const item of equippedItems()) {
    for (const [k, v] of Object.entries(item.stats)) b[k] = (b[k] || 0) + v;
  }
  /* bloodline + talent */
  const ctb = clanTalentBonuses();
  for (const [k, v] of Object.entries(ctb)) b[k] = (b[k] || 0) + v;
  return b;
}

function stats() {
  const b = computeBonuses();
  const conflict = typeof conflictPenalty === "function" ? conflictPenalty() : { qiMult: 1, dmgMult: 1 };
  const devMult = typeof qiDeviationMult === "function" ? qiDeviationMult() : 1;
  const maxHp = Math.round((100 + state.level * 20 + globalIndex() * 12 + b.maxHp) * (1 + b.maxHpPct + passiveTechBonus("maxHpPct")));
  const attack = Math.round((rankPower() + state.level * 2 + b.attack) * (1 + b.attackPct));
  const crit = Math.min(0.75, 0.05 + b.crit);
  const qiPerSec = Math.round((b.qiPerSec + passiveTechQi()) * devMult * conflict.qiMult);
  const gather = Math.round((5 + globalIndex() * 3 + state.level * 2 + b.gather) * (1 + b.gatherPct));
  const qiControl = Math.round(6 + globalIndex() * 0.9 + internalTechs() * 6 + state.level * 0.8 + b.qiControl);
  const foundation = Math.round(6 + state.techniques.length * 5 + totalSkillLevels() * 2 + state.defeated * 0.03 + b.foundation);
  const dmgMult = (1 + b.dmgPct) * conflict.dmgMult;
  return { maxHp, attack, crit, qiPerSec, gather, qiControl, foundation, dmgMult };
}

/* ============================== HELPERS ============================== */

function addLog(text, kind = "") {
  state.log.unshift({ text, kind });
  if (state.log.length > 100) state.log.pop();
}
function addCombatLog(text, kind = "") {
  state.combatLog.unshift({ text, kind });
  if (state.combatLog.length > 50) state.combatLog.pop();
}
const pct = (cur, max) => (max <= 0 ? 0 : clamp((cur / max) * 100, 0, 100));

function addMaterial(id, count = 1) {
  state.materials[id] = (state.materials[id] || 0) + count;
}
function materialCount(id) { return state.materials[id] || 0; }
function removeMaterial(id, count = 1) {
  const have = state.materials[id] || 0;
  if (have < count) return false;
  state.materials[id] = have - count;
  if (state.materials[id] <= 0) delete state.materials[id];
  return true;
}

function gainXp(amount) {
  const b = computeBonuses();
  const amt = Math.round(amount * (1 + (b.xpPct || 0)));
  state.xp += amt;
  let leveled = 0;
  while (state.xp >= xpToLevel(state.level)) {
    state.xp -= xpToLevel(state.level);
    state.level += 1;
    state.skillPoints += 1;
    leveled += 1;
  }
  if (leveled > 0) {
    state.hp = stats().maxHp;
    addLog(`Level up! You are now level ${state.level} (+${leveled} skill point${leveled > 1 ? "s" : ""}).`, "gold");
  }
}

