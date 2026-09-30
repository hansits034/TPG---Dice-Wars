// ==========================================================
// 9. TIMER, STOPWATCH & UI UPDATES
// ==========================================================
function startTurnTimer() {
    stopTurnTimer();
    game.turnTimeLeft = TURN_TIME_LIMIT;
    updateTimerDisplay();

    turnTimerInterval = setInterval(() => {
        // Timer pauses while animations / turn transitions resolve so a timeout can't race an in-flight action
        const nonTurnPhases = ['START', 'SELECT', 'SETTINGS', 'PLAYER_ROLL', 'CPU_ROLL', 'WAVE_CLEAR', 'UPGRADE_MODAL', 'GAME_OVER', 'PLAYER_ANIMATING', 'TURN_ENDING'];
        if (nonTurnPhases.includes(game.phase) || game.paused) return;
        game.turnTimeLeft--;
        updateTimerDisplay();

        if (game.turnTimeLeft <= 0) {
            stopTurnTimer();
            addFloatingText('Time out!', 0, 0, '#F2B84B', 24);
            if (game.currentTurn === 'player') {
                if (typeof cancelCard === 'function') cancelCard();
                game.pivotPreview = false;
                game.pivotPiercer = null;
                game.archerSource = null;
                game.mindControlSource = null;
                game.psychicSource = null;
                game.psychicTargetEnemy = null;
                game.psychicAura = false;
                const canvasWrap = document.getElementById('canvas-wrapper');
                if (canvasWrap) canvasWrap.classList.remove('aura-psychic');
                game.phase = 'PLAYER_TURN';
                endTurn();
            }
        }
    }, 1000);
}

function stopTurnTimer() {
    if (turnTimerInterval) clearInterval(turnTimerInterval);
    turnTimerInterval = null;
}

function startStopwatch() {
    stopStopwatch();
    game.matchTimeSeconds = 0;
    updateStopwatchDisplay();
    stopwatchInterval = setInterval(() => {
        if (game.paused) return;
        game.matchTimeSeconds++;
        updateStopwatchDisplay();
    }, 1000);
}

function stopStopwatch() {
    if (stopwatchInterval) clearInterval(stopwatchInterval);
    stopwatchInterval = null;
}

function formatClock(totalSeconds) {
    const m = String(Math.floor((totalSeconds || 0) / 60)).padStart(2, '0');
    const s = String((totalSeconds || 0) % 60).padStart(2, '0');
    return `${m}:${s}`;
}

function updateStopwatchDisplay() {
    const el = document.getElementById('stopwatch-badge');
    const val = el && el.querySelector('.sw-val');
    if (val) val.textContent = formatClock(game.matchTimeSeconds);
}

function updateTimerDisplay() {
    const el = document.getElementById('timer-badge');
    if (!el) return;
    const span = el.querySelector('span');
    if (span) span.textContent = game.turnTimeLeft;
    el.classList.toggle('low', game.currentTurn === 'player' && game.turnTimeLeft <= 8);
}

// Human-readable label for a die in rosters and reports
function dieDisplayName(d, i) {
    const cls = archName(d.archetype);
    if (d.archetype === 'boss') return { name: 'Dice Titan', sub: '' };
    if (d.isCloneDie) return { name: `${cls} clone`, sub: '' };
    if (d.isSplit) return { name: `${cls} undead`, sub: d.id.endsWith('_a') ? 'A' : 'B' };
    return { name: cls, sub: `Die ${i + 1}` };
}

function dieTagsHTML(d) {
    const tags = [];
    if (d.moveAllowance > 0 && game.currentTurn === d.team) tags.push(`<span class="tag moves">${iconSVG('sprint')}${d.moveAllowance} moves</span>`);
    if (d.frozen > 0) tags.push(`<span class="tag frozen">${iconSVG('snow')}Frozen ${d.frozen}</span>`);
    if (d.trapped > 0) tags.push(`<span class="tag trapped">${iconSVG('vine')}Rooted ${d.trapped}</span>`);
    if (d.bleedStacks > 0) tags.push(`<span class="tag bleed">${iconSVG('drop')}Bleed ${d.bleedStacks}</span>`);
    if ((d.aegisShield || 0) > 0) tags.push(`<span class="tag shield">${iconSVG('aegis')}${d.aegisShield}</span>`);
    if (d.concealed > 0) tags.push(`<span class="tag hidden">${iconSVG('bubble')}Immune ${d.concealed}</span>`);
    if (d.isMindControlled) tags.push(`<span class="tag zap">${iconSVG('telekinator')}Controlled</span>`);
    const rage = getDieRageBonus(d);
    if (rage > 0) tags.push(`<span class="tag rage">${iconSVG('flame')}+${rage} rage</span>`);
    if (d.archetype === 'mage' || getSkillLevel(d, 'zap') > 0) tags.push(`<span class="tag zap">${iconSVG('bolt')}Zap ${d.zapStacks || 0}/2</span>`);
    const psyLvl = Math.min(3, getSkillLevel(d, 'psychic'));
    if (psyLvl > 0 && d.psychicMisses > 0) {
        const pity = PSYCHIC_PITY[psyLvl];
        tags.push(`<span class="tag zap">${iconSVG('telekinator')}${d.psychicMisses >= pity ? 'Push guaranteed next' : `Push misses ${d.psychicMisses}/${pity}`}</span>`);
    }
    return tags.join('');
}

// Skill level bars: one segment per level, filled up to the current level
function dieSkillsHTML(d) {
    if (!d.skills || d.skills.length === 0) return '';
    return `<div class="die-skills">${d.skills.map(sk => {
        const pips = Array.from({ length: sk.maxLvl }, (_, i) => `<i class="${i < sk.curLvl ? 'on' : ''}"></i>`).join('');
        const state = sk.curLvl === 0 ? 'locked' : sk.curLvl >= sk.maxLvl ? 'max' : '';
        const label = sk.curLvl === 0 ? 'Locked' : sk.curLvl >= sk.maxLvl ? 'Max' : `Lv ${sk.curLvl}`;
        return `<div class="skill-chip ${state}" title="${sk.name}: ${sk.desc}">
            <span class="skill-name">${sk.name}</span>
            <span class="skill-pips">${pips}</span>
            <span class="skill-lvl">${label}</span>
        </div>`;
    }).join('')}</div>`;
}

// Two-letter skill label for the compact roster ("Back Stronger" -> "BS", "Explode" -> "Ex")
function skillAbbr(name) {
    const words = name.split(/\s+/).filter(Boolean);
    return words.length > 1 ? (words[0][0] + words[1][0]).toUpperCase() : name.slice(0, 2);
}

