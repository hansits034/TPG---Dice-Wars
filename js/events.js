// ==========================================================
// 12. ARENA BLITZ, EVENT TILES, ROGUELIKE UPGRADES & MINIONS
// ==========================================================
async function triggerRoguelikeUpgrade() {
    stopTurnTimer();
    SFX.powerUp();

    // --- PLAYER UPGRADE ---
    // Mind-controlled enemies and temporary clones are not eligible for permanent upgrades
    const playerAlive = aliveDice('player').filter(d => !d.isMindControlled && !d.isCloneDie);
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
            fxLevelUp(choice.die);
            addFloatingText(`✨ ${choice.skill.name} Lvl ${choice.skill.curLvl}!`, choice.die.q, choice.die.r, '#fbbf24', 20);
            SFX.powerUp();
        } else {
            showTip('upgrade');
            await new Promise(resolve => {
                window._chooseUpgrade = function(idx) {
                    const choice = choices[idx];
                    choice.skill.curLvl++;
                    fxLevelUp(choice.die);
                    addFloatingText(`✨ ${choice.skill.name} Lvl ${choice.skill.curLvl}!`, choice.die.q, choice.die.r, '#fbbf24', 20);
                    SFX.powerUp();
                    hideOverlay();
                    resolve();
                };

                const html = `
                    <div class="overlay-box">
                        <div class="overlay-icon gold">${iconSVG('star')}</div>
                        <h2>Choose an upgrade</h2>
                        <p>Wave ${game.wave} reached. Pick one skill to level up.</p>
                        <div class="upgrade-cards-grid">
                            ${choices.map((c, i) => `
                                <button class="upgrade-card-item" onclick="_chooseUpgrade(${i})">
                                    ${classBadge(c.die.archetype, 'lg')}
                                    <div class="upgrade-info">
                                        <div class="upgrade-name">${c.skill.name}<small>${archName(c.die.archetype)}, die ${c.dieIndex}</small></div>
                                        <div class="upgrade-desc">${c.skill.desc}</div>
                                    </div>
                                    <span class="upgrade-badge">${c.skill.curLvl === 0 ? 'Unlock' : 'Level ' + (c.skill.curLvl + 1)}</span>
                                </button>
                            `).join('')}
                        </div>
                    </div>
                `;
                showOverlay(html);
            });
        }
    }

    // --- CPU AUTO-UPGRADE ---
    const cpuAlive = aliveDice('cpu').filter(d => !d.isMindControlled && !d.isCloneDie);
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
        fxLevelUp(pick.die);
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

    const now = performance.now();
    for (let i = 0; i < count; i++) {
        // crystals drop in one after another (see drawEventCrystal)
        game.eventTiles.set(hKey(shuffled[i].q, shuffled[i].r), { wavesLeft: 2, bornAt: now + i * 220 });
        const h = shuffled[i];
        matchTimeout(() => {
            const p = hexScreen(h.q, h.r);
            spawnParticles(p.x, p.y, '#F2B84B', 14, 2, 900, 3);
            SFX.cardGet();
        }, i * 220 + 450);
    }

    if (count > 0) setMessage(`${count} card crystals dropped onto the arena. Step on one to draw a card.`);
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
        showTip('cards');
    }
    updateCardHand();
}

function shakeBoard(ms = 450) {
    const wrap = document.getElementById('canvas-wrapper');
    if (!wrap) return;
    wrap.classList.remove('shake');
    void wrap.offsetWidth;
    wrap.classList.add('shake');
    setTimeout(() => wrap.classList.remove('shake'), ms);
}

