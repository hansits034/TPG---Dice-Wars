// ==========================================================
// 9. TIMER, STOPWATCH & UI UPDATES
// ==========================================================
function startTurnTimer() {
    stopTurnTimer();
    game.turnTimeLeft = TURN_TIME_LIMIT;
    updateTimerDisplay();

    turnTimerInterval = setInterval(() => {
        if (game.phase !== 'PLAYER_TURN' && game.phase !== 'CPU_TURN') return;
        game.turnTimeLeft--;
        updateTimerDisplay();

        if (game.turnTimeLeft <= 0) {
            stopTurnTimer();
            addFloatingText('⏰ Time Out!', 0, 0, '#ef4444', 24);
            if (game.currentTurn === 'player') endTurn();
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
        game.matchTimeSeconds++;
        updateStopwatchDisplay();
    }, 1000);
}

function stopStopwatch() {
    if (stopwatchInterval) clearInterval(stopwatchInterval);
    stopwatchInterval = null;
}

function updateStopwatchDisplay() {
    const el = document.getElementById('stopwatch-badge');
    if (el) {
        const m = String(Math.floor(game.matchTimeSeconds / 60)).padStart(2, '0');
        const s = String(game.matchTimeSeconds % 60).padStart(2, '0');
        el.textContent = `⏱️ ${m}:${s}`;
    }
}

function updateTimerDisplay() {
    const el = document.getElementById('timer-badge');
    if (el) el.querySelector('span').textContent = game.turnTimeLeft;
}

function updateDiceHP() {
    const cpuEl = document.getElementById('cpu-dice-hp');
    const plEl = document.getElementById('player-dice-hp');
    if (!cpuEl || !plEl) return;

    cpuEl.innerHTML = game.cpuDice.map((d, i) => {
        const pct = Math.max(0, d.hp / MAX_HP);
        const color = pct > 0.5 ? '#fb7185' : pct > 0.25 ? '#fbbf24' : '#ef4444';
        const frozenCls = d.frozen > 0 ? ' frozen' : '';
        const concealCls = d.concealed > 0 ? ' concealed' : '';
        const trappedCls = d.trapped > 0 ? ' trapped' : '';
        const backLvl = getSkillLevel(d, 'backStronger');
        const rageBonus = getDieRageBonus(d);
        const rageBadge = (backLvl > 0 || d.archetype === 'Rage') ? `<span class="move-badge" style="color:#ef4444;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);" title="Taken: ${d.totalDamageTaken||0} dmg -> Bonus DMG: +${rageBonus}">😡${d.totalDamageTaken||0} dmg (+${rageBonus})</span>` : '';
        const dieLabel = d.isSplit ? `${d.icon} ${d.id}[${getDieEffectiveDamage(d)}]` : `${d.icon} D${i+1}[${getDieEffectiveDamage(d)}]`;
        return `<div class="die-hp-card ${d.hp <= 0 ? 'dead' : ''}${frozenCls}${concealCls}${trappedCls}">
            <span style="color:var(--cpu)" class="die-class-badge">${dieLabel}</span>
            <div class="hp-bar-outer"><div class="hp-bar-inner" style="width:${pct*100}%;background:${color}"></div></div>
            <span>${Math.max(0,d.hp)}</span>
            ${rageBadge}
            ${d.moveAllowance > 0 && game.currentTurn === 'cpu' ? `<span class="move-badge">🦶${d.moveAllowance}</span>` : ''}
        </div>`;
    }).join('');

    plEl.innerHTML = game.playerDice.map((d, i) => {
        const pct = Math.max(0, d.hp / MAX_HP);
        const color = pct > 0.5 ? '#34d399' : pct > 0.25 ? '#fbbf24' : '#ef4444';
        const frozenCls = d.frozen > 0 ? ' frozen' : '';
        const concealCls = d.concealed > 0 ? ' concealed' : '';
        const trappedCls = d.trapped > 0 ? ' trapped' : '';
        const backLvl = getSkillLevel(d, 'backStronger');
        const rageBonus = getDieRageBonus(d);
        const rageBadge = (backLvl > 0 || d.archetype === 'Rage') ? `<span class="move-badge" style="color:#ef4444;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);" title="Taken: ${d.totalDamageTaken||0} dmg -> Bonus DMG: +${rageBonus}">😡${d.totalDamageTaken||0} dmg (+${rageBonus})</span>` : '';
        const dieLabel = d.isSplit ? `${d.icon} ${d.id}[${getDieEffectiveDamage(d)}]` : `${d.icon} D${i+1}[${getDieEffectiveDamage(d)}]`;
        return `<div class="die-hp-card ${d.hp <= 0 ? 'dead' : ''}${frozenCls}${concealCls}${trappedCls}">
            <span style="color:var(--player)" class="die-class-badge">${dieLabel}</span>
            <div class="hp-bar-outer"><div class="hp-bar-inner" style="width:${pct*100}%;background:${color}"></div></div>
            <span>${Math.max(0,d.hp)}</span>
            ${rageBadge}
            ${d.moveAllowance > 0 && game.currentTurn === 'player' ? `<span class="move-badge">🦶${d.moveAllowance}</span>` : ''}
        </div>`;
    }).join('');
}

function updateRollDisplay(values, team) {
    const el = document.getElementById('roll-display');
    if (!el) return;
    if (!values || values.length === 0) { el.innerHTML = ''; return; }
    const cls = team === 'player' ? 'player-die' : 'cpu-die';
    const total = values.reduce((a, b) => a + b, 0);
    el.innerHTML = `🎲 ` + values.map(v => `<span class="roll-die-box ${cls}">${v}</span>`).join('+') +
        ` <span class="roll-eq">=</span> <span class="roll-total">${total}</span>`;
}

function updateMoves() {
    const total = game.currentTurn === 'player' ? totalMovesLeft('player') : totalMovesLeft('cpu');
    const el = document.getElementById('moves-display');
    if (el) el.textContent = `Moves: ${total}`;
}

function updateWaveBadge() {
    const el = document.getElementById('wave-badge');
    if (el) el.textContent = `Wave ${game.wave}`;
}

function setMessage(msg) {
    const el = document.getElementById('game-message');
    if (el) el.textContent = msg;
}

function setButtons(endEnabled, deselectEnabled) {
    const endBtn = document.getElementById('btn-end');
    const desBtn = document.getElementById('btn-deselect');
    if (endBtn) endBtn.disabled = !endEnabled;
    if (desBtn) desBtn.disabled = !deselectEnabled;
}

function updateCardHand() {
    const el = document.getElementById('card-slots');
    const cancelBtn = document.getElementById('btn-cancel-card');
    if (cancelBtn) {
        if (game.activeCard) cancelBtn.classList.add('active');
        else cancelBtn.classList.remove('active');
    }

    if (!el) return;
    const maxHand = getMaxHandSize('player');
    const countLabel = `<div style="font-size:0.75rem;color:var(--text-dim);margin-bottom:4px;">Hand: ${game.playerHand.length}/${maxHand}</div>`;

    if (game.playerHand.length === 0) {
        el.innerHTML = '<span class="empty-hand">No cards yet</span>';
    } else {
        el.innerHTML = game.playerHand.map((card, i) => {
            const activeCls = game.activeCard && game.activeCard._handIdx === i ? ' active-card' : '';
            return `<div class="card-slot ${card.rarity}${activeCls}" onclick="onCardClick(${i})" id="card-slot-${i}">
                <span class="card-icon">${card.icon}</span>
                <span class="card-name">${card.name}</span>
                <div class="card-tooltip"><strong>${card.name}</strong><br>${card.desc}<br><em style="color:var(--${card.rarity})">${card.rarity.toUpperCase()}</em></div>
            </div>`;
        }).join('');
    }
    const cpuHandEl = document.getElementById('cpu-hand-count');
    if (cpuHandEl) cpuHandEl.textContent = `🃏 ${game.cpuHand.length}/${getMaxHandSize('cpu')}`;
}

function showCardPopup(card, team) {
    const popup = document.createElement('div');
    popup.className = 'card-gained-popup';
    popup.innerHTML = `
        <div class="cg-title">✨ Card Gained!</div>
        <div class="cg-icon">${card.icon}</div>
        <div class="cg-name">${card.name}</div>
        <div class="cg-desc">${card.desc}</div>
        <div class="cg-rarity ${card.rarity}">${card.rarity.toUpperCase()}</div>
    `;
    document.body.appendChild(popup);
    setTimeout(() => {
        popup.style.animation = 'popupFadeOut 0.4s ease-in forwards';
        setTimeout(() => popup.remove(), 400);
    }, 1800);
}

function showBlitzAnnouncement(title, desc) {
    const el = document.createElement('div');
    el.className = 'blitz-announcement';
    el.innerHTML = `
        <div class="blitz-title">${title}</div>
        <div class="blitz-desc">${desc}</div>
    `;
    document.body.appendChild(el);
    SFX.blitz();
    setTimeout(() => {
        el.style.animation = 'blitzFadeOut 0.4s ease-in forwards';
        setTimeout(() => el.remove(), 400);
    }, 2200);
}

function showOverlay(html) {
    const ol = document.getElementById('overlay');
    if (ol) {
        ol.innerHTML = html;
        ol.classList.remove('hidden');
    }
}

function hideOverlay() {
    const ol = document.getElementById('overlay');
    if (ol) ol.classList.add('hidden');
}

function openGameMenuModal() {
    showOverlay(`
        <div class="overlay-box" style="max-width:420px;">
            <h2>⚙️ GAME MENU</h2>
            <div style="display:flex;flex-direction:column;gap:12px;margin:20px 0;">
                <button class="overlay-btn" style="margin:0;background:rgba(255,255,255,0.08);border:1px solid var(--border);" onclick="hideOverlay(); toggleBGM(); setTimeout(openGameMenuModal, 100);">
                    ${bgmEnabled ? '🔊 BGM: ON' : '🔇 BGM: OFF'}
                </button>
                <button class="overlay-btn restart" style="margin:0;" onclick="hideOverlay(); startGame();">
                    🔄 Restart Match
                </button>
                <button class="overlay-btn" style="margin:0;background:linear-gradient(135deg, var(--cpu), #be123c);" onclick="hideOverlay(); quitToMainMenu();">
                    🏠 Quit to Main Menu
                </button>
            </div>
            <button class="overlay-btn" onclick="hideOverlay();">Resume Game</button>
        </div>
    `);
}

function quitToMainMenu() {
    stopTurnTimer();
    stopStopwatch();
    document.getElementById('game-screen').classList.remove('active');
    document.getElementById('start-screen').classList.remove('hidden');
}

function openHelpModal() {
    showOverlay(`
        <div class="overlay-box help-content">
            <h2>❓ How to Play & Game Info</h2>
            
            <h3>🎲 Core Rules & Archetypes</h3>
            <ul>
                <li><strong>HP:</strong> Each die has <strong>50 Base HP</strong>.</li>
                <li><strong>Damage:</strong> Equal to initial die face value.</li>
                <li><strong>Unique Roles:</strong> Each of your 3 dice has a distinct role.</li>
                <li><strong>Classes:</strong> 🩸 Dracula, 😇 Angel, 🥷 Ninja, 🗡️ Samurai, 🔮 Telekinator, 🛡️ Defender, 😡 Rage, 💀 Necromancer, 🧙 Mage.</li>
            </ul>

            <h3>⚡ Roguelike Upgrades (Every 4 Waves)</h3>
            <p>Choose 1 of 3 random skill level-ups to empower your dice!</p>

            <h3>✨ Event Tiles (Every 3 Waves)</h3>
            <p>Sparkling tiles spawn on empty hexes. Step on them to pick up a card (Max 3 in hand, or 4 with Defender/Samurai).</p>

            <h3>⚡ Arena Blitz Events (Every 5 Waves - 16.6% Each)</h3>
            <ul>
                <li><strong>🌪️ Tornado (16.6%):</strong> Randomizes all dice positions.</li>
                <li><strong>🕳️ Void Tiles (16.6%):</strong> 5-8 adjacent tiles collapse into void for 3 waves.</li>
                <li><strong>🔥 Burning Tiles (16.6%):</strong> 3-5 tiles burn for 3 waves (3 damage on touch).</li>
                <li><strong>🌿 Vine Trap (16.6%):</strong> 2 tiles sprout vines (traps dice on touch for 2 waves).</li>
                <li><strong>🐝 Bee Attack (16.6%):</strong> 5 bees chase nearest die (5 damage & -1 move).</li>
                <li><strong>🧙 Magician (16.6%):</strong> Grants 2 free cards to both sides.</li>
            </ul>

            <button class="overlay-btn" onclick="hideOverlay();">Close</button>
        </div>
    `);
}
