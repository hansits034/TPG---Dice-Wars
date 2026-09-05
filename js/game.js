// ==========================================================
// 11. ANIMATIONS & GAME LOOP / TURN CONTROLLER
// ==========================================================
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
function easeOutQuad(t) { return t * (2 - t); }

function findNearestEmptyHex(q, r) {
    const neighbors = getNeighbors(q, r).filter(n => !getDieAt(n.q, n.r) && !isBlocked(n.q, n.r));
    if (neighbors.length > 0) return neighbors[Math.floor(Math.random() * neighbors.length)];
    const fallback = allHexes.find(h => !getDieAt(h.q, h.r) && !isBlocked(h.q, h.r));
    return fallback || { q, r };
}

function applyForcedMoveBleed(die, distance) {
    if (!die || die.hp <= 0 || distance <= 0) return;
    if (die.bleedTurns > 0 || die.bleedStacks > 0) {
        const stackRate = Math.max(1, die.bleedStacks || 1);
        const totalBleed = distance * stackRate;
        const bleedDmg = Math.min(11, totalBleed);
        const actualDmg = applyIndirectDamage(die, bleedDmg, `🩸 Forced Bleed (Max 11)`, '#ef4444');
        if (actualDmg > 0 && die.bleedSourceDieId) {
            const srcDracula = typeof allDice === 'function' ? allDice().find(d => d.id === die.bleedSourceDieId) : null;
            if (srcDracula) {
                srcDracula.totalDamageDealt = (srcDracula.totalDamageDealt || 0) + actualDmg;
                if (srcDracula.team === 'player' && game.stats) {
                    game.stats.damageDealt[srcDracula.id] = (game.stats.damageDealt[srcDracula.id] || 0) + actualDmg;
                    game.stats.damageDealt.total += actualDmg;
                    if (typeof updateStatsDisplay === 'function') updateStatsDisplay();
                }
            }
        }
        addCombatLog(`${die.icon} ${die.id.toUpperCase()} took ${bleedDmg} Bleed DMG (${stackRate}x stacks) from forced displacement (capped at 11).`, '🩸', '#ef4444');
    }
}

async function animateMove(die, path, isForced=false) {
    if (!path || path.length <= 1) return;
    animatingDie = die;
    let forcedBleedAccum = 0;

    try {
        for (let i = 1; i < path.length; i++) {
            const startP = hexToPixel(die.q, die.r);
            const endP = hexToPixel(path[i].q, path[i].r);
            const startTime = performance.now();
            const duration = 180;

            await new Promise(resolve => {
                function step(now) {
                    const t = Math.min(1, (now - startTime) / duration);
                    const et = easeOutQuad(t);
                    die.renderX = startP.x + (endP.x - startP.x) * et;
                    die.renderY = startP.y + (endP.y - startP.y) * et;
                    animRotation = t * Math.PI * 2;

                    if (t < 1) {
                        requestAnimationFrame(step);
                    } else {
                        die.q = path[i].q;
                        die.r = path[i].r;
                        die.renderX = null;
                        die.renderY = null;
                        animRotation = 0;
                        resolve();
                    }
                }
                requestAnimationFrame(step);
            });
            SFX.move();
            die.movedThisWave = true;

            // Check Bleed Move Distance (1 stack = 1 dmg/tile, 2 stacks = 2 dmg/tile, 3 stacks = 3 dmg/tile; capped at 11 for forced movement)
            if (die.bleedTurns > 0 || die.bleedStacks > 0) {
                const stackRate = Math.max(1, die.bleedStacks || 1);
                let actualBleed = 0;
                if (isForced) {
                    const stepBleed = Math.min(11 - forcedBleedAccum, stackRate);
                    if (stepBleed > 0) {
                        forcedBleedAccum += stepBleed;
                        actualBleed = applyIndirectDamage(die, stepBleed, `🩸 Forced Bleed (${stackRate} DMG/tile)`, '#ef4444');
                    }
                } else {
                    actualBleed = applyIndirectDamage(die, stackRate, `🩸 Bleed (${stackRate} DMG/tile)`, '#ef4444');
                }

                if (actualBleed > 0 && die.bleedSourceDieId) {
                    const srcDracula = typeof allDice === 'function' ? allDice().find(d => d.id === die.bleedSourceDieId) : null;
                    if (srcDracula) {
                        srcDracula.totalDamageDealt = (srcDracula.totalDamageDealt || 0) + actualBleed;
                        if (srcDracula.team === 'player' && game.stats) {
                            game.stats.damageDealt[srcDracula.id] = (game.stats.damageDealt[srcDracula.id] || 0) + actualBleed;
                            game.stats.damageDealt.total += actualBleed;
                            if (typeof updateStatsDisplay === 'function') updateStatsDisplay();
                        }
                    }
                }
                if (checkWin()) return;
            }

            checkEventTilePickup(die);

            // Immediate tile hazard trigger (Burning, Vine, Bear Trap, Bees, Zombies)
            triggerTileEffectOnDie(die);
            if (checkWin()) return;
            if (die.trapped > 0) break;
        }

        const occupant = getDieAt(die.q, die.r, true);
        if (occupant && occupant.id !== die.id && occupant.concealed) {
            const bounce = findNearestEmptyHex(die.q, die.r);
            const bounceDist = hexDist(die.q, die.r, bounce.q, bounce.r);
            die.q = bounce.q; die.r = bounce.r;
            die.movedThisWave = true;
            addFloatingText('🌀 Bounced!', die.q, die.r, '#a78bfa', 16);
            applyForcedMoveBleed(die, bounceDist);
            SFX.move();
            checkEventTilePickup(die);
            triggerTileEffectOnDie(die);
        }
    } finally {
        animatingDie = null;
        die.renderX = null;
        die.renderY = null;
        animRotation = 0;
    }
}

function rollDiceForUnit(die) {
    const maxVal = die.isSplit ? 3 : 6;
    let baseVal = 1;
    if (die.team === 'cpu' && gameSettings && gameSettings.difficulty === 'hard' && !die.isSplit) {
        // Weighted for 4, 5, 6 (approx 70% chance to roll 4, 5, or 6)
        const weightedPool = [1, 2, 3, 4, 4, 5, 5, 5, 6, 6, 6];
        baseVal = weightedPool[Math.floor(Math.random() * weightedPool.length)];
    } else {
        baseVal = Math.floor(Math.random() * maxVal) + 1;
    }

    // Doctor Skill 2: Mutant Research (permanently adds +1/+2/+3/+4 to team dice values)
    const teamDice = typeof aliveDice === 'function' ? aliveDice(die.team) : (die.team === 'player' ? game.playerDice : game.cpuDice);
    if (teamDice) {
        let maxMutantBonus = 0;
        for (const d of teamDice) {
            const lvl = getSkillLevel(d, 'mutantResearch');
            if (lvl > maxMutantBonus) maxMutantBonus = lvl;
        }
        if (maxMutantBonus > 0) {
            baseVal += maxMutantBonus;
        }
    }

    return baseVal;
}

function rollDice(n, isSplit=false) {
    const vals = [];
    const maxVal = isSplit ? 3 : 6;
    for (let i = 0; i < n; i++) vals.push(Math.floor(Math.random() * maxVal) + 1);
    return vals;
}

async function animateRoll(team, aliveUnits) {
    const el = document.getElementById('roll-display');
    const cls = team === 'player' ? 'player-die' : 'cpu-die';
    const n = aliveUnits.length;
    let finalVals;
    SFX.roll();

    for (let f = 0; f < 12; f++) {
        const vals = aliveUnits.map(d => rollDiceForUnit(d));
        const total = vals.reduce((a, b) => a + b, 0);
        if (el) {
            el.innerHTML = `🎲 ` + vals.map(v => `<span class="roll-die-box ${cls}">${v}</span>`).join('+') +
                ` <span class="roll-eq">=</span> <span class="roll-total">${total}</span>`;
        }
        await delay(60 + f * 10);
        if (f === 11) finalVals = vals;
    }

    finalVals = aliveUnits.map(d => rollDiceForUnit(d));
    const total = finalVals.reduce((a, b) => a + b, 0);
    if (el) {
        el.innerHTML = `🎲 ` + finalVals.map(v => `<span class="roll-die-box ${cls}">${v}</span>`).join('+') +
            ` <span class="roll-eq">=</span> <span class="roll-total">${total}</span>`;
    }
    return finalVals;
}

async function startGame() {
    resetGame();
    startBGM();
    startStopwatch();
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.add('active');
    setupCanvas();
    updateDiceHP();
    updateMoves();
    updateWaveBadge();
    updateCardHand();
    setMessage('Rolling to determine who goes first...');
    setButtons(false, false);

    await delay(600);
    await rollForFirst();
}

