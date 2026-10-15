"use strict";

/* =====================================================================
   main.js — player actions, boot sequence, game loops, and event wiring.
   ===================================================================== */

/* ============================== PLAYER ACTIONS ============================== */

function gatherQi() {
  const gain = stats().gather;
  state.qi += gain;
  gainXp(1 + Math.floor(state.realm / 2));
  addLog(`You gather ${gain} qi through focused breathing.`, "good");
  questEvent("gather", {});
  save();
  render();
}

function advance() {
  if (state.stage < STAGES_PER_REALM) advanceStage();
  else attemptBreakthrough();
}

function advanceStage() {
  const req = qiRequirement(state.realm, state.stage);
  if (state.qi < req) { addLog(`You need ${req.toLocaleString()} qi to reach the next stage.`, "bad"); render(); return; }
  state.qi -= req;
  state.stage += 1;
  state.hp = stats().maxHp;
  gainXp(6 + state.realm * 3);
  addLog(`You advance to ${stageName()} (${stageGroup(state.stage)} stage) of the ${REALMS[state.realm].name}.`, "good");
  questEvent("stage", {});
  save();
  render();
}

function attemptBreakthrough() {
  const realm = state.realm;
  if (maxedOut()) { addLog("You have reached the pinnacle — the Martial Sovereign. There is nothing beyond.", "gold"); render(); return; }

  const qiNeed = qiRequirement(realm, STAGES_PER_REALM);
  const pillNeed = pillsRequired(realm);
  const ctrlNeed = controlReq(realm);
  const fndNeed = foundationReq(realm);
  const s = stats();

  if (state.qi < qiNeed) { addLog(`Breakthrough needs ${qiNeed.toLocaleString()} qi (you have ${Math.floor(state.qi).toLocaleString()}).`, "bad"); render(); return; }
  if (state.pills < pillNeed) { addLog(`Breakthrough needs ${pillNeed} Breakthrough Pill(s) — you have ${state.pills}.`, "bad"); render(); return; }
  if (s.qiControl < ctrlNeed) { addLog(`Your Qi Control (${s.qiControl}) is too unstable for this breakthrough (need ${ctrlNeed}).`, "bad"); render(); return; }
  if (s.foundation < fndNeed) { addLog(`Your Foundation (${s.foundation}) is too shaky for this breakthrough (need ${fndNeed}).`, "bad"); render(); return; }

  state.qi -= qiNeed;
  state.pills -= pillNeed;

  const chance = Math.min(0.95, Math.max(0.05, 0.9 - realm * 0.03 + state.insight * 0.06));
  if (Math.random() < chance) {
    state.realm += 1;
    state.stage = 1;
    state.insight = 0;
    state.hp = stats().maxHp;
    gainXp(80 + realm * 40);
    grantSpins(1, "major breakthrough");
    addLog(`Breakthrough SUCCESS! You step into the ${REALMS[state.realm].name} — ${stageName()}.`, "gold");
    if (typeof onRealmAdvance === "function") onRealmAdvance();
  } else {
    state.insight += 1;
    state.hp = Math.max(1, Math.round(state.hp * 0.5));
    const newChance = Math.min(0.95, 0.9 - realm * 0.03 + state.insight * 0.06);
    addLog(`Breakthrough FAILED! Your qi scatters and you cough blood. (Insight raised — next attempt ${Math.round(newChance * 100)}%.)`, "bad");
  }
  questEvent("stage", {});
  save();
  render();
}

function rest() {
  state.hp = stats().maxHp;
  state.poison = 0;
  addLog("You sit in meditation and recover your health.", "good");
  save();
  render();
}

