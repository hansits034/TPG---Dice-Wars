// ==========================================================
// 1. CONFIGURATION & ARCHETYPES
// ==========================================================
const GRID_RADIUS = 5;
let HEX_SIZE = 30;
let gridCenterX = 0, gridCenterY = 0;
const SQRT3 = Math.sqrt(3);
const MAX_HP = 50;
const MAX_HAND = 3;
const EVENT_TILE_INTERVAL = 3; // every 3 waves
const BLITZ_INTERVAL = 5;      // every 5 waves
const UPGRADE_INTERVAL = 4;    // every 4 waves
const EVENT_TILES_PER_SPAWN = 3;
const TURN_TIME_LIMIT = 30;

// Archetype definitions
const ARCHETYPES = [
    {
        id: 'dracula', name: 'Dracula', icon: '🩸',
        skills: [
            { id: 'healOnAtk', name: 'Lifesteal', desc: 'Heal +2 HP per attack (+3 at Lvl 2, +5 at Lvl 3)', maxLvl: 3, curLvl: 1 },
            { id: 'bleed', name: 'Bleed', desc: 'Attacked enemies take +1 damage for 3 waves (Max 3 stacks) & CANNOT be healed for 1 turn', maxLvl: 3, curLvl: 0 }
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
            { id: 'concealMastery', name: 'Conceal Mastery', desc: 'Conceal effects on this die last +1 extra wave', maxLvl: 2, curLvl: 1 },
            { id: 'superDash', name: 'Super Dash', desc: 'Increases Dash card damage by +5', maxLvl: 4, curLvl: 0 }
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
        id: 'metal', name: 'Metal', icon: '🛡️',
        skills: [
            { id: 'thorns', name: 'Thorns', desc: 'Reflect 1 damage (2 at Lvl 2, 3 at Lvl 3) back to attacker', maxLvl: 3, curLvl: 1 },
            { id: 'toughness', name: 'Toughness', desc: 'Reduce incoming damage by -1 (-2 at Lvl 2)', maxLvl: 2, curLvl: 0 }
        ]
    },
    {
        id: 'rage', name: 'Rage', icon: '😡',
        skills: [
            { id: 'backStronger', name: 'Back Stronger', desc: 'Gain +1 permanent damage for every 10 dmg taken (9 dmg at Lvl 2, 7 dmg at Lvl 3)', maxLvl: 3, curLvl: 1 },
            { id: 'explode', name: 'Explode', desc: 'When destroyed, deal 8 damage (15 at Lvl 2) to ALL enemy dice', maxLvl: 2, curLvl: 0 }
        ]
    }
];

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

    box.innerHTML = `
        <div class="class-display-icon">${arch.icon}</div>
        <div class="class-display-name">${arch.name}</div>
        <div class="class-display-desc">${arch.skills[0].desc}</div>
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
    { id:'block',   icon:'🧱', name:'Block',         desc:'Place 2 walls on empty hexes (2 rounds)',           rarity:'uncommon', weight:12, target:'hex' },
    { id:'swap',    icon:'🔀', name:'Swap',          desc:'Swap positions of 2 own dice',                      rarity:'uncommon', weight:12, target:'own-die-2' },
    { id:'atkAgain',icon:'⚔️', name:'Attack Again',  desc:'Can attack again this turn (different target)',     rarity:'rare',     weight:6,  target:'none' },
    { id:'conceal', icon:'👻', name:'Conceal',       desc:'Hide 1 die for 2 rounds (untargetable)',            rarity:'uncommon', weight:10, target:'own-die' },
    { id:'clone',   icon:'🪞', name:'Clone',         desc:'+2 moves & half damage for selected die (1 round)', rarity:'rare',     weight:5,  target:'own-die' },
    { id:'dash',    icon:'💨', name:'Dash',          desc:'Dash straight across arena, enemies in path take 4 dmg', rarity:'rare', weight:6,  target:'own-die-dir' },
];
const TOTAL_WEIGHT = CARD_DEFS.reduce((s,c) => s + c.weight, 0);

function randomCard() {
    let r = Math.random() * TOTAL_WEIGHT;
    for (const c of CARD_DEFS) { r -= c.weight; if (r <= 0) return { ...c }; }
    return { ...CARD_DEFS[0] };
}
