// ==========================================================
// 5. PARTICLE SYSTEM & 8. CANVAS RENDERING
// ==========================================================
let particles = [];

function spawnParticles(x, y, color, count=12, speed=2, life=800, size=3) {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const spd = speed * (0.5 + Math.random());
        particles.push({
            x, y, vx: Math.cos(angle)*spd, vy: Math.sin(angle)*spd - 1,
            life, maxLife: life, color, size: size*(0.5+Math.random()),
            start: performance.now()
        });
    }
}

function spawnTrail(x, y, color, count=3, size=2) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x: x + (Math.random()-0.5)*6, y: y + (Math.random()-0.5)*6,
            vx: (Math.random()-0.5)*0.5, vy: -0.5-Math.random()*0.5,
            life: 400, maxLife: 400, color, size: size*(0.5+Math.random()),
            start: performance.now()
        });
    }
}

function updateAndDrawParticles(ctx, now) {
    particles = particles.filter(p => now - p.start < p.life);
    for (const p of particles) {
        const t = (now - p.start) / p.life;
        const alpha = 1 - t;
        p.x += p.vx; p.y += p.vy; p.vy += 0.02;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 - t * 0.5), 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}

function calcHexSize() {
    const maxW = window.innerWidth - 40;
    const maxH = window.innerHeight - 380;
    const sw = maxW / (SQRT3 * (2 * GRID_RADIUS + 1) + 1);
    const sh = maxH / (1.5 * (2 * GRID_RADIUS + 1) + 1);
    return Math.max(16, Math.min(38, Math.floor(Math.min(sw, sh))));
}

function setupCanvas() {
    HEX_SIZE = calcHexSize();
    const pad = HEX_SIZE * 2.5;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const h of allHexes) {
        const p = hexToPixel(h.q, h.r);
        minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
    const w = (maxX - minX) + pad * 2;
    const ht = (maxY - minY) + pad * 2;
    canvas.width = Math.ceil(w);
    canvas.height = Math.ceil(ht);
    gridCenterX = canvas.width / 2 - (minX + maxX) / 2;
    gridCenterY = canvas.height / 2 - (minY + maxY) / 2;
}

function drawHex(cx, cy, size, fill, stroke, lw) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const a = Math.PI / 180 * (60 * i - 30);
        const vx = cx + size * Math.cos(a);
        const vy = cy + size * Math.sin(a);
        i === 0 ? ctx.moveTo(vx, vy) : ctx.lineTo(vx, vy);
    }
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
}

function getDotPositions(val, cx, cy, s) {
    const o = s * 0.26;
    const tl = [cx - o, cy - o], tr = [cx + o, cy - o];
    const ml = [cx - o, cy], mr = [cx + o, cy], c = [cx, cy];
    const bl = [cx - o, cy + o], br = [cx + o, cy + o];
    const map = { 1:[c], 2:[tr,bl], 3:[tr,c,bl], 4:[tl,tr,bl,br], 5:[tl,tr,c,bl,br], 6:[tl,tr,ml,mr,bl,br] };
    return map[val] || [c];
}

