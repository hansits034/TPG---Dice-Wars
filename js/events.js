// ==========================================================
// 12. ARENA BLITZ, EVENT TILES, ROGUELIKE UPGRADES & MINIONS
// ==========================================================
async function triggerRoguelikeUpgrade() {
    stopTurnTimer();
    SFX.powerUp();

    // --- PLAYER UPGRADE ---
    const playerAlive = aliveDice('player');
    const availableUpgrades = [];

    playerAlive.forEach((die, index) => {
        die.skills.forEach(skill => {
            if (skill.curLvl < skill.maxLvl) {
                availableUpgrades.push({ die, dieIndex: index + 1, skill });
            }
        });
    });

    if (availableUpgrades.length > 0) {
        const choices = availableUpgrades.sort(() => Math.random() - 0.5).slice(0, 3);

        if (fastAutoMode) {
            const choice = choices[0];
            choice.skill.curLvl++;
            addFloatingText(`✨ ${choice.skill.name} Lvl ${choice.skill.curLvl}!`, choice.die.q, choice.die.r, '#fbbf24', 20);
            SFX.powerUp();
        } else {
            await new Promise(resolve => {
                window._chooseUpgrade = function(idx) {
                    const choice = choices[idx];
                    choice.skill.curLvl++;
                    addFloatingText(`✨ ${choice.skill.name} Lvl ${choice.skill.curLvl}!`, choice.die.q, choice.die.r, '#fbbf24', 20);
                    SFX.powerUp();
                    hideOverlay();
                    resolve();
                };

                const html = `
                    <div class="overlay-box">
                        <h2>⚡ ROGUELIKE UPGRADE ⚡</h2>
                        <p style="color:var(--text-dim);margin-bottom:12px;">Wave ${game.wave} reached! Pick 1 skill upgrade for your dice:</p>
                        <div class="upgrade-cards-grid">
                            ${choices.map((c, i) => `
                                <div class="upgrade-card-item" onclick="_chooseUpgrade(${i})">
                                    <span class="upgrade-icon">${c.die.icon}</span>
                                    <div class="upgrade-info">
                                        <div class="upgrade-name">D${c.dieIndex} (${c.die.archetype.toUpperCase()}) - ${c.skill.name}</div>
                                        <div class="upgrade-desc">${c.skill.desc}</div>
                                    </div>
                                    <span class="upgrade-badge">Lvl ${c.skill.curLvl + 1}/${c.skill.maxLvl}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
                showOverlay(html);
            });
        }
    }

    // --- CPU AUTO-UPGRADE ---
    const cpuAlive = aliveDice('cpu');
    const cpuUpgrades = [];
    cpuAlive.forEach(die => {
        die.skills.forEach(skill => {
            if (skill.curLvl < skill.maxLvl) {
                cpuUpgrades.push({ die, skill });
            }
        });
    });
    if (cpuUpgrades.length > 0) {
        const pick = cpuUpgrades[Math.floor(Math.random() * cpuUpgrades.length)];
        pick.skill.curLvl++;
        addFloatingText(`🔴 CPU: ${pick.skill.name} Lvl ${pick.skill.curLvl}!`, pick.die.q, pick.die.r, '#ef4444', 18);
        SFX.powerUp();
        await delay(800);
    }
    updateDiceHP();
}

function spawnEventTiles() {
    const occupied = new Set();
    for (const d of allDice()) { if (d.hp > 0) occupied.add(hKey(d.q, d.r)); }
    for (const k of game.blocks.keys()) occupied.add(k);
    for (const k of game.voidTiles.keys()) occupied.add(k);
    for (const k of game.eventTiles.keys()) occupied.add(k);

    const available = allHexes.filter(h => !occupied.has(hKey(h.q, h.r)));
    const shuffled = available.sort(() => Math.random() - 0.5);
    const count = Math.min(EVENT_TILES_PER_SPAWN, shuffled.length);

    for (let i = 0; i < count; i++) {
        game.eventTiles.set(hKey(shuffled[i].q, shuffled[i].r), { wavesLeft: 2 });
    }

    if (count > 0) {
        setMessage(`✨ ${count} event tiles appeared on the arena!`);
        for (let i = 0; i < count; i++) {
            const p = hexToPixel(shuffled[i].q, shuffled[i].r);
            spawnParticles(p.x + gridCenterX, p.y + gridCenterY, '#fbbf24', 15, 2, 1000, 3);
        }
    }
}

