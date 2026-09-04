// ==========================================================
// 1. CONFIGURATION & ARCHETYPES
// ==========================================================
const GRID_RADIUS = 5;
let HEX_SIZE = 30;
let gridCenterX = 0, gridCenterY = 0;
const SQRT3 = Math.sqrt(3);
const MAX_HP = 50;
const BASE_MAX_HAND = 3;
const EVENT_TILE_INTERVAL = 3; // every 3 waves
const BLITZ_INTERVAL = 5;      // every 5 waves
const UPGRADE_INTERVAL = 4;    // every 4 waves
const EVENT_TILES_PER_SPAWN = 3;
const TURN_TIME_LIMIT = 30;

// Archetype definitions (Each class has passive/skills with max levels & descriptions)
const ARCHETYPES = [
    {
        id: 'dracula', name: 'Dracula', icon: '🩸',
        skills: [
            { id: 'healOnAtk', name: 'Lifesteal', desc: 'Heal +2 HP per attack (+3 at Lvl 2, +5 at Lvl 3)', maxLvl: 3, curLvl: 1 },
            { id: 'bleed', name: 'Bleed', desc: 'Attacks add 1 stack (2 at Lvl 2, 3 at Lvl 3, Max 3). Enemy takes 1 damage per 3 tiles moved for 3 waves & CANNOT be healed for 1 turn', maxLvl: 3, curLvl: 0 }
        ]
    },
    {
        id: 'angel', name: 'Angel', icon: '😇',
        skills: [
            { id: 'healAid', name: 'Heal Aid', desc: 'Heal all team dice +1 HP every 2 turns', maxLvl: 3, curLvl: 1 },
            { id: 'revive', name: 'Revive', desc: 'Once per match: Revive destroyed team die to 15 HP (+15 per lvl)', maxLvl: 3, curLvl: 0 }
        ]
    },
    {
        id: 'ninja', name: 'Ninja', icon: '🥷',
        skills: [
            { id: 'flash', name: 'Flash Movement', desc: '+1 movement cap (+2 at Lvl 2, +4 at Lvl 3)', maxLvl: 3, curLvl: 1 },
            { id: 'quickDestruct', name: 'Quick Destruct', desc: '25% chance (35% Lvl 2, 50% Lvl 3) to attack a DIFFERENT enemy with remaining moves', maxLvl: 3, curLvl: 0 }
        ]
    },
    {
        id: 'samurai', name: 'Samurai', icon: '🗡️',
        skills: [
            { id: 'dashMastery', name: 'Dash Mastery', desc: '+1 Card Slot (Max 4). Free Dash card every 10 waves & +15% Dash drop chance on event tiles', maxLvl: 1, curLvl: 1 },
            { id: 'concealMastery', name: 'Conceal Master', desc: 'Conceal effect on this die lasts +1 extra wave (+2 extra waves at Lvl 2)', maxLvl: 2, curLvl: 1 },
            { id: 'superDash', name: 'Super Dash', desc: 'Increases Dash card damage by +5 per level', maxLvl: 4, curLvl: 0 }
        ]
    },
    {
        id: 'telekinator', name: 'Telekinator', icon: '🔮',
        skills: [
            { id: 'psychic', name: 'Psychic Push', desc: 'Psychic ability (20% chance per lvl) to push 1 enemy die to chosen empty tile at start of turn', maxLvl: 4, curLvl: 1 },
            { id: 'hypno', name: 'Hypno Steal', desc: 'Every 3 waves, 40% chance to steal/destroy enemy card', maxLvl: 2, curLvl: 0 }
        ]
    },
    {
        id: 'defender', name: 'Defender', icon: '🛡️',
        skills: [
            { id: 'defenderMastery', name: 'Defender Mastery', desc: '+1 Card Slot (Max 4). Free Conceal card every 10 waves & +15% Conceal drop chance on event tiles', maxLvl: 1, curLvl: 1 },
            { id: 'thorns', name: 'Thorns', desc: 'When attacked, reflect 1 damage (3 at Lvl 2, 5 at Lvl 3) back to attacker', maxLvl: 3, curLvl: 1 },
            { id: 'toughness', name: 'Toughness', desc: 'Reduce all incoming damage by -1 (-3 at Lvl 2, -5 at Lvl 3)', maxLvl: 3, curLvl: 0 }
        ]
    },
    {
        id: 'rage', name: 'Rage', icon: '😡',
        skills: [
            { id: 'backStronger', name: 'Back Stronger', desc: 'Gain +1 permanent damage for every 10 dmg taken (9 dmg at Lvl 2, 7 dmg at Lvl 3)', maxLvl: 3, curLvl: 1 },
            { id: 'explode', name: 'Explode', desc: 'When destroyed, deal 8 damage (15 at Lvl 2) to ALL enemy dice', maxLvl: 2, curLvl: 0 }
        ]
    },
    {
        id: 'necromancer', name: 'Necromancer', icon: '💀',
        skills: [
            { id: 'minions', name: 'Minions', desc: 'Every 2 waves, summon 1 (2 at Lvl 2, 3 at Lvl 3) zombie lasting 2-3 waves. Zombies move 3 tiles/turn & deal 2 damage', maxLvl: 3, curLvl: 1 },
            { id: 'undead', name: 'Undead', desc: 'On death: splits into 2 playable dice (rolls 1-3) with 5 HP (10 at Lvl 2, 20 at Lvl 3) & empowers zombies with +2 (+3/+4) damage', maxLvl: 3, curLvl: 0 }
        ]
    },
    {
        id: 'mage', name: 'Mage', icon: '🧙',
        skills: [
            { id: 'zap', name: 'Zap', desc: 'Gain +1 Zap stack every 2 waves (Max 2). Deals damage equal to hex distance to nearest enemy (+1 dmg per Lvl). Click Zap button to fire!', maxLvl: 3, curLvl: 1 },
            { id: 'focus', name: 'Focus', desc: 'If unhurt in previous wave: Zap has 35% chance (65% at Lvl 2, 99% at Lvl 3) to deal x2 CRIT damage', maxLvl: 3, curLvl: 0 }
        ]
    },
    {
        id: 'doctor', name: 'Doctor', icon: '🩺',
        skills: [
            { id: 'doctorMastery', name: 'Medical Mastery', desc: '+1 Card Slot (Max 4). Heal Pill card restores +5 additional HP (Total +12 HP)', maxLvl: 1, curLvl: 1 },
            { id: 'nobleSaviour', name: 'Noble Saviour', desc: 'Gain 1 free Heal Pill card every 4 waves (every 3 waves at Lvl 2)', maxLvl: 2, curLvl: 1 },
            { id: 'mutantResearch', name: 'Mutant Research', desc: 'Permanently adds +1 (+2 at Lvl 2, +3 at Lvl 3, +4 at Lvl 4) to all rolled dice values for the whole team', maxLvl: 4, curLvl: 0 }
        ]
    }
];

