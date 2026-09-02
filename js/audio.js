// ==========================================================
// 4. SOUND & BGM SYSTEM (Web Audio API)
// ==========================================================
let audioCtx = null;
let bgmEnabled = true;
let bgmTimer = null;
let bgmStep = 0;

function getAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx;
}

function playTone(freq, dur, type='sine', vol=0.15) {
    try {
        const ctx = getAudio();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(vol, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime + dur);
    } catch(e) {}
}

function playNoise(dur, vol=0.08) {
    try {
        const ctx = getAudio();
        const bufSize = ctx.sampleRate * dur;
        const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(vol, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
        src.connect(gain); gain.connect(ctx.destination);
        src.start();
    } catch(e) {}
}

const SFX = {
    roll()     { for(let i=0;i<5;i++) setTimeout(()=>playNoise(0.04,0.06), i*50); },
    move()     { playTone(220, 0.1, 'sine', 0.08); },
    attack()   { playNoise(0.15, 0.2); playTone(120, 0.2, 'sawtooth', 0.12); },
    destroy()  { playNoise(0.3, 0.25); playTone(80, 0.4, 'sawtooth', 0.15); setTimeout(()=>playTone(60,0.3,'square',0.1),150); },
    cardGet()  { playTone(660,0.1); setTimeout(()=>playTone(880,0.15),100); },
    heal()     { playTone(520,0.15); setTimeout(()=>playTone(660,0.15),100); setTimeout(()=>playTone(780,0.2),200); },
    freeze()   { playTone(1200,0.15,'sine',0.1); setTimeout(()=>playTone(800,0.2,'sine',0.08),80); },
    powerUp()  { playTone(440,0.1); setTimeout(()=>playTone(550,0.1),80); setTimeout(()=>playTone(660,0.15),160); },
    dash()     { playNoise(0.2,0.15); playTone(300,0.3,'sawtooth',0.1); },
    block()    { playTone(150,0.15,'square',0.1); },
    swap()     { playTone(400,0.08); setTimeout(()=>playTone(500,0.08),60); setTimeout(()=>playTone(400,0.1),120); },
    conceal()  { playTone(800,0.3,'sine',0.06); },
    blitz()    { playTone(150,0.4,'sawtooth',0.2); setTimeout(()=>playTone(300,0.4,'square',0.2),200); },
    win()      { [523,659,784,1047].forEach((f,i)=>setTimeout(()=>playTone(f,0.3,'sine',0.12),i*150)); },
    lose()     { [400,350,300,200].forEach((f,i)=>setTimeout(()=>playTone(f,0.3,'sawtooth',0.1),i*200)); },
};

const BGM_MELODY = [
    220, 261, 293, 329, 293, 261, 220, 196,
    220, 293, 329, 392, 329, 293, 220, 261
];
function startBGM() {
    if (bgmTimer) return;
    bgmTimer = setInterval(() => {
        if (!bgmEnabled) return;
        const freq = BGM_MELODY[bgmStep % BGM_MELODY.length];
        playTone(freq, 0.18, 'triangle', 0.02);
        if (bgmStep % 4 === 0) playTone(110, 0.25, 'sine', 0.03);
        bgmStep++;
    }, 300);
}

function toggleBGM() {
    bgmEnabled = !bgmEnabled;
    const btn = document.getElementById('bgm-toggle');
    if (btn) btn.textContent = bgmEnabled ? '🔊 Music On' : '🔇 Music Off';
}
