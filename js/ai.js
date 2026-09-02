// ==========================================================
// 15. CPU AI & FAST AUTO BOT MODE
// ==========================================================
let fastAutoMode = false;

function toggleFastAutoMode() {
    fastAutoMode = !fastAutoMode;
    const btn = document.getElementById('auto-test-btn');
    if (btn) {
        btn.textContent = fastAutoMode ? '⚡ Fast Auto: ON' : '⚡ Fast Auto: OFF';
        if (fastAutoMode) btn.classList.add('active');
        else btn.classList.remove('active');
    }

    // If currently in an active overlay (e.g. roll-for-first or roguelike upgrade), auto click button
    if (fastAutoMode) {
        const overlayBtn = document.querySelector('#overlay:not(.hidden) .overlay-btn');
        if (overlayBtn) overlayBtn.click();
        const upgradeCard = document.querySelector('#overlay:not(.hidden) .upgrade-card-item');
        if (upgradeCard) upgradeCard.click();

        // If it's currently player turn, immediately start bot turns
        if (game.phase === 'PLAYER_TURN' && game.currentTurn === 'player') {
            setTimeout(playerAutoBotTurn, 150);
        }
    }
}

async function playerAutoUseCards() {
    const hand = game.playerHand;
    if (!hand || hand.length === 0) return;
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
        if (card.id === 'atkAgain') {
            applyCard(card, 'player', i);
            await delay(300);
            continue;
        }
    }
    updateCardHand();
}