async function rollForFirst() {
    let playerTotal = 0, cpuTotal = 0;
    let playerVals, cpuVals;
    let attempts = 0;

    do {
        attempts++;
        playerVals = rollDice(3);
        cpuVals = rollDice(3);
        playerTotal = playerVals.reduce((a, b) => a + b, 0);
        cpuTotal = cpuVals.reduce((a, b) => a + b, 0);

        const tieMsg = playerTotal === cpuTotal ? '<div style="color:var(--gold);margin-top:12px;font-weight:700;">TIE! Rolling again...</div>' : '';
        const resultMsg = playerTotal > cpuTotal ?
            '<div class="overlay-result player-win">🟢 Player goes first!</div>' :
            playerTotal < cpuTotal ?
            '<div class="overlay-result cpu-win">🔴 Computer goes first!</div>' : '';

        showOverlay(`
            <div class="overlay-box">
                <h2>⚔ Roll for First Turn! ⚔</h2>
                ${attempts > 1 ? '<div style="color:var(--text-dim);font-size:0.85rem;margin-bottom:8px;">Attempt #' + attempts + '</div>' : ''}
                <div class="roll-compare">
                    <div class="roll-side player">
                        <div class="label">Player</div>
                        <div class="dice-row">${playerVals.map(v => `<div class="die-box">${v}</div>`).join('')}</div>
                        <div class="total-val">${playerTotal}</div>
                    </div>
                    <div class="vs-text">VS</div>
                    <div class="roll-side cpu">
                        <div class="label">Computer</div>
                        <div class="dice-row">${cpuVals.map(v => `<div class="die-box">${v}</div>`).join('')}</div>
                        <div class="total-val">${cpuTotal}</div>
                    </div>
                </div>
                ${resultMsg}${tieMsg}
            </div>
        `);
        await delay(playerTotal === cpuTotal ? 1800 : 2200);
    } while (playerTotal === cpuTotal);

    // Assign initial face damage from the winning roll for match predictability!
    game.playerDice.forEach((d, i) => { if (playerVals[i]) d.baseDamage = playerVals[i]; });
    game.cpuDice.forEach((d, i) => { if (cpuVals[i]) d.baseDamage = cpuVals[i]; });
    updateDiceHP();

    if (playerTotal > cpuTotal) {
        game.currentTurn = 'player';
        game.firstPlayerThisWave = 'player';
        game.turnsInCurrentWave = 0;
        if (fastAutoMode) {
            hideOverlay();
            beginPlayerTurn();
        } else {
            showOverlay(`
                <div class="overlay-box">
                    <h2>🟢 Your Turn First!</h2>
                    <p style="color:var(--text-dim);margin:12px 0;">Roll dice for movement. Each die moves up to its roll value.<br>Damage = die face value (shown on board).</p>
                    <button class="overlay-btn" onclick="hideOverlay(); beginPlayerTurn();">Let's Go!</button>
                </div>
            `);
        }
    } else {
        game.currentTurn = 'cpu';
        game.firstPlayerThisWave = 'cpu';
        game.turnsInCurrentWave = 0;
        if (fastAutoMode) {
            hideOverlay();
            beginCpuTurn();
        } else {
            showOverlay(`
                <div class="overlay-box">
                    <h2>🔴 Computer Goes First!</h2>
                    <p style="color:var(--text-dim);margin:12px 0;">The computer will make its move...</p>
                    <button class="overlay-btn" onclick="hideOverlay(); beginCpuTurn();">Continue</button>
                </div>
            `);
        }
    }
}

function tickStatusEffects(team) {
    const dice = team === 'player' ? game.playerDice : game.cpuDice;
    for (const d of dice) {
        if (d.frozen > 0) {
            d.frozen--;
            d.bleedStacks = 0;
            d.bleedTurns = 0;
        }
        if (d.trapped > 0) d.trapped--;
        if (d.antiHealTurns > 0) d.antiHealTurns--;
        if (d.bleedTurns > 0) {
            d.bleedTurns--;
            if (d.bleedTurns <= 0) {
                d.bleedStacks = 0;
                addFloatingText('🩸 Bleed Cleared', d.q, d.r, '#94a3b8', 14);
            }
        }
    }

    dice.forEach(d => {
        const healLvl = getSkillLevel(d, 'healAid');
        if (healLvl > 0 && d.hp > 0 && d.frozen === 0) {
            let totalHealedThisTurn = 0;
            dice.forEach(td => {
                if (td.hp > 0) {
                    if (td.antiHealTurns > 0 || td.bleedTurns > 0) {
                        addFloatingText(`🚫 Bleed Anti-Heal!`, td.q, td.r, '#ef4444', 14);
                    } else {
                        const prevHp = td.hp;
                        const maxHp = td.maxHp || MAX_HP;
                        td.hp = Math.min(maxHp, td.hp + healLvl);
                        const actual = td.hp - prevHp;
                        totalHealedThisTurn += actual;
                        addFloatingText(`+${healLvl} 😇`, td.q, td.r, '#34d399', 16);
                    }
                }
            });
            if (totalHealedThisTurn > 0) {
                d.totalHealDone = (d.totalHealDone || 0) + totalHealedThisTurn;
            }
            if (team === 'player' && game.stats && totalHealedThisTurn > 0) {
                game.stats.healDone[d.id] = (game.stats.healDone[d.id] || 0) + totalHealedThisTurn;
                game.stats.healDone.total += totalHealedThisTurn;
                updateStatsDisplay();
            }
            SFX.heal();
        }
    });

    for (const [k, v] of game.blocks) {
        v.turnsLeft--;
        if (v.turnsLeft <= 0) game.blocks.delete(k);
    }
}

