// ==========================================================
// 14. CPU AI & 16. FAST AUTO MODE (BOT VS BOT)
// ==========================================================
let fastAutoMode = false;

function toggleFastAutoMode() {
    fastAutoMode = !fastAutoMode;
    const btn = document.getElementById('auto-test-btn');
    if (btn) {
        btn.classList.toggle('active', fastAutoMode);
        btn.innerHTML = `${iconSVG('fast')}<span>${fastAutoMode ? 'Auto play on' : 'Auto play'}</span>`;
    }
    if (fastAutoMode && game.phase === 'PLAYER_TURN' && game.currentTurn === 'player') {
        matchTimeout(playerAutoBotTurn, 200);
    }
}

// Shared card AI for the CPU and the player's Fast Auto bot.
// Returns true if the match ended while playing cards.
async function autoUseCards(team, stepDelay) {
    const hand = team === 'player' ? game.playerHand : game.cpuHand;
    if (hand.length === 0) return false;

    const enemyTeam = team === 'player' ? 'cpu' : 'player';
    const lowHp = (d, pct) => d.hp <= (d.maxHp || MAX_HP) * pct;
    const keepCards = ['heal', 'cure', 'conceal', 'aegis'];

    for (let i = hand.length - 1; i >= 0; i--) {
        if (i >= hand.length) continue;
        const card = hand[i];
        const alive = aliveDice(team);
        const enemies = aliveDice(enemyTeam).filter(d => !d.concealed);
        if (alive.length === 0) return checkWin();
        let used = false;

        if (card.id === 'heal') {
            const weak = alive.find(d => lowHp(d, 0.4) && d.antiHealTurns === 0);
            if (weak) { applyCardWithTarget(card, team, i, [weak]); used = true; }
        } else if (card.id === 'dmg2' || card.id === 'dmg3') {
            const canAttack = alive.some(d => d.frozen === 0 && d.trapped === 0 && d.moveAllowance > 0 &&
                [...findReachable(d).reachable.values()].some(v => v.isAttack));
            if (canAttack) { applyCard(card, team, i); used = true; }
        } else if (card.id === 'freeze') {
            const candidates = enemies.filter(d => d.frozen === 0);
            if (candidates.length > 0) {
                const strongest = candidates.reduce((a, b) => getDieEffectiveDamage(b) > getDieEffectiveDamage(a) ? b : a);
                applyCardWithTarget(card, team, i, [strongest]);
                used = true;
            }
        } else if (card.id === 'conceal') {
            const target = alive.find(d => lowHp(d, 0.3) && d.concealed === 0);
            if (target) { applyCardWithTarget(card, team, i, [target]); used = true; }
        } else if (card.id === 'sprint') {
            const best = alive.find(d => d.moveAllowance > 0 && d.frozen === 0 && d.trapped === 0);
            if (best) { applyCardWithTarget(card, team, i, [best]); used = true; }
        } else if (card.id === 'cure') {
            const debuffed = alive.find(d => d.frozen > 0 || d.trapped > 0 || d.bleedStacks > 0 || lowHp(d, 0.7));
            if (debuffed) { applyCardWithTarget(card, team, i, [debuffed]); used = true; }
        } else if (card.id === 'aegis') {
            const target = alive.find(d => (d.aegisShield || 0) < 15);
            if (target) { applyCardWithTarget(card, team, i, [target]); used = true; }
        } else if (card.id === 'bearTrap') {
            // Place the trap next to an enemy so it is likely to be stepped on
            const spots = allHexes.filter(h => !getDieAt(h.q, h.r) && !isBlocked(h.q, h.r) &&
                !game.eventTiles.has(hKey(h.q, h.r)) && !game.bearTraps.has(hKey(h.q, h.r)));
            spots.sort((a, b) => {
                const da = Math.min(...enemies.map(e => hexDist(a.q, a.r, e.q, e.r)), 99);
                const db = Math.min(...enemies.map(e => hexDist(b.q, b.r, e.q, e.r)), 99);
                return da - db;
            });
            if (spots.length > 0) { applyCardWithTarget(card, team, i, [spots[0]]); used = true; }
        } else if (card.id === 'clone') {
            const best = alive.reduce((a, b) => b.moveAllowance > a.moveAllowance ? b : a);
            if (best && alive.length < 5) { applyCardWithTarget(card, team, i, [best]); used = true; }
        } else if (card.id === 'atkAgain') {
            applyCard(card, team, i);
            used = true;
        } else if (card.id === 'dash') {
            let best = null;
            for (const d of alive) {
                if (!canUseActiveSkill(d)) continue;
                for (const dir of DIRS) {
                    const hits = computeDashPath(d, dir, team).hitEnemies.length;
                    if (hits > 0 && (!best || hits > best.hits)) best = { d, dir, hits };
                }
            }
            if (best) {
                await executeDash(best.d, best.dir, team, i);
                used = true;
            }
        } else if (card.id === 'swap') {
            // Pull a threatened, weak die out of danger by swapping with a healthy teammate
            const nearestEnemyDist = d => Math.min(...enemies.map(e => hexDist(d.q, d.r, e.q, e.r)), 99);
            const weak = alive.find(d => lowHp(d, 0.35) && nearestEnemyDist(d) <= 2 && d.frozen === 0);
            const healthy = weak && alive.filter(d => d !== weak && !lowHp(d, 0.6) && nearestEnemyDist(d) > nearestEnemyDist(weak))
                .sort((a, b) => nearestEnemyDist(b) - nearestEnemyDist(a))[0];
            if (weak && healthy) { applyCardWithTarget(card, team, i, [weak, healthy]); used = true; }
        } else if (card.id === 'block') {
            // Wall off a threatened, weak die
            const weak = alive.find(d => lowHp(d, 0.35) && enemies.some(e => hexDist(d.q, d.r, e.q, e.r) <= 3));
            if (weak) {
                const walls = getNeighbors(weak.q, weak.r).filter(h => !getDieAt(h.q, h.r) && !isBlocked(h.q, h.r) &&
                    !game.eventTiles.has(hKey(h.q, h.r))).slice(0, 4);
                if (walls.length > 0) { applyCardWithTarget(card, team, i, walls); used = true; }
            }
        }

        if (used) {
            await delay(stepDelay);
            if (checkWin()) return true;
        } else if (hand.length >= getMaxHandSize(team) && !keepCards.includes(card.id)) {
            // Free a slot instead of holding an unusable card forever
            hand.splice(i, 1);
        }
    }
    updateCardHand();
    return false;
}

