"use strict";

/* =====================================================================
   karma.js — the morality ledger: heroic / neutral / demonic paths,
   cumulative karma, wanted status and bounties, NPC reactions, and
   path-exclusive quests and rewards.
   ===================================================================== */

/* ============================== PATH & WANTED ============================== */

function karmaPath() {
  const a = state.reputation ? state.reputation.alignment : 0;
  if (a >= 35) return "heroic";
  if (a <= -35) return "demonic";
  return "neutral";
}

const pathInfo = () => KARMA_PATHS[karmaPath()];
const karmaScore = () => (state.karma ? state.karma.good - state.karma.evil : 0);

function wantedLevel() {
  const b = state.bounty || 0;
  let lvl = 0;
  for (const w of WANTED_LEVELS) if (b >= w.min) lvl = w.level;
  const a = state.reputation ? state.reputation.alignment : 0;
  if (a <= -30 && lvl < 1) lvl = 1;
  if (a <= -60 && lvl < 2) lvl = 2;
  if (a <= -85 && lvl < 3) lvl = 3;
  return lvl;
}

const isWanted = () => wantedLevel() > 0;
const wantedInfo = () => WANTED_LEVELS[wantedLevel()];

function addBounty(n) {
  if (!n) return;
  state.bounty = clamp((state.bounty || 0) + n, 0, 99999);
}

/* ============================== LEDGER ============================== */

/* Record a deed. `alignment` omitted => good - evil. Pass alignment:0 to tally only. */
function addKarma(opts = {}) {
  const good = opts.good || 0;
  const evil = opts.evil || 0;
  if (!state.karma || typeof state.karma !== "object") state.karma = { good: 0, evil: 0 };
  state.karma.good += good;
  state.karma.evil += evil;
  const alignment = opts.alignment != null ? opts.alignment : (good - evil);
  const renown = opts.renown || 0;
  if (alignment || renown) adjustReputation({ renown, alignment });
  if (opts.bounty) addBounty(opts.bounty);
  if (opts.reason && (good || evil)) addLog(opts.reason, evil ? "bad" : "good");
}

/* Killing in the open world has moral weight; contests never do. */
function karmaFromKill(enemy) {
  if (!enemy) return;
  if (enemy.duel || enemy.tournament || enemy.isRival || enemy.isNemesis) return;
  if (enemy.typeId === "bandit" || enemy.typeId === "assassin") {
    addKarma({ good: 1, alignment: 0 });
    return;
  }
  if (enemy.typeId === "sect_member") {
    const fac = currentRegion().faction;
    if (fac && fac === state.sect) {
      addKarma({ evil: 6, alignment: -10, bounty: 80, reason: "You shed the blood of your own sect — a betrayal the jianghu will not forget." });
      adjustStanding(fac, -15);
    } else if (fac && FACTIONS[fac] && (state.standing[fac] || 0) > 0) {
      addKarma({ evil: 2, alignment: -3, bounty: 20, reason: "You cut down members of a sect that held you in esteem." });
      adjustStanding(fac, -6);
    }
  }
}

/* Bond actions that carry moral weight feed the ledger. */
function karmaFromBondAction(action) {
  if (!action) return;
  const evil = KARMA_EVIL_ACTIONS[action];
  if (evil) {
    addKarma({ evil: evil.evil, alignment: -Math.round(evil.evil / 2), bounty: evil.bounty, reason: `Dark deed: ${evil.label}.` });
    return;
  }
  const good = KARMA_GOOD_ACTIONS[action];
  if (good) addKarma({ good: good.good, alignment: Math.round(good.good / 2), renown: good.renown, reason: `Righteous act: ${good.label}.` });
}

/* ============================== BOUNTY & AMBUSH ============================== */