// Match Settings: Starting HP & AI Difficulty
let gameSettings = {
    startHp: 50,
    difficulty: 'medium' // 'easy', 'medium', 'hard'
};

// Default 3 distinct roles for player
let selectedPlayerClasses = ['dracula', 'ninja', 'samurai'];

function renderCarouselBox(dieIdx) {
    const classId = selectedPlayerClasses[dieIdx];
    const arch = ARCHETYPES.find(a => a.id === classId) || ARCHETYPES[0];
    const box = document.getElementById(`class-box-${dieIdx}`);
    if (!box) return;

    box.style.animation = 'none';
    box.offsetHeight; // trigger reflow
    box.style.animation = 'classSlideIn 0.3s ease-out';

    // Show first active skill/passive as highlighted description
    const displaySkill = arch.skills.find(s => !s.id.endsWith('Mastery')) || arch.skills[0];

    box.innerHTML = `
        <div class="class-display-icon">${arch.icon}</div>
        <div class="class-display-name">${arch.name}</div>
        <div class="class-display-desc">${displaySkill.desc}</div>
    `;
}

function cycleClass(dieIdx, dir) {
    const availableIndices = [];
    ARCHETYPES.forEach((arch, idx) => {
        const isUsedByOther = selectedPlayerClasses.some((c, i) => i !== dieIdx && c === arch.id);
        if (!isUsedByOther) availableIndices.push(idx);
    });

    const curArchIdx = ARCHETYPES.findIndex(a => a.id === selectedPlayerClasses[dieIdx]);
    let posInAvailable = availableIndices.indexOf(curArchIdx);
    if (posInAvailable === -1) posInAvailable = 0;

    posInAvailable += dir;
    if (posInAvailable < 0) posInAvailable = availableIndices.length - 1;
    if (posInAvailable >= availableIndices.length) posInAvailable = 0;

    const newArchIdx = availableIndices[posInAvailable];
    selectedPlayerClasses[dieIdx] = ARCHETYPES[newArchIdx].id;

    renderCarouselBox(dieIdx);
    if (typeof SFX !== 'undefined' && SFX.move) SFX.move();
}