function checkEventTilePickup(die) {
    const key = hKey(die.q, die.r);
    if (!game.eventTiles.has(key)) return;

    game.eventTiles.delete(key);
    const hand = die.team === 'player' ? game.playerHand : game.cpuHand;
    const maxH = getMaxHandSize(die.team);

    if (hand.length >= maxH) {
        addFloatingText('Hand Full!', die.q, die.r, '#fbbf24', 14);
        return;
    }

    const card = randomCard(die.team);
    hand.push(card);
    SFX.cardGet();

    const p = hexToPixel(die.q, die.r);
    spawnParticles(p.x + gridCenterX, p.y + gridCenterY, '#fbbf24', 20, 3, 800, 4);
    addFloatingText(`🃏 ${card.name}!`, die.q, die.r, '#fbbf24', 16);

    if (die.team === 'player') {
        showCardPopup(card, 'player');
    }
    updateCardHand();
}

async function triggerArenaBlitz() {
    const blitzTypes = ['tornado', 'void', 'burning', 'vine', 'bees', 'magician'];
    const chosen = blitzTypes[Math.floor(Math.random() * blitzTypes.length)];

    switch (chosen) {
        case 'tornado': {
            showBlitzAnnouncement('🌪️ TORNADO BLITZ!', 'All dice positions are randomized!');
            await delay(1500);
            const active = allDice().filter(d => d.hp > 0);
            const available = allHexes.filter(h => !isBlocked(h.q, h.r)).sort(() => Math.random() - 0.5);
            active.forEach((d, i) => {
                if (available[i]) {
                    d.q = available[i].q;
                    d.r = available[i].r;
                    const p = hexToPixel(d.q, d.r);
                    spawnParticles(p.x + gridCenterX, p.y + gridCenterY, '#818cf8', 20, 4, 800, 4);
                    triggerTileEffectOnDie(d);
                }
            });
            break;
        }
        case 'void': {
            showBlitzAnnouncement('🕳️ VOID TILES BLITZ!', '5-8 tiles collapse into the void for 3 waves!');
            await delay(1500);
            const available = allHexes.filter(h => !getDieAt(h.q, h.r)).sort(() => Math.random() - 0.5);
            const count = Math.floor(Math.random() * 4) + 5; // 5 to 8
            for (let i = 0; i < Math.min(count, available.length); i++) {
                game.voidTiles.set(hKey(available[i].q, available[i].r), { wavesLeft: 3 });
            }
            break;
        }
        case 'burning': {
            showBlitzAnnouncement('🔥 BURNING TILES BLITZ!', '3-5 tiles catch fire! Crossing them deals 3 damage!');
            await delay(1500);
            const available = allHexes.filter(h => !isBlocked(h.q, h.r)).sort(() => Math.random() - 0.5);
            const count = Math.floor(Math.random() * 3) + 3;
            for (let i = 0; i < Math.min(count, available.length); i++) {
                game.burningTiles.set(hKey(available[i].q, available[i].r), { wavesLeft: 3 });
            }
            // If any dice currently stand on newly spawned burning tiles, trigger damage immediately
            for (const d of allDice()) {
                if (d.hp > 0) triggerTileEffectOnDie(d);
            }
            break;
        }
        case 'vine': {
            showBlitzAnnouncement('🌿 VINE TRAP BLITZ!', '2 tiles sprout vines! Dice on them are trapped for 2 waves!');
            await delay(1500);
            const available = allHexes.filter(h => !isBlocked(h.q, h.r)).sort(() => Math.random() - 0.5);
            for (let i = 0; i < Math.min(2, available.length); i++) {
                const k = hKey(available[i].q, available[i].r);
                game.vineTraps.set(k, { wavesLeft: 2 });
                const occupant = getDieAt(available[i].q, available[i].r);
                if (occupant) occupant.trapped = 2;
            }
            break;
        }
        case 'bees': {
            showBlitzAnnouncement('🐝 BEE ATTACK BLITZ!', '5 killer bees enter the arena for 3 waves!');
            await delay(1500);
            const available = allHexes.filter(h => !getDieAt(h.q, h.r) && !isBlocked(h.q, h.r)).sort(() => Math.random() - 0.5);
            for (let i = 0; i < Math.min(5, available.length); i++) {
                game.bees.push({ id: Math.random(), q: available[i].q, r: available[i].r, wavesLeft: 3 });
            }
            break;
        }
        case 'magician': {
            showBlitzAnnouncement('🧙 MAGICIAN BLITZ!', 'The Magician grants 2 random cards to everyone!');
            await delay(1500);
            const maxP = getMaxHandSize('player');
            const maxC = getMaxHandSize('cpu');
            for (let i = 0; i < 2; i++) {
                if (game.playerHand.length < maxP) game.playerHand.push(randomCard('player'));
                if (game.cpuHand.length < maxC) game.cpuHand.push(randomCard('cpu'));
            }
            updateCardHand();
            break;
        }
    }
    await delay(1000);
}

