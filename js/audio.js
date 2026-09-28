// ==========================================================
// 4. SOUND & MUSIC (Web Audio API, fully procedural)
// ==========================================================
let audioCtx = null;
let bgmEnabled = true;
let bgmTimer = null;
let musicGain = null, sfxGain = null, noiseBuffer = null;

function getAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const comp = audioCtx.createDynamicsCompressor();
        comp.threshold.value = -16; comp.ratio.value = 3;
        comp.connect(audioCtx.destination);
        musicGain = audioCtx.createGain();
        musicGain.gain.value = bgmEnabled ? 0.55 : 0;
        musicGain.connect(comp);
        sfxGain = audioCtx.createGain();
        sfxGain.gain.value = 0.9;
        sfxGain.connect(comp);
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
}

function getNoise() {
    const ctx = getAudio();
    if (!noiseBuffer) {
        noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
        const data = noiseBuffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    return noiseBuffer;
}

function audioNow() { try { return getAudio().currentTime; } catch (e) { return 0; } }

const midiHz = m => 440 * Math.pow(2, (m - 69) / 12);

// Generic voice: oscillator -> optional filter -> envelope
function voice({ freq, type = 'sine', t, dur, vol = 0.1, attack = 0.005, out, filter, glideTo, detune = 0 }) {
    try {
        const ctx = getAudio();
        const start = t ?? ctx.currentTime;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, start);
        if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, start + dur);
        osc.detune.value = detune;
        g.gain.setValueAtTime(0.0001, start);
        g.gain.exponentialRampToValueAtTime(vol, start + attack);
        g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
        let node = osc;
        if (filter) {
            const f = ctx.createBiquadFilter();
            f.type = filter.type || 'lowpass';
            f.frequency.value = filter.freq;
            f.Q.value = filter.q || 0.7;
            osc.connect(f); node = f;
        }
        node.connect(g); g.connect(out || sfxGain);
        osc.start(start); osc.stop(start + dur + 0.05);
    } catch (e) {}
}

function noiseHit({ t, dur, vol = 0.1, type = 'bandpass', freq = 2000, q = 1, out, sweepTo }) {
    try {
        const ctx = getAudio();
        const start = t ?? ctx.currentTime;
        const src = ctx.createBufferSource();
        src.buffer = getNoise();
        const f = ctx.createBiquadFilter();
        f.type = type; f.frequency.setValueAtTime(freq, start); f.Q.value = q;
        if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, start + dur);
        const g = ctx.createGain();
        g.gain.setValueAtTime(vol, start);
        g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
        src.connect(f); f.connect(g); g.connect(out || sfxGain);
        src.start(start, Math.random() * 0.5); src.stop(start + dur + 0.05);
    } catch (e) {}
}

// Legacy helpers kept for any older callers
function playTone(freq, dur, type = 'sine', vol = 0.15) { voice({ freq, dur, type, vol: vol * 0.8 }); }
function playNoise(dur, vol = 0.08) { noiseHit({ dur, vol, type: 'lowpass', freq: 3000 }); }

