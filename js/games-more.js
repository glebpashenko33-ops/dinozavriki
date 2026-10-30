// Ещё мини-игры: числа, буквы, логика и творчество.
'use strict';

const hit = (x, y, el) => {
  const r = el.getBoundingClientRect();
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
};

// Перетаскивание пальцем. Короткое касание без движения считается нажатием (onTap).
// onDrop(x, y) возвращает true, если элемент принят; иначе он плавно возвращается на место.
function draggable(el, { onDrop, onTap }) {
  el.addEventListener('pointerdown', e => {
    if (busy) return;
    e.preventDefault();
    Sound.unlock();
    const sx = e.clientX, sy = e.clientY;
    let moved = false;
    el.setPointerCapture(e.pointerId);
    el.classList.add('dragging');
    const move = ev => {
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      if (!moved && Math.hypot(dx, dy) > 8) moved = true;
      if (moved) el.style.transform = `translate(${dx}px, ${dy}px) scale(1.08)`;
    };
    const up = ev => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.classList.remove('dragging');
      const from = el.style.transform;
      el.style.transform = '';
      if (!moved) { if (onTap) onTap(); return; }
      if (!onDrop(ev.clientX, ev.clientY) && from) {
        el.animate([{ transform: from }, { transform: 'none' }], { duration: 260, easing: 'ease-out' });
      }
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  });
}

const eggsWord = n => plural(n, 'яичко', 'яичка', 'яичек');
const numOptions = (n, max) => {
  const opts = new Set([n]);
  while (opts.size < 3) { const v = n + pick([-2, -1, 1, 2]); if (v >= 1 && v <= max) opts.add(v); }
  return shuffle([...opts]);
};
const numButtons = (opts, n) => `<div class="options">${opts.map(v => `<button class="num-opt" data-v="${v}" ${v === n ? 'data-ok' : ''}>
  <b>${v}</b><span class="dots">${'<i></i>'.repeat(v)}</span></button>`).join('')}</div>`;

// ---------- Шарики с цифрами ----------
const digitsGame = {
  next() {
    const max = rounds('digits') < 1 ? 5 : 10;
    let n;
    do n = rand(1, max); while (n === this.target);
    this.target = n;
    this.max = max;
    if (!$('.sky-field', G.stage)) {
      G.stage.innerHTML = '<div class="sky-field"></div>';
      this.spawnLoop();
    }
    ask(`Лопни шарик с цифрой ${COUNT[n]}!`);
  },
  spawnLoop() {
    const t = token;
    const field = $('.sky-field', G.stage);
    const timer = setInterval(() => {
      if (t !== token) { clearInterval(timer); return; }
      if ($$('.balloon', field).length >= 7) return;
      const v = Math.random() < .45 ? this.target : rand(1, this.max);
      const b = document.createElement('button');
      b.className = 'balloon' + (G.misses >= 2 && v === this.target ? ' hint' : '');
      b.dataset.v = v;
      b.style.left = rand(4, 84) + '%';
      b.style.setProperty('--c', COLORS[pick(COLOR_KEYS)].base);
      b.innerHTML = `<span>${v}</span>`;
      field.appendChild(b);
      const anim = b.animate([{ transform: 'translateY(0)' }, { transform: `translateY(-${field.clientHeight + 200}px)` }],
        { duration: rand(7000, 9500), easing: 'linear' });
      anim.finished.then(() => b.remove()).catch(() => {});
      tap(b, () => this.pop(b));
    }, 850);
  },
  pop(b) {
    if (busy || b.classList.contains('popped')) return;
    const v = +b.dataset.v;
    if (v === this.target) {
      b.classList.add('popped');
      Sound.sfx.pop2();
      burst(b, ['🎉', '✨', '⭐']);
      setTimeout(() => b.remove(), 200);
      correct(`Это ${COUNT[v]}!`, null);
    } else {
      wrong(b, `Это ${COUNT[v]}. А нам нужна ${COUNT[this.target]}!`);
      if (G.misses >= 2) $$('.balloon', G.stage).forEach(x => x.classList.toggle('hint', +x.dataset.v === this.target));
    }
  },
};

