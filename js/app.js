// Экраны и мини-игры.
'use strict';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const shuffle = arr => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = rand(0, i); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const wait = ms => new Promise(r => setTimeout(r, ms));
const COLOR_KEYS = Object.keys(COLORS);
const TYPE_KEYS = Object.keys(DINO_TYPES);

// ---------- сохранение прогресса ----------
// Сразу читаем из браузера; если игра открыта на claude.ai — ещё и синхронизируем
// с личным хранилищем аккаунта, чтобы коллекция не терялась и была на всех устройствах.
const Store = {
  key: 'dino-milana-v1',
  data: { sound: true, music: true, rounds: {}, owned: [], seenLetters: [] },
  ref: null,
  writing: false,
  dirty: false,
  load() {
    try {
      const raw = localStorage.getItem(this.key);
      if (raw) Object.assign(this.data, JSON.parse(raw));
    } catch (e) { /* без сохранения игра тоже работает */ }
    this.connectCloud();
  },
  save() {
    try { localStorage.setItem(this.key, JSON.stringify(this.data)); } catch (e) { /* ignore */ }
    this.writeCloud();
  },
  progress() {
    const { rounds, owned, seenLetters } = this.data;
    return { rounds, owned, seenLetters };
  },
  // Объединяем: ни один вылупившийся друг и ни одна выученная буква не пропадут.
  merge(remote) {
    const d = this.data;
    const union = (a = [], b = []) => [...new Set([...a, ...b])];
    d.owned = COLLECTION.map(c => c.id).filter(id => union(d.owned, remote.owned).includes(id));
    d.seenLetters = LETTERS.map(x => x.l).filter(l => union(d.seenLetters, remote.seenLetters).includes(l));
    for (const [k, v] of Object.entries(remote.rounds || {})) d.rounds[k] = Math.max(d.rounds[k] || 0, +v || 0);
  },
  async connectCloud() {
    try {
      if (!window.claude || !window.claude.use) return;
      const [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
      if (!db || !user) return;
      const id = await user.id();
      if (!id) return;
      const ref = db.collection('data/users/' + id).doc('progress');
      const snap = await ref.get();
      if (snap.exists) this.merge(snap.data());
      this.ref = ref;
      this.save();
      const badge = $('.btn-meadow .badge');
      if (badge) badge.textContent = this.data.owned.length;
    } catch (e) { /* облако недоступно — играем с браузерным сохранением */ }
  },
  async writeCloud() {
    if (!this.ref) return;
    if (this.writing) { this.dirty = true; return; }
    this.writing = true;
    try { await this.ref.set(this.progress()); } catch (e) { /* повторим при следующем сохранении */ }
    this.writing = false;
    if (this.dirty) { this.dirty = false; this.writeCloud(); }
  },
};
const rounds = id => Store.data.rounds[id] || 0;

// ---------- общий каркас ----------
const app = $('#app');
let token = 0;     // меняется при смене экрана — «гасит» старые асинхронные цепочки
let busy = false;  // блокирует нажатия во время анимаций
let G = null;      // текущая игра

function screen(html, cls = '') {
  token++;
  busy = false;
  Sound.stopSpeech();
  app.innerHTML = `<section class="screen ${cls}">${html}</section>`;
  return app.firstElementChild;
}

// text — что показать в облачке, spoken — что произнести (если отличается: «М» → «мэ»).
function say(text, spoken = text) {
  const b = $('.bubble');
  if (b) { b.textContent = text; b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); }
  return Sound.say(spoken);
}

Sound.onTalk(on => { const g = $('.guide'); if (g) g.classList.toggle('talking', on); });

// Подсказка для взрослого, если Дина не может говорить на этом устройстве.
const VOICE_HELP = {
  unsupported: 'Здесь нет синтеза речи, поэтому Дина молчит. Откройте игру в браузере Chrome или Safari, или установите приложение «Динозаврики».',
  blocked: 'Браузер не разрешил Дине говорить. Нажмите на экран ещё раз.',
  'no-ru': 'На устройстве нет русского голоса. Добавьте его в настройках: «Синтез речи» → русский язык.',
  silent: 'Дина не может говорить. Проверьте громкость и русский голос в настройках синтеза речи или откройте игру в Chrome.',
};
const voiceWarn = document.createElement('button');
voiceWarn.className = 'voice-warn';
voiceWarn.hidden = true;
document.body.appendChild(voiceWarn);
voiceWarn.addEventListener('click', () => { voiceWarn.hidden = true; });
Sound.onProblem(p => {
  voiceWarn.hidden = !p || !VOICE_HELP[p];
  if (p && VOICE_HELP[p]) voiceWarn.innerHTML = `<b>🔇</b><span>${VOICE_HELP[p]}</span><i>✕</i>`;
});

function tap(el, fn) {
  el.addEventListener('pointerdown', e => {
    e.preventDefault();
    Sound.unlock();
    fn(e);
  });
}

function guideHTML(open) { return dinoSVG(GUIDE.t, GUIDE.c, { acc: GUIDE.a, lashes: true, open }); }

// ---------- эффекты ----------
function confetti(n = 70) {
  const cols = ['#ff5fa8', '#9b6cf0', '#ffd23f', '#5ccaf2', '#68c24c', '#f8933a'];
  const layer = document.createElement('div');
  layer.className = 'fx-layer';
  document.body.appendChild(layer);
  for (let i = 0; i < n; i++) {
    const p = document.createElement('i');
    p.className = Math.random() < .3 ? 'conf star' : 'conf';
    p.style.background = Math.random() < .3 ? 'none' : pick(cols);
    if (p.classList.contains('star')) { p.textContent = pick(['⭐', '💖', '✨', '🌸']); }
    p.style.left = Math.random() * 100 + 'vw';
    layer.appendChild(p);
    p.animate([
      { transform: `translate(0,-10vh) rotate(0deg)`, opacity: 1 },
      { transform: `translate(${rand(-15, 15)}vw,105vh) rotate(${rand(-720, 720)}deg)`, opacity: 1 },
    ], { duration: rand(1800, 3200), delay: rand(0, 600), easing: 'cubic-bezier(.3,.6,.6,1)', fill: 'forwards' });
  }
  setTimeout(() => layer.remove(), 4200);
}

