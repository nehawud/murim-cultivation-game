"use strict";

/* =====================================================================
   ui.js — all rendering: character panel, tabs, quest board, world map,
   factions, combat overlay, event overlay, log.
   ===================================================================== */

/* ---- equipment display helpers ---- */
function itemStatText(item) {
  const labels = { attack: "ATK", maxHp: "HP", qiPerSec: "Qi/s", crit: "Crit", qiControl: "Ctrl", foundation: "Fdn", attackPct: "ATK%", maxHpPct: "HP%" };
  return Object.entries(item.stats).map(([k, v]) => {
    const isPct = k === "crit" || k.endsWith("Pct");
    return `+${isPct ? Math.round(v * 100) + "%" : v} ${labels[k] || k}`;
  }).join(", ");
}
const sellValue = (item) => 12 + item.rarity * 25;

/* ============================== MASTER ============================== */

function render() {
  const s = stats();
  const xpNeed = xpToLevel(state.level);
  const region = currentRegion();

  if (state.activeQuest) syncObjectives();

  $("topLocation").textContent = `${region.name} · ${region.type}`;

  $("rankName").textContent = REALMS[state.realm].name;
  $("levelNum").textContent = state.level;
  $("stageName").textContent = stageName();
  $("stageGroupTag").textContent = stageGroup(state.stage);
  $("tierTag").textContent = `Tier ${tierOf()} · ${TIER_NAMES[tierOf()]}`;

  $("xpText").textContent = `${Math.floor(state.xp)} / ${xpNeed}`;
  $("xpFill").style.width = pct(state.xp, xpNeed) + "%";

  if (state.stage < STAGES_PER_REALM) {
    const req = qiRequirement(state.realm, state.stage);
    $("qiText").textContent = `${Math.floor(state.qi).toLocaleString()} / ${req.toLocaleString()}`;
    $("qiFill").style.width = pct(state.qi, req) + "%";
    $("qiStageHint").textContent = `· next: ${REALMS[state.realm].stages[state.stage]}`;
  } else {
    const req = qiRequirement(state.realm, STAGES_PER_REALM);
    $("qiText").textContent = `${Math.floor(state.qi).toLocaleString()} / ${req.toLocaleString()}`;
    $("qiFill").style.width = pct(state.qi, req) + "%";
    $("qiStageHint").textContent = "· breakthrough";
  }

  $("hpText").textContent = `${Math.floor(state.hp)} / ${s.maxHp}`;
  $("hpFill").style.width = pct(state.hp, s.maxHp) + "%";

  $("statAttack").textContent = s.attack;
  $("statCrit").textContent = Math.round(s.crit * 100) + "%";
  $("statQiSec").textContent = s.qiPerSec;
  $("statGather").textContent = s.gather;
  $("statDmg").textContent = "+" + Math.round((s.dmgMult - 1) * 100) + "%";
  $("statPoints").textContent = state.skillPoints;
  $("statControl").textContent = s.qiControl;
  $("statFoundation").textContent = s.foundation;
  $("defeated").textContent = state.defeated;
  $("pillCount").textContent = state.pills;

  $("reputeTitle").textContent = reputationTitle();
  $("renownVal").textContent = state.reputation.renown;
  $("silverVal").textContent = state.silver;

  renderAdvanceButton();
  renderQuests();
  renderWorld();
  renderDungeons();
  renderTechniques();
  renderSkills();
  renderEquipment();
  renderFaction();
  renderClanGacha();
  renderSect();
  renderJournal();
  renderInfo();
  renderLog();
  renderCombat();
}

/* ============================== ADVANCE BUTTON ============================== */

function renderAdvanceButton() {
  const btn = $("advanceBtn");
  const hint = $("advanceHint");
  const s = stats();

  if (maxedOut()) {
    btn.disabled = true;
    btn.textContent = "☯ Martial Sovereign — Peak of the World";
    hint.textContent = "";
    return;
  }

  if (state.stage < STAGES_PER_REALM) {
    const req = qiRequirement(state.realm, state.stage);
    btn.disabled = state.qi < req;
    btn.textContent = `☯ Advance to ${REALMS[state.realm].stages[state.stage]}`;
    hint.textContent = `Costs ${req.toLocaleString()} qi.`;
  } else {
    const qiNeed = qiRequirement(state.realm, STAGES_PER_REALM);
    const pillNeed = pillsRequired(state.realm);
    const ctrlNeed = controlReq(state.realm);
    const fndNeed = foundationReq(state.realm);
    const chance = Math.min(0.95, Math.max(0.05, 0.9 - state.realm * 0.03 + state.insight * 0.06));
    btn.disabled = false;
    btn.textContent = `⚡ Breakthrough → ${REALMS[state.realm + 1].name}`;
    hint.textContent = [
      `Qi ${state.qi >= qiNeed ? "✔" : "✘"} ${Math.floor(state.qi).toLocaleString()}/${qiNeed.toLocaleString()}`,
      `Pills ${state.pills >= pillNeed ? "✔" : "✘"} ${state.pills}/${pillNeed}`,
      `Control ${s.qiControl >= ctrlNeed ? "✔" : "✘"} ${s.qiControl}/${ctrlNeed}`,
      `Foundation ${s.foundation >= fndNeed ? "✔" : "✘"} ${s.foundation}/${fndNeed}`,
      `Success ${Math.round(chance * 100)}%`,
    ].join(" · ");
  }
}

/* ============================== QUESTS TAB ============================== */

function diffChip(d) { return `<span class="diff diff-${d}">${d} — ${DIFFICULTIES[d].name}</span>`; }