// ---------- Сколько стало? (сложение) ----------
const plusGame = {
  async next() {
    const r = rounds('plus');
    const maxSum = r < 1 ? 5 : r < 2 ? 7 : 10;
    const a = rand(1, maxSum - 1), b = rand(1, Math.min(3, maxSum - a));
    this.a = a;
    this.b = b;
    this.sum = a + b;
    const color = pick(COLOR_KEYS);
    const eggs = (n, cls) => Array.from({ length: n }, () => `<div class="plus-egg ${cls}">${eggSVG(color)}</div>`).join('');
    G.stage.innerHTML = `
      <div class="plus-task">
        <div class="nest plus-nest"><div class="egg-row">${eggs(a, '')}${eggs(b, 'new hidden-egg')}</div></div>
        <div class="equation"></div>
        <div class="plus-opts"></div>
      </div>`;
    const text = `Было ${COUNT_N[a]} ${eggsWord(a)}. Прилетело ещё ${COUNT_N[b]}. Сколько стало?`;
    G.prompt = [text, text];
    G.misses = 0;
    busy = true;
    const t = token;
    await say(`Было ${COUNT_N[a]} ${eggsWord(a)}.`);
    if (t !== token) return;
    $$('.hidden-egg', G.stage).forEach((e, i) => setTimeout(() => {
      e.classList.remove('hidden-egg');
      e.classList.add('drop-in');
      Sound.sfx.pop();
    }, i * 300));
    await wait(b * 300 + 200);
    if (t !== token) return;
    $('.plus-opts', G.stage).innerHTML = numButtons(numOptions(this.sum, 10), this.sum);
    $$('.num-opt', G.stage).forEach(el => tap(el, () => this.answer(el)));
    busy = false;
    say(`Прилетело ещё ${COUNT_N[b]}! Сколько стало?`);
  },
  async answer(el) {
    if (busy) return;
    Sound.sfx.pop();
    const { a, b, sum } = this;
    if (+el.dataset.v === sum) {
      el.classList.add('right');
      $('.equation', G.stage).textContent = `${a} + ${b} = ${sum}`;
      correct(`${cap(COUNT[a])} и ${COUNT[b]} — это ${COUNT[sum]}!`, el);
      return;
    }
    busy = true;
    const t = token;
    await wrong(el, 'Давай посчитаем вместе!');
    const eggs = $$('.plus-egg', G.stage);
    for (let i = 0; i < eggs.length; i++) {
      if (t !== token) return;
      animateClass(eggs[i], 'wiggle', 500);
      eggs[i].classList.add('counted');
      await Sound.say(cap(COUNT[i + 1]));
    }
    if (t !== token) return;
    busy = false;
    say('Сколько получилось?');
  },
};

// ---------- Барабан: счёт на слух ----------
const clapsGame = {
  next() {
    const max = Math.min(7, 4 + rounds('claps'));
    let n;
    do n = rand(1, max); while (n === this.n);
    this.n = n;
    G.stage.innerHTML = `
      <div class="claps-task">
        <button class="drum" aria-label="Послушать ещё раз">🥁</button>
        <div class="claps-opts"></div>
      </div>`;
    tap($('.drum', G.stage), () => { if (!busy) this.play(false); });
    G.prompt = ['Слушай и считай, сколько раз я ударю в барабан!', 'Слушай и считай, сколько раз я ударю в барабан!'];
    G.misses = 0;
    this.play(false, true);
  },
  async play(countAloud, intro) {
    busy = true;
    const t = token;
    if (intro) await say(G.prompt[0]);
    else if (!countAloud) await say('Слушай!');
    if (t !== token) return;
    const drum = $('.drum', G.stage);
    for (let i = 1; i <= this.n; i++) {
      if (t !== token) return;
      Sound.sfx.drum();
      animateClass(drum, 'boom', 300);
      animateClass($('.guide'), 'happy', 600);
      if (countAloud) await Sound.say(cap(COUNT[i]));
      else await wait(700);
    }
    if (t !== token) return;
    if (!$('.num-opt', G.stage)) {
      $('.claps-opts', G.stage).innerHTML = numButtons(numOptions(this.n, 7), this.n);
      $$('.num-opt', G.stage).forEach(el => tap(el, () => this.answer(el)));
    }
    busy = false;
    say('Сколько раз? Нажми на цифру! А барабан можно послушать ещё.');
  },
  async answer(el) {
    if (busy) return;
    Sound.sfx.pop();
    const n = this.n;
    if (+el.dataset.v === n) {
      el.classList.add('right');
      correct(`${cap(COUNT[n])} ${plural(n, 'раз', 'раза', 'раз')}!`, el);
    } else {
      const t = token;
      await wrong(el, 'Давай послушаем ещё раз и посчитаем вместе!');
      if (t === token) this.play(true);
    }
  },
};