async function tickWaveEffects() {
    game.wave++;
    updateWaveBadge();

    // Clean up temporary clone dice (lasting 1 wave)
    if (game.playerDice) game.playerDice = game.playerDice.filter(d => !d.isCloneDie);
    if (game.cpuDice) game.cpuDice = game.cpuDice.filter(d => !d.isCloneDie);

    // Immediately release Mind Control if only 1 unit remains on the original team
    checkAndReleaseSoloMindControl();

    // Mind Control expiry tracking (claims last 2 waves)
    const currentAllDice = allDice();
    for (const d of currentAllDice) {
        if (d.isMindControlled) {
            d.mindControlledWaves--;
            if (d.mindControlledWaves <= 0) {
                d.isMindControlled = false;
                const origTeam = d.originalTeam || 'cpu';
                if (origTeam === 'cpu') {
                    game.playerDice = game.playerDice.filter(x => x.id !== d.id);
                    d.team = 'cpu';
                    if (!game.cpuDice.some(x => x.id === d.id)) game.cpuDice.push(d);
                } else {
                    game.cpuDice = game.cpuDice.filter(x => x.id !== d.id);
                    d.team = 'player';
                    if (!game.playerDice.some(x => x.id === d.id)) game.playerDice.push(d);
                }
                // Clamp HP to pre-control HP and apply flat 6 recoil damage
                if (d.hp > (d.preControlHp || d.hp)) d.hp = d.preControlHp;
                applyIndirectDamage(d, 6, '🔮 Mind Control Recoil', '#c084fc');
                addFloatingText('🔮 Mind Control Ended (-6 HP)!', d.q, d.r, '#c084fc', 18);
                addCombatLog(`${d.icon} ${d.id.toUpperCase()} Mind Control ended! Returned to ${origTeam.toUpperCase()} and took 6 recoil DMG.`, '🔮', '#c084fc');
            }
        }
    }

    for (const d of allDice()) {
        if (d.concealed > 0) d.concealed--;
        if (d.halfDamage > 0) d.halfDamage--;
        if (d.moveDebuff > 0) d.moveDebuff--;
        d.cloneActive = false;
        // Reset damagedThisWave flag at start of wave
        d.damagedThisWave = false;
        // Standstill skill tracking (Archer & general)
        d.didNotMoveLastWave = !d.movedThisWave;
        d.movedThisWave = false;
        d.hasAttackedThisTurn = false;
    }

    // Mage Zap Stack generation (every 2 waves, max 2 stacks)
    if (game.wave % 2 === 0) {
        for (const d of allDice()) {
            if (d.hp <= 0) continue;
            const zapLvl = getSkillLevel(d, 'zap');
            if ((d.archetype === 'mage' || zapLvl > 0) && d.frozen === 0) {
                d.zapStacks = Math.min(2, (d.zapStacks || 0) + 1);
                addFloatingText(`⚡ +1 Zap Stack (${d.zapStacks}/2)`, d.q, d.r, '#c084fc', 18);
            }
        }
    }

    // Passive grant card every 10 waves (Samurai -> Dash, Defender -> Conceal)
    if (game.wave % 10 === 0) {
        const pDice = aliveDice('player');
        const hasSamurai = pDice.some(d => getSkillLevel(d, 'dashMastery') > 0);
        const hasDefender = pDice.some(d => getSkillLevel(d, 'defenderMastery') > 0);
        const maxH = getMaxHandSize('player');

        if (hasSamurai && game.playerHand.length < maxH) {
            const dashCard = CARD_DEFS.find(c => c.id === 'dash');
            if (dashCard) {
                game.playerHand.push({ ...dashCard });
                addFloatingText('🗡️ Free Dash!', pDice[0].q, pDice[0].r, '#c084fc', 16);
            }
        }
        if (hasDefender && game.playerHand.length < maxH) {
            const concealCard = CARD_DEFS.find(c => c.id === 'conceal');
            if (concealCard) {
                game.playerHand.push({ ...concealCard });
                addFloatingText('🔰 Free Immunity!', pDice[0].q, pDice[0].r, '#a78bfa', 16);
            }
        }
        updateCardHand();
    }

    // Necromancer minions summoning (Every 2 waves)
    if (game.wave % 2 === 0) {
        for (const d of allDice()) {
            if (d.hp <= 0) continue;
            const minionLvl = getSkillLevel(d, 'minions');
            if (minionLvl > 0 && d.frozen === 0) {
                const count = minionLvl; // 1/2/3
                let undeadBoost = 0;
                // Check if undead empowered (Lvl 1: +1, Lvl 2: +2, Lvl 3: +4)
                const undeadLvl = getSkillLevel(d, 'undead');
                if (undeadLvl > 0) {
                    undeadBoost = undeadLvl === 1 ? 1 : undeadLvl === 2 ? 2 : 4;
                }
                const baseZombieDmg = 2 + undeadBoost;

                for (let i = 0; i < count; i++) {
                    const emptyHex = findNearestEmptyHex(d.q, d.r);
                    const wavesLeft = Math.floor(Math.random() * 2) + 2; // 2 to 3 waves
                    game.zombies.push({
                        id: Math.random(),
                        q: emptyHex.q,
                        r: emptyHex.r,
                        team: d.team,
                        damage: baseZombieDmg,
                        wavesLeft: wavesLeft
                    });
                    spawnParticles(hexToPixel(emptyHex.q, emptyHex.r).x + gridCenterX, hexToPixel(emptyHex.q, emptyHex.r).y + gridCenterY, '#10b981', 12, 2, 600);
                }
                addFloatingText(`🧟 +${count} Zombie!`, d.q, d.r, '#10b981', 18);
            }
        }
    }

    if (game.wave % 3 === 0) {
        for (const d of aliveDice('player')) {
            const hypnoLvl = getSkillLevel(d, 'hypno');
            if (hypnoLvl > 0 && d.frozen === 0) {
                const chance = hypnoLvl === 1 ? 0.4 : 0.7;
                if (Math.random() < chance) {
                    if (game.cpuHand.length > 0) game.cpuHand.pop();
                    if (game.playerHand.length < getMaxHandSize('player')) game.playerHand.push(randomCard('player'));
                    addFloatingText('🔮 Hypno Steal!', d.q, d.r, '#c084fc', 18);
                    updateCardHand();
                }
            }
        }
    }

    // Doctor Noble Saviour (Gain 1 free Heal card every 4 waves at Lvl 1, every 3 waves at Lvl 2)
    for (const d of allDice()) {
        if (d.hp <= 0) continue;
        const saviourLvl = getSkillLevel(d, 'nobleSaviour');
        if (saviourLvl > 0 && d.frozen === 0) {
            const interval = saviourLvl === 1 ? 4 : 3;
            if (game.wave % interval === 0) {
                const maxH = getMaxHandSize(d.team);
                const hand = d.team === 'player' ? game.playerHand : game.cpuHand;
                if (hand.length < maxH) {
                    const healCard = CARD_DEFS.find(c => c.id === 'heal');
                    if (healCard) {
                        hand.push({ ...healCard });
                        if (d.team === 'player') {
                            addFloatingText('🩺 Free Heal Pill!', d.q, d.r, '#34d399', 16);
                            updateCardHand();
                        }
                    }
                }
            }
        }
    }

    for (const [k, v] of game.eventTiles) {
        v.wavesLeft--;
        if (v.wavesLeft <= 0) game.eventTiles.delete(k);
    }

    for (const [k, v] of game.voidTiles) {
        v.wavesLeft--;
        if (v.wavesLeft <= 0) game.voidTiles.delete(k);
    }

    for (const [k, v] of game.burningTiles) {
        v.wavesLeft--;
        if (v.wavesLeft <= 0) game.burningTiles.delete(k);
    }

    for (const [k, v] of game.vineTraps) {
        v.wavesLeft--;
        if (v.wavesLeft <= 0) game.vineTraps.delete(k);
    }

    if (game.bearTraps) {
        for (const [k, v] of game.bearTraps) {
            v.wavesLeft--;
            if (v.wavesLeft <= 0) game.bearTraps.delete(k);
        }
    }

    game.bees = game.bees.filter(b => {
        b.wavesLeft--;
        return b.wavesLeft > 0;
    });

    if (game.zombies) {
        game.zombies = game.zombies.filter(z => {
            z.wavesLeft--;
            return z.wavesLeft > 0;
        });
    }

    await processBeesMovement();
    await processZombiesMovement();

    if ((game.wave - 1) % EVENT_TILE_INTERVAL === 0 && game.wave > 1) {
        spawnEventTiles();
    }

    if ((game.wave - 1) % BLITZ_INTERVAL === 0 && game.wave > 1) {
        await triggerArenaBlitz();
    }

    if ((game.wave - 1) % UPGRADE_INTERVAL === 0 && game.wave > 1) {
        await triggerRoguelikeUpgrade();
    }
}

async function handleTurnEndSequence(finishedTeam) {
    stopTurnTimer();
    game.turnsInCurrentWave++;

    if (game.turnsInCurrentWave >= 2) {
        game.turnsInCurrentWave = 0;
        await tickWaveEffects();
    }

    if (game.phase !== 'GAME_OVER') {
        if (finishedTeam === 'player') {
            beginCpuTurn();
        } else {
            setMessage("Computer's turn ended. Your turn!");
            await delay(400);
            beginPlayerTurn();
        }
    }
}

async function executeZapSkill(mageDie) {
    if (!mageDie || (mageDie.zapStacks || 0) <= 0) return false;
    const enemyTeam = mageDie.team === 'player' ? 'cpu' : 'player';
    const enemies = aliveDice(enemyTeam).filter(d => !d.concealed);
    if (enemies.length === 0) return false;

    // Find nearest enemy and calculate distance
    let nearestEnemy = null;
    let minDist = Infinity;
    for (const ed of enemies) {
        const dist = hexDist(mageDie.q, mageDie.r, ed.q, ed.r);
        if (dist < minDist) {
            minDist = dist;
            nearestEnemy = ed;
        }
    }

    if (!nearestEnemy) return false;

    mageDie.zapStacks--;
    const zapLvl = getSkillLevel(mageDie, 'zap');
    const zapBonus = zapLvl > 0 ? (zapLvl - 1) : 0;
    let zapDmg = Math.max(1, minDist + zapBonus);

    // Check Focus Skill CRIT (if undamaged)
    let isCrit = false;
    const focusLvl = getSkillLevel(mageDie, 'focus');
    if (focusLvl > 0 && !mageDie.damagedThisWave) {
        const critChance = focusLvl === 1 ? 0.35 : focusLvl === 2 ? 0.65 : 0.99;
        if (Math.random() < critChance) {
            isCrit = true;
            zapDmg *= 2;
        }
    }

    // Apply indirect damage with Aegis protection
    const actualDmg = applyIndirectDamage(nearestEnemy, zapDmg, isCrit ? '⚡💥 CRIT ZAP' : '⚡ ZAP', '#c084fc');

    // Track in stats and die
    mageDie.totalDamageDealt = (mageDie.totalDamageDealt || 0) + actualDmg;
    if (mageDie.team === 'player' && game.stats && actualDmg > 0) {
        game.stats.damageDealt[mageDie.id] = (game.stats.damageDealt[mageDie.id] || 0) + actualDmg;
        game.stats.damageDealt.total += actualDmg;
        updateStatsDisplay();
    }

    SFX.attack();
    const p = hexToPixel(nearestEnemy.q, nearestEnemy.r);
    spawnParticles(p.x + gridCenterX, p.y + gridCenterY, '#a855f7', 20, 3, 700);

    updateDiceHP();
    updateSkillButtons();
    if (checkWin()) return true;
    return true;
}

async function triggerPlayerMageZap() {
    if (game.phase !== 'PLAYER_TURN' || game.currentTurn !== 'player') return;
    const playerMage = aliveDice('player').find(d => d.archetype === 'mage' || getSkillLevel(d, 'zap') > 0);
    if (!playerMage || (playerMage.zapStacks || 0) <= 0) return;

    await executeZapSkill(playerMage);
}