// Compact skill meter: abbreviation + level segments; full name and description on hover
function dieSkillsMiniHTML(d) {
    if (!d.skills || d.skills.length === 0) return '';
    return d.skills.map(sk => {
        const pips = Array.from({ length: sk.maxLvl }, (_, i) => `<i class="${i < sk.curLvl ? 'on' : ''}"></i>`).join('');
        const state = sk.curLvl === 0 ? 'locked' : sk.curLvl >= sk.maxLvl ? 'max' : '';
        const lvl = sk.curLvl === 0 ? 'locked' : `level ${sk.curLvl} of ${sk.maxLvl}`;
        return `<span class="sk-mini ${state}" title="${sk.name} (${lvl}): ${sk.desc}"><b>${skillAbbr(sk.name)}</b><span class="skill-pips">${pips}</span></span>`;
    }).join('');
}

// Icon-only status chips for the compact roster
function dieTagsMiniHTML(d) {
    const t = [];
    const chip = (cls, icon, n, title) => t.push(`<span class="tag mini ${cls}" title="${title}">${iconSVG(icon)}${n != null ? n : ''}</span>`);
    if (d.moveAllowance > 0 && game.currentTurn === d.team) {
        chip('moves', 'sprint', d.moveAllowance, `${d.moveAllowance} moves left`);
    }
    if (d.frozen > 0) chip('frozen', 'snow', d.frozen, `Frozen for ${d.frozen} turns`);
    if (d.trapped > 0) chip('trapped', 'vine', d.trapped, `Rooted for ${d.trapped} turns`);
    if (d.bleedStacks > 0) chip('bleed', 'drop', d.bleedStacks, `Bleeding, ${d.bleedStacks} stacks`);
    if ((d.aegisShield || 0) > 0) chip('shield', 'aegis', d.aegisShield, `Aegis shield ${d.aegisShield}`);
    if (d.concealed > 0) chip('hidden', 'bubble', d.concealed, `Immune for ${d.concealed} waves`);
    if (d.isMindControlled) chip('zap', 'telekinator', null, 'Mind-controlled');
    const rage = getDieRageBonus(d);
    if (rage > 0) chip('rage', 'flame', '+' + rage, `Rage bonus +${rage} damage`);
    if (d.archetype === 'mage' || getSkillLevel(d, 'zap') > 0) chip('zap', 'bolt', d.zapStacks || 0, `Zap charges ${d.zapStacks || 0}/2`);
    const psyLvl = Math.min(3, getSkillLevel(d, 'psychic'));
    if (psyLvl > 0 && d.psychicMisses > 0) {
        const pity = PSYCHIC_PITY[psyLvl];
        chip('zap', 'telekinator', d.psychicMisses >= pity ? '!' : `${d.psychicMisses}/${pity}`,
            d.psychicMisses >= pity ? 'Next Psychic Push is guaranteed' : `Psychic Push missed ${d.psychicMisses} in a row; guaranteed after ${pity - d.psychicMisses} more`);
    }
    return t.join('');
}

function rosterHTML(dice, team) {
    const hpColor = pct => pct > 0.5 ? (displayTeam(team) === 'player' ? 'var(--player)' : 'var(--cpu)') : pct > 0.25 ? 'var(--gold)' : '#E4572E';
    return dice.map((d, i) => {
        const maxH = d.maxHp || gameSettings.startHp || MAX_HP;
        const pct = Math.max(0, Math.min(1, d.hp / maxH));
        const { name, sub } = dieDisplayName(d, i);
        const cls = [
            d.hp <= 0 ? 'dead' : '',
            d.frozen > 0 ? 'frozen' : '',
            d.trapped > 0 ? 'trapped' : '',
            d.concealed > 0 ? 'concealed' : '',
            game.selectedDie && game.selectedDie.id === d.id ? 'selected' : '',
        ].join(' ');
        return `<div class="die-hp-card ${cls}" onclick="showDieInfoById('${d.id}')" title="Tap for skill details">
            ${classBadge(d.archetype)}
            <div class="die-main">
                <div class="die-line">
                    <span class="die-name">${name}${sub ? `<small>${sub}</small>` : ''}</span>
                    <span class="hp-num">${Math.max(0, d.hp)}/${maxH}</span>
                    <span class="die-dmg-chip" title="Damage this turn">${getDieEffectiveDamage(d)}<small>dmg</small></span>
                </div>
                <div class="hp-bar-outer"><div class="hp-bar-inner" style="width:${pct * 100}%;background:${hpColor(pct)}"></div></div>
                ${d.hp > 0 ? `<div class="die-sub">${dieSkillsMiniHTML(d)}${dieTagsMiniHTML(d)}</div>` : ''}
            </div>
        </div>`;
    }).join('');
}

function updateDiceHP() {
    const cpuEl = document.getElementById('cpu-dice-hp');
    const plEl = document.getElementById('player-dice-hp');
    if (!cpuEl || !plEl) return;
    cpuEl.innerHTML = isBossMode() && game.cpuDice.some(d => d.archetype === 'boss') ? bossPanelHTML() : rosterHTML(game.cpuDice, 'cpu');
    plEl.innerHTML = rosterHTML(game.playerDice, 'player');
}

function rollDiceHTML(values, team) {
    const cls = displayTeam(team) === 'player' ? 'player-die' : 'cpu-die';
    const total = values.reduce((a, b) => a + b, 0);
    return values.map(v => `<span class="roll-die-box ${cls}">${v}</span>`).join('<span class="roll-plus">+</span>') +
        `<span class="roll-eq">=</span><span class="roll-total">${total}</span>`;
}

function updateRollDisplay(values, team) {
    const el = document.getElementById('roll-display');
    if (!el) return;
    el.innerHTML = values && values.length ? rollDiceHTML(values, team) : '';
}

function updateMoves() {
    const team = game.currentTurn === 'player' ? 'player' : 'cpu';
    const total = totalMovesLeft(team);
    const el = document.getElementById('moves-display');
    const perDie = aliveDice(team).map(d => {
        const atk = attacksLeft(d);
        const done = (d.moveAllowance <= 0 && atk <= 0) || puzzleLocked(d);
        const tip = puzzleLocked(d) ? `attacked: ${d.moveAllowance} moves saved, Attack Again unlocks them`
            : `${d.moveAllowance} ${d.moveAllowance === 1 ? 'move' : 'moves'} left, ${atk} ${atk === 1 ? 'attack' : 'attacks'} left`;
        return `<span class="die-moves ${done ? 'done' : ''}" title="${archName(d.archetype)}: ${tip}">${classBadge(d.archetype, 'sm')}<b>${d.moveAllowance}</b>${atk > 0 ? `<span class="die-atk">${iconSVG('swords')}${atk > 1 ? atk : ''}</span>` : ''}</span>`;
    }).join('');
    if (el) el.innerHTML = `<b>${total}</b> ${total === 1 ? 'move' : 'moves'}${game.currentTurn === 'cpu' && !isHotseat() ? (isBossMode() ? ' (Titan)' : ' (CPU)') : ''}${perDie ? `<span class="per-die-moves">${perDie}</span>` : ''}`;
    if (typeof updatePuzzleHud === 'function') updatePuzzleHud();
}

function updateWaveBadge() {
    const el = document.getElementById('wave-badge');
    if (el) el.textContent = `Wave ${game.wave}`;
    updateEventBadge();
}