// ---------- Картинка на букву ----------
const firstpicGame = {
  next() {
    const pool = LETTERS.filter(x => !x.pos);
    const open = pool.slice(0, Math.min(pool.length, 8 + rounds('firstpic') * 3));
    let x;
    do x = pick(open); while (x === this.x && open.length > 1);
    this.x = x;
    const others = shuffle(pool.filter(y => y !== x)).slice(0, 2);
    const cards = shuffle([x, ...others]);
    G.stage.innerHTML = `
      <div class="letter-task">
        <div class="letter-btn lb1 big-letter">${x.l}</div>
        <div class="pics">${cards.map(c => `<button class="pic-choice" data-l="${c.l}" ${c === x ? 'data-ok' : ''}>
          <span class="pic-emoji">${c.e}</span><span class="pic-label">${c.w}</span></button>`).join('')}</div>
      </div>`;
    $$('.pic-choice', G.stage).forEach(el => tap(el, () => this.answer(el)));
    const make = sp => `Найди картинку на ${letterName(x, sp)}!`;
    ask(make(false), make(true));
  },
  answer(el) {
    if (busy) return;
    Sound.sfx.pop();
    const x = this.x, o = LETTERS.find(y => y.l === el.dataset.l);
    el.classList.add('shown');
    if (o === x) {
      el.classList.add('right');
      const msg = sp => `${cap(x.w)} начинается на ${letterName(x, sp)}!`;
      correct(msg(false), el, { spoken: msg(true) });
    } else {
      const msg = sp => `Это ${o.w}, на ${letterName(o, sp)}. А нам нужна ${letterName(x, sp, 1)}!`;
      wrong(el, msg(false), '[data-ok]', msg(true));
    }
  },
};

// ---------- Что лишнее? ----------
const ODD_THINGS = ['🍎', '🚗', '⚽', '🎈', '🌸', '🧸', '🍦'];
const oddGame = {
  next() {
    const r = rounds('odd');
    const kinds = r < 1 ? ['type', 'thing'] : ['type', 'thing', 'color'];
    const kind = pick(kinds);
    const [t1, t2] = shuffle(TYPE_KEYS);
    const colors = shuffle(COLOR_KEYS);
    let items, why;
    if (kind === 'type') {
      items = [0, 1, 2].map(i => dinoSVG(t1, colors[i], { lashes: true }));
      items.push(dinoSVG(t2, colors[3], { lashes: true }));
      why = 'Этот динозаврик не такой, как все!';
    } else if (kind === 'thing') {
      items = [0, 1, 2].map(i => dinoSVG(TYPE_KEYS[(i + rand(0, 4)) % 5], colors[i], { lashes: true }));
      items.push(`<span class="odd-emoji">${pick(ODD_THINGS)}</span>`);
      why = 'Это не динозаврик!';
    } else {
      items = [0, 1, 2].map(() => dinoSVG(t1, colors[0], { lashes: true }));
      items.push(dinoSVG(t1, colors[1], { lashes: true }));
      why = `Все ${COLORS[colors[0]].nom.replace(/ый$|ий$|ой$/, m => ({ 'ый': 'ые', 'ий': 'ие', 'ой': 'ые' })[m])}, а этот ${COLORS[colors[1]].nom}!`;
    }
    this.why = why;
    const order = shuffle([0, 1, 2, 3]);
    G.stage.innerHTML = `<div class="choices odd-task">${order.map(i =>
      `<button class="choice" ${i === 3 ? 'data-ok' : ''}>${items[i]}</button>`).join('')}</div>`;
    $$('.choice', G.stage).forEach(el => tap(el, () => this.answer(el)));
    ask(G.step === 0 ? 'Кто тут лишний? Найди того, кто не такой, как все!' : 'А тут кто лишний?');
  },
  answer(el) {
    if (busy) return;
    Sound.sfx.pop();
    if (el.hasAttribute('data-ok')) {
      el.classList.add('right');
      correct(this.why, el);
    } else {
      wrong(el, 'Этот похож на других. Кто не такой?', '[data-ok]');
    }
  },
};