function studyManual(index) {
  const manualId = state.manuals[index];
  if (!manualId) return;
  const manual = MANUALS[manualId];
  const tech = TECHNIQUES[manual.teaches];

  if (isLearned(manual.teaches)) {
    const bonus = 40 + state.realm * 30;
    state.qi += bonus;
    gainMastery(manual.teaches, 12);
    addLog(`You already know ${tech.name}; you pore over the manual for ${bonus} qi and deeper mastery.`, "");
  } else if (manual.incomplete && (state.techFragments[manualId] || 0) < manual.pages) {
    const need = manual.pages - (state.techFragments[manualId] || 0);
    addLog(`The ${manual.name} is incomplete — ${need} missing page(s) still elude you.`, "bad");
    render();
    return;
  } else if (!canStudy(manual.teaches)) {
    if (tech.clan && state.bloodline !== tech.clan) {
      addLog(`Only those of the ${gachaClanById(tech.clan).name} bloodline can comprehend ${tech.name}.`, "bad");
      render();
      return;
    }
    if (tech.sect && state.sect !== tech.sect) {
      addLog(`Only members of the ${sectById(tech.sect).name} may study ${tech.name}.`, "bad");
      render();
      return;
    }
    const missing = tech.requires.filter((r) => !isLearned(r)).map((r) => TECHNIQUES[r].name).join(", ");
    addLog(`You cannot yet comprehend ${tech.name} — first master ${missing}.`, "bad");
    render();
    return;
  } else if (!attemptComprehension(manual.teaches)) {
    /* reading a manual does not guarantee understanding */
    addLog(`The ${manual.name} eludes you — the deeper principles of ${tech.name} slip from your grasp.`, "bad");
    if (TECH_GRADES[tech.grade].mult >= TECH_GRADES.heaven.mult && Math.random() < 0.35) {
      triggerQiDeviation(30 + Math.floor(TECH_GRADES[tech.grade].mult * 60), `your qi rebels while you force ${TECH_GRADES[tech.grade].name} insights.`);
    }
    save();
    render();
    return;
  } else {
    state.techniques.push(manual.teaches);
    if (state.mastery[manual.teaches] == null) state.mastery[manual.teaches] = 1;
    addLog(`You study the ${manual.name} and learn ${tech.name}! (${techGradeLabel(manual.teaches)})`, "good");
  }
  state.manuals.splice(index, 1);
  save();
  render();
}

function learnSkill(id) {
  const s = SKILLS[id];
  const cur = skillLevel(id);
  if (cur >= s.max) return;
  if (!skillUnlocked(id)) { addLog(`${s.name} is locked — master its prerequisites first.`, "bad"); render(); return; }
  const cost = skillCost(id);
  if (state.skillPoints < cost) { addLog(`Not enough skill points for ${s.name} (need ${cost}).`, "bad"); render(); return; }
  state.skillPoints -= cost;
  state.skills[id] = cur + 1;
  state.hp = Math.min(state.hp, stats().maxHp);
  addLog(`You train ${s.name} to rank ${cur + 1}.`, "good");
  save();
  render();
}

function equipItem(invIndex) {
  const item = state.inventory[invIndex];
  if (!item) return;
  const prev = state.equipment[item.slot];
  state.equipment[item.slot] = item;
  state.inventory.splice(invIndex, 1);
  if (prev) state.inventory.push(prev);
  state.hp = Math.min(state.hp, stats().maxHp);
  addLog(`You equip ${item.name}.`, "good");
  save(); render();
}

function unequipItem(slot) {
  const item = state.equipment[slot];
  if (!item) return;
  state.equipment[slot] = null;
  state.inventory.push(item);
  state.hp = Math.min(state.hp, stats().maxHp);
  addLog(`You remove ${item.name}.`, "");
  save(); render();
}

function sellItem(invIndex) {
  const item = state.inventory[invIndex];
  if (!item) return;
  const value = sellValue(item);
  state.silver += value;
  state.inventory.splice(invIndex, 1);
  addLog(`You sell ${item.name} for ${value} silver.`, "");
  save(); render();
}

/* ============================== OFFLINE ============================== */

function applyOfflineProgress() {
  const elapsedMs = Math.min(Date.now() - (state.lastSeen || Date.now()), OFFLINE_CAP_HOURS * 3600 * 1000);
  const seconds = Math.floor(elapsedMs / 1000);
  if (seconds < 60) return;
  const gain = Math.floor(stats().qiPerSec * seconds * OFFLINE_EFFICIENCY);
  if (gain <= 0) return;
  state.qi += gain;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const duration = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  $("offlineText").innerHTML = `You cultivated in seclusion for <b>${duration}</b>.<br><span class="big">+${gain.toLocaleString()} qi</span>`;
  $("offlineOverlay").hidden = false;
  addLog(`Offline: +${gain.toLocaleString()} qi over ${duration}.`, "gold");
}

