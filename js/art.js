// Рисовка: объёмные мультяшные динозаврики (SVG), яйца, аксессуары.
'use strict';

function mix(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (p, s) => (p >> s) & 255;
  const c = s => Math.round(ch(pa, s) + (ch(pb, s) - ch(pa, s)) * t);
  return '#' + ((1 << 24) | (c(16) << 16) | (c(8) << 8) | c(0)).toString(16).slice(1);
}

// nom — именительный (м.р.), neu — средний род (яичко какое?), acc — винительный (кого?)
const COLORS = {
  red:    { nom: 'красный',     neu: 'красное', acc: 'красного',     base: '#f0544f', belly: '#ffe3da', accent: '#ffd23f' },
  orange: { nom: 'оранжевый',   neu: 'оранжевое', acc: 'оранжевого',   base: '#f8933a', belly: '#fff0db', accent: '#9a6cf0' },
  yellow: { nom: 'жёлтый',      neu: 'жёлтое', acc: 'жёлтого',      base: '#f9cf3c', belly: '#fff9dc', accent: '#f27bb5' },
  green:  { nom: 'зелёный',     neu: 'зелёное', acc: 'зелёного',     base: '#68c24c', belly: '#ecf9d3', accent: '#f8a53a' },
  sky:    { nom: 'голубой',     neu: 'голубое', acc: 'голубого',     base: '#5ccaf2', belly: '#e6f8ff', accent: '#ff8fc7' },
  blue:   { nom: 'синий',       neu: 'синее', acc: 'синего',       base: '#3f7de0', belly: '#e0ebff', accent: '#ffd23f' },
  purple: { nom: 'фиолетовый',  neu: 'фиолетовое', acc: 'фиолетового',  base: '#9b6cf0', belly: '#f2eaff', accent: '#ffd23f' },
  pink:   { nom: 'розовый',     neu: 'розовое', acc: 'розового',     base: '#f57fbc', belly: '#ffeaf5', accent: '#a77cf5' },
};

const DINO_TYPES = {
  rex:   { name: 'Рекси',  kind: 'тираннозаврик', head: [140, 34, 1] },
  tri:   { name: 'Трики',  kind: 'трицератопс', head: [154, 86, .9] },
  long:  { name: 'Дина',   kind: 'диплодок', head: [156, 26, .8] },
  stego: { name: 'Стеша',  kind: 'стегозавр', head: [154, 128, .75] },
  ptero: { name: 'Птеша',  kind: 'птеродактиль', head: [100, 50, .9] },
};

let svgUid = 0;

function defs(c, id) {
  const light = mix(c.base, '#ffffff', .5), dark = mix(c.base, '#2a0a30', .35);
  const al = mix(c.accent, '#ffffff', .5), ad = mix(c.accent, '#2a0a30', .3);
  const rg = (n, s, cx = '35%', cy = '28%') =>
    `<radialGradient id="${n}${id}" cx="${cx}" cy="${cy}" r="85%">${s.map(([o, col]) => `<stop offset="${o}" stop-color="${col}"/>`).join('')}</radialGradient>`;
  return `<defs>
    ${rg('b', [[0, light], [.5, c.base], [1, dark]])}
    ${rg('f', [[0, c.base], [1, mix(dark, '#000000', .15)]])}
    ${rg('y', [[0, '#ffffff'], [.45, c.belly], [1, mix(c.belly, c.base, .35)]], '40%', '30%')}
    ${rg('a', [[0, al], [.5, c.accent], [1, ad]])}
    ${rg('h', [[0, '#fffdf2'], [1, '#efd59a']])}
    ${rg('i', [[0, '#9a6a3a'], [.6, '#5a3416'], [1, '#2a1406']], '45%', '60%')}
  </defs>`;
}

