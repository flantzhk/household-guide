// i18n.js — English / Tagalog toggle for Household Help (Leni-facing pages only)
// Loaded via <script src="i18n.js"></script> near the end of <body> on every
// Leni-facing page. Same pattern as Meal Planner's MP.i18n: flat dictionary,
// localStorage-persisted choice, English is always the fallback.
//
// How to mark up translatable content:
//   Any element that should change with the toggle gets a data-tl attribute
//   holding the Tagalog HTML for that element (use single-quoted HTML
//   attributes so inner double-quoted attributes like class="si" don't need
//   escaping). The English version is just whatever is already in the
//   element — this script caches it into data-en the first time it runs, so
//   English text never has to be duplicated by hand.
//
//   Example: <h3 data-tl='Ayusin ang silid'>Tidy the room</h3>
//
// Pages with JS-rendered content (index.html) don't use data-tl at all —
// they call HH_i18n.getLang() directly inside their own render functions and
// register a re-render callback via HH_i18n.onChange(fn).

(function () {
  var STORAGE_KEY = 'hhLang';
  var changeListeners = [];

  function getLang() {
    var saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'tl' ? 'tl' : 'en';
  }

  function applyStaticSwap(lang) {
    var nodes = document.querySelectorAll('[data-tl]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.dataset.en === undefined) el.dataset.en = el.innerHTML;
      el.innerHTML = lang === 'tl' ? el.dataset.tl : el.dataset.en;
    }
  }

  function updateToggleUI(lang) {
    var buttons = document.querySelectorAll('.langtoggle button');
    for (var i = 0; i < buttons.length; i++) {
      var btn = buttons[i];
      var isActive = btn.getAttribute('data-lang') === lang;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    }
  }

  function setLang(lang) {
    localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = lang === 'tl' ? 'tl' : 'en';
    applyStaticSwap(lang);
    updateToggleUI(lang);
    for (var i = 0; i < changeListeners.length; i++) changeListeners[i](lang);
  }

  function onChange(fn) {
    changeListeners.push(fn);
  }

  function injectStyle() {
    if (document.getElementById('hh-i18n-style')) return;
    var style = document.createElement('style');
    style.id = 'hh-i18n-style';
    style.textContent =
      '.langtoggle { display: inline-flex; border: 1.5px solid var(--bg-3); border-radius: 20px; overflow: hidden; margin-left: auto; }' +
      '.langtoggle button { font-family: var(--font-ui); font-size: 0.8125rem; font-weight: 700; padding: 9px 14px; border: none; background: transparent; color: var(--fg-1); cursor: pointer; }' +
      '.langtoggle button.active { background: var(--accent); color: #fff; }' +
      '.langtoggle button:not(.active):hover { color: var(--accent); }';
    document.head.appendChild(style);
  }

  function injectToggle() {
    var nav = document.querySelector('.roomnav');
    if (!nav || nav.querySelector('.langtoggle')) return;
    var wrap = document.createElement('span');
    wrap.className = 'langtoggle';
    wrap.innerHTML =
      '<button type="button" data-lang="en">EN</button>' +
      '<button type="button" data-lang="tl">TL</button>';
    nav.appendChild(wrap);
    var buttons = wrap.querySelectorAll('button');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener('click', function (e) {
        setLang(e.currentTarget.getAttribute('data-lang'));
      });
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    injectStyle();
    injectToggle();
    var lang = getLang();
    document.documentElement.lang = lang === 'tl' ? 'tl' : 'en';
    applyStaticSwap(lang);
    updateToggleUI(lang);
  });

  window.HH_i18n = { getLang: getLang, setLang: setLang, onChange: onChange };
})();
