// ==========================================================
// 13. CARD SYSTEM & SKILL EXECUTIONS
// ==========================================================
function onCardClick(idx) {
    if (game.phase !== 'PLAYER_TURN' && game.phase !== 'PLAYER_CARD_TARGET' && game.phase !== 'PLAYER_CARD_DASH_DIE' && game.phase !== 'PLAYER_CARD_DASH_DIR') return;
    if (idx < 0 || idx >= game.playerHand.length) return;

    // If clicking the currently active card, cancel it!
    if (game.activeCard && game.activeCard._handIdx === idx) {
        cancelCard();
        return;
    }

    const card = game.playerHand[idx];

    if (game.activeCard) {
        game.activeCard = null;
        game.cardTargets = [];
        game.phase = 'PLAYER_TURN';
    }

    if (card.target === 'none') {
        applyCard(card, 'player', idx);
    } else {
        game.activeCard = { ...card, _handIdx: idx };
        game.cardTargets = [];

        if (card.target === 'own-die-dir') {
            game.phase = 'PLAYER_CARD_DASH_DIE';
            setMessage(`💨 Dash: Click one of your dice to dash (or click card/cancel to abort).`);
        } else if (card.target === 'own-die-2') {
            game.phase = 'PLAYER_CARD_TARGET';
            setMessage(`🔀 Swap: Click 2 of your dice to swap positions (or click cancel to abort).`);
        } else if (card.target === 'hex' || card.target === 'hex-4') {
            game.phase = 'PLAYER_CARD_TARGET';
            setMessage(`🧱 Block: Click 4 empty hexes to place walls (or click cancel to abort).`);
        } else if (card.target === 'own-die') {
            game.phase = 'PLAYER_CARD_TARGET';
            setMessage(`${card.icon} ${card.name}: Click one of your dice (or click cancel to abort).`);
        } else if (card.target === 'enemy-die') {
            game.phase = 'PLAYER_CARD_TARGET';
            setMessage(`${card.icon} ${card.name}: Click an enemy die (or click cancel to abort).`);
        }
        setButtons(true, true);
    }
    updateCardHand();
}

function applyCard(card, team, handIdx) {
    const hand = team === 'player' ? game.playerHand : game.cpuHand;
    hand.splice(handIdx, 1);

    switch (card.id) {
        case 'dmg2': {
            const dice = aliveDice(team);
            dice.forEach(d => d.damageMultiplier = Math.max(d.damageMultiplier, 2));
            addFloatingText('⚔️ DMG ×2!', dice[0].q, dice[0].r, '#f59e0b', 18);
            SFX.powerUp();
            const p = hexToPixel(dice[0].q, dice[0].r);
            spawnParticles(p.x+gridCenterX, p.y+gridCenterY, '#f59e0b', 15, 2, 600);
            break;
        }
        case 'dmg3': {
            const dice = aliveDice(team);
            dice.forEach(d => d.damageMultiplier = 3);
            addFloatingText('🔥 DMG ×3!', dice[0].q, dice[0].r, '#ef4444', 20);
            SFX.powerUp();
            const p = hexToPixel(dice[0].q, dice[0].r);
            spawnParticles(p.x+gridCenterX, p.y+gridCenterY, '#ef4444', 20, 3, 800, 4);
            break;
        }
        case 'atkAgain': {
            const dice = aliveDice(team);
            dice.forEach(d => d.attackAgainActive = true);
            addFloatingText('⚡ Attack Again!', dice[0].q, dice[0].r, '#fbbf24', 16);
            SFX.powerUp();
            break;
        }
    }

    game.activeCard = null;
    game.cardTargets = [];
    if (team === 'player') {
        game.phase = 'PLAYER_TURN';
        updateCardHand();
    }
}

