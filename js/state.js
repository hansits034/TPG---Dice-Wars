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

function createDie(id, q, r, team, archetypeId='dracula', isSplit=false, isClone=false) {
    const arch = ARCHETYPES.find(a => a.id === archetypeId) || ARCHETYPES[0];
    const skills = isClone ? [] : JSON.parse(JSON.stringify(arch.skills));
    const maxHp = gameSettings ? gameSettings.startHp : MAX_HP;

    return {
        id, q, r, hp: maxHp, maxHp: maxHp, baseDamage: 1, value: 1, team,
        renderX: null, renderY: null,
        moveAllowance: 0,
        frozen: 0,
        concealed: 0,
        trapped: 0,
        moveDebuff: 0,
        damageMultiplier: 1,
        attackAgainActive: false,
        cloneActive: false,
        isCloneDie: isClone,
        halfDamage: 0,
        archetype: arch.id,
        icon: arch.icon,
        skills,
        zapStacks: arch.id === 'mage' ? 1 : 0, // Starts with 1 stack
        bleedStacks: 0,
        bleedTurns: 0,
        bleedMoveDistance: 0,
        antiHealTurns: 0,
        totalDamageTaken: 0,
        totalDamageDealt: 0,
        totalHealDone: 0,
        bonusDamageFromDamageTaken: 0,
        revived: false,
        undeadTriggered: false,
        isSplit: isSplit, // Split dice roll 1-3 instead of 1-6
        damagedThisWave: false,
        aegisShield: 0,
        movedThisWave: false,
        didNotMoveLastWave: false,
        hasAttackedThisTurn: false,
        isMindControlled: false,
        originalTeam: team,
        mindControlledWaves: 0,
        preControlHp: maxHp
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
        bearTraps: new Map(),
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
        mindControlUsedWave: -99,
        pivotUsedWave: -99,
        pivotPreview: false,
        combatLog: [],
        stats: {
            damageDealt: { p1: 0, p2: 0, p3: 0, total: 0 },
            damageTaken: { p1: 0, p2: 0, p3: 0, total: 0 },
            healDone: { p1: 0, p2: 0, p3: 0, cards: 0, total: 0 }
        }
    };
    particles = [];
    floatingTexts = [];
    if (typeof stopTurnTimer === 'function') stopTurnTimer();
    if (typeof stopStopwatch === 'function') stopStopwatch();
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
        const bonus = Math.floor((die.totalDamageTaken || 0) / reqDmg);
        return Math.min(10, bonus); // Max limit +10
    }
    return 0;
}

function getDieEffectiveDamage(die) {
    let dmg = (die.baseDamage || 1) + getDieRageBonus(die);
    // Archer Skill 2: Standstill (+2/+4/+7 if did not move in previous wave)
    const standstillLvl = getSkillLevel(die, 'standstill');
    if (standstillLvl > 0 && die.didNotMoveLastWave) {
        const bonus = standstillLvl === 1 ? 2 : standstillLvl === 2 ? 4 : 7;
        dmg += bonus;
    }
    return dmg;
}

// Helper for indirect / non-contact damage (absorbed by Aegis shield up to 15)
function applyIndirectDamage(die, amount, sourceName='Indirect', color='#ef4444') {
    if (!die || die.hp <= 0 || amount <= 0) return 0;

    let dmgToApply = amount;
    if (die.aegisShield > 0) {
        const absorbed = Math.min(die.aegisShield, dmgToApply);
        die.aegisShield -= absorbed;
        dmgToApply -= absorbed;
        addFloatingText(`🛡️ Aegis -${absorbed} (${die.aegisShield} left)`, die.q, die.r, '#38bdf8', 16);
    }

    if (dmgToApply > 0) {
        die.hp -= dmgToApply;
        die.totalDamageTaken = (die.totalDamageTaken || 0) + dmgToApply;
        die.damagedThisWave = true;
        if (die.hp < 0) die.hp = 0;

        if (die.team === 'player' && game.stats) {
            game.stats.damageTaken[die.id] = (game.stats.damageTaken[die.id] || 0) + dmgToApply;
            game.stats.damageTaken.total += dmgToApply;
            if (typeof updateStatsDisplay === 'function') updateStatsDisplay();
        }

        const backLvl = getSkillLevel(die, 'backStronger');
        if (backLvl > 0 || die.archetype === 'Rage') {
            const reqDmg = backLvl === 2 ? 9 : backLvl === 3 ? 7 : 10;
            const newBonus = Math.min(10, Math.floor(die.totalDamageTaken / reqDmg));
            if (newBonus > (die.bonusDamageFromDamageTaken || 0)) {
                const diff = newBonus - (die.bonusDamageFromDamageTaken || 0);
                die.bonusDamageFromDamageTaken = newBonus;
                addFloatingText(`😡 Rage +${diff} DMG!`, die.q, die.r, '#ef4444', 18);
            }
        }

        addFloatingText(`-${dmgToApply} ${sourceName}`, die.q, die.r, color, 18);
    }
    if (typeof updateDiceHP === 'function') updateDiceHP();
    return dmgToApply;
}

function addCombatLog(text, icon='⚔️', color='#e2e8f0') {
    if (!game || !game.combatLog) {
        if (game) game.combatLog = [];
        else return;
    }
    const entry = {
        wave: game.wave || 1,
        text,
        icon,
        color,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };
    game.combatLog.unshift(entry);
    if (game.combatLog.length > 50) game.combatLog.pop();

    if (typeof updateStatsDisplay === 'function') updateStatsDisplay();
}