// Archer Long Shot Mastery: Ranged attack (can move first!)
async function executeArcherLongShot(archerDie, targetEnemy) {
    if (!archerDie || !targetEnemy || archerDie.hasAttackedThisTurn) return false;
    const longShotLvl = getSkillLevel(archerDie, 'longShot');
    if (longShotLvl <= 0) return false;

    const dist = hexDist(archerDie.q, archerDie.r, targetEnemy.q, targetEnemy.r);
    const missRate = longShotLvl === 1 ? (0.02 * dist) : longShotLvl === 2 ? (0.01 * dist) : 0;

    archerDie.hasAttackedThisTurn = true;
    archerDie.moveAllowance = 0; // Turn ends for archer after long shot
    if (game.selectedDie === archerDie) {
        game.selectedDie = null;
        game.reachable = null;
        game.parents = null;
    }
    SFX.dash();

    if (Math.random() < missRate) {
        addFloatingText(`🏹 Missed! (${Math.round(missRate * 100)}%)`, targetEnemy.q, targetEnemy.r, '#94a3b8', 18);
        addCombatLog(`${archerDie.icon} ${archerDie.id.toUpperCase()} Long Shot missed ${targetEnemy.icon} ${targetEnemy.id.toUpperCase()} (${Math.round(missRate * 100)}% miss)!`, '🏹', '#94a3b8');
    } else {
        const effDmg = getDieEffectiveDamage(archerDie);
        const actualDmg = applyIndirectDamage(targetEnemy, effDmg, '🏹 Long Shot', '#38bdf8');
        SFX.attack();
        const p = hexToPixel(targetEnemy.q, targetEnemy.r);
        spawnParticles(p.x + gridCenterX, p.y + gridCenterY, '#38bdf8', 18, 3, 700);

        archerDie.totalDamageDealt = (archerDie.totalDamageDealt || 0) + actualDmg;
        if (archerDie.team === 'player' && game.stats && actualDmg > 0) {
            game.stats.damageDealt[archerDie.id] = (game.stats.damageDealt[archerDie.id] || 0) + actualDmg;
            game.stats.damageDealt.total += actualDmg;
            updateStatsDisplay();
        }
        addCombatLog(`${archerDie.icon} ${archerDie.id.toUpperCase()} Long Shot hit ${targetEnemy.icon} ${targetEnemy.id.toUpperCase()} for ${actualDmg} DMG!`, '🏹', '#38bdf8');
    }

    updateDiceHP();
    updateSkillButtons();
    if (checkWin()) return true;
    if (totalMovesLeft(archerDie.team) <= 0) {
        setTimeout(() => handleTurnEndSequence(archerDie.team), 600);
    }
    return true;
}

function triggerPlayerArcherShot() {
    if (game.phase !== 'PLAYER_TURN' || game.currentTurn !== 'player') return;
    const archer = aliveDice('player').find(d => (d.archetype === 'archer' || getSkillLevel(d, 'longShot') > 0) && !d.hasAttackedThisTurn);
    if (!archer) return;

    game.selectedDie = null;
    game.reachable = null;
    game.parents = null;
    game.archerSource = archer;
    game.phase = 'PLAYER_ARCHER_TARGET';
    setMessage('🏹 Long Shot: Click an enemy die to fire from distance.');
    setButtons(false, false);
}

// Piercer Pivot Strike: Deals 8 damage in an area (2 sides Lvl 1, 3 sides Lvl 2, all sides Lvl 3)
async function executePiercerPivot(piercerDie) {
    if (!piercerDie || piercerDie.hasAttackedThisTurn) return false;
    const pivotLvl = getSkillLevel(piercerDie, 'pivot');
    if (pivotLvl <= 0) return false;

    piercerDie.hasAttackedThisTurn = true;
    piercerDie.moveAllowance = 0;
    game.pivotUsedWave = game.wave;
    game.pivotPreview = false;
    game.pivotPiercer = null;

    const enemyTeam = piercerDie.team === 'player' ? 'cpu' : 'player';
    const hitHexes = typeof getPivotHexes === 'function' ? getPivotHexes(piercerDie.q, piercerDie.r, pivotLvl) : [];
    const hitEnemies = aliveDice(enemyTeam).filter(d => !d.concealed && hitHexes.some(n => n.q === d.q && n.r === d.r));

    SFX.attack();
    const p = hexToPixel(piercerDie.q, piercerDie.r);
    spawnParticles(p.x + gridCenterX, p.y + gridCenterY, '#f59e0b', 24, 4, 800, 4);

    if (hitEnemies.length === 0) {
        addFloatingText('🎯 Pivot Swung (No targets in range)', piercerDie.q, piercerDie.r, '#94a3b8', 16);
        addCombatLog(`${piercerDie.icon} ${piercerDie.id.toUpperCase()} swung Pivot Strike, but no enemies were in range.`, '🎯', '#f59e0b');
    } else {
        for (const target of hitEnemies) {
            const toughLvl = getSkillLevel(target, 'toughness');
            const toughRed = toughLvl === 1 ? 3 : toughLvl === 2 ? 5 : toughLvl === 3 ? 7 : 0;
            let dmg = Math.max(1, 8 - toughRed);
            if (target.halfDamage > 0) dmg = Math.ceil(dmg / 2);

            target.hp -= dmg;
            target.totalDamageTaken = (target.totalDamageTaken || 0) + dmg;
            target.damagedThisWave = true;

            piercerDie.totalDamageDealt = (piercerDie.totalDamageDealt || 0) + dmg;
            if (piercerDie.team === 'player' && game.stats) {
                game.stats.damageDealt[piercerDie.id] = (game.stats.damageDealt[piercerDie.id] || 0) + dmg;
                game.stats.damageDealt.total += dmg;
                updateStatsDisplay();
            }

            addFloatingText(`-${dmg} 🎯 Pivot!`, target.q, target.r, '#f59e0b', 20);
            addCombatLog(`${piercerDie.icon} ${piercerDie.id.toUpperCase()} Pivot Strike hit ${target.icon} ${target.id.toUpperCase()} for ${dmg} DMG!`, '🎯', '#f59e0b');
            const ep = hexToPixel(target.q, target.r);
            spawnParticles(ep.x + gridCenterX, ep.y + gridCenterY, '#f59e0b', 15, 2, 600);

            if (target.hp <= 0) {
                target.hp = 0;
                addFloatingText('💀 DESTROYED!', target.q, target.r + 0.5, '#ff2244', 16);
                addCombatLog(`💀 ${target.icon} ${target.id.toUpperCase()} was destroyed by Pivot Strike!`, '💀', '#ef4444');
                SFX.destroy();

                const explodeLvl = getSkillLevel(target, 'explode');
                if (explodeLvl > 0) {
                    const expDmg = explodeLvl === 1 ? 8 : 15;
                    addFloatingText(`💥 EXPLODE -${expDmg}!`, target.q, target.r, '#ef4444', 24);
                    SFX.destroy();
                    aliveDice(piercerDie.team).forEach(pd => {
                        pd.hp -= expDmg;
                        pd.totalDamageTaken = (pd.totalDamageTaken || 0) + expDmg;
                        pd.damagedThisWave = true;
                        if (pd.hp < 0) pd.hp = 0;
                        addFloatingText(`-${expDmg} 💥`, pd.q, pd.r, '#ef4444', 20);
                    });
                }

                const didSplit = handleUndeadSplit(target);
                if (!didSplit && target.team === 'cpu') {
                    for (const teamDie of game.cpuDice) {
                        const revLvl = getSkillLevel(teamDie, 'revive');
                        if (revLvl > 0 && !target.revived) {
                            const healAmount = revLvl * 15;
                            target.hp = healAmount;
                            target.revived = true;
                            teamDie.totalHealDone = (teamDie.totalHealDone || 0) + healAmount;
                            if (teamDie.team === 'player' && game.stats) {
                                game.stats.healDone[teamDie.id] = (game.stats.healDone[teamDie.id] || 0) + healAmount;
                                game.stats.healDone.total += healAmount;
                                updateStatsDisplay();
                            }
                            const emptyHex = findNearestEmptyHex(target.q, target.r);
                            target.q = emptyHex.q; target.r = emptyHex.r;
                            target.movedThisWave = true;
                            addFloatingText(`😇 REVIVED (${target.hp} HP)!`, target.q, target.r, '#fbbf24', 20);
                            SFX.heal();
                            break;
                        }
                    }
                }
            }
        }
    }

    updateDiceHP();
    updateSkillButtons();
    if (checkWin()) return true;
    if (totalMovesLeft(piercerDie.team) <= 0) {
        setTimeout(() => handleTurnEndSequence(piercerDie.team), 600);
    }
    return true;
}

