/**
 * MoneyControl PWA Module
 * - Registra o Service Worker
 * - Detecta o evento beforeinstallprompt
 * - Exibe notificacao personalizada de instalacao
 * - Controla exibicao via localStorage (7 dias)
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

  /**
   * Verifica se o usuario ja instalou o app (display-mode: standalone)
   */
  function isStandalone() {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true
    );
  }

  /**
   * Verifica se a notificacao foi descartada ha menos de N dias
   */
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

  /**
   * Salva no localStorage que o usuario dispensou a notificacao
   */
  function markDismissed() {
    try {
      localStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch (e) {
      /* silenciar erros de localStorage cheio */
    }
  }

  /**
   * Cria o HTML da notificacao de instalacao
   */
  function createNotificationElement() {
    var container = document.createElement('div');
    container.id = 'pwa-install-banner';
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
    return container;
  }

  /**
   * Exibe a notificacao de instalacao com animacao
   */
  function showInstallBanner() {
    if (notificationEl) return;

    notificationEl = createNotificationElement();
    document.body.appendChild(notificationEl);

    /* Forca reflow para garantir que a animacao de entrada funcione */
    void notificationEl.offsetHeight;
    notificationEl.classList.add('pwa-banner-visible');

    /* Eventos dos botoes */
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

  /**
   * Remove a notificacao com animacao de saida
   */
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

  /* Escuta o evento beforeinstallprompt */
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;

    /* Expoe para outros modulos (ex: onboarding) */
    window._deferredInstallPrompt = e;

  /* Mostra/esconde botao de instalar no menu */
  var menuBtn = document.getElementById('pwa-install-menu-btn');

  /* Se ja esta instalado, esconde o botao */
  if (isStandalone() && menuBtn) {
    menuBtn.style.display = 'none';
  }

    /* Nao mostrar se:
       - Ja esta em modo standalone (app instalado)
       - O usuario dispensou ha menos de 7 dias */
    if (!isStandalone() && !wasDismissedRecently()) {
      /* Aguardar um pouco para nao atrapalhar o carregamento da pagina */
      setTimeout(showInstallBanner, 2500);
    }
  });

  /* Funcao global para instalar via botao do menu */
  window.__installPWA = function () {
    var prompt = window._deferredInstallPrompt;
    if (prompt) {
      prompt.prompt();
      prompt.userChoice.then(function (result) {
        if (result.outcome === 'accepted') {
          var menuBtn = document.getElementById('pwa-install-menu-btn');
          if (menuBtn) menuBtn.style.display = 'none';
        }
        window._deferredInstallPrompt = null;
      });
    } else {
      alert('Para instalar o MoneyControl:\n\nNo Chrome, toque nos 3 pontinhos (⋮) e selecione "Instalar app" ou "Adicionar à Tela de Início".');
    }
  };

  /* Quando o app ja estiver instalado, esconder qualquer banner */
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

  /* Detectar mudanca no display-mode (ex: usuario saiu do modo standalone) */
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