// Countdown to the next arena event
function updateEventBadge() {
    const el = document.getElementById('event-badge');
    if (!el || !game.wave) return;
    const frenzy = game.wave >= BLITZ_EVERY_WAVE_AFTER;
    const next = nextBlitzWave(game.wave);
    const inWaves = next - game.wave;
    const brutal = isBrutalWave(game.wave);
    el.classList.toggle('frenzy', frenzy && !brutal);
    el.classList.toggle('brutal', brutal);
    el.classList.toggle('soon', inWaves === 1 && !frenzy);
    const brutalIn = BRUTAL_WAVE - game.wave;
    const label = brutal ? 'Brutal every wave' : frenzy ? (brutalIn <= 3 ? `Brutal in ${brutalIn}` : 'Event every wave') : inWaves === 1 ? 'Event next wave' : `Event in ${inWaves}`;
    el.innerHTML = `${iconSVG(brutal ? 'necromancer' : 'star')}<span>${label}</span>`;
    el.title = frenzy ? 'Final frenzy: an arena event every wave' : `Next arena event on wave ${next}`;
}

function setMessage(msg) {
    const el = document.getElementById('game-message');
    if (el) el.textContent = stripEmoji(localizeText(msg));
}

function setSkillButton(btn, icon, label, count) {
    btn.innerHTML = `${iconSVG(icon)}<span>${label}</span>${count != null ? `<span class="btn-count">${count}</span>` : ''}`;
}

function updateSkillButtons() {
    const isPlayerTurn = game.phase === 'PLAYER_TURN' && game.currentTurn === 'player';
    const alivePlayer = aliveDice('player');

    // 1. Mage Zap
    const zapBtn = document.getElementById('btn-zap');
    if (zapBtn) {
        const playerMage = alivePlayer.find(d => d.archetype === 'mage' || getSkillLevel(d, 'zap') > 0);
        if (playerMage) {
            zapBtn.style.display = 'inline-flex';
            const stacks = playerMage.zapStacks || 0;
            setSkillButton(zapBtn, 'bolt', 'Zap', stacks);
            zapBtn.disabled = !isPlayerTurn || stacks <= 0 || playerMage.frozen > 0 || playerMage.trapped > 0;
        } else {
            zapBtn.style.display = 'none';
        }
    }

    // 2. Archer Long Shot
    const archerBtn = document.getElementById('btn-archer');
    if (archerBtn) {
        const archers = alivePlayer.filter(d => d.archetype === 'archer' || getSkillLevel(d, 'longShot') > 0);
        const playerArcher = archers.find(d => !d.hasAttackedThisTurn && d.frozen === 0 && d.trapped === 0) || archers[0];
        if (playerArcher) {
            archerBtn.style.display = 'inline-flex';
            setSkillButton(archerBtn, 'archer', playerArcher.hasAttackedThisTurn ? 'Shot fired' : 'Long shot');
            archerBtn.disabled = !isPlayerTurn || playerArcher.hasAttackedThisTurn || playerArcher.frozen > 0 || playerArcher.trapped > 0;
        } else {
            archerBtn.style.display = 'none';
        }
    }

    // Puzzle: Necromancer Raise
    const raiseBtn = document.getElementById('btn-raise');
    if (raiseBtn) {
        const necro = typeof isPuzzle === 'function' && isPuzzle() ? alivePlayer.find(d => d.archetype === 'necromancer') : null;
        if (necro) {
            raiseBtn.style.display = 'inline-flex';
            setSkillButton(raiseBtn, 'necromancer', necro.puzzleRaised ? 'Raised' : 'Raise');
            raiseBtn.disabled = !isPlayerTurn || necro.puzzleRaised || puzzleOutOfActions();
        } else raiseBtn.style.display = 'none';
    }

    // 3. Piercer Pivot (3 wave cooldown + preview + cancel)
    const pivotBtn = document.getElementById('btn-pivot');
    const cancelPivotBtn = document.getElementById('btn-cancel-pivot');
    if (pivotBtn) {
        const piercers = alivePlayer.filter(d => getSkillLevel(d, 'pivot') > 0);
        const playerPiercer = piercers.find(d => !d.hasAttackedThisTurn && d.frozen === 0 && d.trapped === 0) || piercers[0];
        if (playerPiercer) {
            pivotBtn.style.display = 'inline-flex';
            const pivotUsed = getCooldownWave('pivotUsedWave', 'player');
            const isPivotReady = (game.wave - pivotUsed) >= 3;
            if (game.pivotPreview) {
                setSkillButton(pivotBtn, 'piercer', 'Strike now');
                pivotBtn.disabled = false;
                if (cancelPivotBtn) { cancelPivotBtn.style.display = 'inline-flex'; setSkillButton(cancelPivotBtn, 'close', 'Cancel'); }
            } else {
                setSkillButton(pivotBtn, 'piercer', isPivotReady ? 'Pivot' : `Pivot in wave ${pivotUsed + 3}`);
                pivotBtn.disabled = !isPlayerTurn || !isPivotReady || playerPiercer.hasAttackedThisTurn || playerPiercer.frozen > 0 || playerPiercer.trapped > 0;
                if (cancelPivotBtn) cancelPivotBtn.style.display = 'none';
            }
        } else {
            pivotBtn.style.display = 'none';
            if (cancelPivotBtn) cancelPivotBtn.style.display = 'none';
        }
    }

    // 4. Telekinator Mind Control (5 wave cooldown, needs more than 1 enemy)
    const mindBtn = document.getElementById('btn-mind-control');
    if (mindBtn) {
        const teles = alivePlayer.filter(d => getSkillLevel(d, 'mindControl') > 0);
        const playerTele = teles.find(d => d.frozen === 0 && d.trapped === 0) || teles[0];
        if (playerTele) {
            mindBtn.style.display = 'inline-flex';
            const mindUsed = getCooldownWave('mindControlUsedWave', 'player');
            const isMindReady = (game.wave - mindUsed) >= 5;
            if (aliveDice('cpu').length <= 1) {
                mindBtn.disabled = true;
                setSkillButton(mindBtn, 'telekinator', 'Mind control');
                mindBtn.title = 'Needs at least 2 enemy dice on the board';
            } else {
                mindBtn.disabled = !isPlayerTurn || !isMindReady || playerTele.frozen > 0 || playerTele.trapped > 0;
                setSkillButton(mindBtn, 'telekinator', isMindReady ? 'Mind control' : `Mind control in wave ${mindUsed + 5}`);
                mindBtn.title = 'Take control of one enemy die for 2 waves';
            }
        } else {
            mindBtn.style.display = 'none';
        }
    }

    // collapse the skill row when this team has no active skills
    const skillRow = document.getElementById('tray-skills');
    if (skillRow && skillRow.children) skillRow.classList.toggle('empty', ![...skillRow.children].some(b => b.style.display !== 'none'));
}

function updateZapButton() {
    updateSkillButtons();
}

