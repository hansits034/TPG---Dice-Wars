// ==========================================================
// PAUSE
// Vs computer is the only mode; P, the pause button or leaving the tab freezes the match.
// ==========================================================
function isPaused() { return !!(game && game.paused); }
function matchRunning() {
    const screen = document.getElementById('game-screen');
    return !!(game && game.phase && game.phase !== 'GAME_OVER' && game.phase !== 'IDLE' && screen && screen.classList && screen.classList.contains('active'));
}
function pauseGame() {
    if (!game || game.phase === 'GAME_OVER') return;
    game.paused = true;
    document.body && document.body.classList && document.body.classList.add('is-paused');
}
function resumeGame() {
    if (!game) return;
    game.paused = false;
    document.body && document.body.classList && document.body.classList.remove('is-paused');
    hideOverlay();
}
function overlayOpen() {
    const ol = document.getElementById('overlay');
    return !!(ol && ol.classList && !ol.classList.contains('hidden'));
}
function togglePause() {
    if (isPaused()) { resumeGame(); return; }
    if (matchRunning() && !overlayOpen()) openGameMenuModal();
}
if (typeof document !== 'undefined' && document.addEventListener) {
    // leaving the tab pauses the match so nobody loses a turn to the timer
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && matchRunning() && !isPaused() && !overlayOpen()) openGameMenuModal();
    });
}