function triggerPlayerPiercerPivot() {
    if (game.phase !== 'PLAYER_TURN' || game.currentTurn !== 'player') return;
    const piercer = aliveDice('player').find(d => (d.archetype === 'piercer' || getSkillLevel(d, 'pivot') > 0) && !d.hasAttackedThisTurn);
    if (!piercer || getSkillLevel(piercer, 'pivot') <= 0) return;
    const isPivotReady = (game.wave - (game.pivotUsedWave || -99)) >= 3;
    if (!isPivotReady) return;

    if (!game.pivotPreview) {
        game.pivotPreview = true;
        game.pivotPiercer = piercer;
        setMessage('🎯 Pivot Area Previewed! Click Pivot button or highlighted area to strike.');
        updateSkillButtons();
    } else {
        game.pivotPreview = false;
        executePiercerPivot(piercer);
    }
}

function cancelPivotPreview() {
    if (game.pivotPreview) {
        game.pivotPreview = false;
        game.pivotPiercer = null;
        setMessage('Pivot cancelled.');
        updateSkillButtons();
    }
}

// Telekinator Mind Control: Active skill every 5 waves (claims enemy die for 2 waves)
function triggerPlayerMindControl() {
    if (game.phase !== 'PLAYER_TURN' || game.currentTurn !== 'player') return;
    const tele = aliveDice('player').find(d => d.archetype === 'telekinator' || getSkillLevel(d, 'mindControl') > 0);
    if (!tele || getSkillLevel(tele, 'mindControl') <= 0) return;
    const isMindReady = (game.wave - (game.mindControlUsedWave || -99)) >= 5;
    if (!isMindReady || tele.frozen > 0 || tele.trapped > 0) return;

    if (aliveDice('cpu').length <= 1) {
        addFloatingText('🚫 Need >1 Enemy!', tele.q, tele.r, '#ef4444', 18);
        setMessage('🔮 Mind Control cannot be used when only 1 enemy die remains.');
        return;
    }

    game.mindControlSource = tele;
    game.phase = 'PLAYER_MIND_CONTROL_ENEMY';
    setMessage('🔮 Mind Control: Click an enemy die to claim for 2 waves!');
    setButtons(false, false);
}

async function beginPlayerTurn() {
    game.phase = 'PLAYER_ROLL';
    game.currentTurn = 'player';
    game.selectedDie = null;
    game.reachable = null;
    game.parents = null;
    game.lastAttackedId = null;

    // Reset psychic aura on turn start
    game.psychicAura = false;
    const canvasWrap = document.getElementById('canvas-wrapper');
    if (canvasWrap) canvasWrap.classList.remove('aura-psychic');

    tickStatusEffects('player');
    startTurnTimer();

    setMessage('Rolling your dice for movement...');
    setButtons(false, false);

    await delay(300);
    const alive = aliveDice('player');
    const n = alive.length;
    if (n === 0) { checkWin(); return; }

    const vals = await animateRoll('player', alive);

    alive.forEach((d, i) => {
        d.turnRoll = vals[i];
        d.baseDamage = vals[i]; // Base damage equals rolled die value for this turn!
        const flashLvl = getSkillLevel(d, 'flash');
        const flashBonus = flashLvl === 1 ? 1 : flashLvl === 2 ? 2 : flashLvl === 3 ? 4 : 0;
        d.moveAllowance = Math.max(0, vals[i] + flashBonus - d.moveDebuff);
        d.damageMultiplier = 1;
        d.attackAgainActive = false;
        d.lastAttackedEnemyId = null;
        d.hasAttackedThisTurn = false;
    });

    updateMoves();
    updateRollDisplay(vals, 'player');
    updateDiceHP();
    updateSkillButtons();
    updateStatsDisplay();

    // Check Telekinator Psychic Push skill (40% / 65% / 90%) - Exactly 1 roll attempt per team turn
    const teleDie = alive.find(d => getSkillLevel(d, 'psychic') > 0 && d.frozen === 0 && d.trapped === 0);
    if (teleDie) {
        const psychicLvl = getSkillLevel(teleDie, 'psychic');
        const chance = psychicLvl === 1 ? 0.40 : psychicLvl === 2 ? 0.65 : 0.90;
        const roll = Math.random();
        if (roll < chance) {
            const cpuAlive = aliveDice('cpu').filter(cd => !cd.concealed);
            if (cpuAlive.length > 0) {
                SFX.powerUp();
                game.psychicAura = true;
                if (canvasWrap) canvasWrap.classList.add('aura-psychic');
                addFloatingText('🔮 Psychic Push Triggered!', teleDie.q, teleDie.r, '#c084fc', 22);
                await delay(700);
                game.psychicSource = teleDie;
                game.phase = 'PLAYER_PSYCHIC_ENEMY';
                setMessage(`🔮 PSYCHIC ACTIVE: Choose enemy die to move! (${Math.round(chance * 100)}% Success)`);
                setButtons(false, false);
                return;
            }
        } else {
            addFloatingText(`🔮 Psychic Push Missed (${Math.round(chance * 100)}%)`, teleDie.q, teleDie.r, '#94a3b8', 14);
        }
    }

    game.phase = 'PLAYER_TURN';
    setMessage(`Your turn! Click a green die to move.`);
    setButtons(true, false);

    if (fastAutoMode) {
        setTimeout(playerAutoBotTurn, 200);
    }
}

function selectDie(die) {
    if (die.frozen > 0) {
        setMessage(`Die D${die.id} is frozen! ❄️ (${die.frozen} turn${die.frozen>1?'s':''} left)`);
        return;
    }
    if (die.trapped > 0) {
        setMessage(`Die D${die.id} is trapped in vines! 🌿 (${die.trapped} wave${die.trapped>1?'s':''} left)`);
        return;
    }
    if (die.moveAllowance <= 0) {
        setMessage(`Die D${die.id} has no moves left.`);
        return;
    }

    game.selectedDie = die;
    const { reachable, parents } = findReachable(die);
    game.reachable = reachable;
    game.parents = parents;

    if (reachable.size === 0) {
        setMessage(`Die D${die.id} has no valid moves. Try another.`);
        game.selectedDie = null;
        game.reachable = null;
        game.parents = null;
        setButtons(true, false);
        return;
    }

    const attacks = [...reachable.values()].filter(v => v.isAttack);
    const effDmg = getDieEffectiveDamage(die);
    setMessage(`D${die.id} [DMG:${effDmg}${die.damageMultiplier>1?'×'+die.damageMultiplier:''}] selected. ${die.moveAllowance} moves. ${attacks.length ? attacks.length + ' target(s).' : ''}`);
    setButtons(true, true);
}

function deselectDie() {
    if (game.activeCard) {
        cancelCard();
        return;
    }
    game.selectedDie = null;
    game.reachable = null;
    game.parents = null;
    setMessage(`Select a green die to move.`);
    setButtons(true, false);
}

// Handle Necromancer Undead split upon death
function handleUndeadSplit(deadDie) {
    const undeadLvl = getSkillLevel(deadDie, 'undead');
    if (undeadLvl > 0 && !deadDie.undeadTriggered) {
        deadDie.undeadTriggered = true;
        const splitHp = undeadLvl === 1 ? 10 : undeadLvl === 2 ? 20 : 30;

        // Create 2 split dice
        const teamDiceArray = deadDie.team === 'player' ? game.playerDice : game.cpuDice;
        const empty1 = findNearestEmptyHex(deadDie.q, deadDie.r);
        const empty2 = findNearestEmptyHex(empty1.q, empty1.r);

        const subDie1 = createDie(`${deadDie.id}_a`, empty1.q, empty1.r, deadDie.team, 'necromancer', true);
        const subDie2 = createDie(`${deadDie.id}_b`, empty2.q, empty2.r, deadDie.team, 'necromancer', true);

        subDie1.hp = splitHp;
        subDie1.maxHp = splitHp;
        subDie2.hp = splitHp;
        subDie2.maxHp = splitHp;
        subDie1.skills = JSON.parse(JSON.stringify(deadDie.skills));
        subDie2.skills = JSON.parse(JSON.stringify(deadDie.skills));
        subDie1.undeadTriggered = true;
        subDie2.undeadTriggered = true;

        teamDiceArray.push(subDie1, subDie2);

        addFloatingText(`💀 UNDEAD SPLIT! (${splitHp} HP each)`, deadDie.q, deadDie.r, '#10b981', 20);
        SFX.powerUp();
        return true;
    }
    return false;
}

