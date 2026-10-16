"use strict";

/* =====================================================================
   tournaments.js — the arena: a drifting leaderboard of named rivals,
   ranked duels, a regional meet, and a closed sect tournament. Ratings,
   seasons, and earned titles.
   ===================================================================== */

/* ============================== STATE ============================== */

function ensureArena() {
  if (!state.arena || typeof state.arena !== "object") state.arena = { rating: 1000, wins: 0, losses: 0, streak: 0, best: 1000 };
  if (typeof state.arena.rating !== "number") state.arena.rating = 1000;
  if (typeof state.arena.wins !== "number") state.arena.wins = 0;
  if (typeof state.arena.losses !== "number") state.arena.losses = 0;
  if (typeof state.arena.streak !== "number") state.arena.streak = 0;
  if (typeof state.arena.best !== "number") state.arena.best = state.arena.rating;
  if (!Array.isArray(state.titles)) state.titles = [];
  ensureLeaderboard();
  if (!state.season || typeof state.season !== "object") state.season = { index: 1, endsAt: Date.now() + ARENA_SEASON_MS };
}

function ensureLeaderboard(force) {
  if (!Array.isArray(state.leaderboard)) state.leaderboard = [];
  if (force || !state.leaderboard.length) {
    state.leaderboard = ARENA_RIVALS.map((r, i) => ({
      id: "r" + i, name: r.name, epithet: r.epithet, sect: r.sect,
      rating: 900 + Math.floor(Math.random() * 700),
    }));
  }
}

function leaderboardTick() {
  for (const e of state.leaderboard) e.rating = Math.max(600, e.rating + Math.floor((Math.random() - 0.45) * 16));
}

function playerRank() {
  const mine = state.arena.rating;
  let above = 0;
  for (const e of state.leaderboard) if (e.rating > mine) above++;
  return above + 1;
}

function nearestRival() {
  const mine = state.arena.rating;
  let best = null, bestD = Infinity;
  for (const e of state.leaderboard) {
    const d = Math.abs(e.rating - mine);
    if (d < bestD) { bestD = d; best = e; }
  }
  return best;
}

function resetSeason() {
  if (playerRank() === 1 && typeof grantTitle === "function") grantTitle("ranked_first");
  ensureLeaderboard(true);
  state.season = { index: (state.season.index || 1) + 1, endsAt: Date.now() + ARENA_SEASON_MS };
  addLog(`A new arena season begins (#${state.season.index}). The rankings reset.`, "gold");
}

function arenaTick() {
  ensureArena();
  leaderboardTick();
  if (Date.now() >= state.season.endsAt) resetSeason();
}

const arenaRecord = () => `${state.arena.wins}W / ${state.arena.losses}L`;

/* ============================== TITLES ============================== */

function grantTitle(id) {
  const t = TITLES[id];
  if (!t) return;
  if (!Array.isArray(state.titles)) state.titles = [];
  if (state.titles.some((x) => x.id === id)) return;
  state.titles.push({ id, name: t.name, when: Date.now() });
  addLog(`Title earned: ${t.name} — ${t.desc}`, "gold");
}

const hasTitle = (id) => Array.isArray(state.titles) && state.titles.some((x) => x.id === id);
const titleList = () => (Array.isArray(state.titles) ? state.titles : []);

/* ============================== RANKED DUELS ============================== */

function arenaDuel() {
  ensureArena();
  if (state.enemy) return;
  if (state.tournament) { addLog("Finish your tournament before challenging a duel.", "bad"); render(); return; }
  const rival = nearestRival();
  if (!rival) return;
  const rank = clamp(playerCombatRankIdx() + (rival.rating > state.arena.rating ? 1 : 0), 0, ENEMY_RANKS.length - 1);
  state.enemy = buildEnemy(currentRegion(), rank, "sect_member", pick(["honorable", "aggressive", "tactical"]), { name: rival.name, bossFlee: null });
  state.enemy.duel = { rivalId: rival.id, rivalName: rival.name, rivalRating: rival.rating };
  state.combatLog = [];
  addCombatLog(`${rival.name}, ${rival.epithet}, accepts your challenge (${state.enemy.rankName}).`, "bad");
  afterEnemySpawn();
  save(); render();
}

