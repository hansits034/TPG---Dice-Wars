// ==========================================================
// ICON SYSTEM (hand-drawn stroke icons, 24x24 grid)
// Used as inline SVG in HTML and as Path2D on the canvas.
// ==========================================================
const ICONS = {
    // Classes
    dracula: 'M5 8c2 1.6 4.5 2.3 7 2.3S17 9.6 19 8M8.6 9.7 10 15l1.3-4.8M12.7 10.2 14 15l1.4-5.3M4 5.5c2.2-1.6 4.9-2.5 8-2.5s5.8.9 8 2.5',
    angel: 'M7 5a5 1.8 0 1 0 10 0a5 1.8 0 1 0-10 0M12 11c-3-3-7-3-9-1 1 4 4 6.5 9 6.5s8-2.5 9-6.5c-2-2-6-2-9 1zM12 11v9',
    ninja: 'M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4zM12 10.5a1.5 1.5 0 1 0 0 3a1.5 1.5 0 1 0 0-3',
    samurai: 'M20 4 8.5 15.5M6 13l5 5M3.5 20.5 7.2 16.8M17 4h3v3',
    telekinator: 'M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12zM12 9.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5',
    defender: 'M12 3l7 3v5c0 5-3 8.5-7 10-4-1.5-7-5-7-10V6zM12 7v10',
    rage: 'M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.2-4 2.5-5 0 1.8.8 3 2 3.4C11 9 11 6 12 3z',
    necromancer: 'M12 3a7 7 0 0 0-7 7c0 2.5 1.2 4.3 3 5.3V20h8v-4.7c1.8-1 3-2.8 3-5.3a7 7 0 0 0-7-7zM8.8 11a1.2 1.2 0 1 0 2.4 0a1.2 1.2 0 1 0-2.4 0M12.8 11a1.2 1.2 0 1 0 2.4 0a1.2 1.2 0 1 0-2.4 0M11 20v-2.5M13 20v-2.5',
    mage: 'M4 20 14 10M17 3l1 2.5 2.5 1-2.5 1L17 10l-1-2.5-2.5-1 2.5-1zM7 5v2M6 6h2M19 14v2M18 15h2',
    doctor: 'M9.5 4h5v5.5H20v5h-5.5V20h-5v-5.5H4v-5h5.5z',
    piercer: 'M12 4a8 8 0 1 0 0 16a8 8 0 1 0 0-16M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8M12 11.5v1',
    archer: 'M7 3c6 2 9 5.5 9 9s-3 7-9 9M7 3v18M3 12h15M15.5 9.5 18 12l-2.5 2.5',

    // Cards & effects
    heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
    sprint: 'M5 6l6 6-6 6M12 6l6 6-6 6',
    swords: 'M5 3l11 11M19 3 8 14M4.5 16.5l3 3M16.5 19.5l3-3M3 21l2.5-2.5M21 21l-2.5-2.5',
    snow: 'M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M9 3.5l3 2.2 3-2.2M9 20.5l3-2.2 3 2.2',
    aegis: 'M12 3l7 3v5c0 5-3 8.5-7 10-4-1.5-7-5-7-10V6zM9 12l2 2 4-4',
    trap: 'M3 17h18M4 17l2-5 2 5 2-5 2 5 2-5 2 5 2-5 2 5M12 12V8',
    wall: 'M3 6h18v12H3zM3 12h18M9 6v6M15 12v6',
    swap: 'M4 8h14l-3-3M20 16H6l3 3',
    bubble: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M7.5 9a5 5 0 0 1 4-3',
    flask: 'M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3M7.4 15h9.2',
    bolt: 'M13 2 4 14h7l-1 8 9-12h-7z',
    dash: 'M3 8h11a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h7',
    clone: 'M9 9h11v11H9zM5 15V4h11',
    flame: 'M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.2-4 2.5-5 0 1.8.8 3 2 3.4C11 9 11 6 12 3z',
    drop: 'M12 3c3 4.5 6 7.6 6 11a6 6 0 0 1-12 0c0-3.4 3-6.5 6-11z',
    vine: 'M5 20c0-8 5-13 14-15-1 8-6 13-14 15zM5 20 13 11',
    star: 'M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z',

    // Interface
    sun: 'M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
    moon: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z',
    sunset: 'M3 18h18M6 21h12M8 14a4 4 0 0 1 8 0M12 3v5M9 5.5l3 2.5 3-2.5M4.9 10.9l1.4 1.4M17.7 12.3l1.4-1.4',
    menu: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 5a2 2 0 1 0 0 4a2 2 0 1 0 0-4M9 15a2 2 0 1 0 0 4a2 2 0 1 0 0-4',
    help: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .8-1 1.5v.7M12 17.2v.1',
    music: 'M9 18V5l11-2v13M9 18a3 3 0 1 1-3-3 3 3 0 0 1 3 3zM20 16a3 3 0 1 1-3-3 3 3 0 0 1 3 3z',
    mute: 'M9 18V5l11-2v13M9 18a3 3 0 1 1-3-3 3 3 0 0 1 3 3zM20 16a3 3 0 1 1-3-3 3 3 0 0 1 3 3zM3 3l18 18',
    hourglass: 'M6 3h12M6 21h12M7.5 3c0 5.5 9 5.5 9 9s-9 3.5-9 9M16.5 3c0 5.5-9 5.5-9 9s9 3.5 9 9',
    clock: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M12 7v5l3 2',
    flag: 'M5 21V4M5 4h12l-2.5 4L17 12H5',
    cards: 'M4.5 7.5l8-3 4.8 12.5-8 3zM15 4.5l4.5 1.7-2.5 6.5',
    end: 'M5 5l8 7-8 7zM17 5v14',
    undo: 'M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
    close: 'M6 6l12 12M18 6 6 18',
    trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
    left: 'M15 5l-7 7 7 7',
    right: 'M9 5l7 7-7 7',
    fast: 'M4 6l7 6-7 6zM12 6l7 6-7 6z',
    stats: 'M5 20V10M12 20V4M19 20v-7',
    trophy: 'M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 21h8M10 17h4v4h-4z',
    dice: 'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM8.5 8.5h.01M15.5 8.5h.01M12 12h.01M8.5 15.5h.01M15.5 15.5h.01',
    book: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 21a2 2 0 0 1 2-2h13v2',
    home: 'M4 11 12 4l8 7M6 9.5V20h12V9.5',
    restart: 'M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4',
};