// ---------- hazard variants ----------
// Damaging tiles (stored in game.burningTiles, `kind` picks the variant)
const HAZARD_KINDS = {
    fire:   { dmg: 3, label: 'Burning', color: '#FF8A3D' },
    spikes: { dmg: 4, label: 'Spikes', color: '#C9C4DA' },
    bio:    { dmg: 2, label: 'Toxic', color: '#9BE35A', poison: 2 },
};
// Snare tiles (stored in game.vineTraps)
const SNARE_KINDS = {
    vines:  { text: 'Rooted!', color: '#9BE07A' },
    medusa: { text: 'Petrified for 2 rounds!', color: '#C9C4DA' },
    snow:   { text: 'Frozen solid for 2 rounds!', color: '#BFE6FF' },
};
// Roaming creatures (stored in game.bees)
const SWARM_KINDS = {
    bee:   { steps: 2, dmg: 5, label: 'Sting', color: '#F2B84B' },
    mummy: { steps: 1, dmg: 7, label: 'Mummy curse', color: '#E9DCC0' },
    robot: { steps: 2, dmg: 6, label: 'Laser', color: '#7EC8F2' },
};
const pickOne = arr => arr[Math.floor(Math.random() * arr.length)];

function applySwarmHit(unit, die) {
    const k = SWARM_KINDS[unit.kind || 'bee'];
    applyIndirectDamage(die, brutalDamage(k.dmg, unit.brutal), unit.brutal ? `Brutal ${k.label}` : k.label, k.color);
    if ((unit.kind || 'bee') === 'bee') die.moveDebuff = Math.max(die.moveDebuff, 1);
    if (unit.kind === 'mummy') { die.antiHealTurns = Math.max(die.antiHealTurns, 2); addFloatingText('Cursed: no healing', die.q, die.r, '#E9DCC0', 14); }
    if (unit.kind === 'robot') { const p = dieFxPos(die); fxRing(p.x, p.y + HEX_SIZE * 0.3, '#7EC8F2', HEX_SIZE * 1.2, 400, 4); }
    SFX.attack();
    updateDiceHP();
}

// Remembers where a creature came from so the renderer can animate its step
function stepCreature(unit, q, r) {
    unit.fromQ = unit.q; unit.fromR = unit.r; unit.movedAt = performance.now();
    unit.q = q; unit.r = r;
}

// Shift every tile feature and unit one hex in `dir` (earthquake)
function shiftArena(dir) {
    const shiftMap = (map) => {
        if (!map) return map;
        const out = new Map();
        for (const [k, v] of map) {
            const { q, r } = parseKey(k);
            const nq = q + dir.q, nr = r + dir.r;
            if (isValidHex(nq, nr)) out.set(hKey(nq, nr), v);
        }
        return out;
    };
    game.eventTiles = shiftMap(game.eventTiles);
    game.burningTiles = shiftMap(game.burningTiles);
    game.vineTraps = shiftMap(game.vineTraps);
    game.bearTraps = shiftMap(game.bearTraps);
    game.blocks = shiftMap(game.blocks);
    game.voidTiles = shiftMap(game.voidTiles);

    // dice furthest along the direction move first so they don't block each other
    const dice = allDice().filter(d => d.hp > 0).sort((a, b) => (b.q * dir.q + b.r * dir.r) - (a.q * dir.q + a.r * dir.r));
    const moved = [];
    for (const d of dice) {
        const nq = d.q + dir.q, nr = d.r + dir.r;
        if (!isValidHex(nq, nr) || isBlocked(nq, nr) || getDieAt(nq, nr)) continue;
        const oq = d.q, or = d.r;
        d.q = nq; d.r = nr; d.movedThisWave = true;
        startSlide(d, oq, or, 600, 0.15);
        moved.push({ d, oq, or });
    }
    for (const unit of [...(game.bees || []), ...(game.zombies || [])]) {
        const nq = unit.q + dir.q, nr = unit.r + dir.r;
        if (isValidHex(nq, nr)) stepCreature(unit, nq, nr);
    }
    return moved;
}

