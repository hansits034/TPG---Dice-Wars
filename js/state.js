// ==========================================================
// 6. GAME STATE & CLASS INSTANTIATION
// ==========================================================
let game = {};
let canvas, ctx;
let hoveredHex = null;
let floatingTexts = [];
let animatingDie = null;
let animRotation = 0;
let turnTimerInterval = null;
let stopwatchInterval = null;

function createDie(id, q, r, team, archetypeId='dracula', isSplit=false) {
    const arch = ARCHETYPES.find(a => a.id === archetypeId) || ARCHETYPES[0];
    const skills = JSON.parse(JSON.stringify(arch.skills));

    return {
        id, q, r, hp: MAX_HP, baseDamage: 1, value: 1, team,
        renderX: null, renderY: null,
        moveAllowance: 0,
        frozen: 0,
        concealed: 0,
        trapped: 0,
        moveDebuff: 0,
        damageMultiplier: 1,
        attackAgainActive: false,
        cloneActive: false,
        halfDamage: 0,
        archetype: arch.id,
        icon: arch.icon,
        skills,
        bleedStacks: 0,
        bleedMoveDistance: 0,
        antiHealTurns: 0,
        totalDamageTaken: 0,
        bonusDamageFromDamageTaken: 0,
        revived: false,
        undeadTriggered: false,
        isSplit: isSplit, // Split dice roll 1-3 instead of 1-6
        damagedThisWave: false,
    };
}

function resetGame() {
    // CPU gets 3 distinct random classes as well
    const availableArchs = [...ARCHETYPES].sort(() => Math.random() - 0.5);
    const cpuClasses = [availableArchs[0].id, availableArchs[1].id, availableArchs[2].id];

    game = {
        phase: 'IDLE',
        playerDice: [
            createDie('p1', -4, 4, 'player', selectedPlayerClasses[0]),
            createDie('p2', -2, 4, 'player', selectedPlayerClasses[1]),
            createDie('p3', 0, 4, 'player', selectedPlayerClasses[2]),
        ],
        cpuDice: [
            createDie('c1', 0, -4, 'cpu', cpuClasses[0]),
            createDie('c2', 2, -4, 'cpu', cpuClasses[1]),
            createDie('c3', 4, -4, 'cpu', cpuClasses[2]),
        ],
        currentTurn: null,
        selectedDie: null,
        reachable: null,
        parents: null,
        rollValues: [],
        wave: 1,
        turnsInCurrentWave: 0,
        firstPlayerThisWave: 'player',
        eventTiles: new Map(),
        voidTiles: new Map(),
        burningTiles: new Map(),
        vineTraps: new Map(),
        bees: [],
        zombies: [], // Necromancer zombies
        playerHand: [],
        cpuHand: [],
        activeCard: null,
        cardTargets: [],
        blocks: new Map(),
        lastAttackedId: null,
        turnTimeLeft: TURN_TIME_LIMIT,
        matchTimeSeconds: 0,
    };
    particles = [];
    floatingTexts = [];
    stopTurnTimer();
    stopStopwatch();
}

function allDice() { return game.playerDice && game.cpuDice ? [...game.playerDice, ...game.cpuDice] : []; }
function aliveDice(team) { return (team === 'player' ? game.playerDice : game.cpuDice || []).filter(d => d.hp > 0); }
function getDieAt(q, r, includeConcealed=true) {
    return allDice().find(d => d.hp > 0 && d.q === q && d.r === r && (includeConcealed || !d.concealed));
}
function totalMovesLeft(team) { return aliveDice(team).reduce((s, d) => s + d.moveAllowance, 0); }

function getSkillLevel(die, skillId) {
    if (!die || !die.skills) return 0;
    const s = die.skills.find(sk => sk.id === skillId);
    return s ? s.curLvl : 0;
}

function getDieRageBonus(die) {
    const backLvl = getSkillLevel(die, 'backStronger');
    if (backLvl > 0 || die.archetype === 'Rage') {
        const reqDmg = backLvl === 2 ? 9 : backLvl === 3 ? 7 : 10;
        return Math.floor((die.totalDamageTaken || 0) / reqDmg);
    }
    return 0;
}

function getDieEffectiveDamage(die) {
    return (die.baseDamage || 1) + getDieRageBonus(die);
}