function drawDieFace(cx, cy, size, value, bgColor, isSelected, rotation=0, alpha=1, isClone=false, icon='') {
    const s = size * 0.62;
    const r = s * 0.18;

    if (isClone) {
        ctx.save();
        ctx.globalAlpha = 0.55;
        ctx.translate(cx + 6, cy - 6);
        ctx.beginPath();
        ctx.roundRect(-s / 2, -s / 2, s, s, r);
        ctx.fillStyle = '#c084fc';
        ctx.fill();
        ctx.strokeStyle = '#e9d5ff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
    }

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx, cy);

    if (rotation !== 0) {
        const scaleX = Math.abs(Math.cos(rotation));
        ctx.scale(Math.max(0.05, scaleX), 1);
    }

    if (isSelected) {
        ctx.shadowColor = 'rgba(251,191,36,0.6)';
        ctx.shadowBlur = 14;
    }

    ctx.beginPath();
    ctx.roundRect(-s / 2, -s / 2, s, s, r);
    ctx.fillStyle = bgColor;
    ctx.fill();
    ctx.strokeStyle = isSelected ? '#fbbf24' : 'rgba(255,255,255,0.2)';
    ctx.lineWidth = isSelected ? 2.5 : 1.5;
    ctx.stroke();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    let displayVal = value;
    if (rotation !== 0) {
        const sc = Math.abs(Math.cos(rotation));
        if (sc < 0.3) displayVal = (Math.floor(performance.now() / 60) % 6) + 1;
    }

    if (displayVal <= 6) {
        const dots = getDotPositions(displayVal, 0, 0, s);
        const dotR = s * 0.1;
        ctx.fillStyle = '#fff';
        for (const [dx, dy] of dots) {
            ctx.beginPath();
            ctx.arc(dx, dy, dotR, 0, Math.PI * 2);
            ctx.fill();
        }
    } else {
        ctx.fillStyle = '#fff';
        ctx.font = `900 ${s * 0.55}px Outfit`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(displayVal, 0, 0);
    }

    ctx.restore();
}