function setupClassSelectionUI() {
    renderCarouselBox(0);
    renderCarouselBox(1);
    renderCarouselBox(2);
}

// ==========================================================
// 2. CARD DEFINITIONS
// ==========================================================
const CARD_DEFS = [
    { id:'heal',    icon:'🩹', name:'Heal +7',       desc:'Restore 7 HP to one die',                          rarity:'common',   weight:25, target:'own-die' },
    { id:'dmg2',    icon:'⚔️', name:'Damage ×2',     desc:'Next attack deals double damage',                   rarity:'common',   weight:20, target:'none' },
    { id:'dmg3',    icon:'🔥', name:'Damage ×3',     desc:'Next attack deals triple damage',                   rarity:'rare',     weight:5,  target:'none' },
    { id:'freeze',  icon:'❄️', name:'Freeze',        desc:'Freeze 1 enemy die for 2 turns',                    rarity:'uncommon', weight:12, target:'enemy-die' },
    { id:'block',   icon:'🧱', name:'Block',         desc:'Place 4 walls on empty hexes (2 rounds)',           rarity:'uncommon', weight:12, target:'hex-4' },
    { id:'swap',    icon:'🔀', name:'Swap',          desc:'Swap positions of 2 own dice',                      rarity:'uncommon', weight:12, target:'own-die-2' },
    { id:'atkAgain',icon:'⚔️', name:'Attack Again',  desc:'Can attack again this turn (different target)',     rarity:'rare',     weight:6,  target:'none' },
    { id:'conceal', icon:'👻', name:'Conceal',       desc:'Hide 1 die for 2 rounds (untargetable)',            rarity:'uncommon', weight:10, target:'own-die' },
    { id:'clone',   icon:'🪞', name:'Clone',         desc:'+2 moves & half damage for selected die (1 round)', rarity:'rare',     weight:5,  target:'own-die' },
    { id:'dash',    icon:'💨', name:'Dash',          desc:'Dash straight across arena, enemies in path take 4 dmg', rarity:'rare', weight:6,  target:'own-die-dir' },
];

function getMaxHandSize(team) {
    const dice = aliveDice(team);
    const hasBonus = dice.some(d => getSkillLevel(d, 'defenderMastery') > 0 || getSkillLevel(d, 'dashMastery') > 0 || getSkillLevel(d, 'doctorMastery') > 0);
    return hasBonus ? 4 : BASE_MAX_HAND;
}

function randomCard(team = 'player') {
    const dice = aliveDice(team);
    const hasDefender = dice.some(d => getSkillLevel(d, 'defenderMastery') > 0);
    const hasSamurai = dice.some(d => getSkillLevel(d, 'dashMastery') > 0);

    const adjustedDefs = CARD_DEFS.map(c => {
        let w = c.weight;
        if (c.id === 'conceal' && hasDefender) w = Math.round(w * 2.2); // +15% total share approx
        if (c.id === 'dash' && hasSamurai) w = Math.round(w * 2.5);    // +15% total share approx
        return { ...c, weight: w };
    });

    const totalWeight = adjustedDefs.reduce((s, c) => s + c.weight, 0);
    let r = Math.random() * totalWeight;
    for (const c of adjustedDefs) {
        r -= c.weight;
        if (r <= 0) return { ...c };
    }
    return { ...CARD_DEFS[0] };
}