function burst(el, chars = ['⭐', '✨', '💖']) {
  if (!el) return;
  const r = el.getBoundingClientRect();
  const layer = document.createElement('div');
  layer.className = 'fx-layer';
  document.body.appendChild(layer);
  for (let i = 0; i < 10; i++) {
    const p = document.createElement('i');
    p.className = 'spark';
    p.textContent = pick(chars);
    p.style.left = r.left + r.width / 2 + 'px';
    p.style.top = r.top + r.height / 2 + 'px';
    layer.appendChild(p);
    const a = Math.random() * Math.PI * 2, d = rand(60, 140);
    p.animate([
      { transform: 'translate(-50%,-50%) scale(.3)', opacity: 1 },
      { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d}px)) scale(1.2)`, opacity: 0 },
    ], { duration: 900, easing: 'ease-out', fill: 'forwards' });
  }
  setTimeout(() => layer.remove(), 1000);
}

function hearts(el) { burst(el, ['💖', '💕', '💗', '✨']); }

function animateClass(el, cls, ms = 600) {
  if (!el) return;
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), ms);
}

// Полёт элемента (угощения) к цели.
function fly(fromEl, toEl, content) {
  const a = fromEl.getBoundingClientRect(), b = toEl.getBoundingClientRect();
  const p = document.createElement('div');
  p.className = 'flyer';
  p.textContent = content;
  p.style.left = a.left + a.width / 2 + 'px';
  p.style.top = a.top + a.height / 2 + 'px';
  document.body.appendChild(p);
  const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
  const anim = p.animate([
    { transform: 'translate(-50%,-50%) scale(1)' },
    { transform: `translate(calc(-50% + ${dx / 2}px), calc(-50% + ${dy / 2 - 80}px)) scale(1.2)`, offset: .5 },
    { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.4)` },
  ], { duration: 550, easing: 'ease-in-out', fill: 'forwards' });
  return anim.finished.then(() => p.remove());
}

// ---------- стартовый экран ----------
function startScreen() {
  const s = screen(`
    <div class="start">
      <h1 class="logo"><span>Динозаврики</span>${KID_GEN ? `<small>для ${KID_GEN}</small>` : ''}</h1>
      <div class="start-dinos">
        <div class="sd sd1">${dinoSVG('rex', 'purple', { acc: 'horn', lashes: true })}</div>
        <div class="sd sd2 guide">${guideHTML(true)}</div>
        <div class="sd sd3">${dinoSVG('ptero', 'sky', { acc: 'flower', lashes: true })}</div>
      </div>
      <button class="play-btn" aria-label="Играть">▶</button>
    </div>`, 'start-screen');
  // click, а не pointerdown: на планшете браузер разрешает речь только по завершённому касанию.
  $('.play-btn', s).addEventListener('click', () => {
    Sound.unlock();
    Sound.setSound(Store.data.sound);
    Sound.setMusic(Store.data.music);
    menuScreen(true);
  });
}

// ---------- меню ----------
// Плитки меню по разделам. art — картинка, text — крупная надпись вместо картинки.
const egg3 = (...cs) => `<div class="tile-row">${cs.map(c => (c === '?' ? '<span class="tile-vs">?</span>' : eggSVG(c, false, true))).join('')}</div>`;
const SECTIONS = [
  { title: '🔢 Числа и счёт', tiles: [
    { id: 'count',   title: 'Считаем яички', art: () => eggSVG('pink'), col: 'c-pink' },
    { id: 'feed',    title: 'Покорми Дину',  art: () => dinoSVG('long', 'pink', { acc: 'bow', lashes: true, open: true }), col: 'c-red' },
    { id: 'compare', title: 'Где больше?',   art: () => egg3('sky', 'sky', '?', 'pink'), col: 'c-mint' },
    { id: 'digits',  title: 'Шарики с цифрами', text: '1 2 3', col: 'c-sky' },
    { id: 'plus',    title: 'Сколько стало?', text: '2+1', col: 'c-lilac' },
    { id: 'claps',   title: 'Барабан',       emoji: '🥁', col: 'c-peach' },
  ] },
  { title: '🔤 Буквы', tiles: [
    { id: 'letters', title: 'Найди букву',   text: 'А', col: 'c-purple' },
    { id: 'abc',     title: 'Азбука',        text: 'АБВ', col: 'c-sky' },
    { id: 'firstpic',title: 'Картинка на букву', emoji: '🍉', col: 'c-pink' },
  ] },
  { title: '🧩 Логика и внимание', tiles: [
    { id: 'pattern', title: 'Продолжи узор', art: () => egg3('pink', 'purple', 'pink', '?'), col: 'c-lilac' },
    { id: 'memory',  title: 'Парочки',       art: () => dinoSVG('tri', 'orange', { lashes: true }), col: 'c-yellow' },
    { id: 'shadow',  title: 'Чья тень?',     art: () => dinoSVG('stego', 'green', { cls: 'silhouette' }), col: 'c-green' },
    { id: 'odd',     title: 'Что лишнее?',   art: () => `<div class="tile-row">${dinoSVG('rex', 'green')}${dinoSVG('rex', 'green')}${eggSVG('pink')}</div>`, col: 'c-mint' },
    { id: 'hide',    title: 'Прятки',        art: () => `<div class="tile-hide">${dinoSVG('tri', 'purple', { lashes: true })}${bushSVG()}</div>`, col: 'c-green' },
    { id: 'puzzle',  title: 'Пазлы',         emoji: '🧩', col: 'c-purple' },
    { id: 'sort',    title: 'Разложи по гнёздам', art: () => egg3('pink', 'sky', 'pink', 'sky'), col: 'c-yellow' },
    { id: 'size',    title: 'Большой и маленький', art: () => `<div class="tile-row bottom">${dinoSVG('rex', 'orange', { lashes: true })}<div class="tile-small">${dinoSVG('rex', 'sky', { lashes: true })}</div></div>`, col: 'c-peach' },
    { id: 'shapes',  title: 'Фигуры',        art: () => `<div class="tile-row">${shapeSVG('star', 'yellow')}${shapeSVG('heart', 'pink')}${shapeSVG('circle', 'sky')}</div>`, col: 'c-red' },
    { id: 'colors',  title: 'Цвета',         art: () => dinoSVG('rex', pick(COLOR_KEYS), { lashes: true }), col: 'c-rainbow' },
  ] },
  { title: '🎨 Творчество', tiles: [
    { id: 'paint',   title: 'Раскраска',     art: () => dinoSVG('tri', { base: '#f57fbc', belly: '#fff9dc', accent: '#9b6cf0' }, { lashes: true }), col: 'c-candy' },
    { id: 'dress',   title: 'Наряди динозаврика', art: () => dinoSVG('rex', 'purple', { acc: 'crown', lashes: true }), col: 'c-lilac' },
    { id: 'piano',   title: 'Пианино',       emoji: '🎹', col: 'c-sky' },
  ] },
];
// Свободные игры без раундов открываются своими экранами.
const FREE_SCREENS = () => ({ abc: abcScreen, paint: paintScreen, dress: dressScreen, piano: pianoScreen });