function drawHPBar(cx, cy, width, hp, maxHp, team, alpha=1) {
    const h = 4, w = width * 0.62;
    const x = cx - w / 2, y = cy + width * 0.38;
    const pct = Math.max(0, hp / maxHp);
    const barColor = pct > 0.5 ? (team === 'player' ? '#34d399' : '#fb7185') :
        pct > 0.25 ? '#fbbf24' : '#ef4444';
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 2); ctx.fill();
    if (pct > 0) {
        ctx.fillStyle = barColor;
        ctx.beginPath(); ctx.roundRect(x, y, w * pct, h, 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
}

function drawMoveBadge(cx, cy, size, moves, team) {
    if (moves <= 0) return;
    const bx = cx + size * 0.28, by = cy - size * 0.38;
    const r = 7;
    ctx.fillStyle = 'rgba(251,191,36,0.9)';
    ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#000';
    ctx.font = '700 9px Outfit';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(moves, bx, by);
}

function drawStatusIcons(cx, cy, size, die) {
    let iconY = cy - size * 0.52;
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';

    ctx.fillText(die.icon, cx - size * 0.35, cy - size * 0.2);

    if (die.frozen > 0) { ctx.fillText('❄️', cx - 8, iconY); }
    if (die.trapped > 0) { ctx.fillText('🌿', cx, iconY); }
    if (die.bleedStacks > 0) { ctx.fillText(`🩸${die.bleedStacks}`, cx + 12, iconY); }
    if (die.aegisShield > 0) { ctx.fillText(`🛡️${die.aegisShield}`, cx - 12, iconY); }
    if (die.damageMultiplier > 1) { ctx.fillText(die.damageMultiplier === 3 ? '🔥' : '⚔️', cx + 8, iconY); }
    if (die.cloneActive || die.isCloneDie) { ctx.fillText('🪞', cx, iconY - 12); }
    if (die.halfDamage > 0) { ctx.fillText('🛡', cx + 8, iconY - 12); }
    if (die.attackAgainActive) { ctx.fillText('⚡', cx - 8, iconY - 12); }

    // Render Rage Back Stronger total damage taken badge on canvas
    const backLvl = getSkillLevel(die, 'backStronger');
    if (backLvl > 0 || die.archetype === 'Rage') {
        ctx.fillStyle = '#ef4444';
        ctx.font = '900 10px Outfit';
        ctx.fillText(`😡${die.totalDamageTaken || 0}dmg`, cx, cy + size * 0.45);
    }
}

function render() {
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const now = performance.now();

    for (const h of allHexes) {
        const p = hexToPixel(h.q, h.r);
        const sx = p.x + gridCenterX, sy = p.y + gridCenterY;
        const key = hKey(h.q, h.r);

        let fill = '#12162e';
        let stroke = '#252d52';
        let lw = 1;

        if (game.voidTiles && game.voidTiles.has(key)) {
            fill = '#03050c'; stroke = '#0a0f24';
            drawHex(sx, sy, HEX_SIZE - 1, fill, stroke, 1);
            continue;
        }

        if (game.blocks && game.blocks.has(key)) {
            fill = 'rgba(120,113,108,0.3)'; stroke = 'rgba(168,162,158,0.5)'; lw = 2;
        }

        if (game.burningTiles && game.burningTiles.has(key)) {
            const pulse = Math.sin(now / 200 + h.q) * 0.1 + 0.9;
            fill = `rgba(239,68,68,${0.25 * pulse})`; stroke = `rgba(239,68,68,${0.6 * pulse})`; lw = 2;
        }

        if (game.vineTraps && game.vineTraps.has(key)) {
            fill = 'rgba(132,204,22,0.2)'; stroke = 'rgba(132,204,22,0.6)'; lw = 2;
        }

        if (game.bearTraps && game.bearTraps.has(key)) {
            const trap = game.bearTraps.get(key);
            if (trap && (trap.team === 'player' || game.currentTurn === 'player')) {
                fill = 'rgba(168,162,158,0.2)'; stroke = 'rgba(214,211,209,0.5)'; lw = 1.5;
            }
        }

        if (game.eventTiles && game.eventTiles.has(key)) {
            const pulse = Math.sin(now / 400 + h.q * 2 + h.r) * 0.15 + 0.85;
            fill = `rgba(251,191,36,${0.12 * pulse})`; stroke = `rgba(251,191,36,${0.5 * pulse})`; lw = 2;
        }

        if (game.reachable && game.reachable.has(key)) {
            const info = game.reachable.get(key);
            if (info.isAttack) {
                fill = 'rgba(244,63,94,0.18)'; stroke = 'rgba(244,63,94,0.5)'; lw = 2;
            } else {
                fill = 'rgba(56,189,248,0.12)'; stroke = 'rgba(56,189,248,0.35)'; lw = 1.5;
            }
        }

        if (game.phase === 'PLAYER_CARD_DASH_DIR' && game.activeCard && game.activeCard._dashDie) {
            const dd = game.activeCard._dashDie;
            for (const dir of DIRS) {
                if (h.q === dd.q + dir.q && h.r === dd.r + dir.r) {
                    fill = 'rgba(251,191,36,0.25)'; stroke = 'rgba(251,191,36,0.6)'; lw = 2;
                }
            }
        }

        if (hoveredHex && hoveredHex.q === h.q && hoveredHex.r === h.r) {
            fill = game.reachable && game.reachable.has(key) ?
                (game.reachable.get(key).isAttack ? 'rgba(244,63,94,0.3)' : 'rgba(56,189,248,0.25)') :
                'rgba(129,140,248,0.12)';
            lw = 2;
        }

        if (game.selectedDie && game.selectedDie.q === h.q && game.selectedDie.r === h.r) {
            stroke = '#fbbf24'; lw = 2.5;
        }

        drawHex(sx, sy, HEX_SIZE - 1, fill, stroke, lw);

        if (game.blocks && game.blocks.has(key)) {
            ctx.font = `${HEX_SIZE * 0.5}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🧱', sx, sy);
        } else if (game.burningTiles && game.burningTiles.has(key)) {
            ctx.font = `${HEX_SIZE * 0.5}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🔥', sx, sy);
        } else if (game.vineTraps && game.vineTraps.has(key)) {
            ctx.font = `${HEX_SIZE * 0.5}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🌿', sx, sy);
        } else if (game.bearTraps && game.bearTraps.has(key)) {
            const trap = game.bearTraps.get(key);
            if (trap && (trap.team === 'player' || game.currentTurn === 'player')) {
                ctx.font = `${HEX_SIZE * 0.45}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🪤', sx, sy);
            }
        } else if (game.eventTiles && game.eventTiles.has(key)) {
            ctx.font = `${HEX_SIZE * 0.45}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('✨', sx, sy);
        }
    }

    if (game.bees) {
        for (const bee of game.bees) {
            const p = hexToPixel(bee.q, bee.r);
            const sx = p.x + gridCenterX, sy = p.y + gridCenterY;
            const floatY = Math.sin(now / 150 + bee.id) * 4;
            ctx.font = `${HEX_SIZE * 0.65}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('🐝', sx, sy + floatY);
        }
    }

    if (game.zombies) {
        for (const zombie of game.zombies) {
            const p = hexToPixel(zombie.q, zombie.r);
            const sx = p.x + gridCenterX, sy = p.y + gridCenterY;
            const floatY = Math.sin(now / 200 + zombie.id) * 3;
            ctx.font = `${HEX_SIZE * 0.65}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('🧟', sx, sy + floatY);
        }
    }

    for (const die of allDice()) {
        if (die.hp <= 0) continue;
        if (animatingDie && animatingDie.id === die.id) continue;

        const p = hexToPixel(die.q, die.r);
        const sx = p.x + gridCenterX, sy = p.y + gridCenterY;
        const bgColor = die.team === 'player' ? '#059669' : '#be123c';
        const selected = game.selectedDie && game.selectedDie.id === die.id;
        const alpha = die.concealed > 0 ? (die.team === game.currentTurn ? 0.4 : 0.08) : 1;
        drawDieFace(sx, sy, HEX_SIZE, getDieEffectiveDamage(die), bgColor, selected, 0, alpha, die.cloneActive, die.icon);
        drawHPBar(sx, sy, HEX_SIZE, die.hp, MAX_HP, die.team, alpha);
        if (game.currentTurn === die.team) drawMoveBadge(sx, sy, HEX_SIZE, die.moveAllowance, die.team);
        drawStatusIcons(sx, sy, HEX_SIZE, die);
    }

    if (animatingDie) {
        const die = animatingDie;
        if (die.renderX != null) {
            const sx = die.renderX + gridCenterX, sy = die.renderY + gridCenterY;
            const bgColor = die.team === 'player' ? '#059669' : '#be123c';
            const alpha = die.concealed > 0 ? 0.4 : 1;
            drawDieFace(sx, sy, HEX_SIZE, getDieEffectiveDamage(die), bgColor, false, animRotation, alpha, die.cloneActive, die.icon);
            drawHPBar(sx, sy, HEX_SIZE, die.hp, MAX_HP, die.team, alpha);

            if (die.cloneActive) {
                spawnTrail(sx, sy, '#c084fc', 2, 3);
            } else {
                spawnTrail(sx, sy, die.team === 'player' ? '#34d39966' : '#f43f5e66', 1, 2);
            }
        }
    }

    updateAndDrawParticles(ctx, now);

    floatingTexts = floatingTexts.filter(ft => now < ft.end);
    for (const ft of floatingTexts) {
        const t = (now - ft.start) / (ft.end - ft.start);
        const alpha = 1 - t;
        const y = ft.y - t * 40;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = ft.color;
        ctx.font = `900 ${ft.size || 18}px Outfit`;
        ctx.textAlign = 'center';
        ctx.fillText(ft.text, ft.x, y);
        ctx.globalAlpha = 1;
    }

    requestAnimationFrame(render);
}

function addFloatingText(text, q, r, color, size) {
    const p = hexToPixel(q, r);
    floatingTexts.push({
        text, x: p.x + gridCenterX, y: p.y + gridCenterY - 10,
        color: color || '#fff', size: size || 18,
        start: performance.now(), end: performance.now() + 1200
    });
}