function renderQuests() {
  ensureBoard(currentRegion());
  const panel = document.querySelector('[data-panel="quests"]');
  let html = "";

  /* active quest */
  const q = state.activeQuest;
  if (q) {
    html += `<div class="quest active-quest">
      <div class="quest-head">
        <span class="quest-title">${QUEST_CATEGORIES[q.category].icon} ${q.title}</span>
        ${diffChip(q.difficulty)}
      </div>
      <div class="quest-sub">${QUEST_CATEGORIES[q.category].name} · ${q.giver} · ${regionById(q.regionId).name}</div>
      <p class="quest-desc">${q.desc}</p>`;

    if (q.deadline) {
      const left = q.deadline - Date.now();
      html += left > 0
        ? `<div class="deadline">⏳ Time remaining: ${fmtDuration(left)}</div>`
        : `<div class="deadline bad">⏳ Time expired!</div>`;
    }

    html += `<ul class="objectives">`;
    for (const o of q.objectives) {
      const mark = o.done ? "✔" : "•";
      let prog = "";
      if (o.type === "kill" || o.type === "collect") prog = ` (${o.progress}/${o.count})`;
      else if (o.type === "hold_qi") prog = ` (${Math.floor(state.qi).toLocaleString()}/${o.target.toLocaleString()})`;
      else if (o.type === "escort") prog = ` (${o.progress}/${o.waves})`;
      html += `<li class="${o.done ? "done" : ""}">${mark} ${o.desc}${prog}</li>`;
    }
    html += `</ul>`;
    html += `<div class="quest-reward">Rewards: ${rewardText(q.rewards)}</div>`;

    const canTurnIn = allObjectivesDone(q) && q.regionId === state.region;
    html += `<div class="quest-actions">
      <button class="act small" data-action="abandon">Abandon</button>
      <button class="act primary small" data-action="turnin" ${canTurnIn ? "" : "disabled"}>Turn In${q.regionId !== state.region ? ` at ${regionById(q.regionId).name}` : ""}</button>
    </div></div>`;
  } else {
    html += `<p class="hint">No active quest. Accept one from the board below.</p>`;
  }

  /* main story */
  const mainQ = nextMainQuest();
  if (mainQ) {
    const atGiver = mainQ.regionId === state.region;
    html += `<h3 class="section-title">📜 Main Story</h3>
      <div class="quest story-quest">
        <div class="quest-head"><span class="quest-title">${mainQ.title}</span>${diffChip(mainQ.difficulty)}</div>
        <div class="quest-sub">${mainQ.giver} · ${regionById(mainQ.regionId).name}</div>
        <p class="quest-desc">${mainQ.desc}</p>
        <div class="quest-reward">Rewards: ${rewardText(mainQ.rewards)}</div>
        <button class="act small" data-action="accept" data-qid="${mainQ.id}" ${atGiver && !state.activeQuest ? "" : "disabled"}>
          ${!atGiver ? `Travel to ${regionById(mainQ.regionId).name}` : state.activeQuest ? "Quest in progress" : "Accept"}
        </button>
      </div>`;
  }

  /* board */
  const board = state.questBoard[state.region] || [];
  html += `<h3 class="section-title">📋 ${currentRegion().name} Quest Board</h3>`;
  if (!board.length) html += `<p class="hint">No notices on the board right now. Check back later.</p>`;
  for (const bq of board) {
    html += `<div class="quest">
      <div class="quest-head"><span class="quest-title">${QUEST_CATEGORIES[bq.category].icon} ${bq.title}</span>${diffChip(bq.difficulty)}</div>
      <div class="quest-sub">${QUEST_CATEGORIES[bq.category].name} · ${bq.giver}</div>
      <p class="quest-desc">${bq.desc}</p>
      <div class="quest-reward">Rewards: ${rewardText(bq.rewards)}</div>
      <button class="act small" data-action="accept" data-qid="${bq.id}" ${state.activeQuest ? "disabled" : ""}>Accept</button>
    </div>`;
  }

  /* quest log */
  if (state.questLog.length) {
    html += `<h3 class="section-title">History</h3><ul class="quest-log">`;
    for (const entry of state.questLog.slice(0, 8)) {
      html += `<li class="${entry.result}">${diffChip(entry.difficulty)} ${entry.title} — <b>${entry.result}</b></li>`;
    }
    html += `</ul>`;
  }

  panel.innerHTML = html;
}

function rewardText(r) {
  const parts = [];
  if (r.silver) parts.push(`${r.silver} silver`);
  if (r.qi) parts.push(`${r.qi.toLocaleString()} qi`);
  if (r.xp) parts.push(`${r.xp} xp`);
  if (r.renown) parts.push(`+${r.renown} renown`);
  if (r.alignment) parts.push(`${r.alignment > 0 ? "+" : ""}${r.alignment} honor`);
  if (r.pills) parts.push(`${r.pills} pill`);
  if (r.manual) parts.push(MANUALS[r.manual].name);
  if (r.materials) for (const [m, c] of Object.entries(r.materials)) parts.push(`${c}× ${MATERIALS[m].name}`);
  if (r.standing) for (const [f, v] of Object.entries(r.standing)) parts.push(`${FACTIONS[f] ? FACTIONS[f].name : f} ${v > 0 ? "+" : ""}${v} standing`);
  return parts.length ? parts.join(", ") : "—";
}