function setButtons(endEnabled, deselectEnabled) {
    const endBtn = document.getElementById('btn-end');
    const desBtn = document.getElementById('btn-deselect');
    if (endBtn) endBtn.disabled = !endEnabled;
    if (desBtn) desBtn.disabled = !deselectEnabled;
    updateSkillButtons();
}

function cardArtHTML(card) {
    return `<span class="card-art">${iconSVG(CARD_ICONS[card.id] || 'cards')}</span>`;
}

function updateCardHand() {
    const el = document.getElementById('card-slots');
    const cancelBtn = document.getElementById('btn-cancel-card');
    const discardBtn = document.getElementById('btn-discard-card');
    if (cancelBtn) cancelBtn.classList.toggle('active', !!game.activeCard);
    if (discardBtn) discardBtn.classList.toggle('active', !!game.activeCard);

    if (el) {
        if (game.playerHand.length === 0) {
            el.innerHTML = typeof isPuzzle === 'function' && isPuzzle()
                ? '<span class="empty-hand">No cards in this puzzle.</span>'
                : '<span class="empty-hand">No cards yet. Step on a glowing crystal to draw one.</span>';
        } else {
            el.innerHTML = game.playerHand.map((card, i) => {
                const activeCls = game.activeCard && game.activeCard._handIdx === i ? ' active-card' : '';
                return `<button class="card-slot ${card.rarity}${activeCls}" onclick="onCardClick(${i})" id="card-slot-${i}" title="${card.name} (${card.rarity}): ${card.desc}">
                    <span class="card-rarity"></span>
                    ${cardArtHTML(card)}
                    <span class="card-name">${card.name}</span>
                    <span class="card-desc">${card.desc}</span>
                </button>`;
            }).join('');
        }
    }
    const cpuHandEl = document.getElementById('cpu-hand-count');
    if (cpuHandEl) cpuHandEl.innerHTML = `${iconSVG('cards')}${game.cpuHand.length}/${getMaxHandSize('cpu')} cards`;
}

function showCardPopup(card, team) {
    const popup = document.createElement('div');
    popup.className = 'card-gained-popup';
    popup.innerHTML = `
        <span class="card-art" style="--rc:var(--${card.rarity})">${iconSVG(CARD_ICONS[card.id] || 'cards')}</span>
        <div>
            <div class="cg-title">New ${card.rarity} card</div>
            <div class="cg-name">${card.name}</div>
            <div class="cg-desc">${card.desc}</div>
        </div>
    `;
    document.body.appendChild(popup);
    setTimeout(() => popup.remove(), 2300);
}

function showBlitzAnnouncement(title, desc) {
    const el = document.createElement('div');
    el.className = 'blitz-announcement';
    const icon = {
        Tornado: 'dash', 'Alien visit': 'telekinator', Earthquake: 'wall',
        Collapse: 'close', Rockslide: 'wall', 'Acid flood': 'drop',
        Wildfire: 'flame', 'Spike traps': 'trap', 'Biohazard leak': 'flask',
        Vines: 'vine', "Medusa's gaze": 'telekinator', Snowstorm: 'snow',
        'Bee swarm': 'bolt', 'Mummy attack': 'necromancer', 'Killer robots': 'defender',
        'The Magician': 'mage',
    }[title] || 'star';
    el.innerHTML = `
        <span class="blitz-badge">${iconSVG(icon)}</span>
        <div>
            <div class="blitz-kicker">${isBrutalWave(game.wave) ? 'Brutal arena' : game.wave > BLITZ_EVERY_WAVE_AFTER ? 'Final frenzy' : game.wave >= 30 ? 'Showdown' : 'Arena event'}, wave ${game.wave}</div>
            <div class="blitz-title">${stripEmoji(title)}</div>
            <div class="blitz-desc">${stripEmoji(desc)}</div>
        </div>
    `;
    document.body.appendChild(el);
    SFX.blitz();
    setTimeout(() => {
        el.style.animation = 'blitzFadeOut 0.35s ease-in forwards';
        setTimeout(() => el.remove(), 350);
    }, 2400);
}

function showOverlay(html) {
    const ol = document.getElementById('overlay');
    if (ol) {
        ol.innerHTML = stripEmoji(html);
        ol.classList.remove('hidden');
    }
}

function hideOverlay() {
    const ol = document.getElementById('overlay');
    if (ol) ol.classList.add('hidden');
}

function openGameMenuModal() {
    pauseGame();
    showOverlay(`
        <div class="overlay-box pause-box" style="max-width:420px;">
            <div class="overlay-icon violet">${iconSVG('pause')}</div>
            <h2>Paused</h2>
            <p>The match is frozen: turn timer, match clock and the ${isHotseat() ? "other player's" : isBossMode() ? "Titan's" : "computer's"} moves all wait for you. Press P to resume.</p>
            <div class="menu-list">
                <button class="clay-btn plain" onclick="hideOverlay(); toggleBGM(); setTimeout(openGameMenuModal, 100);">
                    ${iconSVG(bgmEnabled ? 'music' : 'mute')}${bgmEnabled ? 'Music is on' : 'Music is off'}
                </button>
                <button class="clay-btn gold" onclick="resumeGame(); startGame();">${iconSVG('restart')}${isPuzzle() ? 'Restart puzzle' : 'Restart match'}</button>
                ${isPuzzle() ? `<button class="clay-btn plain" onclick="resumeGame(); showPuzzleHint();">${iconSVG('puzzle')}Next step hint</button>
                <button class="clay-btn plain" onclick="resumeGame(); openPuzzleSelect();">${iconSVG('left')}All puzzles</button>` : ''}
                <button class="clay-btn berry" onclick="hideOverlay(); quitToMainMenu();">${iconSVG('home')}Quit to main menu</button>
                <button class="clay-btn plain" onclick="resetTips(); resumeGame(); setMessage('Tips will show again as things come up.');">${iconSVG('help')}Show tips again</button>
                <button class="clay-btn teal" onclick="resumeGame();">${iconSVG('right')}Resume</button>
            </div>
        </div>
    `);
}

function quitToMainMenu() {
    // Abort the running match so pending async turn flows (CPU loop, animations, timeouts) stop
    if (game) {
        game.aborted = true;
        game.phase = 'GAME_OVER';
    }
    stopTurnTimer();
    stopStopwatch();
    hideOverlay();
    document.getElementById('game-screen').classList.remove('active');
    document.getElementById('start-screen').classList.remove('hidden');
    document.body.classList.remove('mode-puzzle', 'is-paused');
    if (gameSettings.mode === 'puzzle') gameSettings.mode = 'classic';
}

// Current active role in the class guide
let selectedCodexRoleId = 'dracula';
const PASSIVE_SKILLS = ['defenderMastery', 'dashMastery', 'backStronger', 'doctorMastery', 'momentum', 'standstill'];

