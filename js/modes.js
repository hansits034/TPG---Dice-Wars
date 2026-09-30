// ==========================================================
// GAME MODES & PAUSE
// Classic (vs computer), Hot-seat (2 players, 1 device) and Boss Raid.
// ==========================================================
function gameMode() { return (game && game.mode) || gameSettings.mode || 'classic'; }
function isHotseat() { return gameMode() === 'hotseat'; }
function isBossMode() { return gameMode() === 'boss'; }

// ---------- pause ----------
function isPaused() { return !!(game && game.paused); }
function matchRunning() {
    const screen = document.getElementById('game-screen');
    return !!(game && game.phase && game.phase !== 'GAME_OVER' && game.phase !== 'IDLE' && screen && screen.classList && screen.classList.contains('active'));
}
function pauseGame() {
    if (!game || game.phase === 'GAME_OVER') return;
    game.paused = true;
    document.body && document.body.classList && document.body.classList.add('is-paused');
}
function resumeGame() {
    if (!game) return;
    game.paused = false;
    document.body && document.body.classList && document.body.classList.remove('is-paused');
    hideOverlay();
}
function overlayOpen() {
    const ol = document.getElementById('overlay');
    return !!(ol && ol.classList && !ol.classList.contains('hidden'));
}
function togglePause() {
    if (isPaused()) { resumeGame(); return; }
    if (matchRunning() && !overlayOpen()) openGameMenuModal();
}
if (typeof document !== 'undefined' && document.addEventListener) {
    // leaving the tab pauses the match so nobody loses a turn to the timer
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && matchRunning() && !isPaused() && !overlayOpen()) openGameMenuModal();
    });
}

// ---------- sides (hot-seat swaps the two teams between turns) ----------
function flipTeam(t) { return t === 'player' ? 'cpu' : t === 'cpu' ? 'player' : t; }
// The colour side of a team: Player 1 is always green, Player 2 always red, even while swapped
function displayTeam(team) { return game && game.sidesSwapped ? flipTeam(team) : team; }

// Human-readable owner of a team right now
function sideName(team) {
    if (isHotseat()) return displayTeam(team) === 'player' ? 'Player 1' : 'Player 2';
    if (isBossMode()) return team === 'player' ? 'Your team' : 'The Titan';
    return team === 'player' ? 'You' : 'Computer';
}

// Turn "CPU"/"Computer" wording into the right name for the current mode
function localizeText(text) {
    if (typeof text !== 'string' || !game || !game.mode || game.mode === 'classic') return text;
    if (game.mode === 'puzzle') return text;
    const other = isHotseat() ? sideName('cpu') : 'Titan';
    return text.replace(/\bComputer\b/g, other).replace(/\bCPU\b/g, other);
}

function freshStats() {
    return { damageDealt: { total: 0 }, damageTaken: { total: 0 }, healDone: { cards: 0, total: 0 } };
}

function swapSides() {
    [game.playerDice, game.cpuDice] = [game.cpuDice, game.playerDice];
    for (const d of allDice()) {
        d.team = flipTeam(d.team);
        d.originalTeam = flipTeam(d.originalTeam);
        d.bleedSourceTeam = flipTeam(d.bleedSourceTeam);
        d.lastHitTeam = flipTeam(d.lastHitTeam);
    }
    [game.playerHand, game.cpuHand] = [game.cpuHand, game.playerHand];
    for (const z of game.zombies || []) z.team = flipTeam(z.team);
    for (const b of game.bees || []) if (b.ownerTeam) b.ownerTeam = flipTeam(b.ownerTeam);
    for (const v of game.bearTraps.values()) v.team = flipTeam(v.team);
    for (const key of ['pivotUsedWave', 'mindControlUsedWave']) {
        const o = game[key] || { player: -99, cpu: -99 };
        game[key] = { player: o.cpu, cpu: o.player };
    }
    [game.stats, game.statsOther] = [game.statsOther || freshStats(), game.stats];
    [game.pendingComebacks, game.pendingComebacksOther] = [game.pendingComebacksOther || [], game.pendingComebacks || []];
    game.sidesSwapped = !game.sidesSwapped;
    game.currentTurn = flipTeam(game.currentTurn);
    game.selectedDie = null; game.reachable = null; game.parents = null;
    game.activeCard = null; game.cardTargets = [];
    game.psychicSource = null; game.psychicTargetEnemy = null; game.mindControlSource = null; game.archerSource = null;
    game.pivotPreview = false; game.pivotPiercer = null;
    updateSideLabels();
    updateDiceHP(); updateCardHand(); updateStatsDisplay(); updateSkillButtons(); updateMoves();
}

