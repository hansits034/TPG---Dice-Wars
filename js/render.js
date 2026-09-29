// ==========================================================
// 5. PARTICLE SYSTEM & 8. CANVAS RENDERING (clay diorama)
// ==========================================================
let particles = [];
let DPR = 1;
let boardLayer = null;          // cached static island (tiles + scenery)
const DECOR_RADIUS = GRID_RADIUS + 1; // non-playable scenery ring around the arena

const CLAY = {
    ink: '#2F2A45',
    // arena grass: mid-tone so highlights and hazards read clearly on top
    grassA: '#8DC063', grassB: '#83B75B', grassC: '#96C86B', grassSide: '#5F8F45',
    grassEdgeLight: '#B8E08F', grassEdgeDark: '#5E8C43',
    rim: '#46663C', rimDark: '#2F4729',
    // scenery ring: muted and lowered so it reads as "outside the match"
    ringGrass: '#6F8C63', ringSand: '#BFAE8C',
    soil: '#B78A5E', soilDark: '#7F5A38', cliff: '#9A7049',
    player: '#4CAF5E', playerDark: '#2E7D3E', playerLight: '#9ADFA5',
    cpu: '#E0525E', cpuDark: '#A3313D', cpuLight: '#F59AA1',
    gold: '#F2B84B', goldDark: '#B07A14',
    pip: '#FFF9F0',
};

function spawnParticles(x, y, color, count=12, speed=2, life=800, size=3) {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const spd = speed * (0.5 + Math.random()) * DPR;
        particles.push({
            x, y, vx: Math.cos(angle)*spd, vy: Math.sin(angle)*spd - DPR,
            life, maxLife: life, color, size: size*(0.5+Math.random())*DPR,
            start: performance.now()
        });
    }
}

function spawnTrail(x, y, color, count=3, size=2) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x: x + (Math.random()-0.5)*6*DPR, y: y + (Math.random()-0.5)*6*DPR,
            vx: (Math.random()-0.5)*0.5*DPR, vy: (-0.5-Math.random()*0.5)*DPR,
            life: 400, maxLife: 400, color, size: size*(0.5+Math.random())*DPR,
            start: performance.now()
        });
    }
}

function updateAndDrawParticles(c, now) {
    particles = particles.filter(p => now - p.start < p.life);
    for (const p of particles) {
        if (now < p.start) continue; // delayed particle
        const t = (now - p.start) / p.life;
        p.x += p.vx; p.y += p.vy; p.vy += p.grav != null ? p.grav : 0.02 * DPR;
        c.globalAlpha = p.chunk ? Math.min(1, (1 - t) * 2) : 1 - t;
        c.fillStyle = p.color;
        if (p.chunk) {
            p.rot += p.vr;
            c.save(); c.translate(p.x, p.y); c.rotate(p.rot);
            c.beginPath(); c.roundRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.8, p.size * 0.3); c.fill();
            c.strokeStyle = 'rgba(47,42,69,0.5)'; c.lineWidth = DPR; c.stroke();
            c.restore();
        } else if (p.plus) {
            const z = p.size * (1 - t * 0.3);
            c.fillRect(p.x - z / 2, p.y - z / 6, z, z / 3);
            c.fillRect(p.x - z / 6, p.y - z / 2, z / 3, z);
        } else {
            c.beginPath();
            c.arc(p.x, p.y, p.size * (1 - t * 0.5), 0, Math.PI * 2);
            c.fill();
        }
    }
    c.globalAlpha = 1;
}

// ---------- geometry helpers ----------
function hash2(q, r, salt=0) {
    let h = (q * 374761393 + r * 668265263 + salt * 2147483647) | 0;
    h = (h ^ (h >>> 13)) * 1274126177 | 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function hexCorners(cx, cy, size) {
    const pts = [];
    for (let i = 0; i < 6; i++) {
        const a = Math.PI / 180 * (60 * i - 30);
        pts.push([cx + size * Math.cos(a), cy + size * Math.sin(a)]);
    }
    return pts;
}

// Hexagon with softly rounded corners (clay look)
function roundedHexPath(c, cx, cy, size, radius) {
    const pts = hexCorners(cx, cy, size);
    c.beginPath();
    for (let i = 0; i < 6; i++) {
        const p0 = pts[(i + 5) % 6], p1 = pts[i], p2 = pts[(i + 1) % 6];
        const d0 = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
        const k = Math.min(0.5, radius / d0);
        const a = [p1[0] + (p0[0] - p1[0]) * k, p1[1] + (p0[1] - p1[1]) * k];
        const b = [p1[0] + (p2[0] - p1[0]) * k, p1[1] + (p2[1] - p1[1]) * k];
        i === 0 ? c.moveTo(a[0], a[1]) : c.lineTo(a[0], a[1]);
        c.quadraticCurveTo(p1[0], p1[1], b[0], b[1]);
    }
    c.closePath();
}

// Extruded hex prism: side band then the top face
function drawPrism(c, cx, cy, size, depth, topColor, sideColor, edgeLight, edgeDark) {
    const r = size * 0.22;
    // side (draw the top shape shifted down, plus a fill between)
    c.fillStyle = sideColor;
    for (let d = depth; d > 0; d -= Math.max(1, depth / 4)) {
        roundedHexPath(c, cx, cy + d, size, r);
        c.fill();
    }
    roundedHexPath(c, cx, cy, size, r);
    c.fillStyle = topColor;
    c.fill();
    if (edgeLight) {
        const g = c.createLinearGradient(cx, cy - size, cx, cy + size);
        g.addColorStop(0, edgeLight);
        g.addColorStop(0.55, 'rgba(255,255,255,0)');
        g.addColorStop(1, edgeDark || 'rgba(0,0,0,0.12)');
        roundedHexPath(c, cx, cy, size - 1.2 * DPR, r);
        c.strokeStyle = g;
        c.lineWidth = 2.4 * DPR;
        c.stroke();
    }
}

function hexScreen(q, r) {
    const p = hexToPixel(q, r);
    return { x: p.x + gridCenterX, y: p.y + gridCenterY };
}

// ---------- canvas sizing ----------
function calcHexSize(availW, availH, R = DECOR_RADIUS) {
    // Island spans R rings: width ~ sqrt3 * (2R+1), height ~ 1.5 * 2R + 2 (+ cliff)
    const sw = availW / (SQRT3 * (2 * R + 1) + 0.6);
    const sh = availH / (1.5 * 2 * R + 3.2);
    return Math.max(14 * DPR, Math.min(54 * DPR, Math.floor(Math.min(sw, sh))));
}

function setupCanvas() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    const wrap = document.getElementById('canvas-wrapper');
    let cssW = wrap ? wrap.clientWidth : 0;
    let cssH = wrap ? wrap.clientHeight : 0;
    if (!cssW || !cssH) { cssW = Math.min(window.innerWidth - 32, 760); cssH = Math.min(window.innerHeight * 0.6, 640); }

    // On narrow screens fit the playable arena and let the scenery ring run off the edges,
    // so tiles stay big enough to tap
    const R = cssW < 700 ? GRID_RADIUS + 0.62 : DECOR_RADIUS;
    HEX_SIZE = calcHexSize(cssW * DPR, cssH * DPR, R);
    const boardW = HEX_SIZE * (SQRT3 * (2 * R + 1) + 0.6);
    const boardH = HEX_SIZE * (1.5 * 2 * R + 3.2);
    canvas.width = Math.ceil(R < DECOR_RADIUS ? cssW * DPR : Math.min(cssW * DPR, boardW + HEX_SIZE));
    canvas.height = Math.ceil(Math.min(cssH * DPR, boardH + HEX_SIZE * 0.5));
    canvas.style.width = (canvas.width / DPR) + 'px';
    canvas.style.height = (canvas.height / DPR) + 'px';
    gridCenterX = canvas.width / 2;
    gridCenterY = canvas.height / 2 - HEX_SIZE * 0.35;
    buildBoardLayer();
}

// ---------- scenery props (static) ----------
function drawShadowBlob(c, x, y, w, h, alpha=0.18) {
    c.fillStyle = `rgba(47,42,69,${alpha})`;
    c.beginPath();
    c.ellipse(x, y, w, h, 0, 0, Math.PI * 2);
    c.fill();
}

function clayBall(c, x, y, rad, base, light, dark) {
    c.fillStyle = dark;
    c.beginPath(); c.arc(x, y + rad * 0.12, rad, 0, Math.PI * 2); c.fill();
    c.fillStyle = base;
    c.beginPath(); c.arc(x, y, rad, 0, Math.PI * 2); c.fill();
    c.fillStyle = light;
    c.beginPath(); c.ellipse(x - rad * 0.3, y - rad * 0.35, rad * 0.38, rad * 0.26, -0.5, 0, Math.PI * 2); c.fill();
}

function drawTree(c, x, y, s, variant) {
    drawShadowBlob(c, x, y + s * 0.05, s * 0.34, s * 0.12);
    c.fillStyle = '#8A5E3B';
    c.beginPath(); c.roundRect(x - s * 0.06, y - s * 0.3, s * 0.12, s * 0.32, s * 0.05); c.fill();
    if (variant < 0.5) {
        // round canopy tree
        clayBall(c, x - s * 0.13, y - s * 0.42, s * 0.2, '#5FA858', '#86C877', '#4A8C45');
        clayBall(c, x + s * 0.14, y - s * 0.44, s * 0.19, '#5FA858', '#86C877', '#4A8C45');
        clayBall(c, x, y - s * 0.6, s * 0.23, '#6CB463', '#94D385', '#4A8C45');
    } else {
        // stacked pine
        const tiers = [[0.62, 0.34], [0.84, 0.27], [1.02, 0.19]];
        for (const [ty, tw] of tiers) {
            c.fillStyle = '#3F7F4E';
            c.beginPath();
            c.moveTo(x - s * tw, y - s * (ty - 0.26) + s * 0.03);
            c.quadraticCurveTo(x, y - s * (ty + 0.02), x + s * tw, y - s * (ty - 0.26) + s * 0.03);
            c.closePath(); c.fill();
            c.fillStyle = '#4E9760';
            c.beginPath();
            c.moveTo(x - s * tw, y - s * (ty - 0.26));
            c.quadraticCurveTo(x, y - s * (ty + 0.04), x + s * tw, y - s * (ty - 0.26));
            c.quadraticCurveTo(x, y - s * (ty - 0.34), x - s * tw, y - s * (ty - 0.26));
            c.fill();
        }
    }
}

