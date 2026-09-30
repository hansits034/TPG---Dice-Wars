// ==========================================================
// 11. ANIMATIONS & GAME LOOP / TURN CONTROLLER
// ==========================================================
// Resolves only if the same match is still running, so async turn flows from an
// abandoned match (Restart / Quit to Menu) stop at their next await instead of mutating the new match.
function delay(ms) {
    const session = game;
    return new Promise(r => setTimeout(() => {
        if (game === session && !session.aborted) r();
    }, ms));
}

// setTimeout that is dropped when the match is restarted or quit
function matchTimeout(fn, ms) {
    const session = game;
    return setTimeout(() => {
        if (game === session && !session.aborted) fn();
    }, ms);
}
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
            startSlide(die, die.q, die.r, 260, 0.5);
            die.q = bounce.q; die.r = bounce.r;
            if (die.slide) { die.slide.fromQ = die.slide.fromQ; }
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
    const finalVals = aliveUnits.map(d => rollDiceForUnit(d));
    if (el) el.innerHTML = `<span class="roll-pending">${team === 'player' ? 'Rolling your dice' : 'Computer is rolling'}</span>`;
    SFX.roll();
    await playBoardRoll(finalVals, team, aliveUnits.map(d => d.archetype));
    if (el) el.innerHTML = rollDiceHTML(finalVals, team);
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

        const resultMsg = playerTotal > cpuTotal ?
            '<div class="overlay-result player-win">You move first.</div>' :
            playerTotal < cpuTotal ?
            '<div class="overlay-result cpu-win">The computer moves first.</div>' :
            '<div class="overlay-result tie">Tied. Rolling again.</div>';

        showOverlay(`
            <div class="overlay-box">
                <h2>Roll for first turn</h2>
                <p>Highest total starts. ${attempts > 1 ? `Reroll ${attempts - 1}.` : 'Your starting dice also set your first damage.'}</p>
                <div class="roll-compare">
                    <div class="roll-side player">
                        <div class="label">You</div>
                        <div class="dice-row" id="first-roll-player"></div>
                        <div class="total-val">${playerTotal}</div>
                    </div>
                    <div class="vs-text">vs</div>
                    <div class="roll-side cpu">
                        <div class="label">Computer</div>
                        <div class="dice-row" id="first-roll-cpu"></div>
                        <div class="total-val">${cpuTotal}</div>
                    </div>
                </div>
                <div class="first-roll-result">${resultMsg}</div>
            </div>
        `);
        SFX.roll();
        const tumbleDur = fastAutoMode ? 350 : 1000;
        await Promise.all([
            tumbleDice(document.getElementById('first-roll-player'), playerVals, 'player', { dur: tumbleDur, spread: 0.35, archetypes: game.playerDice.map(d => d.archetype) }),
            tumbleDice(document.getElementById('first-roll-cpu'), cpuVals, 'cpu', { dur: tumbleDur, spread: 0.35, from: 'right', archetypes: game.cpuDice.map(d => d.archetype) }),
        ]);
        document.querySelectorAll('.roll-side .total-val, .first-roll-result').forEach(e => e.classList.add('shown'));
        await delay(playerTotal === cpuTotal ? 1000 : 1300);
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
                <div class="overlay-box" style="max-width:460px;">
                    <div class="overlay-icon teal">${iconSVG('dice')}</div>
                    <h2>You go first</h2>
                    <p>Each die moves up to its roll and hits for its face value. Click a teal die to begin.</p>
                    <div class="overlay-actions"><button class="clay-btn teal big" onclick="hideOverlay(); beginPlayerTurn();">Roll my dice</button></div>
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
                <div class="overlay-box" style="max-width:460px;">
                    <div class="overlay-icon berry">${iconSVG('dice')}</div>
                    <h2>The computer goes first</h2>
                    <p>Watch where it moves. Your dice roll as soon as its turn ends.</p>
                    <div class="overlay-actions"><button class="clay-btn berry big" onclick="hideOverlay(); beginCpuTurn();">Continue</button></div>
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
            if (d.frozen === 0) d.petrified = false;
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
                        if (actual > 0) fxHeal(td);
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

    // Passive grant card every 10 waves (Samurai -> Dash, Defender -> Immunity) for both teams
    if (game.wave % 10 === 0) {
        for (const team of ['player', 'cpu']) {
            const teamDice = aliveDice(team);
            if (teamDice.length === 0) continue;
            const hand = team === 'player' ? game.playerHand : game.cpuHand;
            const hasSamurai = teamDice.some(d => getSkillLevel(d, 'dashMastery') > 0);
            const hasDefender = teamDice.some(d => getSkillLevel(d, 'defenderMastery') > 0);
            const maxH = getMaxHandSize(team);

            if (hasSamurai && hand.length < maxH) {
                const dashCard = CARD_DEFS.find(c => c.id === 'dash');
                if (dashCard) {
                    hand.push({ ...dashCard });
                    addFloatingText(team === 'player' ? '🗡️ Free Dash!' : '🔴 CPU: Free Dash!', teamDice[0].q, teamDice[0].r, '#c084fc', 16);
                }
            }
            if (hasDefender && hand.length < maxH) {
                const concealCard = CARD_DEFS.find(c => c.id === 'conceal');
                if (concealCard) {
                    hand.push({ ...concealCard });
                    addFloatingText(team === 'player' ? '🔰 Free Immunity!' : '🔴 CPU: Free Immunity!', teamDice[0].q, teamDice[0].r, '#a78bfa', 16);
                }
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
                    spawnParticles(hexScreen(emptyHex.q, emptyHex.r).x, hexScreen(emptyHex.q, emptyHex.r).y + HEX_SIZE * 0.2, '#7F5A38', 12, 2, 700, 3);
                    game.zombies.push({
                        bornAt: performance.now() + i * 150,
                        id: Math.random(),
                        q: emptyHex.q,
                        r: emptyHex.r,
                        team: d.team,
                        ownerId: d.id,
                        damage: baseZombieDmg,
                        wavesLeft: wavesLeft
                    });
                    spawnParticles(hexToPixel(emptyHex.q, emptyHex.r).x + gridCenterX, hexToPixel(emptyHex.q, emptyHex.r).y + gridCenterY, '#10b981', 12, 2, 600);
                }
                addFloatingText(`🧟 +${count} Zombie!`, d.q, d.r, '#10b981', 18);
            }
        }
    }

    // Telekinator Hypno Steal (both teams): steal an enemy card, or destroy it if own hand is full
    if (game.wave % 3 === 0) {
        for (const d of [...aliveDice('player'), ...aliveDice('cpu')]) {
            const hypnoLvl = getSkillLevel(d, 'hypno');
            if (hypnoLvl > 0 && d.frozen === 0) {
                const chance = hypnoLvl === 1 ? 0.4 : 0.7;
                const ownHand = d.team === 'player' ? game.playerHand : game.cpuHand;
                const enemyHand = d.team === 'player' ? game.cpuHand : game.playerHand;
                if (enemyHand.length > 0 && Math.random() < chance) {
                    const [stolen] = enemyHand.splice(Math.floor(Math.random() * enemyHand.length), 1);
                    if (ownHand.length < getMaxHandSize(d.team)) {
                        ownHand.push(stolen);
                        addFloatingText(`🔮 Hypno Steal: ${stolen.name}!`, d.q, d.r, '#c084fc', 18);
                    } else {
                        addFloatingText(`🔮 Hypno Destroyed: ${stolen.name}!`, d.q, d.r, '#c084fc', 18);
                    }
                    addCombatLog(`${d.icon} ${d.id.toUpperCase()} Hypno ${ownHand.includes(stolen) ? 'stole' : 'destroyed'} an enemy ${stolen.name} card!`, '🔮', '#c084fc');
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
                        hand.push({ ...healCard, name: 'Heal Pill', fromDoctorId: d.id });
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

    // Arena events come faster late in the match and stack with whatever is still on the board
    updateEventBadge();
    if (isBlitzWave(game.wave)) {
        const frenzy = game.wave > BLITZ_EVERY_WAVE_AFTER;
        const wrap = document.getElementById('canvas-wrapper');
        const brutal = isBrutalWave(game.wave);
        if (wrap) { wrap.classList.toggle('frenzy', frenzy && !brutal); wrap.classList.toggle('brutal', brutal); }
        if (typeof BGM !== 'undefined') BGM.bpm = brutal ? 120 : frenzy ? 112 : game.wave >= 30 ? 100 : 92;
        if (game.wave === BRUTAL_WAVE) {
            showBlitzAnnouncement('Brutal arena', 'Every event now covers 50% more tiles, hits twice as hard, and traps last 2 waves longer.');
            SFX.blitz();
            await delay(2600);
        }
        if (game.wave === BLITZ_EVERY_WAVE_AFTER + 1) {
            showBlitzAnnouncement('Final frenzy', 'From now on the arena changes every single wave until someone wins.');
            SFX.blitz();
            await delay(2400);
        }
        await triggerArenaBlitz();
    }

    if ((game.wave - 1) % UPGRADE_INTERVAL === 0 && game.wave > 1) {
        await triggerRoguelikeUpgrade();
    }
}

async function handleTurnEndSequence(finishedTeam) {
    // Guard against double turn-end (e.g. skill callback + end-of-turn flow, or timer racing an action)
    if (game.phase === 'GAME_OVER' || game.turnEnding || game.currentTurn !== finishedTeam) return;
    game.turnEnding = true;
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

    SFX.attack();
    const p = hexToPixel(nearestEnemy.q, nearestEnemy.r);
    spawnParticles(p.x + gridCenterX, p.y + gridCenterY, '#a855f7', 20, 3, 700);

    // Apply indirect damage with Aegis protection
    fxBolt(mageDie, nearestEnemy);
    if (isCrit) fxImpact(nearestEnemy, '#E7DDFF', true);
    await delay(170);
    const actualDmg = applyIndirectDamage(nearestEnemy, zapDmg, isCrit ? '⚡💥 CRIT ZAP' : '⚡ ZAP', '#c084fc');
    creditDamageDealt(mageDie, actualDmg);

    updateDiceHP();
    updateSkillButtons();
    if (checkWin()) return true;
    return true;
}

async function triggerPlayerMageZap() {
    if (game.phase !== 'PLAYER_TURN' || game.currentTurn !== 'player') return;
    const playerMage = aliveDice('player').find(d => d.archetype === 'mage' || getSkillLevel(d, 'zap') > 0);
    if (!playerMage || (playerMage.zapStacks || 0) <= 0 || !canUseActiveSkill(playerMage)) return;

    game.phase = 'PLAYER_ANIMATING';
    await executeZapSkill(playerMage);
    if (game.phase !== 'GAME_OVER') { game.phase = 'PLAYER_TURN'; updateSkillButtons(); }
}

// Frozen or rooted dice cannot use active skills
function canUseActiveSkill(die) {
    return !!die && die.hp > 0 && die.frozen === 0 && die.trapped === 0;
}

// After a player skill that may consume the last moves: end the turn or return control
function finishPlayerSkillAction() {
    if (game.phase === 'GAME_OVER') return;
    game.phase = 'PLAYER_TURN';
    if (totalMovesLeft('player') <= 0) {
        setButtons(false, false);
        matchTimeout(() => handleTurnEndSequence('player'), 600);
    } else {
        setButtons(true, false);
    }
}

// Archer Long Shot Mastery: Ranged attack (can move first!)
async function executeArcherLongShot(archerDie, targetEnemy) {
    if (!archerDie || !targetEnemy || archerDie.hasAttackedThisTurn || !canUseActiveSkill(archerDie)) return false;
    if (targetEnemy.hp <= 0 || targetEnemy.concealed) return false;
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
    const travel = 240 + dist * 35;
    fxArrow(archerDie, targetEnemy, travel);
    await delay(travel);

    if (Math.random() < missRate) {
        addFloatingText(`🏹 Missed! (${Math.round(missRate * 100)}%)`, targetEnemy.q, targetEnemy.r, '#94a3b8', 18);
        addCombatLog(`${archerDie.icon} ${archerDie.id.toUpperCase()} Long Shot missed ${targetEnemy.icon} ${targetEnemy.id.toUpperCase()} (${Math.round(missRate * 100)}% miss)!`, '🏹', '#94a3b8');
    } else {
        const effDmg = getDieEffectiveDamage(archerDie);
        SFX.attack();
        const p = hexToPixel(targetEnemy.q, targetEnemy.r);
        spawnParticles(p.x + gridCenterX, p.y + gridCenterY, '#38bdf8', 18, 3, 700);
        addCombatLog(`${archerDie.icon} ${archerDie.id.toUpperCase()} Long Shot hit ${targetEnemy.icon} ${targetEnemy.id.toUpperCase()} (${effDmg} DMG before shields)!`, '🏹', '#38bdf8');

        const actualDmg = applyIndirectDamage(targetEnemy, effDmg, '🏹 Long Shot', '#38bdf8');
        creditDamageDealt(archerDie, actualDmg);
    }

    // Turn ending is handled by the caller (player target handler / CPU turn loop)
    updateDiceHP();
    updateSkillButtons();
    checkWin();
    return true;
}

function triggerPlayerArcherShot() {
    if (game.phase !== 'PLAYER_TURN' || game.currentTurn !== 'player') return;
    const archer = aliveDice('player').find(d => (d.archetype === 'archer' || getSkillLevel(d, 'longShot') > 0) && !d.hasAttackedThisTurn && canUseActiveSkill(d));
    if (!archer) return;

    game.selectedDie = null;
    game.reachable = null;
    game.parents = null;
    game.archerSource = archer;
    game.phase = 'PLAYER_ARCHER_TARGET';
    setMessage('🏹 Long Shot: Click an enemy die to fire from distance.');
    setButtons(false, false);
}

// Piercer Pivot Strike: Deals 8 area damage (1 hex radius at Lvl 1, 2 hex radius at Lvl 2)
async function executePiercerPivot(piercerDie) {
    if (!piercerDie || piercerDie.hasAttackedThisTurn || !canUseActiveSkill(piercerDie)) return false;
    const pivotLvl = getSkillLevel(piercerDie, 'pivot');
    if (pivotLvl <= 0) return false;

    piercerDie.hasAttackedThisTurn = true;
    piercerDie.moveAllowance = 0;
    setCooldownWave('pivotUsedWave', piercerDie.team);
    game.pivotPreview = false;
    game.pivotPiercer = null;

    const enemyTeam = piercerDie.team === 'player' ? 'cpu' : 'player';
    const hitHexes = typeof getPivotHexes === 'function' ? getPivotHexes(piercerDie.q, piercerDie.r, pivotLvl) : [];
    const hitEnemies = aliveDice(enemyTeam).filter(d => !d.concealed && hitHexes.some(n => n.q === d.q && n.r === d.r));
    if (piercerDie.team === 'player') game.phase = 'PLAYER_ANIMATING';
    fxSweep(piercerDie, pivotLvl >= 2 ? 2 : 1);
    await delay(260);

    SFX.attack();
    const p = hexToPixel(piercerDie.q, piercerDie.r);
    spawnParticles(p.x + gridCenterX, p.y + gridCenterY, '#f59e0b', 24, 4, 800, 4);

    if (hitEnemies.length === 0) {
        addFloatingText('🎯 Pivot Swung (No targets in range)', piercerDie.q, piercerDie.r, '#94a3b8', 16);
        addCombatLog(`${piercerDie.icon} ${piercerDie.id.toUpperCase()} swung Pivot Strike, but no enemies were in range.`, '🎯', '#f59e0b');
    } else {
        for (const target of hitEnemies) {
            if (target.hp <= 0) continue; // may have died from a chained Explode
            let dmg = Math.max(1, 8 - getToughnessReduction(target));
            if (target.halfDamage > 0) dmg = Math.ceil(dmg / 2);

            addCombatLog(`${piercerDie.icon} ${piercerDie.id.toUpperCase()} Pivot Strike hit ${target.icon} ${target.id.toUpperCase()} for ${dmg} DMG!`, '🎯', '#f59e0b');
            const ep = hexToPixel(target.q, target.r);
            spawnParticles(ep.x + gridCenterX, ep.y + gridCenterY, '#f59e0b', 15, 2, 600);
            dealDirectDamage(target, dmg, piercerDie, '🎯 Pivot!', '#f59e0b');
        }
    }

    // Turn ending is handled by the caller (player pivot handlers / CPU turn loop)
    updateDiceHP();
    updateSkillButtons();
    checkWin();
    return true;
}

async function triggerPlayerPiercerPivot() {
    if (game.phase !== 'PLAYER_TURN' || game.currentTurn !== 'player') return;
    const piercer = aliveDice('player').find(d => getSkillLevel(d, 'pivot') > 0 && !d.hasAttackedThisTurn && canUseActiveSkill(d));
    if (!piercer) return;
    const isPivotReady = (game.wave - getCooldownWave('pivotUsedWave', 'player')) >= 3;
    if (!isPivotReady) return;

    if (!game.pivotPreview) {
        game.pivotPreview = true;
        game.pivotPiercer = piercer;
        setMessage('🎯 Pivot Area Previewed! Click Pivot button or highlighted area to strike.');
        updateSkillButtons();
    } else {
        game.pivotPreview = false;
        await executePiercerPivot(piercer);
        finishPlayerSkillAction();
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
    const tele = aliveDice('player').find(d => getSkillLevel(d, 'mindControl') > 0 && canUseActiveSkill(d));
    if (!tele) return;
    const isMindReady = (game.wave - getCooldownWave('mindControlUsedWave', 'player')) >= 5;
    if (!isMindReady) return;

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
    if (game.phase === 'GAME_OVER') return;
    game.phase = 'PLAYER_ROLL';
    game.currentTurn = 'player';
    game.turnEnding = false;
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
        d.bonusAttackReady = false;
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
        const psy = rollPsychicPush(teleDie);
        const chance = psy.chance;
        if (psy.hit) {
            const cpuAlive = aliveDice('cpu').filter(cd => !cd.concealed);
            const pushable = [...cpuAlive, ...aliveDice('player')];
            if (pushable.length > 0) {
                SFX.powerUp();
                game.psychicAura = true;
                if (canvasWrap) canvasWrap.classList.add('aura-psychic');
                addFloatingText(psy.guaranteed ? 'Guaranteed Psychic Push!' : 'Psychic Push Triggered!', teleDie.q, teleDie.r, '#c084fc', 22);
                if (psy.guaranteed) addCombatLog('Telekinator focused: Psychic Push guaranteed after a bad-luck streak', '', '#8468C4');
                await delay(700);
                game.psychicSource = teleDie;
                game.phase = 'PLAYER_PSYCHIC_ENEMY';

                // Fast Auto bot resolves the push itself instead of waiting for clicks
                if (fastAutoMode) {
                    const victim = (cpuAlive.length ? cpuAlive : pushable)[Math.floor(Math.random() * (cpuAlive.length || pushable.length))];
                    handlePsychicEnemySelect(victim.q, victim.r);
                    const empties = allHexes.filter(h => !getDieAt(h.q, h.r) && !isBlocked(h.q, h.r));
                    const tile = empties[Math.floor(Math.random() * empties.length)];
                    if (tile) await handlePsychicTileSelect(tile.q, tile.r);
                    if (game.phase === 'PLAYER_PSYCHIC_TILE' || game.phase === 'PLAYER_PSYCHIC_ENEMY') game.phase = 'PLAYER_TURN';
                    if (game.phase === 'PLAYER_TURN') matchTimeout(playerAutoBotTurn, 200);
                    return;
                }

                setMessage('Psychic Push: pick any die, yours or an enemy, then an empty tile. Deselect skips it.');
                setButtons(false, true);
                return;
            }
        } else {
            addFloatingText(`Psychic Push missed (${Math.round(chance * 100)}%)`, teleDie.q, teleDie.r, '#94a3b8', 14);
            addCombatLog(`Psychic Push missed (${Math.round(chance * 100)}%), ${psychicPityText(psy.left)}`, '', '#94a3b8');
            updateDiceHP();
        }
    }

    game.phase = 'PLAYER_TURN';
    setMessage(`Your turn. Pick one of your dice to move.`);
    showTip('select');
    if (document.getElementById('tray-skills') && !document.getElementById('tray-skills').classList.contains('empty')) showTip('skills');
    if (game.wave >= 2) showTip('enemyInfo');
    setButtons(true, false);

    if (fastAutoMode) {
        matchTimeout(playerAutoBotTurn, 200);
    }
}

function selectDie(die) {
    clearPreview();
    if (die.frozen > 0) {
        setMessage(`${archName(die.archetype)} is ${die.petrified ? 'turned to stone' : 'frozen'}. It can move again in ${die.frozen} turn${die.frozen > 1 ? 's' : ''}.`);
        return;
    }
    if (die.trapped > 0) {
        setMessage(`${archName(die.archetype)} is rooted for ${die.trapped} more turn${die.trapped>1?'s':''}.`);
        return;
    }
    if (die.moveAllowance <= 0) {
        setMessage(`${archName(die.archetype)} has no moves left. Pick another die.`);
        return;
    }

    game.selectedDie = die;
    const { reachable, parents } = findReachable(die);
    game.reachable = reachable;
    game.parents = parents;

    if (reachable.size === 0) {
        setMessage(`${archName(die.archetype)} is boxed in. Pick another die.`);
        game.selectedDie = null;
        game.reachable = null;
        game.parents = null;
        setButtons(true, false);
        return;
    }

    const attacks = [...reachable.values()].filter(v => v.isAttack);
    completeTip('select');
    showTip('moveAttack');
    const effDmg = getDieEffectiveDamage(die);
    setMessage(`${archName(die.archetype)}: ${die.moveAllowance} ${die.moveAllowance === 1 ? 'move' : 'moves'}, hits for ${effDmg}${die.damageMultiplier>1?' ×'+die.damageMultiplier:''}. ${attacks.length ? `${attacks.length} enemy in reach.` : 'Click a lit tile to move.'}`);
    setButtons(true, true);
}

function deselectDie() {
    if (game.phase === 'PLAYER_PSYCHIC_ENEMY' || game.phase === 'PLAYER_PSYCHIC_TILE') { skipPsychicPush(); return; }
    clearPreview();
    if (game.activeCard) {
        cancelCard();
        return;
    }
    game.selectedDie = null;
    game.reachable = null;
    game.parents = null;
    setMessage(`Pick one of your dice to move.`);
    setButtons(true, false);
}

// Handle Necromancer Undead split upon death
function handleUndeadSplit(deadDie) {
    const undeadLvl = getSkillLevel(deadDie, 'undead');
    if (undeadLvl > 0 && !deadDie.undeadTriggered) {
        deadDie.undeadTriggered = true;
        const splitHp = undeadLvl === 1 ? 10 : undeadLvl === 2 ? 20 : 30;

        // Create 2 split dice (place the first before searching for the second so they never share a hex)
        const teamDiceArray = deadDie.team === 'player' ? game.playerDice : game.cpuDice;
        const makeSplit = (suffix, hex) => {
            const sub = createDie(`${deadDie.id}_${suffix}`, hex.q, hex.r, deadDie.team, 'necromancer', true);
            sub.hp = splitHp;
            sub.maxHp = splitHp;
            sub.skills = JSON.parse(JSON.stringify(deadDie.skills));
            sub.undeadTriggered = true;
            teamDiceArray.push(sub);
            return sub;
        };
        const sub1 = makeSplit('a', findNearestEmptyHex(deadDie.q, deadDie.r));
        makeSplit('b', findNearestEmptyHex(sub1.q, sub1.r));

        addFloatingText(`💀 UNDEAD SPLIT! (${splitHp} HP each)`, deadDie.q, deadDie.r, '#10b981', 20);
        { const p = dieFxPos(deadDie); spawnParticles(p.x, p.y, '#B8F28A', 22, 3, 900, 3); fxRing(p.x, p.y + HEX_SIZE * 0.3, '#B8F28A', HEX_SIZE * 1.8, 700, 5); }
        addCombatLog(`💀 ${deadDie.icon} ${deadDie.id.toUpperCase()} split into 2 Undead dice (${splitHp} HP each)!`, '💀', '#10b981');
        SFX.powerUp();
        return true;
    }
    return false;
}

// Angel Revive: once per match per Angel, a living Angel revives a destroyed teammate
function tryAngelRevive(deadDie) {
    if (deadDie.isCloneDie) return false;
    const angel = aliveDice(deadDie.team).find(td => td !== deadDie && getSkillLevel(td, 'revive') > 0 && !td.reviveUsed);
    if (!angel) return false;

    const healAmount = getSkillLevel(angel, 'revive') * 15;
    angel.reviveUsed = true;
    deadDie.hp = Math.min(deadDie.maxHp || healAmount, healAmount);
    deadDie.revived = true;
    deadDie._deathHandled = false;
    angel.totalHealDone = (angel.totalHealDone || 0) + deadDie.hp;
    if (angel.team === 'player' && game.stats) {
        game.stats.healDone[angel.id] = (game.stats.healDone[angel.id] || 0) + deadDie.hp;
        game.stats.healDone.total += deadDie.hp;
        updateStatsDisplay();
    }

    // Move off the hex if something else stands on it (e.g. the attacker that stepped in)
    const occupant = allDice().find(d => d !== deadDie && d.hp > 0 && d.q === deadDie.q && d.r === deadDie.r);
    if (occupant) {
        const emptyHex = findNearestEmptyHex(deadDie.q, deadDie.r);
        startSlide(deadDie, deadDie.q, deadDie.r, 380, 0.6);
        deadDie.q = emptyHex.q;
        deadDie.r = emptyHex.r;
        deadDie.movedThisWave = true;
    }
    fxLevelUp(deadDie);
    addFloatingText(`😇 REVIVED (${deadDie.hp} HP)!`, deadDie.q, deadDie.r, '#fbbf24', 20);
    addCombatLog(`😇 ${angel.icon} ${angel.id.toUpperCase()} revived ${deadDie.icon} ${deadDie.id.toUpperCase()} with ${deadDie.hp} HP!`, '😇', '#fbbf24');
    SFX.heal();
    return true;
}

// Central on-death handler for every damage source: Rage Explode, Necromancer Undead split, Angel Revive
function handleDieDeath(die) {
    if (!die || die.hp > 0 || die._deathHandled) return;
    die.hp = 0;
    die._deathHandled = true;
    die.moveAllowance = 0;

    addFloatingText('💀 DESTROYED!', die.q, die.r + 0.5, '#ff2244', 16);
    fxShatter(die);
    addCombatLog(`💀 ${die.icon} ${die.id.toUpperCase()} was destroyed!`, '💀', '#ef4444');
    SFX.destroy();
    if (game.selectedDie === die) {
        game.selectedDie = null;
        game.reachable = null;
        game.parents = null;
    }

    // Rage Explode: damage every die of the opposing team
    const explodeLvl = getSkillLevel(die, 'explode');
    if (explodeLvl > 0) {
        const expDmg = explodeLvl === 1 ? 8 : 15;
        const enemyTeam = die.team === 'player' ? 'cpu' : 'player';
        addFloatingText(`💥 EXPLODE -${expDmg}!`, die.q, die.r, '#ef4444', 24);
        fxExplosion(die);
        addCombatLog(`💥 ${die.icon} ${die.id.toUpperCase()} exploded for ${expDmg} DMG to all enemy dice!`, '💥', '#ef4444');
        for (const target of aliveDice(enemyTeam)) {
            dealDirectDamage(target, expDmg, die, '💥', '#ef4444');
        }
    }

    if (die.isCloneDie) return;
    if (handleUndeadSplit(die)) return;
    tryAngelRevive(die);
}

// Shared melee resolution for player & CPU once the attacker has stepped onto the enemy hex
// Pure melee damage calculation, shared by the real attack and the attack preview
function computeMeleeDamage(die, enemyDie, dist) {
    const face = getDieEffectiveDamage(die);
    const mult = die.damageMultiplier || 1;
    let raw = face * mult;

    // Ninja Momentum Passive (+1 DMG per remaining move after attacking, max +5 DMG)
    let momentum = 0;
    if (getSkillLevel(die, 'momentum') > 0 || die.archetype === 'ninja') {
        momentum = Math.min(5, Math.max(0, die.moveAllowance - dist));
        raw += momentum;
    }

    // Piercer Tank Killer (+10%/15%/20%/25% of target enemy HP)
    let tankKiller = 0;
    const tankKillerLvl = getSkillLevel(die, 'tankKiller');
    if (tankKillerLvl > 0) {
        const pct = tankKillerLvl === 1 ? 0.10 : tankKillerLvl === 2 ? 0.15 : tankKillerLvl === 3 ? 0.20 : 0.25;
        tankKiller = Math.max(1, Math.round(enemyDie.hp * pct));
        raw += tankKiller;
    }

    const toughness = getToughnessReduction(enemyDie);
    raw = Math.max(1, raw - toughness);
    const halved = enemyDie.halfDamage > 0;
    const damage = halved ? Math.ceil(raw / 2) : raw;
    return { damage, face, mult, momentum, tankKiller, toughness, halved };
}

function resolveMeleeAttack(die, enemyDie, info, tq, tr, prevQ, prevR) {
    const calc = computeMeleeDamage(die, enemyDie, info.dist);
    if (calc.momentum > 0) addFloatingText(`🥷 +${calc.momentum} Momentum DMG!`, die.q, die.r, '#60a5fa', 16);
    if (calc.tankKiller > 0) addFloatingText(`🎯 Tank Killer +${calc.tankKiller} DMG!`, die.q, die.r, '#f59e0b', 16);
    const damage = calc.damage;
    const teamTag = die.team === 'cpu' ? '🔴 CPU ' : '';

    // A follow-up attack spends the permission that allowed it (one extra attack per grant)
    if (die.hasAttackedThisTurn) {
        if (die.bonusAttackReady) die.bonusAttackReady = false;
        else if (die.attackAgainActive) die.attackAgainActive = false;
    }
    die.hasAttackedThisTurn = true;
    SFX.attack();
    addFloatingText(`-${damage}`, tq, tr, '#ff4466', 22);
    if (die.damageMultiplier > 1) addFloatingText(`×${die.damageMultiplier}!`, tq, tr - 0.4, '#f59e0b', 14);
    addCombatLog(`${teamTag}${die.icon} ${die.id.toUpperCase()} attacked ${enemyDie.icon} ${enemyDie.id.toUpperCase()} for ${damage} DMG!`, '⚔️', '#ff4466');
    const p = hexToPixel(tq, tr);
    spawnParticles(p.x + gridCenterX, p.y + gridCenterY, '#ff4466', 15, 3, 600, 3);

    const attackedId = enemyDie.id;
    const thornsLvl = getSkillLevel(enemyDie, 'thorns');
    dealDirectDamage(enemyDie, damage, die);
    fxImpact(enemyDie, '#FFF1C9', damage >= 10);
    if (damage >= 12 && typeof shakeBoard === 'function') shakeBoard(260);

    // Defender Thorns reflect on attacker: 1 / 3 / 5
    if (thornsLvl > 0) {
        const reflectDmg = thornsLvl === 1 ? 1 : thornsLvl === 2 ? 3 : 5;
        dealDirectDamage(die, reflectDmg, enemyDie, '🛡️ Thorns', '#a8a29e');
    }

    // Dracula Lifesteal (only while the attacker is still alive)
    const healLvl = getSkillLevel(die, 'healOnAtk');
    if (healLvl > 0 && die.hp > 0) {
        if (die.antiHealTurns > 0) {
            addFloatingText(`🚫 Anti-Healed!`, die.q, die.r, '#ef4444', 14);
        } else {
            const healAmt = healLvl === 1 ? 2 : healLvl === 2 ? 3 : 5;
            const prevHp = die.hp;
            die.hp = Math.min(die.maxHp || MAX_HP, die.hp + healAmt);
            const actualHeal = die.hp - prevHp;
            die.totalHealDone = (die.totalHealDone || 0) + actualHeal;
            if (die.team === 'player' && game.stats && actualHeal > 0) {
                game.stats.healDone[die.id] = (game.stats.healDone[die.id] || 0) + actualHeal;
                game.stats.healDone.total += actualHeal;
                updateStatsDisplay();
            }
            addFloatingText(`+${healAmt} 🩸`, die.q, die.r, '#34d399', 16);
            fxHeal(die);
        }
    }

    // Dracula Bleed: refresh 3-turn duration; upgrade stacks if this attacker's level is higher
    const bleedLvl = getSkillLevel(die, 'bleed');
    if (bleedLvl > 0 && enemyDie.hp > 0) {
        const stacksToAdd = Math.min(3, bleedLvl);
        const wasBleeding = enemyDie.bleedTurns > 0 || enemyDie.bleedStacks > 0;
        enemyDie.bleedStacks = wasBleeding ? Math.min(3, Math.max(enemyDie.bleedStacks || 1, stacksToAdd)) : stacksToAdd;
        enemyDie.bleedSourceDieId = die.id;
        enemyDie.bleedSourceTeam = die.team;
        enemyDie.bleedTurns = 3;
        enemyDie.antiHealTurns = 3;
        if (enemyDie.team === 'player') showTip('bleed');
        { const p = dieFxPos(enemyDie); spawnParticles(p.x, p.y, '#B5304F', 10, 2, 700, 2.5); }
        if (wasBleeding) {
            addFloatingText(`🩸 Bleed Refreshed (${enemyDie.bleedStacks} stacks, 3 Turns)!`, enemyDie.q, enemyDie.r, '#ef4444', 16);
            addCombatLog(`${teamTag}${die.icon} ${die.id.toUpperCase()} refreshed Bleed duration (3 turns, ${enemyDie.bleedStacks} stacks) on ${enemyDie.icon} ${enemyDie.id.toUpperCase()}!`, '🩸', '#ef4444');
        } else {
            addFloatingText(`🩸 Bleed x${enemyDie.bleedStacks} (3 Turns)!`, enemyDie.q, enemyDie.r, '#ef4444', 16);
            addCombatLog(`${teamTag}${die.icon} ${die.id.toUpperCase()} inflicted Bleed x${enemyDie.bleedStacks} on ${enemyDie.icon} ${enemyDie.id.toUpperCase()} (3 turns)!`, '🩸', '#ef4444');
        }
    }

    // Surviving defender (not revived elsewhere) is knocked back to the attacker's previous hex
    if (enemyDie.hp > 0 && die.hp > 0 && enemyDie.q === tq && enemyDie.r === tr) {
        enemyDie.q = prevQ; enemyDie.r = prevR;
        startSlide(enemyDie, tq, tr, 300, 0.35);
        enemyDie.movedThisWave = true;
        triggerTileEffectOnDie(enemyDie);
        triggerTileEffectOnDie(die);
    }

    die.damageMultiplier = 1;
    die.moveAllowance = Math.max(0, die.moveAllowance - info.dist);
    if (die.hp <= 0) die.moveAllowance = 0;

    const quickLvl = getSkillLevel(die, 'quickDestruct');
    const quickChance = quickLvl === 1 ? 0.25 : quickLvl === 2 ? 0.35 : quickLvl === 3 ? 0.50 : 0;
    if (quickLvl > 0 && die.moveAllowance > 0 && Math.random() < quickChance) {
        die.attackAgainActive = true;
        addFloatingText('🥷 Quick Destruct!', die.q, die.r, '#60a5fa', 18);
    }

    if (die.attackAgainActive && die.moveAllowance > 0) {
        die.attackAgainActive = false;
        die.lastAttackedEnemyId = attackedId;
        die.bonusAttackReady = true;
    } else {
        die.moveAllowance = 0;
    }
}

// Walks the attacker up to the enemy and strikes. Returns false if the approach was interrupted
// (trap / vine root, death by bleed or hazard, bounce, target gone) so no "teleport" attack happens.
async function performMeleeAttack(die, path, info, tq, tr) {
    const movePath = path.slice(0, -1);
    if (movePath.length > 1) await animateMove(die, movePath);
    if (game.phase === 'GAME_OVER') return false;

    const enemyDie = getDieAt(tq, tr);
    const adjacent = hexDist(die.q, die.r, tq, tr) === 1;
    const canStrike = die.hp > 0 && die.trapped === 0 && die.frozen === 0 && adjacent &&
        enemyDie && enemyDie.team !== die.team && !enemyDie.concealed;
    if (!canStrike) {
        const stepsTaken = Math.max(0, movePath.length - 1);
        if (die.hp > 0 && die.trapped === 0 && stepsTaken > 0) {
            die.moveAllowance = Math.max(0, die.moveAllowance - stepsTaken);
        } else {
            die.moveAllowance = 0;
        }
        if (die.hp > 0) addFloatingText('⚠️ Attack interrupted!', die.q, die.r, '#fbbf24', 16);
        return false;
    }

    const prevQ = die.q, prevR = die.r;
    await animateMove(die, [{ q: die.q, r: die.r }, { q: tq, r: tr }]);
    if (game.phase === 'GAME_OVER') return false;
    if (die.hp <= 0 || enemyDie.hp <= 0) {
        // Attacker (or target) died from a hazard on the final step
        die.moveAllowance = 0;
        if (die.hp > 0 && die.q === tq && die.r === tr && enemyDie.hp > 0) {
            die.q = prevQ; die.r = prevR;
        }
        return false;
    }

    resolveMeleeAttack(die, enemyDie, info, tq, tr, prevQ, prevR);
    return true;
}

async function handlePlayerMove(tq, tr) {
    if (!game.reachable || !game.reachable.has(hKey(tq, tr))) return;
    if (game.phase !== 'PLAYER_TURN') return;
    clearPreview();
    completeTip('moveAttack');
    showTip('endTurn');

    const info = game.reachable.get(hKey(tq, tr));
    const die = game.selectedDie;
    const path = reconstructPath(game.parents, die.q, die.r, tq, tr);

    game.phase = 'PLAYER_ANIMATING';
    game.reachable = null;
    game.parents = null;
    setButtons(false, false);

    if (info.isAttack) {
        await performMeleeAttack(die, path, info, tq, tr);

        updateMoves();
        updateDiceHP();
        updateSkillButtons();
        await delay(600);

        if (checkWin()) return;

        game.selectedDie = null;

        if (die.hp > 0 && die.moveAllowance > 0) {
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
        if (game.phase === 'GAME_OVER') return;
        die.moveAllowance = Math.max(0, die.moveAllowance - info.dist);
        if (die.hp <= 0 || die.trapped > 0) die.moveAllowance = 0;

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
            if (die.hp > 0 && die.moveAllowance > 0) {
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
    game.phase = 'TURN_ENDING';
    clearPreview();
    completeTip('endTurn');
    game.selectedDie = null;
    game.reachable = null;
    game.parents = null;
    game.activeCard = null;
    game.cardTargets = [];
    game.pivotPreview = false;
    game.pivotPiercer = null;
    aliveDice('player').forEach(d => d.moveAllowance = 0);
    updateMoves();
    updateCardHand();
    setButtons(false, false);
    setMessage("Turn ended.");
    matchTimeout(() => handleTurnEndSequence('player'), 600);
}

// Psychic Push can move any die: an enemy out of position or an ally out of danger
function handlePsychicEnemySelect(q, r) {
    const die = getDieAt(q, r);
    const valid = die && die.hp > 0 && (die.team === 'player' || !die.concealed);
    if (valid) {
        game.psychicTargetEnemy = die;
        game.selectedDie = null;
        game.phase = 'PLAYER_PSYCHIC_TILE';
        setMessage(`Psychic Push: pick an empty tile for ${die.team === 'player' ? 'your' : 'the enemy'} ${archName(die.archetype)}, or tap another die.`);
        return true;
    }
    return false;
}

function skipPsychicPush() {
    game.psychicSource = null;
    game.psychicTargetEnemy = null;
    game.psychicAura = false;
    const canvasWrap = document.getElementById('canvas-wrapper');
    if (canvasWrap) canvasWrap.classList.remove('aura-psychic');
    game.phase = 'PLAYER_TURN';
    setMessage('Psychic Push skipped. Pick one of your dice to move.');
    setButtons(true, false);
}

async function handlePsychicTileSelect(q, r) {
    const enemy = game.psychicTargetEnemy;
    if (!enemy) return false;
    // tapping another die switches the push target
    const other = getDieAt(q, r);
    if (other && other !== enemy) return handlePsychicEnemySelect(q, r);

    if (isValidHex(q, r) && !getDieAt(q, r) && !isBlocked(q, r)) {
        game.phase = 'PLAYER_ANIMATING';
        const oldP = hexToPixel(enemy.q, enemy.r);
        const dist = hexDist(enemy.q, enemy.r, q, r);
        startSlide(enemy, enemy.q, enemy.r, 560, 1.0);
        enemy.q = q; enemy.r = r;
        enemy.movedThisWave = true;
        const newP = hexToPixel(q, r);

        SFX.swap();
        spawnParticles(oldP.x + gridCenterX, oldP.y + gridCenterY, '#c084fc', 18, 3, 600);
        spawnParticles(newP.x + gridCenterX, newP.y + gridCenterY, '#c084fc', 18, 3, 600);
        addFloatingText('🔮 Pushed!', q, r, '#c084fc', 20);
        if (game.psychicSource) fxBeam(game.psychicSource, enemy, '#B79CF2', 500);
        { const p = hexScreen(q, r); fxRing(p.x, p.y + HEX_SIZE * 0.3, '#B79CF2', HEX_SIZE * 1.5, 600, 5); }

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

        updateDiceHP();
        if (checkWin()) return true;
        await delay(600);
        if (game.phase === 'GAME_OVER') return true;

        game.phase = 'PLAYER_TURN';
        setMessage('Your turn. Pick one of your dice to move.');
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

        setCooldownWave('mindControlUsedWave', 'player');
        if (game.mindControlSource) fxBeam(game.mindControlSource, die, '#B79CF2', 800);
        { const p = dieFxPos(die); fxRing(p.x, p.y + HEX_SIZE * 0.3, '#B79CF2', HEX_SIZE * 1.6, 700, 5); }
        game.mindControlSource = null;

        // Roll fresh movement points for this claimed die so player can command it immediately!
        const rollVal = Math.floor(Math.random() * 6) + 1;
        die.turnRoll = rollVal;
        die.baseDamage = rollVal;
        die.moveAllowance = rollVal;
        die.hasAttackedThisTurn = false;
        die.lastAttackedEnemyId = null;
        die.attackAgainActive = false;
        die.bonusAttackReady = false;
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

async function handleArcherTargetSelect(q, r) {
    clearPreview();
    const enemy = getDieAt(q, r);
    if (enemy && enemy.team === 'cpu' && enemy.hp > 0 && !enemy.concealed && game.archerSource) {
        game.selectedDie = null;
        game.reachable = null;
        game.parents = null;
        const archer = game.archerSource;
        game.archerSource = null;
        game.phase = 'PLAYER_ANIMATING';
        await executeArcherLongShot(archer, enemy);
        if (game.phase === 'GAME_OVER') return true;
        setMessage('🏹 Arrow fired! Archer turn ended.');
        finishPlayerSkillAction();
        return true;
    }
    return false;
}

function renderGameOverStatsHTML(isWin) {
    const timeStr = formatClock(game.matchTimeSeconds);
    const startHp = gameSettings.startHp || 50;
    const diff = gameSettings.difficulty || 'medium';
    const diffLabel = diff.charAt(0).toUpperCase() + diff.slice(1);

    const teamBlock = (dice, title, dotCls) => {
        let dealt = 0, taken = 0, heal = 0;
        const rows = dice.map((d, i) => {
            dealt += d.totalDamageDealt || 0; taken += d.totalDamageTaken || 0; heal += d.totalHealDone || 0;
            return `
                <div class="game-over-die-item">
                    <span class="game-over-die-name">${classBadge(d.archetype, 'sm')}${dieDisplayName(d, i).name}</span>
                    <span class="game-over-stat-pills">
                        <span class="game-over-pill dmg" title="Damage dealt">${d.totalDamageDealt || 0}</span>
                        <span class="game-over-pill taken" title="Damage taken">${d.totalDamageTaken || 0}</span>
                        <span class="game-over-pill heal" title="HP healed">${d.totalHealDone || 0}</span>
                    </span>
                </div>`;
        }).join('');
        return `
            <div class="game-over-team-box">
                <div class="game-over-team-title">
                    <span style="display:inline-flex;align-items:center;gap:8px;"><span class="team-dot ${dotCls}"></span>${title}</span>
                    <span class="game-over-stat-pills">
                        <span class="game-over-pill dmg" title="Damage dealt">${dealt}</span>
                        <span class="game-over-pill taken" title="Damage taken">${taken}</span>
                        <span class="game-over-pill heal" title="HP healed">${heal}</span>
                    </span>
                </div>
                ${rows}
            </div>`;
    };

    return `
        <div class="overlay-box game-over-modal-box">
            <div class="overlay-icon ${isWin ? 'gold' : 'berry'}">${iconSVG(isWin ? 'trophy' : 'necromancer')}</div>
            <h2>${isWin ? 'Victory' : 'Defeat'}</h2>
            <p>${isWin ? 'Every enemy die has been knocked out.' : 'Your last die fell. The computer holds the arena.'}</p>

            <div class="game-over-match-summary">
                <span>Reached <b>wave ${game.wave}</b></span>
                <span>Match time <b>${timeStr}</b></span>
                <span><b>${startHp} HP</b>, ${diffLabel}</span>
            </div>

            <div class="game-over-stats-grid">
                ${teamBlock(game.playerDice || [], 'Your team', 'player')}
                ${teamBlock(game.cpuDice || [], 'Computer', 'cpu')}
            </div>
            <p style="font-size:0.8rem;margin-top:10px;">Gold is damage dealt, red is damage taken, teal is HP healed.</p>

            <div class="overlay-actions">
                <button class="clay-btn plain" onclick="hideOverlay(); quitToMainMenu();">${iconSVG('home')}Main menu</button>
                <button class="clay-btn teal" onclick="hideOverlay(); startGame();">${iconSVG('restart')}${isWin ? 'Play again' : 'Try again'}</button>
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