// ---------- Прятки ----------
const hideGame = {
  async next() {
    const k = rounds('hide') < 1 ? 3 : 4;
    const types = shuffle(TYPE_KEYS).slice(0, k);
    const colors = shuffle(COLOR_KEYS);
    this.target = pick(types);
    G.stage.innerHTML = `<div class="hide-task">${types.map((t, i) => `<button class="hide-spot" data-t="${t}" ${t === this.target ? 'data-ok' : ''}>
      <div class="hide-dino">${dinoSVG(t, colors[i], { lashes: true })}</div>${bushSVG()}</button>`).join('')}</div>`;
    $$('.hide-spot', G.stage).forEach(el => tap(el, () => this.answer(el)));
    const name = DINO_TYPES[this.target].name;
    G.prompt = [`Где спрятался ${name}?`, `Где спрятался ${name}?`];
    G.misses = 0;
    busy = true;
    const t = token;
    await say(G.step === 0 ? 'Запоминай, кто где стоит! Сейчас динозаврики спрячутся.' : 'Запоминай!');
    if (t !== token) return;
    await wait(1200 + k * 300);
    if (t !== token) return;
    $$('.hide-spot', G.stage).forEach(s => s.classList.add('hidden'));
    Sound.sfx.pop();
    await wait(700);
    if (t !== token) return;
    busy = false;
    say(G.prompt[0]);
  },
  async answer(el) {
    if (busy) return;
    Sound.sfx.pop();
    el.classList.remove('hidden');
    const d = DINO_TYPES[el.dataset.t];
    if (el.dataset.t === this.target) {
      el.classList.add('right');
      correct(`Вот ${d.name}!`, el);
    } else {
      const t = token;
      busy = true;
      await wrong(el, `Тут ${d.name}! Ищи ${DINO_TYPES[this.target].name}!`);
      if (t !== token) return;
      el.classList.add('hidden');
      busy = false;
    }
  },
};

// ---------- Пазлы ----------
const puzzleGame = {
  total: () => 3,
  next() {
    const r = rounds('puzzle');
    const cols = r < 1 ? 2 : 3, rows = 2, n = cols * rows;
    // Птеродактиль с крыльями даёт почти пустые кусочки — для пазлов берём наземных.
    const type = pick(['rex', 'tri', 'long', 'stego']), color = pick(COLOR_KEYS), acc = pick([undefined, 'bow', 'crown', 'flower']);
    const art = () => dinoSVG(type, color, { lashes: true, acc });
    G.stage.innerHTML = `
      <div class="puzzle">
        <div class="pz-board" style="--cols:${cols};--rows:${rows}">
          <div class="pz-ghost">${art()}</div>
          ${Array.from({ length: n }, (_, i) => `<div class="pz-cell" data-i="${i}"></div>`).join('')}
        </div>
        <div class="pz-tray"></div>
      </div>`;
    const board = $('.pz-board', G.stage), tray = $('.pz-tray', G.stage);
    const W = board.clientWidth, H = board.clientHeight, cw = W / cols, chh = H / rows;
    this.placed = 0;
    this.n = n;
    shuffle([...Array(n).keys()]).forEach(i => {
      const c = i % cols, rw = Math.floor(i / cols);
      const piece = document.createElement('div');
      piece.className = 'pz-piece';
      piece.dataset.i = i;
      // В лотке кусочки уменьшены (--k), на своём месте — в полный размер.
      piece.style.setProperty('--cw', cw + 'px');
      piece.style.setProperty('--ch', chh + 'px');
      piece.innerHTML = `<div class="pz-img" style="width:${W}px;height:${H}px;--x:${-c * cw}px;--y:${-rw * chh}px">${art()}</div>`;
      tray.appendChild(piece);
      draggable(piece, {
        onTap: () => { animateClass(piece, 'wiggle', 500); say('Перетащи кусочек пальчиком на своё место!'); },
        onDrop: (x, y) => this.drop(piece, x, y),
      });
    });
    ask(G.step === 0 ? 'Собери динозаврика! Перетаскивай кусочки на картинку.' : 'Собери ещё одного!');
  },
  drop(piece, x, y) {
    const cell = $$('.pz-cell', G.stage).find(c => !c.firstChild && hit(x, y, c));
    if (!cell) return false;
    if (cell.dataset.i !== piece.dataset.i) {
      Sound.sfx.boop();
      G.misses++;
      if (G.misses >= 2) {
        const right = $(`.pz-cell[data-i="${piece.dataset.i}"]`, G.stage);
        animateClass(right, 'hint', 2400);
      }
      return false;
    }
    cell.appendChild(piece);
    piece.classList.add('placed');
    Sound.sfx.pop();
    burst(cell, ['✨', '⭐']);
    G.misses = 0;
    if (++this.placed === this.n) {
      $('.pz-board', G.stage).classList.add('done');
      correct('Динозаврик собран!', $('.pz-board', G.stage));
    }
    return true;
  },
};

