// Буквы, числа, коллекция динозавриков.
'use strict';

// Имя ребёнка. В ссылке можно задать своё: ?name=Маша&gen=Маши (для кого?), &g=m — для мальчика.
// Имя из ссылки запоминается, чтобы значок на главном экране его не терял.
const KID_DEFAULT = { name: '', gen: '', boy: false };
const KID_INFO = (() => {
  const q = new URLSearchParams(location.search);
  const clean = v => (v || '').trim().slice(0, 24);
  let info = null;
  if (q.has('name')) {
    info = { name: clean(q.get('name')), gen: clean(q.get('gen')), boy: q.get('g') === 'm' };
    try { localStorage.setItem('dino-kid', JSON.stringify(info)); } catch (e) { /* ignore */ }
  } else {
    try { info = JSON.parse(localStorage.getItem('dino-kid')); } catch (e) { /* ignore */ }
  }
  return info || KID_DEFAULT;
})();
const KID = KID_INFO.name;
const KID_GEN = KID_INFO.gen; // «для кого?»
const g = (fem, masc) => (KID_INFO.boy ? masc : fem); // «сделала» / «сделал»
const hi = KID ? `, ${KID}` : ''; // «Привет, Маша!» или просто «Привет!»
const youAre = KID ? `${KID}, ты` : 'Ты';

// Порядок — как в букварях: сначала гласные и «простые» согласные.
// s — как озвучивать (звуком), pos — где буква в слове (start/mid/end).
const LETTERS = [
  { l: 'А', s: 'а', w: 'арбуз', e: '🍉' },
  { l: 'О', s: 'о', w: 'облако', e: '☁️' },
  { l: 'У', s: 'у', w: 'утка', e: '🦆' },
  { l: 'И', s: 'и', w: 'индюк', e: '🦃' },
  { l: 'М', s: 'мэ', w: 'мишка', e: '🧸' },
  { l: 'Л', s: 'лэ', w: 'лиса', e: '🦊' },
  { l: 'Н', s: 'нэ', w: 'носорог', e: '🦏' },
  { l: 'Р', s: 'рэ', w: 'рыбка', e: '🐟' },
  { l: 'С', s: 'сэ', w: 'солнце', e: '☀️' },
  { l: 'К', s: 'кэ', w: 'кот', e: '🐱' },
  { l: 'П', s: 'пэ', w: 'пингвин', e: '🐧' },
  { l: 'Т', s: 'тэ', w: 'торт', e: '🎂' },
  { l: 'Д', s: 'дэ', w: 'динозавр', e: '🦕' },
  { l: 'Б', s: 'бэ', w: 'банан', e: '🍌' },
  { l: 'В', s: 'вэ', w: 'виноград', e: '🍇' },
  { l: 'Г', s: 'гэ', w: 'гриб', e: '🍄' },
  { l: 'З', s: 'зэ', w: 'заяц', e: '🐰' },
  { l: 'Ж', s: 'жэ', w: 'жираф', e: '🦒' },
  { l: 'Ш', s: 'шэ', w: 'шарик', e: '🎈' },
  { l: 'Х', s: 'хэ', w: 'хлеб', e: '🍞' },
  { l: 'Э', s: 'э', w: 'эскимо', e: '🍦' },
  { l: 'Ы', s: 'ы', w: 'сыр', e: '🧀', pos: 'mid' },
  { l: 'Е', s: 'е', w: 'енот', e: '🦝' },
  { l: 'Ё', s: 'ё', w: 'ёжик', e: '🦔' },
  { l: 'Я', s: 'я', w: 'яблоко', e: '🍎' },
  { l: 'Ю', s: 'ю', w: 'юбка', e: '👗' },
  { l: 'Ч', s: 'чэ', w: 'черепаха', e: '🐢' },
  { l: 'Щ', s: 'щэ', w: 'щенок', e: '🐶' },
  { l: 'Ц', s: 'цэ', w: 'цветок', e: '🌸' },
  { l: 'Ф', s: 'фэ', w: 'фламинго', e: '🦩' },
  { l: 'Й', s: 'и краткое', w: 'чай', e: '☕', pos: 'end' },
  { l: 'Ь', s: 'мягкий знак', w: 'конь', e: '🐴', pos: 'end' },
  { l: 'Ъ', s: 'твёрдый знак', w: 'подъёмный кран', e: '🏗️', pos: 'mid' },
];

