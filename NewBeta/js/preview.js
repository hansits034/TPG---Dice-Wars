// ==========================================================
// COMBAT PREVIEW
// Predicts what an action will do before you commit to it.
// Uses the same damage functions as the real actions, so the numbers always match.
// ==========================================================

const THORNS_DMG = [0, 1, 3, 5];
const LIFESTEAL_HEAL = [0, 2, 3, 5];

function angelWillRevive(target) {
    return aliveDice(target.team).some(td => td !== target && getSkillLevel(td, 'revive') > 0 && !td.reviveUsed) && !target.isCloneDie;
}

// Consequences that only happen when the target is knocked out
function knockoutNotes(target, attackerTeam) {
    const notes = [];
    const explodeLvl = getSkillLevel(target, 'explode');
    if (explodeLvl > 0) notes.push({ tone: 'bad', icon: 'flame', text: `It explodes: each of your dice takes ${explodeLvl === 1 ? 8 : 15}` });
    if (getSkillLevel(target, 'undead') > 0 && !target.undeadTriggered) notes.push({ tone: 'warn', icon: 'necromancer', text: 'It splits into 2 undead dice' });
    else if (angelWillRevive(target)) notes.push({ tone: 'warn', icon: 'angel', text: 'Their Angel will revive it' });
    return notes;
}

function buildAttackPreview(die, target, dist) {
    const c = computeMeleeDamage(die, target, dist);
    const hpAfter = Math.max(0, target.hp - c.damage);
    const lethal = hpAfter === 0;
    const notes = [];

    const thornsLvl = getSkillLevel(target, 'thorns');
    if (thornsLvl > 0) {
        const t = THORNS_DMG[thornsLvl];
        notes.push({ tone: 'bad', icon: 'defender', text: t >= die.hp ? `Thorns deal ${t} back and knock out your die` : `Thorns: your die takes ${t}` });
    }
    const healLvl = getSkillLevel(die, 'healOnAtk');
    if (healLvl > 0) {
        notes.push(die.antiHealTurns > 0
            ? { tone: 'bad', icon: 'drop', text: 'Lifesteal blocked while you bleed' }
            : { tone: 'good', icon: 'heart', text: `Lifesteal heals you ${LIFESTEAL_HEAL[healLvl]}` });
    }
    const bleedLvl = getSkillLevel(die, 'bleed');
    if (bleedLvl > 0 && !lethal) notes.push({ tone: 'good', icon: 'drop', text: `Inflicts Bleed x${Math.min(3, bleedLvl)} for 3 turns` });
    if (lethal) notes.push(...knockoutNotes(target, die.team));
    else notes.push({ tone: 'neutral', icon: 'swap', text: 'It survives and is pushed back to your tile' });

    const quickLvl = getSkillLevel(die, 'quickDestruct');
    const movesAfter = Math.max(0, die.moveAllowance - dist);
    if (quickLvl > 0 && movesAfter > 0) notes.push({ tone: 'good', icon: 'ninja', text: `${[0, 25, 35, 50][quickLvl]}% chance to attack again` });
    if (die.attackAgainActive && movesAfter > 0) notes.push({ tone: 'good', icon: 'bolt', text: 'Attack Again: you can strike another enemy after this' });

    const parts = [{ label: `Face ${c.face}` }];
    if (c.mult > 1) parts.push({ label: `x${c.mult} card`, tone: 'good' });
    if (c.momentum > 0) parts.push({ label: `+${c.momentum} momentum`, tone: 'good' });
    if (c.tankKiller > 0) parts.push({ label: `+${c.tankKiller} tank killer`, tone: 'good' });
    if (c.toughness > 0) parts.push({ label: `-${c.toughness} toughness`, tone: 'bad' });
    if (c.halved) parts.push({ label: 'halved', tone: 'bad' });

    return { kind: 'attack', title: `Attack ${archName(target.archetype)}`, attacker: die, target, damage: c.damage, hpAfter, lethal, parts, notes };
}