function eye(x, y, r, lashes) {
  const w = r * .12;
  let s = `<g class="eye" style="animation-delay:${(Math.random() * 4).toFixed(2)}s">
    <ellipse cx="${x}" cy="${y}" rx="${r * .84}" ry="${r}" fill="#fff" stroke="#3a2016" stroke-width="${w}"/>
    <ellipse cx="${x + r * .1}" cy="${y + r * .12}" rx="${r * .56}" ry="${r * .62}" fill="url(#iI)"/>
    <ellipse cx="${x + r * .12}" cy="${y + r * .16}" rx="${r * .3}" ry="${r * .34}" fill="#1a0c04"/>
    <circle cx="${x - r * .14}" cy="${y - r * .2}" r="${r * .24}" fill="#fff"/>
    <circle cx="${x + r * .3}" cy="${y + r * .36}" r="${r * .1}" fill="#fff"/>`;
  if (lashes) {
    s += `<path d="M${x - r * .5},${y - r * .78} l${-r * .25},${-r * .35} M${x},${y - r} l0,${-r * .42} M${x + r * .5},${y - r * .78} l${r * .25},${-r * .35}"
      stroke="#3a2016" stroke-width="${w * 1.3}" stroke-linecap="round"/>`;
  }
  return s + '</g>';
}

const cheek = (x, y, r = 8) => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * .6}" fill="#ff6f9a" opacity=".45"/>`;

function mouth(x1, y1, x2, y2, open) {
  const mx = (x1 + x2) / 2, my = Math.max(y1, y2) + 10;
  if (open) {
    return `<path d="M${x1},${y1} Q${mx},${my + 6} ${x2},${y2} Q${mx},${my - 6} ${x1},${y1}Z" fill="#8a2a3a" stroke="#3a2016" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M${mx - 6},${my - 1} Q${mx},${my + 4} ${mx + 7},${my - 2} Q${mx},${my - 6} ${mx - 6},${my - 1}Z" fill="#ff8aa8"/>`;
  }
  return `<path d="M${x1},${y1} Q${mx},${my} ${x2},${y2}" fill="none" stroke="#3a2016" stroke-width="3" stroke-linecap="round"/>`;
}

const plate = (x, y, s, F) =>
  `<path d="M${x - s * .55},${y + s * .5} Q${x - s * .7},${y - s * .3} ${x},${y - s} Q${x + s * .7},${y - s * .3} ${x + s * .55},${y + s * .5}Z" fill="${F}"/>`;

const spike = (x, y, s, F) => `<path d="M${x - s},${y + s * .5} Q${x - s * .2},${y - s * 1.6} ${x + s},${y + s * .4}Z" fill="${F}"/>`;

function bodyRex(B, Fr, Y, A, H, o) {
  return `
    <path d="M62,140 C40,146 22,156 6,150 C12,134 34,116 66,112Z" fill="${B}"/>
    <ellipse cx="122" cy="166" rx="14" ry="18" fill="${Fr}"/><ellipse cx="127" cy="182" rx="18" ry="8" fill="${Fr}"/>
    ${spike(54, 104, 7, A)}${spike(66, 92, 8, A)}${spike(80, 85, 8, A)}
    <ellipse cx="96" cy="130" rx="46" ry="44" fill="${B}"/>
    <ellipse cx="110" cy="140" rx="26" ry="30" fill="${Y}"/>
    <ellipse cx="80" cy="160" rx="22" ry="25" fill="${B}"/><ellipse cx="86" cy="182" rx="23" ry="9" fill="${B}"/>
    <ellipse cx="135" cy="128" rx="11" ry="6" transform="rotate(35 135 128)" fill="${B}"/>
    <path d="M94,74 C92,44 118,30 142,34 C168,38 188,56 188,80 C188,100 170,110 146,108 C118,108 96,100 94,74Z" fill="${B}"/>
    ${eye(124, 64, 14, o.lashes)}${eye(154, 60, 13, o.lashes)}
    <ellipse cx="179" cy="72" rx="2.5" ry="3.5" fill="#3a2016" opacity=".7"/>
    ${cheek(116, 88, 9)}${cheek(174, 90, 7)}
    ${mouth(142, 92, 180, 88, o.open)}`;
}

