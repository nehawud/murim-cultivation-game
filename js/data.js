"use strict";

/* =====================================================================
   data.js — static game data (realms, factions, regions, enemies,
   techniques, skills, equipment, quests). No logic here.
   ===================================================================== */

const STAGES_PER_REALM = 9;

/* ================================ REALMS ================================ */

const REALMS = [
  { tier: 1, name: "Body Tempering", stages: ["Skin Tempering", "Flesh Tempering", "Muscle Tempering", "Tendon Tempering", "Bone Tempering", "Organ Tempering", "Blood Tempering", "Marrow Tempering", "Body Perfection"] },
  { tier: 1, name: "Qi Gathering", stages: ["Initial Qi Gathering", "Qi Absorption", "Qi Accumulation", "Qi Circulation", "Qi Stabilization", "Qi Refinement", "Qi Consolidation", "Qi Saturation", "Peak Qi Gathering"] },
  { tier: 1, name: "Qi Refining", stages: ["Initial Refinement", "Basic Refinement", "Intermediate Refinement", "Advanced Refinement", "Deep Refinement", "Pure Qi Refinement", "Refined Qi Consolidation", "Perfect Refinement", "Peak Qi Refining"] },
  { tier: 1, name: "Qi Condensation", stages: ["Initial Condensation", "Qi Compression", "Dense Qi", "Stable Condensation", "Deep Condensation", "Pure Condensation", "Advanced Condensation", "Perfect Condensation", "Peak Qi Condensation"] },
  { tier: 2, name: "True Qi Realm", stages: ["Initial True Qi", "True Qi Formation", "True Qi Circulation", "True Qi Stabilization", "True Qi Refinement", "True Qi Consolidation", "Advanced True Qi", "Perfect True Qi", "Peak True Qi"] },
  { tier: 2, name: "Qi Manifestation", stages: ["Initial Manifestation", "External Qi Release", "Qi Projection", "Qi Reinforcement", "Qi Shield Formation", "Qi Blade Formation", "Advanced Manifestation", "Perfect Manifestation", "Peak Manifestation"] },
  { tier: 2, name: "Earth Realm", stages: ["Initial Earth", "Earth Foundation", "Earth Qi", "Earth Stabilization", "Earth Mastery", "Earth Consolidation", "Advanced Earth", "Perfect Earth", "Peak Earth"] },
  { tier: 2, name: "Heaven Realm", stages: ["Initial Heaven", "Heavenly Qi", "Heaven Foundation", "Heavenly Circulation", "Heavenly Reinforcement", "Heaven Comprehension", "Advanced Heaven", "Perfect Heaven", "Peak Heaven"] },
  { tier: 3, name: "Transcendent Realm", stages: ["Initial Transcendence", "Physical Transcendence", "Qi Transcendence", "Mental Transcendence", "Transcendent Foundation", "Transcendent Mastery", "Advanced Transcendence", "Perfect Transcendence", "Peak Transcendence"] },
  { tier: 3, name: "Martial Lord", stages: ["Initial Lord", "Lord Foundation", "Lord Qi", "Lord's Authority", "Lord Mastery", "Lord Consolidation", "Advanced Lord", "Perfect Lord", "Peak Martial Lord"] },
  { tier: 3, name: "Martial King", stages: ["Initial King", "King Foundation", "King Qi", "King's Authority", "King Domain", "King Mastery", "Advanced King", "Perfect King", "Peak Martial King"] },
  { tier: 3, name: "Martial Emperor", stages: ["Initial Emperor", "Emperor Foundation", "Emperor Qi", "Emperor's Authority", "Emperor Domain", "Emperor Mastery", "Advanced Emperor", "Perfect Emperor", "Peak Martial Emperor"] },
  { tier: 4, name: "Martial Saint", stages: ["Initial Saint", "Saint Foundation", "Saint Qi", "Saint Comprehension", "Saint Authority", "Saint Domain", "Advanced Saint", "Perfect Saint", "Peak Martial Saint"] },
  { tier: 4, name: "Martial Ancestor", stages: ["Initial Ancestor", "Ancestor Foundation", "Ancestor Qi", "Ancestor Comprehension", "Ancestor Authority", "Ancestor Domain", "Advanced Ancestor", "Perfect Ancestor", "Peak Martial Ancestor"] },
  { tier: 4, name: "Martial Sovereign", stages: ["Initial Sovereign", "Sovereign Foundation", "Sovereign Qi", "Sovereign Comprehension", "Sovereign Authority", "Sovereign Domain", "Advanced Sovereign", "Perfect Sovereign", "Peak Martial Sovereign"] },
];

const TIER_NAMES = { 1: "Mortal", 2: "Expert", 3: "Grandmaster", 4: "Legendary" };

/* ============================== TECHNIQUES ============================== */

/* --- taxonomy: category (purpose) --- */
const TECH_CATEGORIES = {
  fist:      { name: "Fist Arts",      desc: "Unarmed strikes and combos" },
  palm:      { name: "Palm Arts",      desc: "Powerful palm strikes and internal damage" },
  sword:     { name: "Sword Arts",     desc: "Sword attacks, combos, and sword intent" },
  saber:     { name: "Saber Arts",     desc: "Heavy slashes and destructive attacks" },
  spear:     { name: "Spear Arts",     desc: "Long-range melee and piercing attacks" },
  movement:  { name: "Movement Arts",  desc: "Dodging, speed, and footwork" },
  body:      { name: "Body Arts",      desc: "Physical strength and durability" },
  qi:        { name: "Qi Arts",        desc: "Qi control, blasts, and ranged attacks" },
  defensive: { name: "Defensive Arts", desc: "Blocking, barriers, and counterattacks" },
  internal:  { name: "Internal Arts",  desc: "Cultivation, Qi circulation, and recovery" },
  soul:      { name: "Soul Arts",      desc: "Perception, mental defense, spiritual attacks" },
  formation: { name: "Formation Arts", desc: "Traps, barriers, and coordinated combat" },
};

/* --- rarity: how hard a technique is to OBTAIN (distinct from grade) --- */
const TECH_RARITIES = {
  common:    { name: "Common",    cls: "r0" },
  uncommon:  { name: "Uncommon",  cls: "r1" },
  rare:      { name: "Rare",      cls: "r2" },
  epic:      { name: "Epic",      cls: "r3" },
  legendary: { name: "Legendary", cls: "r4" },
  mythical:  { name: "Mythical",  cls: "r5" },
  divine:    { name: "Divine",    cls: "r6" },
};

/* --- grade: overall quality/power (with Low/Middle/High/Peak) --- */
const TECH_GRADES = {
  mortal:   { name: "Mortal Grade",   mult: 0.00 },
  yellow:   { name: "Yellow Grade",   mult: 0.06 },
  profound: { name: "Profound Grade", mult: 0.14 },
  earth:    { name: "Earth Grade",    mult: 0.24 },
  heaven:   { name: "Heaven Grade",   mult: 0.38 },
  saint:    { name: "Saint Grade",    mult: 0.55 },
  emperor:  { name: "Emperor Grade",  mult: 0.75 },
  divine:   { name: "Divine Grade",   mult: 1.00 },
};
const TECH_SUBGRADES = { low: "Low", middle: "Middle", high: "High", peak: "Peak" };

/* --- mastery bands (1-100), independent of cultivation --- */
const MASTERY_BANDS = [
  { min: 1,   name: "Novice",      mult: 1.00 },
  { min: 20,  name: "Apprentice",  mult: 1.08 },
  { min: 40,  name: "Adept",       mult: 1.18 },
  { min: 60,  name: "Expert",      mult: 1.32, feature: "advanced moves" },
  { min: 80,  name: "Master",      mult: 1.50, feature: "enhanced variations" },
  { min: 100, name: "Grandmaster", mult: 1.80, feature: "ultimate form" },
];
const MASTERY_MAX = 100;

/* --- techniques that clash when held together (qi deviates) --- */
const TECH_CONFLICTS = [
  { a: "demon_cultivation", b: "void_breath",       note: "Demonic qi devours your serene void-breathing." },
  { a: "demon_cultivation", b: "primordial_qi",     note: "The Heavenly Demon Art corrupts primordial dragon qi." },
  { a: "demon_cultivation", b: "dragon_qi",         note: "Demonic qi and dragon-vein qi reject one another." },
  { a: "sect_blood_moon",   b: "sect_nine_heavens", note: "Blood-moon hunger withers the Nine Heavens breath." },
];

/* Each technique carries five defining properties:
   category, grade, qiCost, mastery progression, and acquisition requirements.
   type: active | passive | ultimate | internal (passive).                 */