// Indirect hits (Long Shot, Zap) are absorbed by Aegis first
function absorbAegis(target, amount) {
    const shield = target.aegisShield || 0;
    return { net: Math.max(0, amount - shield), absorbed: Math.min(shield, amount) };
}

function buildRangedPreview(archer, target) {
    const lvl = getSkillLevel(archer, 'longShot');
    const dist = hexDist(archer.q, archer.r, target.q, target.r);
    const miss = lvl === 1 ? 0.02 * dist : lvl === 2 ? 0.01 * dist : 0;
    const raw = getDieEffectiveDamage(archer);
    const { net, absorbed } = absorbAegis(target, raw);
    const hpAfter = Math.max(0, target.hp - net);
    const notes = [];
    notes.push(miss > 0 ? { tone: 'warn', icon: 'piercer', text: `${Math.round(miss * 100)}% chance to miss at ${dist} tiles` } : { tone: 'good', icon: 'piercer', text: 'Cannot miss' });
    if (absorbed > 0) notes.push({ tone: 'bad', icon: 'aegis', text: `Aegis absorbs ${absorbed}` });
    notes.push({ tone: 'neutral', icon: 'end', text: 'Uses up the rest of this archer\'s turn' });
    if (hpAfter === 0) notes.push(...knockoutNotes(target, archer.team));
    return { kind: 'ranged', title: `Long shot at ${archName(target.archetype)}`, attacker: archer, target, damage: net, hpAfter, lethal: hpAfter === 0,
        parts: [{ label: `Face ${raw}` }], notes };
}

function buildZapPreview(mage) {
    const enemyTeam = mage.team === 'player' ? 'cpu' : 'player';
    const enemies = aliveDice(enemyTeam).filter(d => !d.concealed);
    if (!enemies.length) return null;
    let target = enemies[0], best = Infinity;
    for (const e of enemies) {
        const d = hexDist(mage.q, mage.r, e.q, e.r);
        if (d < best) { best = d; target = e; }
    }
    const lvl = getSkillLevel(mage, 'zap');
    const raw = Math.max(1, best + (lvl > 0 ? lvl - 1 : 0));
    const focusLvl = getSkillLevel(mage, 'focus');
    const crit = focusLvl > 0 && !mage.damagedThisWave ? [0, 35, 65, 99][focusLvl] : 0;
    const { net, absorbed } = absorbAegis(target, raw);
    const hpAfter = Math.max(0, target.hp - net);
    const notes = [{ tone: 'neutral', icon: 'piercer', text: `Hits the nearest enemy, ${best} tiles away` }];
    if (crit) notes.push({ tone: 'good', icon: 'bolt', text: `${crit}% chance to crit for ${raw * 2}` });
    if (absorbed > 0) notes.push({ tone: 'bad', icon: 'aegis', text: `Aegis absorbs ${absorbed}` });
    if (hpAfter === 0) notes.push(...knockoutNotes(target, mage.team));
    return { kind: 'zap', title: `Zap ${archName(target.archetype)}`, attacker: mage, target, damage: net, hpAfter, lethal: hpAfter === 0,
        parts: [{ label: `${best} tiles` }, ...(lvl > 1 ? [{ label: `+${lvl - 1} level`, tone: 'good' }] : [])], notes };
}

function pivotDamageOn(target) {
    let dmg = Math.max(1, 8 - getToughnessReduction(target));
    if (target.halfDamage > 0) dmg = Math.ceil(dmg / 2);
    return dmg;
}

// ---------- preview state ----------
function setPreview(p) {
    game.preview = p;
    renderPreviewCard();
}

function clearPreview() {
    if (!game.preview) return;
    game.preview = null;
    renderPreviewCard();
}

// Hovering (or first tap on) a reachable tile while a die is selected
function previewForHex(q, r) {
    const die = game.selectedDie;
    const key = hKey(q, r);
    if (!die || !game.reachable || !game.reachable.has(key)) return null;
    const info = game.reachable.get(key);
    const path = reconstructPath(game.parents, die.q, die.r, q, r);
    if (!info.isAttack) return { kind: 'move', key, q, r, path, attacker: die, movesLeft: die.moveAllowance - info.dist };
    const target = getDieAt(q, r);
    if (!target) return null;
    return { ...buildAttackPreview(die, target, info.dist), key, q, r, path };
}