function applyCardWithTarget(card, team, handIdx, targets) {
    const hand = team === 'player' ? game.playerHand : game.cpuHand;
    hand.splice(handIdx, 1);

    switch (card.id) {
        case 'heal': {
            const die = targets[0];
            if (die.antiHealTurns > 0) {
                addFloatingText('🚫 Bleed Anti-Heal!', die.q, die.r, '#ef4444', 18);
            } else {
                const prevHp = die.hp;
                const maxHp = die.maxHp || MAX_HP;
                die.hp = Math.min(maxHp, die.hp + 7);
                const actual = die.hp - prevHp;
                if (team === 'player' && game.stats && actual > 0) {
                    game.stats.healDone.cards = (game.stats.healDone.cards || 0) + actual;
                    game.stats.healDone.total += actual;
                    updateStatsDisplay();
                }
                addFloatingText('+7 HP', die.q, die.r, '#34d399', 20);
                SFX.heal();
                const p = hexToPixel(die.q, die.r);
                spawnParticles(p.x+gridCenterX, p.y+gridCenterY, '#34d399', 18, 2, 800, 3);
            }
            break;
        }
        case 'freeze': {
            const die = targets[0];
            die.frozen = 2;
            addFloatingText('❄️ Frozen (2 turns)!', die.q, die.r, '#60a5fa', 18);
            SFX.freeze();
            const p = hexToPixel(die.q, die.r);
            spawnParticles(p.x+gridCenterX, p.y+gridCenterY, '#93c5fd', 20, 2, 1000, 4);
            break;
        }
        case 'conceal': {
            const die = targets[0];
            const concealBonus = getSkillLevel(die, 'concealMastery');
            const duration = 2 + concealBonus;
            die.concealed = duration;
            addFloatingText(`👻 Concealed (${duration} waves)!`, die.q, die.r, '#a78bfa', 16);
            SFX.conceal();
            const p = hexToPixel(die.q, die.r);
            spawnParticles(p.x+gridCenterX, p.y+gridCenterY, '#a78bfa', 15, 1.5, 1000, 3);
            break;
        }
        case 'clone': {
            const die = targets[0];
            die.cloneActive = true;
            die.moveAllowance += 2;
            die.halfDamage = 1;
            addFloatingText('🪞 Clone!', die.q, die.r, '#c084fc', 18);
            SFX.powerUp();
            const p = hexToPixel(die.q, die.r);
            spawnParticles(p.x+gridCenterX, p.y+gridCenterY, '#c084fc', 20, 2, 800, 4);
            break;
        }
        case 'swap': {
            const [d1, d2] = targets;
            const tq = d1.q, tr = d1.r;
            d1.q = d2.q; d1.r = d2.r;
            d2.q = tq; d2.r = tr;
            addFloatingText('🔀 Swapped!', d1.q, d1.r, '#60a5fa', 16);
            SFX.swap();
            const p1 = hexToPixel(d1.q, d1.r);
            const p2 = hexToPixel(d2.q, d2.r);
            spawnParticles(p1.x+gridCenterX, p1.y+gridCenterY, '#60a5fa', 12, 2, 600);
            spawnParticles(p2.x+gridCenterX, p2.y+gridCenterY, '#60a5fa', 12, 2, 600);
            
            // Check tile effects upon swapping
            triggerTileEffectOnDie(d1);
            triggerTileEffectOnDie(d2);
            break;
        }
        case 'block': {
            for (const hex of targets) {
                game.blocks.set(hKey(hex.q, hex.r), { turnsLeft: 4 });
                addFloatingText('🧱', hex.q, hex.r, '#a8a29e', 20);
                const p = hexToPixel(hex.q, hex.r);
                spawnParticles(p.x+gridCenterX, p.y+gridCenterY, '#a8a29e', 10, 1.5, 600);
            }
            SFX.block();
            break;
        }
    }

    game.activeCard = null;
    game.cardTargets = [];
    if (team === 'player') {
        game.phase = 'PLAYER_TURN';
        updateCardHand();
        updateDiceHP();
        updateMoves();
    }
}

async function executeDash(die, dir, team, handIdx) {
    const hand = team === 'player' ? game.playerHand : game.cpuHand;
    hand.splice(handIdx, 1);

    SFX.dash();

    const path = [{ q: die.q, r: die.r }];
    let cq = die.q, cr = die.r;
    const hitEnemies = [];

    while (true) {
        const nq = cq + dir.q, nr = cr + dir.r;
        if (!isValidHex(nq, nr) || isBlocked(nq, nr)) break;

        const ownDice = aliveDice(team);
        if (ownDice.some(d => d.q === nq && d.r === nr && d.id !== die.id)) break;

        path.push({ q: nq, r: nr });

        const enemy = getDieAt(nq, nr);
        if (enemy && enemy.team !== team && !enemy.concealed) {
            hitEnemies.push(enemy);
        }

        cq = nq; cr = nr;
    }

    if (path.length < 2) {
        addFloatingText('Blocked!', die.q, die.r, '#ef4444', 14);
        game.activeCard = null;
        if (team === 'player') { game.phase = 'PLAYER_TURN'; updateCardHand(); }
        return;
    }

    let landIdx = path.length - 1;
    while (landIdx > 0) {
        const lh = path[landIdx];
        const occupant = getDieAt(lh.q, lh.r);
        if (!occupant || occupant.id === die.id) break;
        landIdx--;
    }

    animatingDie = die;
    const startP = hexToPixel(path[0].q, path[0].r);
    const endP = hexToPixel(path[landIdx].q, path[landIdx].r);

    await new Promise(resolve => {
        const start = performance.now();
        const dur = 300;
        function step(now) {
            const t = Math.min((now - start) / dur, 1);
            const et = easeOutCubic(t);
            die.renderX = startP.x + (endP.x - startP.x) * et;
            die.renderY = startP.y + (endP.y - startP.y) * et;
            animRotation = t * Math.PI * 6;

            spawnTrail(die.renderX + gridCenterX, die.renderY + gridCenterY, '#fbbf24', 3, 3);

            if (t < 1) requestAnimationFrame(step);
            else {
                die.q = path[landIdx].q;
                die.r = path[landIdx].r;
                die.renderX = null;
                die.renderY = null;
                animRotation = 0;
                resolve();
            }
        }
        requestAnimationFrame(step);
    });
    animatingDie = null;

    const superDashBonus = getSkillLevel(die, 'superDash') * 5;
    const rageBonus = getDieRageBonus(die);
    const baseDashDmg = 4 + superDashBonus + rageBonus;

    for (const enemy of hitEnemies) {
        const dmg = enemy.halfDamage > 0 ? Math.ceil(baseDashDmg / 2) : baseDashDmg;
        enemy.hp -= dmg;
        enemy.totalDamageTaken = (enemy.totalDamageTaken || 0) + dmg;
        enemy.damagedThisWave = true;
        if (enemy.hp < 0) enemy.hp = 0;
        addFloatingText(`-${dmg} 💨`, enemy.q, enemy.r, '#fbbf24', 20);
        const p = hexToPixel(enemy.q, enemy.r);
        spawnParticles(p.x+gridCenterX, p.y+gridCenterY, '#fbbf24', 15, 3, 600, 3);
        SFX.attack();
    }

    // Trigger tile effects on landing
    triggerTileEffectOnDie(die);

    updateDiceHP();
    updateCardHand();

    if (team === 'player') {
        game.activeCard = null;
        game.phase = 'PLAYER_TURN';
        await delay(300);
        if (checkWin()) return;
    }
}