async function playerAutoBotTurn() {
    if (!fastAutoMode || game.currentTurn !== 'player' || game.phase !== 'PLAYER_TURN') return;

    // Automatically resolve psychic push if triggered
    if (game.phase === 'PLAYER_PSYCHIC_ENEMY') {
        const cpuAlive = aliveDice('cpu').filter(cd => !cd.concealed);
        if (cpuAlive.length > 0) {
            handlePsychicEnemySelect(cpuAlive[0].q, cpuAlive[0].r);
            await delay(200);
        }
    }
    if (game.phase === 'PLAYER_PSYCHIC_TILE' && game.psychicTargetEnemy) {
        const emptyHex = allHexes.find(h => !getDieAt(h.q, h.r) && !isBlocked(h.q, h.r));
        if (emptyHex) {
            await handlePsychicTileSelect(emptyHex.q, emptyHex.r);
            await delay(250);
        }
    }

    // Use player cards smartly
    await playerAutoUseCards();

    let maxIters = 25;
    while (fastAutoMode && totalMovesLeft('player') > 0 && maxIters-- > 0 && game.phase === 'PLAYER_TURN') {
        const pAlive = aliveDice('player').filter(d => d.moveAllowance > 0 && d.frozen === 0 && d.trapped === 0);
        if (pAlive.length === 0) break;

        const shuffled = [...pAlive].sort(() => Math.random() - 0.5);
        let moved = false;

        for (const die of shuffled) {
            selectDie(die);
            if (!game.reachable || game.reachable.size === 0) {
                die.moveAllowance = 0;
                deselectDie();
                continue;
            }

            const targets = [...game.reachable.values()];
            const attacks = targets.filter(t => t.isAttack && (!game.lastAttackedId || die.attackAgainActive));
            let target;

            if (attacks.length > 0) {
                target = attacks[Math.floor(Math.random() * attacks.length)];
            } else {
                const moveTargets = targets.filter(t => !t.isAttack);
                if (moveTargets.length === 0) {
                    die.moveAllowance = 0;
                    deselectDie();
                    continue;
                }
                const cpuAlive = aliveDice('cpu');
                if (cpuAlive.length > 0) {
                    moveTargets.sort((a, b) => {
                        const da = Math.min(...cpuAlive.map(cd => hexDist(a.q, a.r, cd.q, cd.r)));
                        const db = Math.min(...cpuAlive.map(cd => hexDist(b.q, b.r, cd.q, cd.r)));
                        return da - db;
                    });
                    const best = moveTargets.slice(0, Math.max(1, Math.ceil(moveTargets.length * 0.3)));
                    target = best[Math.floor(Math.random() * best.length)];
                } else {
                    target = moveTargets[Math.floor(Math.random() * moveTargets.length)];
                }
            }

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
        if (card.id === 'clone') {
            const best = alive.reduce((a, b) => b.moveAllowance > a.moveAllowance ? b : a);
            if (best.moveAllowance > 0) {
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

    const vals = await animateRoll('cpu', n);

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
    updateRollDisplay(vals, 'cpu');
    updateDiceHP();

    setMessage(`🔴 Computer has ${totalMovesLeft('cpu')} total moves.`);
    await delay(400);

    await cpuUseCards();

    let maxIterations = 30;
    while (totalMovesLeft('cpu') > 0 && maxIterations-- > 0) {
        const cpuAlive = aliveDice('cpu').filter(d => d.moveAllowance > 0 && d.frozen === 0 && d.trapped === 0);
        if (cpuAlive.length === 0) break;

        const shuffled = [...cpuAlive].sort(() => Math.random() - 0.5);
        let moved = false;

        for (const die of shuffled) {
            const { reachable, parents } = findReachable(die);
            if (reachable.size === 0) { die.moveAllowance = 0; continue; }

            const targets = [...reachable.values()];
            const attacks = targets.filter(t => t.isAttack && (!game.lastAttackedId || die.attackAgainActive));
            let target;

            if (attacks.length > 0 && Math.random() < 0.7) {
                target = attacks[Math.floor(Math.random() * attacks.length)];
            } else {
                const moveTargets = targets.filter(t => !t.isAttack);
                if (moveTargets.length === 0) { die.moveAllowance = 0; continue; }
                const playerAlive = aliveDice('player');
                if (playerAlive.length > 0 && Math.random() < 0.6) {
                    moveTargets.sort((a, b) => {
                        const da = Math.min(...playerAlive.map(pd => hexDist(a.q, a.r, pd.q, pd.r)));
                        const db = Math.min(...playerAlive.map(pd => hexDist(b.q, b.r, pd.q, pd.r)));
                        return da - db;
                    });
                    const best = moveTargets.slice(0, Math.max(1, Math.ceil(moveTargets.length * 0.3)));
                    target = best[Math.floor(Math.random() * best.length)];
                } else {
                    target = moveTargets[Math.floor(Math.random() * moveTargets.length)];
                }
            }

            const path = reconstructPath(parents, die.q, die.r, target.q, target.r);

            game.selectedDie = die;
            game.reachable = reachable;
            await delay(250);
            game.reachable = null;

            if (target.isAttack) {
                const movePath = path.slice(0, -1);
                if (movePath.length > 1) await animateMove(die, movePath);

                const prevQ = die.q, prevR = die.r;
                const enemyDie = getDieAt(target.q, target.r);

                await animateMove(die, [{ q: die.q, r: die.r }, { q: target.q, r: target.r }]);

                // Toughness reduction
                const toughLvl = getSkillLevel(enemyDie, 'toughness');
                const toughRed = toughLvl > 0 ? (toughLvl === 1 ? 1 : 2) : 0;

                const attackerEffDmg = getDieEffectiveDamage(die);
                let rawDmg = Math.max(1, attackerEffDmg * die.damageMultiplier + enemyDie.bleedStacks - toughRed);
                const damage = enemyDie.halfDamage > 0 ? Math.ceil(rawDmg / 2) : rawDmg;

                enemyDie.hp -= damage;
                enemyDie.totalDamageTaken += damage;
                SFX.attack();

                // Rage Back Stronger on enemy
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

                // Metal Thorns reflect on attacker (die)
                const thornsLvl = getSkillLevel(enemyDie, 'thorns');
                if (thornsLvl > 0) {
                    const reflectDmg = thornsLvl === 1 ? 1 : thornsLvl === 2 ? 2 : 3;
                    die.hp -= reflectDmg;
                    die.totalDamageTaken = (die.totalDamageTaken || 0) + reflectDmg;
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

                // Dracula Bleed + Anti-Heal
                const bleedLvl = getSkillLevel(die, 'bleed');
                if (bleedLvl > 0) {
                    enemyDie.bleedStacks = Math.min(3, enemyDie.bleedStacks + bleedLvl);
                    enemyDie.antiHealTurns = 1;
                    addFloatingText(`🩸 Bleed x${enemyDie.bleedStacks} (No Heal 1T)!`, enemyDie.q, enemyDie.r, '#ef4444', 16);
                }

                addFloatingText(`-${damage}`, target.q, target.r, '#ff4466', 22);
                setMessage(`🔴 Computer attacks! Dealt ${damage} damage!`);

                const p = hexToPixel(target.q, target.r);
                spawnParticles(p.x+gridCenterX, p.y+gridCenterY, '#ff4466', 15, 3, 600);

                if (enemyDie.hp <= 0) {
                    enemyDie.hp = 0;
                    addFloatingText('💀', target.q, target.r + 0.5, '#ff2244', 20);
                    SFX.destroy();
                    die.q = target.q; die.r = target.r;

                    // Rage Explode on death (can trigger again after revive)
                    const explodeLvl = getSkillLevel(enemyDie, 'explode');
                    if (explodeLvl > 0) {
                        const expDmg = explodeLvl === 1 ? 8 : 15;
                        addFloatingText(`💥 EXPLODE -${expDmg}!`, target.q, target.r, '#ef4444', 24);
                        SFX.destroy();
                        aliveDice('cpu').forEach(cd => {
                            cd.hp -= expDmg;
                            cd.totalDamageTaken = (cd.totalDamageTaken || 0) + expDmg;
                            if (cd.hp < 0) cd.hp = 0;
                            addFloatingText(`-${expDmg} 💥`, cd.q, cd.r, '#ef4444', 20);
                        });
                    }

                    // Revive check (Rage can revive and explode again on next death)
                    for (const teamDie of game.playerDice) {
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
                } else {
                    die.q = target.q; die.r = target.r;
                    enemyDie.q = prevQ; enemyDie.r = prevR;
                }

                die.damageMultiplier = 1;
                const attackedId = enemyDie.id;

                die.moveAllowance -= target.dist;
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
                moved = true;
                break;
            } else {
                await animateMove(die, path);
                die.moveAllowance -= target.dist;
                updateMoves();
                updateDiceHP();
                setMessage(`🔴 Computer moves. ${totalMovesLeft('cpu')} moves left.`);
                await delay(250);
                moved = true;
                break;
            }
        }

        if (!moved) break;
    }

    stopTurnTimer();
    game.selectedDie = null;
    game.reachable = null;
    updateRollDisplay([], 'cpu');
    updateCardHand();

    await handleTurnEndSequence('cpu');
}