// Arena events: a short banner, then one of three variants plays out on the board
async function triggerArenaBlitz() {
    showTip('event');
    const blitzTypes = ['tornado', 'void', 'burning', 'vine', 'bees', 'magician'];
    const chosen = blitzTypes[Math.floor(Math.random() * blitzTypes.length)];
    const now = () => performance.now();
    // brutal waves: more tiles, double damage, longer traps (see config.js)
    const brutal = isBrutalWave(game.wave);
    const range = (a, b) => `${brutalTiles(a, brutal)} to ${brutalTiles(b, brutal)}`;

    switch (chosen) {
        case 'tornado': {
            const variant = pickOne(['tornado', 'alien', 'quake']);
            if (variant === 'tornado') {
                showBlitzAnnouncement('Tornado', 'Every die gets thrown to a new tile.');
                await delay(600);
                addBoardFx('tornado', 2200);
                SFX.wind();
                await delay(500);
                const active = allDice().filter(d => d.hp > 0);
                const available = allHexes.filter(h => !isBlocked(h.q, h.r)).sort(() => Math.random() - 0.5);
                const moved = [];
                active.forEach((d, i) => {
                    if (!available[i]) return;
                    const oldQ = d.q, oldR = d.r;
                    d.q = available[i].q; d.r = available[i].r;
                    d.movedThisWave = true;
                    startSlide(d, oldQ, oldR, 1000, 1.2, i * 90, true);
                    moved.push({ d, oldQ, oldR });
                });
                await delay(1000 + active.length * 90);
                for (const { d, oldQ, oldR } of moved) {
                    const p = hexScreen(d.q, d.r);
                    spawnParticles(p.x, p.y + HEX_SIZE * 0.3, '#C9A77C', 10, 2, 600, 3);
                    applyForcedMoveBleed(d, hexDist(oldQ, oldR, d.q, d.r));
                    triggerTileEffectOnDie(d);
                }
            } else if (variant === 'alien') {
                showBlitzAnnouncement('Alien visit', 'A saucer beams up a few dice and drops them somewhere else.');
                await delay(600);
                const victims = allDice().filter(d => d.hp > 0).sort(() => Math.random() - 0.5).slice(0, brutalTiles(2 + Math.floor(Math.random() * 3), brutal));
                addBoardFx('ufo', 900 + victims.length * 650 + 700);
                SFX.alien();
                await delay(700);
                for (const d of victims) {
                    const spots = allHexes.filter(h => !isBlocked(h.q, h.r) && !getDieAt(h.q, h.r));
                    if (!spots.length) break;
                    const to = pickOne(spots);
                    const from = dieFxPos(d);
                    addBoardFx('tractor', 520, { x: from.x, y: from.y });
                    SFX.teleport();
                    await delay(380);
                    const oldQ = d.q, oldR = d.r;
                    d.q = to.q; d.r = to.r; d.movedThisWave = true;
                    d.popAt = performance.now();
                    const p = hexScreen(to.q, to.r);
                    fxRing(p.x, p.y + HEX_SIZE * 0.25, '#9BE35A', HEX_SIZE * 1.5, 500, 5);
                    spawnParticles(p.x, p.y, '#C8FF9E', 14, 2.5, 600, 3);
                    applyForcedMoveBleed(d, hexDist(oldQ, oldR, d.q, d.r));
                    triggerTileEffectOnDie(d);
                    updateDiceHP();
                    await delay(270);
                }
                await delay(500);
            } else {
                showBlitzAnnouncement('Earthquake', 'The whole arena slides one tile over.');
                await delay(600);
                const dir = pickOne(DIRS);
                addBoardFx('quake', 1600);
                SFX.quake();
                shakeBoard(1200);
                await delay(400);
                const moved = shiftArena(dir);
                for (let i = 0; i < 18; i++) {
                    const h = pickOne(allHexes);
                    const p = hexScreen(h.q, h.r);
                    spawnParticles(p.x, p.y + HEX_SIZE * 0.3, '#B89A74', 3, 1.5, 700, 3);
                }
                await delay(800);
                for (const { d, oq, or } of moved) {
                    applyForcedMoveBleed(d, hexDist(oq, or, d.q, d.r));
                    triggerTileEffectOnDie(d);
                }
            }
            updateDiceHP();
            break;
        }
        case 'void': {
            const variant = pickOne(['hole', 'mountain', 'acid']);
            const text = {
                hole: ['Collapse', `${range(5, 8)} tiles fall into the void for 3 waves.`],
                mountain: ['Rockslide', `Mountains burst out of ${range(5, 8)} tiles and block them for 3 waves.`],
                acid: ['Acid flood', `Acid pools seal off ${range(5, 8)} tiles for 3 waves.`],
            }[variant];
            showBlitzAnnouncement(text[0], text[1]);
            await delay(600);
            const available = allHexes.filter(h => !getDieAt(h.q, h.r) && !isBlocked(h.q, h.r)).sort(() => Math.random() - 0.5);
            const count = Math.min(brutalTiles(Math.floor(Math.random() * 4) + 5, brutal), available.length); // 5 to 8 (+50% when brutal)
            if (variant !== 'acid') shakeBoard(900);
            for (let i = 0; i < count; i++) {
                const h = available[i];
                game.voidTiles.set(hKey(h.q, h.r), { wavesLeft: 3, bornAt: now() + i * 110, kind: variant, brutal });
                matchTimeout(() => {
                    const p = hexScreen(h.q, h.r);
                    if (variant === 'acid') { spawnParticles(p.x, p.y, '#B6F24A', 12, 2, 700, 3); SFX.bubble(); }
                    else { spawnParticles(p.x, p.y, variant === 'mountain' ? '#9D99B2' : '#7B6A57', 12, 2.5, 700, 3.5); SFX.crumble(); }
                }, i * 110 + 250);
            }
            await delay(count * 110 + 700);
            break;
        }
        case 'burning': {
            const variant = pickOne(['fire', 'spikes', 'bio']);
            const text = {
                fire: ['Wildfire', `${range(3, 5)} tiles catch fire. Touching them deals ${brutalDamage(3, brutal)} damage.`],
                spikes: ['Spike traps', `${range(3, 5)} tiles sprout spikes. Touching them deals ${brutalDamage(4, brutal)} damage.`],
                bio: ['Biohazard leak', `${range(3, 5)} tiles leak toxin: ${brutalDamage(2, brutal)} damage and no healing for 2 turns.`],
            }[variant];
            showBlitzAnnouncement(text[0], text[1]);
            await delay(600);
            const available = allHexes.filter(h => !isBlocked(h.q, h.r)).sort(() => Math.random() - 0.5);
            const count = Math.min(brutalTiles(Math.floor(Math.random() * 3) + 3, brutal), available.length);
            for (let i = 0; i < count; i++) {
                const h = available[i];
                game.burningTiles.set(hKey(h.q, h.r), { wavesLeft: 3, bornAt: now() + i * 160, kind: variant, brutal });
                matchTimeout(() => {
                    const p = hexScreen(h.q, h.r);
                    spawnParticles(p.x, p.y, HAZARD_KINDS[variant].color, 14, 2.5, 800, 3);
                    if (variant === 'spikes') SFX.block(); else if (variant === 'bio') SFX.bubble(); else SFX.ignite();
                }, i * 160);
            }
            await delay(count * 160 + 700);
            // Dice already standing on a new hazard take damage now
            for (const d of allDice()) {
                if (d.hp > 0) triggerTileEffectOnDie(d);
            }
            break;
        }
        case 'vine': {
            const variant = pickOne(['vines', 'medusa', 'snow']);
            const text = {
                vines: ['Vines', `${brutalTiles(2, brutal)} tiles sprout vines that root any die for ${brutalTrap(2, brutal)} turns.`],
                medusa: ["Medusa's gaze", `${brutalTiles(2, brutal)} tiles turn to stone. Any die on them is petrified for ${brutalTrap(2, brutal)} rounds.`],
                snow: ['Snowstorm', `${brutalTiles(3, brutal)} tiles freeze over. Any die on them is frozen solid for ${brutalTrap(2, brutal)} rounds.`],
            }[variant];
            showBlitzAnnouncement(text[0], text[1]);
            await delay(600);
            if (variant === 'snow') { addBoardFx('snowfall', 3200); SFX.wind(); }
            if (variant === 'medusa') { addBoardFx('medusa', 1800); SFX.magic(); }
            const available = allHexes.filter(h => !isBlocked(h.q, h.r)).sort(() => Math.random() - 0.5);
            const count = brutalTiles(variant === 'snow' ? 3 : 2, brutal);
            for (let i = 0; i < Math.min(count, available.length); i++) {
                const h = available[i];
                game.vineTraps.set(hKey(h.q, h.r), { wavesLeft: brutalTrap(2, brutal), bornAt: now() + i * 300, kind: variant, brutal });
                matchTimeout(() => {
                    const p = hexScreen(h.q, h.r);
                    spawnParticles(p.x, p.y, SNARE_KINDS[variant].color, 12, 2, 700, 3);
                    SFX.block();
                    const occupant = getDieAt(h.q, h.r);
                    if (occupant) { triggerTileEffectOnDie(occupant); updateDiceHP(); }
                }, i * 300 + 400);
            }
            await delay(variant === 'snow' ? 1900 : 1400);
            break;
        }
        case 'bees': {
            const variant = pickOne(['bee', 'mummy', 'robot']);
            const text = {
                bee: ['Bee swarm', `${brutalTiles(5, brutal)} bees join for 3 waves: ${brutalDamage(5, brutal)} damage and -1 move.`],
                mummy: ['Mummy attack', `${brutalTiles(3, brutal)} mummies rise for 3 waves: slow, ${brutalDamage(7, brutal)} damage and a healing curse.`],
                robot: ['Killer robots', `${brutalTiles(3, brutal)} robots drop in for 3 waves and hunt the weakest die for ${brutalDamage(6, brutal)} damage.`],
            }[variant];
            showBlitzAnnouncement(text[0], text[1]);
            await delay(600);
            const count = brutalTiles(variant === 'bee' ? 5 : 3, brutal);
            const available = allHexes.filter(h => !getDieAt(h.q, h.r) && !isBlocked(h.q, h.r)).sort(() => Math.random() - 0.5);
            if (variant === 'bee') SFX.buzz(); else if (variant === 'robot') SFX.robot(); else SFX.crumble();
            for (let i = 0; i < Math.min(count, available.length); i++) {
                const unit = { id: Math.random(), q: available[i].q, r: available[i].r, wavesLeft: 3, kind: variant, bornAt: now() + i * 160, brutal };
                if (variant === 'bee') {
                    const a = Math.random() * Math.PI * 2, rad = Math.max(canvas.width, canvas.height) * 0.6;
                    unit.fromX = gridCenterX + Math.cos(a) * rad; unit.fromY = gridCenterY + Math.sin(a) * rad;
                } else if (variant === 'robot') {
                    const p = hexScreen(unit.q, unit.r);
                    unit.fromX = p.x; unit.fromY = p.y - canvas.height; // drops from the sky
                }
                game.bees.push(unit);
                if (variant === 'mummy') matchTimeout(() => { const p = hexScreen(unit.q, unit.r); spawnChunks(p.x, p.y + HEX_SIZE * 0.3, '#B89A74', 8, 2.5); }, i * 160);
                if (variant === 'robot') matchTimeout(() => { const p = hexScreen(unit.q, unit.r); fxRing(p.x, p.y + HEX_SIZE * 0.3, '#7EC8F2', HEX_SIZE * 1.3, 450, 5); shakeBoard(200); }, i * 160 + 900);
            }
            await delay(1900);
            break;
        }
        case 'magician': {
            showBlitzAnnouncement('The Magician', 'Both sides draw 2 random cards.');
            await delay(500);
            addBoardFx('magician', 2400);
            SFX.magic();
            await delay(1100);
            const maxP = getMaxHandSize('player');
            const maxC = getMaxHandSize('cpu');
            for (let i = 0; i < 2; i++) {
                if (game.playerHand.length < maxP) game.playerHand.push(randomCard('player'));
                if (game.cpuHand.length < maxC) game.cpuHand.push(randomCard('cpu'));
            }
            SFX.cardGet();
            updateCardHand();
            await delay(1300);
            break;
        }
    }
    await delay(300);
}