async function handlePlayerMove(tq, tr) {
    if (!game.reachable || !game.reachable.has(hKey(tq, tr))) return;
    if (game.phase !== 'PLAYER_TURN') return;

    const info = game.reachable.get(hKey(tq, tr));
    const die = game.selectedDie;
    const path = reconstructPath(game.parents, die.q, die.r, tq, tr);

    game.phase = 'PLAYER_ANIMATING';
    game.reachable = null;
    game.parents = null;
    setButtons(false, false);

    if (info.isAttack) {
        const movePath = path.slice(0, -1);
        if (movePath.length > 1) await animateMove(die, movePath);

        const prevQ = die.q, prevR = die.r;
        const enemyDie = getDieAt(tq, tr);
        if (!enemyDie) {
            die.q = tq; die.r = tr;
            game.phase = 'PLAYER_TURN';
            setButtons(true, false);
            return;
        }

        await animateMove(die, [{ q: die.q, r: die.r }, { q: tq, r: tr }]);

        // Calculate damage with Toughness reduction: -3 / -5 / -7
        const toughLvl = getSkillLevel(enemyDie, 'toughness');
        const toughRed = toughLvl === 1 ? 3 : toughLvl === 2 ? 5 : toughLvl === 3 ? 7 : 0;

        const attackerEffDmg = getDieEffectiveDamage(die);
        let rawDamage = attackerEffDmg * die.damageMultiplier;

        // Ninja Momentum Passive (+1 DMG per remaining move after attacking, max +5 DMG)
        if (die.archetype === 'ninja') {
            const remainingMoves = Math.max(0, die.moveAllowance - info.dist);
            const ninjaBonus = Math.min(5, remainingMoves);
            if (ninjaBonus > 0) {
                rawDamage += ninjaBonus;
                addFloatingText(`🥷 +${ninjaBonus} Momentum DMG!`, die.q, die.r, '#60a5fa', 16);
            }
        }

        // Piercer Tank Killer (+10%/15%/20%/25% of target enemy HP)
        const tankKillerLvl = getSkillLevel(die, 'tankKiller');
        if (tankKillerLvl > 0) {
            const pct = tankKillerLvl === 1 ? 0.10 : tankKillerLvl === 2 ? 0.15 : tankKillerLvl === 3 ? 0.20 : 0.25;
            const tankBonus = Math.max(1, Math.round(enemyDie.hp * pct));
            rawDamage += tankBonus;
            addFloatingText(`🎯 Tank Killer +${tankBonus} DMG!`, die.q, die.r, '#f59e0b', 16);
        }

        rawDamage = Math.max(1, rawDamage - toughRed);
        const damage = enemyDie.halfDamage > 0 ? Math.ceil(rawDamage / 2) : rawDamage;

        die.hasAttackedThisTurn = true;
        die.totalDamageDealt = (die.totalDamageDealt || 0) + damage;
        enemyDie.hp -= damage;
        enemyDie.totalDamageTaken = (enemyDie.totalDamageTaken || 0) + damage;
        enemyDie.damagedThisWave = true;
        SFX.attack();

        // Track stats: Damage Dealt by Player Die
        if (game.stats) {
            game.stats.damageDealt[die.id] = (game.stats.damageDealt[die.id] || 0) + damage;
            game.stats.damageDealt.total += damage;
            updateStatsDisplay();
        }

        // Check Rage Back Stronger on enemy
        const enemyBackLvl = getSkillLevel(enemyDie, 'backStronger');
        if (enemyBackLvl > 0 || enemyDie.archetype === 'Rage') {
            const reqDmg = enemyBackLvl === 2 ? 9 : enemyBackLvl === 3 ? 7 : 10;
            const newBonus = Math.min(10, Math.floor(enemyDie.totalDamageTaken / reqDmg));
            if (newBonus > (enemyDie.bonusDamageFromDamageTaken || 0)) {
                const diff = newBonus - (enemyDie.bonusDamageFromDamageTaken || 0);
                enemyDie.bonusDamageFromDamageTaken = newBonus;
                addFloatingText(`😡 Rage +${diff} DMG!`, enemyDie.q, enemyDie.r, '#ef4444', 18);
            }
        }

        // Check Defender Thorns reflect on attacker (die): 1 / 3 / 5
        const thornsLvl = getSkillLevel(enemyDie, 'thorns');
        if (thornsLvl > 0) {
            const reflectDmg = thornsLvl === 1 ? 1 : thornsLvl === 2 ? 3 : 5;
            die.hp -= reflectDmg;
            die.totalDamageTaken = (die.totalDamageTaken || 0) + reflectDmg;
            die.damagedThisWave = true;
            if (die.hp < 0) die.hp = 0;

            // Track stats: Damage Taken by Player Die from Thorns
            if (game.stats) {
                game.stats.damageTaken[die.id] = (game.stats.damageTaken[die.id] || 0) + reflectDmg;
                game.stats.damageTaken.total += reflectDmg;
                updateStatsDisplay();
            }

            const dieBackLvl = getSkillLevel(die, 'backStronger');
            if (dieBackLvl > 0 || die.archetype === 'Rage') {
                const reqDmg = dieBackLvl === 2 ? 9 : dieBackLvl === 3 ? 7 : 10;
                const newBonus = Math.min(10, Math.floor(die.totalDamageTaken / reqDmg));
                if (newBonus > (die.bonusDamageFromDamageTaken || 0)) {
                    const diff = newBonus - (die.bonusDamageFromDamageTaken || 0);
                    die.bonusDamageFromDamageTaken = newBonus;
                    addFloatingText(`😡 Rage +${diff} DMG!`, die.q, die.r, '#ef4444', 18);
                }
            }

            addFloatingText(`-${reflectDmg} 🛡️ Thorns`, die.q, die.r, '#a8a29e', 18);
        }

        // Dracula Lifesteal
        const healLvl = getSkillLevel(die, 'healOnAtk');
        if (healLvl > 0 && die.antiHealTurns === 0) {
            const healAmt = healLvl === 1 ? 2 : healLvl === 2 ? 3 : 5;
            const prevHp = die.hp;
            const maxHp = die.maxHp || (game && game.settings ? game.settings.startHp : (typeof gameSettings !== 'undefined' ? gameSettings.startHp : 50));
            die.hp = Math.min(maxHp, die.hp + healAmt);
            const actualHeal = die.hp - prevHp;
            die.totalHealDone = (die.totalHealDone || 0) + actualHeal;
            if (game.stats && actualHeal > 0) {
                game.stats.healDone[die.id] = (game.stats.healDone[die.id] || 0) + actualHeal;
                game.stats.healDone.total += actualHeal;
                updateStatsDisplay();
            }
            addFloatingText(`+${healAmt} 🩸`, die.q, die.r, '#34d399', 16);
        } else if (healLvl > 0 && die.antiHealTurns > 0) {
            addFloatingText(`🚫 Anti-Healed!`, die.q, die.r, '#ef4444', 14);
        }

        // Dracula Bleed: If already bleeding, upgrade stack if current skill is higher and refresh 3-turn duration
        const bleedLvl = getSkillLevel(die, 'bleed');
        if (bleedLvl > 0) {
            const stacksToAdd = bleedLvl === 1 ? 1 : bleedLvl === 2 ? 2 : 3;
            if (enemyDie.bleedTurns > 0 || enemyDie.bleedStacks > 0) {
                enemyDie.bleedStacks = Math.min(3, Math.max(enemyDie.bleedStacks || 1, stacksToAdd));
                enemyDie.bleedSourceDieId = die.id;
                enemyDie.bleedSourceTeam = die.team;
                enemyDie.bleedTurns = 3;
                enemyDie.antiHealTurns = 3;
                addFloatingText(`🩸 Bleed Refreshed (${enemyDie.bleedStacks} stacks, 3 Turns)!`, enemyDie.q, enemyDie.r, '#ef4444', 16);
                addCombatLog(`${die.icon} ${die.id.toUpperCase()} refreshed Bleed duration (3 turns, ${enemyDie.bleedStacks} stacks) on ${enemyDie.icon} ${enemyDie.id.toUpperCase()}!`, '🩸', '#ef4444');
            } else {
                enemyDie.bleedStacks = Math.min(3, stacksToAdd);
                enemyDie.bleedSourceDieId = die.id;
                enemyDie.bleedSourceTeam = die.team;
                enemyDie.bleedTurns = 3;
                enemyDie.antiHealTurns = 3;
                addFloatingText(`🩸 Bleed x${enemyDie.bleedStacks} (3 Turns)!`, enemyDie.q, enemyDie.r, '#ef4444', 16);
                addCombatLog(`${die.icon} ${die.id.toUpperCase()} inflicted Bleed x${enemyDie.bleedStacks} on ${enemyDie.icon} ${enemyDie.id.toUpperCase()} (3 turns)!`, '🩸', '#ef4444');
            }
        }

        addFloatingText(`-${damage}`, tq, tr, '#ff4466', 22);
        if (die.damageMultiplier > 1) addFloatingText(`×${die.damageMultiplier}!`, tq, tr - 0.4, '#f59e0b', 14);
        addCombatLog(`${die.icon} ${die.id.toUpperCase()} attacked ${enemyDie.icon} ${enemyDie.id.toUpperCase()} for ${damage} DMG!`, '⚔️', '#ff4466');

        const p = hexToPixel(tq, tr);
        spawnParticles(p.x+gridCenterX, p.y+gridCenterY, '#ff4466', 15, 3, 600, 3);

        if (enemyDie.hp <= 0) {
            enemyDie.hp = 0;
            addFloatingText('💀 DESTROYED!', tq, tr + 0.5, '#ff2244', 16);
            addCombatLog(`💀 ${enemyDie.icon} ${enemyDie.id.toUpperCase()} was destroyed!`, '💀', '#ef4444');
            SFX.destroy();
            die.q = tq; die.r = tr;

            // Rage Explode on death
            const explodeLvl = getSkillLevel(enemyDie, 'explode');
            if (explodeLvl > 0) {
                const expDmg = explodeLvl === 1 ? 8 : 15;
                addFloatingText(`💥 EXPLODE -${expDmg}!`, tq, tr, '#ef4444', 24);
                SFX.destroy();
                aliveDice('player').forEach(pd => {
                    pd.hp -= expDmg;
                    pd.totalDamageTaken = (pd.totalDamageTaken || 0) + expDmg;
                    pd.damagedThisWave = true;
                    if (pd.hp < 0) pd.hp = 0;
                    addFloatingText(`-${expDmg} 💥`, pd.q, pd.r, '#ef4444', 20);
                });
            }

            // Necromancer Undead split check (without consuming Angel revive!)
            const didSplit = handleUndeadSplit(enemyDie);

            // Revive check (Angel revive) if didn't split
            if (!didSplit) {
                for (const teamDie of game.cpuDice) {
                    const revLvl = getSkillLevel(teamDie, 'revive');
                    if (revLvl > 0 && !enemyDie.revived) {
                        const healAmount = revLvl * 15;
                        enemyDie.hp = healAmount;
                        enemyDie.revived = true;
                        teamDie.totalHealDone = (teamDie.totalHealDone || 0) + healAmount;
                        if (teamDie.team === 'player' && game.stats) {
                            game.stats.healDone[teamDie.id] = (game.stats.healDone[teamDie.id] || 0) + healAmount;
                            game.stats.healDone.total += healAmount;
                            updateStatsDisplay();
                        }
                        const emptyHex = findNearestEmptyHex(enemyDie.q, enemyDie.r);
                        enemyDie.q = emptyHex.q;
                        enemyDie.r = emptyHex.r;
                        enemyDie.movedThisWave = true;
                        addFloatingText(`😇 REVIVED (${enemyDie.hp} HP)!`, enemyDie.q, enemyDie.r, '#fbbf24', 20);
                        SFX.heal();
                        break;
                    }
                }
            }
        } else {
            die.q = tq; die.r = tr;
            enemyDie.q = prevQ; enemyDie.r = prevR;
            enemyDie.movedThisWave = true;
            if (typeof triggerTileEffectOnDie === 'function') {
                triggerTileEffectOnDie(enemyDie);
                triggerTileEffectOnDie(die);
            }
        }

        die.damageMultiplier = 1;
        const attackedId = enemyDie.id;

        die.moveAllowance -= info.dist;
        if (die.moveAllowance < 0) die.moveAllowance = 0;

        const quickLvl = getSkillLevel(die, 'quickDestruct');
        const quickChance = quickLvl === 1 ? 0.25 : quickLvl === 2 ? 0.35 : quickLvl === 3 ? 0.50 : 0;
        if (quickLvl > 0 && die.moveAllowance > 0 && Math.random() < quickChance) {
            die.attackAgainActive = true;
            addFloatingText('🥷 Quick Destruct!', die.q, die.r, '#60a5fa', 18);
        }

        if (die.attackAgainActive && die.moveAllowance > 0) {
            die.attackAgainActive = false;
            die.lastAttackedEnemyId = attackedId;
        } else {
            die.moveAllowance = 0;
        }

        updateMoves();
        updateDiceHP();
        updateSkillButtons();
        await delay(600);

        if (checkWin()) return;

        game.selectedDie = null;

        if (die.moveAllowance > 0) {
            game.phase = 'PLAYER_TURN';
            setMessage(`Attack Again! ${die.moveAllowance} moves left.`);
            selectDie(die);
        } else if (totalMovesLeft('player') > 0) {
            game.phase = 'PLAYER_TURN';
            setMessage(`Attack done. ${totalMovesLeft('player')} total moves remaining.`);
            setButtons(true, false);
        } else {
            setMessage("No moves remaining. Ending turn...");
            await delay(600);
            await handleTurnEndSequence('player');
        }
    } else {
        await animateMove(die, path);
        die.moveAllowance -= info.dist;

        updateMoves();
        updateDiceHP();
        updateSkillButtons();

        if (totalMovesLeft('player') <= 0) {
            game.selectedDie = null;
            setMessage("No moves remaining. Ending turn...");
            await delay(600);
            await handleTurnEndSequence('player');
        } else {
            game.phase = 'PLAYER_TURN';
            if (die.moveAllowance > 0) {
                selectDie(die);
            } else {
                game.selectedDie = null;
                setMessage(`Die done. Select another die to move.`);
                setButtons(true, false);
            }
        }
    }
}