function tileHTML(t) {
  const art = t.art ? t.art() : t.emoji ? `<span class="tile-emoji">${t.emoji}</span>` : `<span class="tile-letter">${t.text}</span>`;
  return `<button class="tile ${t.col}" data-id="${t.id}"><div class="tile-art">${art}</div><div class="tile-title">${t.title}</div></button>`;
}

function menuScreen(greet) {
  Sound.setMusic(Store.data.music);
  const s = screen(`
    <header class="topbar">
      <div class="guide mini">${guideHTML()}</div>
      <div class="bubble">Во что поиграем?</div>
      <div class="tb-right">
        <button class="round-btn btn-meadow" aria-label="Моя полянка">🌼<span class="badge">${Store.data.owned.length}</span></button>
        <button class="round-btn btn-music ${Store.data.music ? '' : 'off'}" aria-label="Музыка">🎵</button>
        <button class="round-btn btn-sound ${Store.data.sound ? '' : 'off'}" aria-label="Звук">🔊</button>
      </div>
    </header>
    <div class="menu-scroll">
      ${SECTIONS.map(sec => `<h2 class="sec-title">${sec.title}</h2><div class="menu-grid">${sec.tiles.map(tileHTML).join('')}</div>`).join('')}
    </div>`, 'menu-screen');
  // click, а не pointerdown: меню прокручивается, и касание при прокрутке не должно открывать игру.
  $$('.tile', s).forEach(el => el.addEventListener('click', () => {
    Sound.sfx.pop();
    const id = el.dataset.id;
    animateClass(el, 'pressed', 300);
    const open = FREE_SCREENS()[id];
    setTimeout(() => (open ? open() : startGame(id)), 180);
  }));
  tap($('.btn-meadow', s), () => { Sound.sfx.pop(); meadowScreen(); });
  tap($('.btn-sound', s), e => {
    Store.data.sound = !Store.data.sound; Store.save();
    Sound.setSound(Store.data.sound);
    e.currentTarget.classList.toggle('off', !Store.data.sound);
    if (Store.data.sound) say('Звук включён!');
  });
  tap($('.btn-music', s), e => {
    Store.data.music = !Store.data.music; Store.save();
    Sound.setMusic(Store.data.music);
    e.currentTarget.classList.toggle('off', !Store.data.music);
  });
  if (greet) say(`Привет${hi}! Я динозаврик Дина. Выбирай, во что будем играть!`);
  else say('Во что поиграем?');
}

// ---------- каркас мини-игры ----------
function gameShell() {
  return screen(`
    <header class="topbar">
      <button class="round-btn btn-home" aria-label="Домой">🏠</button>
      <div class="guide mini">${guideHTML()}</div>
      <div class="bubble"></div>
      <button class="round-btn btn-repeat" aria-label="Повторить">👂</button>
    </header>
    <div class="progress"></div>
    <div class="stage"></div>`, 'game-screen');
}

function startGame(id) {
  const game = GAMES[id];
  const s = gameShell();
  G = { id, game, step: 0, total: game.total ? game.total() : 5, misses: 0, prompt: '', s, stage: $('.stage', s) };
  tap($('.btn-home', s), () => { Sound.sfx.pop(); menuScreen(); });
  tap($('.btn-repeat', s), () => { if (G.prompt) say(...G.prompt); });
  tap($('.guide', s), () => { if (G.prompt) say(...G.prompt); });
  renderProgress();
  game.next();
}

function renderProgress() {
  const p = $('.progress');
  if (!p) return;
  p.innerHTML = Array.from({ length: G.total }, (_, i) =>
    `<span class="pstep ${i < G.step ? 'done' : ''}">${i < G.step ? '⭐' : ''}</span>`).join('');
}

function ask(text, spoken = text) {
  G.prompt = [text, spoken];
  G.misses = 0;
  return say(text, spoken);
}

// Правильный ответ: похвала, шаг прогресса, следующая задача или награда.
async function correct(text, el, { next = true, spoken = text } = {}) {
  busy = true;
  const t = token;
  Sound.sfx.ding();
  burst(el);
  animateClass($('.guide'), 'happy', 900);
  G.step++;
  renderProgress();
  const praise = pick(PRAISE);
  await say(text ? `${praise} ${text}` : praise, spoken ? `${praise} ${spoken}` : praise);
  if (t !== token) return;
  if (G.step >= G.total) {
    await wait(300);
    if (t !== token) return;
    finishRound();
  } else {
    busy = false;
    if (next) G.game.next();
  }
}

async function wrong(el, text, hintSel, spoken = text) {
  Sound.sfx.boop();
  animateClass(el, 'shake', 600);
  G.misses++;
  if (G.misses >= 2 && hintSel) $$(hintSel, G.stage).forEach(h => h.classList.add('hint'));
  if (text) await say(text, spoken);
  else await say(pick(RETRY));
}

function finishRound() {
  Store.data.rounds[G.id] = rounds(G.id) + 1;
  Store.save();
  rewardScreen(G.id);
}