async function playerAutoUseCards() {
    return autoUseCards('player', 300);
}

async function playerAutoBotTurn() {
    if (!fastAutoMode || game.phase !== 'PLAYER_TURN' || game.currentTurn !== 'player') return;

    await playerAutoUseCards();

    while (totalMovesLeft('player') > 0 && game.phase === 'PLAYER_TURN' && game.currentTurn === 'player') {
        const movableDice = aliveDice('player').filter(d => d.moveAllowance > 0 && d.frozen === 0 && d.trapped === 0);
        if (movableDice.length === 0) break;

        let moved = false;
        for (const die of movableDice) {
            selectDie(die);
            if (!game.reachable || game.reachable.size === 0) {
                deselectDie();
                continue;
            }

            const targets = [];
            for (const info of game.reachable.values()) {
                targets.push({ q: info.q, r: info.r, isAttack: info.isAttack, dist: info.dist });
            }

            const attackTarget = targets.find(t => t.isAttack);
            const target = attackTarget || targets[Math.floor(Math.random() * targets.length)];

            if (target) {
                moved = true;
                await handlePlayerMove(target.q, target.r);
                await delay(120);
                break;
            }
        }

        if (!moved) break;
    }

    if (fastAutoMode && game.phase === 'PLAYER_TURN' && game.currentTurn === 'player') {
        endTurn();
    }
}