function onDuelResolved(won, enemy) {
  ensureArena();
  const d = enemy && enemy.duel;
  if (!d) return;
  const mine = state.arena.rating;
  const opp = d.rivalRating || mine;
  const expected = 1 / (1 + Math.pow(10, (opp - mine) / 400));
  const delta = Math.round(32 * ((won ? 1 : 0) - expected));
  state.arena.rating = Math.max(0, mine + delta);
  state.arena.best = Math.max(state.arena.best, state.arena.rating);
  if (won) { state.arena.wins += 1; state.arena.streak = (state.arena.streak || 0) + 1; grantTitle("duelist"); }
  else { state.arena.losses += 1; state.arena.streak = 0; }
  const entry = state.leaderboard.find((e) => e.id === d.rivalId);
  if (entry) {
    entry.rating = Math.max(400, entry.rating - delta);
    if (won && Math.random() < 0.25) { entry.epithet = "the Determined"; }
  }
  addLog(
    won ? `You win the ranked duel against ${d.rivalName}. Rating ${delta >= 0 ? "+" : ""}${delta} → ${state.arena.rating}.`
        : `You lose the ranked duel to ${d.rivalName}. Rating ${delta} → ${state.arena.rating}.`,
    won ? "good" : "bad"
  );
}

/* ============================== TOURNAMENTS ============================== */

function startTournament(kind) {
  ensureArena();
  const def = TOURNAMENTS[kind];
  if (!def) return;
  if (state.enemy) return;
  if (state.tournament) { addLog("You are already entered in a tournament.", "bad"); render(); return; }
  if (state.dungeon) { addLog("Finish your dungeon run first.", "bad"); render(); return; }
  if (def.id === "sect" && !state.sect) { addLog("You must belong to a sect to enter its tournament.", "bad"); render(); return; }
  state.tournament = { kind, name: def.name, rounds: def.rounds, entrants: def.entrants, wins: 0, opponents: [], round: 1 };
  addLog(`${def.name} begins! ${def.entrants} contenders enter — win ${def.rounds} bouts to be crowned champion.`, "gold");
  tournamentSpawn();
}

function tournamentSpawn() {
  const t = state.tournament;
  if (!t) return;
  const def = TOURNAMENTS[t.kind];
  const round = t.wins + 1;
  const rank = clamp(playerCombatRankIdx() + Math.floor((round - 1) * (def.rankScale || 1)), 0, ENEMY_RANKS.length - 1);
  const rival = pick(ARENA_RIVALS);
  t.opponents.push(rival.name);
  state.enemy = buildEnemy(currentRegion(), rank, "sect_member", pick(["honorable", "aggressive", "tactical"]), { name: rival.name, bossFlee: null });
  state.enemy.tournament = { round };
  state.combatLog = [];
  addCombatLog(`Round ${round}/${t.rounds}: ${rival.name}, ${rival.epithet} (${state.enemy.rankName}) steps forward.`, "bad");
  afterEnemySpawn();
  save(); render();
}

function onTournamentRoundWon(enemy) {
  const t = state.tournament;
  if (!t) return;
  t.wins += 1;
  t.round = t.wins + 1;
  const def = TOURNAMENTS[t.kind];
  if (t.wins >= def.rounds) { onTournamentEnd(true, enemy); return; }
  addLog(`You advance past round ${t.wins} of ${def.rounds} in the ${t.name}.`, "good");
  state._keepEnemy = true; /* let winCombat keep the freshly spawned opponent */
  tournamentSpawn();
}

function onTournamentEnd(champion, enemy, reason) {
  const t = state.tournament;
  if (!t) return;
  const def = TOURNAMENTS[t.kind];
  state.tournament = null;
  state._keepEnemy = false;
  state.enemy = null;
  state.poison = 0;
  if (champion) {
    const r = def.rewards || {};
    if (r.silver) state.silver += r.silver;
    if (r.qi) state.qi += r.qi;
    if (r.xp) gainXp(r.xp);
    if (r.renown) adjustReputation({ renown: r.renown });
    if (r.contribution && state.sect && typeof addContribution === "function") addContribution(r.contribution, "tournament victory");
    grantTitle(t.kind === "sect" ? "sect_champion" : "regional_champion");
    addLog(`🏆 Champion! You win the ${t.name}.`, "gold");
  } else {
    addLog(`${reason || "Defeat"} — you are out of the ${t.name}.${t.wins ? ` (Cleared ${t.wins} round(s).)` : ""}`, "bad");
  }
}

function tournamentForfeit() {
  if (!state.tournament) return;
  addLog("You withdraw from the tournament.", "bad");
  onTournamentEnd(false, null, "Withdrawal");
}