const SFX = {
    // plastic-on-wood clack, strength 0..1
    diceHit(strength = 1) {
        const v = 0.05 + 0.12 * strength;
        noiseHit({ dur: 0.035, vol: v, type: 'bandpass', freq: 2600 + Math.random() * 900, q: 2.5 });
        voice({ freq: 900 + Math.random() * 600, type: 'triangle', dur: 0.03, vol: v * 0.5 });
    },
    roll() { for (let i = 0; i < 4; i++) setTimeout(() => SFX.diceHit(0.35 + Math.random() * 0.2), i * 45); },
    move() {
        voice({ freq: 520, type: 'sine', dur: 0.08, vol: 0.06, glideTo: 380 });
        noiseHit({ dur: 0.03, vol: 0.03, freq: 1500, q: 1.5 });
    },
    attack() {
        noiseHit({ dur: 0.12, vol: 0.16, type: 'lowpass', freq: 1800 });
        voice({ freq: 180, type: 'sine', dur: 0.18, vol: 0.18, glideTo: 70 });
    },
    destroy() {
        noiseHit({ dur: 0.35, vol: 0.18, type: 'lowpass', freq: 900, sweepTo: 200 });
        voice({ freq: 140, type: 'sine', dur: 0.4, vol: 0.2, glideTo: 45 });
    },
    cardGet() {
        const t = audioNow();
        [76, 81, 88].forEach((m, i) => voice({ freq: midiHz(m), type: 'triangle', t: t + i * 0.07, dur: 0.25, vol: 0.07 }));
    },
    heal() {
        const t = audioNow();
        [72, 76, 79, 84].forEach((m, i) => voice({ freq: midiHz(m), type: 'sine', t: t + i * 0.06, dur: 0.35, vol: 0.06 }));
    },
    freeze() {
        const t = audioNow();
        [96, 91, 88].forEach((m, i) => voice({ freq: midiHz(m), type: 'sine', t: t + i * 0.05, dur: 0.3, vol: 0.05 }));
        noiseHit({ dur: 0.25, vol: 0.04, type: 'highpass', freq: 5000 });
    },
    powerUp() {
        const t = audioNow();
        [67, 71, 74, 79].forEach((m, i) => voice({ freq: midiHz(m), type: 'triangle', t: t + i * 0.06, dur: 0.22, vol: 0.07 }));
    },
    dash() { noiseHit({ dur: 0.35, vol: 0.12, type: 'bandpass', freq: 600, q: 0.8, sweepTo: 2400 }); },
    block() { voice({ freq: 150, type: 'square', dur: 0.12, vol: 0.05, filter: { freq: 600 } }); noiseHit({ dur: 0.08, vol: 0.06, type: 'lowpass', freq: 700 }); },
    swap() {
        const t = audioNow();
        [72, 79, 72].forEach((m, i) => voice({ freq: midiHz(m), type: 'triangle', t: t + i * 0.06, dur: 0.1, vol: 0.06 }));
    },
    conceal() { voice({ freq: midiHz(84), type: 'sine', dur: 0.5, vol: 0.05, attack: 0.08, glideTo: midiHz(91) }); },
    blitz() {
        const t = audioNow();
        voice({ freq: midiHz(50), type: 'sawtooth', t, dur: 0.5, vol: 0.06, filter: { freq: 900 } });
        voice({ freq: midiHz(57), type: 'sawtooth', t: t + 0.12, dur: 0.5, vol: 0.06, filter: { freq: 900 } });
        voice({ freq: midiHz(62), type: 'sawtooth', t: t + 0.24, dur: 0.7, vol: 0.07, filter: { freq: 1200 } });
    },
    wind() { noiseHit({ dur: 2.0, vol: 0.12, type: 'bandpass', freq: 300, q: 1.2, sweepTo: 1100 }); },
    crumble() {
        noiseHit({ dur: 0.3, vol: 0.12, type: 'lowpass', freq: 500, sweepTo: 150 });
        voice({ freq: 90, type: 'sine', dur: 0.25, vol: 0.1, glideTo: 40 });
    },
    ignite() { noiseHit({ dur: 0.45, vol: 0.1, type: 'highpass', freq: 800, sweepTo: 3000 }); },
    buzz() {
        voice({ freq: 190, type: 'sawtooth', dur: 1.4, vol: 0.035, attack: 0.2, filter: { freq: 1400 }, glideTo: 230 });
        voice({ freq: 196, type: 'sawtooth', dur: 1.4, vol: 0.03, attack: 0.3, filter: { freq: 1400 }, glideTo: 220, detune: 20 });
    },
    magic() {
        const t = audioNow();
        [74, 78, 81, 86, 90, 93].forEach((m, i) => voice({ freq: midiHz(m), type: 'sine', t: t + i * 0.08, dur: 0.5, vol: 0.05 }));
    },
    alien() {
        voice({ freq: 600, type: 'sine', dur: 1.6, vol: 0.05, attack: 0.3, glideTo: 900 });
        voice({ freq: 606, type: 'sine', dur: 1.6, vol: 0.04, attack: 0.3, glideTo: 450, detune: 30 });
    },
    teleport() { voice({ freq: 300, type: 'sine', dur: 0.35, vol: 0.07, glideTo: 1400 }); noiseHit({ dur: 0.3, vol: 0.05, type: 'highpass', freq: 3000 }); },
    quake() {
        noiseHit({ dur: 1.4, vol: 0.2, type: 'lowpass', freq: 220, sweepTo: 90 });
        voice({ freq: 55, type: 'sine', dur: 1.2, vol: 0.15, glideTo: 35 });
    },
    bubble() {
        const t = audioNow();
        for (let i = 0; i < 4; i++) voice({ freq: 300 + Math.random() * 500, type: 'sine', t: t + i * 0.07, dur: 0.08, vol: 0.05, glideTo: 900 + Math.random() * 400 });
    },
    robot() {
        const t = audioNow();
        [0, 0.12, 0.24].forEach((d, i) => voice({ freq: 220 + i * 110, type: 'square', t: t + d, dur: 0.1, vol: 0.035, filter: { freq: 1600 } }));
    },
    win() {
        const t = audioNow();
        [62, 66, 69, 74, 78].forEach((m, i) => voice({ freq: midiHz(m), type: 'triangle', t: t + i * 0.13, dur: 0.5, vol: 0.09 }));
    },
    lose() {
        const t = audioNow();
        [69, 65, 62, 57].forEach((m, i) => voice({ freq: midiHz(m), type: 'triangle', t: t + i * 0.2, dur: 0.5, vol: 0.08, filter: { freq: 1500 } }));
    },
};