function renderCodexRoleDetails(archId) {
    selectedCodexRoleId = archId;
    const arch = ARCHETYPES.find(a => a.id === archId) || ARCHETYPES[0];

    document.querySelectorAll('.royale-card').forEach(card => {
        card.classList.toggle('active', card.dataset.archId === archId);
    });

    const detailsContainer = document.getElementById('codex-role-details-area');
    if (!detailsContainer) return;

    let activeSkillCount = 0;
    const skillsHTML = arch.skills.map((s) => {
        const isPassive = PASSIVE_SKILLS.includes(s.id);
        const tagText = isPassive ? 'Passive' : `Skill ${++activeSkillCount}`;
        const startNote = s.curLvl > 0 ? `starts at level ${s.curLvl}` : 'unlock through upgrades';
        return `
            <div class="codex-skill-box">
                <div class="codex-skill-head">
                    <span class="codex-skill-title">${s.name}<span class="codex-skill-max">max level ${s.maxLvl}, ${startNote}</span></span>
                    <span class="codex-skill-badge ${isPassive ? 'passive-badge' : ''}">${tagText}</span>
                </div>
                <div class="codex-skill-desc">${s.desc}</div>
            </div>
        `;
    }).join('');

    detailsContainer.innerHTML = `
        <div class="codex-role-title-row">
            ${classBadge(arch.id, 'xl')}
            <div>
                <div class="codex-hero-name">${arch.name}</div>
                <div class="codex-hero-sub">${arch.skills.length} skills. Level them up every 4 waves.</div>
            </div>
        </div>
        <div class="codex-skills-list">${skillsHTML}</div>
    `;
    if (typeof SFX !== 'undefined' && SFX.move) SFX.move();
}

function openDiceGuideModal() {
    selectedCodexRoleId = selectedPlayerClasses[0] || 'dracula';
    const cardsHTML = ARCHETYPES.map(arch => `
        <button class="royale-card${arch.id === selectedCodexRoleId ? ' active' : ''}" data-arch-id="${arch.id}" onclick="renderCodexRoleDetails('${arch.id}')">
            ${classBadge(arch.id, 'lg')}
            <span class="royale-card-ribbon">${arch.name}</span>
        </button>
    `).join('');

    showOverlay(`
        <div class="overlay-box dice-codex-container">
            <h2>Class guide</h2>
            <p class="overlay-lead" style="margin:0;">${ARCHETYPES.length} classes. Pick one to see what it does.</p>
            <div class="codex-card-deck-grid">${cardsHTML}</div>
            <div class="codex-details-card" id="codex-role-details-area"></div>
            <div class="overlay-actions"><button class="clay-btn teal" onclick="hideOverlay();">Close guide</button></div>
        </div>
    `);
    renderCodexRoleDetails(selectedCodexRoleId);
}

function openHelpModal() {
    const totalWeight = CARD_DEFS.reduce((s, c) => s + c.weight, 0);
    const cardRowsHTML = CARD_DEFS.map(c => `
        <tr>
            <td><span class="help-card-name"><span class="card-art" style="--rc:var(--${c.rarity})">${iconSVG(CARD_ICONS[c.id] || 'cards')}</span>${c.name}</span></td>
            <td><span class="card-rarity-tag ${c.rarity}">${c.rarity}</span></td>
            <td>${((c.weight / totalWeight) * 100).toFixed(1)}%</td>
            <td>${c.desc}</td>
        </tr>
    `).join('');

    showOverlay(`
        <div class="overlay-box help-content">
            <h2>How to play</h2>

            <h3>Your turn</h3>
            <ul>
                <li>Your dice roll at the start of every turn. Each die can move up to its roll, and its face value is its damage.</li>
                <li>Click one of your dice, then click a lit tile to move or a red tile to attack.</li>
                <li>Every die starts with <strong>50, 75 or 100 HP</strong>, depending on match settings. Destroy all enemy dice to win.</li>
            </ul>

            <h3>Arena rhythm</h3>
            <ul>
                <li><strong>Every 3 waves</strong>, glowing crystals appear. Step on one to draw a card (hand limit 3, or 4 with a Defender, Samurai or Doctor).</li>
                <li><strong>Puzzles:</strong> one-turn challenges with fixed dice, odd maps and rocks. Press R to restart a puzzle and H for a step-by-step hint.</li>
                <li><strong>Modes:</strong> play against the computer, pass one device between 2 players, or raid the Dice Titan boss (once, or Endless for a high score). Press P or the pause button any time to freeze the match.</li>
                <li><strong>Every 4 waves</strong>, pick one skill upgrade from three choices. Losing a die to the enemy also earns a <strong>comeback upgrade</strong> for your remaining dice.</li>
                <li><strong>Arena events</strong> hit on waves 5, 10, 14, 18, 21, 24, 27, 30, then every 2 waves, and every single wave from wave 37. Their effects stack. From wave 40 they turn <strong>brutal</strong>: 50% more tiles, double damage, traps last 2 waves longer.</li>
            </ul>

            <h3>Cards</h3>
            <div style="overflow-x:auto;">
                <table class="help-probability-table">
                    <thead><tr><th>Card</th><th>Rarity</th><th>Drop rate</th><th>Effect</th></tr></thead>
                    <tbody>${cardRowsHTML}</tbody>
                </table>
            </div>

            <h3>Arena events</h3>
            <ul class="blitz-list">
                <li><strong>Upheaval.</strong> Tornado throws every die, an alien saucer teleports a few, or an earthquake slides the whole arena one tile.</li>
                <li><strong>Blocked ground.</strong> 5 to 8 tiles become a void, a mountain or an acid pool for 3 waves.</li>
                <li><strong>Hazard tiles.</strong> Fire (3 damage), spikes (4 damage) or a biohazard leak (2 damage and no healing).</li>
                <li><strong>Snares.</strong> Vines root. Medusa's gaze petrifies and snowstorm ice freezes a die solid for 2 rounds.</li>
                <li><strong>Invaders.</strong> Bees sting and slow, mummies hit hard and curse healing, robots hunt the weakest die.</li>
                <li><strong>Magician.</strong> Both sides draw 2 cards.</li>
            </ul>
            <div class="overlay-actions"><button class="clay-btn teal" onclick="hideOverlay();">Got it</button></div>
        </div>
    `);
}

// ==========================================================
// STATS PANEL & MATCH SETTINGS MODAL
// ==========================================================
let currentStatsTab = 'dealt'; // 'dealt', 'taken', 'heal', 'log'

function toggleStatsPanel() {
    const p = document.getElementById('stats-panel-widget');
    if (p) p.classList.toggle('open');
}

function switchStatsTab(tab) {
    currentStatsTab = tab;
    ['dealt', 'taken', 'heal', 'log'].forEach(t => {
        const btn = document.getElementById(`tab-stat-${t}`);
        if (btn) btn.classList.toggle('active', t === tab);
    });
    updateStatsDisplay();
}