// ---------- Разложи по гнёздам ----------
const sortGame = {
  total: () => 3,
  next() {
    const k = rounds('sort') < 1 ? 2 : 3;
    const colors = shuffle(['pink', 'sky', 'yellow', 'green', 'purple']).slice(0, k);
    const eggs = shuffle(colors.flatMap(c => [c, c, c]));
    this.left = eggs.length;
    this.sel = null;
    G.stage.innerHTML = `
      <div class="sort-task">
        <div class="sort-eggs">${eggs.map(c => `<div class="sort-egg" data-c="${c}">${eggSVG(c, false, true)}</div>`).join('')}</div>
        <div class="sort-nests">${colors.map(c => `<button class="sort-nest nest" data-c="${c}" style="--c:${COLORS[c].base}">
          <span class="nest-tag">${eggSVG(c, false, true)}</span><div class="nest-in"></div></button>`).join('')}</div>
      </div>`;
    $$('.sort-egg', G.stage).forEach(egg => draggable(egg, {
      onTap: () => { $$('.sort-egg.sel', G.stage).forEach(e => e.classList.remove('sel')); egg.classList.add('sel'); this.sel = egg; Sound.sfx.pop(); },
      onDrop: (x, y) => {
        const nest = $$('.sort-nest', G.stage).find(n => hit(x, y, n));
        return nest ? this.put(egg, nest) : false;
      },
    }));
    $$('.sort-nest', G.stage).forEach(nest => tap(nest, () => { if (this.sel) this.put(this.sel, nest); }));
    ask(G.step === 0 ? 'Разложи яички по гнёздышкам! Каждое яичко — в гнёздышко своего цвета.' : 'Разложи яички по цветам!');
  },
  put(egg, nest) {
    if (busy) return false;
    const c = egg.dataset.c;
    if (c !== nest.dataset.c) {
      wrong(egg, `Это ${COLORS[c].neu} яичко. Ему в ${COLORS[c].neu} гнёздышко!`);
      return false;
    }
    egg.classList.remove('sel');
    this.sel = null;
    $('.nest-in', nest).appendChild(egg);
    egg.classList.add('in-nest');
    Sound.sfx.pop();
    burst(nest, ['✨']);
    if (--this.left === 0) correct('Все яички на своих местах!', $('.sort-nests', G.stage));
    return true;
  },
};

// ---------- Фигуры ----------
const shapesGame = {
  next() {
    const r = rounds('shapes');
    const open = r < 1 ? ['circle', 'square', 'triangle', 'star', 'heart'] : Object.keys(SHAPES);
    const k = r < 1 ? 3 : 4;
    const choices = shuffle(open).slice(0, k);
    let target;
    do target = pick(choices); while (target === this.last);
    this.last = target;
    this.target = target;
    const colors = shuffle(COLOR_KEYS);
    G.stage.innerHTML = `<div class="choices shapes-task">${choices.map((s, i) =>
      `<button class="choice" data-s="${s}" ${s === target ? 'data-ok' : ''}>${shapeSVG(s, colors[i])}</button>`).join('')}</div>`;
    $$('.choice', G.stage).forEach(el => tap(el, () => this.answer(el)));
    ask(`Найди ${SHAPES[target].acc}!`);
  },
  answer(el) {
    if (busy) return;
    Sound.sfx.pop();
    const s = el.dataset.s;
    if (s === this.target) {
      el.classList.add('right');
      correct(`Это ${SHAPES[s].nom}!`, el);
    } else {
      wrong(el, `Это ${SHAPES[s].nom}. Найди ${SHAPES[this.target].acc}!`, '[data-ok]');
    }
  },
};

Object.assign(GAMES, {
  digits: digitsGame, plus: plusGame, claps: clapsGame, firstpic: firstpicGame,
  odd: oddGame, hide: hideGame, puzzle: puzzleGame, sort: sortGame, shapes: shapesGame,
});

// ---------- свободные игры ----------
function freeShell(cls, rightBtn = '') {
  const s = screen(`
    <header class="topbar">
      <button class="round-btn btn-home" aria-label="Домой">🏠</button>
      <div class="guide mini">${guideHTML()}</div>
      <div class="bubble"></div>
      ${rightBtn}
    </header>
    <div class="free-stage"></div>`, cls);
  tap($('.btn-home', s), () => { Sound.sfx.pop(); menuScreen(); });
  return s;
}