function bodyTri(B, Fr, Y, A, H, o) {
  let scallops = '';
  for (let i = 0; i < 9; i++) {
    const ang = Math.PI * (0.9 + i * 0.16);
    scallops += `<circle cx="${146 + Math.cos(ang) * 36}" cy="${96 + Math.sin(ang) * 36}" r="9" fill="${A}"/>`;
  }
  return `
    <path d="M50,142 C30,148 16,158 4,152 C12,138 30,124 54,122Z" fill="${B}"/>
    <ellipse cx="62" cy="166" rx="13" ry="18" fill="${Fr}"/><ellipse cx="116" cy="168" rx="13" ry="17" fill="${Fr}"/>
    ${scallops}<circle cx="146" cy="96" r="36" fill="${A}"/><circle cx="146" cy="98" r="24" fill="#fff" opacity=".25"/>
    <ellipse cx="88" cy="134" rx="56" ry="38" fill="${B}"/>
    <ellipse cx="94" cy="150" rx="38" ry="15" fill="${Y}"/>
    <ellipse cx="74" cy="170" rx="15" ry="17" fill="${B}"/><ellipse cx="128" cy="170" rx="15" ry="16" fill="${B}"/>
    <circle cx="68" cy="184" r="3" fill="#fff6e0"/><circle cx="76" cy="185" r="3" fill="#fff6e0"/><circle cx="124" cy="184" r="3" fill="#fff6e0"/><circle cx="132" cy="184" r="3" fill="#fff6e0"/>
    <path d="M134,86 Q124,62 128,46 Q142,62 146,82Z" fill="${H}"/>
    <path d="M158,82 Q162,60 174,48 Q174,68 170,86Z" fill="${H}"/>
    <ellipse cx="154" cy="114" rx="33" ry="28" fill="${B}"/>
    <path d="M178,106 Q186,94 196,94 Q192,108 182,114Z" fill="${H}"/>
    ${eye(144, 106, 11, o.lashes)}${eye(167, 104, 10, o.lashes)}
    ${cheek(136, 124, 7)}${cheek(180, 120, 6)}
    ${mouth(150, 126, 182, 120, o.open)}`;
}

function bodyLong(B, Fr, Y, A, H, o) {
  return `
    <path d="M42,148 C24,154 10,166 2,158 C8,142 24,132 46,128Z" fill="${B}"/>
    <ellipse cx="56" cy="168" rx="13" ry="18" fill="${Fr}"/><ellipse cx="110" cy="170" rx="13" ry="17" fill="${Fr}"/>
    <path d="M104,140 C108,104 118,74 134,50 L164,58 C150,82 142,110 140,142Z" fill="${B}"/>
    <ellipse cx="82" cy="142" rx="52" ry="34" fill="${B}"/>
    <circle cx="60" cy="126" r="6" fill="${A}" opacity=".85"/><circle cx="80" cy="118" r="5" fill="${A}" opacity=".85"/><circle cx="98" cy="127" r="4" fill="${A}" opacity=".85"/>
    <ellipse cx="88" cy="158" rx="34" ry="13" fill="${Y}"/>
    <path d="M118,120 C124,96 132,78 142,64" stroke="${Y}" stroke-width="10" stroke-linecap="round" fill="none" opacity=".9"/>
    <ellipse cx="68" cy="172" rx="15" ry="16" fill="${B}"/><ellipse cx="122" cy="172" rx="15" ry="15" fill="${B}"/>
    <ellipse cx="156" cy="44" rx="30" ry="23" fill="${B}"/>
    ${eye(148, 38, 11, o.lashes)}${eye(170, 38, 10, o.lashes)}
    ${cheek(140, 56, 6)}${cheek(180, 54, 5)}
    ${mouth(156, 56, 182, 50, o.open)}`;
}

