/**
 * Dark Mode - MoneyControl
 * Gerencia alternancia de tema claro/escuro
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'mc_theme';
  var html = document.documentElement;

  // Aplica tema salvo (padrao: branco)
  function applyTheme() {
    var saved = localStorage.getItem(STORAGE_KEY);
    var dark;
    if (saved === 'dark') dark = true;
    else if (saved === 'light') dark = false;
    else dark = false; // padrao: modo branco

    html.classList.toggle('dark', dark);
  }

  // Alterna o tema
  function toggleTheme() {
    html.classList.add('transitioning');
    var isDark = html.classList.toggle('dark');
    localStorage.setItem(STORAGE_KEY, isDark ? 'dark' : 'light');
    setTimeout(function () {
      html.classList.remove('transitioning');
    }, 450);
  }

  // Cria o HTML do botao de toggle
  function createToggleHTML() {
    return [
      '<button class="dark-mode-toggle" onclick="window.__toggleDarkMode()" aria-label="Alternar modo escuro">',
      '  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="dm-icon-sun">',
      '    <circle cx="12" cy="12" r="5"></circle>',
      '    <line x1="12" y1="1" x2="12" y2="3"></line>',
      '    <line x1="12" y1="21" x2="12" y2="23"></line>',
      '    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>',
      '    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>',
      '    <line x1="1" y1="12" x2="3" y2="12"></line>',
      '    <line x1="21" y1="12" x2="23" y2="12"></line>',
      '    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>',
      '    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>',
      '  </svg>',
      '  <div class="dark-mode-switch"></div>',
      '  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="dm-icon-moon">',
      '    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>',
      '  </svg>',
      '</button>'
    ].join('\n');
  }

  // Insere o botão no sidebar (antes do "Sair da Conta")
  function injectToggle() {
    var sidebars = document.querySelectorAll('aside#sidebar');
    sidebars.forEach(function (sidebar) {
      if (sidebar.querySelector('.dark-mode-toggle')) return;
      var logoutLink = sidebar.querySelector('#menu-sair');
      if (!logoutLink) return;
      var li = document.createElement('li');
      li.innerHTML = createToggleHTML();
      var nav = logoutLink.closest('nav');
      if (nav) {
        var ul = nav.querySelector('ul');
        if (ul) ul.appendChild(li);
      } else {
        logoutLink.closest('div')?.parentElement?.insertBefore(li, logoutLink.closest('div'));
      }
    });
  }

  // Expoe a funcao global para onclick
  window.__toggleDarkMode = function () {
    toggleTheme();
  };

  // Inicializa
  applyTheme();
  injectToggle();
})();
