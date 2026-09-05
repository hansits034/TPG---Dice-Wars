// ==========================================================
// 17. EVENT HANDLERS & 18. INITIALIZATION
// ==========================================================
function onCanvasClick(e) {
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const my = (e.clientY - rect.top) * (canvas.height / rect.height);
    const gx = mx - gridCenterX, gy = my - gridCenterY;
    const hex = pixelToHex(gx, gy);

    if (!isValidHex(hex.q, hex.r)) return;

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

    if (game.pivotPreview && game.pivotPiercer) {
        const pDie = game.pivotPiercer;
        const pLvl = getSkillLevel(pDie, 'pivot') || 1;
        const pivotSides = pLvl === 1 ? 2 : pLvl === 2 ? 3 : 6;
        const neighbors = (typeof getNeighbors === 'function' ? getNeighbors(pDie.q, pDie.r) : []).slice(0, pivotSides);
        if ((hex.q === pDie.q && hex.r === pDie.r) || neighbors.some(n => n.q === hex.q && n.r === hex.r)) {
            executePiercerPivot(pDie);
            return;
        } else {
            game.pivotPreview = false;
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
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const my = (e.clientY - rect.top) * (canvas.height / rect.height);
    const gx = mx - gridCenterX, gy = my - gridCenterY;
    const hex = pixelToHex(gx, gy);

    if (isValidHex(hex.q, hex.r)) {
        hoveredHex = hex;
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
    }
}

function onCanvasMouseLeave() { hoveredHex = null; canvas.style.cursor = 'default'; }
function onResize() { setupCanvas(); }

function onCanvasTouch(e) {
    e.preventDefault();
    const touch = e.touches[0];
    onCanvasClick({ clientX: touch.clientX, clientY: touch.clientY });
}

function onKeyDown(e) {
    if (e.key === 'Escape') cancelCard();
}

function init() {
    canvas = document.getElementById('canvas');
    ctx = canvas.getContext('2d');

    canvas.addEventListener('click', onCanvasClick);
    canvas.addEventListener('mousemove', onCanvasMouseMove);
    canvas.addEventListener('mouseleave', onCanvasMouseLeave);
    canvas.addEventListener('touchstart', onCanvasTouch, { passive: false });
    window.addEventListener('resize', onResize);
    window.addEventListener('keydown', onKeyDown);

    setupClassSelectionUI();
    resetGame();
    setupCanvas();
    render();
}

window.addEventListener('DOMContentLoaded', init);