function fmtDuration(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/* ============================== WORLD TAB ============================== */

function renderWorld() {
  const panel = document.querySelector('[data-panel="world"]');
  const region = currentRegion();
  let html = "";

  html += `<div class="region current-region">
    <div class="region-head"><span class="region-name">${region.name}</span><span class="tag">${region.type}</span></div>
    <p class="region-desc">${region.desc}</p>
    <div class="region-meta">
      <span>Faction: <b>${region.faction ? FACTIONS[region.faction].name : "None"}</b></span>
      <span>Enemy ranks: <b>${ENEMY_RANKS[region.rankIdx[0]].name} – ${ENEMY_RANKS[region.rankIdx[1]].name}</b></span>
      <span>Danger: <b class="danger-${regionDanger(region)}">${DANGER_LABEL[regionDanger(region)]}</b></span>
    </div>
    <div class="bar-block"><div class="bar-label"><span>Regional Unrest</span><span>${threatOf(region.id)}%</span></div>
      <div class="bar threat"><div class="fill" style="width:${threatOf(region.id)}%"></div></div></div>`;

  if (region.hub) {
    html += `<div class="hub-actions">
      <button class="act small" data-action="buyPill">Buy Pill (60 silver)</button>
      <button class="act small" data-action="sellMaterials">Sell All Goods</button>
    </div>`;
  }
  html += `</div>`;

  /* gathered materials */
  const mats = Object.entries(state.materials).filter(([, c]) => c > 0);
  if (mats.length) {
    html += `<h3 class="section-title">Satchel</h3><div class="material-list">`;
    for (const [id, c] of mats) html += `<span class="mat">${MATERIALS[id].name} ×${c}</span>`;
    html += `</div>`;
  }

  html += `<h3 class="section-title">The World</h3>`;
  for (const r of REGIONS) {
    const here = r.id === state.region;
    html += `<div class="region ${here ? "here" : ""}">
      <div class="region-head">
        <span class="region-name">${r.name}</span>
        <span class="tag">${r.type}</span>
        <span class="danger-${regionDanger(r)}">${DANGER_LABEL[regionDanger(r)]}</span>
      </div>
      <div class="region-meta">
        <span>${ENEMY_RANKS[r.rankIdx[0]].name}–${ENEMY_RANKS[r.rankIdx[1]].name}</span>
        <span>Rec. Realm: ${REALMS[r.recommendedRealm].name}</span>
        <span>Unrest: ${threatOf(r.id)}%</span>
      </div>
      ${here ? `<div class="hint">You are here.</div>` : `<button class="act small" data-action="travel" data-region="${r.id}">Travel</button>`}
    </div>`;
  }

  panel.innerHTML = html;
}
/* ============================== DUNGEONS TAB ============================== */

function dungeonDanger(site) {
  const [lo, hi] = site.rankIdx;
  const my = playerCombatRankIdx();
  if (my > hi + 1) return "trivial";
  if (my > hi) return "easy";
  if (my >= lo) return "fitting";
  if (my >= lo - 1) return "dangerous";
  return "deadly";
}

function dungeonSiteCard(site, secret) {
  const type = DUNGEON_TYPES[site.type];
  const danger = dungeonDanger(site);
  const canEnter = !state.enemy && !state.dungeon && site.region === state.region;
  const depth = type.minFloors === type.maxFloors ? `${type.minFloors}` : `${type.minFloors}–${type.maxFloors}`;
  return `<div class="dungeon-card${secret ? " secret" : ""}">
    <div class="dungeon-head">
      <span class="dungeon-name">${type.icon} ${site.name}</span>
      <span class="tag">${type.name}</span>
      <span class="danger-${danger}">${DANGER_LABEL[danger]}</span>
    </div>
    <p class="region-desc">${type.desc}</p>
    <div class="region-meta">
      <span>Guardians: <b>${ENEMY_RANKS[site.rankIdx[0]].name}–${ENEMY_RANKS[site.rankIdx[1]].name}</b></span>
      <span>Depth: ${depth} floors</span>
      ${site.inheritance ? `<span>Inheritance: <b>possible</b></span>` : ""}
      ${secret ? `<span class="tag gold">Closes in ${fmtDuration(secret.msLeft)}</span>` : ""}
    </div>
    <button class="act ${secret ? "primary" : ""} small" data-action="dungeonEnter" data-site="${site.id}" ${canEnter ? "" : "disabled"}>Enter Dungeon</button>
  </div>`;
}

function renderDungeons() {
  const panel = document.querySelector('[data-panel="dungeons"]');
  if (!panel || typeof dungeonAvailableSites !== "function") return;
  let html = "";
  const run = state.dungeon;

  if (run) {
    const type = DUNGEON_TYPES[run.type];
    html += `<div class="dungeon-run">
      <div class="dungeon-head">
        <span class="dungeon-name">${type.icon} ${run.name}</span>
        <span class="tag">${type.name}</span>
      </div>
      <div class="floor-line">Floor <b>${run.floor}</b> / ${run.floors} · ${run.cleared} cleared</div>
      <div class="floor-track">`;
    for (let i = 1; i <= run.floors; i++) {
      const kind = run.plan[i - 1];
      const icon = i === run.floors ? (run.type === "trial" ? "🗿" : "👑") : DUNGEON_ROOMS[kind].icon;
      const label = i === run.floors ? "Boss" : DUNGEON_ROOMS[kind].name;
      const done = i < run.floor || (i === run.floor && !state.enemy && run.awaiting);
      const cls = done ? "done" : i === run.floor ? "current" : "";
      html += `<span class="floor-dot ${cls}" title="Floor ${i}: ${label}">${icon}</span>`;
    }
    html += `</div>
      <div class="loot-line">Spoils this run (banked on exit): <b>${dungeonLootText(run.loot)}</b></div>`;
    if (state.enemy) {
      html += `<p class="hint">A guardian bars the way — resolve the battle to continue deeper.</p>`;
    } else if (run.awaiting) {
      html += `<div class="hub-actions">
        <button class="act primary small" data-action="dungeonDescend">Descend deeper</button>
        <button class="act small" data-action="dungeonRetreat">Retreat with spoils</button>
      </div>`;
    }
    html += `<p class="hint">Deeper floors mean deadlier guardians — and richer spoils. Die here and the run's unbanked spoils are lost.</p></div>`;
  } else {
    html += `<p class="hint">Dungeons hide treasure, lost martial inheritance, and things best left buried. Enter one from the region it dwells in — deeper floors mean richer spoils and deadlier guardians.</p>`;
  }

  const here = dungeonAvailableSites(state.region);
  html += `<h3 class="section-title">${currentRegion().name} — Entrances <span class="hint">(${here.length})</span></h3>`;
  if (!here.length) html += `<p class="hint">No dungeon entrances are known in this region.</p>`;
  else for (const { site, secret } of here) html += dungeonSiteCard(site, secret);

  const elsewhere = openSecretRealmList().filter((sr) => sr.regionId !== state.region);
  html += `<h3 class="section-title">Secret Realms Open Elsewhere <span class="hint">(${elsewhere.length})</span></h3>`;
  if (!elsewhere.length) html += `<p class="hint">None are open at present. Secret realms appear and seal again with the turning of the world.</p>`;
  else for (const sr of elsewhere) {
    html += `<div class="dungeon-card secret">
      <div class="dungeon-head"><span class="dungeon-name">🌌 ${sr.site.name}</span><span class="tag gold">Closes in ${fmtDuration(sr.msLeft)}</span></div>
      <div class="region-meta">
        <span>Opened in <b>${regionById(sr.regionId).name}</b></span>
        <span>Guardians: ${ENEMY_RANKS[sr.site.rankIdx[0]].name}–${ENEMY_RANKS[sr.site.rankIdx[1]].name}</span>
      </div>
      <p class="hint">Travel there before it seals.</p>
    </div>`;
  }

  html += `<p class="hint">Dungeons cleared: <b>${state.dungeonsCleared}</b>.</p>`;
  panel.innerHTML = html;
}

/* ============================== TECHNIQUES ============================== */

function renderTechniques() {
  const panel = document.querySelector('[data-panel="techniques"]');
  const held = state.manuals;

  let html = "";
  if ((state.qiDeviation || 0) > 0) {
    html += `<p class="warn">Qi deviation — your cultivation is disrupted for ${state.qiDeviation}s (qi recovery halved).</p>`;
  }
  const conf = activeConflicts();
  if (conf.length) {
    html += `<p class="warn">Technique conflict: ${conf.map((c) => c.note).join(" ")} (qi recovery and force reduced).</p>`;
  }

  html += "<h3 class='section-title'>Manuals in Hand</h3>";
  if (!held.length) {
    html += "<p class='hint'>Defeat enemies, plunder ruins, or trade with sects to find martial manuals.</p>";
  } else {
    html += "<ul class='list'>";
    held.forEach((manualId, i) => {
      const m = MANUALS[manualId];
      const tech = TECHNIQUES[m.teaches];
      const known = isLearned(m.teaches);
      const ok = canStudy(m.teaches);
      const missing = tech.requires.filter((r) => !isLearned(r)).map((r) => TECHNIQUES[r].name).join(", ");
      const clanBlock = tech.clan && state.bloodline !== tech.clan;
      const sectBlock = tech.sect && state.sect !== tech.sect;
      const frag = m.incomplete ? (state.techFragments[manualId] || 0) : 0;
      const incompleteBlock = m.incomplete && frag < m.pages;
      const note = known ? "Already known — study for qi &amp; mastery"
        : incompleteBlock ? `<span class='req'>Incomplete — ${frag}/${m.pages} pages recovered</span>`
        : ok ? `Teaches ${tech.name}` : clanBlock ? `<span class='req'>Requires ${gachaClanById(tech.clan).name} lineage</span>`
        : sectBlock ? `<span class='req'>Requires membership in the ${sectById(tech.sect).name}</span>`
        : `<span class='req'>Requires ${missing}</span>`;
      html += `<li>
        <span class="item-name">${m.name}<span class="item-desc">${note}</span></span>
        <button class="act small" data-action="study" data-index="${i}" ${!known && (!ok || incompleteBlock) ? "disabled" : ""}>${known ? "Study" : "Learn"}</button>
      </li>`;
    });
    html += "</ul>";
  }

  html += `<p class="hint">Mastery (1-${MASTERY_MAX}) grows through use — separate from cultivation rank. <b>Grade</b> is power; <b>rarity</b> is how hard a technique is to obtain.</p>`;

  const byCat = {};
  for (const id of Object.keys(TECHNIQUES)) (byCat[TECHNIQUES[id].category] || (byCat[TECHNIQUES[id].category] = [])).push(id);
  for (const catId of Object.keys(TECH_CATEGORIES)) {
    const ids = byCat[catId] || [];
    if (!ids.length) continue;
    html += `<h3 class='section-title'>${TECH_CATEGORIES[catId].name} <span class="hint">— ${TECH_CATEGORIES[catId].desc}</span></h3><div class="tree-group">`;
    for (const id of ids) {
      const t = TECHNIQUES[id];
      const known = isLearned(id);
      const unlocked = canStudy(id);
      const cls = known ? "known" : unlocked ? "" : "locked";
      const rar = techRarityObj(id);
      const mstr = known ? `<div class="mastery"><div class="bar"><div class="fill" style="width:${masteryBandPct(id)}%"></div></div><span>${masteryBandName(masteryOf(id))} ${masteryOf(id)}/${MASTERY_MAX}</span></div>` : "";
      const dmgText = !t.passive ? `${techDamage(id, stats()).toLocaleString()} dmg`
        : t.autoQi ? `+${t.autoQi} qi/s`
        : t.guard ? `guard ${Math.round(t.guard * 100)}%`
        : t.dodge ? "+dodge" : "passive";
      const status = known ? `<span class="tag gold">${t.type === "ultimate" ? "Ultimate" : "Learned"}</span>` : unlocked ? "<span class='tag'>Manual</span>" : "<span class='tag locked'>Locked</span>";
      html += `<div class="tree-node ${cls} rarity-${rar.cls}">
        <span class="item-name"><span class="tier rar">${rar.name}</span>${t.name}${t.type === "ultimate" ? " ★" : ""}
          <span class="item-desc">${techGradeLabel(id)} · ${t.type} · ${dmgText}</span>
          <span class="item-desc">${t.desc}</span>
          <span class="item-desc acq">Acquired: ${acquisitionText(id)}</span>
        </span>
        ${status}${mstr}
      </div>`;
    }
    html += "</div>";
  }
  panel.innerHTML = html;
}

function canStudy(techId) {
  const t = TECHNIQUES[techId];
  if (t.clan && state.bloodline !== t.clan) return false;
  if (t.sect && state.sect !== t.sect) return false;
  return t.requires.every((r) => isLearned(r));
}

/* ============================== SKILLS ============================== */

function skillLevel(id) { return state.skills[id] || 0; }
function skillCost(id) { return SKILLS[id].cost * (skillLevel(id) + 1); }
function skillUnlocked(id) { return SKILLS[id].req.every((r) => skillLevel(r) > 0); }

function renderSkills() {
  const panel = document.querySelector('[data-panel="skills"]');
  let html = `<p class="hint">Skill Points available: <b style="color:var(--gold)">${state.skillPoints}</b> · Earn 1 per level.</p>`;
  for (const branch of SKILL_BRANCHES) {
    const ids = Object.keys(SKILLS).filter((id) => SKILLS[id].branch === branch);
    html += `<div class="branch"><h4>${branch}</h4>`;
    for (const id of ids) {
      const s = SKILLS[id];
      const lvl = skillLevel(id);
      const maxed = lvl >= s.max;
      const unlocked = skillUnlocked(id);
      const cost = skillCost(id);
      const canLearn = unlocked && !maxed && state.skillPoints >= cost;
      const pips = Array.from({ length: s.max }, (_, i) => `<span class="pip ${i < lvl ? "on" : ""}"></span>`).join("");
      const reqText = unlocked ? "" : ` <span class="req">Requires ${s.req.map((r) => SKILLS[r].name).join(", ")}</span>`;
      html += `<div class="skill ${maxed ? "maxed" : lvl > 0 ? "owned" : ""}">
        <div class="skill-main">
          <div class="skill-name">${s.name}</div>
          <span class="item-desc">${s.desc}${reqText}</span>
          <div class="skill-pips">${pips}</div>
        </div>
        <button class="act small" data-action="skill" data-skill="${id}" ${canLearn ? "" : "disabled"}>${maxed ? "Maxed" : `Learn (${cost}sp)`}</button>
      </div>`;
    }
    html += "</div>";
  }
  panel.innerHTML = html;
}

/* ============================== EQUIPMENT ============================== */

function renderEquipment() {
  const panel = document.querySelector('[data-panel="equipment"]');
  let html = "<h3 class='section-title'>Equipped</h3><div class='slots'>";
  for (const slot of SLOTS) {
    const item = state.equipment[slot];
    html += `<div class="slot"><h5>${SLOT_LABEL[slot]}</h5>`;
    if (item) {
      html += `<div class="item-name rarity-${item.rarity}">${item.name}</div>
        <span class="item-desc">${RARITIES[item.rarity].name} · ${itemStatText(item)}</span>
        <button class="act small" style="margin-top:8px" data-action="unequip" data-slot="${slot}">Remove</button>`;
    } else {
      html += "<div class='empty'>— empty —</div>";
    }
    html += "</div>";
  }
  html += "</div>";

  html += "<h3 class='section-title'>Inventory</h3>";
  if (!state.inventory.length) {
    html += "<p class='hint'>No spare equipment. Hunt enemies to find gear.</p>";
  } else {
    html += "<ul class='list'>";
    state.inventory.forEach((item, i) => {
      html += `<li>
        <span class="item-name rarity-${item.rarity}">${item.name}<span class="item-desc">${RARITIES[item.rarity].name} · ${itemStatText(item)}</span></span>
        <span>
          <button class="act small" data-action="equip" data-index="${i}">Equip</button>
          <button class="act small" data-action="sell" data-index="${i}">Sell ${sellValue(item)}</button>
        </span>
      </li>`;
    });
    html += "</ul>";
  }
  panel.innerHTML = html;
}

/* ============================== FACTION TAB ============================== */

function renderFaction() {
  const panel = document.querySelector('[data-panel="faction"]');
  let html = "";

  html += `<p class="hint">Your clan is your <b>bloodline</b>, awakened through the <b>Clan</b> gacha. Standing with the world's factions shifts with your deeds.</p>`;

  /* standings */
  html += `<h3 class="section-title">Faction Standing</h3><ul class="standing-list">`;
  for (const [id, f] of Object.entries(FACTIONS)) {
    const v = state.standing[id] || 0;
    const sl = standingLevel(id);
    html += `<li><span>${f.name}</span><span class="standing-val ${sl.cls}">${sl.label} (${v})</span></li>`;
  }
  html += `</ul>`;
  html += `<p class="hint">Helping villages and defeating criminals raises your honor; harming the innocent lowers it. Reputation: <b>${reputationTitle()}</b> · Renown: <b>${renownTitle()}</b>.</p>`;

  /* sect standing */
  const knownSects = SECTS.filter((s) => state.sect === s.id || state.sectFlags["found_" + s.id] || (state.standing[s.id] || 0) !== 0);
  if (knownSects.length) {
    html += `<h3 class="section-title">Sect Standing</h3><ul class="standing-list">`;
    for (const s of knownSects) {
      const v = state.standing[s.id] || 0;
      const sl = standingLevel(s.id);
      html += `<li><span>${s.name}${state.sect === s.id ? ' <span class="tag gold">member</span>' : ""}</span><span class="standing-val ${sl.cls}">${sl.label} (${v})</span></li>`;
    }
    html += `</ul>`;
  }

  panel.innerHTML = html;
}

/* ============================== CLAN (GACHA) TAB ============================== */

function bonusText(bonus) {
  const labels = { attack: "ATK", maxHp: "HP", qiPerSec: "Qi/s", crit: "Crit", qiControl: "Qi Control", foundation: "Foundation", attackPct: "ATK", maxHpPct: "HP", gatherPct: "Gather", dmgPct: "Damage", dropPct: "Find", gearPct: "Gear Find", xpPct: "XP", dodgePct: "Dodge", gather: "Gather" };
  return Object.entries(bonus).map(([k, v]) => {
    const isPct = k === "crit" || k.endsWith("Pct");
    const pctVal = Math.round(((k === "crit" ? v : v) * 100) * 10) / 10;
    return `+${isPct ? pctVal + "%" : v} ${labels[k] || k}`;
  }).join(", ");
}

function clanCard(clan, owned) {
  const rar = CLAN_RARITIES[clan.rarity];
  const active = state.bloodline === clan.id;
  const count = state.clanInventory.filter((id) => id === clan.id).length;
  return `<div class="clan-card ${owned ? "" : "locked"} ${active ? "mine" : ""}">
    <h4 class="${rar.cls}">${clan.name} <span class="tag ${rar.cls}">${rar.name}</span>${active ? ' <span class="tag gold">Active</span>' : ""}</h4>
    <div class="clan-buff">${clan.spec} — ${clan.desc}</div>
    <p class="clan-flavor">${clan.flavor}</p>
  </div>`;
}

function renderLastSpin() {
  const ls = state.lastSpin;
  if (!ls || !ls.clan) return "";
  const c = ls.clan;
  const rar = CLAN_RARITIES[ls.rarity];
  if (ls.duplicate) {
    return `<div class="spin-result ${rar.cls}">
      <div class="spin-result-head"><span class="spin-tag ${rar.cls}">Duplicate · ${rar.name}</span></div>
      <h4 class="${rar.cls}">${c.name}</h4>
      <p>You already carry this bloodline — it dissolves into <b>${ls.essence} Clan Essence</b>.</p>
      <p class="hint">Essence: ${state.clanEssence} · Spins left: ${state.spins}</p>
    </div>`;
  }
  return `<div class="spin-result ${rar.cls}">
    <div class="spin-result-head"><span class="spin-tag ${rar.cls}">${rar.name}</span>${ls.first ? '<span class="spin-tag gold">First Bloodline</span>' : ""}</div>
    <h4 class="${rar.cls}">${c.name}</h4>
    <div class="clan-buff">${c.spec} — ${c.desc}</div>
    <p class="clan-flavor">"${c.flavor}"</p>
    <p class="hint">Spins left: ${state.spins}</p>
  </div>`;
}

function renderClanGacha() {
  const panel = document.querySelector('[data-panel="clan"]');
  if (!panel) return;
  let html = "";

  const bl = getBloodline();
  const bonus = clanTalentBonuses();

  html += `<div class="gacha-head">
    <div class="gacha-stat"><span class="num">${state.spins}</span><span class="lbl">Spins</span></div>
    <div class="gacha-stat"><span class="num">${state.clanEssence}</span><span class="lbl">Essence</span></div>
    <div class="gacha-stat"><span class="num">${state.spinsTotal}</span><span class="lbl">Total Spins</span></div>
  </div>`;

  html += `<div class="pity-bar"><span>Pity → Legendary: ${state.pityLegendary}/50</span><span>Mythical: ${state.pityMythical}/100</span></div>`;

  html += renderLastSpin();

  if (bl) {
    html += `<div class="clan-card mine">
      <h4 class="${CLAN_RARITIES[bl.rarity].cls}">${bl.name} <span class="tag ${CLAN_RARITIES[bl.rarity].cls}">${CLAN_RARITIES[bl.rarity].name}</span></h4>
      <div class="clan-buff">${bl.spec} — ${bl.desc}${state.bloodlineLevel ? ` <span class="tag gold">Infusion ${state.bloodlineLevel}</span>` : ""}</div>
      <p class="clan-flavor">${bl.flavor}</p>
      <button class="act small" data-action="toggleClanLock">${state.clanLocked ? "🔒 Locked" : "🔓 Unlocked"}</button>
    </div>`;
  } else {
    html += `<p class="hint">No bloodline awakened yet. Use a spin to roll your clan lineage.</p>`;
  }

  html += `<div class="talent-line">Talent: <b class="tag gold">${state.talent ? TALENTS[state.talent].name : "—"}</b>${state.talent ? ` <span class="hint">${TALENTS[state.talent].desc}</span>` : ""}</div>`;

  html += `<button class="act primary" data-action="spin" ${state.spins <= 0 ? "disabled" : ""}>Spin the Bloodline (${state.spins})</button>`;

  html += `<h3 class="section-title">Clan Essence</h3>
    <div class="essence-shop">
      <div class="shop-item"><div><b>${ESSENCE_SHOP.extraSpin.name}</b><span class="hint">${ESSENCE_SHOP.extraSpin.desc}</span></div><button class="act small" data-action="buySpin" ${state.clanEssence < ESSENCE_SHOP.extraSpin.cost ? "disabled" : ""}>${ESSENCE_SHOP.extraSpin.cost} ⬦</button></div>
      <div class="shop-item"><div><b>${ESSENCE_SHOP.rerollTalent.name}</b><span class="hint">${ESSENCE_SHOP.rerollTalent.desc} (${state.talent ? TALENTS[state.talent].name : "—"})</span></div><button class="act small" data-action="rerollTalent" ${state.clanEssence < ESSENCE_SHOP.rerollTalent.cost ? "disabled" : ""}>${ESSENCE_SHOP.rerollTalent.cost} ⬦</button></div>
      <div class="shop-item"><div><b>${ESSENCE_SHOP.infusion.name}</b><span class="hint">${ESSENCE_SHOP.infusion.desc} (Level ${state.bloodlineLevel || 0})</span></div><button class="act small" data-action="infuse" ${state.clanEssence < infusionCost() ? "disabled" : ""}>${infusionCost()} ⬦</button></div>
    </div>`;

  html += `<p class="hint">Active bonuses: ${Object.keys(bonus).length ? bonusText(bonus) : "none"}.</p>`;

  html += `<h3 class="section-title">Spin Settings</h3><div class="spin-settings">`;
  for (const key of ["epic", "legendary", "mythical"]) {
    const on = state.spinSettings[CONFIRM_KEYS[key]];
    html += `<label class="setting-row">
      <input type="checkbox" data-action="toggleConfirm" data-rarity="${key}" ${on ? "checked" : ""}>
      <span>Confirm before spinning away an active <b class="${CLAN_RARITIES[key].cls}">${CLAN_RARITIES[key].name}</b> bloodline</span>
    </label>`;
  }
  html += `</div>`;
  html += `<p class="hint">Disable a confirmation to spin quickly through high-rarity results without prompts.</p>`;

  html += `<h3 class="section-title">Bloodline Codex (${state.clanInventory.length}/${GACHA_CLANS.length})</h3>`;
  for (const key of RARITY_ORDER) {
    const clans = GACHA_CLANS.filter((c) => c.rarity === key);
    const rar = CLAN_RARITIES[key];
    const found = clans.filter((c) => state.clanInventory.includes(c.id)).length;
    html += `<details class="rarity-group"><summary class="${rar.cls}">${rar.name} — ${found}/${clans.length}</summary>`;
    for (const c of clans) html += clanCard(c, state.clanInventory.includes(c.id));
    html += `</details>`;
  }

  panel.innerHTML = html;
}

/* ============================== SECT TAB ============================== */

function sectRespText(sect) {
  const c = canJoinSect(sect.id);
  if (state.sect === sect.id) return '<span class="tag gold">Your Sect</span>';
  if (c.ok) return '<button class="act small" data-action="joinSect" data-sect="' + sect.id + '">Seek Admission</button>';
  return '<span class="req">' + c.reason + "</span>";
}

function renderSect() {
  const panel = document.querySelector('[data-panel="sect"]');
  if (!panel) return;
  let html = "";

  const my = currentSect();

  if (my) {
    const grade = sectGrade(my);
    const info = sectRankInfo(state.sectRank);
    const next = nextSectRank();
    html += `<div class="sect-card mine">
      <div class="sect-head"><h4>${my.name}</h4>
        <span class="tag ${my.type === "demonic" ? "worst" : "gold"}">${SECT_TYPES[my.type].name}</span>
        <span class="tag" style="color:${grade.color}">${grade.label} · ${grade.name}</span>
      </div>
      <div class="sect-buff">Rank ${info.rank}/10 — <b>${info.name}</b>. ${info.role}</div>
      <div class="sect-buff">Leader: ${my.leader} · Home: ${sectRegionName(my)}</div>
      <p class="clan-flavor">"${my.flavor}"</p>
      <div class="gacha-stat"><span class="num">${state.contribution}</span><span class="lbl">Contribution</span></div>`;

    if (next) {
      html += `<div class="sect-next">Next: <b>${next.name}</b> — ${next.req} contribution` +
        (sectCombatGateOk(next.rank) ? "" : ` <span class="req">(needs the strength of a ${ENEMY_RANKS[next.rank - 4].name})</span>`) + `</div>
        <div class="bar"><div class="fill" style="width:${pct(state.contribution, next.req)}%"></div></div>`;
    } else {
      html += `<div class="sect-next">You stand at the pinnacle of the ${my.name}.</div>`;
    }
    html += `<div class="hub-actions">
      <button class="act small" data-action="sectTrain">Train in the grounds</button>
      <button class="act small" data-action="sectRefresh">New missions</button>
      <button class="act small" data-action="leaveSect">Leave Sect</button>
    </div></div>`;

    if (my.rivals.length) {
      html += `<p class="hint">Rivals: ${my.rivals.map((r) => sectById(r).name).join(", ")}.</p>`;
    }

    /* missions */
    html += `<h3 class="section-title">Sect Missions</h3>`;
    if (!state.sectMissions.length) html += `<p class="hint">No missions available. Ask for new duties.</p>`;
    else {
      html += `<ul class="list">`;
      for (const m of state.sectMissions) {
        const prog = m.type === "kill" || m.type === "gather" ? `${Math.min(m.progress, m.target)}/${m.target}` : (m.type === "donate" ? `${m.target} silver` : `${m.target.toLocaleString()} qi`);
        const ready = m.type === "donate" ? state.silver >= m.target : m.type === "cultivate" ? state.qi >= m.target : m.done;
        html += `<li>
          <span class="item-name">${m.label}<span class="item-desc">${prog} · +${m.contrib} contribution</span></span>
          <button class="act small" data-action="sectTurnIn" data-id="${m.id}" ${ready ? "" : "disabled"}>${m.type === "donate" ? "Donate" : m.type === "cultivate" ? "Offer Qi" : "Turn In"}</button>
        </li>`;
      }
      html += `</ul>`;
    }

    /* shop */
    html += `<h3 class="section-title">Sect Exchange</h3><div class="essence-shop">`;
    for (const item of SECT_SHOP) {
      html += `<div class="shop-item"><div><b>${item.name}</b><span class="hint">${item.desc}</span></div>
        <button class="act small" data-action="sectShop" data-id="${item.id}" ${state.contribution < item.cost ? "disabled" : ""}>${item.cost} ⚑</button></div>`;
    }
    html += `</div>`;
    if (my.techniques.length) {
      html += `<p class="hint">Sect art: <b>${TECHNIQUES[my.techniques[0]].name}</b> — obtainable via the Sect Secret Art or as an inheritance.</p>`;
    }
    panel.innerHTML = html;
    return;
  }

  /* not in a sect: directory */
  html += `<p class="hint">Join a sect to train, earn contribution, climb ten ranks, and study sect-exclusive arts. Travel to a sect's home and seek admission.</p>`;
  for (const typeId of ["orthodox", "demonic", "hidden", "martial_clan"]) {
    const list = SECTS.filter((s) => s.type === typeId);
    if (!list.length) continue;
    html += `<h3 class="section-title">${SECT_TYPES[typeId].name} — ${SECT_TYPES[typeId].desc}</h3>`;
    for (const s of list) {
      const grade = sectGrade(s);
      const here = s.region === state.region;
      html += `<div class="sect-card ${here ? "here" : ""}">
        <div class="sect-head"><h4>${s.name}</h4>
          <span class="tag" style="color:${grade.color}">${grade.label} · ${grade.name}</span>
        </div>
        <div class="sect-buff">${s.desc}</div>
        <p class="clan-flavor">Leader: ${s.leader} · Home: ${sectRegionName(s)}</p>
        ${here ? '<div class="hint">You are here.</div>' : ""}
        ${sectRespText(s)}
      </div>`;
    }
  }
  panel.innerHTML = html;
}

/* ============================== JOURNAL TAB ============================== */

function sectNameOf(npc) {
  if (!npc.sect) return "Unaffiliated";
  const s = typeof sectById === "function" ? sectById(npc.sect) : null;
  return s ? s.name : npc.sect;
}

function npcCard(npc, reveal) {
  const st = state.npcs[npc.id] || {};
  const score = bondOf(npc.id);
  const band = bondBand(score);
  const type = BOND_TYPES[bondTypeOf(npc.id)];
  const region = npc.region && typeof regionById === "function" ? regionById(npc.region).name : npc.region;
  const standing = state.standing[npc.sect] || 0;

  if (!reveal) {
    return `<div class="npc-card unknown">
      <div class="npc-head"><h4>???</h4><span class="tag locked">Unknown</span></div>
      <div class="npc-line">A figure rumoured in ${region}.</div>
      <button class="act small" data-action="investigate" data-npc="${npc.id}">Investigate (20 silver)</button>
    </div>`;
  }

  const hist = (st.history || []).slice(0, 4).map((h) => `<li>${h.text}</li>`).join("");
  const benefits = bondBenefits(npc.id);
  const statusText = st.status && st.status !== "active" ? `<span class="tag ${st.status === "hunting" ? "worst" : "gold"}">${st.status}</span>` : "";
  const record = (st.wins || st.losses) ? `<div class="npc-line">Record vs you: <b>${st.wins || 0}W</b> / ${st.losses || 0}L</div>` : "";
  const actions = (typeof npcInteractions === "function" ? npcInteractions(npc.id) : [])
    .map((a) => `<button class="act small" data-action="${a.action}" data-npc="${npc.id}"${a.tier ? ` data-tier="${a.tier}"` : ""}${a.disabled ? " disabled" : ""}>${a.label}</button>`)
    .join("");

  return `<div class="npc-card ${band.cls}">
    <div class="npc-head"><h4>${npc.name}</h4>
      <span class="tag">${type.name}</span>${statusText}
    </div>
    <div class="npc-line">${npc.realm} · ${npc.role} · ${sectNameOf(npc)}</div>
    <div class="npc-line">Last known: ${region}${npc.sect ? ` · Sect standing: ${standing}` : ""}</div>
    <div class="npc-rel"><span class="standing-val ${band.cls}">${band.name}</span> <span class="hint">score ${score >= 0 ? "+" : ""}${score}</span></div>
    ${record}
    ${hist ? `<ul class="npc-hist">${hist}</ul>` : ""}
    ${benefits.length ? `<div class="npc-benefits">${benefits.map((b) => `<span class="tag gold">${b}</span>`).join(" ")}</div>` : ""}
    ${actions ? `<div class="npc-actions">${actions}</div>` : ""}
  </div>`;
}

function renderJournal() {
  const panel = document.querySelector('[data-panel="journal"]');
  if (!panel) return;
  const met = NPCS.filter((n) => isKnownToPlayer(n.id));
  const unmet = NPCS.filter((n) => !isKnownToPlayer(n.id));

  const by = { allies: [], rivals: [], enemies: [], figures: [] };
  for (const n of met) {
    const type = bondTypeOf(n.id);
    if (type === "rival") by.rivals.push(n);
    else if (type === "enemy" || type === "nemesis") by.enemies.push(n);
    else if (["ally", "friend", "close_friend", "sworn", "master", "disciple"].includes(type) || bondOf(n.id) >= 41) by.allies.push(n);
    else by.figures.push(n);
  }

  let html = `<p class="hint">Three layers: <b>bond score</b> (personal feeling), <b>relationship type</b> (rival, master, sworn…), and <b>faction standing</b> (a whole sect's view). The same person can be your friend while their sect calls you an enemy.</p>`;

  const section = (title, list, empty) => `<h3 class="section-title">${title} <span class="hint">(${list.length})</span></h3>` +
    (list.length ? list.map((n) => npcCard(n, true)).join("") : `<p class="hint">${empty}</p>`);

  html += section("Allies", by.allies, "No allies yet — help, protect, and keep your word.");
  html += section("Rivals", by.rivals, "No rivals yet.");
  html += section("Enemies", by.enemies, "No enemies have marked you… yet.");
  html += section("Known Figures", by.figures, "No other figures are known to you.");

  if (unmet.length) {
    html += `<h3 class="section-title">Unknown Figures <span class="hint">(${unmet.length})</span></h3>`;
    html += `<p class="hint">Rumours of those you have not yet met. Investigate to learn more.</p>`;
    html += unmet.slice(0, 8).map((n) => npcCard(n, false)).join("");
  }

  panel.innerHTML = html;
}

/* ============================== INFO TAB ============================== */

function renderInfo() {
  const panel = document.querySelector('[data-panel="info"]');
  let html = "";

  html += `<div class="info-block"><h4>Cultivation Realms — ${REALMS.length} × ${STAGES_PER_REALM} = ${REALMS.length * STAGES_PER_REALM} steps</h4>
    <p>Four <b>Tiers</b> contain the major <b>Realms</b>. Each realm has <b>9 Stages</b> (1–3 Early, 4–6 Middle, 7–8 Late, 9 Peak). Pay qi to advance stages; advance <i>realms</i> only via a successful <b>Breakthrough</b>.</p>`;
  let lastTier = null;
  for (let r = 0; r < REALMS.length; r++) {
    const realm = REALMS[r];
    if (realm.tier !== lastTier) {
      lastTier = realm.tier;
      html += `<h4 style="margin:12px 0 4px;color:var(--jade)">Tier ${realm.tier} — ${TIER_NAMES[realm.tier]} Realm</h4>`;
    }
    const isCur = r === state.realm;
    html += `<table class="realm-table" style="margin-bottom:6px">
      <tr><th colspan="2" style="${isCur ? "color:var(--gold)" : ""}">${r + 1}. ${realm.name}${isCur ? " ◄ you" : ""}</th><th style="text-align:right">Qi</th></tr>`;
    realm.stages.forEach((sn, si) => {
      const cur = isCur && state.stage - 1 === si;
      html += `<tr${cur ? " class='current'" : ""}><td>${si + 1}</td><td>${sn} <span style="color:var(--muted);font-size:11px">${stageGroup(si + 1)}</span></td><td class="num">${qiRequirement(r, si + 1).toLocaleString()}</td></tr>`;
    });
    html += "</table>";
  }
  html += `<p class="hint">A <b>Breakthrough</b> also needs <b>Pills</b>, enough <b>Qi Control</b>, a stable <b>Foundation</b>, and a successful attempt. Failures consume pills and raise Insight.</p></div>`;

  html += `<div class="info-block"><h4>Enemy Ranks &amp; Regions</h4>
    <p>Enemies belong to one of eight ranks — <b>Mortal → Trained Fighter → Martial Apprentice → Adept → Expert → Master → Grandmaster → Legendary</b>. Each region has a fixed rank range, so <b>weak foes stay weak</b> as you grow, and powerful foes in weak regions are rare. Wander into a high-rank region underleveled and you will die.</p></div>`;

  html += `<div class="info-block"><h4>Enemy Personalities</h4>
    <p>${Object.values(PERSONALITIES).map((p) => `<b>${p.name}</b> — ${p.desc}`).join("<br>")}</p></div>`;

  html += `<div class="info-block"><h4>Quests &amp; Difficulty</h4>
    <p>Six categories: Main Story, Bounty, Collection, Escort, Cultivation, Faction. Difficulty runs <b>${DIFFICULTY_ORDER.join(" → ")}</b> (${DIFFICULTY_ORDER.map((d) => DIFFICULTIES[d].name).join(", ")}). Bounties and timed jobs can <b>expire</b>; escorts can die; failed faction tasks cost standing — but you can always recover.</p></div>`;

  html += `<div class="info-block"><h4>Reputation &amp; Faction Standing</h4>
    <p>Two axes: <b>Honor</b> (righteous ↔ criminal) and <b>Renown</b> (fame). Each faction also tracks <b>Standing</b>. Criminals draw bounty hunters on the road; merchants refuse low-standing customers; sects remember betrayal.</p></div>`;

  html += `<div class="info-block"><h4>World Simulation</h4>
    <p>Lawless regions accumulate <b>Unrest</b> over time, escalating local enemy ranks. Cull bandits and their pressure falls; ignore them and roads grow deadly.</p></div>`;

  html += `<div class="info-block"><h4>Offline Progress</h4>
    <p>While closed you gather passive qi at <b>${OFFLINE_EFFICIENCY * 100}%</b> for up to <b>${OFFLINE_CAP_HOURS}h</b>.</p></div>`;

  panel.innerHTML = html;
}

/* ============================== LOG ============================== */

function renderLog() {
  const el = $("log");
  el.innerHTML = "";
  for (const entry of state.log) {
    const div = document.createElement("div");
    div.className = "entry " + (entry.kind || "");
    div.textContent = entry.text;
    el.appendChild(div);
  }
}

/* ============================== COMBAT ============================== */

function renderCombat() {
  const overlay = $("combatOverlay");
  if (!state.enemy) { overlay.hidden = true; return; }
  overlay.hidden = false;

  const e = state.enemy;
  const s = stats();
  const type = ENEMY_TYPES[e.typeId];

  $("enemyName").textContent = e.name;
  $("enemyRankChip").textContent = e.rankName;
  $("enemyTags").innerHTML =
    `<span class="etag">${type.name}</span>` +
    `<span class="etag">${e.personalityName}</span>` +
    (e.boss ? `<span class="etag boss">Boss</span>` : "") +
    (e.elite ? `<span class="etag elite">Elite</span>` : "") +
    (e.dungeon ? `<span class="etag">Dungeon · Floor ${e.dungeonFloor}</span>` : "");

  $("enemyHpText").textContent = `${Math.max(0, Math.floor(e.hp)).toLocaleString()} / ${e.maxHp.toLocaleString()}`;
  $("enemyHpFill").style.width = pct(e.hp, e.maxHp) + "%";

  const npcBar = $("npcBar");
  if (state.escort && state.escort.hp > 0) {
    npcBar.hidden = false;
    $("npcName").textContent = `Protect ${state.escort.name}`;
    $("npcHpText").textContent = `${Math.max(0, Math.floor(state.escort.hp))} / ${state.escort.maxHp}`;
    $("npcHpFill").style.width = pct(state.escort.hp, state.escort.maxHp) + "%";
  } else {
    npcBar.hidden = true;
  }

  $("combatHpText").textContent = `${Math.floor(state.hp).toLocaleString()} / ${s.maxHp.toLocaleString()}`;
  $("combatHpFill").style.width = pct(state.hp, s.maxHp) + "%";
  $("poisonTag").hidden = !(state.poison > 0);

  $("combatQiText").textContent = Math.floor(state.qi).toLocaleString();
  $("combatQiFill").style.width = pct(state.qi, Math.max(qiRequirement(state.realm, state.stage), 1)) + "%";

  const techs = $("combatTechs");
  techs.innerHTML = "";
  for (const id of state.techniques) {
    const t = TECHNIQUES[id];
    if (t.passive) continue;
    const ult = isUltimate(id);
    const cd = techCooldownLeft(id);
    const btn = document.createElement("button");
    const dmg = techDamage(id, s);
    btn.disabled = t.qiCost > state.qi || (ult && cd > 0);
    btn.dataset.action = "attack";
    btn.dataset.tech = id;
    const band = masteryBandName(masteryOf(id));
    const extra = ult && cd > 0 ? ` · recharging ${cd}` : t.qiCost ? ` · ${t.qiCost} qi` : " · free";
    btn.innerHTML = `${t.name}${ult ? " ★" : ""}<span class="cost">${dmg.toLocaleString()} dmg · ${band}${extra}</span>`;
    techs.appendChild(btn);
  }
  /* defensive guard action */
  const gid = bestGuardTech();
  const gt = gid ? TECHNIQUES[gid] : null;
  const gbtn = document.createElement("button");
  gbtn.dataset.action = "guard";
  if (gid) gbtn.dataset.tech = gid;
  gbtn.disabled = gt ? gt.qiCost > state.qi : false;
  gbtn.innerHTML = `Guard<span class="cost">${gt ? `${Math.round(guardReduction(gid) * 100)}% block · ${gt.qiCost} qi` : "brace yourself"}</span>`;
  techs.appendChild(gbtn);

  const cl = $("combatLog");
  cl.innerHTML = "";
  for (const entry of state.combatLog) {
    const div = document.createElement("div");
    div.className = "entry " + (entry.kind || "");
    div.textContent = entry.text;
    cl.appendChild(div);
  }
}

/* ============================== EVENT OVERLAY ============================== */

function openEvent(title, body, choices) {
  $("eventTitle").textContent = title;
  $("eventBody").textContent = body;
  const box = $("eventChoices");
  box.innerHTML = "";
  choices.forEach((c, i) => {
    const btn = document.createElement("button");
    btn.className = "act primary small";
    btn.textContent = c.label;
    btn.addEventListener("click", c.action);
    box.appendChild(btn);
  });
  $("eventOverlay").hidden = false;
}
function closeEvent() { $("eventOverlay").hidden = true; }

/* ============================== TABS ============================== */

function switchTab(tab) {
  document.querySelectorAll(".tab").forEach((el) => el.classList.toggle("active", el.dataset.tab === tab));
  document.querySelectorAll(".tab-panel").forEach((el) => { el.hidden = el.dataset.panel !== tab; });
}