const TECHNIQUES = {
  basic:        { name: "Basic Strike", school: "Foundation", tier: 0, requires: [], qiCost: 0, dmg: 8, category: "fist", rarity: "common", grade: "mortal", sub: "middle", type: "active", from: "Innate — known from birth.", desc: "A plain strike that costs no qi." },

  flowing_palm: { name: "Flowing Water Palm", school: "External", tier: 1, requires: ["basic"], qiCost: 10, dmg: 26, category: "palm", rarity: "common", grade: "mortal", sub: "high", type: "active", from: "Beginner manuals and masters.", desc: "A yielding palm that redirects force." },
  iron_fist:    { name: "Iron Fist", school: "External", tier: 2, requires: ["flowing_palm"], qiCost: 16, dmg: 46, category: "fist", rarity: "uncommon", grade: "yellow", sub: "middle", type: "active", from: "Bosses and sect libraries.", desc: "Condense qi into a crushing fist." },
  mountain_fist:{ name: "Mountain-Shattering Fist", school: "External", tier: 3, requires: ["iron_fist"], qiCost: 26, dmg: 84, category: "fist", rarity: "rare", grade: "profound", sub: "middle", type: "active", from: "Mountain clans and hidden ruins.", desc: "One blow that echoes like an avalanche." },
  thunder_palm: { name: "Thunderclap Palm", school: "External", tier: 3, requires: ["iron_fist"], qiCost: 34, dmg: 92, category: "palm", rarity: "rare", grade: "profound", sub: "high", type: "active", from: "Thunder sects and masters.", desc: "Discharge qi like a thunderclap." },
  nine_yang:    { name: "Nine Yang Divine Art", school: "External", tier: 4, requires: ["thunder_palm"], qiCost: 55, dmg: 170, category: "qi", rarity: "legendary", grade: "heaven", sub: "high", type: "active", from: "Inheritance trials of the old orthodox halls.", desc: "Overwhelming yang qi erupts." },

  iron_mountain_guard:{ name: "Iron Mountain Guard", school: "External", tier: 2, requires: ["iron_fist"], qiCost: 14, dmg: 0, category: "defensive", rarity: "rare", grade: "profound", sub: "middle", type: "active", guard: 0.30, from: "Iron Mountain Sect library.", desc: "Raise an immovable guard; blunt the next blow and counter." },
  eight_trigrams:{ name: "Eight Trigrams Formation", school: "External", tier: 3, requires: ["cloud_step"], qiCost: 20, dmg: 0, category: "formation", rarity: "rare", grade: "earth", sub: "low", type: "passive", guard: 0.12, from: "Formation masters and hidden ruins.", desc: "Subtle footwork-array that turns aside attacks." },

  cloud_step:   { name: "Cloud Step", school: "Internal", tier: 1, requires: ["basic"], qiCost: 0, dmg: 0, autoQi: 3, passive: true, category: "internal", rarity: "uncommon", grade: "yellow", sub: "low", type: "passive", from: "Beginner internal manuals.", desc: "Breathing art that gathers +3 qi/sec." },
  dragon_qi:    { name: "Dragon Vein Art", school: "Internal", tier: 2, requires: ["cloud_step"], qiCost: 0, dmg: 0, autoQi: 12, passive: true, category: "internal", rarity: "rare", grade: "earth", sub: "middle", type: "passive", from: "Masters and sect libraries.", desc: "Draw on the world's dragon veins: +12 qi/sec." },
  void_breath:  { name: "Void Breathing", school: "Internal", tier: 3, requires: ["dragon_qi"], qiCost: 0, dmg: 0, autoQi: 35, passive: true, category: "internal", rarity: "epic", grade: "heaven", sub: "low", type: "passive", from: "Hidden ruins; rarely, inheritance.", desc: "Breathe emptiness itself: +35 qi/sec." },
  blood_moon_scripture:{ name: "Blood Moon Scripture", school: "Internal", tier: 5, requires: ["dragon_qi"], qiCost: 0, dmg: 0, autoQi: 48, passive: true, category: "internal", rarity: "legendary", grade: "emperor", sub: "low", type: "passive", from: "Blood Moon Sect's deepest vault.", desc: "The moon's hunger circulates your qi: +48 qi/sec. (Conflicts with light arts)" },

  phantom_step: { name: "Phantom Step", school: "Internal", tier: 2, requires: ["cloud_step"], qiCost: 0, dmg: 0, passive: true, category: "movement", rarity: "rare", grade: "profound", sub: "low", type: "passive", dodge: 0.06, from: "Assassin halls and ruins.", desc: "Footwork that leaves after-images: +dodge (grows with mastery)." },
  golden_body:  { name: "Golden Body Scripture", school: "Internal", tier: 4, requires: ["iron_fist"], qiCost: 0, dmg: 0, passive: true, category: "body", rarity: "epic", grade: "earth", sub: "high", type: "passive", maxHpPct: 0.08, from: "Body-forging sects and bosses.", desc: "Temper flesh and bone: +8% max HP." },
  soul_sever:   { name: "Soul-Severing Gaze", school: "External", tier: 3, requires: ["basic"], qiCost: 30, dmg: 70, category: "soul", rarity: "epic", grade: "profound", sub: "peak", type: "active", from: "Soul sects; forbidden archives.", desc: "A spiritual assault that wounds the mind itself." },

  azure_sword:  { name: "Azure Sword Qi", school: "Sword", tier: 1, requires: ["basic"], qiCost: 24, dmg: 62, category: "sword", rarity: "uncommon", grade: "yellow", sub: "high", type: "active", from: "Sword sects and manuals.", desc: "A blade of condensed qi." },
  sword_qi:     { name: "Ten Thousand Sword Qi", school: "Sword", tier: 2, requires: ["azure_sword"], qiCost: 30, dmg: 104, category: "sword", rarity: "rare", grade: "profound", sub: "peak", type: "active", from: "Sword masters and bosses.", desc: "A storm of flying blades." },
  sword_immortal: { name: "Sword Immortal's Edge", school: "Sword", tier: 3, requires: ["sword_qi"], qiCost: 60, dmg: 200, category: "sword", rarity: "legendary", grade: "saint", sub: "middle", type: "active", from: "Inheritance trials of fallen sword immortals.", desc: "The heavens themselves are cut." },
  azure_dragon_sword:{ name: "Azure Dragon Sword Art", school: "Sword", tier: 5, requires: ["sword_qi"], qiCost: 70, dmg: 150, category: "sword", rarity: "legendary", grade: "heaven", sub: "peak", type: "ultimate", cooldown: 3, from: "Inheritance; ancient dragon ruins.", desc: "Ultimate: a coiling dragon of sword qi. (Ultimate — recharges)" },

  sect_blood_moon:   { name: "Blood Moon Art", school: "Saber", tier: 4, requires: ["nine_yang"], qiCost: 58, dmg: 188, category: "saber", rarity: "epic", grade: "heaven", sub: "middle", type: "active", sect: "blood_moon_sect", from: "Blood Moon Sect exchange.", desc: "Demonic art that drinks the foe's vitality." },
  nine_dragons_spear:{ name: "Nine Dragons Spear", school: "External", tier: 5, requires: ["nine_yang"], qiCost: 80, dmg: 210, category: "spear", rarity: "legendary", grade: "saint", sub: "low", type: "ultimate", cooldown: 4, from: "Inheritance trial of the spear sovereign.", desc: "Ultimate: nine successive thrusts, the last spending a flood of qi. (Ultimate)" },

  sect_iron_body:    { name: "Iron Mountain Scripture", school: "External", tier: 3, requires: ["iron_fist"], qiCost: 30, dmg: 112, category: "body", rarity: "epic", grade: "earth", sub: "middle", type: "active", sect: "iron_mountain_sect", from: "Iron Mountain Sect exchange.", desc: "Body-forging art of the Iron Mountain Sect." },

  heavenly_sword_intent: { name: "Heavenly Sword Intent", school: "Sword", tier: 5, requires: ["sword_qi"], qiCost: 45, dmg: 150, category: "sword", rarity: "mythical", grade: "emperor", sub: "high", type: "ultimate", cooldown: 3, clan: "heavenly_sword_clan", from: "Heavenly Sword bloodline only.", desc: "Ultimate sword intent of the Heavenly Sword bloodline. (Lineage · Ultimate)" },
  demon_cultivation:     { name: "Heavenly Demon Art", school: "External", tier: 5, requires: ["nine_yang"], qiCost: 70, dmg: 240, category: "qi", rarity: "mythical", grade: "divine", sub: "low", type: "active", clan: "heavenly_demon_clan", conflictNote: true, from: "Heavenly Demon bloodline only.", desc: "Demonic qi that devours all things. (Lineage · conflicts with light arts)" },
  primordial_qi:         { name: "Primordial Qi Art", school: "Internal", tier: 5, requires: ["void_breath"], qiCost: 0, dmg: 0, autoQi: 60, passive: true, category: "internal", rarity: "divine", grade: "divine", sub: "low", type: "passive", clan: "primordial_dragon_clan", from: "Primordial Dragon bloodline only.", desc: "The first breath of dragons: +60 qi/sec. (Lineage)" },

  /* ---- sect-exclusive techniques ---- */
  sect_sword:        { name: "Heavenly Sword Scripture", school: "Sword", tier: 4, requires: ["sword_qi"], qiCost: 42, dmg: 168, category: "sword", rarity: "epic", grade: "heaven", sub: "middle", type: "active", sect: "heavenly_sword_sect", from: "Heavenly Sword Sect exchange / inheritance.", desc: "The orthodox sword intent of the Heavenly Sword Sect." },
  sect_azure_lotus:  { name: "Azure Lotus Art", school: "Internal", tier: 4, requires: ["void_breath"], qiCost: 0, dmg: 0, autoQi: 45, passive: true, category: "internal", rarity: "epic", grade: "earth", sub: "high", type: "passive", sect: "azure_lotus_sect", from: "Azure Lotus Sect exchange / inheritance.", desc: "Azure Lotus breathing: +45 qi/sec." },
  sect_nine_heavens:{ name: "Nine Heavens Scripture", school: "Internal", tier: 5, requires: ["void_breath"], qiCost: 0, dmg: 0, autoQi: 72, passive: true, category: "internal", rarity: "legendary", grade: "heaven", sub: "high", type: "passive", sect: "nine_heavens_pavilion", from: "Nine Heavens Pavilion exchange / inheritance.", desc: "Lost breathing art of the hidden Nine Heavens Pavilion." },
  sect_silent_moon:  { name: "Silent Moon Art", school: "Sword", tier: 5, requires: ["sword_immortal"], qiCost: 66, dmg: 262, category: "sword", rarity: "legendary", grade: "saint", sub: "low", type: "active", sect: "silent_moon_sanctuary", from: "Silent Moon Sanctuary exchange / inheritance.", desc: "The moonlit sword art kept by the Silent Moon Sanctuary." },
};

const MANUALS = {
  m_flowing:       { name: "Flowing Water Manual", teaches: "flowing_palm" },
  m_cloud:         { name: "Cloud Step Manual", teaches: "cloud_step" },
  m_iron:          { name: "Iron Body Manual", teaches: "iron_fist" },
  m_azure:         { name: "Azure Sword Manual", teaches: "azure_sword" },
  m_thunder:       { name: "Thunder Sutra", teaches: "thunder_palm" },
  m_mountain:      { name: "Mountain Fist Manual", teaches: "mountain_fist" },
  m_dragon:        { name: "Dragon Vein Art", teaches: "dragon_qi" },
  m_nine:          { name: "Nine Yang Scripture", teaches: "nine_yang" },
  m_sword_qi:      { name: "Myriad Sword Manual", teaches: "sword_qi" },
  m_sword_immortal:{ name: "Sword Immortal's Testament", teaches: "sword_immortal" },
  m_void:          { name: "Void Heart Sutra", teaches: "void_breath" },
  m_blood_scripture:{ name: "Blood Moon Scripture", teaches: "blood_moon_scripture" },
  m_guard:         { name: "Iron Mountain Guard Manual", teaches: "iron_mountain_guard" },
  m_trigram:       { name: "Eight Trigrams Array Manual", teaches: "eight_trigrams" },
  m_phantom:       { name: "Phantom Step Manual", teaches: "phantom_step" },
  m_golden:        { name: "Golden Body Sutra", teaches: "golden_body" },
  m_soul:          { name: "Soul-Severing Scroll", teaches: "soul_sever" },
  m_dragon_sword:  { name: "Azure Dragon Sword Manual", teaches: "azure_dragon_sword" },
  m_dragonspear:   { name: "Nine Dragons Spear Manual", teaches: "nine_dragons_spear", incomplete: true, pages: 3 },
  m_heavenly_sword:{ name: "Heavenly Sword Scripture", teaches: "sect_sword" },
  m_azure_lotus:   { name: "Azure Lotus Manual", teaches: "sect_azure_lotus" },
  m_iron_mountain: { name: "Iron Mountain Manual", teaches: "sect_iron_body" },
  m_blood_moon:    { name: "Blood Moon Manual", teaches: "sect_blood_moon" },
  m_nine_heavens:  { name: "Nine Heavens Scripture", teaches: "sect_nine_heavens" },
  m_silent_moon:   { name: "Silent Moon Manual", teaches: "sect_silent_moon" },
};