// Instantaneous tile effect trigger helper
function triggerTileEffectOnDie(die) {
    if (!die || die.hp <= 0) return;
    const k = hKey(die.q, die.r);

    if (game.burningTiles && game.burningTiles.has(k)) {
        die.hp -= 3;
        die.totalDamageTaken = (die.totalDamageTaken || 0) + 3;
        die.damagedThisWave = true;
        if (die.hp < 0) die.hp = 0;

        const backLvl = getSkillLevel(die, 'backStronger');
        if (backLvl > 0 || die.archetype === 'Rage') {
            const reqDmg = backLvl === 2 ? 9 : backLvl === 3 ? 7 : 10;
            const newBonus = Math.floor(die.totalDamageTaken / reqDmg);
            if (newBonus > (die.bonusDamageFromDamageTaken || 0)) {
                const diff = newBonus - (die.bonusDamageFromDamageTaken || 0);
                die.bonusDamageFromDamageTaken = newBonus;
                addFloatingText(`😡 Rage +${diff} DMG!`, die.q, die.r, '#ef4444', 18);
            }
        }

        addFloatingText('-3 🔥', die.q, die.r, '#ef4444', 18);
        updateDiceHP();
        if (checkWin()) return;
    }

    if (game.vineTraps && game.vineTraps.has(k)) {
        die.trapped = 2;
        die.moveAllowance = 0;
        addFloatingText('🌿 Trapped!', die.q, die.r, '#84cc16', 20);
        SFX.block();
        updateDiceHP();
    }

    // Check bee collision on this tile
    if (game.bees) {
        for (const bee of game.bees) {
            if (bee.q === die.q && bee.r === die.r && die.concealed === 0) {
                die.hp -= 5;
                die.totalDamageTaken = (die.totalDamageTaken || 0) + 5;
                die.damagedThisWave = true;
                die.moveDebuff = Math.max(die.moveDebuff, 1);
                if (die.hp < 0) die.hp = 0;
                addFloatingText('-5 🐝', die.q, die.r, '#fbbf24', 20);
                SFX.attack();
                updateDiceHP();
                if (checkWin()) return;
            }
        }
    }

    // Check zombie collision on this tile
    if (game.zombies) {
        for (const zombie of game.zombies) {
            if (zombie.q === die.q && zombie.r === die.r && zombie.team !== die.team && die.concealed === 0) {
                die.hp -= zombie.damage;
                die.totalDamageTaken = (die.totalDamageTaken || 0) + zombie.damage;
                die.damagedThisWave = true;
                if (die.hp < 0) die.hp = 0;
                addFloatingText(`-${zombie.damage} 🧟`, die.q, die.r, '#10b981', 20);
                SFX.attack();
                updateDiceHP();
                if (checkWin()) return;
            }
        }
    }
}