// A zombie bite counts as damage dealt by the necromancer that raised it
function zombieHit(zombie, die) {
    const owner = allDice().find(d => d.id === zombie.ownerId);
    const dealt = applyIndirectDamage(die, zombie.damage, 'Zombie', '#10b981');
    if (owner && dealt > 0) creditDamageDealt(owner, dealt);
    const who = owner ? `${owner.team === 'cpu' ? 'CPU ' : ''}${archName(owner.archetype)}` : 'A necromancer';
    addCombatLog(`${who}'s zombie bit ${archName(die.archetype)} for ${dealt} DMG`, '', '#10b981');
    SFX.attack();
    updateDiceHP();
    return dealt;
}

// Instantaneous tile effect trigger helper
function triggerTileEffectOnDie(die) {
    if (!die || die.hp <= 0) return;
    const k = hKey(die.q, die.r);

    if (game.burningTiles && game.burningTiles.has(k)) {
        const kind = game.burningTiles.get(k).kind || 'fire';
        const hz = HAZARD_KINDS[kind] || HAZARD_KINDS.fire;
        if (die.team === 'player') showTip('hazard');
        const hzItem = game.burningTiles.get(k);
        applyIndirectDamage(die, brutalDamage(hz.dmg, hzItem.brutal), hzItem.brutal ? `Brutal ${hz.label}` : hz.label, hz.color);
        if (hz.poison) die.antiHealTurns = Math.max(die.antiHealTurns, hz.poison);
        if (checkWin()) return;
    }

    if (game.vineTraps && game.vineTraps.has(k)) {
        const kind = game.vineTraps.get(k).kind || 'vines';
        const sn = SNARE_KINDS[kind] || SNARE_KINDS.vines;
        if (die.team === 'player') showTip('hazard');
        die.moveAllowance = 0;
        // Frozen ticks down at the start of each of the die's own turns, so 3 keeps it locked
        // for at least its next 2 turns (2 full rounds), whether it steps on the tile or the tile appears under it
        const snItem = game.vineTraps.get(k);
        const lock = brutalTrap(2, snItem.brutal); // rounds the die stays stuck
        if (kind === 'medusa') { die.frozen = Math.max(die.frozen, lock + 1); die.petrified = true; die.trapped = 0; SFX.block(); }
        else if (kind === 'snow') { die.frozen = Math.max(die.frozen, lock + 1); die.petrified = false; die.moveDebuff = Math.max(die.moveDebuff, 1); SFX.freeze(); }
        else { die.trapped = Math.max(die.trapped, lock); SFX.block(); }
        addFloatingText(kind === 'vines' ? `Rooted for ${lock} turns!` : sn.text.replace('2 rounds', `${lock} rounds`), die.q, die.r, sn.color, 20);
        updateDiceHP();
    }

    // Check Bear Trap on this tile
    if (game.bearTraps && game.bearTraps.has(k)) {
        const trap = game.bearTraps.get(k);
        if (trap && trap.team !== die.team) {
            game.bearTraps.delete(k);
            applyIndirectDamage(die, 5, 'Bear Trap', '#ef4444');
            die.trapped = 2;
            die.moveAllowance = 0;
            addFloatingText('Bear trapped!', die.q, die.r, '#ef4444', 20);
            { const p = dieFxPos(die); spawnChunks(p.x, p.y + HEX_SIZE * 0.3, '#8E8AA3', 8, 2.5); }
            SFX.attack();
            updateDiceHP();
            if (checkWin()) return;
        }
    }

    // Roaming creatures on this tile
    if (game.bees) {
        for (const unit of game.bees) {
            if (unit.q === die.q && unit.r === die.r && die.concealed === 0) {
                applySwarmHit(unit, die);
                if (checkWin()) return;
            }
        }
    }

    // Check zombie collision on this tile
    if (game.zombies) {
        for (const zombie of game.zombies) {
            if (zombie.q === die.q && zombie.r === die.r && zombie.team !== die.team && die.concealed === 0) {
                zombieHit(zombie, die);
                if (checkWin()) return;
            }
        }
    }
}

