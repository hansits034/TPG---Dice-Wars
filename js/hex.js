// ==========================================================
// 3. HEX GRID UTILITIES & MATH
// ==========================================================
const allHexes = [];
for (let q = -GRID_RADIUS; q <= GRID_RADIUS; q++) {
    for (let r = -GRID_RADIUS; r <= GRID_RADIUS; r++) {
        if (Math.abs(q + r) <= GRID_RADIUS) allHexes.push({ q, r });
    }
}

function hexToPixel(q, r) {
    return { x: HEX_SIZE * (SQRT3 * q + SQRT3 / 2 * r), y: HEX_SIZE * (1.5 * r) };
}

function pixelToHex(px, py) {
    const fq = (SQRT3 / 3 * px - 1.0 / 3 * py) / HEX_SIZE;
    const fr = (2.0 / 3 * py) / HEX_SIZE;
    return hexRound(fq, fr);
}

function hexRound(fq, fr) {
    let x = fq, z = fr, y = -x - z;
    let rx = Math.round(x), ry = Math.round(y), rz = Math.round(z);
    const xd = Math.abs(rx - x), yd = Math.abs(ry - y), zd = Math.abs(rz - z);
    if (xd > yd && xd > zd) rx = -ry - rz;
    else if (yd > zd) ry = -rx - rz;
    else rz = -rx - ry;
    return { q: rx, r: rz };
}

const DIRS = [
    { q:1, r:0 }, { q:-1, r:0 }, { q:0, r:1 },
    { q:0, r:-1 }, { q:1, r:-1 }, { q:-1, r:1 }
];

function getNeighbors(q, r) {
    return DIRS.map(d => ({ q: q + d.q, r: r + d.r })).filter(h => isValidHex(h.q, h.r));
}

function isValidHex(q, r) {
    return Math.abs(q) <= GRID_RADIUS && Math.abs(r) <= GRID_RADIUS && Math.abs(q + r) <= GRID_RADIUS;
}

function hKey(q, r) { return `${q},${r}`; }
function parseKey(k) { const [q, r] = k.split(',').map(Number); return { q, r }; }
function hexDist(q1, r1, q2, r2) {
    return (Math.abs(q1 - q2) + Math.abs(r1 - r2) + Math.abs((q1 + r1) - (q2 + r2))) / 2;
}

// Pathfinding & Movement Checks
function isBlocked(q, r) {
    const k = hKey(q, r);
    return (game.blocks && game.blocks.has(k)) || (game.voidTiles && game.voidTiles.has(k));
}

function findReachable(die, maxMoves) {
    const moves = maxMoves !== undefined ? maxMoves : die.moveAllowance;
    const ownTeam = die.team;
    const ownDice = aliveDice(ownTeam);
    const enemyDice = aliveDice(ownTeam === 'player' ? 'cpu' : 'player');

    const reachable = new Map();
    const parents = new Map();
    const queue = [{ q: die.q, r: die.r, dist: 0 }];
    parents.set(hKey(die.q, die.r), null);

    while (queue.length > 0) {
        const cur = queue.shift();
        for (const n of getNeighbors(cur.q, cur.r)) {
            const key = hKey(n.q, n.r);
            if (parents.has(key)) continue;
            if (isBlocked(n.q, n.r)) continue;

            const blockedOwn = ownDice.some(d => d.q === n.q && d.r === n.r && d.id !== die.id);
            if (blockedOwn) continue;

            const enemy = enemyDice.find(d => d.q === n.q && d.r === n.r);
            let isEnemy = !!enemy && !enemy.concealed;
            if (isEnemy && die.lastAttackedEnemyId && enemy.id === die.lastAttackedEnemyId) {
                isEnemy = false; // Cannot attack same enemy die in same turn!
            }
            const nd = cur.dist + 1;
            if (nd > moves) continue;

            parents.set(key, hKey(cur.q, cur.r));
            if (isEnemy) {
                reachable.set(key, { q: n.q, r: n.r, dist: nd, isAttack: true });
            } else if (!enemy) {
                reachable.set(key, { q: n.q, r: n.r, dist: nd, isAttack: false });
                queue.push({ q: n.q, r: n.r, dist: nd });
            }
        }
    }
    return { reachable, parents };
}

function reconstructPath(parents, startQ, startR, targetQ, targetR) {
    const path = [];
    let key = hKey(targetQ, targetR);
    while (key) { path.unshift(parseKey(key)); key = parents.get(key); }
    return path;
}