function teamDotHTML(team) { return `<span class="team-dot ${displayTeam(team)}"></span>`; }

function updateSideLabels() {
    const cpuHead = document.getElementById('cpu-bar-title');
    const plHead = document.getElementById('player-bar-title');
    if (cpuHead) cpuHead.innerHTML = `${teamDotHTML('cpu')}${isHotseat() ? sideName('cpu') : isBossMode() ? 'Boss' : gameMode() === 'puzzle' ? 'Targets' : 'Computer'}`;
    if (plHead) plHead.innerHTML = `${teamDotHTML('player')}${isHotseat() ? `${sideName('player')}, your turn` : 'Your dice'}`;
    const auto = document.getElementById('auto-test-btn');
    if (auto) auto.style.display = isHotseat() || gameMode() === 'puzzle' ? 'none' : '';
    if (document.body && document.body.classList) document.body.classList.toggle('mode-puzzle', gameMode() === 'puzzle');
}

// Hot-seat: hand the device over, then run the next player's turn with the normal controls
async function beginHotseatTurn() {
    if (game.phase === 'GAME_OVER') return;
    stopTurnTimer();
    swapSides();
    game.phase = 'HANDOFF';
    const who = sideName('player');
    const tone = displayTeam('player') === 'player' ? 'teal' : 'berry';
    setMessage(`${who}'s turn.`);
    await new Promise(resolve => {
        window._startHandoff = () => { hideOverlay(); resolve(); };
        showOverlay(`
            <div class="overlay-box handoff-box" style="max-width:440px;">
                <div class="overlay-icon ${tone}">${iconSVG('swap')}</div>
                <h2>${who}'s turn</h2>
                <p>Pass the device to ${who}. The board and cards stay hidden until they are ready.</p>
                <div class="overlay-actions"><button class="clay-btn ${tone} big" onclick="_startHandoff()">I'm ${who}, start</button></div>
            </div>
        `);
    });
    beginPlayerTurn();
}

// ---------- boss raid ----------
function bossDie() { return (game.cpuDice || []).find(d => d.archetype === 'boss' && d.hp > 0); }
function bossPhase(b) {
    if (!b) return 1;
    const pct = b.hp / b.maxHp;
    return pct > 0.66 ? 1 : pct > 0.33 ? 2 : 3;
}
function bossEnraged() { return isBossMode() && bossPhase(bossDie()) === 3; }

function bossPanelHTML() {
    const b = (game.cpuDice || []).find(d => d.archetype === 'boss');
    if (!b) return '';
    const pct = Math.max(0, b.hp / b.maxHp) * 100;
    const phase = bossPhase(b);
    const phases = ['Summoning', 'Ground slam', 'Enraged'];
    return `
        <div class="boss-card" onclick="showDieInfoById('${b.id}')">
            <div class="boss-head">
                ${classBadge('boss', 'lg')}
                <div><div class="boss-name">Dice Titan${isBossEndless() ? ` <span class="boss-lvl">Lv ${game.bossLevel || 1}</span>` : ''}</div><div class="boss-phase">Phase ${phase}: ${phases[phase - 1]}</div></div>
                <div class="die-dmg-chip">${getDieEffectiveDamage(b)}<small>dmg</small></div>
            </div>
            <div class="boss-bar"><i style="width:${pct}%"></i><b style="left:33%"></b><b style="left:66%"></b></div>
            <div class="boss-hp">${Math.max(0, b.hp)} / ${b.maxHp} HP</div>
            ${isBossEndless() ? `<div class="boss-score"><span>Score <b>${game.bossScore || 0}</b></span><span>Best <b>${Math.max(readBossBest(), game.bossScore || 0)}</b></span></div>` : ''}
            <div class="die-sub">${dieTagsMiniHTML(b)}</div>
        </div>`;
}

