"use strict";

/* =====================================================================
   gacha.js — clan bloodline gacha: rarities, pity, spins, lock,
   duplicate protection, talents, bloodline infusion, essence shop,
   rivalries, and bloodline discovery.
   ===================================================================== */

/* ============================== HELPERS ============================== */

const getBloodline = () => (state.bloodline ? gachaClanById(state.bloodline) : null);
const bloodlineBonusMultiplier = () => 1 + (state.bloodlineLevel || 0) * 0.1;

/* Merge bloodline + talent bonuses into a raw bonus map. */
function clanTalentBonuses() {
  const out = {};
  const bl = getBloodline();
  if (bl) {
    const mult = bloodlineBonusMultiplier();
    for (const [k, v] of Object.entries(bl.bonus)) out[k] = (out[k] || 0) + v * mult;
  }
  if (state.talent && TALENTS[state.talent]) {
    for (const [k, v] of Object.entries(TALENTS[state.talent].bonus)) out[k] = (out[k] || 0) + v;
  }
  return out;
}

function clanRivalsFaction(factionId) {
  if (!state.bloodline) return false;
  return (CLAN_RIVALS[state.bloodline] || []).includes(factionId);
}

/* ============================== TALENT ============================== */

function rollTalent() {
  const total = TALENT_WEIGHTS.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [key, w] of TALENT_WEIGHTS) {
    r -= w;
    if (r <= 0) { state.talent = key; return key; }
  }
  state.talent = "ordinary";
  return "ordinary";
}

/* ============================== SPINS ============================== */

function grantSpins(n, reason) {
  if (n <= 0) return;
  state.spins += n;
  addLog(`🎟️ Gained ${n} clan spin${n > 1 ? "s" : ""}${reason ? " — " + reason : ""}.`, "gold");
}

/* ============================== GACHA ROLL ============================== */

function rollRarity() {
  if (state.pityMythical >= 100) return "mythical";
  if (state.pityLegendary >= 50) return Math.random() < 0.2 ? "mythical" : "legendary";
  const r = Math.random() * 100;
  let acc = 0;
  for (const key of RARITY_ORDER) {
    acc += CLAN_RARITIES[key].chance;
    if (r < acc) return key;
  }
  return "mythical";
}

function updatePity(rarity) {
  if (rarity === "mythical") { state.pityMythical = 0; state.pityLegendary = 0; }
  else if (rarity === "legendary") { state.pityLegendary = 0; state.pityMythical += 1; }
  else { state.pityLegendary += 1; state.pityMythical += 1; }
}

/* Perform one spin. Returns a result object for the reveal UI. */
function spinClan() {
  if (state.spins <= 0) return { error: "no-spins" };

  state.spins -= 1;
  state.spinsTotal += 1;

  const rarity = rollRarity();
  updatePity(rarity);

  const pool = GACHA_CLANS.filter((c) => c.rarity === rarity);
  const clan = pool[Math.floor(Math.random() * pool.length)];

  if (state.clanInventory.includes(clan.id)) {
    const essence = CLAN_RARITIES[rarity].dupEssence;
    state.clanEssence += essence;
    addLog(`Duplicate bloodline: ${clan.name}. Converted into ${essence} Clan Essence.`, "");
    return { clan, rarity, duplicate: true, essence };
  }

  state.clanInventory.push(clan.id);
  const isFirst = !state.bloodline;
  state.bloodline = clan.id;
  state.bloodlineLevel = 0;
  addLog(`You awaken the ${clan.name} bloodline (${CLAN_RARITIES[rarity].name})! ${clan.desc}`, "gold");
  return { clan, rarity, duplicate: false, first: isFirst };
}

/* ============================== LOCK ============================== */

function toggleClanLock() {
  if (!state.bloodline) { addLog("Roll a clan before locking it.", "bad"); render(); return; }
  state.clanLocked = !state.clanLocked;
  addLog(state.clanLocked ? "Your bloodline is locked — spins will not replace it without confirmation." : "Bloodline lock released.", "");
  save(); render();
}

/* ============================== ESSENCE SHOP ============================== */