async function processBeesMovement() {
    if (!game.bees || game.bees.length === 0) return;
    const activeDice = allDice().filter(d => d.hp > 0 && d.concealed === 0);
    if (activeDice.length === 0) return;

    for (const unit of game.bees) {
        const kind = SWARM_KINDS[unit.kind || 'bee'];
        // robots hunt the weakest die, everything else chases the nearest one
        const target = unit.kind === 'robot'
            ? activeDice.reduce((a, b) => (b.hp < a.hp ? b : a))
            : activeDice.reduce((a, b) => (hexDist(unit.q, unit.r, b.q, b.r) < hexDist(unit.q, unit.r, a.q, a.r) ? b : a));
        const dist = hexDist(unit.q, unit.r, target.q, target.r);
        const steps = Math.min(kind.steps, Math.max(1, dist));
        const startQ = unit.q, startR = unit.r;
        for (let s = 0; s < steps; s++) {
            const neighbors = getNeighbors(unit.q, unit.r).filter(n => unit.kind === 'bee' || !isBlocked(n.q, n.r));
            neighbors.sort((a, b) => hexDist(a.q, a.r, target.q, target.r) - hexDist(b.q, b.r, target.q, target.r));
            if (neighbors.length > 0) { unit.q = neighbors[0].q; unit.r = neighbors[0].r; }
            if (unit.q === target.q && unit.r === target.r) {
                applySwarmHit(unit, target);
                if (checkWin()) return;
                break;
            }
        }
        if (unit.q !== startQ || unit.r !== startR) {
            const endQ = unit.q, endR = unit.r;
            unit.q = startQ; unit.r = startR;
            stepCreature(unit, endQ, endR);
        }
    }
}