/* ================================ SKILLS ================================ */

const SKILLS = {
  iron_bones:       { name: "Iron Bones", branch: "Body", max: 5, cost: 1, stat: "maxHp", per: 40, req: [], desc: "+40 max HP per rank." },
  tempered_flesh:   { name: "Tempered Flesh", branch: "Body", max: 5, cost: 2, stat: "maxHpPct", per: 0.08, req: ["iron_bones"], desc: "+8% max HP per rank." },
  firm_foundation:  { name: "Firm Foundation", branch: "Body", max: 5, cost: 2, stat: "foundation", per: 10, req: ["iron_bones"], desc: "+10 Foundation per rank (aids breakthroughs)." },
  battle_trance:    { name: "Battle Trance", branch: "Body", max: 3, cost: 3, stat: "attackPct", per: 0.10, req: ["tempered_flesh"], desc: "+10% attack per rank." },

  foundation_breath:{ name: "Foundation Breathing", branch: "Qi", max: 5, cost: 1, stat: "qiPerSec", per: 3, req: [], desc: "+3 qi/sec per rank." },
  qi_overflow:      { name: "Qi Overflow", branch: "Qi", max: 5, cost: 2, stat: "gatherPct", per: 0.10, req: ["foundation_breath"], desc: "+10% gathered qi per rank." },
  qi_control:       { name: "Qi Control", branch: "Qi", max: 5, cost: 2, stat: "qiControl", per: 10, req: ["foundation_breath"], desc: "+10 Qi Control per rank (aids breakthroughs)." },
  deep_meridians:   { name: "Deep Meridians", branch: "Qi", max: 5, cost: 2, stat: "qiPerSec", per: 9, req: ["foundation_breath"], desc: "+9 qi/sec per rank." },
  heavenly_veins:   { name: "Heavenly Veins", branch: "Qi", max: 3, cost: 3, stat: "qiPerSec", per: 25, req: ["deep_meridians"], desc: "+25 qi/sec per rank." },

  precise_strikes:  { name: "Precise Strikes", branch: "Martial", max: 5, cost: 1, stat: "attack", per: 4, req: [], desc: "+4 attack per rank." },
  deadly_focus:     { name: "Deadly Focus", branch: "Martial", max: 5, cost: 2, stat: "crit", per: 0.02, req: ["precise_strikes"], desc: "+2% crit chance per rank." },
  overwhelming:     { name: "Overwhelming Force", branch: "Martial", max: 3, cost: 3, stat: "dmgPct", per: 0.10, req: ["precise_strikes"], desc: "+10% technique damage per rank." },

  lucky_find:       { name: "Lucky Find", branch: "Fortune", max: 5, cost: 2, stat: "dropPct", per: 0.10, req: [], desc: "+10% manual drop chance per rank." },
  rich_qi:          { name: "Rich Qi", branch: "Fortune", max: 5, cost: 2, stat: "qiKillPct", per: 0.15, req: [], desc: "+15% qi gained from kills per rank." },
  hoarder:          { name: "Fortunate Soul", branch: "Fortune", max: 3, cost: 3, stat: "gearPct", per: 0.12, req: ["lucky_find"], desc: "+12% equipment drop chance per rank." },
};

const SKILL_BRANCHES = ["Body", "Qi", "Martial", "Fortune"];

/* =============================== FACTIONS =============================== */

const FACTIONS = {
  civilians:      { name: "Common Folk", type: "civilians", joinable: false, desc: "Villagers, farmers, and travelers of the realm.", flavor: "The humble people whose goodwill is the root of a righteous name." },
  merchant_guild: { name: "Riverside Merchant Guild", type: "guild", joinable: false, desc: "Traders who move goods and coin across the provinces.", flavor: "Coin opens more doors than swords — but only if your name is clean." },
  imperial_court: { name: "Imperial Court", type: "court", joinable: false, desc: "The empire's officials and enforcers.", flavor: "The law of the land, distant yet inescapable." },

  azure_dragon:   { name: "Azure Dragon Clan", type: "clan", joinable: true, buff: "attackPct", mag: 0.12, desc: "+12% attack", flavor: "Righteous and unyielding; their blades guard the realm." },
  white_lotus:    { name: "White Lotus Sect", type: "clan", joinable: true, buff: "gatherPct", mag: 0.15, desc: "+15% qi gathering", flavor: "Serene seekers who flow with the breath of the world." },
  iron_mountain:  { name: "Iron Mountain Sect", type: "clan", joinable: true, buff: "maxHpPct", mag: 0.18, desc: "+18% max HP", flavor: "Bodies like stone, unmoving beneath any storm." },
  shadow_pavilion:{ name: "Shadow Pavilion", type: "clan", joinable: true, buff: "crit", mag: 0.05, desc: "+5% crit chance", flavor: "Whispers in the dark; death arrives unseen." },
  heavenly_sword: { name: "Heavenly Sword Sect", type: "clan", joinable: true, buff: "dmgPct", mag: 0.12, desc: "+12% technique damage", flavor: "Their sword qi cleaves the clouds themselves." },
};

const CLAN_IDS = Object.keys(FACTIONS).filter((id) => FACTIONS[id].joinable);

/* ============================== EQUIPMENT ============================== */

const SLOTS = ["weapon", "armor", "charm"];
const SLOT_LABEL = { weapon: "Weapon", armor: "Armor", charm: "Charm" };

const EQUIP_BASES = {
  weapon: [
    { name: "Wooden Practice Blade", stats: { attack: 6 } },
    { name: "Iron Sword", stats: { attack: 12 } },
    { name: "Twin Hook Swords", stats: { attack: 16, crit: 0.02 } },
    { name: "Spirit Jade Staff", stats: { attack: 20, qiPerSec: 4 } },
    { name: "Demon Slayer Saber", stats: { attack: 26, crit: 0.03 } },
  ],
  armor: [
    { name: "Cloth Robe", stats: { maxHp: 40 } },
    { name: "Leather Armor", stats: { maxHp: 80 } },
    { name: "Iron Scale Armor", stats: { maxHp: 130, attack: 4 } },
    { name: "Black Tortoise Mail", stats: { maxHp: 200, foundation: 6 } },
  ],
  charm: [
    { name: "Jade Pendant", stats: { qiPerSec: 3 } },
    { name: "Tiger Eye Bead", stats: { crit: 0.03 } },
    { name: "Dragon Bone Charm", stats: { attack: 10, qiControl: 6 } },
    { name: "Phoenix Feather", stats: { qiPerSec: 8, maxHpPct: 0.06 } },
  ],
};

const RARITIES = [
  { name: "Common", mult: 1.0 },
  { name: "Uncommon", mult: 1.5 },
  { name: "Rare", mult: 2.2 },
  { name: "Epic", mult: 3.2 },
  { name: "Legendary", mult: 4.8 },
];

/* =============================== ENEMIES =============================== */

/* Enemy ranks — the world's combat ladder (independent of the player).
   Stats are region-anchored, so weak enemies stay weak as you grow. */
const ENEMY_RANKS = [
  { id: "mortal",      name: "Mortal",           threat: 1, hp: 60,   atk: 8,   qi: 20,   xp: 14,   power: 6 },
  { id: "trained",     name: "Trained Fighter",  threat: 2, hp: 120,  atk: 13,  qi: 40,   xp: 28,   power: 16 },
  { id: "apprentice",  name: "Martial Apprentice", threat: 3, hp: 220, atk: 20,  qi: 75,   xp: 46,   power: 32 },
  { id: "adept",       name: "Martial Adept",    threat: 4, hp: 360,  atk: 30,  qi: 125,  xp: 72,   power: 58 },
  { id: "expert",      name: "Martial Expert",   threat: 5, hp: 580,  atk: 46,  qi: 220,  xp: 115,  power: 96 },
  { id: "master",      name: "Martial Master",   threat: 6, hp: 920,  atk: 68,  qi: 350,  xp: 180,  power: 150 },
  { id: "grandmaster", name: "Grandmaster",      threat: 7, hp: 1550, atk: 100, qi: 560,  xp: 290,  power: 235 },
  { id: "legendary",   name: "Legendary",        threat: 8, hp: 2600, atk: 152, qi: 900,  xp: 470,  power: 360 },
];

/* Enemy types — flavor, stat modifiers, behavior pool, drop tables. */
const ENEMY_TYPES = {
  bandit: {
    name: "Bandit", hpMul: 1.0, atkMul: 1.0,
    behaviors: ["cowardly", "aggressive", "ruthless", "protective"],
    drops: ["copper", "stolen_goods", "cloth_scrap"],
    manuals: ["m_flowing", "m_iron"],
    goal: "Hunts the roads for coin and captives.",
  },
  assassin: {
    name: "Assassin", hpMul: 0.85, atkMul: 1.25,
    behaviors: ["cunning", "tactical", "ruthless"],
    drops: ["poison_vial", "concealed_blade"],
    manuals: ["m_cloud", "m_azure"],
    goal: "Strikes from the shadows for a contract.",
  },
  rogue_cultivator: {
    name: "Rogue Cultivator", hpMul: 1.0, atkMul: 1.08,
    behaviors: ["tactical", "cunning", "honorable"],
    drops: ["spirit_stone", "wild_herb"],
    manuals: ["m_azure", "m_dragon", "m_void"],
    goal: "Wanders in search of herbs, relics, and rivals.",
  },
  sect_member: {
    name: "Sect Disciple", hpMul: 1.1, atkMul: 1.1,
    behaviors: ["aggressive", "tactical", "protective", "honorable"],
    drops: ["sect_token", "cloth_scrap"],
    manuals: ["m_iron", "m_thunder", "m_sword_qi"],
    goal: "Guards their sect's territory and name.",
  },
  boss: {
    name: "Named Boss", hpMul: 1.7, atkMul: 1.3,
    behaviors: ["tactical", "ruthless", "aggressive"],
    drops: ["rare_material", "spirit_stone"],
    manuals: ["m_thunder", "m_nine", "m_sword_immortal"],
    goal: "A figure of legend with their own agenda.",
  },
};

/* Personalities — drive combat AI. */
const PERSONALITIES = {
  cowardly:   { name: "Cowardly",   desc: "Flees when badly injured.",           fleeHp: 0.30 },
  aggressive: { name: "Aggressive", desc: "Attacks relentlessly.",                atkMul: 1.25 },
  tactical:   { name: "Tactical",   desc: "Blocks and punishes mistakes.",        blockChance: 0.30 },
  cunning:    { name: "Cunning",    desc: "Uses traps and poison.",               poison: true, ambush: true },
  honorable:  { name: "Honorable",  desc: "Offers a formal duel; strikes true.",  atkMul: 1.1, noFlee: true },
  ruthless:   { name: "Ruthless",   desc: "Targets the vulnerable.",              lowHpBonus: 1.9 },
  protective: { name: "Protective", desc: "Calls for help when threatened.",      reinforce: true },
};

/* =============================== REGIONS =============================== */