const cap = s => s[0].toUpperCase() + s.slice(1);

// Счёт вслух и согласование с существительными.
const COUNT = ['ноль', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять', 'десять'];
const COUNT_F = ['ноль', 'одна', 'две', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять', 'десять'];
const COUNT_FA = ['ноль', 'одну', 'две', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять', 'десять'];
const COUNT_N = ['ноль', 'одно', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять', 'десять'];

function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}

// Угощения для «Покорми Дину»: формы для «дай N …».
const TREATS = [
  { e: '🍓', forms: ['клубничку', 'клубнички', 'клубничек'] },
  { e: '🍒', forms: ['вишенку', 'вишенки', 'вишенок'] },
  { e: '🍬', forms: ['конфетку', 'конфетки', 'конфеток'] },
  { e: '🍪', forms: ['печеньку', 'печеньки', 'печенек'] },
];

// Коллекция: новый друг вылупляется за каждый пройденный раунд.
const COLLECTION = [
  { id: 'pinky',  n: 'Пинки',       t: 'long',  c: 'pink',   a: 'bow' },
  { id: 'unic',   n: 'Единорожка',  t: 'rex',   c: 'purple', a: 'horn' },
  { id: 'daisy',  n: 'Ромашка',     t: 'stego', c: 'yellow', a: 'flower' },
  { id: 'prin',   n: 'Принцесса',   t: 'tri',   c: 'pink',   a: 'crown' },
  { id: 'fairy',  n: 'Феечка',      t: 'ptero', c: 'purple', a: 'hat' },
  { id: 'bead',   n: 'Бусинка',     t: 'rex',   c: 'sky',    a: 'bow' },
  { id: 'spark',  n: 'Огонёк',      t: 'tri',   c: 'orange' },
  { id: 'leaf',   n: 'Листик',      t: 'long',  c: 'green',  a: 'flower' },
  { id: 'star',   n: 'Звёздочка',   t: 'ptero', c: 'yellow', a: 'crown' },
  { id: 'berry',  n: 'Черничка',    t: 'stego', c: 'blue',   a: 'bow' },
  { id: 'straw',  n: 'Клубничка',   t: 'rex',   c: 'red',    a: 'flower' },
  { id: 'cloud',  n: 'Облачко',     t: 'long',  c: 'sky',    a: 'horn' },
  { id: 'plum',   n: 'Сливка',      t: 'tri',   c: 'purple', a: 'flower' },
  { id: 'peach',  n: 'Персик',      t: 'stego', c: 'orange', a: 'hat' },
  { id: 'butter', n: 'Лютик',       t: 'ptero', c: 'green',  a: 'bow' },
  { id: 'queen',  n: 'Королева',    t: 'long',  c: 'purple', a: 'crown' },
  { id: 'marsh',  n: 'Зефирка',     t: 'stego', c: 'pink',   a: 'horn' },
  { id: 'sunny',  n: 'Солнышко',    t: 'rex',   c: 'yellow', a: 'hat' },
  { id: 'drop',   n: 'Капелька',    t: 'ptero', c: 'blue',   a: 'flower' },
  { id: 'cherry', n: 'Ягодка',      t: 'tri',   c: 'red',    a: 'bow' },
  { id: 'mint',   n: 'Мятка',       t: 'rex',   c: 'green',  a: 'crown' },
  { id: 'rainb',  n: 'Радужка',     t: 'ptero', c: 'pink',   a: 'horn' },
];

const GUIDE = { t: 'long', c: 'pink', a: 'bow' };

const PRAISE = [
  `Молодец${hi}!`, 'Умница!', 'Правильно!', 'Ура! Здорово!', `${youAre} супер!`, 'Отлично!', 'Вот это да! Правильно!', 'Браво!',
];
const RETRY = ['Попробуй ещё разок!', 'Почти! Давай ещё.', 'Ой, не то. Попробуй ещё!'];
const PET = ['Хи-хи! Щекотно!', `Я тебя люблю${hi}!`, 'Давай дружить!', 'Ура! Поиграй со мной!', 'Ой, как приятно!'];
const TREATS_MEADOW = ['🍓', '🍰', '🍦', '🍎', '🍪', '🧁', '🍉'];