function drawRock(c, x, y, s) {
    drawShadowBlob(c, x, y + s * 0.04, s * 0.3, s * 0.1);
    c.fillStyle = '#8E8AA3';
    c.beginPath(); c.ellipse(x, y - s * 0.08, s * 0.28, s * 0.2, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#B4B0C6';
    c.beginPath(); c.ellipse(x - s * 0.05, y - s * 0.14, s * 0.2, s * 0.13, -0.2, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#9D99B2';
    c.beginPath(); c.ellipse(x + s * 0.2, y - s * 0.02, s * 0.12, s * 0.09, 0, 0, Math.PI * 2); c.fill();
}

function drawBush(c, x, y, s) {
    drawShadowBlob(c, x, y + s * 0.02, s * 0.28, s * 0.09);
    clayBall(c, x - s * 0.12, y - s * 0.1, s * 0.14, '#6DB860', '#94D385', '#4F9148');
    clayBall(c, x + s * 0.12, y - s * 0.1, s * 0.13, '#6DB860', '#94D385', '#4F9148');
    clayBall(c, x, y - s * 0.17, s * 0.15, '#78C06A', '#A0DA90', '#4F9148');
}

function drawBanner(c, x, y, s, color, dark) {
    drawShadowBlob(c, x, y, s * 0.18, s * 0.06);
    c.fillStyle = '#8A5E3B';
    c.beginPath(); c.roundRect(x - s * 0.03, y - s * 0.95, s * 0.06, s * 0.95, s * 0.03); c.fill();
    c.fillStyle = dark;
    c.beginPath();
    c.moveTo(x + s * 0.03, y - s * 0.9);
    c.quadraticCurveTo(x + s * 0.3, y - s * 0.95, x + s * 0.55, y - s * 0.84);
    c.lineTo(x + s * 0.4, y - s * 0.72);
    c.lineTo(x + s * 0.55, y - s * 0.58);
    c.quadraticCurveTo(x + s * 0.3, y - s * 0.66, x + s * 0.03, y - s * 0.6);
    c.closePath(); c.fill();
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(x + s * 0.03, y - s * 0.92);
    c.quadraticCurveTo(x + s * 0.3, y - s * 0.97, x + s * 0.52, y - s * 0.87);
    c.lineTo(x + s * 0.38, y - s * 0.75);
    c.lineTo(x + s * 0.52, y - s * 0.62);
    c.quadraticCurveTo(x + s * 0.3, y - s * 0.7, x + s * 0.03, y - s * 0.64);
    c.closePath(); c.fill();
    clayBall(c, x, y - s * 0.97, s * 0.05, CLAY.gold, '#FBD98A', CLAY.goldDark);
}

function drawTuft(c, x, y, s) {
    c.strokeStyle = 'rgba(94,150,68,0.75)';
    c.lineWidth = 1.6 * DPR;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(x - s * 0.06, y); c.quadraticCurveTo(x - s * 0.08, y - s * 0.08, x - s * 0.1, y - s * 0.12);
    c.moveTo(x, y); c.lineTo(x, y - s * 0.14);
    c.moveTo(x + s * 0.06, y); c.quadraticCurveTo(x + s * 0.08, y - s * 0.08, x + s * 0.11, y - s * 0.11);
    c.stroke();
}

function drawFlowers(c, x, y, s, color) {
    const dots = [[0, 0], [s * 0.1, s * 0.05], [-s * 0.08, s * 0.06]];
    for (const [dx, dy] of dots) {
        c.fillStyle = color;
        c.beginPath(); c.arc(x + dx, y + dy, s * 0.035, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#FFF4C2';
        c.beginPath(); c.arc(x + dx, y + dy, s * 0.013, 0, Math.PI * 2); c.fill();
    }
}

// Build the static island once per resize
function buildBoardLayer() {
    if (typeof document === 'undefined' || !document.createElement) return;
    boardLayer = document.createElement('canvas');
    boardLayer.width = canvas.width;
    boardLayer.height = canvas.height;
    const c = boardLayer.getContext('2d');
    if (!c || typeof c.beginPath !== 'function') { boardLayer = null; return; }
    const S = HEX_SIZE;
    const RING_DROP = S * 0.34; // scenery ring sits lower than the arena

    // Island shadow on the "table"
    c.fillStyle = 'rgba(47,42,69,0.18)';
    c.beginPath();
    c.ellipse(gridCenterX, gridCenterY + S * 1.5, S * SQRT3 * (DECOR_RADIUS + 0.35), S * 1.5 * (DECOR_RADIUS + 0.15), 0, 0, Math.PI * 2);
    c.fill();

    const all = [];
    for (let q = -DECOR_RADIUS; q <= DECOR_RADIUS; q++) {
        for (let r = -DECOR_RADIUS; r <= DECOR_RADIUS; r++) {
            if (Math.abs(q + r) <= DECOR_RADIUS) all.push({ q, r, d: hexDist(0, 0, q, r) });
        }
    }
    const withPos = all.map(h => ({ ...h, ...hexScreen(h.q, h.r) })).sort((a, b) => a.y - b.y || a.x - b.x);
    const ring = withPos.filter(h => h.d === DECOR_RADIUS);
    const arena = withPos.filter(h => h.d < DECOR_RADIUS);

    // Thick clay cliff and soil bed under the scenery ring
    for (const h of ring) {
        c.fillStyle = CLAY.soilDark;
        roundedHexPath(c, h.x, h.y + RING_DROP + S * 0.45, S * 1.02, S * 0.3); c.fill();
        c.fillStyle = CLAY.cliff;
        roundedHexPath(c, h.x, h.y + RING_DROP + S * 0.28, S * 1.02, S * 0.3); c.fill();
    }
    for (const h of ring) {
        c.fillStyle = '#8E6A48';
        roundedHexPath(c, h.x, h.y + RING_DROP + S * 0.08, S * 1.01, S * 0.25); c.fill();
    }
    // Scenery ring: muted, lowered tiles so it clearly reads as "not part of the fight"
    for (const h of ring) {
        const sandy = hash2(h.q, h.r, 2) < 0.45;
        drawPrism(c, h.x, h.y + RING_DROP, S * 0.93, S * 0.12,
            sandy ? CLAY.ringSand : CLAY.ringGrass, sandy ? '#A8946E' : '#56734A',
            sandy ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.12)', 'rgba(0,0,0,0.12)');
    }

    // Raised arena plinth: a dark moss frame that outlines the playable area and the gaps between tiles
    for (const h of arena) {
        c.fillStyle = CLAY.rimDark;
        roundedHexPath(c, h.x, h.y + S * 0.36, S * 1.1, S * 0.3); c.fill();
    }
    for (const h of arena) {
        c.fillStyle = CLAY.rim;
        roundedHexPath(c, h.x, h.y + S * 0.1, S * 1.1, S * 0.3); c.fill();
    }

    for (const h of arena) {
        const v = hash2(h.q, h.r, 1);
        const top = v < 0.4 ? CLAY.grassA : v < 0.8 ? CLAY.grassB : CLAY.grassC;
        drawPrism(c, h.x, h.y, S * 0.92, S * 0.18, top, CLAY.grassSide, CLAY.grassEdgeLight, CLAY.grassEdgeDark);
        // quiet surface detail on some tiles, kept off-centre so dice never hide it fully
        const deco = hash2(h.q, h.r, 3);
        const ox = (hash2(h.q, h.r, 4) - 0.5) * S * 0.9, oy = S * 0.42;
        if (deco < 0.14) drawTuft(c, h.x + ox, h.y + oy, S);
        else if (deco < 0.2) drawFlowers(c, h.x + ox, h.y + oy - S * 0.05, S, hash2(h.q, h.r, 5) < 0.5 ? '#E68AA0' : '#F3EEFA');
    }

    // Props on the scenery ring. Tall trees only on the far (upper) half so they never cover arena tiles.
    const bannerPlayer = { q: -3, r: DECOR_RADIUS };
    const bannerCpu = { q: 3, r: -DECOR_RADIUS };
    for (const h of ring) {
        const px = h.x, py = h.y + RING_DROP + S * 0.16;
        if (h.q === bannerPlayer.q && h.r === bannerPlayer.r) { drawBanner(c, px, py, S * 1.1, CLAY.player, CLAY.playerDark); continue; }
        if (h.q === bannerCpu.q && h.r === bannerCpu.r) { drawBanner(c, px, py, S * 1.2, CLAY.cpu, CLAY.cpuDark); continue; }
        const farSide = h.y < gridCenterY - S * 1.5;
        const roll = hash2(h.q, h.r, 6);
        const jitter = (hash2(h.q, h.r, 7) - 0.5) * S * 0.3;
        if (farSide && roll < 0.45) drawTree(c, px + jitter, py, S * 1.55, hash2(h.q, h.r, 8));
        else if (roll < 0.3) drawRock(c, px + jitter, py, S * 1.1);
        else if (roll < 0.55) drawBush(c, px + jitter, py, S * 1.1);
    }
}

// ---------- animation helpers ----------
const easeOutBack = t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const easeInOut = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const clamp01 = t => Math.max(0, Math.min(1, t));
// 0..1 growth of something spawned at `bornAt` (items without bornAt are fully grown)
function growth(item, now, dur = 500) {
    if (!item || item.bornAt == null) return 1;
    return clamp01((now - item.bornAt) / dur);
}

// Board-wide effect animations (tornado swirl, magician, ...)
let boardFx = [];
function addBoardFx(type, dur, data = {}) {
    boardFx.push({ type, start: performance.now(), dur, ...data });
}

// Slide a die from a previous hex to its current one (push, swap, tornado, knockback)
function startSlide(die, fromQ, fromR, dur = 420, arc = 0.4, delayMs = 0, spin = false) {
    if (!die) return;
    die.slide = { fromQ, fromR, start: performance.now() + delayMs, dur, arc, spin };
}

function diePosition(die, now) {
    const to = hexScreen(die.q, die.r);
    const sl = die.slide;
    if (!sl) return { x: to.x, y: to.y, tilt: 0 };
    const t = clamp01((now - sl.start) / sl.dur);
    if (t >= 1) { die.slide = null; return { x: to.x, y: to.y, tilt: 0 }; }
    const from = hexScreen(sl.fromQ, sl.fromR);
    const e = easeInOut(t);
    return {
        x: from.x + (to.x - from.x) * e,
        y: from.y + (to.y - from.y) * e - Math.sin(Math.PI * t) * sl.arc * HEX_SIZE * 1.6,
        tilt: sl.spin ? t * Math.PI * 4 : Math.sin(Math.PI * t) * 0.25,
    };
}

// ---------- dynamic tile overlays ----------
function tileOverlay(sx, sy, fill, stroke, lw, size = 0.92) {
    roundedHexPath(ctx, sx, sy, HEX_SIZE * size, HEX_SIZE * 0.2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = (lw || 2) * DPR; ctx.stroke(); }
}

function drawVoid(sx, sy, item, now) {
    const S = HEX_SIZE;
    const kind = (item && item.kind) || 'hole';
    const g = growth(item, now, 650);

    if (kind === 'mountain') {
        const rise = easeOutBack(g);
        tileOverlay(sx, sy, '#6E6A80', '#2F2A45', 2);
        if (rise <= 0) return;
        drawShadowBlob(ctx, sx, sy + S * 0.25, S * 0.62, S * 0.18, 0.3);
        const h = S * 1.15 * rise;
        const baseY = sy + S * 0.3;
        // back peak, main peak, snow cap
        ctx.strokeStyle = CLAY.ink; ctx.lineWidth = 1.6 * DPR; ctx.lineJoin = 'round';
        ctx.fillStyle = '#7F7A94';
        ctx.beginPath(); ctx.moveTo(sx - S * 0.2, baseY); ctx.lineTo(sx + S * 0.25, baseY - h * 0.75); ctx.lineTo(sx + S * 0.62, baseY); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#9D99B2';
        ctx.beginPath(); ctx.moveTo(sx - S * 0.62, baseY); ctx.lineTo(sx - S * 0.08, baseY - h); ctx.lineTo(sx + S * 0.4, baseY); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.moveTo(sx - S * 0.08, baseY - h); ctx.lineTo(sx - S * 0.24, baseY - h * 0.68); ctx.lineTo(sx - S * 0.12, baseY - h * 0.74);
        ctx.lineTo(sx - S * 0.02, baseY - h * 0.64); ctx.lineTo(sx + S * 0.08, baseY - h * 0.72); ctx.closePath(); ctx.fill();
        return;
    }
    if (kind === 'acid') {
        const spread = easeOutBack(g);
        tileOverlay(sx, sy, '#3B4A2A', '#2F2A45', 2);
        roundedHexPath(ctx, sx, sy + S * 0.04, S * 0.8 * Math.min(1, spread), S * 0.3);
        ctx.fillStyle = '#8BD12E'; ctx.fill();
        roundedHexPath(ctx, sx, sy, S * 0.66 * Math.min(1, spread), S * 0.3);
        ctx.fillStyle = '#B6F24A'; ctx.fill();
        // bubbles popping
        for (let i = 0; i < 4; i++) {
            const ph = ((now / 900) + i * 0.27 + (sx % 7) * 0.1) % 1;
            const bx = sx + Math.sin(i * 2.3 + sx) * S * 0.35, by = sy + Math.cos(i * 1.7) * S * 0.2;
            ctx.strokeStyle = `rgba(234,255,190,${1 - ph})`; ctx.lineWidth = 1.5 * DPR;
            ctx.beginPath(); ctx.arc(bx, by, S * 0.05 + ph * S * 0.1, 0, Math.PI * 2); ctx.stroke();
        }
        if (Math.random() < 0.04) spawnTrail(sx + (Math.random() - 0.5) * S * 0.6, sy, 'rgba(182,242,74,0.8)', 1, 1.5);
        return;
    }

    if (g < 1) {
        // crumbling: the tile shakes, then drops away into the hole
        const shake = g < 0.35 ? Math.sin(now / 18) * S * 0.04 : 0;
        const fall = g > 0.35 ? (g - 0.35) / 0.65 : 0;
        ctx.save();
        ctx.globalAlpha = 1 - fall;
        tileOverlay(sx + shake, sy + fall * S * 0.8, '#7B6A57', '#3B3552', 2, 0.92 * (1 - fall * 0.4));
        ctx.restore();
    }
    const hole = easeOutBack(clamp01((g - 0.25) / 0.75));
    if (hole <= 0) return;
    roundedHexPath(ctx, sx, sy, S * 0.9 * Math.min(1, hole), S * 0.2);
    ctx.fillStyle = '#2A2540';
    ctx.fill();
    ctx.strokeStyle = '#15121F'; ctx.lineWidth = 2 * DPR; ctx.stroke();
    roundedHexPath(ctx, sx, sy + S * 0.12, S * 0.7 * Math.min(1, hole), S * 0.18);
    ctx.fillStyle = '#110E1A';
    ctx.fill();
}

function drawWall(sx, sy, item, now) {
    const S = HEX_SIZE;
    const g = easeOutBack(growth(item, now, 450));
    drawShadowBlob(ctx, sx, sy + S * 0.2, S * 0.55, S * 0.16, 0.25);
    ctx.save();
    ctx.translate(sx, sy + S * 0.3);
    ctx.scale(1, Math.max(0.05, g));
    ctx.translate(-sx, -(sy + S * 0.3));
    ctx.fillStyle = '#5E5A73';
    ctx.beginPath(); ctx.roundRect(sx - S * 0.5, sy - S * 0.3, S, S * 0.62, S * 0.16); ctx.fill();
    ctx.fillStyle = '#9C97B0';
    ctx.beginPath(); ctx.roundRect(sx - S * 0.5, sy - S * 0.42, S, S * 0.5, S * 0.16); ctx.fill();
    ctx.strokeStyle = CLAY.ink; ctx.lineWidth = 1.6 * DPR;
    ctx.beginPath(); ctx.roundRect(sx - S * 0.5, sy - S * 0.42, S, S * 0.74, S * 0.16); ctx.stroke();
    ctx.strokeStyle = 'rgba(47,42,69,0.4)';
    ctx.beginPath();
    ctx.moveTo(sx - S * 0.46, sy - S * 0.17); ctx.lineTo(sx + S * 0.46, sy - S * 0.17);
    ctx.moveTo(sx - S * 0.1, sy - S * 0.42); ctx.lineTo(sx - S * 0.1, sy - S * 0.17);
    ctx.moveTo(sx + S * 0.2, sy - S * 0.17); ctx.lineTo(sx + S * 0.2, sy + S * 0.08);
    ctx.stroke();
    ctx.restore();
}

function drawFire(sx, sy, now, seed, item) {
    const S = HEX_SIZE;
    const kind = (item && item.kind) || 'fire';
    const g = growth(item, now, 700);

    if (kind === 'spikes') {
        tileOverlay(sx, sy, `rgba(62,58,82,${0.85 * Math.min(1, g * 2)})`, '#C9C4DA', 2.5);
        const spikes = [[-0.3, 0.1], [0, -0.12], [0.3, 0.1], [-0.15, 0.3], [0.15, 0.3]];
        spikes.forEach(([dx, dy], i) => {
            const pop = easeOutBack(clamp01(g * 1.8 - i * 0.12));
            if (pop <= 0) return;
            const x = sx + dx * S, y = sy + dy * S + S * 0.1, h = S * 0.36 * pop;
            ctx.fillStyle = '#6E6A80';
            ctx.beginPath(); ctx.moveTo(x - S * 0.09, y); ctx.lineTo(x, y - h); ctx.lineTo(x + S * 0.09, y); ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#D5DDE6';
            ctx.beginPath(); ctx.moveTo(x - S * 0.09, y); ctx.lineTo(x, y - h); ctx.lineTo(x + S * 0.01, y); ctx.closePath(); ctx.fill();
            ctx.strokeStyle = CLAY.ink; ctx.lineWidth = 1.2 * DPR;
            ctx.beginPath(); ctx.moveTo(x - S * 0.09, y); ctx.lineTo(x, y - h); ctx.lineTo(x + S * 0.09, y); ctx.stroke();
        });
        return;
    }
    if (kind === 'bio') {
        tileOverlay(sx, sy, `rgba(47,58,34,${0.85 * Math.min(1, g * 2)})`, '#9BE35A', 2.5);
        // toxic puddle + leaking barrel
        const pg = easeOutBack(g);
        ctx.fillStyle = '#9BE35A';
        ctx.beginPath(); ctx.ellipse(sx + S * 0.1, sy + S * 0.22, S * 0.45 * pg, S * 0.16 * pg, 0, 0, Math.PI * 2); ctx.fill();
        if (pg > 0.2) {
            ctx.strokeStyle = CLAY.ink; ctx.lineWidth = 1.4 * DPR;
            ctx.fillStyle = '#E3B341';
            ctx.beginPath(); ctx.roundRect(sx - S * 0.3, sy - S * 0.28, S * 0.36, S * 0.46, S * 0.06); ctx.fill(); ctx.stroke();
            ctx.fillStyle = CLAY.ink;
            ctx.beginPath(); ctx.arc(sx - S * 0.12, sy - S * 0.05, S * 0.08, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#E3B341';
            ctx.beginPath(); ctx.arc(sx - S * 0.12, sy - S * 0.05, S * 0.03, 0, Math.PI * 2); ctx.fill();
        }
        if (Math.random() < 0.06) spawnTrail(sx + (Math.random() - 0.3) * S * 0.6, sy + S * 0.1, 'rgba(155,227,90,0.8)', 1, 2);
        return;
    }

    tileOverlay(sx, sy, `rgba(74,42,30,${0.85 * Math.min(1, g * 2)})`, '#E4572E', 2.5);
    const flames = [[-0.22, 0.05, 0.22], [0.2, 0.08, 0.2], [0, -0.05, 0.3]];
    flames.forEach(([dx, dy, h], i) => {
        const fg = easeOutBack(clamp01(g * 1.6 - i * 0.2));
        if (fg <= 0) return;
        const sway = Math.sin(now / 160 + seed + dx * 10) * S * 0.035;
        const flick = 1 + Math.sin(now / 90 + seed * 3 + i) * 0.08;
        const x = sx + dx * S, y = sy + dy * S + S * 0.2;
        const hh = h * fg * flick;
        ctx.fillStyle = '#D9441C';
        ctx.beginPath();
        ctx.moveTo(x - S * 0.13 * fg, y);
        ctx.quadraticCurveTo(x - S * 0.14 * fg, y - S * hh, x + sway, y - S * (hh + 0.2 * fg));
        ctx.quadraticCurveTo(x + S * 0.14 * fg, y - S * hh, x + S * 0.13 * fg, y);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#FFC857';
        ctx.beginPath();
        ctx.moveTo(x - S * 0.06 * fg, y);
        ctx.quadraticCurveTo(x - S * 0.07 * fg, y - S * hh * 0.6, x + sway * 0.6, y - S * (hh * 0.6 + 0.1 * fg));
        ctx.quadraticCurveTo(x + S * 0.07 * fg, y - S * hh * 0.6, x + S * 0.06 * fg, y);
        ctx.closePath(); ctx.fill();
    });
    if (Math.random() < 0.05) spawnTrail(sx + (Math.random() - 0.5) * S * 0.6, sy, '#FFB347', 1, 1.5);
}

function drawVines(sx, sy, item, now) {
    const S = HEX_SIZE;
    const kind = (item && item.kind) || 'vines';
    const g = growth(item, now, 900);

    if (kind === 'medusa') {
        // petrifying stone tile with a serpent eye
        tileOverlay(sx, sy, 'rgba(120,116,138,0.9)', '#E6E2F2', 2.5);
        const eg = easeOutBack(g);
        ctx.save(); ctx.translate(sx, sy); ctx.scale(eg, eg);
        ctx.fillStyle = '#E6E2F2'; ctx.strokeStyle = CLAY.ink; ctx.lineWidth = 1.5 * DPR;
        ctx.beginPath(); ctx.ellipse(0, 0, S * 0.38, S * 0.2, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        const blink = 0.3 + Math.abs(Math.sin(now / 700)) * 0.7;
        ctx.fillStyle = '#9BE35A';
        ctx.beginPath(); ctx.ellipse(0, 0, S * 0.08, S * 0.17 * blink, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = CLAY.ink;
        ctx.beginPath(); ctx.ellipse(0, 0, S * 0.025, S * 0.12 * blink, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        // cracks
        ctx.strokeStyle = 'rgba(47,42,69,0.5)'; ctx.lineWidth = 1.2 * DPR;
        ctx.beginPath(); ctx.moveTo(sx - S * 0.6, sy + S * 0.2); ctx.lineTo(sx - S * 0.4, sy + S * 0.3); ctx.lineTo(sx - S * 0.3, sy + S * 0.45);
        ctx.moveTo(sx + S * 0.5, sy - S * 0.3); ctx.lineTo(sx + S * 0.35, sy - S * 0.35); ctx.stroke();
        return;
    }
    if (kind === 'snow') {
        tileOverlay(sx, sy, 'rgba(214,238,252,0.95)', '#5AA7D6', 2.5);
        // frost crystals and snow drifts
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath(); ctx.ellipse(sx - S * 0.25, sy + S * 0.25, S * 0.3 * g, S * 0.1 * g, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(sx + S * 0.3, sy + S * 0.18, S * 0.22 * g, S * 0.08 * g, 0, 0, Math.PI * 2); ctx.fill();
        drawIcon(ctx, 'snow', sx, sy - S * 0.05, S * 0.6 * easeOutBack(g), '#5AA7D6', 2.4);
        if (Math.random() < 0.05) spawnTrail(sx + (Math.random() - 0.5) * S, sy - S * 0.5, 'rgba(255,255,255,0.9)', 1, 1.5);
        return;
    }

    tileOverlay(sx, sy, 'rgba(38,78,48,0.85)', '#9BE07A', 2.5);
    ctx.save();
    ctx.strokeStyle = '#9BE07A';
    ctx.lineWidth = 3 * DPR;
    ctx.lineCap = 'round';
    const len = S * 1.6;
    if (ctx.setLineDash) ctx.setLineDash([len * g, len]);
    ctx.beginPath();
    ctx.moveTo(sx - S * 0.5, sy + S * 0.2);
    ctx.bezierCurveTo(sx - S * 0.2, sy - S * 0.4, sx + S * 0.1, sy + S * 0.4, sx + S * 0.5, sy - S * 0.15);
    ctx.stroke();
    if (ctx.setLineDash) ctx.setLineDash([]);
    [-0.3, 0.05, 0.35].forEach((t, i) => {
        const lg = easeOutBack(clamp01(g * 1.5 - 0.3 - i * 0.2));
        if (lg <= 0) return;
        ctx.fillStyle = '#C3F09E';
        ctx.beginPath(); ctx.ellipse(sx + t * S, sy - S * 0.02 + Math.sin(t * 9) * S * 0.12, S * 0.11 * lg, S * 0.055 * lg, t * 3, 0, Math.PI * 2); ctx.fill();
    });
    ctx.restore();
}

function drawEventCrystal(sx, sy, now, seed, item) {
    const S = HEX_SIZE;
    const g = growth(item, now, 700);
    // drops in from above and bounces
    const drop = g < 1 ? (1 - easeOutBack(g)) * S * 2.2 : 0;
    const bob = Math.sin(now / 420 + seed) * S * 0.07;
    tileOverlay(sx, sy, 'rgba(242,184,75,0.4)', CLAY.goldDark, 3);
    drawShadowBlob(ctx, sx, sy + S * 0.22, S * 0.26 * (1 - drop / (S * 3)), S * 0.08, 0.25);
    const y = sy - S * 0.2 + bob - drop;
    ctx.fillStyle = CLAY.goldDark;
    ctx.beginPath();
    ctx.moveTo(sx, y - S * 0.34); ctx.lineTo(sx + S * 0.22, y); ctx.lineTo(sx, y + S * 0.3); ctx.lineTo(sx - S * 0.22, y);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = CLAY.ink; ctx.lineWidth = 1.5 * DPR; ctx.stroke();
    ctx.fillStyle = CLAY.gold;
    ctx.beginPath();
    ctx.moveTo(sx, y - S * 0.34); ctx.lineTo(sx + S * 0.22, y); ctx.lineTo(sx, y + S * 0.06); ctx.lineTo(sx - S * 0.22, y);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#FFF1C9';
    ctx.beginPath(); ctx.ellipse(sx - S * 0.06, y - S * 0.12, S * 0.05, S * 0.03, -0.6, 0, Math.PI * 2); ctx.fill();
}

// ---------- creatures ----------
// Interpolated screen position for a creature that stepped recently
function creaturePos(unit, now, dur = 550) {
    const to = hexScreen(unit.q, unit.r);
    if (unit.movedAt == null || unit.fromQ == null) return to;
    const t = clamp01((now - unit.movedAt) / dur);
    if (t >= 1) return to;
    const from = hexScreen(unit.fromQ, unit.fromR);
    const e = easeInOut(t);
    return { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e - Math.sin(Math.PI * t) * HEX_SIZE * 0.25 };
}

function drawBee(bee, now) {
    if (bee.kind === 'mummy') return drawMummy(bee, now);
    if (bee.kind === 'robot') return drawRobot(bee, now);
    const S = HEX_SIZE;
    const to = creaturePos(bee, now);
    let sx = to.x, sy = to.y;
    const g = growth(bee, now, 1100);
    if (g < 1 && bee.fromX != null) {
        // flies in from outside the arena on a wobbly path
        const e = easeInOut(g);
        sx = bee.fromX + (to.x - bee.fromX) * e + Math.sin(g * 14 + bee.id * 20) * S * 0.3 * (1 - g);
        sy = bee.fromY + (to.y - bee.fromY) * e;
    }
    const bob = Math.sin(now / 150 + bee.id * 10) * S * 0.08;
    const y = sy - S * 0.4 + bob;
    const flap = Math.abs(Math.sin(now / 40 + bee.id * 7));
    drawShadowBlob(ctx, sx, sy + S * 0.15, S * 0.2, S * 0.06, 0.25);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.strokeStyle = CLAY.ink; ctx.lineWidth = 1.2 * DPR;
    for (const side of [-1, 1]) {
        ctx.beginPath(); ctx.ellipse(sx + side * S * 0.09, y - S * 0.16, S * 0.1, S * 0.07 * (0.5 + flap * 0.5), side * 0.5, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
    }
    ctx.fillStyle = CLAY.gold;
    ctx.beginPath(); ctx.ellipse(sx, y, S * 0.22, S * 0.16, 0, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 1.8 * DPR; ctx.stroke();
    ctx.fillStyle = CLAY.ink;
    for (const dx of [-0.07, 0.06]) ctx.fillRect(sx + dx * S - S * 0.028, y - S * 0.14, S * 0.056, S * 0.28);
    ctx.beginPath(); ctx.arc(sx + S * 0.15, y - S * 0.03, S * 0.03, 0, Math.PI * 2); ctx.fill();
}

function drawMummy(m, now) {
    const S = HEX_SIZE;
    const p = creaturePos(m, now, 800);
    const rise = easeOutBack(growth(m, now, 800));
    const sway = Math.sin(now / 420 + m.id * 10) * S * 0.05;
    drawShadowBlob(ctx, p.x, p.y + S * 0.25, S * 0.34, S * 0.1, 0.28);
    ctx.save();
    ctx.beginPath(); ctx.rect(p.x - S, p.y - S * 2, S * 2, S * 2.3); ctx.clip();
    const x = p.x + sway, y = p.y + S * 0.1 + (1 - rise) * S * 1.1;
    ctx.strokeStyle = CLAY.ink; ctx.lineWidth = 1.8 * DPR;
    ctx.fillStyle = '#E9DCC0';
    // body and outstretched arms
    ctx.beginPath(); ctx.roundRect(x - S * 0.26, y - S * 0.62, S * 0.52, S * 0.8, S * 0.2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.roundRect(x - S * 0.46, y - S * 0.42, S * 0.24, S * 0.11, S * 0.05); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.roundRect(x + S * 0.22, y - S * 0.46, S * 0.24, S * 0.11, S * 0.05); ctx.fill(); ctx.stroke();
    // bandage lines
    ctx.strokeStyle = 'rgba(140,112,70,0.7)'; ctx.lineWidth = 1.4 * DPR;
    for (let i = 0; i < 4; i++) {
        const ly = y - S * 0.5 + i * S * 0.15;
        ctx.beginPath(); ctx.moveTo(x - S * 0.24, ly + S * 0.04); ctx.lineTo(x + S * 0.24, ly - S * 0.03); ctx.stroke();
    }
    // glowing eyes in the gap
    ctx.fillStyle = CLAY.ink;
    ctx.beginPath(); ctx.roundRect(x - S * 0.18, y - S * 0.5, S * 0.36, S * 0.1, S * 0.04); ctx.fill();
    ctx.fillStyle = '#FFE08A';
    ctx.beginPath(); ctx.arc(x - S * 0.08, y - S * 0.45, S * 0.03, 0, Math.PI * 2); ctx.arc(x + S * 0.08, y - S * 0.45, S * 0.03, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
}

function drawRobot(bot, now) {
    const S = HEX_SIZE;
    const to = creaturePos(bot, now);
    let x = to.x, y = to.y;
    const g = growth(bot, now, 1000);
    if (g < 1 && bot.fromY != null) {
        // drops from the sky and lands hard
        const e = g * g;
        y = bot.fromY + (to.y - bot.fromY) * e;
    }
    const hover = Math.sin(now / 200 + bot.id * 10) * S * 0.03;
    drawShadowBlob(ctx, to.x, to.y + S * 0.25, S * 0.32 * Math.max(0.3, g), S * 0.1 * Math.max(0.3, g), 0.3);
    const by = y - S * 0.1 + hover;
    ctx.strokeStyle = CLAY.ink; ctx.lineWidth = 1.8 * DPR;
    // treads
    ctx.fillStyle = '#46586C';
    ctx.beginPath(); ctx.roundRect(x - S * 0.3, by + S * 0.08, S * 0.6, S * 0.16, S * 0.07); ctx.fill(); ctx.stroke();
    // body
    ctx.fillStyle = '#A9B6C4';
    ctx.beginPath(); ctx.roundRect(x - S * 0.26, by - S * 0.3, S * 0.52, S * 0.4, S * 0.08); ctx.fill(); ctx.stroke();
    // head
    ctx.fillStyle = '#C9D3DD';
    ctx.beginPath(); ctx.roundRect(x - S * 0.2, by - S * 0.62, S * 0.4, S * 0.3, S * 0.08); ctx.fill(); ctx.stroke();
    // scanning red eye
    const scan = Math.sin(now / 250 + bot.id * 5) * S * 0.08;
    ctx.fillStyle = CLAY.ink;
    ctx.beginPath(); ctx.roundRect(x - S * 0.15, by - S * 0.52, S * 0.3, S * 0.1, S * 0.04); ctx.fill();
    ctx.fillStyle = '#FF4D5E';
    ctx.beginPath(); ctx.arc(x + scan, by - S * 0.47, S * 0.04, 0, Math.PI * 2); ctx.fill();
    // antenna
    ctx.beginPath(); ctx.moveTo(x, by - S * 0.62); ctx.lineTo(x, by - S * 0.76); ctx.stroke();
    ctx.fillStyle = Math.sin(now / 150) > 0 ? '#FF4D5E' : '#7EC8F2';
    ctx.beginPath(); ctx.arc(x, by - S * 0.78, S * 0.045, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
}

function drawZombie(z, now) {
    const S = HEX_SIZE;
    const p = creaturePos(z, now);
    const g = growth(z, now, 700);
    const rise = easeOutBack(g);
    const col = teamColors(z.team);
    const sway = Math.sin(now / 260 + z.id * 10) * S * 0.035;
    // team base disc so ownership is obvious
    ctx.fillStyle = col.dark;
    ctx.beginPath(); ctx.ellipse(p.x, p.y + S * 0.26, S * 0.36, S * 0.13, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = col.base;
    ctx.beginPath(); ctx.ellipse(p.x, p.y + S * 0.22, S * 0.36, S * 0.13, 0, 0, Math.PI * 2); ctx.fill();

    ctx.save();
    // rises out of the ground
    ctx.beginPath(); ctx.rect(p.x - S, p.y - S * 2, S * 2, S * 2.24); ctx.clip();
    const x = p.x + sway, y = p.y + S * 0.08 + (1 - rise) * S * 0.9;
    ctx.strokeStyle = CLAY.ink; ctx.lineWidth = 1.8 * DPR;
    ctx.fillStyle = '#4A4560';
    ctx.beginPath(); ctx.roundRect(x - S * 0.24, y - S * 0.22, S * 0.48, S * 0.38, S * 0.14); ctx.fill(); ctx.stroke();
    // arms reaching forward
    ctx.fillStyle = '#7FAE5C';
    ctx.beginPath(); ctx.roundRect(x - S * 0.34, y - S * 0.14, S * 0.16, S * 0.09, S * 0.04); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.roundRect(x + S * 0.18, y - S * 0.16, S * 0.16, S * 0.09, S * 0.04); ctx.fill(); ctx.stroke();
    // head
    ctx.fillStyle = '#8CBF62';
    ctx.beginPath(); ctx.arc(x, y - S * 0.36, S * 0.22, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#FFF9F0';
    ctx.beginPath(); ctx.arc(x - S * 0.08, y - S * 0.38, S * 0.06, 0, Math.PI * 2); ctx.arc(x + S * 0.09, y - S * 0.36, S * 0.05, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = CLAY.ink;
    ctx.beginPath(); ctx.arc(x - S * 0.08, y - S * 0.38, S * 0.028, 0, Math.PI * 2); ctx.arc(x + S * 0.09, y - S * 0.36, S * 0.024, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - S * 0.07, y - S * 0.24); ctx.lineTo(x + S * 0.07, y - S * 0.25); ctx.lineWidth = 1.5 * DPR; ctx.stroke();
    ctx.restore();
}

// ---------- board-wide effects ----------
function drawTornadoFx(fx, t, now) {
    const S = HEX_SIZE;
    const cx = gridCenterX, cy = gridCenterY;
    const grow = t < 0.2 ? t / 0.2 : t > 0.8 ? (1 - t) / 0.2 : 1;
    ctx.save();
    ctx.globalAlpha = 0.8 * grow;
    ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
        const rot = now / 180 + i * Math.PI / 2;
        const rad = S * (2 + i * 1.3) * grow;
        ctx.strokeStyle = i % 2 ? 'rgba(255,255,255,0.75)' : 'rgba(210,220,230,0.8)';
        ctx.lineWidth = (6 - i) * DPR;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rad, rad * 0.55, 0, rot, rot + Math.PI * 1.1);
        ctx.stroke();
    }
    ctx.restore();
    if (Math.random() < 0.5) {
        const a = Math.random() * Math.PI * 2, r = S * (1 + Math.random() * 5);
        spawnTrail(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.55, Math.random() < 0.5 ? '#6DB860' : '#C9A77C', 1, 2.5);
    }
}

function drawMagicianFx(fx, t, now) {
    const S = HEX_SIZE;
    const cx = gridCenterX, cy = gridCenterY;
    const pop = t < 0.15 ? easeOutBack(t / 0.15) : t > 0.85 ? Math.max(0, 1 - (t - 0.85) / 0.15) : 1;
    const bob = Math.sin(now / 200) * S * 0.08;
    // flying cards: two to each side
    if (t > 0.3 && t < 0.9) {
        const ct = (t - 0.3) / 0.6;
        [-1, 1].forEach(side => {
            for (let k = 0; k < 2; k++) {
                const kt = clamp01(ct * 1.3 - k * 0.25);
                if (kt <= 0 || kt >= 1) continue;
                const x = cx + side * kt * canvas.width * 0.55;
                const y = cy - S * 1.2 - Math.sin(Math.PI * kt) * S * 2 + k * S * 0.5;
                ctx.save();
                ctx.translate(x, y); ctx.rotate(side * kt * 6);
                ctx.fillStyle = side < 0 ? CLAY.cpu : CLAY.player;
                ctx.strokeStyle = CLAY.ink; ctx.lineWidth = 1.5 * DPR;
                ctx.beginPath(); ctx.roundRect(-S * 0.25, -S * 0.35, S * 0.5, S * 0.7, S * 0.1); ctx.fill(); ctx.stroke();
                ctx.fillStyle = '#FFF9F0';
                ctx.beginPath(); ctx.arc(0, 0, S * 0.1, 0, Math.PI * 2); ctx.fill();
                ctx.restore();
            }
        });
    }
    if (pop <= 0) return;
    ctx.save();
    ctx.translate(cx, cy + bob);
    ctx.scale(pop, pop);
    ctx.strokeStyle = CLAY.ink; ctx.lineWidth = 2 * DPR;
    drawShadowBlob(ctx, 0, S * 0.7, S * 0.8, S * 0.22, 0.3);
    // robe
    ctx.fillStyle = '#6B55B0';
    ctx.beginPath(); ctx.moveTo(-S * 0.7, S * 0.6); ctx.quadraticCurveTo(0, -S * 0.9, S * 0.7, S * 0.6); ctx.closePath(); ctx.fill(); ctx.stroke();
    // face
    ctx.fillStyle = '#F3D2B3';
    ctx.beginPath(); ctx.arc(0, -S * 0.45, S * 0.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = CLAY.ink;
    ctx.beginPath(); ctx.arc(-S * 0.1, -S * 0.47, S * 0.04, 0, Math.PI * 2); ctx.arc(S * 0.1, -S * 0.47, S * 0.04, 0, Math.PI * 2); ctx.fill();
    // beard
    ctx.fillStyle = '#FFF9F0';
    ctx.beginPath(); ctx.moveTo(-S * 0.22, -S * 0.32); ctx.quadraticCurveTo(0, S * 0.2, S * 0.22, -S * 0.32); ctx.closePath(); ctx.fill(); ctx.stroke();
    // hat
    ctx.fillStyle = '#4E3D8C';
    ctx.beginPath(); ctx.moveTo(-S * 0.45, -S * 0.66); ctx.quadraticCurveTo(S * 0.1, -S * 1.2, S * 0.3, -S * 1.6); ctx.lineTo(S * 0.45, -S * 0.66); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, -S * 0.66, S * 0.55, S * 0.12, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    drawIcon(ctx, 'star', S * 0.05, -S * 1.0, S * 0.35, CLAY.gold, 3);
    // wand wave
    const wave = Math.sin(now / 120) * 0.5;
    ctx.save(); ctx.translate(S * 0.55, -S * 0.1); ctx.rotate(-0.8 + wave);
    ctx.strokeStyle = '#8A5E3B'; ctx.lineWidth = 4 * DPR;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -S * 0.7); ctx.stroke();
    ctx.restore();
    ctx.restore();
    if (Math.random() < 0.4) spawnParticles(cx + (Math.random() - 0.5) * S * 2, cy - S * (0.5 + Math.random()), Math.random() < 0.5 ? CLAY.gold : '#C9B6F2', 1, 1.2, 700, 3);
}

function drawBoardFx(now) {
    boardFx = boardFx.filter(fx => now - fx.start < fx.dur);
    for (const fx of boardFx) {
        const t = clamp01((now - fx.start) / fx.dur);
        if (fx.type === 'tornado') drawTornadoFx(fx, t, now);
        else if (fx.type === 'magician') drawMagicianFx(fx, t, now);
        else if (fx.type === 'ufo') drawUfo(fx, t, now);
        else if (fx.type === 'tractor') drawTractor(fx, t, now);
        else if (fx.type === 'quake') drawQuake(fx, t, now);
        else if (fx.type === 'snowfall') drawSnowfall(fx, t, now);
        else if (fx.type === 'medusa') drawMedusaFx(fx, t, now);
        else drawFxItem(fx, t, now);
    }
}

// ---------- dice pawns ----------
function getDotPositions(val, cx, cy, s) {
    const o = s * 0.26;
    const tl = [cx - o, cy - o], tr = [cx + o, cy - o];
    const ml = [cx - o, cy], mr = [cx + o, cy], c = [cx, cy];
    const bl = [cx - o, cy + o], br = [cx + o, cy + o];
    const map = { 1:[c], 2:[tr,bl], 3:[tr,c,bl], 4:[tl,tr,bl,br], 5:[tl,tr,c,bl,br], 6:[tl,tr,ml,mr,bl,br] };
    return map[val] || [c];
}

function teamColors(team) {
    return team === 'player'
        ? { base: CLAY.player, dark: CLAY.playerDark, light: CLAY.playerLight }
        : { base: CLAY.cpu, dark: CLAY.cpuDark, light: CLAY.cpuLight };
}

function classDice(archetype) {
    return CLASS_DICE[archetype] || { body: '#8C88A3', light: '#B0ACC6', dark: '#5E5A73', pip: '#FFF9F0' };
}

// ---------- per-role accessories (drawn on / around the cube) ----------
function drawAccessory(die, x, y, s, now, back) {
    const a = die.archetype;
    const cd = classDice(a);
    const top = y - s / 2;
    const ink = CLAY.ink;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.strokeStyle = ink; ctx.lineWidth = 1.6 * DPR;

    if (back) {
        // parts that sit behind the cube
        if (a === 'dracula') {
            const flap = Math.sin(now / 220 + x) * s * 0.04;
            [-1, 1].forEach(side => {
                ctx.fillStyle = cd.dark;
                ctx.beginPath();
                ctx.moveTo(x + side * s * 0.4, y - s * 0.2);
                ctx.lineTo(x + side * s * 0.95, y - s * 0.42 + flap);
                ctx.quadraticCurveTo(x + side * s * 0.82, y - s * 0.12, x + side * s * 0.88, y + s * 0.08);
                ctx.quadraticCurveTo(x + side * s * 0.72, y - s * 0.02, x + side * s * 0.66, y + s * 0.14);
                ctx.quadraticCurveTo(x + side * s * 0.56, y + s * 0.02, x + side * s * 0.42, y + s * 0.12);
                ctx.closePath(); ctx.fill(); ctx.stroke();
            });
        } else if (a === 'angel') {
            const flap = Math.sin(now / 300 + x) * 0.12;
            [-1, 1].forEach(side => {
                ctx.save();
                ctx.translate(x + side * s * 0.45, y - s * 0.12);
                ctx.rotate(side * (0.25 + flap));
                ctx.fillStyle = '#FFFFFF';
                ctx.beginPath();
                ctx.ellipse(side * s * 0.22, 0, s * 0.3, s * 0.16, 0, 0, Math.PI * 2);
                ctx.fill(); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(side * s * 0.05, s * 0.04); ctx.lineTo(side * s * 0.36, s * 0.06); ctx.stroke();
                ctx.restore();
            });
        }
        return;
    }

    if (a === 'angel') {
        const bob = Math.sin(now / 400 + x) * s * 0.04;
        ctx.strokeStyle = '#B98A1E'; ctx.lineWidth = s * 0.1;
        ctx.beginPath(); ctx.ellipse(x, top - s * 0.2 + bob, s * 0.3, s * 0.08, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = '#FFE08A'; ctx.lineWidth = s * 0.06;
        ctx.beginPath(); ctx.ellipse(x, top - s * 0.21 + bob, s * 0.3, s * 0.08, 0, 0, Math.PI * 2); ctx.stroke();
    } else if (a === 'dracula') {
        // fangs peeking out at the bottom edge
        ctx.fillStyle = '#FFF9F0';
        [-1, 1].forEach(side => {
            ctx.beginPath();
            ctx.moveTo(x + side * s * 0.14 - s * 0.05, y + s / 2 - s * 0.02);
            ctx.lineTo(x + side * s * 0.14 + s * 0.05, y + s / 2 - s * 0.02);
            ctx.lineTo(x + side * s * 0.14, y + s / 2 + s * 0.12);
            ctx.closePath(); ctx.fill(); ctx.stroke();
        });
    } else if (a === 'ninja') {
        // headband across the upper face with fluttering tails
        const bandY = top + s * 0.12;
        ctx.fillStyle = '#D6DAF0';
        ctx.beginPath(); ctx.roundRect(x - s / 2, bandY, s, s * 0.14, s * 0.04); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#9AA2C8';
        ctx.beginPath(); ctx.roundRect(x - s * 0.12, bandY + s * 0.02, s * 0.24, s * 0.1, s * 0.03); ctx.fill();
        const wave = Math.sin(now / 140 + x) * s * 0.06;
        ctx.strokeStyle = '#D6DAF0'; ctx.lineWidth = s * 0.07;
        ctx.beginPath();
        ctx.moveTo(x + s / 2, bandY + s * 0.07);
        ctx.quadraticCurveTo(x + s * 0.7, bandY + wave, x + s * 0.86, bandY + s * 0.12 - wave);
        ctx.moveTo(x + s / 2, bandY + s * 0.09);
        ctx.quadraticCurveTo(x + s * 0.66, bandY + s * 0.2 + wave, x + s * 0.8, bandY + s * 0.3);
        ctx.stroke();
    } else if (a === 'samurai') {
        // golden kabuto crest
        ctx.fillStyle = '#F2C96B';
        ctx.beginPath();
        ctx.moveTo(x, top + s * 0.02);
        ctx.quadraticCurveTo(x - s * 0.18, top - s * 0.12, x - s * 0.38, top - s * 0.34);
        ctx.quadraticCurveTo(x - s * 0.12, top - s * 0.2, x, top - s * 0.06);
        ctx.quadraticCurveTo(x + s * 0.12, top - s * 0.2, x + s * 0.38, top - s * 0.34);
        ctx.quadraticCurveTo(x + s * 0.18, top - s * 0.12, x, top + s * 0.02);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#C0392B';
        ctx.beginPath(); ctx.arc(x, top - s * 0.02, s * 0.06, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    } else if (a === 'telekinator') {
        // two orbiting psychic orbs
        for (let k = 0; k < 2; k++) {
            const ang = now / 500 + k * Math.PI;
            const ox = x + Math.cos(ang) * s * 0.72, oy = y - s * 0.1 + Math.sin(ang) * s * 0.22;
            ctx.fillStyle = 'rgba(201,182,242,0.35)';
            ctx.beginPath(); ctx.arc(ox, oy, s * 0.13, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#E7DDFF';
            ctx.beginPath(); ctx.arc(ox, oy, s * 0.07, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        }
    } else if (a === 'defender') {
        // steel rivets at the corners
        ctx.fillStyle = '#D5DDE6';
        for (const [dx, dy] of [[-0.36, -0.36], [0.36, -0.36], [-0.36, 0.36], [0.36, 0.36]]) {
            ctx.beginPath(); ctx.arc(x + dx * s, y + dy * s, s * 0.05, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        }
    } else if (a === 'rage') {
        // horns
        [-1, 1].forEach(side => {
            ctx.fillStyle = '#FFF1D6';
            ctx.beginPath();
            ctx.moveTo(x + side * s * 0.22, top + s * 0.06);
            ctx.quadraticCurveTo(x + side * s * 0.42, top - s * 0.06, x + side * s * 0.46, top - s * 0.32);
            ctx.quadraticCurveTo(x + side * s * 0.34, top - s * 0.12, x + side * s * 0.4, top + s * 0.06);
            ctx.closePath(); ctx.fill(); ctx.stroke();
        });
        if (getDieRageBonus(die) > 0 && Math.random() < 0.08) spawnTrail(x + (Math.random() - 0.5) * s * 0.6, top - s * 0.1, 'rgba(255,145,96,0.8)', 1, 2);
    } else if (a === 'necromancer') {
        // ghostly wisp hovering over the die
        const fl = Math.sin(now / 120 + x) * s * 0.03;
        const wx = x + s * 0.28, wy = top - s * 0.16;
        ctx.fillStyle = 'rgba(184,242,138,0.35)';
        ctx.beginPath(); ctx.arc(wx, wy, s * 0.18, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#B8F28A';
        ctx.beginPath();
        ctx.moveTo(wx - s * 0.1, wy + s * 0.06);
        ctx.quadraticCurveTo(wx - s * 0.1, wy - s * 0.12, wx + fl, wy - s * 0.24);
        ctx.quadraticCurveTo(wx + s * 0.12, wy - s * 0.08, wx + s * 0.1, wy + s * 0.06);
        ctx.quadraticCurveTo(wx, wy + s * 0.14, wx - s * 0.1, wy + s * 0.06);
        ctx.fill();
    } else if (a === 'mage') {
        // wizard hat
        ctx.fillStyle = cd.dark;
        ctx.beginPath(); ctx.ellipse(x, top + s * 0.02, s * 0.4, s * 0.09, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x - s * 0.24, top);
        ctx.quadraticCurveTo(x - s * 0.02, top - s * 0.34, x + s * 0.2, top - s * 0.56);
        ctx.quadraticCurveTo(x + s * 0.12, top - s * 0.24, x + s * 0.24, top);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        drawIcon(ctx, 'star', x + s * 0.02, top - s * 0.16, s * 0.2, '#F2C96B', 3);
    } else if (a === 'doctor') {
        // nurse cap with a blue cross
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath(); ctx.roundRect(x - s * 0.24, top - s * 0.2, s * 0.48, s * 0.22, s * 0.08); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#3E8FB0';
        ctx.fillRect(x - s * 0.03, top - s * 0.17, s * 0.06, s * 0.16);
        ctx.fillRect(x - s * 0.08, top - s * 0.12, s * 0.16, s * 0.06);
    } else if (a === 'piercer') {
        // spear sticking out of the top corner
        ctx.strokeStyle = '#6E4B2A'; ctx.lineWidth = s * 0.07;
        ctx.beginPath(); ctx.moveTo(x + s * 0.12, top + s * 0.1); ctx.lineTo(x + s * 0.5, top - s * 0.3); ctx.stroke();
        ctx.fillStyle = '#D5DDE6'; ctx.strokeStyle = ink; ctx.lineWidth = 1.6 * DPR;
        ctx.beginPath();
        ctx.moveTo(x + s * 0.62, top - s * 0.44);
        ctx.lineTo(x + s * 0.44, top - s * 0.34);
        ctx.lineTo(x + s * 0.54, top - s * 0.24);
        ctx.closePath(); ctx.fill(); ctx.stroke();
    } else if (a === 'archer') {
        // feather tucked into the top
        ctx.save();
        ctx.translate(x - s * 0.26, top + s * 0.04);
        ctx.rotate(-0.5 + Math.sin(now / 500 + x) * 0.06);
        ctx.fillStyle = '#EDE3C8';
        ctx.beginPath(); ctx.ellipse(0, -s * 0.24, s * 0.09, s * 0.26, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = '#8C6A3F';
        ctx.beginPath(); ctx.moveTo(0, s * 0.02); ctx.lineTo(0, -s * 0.46); ctx.stroke();
        ctx.restore();
    }
}

function drawDiePawn(cx, cy, die, opts = {}) {
    const S = HEX_SIZE;
    const now = performance.now();
    const s = S * 1.0;              // cube width
    const depth = s * 0.24;
    const r = s * 0.24;
    const team = teamColors(die.team);
    const cd = classDice(die.archetype);
    // hop: parabolic jump between tiles with stretch in the air and squash on landing
    const hop = opts.hop || 0;
    const air = hop ? Math.sin(Math.PI * hop) : 0;
    const landing = hop ? Math.max(0, 1 - Math.min(hop, 1 - hop) / 0.12) : 0;
    const lift = (opts.selected ? S * 0.12 + Math.sin(now / 260) * S * 0.03 : 0) + air * S * 0.55;
    // hit reaction: short shake
    const hitAge = die.hitAt && die.hitAt <= now ? now - die.hitAt : 9999;
    const shake = hitAge < 220 ? Math.sin(hitAge / 18) * S * 0.07 * (1 - hitAge / 220) : 0;
    const x = cx + shake, y = cy - S * 0.14 - lift;
    const popAge = die.popAt ? now - die.popAt : 9999;
    const pop = popAge >= 0 && popAge < 450 ? Math.max(0.05, easeOutBack(popAge / 450)) : 1;
    const sxScale = (1 - air * 0.06 + landing * 0.1) * pop;
    const syScale = (1 + air * 0.08 - landing * 0.12) * pop;
    const tilt = opts.tilt || (hop ? Math.sin(Math.PI * 2 * hop) * 0.22 : 0);

    ctx.save();
    ctx.globalAlpha = opts.alpha ?? 1;

    // team coaster: green for your dice, red for enemy dice
    drawShadowBlob(ctx, cx, cy + S * 0.32, s * 0.6 * (1 - air * 0.3), s * 0.2 * (1 - air * 0.3), 0.3 - air * 0.12);
    ctx.fillStyle = team.dark;
    ctx.beginPath(); ctx.ellipse(cx, cy + S * 0.3, s * 0.6, s * 0.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = team.base;
    ctx.beginPath(); ctx.ellipse(cx, cy + S * 0.26, s * 0.6, s * 0.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 1.5 * DPR;
    ctx.beginPath(); ctx.ellipse(cx, cy + S * 0.26, s * 0.5, s * 0.15, 0, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();

    ctx.translate(x, y + s / 2 + depth);
    ctx.rotate(tilt);
    ctx.scale(sxScale, syScale);
    ctx.translate(-x, -(y + s / 2 + depth));

    drawAccessory(die, x, y, s, now, true);

    // clone ghost behind
    if (die.cloneActive || die.isCloneDie) {
        ctx.save();
        ctx.globalAlpha *= 0.4;
        ctx.fillStyle = cd.light;
        ctx.beginPath(); ctx.roundRect(x - s / 2 + S * 0.16, y - s / 2 - S * 0.14, s, s, r); ctx.fill();
        ctx.restore();
    }

    // side band in the team colour, then the class-coloured top face
    ctx.fillStyle = team.dark;
    ctx.beginPath(); ctx.roundRect(x - s / 2, y - s / 2 + depth, s, s, r); ctx.fill();
    ctx.fillStyle = team.base;
    ctx.beginPath(); ctx.roundRect(x - s / 2, y - s / 2 + depth * 0.55, s, s, r); ctx.fill();
    ctx.strokeStyle = 'rgba(47,42,69,0.85)'; ctx.lineWidth = 1.8 * DPR;
    ctx.beginPath(); ctx.roundRect(x - s / 2, y - s / 2, s, s + depth, r); ctx.stroke();
    ctx.fillStyle = cd.body;
    ctx.beginPath(); ctx.roundRect(x - s / 2, y - s / 2, s, s, r); ctx.fill();
    ctx.strokeStyle = 'rgba(47,42,69,0.55)'; ctx.lineWidth = 1.2 * DPR;
    ctx.stroke();

    // role watermark embossed into the face
    drawIcon(ctx, die.archetype, x, y + s * 0.02, s * 0.78, cd.light, 2.2);
    // soft top highlight
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath(); ctx.roundRect(x - s / 2 + s * 0.1, y - s / 2 + s * 0.06, s * 0.8, s * 0.16, s * 0.08); ctx.fill();

    // face value: indented clay pips (or a number above 6)
    const val = opts.value;
    if (val >= 1 && val <= 6) {
        const dotR = s * 0.085;
        for (const [dx, dy] of getDotPositions(val, x, y + s * 0.02, s * 0.94)) {
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.beginPath(); ctx.arc(dx, dy - dotR * 0.2, dotR, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = cd.pip;
            ctx.beginPath(); ctx.arc(dx, dy + dotR * 0.1, dotR * 0.88, 0, Math.PI * 2); ctx.fill();
        }
    } else {
        ctx.font = `${Math.round(s * 0.5)}px 'Lilita One', sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = cd.dark;
        ctx.fillText(val, x, y + s * 0.07);
        ctx.fillStyle = cd.pip;
        ctx.fillText(val, x, y + s * 0.03);
    }

    drawAccessory(die, x, y, s, now, false);

    // status overlays that wrap the whole die
    if (die.frozen > 0 && die.petrified) {
        // turned to stone by Medusa
        ctx.fillStyle = 'rgba(150,146,166,0.85)';
        ctx.beginPath(); ctx.roundRect(x - s / 2, y - s / 2, s, s + depth, r); ctx.fill();
        ctx.strokeStyle = 'rgba(47,42,69,0.55)'; ctx.lineWidth = 1.5 * DPR;
        ctx.beginPath(); ctx.moveTo(x - s * 0.3, y - s * 0.4); ctx.lineTo(x - s * 0.1, y - s * 0.1); ctx.lineTo(x - s * 0.22, y + s * 0.2);
        ctx.moveTo(x + s * 0.25, y - s * 0.2); ctx.lineTo(x + s * 0.1, y + s * 0.05); ctx.stroke();
    } else if (die.frozen > 0) {
        ctx.fillStyle = 'rgba(190,230,255,0.55)';
        ctx.beginPath(); ctx.roundRect(x - s * 0.6, y - s * 0.62, s * 1.2, s * 1.24 + depth, s * 0.18); ctx.fill();
        ctx.strokeStyle = '#EAF7FF'; ctx.lineWidth = 2 * DPR; ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2.5 * DPR;
        ctx.beginPath(); ctx.moveTo(x - s * 0.45, y - s * 0.3); ctx.lineTo(x - s * 0.25, y - s * 0.5);
        ctx.moveTo(x - s * 0.45, y - s * 0.1); ctx.lineTo(x - s * 0.1, y - s * 0.45); ctx.stroke();
    }
    if (hitAge < 140) {
        ctx.fillStyle = `rgba(255,255,255,${0.7 * (1 - hitAge / 140)})`;
        ctx.beginPath(); ctx.roundRect(x - s / 2, y - s / 2, s, s + depth, r); ctx.fill();
    }
    if (opts.selected) {
        ctx.strokeStyle = CLAY.gold;
        ctx.lineWidth = 3.5 * DPR;
        ctx.beginPath(); ctx.roundRect(x - s / 2 - 3 * DPR, y - s / 2 - 3 * DPR, s + 6 * DPR, s + depth + 6 * DPR, r + 3 * DPR); ctx.stroke();
    }
    ctx.restore();

    // shields drawn un-rotated around the die
    if ((die.aegisShield || 0) > 0) {
        const pulse = 0.5 + Math.sin(now / 300) * 0.15;
        ctx.strokeStyle = `rgba(126,200,242,${pulse + 0.2})`;
        ctx.fillStyle = `rgba(126,200,242,${pulse * 0.25})`;
        ctx.lineWidth = 2.5 * DPR;
        ctx.beginPath(); ctx.ellipse(cx, y + s * 0.1, s * 0.82, s * 0.86, 0, Math.PI, 0); ctx.fill(); ctx.stroke();
    }
    if (die.concealed > 0 && (opts.alpha ?? 1) > 0.3) {
        const sh = now / 700;
        ctx.strokeStyle = 'rgba(200,182,255,0.9)'; ctx.lineWidth = 2 * DPR;
        ctx.fillStyle = 'rgba(200,182,255,0.16)';
        ctx.beginPath(); ctx.arc(cx, y + s * 0.15, s * 0.9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 3 * DPR;
        ctx.beginPath(); ctx.arc(cx, y + s * 0.15, s * 0.74, sh, sh + 0.6); ctx.stroke();
    }
    return { top: y - s / 2, bottom: cy + S * 0.36, x, s };
}

function drawHPBar(cx, bottomY, width, hp, maxHp, team, alpha=1) {
    const h = 6 * DPR, w = width * 0.82;
    const x = cx - w / 2, y = bottomY + 4 * DPR;
    const pct = Math.min(1, Math.max(0, hp / (maxHp || 50)));
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(47,42,69,0.7)';
    ctx.beginPath(); ctx.roundRect(x - DPR, y - DPR, w + 2 * DPR, h + 2 * DPR, h); ctx.fill();
    if (pct > 0) {
        const col = pct <= 0.25 ? '#FF7A45' : pct <= 0.5 ? CLAY.gold : (team === 'player' ? CLAY.playerLight : CLAY.cpuLight);
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.roundRect(x, y, Math.max(h, w * pct), h, h / 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
}

function drawMoveBadge(x, topY, s, moves) {
    if (moves <= 0) return;
    const r = 9 * DPR;
    const bx = x + s * 0.5, by = topY + s * 0.02;
    ctx.fillStyle = CLAY.goldDark;
    ctx.beginPath(); ctx.arc(bx, by + 2 * DPR, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = CLAY.gold;
    ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = CLAY.ink; ctx.lineWidth = 1.5 * DPR; ctx.stroke();
    ctx.fillStyle = CLAY.ink;
    ctx.font = `${Math.round(12 * DPR)}px 'Lilita One', sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(moves, bx, by + DPR);
}

function drawStatusChips(x, topY, die) {
    const chips = [];
    if (die.frozen > 0) chips.push({ icon: 'snow', color: '#3778A3' });
    if (die.trapped > 0) chips.push({ icon: 'vine', color: '#2F6B3E' });
    if (die.bleedStacks > 0) chips.push({ icon: 'drop', color: '#9E2F4C', n: die.bleedStacks });
    if (die.aegisShield > 0) chips.push({ icon: 'aegis', color: '#3F6C94', n: die.aegisShield });
    if (die.damageMultiplier > 1) chips.push({ text: 'x' + die.damageMultiplier, color: '#A8720F' });
    if (die.attackAgainActive) chips.push({ icon: 'bolt', color: '#624A9E' });
    if (die.halfDamage > 0) chips.push({ icon: 'defender', color: '#46586E' });
    const rage = getDieRageBonus(die);
    if (rage > 0) chips.push({ icon: 'flame', color: '#C24420', n: rage });
    if (chips.length === 0) return;

    const h = 16 * DPR;
    const widths = chips.map(ch => (ch.n != null || ch.text ? 31 : 18) * DPR);
    const total = widths.reduce((a, b) => a + b, 0) + (chips.length - 1) * 3 * DPR;
    let cx = x - total / 2;
    const cy = topY - h - 6 * DPR;
    ctx.font = `${Math.round(10.5 * DPR)}px 'Lilita One', sans-serif`;
    ctx.textBaseline = 'middle';
    chips.forEach((ch, i) => {
        const w = widths[i];
        ctx.fillStyle = CLAY.ink;
        ctx.beginPath(); ctx.roundRect(cx - DPR, cy - DPR, w + 2 * DPR, h + 3.5 * DPR, h / 2); ctx.fill();
        ctx.fillStyle = ch.color;
        ctx.beginPath(); ctx.roundRect(cx, cy, w, h, h / 2); ctx.fill();
        if (ch.text) {
            ctx.fillStyle = '#FFF9F0'; ctx.textAlign = 'center';
            ctx.fillText(ch.text, cx + w / 2, cy + h / 2 + 0.5 * DPR);
        } else {
            drawIcon(ctx, ch.icon, cx + 9 * DPR, cy + h / 2, 10.5 * DPR, '#FFF9F0', 2.8);
            if (ch.n != null) {
                ctx.fillStyle = '#FFF9F0'; ctx.textAlign = 'left';
                ctx.fillText(ch.n, cx + 16 * DPR, cy + h / 2 + 0.5 * DPR);
            }
        }
        cx += w + 3 * DPR;
    });
}

function drawDieUnit(sx, sy, die, opts) {
    const box = drawDiePawn(sx, sy, die, opts);
    drawHPBar(sx, box.bottom, box.s, die.hp, die.maxHp, die.team, opts.alpha ?? 1);
    if (opts.showMoves) drawMoveBadge(box.x, box.top, box.s, die.moveAllowance);
    if ((opts.alpha ?? 1) > 0.3) drawStatusChips(box.x, box.top, die);
}


// ==========================================================
// SKILL & COMBAT VFX
// ==========================================================
// Screen position of a die's body (follows slides so effects line up with what you see)
function dieFxPos(die) {
    if (!die) return { x: gridCenterX, y: gridCenterY };
    const p = typeof diePosition === 'function' ? diePosition(die, performance.now()) : hexScreen(die.q, die.r);
    return { x: p.x, y: p.y - HEX_SIZE * 0.2 };
}

// Clay chunks that fly out and fall with gravity
function spawnChunks(x, y, color, count = 10, power = 3) {
    const now = performance.now();
    for (let i = 0; i < count; i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.4;
        const sp = power * (0.6 + Math.random() * 0.8) * DPR;
        particles.push({
            x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, grav: 0.18 * DPR,
            life: 900, maxLife: 900, color, size: (3 + Math.random() * 4) * DPR,
            start: now, chunk: true, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
        });
    }
}

function fxImpact(die, color = '#FFF1C9', big = false) {
    const p = dieFxPos(die);
    addBoardFx('impact', big ? 480 : 340, { x: p.x, y: p.y, color, big });
    spawnParticles(p.x, p.y, color, big ? 16 : 9, big ? 3.5 : 2.5, 500, 3);
}
function fxHeal(die, amount = 1) {
    if (!die) return;
    const p = dieFxPos(die);
    addBoardFx('pillar', 700, { x: p.x, y: p.y + HEX_SIZE * 0.4, color: '134,214,120' });
    for (let i = 0; i < 6; i++) {
        particles.push({
            x: p.x + (Math.random() - 0.5) * HEX_SIZE, y: p.y + HEX_SIZE * 0.3,
            vx: 0, vy: -(0.8 + Math.random()) * DPR, life: 900, maxLife: 900, color: '#9BE07A',
            size: 5 * DPR, start: performance.now() + i * 60, plus: true,
        });
    }
}
function fxRing(x, y, color, maxR, dur = 500, width = 4) { addBoardFx('ring', dur, { x, y, color, maxR, width }); }
function fxLevelUp(die) {
    const p = dieFxPos(die);
    addBoardFx('pillar', 900, { x: p.x, y: p.y + HEX_SIZE * 0.4, color: '242,184,75' });
    fxRing(p.x, p.y + HEX_SIZE * 0.3, '#F2B84B', HEX_SIZE * 1.4, 700, 5);
    spawnParticles(p.x, p.y, '#F2B84B', 18, 3, 900, 3);
}
function fxShatter(die) {
    const p = dieFxPos(die);
    const cd = classDice(die.archetype);
    const team = teamColors(die.team);
    spawnChunks(p.x, p.y, cd.body, 12, 4);
    spawnChunks(p.x, p.y + HEX_SIZE * 0.2, team.base, 6, 3);
    fxRing(p.x, p.y + HEX_SIZE * 0.3, 'rgba(255,255,255,0.9)', HEX_SIZE * 1.3, 450, 5);
    addBoardFx('poof', 600, { x: p.x, y: p.y });
}
function fxBolt(fromDie, toDie, color = '#C9B6F2') {
    const a = dieFxPos(fromDie), b = dieFxPos(toDie);
    addBoardFx('bolt', 380, { x1: a.x, y1: a.y - HEX_SIZE * 0.3, x2: b.x, y2: b.y, color });
}
function fxArrow(fromDie, toDie, dur) {
    const a = dieFxPos(fromDie), b = dieFxPos(toDie);
    addBoardFx('arrow', dur, { x1: a.x, y1: a.y - HEX_SIZE * 0.2, x2: b.x, y2: b.y });
}
function fxBeam(fromDie, toDie, color = '#B79CF2', dur = 600) {
    const a = dieFxPos(fromDie), b = dieFxPos(toDie);
    addBoardFx('beam', dur, { x1: a.x, y1: a.y, x2: b.x, y2: b.y, color });
}
function fxSweep(die, radiusHexes, dur = 420) {
    const p = dieFxPos(die);
    addBoardFx('sweep', dur, { x: p.x, y: p.y + HEX_SIZE * 0.2, r: HEX_SIZE * SQRT3 * (radiusHexes + 0.4) });
}
function fxExplosion(die) {
    const p = dieFxPos(die);
    addBoardFx('explosion', 700, { x: p.x, y: p.y });
    spawnParticles(p.x, p.y, '#FF8A3D', 26, 5, 800, 4);
    spawnChunks(p.x, p.y, '#6B3F2A', 8, 5);
    if (typeof shakeBoard === 'function') shakeBoard(500);
}

function drawFxItem(fx, t, now) {
    const S = HEX_SIZE;
    switch (fx.type) {
        case 'impact': {
            const r = S * (fx.big ? 1.1 : 0.7) * (0.3 + t * 0.9);
            ctx.globalAlpha = 1 - t;
            ctx.strokeStyle = fx.color; ctx.lineWidth = (fx.big ? 6 : 4) * DPR * (1 - t);
            ctx.beginPath(); ctx.arc(fx.x, fx.y, r, 0, Math.PI * 2); ctx.stroke();
            ctx.lineWidth = 3 * DPR * (1 - t);
            for (let i = 0; i < 8; i++) {
                const a = i * Math.PI / 4 + 0.3;
                ctx.beginPath();
                ctx.moveTo(fx.x + Math.cos(a) * r * 0.9, fx.y + Math.sin(a) * r * 0.9);
                ctx.lineTo(fx.x + Math.cos(a) * r * 1.35, fx.y + Math.sin(a) * r * 1.35);
                ctx.stroke();
            }
            ctx.globalAlpha = 1;
            break;
        }
        case 'ring': {
            ctx.globalAlpha = 1 - t;
            ctx.strokeStyle = fx.color; ctx.lineWidth = fx.width * DPR * (1 - t * 0.7);
            ctx.beginPath(); ctx.ellipse(fx.x, fx.y, fx.maxR * t, fx.maxR * t * 0.5, 0, 0, Math.PI * 2); ctx.stroke();
            ctx.globalAlpha = 1;
            break;
        }
        case 'pillar': {
            const a = t < 0.2 ? t / 0.2 : 1 - (t - 0.2) / 0.8;
            const w = S * 0.55 * (1 - t * 0.3);
            const g = ctx.createLinearGradient(0, fx.y - S * 2.4, 0, fx.y);
            g.addColorStop(0, `rgba(${fx.color},0)`);
            g.addColorStop(1, `rgba(${fx.color},${0.55 * a})`);
            ctx.fillStyle = g;
            ctx.beginPath(); ctx.roundRect(fx.x - w / 2, fx.y - S * 2.4, w, S * 2.4, w / 2); ctx.fill();
            break;
        }
        case 'poof': {
            ctx.globalAlpha = 0.8 * (1 - t);
            for (let i = 0; i < 5; i++) {
                const a = i * 1.26;
                const d = S * 0.5 * (0.4 + t);
                ctx.fillStyle = '#EDEFF2';
                ctx.beginPath(); ctx.arc(fx.x + Math.cos(a) * d, fx.y + Math.sin(a) * d * 0.6, S * 0.28 * (1 - t * 0.5), 0, Math.PI * 2); ctx.fill();
            }
            ctx.globalAlpha = 1;
            break;
        }
        case 'bolt': {
            // jagged lightning, re-randomised each frame
            const segs = 7;
            const pts = [[fx.x1, fx.y1]];
            for (let i = 1; i < segs; i++) {
                const k = i / segs;
                const nx = -(fx.y2 - fx.y1), ny = fx.x2 - fx.x1;
                const len = Math.hypot(nx, ny) || 1;
                const off = (Math.random() - 0.5) * S * 0.7;
                pts.push([fx.x1 + (fx.x2 - fx.x1) * k + nx / len * off, fx.y1 + (fx.y2 - fx.y1) * k + ny / len * off]);
            }
            pts.push([fx.x2, fx.y2]);
            const a = 1 - t;
            ctx.lineJoin = 'round'; ctx.lineCap = 'round';
            [[12, `rgba(132,104,196,${0.35 * a})`], [5, `rgba(201,182,242,${0.9 * a})`], [2, `rgba(255,255,255,${a})`]].forEach(([w, c]) => {
                ctx.strokeStyle = c; ctx.lineWidth = w * DPR;
                ctx.beginPath(); pts.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)); ctx.stroke();
            });
            break;
        }
        case 'arrow': {
            const e = t;
            const x = fx.x1 + (fx.x2 - fx.x1) * e;
            const arc = Math.hypot(fx.x2 - fx.x1, fx.y2 - fx.y1) * 0.25;
            const y = fx.y1 + (fx.y2 - fx.y1) * e - Math.sin(Math.PI * e) * arc;
            const dx = (fx.x2 - fx.x1), dy = (fx.y2 - fx.y1) - Math.cos(Math.PI * e) * Math.PI * arc;
            const ang = Math.atan2(dy, dx);
            ctx.save();
            ctx.translate(x, y); ctx.rotate(ang);
            ctx.strokeStyle = '#6E4B2A'; ctx.lineWidth = 3 * DPR; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(-S * 0.5, 0); ctx.lineTo(S * 0.2, 0); ctx.stroke();
            ctx.fillStyle = '#D5DDE6'; ctx.strokeStyle = CLAY.ink; ctx.lineWidth = 1.4 * DPR;
            ctx.beginPath(); ctx.moveTo(S * 0.36, 0); ctx.lineTo(S * 0.16, -S * 0.1); ctx.lineTo(S * 0.16, S * 0.1); ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#E4572E';
            ctx.beginPath(); ctx.moveTo(-S * 0.5, 0); ctx.lineTo(-S * 0.62, -S * 0.1); ctx.lineTo(-S * 0.38, 0); ctx.lineTo(-S * 0.62, S * 0.1); ctx.closePath(); ctx.fill();
            ctx.restore();
            if (Math.random() < 0.6) spawnTrail(x, y, 'rgba(255,255,255,0.7)', 1, 1.5);
            break;
        }
        case 'beam': {
            const a = t < 0.2 ? t / 0.2 : 1 - (t - 0.2) / 0.8;
            ctx.lineCap = 'round';
            for (let k = 0; k < 2; k++) {
                ctx.strokeStyle = k ? `rgba(255,255,255,${a})` : fx.color;
                ctx.globalAlpha = k ? 1 : a * 0.8;
                ctx.lineWidth = (k ? 2 : 6) * DPR;
                ctx.beginPath();
                for (let i = 0; i <= 24; i++) {
                    const u = i / 24;
                    const nx = -(fx.y2 - fx.y1), ny = fx.x2 - fx.x1, len = Math.hypot(nx, ny) || 1;
                    const wave = Math.sin(u * 14 - now / 60 + k * Math.PI) * S * 0.18 * Math.sin(Math.PI * u);
                    const px = fx.x1 + (fx.x2 - fx.x1) * u + nx / len * wave, py = fx.y1 + (fx.y2 - fx.y1) * u + ny / len * wave;
                    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
                }
                ctx.stroke();
            }
            ctx.globalAlpha = 1;
            break;
        }
        case 'sweep': {
            // a blade swinging a full circle around the piercer
            const ang = -Math.PI / 2 + t * Math.PI * 2.2;
            ctx.save();
            ctx.globalAlpha = t > 0.8 ? (1 - t) / 0.2 : 1;
            ctx.fillStyle = 'rgba(228,87,46,0.18)';
            ctx.beginPath(); ctx.ellipse(fx.x, fx.y, fx.r, fx.r * 0.55, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(255,200,120,0.45)';
            ctx.beginPath(); ctx.moveTo(fx.x, fx.y);
            for (let i = 0; i <= 12; i++) {
                const aa = ang - 1.2 + i * 0.1;
                ctx.lineTo(fx.x + Math.cos(aa) * fx.r, fx.y + Math.sin(aa) * fx.r * 0.55);
            }
            ctx.closePath(); ctx.fill();
            ctx.strokeStyle = '#FFF1C9'; ctx.lineWidth = 4 * DPR; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(fx.x, fx.y); ctx.lineTo(fx.x + Math.cos(ang) * fx.r, fx.y + Math.sin(ang) * fx.r * 0.55); ctx.stroke();
            ctx.restore();
            break;
        }
        case 'explosion': {
            const r = S * 2.2 * easeOutBack(Math.min(1, t * 1.6));
            ctx.globalAlpha = 1 - t;
            ctx.fillStyle = '#FFC857';
            ctx.beginPath(); ctx.arc(fx.x, fx.y, r * 0.55, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#E4572E';
            ctx.beginPath(); ctx.arc(fx.x, fx.y, r * 0.35, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#FFF1C9'; ctx.lineWidth = 6 * DPR * (1 - t);
            ctx.beginPath(); ctx.ellipse(fx.x, fx.y, r, r * 0.6, 0, 0, Math.PI * 2); ctx.stroke();
            ctx.globalAlpha = 1;
            break;
        }
    }
}


// ==========================================================
// EVENT FX: UFO, tractor beam, earthquake, snowfall, medusa
// ==========================================================
function ufoPos(fx, now) {
    const t = clamp01((now - fx.start) / fx.dur);
    const S = HEX_SIZE;
    const enter = t < 0.15 ? 1 - easeOutBack(t / 0.15) : 0;
    const exit = t > 0.85 ? Math.pow((t - 0.85) / 0.15, 2) : 0;
    return {
        x: gridCenterX + Math.sin(t * Math.PI * 2.2) * canvas.width * 0.22 + exit * canvas.width * 0.6,
        y: gridCenterY - S * 4.6 + Math.sin(now / 300) * S * 0.12 - enter * canvas.height * 0.5 - exit * canvas.height * 0.4,
    };
}

function drawUfo(fx, t, now) {
    const S = HEX_SIZE;
    const p = ufoPos(fx, now);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(Math.sin(now / 400) * 0.06);
    ctx.strokeStyle = CLAY.ink; ctx.lineWidth = 2 * DPR;
    // dome
    ctx.fillStyle = 'rgba(190,240,210,0.9)';
    ctx.beginPath(); ctx.ellipse(0, -S * 0.3, S * 0.55, S * 0.45, 0, Math.PI, 0); ctx.fill(); ctx.stroke();
    // tiny alien
    ctx.fillStyle = '#8BD14A';
    ctx.beginPath(); ctx.arc(0, -S * 0.42, S * 0.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = CLAY.ink;
    ctx.beginPath(); ctx.ellipse(-S * 0.08, -S * 0.44, S * 0.05, S * 0.07, 0.3, 0, Math.PI * 2); ctx.ellipse(S * 0.08, -S * 0.44, S * 0.05, S * 0.07, -0.3, 0, Math.PI * 2); ctx.fill();
    // saucer
    ctx.fillStyle = '#A9B6C4';
    ctx.beginPath(); ctx.ellipse(0, -S * 0.25, S * 1.2, S * 0.36, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#6C8199';
    ctx.beginPath(); ctx.ellipse(0, -S * 0.12, S * 0.8, S * 0.18, 0, 0, Math.PI); ctx.fill(); ctx.stroke();
    for (let i = 0; i < 5; i++) {
        const lx = -S * 0.8 + i * S * 0.4;
        ctx.fillStyle = (Math.floor(now / 150) + i) % 2 ? '#F2B84B' : '#FFF1C9';
        ctx.beginPath(); ctx.arc(lx, -S * 0.24, S * 0.07, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
}

function drawTractor(fx, t, now) {
    const S = HEX_SIZE;
    const ufo = boardFx.find(f => f.type === 'ufo');
    const src = ufo ? ufoPos(ufo, now) : { x: fx.x, y: fx.y - S * 5 };
    const a = t < 0.3 ? t / 0.3 : 1 - (t - 0.3) / 0.7;
    ctx.fillStyle = `rgba(200,255,170,${0.45 * a})`;
    ctx.beginPath();
    ctx.moveTo(src.x - S * 0.4, src.y - S * 0.1);
    ctx.lineTo(src.x + S * 0.4, src.y - S * 0.1);
    ctx.lineTo(fx.x + S * 0.7, fx.y + S * 0.4);
    ctx.lineTo(fx.x - S * 0.7, fx.y + S * 0.4);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = `rgba(255,255,255,${0.7 * a})`; ctx.lineWidth = 2 * DPR;
    for (let i = 0; i < 3; i++) {
        const k = ((now / 300) + i / 3) % 1;
        const y = fx.y + S * 0.4 - (fx.y + S * 0.4 - src.y) * k;
        const w = S * 0.7 - (S * 0.3) * k;
        ctx.beginPath(); ctx.ellipse(src.x + (fx.x - src.x) * (1 - k), y, w, w * 0.25, 0, 0, Math.PI * 2); ctx.stroke();
    }
}

function drawQuake(fx, t, now) {
    const S = HEX_SIZE;
    if (!fx.cracks) {
        fx.cracks = Array.from({ length: 6 }, () => {
            let x = gridCenterX + (Math.random() - 0.5) * S * 4, y = gridCenterY + (Math.random() - 0.5) * S * 3;
            let ang = Math.random() * Math.PI * 2;
            const pts = [[x, y]];
            for (let i = 0; i < 7; i++) {
                ang += (Math.random() - 0.5) * 1.1;
                x += Math.cos(ang) * S * 0.7; y += Math.sin(ang) * S * 0.45;
                pts.push([x, y]);
            }
            return pts;
        });
    }
    const grow = clamp01(t / 0.3), fade = t > 0.6 ? 1 - (t - 0.6) / 0.4 : 1;
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const pts of fx.cracks) {
        const n = Math.max(2, Math.ceil(pts.length * grow));
        ctx.strokeStyle = `rgba(47,42,69,${0.75 * fade})`; ctx.lineWidth = 4 * DPR;
        ctx.beginPath(); pts.slice(0, n).forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
        ctx.strokeStyle = `rgba(150,110,70,${0.8 * fade})`; ctx.lineWidth = 1.5 * DPR;
        ctx.stroke();
    }
    ctx.restore();
}

function drawSnowfall(fx, t, now) {
    const a = t < 0.15 ? t / 0.15 : t > 0.8 ? (1 - t) / 0.2 : 1;
    ctx.save();
    ctx.fillStyle = `rgba(230,244,255,${0.18 * a})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = `rgba(255,255,255,${0.95 * a})`;
    for (let i = 0; i < 90; i++) {
        const sx = (i * 97.13) % canvas.width;
        const speed = 0.05 + (i % 7) * 0.012;
        const y = ((now * speed * DPR) + i * 53) % (canvas.height + 20) - 10;
        const x = sx + Math.sin(now / 600 + i) * 12 * DPR;
        ctx.beginPath(); ctx.arc(x, y, (1.5 + (i % 3)) * DPR, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
}

function drawMedusaFx(fx, t, now) {
    const S = HEX_SIZE;
    const open = t < 0.3 ? easeOutBack(t / 0.3) : t > 0.75 ? Math.max(0, 1 - (t - 0.75) / 0.25) : 1;
    if (open <= 0) return;
    const x = gridCenterX, y = gridCenterY - S * 0.5;
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = 'rgba(47,42,69,0.25)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = CLAY.ink; ctx.lineWidth = 3 * DPR;
    ctx.fillStyle = '#E6E2F2';
    ctx.beginPath(); ctx.ellipse(x, y, S * 2.2, S * 1.1 * open, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#9BE35A';
    ctx.beginPath(); ctx.ellipse(x, y, S * 0.9 * open, S * 0.95 * open, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = CLAY.ink;
    ctx.beginPath(); ctx.ellipse(x, y, S * 0.18, S * 0.85 * open, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
}

// ==========================================================
// DAY / NIGHT CYCLE (one day = 5 minutes) + ambient life
// ==========================================================
const DAY_LENGTH_MS = 5 * 60 * 1000;
const dayStart = (typeof performance !== 'undefined' ? performance.now() : 0) - DAY_LENGTH_MS * 0.04;
// t: position in the day. table: page colour, tint: board light (rgba), night: 0..1
const DAY_KEYS = [
    { t: 0.00, table: [176, 206, 222], tint: [255, 190, 160, 0.10], night: 0.25 }, // dawn
    { t: 0.08, table: [168, 212, 224], tint: [255, 228, 200, 0.05], night: 0 },    // morning
    { t: 0.30, table: [154, 203, 217], tint: [255, 255, 255, 0.00], night: 0 },    // noon
    { t: 0.48, table: [170, 196, 205], tint: [255, 214, 160, 0.06], night: 0 },    // afternoon
    { t: 0.58, table: [222, 172, 150], tint: [255, 132, 72, 0.18], night: 0.1 },   // sunset
    { t: 0.68, table: [104, 104, 148], tint: [60, 50, 130, 0.24], night: 0.7 },    // dusk
    { t: 0.80, table: [58, 70, 108], tint: [22, 32, 92, 0.30], night: 1 },         // night
    { t: 0.94, table: [88, 98, 140], tint: [50, 50, 120, 0.22], night: 0.7 },      // before dawn
    { t: 1.00, table: [176, 206, 222], tint: [255, 190, 160, 0.10], night: 0.25 },
];

function dayState(now) {
    const t = (((now - dayStart) / DAY_LENGTH_MS) % 1 + 1) % 1;
    let i = 0;
    while (i < DAY_KEYS.length - 2 && DAY_KEYS[i + 1].t <= t) i++;
    const a = DAY_KEYS[i], b = DAY_KEYS[i + 1];
    const k = (t - a.t) / (b.t - a.t);
    const mix = (x, y) => x + (y - x) * k;
    const label = t < 0.06 || t >= 0.95 ? 'Dawn' : t < 0.26 ? 'Morning' : t < 0.52 ? 'Noon' : t < 0.66 ? 'Evening' : 'Night';
    return {
        t, label,
        table: a.table.map((v, j) => Math.round(mix(v, b.table[j]))),
        tint: a.tint.map((v, j) => mix(v, b.tint[j])),
        night: mix(a.night, b.night),
    };
}

let lastDayUi = 0;
function updateDayCycleUI(now, ds) {
    if (now - lastDayUi < 400) return;
    lastDayUi = now;
    const root = document.documentElement;
    if (root && root.style && root.style.setProperty) {
        root.style.setProperty('--table', `rgb(${ds.table.join(',')})`);
        root.style.setProperty('--night', ds.night.toFixed(3));
    }
    const badge = document.getElementById('daytime-badge');
    if (badge && badge.dataset.label !== ds.label) {
        badge.dataset.label = ds.label;
        const icon = ds.label === 'Night' ? 'moon' : ds.label === 'Evening' || ds.label === 'Dawn' ? 'sunset' : 'sun';
        badge.innerHTML = `${iconSVG(icon)}<span>${ds.label}</span>`;
        badge.className = `hud-chip daytime ${ds.label.toLowerCase()}`;
    }
}

// flocks of birds by day, bats by night
let ambientFlock = null;
let nextFlockAt = (typeof performance !== 'undefined' ? performance.now() : 0) + 6000;
function updateFlock(now, ds) {
    if (!ambientFlock && now > nextFlockAt) {
        const fromLeft = Math.random() < 0.5;
        const bats = ds.night > 0.55;
        const count = bats ? 3 + Math.floor(Math.random() * 3) : 3 + Math.floor(Math.random() * 4);
        ambientFlock = {
            start: now, dur: bats ? 6500 : 8000, fromLeft, bats,
            y0: canvas.height * (0.15 + Math.random() * 0.5),
            drift: (Math.random() - 0.5) * canvas.height * 0.3,
            birds: Array.from({ length: count }, (_, i) => ({
                dx: -i * 28 * DPR * (0.8 + Math.random() * 0.4), dy: (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 16 * DPR + Math.random() * 6 * DPR,
                phase: Math.random() * 6,
            })),
        };
    }
    if (ambientFlock && now - ambientFlock.start > ambientFlock.dur) {
        ambientFlock = null;
        nextFlockAt = now + 14000 + Math.random() * 22000;
    }
}

function drawFlock(now) {
    const f = ambientFlock;
    if (!f) return;
    const S = HEX_SIZE;
    const t = (now - f.start) / f.dur;
    const span = canvas.width + 300 * DPR;
    const baseX = f.fromLeft ? -150 * DPR + span * t : canvas.width + 150 * DPR - span * t;
    const dir = f.fromLeft ? 1 : -1;
    for (const b of f.birds) {
        const x = baseX + b.dx * dir;
        const y = f.y0 + f.drift * t + b.dy + (f.bats ? Math.sin(now / 90 + b.phase) * 8 * DPR : Math.sin(now / 400 + b.phase) * 4 * DPR);
        const flap = Math.sin(now / (f.bats ? 60 : 110) + b.phase);
        const w = S * (f.bats ? 0.32 : 0.36);
        // shadow on the ground far below
        ctx.save();
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = 'rgba(47,42,69,0.16)';
        ctx.beginPath(); ctx.ellipse(x + 30 * DPR, y + S * 2.2, w * 0.7, w * 0.22, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        ctx.strokeStyle = f.bats ? '#1E1A2C' : '#3B3552';
        ctx.fillStyle = f.bats ? '#2A2540' : '#3B3552';
        ctx.lineWidth = 2.4 * DPR; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        if (f.bats) {
            ctx.beginPath();
            ctx.moveTo(x - w, y - flap * w * 0.4);
            ctx.quadraticCurveTo(x - w * 0.5, y + w * 0.1, x, y);
            ctx.quadraticCurveTo(x + w * 0.5, y + w * 0.1, x + w, y - flap * w * 0.4);
            ctx.lineTo(x + w * 0.6, y + w * 0.15); ctx.lineTo(x, y + w * 0.2); ctx.lineTo(x - w * 0.6, y + w * 0.15);
            ctx.closePath(); ctx.fill();
        } else {
            ctx.beginPath();
            ctx.moveTo(x - w, y - flap * w * 0.5);
            ctx.quadraticCurveTo(x - w * 0.45, y - w * 0.35 - flap * w * 0.2, x, y);
            ctx.quadraticCurveTo(x + w * 0.45, y - w * 0.35 - flap * w * 0.2, x + w, y - flap * w * 0.5);
            ctx.stroke();
        }
    }
}

// soft cloud shadows drifting over the island by day
function drawCloudShadows(now, ds) {
    const a = 0.1 * (1 - ds.night);
    if (a < 0.01) return;
    const S = HEX_SIZE;
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = `rgba(47,42,69,${a})`;
    for (let i = 0; i < 2; i++) {
        const span = canvas.width + S * 10;
        const x = ((now * 0.012 * DPR + i * span * 0.55) % span) - S * 5;
        const y = gridCenterY + (i ? -S * 3 : S * 2.5);
        for (const [dx, dy, r] of [[0, 0, 2.2], [S * 1.8, S * 0.3, 1.6], [-S * 1.7, S * 0.4, 1.5]]) {
            ctx.beginPath(); ctx.ellipse(x + dx, y + dy, S * r, S * r * 0.55, 0, 0, Math.PI * 2); ctx.fill();
        }
    }
    ctx.restore();
}

// fireflies drifting over the arena at night
function drawFireflies(now, ds) {
    if (ds.night < 0.25) return;
    const S = HEX_SIZE;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 12; i++) {
        const x = gridCenterX + Math.sin(now / (3000 + i * 170) + i * 1.7) * S * SQRT3 * 5.5;
        const y = gridCenterY + Math.cos(now / (2600 + i * 210) + i * 2.3) * S * 5;
        const flick = 0.5 + 0.5 * Math.sin(now / (300 + i * 37) + i);
        const a = ds.night * flick;
        const g = ctx.createRadialGradient(x, y, 0, x, y, S * 0.28);
        g.addColorStop(0, `rgba(240,255,170,${0.9 * a})`);
        g.addColorStop(0.35, `rgba(220,255,140,${0.35 * a})`);
        g.addColorStop(1, 'rgba(220,255,140,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, S * 0.28, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
}

// warm/cool light over everything already on the canvas (island and pieces, never the empty table)
function applyDayTint(ds) {
    const [r, g, b, a] = ds.tint;
    if (a < 0.01) return;
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
}

// ---------- main render loop ----------
function render() {
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const now = performance.now();
    if (boardLayer) ctx.drawImage(boardLayer, 0, 0);

    const pivotHexes = (game.pivotPreview && game.pivotPiercer)
        ? getPivotHexes(game.pivotPiercer.q, game.pivotPiercer.r, getSkillLevel(game.pivotPiercer, 'pivot') || 1) : [];
    const dashDie = game.phase === 'PLAYER_CARD_DASH_DIR' && game.activeCard ? game.activeCard._dashDie : null;

    const tiles = allHexes.map(h => ({ ...h, ...hexScreen(h.q, h.r), key: hKey(h.q, h.r) })).sort((a, b) => a.y - b.y);

    // Pass 1: flat tile overlays (hazards first, then interaction highlights on top)
    for (const t of tiles) {
        const { x: sx, y: sy, key } = t;
        if (game.voidTiles && game.voidTiles.has(key)) { drawVoid(sx, sy, game.voidTiles.get(key), now); continue; }
        if (game.bearTraps && game.bearTraps.has(key)) {
            const trap = game.bearTraps.get(key);
            // Bear traps are hidden from opponents; only render the player's own traps
            if (trap && trap.team === 'player') {
                tileOverlay(sx, sy, 'rgba(62,58,82,0.8)', '#C9C4DA', 2);
                drawIcon(ctx, 'trap', sx, sy + HEX_SIZE * 0.05, HEX_SIZE * 0.7, '#E6E2F2', 2.2);
            }
        }
        if (game.vineTraps && game.vineTraps.has(key)) drawVines(sx, sy, game.vineTraps.get(key), now);
        if (game.burningTiles && game.burningTiles.has(key)) drawFire(sx, sy, now, t.q * 3 + t.r, game.burningTiles.get(key));

        if (game.reachable && game.reachable.has(key)) {
            const info = game.reachable.get(key);
            const hazard = (game.burningTiles && game.burningTiles.has(key)) || (game.vineTraps && game.vineTraps.has(key)) ||
                (game.bearTraps && game.bearTraps.has(key) && game.bearTraps.get(key).team === 'player');
            if (info.isAttack) {
                tileOverlay(sx, sy, 'rgba(224,96,126,0.5)', '#7A2440', 3);
            } else if (hazard) {
                // keep the hazard visible: outline only, dashed to say "you can walk here, but careful"
                if (ctx.setLineDash) ctx.setLineDash([5 * DPR, 4 * DPR]);
                tileOverlay(sx, sy, null, '#FFF6D8', 3, 0.84);
                if (ctx.setLineDash) ctx.setLineDash([]);
            } else {
                tileOverlay(sx, sy, 'rgba(255,250,230,0.55)', CLAY.playerDark, 2, 0.84);
            }
        }
        if (dashDie && DIRS.some(d => t.q === dashDie.q + d.q && t.r === dashDie.r + d.r)) {
            tileOverlay(sx, sy, 'rgba(242,184,75,0.55)', '#7A5510', 3);
        }
        if (pivotHexes.some(n => n.q === t.q && n.r === t.r)) {
            const pulse = Math.sin(now / 150) * 0.12 + 0.45;
            tileOverlay(sx, sy, `rgba(228,87,46,${pulse})`, '#7A2A12', 3);
        }
        if (hoveredHex && hoveredHex.q === t.q && hoveredHex.r === t.r && game.phase && game.phase.startsWith('PLAYER')) {
            tileOverlay(sx, sy, 'rgba(255,255,255,0.25)', CLAY.ink, 2.5);
        }
        if (game.selectedDie && game.selectedDie.q === t.q && game.selectedDie.r === t.r) {
            tileOverlay(sx, sy, 'rgba(242,184,75,0.5)', CLAY.ink, 3);
        }
    }

    // movement path of the action being previewed
    if (game.preview && !['PLAYER_TURN', 'PLAYER_ARCHER_TARGET'].includes(game.phase)) clearPreview();
    drawPreviewPath(now);

    // Pass 2: things that stand on tiles, in depth order
    const standing = [];
    for (const t of tiles) {
        if (game.blocks && game.blocks.has(t.key)) standing.push({ y: t.y, draw: () => drawWall(t.x, t.y, game.blocks.get(t.key), now) });
        if (game.eventTiles && game.eventTiles.has(t.key)) standing.push({ y: t.y, draw: () => drawEventCrystal(t.x, t.y, now, t.q + t.r * 2, game.eventTiles.get(t.key)) });
    }
    for (const bee of (game.bees || [])) {
        standing.push({ y: hexScreen(bee.q, bee.r).y + 0.3, draw: () => drawBee(bee, now) });
    }
    for (const z of (game.zombies || [])) {
        standing.push({ y: hexScreen(z.q, z.r).y + 0.05, draw: () => drawZombie(z, now) });
    }
    for (const die of allDice()) {
        if (die.hp <= 0) continue;
        if (animatingDie && animatingDie.id === die.id) continue;
        const pos = diePosition(die, now);
        const alpha = die.concealed > 0 ? (die.team === game.currentTurn ? 0.45 : 0.1) : 1;
        standing.push({ y: pos.y + 0.2, draw: () => drawDieUnit(pos.x, pos.y, die, {
            value: getDieEffectiveDamage(die), alpha, tilt: pos.tilt,
            selected: game.selectedDie && game.selectedDie.id === die.id,
            showMoves: game.currentTurn === die.team,
        }) });
    }
    standing.sort((a, b) => a.y - b.y);
    for (const s of standing) s.draw();

    if (animatingDie && animatingDie.renderX != null) {
        const die = animatingDie;
        const sx = die.renderX + gridCenterX, sy = die.renderY + gridCenterY;
        const hop = animRotation ? (animRotation / (Math.PI * 2)) % 1 : 0;
        drawDieUnit(sx, sy, die, { value: getDieEffectiveDamage(die), hop, alpha: die.concealed > 0 ? 0.45 : 1 });
    }

    // time of day: light the island, drift cloud shadows
    const ds = dayState(now);
    updateDayCycleUI(now, ds);
    applyDayTint(ds);
    drawCloudShadows(now, ds);

    drawBoardFx(now);
    drawPreviewBadges();

    // Psychic Push: soft violet vignette
    if (game.psychicAura) {
        const pulse = Math.sin(now / 200) * 0.08 + 0.22;
        const g = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, canvas.height * 0.3, canvas.width / 2, canvas.height / 2, canvas.height * 0.8);
        g.addColorStop(0, 'rgba(132,104,196,0)');
        g.addColorStop(1, `rgba(132,104,196,${pulse})`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    updateAndDrawParticles(ctx, now);
    drawFireflies(now, ds);
    updateFlock(now, ds);
    drawFlock(now);

    floatingTexts = floatingTexts.filter(ft => now < ft.end);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    for (const ft of floatingTexts) {
        const t = (now - ft.start) / (ft.end - ft.start);
        const y = ft.y - t * 40 * DPR;
        const pop = t < 0.12 ? 0.7 + t / 0.12 * 0.3 : 1;
        ctx.globalAlpha = t > 0.7 ? (1 - t) / 0.3 : 1;
        ctx.font = `${Math.round((ft.size || 18) * 0.9 * DPR * pop)}px 'Lilita One', sans-serif`;
        ctx.strokeStyle = 'rgba(47,42,69,0.9)';
        ctx.lineWidth = 4.5 * DPR;
        ctx.strokeText(ft.text, ft.x, y);
        ctx.fillStyle = ft.color;
        ctx.fillText(ft.text, ft.x, y);
    }
    ctx.globalAlpha = 1;

    requestAnimationFrame(render);
}

function addFloatingText(text, q, r, color, size) {
    const clean = stripEmoji(String(text));
    if (!clean) return;
    const p = hexScreen(q, r);
    // stack texts that start at the same spot so they don't overprint
    const nowT = performance.now();
    const stacked = floatingTexts.filter(ft => Math.abs(ft.x - p.x) < 2 && nowT - ft.start < 300).length;
    floatingTexts.push({
        text: clean, x: p.x, y: p.y - HEX_SIZE * 0.6 - stacked * 18 * DPR,
        color: color || '#fff', size: size || 18,
        start: nowT, end: nowT + 1300
    });
}
