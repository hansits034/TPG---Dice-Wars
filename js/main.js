// ==========================================================
// 17. EVENT HANDLERS & 18. INITIALIZATION
// ==========================================================
// Screen point -> hex under it
function eventToHex(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const mx = (clientX - rect.left) * (canvas.width / rect.width);
    const my = (clientY - rect.top) * (canvas.height / rect.height);
    return pixelToHex(mx - gridCenterX, my - gridCenterY);
}

// Touch screens have no hover: tapping an enemy (or any die outside your move) shows its details briefly
let lastPointerType = 'mouse';
let tipTimer = null;
function showTapInfo(die, clientX, clientY, ms = 2800) {
    showDieTooltip(die, clientX, clientY);
    clearTimeout(tipTimer);
    tipTimer = setTimeout(hideDieTooltip, ms);
}

function onCanvasClick(e) {
    const hex = eventToHex(e.clientX, e.clientY);

    if (!isValidHex(hex.q, hex.r)) { if (lastPointerType !== 'mouse') hideDieTooltip(); return; }

    if (lastPointerType !== 'mouse') {
        const tapped = getDieAt(hex.q, hex.r);
        if (tapped && tapped.team !== 'player' && !tapped.concealed) showTapInfo(tapped, e.clientX, e.clientY);
        else hideDieTooltip();
    }

    if (game.phase === 'PLAYER_CARD_TARGET') {
        handleCardTarget(hex.q, hex.r);
        return;
    }
    if (game.phase === 'PLAYER_CARD_DASH_DIE') {
        handleDashDieSelect(hex.q, hex.r);
        return;
    }
    if (game.phase === 'PLAYER_CARD_DASH_DIR') {
        handleDashDirSelect(hex.q, hex.r);
        return;
    }
    if (game.phase === 'PLAYER_PSYCHIC_ENEMY') {
        handlePsychicEnemySelect(hex.q, hex.r);
        return;
    }
    if (game.phase === 'PLAYER_PSYCHIC_TILE') {
        handlePsychicTileSelect(hex.q, hex.r);
        return;
    }
    if (game.phase === 'PLAYER_ARCHER_TARGET') {
        handleArcherTargetSelect(hex.q, hex.r);
        return;
    }
    if (game.phase === 'PLAYER_MIND_CONTROL_ENEMY') {
        handleMindControlEnemySelect(hex.q, hex.r);
        return;
    }
    if (game.phase === 'PLAYER_MIND_CONTROL_TARGET') {
        handleMindControlTargetSelect(hex.q, hex.r);
        return;
    }

    // Only the player's own turn accepts die selection / movement clicks
    if (game.phase !== 'PLAYER_TURN') return;

    if (game.pivotPreview && game.pivotPiercer) {
        const pDie = game.pivotPiercer;
        const pLvl = getSkillLevel(pDie, 'pivot') || 1;
        const pivotHexes = typeof getPivotHexes === 'function' ? getPivotHexes(pDie.q, pDie.r, pLvl) : [];
        if ((hex.q === pDie.q && hex.r === pDie.r) || pivotHexes.some(n => n.q === hex.q && n.r === hex.r)) {
            executePiercerPivot(pDie).then(finishPlayerSkillAction);
            return;
        } else {
            game.pivotPreview = false;
            game.pivotPiercer = null;
            setMessage('Pivot cancelled.');
            updateSkillButtons();
        }
    }

    const die = getDieAt(hex.q, hex.r);

    if (die && die.team === 'player' && die.hp > 0) {
        selectDie(die);
        return;
    }

    if (game.selectedDie) {
        handlePlayerMove(hex.q, hex.r);
    }
}

function onCanvasMouseMove(e) {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    const hex = eventToHex(e.clientX, e.clientY);

    if (isValidHex(hex.q, hex.r)) {
        hoveredHex = hex;
        // show a skill card for any visible die under the cursor
        const hovered = getDieAt(hex.q, hex.r);
        if (hovered && (!hovered.concealed || hovered.team === 'player')) showDieTooltip(hovered, e.clientX, e.clientY);
        else hideDieTooltip();
        if (game.phase === 'PLAYER_TURN') {
            const d = getDieAt(hex.q, hex.r);
            if (d && d.team === 'player' && d.hp > 0) {
                canvas.style.cursor = 'pointer';
            } else if (game.reachable && game.reachable.has(hKey(hex.q, hex.r))) {
                canvas.style.cursor = game.reachable.get(hKey(hex.q, hex.r)).isAttack ? 'crosshair' : 'pointer';
            } else {
                canvas.style.cursor = 'default';
            }
        } else if (game.phase === 'PLAYER_CARD_TARGET' || game.phase === 'PLAYER_CARD_DASH_DIE' || game.phase === 'PLAYER_CARD_DASH_DIR' || game.phase === 'PLAYER_PSYCHIC_ENEMY' || game.phase === 'PLAYER_PSYCHIC_TILE' || game.phase === 'PLAYER_ARCHER_TARGET' || game.phase === 'PLAYER_MIND_CONTROL_ENEMY' || game.phase === 'PLAYER_MIND_CONTROL_TARGET') {
            canvas.style.cursor = 'pointer';
        }
    } else {
        hoveredHex = null;
        canvas.style.cursor = 'default';
        hideDieTooltip();
    }
}

function onCanvasMouseLeave() { hoveredHex = null; canvas.style.cursor = 'default'; hideDieTooltip(); }
function onResize() { setupCanvas(); }

// Re-fit the board whenever its box changes size (rotation, panels opening, fonts loading)
let lastBoardSize = '';
function watchBoardSize() {
    const wrap = document.getElementById('canvas-wrapper');
    if (!wrap || typeof ResizeObserver === 'undefined') return;
    let pending = null;
    new ResizeObserver(() => {
        const size = `${wrap.clientWidth}x${wrap.clientHeight}`;
        if (size === lastBoardSize || !wrap.clientWidth) return;
        lastBoardSize = size;
        clearTimeout(pending);
        pending = setTimeout(setupCanvas, 60);
    }).observe(wrap);

    const tray = document.getElementById('controls-bar');
    if (tray) new ResizeObserver(() => {
        document.documentElement.style.setProperty('--tray-h', `${tray.offsetHeight}px`);
    }).observe(tray);
}

function onKeyDown(e) {
    if (e.key === 'Escape') cancelCard();
}

function init() {
    canvas = document.getElementById('canvas');
    ctx = canvas.getContext('2d');

    canvas.addEventListener('click', onCanvasClick);
    canvas.addEventListener('pointerdown', e => { lastPointerType = e.pointerType || 'mouse'; });
    canvas.addEventListener('pointermove', onCanvasMouseMove);
    canvas.addEventListener('mouseleave', onCanvasMouseLeave);
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', () => setTimeout(onResize, 250));
    window.addEventListener('keydown', onKeyDown);

    setupClassSelectionUI();
    resetGame();
    setupCanvas();
    watchBoardSize();
    render();
}

window.addEventListener('DOMContentLoaded', init);
