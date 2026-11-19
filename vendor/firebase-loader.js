/* Carica Firebase: la versione attuale (vendor/*-compat.js, JavaScript moderno) oppure, sui browser
   che non la leggono (es. Firefox 68 su Android 4.4), la 8.10.1 in vendor/legacy/ con la stessa API.
   Va incluso come script classico al posto dei tre script di Firebase: document.write mantiene l'ordine. */
(function () {
  var modern = true;
  try { new Function('return ({}).a?.b ?? 0'); } catch (e) { modern = false; }
  var base = modern ? '/vendor/firebase-' : '/vendor/legacy/firebase-', end = modern ? '-compat.js' : '.js';
  ['app', 'auth', 'database'].forEach(function (n) {
    document.write('<script src="' + base + n + end + '"></' + 'script>');
  });
})();
