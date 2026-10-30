// Запуск: подключается последним, когда все игры уже объявлены.
'use strict';

Store.load();
startScreen();

// Офлайн-режим, когда игра открыта как сайт (не в приложении и не внутри другой страницы).
if ('serviceWorker' in navigator && location.protocol === 'https:' && window.top === window) {
  navigator.serviceWorker.register('sw.js').catch(() => { /* без офлайна игра тоже работает */ });
}
