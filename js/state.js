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
        bonusAttackReady: false,
        psychicMisses: 0,
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
        // Skill cooldowns are tracked per team so one side's usage never locks the other side
        mindControlUsedWave: { player: -99, cpu: -99 },
        pivotUsedWave: { player: -99, cpu: -99 },
        turnEnding: false,
        pendingComebacks: [],
        aborted: false,
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
    if (backLvl > 0) {
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
// sourceTeam: the team responsible (null for neutral arena hazards); used for comeback upgrades
function applyIndirectDamage(die, amount, sourceName='Indirect', color='#ef4444', sourceTeam=null) {
    if (!die || die.hp <= 0 || amount <= 0) return 0;

    let dmgToApply = amount;
    if (die.aegisShield > 0) {
        const absorbed = Math.min(die.aegisShield, dmgToApply);
        die.aegisShield -= absorbed;
        dmgToApply -= absorbed;
        addFloatingText(`🛡️ Aegis -${absorbed} (${die.aegisShield} left)`, die.q, die.r, '#38bdf8', 16);
    }

    if (dmgToApply > 0) {
        die.lastHitTeam = sourceTeam;
        die.hp -= dmgToApply;
        die.hitAt = performance.now();
        if (typeof dieFxPos === 'function') {
            const p = dieFxPos(die);
            if (/Bleed/.test(sourceName)) spawnParticles(p.x, p.y + HEX_SIZE * 0.2, '#B5304F', 6, 1.5, 600, 2.5);
            else fxImpact(die, color, dmgToApply >= 10);
        }
        die.totalDamageTaken = (die.totalDamageTaken || 0) + dmgToApply;
        die.damagedThisWave = true;
        if (die.hp < 0) die.hp = 0;

        if (die.team === 'player' && game.stats) {
            game.stats.damageTaken[die.id] = (game.stats.damageTaken[die.id] || 0) + dmgToApply;
            game.stats.damageTaken.total += dmgToApply;
            if (typeof updateStatsDisplay === 'function') updateStatsDisplay();
        }

        updateRageBonus(die);

        addFloatingText(`-${dmgToApply} ${sourceName}`, die.q, die.r, color, 18);
        if (die.hp <= 0 && typeof handleDieDeath === 'function') handleDieDeath(die);
    }
    if (typeof updateDiceHP === 'function') updateDiceHP();
    return dmgToApply;
}

function getCooldownWave(key, team) {
    const v = game[key];
    if (v && typeof v === 'object') return v[team] ?? -99;
    return -99;
}

function setCooldownWave(key, team) {
    if (!game[key] || typeof game[key] !== 'object') game[key] = { player: -99, cpu: -99 };
    game[key][team] = game.wave;
}

// Rage Back Stronger: recompute the permanent bonus after taking damage
function updateRageBonus(die) {
    const backLvl = getSkillLevel(die, 'backStronger');
    if (backLvl <= 0) return;
    const reqDmg = backLvl === 2 ? 9 : backLvl === 3 ? 7 : 10;
    const newBonus = Math.min(10, Math.floor((die.totalDamageTaken || 0) / reqDmg));
    if (newBonus > (die.bonusDamageFromDamageTaken || 0)) {
        const diff = newBonus - (die.bonusDamageFromDamageTaken || 0);
        die.bonusDamageFromDamageTaken = newBonus;
        addFloatingText(`😡 Rage +${diff} DMG!`, die.q, die.r, '#ef4444', 18);
    }
}

// Psychic Push roll with bad-luck protection:
// after 3 / 2 / 1 misses in a row (Lvl 1 / 2 / 3) the next roll always succeeds
const PSYCHIC_CHANCE = [0, 0.40, 0.65, 0.90];
const PSYCHIC_PITY = [0, 3, 2, 1];
function rollPsychicPush(die) {
    const lvl = Math.max(1, Math.min(3, getSkillLevel(die, 'psychic')));
    const guaranteed = (die.psychicMisses || 0) >= PSYCHIC_PITY[lvl];
    const hit = guaranteed || Math.random() < PSYCHIC_CHANCE[lvl];
    die.psychicMisses = hit ? 0 : (die.psychicMisses || 0) + 1;
    return { hit, guaranteed, chance: PSYCHIC_CHANCE[lvl], pity: PSYCHIC_PITY[lvl], left: PSYCHIC_PITY[lvl] - die.psychicMisses };
}
function psychicPityText(left) {
    return left <= 0 ? 'the next push is guaranteed' : `guaranteed after ${left} more miss${left > 1 ? 'es' : ''}`;
}

// Defender Toughness: flat reduction of incoming contact damage (-3 / -5 / -7)
function getToughnessReduction(die) {
    const lvl = getSkillLevel(die, 'toughness');
    return lvl === 1 ? 3 : lvl === 2 ? 5 : lvl === 3 ? 7 : 0;
}

// Credit healing to the die that caused it (stats + game over summary)
function creditHeal(healer, amount) {
    if (!healer || amount <= 0) return;
    healer.totalHealDone = (healer.totalHealDone || 0) + amount;
    if (healer.team === 'player' && game.stats) {
        game.stats.healDone[healer.id] = (game.stats.healDone[healer.id] || 0) + amount;
        game.stats.healDone.total += amount;
        if (typeof updateStatsDisplay === 'function') updateStatsDisplay();
    }
}

// Credit damage (already applied to the target) to the attacking die and player stats
function creditDamageDealt(attacker, amount) {
    if (!attacker || amount <= 0) return;
    attacker.totalDamageDealt = (attacker.totalDamageDealt || 0) + amount;
    if (attacker.team === 'player' && game.stats) {
        game.stats.damageDealt[attacker.id] = (game.stats.damageDealt[attacker.id] || 0) + amount;
        game.stats.damageDealt.total += amount;
        if (typeof updateStatsDisplay === 'function') updateStatsDisplay();
    }
}

// Direct / contact damage (not absorbed by Aegis). Tracks stats and triggers on-death effects.
function dealDirectDamage(target, amount, attacker=null, label=null, color='#ef4444') {
    if (!target || target.hp <= 0 || amount <= 0) return 0;
    target.lastHitTeam = attacker ? attacker.team : null;
    target.hp -= amount;
    if (target.hp < 0) target.hp = 0;
    target.hitAt = performance.now();
    if (label && typeof fxImpact === 'function') fxImpact(target, '#FFD7C2', amount >= 10);
    target.totalDamageTaken = (target.totalDamageTaken || 0) + amount;
    target.damagedThisWave = true;
    if (attacker) attacker.totalDamageDealt = (attacker.totalDamageDealt || 0) + amount;

    if (game.stats) {
        if (attacker && attacker.team === 'player') {
            game.stats.damageDealt[attacker.id] = (game.stats.damageDealt[attacker.id] || 0) + amount;
            game.stats.damageDealt.total += amount;
        }
        if (target.team === 'player') {
            game.stats.damageTaken[target.id] = (game.stats.damageTaken[target.id] || 0) + amount;
            game.stats.damageTaken.total += amount;
        }
        if (typeof updateStatsDisplay === 'function') updateStatsDisplay();
    }

    updateRageBonus(target);
    if (label) addFloatingText(`-${amount} ${label}`, target.q, target.r, color, 18);
    if (target.hp <= 0 && typeof handleDieDeath === 'function') handleDieDeath(target);
    return amount;
}

function addCombatLog(text, icon='⚔️', color='#e2e8f0') {
    if (!game || !game.combatLog) {
        if (game) game.combatLog = [];
        else return;
    }
    const entry = {
        wave: game.wave || 1,
        text: stripEmoji(text),
        icon,
        color,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };
    game.combatLog.unshift(entry);
    if (game.combatLog.length > 50) game.combatLog.pop();

    if (typeof updateStatsDisplay === 'function') updateStatsDisplay();
}