function endTurn() {
    if (game.phase !== 'PLAYER_TURN' && game.phase !== 'PLAYER_CARD_TARGET') return;
    game.selectedDie = null;
    game.reachable = null;
    game.parents = null;
    aliveDice('player').forEach(d => d.moveAllowance = 0);
    updateMoves();
    setButtons(false, false);
    setMessage("Turn ended.");
    setTimeout(() => handleTurnEndSequence('player'), 600);
}

function handlePsychicEnemySelect(q, r) {
    const die = getDieAt(q, r);
    if (die && die.team === 'cpu' && die.hp > 0 && !die.concealed) {
        game.psychicTargetEnemy = die;
        game.phase = 'PLAYER_PSYCHIC_TILE';
        setMessage('🔮 Psychic Push: Click an empty hex to push the enemy die.');
        return true;
    }
    return false;
}

async function handlePsychicTileSelect(q, r) {
    const enemy = game.psychicTargetEnemy;
    if (!enemy) return false;

    if (isValidHex(q, r) && !getDieAt(q, r) && !isBlocked(q, r)) {
        game.phase = 'PLAYER_ANIMATING';
        const oldP = hexToPixel(enemy.q, enemy.r);
        const dist = hexDist(enemy.q, enemy.r, q, r);
        enemy.q = q; enemy.r = r;
        enemy.movedThisWave = true;
        const newP = hexToPixel(q, r);

        SFX.swap();
        spawnParticles(oldP.x + gridCenterX, oldP.y + gridCenterY, '#c084fc', 18, 3, 600);
        spawnParticles(newP.x + gridCenterX, newP.y + gridCenterY, '#c084fc', 18, 3, 600);
        addFloatingText('🔮 Pushed!', q, r, '#c084fc', 20);

        // Forced movement bleed capped to 11
        applyForcedMoveBleed(enemy, dist);

        // Immediate tile hazard & card pickup check when pushed
        checkEventTilePickup(enemy);
        triggerTileEffectOnDie(enemy);

        game.psychicSource = null;
        game.psychicTargetEnemy = null;
        game.psychicAura = false;
        const canvasWrap = document.getElementById('canvas-wrapper');
        if (canvasWrap) canvasWrap.classList.remove('aura-psychic');

        await delay(600);

        game.phase = 'PLAYER_TURN';
        setMessage('Your turn! Click a green die to move.');
        setButtons(true, false);
        return true;
    }
    return false;
}

// Mind Control Selection Handlers: Claims enemy die for 2 waves and rolls new moves immediately!
function handleMindControlEnemySelect(q, r) {
    const die = getDieAt(q, r);
    if (die && die.team === 'cpu' && die.hp > 0 && !die.concealed) {
        // Claim the enemy die for 2 waves
        die.isMindControlled = true;
        die.mindControlledWaves = 2;
        die.originalTeam = 'cpu';
        die.preControlHp = die.hp;
        die.team = 'player';

        game.cpuDice = game.cpuDice.filter(d => d.id !== die.id);
        if (!game.playerDice.some(d => d.id === die.id)) game.playerDice.push(die);

        game.mindControlUsedWave = game.wave;
        game.mindControlSource = null;

        // Roll fresh movement points for this claimed die so player can command it immediately!
        const rollVal = Math.floor(Math.random() * 6) + 1;
        die.turnRoll = rollVal;
        die.baseDamage = rollVal;
        die.moveAllowance = rollVal;
        die.hasAttackedThisTurn = false;
        die.damageMultiplier = 1;

        SFX.powerUp();
        addFloatingText(`🔮 MIND CONTROLLED (🎲 Roll ${rollVal})!`, die.q, die.r, '#c084fc', 22);
        addCombatLog(`🔮 Mind Controlled ${die.icon} ${die.id.toUpperCase()}! Rolled ${rollVal} moves. Ready for action!`, '🔮', '#c084fc');

        game.phase = 'PLAYER_TURN';
        setMessage(`🔮 Claimed ${die.icon} ${die.id.toUpperCase()} (Rolled ${rollVal} Moves)! You can move it now.`);
        updateMoves();
        updateDiceHP();
        updateSkillButtons();
        setButtons(true, false);
        return true;
    }
    return false;
}

