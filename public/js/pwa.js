/**
 * MoneyControl PWA Module
 * - Registra o Service Worker
 * - Detecta o evento beforeinstallprompt
 * - Exibe notificacao personalizada de instalacao
 * - Controla exibicao via localStorage (7 dias)
 * - Fallback para iOS e navegadores sem beforeinstallprompt
 */

(function () {
  'use strict';

  /* ============================================================
     SERVICE WORKER REGISTRATION
     ============================================================ */
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .register('/sw.js')
      .then(function (reg) {
        console.log('[PWA] Service Worker registrado com escopo:', reg.scope);
      })
      .catch(function (err) {
        console.warn('[PWA] Falha ao registrar Service Worker:', err);
      });
  }

  /* ============================================================
     INSTALL PROMPT HANDLER
     ============================================================ */

  var STORAGE_KEY = 'mc_pwa_dismissed';
  var DISMISS_DAYS = 7;
  var deferredPrompt = null;
  var notificationEl = null;

  function isIOS() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
  }

  function isAndroid() {
    return /android/i.test(navigator.userAgent);
  }

  function isStandalone() {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true
    );
  }

  function wasDismissedRecently() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      var dismissedAt = parseInt(raw, 10);
      var now = Date.now();
      var daysMs = DISMISS_DAYS * 24 * 60 * 60 * 1000;
      return now - dismissedAt < daysMs;
    } catch (e) {
      return false;
    }
  }

  function markDismissed() {
    try {
      localStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch (e) {
      /* silenciar erros de localStorage cheio */
    }
  }

  /* ============================================================
     INSTALL BANNER
     ============================================================ */

  function createNotificationElement(manualMode) {
    var container = document.createElement('div');
    container.id = 'pwa-install-banner';

    if (manualMode === 'ios') {
      container.innerHTML = [
        '<div class="pwa-banner-backdrop"></div>',
        '<div class="pwa-banner">',
        '  <div class="pwa-banner-header">',
        '    <div class="pwa-banner-icon">',
        '      <img src="assets/logo.png" alt="MoneyControl" width="40" height="40">',
        '    </div>',
        '    <div class="pwa-banner-info">',
        '      <strong class="pwa-banner-title">Instale o MoneyControl</strong>',
        '      <span class="pwa-banner-subtitle">Toque no botao de compartilhar <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline;vertical-align:middle"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg> e selecione "Adicionar a Tela de Inicio".',
        '    </div>',
        '    <button class="pwa-banner-close" id="pwa-banner-close" aria-label="Fechar">&times;</button>',
        '  </div>',
        '</div>'
      ].join('\n');
    } else {
      container.innerHTML = [
        '<div class="pwa-banner-backdrop"></div>',
        '<div class="pwa-banner">',
        '  <div class="pwa-banner-header">',
        '    <div class="pwa-banner-icon">',
        '      <img src="assets/logo.png" alt="MoneyControl" width="40" height="40">',
        '    </div>',
        '    <div class="pwa-banner-info">',
        '      <strong class="pwa-banner-title">Instale nosso aplicativo</strong>',
        '      <span class="pwa-banner-subtitle">Acesso mais rapido e uma experiencia melhor no seu dispositivo.</span>',
        '    </div>',
        '    <button class="pwa-banner-close" id="pwa-banner-close" aria-label="Fechar">&times;</button>',
        '  </div>',
        '  <div class="pwa-banner-actions">',
        '    <button class="pwa-btn pwa-btn-dismiss" id="pwa-btn-dismiss">Agora nao</button>',
        '    <button class="pwa-btn pwa-btn-install" id="pwa-btn-install">Instalar</button>',
        '  </div>',
        '</div>'
      ].join('\n');
    }
    return container;
  }

  function showInstallBanner(manualMode) {
    if (notificationEl) return;

    notificationEl = createNotificationElement(manualMode || null);
    document.body.appendChild(notificationEl);

    void notificationEl.offsetHeight;
    notificationEl.classList.add('pwa-banner-visible');

    var btnInstall = document.getElementById('pwa-btn-install');
    var btnDismiss = document.getElementById('pwa-btn-dismiss');
    var btnClose = document.getElementById('pwa-banner-close');

    if (btnInstall) {
      btnInstall.addEventListener('click', function () {
        if (deferredPrompt) {
          deferredPrompt.prompt();
          deferredPrompt.userChoice.then(function (choiceResult) {
            if (choiceResult.outcome === 'accepted') {
              console.log('[PWA] Usuario aceitou a instalacao');
            }
            deferredPrompt = null;
            window._deferredInstallPrompt = null;
            hideInstallBanner();
          });
        }
      });
    }

    if (btnDismiss) {
      btnDismiss.addEventListener('click', function () {
        markDismissed();
        hideInstallBanner();
      });
    }

    if (btnClose) {
      btnClose.addEventListener('click', function () {
        markDismissed();
        hideInstallBanner();
      });
    }
  }

  function hideInstallBanner() {
    if (!notificationEl) return;
    notificationEl.classList.remove('pwa-banner-visible');
    notificationEl.classList.add('pwa-banner-hiding');
    setTimeout(function () {
      if (notificationEl && notificationEl.parentNode) {
        notificationEl.parentNode.removeChild(notificationEl);
      }
      notificationEl = null;
    }, 350);
  }

  /* ============================================================
     BOTAO DO MENU - Mostra/esconde
     ============================================================ */

  function updateMenuButton() {
    var menuBtn = document.getElementById('pwa-install-menu-btn');
    if (isStandalone() && menuBtn) {
      menuBtn.style.display = 'none';
    }
  }

  updateMenuButton();

  /* ============================================================
     EVENTO beforeinstallprompt (Chrome, Edge, Samsung Internet)
     ============================================================ */

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    window._deferredInstallPrompt = e;

    updateMenuButton();

    if (!isStandalone() && !wasDismissedRecently()) {
      setTimeout(function () {
        showInstallBanner('native');
      }, 2500);
    }
  });

  /* ============================================================
     FALLBACK - iOS e navegadores sem beforeinstallprompt
     ============================================================ */

  function tryFallbackInstall() {
    if (isStandalone()) return;
    if (wasDismissedRecently()) return;
    if (deferredPrompt) return;

    if (isIOS()) {
      setTimeout(function () {
        showInstallBanner('ios');
      }, 3000);
    }
  }

  tryFallbackInstall();

  /* ============================================================
     FUNCAO GLOBAL - Instalar via botao do menu
     ============================================================ */

  window.__installPWA = function () {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function (result) {
        if (result.outcome === 'accepted') {
          updateMenuButton();
        }
        deferredPrompt = null;
        window._deferredInstallPrompt = null;
      });
      return;
    }

    if (isIOS()) {
      alert(
        'Para instalar o MoneyControl no iPhone:\n\n' +
        '1. Toque no botao de compartilhar (quadrado com seta) na barra abaixo\n' +
        '2. Selecione "Adicionar a Tela de Inicio"\n' +
        '3. Toque em "Adicionar" no canto superior direito'
      );
      return;
    }

    if (isAndroid()) {
      alert(
        'Para instalar o MoneyControl:\n\n' +
        '1. Toque nos 3 pontinhos (⋮) no canto superior direito\n' +
        '2. Selecione "Instalar app" ou "Adicionar a Tela inicial"\n' +
        '3. Confirme a instalacao'
      );
      return;
    }

    alert(
      'Para instalar o MoneyControl:\n\n' +
      'No Chrome/Edge, toque nos 3 pontinhos (⋮) e selecione "Instalar app".\n' +
      'No Firefox, toque nos 3 pontinhos e selecione "Instalar".'
    );
  };

  /* ============================================================
     APP INSTALADO - Limpa estado
     ============================================================ */

  window.addEventListener('appinstalled', function () {
    deferredPrompt = null;
    window._deferredInstallPrompt = null;
    hideInstallBanner();
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      /* silenciar */
    }
    console.log('[PWA] App instalado com sucesso');
  });

  /* ============================================================
     MUDANCA DE DISPLAY-MODE
     ============================================================ */

  if (window.matchMedia) {
    var mql = window.matchMedia('(display-mode: standalone)');
    if (mql.addEventListener) {
      mql.addEventListener('change', function () {
        if (!isStandalone()) {
          /* Pode mostrar o banner novamente quando sair do standalone */
        }
      });
    }
  }
})();