// ----------------------------------------------------------
// Background music: a calm tabletop-adventure loop in D dorian.
// Kalimba arpeggios, warm bass, soft pad, woody percussion and an
// ocarina melody that joins every second loop.
// ----------------------------------------------------------
const BGM = {
    bpm: 92,
    bars: [
        { bass: 38, tones: [62, 65, 69, 72] }, // Dm7
        { bass: 46, tones: [58, 62, 65, 69] }, // Bbmaj7
        { bass: 41, tones: [60, 65, 69, 72] }, // F
        { bass: 36, tones: [60, 64, 67, 72] }, // C
        { bass: 38, tones: [62, 65, 69, 74] }, // Dm
        { bass: 43, tones: [62, 67, 70, 74] }, // Gm
        { bass: 46, tones: [62, 65, 70, 74] }, // Bb
        { bass: 45, tones: [61, 64, 69, 73] }, // A
    ],
    arpOrder: [0, 2, 1, 3, 2, 1, 3, 2],
    arpHits: [1, 0, 1, 1, 0, 1, 1, 1],
    melody: [
        [32, 74, 2], [34, 72, 1], [35, 69, 3], [38, 67, 2],
        [40, 70, 2], [42, 69, 2], [44, 67, 2], [46, 65, 2],
        [48, 65, 1], [49, 67, 1], [50, 69, 2], [52, 70, 2], [54, 72, 2],
        [56, 73, 3], [59, 69, 1], [60, 74, 4],
    ],
    step: 0, loop: 0, nextTime: 0,
};

function scheduleBgmStep(step, t) {
    const eighth = 60 / BGM.bpm / 2;
    const bar = BGM.bars[Math.floor(step / 8) % BGM.bars.length];
    const inBar = step % 8;
    const out = musicGain;

    // pad: one soft chord per bar
    if (inBar === 0) {
        bar.tones.slice(0, 3).forEach((m, i) => voice({
            freq: midiHz(m - 12), type: 'triangle', t, dur: eighth * 8.4, vol: 0.022, attack: 0.5, out,
            filter: { freq: 900 }, detune: i === 1 ? 6 : -4,
        }));
    }
    // bass on beats 1 and 3
    if (inBar === 0 || inBar === 4) {
        const m = inBar === 0 ? bar.bass : bar.bass + 7;
        voice({ freq: midiHz(m), type: 'triangle', t, dur: eighth * 3, vol: 0.12, out, filter: { freq: 500 } });
    }
    // kalimba arpeggio
    if (BGM.arpHits[inBar]) {
        const m = bar.tones[BGM.arpOrder[(inBar + BGM.loop) % 8] % bar.tones.length];
        voice({ freq: midiHz(m), type: 'sine', t, dur: 0.55, vol: 0.05, out });
        voice({ freq: midiHz(m) * 4.02, type: 'sine', t, dur: 0.08, vol: 0.012, out }); // woody attack partial
    }
    // percussion: soft kick, rim on 2 & 4, shaker on off-beats
    if (inBar === 0 || inBar === 4) voice({ freq: 120, type: 'sine', t, dur: 0.14, vol: 0.09, glideTo: 48, out });
    if (inBar === 2 || inBar === 6) noiseHit({ t, dur: 0.05, vol: 0.05, type: 'bandpass', freq: 1800, q: 4, out });
    if (inBar % 2 === 1) noiseHit({ t, dur: 0.03, vol: 0.02, type: 'highpass', freq: 6000, out });

    // ocarina melody on every second loop
    if (BGM.loop % 2 === 1) {
        for (const [s, m, len] of BGM.melody) {
            if (s === step) {
                voice({ freq: midiHz(m), type: 'triangle', t, dur: eighth * len + 0.1, vol: 0.05, attack: 0.04, out, filter: { freq: 2400 } });
                voice({ freq: midiHz(m), type: 'sine', t, dur: eighth * len + 0.1, vol: 0.03, attack: 0.06, out, detune: 7 });
            }
        }
    }
}

function startBGM() {
    if (bgmTimer) return;
    let ctx;
    try { ctx = getAudio(); } catch (e) { return; }
    BGM.nextTime = ctx.currentTime + 0.1;
    BGM.step = 0;
    const eighth = 60 / BGM.bpm / 2;
    // look-ahead scheduler: stays in time even when the page is busy animating
    bgmTimer = setInterval(() => {
        while (BGM.nextTime < ctx.currentTime + 0.2) {
            if (bgmEnabled) scheduleBgmStep(BGM.step, BGM.nextTime);
            BGM.nextTime += eighth;
            BGM.step++;
            if (BGM.step >= BGM.bars.length * 8) { BGM.step = 0; BGM.loop++; }
        }
    }, 50);
}

function toggleBGM() {
    bgmEnabled = !bgmEnabled;
    if (musicGain && audioCtx) musicGain.gain.setTargetAtTime(bgmEnabled ? 0.55 : 0, audioCtx.currentTime, 0.1);
    const btn = document.getElementById('bgm-toggle');
    if (btn) {
        btn.innerHTML = iconSVG(bgmEnabled ? 'music' : 'mute');
        btn.classList.toggle('off', !bgmEnabled);
    }
}