// ---------- 1. Считаем яички ----------
const countGame = {
  next() {
    const r = rounds('count');
    const maxN = Math.min(10, 5 + r * 2), minN = Math.max(1, maxN - 5);
    let n;
    do n = rand(minN, maxN); while (n === this.last);
    this.last = n;
    this.n = n;
    this.counted = 0;
    const color = pick(COLOR_KEYS);
    const opts = new Set([n]);
    while (opts.size < 3) { const v = n + pick([-3, -2, -1, 1, 2, 3]); if (v >= 1 && v <= 10) opts.add(v); }
    const rows = [];
    for (let i = 0; i < n; i += 5) rows.push(Math.min(5, n - i));
    let idx = 0;
    G.stage.innerHTML = `
      <div class="nest">${rows.map(k => `<div class="egg-row">${Array.from({ length: k }, () =>
        `<button class="egg-btn" data-i="${idx++}">${eggSVG(color)}<span class="egg-num"></span></button>`).join('')}</div>`).join('')}
      </div>
      <div class="options">${shuffle([...opts]).map(v => `<button class="num-opt" data-v="${v}" ${v === n ? 'data-ok' : ''}>
        <b>${v}</b><span class="dots">${'<i></i>'.repeat(v)}</span></button>`).join('')}</div>`;
    $$('.egg-btn', G.stage).forEach(el => tap(el, () => this.tapEgg(el)));
    $$('.num-opt', G.stage).forEach(el => tap(el, () => this.answer(el)));
    ask(G.step === 0 ? 'Сколько яичек в гнёздышке? Нажимай на каждое яичко и считай!' : 'Сколько тут яичек? Посчитай!');
  },
  tapEgg(el) {
    if (busy) return;
    if (el.classList.contains('counted')) { animateClass(el, 'wiggle', 500); return; }
    this.counted++;
    el.classList.add('counted');
    $('.egg-num', el).textContent = this.counted;
    animateClass(el, 'wiggle', 500);
    Sound.sfx.pop();
    say(cap(COUNT[this.counted]));
  },
  async answer(el) {
    if (busy) return;
    const v = +el.dataset.v, n = this.n;
    if (v === n) {
      busy = true;
      el.classList.add('right');
      Sound.sfx.sparkle();
      const color = pick(COLOR_KEYS);
      $$('.egg-btn', G.stage).forEach((e, i) => setTimeout(() => {
        Sound.sfx.crack();
        e.innerHTML = eggSVG(color, true);
        e.classList.add('hatch');
      }, i * 120));
      await wait(n * 120 + 200);
      correct(`${cap(COUNT_N[n])} ${plural(n, 'яичко', 'яичка', 'яичек')}! Малыши вылупились!`, el);
    } else {
      busy = true;
      const t = token;
      await wrong(el, 'Давай посчитаем вместе!');
      if (t !== token) return;
      const eggs = $$('.egg-btn', G.stage);
      eggs.forEach(e => { e.classList.remove('counted'); $('.egg-num', e).textContent = ''; });
      for (let i = 0; i < eggs.length; i++) {
        if (t !== token) return;
        eggs[i].classList.add('counted');
        $('.egg-num', eggs[i]).textContent = i + 1;
        animateClass(eggs[i], 'wiggle', 500);
        await Sound.say(cap(COUNT[i + 1]));
      }
      this.counted = n;
      if (t !== token) return;
      busy = false;
      say('Сколько получилось? Нажми на цифру!');
    }
  },
};

// ---------- 2. Покорми Дину ----------
const feedGame = {
  next() {
    const r = rounds('feed');
    const maxN = Math.min(10, 5 + r * 2);
    let n;
    do n = rand(Math.max(1, maxN - 5), maxN); while (n === this.last);
    this.last = n;
    this.n = n;
    this.fed = 0;
    this.treat = pick(TREATS);
    clearTimeout(this.timer);
    G.stage.innerHTML = `
      <div class="feed">
        <div class="feed-left">
          <div class="target-card"><b>${n}</b><span class="dots">${'<i></i>'.repeat(n)}</span></div>
          <div class="eater">${dinoSVG('long', 'pink', { acc: 'bow', lashes: true, open: true })}<span class="mouth-target"></span></div>
          <div class="fed-count">0</div>
        </div>
        <div class="bowl">${Array.from({ length: 10 }, () => `<button class="treat">${this.treat.e}</button>`).join('')}</div>
      </div>`;
    $$('.treat', G.stage).forEach(el => tap(el, () => this.give(el)));
    const f = this.treat.forms;
    ask(`Дина хочет кушать! Дай ей ${COUNT_FA[n]} ${plural(n, f[0], f[1], f[2])}!`);
  },
  async give(el) {
    if (busy || el.classList.contains('used')) return;
    el.classList.add('used');
    clearTimeout(this.timer);
    const t = token;
    Sound.sfx.pop();
    const eater = $('.eater', G.stage);
    fly(el, $('.mouth-target', G.stage), this.treat.e).then(() => {
      if (t !== token) return;
      Sound.sfx.munch();
      animateClass(eater, 'chomp', 400);
    });
    this.fed++;
    const fed = this.fed, n = this.n;
    $('.fed-count', G.stage).textContent = fed;
    if (fed > n) {
      busy = true;
      await wrong(eater, `Ой! Это уже ${COUNT_F[fed]}. А нужно ${COUNT_F[n]}. Давай сначала!`);
      if (t !== token) return;
      this.fed = 0;
      $('.fed-count', G.stage).textContent = 0;
      $$('.treat', G.stage).forEach(b => b.classList.remove('used'));
      busy = false;
      return;
    }
    say(cap(COUNT_F[fed]));
    if (fed === n) {
      // Если малышка остановилась на нужном числе — засчитываем.
      this.timer = setTimeout(() => {
        if (t !== token || this.fed !== n) return;
        hearts(eater);
        correct(`Ням-ням! Ровно ${COUNT_F[n]}! Спасибо!`, eater);
      }, 1700);
    }
  },
};