/* rankIdx indexes into ENEMY_RANKS. recommendedRealm is informational —
   entering a high-ranked region as a low cultivator is a death sentence. */
const REGIONS = [
  {
    id: "willow_creek", name: "Willow Creek Village", type: "Village", faction: "civilians",
    rankIdx: [0, 1], recommendedRealm: 0, hub: false,
    enemyTypes: ["bandit"],
    materials: ["wild_herb", "copper"],
    desc: "A quiet farming village along a trade road. Something has been snatching travelers.",
  },
  {
    id: "northern_road", name: "The Northern Road", type: "Wilds", faction: "civilians",
    rankIdx: [1, 2], recommendedRealm: 1, hub: false,
    enemyTypes: ["bandit", "rogue_cultivator"],
    materials: ["copper", "wild_herb"],
    desc: "A rutted road through open hills, ideal for ambushes.",
  },
  {
    id: "blackwood_forest", name: "Blackwood Forest", type: "Forest", faction: "civilians",
    rankIdx: [1, 2], recommendedRealm: 1, hub: false,
    enemyTypes: ["bandit", "rogue_cultivator"],
    materials: ["wild_herb", "wild_herb", "iron_ore"],
    desc: "Dense pines hiding herbalist trails, hidden caves, and worse.",
  },
  {
    id: "riverside_city", name: "Riverside City", type: "City", faction: "merchant_guild",
    rankIdx: [1, 3], recommendedRealm: 2, hub: true,
    enemyTypes: ["bandit", "assassin"],
    materials: ["copper"],
    desc: "A bustling river port of merchants, auctions, and bounty offices.",
  },
  {
    id: "iron_mountain", name: "Iron Mountain Foothills", type: "Mountains", faction: "iron_mountain",
    rankIdx: [2, 4], recommendedRealm: 3, hub: false,
    enemyTypes: ["bandit", "sect_member", "rogue_cultivator"],
    materials: ["iron_ore", "iron_ore", "spirit_stone"],
    desc: "Ore-rich slopes patrolled by the Iron Mountain Sect.",
  },
  {
    id: "azure_territory", name: "Azure Sword Territory", type: "Sect Territory", faction: "azure_dragon",
    rankIdx: [3, 5], recommendedRealm: 5, hub: false,
    enemyTypes: ["sect_member", "assassin"],
    materials: ["spirit_stone", "wild_herb"],
    desc: "Disciplined sword halls and training grounds of the Azure Dragon Clan.",
  },
  {
    id: "shadow_marshes", name: "Shadow Pavilion Marshes", type: "Wilds", faction: "shadow_pavilion",
    rankIdx: [4, 6], recommendedRealm: 7, hub: false,
    enemyTypes: ["assassin", "rogue_cultivator"],
    materials: ["poison_vial", "wild_herb", "spirit_stone"],
    desc: "Fog-drowned wetlands where the Pavilion tests its blades.",
  },
  {
    id: "cloudveil_mountains", name: "Cloudveil Mountains", type: "Mountains", faction: "heavenly_sword",
    rankIdx: [5, 7], recommendedRealm: 9, hub: false,
    enemyTypes: ["rogue_cultivator", "sect_member"],
    materials: ["rare_material", "spirit_stone"],
    desc: "Peaks that pierce the clouds, claimed by the Heavenly Sword Sect.",
  },
  {
    id: "fallen_heaven", name: "Ruins of Fallen Heaven", type: "Forbidden", faction: null,
    rankIdx: [6, 7], recommendedRealm: 12, hub: false,
    enemyTypes: ["rogue_cultivator", "boss"],
    materials: ["rare_material", "spirit_stone", "spirit_stone"],
    desc: "A dead sect's shattered halls. Ancient dangers stir among the rubble.",
  },
];

/* ============================== MATERIALS ============================== */

const MATERIALS = {
  wild_herb:      { name: "Wild Herb",             kind: "herb",      value: 12, desc: "Common herb for salves and pills." },
  moonveil_herb:  { name: "Moonveil Herb",         kind: "herb",      value: 40, desc: "A pale blossom that glows under moonlight." },
  iron_ore:       { name: "Iron Ore",              kind: "ore",       value: 16, desc: "Raw iron for weapons and armor." },
  spirit_stone:   { name: "Spirit Stone",          kind: "cultivation", value: 55, desc: "Crystalline qi, prized by cultivators." },
  rare_material:  { name: "Ancient Relic Fragments", kind: "rare",    value: 160, desc: "Shards of a lost inheritance." },
  copper:         { name: "Copper Coins",          kind: "junk",      value: 5,  desc: "Spare change." },
  stolen_goods:   { name: "Stolen Goods",          kind: "junk",      value: 14, desc: "Merchandise recovered from bandits." },
  poison_vial:    { name: "Poison Vial",           kind: "consumable", value: 28, desc: "A dose of refined venom." },
  concealed_blade:{ name: "Concealed Blade",       kind: "weapon",    value: 34, desc: "A slim hidden weapon." },
  cloth_scrap:    { name: "Cloth Scrap",           kind: "junk",      value: 6,  desc: "Torn rags." },
  sect_token:     { name: "Sect Token",            kind: "token",     value: 30, desc: "Proof of defeating a sect member." },
};

/* ============================== QUESTS ============================== */

const QUEST_CATEGORIES = {
  main:      { name: "Main Story", color: "gold",  icon: "📜" },
  bounty:    { name: "Bounty",     color: "red",   icon: "🎯" },
  collection:{ name: "Collection", color: "green", icon: "🌿" },
  escort:    { name: "Escort",     color: "blue",  icon: "🛡️" },
  cultivation:{ name: "Cultivation", color: "purple", icon: "☯" },
  faction:   { name: "Faction",    color: "teal",  icon: "🏯" },
  morality:  { name: "Moral Path", color: "purple", icon: "⚖️" },
};

/* Difficulty ladder. rewardScale multiplies base rewards. */
const DIFFICULTIES = {
  E:  { name: "Trivial",      silver: [8, 18],    qi: 30,   xp: 18,   rewardScale: 1.0, rep: 1 },
  D:  { name: "Easy",         silver: [18, 40],   qi: 70,   xp: 40,   rewardScale: 1.5, rep: 2 },
  C:  { name: "Moderate",     silver: [40, 90],   qi: 160,  xp: 90,   rewardScale: 2.2, rep: 4 },
  B:  { name: "Hard",         silver: [90, 200],  qi: 380,  xp: 200,  rewardScale: 3.2, rep: 7 },
  A:  { name: "Extreme",      silver: [200, 450], qi: 850,  xp: 430,  rewardScale: 4.6, rep: 11 },
  S:  { name: "Calamity",     silver: [450, 900], qi: 1900, xp: 900,  rewardScale: 6.5, rep: 16 },
  SS: { name: "Catastrophic", silver: [900, 2000], qi: 4200, xp: 1900, rewardScale: 9.0, rep: 24 },
};

const DIFFICULTY_ORDER = ["E", "D", "C", "B", "A", "S", "SS"];

/* Named bosses that can appear / return. */
const NAMED_BOSSES = {
  black_fang: {
    name: "Black Fang", rankPreferred: "apprentice", type: "bandit",
    personality: "ruthless", desc: "A scarred outpost chief who knows when to run.",
  },
};

/* ============================== DUNGEONS & HIDDEN REALMS ============================== */

/* Dungeon kinds. floors are rolled between min/max on entry. */
const DUNGEON_TYPES = {
  ruins:        { name: "Ancient Ruins",     icon: "🏛️", minFloors: 3, maxFloors: 4, desc: "Sunken halls of a vanished sect, thick with dust, traps, and the dead who guard them." },
  secret_realm: { name: "Secret Realm",      icon: "🌌", minFloors: 4, maxFloors: 5, desc: "A pocket world that opens but rarely, its air dense with concentrated qi." },
  trial:        { name: "Inheritance Trial", icon: "🗿", minFloors: 5, maxFloors: 5, desc: "A dead master's final test, set to choose an heir for a lost art." },
  vault:        { name: "Guarded Vault",     icon: "🔒", minFloors: 2, maxFloors: 3, desc: "A hoard behind one terrible guardian; little to loot but the last room." },
};

/* Rooms that fill the floors between the entrance and the final boss. */
const DUNGEON_ROOMS = {
  combat:   { name: "Guardian Hall",       icon: "⚔️", weight: 32, desc: "A guardian stirs among the ruins." },
  elite:    { name: "Elite Chamber",       icon: "💀", weight: 14, desc: "A far deadlier foe waits here." },
  treasure: { name: "Treasure Cache",      icon: "💰", weight: 18, desc: "Spoils left by those who never returned." },
  hazard:   { name: "Trapped Passage",     icon: "⚠️", weight: 12, desc: "Old defenses still hunger." },
  rest:     { name: "Sealed Spring",       icon: "🕯️", weight: 10, desc: "A pocket of clean qi to recover in." },
  lore:     { name: "Ancient Inscription", icon: "📜", weight: 14, desc: "The wisdom of the fallen." },
};

/* Fixed dungeon entrances. rankIdx mirrors the enemy-rank ladder.
   inheritance = technique ids this site's trial can bestow on completion. */
const DUNGEON_SITES = [
  { id: "whispering_barrows",  name: "The Whispering Barrows",    type: "ruins",  region: "willow_creek",        rankIdx: [1, 2], inheritance: ["mountain_fist", "iron_mountain_guard"] },
  { id: "northern_catacombs",  name: "Northern Catacombs",        type: "ruins",  region: "northern_road",       rankIdx: [1, 3] },
  { id: "blackwood_hollow",    name: "Blackwood Hollow",          type: "ruins",  region: "blackwood_forest",    rankIdx: [2, 3], inheritance: ["phantom_step", "soul_sever"] },
  { id: "riverside_undercity", name: "Riverside Undercity",       type: "vault",  region: "riverside_city",      rankIdx: [2, 4], boss: "The Coin-Buried King" },
  { id: "iron_deepvein",       name: "Iron Deepvein",             type: "ruins",  region: "iron_mountain",       rankIdx: [3, 5], inheritance: ["golden_body", "sect_iron_body"] },
  { id: "azure_sepulcher",     name: "Azure Sepulcher",           type: "vault",  region: "azure_territory",     rankIdx: [4, 5], boss: "Blade-Spirit of the Azure Vault" },
  { id: "shadow_sunken_shrine",name: "The Sunken Shrine",         type: "trial",  region: "shadow_marshes",      rankIdx: [5, 6], inheritance: ["sword_qi", "sect_silent_moon"] },
  { id: "cloudveil_sky_tomb",  name: "Sky Tomb of Cloudveil",     type: "vault",  region: "cloudveil_mountains", rankIdx: [5, 7], boss: "The Cloud-Stepping Immortal" },
  { id: "fallen_heaven_crypt", name: "The Dead Sect's Crypt",     type: "ruins",  region: "fallen_heaven",       rankIdx: [6, 7] },
  { id: "fallen_heaven_trial", name: "Trial of Fallen Heaven",    type: "trial",  region: "fallen_heaven",       rankIdx: [6, 7], inheritance: ["nine_yang", "void_breath", "sword_immortal", "azure_dragon_sword"] },
];