// ---------- preview card (HTML) ----------
function previewCardHTML(p, touch) {
    const tgt = p.target;
    const maxH = tgt.maxHp || MAX_HP;
    const nowPct = Math.max(0, tgt.hp / maxH) * 100;
    const afterPct = Math.max(0, p.hpAfter / maxH) * 100;
    const parts = p.parts.map(x => `<span class="ap-part ${x.tone || ''}">${x.label}</span>`).join('');
    const notes = p.notes.map(n => `<li class="${n.tone}">${iconSVG(n.icon)}<span>${n.text}</span></li>`).join('');
    const verb = p.kind === 'attack' ? 'attack' : p.kind === 'ranged' ? 'shoot' : 'zap';
    return `
        <div class="ap-head">
            ${classBadge(p.attacker.archetype, 'sm')}
            <span class="ap-arrow">${iconSVG('right')}</span>
            ${classBadge(tgt.archetype, 'sm')}
            <span class="ap-title">${p.title}</span>
        </div>
        <div class="ap-main">
            <span class="ap-num">${p.damage}</span>
            <span class="ap-unit">damage</span>
            ${p.lethal ? `<span class="ap-ko">${iconSVG('necromancer')}Knockout</span>` : `<span class="ap-hp">HP ${tgt.hp} to ${p.hpAfter}</span>`}
        </div>
        <div class="ap-bar"><i class="after" style="width:${afterPct}%"></i><i class="lost" style="left:${afterPct}%;width:${nowPct - afterPct}%"></i></div>
        <div class="ap-parts">${parts}</div>
        ${notes ? `<ul class="ap-notes">${notes}</ul>` : ''}
        ${touch ? `<div class="ap-hint">Tap the same tile again to ${verb}</div>` : ''}
    `;
}

function renderPreviewCard() {
    const board = document.querySelector && document.querySelector('.board');
    if (!board) return;
    let card = document.getElementById('attack-preview');
    const p = game.preview;
    // coaching tips step aside while a preview card is open
    const tip = document.getElementById('coach-tip');
    if (tip) tip.classList.toggle('yield', !!(p && p.target && p.kind !== 'move'));
    if (!p || p.kind === 'move' || !p.target) {
        if (card) card.classList.remove('show');
        return;
    }
    if (!card) {
        card = document.createElement('div');
        card.id = 'attack-preview';
        board.appendChild(card);
    }
    if (typeof hideDieTooltip === 'function') hideDieTooltip();
    card.innerHTML = previewCardHTML(p, p.touch);
    card.classList.toggle('lethal', !!p.lethal);

    // place it on the side of the board away from the target
    const rect = board.getBoundingClientRect();
    const crect = canvas.getBoundingClientRect();
    const tp = hexScreen(p.target.q, p.target.r);
    const tx = crect.left - rect.left + tp.x * (crect.width / canvas.width);
    const ty = crect.top - rect.top + tp.y * (crect.height / canvas.height);
    const docked = rect.width < 560;
    card.classList.toggle('docked', docked);
    if (docked) {
        card.classList.toggle('dock-top', ty > rect.height / 2);
        card.classList.toggle('dock-bottom', ty <= rect.height / 2);
        card.style.transform = '';
    } else {
        const w = card.offsetWidth || 280, h = card.offsetHeight || 200;
        let x = tx + 40;
        if (x + w > rect.width - 8) x = tx - w - 40;
        x = Math.max(8, Math.min(rect.width - w - 8, x));
        const y = Math.max(8, Math.min(rect.height - h - 8, ty - h / 2));
        card.style.transform = `translate(${x}px, ${y}px)`;
    }
    card.classList.add('show');
}