// ---------- 3. Найди букву ----------
const lettersGame = {
  next() {
    const r = rounds('letters');
    const unlocked = LETTERS.slice(0, Math.min(LETTERS.length, 8 + r * 3));
    const seen = Store.data.seenLetters;
    const fresh = unlocked.filter(x => !seen.includes(x.l));
    let target;
    if (fresh.length && (G.step === 0 || Math.random() < .5)) target = fresh[0];
    else do target = pick(unlocked); while (unlocked.length > 1 && target === this.last);
    this.last = target;
    this.target = target;
    const isNew = !seen.includes(target.l);
    const k = r < 2 ? 3 : 4;
    const pool = shuffle(unlocked.length >= k ? unlocked : LETTERS).filter(x => x !== target).slice(0, k - 1);
    const choices = shuffle([target, ...pool]);
    const hl = this.highlight(target);
    G.stage.innerHTML = `
      <div class="letter-task">
        <div class="pic-card ${isNew ? 'new' : ''}">${isNew ? '<span class="new-tag">Новая буква!</span>' : ''}
          <div class="pic-emoji">${target.e}</div><div class="pic-word">${hl}</div></div>
        <div class="letters">${choices.map((c, i) => `<button class="letter-btn lb${i}" data-l="${c.l}" ${c === target ? 'data-ok' : ''}>${c.l}</button>`).join('')}</div>
      </div>`;
    $$('.letter-btn', G.stage).forEach(el => tap(el, () => this.answer(el)));
    const mid = target.pos === 'mid' || target.pos === 'end';
    const make = v => (isNew ? 'Новая буква! ' : '') +
      (mid ? `${cap(target.w)}. В этом слове есть ${v}. Найди ${v}!` : `${cap(target.w)} начинается на ${v}. Найди ${v}!`);
    ask(make(letterName(target, false)), make(letterName(target, true)));
  },
  highlight(x) {
    const w = x.w.toUpperCase(), i = w.indexOf(x.l);
    return `${w.slice(0, i)}<em>${w[i]}</em>${w.slice(i + 1)}`;
  },
  async answer(el) {
    if (busy) return;
    const x = this.target;
    Sound.sfx.pop();
    if (el.dataset.l === x.l) {
      el.classList.add('right');
      if (!Store.data.seenLetters.includes(x.l)) { Store.data.seenLetters.push(x.l); Store.save(); }
      correct(`Это ${letterName(x, false, 1)}! ${cap(x.w)}!`, el, { spoken: `Это ${letterName(x, true, 1)}! ${cap(x.w)}!` });
    } else {
      const o = LETTERS.find(y => y.l === el.dataset.l);
      const msg = sp => `Это ${letterName(o, sp, 1)}. А нам нужна ${letterName(x, sp, 1)}!`;
      wrong(el, msg(false), '[data-ok]', msg(true));
    }
  },
};

// «букву М» / «буква М»; для Ь и Ъ — просто «мягкий знак».
function letterName(x, spoken, nom) {
  const v = spoken ? x.s : x.l;
  if (/знак/.test(x.s)) return spoken ? x.s : `знак ${x.l}`;
  return (nom ? 'буква ' : 'букву ') + v;
}

// ---------- 4. Парочки ----------
const memoryGame = {
  total() { const r = rounds('memory'); return r < 1 ? 3 : r < 3 ? 4 : 5; },
  next() {
    const pairs = G.total;
    const types = shuffle(TYPE_KEYS).slice(0, pairs);
    const colors = shuffle(COLOR_KEYS);
    const cards = shuffle(types.flatMap((t, i) => [{ t, c: colors[i] }, { t, c: colors[i] }]));
    const n = cards.length;
    const cols = innerHeight > innerWidth ? (n <= 6 ? 3 : 4) : n / 2;
    G.stage.innerHTML = `<div class="memory" style="--cols:${cols}">
      ${cards.map((c, i) => `<button class="mcard" data-i="${i}" data-t="${c.t}">
        <div class="mface mback"><span>🌸</span></div>
        <div class="mface mfront">${dinoSVG(c.t, c.c, { lashes: true })}</div></button>`).join('')}</div>`;
    this.open = [];
    $$('.mcard', G.stage).forEach(el => tap(el, () => this.flip(el)));
    ask('Найди парочки! Открывай карточки и ищи одинаковых динозавриков.');
  },
  async flip(el) {
    if (busy || el.classList.contains('flipped')) return;
    Sound.sfx.pop();
    el.classList.add('flipped');
    this.open.push(el);
    const name = DINO_TYPES[el.dataset.t].name;
    if (this.open.length === 1) { Sound.say(name); return; }
    const [a, b] = this.open;
    this.open = [];
    if (a.dataset.t === b.dataset.t) {
      a.classList.add('matched');
      b.classList.add('matched');
      correct(`Парочка! ${name}!`, b, { next: false });
    } else {
      busy = true;
      const t = token;
      Sound.say(name);
      await wait(1100);
      if (t !== token) return;
      Sound.sfx.boop();
      a.classList.remove('flipped');
      b.classList.remove('flipped');
      busy = false;
    }
  },
};

// ---------- 5. Чья тень? ----------
const shadowGame = {
  next() {
    const r = rounds('shadow');
    const k = r < 2 ? 3 : 4;
    const types = shuffle(TYPE_KEYS).slice(0, k);
    let target;
    do target = pick(types); while (target === this.last && k > 1);
    this.last = target;
    this.target = target;
    const colors = shuffle(COLOR_KEYS);
    const tc = colors[types.indexOf(target)];
    G.stage.innerHTML = `
      <div class="shadow-task">
        <div class="shadow-pic">${dinoSVG(target, tc, { lashes: true, cls: 'silhouette' })}</div>
        <div class="choices">${types.map((t, i) => `<button class="choice" data-t="${t}" ${t === target ? 'data-ok' : ''}>${dinoSVG(t, colors[i], { lashes: true })}</button>`).join('')}</div>
      </div>`;
    $$('.choice', G.stage).forEach(el => tap(el, () => this.answer(el)));
    ask(G.step === 0 ? 'Ой, кто-то спрятался! Чья это тень? Найди динозаврика!' : 'А это чья тень?');
  },
  answer(el) {
    if (busy) return;
    Sound.sfx.pop();
    const t = el.dataset.t, d = DINO_TYPES[t];
    if (t === this.target) {
      el.classList.add('right');
      $('.shadow-pic .dino', G.stage).classList.remove('silhouette');
      correct(`Это ${d.name}! ${cap(d.kind)}!`, $('.shadow-pic', G.stage));
    } else {
      wrong(el, `Это ${d.name}. Посмотри на тень ещё разок!`, '[data-ok]');
    }
  },
};