function handleCardTarget(q, r) {
    if (!game.activeCard) return false;
    const card = game.activeCard;

    if (card.target === 'own-die') {
        const die = getDieAt(q, r);
        if (die && die.team === 'player' && die.hp > 0) {
            applyCardWithTarget(card, 'player', card._handIdx, [die]);
            return true;
        }
    } else if (card.target === 'enemy-die') {
        const die = getDieAt(q, r);
        if (die && die.team === 'cpu' && die.hp > 0 && !die.concealed) {
            applyCardWithTarget(card, 'player', card._handIdx, [die]);
            return true;
        }
    } else if (card.target === 'own-die-2') {
        const die = getDieAt(q, r);
        if (die && die.team === 'player' && die.hp > 0) {
            if (!game.cardTargets.some(t => t.id === die.id)) {
                game.cardTargets.push(die);
                addFloatingText('✓', q, r, '#60a5fa', 14);
                if (game.cardTargets.length >= 2) {
                    applyCardWithTarget(card, 'player', card._handIdx, game.cardTargets);
                    return true;
                } else {
                    setMessage('🔀 Swap: Click second die...');
                }
            }
        }
        return true;
    } else if (card.target === 'hex' || card.target === 'hex-4') {
        const reqCount = card.target === 'hex-4' ? 4 : 2;
        if (isValidHex(q, r) && !getDieAt(q, r) && !isBlocked(q, r) && !game.eventTiles.has(hKey(q, r))) {
            if (!game.cardTargets.some(t => t.q === q && t.r === r)) {
                game.cardTargets.push({ q, r });
                addFloatingText('✓', q, r, '#a8a29e', 14);
                if (game.cardTargets.length >= reqCount) {
                    applyCardWithTarget(card, 'player', card._handIdx, game.cardTargets);
                    return true;
                } else {
                    setMessage(`🧱 Block: Click hex #${game.cardTargets.length + 1} (${game.cardTargets.length}/${reqCount})...`);
                }
            }
        }
        return true;
    }
    return false;
}

function handleDashDieSelect(q, r) {
    const die = getDieAt(q, r);
    if (die && die.team === 'player' && die.hp > 0) {
        game.activeCard._dashDie = die;
        game.phase = 'PLAYER_CARD_DASH_DIR';
        setMessage('💨 Dash: Click a neighboring hex to choose direction.');
        return true;
    }
    return false;
}

function handleDashDirSelect(q, r) {
    const dd = game.activeCard._dashDie;
    if (!dd) return false;

    const dir = DIRS.find(d => dd.q + d.q === q && dd.r + d.r === r);
    if (!dir) return false;

    const card = game.activeCard;
    game.phase = 'PLAYER_ANIMATING';
    executeDash(dd, dir, 'player', card._handIdx);
    return true;
}

function cancelCard() {
    if (game.activeCard || game.phase === 'PLAYER_CARD_TARGET' || game.phase === 'PLAYER_CARD_DASH_DIE' || game.phase === 'PLAYER_CARD_DASH_DIR') {
        game.activeCard = null;
        game.cardTargets = [];
        game.phase = 'PLAYER_TURN';
        setMessage('Card cancelled. Select a die to move.');
        setButtons(true, game.selectedDie != null);
        updateCardHand();
    }
}