async function processZombiesMovement() {
    if (!game.zombies || game.zombies.length === 0) return;

    for (const zombie of game.zombies) {
        const enemyTeam = zombie.team === 'player' ? 'cpu' : 'player';
        const targetDice = aliveDice(enemyTeam).filter(d => d.concealed === 0);
        if (targetDice.length === 0) continue;

        // Chase the nearest enemy die
        const targetDie = targetDice.reduce((best, d) =>
            hexDist(zombie.q, zombie.r, d.q, d.r) < hexDist(zombie.q, zombie.r, best.q, best.r) ? d : best);

        // Move 3 tiles per turn towards enemy die
        const steps = 3;
        for (let s = 0; s < steps; s++) {
            if (zombie.q === targetDie.q && zombie.r === targetDie.r) break;

            const neighbors = getNeighbors(zombie.q, zombie.r).filter(n => !isBlocked(n.q, n.r));
            neighbors.sort((a, b) => hexDist(a.q, a.r, targetDie.q, targetDie.r) - hexDist(b.q, b.r, targetDie.q, targetDie.r));
            if (neighbors.length > 0) stepCreature(zombie, neighbors[0].q, neighbors[0].r);

            if (zombie.q === targetDie.q && zombie.r === targetDie.r) {
                zombieHit(zombie, targetDie);
                if (checkWin()) return;
                break;
            }
        }
    }
}