function bodyStego(B, Fr, Y, A, H, o) {
  return `
    ${plate(44, 116, 14, A)}${plate(62, 100, 19, A)}${plate(86, 92, 22, A)}${plate(110, 96, 19, A)}${plate(130, 108, 14, A)}
    <path d="M46,142 C26,142 12,132 4,120 C18,122 32,124 50,124Z" fill="${B}"/>
    <path d="M8,121 L4,106 L16,118Z M20,123 L18,108 L28,121Z" fill="${H}"/>
    <ellipse cx="60" cy="168" rx="13" ry="18" fill="${Fr}"/><ellipse cx="116" cy="170" rx="13" ry="17" fill="${Fr}"/>
    <ellipse cx="88" cy="138" rx="56" ry="35" fill="${B}"/>
    <ellipse cx="94" cy="155" rx="36" ry="13" fill="${Y}"/>
    <ellipse cx="72" cy="172" rx="15" ry="16" fill="${B}"/><ellipse cx="126" cy="172" rx="15" ry="15" fill="${B}"/>
    <ellipse cx="138" cy="140" rx="20" ry="17" fill="${B}"/>
    <ellipse cx="158" cy="144" rx="30" ry="24" fill="${B}"/>
    ${eye(148, 136, 11, o.lashes)}${eye(170, 136, 10, o.lashes)}
    ${cheek(140, 156, 6)}${cheek(182, 154, 5)}
    ${mouth(156, 156, 182, 150, o.open)}`;
}

function bodyPtero(B, Fr, Y, A, H, o) {
  const wing = `<path d="M88,104 C68,80 38,72 8,84 C20,94 20,104 16,116 C32,108 44,114 50,126 C62,116 76,118 90,126Z" fill="${A}"/>
    <path d="M86,106 C66,90 40,84 14,88" stroke="${B}" stroke-width="5" fill="none" stroke-linecap="round"/>`;
  return `
    <g class="wing-l">${wing}</g>
    <g class="wing-r"><g transform="translate(200,0) scale(-1,1)">${wing}</g></g>
    <ellipse cx="92" cy="154" rx="7" ry="10" fill="${Fr}"/><ellipse cx="108" cy="154" rx="7" ry="10" fill="${Fr}"/>
    <ellipse cx="100" cy="122" rx="24" ry="32" fill="${B}"/>
    <ellipse cx="100" cy="130" rx="14" ry="20" fill="${Y}"/>
    <path d="M94,52 C88,30 102,16 124,12 C116,28 114,42 110,56Z" fill="${A}"/>
    <circle cx="100" cy="76" r="30" fill="${B}"/>
    <path d="M86,90 Q100,118 116,90 Q100,96 86,90Z" fill="url(#hI)" stroke="#d8a855" stroke-width="1.5"/>
    ${eye(88, 72, 11, o.lashes)}${eye(112, 72, 11, o.lashes)}
    ${cheek(78, 90, 6)}${cheek(122, 90, 6)}`;
}

const BODIES = { rex: bodyRex, tri: bodyTri, long: bodyLong, stego: bodyStego, ptero: bodyPtero };

