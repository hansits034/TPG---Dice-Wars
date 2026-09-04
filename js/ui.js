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
        const maxH = d.maxHp || MAX_HP;
        const pct = Math.max(0, d.hp / maxH);
        const color = pct > 0.5 ? '#fb7185' : pct > 0.25 ? '#fbbf24' : '#ef4444';
        const frozenCls = d.frozen > 0 ? ' frozen' : '';
        const concealCls = d.concealed > 0 ? ' concealed' : '';
        const trappedCls = d.trapped > 0 ? ' trapped' : '';
        const backLvl = getSkillLevel(d, 'backStronger');
        const rageBonus = getDieRageBonus(d);
        const rageBadge = (backLvl > 0 || d.archetype === 'Rage') ? `<span class="move-badge" style="color:#ef4444;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);" title="Taken: ${d.totalDamageTaken || 0} dmg -> Bonus DMG: +${rageBonus}">😡${d.totalDamageTaken || 0} dmg (+${rageBonus})</span>` : '';
        const zapBadge = (d.archetype === 'mage' || getSkillLevel(d, 'zap') > 0) ? `<span class="move-badge" style="color:#c084fc;background:rgba(168,85,247,0.15);border:1px solid rgba(168,85,247,0.3);" title="Zap Stacks: ${d.zapStacks || 0}/2">⚡${d.zapStacks || 0}</span>` : '';
        const dieLabel = d.isSplit ? `${d.icon} ${d.id}[${getDieEffectiveDamage(d)}]` : `${d.icon} D${i + 1}[${getDieEffectiveDamage(d)}]`;
        return `<div class="die-hp-card ${d.hp <= 0 ? 'dead' : ''}${frozenCls}${concealCls}${trappedCls}">
            <span style="color:var(--cpu)" class="die-class-badge">${dieLabel}</span>
            <div class="hp-bar-outer"><div class="hp-bar-inner" style="width:${pct * 100}%;background:${color}"></div></div>
            <span>${Math.max(0, d.hp)}</span>
            ${rageBadge}
            ${zapBadge}
            ${d.moveAllowance > 0 && game.currentTurn === 'cpu' ? `<span class="move-badge">🦶${d.moveAllowance}</span>` : ''}
        </div>`;
    }).join('');

    plEl.innerHTML = game.playerDice.map((d, i) => {
        const maxH = d.maxHp || MAX_HP;
        const pct = Math.max(0, d.hp / maxH);
        const color = pct > 0.5 ? '#34d399' : pct > 0.25 ? '#fbbf24' : '#ef4444';
        const frozenCls = d.frozen > 0 ? ' frozen' : '';
        const concealCls = d.concealed > 0 ? ' concealed' : '';
        const trappedCls = d.trapped > 0 ? ' trapped' : '';
        const backLvl = getSkillLevel(d, 'backStronger');
        const rageBonus = getDieRageBonus(d);
        const rageBadge = (backLvl > 0 || d.archetype === 'Rage') ? `<span class="move-badge" style="color:#ef4444;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);" title="Taken: ${d.totalDamageTaken || 0} dmg -> Bonus DMG: +${rageBonus}">😡${d.totalDamageTaken || 0} dmg (+${rageBonus})</span>` : '';
        const zapBadge = (d.archetype === 'mage' || getSkillLevel(d, 'zap') > 0) ? `<span class="move-badge" style="color:#c084fc;background:rgba(168,85,247,0.15);border:1px solid rgba(168,85,247,0.3);" title="Zap Stacks: ${d.zapStacks || 0}/2">⚡${d.zapStacks || 0}</span>` : '';
        const dieLabel = d.isSplit ? `${d.icon} ${d.id}[${getDieEffectiveDamage(d)}]` : `${d.icon} D${i + 1}[${getDieEffectiveDamage(d)}]`;
        return `<div class="die-hp-card ${d.hp <= 0 ? 'dead' : ''}${frozenCls}${concealCls}${trappedCls}">
            <span style="color:var(--player)" class="die-class-badge">${dieLabel}</span>
            <div class="hp-bar-outer"><div class="hp-bar-inner" style="width:${pct * 100}%;background:${color}"></div></div>
            <span>${Math.max(0, d.hp)}</span>
            ${rageBadge}
            ${zapBadge}
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

function updateZapButton() {
    const zapBtn = document.getElementById('btn-zap');
    if (!zapBtn) return;
    const playerMage = aliveDice('player').find(d => d.archetype === 'mage' || getSkillLevel(d, 'zap') > 0);
    if (!playerMage) {
        zapBtn.style.display = 'none';
        return;
    }
    zapBtn.style.display = 'inline-flex';
    const stacks = playerMage.zapStacks || 0;
    zapBtn.textContent = `⚡ ZAP (${stacks})`;
    const isPlayerTurn = game.phase === 'PLAYER_TURN' && game.currentTurn === 'player';
    zapBtn.disabled = !isPlayerTurn || stacks <= 0 || playerMage.frozen > 0 || playerMage.trapped > 0;
}

function setButtons(endEnabled, deselectEnabled) {
    const endBtn = document.getElementById('btn-end');
    const desBtn = document.getElementById('btn-deselect');
    if (endBtn) endBtn.disabled = !endEnabled;
    if (desBtn) desBtn.disabled = !deselectEnabled;
    updateZapButton();
}

function updateCardHand() {
    const el = document.getElementById('card-slots');
    const cancelBtn = document.getElementById('btn-cancel-card');
    const discardBtn = document.getElementById('btn-discard-card');
    if (cancelBtn) {
        if (game.activeCard) cancelBtn.classList.add('active');
        else cancelBtn.classList.remove('active');
    }
    if (discardBtn) {
        if (game.activeCard) discardBtn.classList.add('active');
        else discardBtn.classList.remove('active');
    }

    if (!el) return;
    const maxHand = getMaxHandSize('player');

    if (game.playerHand.length === 0) {
        el.innerHTML = '<span class="empty-hand">No cards yet</span>';
    } else {
        el.innerHTML = game.playerHand.map((card, i) => {
            const activeCls = game.activeCard && game.activeCard._handIdx === i ? ' active-card' : '';
            return `<div class="card-slot ${card.rarity}${activeCls}" onclick="onCardClick(${i})" id="card-slot-${i}">
                <span class="card-icon">${card.icon}</span>
                <span class="card-name">${card.name}</span>
                <span class="card-discard-x" onclick="event.stopPropagation(); destroyCard(${i});" title="Destroy/discard this card">✕</span>
                <div class="card-tooltip"><strong>${card.name}</strong><br>${card.desc}<br><em style="color:var(--${card.rarity})">${card.rarity.toUpperCase()}</em><br><span style="color:#f87171;font-size:0.65rem;">Click ✕ to destroy</span></div>
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

// Current active role in the Dice Codex card collection view
let selectedCodexRoleId = 'dracula';

function renderCodexRoleDetails(archId) {
    selectedCodexRoleId = archId;
    const arch = ARCHETYPES.find(a => a.id === archId) || ARCHETYPES[0];

    // Update card active classes
    const allCards = document.querySelectorAll('.royale-card');
    allCards.forEach(card => {
        if (card.dataset.archId === archId) card.classList.add('active');
        else card.classList.remove('active');
    });

    const detailsContainer = document.getElementById('codex-role-details-area');
    if (!detailsContainer) return;

    let activeSkillCount = 0;
    const skillsHTML = arch.skills.map((s) => {
        const isPassive = s.id === 'defenderMastery' || s.id === 'dashMastery' || s.id === 'backStronger' || s.id === 'doctorMastery';
        let tagText = 'PASSIVE';
        if (!isPassive) {
            activeSkillCount++;
            tagText = `SKILL ${activeSkillCount}`;
        }
        const badgeClass = isPassive ? 'codex-skill-badge passive-badge' : 'codex-skill-badge';
        const boxClass = isPassive ? 'codex-skill-box passive' : 'codex-skill-box';
        return `
            <div class="${boxClass}">
                <div class="codex-skill-head">
                    <span class="codex-skill-title">⚡ ${s.name} <span class="codex-skill-max">(Max Lvl ${s.maxLvl})</span></span>
                    <span class="${badgeClass}">${tagText}</span>
                </div>
                <div class="codex-skill-desc">${s.desc}</div>
            </div>
        `;
    }).join('');

    detailsContainer.innerHTML = `
        <div class="codex-role-title-row">
            <div class="codex-role-title-left">
                <div class="codex-hero-icon">${arch.icon}</div>
                <div>
                    <div class="codex-hero-name">${arch.name}</div>
                    <div style="font-size:0.75rem;color:var(--text-dim);margin-top:2px;">Role Identity & Archetype</div>
                </div>
            </div>
            <span class="codex-role-tag">${ARCHETYPES.length} Playable Roles</span>
        </div>
        <div class="codex-skills-list">
            ${skillsHTML}
        </div>
    `;

    if (typeof SFX !== 'undefined' && SFX.move) SFX.move();
}

function openDiceGuideModal() {
    selectedCodexRoleId = selectedPlayerClasses[0] || 'dracula';

    const cardsHTML = ARCHETYPES.map((arch, idx) => {
        const isActive = arch.id === selectedCodexRoleId ? ' active' : '';
        return `
            <div class="royale-card${isActive}" data-arch-id="${arch.id}" onclick="renderCodexRoleDetails('${arch.id}')">
                <div class="royale-card-elixir"><span>${idx + 1}</span></div>
                <div class="royale-card-art">${arch.icon}</div>
                <div class="royale-card-ribbon">${arch.name}</div>
            </div>
        `;
    }).join('');

    showOverlay(`
        <div class="overlay-box dice-codex-container">
            <h2>📖 DICE & SKILLS CODEX</h2>
            <div class="codex-header-desc">
                Select a role below to view detailed abilities and roguelike upgrades:
            </div>
            
            <div class="codex-card-deck-grid">
                ${cardsHTML}
            </div>

            <div class="codex-details-card" id="codex-role-details-area">
                <!-- Injected via renderCodexRoleDetails -->
            </div>

            <div style="text-align:center;margin-top:14px;">
                <button class="overlay-btn" onclick="hideOverlay();">Close Codex</button>
            </div>
        </div>
    `);

    renderCodexRoleDetails(selectedCodexRoleId);
}

function openHelpModal() {
    showOverlay(`
        <div class="overlay-box help-content">
            <h2>❓ How to Play & Game Info</h2>
            
            <h3>🎲 Core Rules & Archetypes</h3>
            <ul>
                <li><strong>HP:</strong> Each die has <strong>50 Base HP</strong>.</li>
                <li><strong>Damage:</strong> Equal to initial rolled die face value.</li>
                <li><strong>Unique Roles:</strong> Each of your 3 dice has a distinct role.</li>
                <li><strong>Classes:</strong> 🩸 Dracula, 😇 Angel, 🥷 Ninja, 🗡️ Samurai, 🔮 Telekinator, 🛡️ Defender, 😡 Rage, 💀 Necromancer, 🧙 Mage, 🩺 Doctor.</li>
            </ul>

            <h3>⚡ Roguelike Upgrades (Every 4 Waves)</h3>
            <p>Choose 1 of 3 random skill level-ups to empower your dice!</p>

            <h3>✨ Event Tiles (Every 3 Waves)</h3>
            <p>Sparkling tiles spawn on empty hexes. Step on them to pick up a card (Max 3 in hand, or 4 with Defender/Samurai/Doctor).</p>

            <h3>⚡ Arena Blitz Events (Every 5 Waves - 16.6% Each)</h3>
            <ul>
                <li><strong>🌪️ Tornado (16.6%):</strong> Randomizes all dice positions.</li>
                <li><strong>🕳️ Void Tiles (16.6%):</strong> 5-8 adjacent tiles collapse into void for 3 waves.</li>
                <li><strong>🔥 Burning Tiles (16.6%):</strong> 3-5 tiles burn for 3 waves (3 damage on touch).</li>
                <li><strong>🌿 Vine Trap (16.6%):</strong> 2 tiles sprout vines (traps dice on touch for 2 waves).</li>
                <li><strong>🐝 Bee Attack (16.6%):</strong> 5 bees chase nearest die (5 damage & -1 move).</li>
                <li><strong>🧙 Magician (16.6%):</strong> Grants 2 random cards to everyone.</li>
            </ul>
            <div style="text-align:center;margin-top:14px;">
                <button class="overlay-btn" onclick="hideOverlay();">Close</button>
            </div>
        </div>
    `);
}

// ==========================================================
// STATS PANEL & MATCH SETTINGS MODAL
// ==========================================================
let currentStatsTab = 'dealt'; // 'dealt', 'taken', 'heal'
let statsPanelCollapsed = false;

function toggleStatsPanel() {
    const p = document.getElementById('stats-panel-widget');
    const btn = document.getElementById('stats-toggle-btn');
    if (!p) return;
    statsPanelCollapsed = !statsPanelCollapsed;
    if (statsPanelCollapsed) {
        p.classList.add('collapsed');
        if (btn) btn.textContent = '▶';
    } else {
        p.classList.remove('collapsed');
        if (btn) btn.textContent = '◀';
    }
}

function switchStatsTab(tab) {
    currentStatsTab = tab;
    ['dealt', 'taken', 'heal'].forEach(t => {
        const btn = document.getElementById(`tab-stat-${t}`);
        if (btn) {
            if (t === tab) btn.classList.add('active');
            else btn.classList.remove('active');
        }
    });
    updateStatsDisplay();
}

function updateStatsDisplay() {
    const area = document.getElementById('stats-content-area');
    if (!area || !game.stats) return;

    const pDice = game.playerDice || [];
    const colors = ['#34d399', '#60a5fa', '#f59e0b']; // D1, D2, D3

    if (currentStatsTab === 'dealt') {
        const data = game.stats.damageDealt || { p1: 0, p2: 0, p3: 0, total: 0 };
        const maxVal = Math.max(1, data.total || (data.p1 + data.p2 + data.p3));
        const rowsHTML = pDice.map((d, i) => {
            const val = data[d.id] || 0;
            const pct = Math.round((val / maxVal) * 100);
            return `
                <div class="stat-row-item">
                    <div class="stat-row-label">
                        <span>${d.icon} D${i + 1} (${d.archetype.toUpperCase()})</span>
                        <span style="color:#fb7185">${val} DMG</span>
                    </div>
                    <div class="stat-bar-bg">
                        <div class="stat-bar-fill" style="width:${pct}%;background:${colors[i % 3]};"></div>
                    </div>
                </div>
            `;
        }).join('');

        area.innerHTML = `
            <div class="stat-bar-group">
                ${rowsHTML}
            </div>
            <div class="stat-total-summary">Total Damage Dealt: <strong style="color:#fb7185">${data.total || 0}</strong></div>
        `;
    } else if (currentStatsTab === 'taken') {
        const data = game.stats.damageTaken || { p1: 0, p2: 0, p3: 0, total: 0 };
        const maxVal = Math.max(1, data.total || (data.p1 + data.p2 + data.p3));
        const rowsHTML = pDice.map((d, i) => {
            const val = data[d.id] || 0;
            const pct = Math.round((val / maxVal) * 100);
            return `
                <div class="stat-row-item">
                    <div class="stat-row-label">
                        <span>${d.icon} D${i + 1} (${d.archetype.toUpperCase()})</span>
                        <span style="color:#f43f5e">${val} Taken</span>
                    </div>
                    <div class="stat-bar-bg">
                        <div class="stat-bar-fill" style="width:${pct}%;background:#f43f5e;"></div>
                    </div>
                </div>
            `;
        }).join('');

        area.innerHTML = `
            <div class="stat-bar-group">
                ${rowsHTML}
            </div>
            <div class="stat-total-summary">Total Damage Taken: <strong style="color:#f43f5e">${data.total || 0}</strong></div>
        `;
    } else if (currentStatsTab === 'heal') {
        const data = game.stats.healDone || { p1: 0, p2: 0, p3: 0, cards: 0, total: 0 };
        const maxVal = Math.max(1, data.total || (data.p1 + data.p2 + data.p3 + data.cards));
        const rowsHTML = pDice.map((d, i) => {
            const val = data[d.id] || 0;
            const pct = Math.round((val / maxVal) * 100);
            return `
                <div class="stat-row-item">
                    <div class="stat-row-label">
                        <span>${d.icon} D${i + 1} (${d.archetype.toUpperCase()})</span>
                        <span style="color:#34d399">+${val} HP</span>
                    </div>
                    <div class="stat-bar-bg">
                        <div class="stat-bar-fill" style="width:${pct}%;background:#34d399;"></div>
                    </div>
                </div>
            `;
        }).join('');

        const cardHealVal = data.cards || 0;
        const cardPct = Math.round((cardHealVal / maxVal) * 100);
        const cardRow = `
            <div class="stat-row-item">
                <div class="stat-row-label">
                    <span>🩹 Heal Cards</span>
                    <span style="color:#34d399">+${cardHealVal} HP</span>
                </div>
                <div class="stat-bar-bg">
                    <div class="stat-bar-fill" style="width:${cardPct}%;background:#10b981;"></div>
                </div>
            </div>
        `;

        area.innerHTML = `
            <div class="stat-bar-group">
                ${rowsHTML}
                ${cardRow}
            </div>
            <div class="stat-total-summary">Total HP Restored: <strong style="color:#34d399">+${data.total || 0}</strong></div>
        `;
    }
}

function openGameSettingsModal() {
    let selectedHp = gameSettings.startHp || 50;
    let selectedDiff = gameSettings.difficulty || 'medium';

    window._selectSettingHp = function (hp) {
        selectedHp = hp;
        document.querySelectorAll('.hp-opt-btn').forEach(b => {
            if (parseInt(b.dataset.hp) === hp) b.classList.add('active');
            else b.classList.remove('active');
        });
    };

    window._selectSettingDiff = function (diff) {
        selectedDiff = diff;
        document.querySelectorAll('.diff-opt-btn').forEach(b => {
            if (b.dataset.diff === diff) b.classList.add('active');
            else b.classList.remove('active');
        });
    };

    window._confirmSettingsAndStart = function () {
        gameSettings.startHp = selectedHp;
        gameSettings.difficulty = selectedDiff;
        hideOverlay();
        startGame();
    };

    showOverlay(`
        <div class="overlay-box settings-modal-box">
            <h2>⚙️ MATCH SETUP & SETTINGS</h2>
            <p style="color:var(--text-dim);font-size:0.85rem;margin-bottom:12px;">Customize starting HP and AI difficulty before battle:</p>
            
            <div class="settings-section-title">❤️ Starting Dice HP</div>
            <div class="settings-options-grid">
                <div class="settings-opt-btn hp-opt-btn ${selectedHp === 50 ? 'active' : ''}" data-hp="50" onclick="_selectSettingHp(50)">
                    <div class="settings-opt-name">50 HP</div>
                    <div class="settings-opt-desc">Standard Match</div>
                </div>
                <div class="settings-opt-btn hp-opt-btn ${selectedHp === 75 ? 'active' : ''}" data-hp="75" onclick="_selectSettingHp(75)">
                    <div class="settings-opt-name">75 HP</div>
                    <div class="settings-opt-desc">Extended Battle</div>
                </div>
                <div class="settings-opt-btn hp-opt-btn ${selectedHp === 100 ? 'active' : ''}" data-hp="100" onclick="_selectSettingHp(100)">
                    <div class="settings-opt-name">100 HP</div>
                    <div class="settings-opt-desc">Endurance Mode</div>
                </div>
            </div>

            <div class="settings-section-title">🧠 AI Difficulty Mode</div>
            <div class="settings-options-grid">
                <div class="settings-opt-btn diff-opt-btn ${selectedDiff === 'easy' ? 'active' : ''}" data-diff="easy" onclick="_selectSettingDiff('easy')">
                    <div class="settings-opt-name">🟢 Easy</div>
                    <div class="settings-opt-desc">Standard Bot AI</div>
                </div>
                <div class="settings-opt-btn diff-opt-btn ${selectedDiff === 'medium' ? 'active' : ''}" data-diff="medium" onclick="_selectSettingDiff('medium')">
                    <div class="settings-opt-name">🟡 Medium</div>
                    <div class="settings-opt-desc">Simulates Moves</div>
                </div>
                <div class="settings-opt-btn diff-opt-btn ${selectedDiff === 'hard' ? 'active' : ''}" data-diff="hard" onclick="_selectSettingDiff('hard')">
                    <div class="settings-opt-name">🔴 Hard</div>
                    <div class="settings-opt-desc">Smart + Loaded Dice (4-6)</div>
                </div>
            </div>

            <div style="display:flex;gap:10px;margin-top:20px;justify-content:flex-end;">
                <button class="overlay-btn" style="background:rgba(255,255,255,0.08);margin:0;" onclick="hideOverlay()">Back</button>
                <button class="overlay-btn restart" style="margin:0;" onclick="_confirmSettingsAndStart()">⚔️ Start Battle</button>
            </div>
        </div>
    `);
}