async function bossAbilities() {
    const boss = bossDie();
    if (!boss || boss.frozen > 0) return;
    game.bossTurn = (game.bossTurn || 0) + 1;
    const phase = bossPhase(boss);

    // phase changes are announced once
    if (phase > (game.bossPhaseShown || 1)) {
        game.bossPhaseShown = phase;
        if (phase === 2) showBlitzAnnouncement('The Titan roars', 'Below 66% HP it slams the ground every other turn.');
        else showBlitzAnnouncement('The Titan is enraged', 'Below 33% HP: +2 moves, +6 damage and an arena event every wave.');
        shakeBoard(700);
        SFX.blitz();
        await delay(1600);
    }

    if (phase === 3) boss.moveAllowance += 2;

    // Summon Horde: every 2 waves
    if (game.wave % 2 === 0 && game.bossSummonWave !== game.wave) {
        game.bossSummonWave = game.wave;
        const count = phase === 3 ? 2 : 1;
        const now = performance.now();
        for (let i = 0; i < count; i++) {
            const h = findNearestEmptyHex(boss.q, boss.r);
            const kind = (game.bossTurn + i) % 2 ? 'mummy' : 'robot';
            game.bees.push({ id: Math.random(), q: h.q, r: h.r, kind, wavesLeft: 2, ownerTeam: 'cpu', bornAt: now + i * 180 });
            matchTimeout(() => { const p = hexScreen(h.q, h.r); spawnChunks(p.x, p.y + HEX_SIZE * 0.3, '#5A4787', 8, 2.5); }, i * 180);
        }
        addFloatingText(`Summon Horde +${count}`, boss.q, boss.r, '#B79CF2', 20);
        addCombatLog(`The Titan summoned ${count} ${count === 1 ? 'minion' : 'minions'}`, '', '#8468C4');
        SFX.crumble();
        await delay(900);
    }

    // Titan Slam: from phase 2, every other boss turn
    if (phase >= 2 && game.bossTurn % 2 === 0) {
        const dmg = phase === 3 ? 10 : 7;
        fxSweep(boss, 2, 520);
        shakeBoard(600);
        SFX.quake();
        await delay(300);
        const hit = aliveDice('player').filter(p => !p.concealed && hexDist(p.q, p.r, boss.q, boss.r) <= 2);
        for (const p of hit) dealDirectDamage(p, dmg, boss, 'Titan Slam', '#8468C4');
        addCombatLog(`Titan Slam hit ${hit.length} ${hit.length === 1 ? 'die' : 'dice'} for ${dmg}`, '', '#8468C4');
        updateDiceHP();
        await delay(600);
    }
}

// ---------- per-mode setup (called at the end of resetGame) ----------
function applyModeSetup() {
    if (document.body && document.body.classList) document.body.classList.remove('is-paused');
    game.mode = gameSettings.mode || 'classic';
    game.sidesSwapped = false;
    game.paused = false;
    game.statsOther = freshStats();
    game.pendingComebacksOther = [];
    if (game.mode === 'hotseat') {
        const p2 = gameSettings.p2Classes && gameSettings.p2Classes.length === 3 ? gameSettings.p2Classes : ['rage', 'mage', 'defender'];
        game.cpuDice = p2.map((a, i) => createDie('c' + (i + 1), [0, 2, 4][i], -4, 'cpu', a));
    } else if (game.mode === 'puzzle') {
        game.puzzleIndex = gameSettings.puzzleIndex || 0;
        applyPuzzleSetup();
    } else if (game.mode === 'boss') {
        const boss = createDie('c1', 0, -3, 'cpu', 'boss');
        boss.maxHp = boss.hp = (gameSettings.startHp || 50) * 3;
        boss.isBoss = true;
        game.cpuDice = [boss];
        game.bossTurn = 0;
        game.bossPhaseShown = 1;
        game.bossEndless = !!gameSettings.bossEndless;
        game.bossLevel = 1;
        game.bossScore = 0;
        game.bossScoreResult = null;
    }
}

// ---------- boss raid: endless ----------
function isBossEndless() { return isBossMode() && !!(game && game.bossEndless); }
function bossBestKey() { return `diceWars.bossBest.${gameSettings.startHp || 50}`; }
function readBossBest() { try { return parseInt(localStorage.getItem(bossBestKey()), 10) || 0; } catch (e) { return 0; } }
function saveBossBest(score) { try { localStorage.setItem(bossBestKey(), String(score)); } catch (e) {} }

// Score = every point of HP the Titan loses, whatever the source
function recordBossDamage(die, lost) {
    if (!isBossEndless() || !die || die.archetype !== 'boss' || !(lost > 0)) return;
    game.bossScore = (game.bossScore || 0) + lost;
}