function bountyTick() {
  const b = state.bounty || 0;
  if (b <= 0) return;
  const a = state.reputation ? state.reputation.alignment : 0;
  /* a clean name lets the heat die down; a demon's legend only grows */
  if (a > -20 && Math.random() < 0.4) state.bounty = Math.max(0, b - (3 + Math.floor(b / 100)));
  else if (a <= -60 && Math.random() < 0.2) addBounty(5);
}

function bountyAmbushCheck() {
  const lvl = wantedLevel();
  if (lvl <= 0) return false;
  return Math.random() < WANTED_LEVELS[lvl].hunterChance;
}

/* Honest merchants refuse the truly damned and the openly hunted. */
function karmaRefusesTrade() {
  const a = state.reputation ? state.reputation.alignment : 0;
  return wantedLevel() >= 2 || a <= -60;
}

/* ============================== NPC REACTIONS ============================== */

function isRighteousNpc(n) {
  if (!n) return false;
  if (n.tags && (n.tags.includes("story") || n.tags.includes("master") || n.tags.includes("leader"))) return true;
  if (n.sect) { const s = sectById(n.sect); if (s && s.type === "orthodox") return true; }
  return false;
}

/* Returns { refuses, text } when the person's moral stance blocks interaction. */
function npcKarmaReaction(id) {
  const n = npcById(id);
  if (!n) return null;
  const demon = (state.reputation ? state.reputation.alignment : 0) <= -35;
  const lvl = wantedLevel();
  if (isRighteousNpc(n)) {
    if (demon) return { refuses: true, text: `${n.name} recoils from your demonic aura and will not aid you.` };
    if (lvl >= 2) return { refuses: true, text: `${n.name} wants nothing to do with a wanted outlaw.` };
  }
  return null;
}

const npcRefusesPlayer = (id) => { const r = npcKarmaReaction(id); return !!(r && r.refuses); };

/* ============================== PATH QUESTS ============================== */

function pathQuestBoard(region) {
  const path = karmaPath();
  const pool = PATH_QUEST_TEMPLATES[path];
  if (!pool || !pool.length) return null;
  if (Math.random() > 0.6) return null;
  const t = pick(pool);
  const difficulty = regionDifficulty(region);
  const typeId = ENEMY_TYPES[t.typeId] ? t.typeId : randomEnemyType(region);
  const d = DIFFICULTIES[difficulty];
  return {
    id: uid(), key: null, category: "morality", regionId: region.id, difficulty,
    title: t.title, giver: t.giver,
    desc: t.desc.replace("{region}", region.name),
    objectives: [{ type: "kill", typeId, region: region.id, count: t.count, desc: `Defeat ${t.count} ${ENEMY_TYPES[typeId].name.toLowerCase()}s here`, done: false, progress: 0 }],
    rewards: rewardFor(difficulty, { alignment: t.alignment, renown: d.rep + (t.renown || 0) }),
    deadline: null, status: "offered", morality: path, bounty: t.bounty || 0,
  };
}

function onQuestCompleted(q) {
  if (!q) return;
  if (q.bounty) addBounty(q.bounty);
  if (q.category === "morality") {
    const a = (q.rewards && q.rewards.alignment) || 0;
    if (a < 0) addKarma({ evil: Math.min(10, -a), alignment: 0 });
    else if (a > 0) addKarma({ good: Math.min(10, a), alignment: 0 });
  }
}

/* ============================== VIEW HELPERS ============================== */

function pathPerks() {
  const path = karmaPath();
  if (path === "heroic") return [
    "Honest merchants and righteous sects welcome you.",
    "While your name stays clean, bounty hunters keep their distance.",
    "Righteous patrons post exclusive heroic deeds.",
  ];
  if (path === "demonic") return [
    "Demonic sects may admit you where the orthodox turn away.",
    "Merchants bar their doors and bounty hunters gather on the roads.",
    "Shadowed patrons post lucrative, bloody work.",
  ];
  return [
    "You owe nothing to heaven or hell — few doors close, few open wide.",
    "Your path may still turn toward the light or the dark.",
  ];
}

function karmaTick() {
  bountyTick();
}