/* Secret realms: not fixed to the map — they open in a region for a while, then close. */
const SECRET_REALMS = [
  { id: "sr_moonwell",     name: "The Moonwell Grotto",           type: "secret_realm", region: "blackwood_forest",    rankIdx: [2, 4], inheritance: ["sect_azure_lotus", "void_breath"] },
  { id: "sr_dragon_vein",  name: "Dragon Vein Nexus",             type: "secret_realm", region: "iron_mountain",       rankIdx: [3, 5], inheritance: ["dragon_qi"] },
  { id: "sr_sword_sea",    name: "Sea of Ten Thousand Swords",    type: "secret_realm", region: "azure_territory",     rankIdx: [4, 6], inheritance: ["sword_qi", "heavenly_sword_intent"] },
  { id: "sr_void_rift",    name: "Rift of the Void",              type: "secret_realm", region: "shadow_marshes",      rankIdx: [5, 7], inheritance: ["void_breath", "primordial_qi"] },
  { id: "sr_heaven_gate",  name: "The Gate of Fallen Heaven",     type: "secret_realm", region: "fallen_heaven",       rankIdx: [6, 7], inheritance: ["nine_yang", "sword_immortal"] },
];

/* Flavor lines for inscription (lore) rooms. */
const DUNGEON_LORE = [
  "a dying master scratches one last warning: do not trust the quiet.",
  "a wall of disciples' names, every one struck through.",
  "the founding oath of a sect that no longer exists.",
  "a crude map to a vault that has long since been looted.",
  "a promise carved in stone: the strong inherit, the rest remain.",
];

/* ============================== CLAN GACHA ============================== */

const CLAN_RARITIES = {
  common:    { name: "Common",    chance: 50,   dupEssence: 5,   cls: "rarity-0" },
  uncommon:  { name: "Uncommon",  chance: 25,   dupEssence: 10,  cls: "rarity-1" },
  rare:      { name: "Rare",      chance: 15,   dupEssence: 25,  cls: "rarity-2" },
  epic:      { name: "Epic",      chance: 7,    dupEssence: 60,  cls: "rarity-3" },
  legendary: { name: "Legendary", chance: 2.5,  dupEssence: 150, cls: "rarity-4" },
  mythical:  { name: "Mythical",  chance: 0.5,  dupEssence: 400, cls: "rarity-5" },
};
const RARITY_ORDER = ["common", "uncommon", "rare", "epic", "legendary", "mythical"];

const GACHA_CLANS = [
  /* ---- Common (10) ---- */
  { id: "chen",  name: "Chen Clan",  rarity: "common", spec: "Physical training", desc: "+5% training efficiency (XP)",  bonus: { xpPct: 0.05 }, flavor: "Sturdy bodies built through daily toil." },
  { id: "lin",   name: "Lin Clan",   rarity: "common", spec: "Swordsmanship", desc: "+5% technique damage", bonus: { dmgPct: 0.05 }, flavor: "A blade passed down for generations." },
  { id: "wang",  name: "Wang Clan",  rarity: "common", spec: "Endurance", desc: "+5% max HP", bonus: { maxHpPct: 0.05 }, flavor: "They simply do not fall." },
  { id: "zhao",  name: "Zhao Clan",  rarity: "common", spec: "Spearmanship", desc: "+5% attack", bonus: { attackPct: 0.05 }, flavor: "Reach beyond the sword's edge." },
  { id: "liu",   name: "Liu Clan",   rarity: "common", spec: "Agility", desc: "+3% dodge", bonus: { dodgePct: 0.03 }, flavor: "Gone before the blow lands." },
  { id: "feng",  name: "Feng Clan",  rarity: "common", spec: "Awareness", desc: "+5% find chance", bonus: { dropPct: 0.05 }, flavor: "Eyes that miss nothing." },
  { id: "huang", name: "Huang Clan", rarity: "common", spec: "Fist arts", desc: "+5 attack", bonus: { attack: 5 }, flavor: "Fists weathered like old stone." },
  { id: "sun",   name: "Sun Clan",   rarity: "common", spec: "Survival", desc: "+40 max HP", bonus: { maxHp: 40 }, flavor: "Endless vitality under the open sky." },
  { id: "guo",   name: "Guo Clan",   rarity: "common", spec: "Weapon crafting", desc: "+5% gear find chance", bonus: { gearPct: 0.05 }, flavor: "Smiths whose steel never dulls." },
  { id: "xu",    name: "Xu Clan",    rarity: "common", spec: "Meditation", desc: "+3 qi/sec", bonus: { qiPerSec: 3 }, flavor: "Stillness that gathers the world's breath." },

  /* ---- Uncommon (8) ---- */
  { id: "zhao_yue", name: "Zhao Yue Clan", rarity: "uncommon", spec: "Internal energy", desc: "+8 qi/sec", bonus: { qiPerSec: 8 }, flavor: "Their meridians drink deep of heaven and earth." },
  { id: "bai",      name: "Bai Clan",      rarity: "uncommon", spec: "Sword techniques", desc: "+8% technique damage", bonus: { dmgPct: 0.08 }, flavor: "White blades that move like snowfall." },
  { id: "he",       name: "He Clan",       rarity: "uncommon", spec: "Body refinement", desc: "+7% max HP", bonus: { maxHpPct: 0.07 }, flavor: "Flesh tempered into armor." },
  { id: "tang",     name: "Tang Clan",     rarity: "uncommon", spec: "Hidden weapons", desc: "+4% crit", bonus: { crit: 0.04 }, flavor: "Death arrives from an unexpected angle." },
  { id: "qiao",     name: "Qiao Clan",     rarity: "uncommon", spec: "Movement arts", desc: "+6% dodge", bonus: { dodgePct: 0.06 }, flavor: "Steps that leave no trace." },
  { id: "ning",     name: "Ning Clan",     rarity: "uncommon", spec: "Medical arts", desc: "+60 max HP", bonus: { maxHp: 60 }, flavor: "Healers who know every meridian." },
  { id: "luo",      name: "Luo Clan",      rarity: "uncommon", spec: "Spear formations", desc: "+8% attack", bonus: { attackPct: 0.08 }, flavor: "Discipline turned into a wall of spears." },
  { id: "yu",       name: "Yu Clan",       rarity: "uncommon", spec: "Mental discipline", desc: "+8 Foundation", bonus: { foundation: 8 }, flavor: "Will as unshakable as a mountain." },

  /* ---- Rare (7) ---- */
  { id: "yun",  name: "Yun Clan",  rarity: "rare", spec: "Qi manipulation", desc: "+12 qi/sec", bonus: { qiPerSec: 12 }, flavor: "Cloud qi that never stops flowing." },
  { id: "han",  name: "Han Clan",  rarity: "rare", spec: "Ice-based martial arts", desc: "+8% technique damage", bonus: { dmgPct: 0.08 }, flavor: "Frost spreads from every strike." },
  { id: "shen", name: "Shen Clan", rarity: "rare", spec: "Internal force", desc: "+10 Qi Control", bonus: { qiControl: 10 }, flavor: "Absolute mastery over their own dantian." },
  { id: "mo",   name: "Mo Clan",   rarity: "rare", spec: "Shadow techniques", desc: "+8% dodge", bonus: { dodgePct: 0.08 }, flavor: "They fight from within the dark." },
  { id: "xue",  name: "Xue Clan",  rarity: "rare", spec: "Bloodline refinement", desc: "+10% XP", bonus: { xpPct: 0.10 }, flavor: "Their blood remembers ancient strength." },
  { id: "lei",  name: "Lei Clan",  rarity: "rare", spec: "Thunder-style combat", desc: "+10% technique damage", bonus: { dmgPct: 0.10 }, flavor: "Lightning answers their call." },
  { id: "jin",  name: "Jin Clan",  rarity: "rare", spec: "Weapon mastery", desc: "+8% attack", bonus: { attackPct: 0.08 }, flavor: "Every weapon becomes an extension of the arm." },

  /* ---- Epic (5) ---- */
  { id: "heavenly_spear",    name: "Heavenly Spear Clan",    rarity: "epic", spec: "Spear supremacy", desc: "+12% attack", bonus: { attackPct: 0.12 }, flavor: "One spear, ten thousand armies." },
  { id: "crimson_phoenix",   name: "Crimson Phoenix Clan",   rarity: "epic", spec: "Recovery and vitality", desc: "+10% max HP, +5 qi/sec", bonus: { maxHpPct: 0.10, qiPerSec: 5 }, flavor: "Reborn from every wound." },
  { id: "obsidian_mountain", name: "Obsidian Mountain Clan", rarity: "epic", spec: "Defensive martial arts", desc: "+12% max HP", bonus: { maxHpPct: 0.12 }, flavor: "Immovable as the black peaks." },
  { id: "nine_shadows",      name: "Nine Shadows Clan",      rarity: "epic", spec: "Assassination", desc: "+12% damage, +4% crit", bonus: { dmgPct: 0.12, crit: 0.04 }, flavor: "Nine shadows, one death." },
  { id: "azure_lotus",       name: "Azure Lotus Clan",       rarity: "epic", spec: "Qi refinement", desc: "+12 Qi Control", bonus: { qiControl: 12 }, flavor: "A pure lotus in a sea of qi." },

  /* ---- Legendary (4) ---- */
  { id: "azure_dragon_clan", name: "Azure Dragon Clan",     rarity: "legendary", spec: "Physical supremacy", desc: "+15% XP, +10% max HP", bonus: { xpPct: 0.15, maxHpPct: 0.10 }, flavor: "Blood of the azure dragon runs hot." },
  { id: "heavenly_sword_clan", name: "Heavenly Sword Clan", rarity: "legendary", spec: "Sword intent", desc: "+15% technique damage", bonus: { dmgPct: 0.15 }, flavor: "Sword intent that splits the heavens." },
  { id: "thunder_sovereign", name: "Thunder Sovereign Clan", rarity: "legendary", spec: "Lightning Qi", desc: "+15% technique damage", bonus: { dmgPct: 0.15 }, flavor: "The storm bows to their blood." },
  { id: "celestial_phoenix", name: "Celestial Phoenix Clan", rarity: "legendary", spec: "Vitality and recovery", desc: "+15% max HP, +10 qi/sec", bonus: { maxHpPct: 0.15, qiPerSec: 10 }, flavor: "Life burns eternal within them." },

  /* ---- Mythical (2) ---- */
  { id: "primordial_dragon_clan", name: "Primordial Dragon Clan", rarity: "mythical", spec: "Primordial Qi", desc: "+15 qi/sec, +10 Qi Control", bonus: { qiPerSec: 15, qiControl: 10 }, flavor: "A bloodline older than the mountains." },
  { id: "heavenly_demon_clan",    name: "Heavenly Demon Clan",    rarity: "mythical", spec: "Demonic cultivation", desc: "+15% damage, +10% XP", bonus: { dmgPct: 0.15, xpPct: 0.10 }, flavor: "Devour all creation and grow." },
];