/* ============================== LOOPS ============================== */

setInterval(() => {
  if (state.enemy) return;
  if (state.qiDeviation > 0) {
    state.qiDeviation -= 1;
    if (state.qiDeviation <= 0) { state.qiDeviation = 0; addLog("Your qi settles; the deviation passes.", "good"); }
  }
  const passive = stats().qiPerSec;
  if (passive > 0) { state.qi += passive; save(); render(); }
}, 1000);

setInterval(() => {
  if (state.activeQuest && state.activeQuest.deadline) checkDeadlines();
}, 30000);

setInterval(() => {
  worldTick();
  if (!state.enemy) { save(); }
}, 60000);

setInterval(() => save(), 15000);
window.addEventListener("beforeunload", () => save());
window.addEventListener("pagehide", () => save());
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") save(); });

/* ============================== EVENTS ============================== */

document.addEventListener("click", (event) => {
  const tab = event.target.closest(".tab");
  if (tab) { switchTab(tab.dataset.tab); return; }

  const el = event.target.closest("[data-action]");
  if (!el) return;

  switch (el.dataset.action) {
    case "gather": gatherQi(); break;
    case "advance": advance(); break;
    case "explore": exploreRegion(); break;
    case "hunt": hunt(); break;
    case "rest": rest(); break;
    case "study": studyManual(Number(el.dataset.index)); break;
    case "attack": playerAttack(el.dataset.tech); break;
    case "guard": playerGuard(el.dataset.tech); break;
    case "flee": flee(); break;
    case "skill": learnSkill(el.dataset.skill); break;
    case "equip": equipItem(Number(el.dataset.index)); break;
    case "unequip": unequipItem(el.dataset.slot); break;
    case "sell": sellItem(Number(el.dataset.index)); break;
    case "spin": spinClanAction(); break;
    case "toggleClanLock": toggleClanLock(); break;
    case "toggleConfirm": toggleConfirmSetting(el.dataset.rarity); break;
    case "buySpin": buyEssenceSpin(); break;
    case "rerollTalent": rerollTalent(); break;
    case "infuse": infuseBloodline(); break;
    case "joinSect": joinSect(el.dataset.sect); break;
    case "leaveSect": if (confirm("Leave your sect? You will lose all rank and contribution.")) leaveSect(); break;
    case "sectTrain": sectTrain(); break;
    case "sectRefresh": refreshSectMissions(true); addLog("You request new duties from the sect.", ""); save(); render(); break;
    case "sectTurnIn": turnInSectMission(el.dataset.id); break;
    case "sectShop": buySectItem(el.dataset.id); break;
    case "investigate": investigateNpc(el.dataset.npc); break;
    case "gift": giftNpc(el.dataset.npc, el.dataset.tier); break;
    case "train": seekTraining(el.dataset.npc); break;
    case "spar": sparNpc(el.dataset.npc); break;
    case "reconcile": reconcileNpc(el.dataset.npc); break;
    case "dungeonEnter": startDungeon(el.dataset.site); break;
    case "dungeonDescend": dungeonDescend(); break;
    case "dungeonRetreat": dungeonRetreat(); break;
    case "travel": travelTo(el.dataset.region); break;
    case "accept": acceptQuest(el.dataset.qid); break;
    case "turnin": turnInQuest(); break;
    case "abandon": abandonQuest(); break;
    case "buyPill": buyPill(); break;
    case "sellMaterials": sellMaterials(); break;
    case "closeOffline": $("offlineOverlay").hidden = true; break;
    case "reset":
      if (confirm("Erase all progress and start over?")) {
        state = defaultState();
        state._mainOffer = null;
        save();
        render();
      }
      break;
  }
});

/* ============================== BOOT ============================== */

applyOfflineProgress();
state.hp = Math.min(state.hp, stats().maxHp);
ensureBoard(currentRegion());
if (state.sect && typeof refreshSectMissions === "function") refreshSectMissions(false);
if (!state.log.length) addLog("You awaken in the mortal world, a martial aspirant with a faint spark of qi.", "gold");
if (typeof storage !== "undefined" && !storage.available) {
  addLog("⚠ This browser is not saving your progress (private mode, or the page opened as a file). Serve the game over http:// to keep your save.", "bad");
}
render();
