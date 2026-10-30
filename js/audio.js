// Голос (синтез речи), звуковые эффекты и тихая фоновая музыка.
'use strict';

const Sound = (() => {
  let ctx = null, sfxGain, musicGain, musicOn = false, musicTimer = null;
  let soundEnabled = true, musicEnabled = true;
  let voice = null, talkCb = () => {}, speakId = 0;
  const MUSIC_VOL = 0.035, MUSIC_DUCK = 0.008;

  // --- голос ---
  // В Android-приложении речь идёт через системный синтез (мост AndroidTTS из MainActivity):
  // WebView не поддерживает speechSynthesis.
  const android = window.AndroidTTS || null;
  const hasWebSpeech = 'speechSynthesis' in window;
  const loadedAt = Date.now();

  // Почему Дина может молчать — игра показывает родителю подсказку.
  // unsupported — нет синтеза речи вообще; blocked — браузер не разрешил; no-ru — нет русского голоса;
  // silent — фразы не начинают звучать.
  let problem = android || hasWebSpeech ? null : 'unsupported';
  let problemCb = () => {};
  let silentCount = 0;
  function setProblem(p) {
    if (problem === p) return;
    problem = p;
    problemCb(p);
  }

  const FEMALE = /milena|irina|svetlana|alena|alyona|dariya|ekaterina|elena|anna|google|женск|female/i;
  const MALE = /yuri|pavel|dmitr|maxim|male|муж/i;
  function pickVoice() {
    const all = speechSynthesis.getVoices();
    const ru = all.filter(v => /^ru/i.test(v.lang));
    voice = ru.find(v => FEMALE.test(v.name) && !MALE.test(v.name)) || ru.find(v => !MALE.test(v.name)) || ru[0] || null;
    if (all.length && !ru.length) setProblem('no-ru');
    else if (ru.length && problem === 'no-ru') setProblem(null);
  }
  if (!android && hasWebSpeech) {
    pickVoice();
    speechSynthesis.addEventListener('voiceschanged', pickVoice);
  }

  const androidDone = {};
  window.__ttsDone = id => { const f = androidDone[id]; delete androidDone[id]; if (f) f(); };
  let current = null; // Chrome «теряет» фразу, если на неё нет ссылки

  function say(text) {
    return new Promise(resolve => {
      const id = ++speakId;
      const canSpeak = android ? android.ready() : hasWebSpeech;
      if (android && !canSpeak && Date.now() - loadedAt > 4000) setProblem('no-ru');
      if (!soundEnabled || !canSpeak) { setTimeout(resolve, 300 + text.length * 25); return; }
      let done = false, started = false;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(guard);
        clearTimeout(startGuard);
        if (id === speakId) { talkCb(false); duck(false); }
        resolve();
      };
      // onend иногда не приходит (особенно в Chrome) — страхуемся таймером.
      const guard = setTimeout(finish, 1500 + text.length * 90);
      let startGuard = 0;
      talkCb(true);
      duck(true);
      if (android) {
        androidDone[id] = finish;
        android.speak(text, String(id));
        return;
      }
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'ru-RU';
      if (voice) u.voice = voice;
      u.rate = 0.92;
      u.pitch = 1.3;
      u.onstart = () => {
        started = true;
        silentCount = 0;
        if (problem === 'silent' || problem === 'blocked') setProblem(null);
      };
      u.onend = finish;
      u.onerror = e => {
        if (e.error === 'not-allowed') setProblem('blocked');
        else if (/unavailable/.test(e.error || '')) setProblem('no-ru');
        finish();
      };
      // Если фраза так и не зазвучала — не держим ребёнка в ожидании.
      startGuard = setTimeout(() => {
        if (started || done) return;
        if (++silentCount >= 2 && !problem) setProblem('silent');
        finish();
      }, 3500);
      current = u;
      const busy = speechSynthesis.speaking || speechSynthesis.pending;
      speechSynthesis.cancel();
      // Chrome может проглотить фразу, сказанную сразу после cancel(), — даём паузу.
      if (busy) setTimeout(() => { if (id === speakId) speechSynthesis.speak(u); else finish(); }, 80);
      else speechSynthesis.speak(u);
    });
  }

  // Браузеры разрешают речь только после «настоящего» касания (на сенсорных экранах это
  // окончание касания, а не его начало), поэтому будим синтез на click/touchend.
  function primeSpeech() {
    if (android || !hasWebSpeech || primeSpeech.done) return;
    primeSpeech.done = true;
    const u = new SpeechSynthesisUtterance('.');
    u.volume = 0;
    u.lang = 'ru-RU';
    speechSynthesis.speak(u);
  }
  ['click', 'touchend', 'keydown'].forEach(ev => document.addEventListener(ev, () => { primeSpeech(); unlock(); }, true));

  function stopSpeech() {
    speakId++;
    if (android) android.stop();
    else if (hasWebSpeech) speechSynthesis.cancel();
    talkCb(false);
    duck(false);
  }

  // --- WebAudio ---
  function unlock() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      sfxGain = ctx.createGain();
      sfxGain.gain.value = 0.5;
      sfxGain.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = MUSIC_VOL;
      // мягкое «эхо» делает мелодию воздушной и ненавязчивой
      const delay = ctx.createDelay(1);
      delay.delayTime.value = 0.42;
      const fb = ctx.createGain();
      fb.gain.value = 0.35;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1800;
      musicGain.connect(lp);
      lp.connect(ctx.destination);
      lp.connect(delay);
      delay.connect(fb);
      fb.connect(delay);
      delay.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
  }

  function tone(freq, start, dur, { type = 'sine', vol = 0.3, out = sfxGain, attack = 0.01 } = {}) {
    if (!ctx) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, start);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(vol, start + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g);
    g.connect(out);
    o.start(start);
    o.stop(start + dur + 0.05);
    return o;
  }

  const sfx = {
    pop() {
      if (!soundEnabled || !ctx) return;
      const t = ctx.currentTime, o = tone(500, t, 0.12, { vol: 0.25 });
      if (o) o.frequency.exponentialRampToValueAtTime(900, t + 0.08);
    },
    ding() {
      if (!soundEnabled || !ctx) return;
      const t = ctx.currentTime;
      [523, 659, 784, 1047].forEach((f, i) => tone(f, t + i * 0.09, 0.5, { type: 'triangle', vol: 0.22 }));
    },
    boop() {
      if (!soundEnabled || !ctx) return;
      const t = ctx.currentTime, o = tone(320, t, 0.3, { vol: 0.18 });
      if (o) o.frequency.exponentialRampToValueAtTime(200, t + 0.25);
    },
    crack() {
      if (!soundEnabled || !ctx) return;
      const t = ctx.currentTime, len = 0.12;
      const buf = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
      const src = ctx.createBufferSource(), g = ctx.createGain();
      src.buffer = buf;
      g.gain.value = 0.5;
      src.connect(g);
      g.connect(sfxGain);
      src.start(t);
    },
    fanfare() {
      if (!soundEnabled || !ctx) return;
      const t = ctx.currentTime;
      [[523, 0], [659, .12], [784, .24], [1047, .4], [784, .55], [1047, .7]].forEach(([f, d]) =>
        tone(f, t + d, 0.45, { type: 'triangle', vol: 0.22 }));
    },
    munch() {
      if (!soundEnabled || !ctx) return;
      const t = ctx.currentTime;
      [0, 0.15, 0.3].forEach(d => tone(180 + Math.random() * 60, t + d, 0.1, { type: 'square', vol: 0.06 }));
    },
    drum() {
      if (!soundEnabled || !ctx) return;
      const t = ctx.currentTime, o = tone(150, t, 0.4, { vol: 0.6 });
      if (o) o.frequency.exponentialRampToValueAtTime(60, t + 0.3);
      this.crack();
    },
    // нота «маримбы» для пианино
    note(freq) {
      if (!ctx) return;
      const t = ctx.currentTime;
      tone(freq, t, 0.9, { type: 'triangle', vol: 0.35 });
      tone(freq * 2, t, 0.35, { vol: 0.08 });
    },
    pop2() {
      if (!soundEnabled || !ctx) return;
      const t = ctx.currentTime, o = tone(900, t, 0.15, { type: 'square', vol: 0.08 });
      if (o) o.frequency.exponentialRampToValueAtTime(200, t + 0.12);
      this.crack();
    },
    sparkle() {
      if (!soundEnabled || !ctx) return;
      const t = ctx.currentTime;
      [1319, 1568, 1760, 2093, 2637].forEach((f, i) => tone(f, t + i * 0.05, 0.3, { vol: 0.08 }));
    },
  };

  // --- тихая колыбельная-«музыкальная шкатулка» (пентатоника, без резких звуков) ---
  const SCALE = [392, 440, 523, 587, 659, 784, 880];
  const CHORDS = [[262, 330, 392], [220, 262, 330], [175, 220, 262], [196, 247, 294]];
  let beat = 0, last = 3;
  function musicStep() {
    if (!ctx || !musicOn) return;
    const t = ctx.currentTime + 0.05;
    if (beat % 8 === 0) {
      CHORDS[(beat / 8) % CHORDS.length].forEach(f => tone(f, t, 3.6, { vol: 0.25, out: musicGain, attack: 0.8 }));
    }
    if (Math.random() < 0.6) {
      last = Math.max(0, Math.min(SCALE.length - 1, last + [-2, -1, 1, 2][Math.floor(Math.random() * 4)]));
      tone(SCALE[last], t, 1.6, { vol: 0.35, out: musicGain, attack: 0.04 });
    }
    beat++;
  }
  function startMusic() {
    if (!ctx || musicOn || !musicEnabled) return;
    musicOn = true;
    musicTimer = setInterval(musicStep, 600);
  }
  function stopMusic() {
    musicOn = false;
    clearInterval(musicTimer);
  }
  function duck(on) {
    if (!musicGain) return;
    musicGain.gain.setTargetAtTime(on ? MUSIC_DUCK : MUSIC_VOL, ctx.currentTime, 0.2);
  }

  return {
    say, stopSpeech, unlock, sfx,
    onTalk(cb) { talkCb = cb; },
    onProblem(cb) { problemCb = cb; cb(problem); },
    setSound(on) { soundEnabled = on; if (!on) stopSpeech(); },
    setMusic(on) { musicEnabled = on; on ? startMusic() : stopMusic(); },
    startMusic,
    // приложение свёрнуто / снова открыто
    pause() { stopSpeech(); if (ctx) ctx.suspend(); },
    resume() { if (ctx) ctx.resume(); },
  };
})();