// Endless: instead of dying, the Titan rises one level stronger
function bossRebirth(die) {
    if (!isBossEndless() || !die || die.archetype !== 'boss') return false;
    game.bossLevel = (game.bossLevel || 1) + 1;
    const lvl = game.bossLevel;
    die.maxHp = Math.round((gameSettings.startHp || 50) * 3 * (1 + 0.35 * (lvl - 1)));
    die.hp = die.maxHp;
    die.frozen = 0; die.petrified = false; die.trapped = 0;
    die.bleedStacks = 0; die.bleedTurns = 0; die.antiHealTurns = 0;
    game.bossPhaseShown = 1;
    game.bossTurn = 0;
    for (const d of aliveDice('player')) d.hp = Math.min(d.maxHp, d.hp + 10);
    showBlitzAnnouncement(`Titan level ${lvl}`, `It rises again with ${die.maxHp} HP and +${lvl - 1} damage. Your squad recovers 10 HP.`);
    addFloatingText(`Level ${lvl}`, die.q, die.r, '#B79CF2', 24);
    addCombatLog(`The Titan rose again at level ${lvl} (${die.maxHp} HP)`, '', '#8468C4');
    fxImpact(die, '#B79CF2', true);
    shakeBoard(700);
    SFX.blitz();
    updateDiceHP();
    return true;
}

function finishEndlessScore() {
    if (game.bossScoreResult) return game.bossScoreResult;
    const score = game.bossScore || 0, prev = readBossBest();
    if (score > prev) saveBossBest(score);
    return (game.bossScoreResult = { score, best: Math.max(prev, score), isNew: score > prev });
}

// Boss raid starts with the players, after a short briefing
function showBossIntro() {
    game.currentTurn = 'player';
    game.firstPlayerThisWave = 'player';
    game.turnsInCurrentWave = 0;
    if (fastAutoMode) { hideOverlay(); beginPlayerTurn(); return; }
    showOverlay(`
        <div class="overlay-box" style="max-width:500px;">
            <div class="overlay-icon violet">${iconSVG('boss')}</div>
            <h2>${isBossEndless() ? 'Endless raid' : 'Boss raid: the Dice Titan'}</h2>
            <p>${isBossEndless()
                ? `The Titan never stays down: each time you drain its ${bossDie().maxHp} HP it rises a level stronger. Your score is all the damage it takes before your squad falls. Best so far: <b>${readBossBest()}</b>.`
                : `One giant die with ${bossDie().maxHp} HP. It hits harder, cannot be pushed or mind-controlled, and changes as it weakens.`}</p>
            <ul class="boss-brief">
                <li><b>Phase 1</b> summons a mummy or robot every 2 waves. Minions only hunt your dice.</li>
                <li><b>Phase 2</b> (below 66%) adds a Titan Slam around itself every other turn.</li>
                <li><b>Phase 3</b> (below 33%) enrages: more moves, more damage, an arena event every wave.</li>
            </ul>
            <div class="overlay-actions"><button class="clay-btn violet big" onclick="hideOverlay(); beginPlayerTurn();">Start the raid</button></div>
        </div>
    `);
}

// ---------- Player 2 squad picker (setup screen) ----------
function randomSquad() {
    return [...ARCHETYPES].sort(() => Math.random() - 0.5).slice(0, 3).map(a => a.id);
}
function cycleP2Class(i, dir) {
    const list = gameSettings.p2Classes;
    const ids = ARCHETYPES.map(a => a.id).filter(id => !list.some((c, j) => j !== i && c === id));
    let pos = ids.indexOf(list[i]);
    pos = (pos + dir + ids.length) % ids.length;
    list[i] = ids[pos];
    const el = document.getElementById('p2-squad');
    if (el) el.innerHTML = p2SquadHTML();
}
function p2SquadHTML() {
    return gameSettings.p2Classes.map((id, i) => `
        <div class="p2-pick">
            <button class="carousel-arrow-btn" onclick="cycleP2Class(${i}, -1)" aria-label="Previous class">${iconSVG('left')}</button>
            <div class="p2-pick-body">${classBadge(id, 'lg')}<span>${archName(id)}</span></div>
            <button class="carousel-arrow-btn" onclick="cycleP2Class(${i}, 1)" aria-label="Next class">${iconSVG('right')}</button>
        </div>`).join('');
}