// ---------- 6. Цвета ----------
const colorsGame = {
  next() {
    const k = rounds('colors') < 1 ? 4 : 5;
    const colors = shuffle(COLOR_KEYS).slice(0, k);
    let target;
    do target = pick(colors); while (target === this.last);
    this.last = target;
    this.target = target;
    const type = pick(TYPE_KEYS);
    G.stage.innerHTML = `<div class="choices colors-task">${colors.map(c =>
      `<button class="choice" data-c="${c}" ${c === target ? 'data-ok' : ''}>${dinoSVG(type, c, { lashes: true })}</button>`).join('')}</div>`;
    $$('.choice', G.stage).forEach(el => tap(el, () => this.answer(el)));
    ask(`Найди ${COLORS[target].acc} динозаврика!`);
  },
  answer(el) {
    if (busy) return;
    Sound.sfx.pop();
    const c = el.dataset.c;
    if (c === this.target) {
      el.classList.add('right');
      correct(`Это ${COLORS[c].nom} динозаврик!`, el);
    } else {
      wrong(el, `Это ${COLORS[c].nom}. Найди ${COLORS[this.target].acc}!`, '[data-ok]');
    }
  },
};


// ---------- 7. Продолжи узор ----------
const patternGame = {
  next() {
    const r = rounds('pattern');
    const kinds = r < 1 ? ['AB'] : r < 2 ? ['AB', 'AAB', 'ABB'] : ['AB', 'AAB', 'ABB', 'ABC'];
    const kind = pick(kinds);
    const colors = shuffle(['pink', 'sky', 'yellow', 'green', 'purple', 'orange']);
    const unit = [...kind].map(ch => colors[ch.charCodeAt(0) - 65]);
    const shown = unit.length * 2 + rand(0, unit.length - 1);
    const seq = Array.from({ length: shown }, (_, i) => unit[i % unit.length]);
    const answer = unit[shown % unit.length];
    this.answer = answer;
    this.seq = seq;
    const opts = shuffle([...new Set([answer, ...shuffle(unit), colors[3]])].slice(0, 3));
    G.stage.innerHTML = `
      <div class="pattern-task">
        <div class="pattern-row">${seq.map(c => `<div class="p-egg">${eggSVG(c, false, true)}</div>`).join('')}<div class="p-egg p-slot">?</div></div>
        <div class="options">${opts.map(c => `<button class="egg-opt" data-c="${c}" ${c === answer ? 'data-ok' : ''}>${eggSVG(c, false, true)}</button>`).join('')}</div>
      </div>`;
    $$('.egg-opt', G.stage).forEach(el => tap(el, () => this.pick(el)));
    ask(G.step === 0 ? 'Посмотри на яички! Какое яичко будет следующим?' : 'А тут какое яичко дальше?');
  },
  pick(el) {
    if (busy) return;
    Sound.sfx.pop();
    if (el.dataset.c === this.answer) {
      el.classList.add('right');
      const slot = $('.p-slot', G.stage);
      slot.classList.remove('p-slot');
      slot.innerHTML = eggSVG(this.answer, false, true);
      animateClass(slot, 'wiggle', 500);
      correct(`Следующее — ${COLORS[this.answer].neu}!`, slot);
    } else {
      const tail = this.seq.slice(-3).map(c => COLORS[c].neu).join(', ');
      wrong(el, `Давай посмотрим ещё раз: ${tail}… А дальше?`, '[data-ok]');
    }
  },
};

// ---------- 8. Где больше? ----------
const compareGame = {
  next() {
    const r = rounds('compare');
    const max = Math.min(10, 5 + r * 2), minGap = r < 1 ? 2 : 1;
    let a, b;
    do { a = rand(1, max); b = rand(1, max); } while (Math.abs(a - b) < minGap);
    this.more = r < 1 || Math.random() < .6;
    this.counts = [a, b];
    const color = pick(COLOR_KEYS);
    const nest = (n, i) => {
      const rows = [];
      for (let k = 0; k < n; k += 5) rows.push(Math.min(5, n - k));
      const ok = this.more ? n === Math.max(a, b) : n === Math.min(a, b);
      return `<button class="cmp-nest nest" data-i="${i}" ${ok ? 'data-ok' : ''}>${rows.map(k =>
        `<div class="egg-row">${Array.from({ length: k }, () => `<div class="cmp-egg">${eggSVG(color, false, true)}</div>`).join('')}</div>`).join('')}</button>`;
    };
    G.stage.innerHTML = `<div class="compare-task">${nest(a, 0)}${nest(b, 1)}</div>`;
    $$('.cmp-nest', G.stage).forEach(el => tap(el, () => this.pick(el)));
    ask(this.more ? 'Где больше яичек? Нажми на гнёздышко!' : 'А где меньше яичек? Нажми на гнёздышко!');
  },
  pick(el) {
    if (busy) return;
    Sound.sfx.pop();
    const [a, b] = this.counts, i = +el.dataset.i;
    const mine = i === 0 ? a : b, other = i === 0 ? b : a;
    if (el.hasAttribute('data-ok')) {
      el.classList.add('right');
      correct(`Тут ${COUNT_N[mine]}, а там ${COUNT_N[other]}. Здесь ${this.more ? 'больше' : 'меньше'}!`, el);
    } else {
      wrong(el, `Давай посчитаем: тут ${COUNT_N[mine]}, а там ${COUNT_N[other]}. Где ${this.more ? 'больше' : 'меньше'}?`, '[data-ok]');
    }
  },
};