// Clay colour for each class medallion
// Dice body palette per role (top face colour, emboss light, shade and pip colour).
// Team is shown separately: green side band + coaster for your dice, red for the enemy.
const CLASS_DICE = {
    dracula:     { body: '#7B2D4F', light: '#9C4A6E', dark: '#4E1A32', pip: '#FFF3F6' },
    angel:       { body: '#F1D27A', light: '#FBE7AE', dark: '#C9A241', pip: '#5A4A1E' },
    ninja:       { body: '#34395A', light: '#4B5178', dark: '#1F2238', pip: '#E8ECFF' },
    samurai:     { body: '#2F2B38', light: '#48425A', dark: '#18151E', pip: '#F2C96B' },
    telekinator: { body: '#8266C9', light: '#9B83DB', dark: '#5A439A', pip: '#FFF9F0' },
    defender:    { body: '#6C8199', light: '#8497AE', dark: '#46586C', pip: '#FFF9F0' },
    rage:        { body: '#E4642E', light: '#F07F4F', dark: '#A8421A', pip: '#FFF4E8' },
    necromancer: { body: '#5B5170', light: '#716787', dark: '#3A3349', pip: '#B8F28A' },
    mage:        { body: '#3E7FC4', light: '#5B95D2', dark: '#285A91', pip: '#FFF9F0' },
    doctor:      { body: '#EEF2F4', light: '#D9E2E8', dark: '#B9C4CC', pip: '#2F2A45' },
    piercer:     { body: '#D39B2A', light: '#E0B04F', dark: '#9A6E14', pip: '#FFF9F0' },
    archer:      { body: '#8C6A3F', light: '#A07E52', dark: '#5F4526', pip: '#FFF4E0' },
};

// Medallion colour for each class in the interface (readable behind a light icon)
const CLASS_COLORS = Object.fromEntries(Object.entries(CLASS_DICE).map(([k, v]) => [k, v.body]));
CLASS_COLORS.angel = '#D6A93A';
CLASS_COLORS.doctor = '#6F9FB2';

// Card id -> icon name
const CARD_ICONS = {
    heal: 'heart', sprint: 'sprint', dmg2: 'swords', freeze: 'snow', aegis: 'aegis', bearTrap: 'trap',
    block: 'wall', swap: 'swap', conceal: 'bubble', cure: 'flask', atkAgain: 'bolt', dash: 'dash',
    clone: 'clone', dmg3: 'flame',
};

function iconSVG(name, cls = '') {
    const d = ICONS[name];
    if (!d) return '';
    return `<svg class="ico ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
}

// Round clay medallion for a class, used in HTML lists
function classBadge(archId, size = 'md') {
    const color = CLASS_COLORS[archId] || '#7A7894';
    return `<span class="class-badge ${size}" style="--cb:${color}">${iconSVG(archId)}</span>`;
}

function archName(archId) {
    const a = ARCHETYPES.find(x => x.id === archId);
    return a ? a.name : archId;
}

const _pathCache = {};
function drawIcon(c, name, x, y, size, color, lineWidth = 2.4) {
    const d = ICONS[name];
    if (!d || typeof Path2D === 'undefined') return;
    const p = _pathCache[name] || (_pathCache[name] = new Path2D(d));
    c.save();
    c.translate(x - size / 2, y - size / 2);
    c.scale(size / 24, size / 24);
    c.lineWidth = lineWidth;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.strokeStyle = color;
    c.stroke(p);
    c.restore();
}

// Removes emoji / pictographs from any game text so the UI never falls back to system emoji
const EMOJI_RE = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{200D}\u{20E3}]/gu;
function stripEmoji(text) {
    if (typeof text !== 'string') return text;
    return text.replace(EMOJI_RE, '').replace(/[ \t]{2,}/g, ' ').replace(/\(\s+/g, '(').trim();
}