function handleArcherTargetSelect(q, r) {
    const enemy = getDieAt(q, r);
    if (enemy && enemy.team === 'cpu' && enemy.hp > 0 && !enemy.concealed && game.archerSource) {
        game.selectedDie = null;
        game.reachable = null;
        game.parents = null;
        executeArcherLongShot(game.archerSource, enemy);
        game.archerSource = null;
        game.phase = 'PLAYER_TURN';
        setMessage('🏹 Arrow fired! Archer turn ended.');
        if (totalMovesLeft('player') <= 0) {
            setTimeout(() => handleTurnEndSequence('player'), 600);
        } else {
            setButtons(true, false);
        }
        return true;
    }
    return false;
}

function renderGameOverStatsHTML(isWin) {
    const elapsedMins = Math.floor((game.matchTimeSeconds || 0) / 60);
    const elapsedSecs = (game.matchTimeSeconds || 0) % 60;
    const timeStr = `${elapsedMins.toString().padStart(2, '0')}:${elapsedSecs.toString().padStart(2, '0')}`;
    const startHp = game && game.settings ? game.settings.startHp : (typeof gameSettings !== 'undefined' ? gameSettings.startHp : 50);
    const diff = (typeof gameSettings !== 'undefined' ? gameSettings.difficulty : 'Medium').toUpperCase();

    // Player Dice calculations
    let pTotalDealt = 0, pTotalTaken = 0, pTotalHeal = 0;
    const playerDiceList = (game.playerDice || []).map((d, i) => {
        const dealt = d.totalDamageDealt || 0;
        const taken = d.totalDamageTaken || 0;
        const heal = d.totalHealDone || 0;
        pTotalDealt += dealt; pTotalTaken += taken; pTotalHeal += heal;
        const name = d.isSplit ? `${d.icon} ${d.id}` : `${d.icon} D${i + 1} (${d.archetype.toUpperCase()})`;
        return `
            <div class="game-over-die-item">
                <span style="font-weight:700;color:var(--player);">${name}</span>
                <div class="game-over-stat-pills">
                    <span class="game-over-pill dmg" title="Damage Dealt">⚔️ ${dealt}</span>
                    <span class="game-over-pill taken" title="Damage Taken">🛡️ ${taken}</span>
                    <span class="game-over-pill heal" title="Healing">💚 ${heal}</span>
                </div>
            </div>
        `;
    }).join('');

    // CPU Dice calculations
    let cTotalDealt = 0, cTotalTaken = 0, cTotalHeal = 0;
    const cpuDiceList = (game.cpuDice || []).map((d, i) => {
        const dealt = d.totalDamageDealt || 0;
        const taken = d.totalDamageTaken || 0;
        const heal = d.totalHealDone || 0;
        cTotalDealt += dealt; cTotalTaken += taken; cTotalHeal += heal;
        const name = d.isSplit ? `${d.icon} ${d.id}` : `${d.icon} CPU ${i + 1} (${d.archetype.toUpperCase()})`;
        return `
            <div class="game-over-die-item">
                <span style="font-weight:700;color:var(--cpu);">${name}</span>
                <div class="game-over-stat-pills">
                    <span class="game-over-pill dmg" title="Damage Dealt">⚔️ ${dealt}</span>
                    <span class="game-over-pill taken" title="Damage Taken">🛡️ ${taken}</span>
                    <span class="game-over-pill heal" title="Healing">💚 ${heal}</span>
                </div>
            </div>
        `;
    }).join('');

    return `
        <div class="overlay-box game-over-modal-box">
            <h2>${isWin ? '🏆 VICTORY! 🏆' : '💀 DEFEAT 💀'}</h2>
            <p style="color:${isWin ? 'var(--player)' : 'var(--cpu)'};font-size:1.05rem;font-weight:700;margin:6px 0;">
                ${isWin ? 'All enemy dice were conquered!' : 'Your team was destroyed in the arena...'}
            </p>

            <div class="game-over-match-summary">
                <span>🌊 Wave: <b style="color:var(--gold);">${game.wave}</b></span>
                <span>⏱️ Time: <b style="color:var(--accent);">${timeStr}</b></span>
                <span>❤️ Mode: <b>${startHp} HP</b> (${diff})</span>
            </div>

            <div class="game-over-stats-grid">
                <div class="game-over-team-box player">
                    <div class="game-over-team-title">
                        <span>🟢 Player Team</span>
                        <div class="game-over-stat-pills">
                            <span class="game-over-pill dmg" title="Total DMG Dealt">⚔️ ${pTotalDealt}</span>
                            <span class="game-over-pill taken" title="Total DMG Taken">🛡️ ${pTotalTaken}</span>
                            <span class="game-over-pill heal" title="Total Heal">💚 ${pTotalHeal}</span>
                        </div>
                    </div>
                    ${playerDiceList}
                </div>

                <div class="game-over-team-box cpu">
                    <div class="game-over-team-title">
                        <span>🔴 Enemy Team</span>
                        <div class="game-over-stat-pills">
                            <span class="game-over-pill dmg" title="Total DMG Dealt">⚔️ ${cTotalDealt}</span>
                            <span class="game-over-pill taken" title="Total DMG Taken">🛡️ ${cTotalTaken}</span>
                            <span class="game-over-pill heal" title="Total Heal">💚 ${cTotalHeal}</span>
                        </div>
                    </div>
                    ${cpuDiceList}
                </div>
            </div>

            <div style="display:flex;gap:12px;margin-top:16px;justify-content:center;flex-wrap:wrap;">
                <button class="overlay-btn restart" onclick="hideOverlay(); startGame();">🔄 ${isWin ? 'Play Again' : 'Try Again'}</button>
                <button class="overlay-btn" style="background:linear-gradient(135deg, var(--cpu), #be123c);" onclick="hideOverlay(); quitToMainMenu();">🏠 Main Menu</button>
            </div>
        </div>
    `;
}

function checkAndReleaseSoloMindControl() {
    if (!game || !game.playerDice || !game.cpuDice) return false;
    let anyReleased = false;
    const all = allDice();

    for (const d of all) {
        if (d.isMindControlled && d.hp > 0) {
            const origTeam = d.originalTeam || (d.team === 'player' ? 'cpu' : 'player');
            // Check if there are any other living dice belonging to origTeam (excluding this mind-controlled unit)
            const otherAliveUnitsOfOrigTeam = all.filter(x => x.id !== d.id && x.hp > 0 && (x.originalTeam ? x.originalTeam === origTeam : x.team === origTeam));

            if (otherAliveUnitsOfOrigTeam.length === 0) {
                // The mind-controlled die is the ONLY remaining unit of its original team!
                // Immediately release mind control so the match does not falsely end prematurely.
                d.isMindControlled = false;
                d.mindControlledWaves = 0;

                if (origTeam === 'cpu') {
                    game.playerDice = game.playerDice.filter(x => x.id !== d.id);
                    d.team = 'cpu';
                    if (!game.cpuDice.some(x => x.id === d.id)) game.cpuDice.push(d);
                } else {
                    game.cpuDice = game.cpuDice.filter(x => x.id !== d.id);
                    d.team = 'player';
                    if (!game.playerDice.some(x => x.id === d.id)) game.playerDice.push(d);
                }

                if (game.selectedDie && game.selectedDie.id === d.id && d.team !== game.currentTurn) {
                    game.selectedDie = null;
                    game.reachable = null;
                    game.parents = null;
                }

                // Restore pre-control HP clamp and apply 6 flat recoil damage
                if (d.hp > (d.preControlHp || d.hp)) d.hp = d.preControlHp;
                applyIndirectDamage(d, 6, '🔮 Solo Release Recoil', '#c084fc');
                addFloatingText('🔮 Mind Control Released (Last Standing)!', d.q, d.r, '#c084fc', 20);
                addCombatLog(`🔮 Mind Control broken on ${d.icon} ${d.id.toUpperCase()}! As the last surviving unit, it returned to ${origTeam.toUpperCase()} and took 6 recoil DMG.`, '🔮', '#c084fc');
                anyReleased = true;
            }
        }
    }

    if (anyReleased) {
        updateDiceHP();
        updateSkillButtons();
        updateMoves();
    }
    return anyReleased;
}

function checkWin() {
    checkAndReleaseSoloMindControl();

    const pAlive = aliveDice('player').length;
    const cAlive = aliveDice('cpu').length;

    if (cAlive === 0) {
        game.phase = 'GAME_OVER';
        stopTurnTimer();
        stopStopwatch();
        SFX.win();
        showOverlay(renderGameOverStatsHTML(true));
        return true;
    }
    if (pAlive === 0) {
        game.phase = 'GAME_OVER';
        stopTurnTimer();
        stopStopwatch();
        SFX.lose();
        showOverlay(renderGameOverStatsHTML(false));
        return true;
    }
    return false;
}
