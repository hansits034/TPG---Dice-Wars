// ==========================================================
// 14. CPU AI & 16. FAST AUTO MODE (BOT VS BOT)
// ==========================================================
let fastAutoMode = false;

function toggleFastAutoMode() {
    fastAutoMode = !fastAutoMode;
    const btn = document.getElementById('auto-test-btn');
    if (btn) {
        if (fastAutoMode) {
            btn.classList.add('active');
            btn.textContent = '⚡ Fast Auto: ON';
            if (game.phase === 'PLAYER_TURN' && game.currentTurn === 'player') {
                setTimeout(playerAutoBotTurn, 200);
            }
        } else {
            btn.classList.remove('active');
            btn.textContent = '⚡ Fast Auto: OFF';
        }
    }
}

async function playerAutoUseCards() {
    const hand = game.playerHand;
    if (hand.length === 0) return;

    const alive = aliveDice('player');
    const cpuAlive = aliveDice('cpu');

    for (let i = hand.length - 1; i >= 0; i--) {
        const card = hand[i];

        if (card.id === 'heal') {
            const weak = alive.find(d => d.hp <= MAX_HP * 0.4);
            if (weak) {
                applyCardWithTarget(card, 'player', i, [weak]);
                await delay(300);
                continue;
            }
        }
        if (card.id === 'dmg2' || card.id === 'dmg3') {
            for (const d of alive) {
                if (d.frozen > 0 || d.trapped > 0) continue;
                const { reachable } = findReachable(d);
                const attacks = [...reachable.values()].filter(v => v.isAttack);
                if (attacks.length > 0) {
                    applyCard(card, 'player', i);
                    await delay(300);
                    break;
                }
            }
            continue;
        }
        if (card.id === 'freeze' && cpuAlive.length > 0) {
            const strongest = cpuAlive.reduce((a, b) => b.baseDamage > a.baseDamage ? b : a);
            if (strongest.frozen === 0) {
                applyCardWithTarget(card, 'player', i, [strongest]);
                await delay(300);
                continue;
            }
        }
        if (card.id === 'conceal') {
            const lowHp = alive.find(d => d.hp <= MAX_HP * 0.3 && d.concealed === 0);
            if (lowHp) {
                applyCardWithTarget(card, 'player', i, [lowHp]);
                await delay(300);
                continue;
            }
        }
        if (card.id === 'sprint') {
            const best = alive.find(d => d.moveAllowance > 0) || alive[0];
            if (best) {
                applyCardWithTarget(card, 'player', i, [best]);
                await delay(300);
                continue;
            }
        }
        if (card.id === 'cure') {
            const debuffed = alive.find(d => d.frozen > 0 || d.trapped > 0 || d.bleedStacks > 0 || d.hp <= MAX_HP * 0.7);
            if (debuffed) {
                applyCardWithTarget(card, 'player', i, [debuffed]);
                await delay(300);
                continue;
            }
        }
        if (card.id === 'aegis') {
            const targetDie = alive.find(d => (d.aegisShield || 0) < 15) || alive[0];
            if (targetDie) {
                applyCardWithTarget(card, 'player', i, [targetDie]);
                await delay(300);
                continue;
            }
        }
        if (card.id === 'bearTrap') {
            const emptyHex = allHexes.find(h => !getDieAt(h.q, h.r) && !isBlocked(h.q, h.r) && !game.eventTiles.has(hKey(h.q, h.r)) && !game.bearTraps.has(hKey(h.q, h.r)));
            if (emptyHex) {
                applyCardWithTarget(card, 'player', i, [emptyHex]);
                await delay(300);
                continue;
            }
        }
        if (card.id === 'clone') {
            const best = alive.reduce((a, b) => b.moveAllowance > a.moveAllowance ? b : a);
            if (best && alive.length < 5) {
                applyCardWithTarget(card, 'player', i, [best]);
                await delay(300);
                continue;
            }
        }
        if (card.id === 'atkAgain') {
            applyCard(card, 'player', i);
            await delay(300);
            continue;
        }
    }
    updateCardHand();
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
            for (const [key, info] of game.reachable.entries()) {
                const hex = game.parents.get(key) || { q: die.q, r: die.r };
                targets.push({ q: info.isAttack ? (allHexes.find(h => hKey(h.q, h.r) === key).q) : hex.q, r: info.isAttack ? (allHexes.find(h => hKey(h.q, h.r) === key).r) : hex.r, isAttack: info.isAttack, dist: info.dist });
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

async function cpuUseCards() {
    const hand = game.cpuHand;
    if (hand.length === 0) return;

    const alive = aliveDice('cpu');
    const playerAlive = aliveDice('player');

    for (let i = hand.length - 1; i >= 0; i--) {
        const card = hand[i];

        if (card.id === 'heal') {
            const weak = alive.find(d => d.hp <= MAX_HP * 0.4);
            if (weak) {
                applyCardWithTarget(card, 'cpu', i, [weak]);
                await delay(500);
                continue;
            }
        }
        if (card.id === 'dmg2' || card.id === 'dmg3') {
            for (const d of alive) {
                if (d.frozen > 0 || d.trapped > 0) continue;
                const { reachable } = findReachable(d);
                const attacks = [...reachable.values()].filter(v => v.isAttack);
                if (attacks.length > 0) {
                    applyCard(card, 'cpu', i);
                    await delay(500);
                    break;
                }
            }
            continue;
        }
        if (card.id === 'freeze' && playerAlive.length > 0) {
            const strongest = playerAlive.reduce((a, b) => b.baseDamage > a.baseDamage ? b : a);
            if (strongest.frozen === 0) {
                applyCardWithTarget(card, 'cpu', i, [strongest]);
                await delay(500);
                continue;
            }
        }
        if (card.id === 'conceal') {
            const lowHp = alive.find(d => d.hp <= MAX_HP * 0.3 && d.concealed === 0);
            if (lowHp) {
                applyCardWithTarget(card, 'cpu', i, [lowHp]);
                await delay(500);
                continue;
            }
        }
        if (card.id === 'sprint') {
            const best = alive.find(d => d.moveAllowance > 0) || alive[0];
            if (best) {
                applyCardWithTarget(card, 'cpu', i, [best]);
                await delay(500);
                continue;
            }
        }
        if (card.id === 'cure') {
            const debuffed = alive.find(d => d.frozen > 0 || d.trapped > 0 || d.bleedStacks > 0 || d.hp <= MAX_HP * 0.7);
            if (debuffed) {
                applyCardWithTarget(card, 'cpu', i, [debuffed]);
                await delay(500);
                continue;
            }
        }
        if (card.id === 'aegis') {
            const targetDie = alive.find(d => (d.aegisShield || 0) < 15) || alive[0];
            if (targetDie) {
                applyCardWithTarget(card, 'cpu', i, [targetDie]);
                await delay(500);
                continue;
            }
        }
        if (card.id === 'bearTrap') {
            const emptyHex = allHexes.find(h => !getDieAt(h.q, h.r) && !isBlocked(h.q, h.r) && !game.eventTiles.has(hKey(h.q, h.r)) && !game.bearTraps.has(hKey(h.q, h.r)));
            if (emptyHex) {
                applyCardWithTarget(card, 'cpu', i, [emptyHex]);
                await delay(500);
                continue;
            }
        }
        if (card.id === 'clone') {
            const best = alive.reduce((a, b) => b.moveAllowance > a.moveAllowance ? b : a);
            if (best && alive.length < 5) {
                applyCardWithTarget(card, 'cpu', i, [best]);
                await delay(500);
                continue;
            }
        }
        if (card.id === 'atkAgain') {
            applyCard(card, 'cpu', i);
            await delay(500);
            continue;
        }
    }
    updateCardHand();
}

async function beginCpuTurn() {
    game.phase = 'CPU_TURN';
    game.currentTurn = 'cpu';
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
    });

    updateRollDisplay(vals, 'cpu');
    updateDiceHP();

    // CPU Mage Zap Skill Execution
    const cpuMage = alive.find(d => (d.archetype === 'mage' || getSkillLevel(d, 'zap') > 0) && (d.zapStacks || 0) > 0 && d.frozen === 0);
    if (cpuMage) {
        const pAlive = aliveDice('player').filter(pd => !pd.concealed);
        if (pAlive.length > 0) {
            let maxDist = 0;
            pAlive.forEach(pd => {
                const dist = hexDist(cpuMage.q, cpuMage.r, pd.q, pd.r);
                if (dist > maxDist) maxDist = dist;
            });
            // Fire Zap if at good range (distance >= 3) or at 2 stacks
            if (maxDist >= 3 || cpuMage.zapStacks >= 2) {
                await executeZapSkill(cpuMage);
                await delay(500);
                if (checkWin()) return;
            }
        }
    }

    // CPU Telekinator Psychic Push
    for (const d of alive) {
        const psychicLvl = getSkillLevel(d, 'psychic');
        if (psychicLvl > 0 && d.frozen === 0 && d.trapped === 0) {
            const chance = psychicLvl * 0.20;
            if (Math.random() < chance) {
                const pAlive = aliveDice('player').filter(pd => !pd.concealed);
                if (pAlive.length > 0) {
                    const victim = pAlive[Math.floor(Math.random() * pAlive.length)];
                    const emptyHex = findNearestEmptyHex(victim.q, victim.r);
                    const oldQ = victim.q;
                    const oldR = victim.r;
                    const oldP = hexToPixel(oldQ, oldR);
                    victim.q = emptyHex.q; victim.r = emptyHex.r;
                    victim.movedThisWave = true;
                    const newP = hexToPixel(emptyHex.q, emptyHex.r);

                    SFX.swap();
                    spawnParticles(oldP.x + gridCenterX, oldP.y + gridCenterY, '#c084fc', 18, 3, 600);
                    spawnParticles(newP.x + gridCenterX, newP.y + gridCenterY, '#c084fc', 18, 3, 600);
                    addFloatingText('🔮 CPU Psychic Push!', emptyHex.q, emptyHex.r, '#c084fc', 20);
                    addCombatLog(`🔮 CPU Telekinator Psychic Pushed ${victim.icon} ${victim.id.toUpperCase()}!`, '🔮', '#c084fc');
                    if (typeof applyForcedMoveBleed === 'function') {
                        applyForcedMoveBleed(victim, hexDist(oldQ, oldR, emptyHex.q, emptyHex.r));
                    }
                    triggerTileEffectOnDie(victim);
                    await delay(800);
                    break;
                }
            }
        }
    }

    // CPU Telekinator Mind Control (every 5 waves if unlocked)
    const cpuTele = alive.find(d => (d.archetype === 'telekinator' && getSkillLevel(d, 'mindControl') > 0) && d.frozen === 0);
    if (cpuTele && (game.wave - (game.mindControlUsedWave || -99)) >= 5) {
        const pAlive = aliveDice('player').filter(pd => !pd.concealed);
        if (pAlive.length > 0) {
            const victim = pAlive[Math.floor(Math.random() * pAlive.length)];
            victim.isMindControlled = true;
            victim.mindControlledWaves = 2;
            victim.originalTeam = 'player';
            victim.preControlHp = victim.hp;
            victim.team = 'cpu';

            game.playerDice = game.playerDice.filter(d => d.id !== victim.id);
            if (!game.cpuDice.some(d => d.id === victim.id)) game.cpuDice.push(victim);

            game.mindControlUsedWave = game.wave;
            SFX.powerUp();
            addFloatingText('🔮 CPU MIND CONTROL (2 Waves)!', victim.q, victim.r, '#c084fc', 20);
            addCombatLog(`🔮 CPU Mind Controlled ${victim.icon} ${victim.id.toUpperCase()} for 2 waves!`, '🔮', '#c084fc');
            updateDiceHP();
            await delay(800);
        }
    }

    // CPU Piercer Pivot Strike (every 3 waves if in range)
    const cpuPiercer = alive.find(d => (d.archetype === 'piercer' && getSkillLevel(d, 'pivot') > 0) && !d.hasAttackedThisTurn && d.frozen === 0);
    if (cpuPiercer && (game.wave - (game.pivotUsedWave || -99)) >= 3) {
        const pAlive = aliveDice('player').filter(pd => !pd.concealed && hexDist(cpuPiercer.q, cpuPiercer.r, pd.q, pd.r) === 1);
        if (pAlive.length > 0) {
            await executePiercerPivot(cpuPiercer);
            await delay(500);
            if (checkWin()) return;
        }
    }

    // CPU Archer Long Shot (if in range)
    const cpuArcher = alive.find(d => (d.archetype === 'archer' || getSkillLevel(d, 'longShot') > 0) && !d.hasAttackedThisTurn && d.frozen === 0);
    if (cpuArcher) {
        const pAlive = aliveDice('player').filter(pd => !pd.concealed);
        if (pAlive.length > 0) {
            const target = pAlive.sort((a, b) => a.hp - b.hp)[0]; // target weakest
            await executeArcherLongShot(cpuArcher, target);
            await delay(500);
            if (checkWin()) return;
        }
    }

    await cpuUseCards();
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

            const movePath = path.slice(0, -1);
            if (movePath.length > 1) await animateMove(die, movePath);

            const prevQ = die.q, prevR = die.r;
            const enemyDie = getDieAt(targetHex.q, targetHex.r);

            await animateMove(die, [{ q: die.q, r: die.r }, { q: targetHex.q, r: targetHex.r }]);

            // Calculate damage with Toughness reduction: -3 / -5 / -7
            const toughLvl = getSkillLevel(enemyDie, 'toughness');
            const toughRed = toughLvl === 1 ? 3 : toughLvl === 2 ? 5 : toughLvl === 3 ? 7 : 0;

            const attackerEffDmg = getDieEffectiveDamage(die);
            let rawDamage = Math.max(1, (attackerEffDmg * die.damageMultiplier) - toughRed);
            const damage = enemyDie.halfDamage > 0 ? Math.ceil(rawDamage / 2) : rawDamage;

            enemyDie.hp -= damage;
            enemyDie.totalDamageTaken += damage;
            enemyDie.damagedThisWave = true;
            SFX.attack();

            // Rage Back Stronger check on player die
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

            // Defender Thorns reflect check on attacker (die): 1 / 3 / 5
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
            }

            // Dracula Bleed
            const bleedLvl = getSkillLevel(die, 'bleed');
            if (bleedLvl > 0) {
                const stacksToAdd = bleedLvl === 1 ? 1 : bleedLvl === 2 ? 2 : 3;
                enemyDie.bleedStacks = Math.min(3, (enemyDie.bleedStacks || 0) + stacksToAdd);
                enemyDie.bleedTurns = 3;
                enemyDie.antiHealTurns = 3;
                addFloatingText(`🩸 Bleed x${enemyDie.bleedStacks} (3 Turns)!`, enemyDie.q, enemyDie.r, '#ef4444', 16);
                addCombatLog(`${die.icon} ${die.id.toUpperCase()} inflicted Bleed x${enemyDie.bleedStacks} on ${enemyDie.icon} ${enemyDie.id.toUpperCase()} (3 turns)!`, '🩸', '#ef4444');
            }

            addFloatingText(`-${damage}`, targetHex.q, targetHex.r, '#ff4466', 22);
            addCombatLog(`🔴 CPU ${die.icon} attacked ${enemyDie.icon} ${enemyDie.id.toUpperCase()} for ${damage} DMG!`, '⚔️', '#ff4466');
            const p = hexToPixel(targetHex.q, targetHex.r);
            spawnParticles(p.x+gridCenterX, p.y+gridCenterY, '#ff4466', 15, 3, 600, 3);

            // Track stats: Damage Taken by Player Die
            if (game.stats) {
                game.stats.damageTaken[enemyDie.id] = (game.stats.damageTaken[enemyDie.id] || 0) + damage;
                game.stats.damageTaken.total += damage;
                updateStatsDisplay();
            }

            if (enemyDie.hp <= 0) {
                enemyDie.hp = 0;
                addFloatingText('💀 DESTROYED!', targetHex.q, targetHex.r + 0.5, '#ff2244', 16);
                addCombatLog(`💀 ${enemyDie.icon} ${enemyDie.id.toUpperCase()} was destroyed!`, '💀', '#ef4444');
                SFX.destroy();
                die.q = targetHex.q; die.r = targetHex.r;

                // Rage Explode on death
                const explodeLvl = getSkillLevel(enemyDie, 'explode');
                if (explodeLvl > 0) {
                    const expDmg = explodeLvl === 1 ? 8 : 15;
                    addFloatingText(`💥 EXPLODE -${expDmg}!`, targetHex.q, targetHex.r, '#ef4444', 24);
                    SFX.destroy();
                    aliveDice('cpu').forEach(cd => {
                        cd.hp -= expDmg;
                        cd.totalDamageTaken = (cd.totalDamageTaken || 0) + expDmg;
                        cd.damagedThisWave = true;
                        if (cd.hp < 0) cd.hp = 0;
                        addFloatingText(`-${expDmg} 💥`, cd.q, cd.r, '#ef4444', 20);
                    });
                }

                // Necromancer Undead split
                const didSplit = handleUndeadSplit(enemyDie);

                // Angel Revive
                if (!didSplit) {
                    for (const teamDie of game.playerDice) {
                        const revLvl = getSkillLevel(teamDie, 'revive');
                        if (revLvl > 0 && !enemyDie.revived) {
                            enemyDie.hp = revLvl * 15;
                            enemyDie.revived = true;
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
                die.q = targetHex.q; die.r = targetHex.r;
                enemyDie.q = prevQ; enemyDie.r = prevR;
                enemyDie.movedThisWave = true;
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
            die.moveAllowance -= info.dist;
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
