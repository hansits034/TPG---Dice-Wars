// ==========================================================
// 11. ANIMATIONS & GAME LOOP / TURN CONTROLLER
// ==========================================================
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

function findNearestEmptyHex(q, r) {
    const neighbors = getNeighbors(q, r).filter(n => !getDieAt(n.q, n.r) && !isBlocked(n.q, n.r));
    if (neighbors.length > 0) return neighbors[Math.floor(Math.random() * neighbors.length)];
    const fallback = allHexes.find(h => !getDieAt(h.q, h.r) && !isBlocked(h.q, h.r));
    return fallback || { q, r };
}

async function animateMove(die, path) {
    if (path.length < 2) return;
    animatingDie = die;

    for (let i = 1; i < path.length; i++) {
        const from = hexToPixel(path[i - 1].q, path[i - 1].r);
        const to = hexToPixel(path[i].q, path[i].r);

        await new Promise(resolve => {
            const start = performance.now();
            const dur = 140;
            function step(now) {
                const t = Math.min((now - start) / dur, 1);
                const et = easeOutCubic(t);
                die.renderX = from.x + (to.x - from.x) * et;
                die.renderY = from.y + (to.y - from.y) * et;
                animRotation = t * Math.PI * 2;
                if (t < 1) requestAnimationFrame(step);
                else {
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

        // Check Bleed Move Distance (1 dmg per 3 tiles moved)
        if (die.bleedStacks > 0) {
            die.bleedMoveDistance = (die.bleedMoveDistance || 0) + 1;
            if (die.bleedMoveDistance % 3 === 0) {
                die.hp -= 1;
                die.totalDamageTaken = (die.totalDamageTaken || 0) + 1;
                die.damagedThisWave = true;
                if (die.hp < 0) die.hp = 0;
                addFloatingText('-1 🩸 Bleed', die.q, die.r, '#ef4444', 16);
                updateDiceHP();
                if (checkWin()) return;
            }
        }

        checkEventTilePickup(die);

        // Immediate tile hazard trigger (Burning, Vine, Bees, Zombies)
        triggerTileEffectOnDie(die);
        if (checkWin()) return;
        if (die.trapped > 0) break;
    }
    animatingDie = null;

    const occupant = getDieAt(die.q, die.r, true);
    if (occupant && occupant.id !== die.id && occupant.concealed) {
        const bounce = findNearestEmptyHex(die.q, die.r);
        die.q = bounce.q; die.r = bounce.r;
        addFloatingText('🌀 Bounced!', die.q, die.r, '#a78bfa', 16);
        SFX.move();
        triggerTileEffectOnDie(die);
    }
}

function rollDiceForUnit(die) {
    const maxVal = die.isSplit ? 3 : 6;
    return Math.floor(Math.random() * maxVal) + 1;
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
        if (d.frozen > 0) d.frozen--;
        if (d.trapped > 0) d.trapped--;
        if (d.antiHealTurns > 0) d.antiHealTurns--;
    }

    dice.forEach(d => {
        const healLvl = getSkillLevel(d, 'healAid');
        if (healLvl > 0 && d.hp > 0 && d.frozen === 0) {
            dice.forEach(td => {
                if (td.hp > 0) {
                    if (td.antiHealTurns > 0) {
                        addFloatingText(`🚫 Bleed Anti-Heal!`, td.q, td.r, '#ef4444', 14);
                    } else {
                        td.hp = Math.min(MAX_HP, td.hp + healLvl);
                        addFloatingText(`+${healLvl} 😇`, td.q, td.r, '#34d399', 16);
                    }
                }
            });
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

    for (const d of allDice()) {
        if (d.concealed > 0) d.concealed--;
        if (d.halfDamage > 0) d.halfDamage--;
        if (d.moveDebuff > 0) d.moveDebuff--;
        if (d.frozen > 0) {
            d.bleedStacks = 0; // Bleed vanishes when frozen
        } else if (d.bleedStacks > 0) {
            d.bleedStacks--;
        }
        d.cloneActive = false;
        // Reset damagedThisWave flag at start of wave
        d.damagedThisWave = false;
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
                addFloatingText('🛡️ Free Conceal!', pDice[0].q, pDice[0].r, '#a78bfa', 16);
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
                // Check if undead empowered
                const undeadLvl = getSkillLevel(d, 'undead');
                if (d.isSplit && undeadLvl > 0) {
                    undeadBoost = undeadLvl === 1 ? 2 : undeadLvl === 2 ? 3 : 4;
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

async function executeMagePoke(team, aliveUnits) {
    const enemyTeam = team === 'player' ? 'cpu' : 'player';
    const enemies = aliveDice(enemyTeam).filter(d => !d.concealed);
    if (enemies.length === 0) return;

    for (const die of aliveUnits) {
        const pokeLvl = getSkillLevel(die, 'poke');
        if (pokeLvl > 0 && die.frozen === 0) {
            const bonusDmg = pokeLvl === 1 ? 0 : pokeLvl === 2 ? 2 : pokeLvl === 3 ? 4 : 6;
            const rollVal = die.turnRoll || 1;
            let totalPokeDmg = rollVal + bonusDmg;

            // Check Focus skill (if not damaged this/previous wave)
            let isCrit = false;
            const focusLvl = getSkillLevel(die, 'focus');
            if (focusLvl > 0 && !die.damagedThisWave) {
                const critChance = focusLvl === 1 ? 0.35 : 0.60;
                if (Math.random() < critChance) {
                    isCrit = true;
                    totalPokeDmg *= 2;
                }
            }

            const targetEnemy = enemies[Math.floor(Math.random() * enemies.length)];
            targetEnemy.hp -= totalPokeDmg;
            targetEnemy.totalDamageTaken = (targetEnemy.totalDamageTaken || 0) + totalPokeDmg;
            targetEnemy.damagedThisWave = true;
            if (targetEnemy.hp < 0) targetEnemy.hp = 0;

            SFX.attack();
            const p = hexToPixel(targetEnemy.q, targetEnemy.r);
            spawnParticles(p.x + gridCenterX, p.y + gridCenterY, '#a855f7', 15, 3, 600);

            if (isCrit) {
                addFloatingText(`💥 CRIT POKE -${totalPokeDmg}!`, targetEnemy.q, targetEnemy.r, '#fbbf24', 22);
            } else {
                addFloatingText(`⚡ POKE -${totalPokeDmg}!`, targetEnemy.q, targetEnemy.r, '#c084fc', 18);
            }

            // Check Rage Back Stronger
            const enemyBackLvl = getSkillLevel(targetEnemy, 'backStronger');
            if (enemyBackLvl > 0 || targetEnemy.archetype === 'Rage') {
                const reqDmg = enemyBackLvl === 2 ? 9 : enemyBackLvl === 3 ? 7 : 10;
                const newBonus = Math.floor(targetEnemy.totalDamageTaken / reqDmg);
                if (newBonus > (targetEnemy.bonusDamageFromDamageTaken || 0)) {
                    const diff = newBonus - (targetEnemy.bonusDamageFromDamageTaken || 0);
                    targetEnemy.bonusDamageFromDamageTaken = newBonus;
                    addFloatingText(`😡 Rage +${diff} DMG!`, targetEnemy.q, targetEnemy.r, '#ef4444', 18);
                }
            }

            updateDiceHP();
            await delay(400);
            if (checkWin()) return;
        }
    }
}

async function beginPlayerTurn() {
    game.phase = 'PLAYER_ROLL';
    game.currentTurn = 'player';
    game.selectedDie = null;
    game.reachable = null;
    game.parents = null;
    game.lastAttackedId = null;

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
        d.baseDamage = vals[i]; // Damage dasar mengikuti mata dadu hasil kocokan turn ini!
        const flashLvl = getSkillLevel(d, 'flash');
        const flashBonus = flashLvl === 1 ? 1 : flashLvl === 2 ? 2 : flashLvl === 3 ? 4 : 0;
        d.moveAllowance = Math.max(0, vals[i] + flashBonus - d.moveDebuff);
        d.damageMultiplier = 1;
        d.attackAgainActive = false;
        d.lastAttackedEnemyId = null;
    });

    updateMoves();
    updateRollDisplay(vals, 'player');
    updateDiceHP();

    // Mage Poke Execution
    await executeMagePoke('player', alive);
    if (checkWin()) return;

    // Check Telekinator Psychic Push skill
    for (const d of alive) {
        const psychicLvl = getSkillLevel(d, 'psychic');
        if (psychicLvl > 0 && d.frozen === 0 && d.trapped === 0) {
            const chance = psychicLvl * 0.20;
            const roll = Math.random();
            if (roll < chance) {
                const cpuAlive = aliveDice('cpu').filter(cd => !cd.concealed);
                if (cpuAlive.length > 0) {
                    SFX.powerUp();
                    addFloatingText('🔮 Psychic Push Triggered!', d.q, d.r, '#c084fc', 20);
                    await delay(800);
                    game.psychicSource = d;
                    game.phase = 'PLAYER_PSYCHIC_ENEMY';
                    setMessage(`🔮 Psychic Push SUCCESS (${Math.round(chance*100)}% chance)! Click an enemy die to push.`);
                    setButtons(false, false);
                    return;
                }
            } else {
                addFloatingText(`🔮 Psychic Push Missed (${Math.round(chance*100)}%)`, d.q, d.r, '#94a3b8', 14);
            }
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
        const splitHp = undeadLvl === 1 ? 5 : undeadLvl === 2 ? 10 : 20;

        // Create 2 split dice
        const teamDiceArray = deadDie.team === 'player' ? game.playerDice : game.cpuDice;
        const empty1 = findNearestEmptyHex(deadDie.q, deadDie.r);
        const empty2 = findNearestEmptyHex(empty1.q, empty1.r);

        const subDie1 = createDie(`${deadDie.id}_a`, empty1.q, empty1.r, deadDie.team, 'necromancer', true);
        const subDie2 = createDie(`${deadDie.id}_b`, empty2.q, empty2.r, deadDie.team, 'necromancer', true);

        subDie1.hp = splitHp;
        subDie2.hp = splitHp;
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

        await animateMove(die, [{ q: die.q, r: die.r }, { q: tq, r: tr }]);

        // Calculate damage with Toughness reduction: -1 / -3 / -5
        const toughLvl = getSkillLevel(enemyDie, 'toughness');
        const toughRed = toughLvl === 1 ? 1 : toughLvl === 2 ? 3 : toughLvl === 3 ? 5 : 0;

        const attackerEffDmg = getDieEffectiveDamage(die);
        let rawDamage = Math.max(1, (attackerEffDmg * die.damageMultiplier) - toughRed);
        const damage = enemyDie.halfDamage > 0 ? Math.ceil(rawDamage / 2) : rawDamage;

        enemyDie.hp -= damage;
        enemyDie.totalDamageTaken += damage;
        enemyDie.damagedThisWave = true;
        SFX.attack();

        // Check Rage Back Stronger on enemy
        const enemyBackLvl = getSkillLevel(enemyDie, 'backStronger');
        if (enemyBackLvl > 0 || enemyDie.archetype === 'Rage') {
            const reqDmg = enemyBackLvl === 2 ? 9 : enemyBackLvl === 3 ? 7 : 10;
            const newBonus = Math.floor(enemyDie.totalDamageTaken / reqDmg);
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

            const dieBackLvl = getSkillLevel(die, 'backStronger');
            if (dieBackLvl > 0 || die.archetype === 'Rage') {
                const reqDmg = dieBackLvl === 2 ? 9 : dieBackLvl === 3 ? 7 : 10;
                const newBonus = Math.floor(die.totalDamageTaken / reqDmg);
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
            die.hp = Math.min(MAX_HP, die.hp + healAmt);
            addFloatingText(`+${healAmt} 🩸`, die.q, die.r, '#34d399', 16);
        } else if (healLvl > 0 && die.antiHealTurns > 0) {
            addFloatingText(`🚫 Anti-Healed!`, die.q, die.r, '#ef4444', 14);
        }

        // Dracula Bleed: adds stacks based on level (1/2/3, Max 3)
        const bleedLvl = getSkillLevel(die, 'bleed');
        if (bleedLvl > 0) {
            const stacksToAdd = bleedLvl === 1 ? 1 : bleedLvl === 2 ? 2 : 3;
            enemyDie.bleedStacks = Math.min(3, (enemyDie.bleedStacks || 0) + stacksToAdd);
            enemyDie.antiHealTurns = 1;
            addFloatingText(`🩸 Bleed x${enemyDie.bleedStacks}!`, enemyDie.q, enemyDie.r, '#ef4444', 16);
        }

        addFloatingText(`-${damage}`, tq, tr, '#ff4466', 22);
        if (die.damageMultiplier > 1) addFloatingText(`×${die.damageMultiplier}!`, tq, tr - 0.4, '#f59e0b', 14);

        const p = hexToPixel(tq, tr);
        spawnParticles(p.x+gridCenterX, p.y+gridCenterY, '#ff4466', 15, 3, 600, 3);

        if (enemyDie.hp <= 0) {
            enemyDie.hp = 0;
            addFloatingText('💀 DESTROYED!', tq, tr + 0.5, '#ff2244', 16);
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
                        enemyDie.hp = revLvl * 15;
                        enemyDie.revived = true;
                        const emptyHex = findNearestEmptyHex(enemyDie.q, enemyDie.r);
                        enemyDie.q = emptyHex.q;
                        enemyDie.r = emptyHex.r;
                        addFloatingText(`😇 REVIVED (${enemyDie.hp} HP)!`, enemyDie.q, enemyDie.r, '#fbbf24', 20);
                        SFX.heal();
                        break;
                    }
                }
            }
        } else {
            die.q = tq; die.r = tr;
            enemyDie.q = prevQ; enemyDie.r = prevR;
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
        enemy.q = q; enemy.r = r;
        const newP = hexToPixel(q, r);

        SFX.swap();
        spawnParticles(oldP.x + gridCenterX, oldP.y + gridCenterY, '#c084fc', 18, 3, 600);
        spawnParticles(newP.x + gridCenterX, newP.y + gridCenterY, '#c084fc', 18, 3, 600);
        addFloatingText('🔮 Pushed!', q, r, '#c084fc', 20);

        // Immediate tile hazard check when pushed
        triggerTileEffectOnDie(enemy);

        game.psychicSource = null;
        game.psychicTargetEnemy = null;
        await delay(600);

        game.phase = 'PLAYER_TURN';
        setMessage('Your turn! Click a green die to move.');
        setButtons(true, false);
        return true;
    }
    return false;
}

function checkWin() {
    const pAlive = aliveDice('player').length;
    const cAlive = aliveDice('cpu').length;

    if (cAlive === 0) {
        game.phase = 'GAME_OVER';
        stopTurnTimer();
        stopStopwatch();
        SFX.win();
        showOverlay(`
            <div class="overlay-box">
                <h2>🏆 VICTORY! 🏆</h2>
                <p style="color:var(--player);font-size:1.1rem;font-weight:700;margin:12px 0;">All enemy dice destroyed!</p>
                <p style="color:var(--text-dim);">You conquered the Hex Arena in Wave ${game.wave}!</p>
                <div style="display:flex;gap:12px;margin-top:16px;justify-content:center;flex-wrap:wrap;">
                    <button class="overlay-btn restart" onclick="hideOverlay(); startGame();">🔄 Play Again</button>
                    <button class="overlay-btn" style="background:linear-gradient(135deg, var(--cpu), #be123c);" onclick="hideOverlay(); quitToMainMenu();">🏠 Main Menu</button>
                </div>
            </div>
        `);
        return true;
    }
    if (pAlive === 0) {
        game.phase = 'GAME_OVER';
        stopTurnTimer();
        stopStopwatch();
        SFX.lose();
        showOverlay(`
            <div class="overlay-box">
                <h2>💀 DEFEAT 💀</h2>
                <p style="color:var(--cpu);font-size:1.1rem;font-weight:700;margin:12px 0;">All your dice were destroyed!</p>
                <p style="color:var(--text-dim);">The computer conquered the arena...</p>
                <div style="display:flex;gap:12px;margin-top:16px;justify-content:center;flex-wrap:wrap;">
                    <button class="overlay-btn restart" onclick="hideOverlay(); startGame();">🔄 Try Again</button>
                    <button class="overlay-btn" style="background:linear-gradient(135deg, var(--cpu), #be123c);" onclick="hideOverlay(); quitToMainMenu();">🏠 Main Menu</button>
                </div>
            </div>
        `);
        return true;
    }
    return false;
}