// ---------- 9. Большой и маленький ----------
const sizeGame = {
  next() {
    const k = rounds('size') < 1 ? 3 : 4;
    const scales = shuffle([.42, .62, .8, 1].slice(4 - k));
    const type = pick(TYPE_KEYS);
    const colors = shuffle(COLOR_KEYS);
    this.big = Math.random() < .5;
    const target = this.big ? Math.max(...scales) : Math.min(...scales);
    G.stage.innerHTML = `<div class="size-task">${scales.map((sc, i) =>
      `<button class="size-dino" style="--s:${sc}" ${sc === target ? 'data-ok' : ''}>${dinoSVG(type, colors[i], { lashes: true })}</button>`).join('')}</div>`;
    $$('.size-dino', G.stage).forEach(el => tap(el, () => this.pick(el)));
    ask(this.big ? 'Найди самого большого динозаврика!' : 'Найди самого маленького динозаврика!');
  },
  pick(el) {
    if (busy) return;
    Sound.sfx.pop();
    const word = this.big ? 'большой' : 'маленький';
    if (el.hasAttribute('data-ok')) {
      el.classList.add('right');
      correct(`Это самый ${word}!`, el);
    } else {
      wrong(el, `Этот не самый ${word}. Посмотри внимательно!`, '[data-ok]');
    }
  },
};

const GAMES = {
  count: countGame, feed: feedGame, letters: lettersGame, memory: memoryGame, shadow: shadowGame, colors: colorsGame,
  pattern: patternGame, compare: compareGame, size: sizeGame,
};

// ---------- награда: вылупляется новый друг ----------
function rewardScreen(gameId) {
  const owned = Store.data.owned;
  const friend = COLLECTION.find(c => !owned.includes(c.id));
  const eggColor = friend ? friend.c : 'pink';
  const s = screen(`
    <div class="reward">
      <div class="reward-egg">${eggSVG(eggColor)}<svg class="cracks" viewBox="0 0 100 120"><path class="c1" d="M30,60 L40,52 L46,62 L54,50"/><path class="c2" d="M54,50 L62,60 L70,52 L78,62"/></svg></div>
      <div class="reward-actions hidden">
        <button class="big-btn again" aria-label="Ещё">🔄</button>
        <button class="big-btn meadow" aria-label="Полянка">🌼</button>
        <button class="big-btn home" aria-label="Домой">🏠</button>
      </div>
    </div>`, 'reward-screen');
  const egg = $('.reward-egg', s);
  let taps = 0;
  confetti(40);
  Sound.sfx.fanfare();
  Sound.say(`Ура${hi}! Ты всё ${g('сделала', 'сделал')}! Смотри, яичко! Нажимай на него!`);
  tap(egg, async () => {
    if (taps >= 3) return;
    taps++;
    Sound.sfx.crack();
    animateClass(egg, 'wiggle', 500);
    egg.classList.add('crack' + taps);
    if (taps < 3) return;
    const t = token;
    await wait(350);
    if (t !== token) return;
    Sound.sfx.sparkle();
    confetti(80);
    if (friend) {
      owned.push(friend.id);
      Store.save();
      egg.outerHTML = `<div class="new-friend">${dinoSVG(friend.t, friend.c, { acc: friend.a, lashes: true, open: true })}<div class="friend-name">${friend.n}</div></div>`;
      Sound.say(`Ура! Это ${friend.n}! Теперь ${friend.n} живёт на твоей полянке!`);
    } else {
      egg.outerHTML = `<div class="new-friend"><div class="big-star">🌟</div></div>`;
      Sound.say(`Ура! Золотая звёздочка${KID_GEN ? ` для ${KID_GEN}` : ''}!`);
    }
    $('.reward-actions', s).classList.remove('hidden');
  });
  tap($('.again', s), () => { Sound.sfx.pop(); startGame(gameId); });
  tap($('.meadow', s), () => { Sound.sfx.pop(); meadowScreen(); });
  tap($('.home', s), () => { Sound.sfx.pop(); menuScreen(); });
}