const gachaClanById = (id) => GACHA_CLANS.find((c) => c.id === id);

/* ============================== TALENTS ============================== */

const TALENTS = {
  dull:      { name: "Dull",             tier: 0, bonus: { xpPct: -0.10 }, desc: "Slow comprehension (-10% XP)." },
  ordinary:  { name: "Ordinary",         tier: 1, bonus: {}, desc: "Standard progression." },
  gifted:    { name: "Gifted",           tier: 2, bonus: { xpPct: 0.10 }, desc: "Improved learning (+10% XP)." },
  genius:    { name: "Genius",           tier: 3, bonus: { xpPct: 0.20, dmgPct: 0.05 }, desc: "Exceptional comprehension (+20% XP, +5% damage)." },
  peerless:  { name: "Peerless",         tier: 4, bonus: { xpPct: 0.30, dmgPct: 0.10 }, desc: "Extraordinary potential (+30% XP, +10% damage)." },
  heavenly:  { name: "Heavenly Prodigy", tier: 5, bonus: { xpPct: 0.50, dmgPct: 0.15, qiControl: 10 }, desc: "Exceptional across all disciplines (+50% XP, +15% damage, +10 Qi Control)." },
};
const TALENT_WEIGHTS = [["dull", 15], ["ordinary", 40], ["gifted", 25], ["genius", 12], ["peerless", 6], ["heavenly", 2]];

/* ============================== CLAN RIVALRIES ============================== */

/* clanId -> faction ids whose members regard it as a rival. */
const CLAN_RIVALS = {
  azure_dragon_clan:  ["shadow_pavilion"],
  heavenly_sword_clan: ["shadow_pavilion"],
  nine_shadows:       ["azure_dragon"],
  obsidian_mountain:  ["heavenly_sword"],
  heavenly_demon_clan: ["azure_dragon", "heavenly_sword", "white_lotus"],
};

/* ============================== ESSENCE SHOP ============================== */

const ESSENCE_SHOP = {
  extraSpin:  { name: "Extra Spin",        cost: 100, desc: "Convert essence into one clan spin." },
  rerollTalent: { name: "Re-roll Talent",  cost: 150, desc: "Roll a new personal talent." },
  infusion:   { name: "Bloodline Infusion", costFactor: 200, desc: "Strengthen your clan's passive (+10% of its value per level)." },
};


/* ============================== SECTS ============================== */

const SECT_TYPES = {
  orthodox:    { name: "Orthodox", desc: "Follow martial honor and discipline; protect the weak." },
  demonic:     { name: "Demonic", desc: "Forbidden arts and brutal hierarchies where strength rules." },
  hidden:      { name: "Hidden", desc: "Concealed sanctuaries holding lost techniques and manuals." },
  martial_clan:{ name: "Martial Clan", desc: "Hereditary bloodline organizations passing down secret arts." },
};

/* Ordered weakest -> strongest. */
const SECT_GRADE_ORDER = ["5", "4", "3", "2", "1", "sacred", "ancient", "legendary"];
const SECT_GRADES = {
  "5":       { label: "Grade 5", name: "Small Local Sect",        tier: 0, color: "#8fa08f" },
  "4":       { label: "Grade 4", name: "Regional Sect",           tier: 1, color: "#8fd3a0" },
  "3":       { label: "Grade 3", name: "Provincial Sect",         tier: 2, color: "#5aa0e6" },
  "2":       { label: "Grade 2", name: "Major Sect",              tier: 3, color: "#b06fe6" },
  "1":       { label: "Grade 1", name: "World-Class Sect",        tier: 4, color: "#e6b34f" },
  sacred:    { label: "Sacred",  name: "Sect of Saint-Level Power", tier: 5, color: "#d0554a" },
  ancient:   { label: "Ancient", name: "Centuries-Old Organization", tier: 6, color: "#d0554a" },
  legendary: { label: "Legendary", name: "Multi-Region Hegemon",   tier: 7, color: "#d0554a" },
};

/* The ten ranks a disciple can climb. req = contribution needed. */
const SECT_RANKS = [
  { rank: 1,  name: "Outer Disciple",   role: "Beginner; basic training.",                 req: 0 },
  { rank: 2,  name: "Inner Disciple",   role: "Access to better techniques.",              req: 100 },
  { rank: 3,  name: "Core Disciple",    role: "Elite student with rare resources.",         req: 300 },
  { rank: 4,  name: "Elite Disciple",   role: "Among the sect's strongest students.",       req: 700 },
  { rank: 5,  name: "True Disciple",    role: "Personally selected by an elder or leader.", req: 1500 },
  { rank: 6,  name: "Personal Disciple",role: "Trained directly by an elder or master.",    req: 3000 },
  { rank: 7,  name: "Sect Elder",       role: "Oversees disciples and sect affairs.",       req: 6000 },
  { rank: 8,  name: "Grand Elder",      role: "Veteran expert with considerable authority.",req: 10000 },
  { rank: 9,  name: "Vice Sect Master", role: "Second-in-command.",                         req: 16000 },
  { rank: 10, name: "Sect Master",      role: "Leader of the entire sect.",                 req: 25000 },
];

const SECTS = [
  /* ---- Orthodox ---- */
  {
    id: "heavenly_sword_sect", name: "Heavenly Sword Sect", type: "orthodox", grade: "2",
    region: "cloudveil_mountains", leader: "Sword Saint Yun Lian",
    desc: "The preeminent orthodox sword sect; its disciples cleave clouds with sword intent.",
    flavor: "A blade raised for the realm, not for the self.",
    rivals: ["blood_moon_sect", "heavenly_demon_sect"],
    techniques: ["sect_sword"], manuals: ["m_heavenly_sword"],
    reqCombatRank: 3,
  },
  {
    id: "azure_lotus_sect", name: "Azure Lotus Sect", type: "orthodox", grade: "3",
    region: "azure_territory", leader: "Lotus Elder Qing",
    desc: "Serene upholders of qi refinement and inner balance.",
    flavor: "Still water runs deepest.",
    rivals: ["blood_moon_sect"],
    techniques: ["sect_azure_lotus"], manuals: ["m_azure_lotus"],
    reqCombatRank: 2,
  },
  {
    id: "iron_mountain_sect", name: "Iron Mountain Sect", type: "orthodox", grade: "3",
    region: "iron_mountain", leader: "Mountain Lord Tie",
    desc: "Stalwart body-forgers who hold mountain passes against all comers.",
    flavor: "Stone does not bend.",
    rivals: ["heavenly_demon_sect"],
    techniques: ["sect_iron_body"], manuals: ["m_iron_mountain"],
    reqCombatRank: 2,
  },
  {
    id: "white_lotus_sect", name: "White Lotus Sect", type: "orthodox", grade: "4",
    region: "azure_territory", leader: "Matron Suyin",
    desc: "Humble healers and seekers of the world's breath.",
    flavor: "The lotus blooms from the mud.",
    rivals: [],
    techniques: [], manuals: ["m_cloud"],
    reqCombatRank: 1,
  },

  /* ---- Demonic ---- */
  {
    id: "blood_moon_sect", name: "Blood Moon Sect", type: "demonic", grade: "2",
    region: "blackwood_forest", leader: "Blood Sovereign Leng",
    desc: "Demonic cult that drains life essence to fuel their ascension.",
    flavor: "The moon rises red, and the rivers run still.",
    rivals: ["heavenly_sword_sect", "azure_lotus_sect"],
    techniques: ["sect_blood_moon"], manuals: ["m_blood_moon"],
    reqCombatRank: 3,
  },
  {
    id: "heavenly_demon_sect", name: "Heavenly Demon Sect", type: "demonic", grade: "1",
    region: "fallen_heaven", leader: "Heavenly Demon Lord",
    desc: "The darkest of the demonic sects; strength alone earns rank.",
    flavor: "Devour the heavens and grow.",
    rivals: ["heavenly_sword_sect", "iron_mountain_sect"],
    techniques: ["demon_cultivation"], manuals: ["m_nine"],
    reqCombatRank: 5,
  },

  /* ---- Hidden ---- */
  {
    id: "nine_heavens_pavilion", name: "Nine Heavens Pavilion", type: "hidden", grade: "ancient",
    region: "fallen_heaven", leader: "Pavilion Keeper (unknown)",
    desc: "A concealed pavilion preserving lost breathing arts from an elder age.",
    flavor: "Few find it. Fewer return unchanged.",
    rivals: [],
    techniques: ["sect_nine_heavens"], manuals: ["m_nine_heavens"],
    reqCombatRank: 6, hidden: true,
  },
  {
    id: "silent_moon_sanctuary", name: "Silent Moon Sanctuary", type: "hidden", grade: "sacred",
    region: "cloudveil_mountains", leader: "The Silent One",
    desc: "A moonlit sanctuary hidden in the high peaks, master of the Silent Moon sword.",
    flavor: "Silence is the sharpest edge.",
    rivals: [],
    techniques: ["sect_silent_moon"], manuals: ["m_silent_moon"],
    reqCombatRank: 6, hidden: true,
  },

  /* ---- Martial Clans ---- */
  {
    id: "heavenly_spear_clan_sect", name: "Heavenly Spear Clan", type: "martial_clan", grade: "3",
    region: "azure_territory", leader: "Spear Patriarch Fang",
    desc: "A hereditary spear clan; only those of the Heavenly Spear blood may join.",
    flavor: "One spear, ten thousand armies.",
    rivals: ["primordial_dragon_clan_sect"],
    techniques: [], manuals: ["m_iron"], bloodline: "heavenly_spear",
    reqCombatRank: 1,
  },
  {
    id: "primordial_dragon_clan_sect", name: "Primordial Dragon Clan", type: "martial_clan", grade: "legendary",
    region: "fallen_heaven", leader: "Dragon Ancestor",
    desc: "An ancient bloodline clan whose qi predates the mountains.",
    flavor: "Older than the mountains, hungrier than the sea.",
    rivals: ["heavenly_spear_clan_sect"],
    techniques: ["primordial_qi"], manuals: ["m_void"], bloodline: "primordial_dragon_clan",
    reqCombatRank: 4, hidden: true,
  },
  {
    id: "shadow_pavilion_sect", name: "Shadow Pavilion", type: "hidden", grade: "2",
    region: "shadow_marshes", leader: "The Faceless",
    desc: "Assassins and spies; membership is a secret even from other members.",
    flavor: "You never see the blade that ends you.",
    rivals: ["heavenly_sword_sect"],
    techniques: [], manuals: ["m_cloud"],
    reqCombatRank: 3,
  },
  {
    id: "celestial_phoenix_clan_sect", name: "Celestial Phoenix Clan", type: "martial_clan", grade: "1",
    region: "blackwood_forest", leader: "Phoenix Matriarch",
    desc: "A bloodline clan of peerless vitality; only Phoenix blood may enter.",
    flavor: "We are reborn from every defeat.",
    rivals: ["blood_moon_sect"],
    techniques: [], manuals: ["m_flowing"], bloodline: "celestial_phoenix",
    reqCombatRank: 4,
  },
];