function buyEssenceSpin() {
  const cost = ESSENCE_SHOP.extraSpin.cost;
  if (state.clanEssence < cost) { addLog(`Need ${cost} Clan Essence (have ${state.clanEssence}).`, "bad"); render(); return; }
  state.clanEssence -= cost;
  state.spins += 1;
  addLog(`You spend ${cost} essence for an extra clan spin.`, "good");
  save(); render();
}

function rerollTalent() {
  if (!state.bloodline) { addLog("Awaken a bloodline first.", "bad"); render(); return; }
  const cost = ESSENCE_SHOP.rerollTalent.cost;
  if (state.clanEssence < cost) { addLog(`Need ${cost} Clan Essence (have ${state.clanEssence}).`, "bad"); render(); return; }
  state.clanEssence -= cost;
  const key = rollTalent();
  addLog(`You re-roll your fate — new talent: ${TALENTS[key].name}.`, "gold");
  state.hp = Math.min(state.hp, stats().maxHp);
  save(); render();
}

function infusionCost() { return ESSENCE_SHOP.infusion.costFactor * ((state.bloodlineLevel || 0) + 1); }

function infuseBloodline() {
  if (!state.bloodline) { addLog("Awaken a bloodline first.", "bad"); render(); return; }
  const cost = infusionCost();
  if (state.clanEssence < cost) { addLog(`Need ${cost} Clan Essence (have ${state.clanEssence}).`, "bad"); render(); return; }
  state.clanEssence -= cost;
  state.bloodlineLevel = (state.bloodlineLevel || 0) + 1;
  state.hp = Math.min(state.hp, stats().maxHp);
  addLog(`Bloodline infusion! Your ${getBloodline().name} passive strengthens (Level ${state.bloodlineLevel}).`, "gold");
  save(); render();
}

/* ============================== DISCOVERY ============================== */

/* Exploration may uncover a lost bloodline. Grants the clan + spins. */
function discoverBloodline() {
  const pool = GACHA_CLANS.filter((c) => (c.rarity === "mythical" || c.rarity === "legendary") && !state.clanInventory.includes(c.id));
  if (!pool.length) return null;
  const clan = pool[Math.floor(Math.random() * pool.length)];
  state.clanInventory.push(clan.id);
  state.bloodline = clan.id;
  state.bloodlineLevel = 0;
  const spins = 1 + Math.floor(Math.random() * 3);
  grantSpins(spins, "ancient ruin");
  addLog(`In an ancient ruin you inherit a lost bloodline: the ${clan.name} (${CLAN_RARITIES[clan.rarity].name})!`, "gold");
  return clan;
}

/* ============================== UI ACTION + REVEAL ============================== */

const CONFIRM_KEYS = { epic: "confirmEpic", legendary: "confirmLegendary", mythical: "confirmMythical" };

function confirmForRarity(rarity) {
  const key = CONFIRM_KEYS[rarity];
  return !!key && !!state.spinSettings[key];
}

function toggleConfirmSetting(rarity) {
  const key = CONFIRM_KEYS[rarity];
  if (!key) return;
  state.spinSettings[key] = !state.spinSettings[key];
  addLog(`${CLAN_RARITIES[rarity].name} spin confirmation ${state.spinSettings[key] ? "enabled" : "disabled"}.`, "");
  save();
  render();
}

/* Ask before a spin would replace a valuable active bloodline. */
function bloodlineReplaceGuard() {
  const bl = getBloodline();
  if (!bl) return true;
  if (state.clanLocked) {
    return confirm(`Your ${bl.name} bloodline is locked.\n\nSpend a spin anyway? A new roll may replace it.`);
  }
  if (confirmForRarity(bl.rarity)) {
    const label = CLAN_RARITIES[bl.rarity].name;
    return confirm(
      `You are about to spin away your active ${label} bloodline: ${bl.name}.\n\n${bl.desc}\n\n` +
      `The result could replace it with a lower-rarity clan. Spin anyway?`
    );
  }
  return true;
}

function spinClanAction() {
  if (state.spins <= 0) {
    addLog("You have no clan spins. Earn them from quests, bosses, ruins, and breakthroughs.", "bad");
    render();
    return;
  }
  if (!bloodlineReplaceGuard()) { render(); return; }

  const res = spinClan();
  if (res.error) return;
  state.hp = Math.min(state.hp, stats().maxHp);
  state.lastSpin = { ...res, when: Date.now() };
  save();
  render();
}