async function beginCpuTurn() {
    if (game.phase === 'GAME_OVER') return;
    clearPreview();
    game.phase = 'CPU_TURN';
    game.currentTurn = 'cpu';
    game.turnEnding = false;
    game.selectedDie = null;
    game.reachable = null;
    game.lastAttackedId = null;

    tickStatusEffects('cpu');
    startTurnTimer();
    setButtons(false, false);
    setMessage("🔴 Computer is rolling...");

    await delay(500);
    const alive = aliveDice('cpu');
    const n = alive.length;
    if (n === 0) { checkWin(); return; }

    const vals = await animateRoll('cpu', alive);

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

    updateRollDisplay(vals, 'cpu');
    updateDiceHP();

    // CPU Mage Zap Skill Execution
    const cpuMage = alive.find(d => (d.archetype === 'mage' || getSkillLevel(d, 'zap') > 0) && (d.zapStacks || 0) > 0 && canUseActiveSkill(d));
    if (cpuMage) {
        const pAlive = aliveDice('player').filter(pd => !pd.concealed);
        if (pAlive.length > 0) {
            // Zap hits the NEAREST enemy for damage equal to that distance
            const nearestDist = Math.min(...pAlive.map(pd => hexDist(cpuMage.q, cpuMage.r, pd.q, pd.r)));
            // Fire Zap if at good range (distance >= 3) or at 2 stacks
            if (nearestDist >= 3 || cpuMage.zapStacks >= 2) {
                await executeZapSkill(cpuMage);
                await delay(500);
                if (checkWin()) return;
            }
        }
    }

    // CPU Telekinator Psychic Push (same 40% / 65% / 90% as the player, one roll per turn)
    const cpuPsychic = alive.find(d => getSkillLevel(d, 'psychic') > 0 && d.hp > 0 && d.frozen === 0 && d.trapped === 0);
    if (cpuPsychic) {
        const psychicLvl = getSkillLevel(cpuPsychic, 'psychic');
        const chance = psychicLvl === 1 ? 0.40 : psychicLvl === 2 ? 0.65 : 0.90;
        const pAlive = aliveDice('player').filter(pd => !pd.concealed);
        if (pAlive.length > 0 && Math.random() < chance) {
            const threatened = alive.filter(d => d.hp > 0 && d.hp <= (d.maxHp || MAX_HP) * 0.35 &&
                pAlive.some(p => hexDist(p.q, p.r, d.q, d.r) <= 1));
            let victim, emptyHex;
            if (threatened.length) {
                // pull its own weak die to the empty tile furthest from the player's dice
                victim = threatened[0];
                const spots = allHexes.filter(h => !getDieAt(h.q, h.r) && !isBlocked(h.q, h.r));
                emptyHex = spots.reduce((best, h) => {
                    const dist = Math.min(...pAlive.map(p => hexDist(p.q, p.r, h.q, h.r)));
                    return !best || dist > best.dist ? { q: h.q, r: h.r, dist } : best;
                }, null) || findNearestEmptyHex(victim.q, victim.r);
            } else {
                victim = pAlive[Math.floor(Math.random() * pAlive.length)];
                emptyHex = findNearestEmptyHex(victim.q, victim.r);
            }
            const oldQ = victim.q;
            const oldR = victim.r;
            const oldP = hexToPixel(oldQ, oldR);
            victim.q = emptyHex.q; victim.r = emptyHex.r;
            startSlide(victim, oldQ, oldR, 520, 0.9);
            victim.movedThisWave = true;
            const newP = hexToPixel(emptyHex.q, emptyHex.r);

            SFX.swap();
            spawnParticles(oldP.x + gridCenterX, oldP.y + gridCenterY, '#c084fc', 18, 3, 600);
            spawnParticles(newP.x + gridCenterX, newP.y + gridCenterY, '#c084fc', 18, 3, 600);
            addFloatingText('🔮 CPU Psychic Push!', emptyHex.q, emptyHex.r, '#c084fc', 20);
            fxBeam(cpuPsychic, victim, '#B79CF2', 500);
            addCombatLog(`🔮 CPU Telekinator Psychic Pushed ${victim.icon} ${victim.id.toUpperCase()}!`, '🔮', '#c084fc');
            applyForcedMoveBleed(victim, hexDist(oldQ, oldR, emptyHex.q, emptyHex.r));
            checkEventTilePickup(victim);
            triggerTileEffectOnDie(victim);
            updateDiceHP();
            if (checkWin()) return;
            await delay(800);
        }
    }

    // CPU Telekinator Mind Control (every 5 waves if unlocked and >1 player die remains)
    const cpuTele = alive.find(d => getSkillLevel(d, 'mindControl') > 0 && canUseActiveSkill(d));
    if (cpuTele && (game.wave - getCooldownWave('mindControlUsedWave', 'cpu')) >= 5) {
        const pAlive = aliveDice('player').filter(pd => !pd.concealed);
        if (pAlive.length > 1) {
            const victim = pAlive[Math.floor(Math.random() * pAlive.length)];
            victim.isMindControlled = true;
            victim.mindControlledWaves = 2;
            victim.originalTeam = 'player';
            victim.preControlHp = victim.hp;
            victim.team = 'cpu';
            victim.moveAllowance = 0;

            game.playerDice = game.playerDice.filter(d => d.id !== victim.id);
            if (!game.cpuDice.some(d => d.id === victim.id)) game.cpuDice.push(victim);

            setCooldownWave('mindControlUsedWave', 'cpu');
            SFX.powerUp();
            addFloatingText('🔮 CPU MIND CONTROL (2 Waves)!', victim.q, victim.r, '#c084fc', 20);
            fxBeam(cpuTele, victim, '#B79CF2', 800);
            addCombatLog(`🔮 CPU Mind Controlled ${victim.icon} ${victim.id.toUpperCase()} for 2 waves!`, '🔮', '#c084fc');
            updateDiceHP();
            await delay(800);
        }
    }

    // CPU Piercer Pivot Strike (every 3 waves if in range)
    const cpuPiercer = alive.find(d => getSkillLevel(d, 'pivot') > 0 && !d.hasAttackedThisTurn && canUseActiveSkill(d));
    if (cpuPiercer && (game.wave - getCooldownWave('pivotUsedWave', 'cpu')) >= 3) {
        const pLvl = getSkillLevel(cpuPiercer, 'pivot') || 1;
        const hitHexes = typeof getPivotHexes === 'function' ? getPivotHexes(cpuPiercer.q, cpuPiercer.r, pLvl) : [];
        const pAlive = aliveDice('player').filter(pd => !pd.concealed && hitHexes.some(n => n.q === pd.q && n.r === pd.r));
        if (pAlive.length > 0) {
            await executePiercerPivot(cpuPiercer);
            await delay(500);
            if (checkWin()) return;
        }
    }

    // CPU Archer Long Shot (targets the weakest visible enemy)
    const cpuArcher = alive.find(d => (d.archetype === 'archer' || getSkillLevel(d, 'longShot') > 0) && !d.hasAttackedThisTurn && canUseActiveSkill(d));
    if (cpuArcher) {
        const pAlive = aliveDice('player').filter(pd => !pd.concealed);
        if (pAlive.length > 0) {
            const target = pAlive.sort((a, b) => a.hp - b.hp)[0];
            await executeArcherLongShot(cpuArcher, target);
            await delay(500);
            if (checkWin()) return;
        }
    }

    if (await autoUseCards('cpu', 500)) return;
    await delay(fastAutoMode ? 200 : 600);

    const stepDelay = fastAutoMode ? 100 : 400;

    while (totalMovesLeft('cpu') > 0) {
        if (checkWin()) return;

        const movableDice = aliveDice('cpu').filter(d => d.moveAllowance > 0 && d.frozen === 0 && d.trapped === 0);
        if (movableDice.length === 0) break;

        const attackMoves = [];
        const nonAttackMoves = [];

        for (const die of movableDice) {
            const { reachable, parents } = findReachable(die);
            for (const [key, info] of reachable) {
                const h = allHexes.find(hx => hKey(hx.q, hx.r) === key);
                if (info.isAttack) {
                    const enemy = getDieAt(h.q, h.r);
                    const isDiffEnemy = die.lastAttackedEnemyId == null || (enemy && enemy.id !== die.lastAttackedEnemyId);
                    if (isDiffEnemy) {
                        attackMoves.push({ die, targetHex: h, info, parents });
                    }
                } else {
                    nonAttackMoves.push({ die, targetHex: h, info, parents });
                }
            }
        }

        const isSmartAI = gameSettings && (gameSettings.difficulty === 'medium' || gameSettings.difficulty === 'hard');

        if (attackMoves.length > 0) {
            let chosen = attackMoves[0];
            if (isSmartAI) {
                // Score attack moves: prefer killing enemy, high damage, or targeting weak enemies
                let bestScore = -Infinity;
                for (const move of attackMoves) {
                    const enemy = getDieAt(move.targetHex.q, move.targetHex.r);
                    let score = 50;
                    if (enemy) {
                        const effDmg = getDieEffectiveDamage(move.die);
                        if (enemy.hp <= effDmg) score += 100; // Lethal bonus!
                        else score += (effDmg * 5) - enemy.hp;
                    }
                    if (score > bestScore) {
                        bestScore = score;
                        chosen = move;
                    }
                }
            } else {
                chosen = attackMoves[Math.floor(Math.random() * attackMoves.length)];
            }
            const { die, targetHex, info, parents } = chosen;
            const path = reconstructPath(parents, die.q, die.r, targetHex.q, targetHex.r);

            await performMeleeAttack(die, path, info, targetHex.q, targetHex.r);

            updateDiceHP();
            await delay(stepDelay);
            if (checkWin()) return;
        } else if (nonAttackMoves.length > 0) {
            const playerDice = aliveDice('player').filter(d => !d.concealed);
            let bestMove = nonAttackMoves[0];

            if (isSmartAI) {
                // Smart positional movement: Mage stays back, others approach strategically avoiding hazards
                let bestScore = -Infinity;
                for (const move of nonAttackMoves) {
                    let score = 0;
                    let minDistToPlayer = Infinity;
                    for (const pd of playerDice) {
                        const d = hexDist(move.targetHex.q, move.targetHex.r, pd.q, pd.r);
                        if (d < minDistToPlayer) minDistToPlayer = d;
                    }

                    if (move.die.archetype === 'mage') {
                        // Mage wants distance (3-5 tiles away) to maximize Zap
                        score = (minDistToPlayer >= 3 && minDistToPlayer <= 5) ? 80 - Math.abs(minDistToPlayer - 4) * 10 : 20;
                    } else {
                        // Other classes want to close in
                        score = 50 - minDistToPlayer * 5;
                    }

                    // Penalize hazardous tiles
                    const hexKey = hKey(move.targetHex.q, move.targetHex.r);
                    if (game.burningTiles && game.burningTiles.has(hexKey)) score -= 60;
                    if (game.vineTraps && game.vineTraps.has(hexKey)) score -= 40;
                    if (game.voidTiles && game.voidTiles.has(hexKey)) score -= 100;
                    // Reward event tile pickup
                    if (game.eventTiles && game.eventTiles.has(hexKey)) score += 30;

                    if (score > bestScore) {
                        bestScore = score;
                        bestMove = move;
                    }
                }
            } else {
                let minD = Infinity;
                for (const move of nonAttackMoves) {
                    let dToP = Infinity;
                    for (const pd of playerDice) {
                        const d = hexDist(move.targetHex.q, move.targetHex.r, pd.q, pd.r);
                        if (d < dToP) dToP = d;
                    }
                    if (dToP < minD) {
                        minD = dToP;
                        bestMove = move;
                    }
                }
            }

            const { die, targetHex, info, parents } = bestMove;
            const path = reconstructPath(parents, die.q, die.r, targetHex.q, targetHex.r);

            await animateMove(die, path);
            if (game.phase === 'GAME_OVER') return;
            die.moveAllowance = Math.max(0, die.moveAllowance - info.dist);
            if (die.hp <= 0 || die.trapped > 0) die.moveAllowance = 0;
            updateDiceHP();
            await delay(stepDelay);
        } else {
            break;
        }
    }

    aliveDice('cpu').forEach(d => d.moveAllowance = 0);
    setMessage("🔴 Computer finished its turn.");
    await delay(fastAutoMode ? 200 : 600);
    await handleTurnEndSequence('cpu');
}