// ---------- canvas overlay: movement path and damage badges ----------
function drawDamageBadge(x, y, text, lethal, small = false) {
    const S = HEX_SIZE;
    const h = (small ? 18 : 24) * DPR;
    ctx.font = `${Math.round((small ? 11 : 14) * DPR)}px 'Lilita One', sans-serif`;
    const w = Math.max(h * 1.3, ctx.measureText(text).width + (lethal ? 26 : 14) * DPR);
    const bx = x - w / 2, by = y - S * 1.25 - h;
    ctx.fillStyle = CLAY.ink;
    ctx.beginPath(); ctx.roundRect(bx - DPR, by - DPR + 2 * DPR, w + 2 * DPR, h + 2 * DPR, h / 2); ctx.fill();
    ctx.fillStyle = lethal ? '#E4572E' : '#FFF9F0';
    ctx.beginPath(); ctx.roundRect(bx, by, w, h, h / 2); ctx.fill();
    ctx.strokeStyle = CLAY.ink; ctx.lineWidth = 1.5 * DPR; ctx.stroke();
    // little pointer
    ctx.fillStyle = lethal ? '#E4572E' : '#FFF9F0';
    ctx.beginPath(); ctx.moveTo(x - 5 * DPR, by + h - DPR); ctx.lineTo(x + 5 * DPR, by + h - DPR); ctx.lineTo(x, by + h + 6 * DPR); ctx.closePath(); ctx.fill();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = lethal ? '#FFF9F0' : CLAY.ink;
    if (lethal) {
        drawIcon(ctx, 'necromancer', bx + 11 * DPR, by + h / 2, 13 * DPR, '#FFF9F0', 2.6);
        ctx.fillText(text, x + 7 * DPR, by + h / 2 + DPR);
    } else {
        ctx.fillText(text, x, by + h / 2 + DPR);
    }
}

function drawPreviewPath(now) {
    const p = game.preview;
    if (!p || !p.path || p.path.length < 2) return;
    const pts = p.path.map(h => hexScreen(h.q, h.r));
    const S = HEX_SIZE;
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(47,42,69,0.55)'; ctx.lineWidth = 5 * DPR;
    if (ctx.setLineDash) { ctx.setLineDash([2 * DPR, 9 * DPR]); ctx.lineDashOffset = -now / 40; }
    ctx.beginPath(); pts.forEach((pt, i) => i ? ctx.lineTo(pt.x, pt.y + S * 0.1) : ctx.moveTo(pt.x, pt.y + S * 0.1)); ctx.stroke();
    if (ctx.setLineDash) ctx.setLineDash([]);
    // end marker: ring for a move, crosshair for an attack
    const end = pts[pts.length - 1];
    const pulse = 1 + Math.sin(now / 180) * 0.06;
    ctx.strokeStyle = p.kind === 'attack' ? '#7A2440' : CLAY.playerDark;
    ctx.lineWidth = 3 * DPR;
    ctx.beginPath(); ctx.ellipse(end.x, end.y + S * 0.1, S * 0.42 * pulse, S * 0.26 * pulse, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
}

function drawPreviewBadges() {
    const p = game.preview;
    if (p && p.target && p.kind !== 'move') {
        const t = hexScreen(p.target.q, p.target.r);
        drawDamageBadge(t.x, t.y, p.lethal ? 'KO' : `-${p.damage}`, p.lethal);
    }
    if (p && p.kind === 'move' && typeof p.movesLeft === 'number') {
        const t = hexScreen(p.q, p.r);
        drawDamageBadge(t.x, t.y + HEX_SIZE * 0.55, `${p.movesLeft} left`, false, true);
    }
    // Pivot: damage on every enemy in the swing
    if (game.pivotPreview && game.pivotPiercer) {
        const pd = game.pivotPiercer;
        const hexes = getPivotHexes(pd.q, pd.r, getSkillLevel(pd, 'pivot') || 1);
        for (const e of aliveDice(pd.team === 'player' ? 'cpu' : 'player')) {
            if (e.concealed || !hexes.some(h => h.q === e.q && h.r === e.r)) continue;
            const dmg = pivotDamageOn(e);
            const t = hexScreen(e.q, e.r);
            drawDamageBadge(t.x, t.y, dmg >= e.hp ? 'KO' : `-${dmg}`, dmg >= e.hp);
        }
    }
}