function statRowsHTML(pDice, data, maxVal, color, suffix) {
    return pDice.map((d, i) => {
        const val = data[d.id] || 0;
        const pct = Math.round((val / maxVal) * 100);
        return `
            <div class="stat-row-item">
                <div class="stat-row-label">
                    <span>${classBadge(d.archetype, 'sm')}${dieDisplayName(d, i).name}</span>
                    <span>${val} ${suffix}</span>
                </div>
                <div class="stat-bar-bg"><div class="stat-bar-fill" style="width:${pct}%;background:${color};"></div></div>
            </div>
        `;
    }).join('');
}

function updateStatsDisplay() {
    const area = document.getElementById('stats-content-area');
    if (!area || !game.stats) return;
    const pDice = game.playerDice || [];

    if (currentStatsTab === 'dealt' || currentStatsTab === 'taken') {
        const isDealt = currentStatsTab === 'dealt';
        const data = (isDealt ? game.stats.damageDealt : game.stats.damageTaken) || { total: 0 };
        const maxVal = Math.max(1, data.total || 0);
        area.innerHTML = `
            <div class="stat-bar-group">${statRowsHTML(pDice, data, maxVal, isDealt ? 'var(--gold)' : 'var(--cpu)', 'dmg')}</div>
            <div class="stat-total-summary"><span>${isDealt ? 'Damage dealt' : 'Damage taken'}</span><strong>${data.total || 0}</strong></div>
        `;
    } else if (currentStatsTab === 'heal') {
        const data = game.stats.healDone || { cards: 0, total: 0 };
        const maxVal = Math.max(1, data.total || 0);
        const cardHealVal = data.cards || 0;
        area.innerHTML = `
            <div class="stat-bar-group">
                ${statRowsHTML(pDice, data, maxVal, 'var(--player)', 'hp')}
                <div class="stat-row-item">
                    <div class="stat-row-label"><span>${iconSVG('heart')}Heal cards</span><span>${cardHealVal} hp</span></div>
                    <div class="stat-bar-bg"><div class="stat-bar-fill" style="width:${Math.round((cardHealVal / maxVal) * 100)}%;background:var(--player-lip);"></div></div>
                </div>
            </div>
            <div class="stat-total-summary"><span>HP restored</span><strong>${data.total || 0}</strong></div>
        `;
    } else if (currentStatsTab === 'log') {
        const logs = game.combatLog || [];
        if (logs.length === 0) {
            area.innerHTML = `<div class="stats-empty">Nothing has happened yet. Moves and hits will show up here.</div>`;
        } else {
            area.innerHTML = `<div class="combat-log-container">${logs.map(entry => `
                <div class="combat-log-item">
                    <span class="log-dot" style="background:${entry.color || 'var(--sky)'}"></span>
                    <div>
                        <div class="combat-log-meta">Wave ${entry.wave}, ${entry.time}</div>
                        <div class="combat-log-text">${entry.text}</div>
                    </div>
                </div>
            `).join('')}</div>`;
        }
    }
}