// ---------- раскраска (свободная игра) ----------
const BLANK = 'blank';
function paintScreen() {
  const parts = { body: BLANK, belly: BLANK, accent: BLANK };
  let brush = 'pink', typeIdx = rand(0, TYPE_KEYS.length - 1), painted = 0;
  const s = screen(`
    <header class="topbar">
      <button class="round-btn btn-home" aria-label="Домой">🏠</button>
      <div class="guide mini">${guideHTML()}</div>
      <div class="bubble"></div>
      <button class="round-btn btn-next" aria-label="Другой динозаврик">🦕</button>
    </header>
    <div class="paint">
      <div class="canvas"></div>
      <div class="palette">${COLOR_KEYS.map(k => `<button class="paint-color" data-c="${k}" style="--c:${COLORS[k].base}" aria-label="${COLORS[k].nom}"></button>`).join('')}
        <button class="paint-done" aria-label="Готово">✨</button></div>
    </div>`, 'paint-screen');
  const canvas = $('.canvas', s);
  const colorOf = () => {
    const tone = k => (k === BLANK ? null : COLORS[k]);
    const b = tone(parts.body), y = tone(parts.belly), a = tone(parts.accent);
    return {
      base: b ? b.base : '#efe7f2',
      belly: y ? mix(y.base, '#ffffff', .55) : '#ffffff',
      accent: a ? a.base : '#ded3e6',
    };
  };
  const render = () => { canvas.innerHTML = dinoSVG(TYPE_KEYS[typeIdx], colorOf(), { lashes: true }); };
  const choose = k => {
    brush = k;
    $$('.paint-color', s).forEach(b => b.classList.toggle('sel', b.dataset.c === k));
  };
  render();
  choose(brush);
  tap($('.btn-home', s), () => { Sound.sfx.pop(); menuScreen(); });
  tap($('.btn-next', s), () => {
    Sound.sfx.pop();
    typeIdx = (typeIdx + 1) % TYPE_KEYS.length;
    Object.keys(parts).forEach(p => { parts[p] = BLANK; });
    render();
    say(`Это ${DINO_TYPES[TYPE_KEYS[typeIdx]].name}. Раскрась!`);
  });
  $$('.paint-color', s).forEach(el => tap(el, () => {
    Sound.sfx.pop();
    choose(el.dataset.c);
    say(cap(COLORS[el.dataset.c].nom) + '!');
  }));
  // Какую часть тронули — по заливке фигуры: туловище, животик или гребешок/рожки.
  tap(canvas, e => {
    const fill = (e.target.getAttribute && e.target.getAttribute('fill')) || '';
    const m = fill.match(/url\(#([bfyah])d\d+\)/);
    if (!m) return;
    const part = { b: 'body', f: 'body', y: 'belly', a: 'accent', h: 'accent' }[m[1]];
    if (parts[part] === brush) return;
    parts[part] = brush;
    render();
    Sound.sfx.sparkle();
    burst(canvas, ['✨', '🎨', '💖']);
    if (++painted % 4 === 0) say(pick(['Красиво!', 'Как ярко!', 'Ух ты, здорово!', `${youAre} ${g('художница', 'художник')}!`]));
  });
  tap($('.paint-done', s), () => {
    Sound.sfx.fanfare();
    confetti(60);
    animateClass(canvas, 'jump', 700);
    say(`Какой нарядный динозаврик! ${youAre} ${g('настоящая художница', 'настоящий художник')}!`);
  });
  say('Раскраска! Выбери краску и нажимай на динозаврика: на спинку, животик или гребешок.');
}

// ---------- азбука (свободное изучение) ----------
function abcScreen() {
  const s = screen(`
    <header class="topbar">
      <button class="round-btn btn-home" aria-label="Домой">🏠</button>
      <div class="guide mini">${guideHTML()}</div>
      <div class="bubble"></div>
    </header>
    <div class="abc-grid">${LETTERS.map((x, i) => `<button class="abc-btn lb${i % 6}" data-i="${i}">${x.l}</button>`).join('')}</div>
    <div class="abc-card hidden"></div>`, 'abc-screen');
  tap($('.btn-home', s), () => { Sound.sfx.pop(); menuScreen(); });
  const card = $('.abc-card', s);
  $$('.abc-btn', s).forEach(el => tap(el, () => {
    const x = LETTERS[+el.dataset.i];
    Sound.sfx.pop();
    card.innerHTML = `<div class="abc-inner lb${+el.dataset.i % 6}">
      <div class="abc-letter">${x.l}<small>${x.l.toLowerCase()}</small></div>
      <div class="pic-emoji">${x.e}</div><div class="pic-word">${lettersGame.highlight(x)}</div></div>`;
    card.classList.remove('hidden');
    animateClass(card.firstElementChild, 'pop', 500);
    say(`${x.l} — ${x.w}!`, x.pos ? `${cap(x.s)}. Как в слове ${x.w}.` : `${cap(x.s)}. ${cap(x.w)}!`);
  }));
  tap(card, () => { card.classList.add('hidden'); Sound.sfx.pop(); });
  say('Это азбука! Нажимай на буквы и слушай!');
}

// ---------- полянка с коллекцией ----------
function meadowScreen() {
  const friends = [{ id: 'guide', n: 'Дина', ...GUIDE }, ...COLLECTION.filter(c => Store.data.owned.includes(c.id))];
  const s = screen(`
    <header class="topbar">
      <button class="round-btn btn-home" aria-label="Домой">🏠</button>
      <div class="guide mini">${guideHTML()}</div>
      <div class="bubble"></div>
      <div class="friends-count">🦕 ${friends.length}/${COLLECTION.length + 1}</div>
    </header>
    <div class="meadow">
      ${friends.map((f, i) => `<button class="mfriend" data-i="${i}" style="margin-top:${rand(0, 6)}%;animation-delay:${(Math.random() * 3).toFixed(2)}s">
        ${dinoSVG(f.t, f.c, { acc: f.a, lashes: true })}<span class="mname">${f.n}</span></button>`).join('')}
    </div>
    <div class="treat-bar">${TREATS_MEADOW.map(e => `<button class="mtreat">${e}</button>`).join('')}</div>`, 'meadow-screen');
  tap($('.btn-home', s), () => { Sound.sfx.pop(); menuScreen(); });
  fitMeadow($('.meadow', s), friends.length);
  let selected = null;
  const select = el => {
    $$('.mfriend.sel', s).forEach(x => x.classList.remove('sel'));
    selected = el;
    el.classList.add('sel');
  };
  $$('.mfriend', s).forEach(el => tap(el, () => {
    const f = friends[+el.dataset.i];
    select(el);
    Sound.sfx.pop();
    animateClass(el, 'jump', 700);
    hearts(el);
    say(Math.random() < .5 ? `Я ${f.n}!` : `${f.n}: ${pick(PET)}`);
  }));
  $$('.mtreat', s).forEach(el => tap(el, async () => {
    const target = selected || pick($$('.mfriend', s));
    select(target);
    Sound.sfx.pop();
    const t = token;
    await fly(el, $('svg', target), el.textContent);
    if (t !== token) return;
    Sound.sfx.munch();
    animateClass(target, 'chomp', 500);
    hearts(target);
    say(pick(['Ням-ням! Вкусно!', 'Спасибо! Ням-ням!', 'Ммм, как вкусно!', 'Ещё хочу!']));
  }));
  say(friends.length > 1
    ? 'Это твоя полянка! Гладь динозавриков и угощай вкусняшками!'
    : `Это твоя полянка! Играй в игры, и здесь появятся новые друзья!`);
}

// Подбираем размер динозавриков, чтобы все поместились на полянке без наложений.
function fitMeadow(el, n) {
  const { width: W, height: H } = el.getBoundingClientRect();
  let sz = Math.min(W, H, Math.min(innerWidth, innerHeight) * .34);
  while (sz > 40 && Math.floor(W / sz) * Math.floor(H / (sz * 1.12)) < n) sz -= 4;
  el.style.setProperty('--sz', sz + 'px');
}

// ---------- Android-приложение ----------
// Кнопка «Назад»: из игры — в меню, из меню — выход.
window.androidBack = () => {
  const cur = app.firstElementChild;
  if (!cur || cur.classList.contains('start-screen') || cur.classList.contains('menu-screen')) return 'exit';
  const card = $('.abc-card:not(.hidden)');
  if (card) card.classList.add('hidden');
  else menuScreen();
  return 'handled';
};
window.androidPause = () => Sound.pause();
window.androidResume = () => Sound.resume();