// Аксессуары рисуются поверх головы: x,y — макушка, k — масштаб.
function accessory(kind, x, y, k) {
  const t = `transform="translate(${x} ${y}) scale(${k})"`;
  switch (kind) {
    case 'bow':
      return `<g ${t}><path d="M0,0 C-10,-14 -28,-14 -28,0 C-28,14 -10,14 0,0Z" fill="#ff5fa8"/><path d="M0,0 C10,-14 28,-14 28,0 C28,14 10,14 0,0Z" fill="#ff5fa8"/>
        <path d="M-4,0 C-10,-8 -20,-8 -20,-2" stroke="#fff" stroke-width="3" opacity=".5" fill="none" stroke-linecap="round"/>
        <circle r="7" fill="#e83e8c"/><circle cx="-2" cy="-2" r="2.5" fill="#fff" opacity=".6"/></g>`;
    case 'crown':
      return `<g ${t}><path d="M-22,4 L-24,-18 L-12,-6 L0,-22 L12,-6 L24,-18 L22,4Z" fill="#ffd23f" stroke="#e0a010" stroke-width="2" stroke-linejoin="round"/>
        <circle cx="0" cy="-4" r="4" fill="#ff5fa8"/><circle cx="-13" cy="-2" r="3" fill="#7fd1ff"/><circle cx="13" cy="-2" r="3" fill="#9b6cf0"/></g>`;
    case 'horn':
      return `<g ${t}><path d="M-16,2 C-26,-8 -22,-20 -12,-16 M-12,4 C-24,0 -30,8 -28,16" stroke="#ff7fbf" stroke-width="5" fill="none" stroke-linecap="round"/>
        <path d="M-14,-2 C-20,-12 -14,-22 -6,-14" stroke="#9b6cf0" stroke-width="5" fill="none" stroke-linecap="round"/>
        <path d="M-9,4 L0,-36 L9,4Z" fill="#ffe680" stroke="#e8b830" stroke-width="2" stroke-linejoin="round"/>
        <path d="M-7,-4 L7,-9 M-5,-14 L5,-19 M-3,-24 L3,-28" stroke="#ff9ed0" stroke-width="3" stroke-linecap="round"/></g>`;
    case 'flower':
      return `<g ${t}>${[0, 72, 144, 216, 288].map(a => `<ellipse cx="0" cy="-10" rx="7" ry="10" fill="#fff" transform="rotate(${a})"/>`).join('')}<circle r="7" fill="#ffd23f"/></g>`;
    case 'hat':
      return `<g ${t}><ellipse cx="0" cy="2" rx="26" ry="7" fill="#9b6cf0"/><path d="M-14,2 Q-14,-22 0,-24 Q14,-22 14,2Z" fill="#9b6cf0"/>
        <path d="M-14,-4 Q0,0 14,-4" stroke="#ff7fbf" stroke-width="5" fill="none"/><circle cx="8" cy="-6" r="4" fill="#ffd23f"/></g>`;
  }
  return '';
}

/**
 * dinoSVG(type, colorKey | {base, belly, accent}, {acc: bow|crown|horn|flower|hat, lashes, open, cls})
 */