async function processBeesMovement() {
    if (!game.bees || game.bees.length === 0) return;
    const activeDice = allDice().filter(d => d.hp > 0 && d.concealed === 0);
    if (activeDice.length === 0) return;

    for (const bee of game.bees) {
        let closestDie = activeDice[0];
        let minDist = hexDist(bee.q, bee.r, closestDie.q, closestDie.r);
        for (const d of activeDice) {
            const dist = hexDist(bee.q, bee.r, d.q, d.r);
            if (dist < minDist) { minDist = dist; closestDie = d; }
        }

        const steps = Math.min(2, Math.max(1, minDist));
        for (let s = 0; s < steps; s++) {
            const neighbors = getNeighbors(bee.q, bee.r);
            neighbors.sort((a, b) => hexDist(a.q, a.r, closestDie.q, closestDie.r) - hexDist(b.q, b.r, closestDie.q, closestDie.r));
            if (neighbors.length > 0) {
                bee.q = neighbors[0].q;
                bee.r = neighbors[0].r;
            }

            if (bee.q === closestDie.q && bee.r === closestDie.r) {
                closestDie.hp -= 5;
                closestDie.totalDamageTaken = (closestDie.totalDamageTaken || 0) + 5;
                closestDie.damagedThisWave = true;
                closestDie.moveDebuff = Math.max(closestDie.moveDebuff, 1);
                if (closestDie.hp < 0) closestDie.hp = 0;

                const beeBackLvl = getSkillLevel(closestDie, 'backStronger');
                if (beeBackLvl > 0 || closestDie.archetype === 'Rage') {
                    const reqDmg = beeBackLvl === 2 ? 9 : beeBackLvl === 3 ? 7 : 10;
                    const newBonus = Math.floor(closestDie.totalDamageTaken / reqDmg);
                    if (newBonus > (closestDie.bonusDamageFromDamageTaken || 0)) {
                        const diff = newBonus - (closestDie.bonusDamageFromDamageTaken || 0);
                        closestDie.bonusDamageFromDamageTaken = newBonus;
                        addFloatingText(`😡 Rage +${diff} DMG!`, closestDie.q, closestDie.r, '#ef4444', 18);
                    }
                }

                addFloatingText('-5 🐝', bee.q, bee.r, '#fbbf24', 20);
                SFX.attack();
                updateDiceHP();
                if (checkWin()) return;
                break;
            }
        }
    }
}

async function processZombiesMovement() {
    if (!game.zombies || game.zombies.length === 0) return;

    for (const zombie of game.zombies) {
        const enemyTeam = zombie.team === 'player' ? 'cpu' : 'player';
        const targetDice = aliveDice(enemyTeam).filter(d => d.concealed === 0);
        if (targetDice.length === 0) continue;

        // Choose target die (persists or picks nearest)
        let targetDie = targetDice[Math.floor(Math.random() * targetDice.length)];

        // Move 3 tiles per turn towards enemy die
        const steps = 3;
        for (let s = 0; s < steps; s++) {
            if (zombie.q === targetDie.q && zombie.r === targetDie.r) break;

            const neighbors = getNeighbors(zombie.q, zombie.r).filter(n => !isBlocked(n.q, n.r));
            neighbors.sort((a, b) => hexDist(a.q, a.r, targetDie.q, targetDie.r) - hexDist(b.q, b.r, targetDie.q, targetDie.r));
            if (neighbors.length > 0) {
                zombie.q = neighbors[0].q;
                zombie.r = neighbors[0].r;
            }

            if (zombie.q === targetDie.q && zombie.r === targetDie.r) {
                targetDie.hp -= zombie.damage;
                targetDie.totalDamageTaken = (targetDie.totalDamageTaken || 0) + zombie.damage;
                targetDie.damagedThisWave = true;
                if (targetDie.hp < 0) targetDie.hp = 0;

                const backLvl = getSkillLevel(targetDie, 'backStronger');
                if (backLvl > 0 || targetDie.archetype === 'Rage') {
                    const reqDmg = backLvl === 2 ? 9 : backLvl === 3 ? 7 : 10;
                    const newBonus = Math.floor(targetDie.totalDamageTaken / reqDmg);
                    if (newBonus > (targetDie.bonusDamageFromDamageTaken || 0)) {
                        const diff = newBonus - (targetDie.bonusDamageFromDamageTaken || 0);
                        targetDie.bonusDamageFromDamageTaken = newBonus;
                        addFloatingText(`😡 Rage +${diff} DMG!`, targetDie.q, targetDie.r, '#ef4444', 18);
                    }
                }

                addFloatingText(`-${zombie.damage} 🧟`, zombie.q, zombie.r, '#10b981', 20);
                SFX.attack();
                updateDiceHP();
                if (checkWin()) return;
                break;
            }
        }
    }
}