const sectById = (id) => SECTS.find((s) => s.id === id) || null;

/* Contribution-purchasable items (spec starting values). */
const SECT_SHOP = [
  { id: "sh_manual_basic",   name: "Basic Cultivation Manual", cost: 100,   kind: "manual", ref: "m_flowing",       desc: "The Flowing Water Manual." },
  { id: "sh_pill_heal",      name: "Healing Pill",             cost: 150,   kind: "pill",   ref: null,              amount: 2, desc: "Two Breakthrough Pills." },
  { id: "sh_manual_inter",   name: "Intermediate Technique",   cost: 1000,  kind: "manual", ref: "m_iron",          desc: "The Iron Body Manual." },
  { id: "sh_manual_adv",     name: "Advanced Cultivation Manual", cost: 5000, kind: "manual", ref: "m_nine",        desc: "The Nine Yang Scripture." },
  { id: "sh_weapon",         name: "Sect-Forged Weapon",       cost: 2500,  kind: "weapon", ref: null,              desc: "A high-quality rolling weapon." },
  { id: "sh_secret",         name: "Sect Secret Art",          cost: 25000, kind: "technique", ref: null,           desc: "The sect's signature art (a manual for your sect technique)." },
  { id: "sh_material",       name: "Rare Materials Cache",     cost: 600,   kind: "material", ref: "spirit_ore",   amount: 3, desc: "A cache of spirit ore." },
];

/* Sect mission templates drawn from the board. */
const SECT_MISSION_TEMPLATES = [
  { type: "kill",        label: "Cull intruders in {region}",  contrib: 60,  stat: "kills" },
  { type: "gather",      label: "Gather supplies for the sect", contrib: 45, stat: "gathers" },
  { type: "donate",      label: "Donate silver to the sect",   contrib: 40,  stat: "silver" },
  { type: "cultivate",   label: "Seclude yourself and cultivate", contrib: 70, stat: "qi" },
];

/* ============================== BONDS & RELATIONSHIPS ==============================

   Three connected systems, kept deliberately separate:
     1) BOND SCORE        (-100..+100) — trust / hostility / personal feeling.
     2) RELATIONSHIP TYPE — the nature of the connection (rival, master, sworn...).
     3) FACTION REPUTATION— already tracked via state.standing (a whole sect's view).
   A friendly rival can hate your guts personally while their sect admires you, or
   vice versa, because the three layers never collapse into one number.        */

/* Relationship TYPE — the NATURE of the connection (separate from score). */
const BOND_TYPES = {
  stranger:     { name: "Stranger",            desc: "Has little or no knowledge of you." },
  acquaintance: { name: "Acquaintance",        desc: "Knows who you are." },
  ally:         { name: "Ally",                desc: "Cooperates with you toward shared goals." },
  friend:       { name: "Friend",              desc: "Trusts you and may offer assistance." },
  close_friend: { name: "Close Friend",        desc: "High trust; may risk something to help you." },
  sworn:        { name: "Sworn Brother/Sister",desc: "A special bond formed by ceremony or great event." },
  master:       { name: "Master",              desc: "Teaches you techniques and cultivation." },
  disciple:     { name: "Disciple",            desc: "Learns from you and may follow your teachings." },
  rival:        { name: "Rival",               desc: "Competes with you and seeks to surpass you." },
  enemy:        { name: "Enemy",               desc: "Opposes you because of conflicting interests." },
  nemesis:      { name: "Nemesis",             desc: "Holds a deep grudge and may pursue revenge." },
  neutral:      { name: "Neutral",             desc: "Has no strong feelings toward you." },
};

/* Relationship SCORE bands (-100..+100). */
const BOND_BANDS = [
  { min: -100, max: -81, name: "Nemesis",       cls: "b-nemesis" },
  { min: -80,  max: -51, name: "Hostile Enemy",  cls: "b-enemy" },
  { min: -50,  max: -21, name: "Dislikes You",   cls: "b-dislike" },
  { min: -20,  max: 20,  name: "Neutral",        cls: "b-neutral" },
  { min: 21,   max: 40,  name: "Acquaintance",   cls: "b-acq" },
  { min: 41,   max: 60,  name: "Friendly",       cls: "b-friendly" },
  { min: 61,   max: 80,  name: "Trusted Ally",   cls: "b-ally" },
  { min: 81,   max: 99,  name: "Close Bond",     cls: "b-close" },
  { min: 100,  max: 100, name: "Absolute Trust", cls: "b-trust" },
];

/* Concrete actions that shift a bond. Weights encode consequence: betraying a
   sworn sibling (-80) dwarfs a refused favor (-5). */
const BOND_ACTIONS = {
  quest_helped:     { delta: 12,  label: "You saw a difficult task through for them" },
  saved_life:       { delta: 30,  label: "You saved their life" },
  protected_sect:   { delta: 25,  label: "You protected their sect" },
  shared_resource:  { delta: 8,   label: "You shared cultivation resources" },
  fought_alongside: { delta: 10,  label: "You fought alongside them" },
  kept_promise:     { delta: 10,  label: "You kept your word" },
  gave_rare_gift:   { delta: 18,  label: "You gave them a rare technique or treasure" },
  small_favor:      { delta: 4,   label: "You did them a small favor" },
  spared_them:      { delta: 15,  label: "You spared their life" },
  refused_favor:    { delta: -5,  label: "You refused a small favor" },
  broke_promise:    { delta: -20, label: "You broke a promise" },
  stole_from:       { delta: -25, label: "You stole from them" },
  defeated_rival:   { delta: -8,  label: "You defeated them in open competition" },
  humiliated:       { delta: -30, label: "You humiliated them publicly" },
  attacked_kin:     { delta: -40, label: "You harmed their friends or family" },
  betrayed_sect:    { delta: -45, label: "You betrayed their sect" },
  abandoned:        { delta: -28, label: "You abandoned them during an important mission" },
  betrayed_sworn:   { delta: -80, label: "You betrayed a sworn sibling" },
  reconciled:       { delta: 35,  label: "You made peace and set old grudges aside" },
  trained_with_them:{ delta: 3,   label: "You trained under their guidance" },
  sparred_friendly: { delta: 2,   label: "You crossed blades in a friendly spar" },
};

/* Gifts — silver spent, bond gained, with diminishing returns per person. */
const BOND_GIFTS = [
  { tier: "token",    name: "Small Token",     cost: 10,  gain: 3 },
  { tier: "fine",     name: "Fine Gift",       cost: 60,  gain: 9 },
  { tier: "treasure", name: "Cultivation Treasure", cost: 250, gain: 22 },
];

/* Realm label for a sect grade, so leader NPCs read sensibly. */
function realmNameForGrade(grade) {
  const map = {
    "5": "Qi Refining", "4": "Qi Condensation", "3": "True Qi Realm", "2": "Earth Realm",
    "1": "Heaven Realm", sacred: "Transcendent Realm", ancient: "Martial Lord", legendary: "Martial Saint",
  };
  return map[grade] || "Qi Gathering";
}

/* Named figures the player can form bonds with. Sect leaders are folded in below. */
const NPCS = [
  { id: "elder_rong",    name: "Elder Rong",         realm: "Qi Gathering",   sect: null,                region: "willow_creek",     role: "Village Elder",    known: true,  tags: ["story"] },
  { id: "herbalist_yun", name: "Herbalist Yun",       realm: "Qi Refining",    sect: null,                region: "willow_creek",     role: "Herbalist",        known: true,  tags: ["quest"] },
  { id: "caravan_lao",   name: "Caravan Master Lao",  realm: "True Qi Realm",  sect: null,                region: "northern_road",    role: "Caravan Master",   known: true,  tags: ["quest"] },
  { id: "meditation_wu", name: "Meditation Master Wu",realm: "Earth Realm",    sect: null,                region: "riverside_city",   role: "Meditation Master",known: false, tags: ["master"] },
  { id: "jin_wei",       name: "Jin Wei",             realm: "Qi Gathering",   sect: null,                region: "riverside_city",   role: "Prodigy",          known: true,  rival: true, tags: ["rival"] },
  { id: "mei_lin",       name: "Mei Lin",             realm: "Qi Condensation",sect: "azure_lotus_sect",  region: "azure_territory",  role: "Disciple",         known: false, rival: true, tags: ["rival"] },
  { id: "scar_butcher",  name: "Scar the Butcher",    realm: "True Qi Realm",  sect: null,                region: "blackwood_forest", role: "Bandit Chief",     known: true,  important: true, tags: ["villain"] },
];

/* Sect leaders are known figures too — hidden until the player investigates. */
for (const s of SECTS) {
  NPCS.push({
    id: "npc_" + s.id, name: s.leader, realm: realmNameForGrade(s.grade), sect: s.id,
    region: s.region, role: "Sect Leader", known: false, important: true, tags: ["leader"],
  });
}

const npcById = (id) => NPCS.find((n) => n.id === id) || null;

/* ============================== KARMA & MORALITY ==============================

   A morality LEDGER atop alignment. Alignment (-100..100) is the axis;
   karma tallies the notable deeds that pushed you along it; bounty turns
   notoriety into a hunted name; path is the label the world uses for you. */

const KARMA_PATHS = {
  heroic:  { name: "Heroic Path",  icon: "☀️", cls: "good",  desc: "The righteous way: shield the weak and punish the wicked. Righteous sects open their gates; the hunted grow bold in your presence." },
  neutral: { name: "Neutral Path", icon: "☯️", cls: "",      desc: "You walk your own road, owing nothing to heaven or hell. Few doors close; few open wide." },
  demonic: { name: "Demonic Path", icon: "🌑", cls: "worst", desc: "The dark way: seize all, spare none. Demonic sects welcome you; honest merchants bar their doors and bounty hunters gather." },
};

/* Wanted tiers scale the bounty price on your head and how hard the jianghu hunts you. */
const WANTED_LEVELS = [
  { level: 0, min: 0,   name: "Clean Record", hunterChance: 0,    desc: "No price on your head." },
  { level: 1, min: 60,  name: "Suspect",      hunterChance: 0.12, desc: "Local enforcers keep watch for you." },
  { level: 2, min: 180, name: "Outlaw",       hunterChance: 0.28, desc: "Bounty hunters trail your steps." },
  { level: 3, min: 420, name: "Most Wanted",  hunterChance: 0.45, desc: "The whole jianghu hunts you openly." },
];