function dinoSVG(type, colorKey, o = {}) {
  const id = 'd' + (++svgUid);
  // colorKey — ключ из COLORS или свой набор { base, belly, accent } (раскраска).
  const c = typeof colorKey === 'object' ? colorKey : COLORS[colorKey] || COLORS.green;
  const ref = n => `url(#${n}${id})`;
  // eye() и клюв ссылаются на #iI/#hI — подставляем id этого экземпляра.
  const body = BODIES[type](ref('b'), ref('f'), ref('y'), ref('a'), ref('h'), o).replace(/url\(#(\w)I\)/g, `url(#$1${id})`);
  let acc = '';
  if (o.acc) {
    const [x, y, k] = DINO_TYPES[type].head;
    acc = accessory(o.acc, x, y, k);
  }
  return `<svg class="dino dino-${type} ${o.cls || ''}" viewBox="0 0 200 200" aria-hidden="true">
    ${defs(c, id)}
    <ellipse cx="100" cy="190" rx="${type === 'ptero' ? 40 : 74}" ry="7" fill="#5a2a6a" opacity=".14" class="ground-shadow"/>
    <g class="dino-body">${body}${acc}</g></svg>`;
}

// Яйцо в крапинку. hatched — вылупившийся малыш со скорлупкой-шапочкой.
// tinted — яйцо целиком окрашено (для игр, где важен цвет: узоры, сортировка).
function eggSVG(colorKey, hatched, tinted) {
  const id = 'e' + (++svgUid);
  const c = COLORS[colorKey] || COLORS.pink;
  const [s0, s1, s2] = tinted ? [mix(c.base, '#ffffff', .65), mix(c.base, '#ffffff', .15), mix(c.base, '#2a0a30', .25)] : ['#ffffff', '#fff3e0', '#e9c99a'];
  const dot = tinted ? '#ffffff' : c.base;
  const shell = `<radialGradient id="s${id}" cx="35%" cy="25%" r="85%"><stop offset="0" stop-color="${s0}"/><stop offset=".6" stop-color="${s1}"/><stop offset="1" stop-color="${s2}"/></radialGradient>`;
  const spots = `<circle cx="34" cy="60" r="7" fill="${dot}" opacity=".7"/><circle cx="62" cy="44" r="5" fill="${dot}" opacity=".7"/>
    <circle cx="66" cy="80" r="8" fill="${dot}" opacity=".7"/><circle cx="40" cy="92" r="5" fill="${dot}" opacity=".7"/>`;
  if (!hatched) {
    return `<svg class="egg" viewBox="0 0 100 120" aria-hidden="true"><defs>${shell}</defs>
      <ellipse cx="50" cy="114" rx="32" ry="5" fill="#5a2a6a" opacity=".15"/>
      <path d="M50,8 C76,8 92,52 92,76 C92,100 74,114 50,114 C26,114 8,100 8,76 C8,52 24,8 50,8Z" fill="url(#s${id})"/>
      ${spots}<ellipse cx="34" cy="34" rx="8" ry="13" fill="#fff" opacity=".7" transform="rotate(25 34 34)"/></svg>`;
  }
  const gid = id + 'b';
  const light = mix(c.base, '#ffffff', .5), dark = mix(c.base, '#2a0a30', .3);
  return `<svg class="egg hatched" viewBox="0 0 100 120" aria-hidden="true"><defs>${shell}
      <radialGradient id="${gid}" cx="35%" cy="28%" r="85%"><stop offset="0" stop-color="${light}"/><stop offset=".55" stop-color="${c.base}"/><stop offset="1" stop-color="${dark}"/></radialGradient>
      <radialGradient id="i${gid}" cx="45%" cy="60%" r="85%"><stop offset="0" stop-color="#9a6a3a"/><stop offset="1" stop-color="#2a1406"/></radialGradient></defs>
    <ellipse cx="50" cy="114" rx="32" ry="5" fill="#5a2a6a" opacity=".15"/>
    <g class="baby"><circle cx="50" cy="58" r="30" fill="url(#${gid})"/>
      ${eye(39, 54, 9).replace('url(#iI)', `url(#i${gid})`)}${eye(61, 54, 9).replace('url(#iI)', `url(#i${gid})`)}
      ${cheek(32, 68, 5)}${cheek(68, 68, 5)}
      <path d="M42,70 Q50,78 58,70" fill="none" stroke="#3a2016" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M26,34 L32,22 L40,30 L50,18 L60,30 L68,22 L74,34 Q50,24 26,34Z" fill="url(#s${id})" class="cap"/></g>
    <path d="M10,76 L22,68 L32,78 L42,66 L52,78 L62,66 L72,78 L82,68 L90,76 C92,100 74,114 50,114 C26,114 8,100 10,76Z" fill="url(#s${id})"/>
    <circle cx="66" cy="94" r="7" fill="${c.base}" opacity=".75"/><circle cx="36" cy="98" r="5" fill="${c.base}" opacity=".75"/></svg>`;
}

// Кустик для «Пряток».
function bushSVG() {
  const id = 'k' + (++svgUid);
  return `<svg class="bush" viewBox="0 0 200 120" aria-hidden="true"><defs>
    <radialGradient id="${id}" cx="40%" cy="30%" r="80%"><stop offset="0" stop-color="#b6f08a"/><stop offset=".6" stop-color="#6cc25a"/><stop offset="1" stop-color="#3f8a2b"/></radialGradient></defs>
    <g fill="url(#${id})"><circle cx="45" cy="70" r="42"/><circle cx="100" cy="52" r="50"/><circle cx="155" cy="70" r="42"/><rect x="10" y="70" width="180" height="50" rx="20"/></g>
    <circle cx="70" cy="50" r="6" fill="#ff8fc7"/><circle cx="128" cy="40" r="6" fill="#fff"/><circle cx="160" cy="78" r="6" fill="#ffd23f"/><circle cx="40" cy="84" r="5" fill="#c4a8ff"/></svg>`;
}

// Геометрические фигуры с мордочками.
const SHAPES = {
  circle:   { nom: 'круг',          acc: 'круг',          d: '<circle cx="50" cy="50" r="42"/>' },
  square:   { nom: 'квадрат',       acc: 'квадрат',       d: '<rect x="10" y="10" width="80" height="80" rx="10"/>' },
  triangle: { nom: 'треугольник',   acc: 'треугольник',   d: '<path d="M50,8 L94,88 L6,88Z" stroke-linejoin="round" stroke-width="8"/>', eyeY: 62 },
  star:     { nom: 'звезда',        acc: 'звезду',        d: '<path d="M50,4 L62,36 L96,37 L69,58 L79,92 L50,72 L21,92 L31,58 L4,37 L38,36Z" stroke-linejoin="round" stroke-width="6"/>', eyeY: 52 },
  heart:    { nom: 'сердечко',      acc: 'сердечко',      d: '<path d="M50,90 C20,68 4,50 4,32 C4,17 16,7 29,7 C39,7 46,13 50,21 C54,13 61,7 71,7 C84,7 96,17 96,32 C96,50 80,68 50,90Z"/>', eyeY: 38 },
  oval:     { nom: 'овал',          acc: 'овал',          d: '<ellipse cx="50" cy="50" rx="46" ry="30"/>' },
  rect:     { nom: 'прямоугольник', acc: 'прямоугольник', d: '<rect x="4" y="24" width="92" height="52" rx="8"/>' },
  rhombus:  { nom: 'ромб',          acc: 'ромб',          d: '<path d="M50,4 L94,50 L50,96 L6,50Z" stroke-linejoin="round" stroke-width="6"/>' },
};

function shapeSVG(key, colorKey) {
  const id = 'f' + (++svgUid);
  const sh = SHAPES[key], c = COLORS[colorKey];
  const y = sh.eyeY || 46;
  return `<svg class="shape" viewBox="0 0 100 100" aria-hidden="true"><defs>
    <radialGradient id="${id}" cx="35%" cy="28%" r="85%"><stop offset="0" stop-color="${mix(c.base, '#ffffff', .5)}"/><stop offset=".55" stop-color="${c.base}"/><stop offset="1" stop-color="${mix(c.base, '#2a0a30', .3)}"/></radialGradient></defs>
    <g fill="url(#${id})" stroke="url(#${id})">${sh.d}</g>
    <g class="eye"><circle cx="40" cy="${y}" r="6" fill="#fff"/><circle cx="41" cy="${y + 1}" r="3.5" fill="#2a1406"/><circle cx="39.5" cy="${y - 1.5}" r="1.4" fill="#fff"/></g>
    <g class="eye"><circle cx="60" cy="${y}" r="6" fill="#fff"/><circle cx="61" cy="${y + 1}" r="3.5" fill="#2a1406"/><circle cx="59.5" cy="${y - 1.5}" r="1.4" fill="#fff"/></g>
    <path d="M43,${y + 11} Q50,${y + 17} 57,${y + 11}" fill="none" stroke="#3a2016" stroke-width="2.5" stroke-linecap="round"/></svg>`;
}
