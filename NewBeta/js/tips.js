// ==========================================================
// TIPS: short, one-time coaching the first time each mechanic shows up.
// Non-blocking; progress is remembered in this browser.
// ==========================================================
const TIPS = {
    select:    { title: 'Your turn', text: 'Every die rolled its moves. Pick one of your dice (green base) to see where it can go.' },
    moveAttack:{ title: 'Moving and attacking', text: 'Pale tiles are moves, red tiles are attacks. Point at a red tile (or tap it once) to preview the damage before you strike.' },
    endTurn:   { title: 'Spend your moves', text: 'Each die can keep moving until its steps run out. Press End turn when you are done.' },
    skills:    { title: 'Active skills', text: 'Some roles have skills in the action bar, like Zap or Long shot. Point at them to preview what they will hit.' },
    enemyInfo: { title: 'Know your enemy', text: 'Point at (or tap) any die to see its skills and their levels.' },
    cards:     { title: 'You drew a card', text: 'Cards sit in your hand. Select one, then pick its target on the board.' },
    event:     { title: 'Arena event', text: 'Every 5 waves the arena changes. Watch the board for new hazards or creatures.' },
    hazard:    { title: 'Hazard tiles', text: 'Dark tiles with a bright outline hurt, slow or root any die that steps on them.' },
    bleed:     { title: 'Bleeding', text: 'A bleeding die loses HP for every tile it moves and cannot heal until it wears off.' },
    upgrade:   { title: 'Level up', text: 'Every 4 waves you pick one skill upgrade. The bars on each die show its skill levels.' },
};

const TipStore = {
    key: 'dicewars.tips.v1',
    load() {
        try { return JSON.parse(localStorage.getItem(this.key)) || { seen: {}, off: false }; }
        catch (e) { return { seen: {}, off: false }; }
    },
    save(s) { try { localStorage.setItem(this.key, JSON.stringify(s)); } catch (e) {} },
};
let tipState = TipStore.load();
let tipQueue = [];
let tipCurrent = null;

function showTip(id) {
    if (!TIPS[id] || tipState.off || tipState.seen[id]) return;
    if (tipCurrent === id || tipQueue.includes(id)) return;
    if (typeof fastAutoMode !== 'undefined' && fastAutoMode) return;
    tipQueue.push(id);
    if (!tipCurrent) nextTip();
}

// Mark a tip as learned (e.g. the player already did what it asked) and close it if open
function completeTip(id) {
    tipState.seen[id] = true;
    TipStore.save(tipState);
    tipQueue = tipQueue.filter(t => t !== id);
    if (tipCurrent === id) closeTip();
}

function nextTip() {
    const el = document.getElementById('coach-tip');
    if (!el) return;
    tipCurrent = tipQueue.shift() || null;
    if (!tipCurrent) { el.classList.remove('show'); return; }
    const t = TIPS[tipCurrent];
    const left = tipQueue.length;
    el.innerHTML = `
        <div class="tip-badge">${iconSVG('help')}</div>
        <div class="tip-body">
            <div class="tip-title">${t.title}</div>
            <div class="tip-text">${t.text}</div>
            <div class="tip-actions">
                <button class="pill-btn" onclick="dismissTip()">Got it${left ? ` (${left} more)` : ''}</button>
                <button class="tip-off" onclick="disableTips()">Turn off tips</button>
            </div>
        </div>`;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
}

function closeTip() {
    tipCurrent = null;
    nextTip();
}

function dismissTip() {
    if (tipCurrent) {
        tipState.seen[tipCurrent] = true;
        TipStore.save(tipState);
    }
    closeTip();
}

function disableTips() {
    tipState.off = true;
    TipStore.save(tipState);
    tipQueue = [];
    tipCurrent = null;
    const el = document.getElementById('coach-tip');
    if (el) el.classList.remove('show');
}

function resetTips() {
    tipState = { seen: {}, off: false };
    TipStore.save(tipState);
}