/* Notable evil deeds — tracked via bond actions and own-sect killings. */
const KARMA_EVIL_ACTIONS = {
  betrayed_sworn: { evil: 24, bounty: 160, label: "betraying a sworn sibling" },
  betrayed_sect:  { evil: 18, bounty: 120, label: "betraying a sect" },
  attacked_kin:   { evil: 14, bounty: 90,  label: "harming the kin of another" },
  humiliated:     { evil: 10, bounty: 60,  label: "public cruelty" },
  stole_from:     { evil: 8,  bounty: 40,  label: "theft from a bond" },
  abandoned:      { evil: 6,  bounty: 30,  label: "abandoning a companion" },
};

/* Notable righteous deeds. */
const KARMA_GOOD_ACTIONS = {
  saved_life:   { good: 12, renown: 8, label: "saving a life" },
  spared_them:  { good: 8,  renown: 4, label: "showing mercy" },
  kept_promise: { good: 5,  renown: 3, label: "keeping your word" },
};

/* Path-exclusive deeds posted to the region board. */
const PATH_QUEST_TEMPLATES = {
  heroic: [
    { title: "Purge the Wicked",   giver: "Righteous Magistrate", type: "kill", typeId: "bandit",       count: 3, alignment: 6,  renown: 8,  desc: "A magistrate asks you to thin the lawless haunting {region}." },
    { title: "Shield the Weak",    giver: "Village Elder",        type: "kill", typeId: "bandit",       count: 2, alignment: 5,  renown: 6,  desc: "Drive the raiders away from the frightened folk of {region}." },
    { title: "Root Out Corruption", giver: "Orthodox Envoy",      type: "kill", typeId: "rogue_cultivator", count: 3, alignment: 6, renown: 7, desc: "Hunt the rogue cultivators preying on travelers in {region}." },
  ],
  demonic: [
    { title: "A Silent Elimination", giver: "Shadowed Patron", type: "kill", typeId: "sect_member", count: 2, alignment: -8, renown: 10, bounty: 40, desc: "A hooded patron pays well to remove rivals of {region}." },
    { title: "Extortion",            giver: "Black-Market Broker", type: "kill", typeId: "bandit",  count: 3, alignment: -6, renown: 8,  bounty: 30, desc: "Collect 'tribute' from the defiant of {region}, by any means." },
    { title: "Blood Tribute",        giver: "Demonic Cult Envoy",  type: "kill", typeId: "sect_member", count: 3, alignment: -9, renown: 12, bounty: 60, desc: "Feed the cult's hunger with the blood of {region}'s best." },
  ],
};

/* ============================== DYNAMIC WORLD EVENTS ==============================

   The world moves on its own: warbands rise, sects clash, strangers appear,
   beasts stalk the wilds, and treasures lie briefly unclaimed. Events are
   region-scoped, time-limited, and often interactable. */

const WORLD_EVENT_MIN_MS = 20 * 60 * 1000;
const WORLD_EVENT_MAX_ACTIVE = 3;
const WORLD_EVENT_SPAWN_CHANCE = 0.35;

const WORLD_EVENT_TYPES = {
  bandit_invasion:    { name: "Bandit Invasion",     icon: "🏴", duration: [25, 45], desc: "A warband sweeps the region; the roads boil with raiders and the unrest climbs." },
  sect_war:           { name: "Sect War",            icon: "⚔️", duration: [30, 60], desc: "Two powers clash. Every disciple on the road is a foe, and taking a side earns standing." },
  traveling_merchant: { name: "Traveling Merchant",  icon: "🛒", duration: [20, 35], desc: "A wandering trader sets up a stall of rare wares — gone when the caravan rolls on." },
  mysterious_stranger:{ name: "Mysterious Stranger", icon: "🎭", duration: [20, 40], desc: "A cloaked figure waits with an offer, a rumour, or a trap." },
  rare_beast:         { name: "Rare Beast",          icon: "🐉", duration: [30, 50], desc: "A fabled beast has been sighted — a fortune in materials and renown for whoever fells it." },
  contested_treasure: { name: "Contested Treasure",  icon: "💎", duration: [20, 40], desc: "A cache of treasure lies unclaimed — but the wise expect a guardian." },
  world_boss:         { name: "World Boss",          icon: "☠️", duration: [45, 90], desc: "A calamity-level foe has surfaced; heroes gather to fell it before it ruins the land." },
};

const EVENT_SPAWN_WEIGHTS = [
  ["bandit_invasion", 20], ["sect_war", 12], ["traveling_merchant", 16],
  ["mysterious_stranger", 16], ["rare_beast", 16], ["contested_treasure", 14], ["world_boss", 6],
];

const RARE_BEASTS = [
  { id: "jade_serpent",   name: "Jade Serpent of the Deep", typeId: "rogue_cultivator", personality: "cunning",    hpMul: 1.5, atkMul: 1.15, xpMul: 2.2, reward: { silver: 120, renown: 25, manual: "m_dragon" } },
  { id: "bloodmane_tiger", name: "Bloodmane Tiger",         typeId: "boss",             personality: "aggressive", hpMul: 1.6, atkMul: 1.20, xpMul: 2.4, reward: { silver: 160, renown: 30, materials: { rare_material: 1 } } },
  { id: "thunder_roc",    name: "Thunder Roc",              typeId: "rogue_cultivator", personality: "tactical",   hpMul: 1.4, atkMul: 1.30, xpMul: 2.0, reward: { silver: 140, renown: 24, materials: { spirit_stone: 2 } } },
];

const WORLD_BOSSES = [
  { id: "iron_tyrant", name: "The Iron Tyrant", title: "World Calamity", rankPreferred: "grandmaster", personality: "ruthless",   hpMul: 2.0, atkMul: 1.25, reward: { silver: 400, renown: 80, manual: "m_nine", pills: 1 }, titleId: "calamity_slayer" },
  { id: "void_wyrm",   name: "Void Wyrm",       title: "Devourer of Realms", rankPreferred: "legendary", personality: "tactical", hpMul: 2.2, atkMul: 1.30, reward: { silver: 500, renown: 90, manual: "m_void", pills: 2 }, titleId: "calamity_slayer" },
];

const EVENT_STRANGERS = [
  { id: "blind_diviner",  name: "The Blind Diviner", flavor: "sightless eyes that see what mortals cannot." },
  { id: "masked_envoys",  name: "A Masked Envoy",    flavor: "silk, spice, and the smell of old blood." },
  { id: "wandering_monk", name: "A Wandering Monk",  flavor: "barefoot, patient, and unarmed — or so it seems." },
];

const EVENT_MERCHANT_WARES = [
  { id: "w_herb",   name: "Bundle of Wild Herbs",   cost: 60,  kind: "material", ref: "wild_herb",   amount: 5 },
  { id: "w_spirit", name: "Pouch of Spirit Stones", cost: 200, kind: "material", ref: "spirit_stone", amount: 3 },
  { id: "w_pill",   name: "Breakthrough Pill",      cost: 90,  kind: "pill",     amount: 1 },
  { id: "w_manual", name: "Wandering Manual",       cost: 260, kind: "manual",   ref: "m_cloud" },
  { id: "w_iron",   name: "Bar of Iron Ore",        cost: 40,  kind: "material", ref: "iron_ore",    amount: 4 },
];

const CONTESTED_TREASURES = [
  { id: "warchest",   name: "A Buried Warchest",              reward: { silver: 220, materials: { spirit_stone: 2 } } },
  { id: "storage_ring", name: "A Fallen Cultivator's Ring",   reward: { manual: "m_azure", renown: 15 } },
  { id: "jade_coffer", name: "A Sealed Jade Coffer",          reward: { pills: 2, silver: 120 } },
  { id: "relic",      name: "Shards of an Ancient Relic",     reward: { materials: { rare_material: 2 }, silver: 80 } },
];

/* ============================== TOURNAMENTS & RANKINGS ==============================

   A local, single-player arena: a drifting leaderboard of named rivals, ranked
   duels, an open regional meet, and a closed sect tournament. Winning earns
   rating, titles, and standing in the jianghu's imagination. */

const ARENA_SEASON_MS = 7 * 24 * 3600 * 1000;
const ARENA_RIVALS = [
  { name: "Yun Fei",     epithet: "the Cloud-Stepping Blade", sect: "Heavenly Sword Sect" },
  { name: "Jin Wei",     epithet: "the Prodigy",              sect: "Unaligned" },
  { name: "Mei Lin",     epithet: "the Azure Bloom",          sect: "Azure Lotus Sect" },
  { name: "Tie Shan",    epithet: "the Immovable",            sect: "Iron Mountain Sect" },
  { name: "Leng Wu",     epithet: "Blood-Moon Reaper",        sect: "Blood Moon Sect" },
  { name: "Su Ling",     epithet: "the Silent Crescent",      sect: "Silent Moon Sanctuary" },
  { name: "Bai He",      epithet: "the White Crane",          sect: "Unaligned" },
  { name: "Fang Yu",     epithet: "Spear of Ten Armies",      sect: "Heavenly Spear Clan" },
  { name: "Qin Zhao",    epithet: "the Thunderclap",          sect: "Unaligned" },
  { name: "Hei Ying",    epithet: "the Ninefold Shadow",      sect: "Shadow Pavilion" },
  { name: "Wu Kang",     epithet: "the Mountain Breaker",     sect: "Iron Mountain Sect" },
  { name: "Xue Rong",    epithet: "the Crimson Phoenix",      sect: "Celestial Phoenix Clan" },
  { name: "Mo Yan",      epithet: "the Void Walker",          sect: "Unaligned" },
  { name: "Lin Shuang",  epithet: "Frost of the Northern Peaks", sect: "Azure Dragon Clan" },
  { name: "Gu Tian",     epithet: "the Grand Elder's Heir",   sect: "Heavenly Sword Sect" },
  { name: "Long Xin",    epithet: "the Dragon's Fang",        sect: "Primordial Dragon Clan" },
];

const TOURNAMENTS = {
  regional: {
    id: "regional", name: "Regional Martial Meet", rounds: 4, entrants: 16, rankScale: 1,
    desc: "An open jianghu tournament. Best four challengers in a row to be crowned champion.",
    rewards: { silver: 600, qi: 900, xp: 420, renown: 35 },
  },
  sect: {
    id: "sect", name: "Sect Tournament", rounds: 3, entrants: 8, rankScale: 1,
    desc: "A closed contest among your own sect's disciples. Win three bouts to take the title.",
    rewards: { contribution: 800, qi: 600, xp: 300, renown: 20 },
  },
};

const TITLES = {
  regional_champion: { name: "Regional Champion",           desc: "Won a Regional Martial Meet." },
  sect_champion:     { name: "Sect Tournament Victor",      desc: "Won your sect's tournament." },
  ranked_first:      { name: "Ranked First Under Heaven",   desc: "Topped the jianghu rankings." },
  calamity_slayer:   { name: "Calamity Slayer",             desc: "Felled a world boss." },
  beast_slayer:      { name: "Beast Slayer",                desc: "Brought down a rare beast." },
  duelist:           { name: "Arena Duelist",               desc: "Won a ranked duel." },
};