function openGameSettingsModal() {
    let selectedHp = gameSettings.startHp || 50;
    let selectedDiff = gameSettings.difficulty || 'medium';
    let selectedMode = gameSettings.mode && gameSettings.mode !== 'puzzle' ? gameSettings.mode : 'classic';
    let selectedEndless = !!gameSettings.bossEndless;
    window._selectSettingBoss = function (endless) {
        selectedEndless = endless;
        document.querySelectorAll('.boss-opt-btn').forEach(b => b.classList.toggle('active', (b.dataset.endless === '1') === endless));
    };
    if (!gameSettings.p2Classes || gameSettings.p2Classes.length !== 3) gameSettings.p2Classes = randomSquad();

    window._selectSettingMode = function (mode) {
        selectedMode = mode;
        document.querySelectorAll('.mode-opt-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
        const p2 = document.getElementById('p2-section');
        const diff = document.getElementById('diff-section');
        if (p2) p2.style.display = mode === 'hotseat' ? '' : 'none';
        if (diff) diff.style.display = mode === 'hotseat' ? 'none' : '';
        const boss = document.getElementById('boss-section');
        if (boss) boss.style.display = mode === 'boss' ? '' : 'none';
    };

    window._selectSettingHp = function (hp) {
        selectedHp = hp;
        document.querySelectorAll('.hp-opt-btn').forEach(b => b.classList.toggle('active', parseInt(b.dataset.hp) === hp));
    };
    window._selectSettingDiff = function (diff) {
        selectedDiff = diff;
        document.querySelectorAll('.diff-opt-btn').forEach(b => b.classList.toggle('active', b.dataset.diff === diff));
    };
    window._confirmSettingsAndStart = function () {
        gameSettings.startHp = selectedHp;
        gameSettings.difficulty = selectedDiff;
        gameSettings.mode = selectedMode;
        gameSettings.bossEndless = selectedEndless;
        if (selectedMode === 'hotseat' && fastAutoMode) toggleFastAutoModeOff();
        hideOverlay();
        startGame();
    };

    const modeOpt = (id, name, desc) => `<button class="settings-opt-btn mode-opt-btn ${selectedMode === id ? 'active' : ''}" data-mode="${id}" onclick="_selectSettingMode('${id}')">
        <div class="settings-opt-name">${name}</div><div class="settings-opt-desc">${desc}</div></button>`;
    const bossOpt = (endless, name, desc) => `<button class="settings-opt-btn boss-opt-btn ${selectedEndless === endless ? 'active' : ''}" data-endless="${endless ? 1 : 0}" onclick="_selectSettingBoss(${endless})">
        <div class="settings-opt-name">${name}</div><div class="settings-opt-desc">${desc}</div></button>`;
    const hpOpt = (hp, desc) => `<button class="settings-opt-btn hp-opt-btn ${selectedHp === hp ? 'active' : ''}" data-hp="${hp}" onclick="_selectSettingHp(${hp})">
        <div class="settings-opt-name">${hp} HP</div><div class="settings-opt-desc">${desc}</div></button>`;
    const diffOpt = (id, name, desc) => `<button class="settings-opt-btn diff-opt-btn ${selectedDiff === id ? 'active' : ''}" data-diff="${id}" onclick="_selectSettingDiff('${id}')">
        <div class="settings-opt-name">${name}</div><div class="settings-opt-desc">${desc}</div></button>`;

    showOverlay(`
        <div class="overlay-box settings-modal-box">
            <h2>Match setup</h2>
            <p class="overlay-lead" style="margin:0;">Pick a mode, how long the fight lasts and how sharp the computer plays.</p>

            <div class="settings-section-title">Mode</div>
            <div class="settings-options-grid">
                ${modeOpt('classic', 'Vs computer', 'Your squad against the CPU')}
                ${modeOpt('hotseat', '2 players', 'Take turns on one device')}
                ${modeOpt('boss', 'Boss raid', 'Your squad against the Dice Titan')}
            </div>

            <div id="boss-section" style="display:${selectedMode === 'boss' ? '' : 'none'};">
                <div class="settings-section-title">Raid type</div>
                <div class="settings-options-grid two">
                    ${bossOpt(false, 'Raid', 'Bring the Titan down once')}
                    ${bossOpt(true, 'Endless', readBossBest() ? `It keeps rising. Best: ${readBossBest()} dmg` : 'It keeps rising. Score = damage dealt')}
                </div>
            </div>

            <div id="p2-section" style="display:${selectedMode === 'hotseat' ? '' : 'none'};">
                <div class="settings-section-title">Player 2 squad</div>
                <div class="p2-squad" id="p2-squad">${p2SquadHTML()}</div>
            </div>

            <div class="settings-section-title">Starting HP per die</div>
            <div class="settings-options-grid">
                ${hpOpt(50, 'Quick match')}
                ${hpOpt(75, 'Longer fights')}
                ${hpOpt(100, 'Endurance')}
            </div>

            <div id="diff-section" style="display:${selectedMode === 'hotseat' ? 'none' : ''};">
            <div class="settings-section-title">Computer difficulty</div>
            <div class="settings-options-grid">
                ${diffOpt('easy', 'Easy', 'Picks moves at random')}
                ${diffOpt('medium', 'Medium', 'Plans attacks and positions')}
                ${diffOpt('hard', 'Hard', 'Plans ahead, rolls high more often')}
            </div>
            </div>

            <div class="overlay-actions" style="justify-content:flex-end;">
                <button class="clay-btn plain" onclick="hideOverlay()">Back</button>
                <button class="clay-btn teal" onclick="_confirmSettingsAndStart()">Start battle</button>
            </div>
        </div>
    `);
}

// ==========================================================
// 3D DICE TUMBLE (CSS cubes thrown onto the board)
// ==========================================================
const PIP_LAYOUT = {
    1: [[50, 50]],
    2: [[72, 28], [28, 72]],
    3: [[72, 28], [50, 50], [28, 72]],
    4: [[28, 28], [72, 28], [28, 72], [72, 72]],
    5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
    6: [[28, 26], [72, 26], [28, 50], [72, 50], [28, 74], [72, 74]],
};
// face value -> cube rotation that brings that face to the front
const FACE_ROT = { 1: [0, 0], 2: [-90, 0], 3: [0, -90], 4: [0, 90], 5: [90, 0], 6: [0, 180] };

function diceCubeHTML(team, value, archetype) {
    const shown = ((value - 1) % 6) + 1;
    const cd = CLASS_DICE[archetype];
    const style = cd ? `style="--face:${cd.body};--face-emboss:${cd.light};--pip:${cd.pip}"` : '';
    const mark = archetype ? `<span class="dice-mark">${iconSVG(archetype)}</span>` : '';
    const faces = [1, 2, 3, 4, 5, 6].map(f => {
        const inner = (f === shown && value > 6)
            ? `<span class="dice-num">${value}</span>`
            : PIP_LAYOUT[f].map(([x, y]) => `<i style="left:${x}%;top:${y}%"></i>`).join('');
        return `<div class="dice-face f${f}">${mark}${inner}</div>`;
    }).join('');
    return `<div class="dice-cube-wrap ${displayTeam(team)}" ${style}>
        <div class="dice-shadow"></div>
        <div class="dice-cube-view"><div class="dice-cube">
            <div class="dice-core a"></div><div class="dice-core b"></div><div class="dice-core c"></div>
            ${faces}
        </div></div>
    </div>`;
}

// Throws cubes into `container` and resolves when they have settled on `values`
function tumbleDice(container, values, team, { dur = 1150, spread = 1, from = 'left', archetypes = [] } = {}) {
    if (!container) return Promise.resolve();
    container.innerHTML = values.map((v, i) => diceCubeHTML(team, v, archetypes[i])).join('');
    const wraps = [...container.querySelectorAll('.dice-cube-wrap')];
    if (!wraps[0] || typeof wraps[0].animate !== 'function') return Promise.resolve();
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const anims = wraps.map((wrap, i) => {
        const v = values[i];
        const [tx, ty] = FACE_ROT[((v - 1) % 6) + 1];
        const cube = wrap.querySelector('.dice-cube');
        const shadow = wrap.querySelector('.dice-shadow');
        const d = reduce ? 1 : dur + i * 120;
        const sx = (from === 'left' ? -1 : 1) * (220 + i * 40) * spread;
        const spinX = tx + 360 * (2 + ((i + v) % 2)) * (i % 2 ? -1 : 1);
        const spinY = ty + 360 * (3 + (v % 2));
        const spinZ = (i % 2 ? 1 : -1) * 360;
        cube.style.transform = `rotateX(${tx}deg) rotateY(${ty}deg)`;
        const ease = 'cubic-bezier(0.22, 0.7, 0.3, 1)';
        cube.animate([
            { transform: `rotateX(${spinX}deg) rotateY(${spinY}deg) rotateZ(${spinZ}deg)` },
            { transform: `rotateX(${tx + (spinX - tx) * 0.12}deg) rotateY(${ty + (spinY - ty) * 0.1}deg) rotateZ(${spinZ * 0.08}deg)`, offset: 0.72 },
            { transform: `rotateX(${tx}deg) rotateY(${ty}deg) rotateZ(0deg)` },
        ], { duration: d, easing: ease, fill: 'both' });
        shadow.animate([
            { opacity: 0, transform: 'scale(0.4)' },
            { opacity: 1, transform: 'scale(1)', offset: 0.45 },
            { opacity: 0.6, transform: 'scale(0.7)', offset: 0.58 },
            { opacity: 1, transform: 'scale(1)' },
        ], { duration: d, fill: 'both' });
        // throw arc with two small bounces
        return wrap.animate([
            { transform: `translate(${sx}px, -140px)`, offset: 0 },
            { transform: `translate(${sx * 0.2}px, 0px)`, offset: 0.45, easing: 'ease-out' },
            { transform: `translate(${sx * 0.08}px, -34px)`, offset: 0.6, easing: 'ease-in' },
            { transform: `translate(${sx * 0.02}px, 0px)`, offset: 0.76, easing: 'ease-out' },
            { transform: `translate(0px, -9px)`, offset: 0.86, easing: 'ease-in' },
            { transform: 'translate(0px, 0px)', offset: 1 },
        ], { duration: d, fill: 'both' });
    });

    if (!reduce && typeof SFX !== 'undefined' && SFX.diceHit) {
        wraps.forEach((_, i) => {
            const d = dur + i * 120;
            [0.45, 0.76, 0.93].forEach((o, k) => setTimeout(() => SFX.diceHit(1 - k * 0.3), d * o));
        });
    }
    // never let the game wait on an animation forever (e.g. background tabs pause animations)
    const longest = reduce ? 50 : dur + wraps.length * 120 + 150;
    return Promise.race([
        Promise.all(anims.map(a => a.finished.catch(() => {}))),
        new Promise(r => setTimeout(r, longest)),
    ]);
}

// Board-level roll: cubes land over the arena, then fade away
async function playBoardRoll(values, team, archetypes = []) {
    const board = document.getElementById('canvas-wrapper');
    if (!board || !document.createElement) return;
    const stage = document.createElement('div');
    stage.className = `roll-stage ${team}`;
    board.appendChild(stage);
    const fast = typeof fastAutoMode !== 'undefined' && fastAutoMode;
    await tumbleDice(stage, values, team, { dur: fast ? 450 : 1150, from: team === 'player' ? 'left' : 'right', archetypes });
    await new Promise(r => setTimeout(r, fast ? 120 : 520));
    stage.classList.add('leaving');
    setTimeout(() => stage.remove(), 300);
}

// ==========================================================
// DIE TOOLTIP (hover a die on the board)
// ==========================================================
function showDieTooltip(die, clientX, clientY) {
    const board = document.querySelector('.board');
    if (!board) return;
    let tip = document.getElementById('die-tooltip');
    if (!tip) {
        tip = document.createElement('div');
        tip.id = 'die-tooltip';
        board.appendChild(tip);
    }
    if (tip.dataset.dieId !== die.id || tip.dataset.hp !== String(die.hp)) {
        const maxH = die.maxHp || gameSettings.startHp || MAX_HP;
        const pct = Math.max(0, Math.min(1, die.hp / maxH));
        const mine = die.team === 'player';
        tip.dataset.dieId = die.id;
        tip.dataset.hp = String(die.hp);
        tip.className = displayTeam(die.team);
        tip.innerHTML = `
            <div class="tip-head">
                ${classBadge(die.archetype, 'lg')}
                <div>
                    <div class="tip-name">${dieDisplayName(die, 0).name}</div>
                    <div class="tip-team">${isHotseat() ? `${sideName(die.team)}'s die` : die.archetype === 'boss' ? 'Raid boss' : mine ? 'Your die' : 'Enemy die'}${die.isMindControlled ? ', mind-controlled' : ''}</div>
                </div>
                <div class="die-dmg">${getDieEffectiveDamage(die)}<small>dmg</small></div>
            </div>
            <div class="hp-line">
                <div class="hp-bar-outer"><div class="hp-bar-inner" style="width:${pct * 100}%;background:${displayTeam(die.team) === 'player' ? 'var(--player)' : 'var(--cpu)'}"></div></div>
                <span class="hp-num">${Math.max(0, die.hp)}/${maxH}</span>
            </div>
            <div class="die-tags">${dieTagsHTML(die)}</div>
            ${dieSkillsHTML(die)}
        `;
    }
    const rect = board.getBoundingClientRect();
    // narrow screens: dock the card across the board, on the half away from the die
    const docked = rect.width < 560;
    tip.classList.toggle('docked', docked);
    if (docked) {
        const inTopHalf = clientY - rect.top < rect.height / 2;
        tip.classList.toggle('dock-bottom', inTopHalf);
        tip.classList.toggle('dock-top', !inTopHalf);
        tip.style.transform = '';
        tip.classList.add('show');
        return;
    }
    let x = clientX - rect.left + 18, y = clientY - rect.top + 18;
    const w = tip.offsetWidth || 260, h = tip.offsetHeight || 160;
    if (x + w > rect.width) x = clientX - rect.left - w - 18;
    if (x < 0) x = Math.max(0, (rect.width - w) / 2);
    if (y + h > rect.height) y = Math.max(0, rect.height - h - 8);
    tip.style.transform = `translate(${Math.max(0, x)}px, ${y}px)`;
    tip.classList.add('show');
}

// Info card for creatures standing on a tile
function showCreatureTooltip(list, clientX, clientY) {
    const board = document.querySelector('.board');
    if (!board || !list.length) return;
    let tip = document.getElementById('die-tooltip');
    if (!tip) { tip = document.createElement('div'); tip.id = 'die-tooltip'; board.appendChild(tip); }
    const groups = [];
    for (const e of list) {
        const owner = e.kind === 'zombie' ? allDice().find(d => d.id === e.unit.ownerId) : null;
        const key = e.kind + (owner ? owner.id : e.unit.team || '');
        let g = groups.find(x => x.key === key);
        if (!g) groups.push(g = { key, kind: e.kind, owner, team: e.unit.team, count: 0, waves: 0, dmg: 0 });
        g.count++;
        g.waves = Math.max(g.waves, e.unit.wavesLeft || 0);
        g.dmg = e.kind === 'zombie' ? e.unit.damage : brutalDamage(SWARM_KINDS[e.kind].dmg, e.unit.brutal);
        g.brutal = g.brutal || !!e.unit.brutal;
        g.boss = g.boss || !!e.unit.ownerTeam;
    }
    const rows = groups.map(g => {
        const st = CREATURE_STYLE[g.kind];
        const who = g.kind === 'zombie'
            ? `${g.team === 'player' ? 'Your' : 'Enemy'} ${g.owner ? archName(g.owner.archetype) : 'Necromancer'}'s`
            : (g.boss ? 'Titan\'s' : g.brutal ? 'Brutal' : 'Wild');
        const extra = g.kind === 'bee' ? ', -1 move' : g.kind === 'mummy' ? ', stops healing' : g.kind === 'robot' ? ', hunts the weakest' : '';
        return `<div class="crowd-row"><span class="crowd-dot" style="background:${st.color}"></span>
            <div><b>${g.count} ${g.count > 1 ? st.plural : st.name}</b><small>${who}, ${g.dmg} damage${extra}. ${g.waves} ${g.waves === 1 ? 'wave' : 'waves'} left</small></div></div>`;
    }).join('');
    tip.dataset.dieId = 'crowd';
    tip.dataset.hp = String(list.length) + Math.random();
    tip.className = 'crowd';
    tip.innerHTML = `<div class="tip-name">On this tile</div>${rows}`;
    const rect = board.getBoundingClientRect();
    const docked = rect.width < 560;
    tip.classList.toggle('docked', docked);
    if (docked) {
        const inTopHalf = clientY - rect.top < rect.height / 2;
        tip.classList.toggle('dock-bottom', inTopHalf);
        tip.classList.toggle('dock-top', !inTopHalf);
        tip.style.transform = '';
    } else {
        const w = tip.offsetWidth || 240, h = tip.offsetHeight || 100;
        let x = clientX - rect.left + 18, y = clientY - rect.top + 18;
        if (x + w > rect.width) x = clientX - rect.left - w - 18;
        if (y + h > rect.height) y = Math.max(0, rect.height - h - 8);
        tip.style.transform = `translate(${Math.max(0, x)}px, ${y}px)`;
    }
    tip.classList.add('show');
}

// Show a die's details from its roster card (works for touch and mouse)
function showDieInfoById(id) {
    const die = allDice().find(d => d.id === id);
    if (!die || die.hp <= 0 || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const p = hexScreen(die.q, die.r);
    const x = rect.left + p.x * (rect.width / canvas.width);
    const y = rect.top + p.y * (rect.height / canvas.height);
    if (typeof showTapInfo === 'function') showTapInfo(die, x, y, 3200);
    else showDieTooltip(die, x, y);
}

function hideDieTooltip() {
    const tip = document.getElementById('die-tooltip');
    if (tip) tip.classList.remove('show');
}