// Наряди динозаврика
const OUTFITS = [
  { a: null, e: '🚫', n: 'Без наряда' }, { a: 'bow', e: '🎀', n: 'Бантик!' }, { a: 'crown', e: '👑', n: 'Корона! Как у принцессы!' },
  { a: 'horn', e: '🦄', n: 'Рог единорога!' }, { a: 'flower', e: '🌼', n: 'Цветочек!' }, { a: 'hat', e: '🎩', n: 'Волшебная шляпка!' },
];
function dressScreen() {
  const s = freeShell('dress-screen', '<button class="round-btn btn-next" aria-label="Другой динозаврик">🦕</button>');
  let typeIdx = 0, colorIdx = COLOR_KEYS.indexOf('pink'), acc = null;
  const stage = $('.free-stage', s);
  stage.innerHTML = `
    <div class="dress">
      <div class="canvas dress-canvas"></div>
      <div class="outfits">${OUTFITS.map((o, i) => `<button class="outfit" data-i="${i}">${o.e}</button>`).join('')}
        <button class="outfit recolor" aria-label="Другой цвет">🌈</button></div>
    </div>`;
  const canvas = $('.dress-canvas', s);
  const render = () => { canvas.innerHTML = dinoSVG(TYPE_KEYS[typeIdx], COLOR_KEYS[colorIdx], { acc: acc || undefined, lashes: true, open: true }); };
  render();
  $$('.outfit[data-i]', s).forEach(el => tap(el, () => {
    const o = OUTFITS[+el.dataset.i];
    acc = o.a;
    render();
    Sound.sfx.sparkle();
    animateClass(canvas, 'jump', 700);
    if (o.a) burst(canvas, ['✨', '💖', '⭐']);
    say(o.n);
  }));
  tap($('.recolor', s), () => {
    colorIdx = (colorIdx + 1) % COLOR_KEYS.length;
    render();
    Sound.sfx.sparkle();
    say(cap(COLORS[COLOR_KEYS[colorIdx]].nom) + '!');
  });
  tap($('.btn-next', s), () => {
    typeIdx = (typeIdx + 1) % TYPE_KEYS.length;
    render();
    Sound.sfx.pop();
    say(`Это ${DINO_TYPES[TYPE_KEYS[typeIdx]].name}!`);
  });
  tap(canvas, () => { animateClass(canvas, 'jump', 700); hearts(canvas); say(pick(PET)); });
  say('Наряди динозаврика! Выбирай бантик, корону или шляпку. А радуга меняет цвет!');
}

// Пианино
const PIANO = [
  { f: 262, c: 'red' }, { f: 294, c: 'orange' }, { f: 330, c: 'yellow' }, { f: 349, c: 'green' },
  { f: 392, c: 'sky' }, { f: 440, c: 'blue' }, { f: 494, c: 'purple' }, { f: 523, c: 'pink' },
];
// «Маленькая звёздочка» (народная мелодия): номер клавиши и длительность.
const SONG = [[0, 1], [0, 1], [4, 1], [4, 1], [5, 1], [5, 1], [4, 2], [3, 1], [3, 1], [2, 1], [2, 1], [1, 1], [1, 1], [0, 2]];
function pianoScreen() {
  Sound.setMusic(false);
  const s = freeShell('piano-screen', '<button class="round-btn btn-song" aria-label="Песенка">🎵</button>');
  const stage = $('.free-stage', s);
  stage.innerHTML = `
    <div class="piano">
      <div class="dancer">${dinoSVG('rex', 'purple', { acc: 'horn', lashes: true, open: true })}</div>
      <div class="keys">${PIANO.map((k, i) => `<button class="key" data-i="${i}" style="--c:${COLORS[k.c].base}"><span>${eggSVG(k.c, false, true)}</span></button>`).join('')}</div>
    </div>`;
  const dancer = $('.dancer', s);
  const press = i => {
    Sound.sfx.note(PIANO[i].f);
    const key = $(`.key[data-i="${i}"]`, s);
    animateClass(key, 'down', 250);
    animateClass(dancer, 'jump', 500);
  };
  $$('.key', s).forEach(el => tap(el, () => press(+el.dataset.i)));
  let playing = false;
  tap($('.btn-song', s), async () => {
    if (playing) return;
    playing = true;
    const t = token;
    await say(`Слушай песенку! А потом сыграй ${g('сама', 'сам')}.`);
    for (const [i, d] of SONG) {
      if (t !== token) return;
      press(i);
      await wait(d * 420);
    }
    playing = false;
  });
  say('Это пианино! Нажимай на клавиши и играй музыку. Кнопка с ноткой играет песенку.');
}
