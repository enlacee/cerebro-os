/*!
 * Cerebro OS — widget de chat embebible.
 *
 * Uso (todo lo demás se configura en config/cerebro.php → GET /api/widget):
 *   <script src="https://chat.tudominio.com/widget.js" defer></script>
 */
(function () {
  'use strict';

  var script = document.currentScript;
  if (!script || window.__cerebroWidget) return;
  window.__cerebroWidget = true;

  // Base = donde vive widget.js (sirve con subdominio o carpeta: https://web.com/cerebro/widget.js).
  var base = script.src.replace(/\/widget\.js(\?.*)?$/, '');
  var cfg = {
    title: 'Asistente',
    subtitle: 'Asistente virtual',
    greeting: '¡Hola! 👋 ¿En qué te puedo ayudar?',
    colors: { accent: '#1a73e8', whatsapp: '#188038', header: '#ffffff', header_text: '#202124' },
    whatsapp: '',
    contact: { label: 'WhatsApp', message: 'Hola, vengo del chat de la web 👋' },
    pay: null,
    call: null,
    topics_title: '',
    topics: [],
    rating: null,
    links: [],
  };

  // Íconos de línea (24×24) para CEREBRO_LINKS; un tipo desconocido usa "link".
  var ICONS = {
    blog: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    web: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20"/>',
    youtube: '<path d="M2.5 17a24 24 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49 49 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24 24 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49 49 0 0 1-16.2 0A2 2 0 0 1 2.5 17"/><path d="m10 15 5-3-5-3z"/>',
    tiktok: '<path d="M9 12a4 4 0 1 0 4 4V2a5 5 0 0 0 5 5"/>',
    facebook: '<path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>',
    instagram: '<rect width="20" height="20" x="2" y="2" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5h.01"/>',
    linkedin: '<path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z"/><path d="M2 9h4v12H2z"/><circle cx="4" cy="4" r="2"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  };
  var ready = fetch(base + '/api/widget')
    .then(function (res) { return res.ok ? res.json() : {}; })
    .then(function (remote) { Object.assign(cfg, remote); })
    .catch(function () {});

  var STORE = 'cerebro-chat';
  var EXPIRES = 24 * 60 * 60 * 1000; // tras 24 h sin actividad, la conversación empieza de cero
  var state = load();
  var busy = false;

  // ---------- almacenamiento (puede fallar en modo privado) ----------
  function load() {
    try {
      var saved = JSON.parse(localStorage.getItem(STORE));
      if (saved && saved.session && Date.now() - (saved.updated || 0) < EXPIRES) return saved;
    } catch (e) {}
    return fresh();
  }

  function fresh() {
    return { session: uuid(), messages: [], updated: Date.now() };
  }

  function save() {
    try {
      state.updated = Date.now();
      state.messages = state.messages.slice(-30);
      localStorage.setItem(STORE, JSON.stringify(state));
    } catch (e) {}
  }

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  function waLink(message) {
    return 'https://wa.me/' + String(cfg.whatsapp).replace(/\D/g, '') + '?text=' + encodeURIComponent(message);
  }

  // ---------- render de texto: escapa HTML y permite **negrita** y links ----------
  function format(text) {
    var html = text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    html = html.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    return html.replace(/\n/g, '<br>');
  }

  // ---------- UI ----------
  var host = document.createElement('div');
  host.id = 'cerebro-chat';
  document.body.appendChild(host);
  var root = host.attachShadow({ mode: 'open' });

  root.innerHTML =
    '<style>' +
    // Mobile first: base = pantalla completa en el celular; desde 481px = panel flotante.
    // Estilo sobrio tipo Google: --c = asistente · --wa = todo lo que abre WhatsApp · cabecera clara con línea fina.
    // La cabecera usa --head-light/--head-text-light (configurables) y en modo oscuro pasa a gris oscuro.
    ':host{all:initial;--c:#1a73e8;--wa:#188038;--head-light:#fff;--head-text-light:#202124;' +
    '--head:var(--head-light);--head-fg:var(--head-text-light);--icon:#5f6368;--hover:#f1f3f4;' +
    '--bg:#fff;--fg:#202124;--muted:#5f6368;--bot:#f1f3f4;--line:#dadce0;' +
    'font:15px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;-webkit-text-size-adjust:100%}' +
    '@media (prefers-color-scheme:dark){:host{--bg:#202124;--fg:#e8eaed;--muted:#9aa0a6;--bot:#303134;--line:#3c4043;--head:#202124;--head-fg:#e8eaed;--icon:#9aa0a6;--hover:#303134}' +
    ':host .chip,:host .callbar button{color:#8ab4f8}' +
    ':host .icon.reset,:host .icon.reset:hover{color:#8ab4f8;background:rgba(138,180,248,.14)}' +
    ':host .chip:hover,:host .chip:active,:host .callbar button:hover,:host .callbar button:active{background:rgba(138,180,248,.12);border-color:var(--line)}}' +
    '*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}' +
    'button,a{touch-action:manipulation}' +
    '.fab{position:fixed;right:calc(16px + env(safe-area-inset-right));bottom:calc(16px + env(safe-area-inset-bottom));' +
    'width:56px;height:56px;border-radius:50%;border:0;background:var(--c);color:#fff;display:grid;place-items:center;' +
    'cursor:pointer;box-shadow:0 3px 10px rgba(60,64,67,.35);font-size:26px;z-index:2147483000}' +
    '.panel{position:fixed;inset:0;width:100%;height:100vh;height:100dvh;display:none;flex-direction:column;' +
    'background:var(--bg);color:var(--fg);overflow:hidden;z-index:2147483001}' +
    '.panel.open{display:flex}' +
    // Fondo oscurecido y difuminado detrás del chat (escritorio); en el celular el chat ya es pantalla completa.
    '.backdrop{display:none;position:fixed;inset:0;background:rgba(32,33,36,.45);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);' +
    'opacity:0;visibility:hidden;transition:opacity .2s ease,visibility .2s ease;z-index:2147482999}' +
    '.backdrop.show{opacity:1;visibility:visible}' +
    '@keyframes cerebro-pop{from{opacity:0;transform:translateY(12px) scale(.98)}to{opacity:1;transform:none}}' +
    '.head{flex:none;display:flex;align-items:center;gap:6px;background:var(--head);color:var(--head-fg);border-bottom:1px solid var(--line);' +
    'padding:calc(8px + env(safe-area-inset-top)) calc(6px + env(safe-area-inset-right)) 8px calc(14px + env(safe-area-inset-left))}' +
    '.who{flex:1;min-width:0;display:flex;flex-direction:column;line-height:1.25}' +
    '.who b{font-size:16px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.who small{font-size:12px;color:var(--muted);display:flex;align-items:center;gap:5px;white-space:nowrap;overflow:hidden}' +
    '.who small::before{content:"";flex:none;width:7px;height:7px;border-radius:50%;background:#1e8e3e}' +
    '.wa{display:inline-flex;align-items:center;gap:6px;flex:none;min-height:36px;background:var(--wa);color:#fff;font-weight:600;font-size:13px;' +
    'padding:0 12px;border-radius:999px;text-decoration:none;white-space:nowrap}' +
    '.wa svg{flex:none}' +
    '.tools{display:flex;flex:none;margin-left:2px;padding-left:4px;border-left:1px solid var(--line)}' +
    '.icon{width:42px;height:42px;display:grid;place-items:center;border:0;border-radius:12px;background:transparent;color:var(--icon);cursor:pointer;padding:0}' +
    '.icon:active{background:var(--hover)}' +
    // Nueva conversación destacada (como el F5): azul del asistente y gira al tocarla.
    '.icon.reset{color:var(--c);background:#e8f0fe;margin-right:4px}.icon.reset:active{background:#d2e3fc}' +
    '@keyframes cerebro-spin{to{transform:rotate(360deg)}}.reset.spin svg{animation:cerebro-spin .5s ease}' +
    '.icon:focus-visible,.wa:focus-visible{outline:2px solid var(--c);outline-offset:2px}' +
    '.msgs{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;' +
    'padding:14px calc(14px + env(safe-area-inset-right)) 14px calc(14px + env(safe-area-inset-left));display:flex;flex-direction:column;gap:8px}' +
    '.m{max-width:88%;padding:9px 12px;border-radius:16px;overflow-wrap:anywhere;white-space:normal}' +
    '.m.bot{background:var(--bot);align-self:flex-start;border-bottom-left-radius:4px}' +
    '.m.user{background:var(--c);color:#fff;align-self:flex-end;border-bottom-right-radius:4px}' +
    '.m a{color:inherit;text-decoration:underline}' +
    '.m.err{background:#fef2f2;color:#991b1b}' +
    '.welcome{display:flex;flex-direction:column;gap:6px}' +
    // Acciones principales en una fila de botones compactos (bajan de línea si no caben).
    '.quick{display:flex;flex-wrap:wrap;gap:8px}' +
    '.pay{display:inline-flex;align-items:center;min-height:38px;padding:7px 14px;border-radius:999px;background:var(--wa);color:#fff;text-decoration:none;font-weight:600;font-size:14px;white-space:nowrap}' +
    '.pay.call{background:var(--bg);color:var(--fg);border:1px solid var(--line);font:inherit;font-weight:600;font-size:14px;cursor:pointer}' +
    '.label{color:var(--muted);font-size:13px;margin-top:4px}' +
    // Prueba social (calificación) y, al pie, blog y redes en gris para no competir con pagar/llamar/chips.
    '.rating{display:inline-flex;align-items:center;gap:3px;color:var(--muted);text-decoration:none}' +
    '.rating .star{color:#fbbc04;font-size:13px;line-height:1}.who .rating b{font-size:12px;color:var(--fg);font-weight:600}' +
    // Aviso de IA al pie, bajo el campo de texto (como en ChatGPT): siempre visible sin cortar la bienvenida.
    '.foot{flex:none;background:var(--bg);color:var(--muted);font-size:11px;line-height:1.3;text-align:center;padding:0 12px calc(6px + env(safe-area-inset-bottom))}' +
    '.links{display:flex;flex-wrap:wrap;gap:4px 2px;margin-top:8px;padding-top:10px;border-top:1px solid var(--line)}' +
    '.links a{display:inline-flex;align-items:center;gap:6px;min-height:32px;padding:0 6px;border-radius:999px;color:var(--muted);font-size:13px;text-decoration:none}' +
    '.links a:active{background:var(--hover)}.rating:focus-visible,.links a:focus-visible{outline:2px solid var(--c);outline-offset:2px}' +
    // Temas en lista vertical compacta: cada chip ocupa solo el ancho de su texto.
    '.chips{display:flex;flex-direction:column;align-items:flex-start;gap:6px}' +
    '.chip{min-height:32px;border:1px solid var(--line);background:var(--bg);color:var(--c);font-weight:500;border-radius:999px;padding:5px 12px;font:inherit;font-size:13px;cursor:pointer;text-align:left}' +
    '.chip:active,.callbar button:active{background:#e8f0fe;border-color:#d2e3fc}.pay.call:active{background:var(--hover)}' +
    '.card{background:var(--bot);border-radius:14px;padding:12px;display:flex;flex-direction:column;gap:10px;align-self:stretch}' +
    '.card p{margin:0;font-size:14px}' +
    '.card label{font-size:13px;color:var(--muted);display:flex;flex-direction:column;gap:4px}' +
    '.card input{flex:none;width:100%}' +
    '.card .slot{flex-direction:row;align-items:flex-start;gap:10px;font-size:14px;color:var(--fg);cursor:pointer;padding:8px 10px;border:1px solid var(--line);border-radius:12px;background:var(--bg)}' +
    '.card .slot:has(input:checked){border-color:var(--c);box-shadow:inset 0 0 0 1px var(--c)}' +
    '.card .when-title{font-size:13px;color:var(--muted);display:flex;flex-direction:column;gap:2px}' +
    '.card .when-title small{font-size:12px;color:var(--c)}' +
    '.card .privacy{font-size:12px;color:var(--muted);margin:8px 0 0}.card .privacy:empty{display:none}' +
    '.card .night-note{font-size:12px;color:var(--fg);background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:6px 10px;margin-top:4px}' +
    '.card .slot>span{flex:1;min-width:0}.card .slot .row{display:flex;justify-content:space-between;align-items:baseline;gap:8px}' +
    '.card .slot em{font-style:normal;color:var(--muted);font-size:12px;white-space:nowrap}' +
    '.card .slot.night b{color:var(--muted);font-weight:600}' +
    '.card .slot input{width:18px;height:18px;margin:2px 0 0;accent-color:var(--c);flex:none}.card .slot small{display:block;color:var(--muted);font-size:12px}' +
    '.card .actions{display:flex;gap:8px}' +
    '.card .actions button{flex:1;min-height:46px;border:1px solid var(--line);border-radius:12px;padding:10px;font:inherit;cursor:pointer;background:var(--bg);color:var(--fg)}' +
    '.card .actions .main{background:var(--c);border-color:var(--c);color:#fff;font-weight:600}' +
    '.card .actions button:disabled{opacity:.5;cursor:default}' +
    '.card .error{color:#dc2626;font-size:13px;margin:0}' +
    '.hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}' +
    '.typing{flex:none;color:var(--muted);font-size:13px;padding:0 16px 6px;display:none}' +
    '.callbar{flex:none;padding:0 calc(10px + env(safe-area-inset-right)) 8px calc(10px + env(safe-area-inset-left));display:none}' +
    '.callbar button{min-height:36px;border:1px solid var(--line);background:var(--bg);color:var(--c);font-weight:500;border-radius:999px;padding:6px 14px;font:inherit;font-size:14px;cursor:pointer}' +
    '.composer{flex:none;display:flex;gap:8px;align-items:center;border-top:1px solid var(--line);background:var(--bg);' +
    'padding:8px calc(10px + env(safe-area-inset-right)) calc(8px + env(safe-area-inset-bottom)) calc(10px + env(safe-area-inset-left))}' +
    // 16px en campos: evita el zoom automático de iPhone al tocarlos.
    'input{flex:1;min-width:0;min-height:44px;padding:10px 14px;border:1px solid var(--line);border-radius:22px;background:var(--bg);color:var(--fg);font:inherit;font-size:16px}' +
    '.card input:not([type=radio]){border-radius:12px}' +
    'input:focus{outline:2px solid var(--c);outline-offset:-1px;border-color:transparent}' +
    '.send{flex:none;width:44px;height:44px;display:grid;place-items:center;border:0;border-radius:50%;background:var(--c);color:#fff;cursor:pointer;padding:0}' +
    '.send:disabled{opacity:.5;cursor:default}' +
    '@media (hover:hover){.links a:hover{background:var(--hover);color:var(--fg)}.rating[href]:hover{text-decoration:underline}' +
    '.icon:hover{background:var(--hover);color:var(--fg)}.icon.reset:hover{background:#d2e3fc;color:var(--c)}.wa:hover{filter:brightness(.95)}' +
    '.chip:hover,.callbar button:hover{background:#e8f0fe;border-color:#d2e3fc}.pay.call:hover{background:var(--hover)}}' +
    // Celular angosto (≤360px): el botón de WhatsApp queda solo con ícono.
    // Celular: sin espacio para "En línea" y la calificación juntas → queda la calificación.
    '@media (max-width:480px){.rated .status,.rated::before{display:none}}' +
    '@media (max-width:360px){.wa{width:38px;padding:0;justify-content:center}.wa .short{display:none}}' +
    // Escritorio / tablet: panel flotante.
    '@media (min-width:481px){' +
    '.fab{right:20px;bottom:20px;width:58px;height:58px}' +
    '.panel{inset:auto 20px 90px auto;width:400px;height:620px;max-height:calc(100vh - 110px);border-radius:16px;border:1px solid var(--line);box-shadow:0 8px 28px rgba(60,64,67,.28)}' +
    '.head{padding:10px 8px 10px 14px}.icon{width:36px;height:36px;border-radius:10px}' +
    '.backdrop{display:block}.panel.open{animation:cerebro-pop .2s ease-out}' +
    '.msgs{padding:14px}.composer{padding:10px}.callbar{padding:0 10px 8px}.foot-on .composer{padding-bottom:4px}' +
    '}' +
    '.panel.open~.fab{display:none}' +
    '@media (prefers-reduced-motion:reduce){.panel.open,.reset.spin svg{animation:none}.backdrop{transition:none}}' +
    '@media (min-width:481px){.panel.open~.fab{display:grid}}' +
    '</style>' +
    '<div class="backdrop" aria-hidden="true"></div>' +
    '<div class="panel" role="dialog" aria-label="Chat">' +
    '<div class="head">' +
    '<div class="who"><b></b><small></small></div>' +
    '<a class="wa" target="_blank" rel="noopener" hidden>' +
    // Logo de WhatsApp: se reconoce sin leer.
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
    '<path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.26-.46-2.39-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.7.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2-1.41.25-.7.25-1.29.18-1.41-.08-.13-.28-.2-.57-.35m-5.42 7.4h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.89-9.88 2.64 0 5.12 1.03 6.99 2.9a9.83 9.83 0 0 1 2.89 6.99c0 5.45-4.44 9.88-9.88 9.88m8.41-18.3A11.82 11.82 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.89c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.88 11.88 0 0 0 5.68 1.45h.01c6.55 0 11.89-5.34 11.89-11.89a11.82 11.82 0 0 0-3.48-8.41z"/></svg><span class="short"></span></a>' +
    '<div class="tools">' +
    '<button class="icon reset" aria-label="Nueva conversación" title="Nueva conversación">' +
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M3 12a9 9 0 0 1 15.5-6.2L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16"/><path d="M3 21v-5h5"/></svg></button>' +
    '<button class="icon close" aria-label="Cerrar chat" title="Cerrar">' +
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true">' +
    '<path d="M18 6 6 18M6 6l12 12"/></svg></button>' +
    '</div></div>' +
    '<div class="msgs" aria-live="polite"></div>' +
    '<div class="typing">Escribiendo…</div>' +
    '<div class="callbar"><button type="button"></button></div>' +
    '<form class="composer"><input maxlength="1000" placeholder="Escribe tu mensaje…" aria-label="Mensaje" enterkeyhint="send" autocomplete="off">' +
    '<button type="submit" class="send" aria-label="Enviar">' +
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4 20-7z"/></svg></button></form>' +
    '<div class="foot" hidden></div>' +
    '</div>' +
    '<button class="fab" aria-label="Abrir chat">💬</button>';

  var $ = function (sel) { return root.querySelector(sel); };
  var panel = $('.panel'), msgs = $('.msgs'), typing = $('.typing'), form = $('.composer'), input = $('.composer input'), sendBtn = $('.composer button');
  var mobile = window.matchMedia('(max-width: 480px)');

  // En el celular no abrimos el teclado solos (tapa la bienvenida); solo si ya estaba abierto.
  function focusInput(el) {
    el = el || input;
    if (!mobile.matches || root.activeElement === input) el.focus({ preventScroll: true });
  }

  // Celular: el chat ocupa la pantalla visible (sin teclado ni barras) y la página de fondo no se mueve.
  var vv = window.visualViewport, savedOverflow = null;
  function fitViewport() {
    var full = panel.classList.contains('open') && mobile.matches;
    if (full && vv) {
      panel.style.height = vv.height + 'px';
      panel.style.top = vv.offsetTop + 'px';
      if (state.messages.length) msgs.scrollTop = msgs.scrollHeight;
    } else {
      panel.style.height = panel.style.top = '';
    }
    if (full && savedOverflow === null) {
      savedOverflow = document.documentElement.style.overflow;
      document.documentElement.style.overflow = 'hidden';
    } else if (!full && savedOverflow !== null) {
      document.documentElement.style.overflow = savedOverflow;
      savedOverflow = null;
    }
  }
  if (vv) {
    vv.addEventListener('resize', fitViewport);
    vv.addEventListener('scroll', fitViewport);
  }
  if (mobile.addEventListener) mobile.addEventListener('change', fitViewport);

  ready.then(function () {
    host.style.setProperty('--c', cfg.colors.accent);
    host.style.setProperty('--wa', cfg.colors.whatsapp);
    host.style.setProperty('--head-light', cfg.colors.header);
    host.style.setProperty('--head-text-light', cfg.colors.header_text);
    $('.who b').textContent = cfg.title;
    // Cabecera: "● En línea · ★ 4.9 en Google" (la calificación queda visible toda la conversación).
    var sub = $('.who small');
    var status = document.createElement('span');
    status.className = 'status';
    status.textContent = cfg.subtitle;
    sub.appendChild(status);
    if (cfg.rating && cfg.rating.value) {
      sub.classList.add('rated');
      var dot = document.createElement('span');
      dot.className = 'status';
      dot.setAttribute('aria-hidden', 'true');
      dot.textContent = '·';
      sub.appendChild(dot);
      sub.appendChild(ratingEl());
    }
    if (cfg.disclaimer) {
      $('.foot').textContent = cfg.disclaimer;
      $('.foot').hidden = false;
      panel.classList.add('foot-on');
    }
    if (cfg.whatsapp) {
      var wa = $('.wa');
      wa.querySelector('.short').textContent = cfg.contact.short || 'WhatsApp';
      wa.setAttribute('aria-label', cfg.contact.label);
      wa.title = cfg.contact.label;
      wa.href = waLink(cfg.contact.message);
      wa.hidden = false;
    }
    if (cfg.call) $('.callbar button').textContent = cfg.call.short;
  });

  $('.callbar button').addEventListener('click', function () { openCallForm(); });

  // El acceso fijo a "que me llame" aparece cuando ya no está la bienvenida ni el formulario.
  function updateCallbar() {
    $('.callbar').style.display = cfg.call && !$('.welcome') && !$('.card') ? 'block' : 'none';
  }

  function toggle(open) {
    panel.classList.toggle('open', open);
    $('.backdrop').classList.toggle('show', open);
    $('.fab').textContent = open ? '✕' : '💬';
    fitViewport();
    if (open) {
      if (!msgs.children.length) ready.then(renderAll);
      focusInput();
    }
  }

  $('.fab').addEventListener('click', function () { toggle(!panel.classList.contains('open')); });
  $('.close').addEventListener('click', function () { toggle(false); });
  // Clic fuera del chat o tecla Esc: se cierra.
  $('.backdrop').addEventListener('click', function () { toggle(false); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && panel.classList.contains('open')) toggle(false);
  });

  // Nueva conversación: borra el historial local y vuelve a la bienvenida.
  $('.reset').addEventListener('click', function () {
    if (busy) return;
    // Vuelta del ícono como confirmación visual.
    var btn = this;
    btn.classList.remove('spin');
    void btn.offsetWidth;
    btn.classList.add('spin');
    state = fresh();
    save();
    renderAll();
    focusInput();
  });

  $('.reset').addEventListener('animationend', function () { this.classList.remove('spin'); });

  function bubble(role, text, extra) {
    var el = document.createElement('div');
    el.className = 'm ' + (role === 'user' ? 'user' : 'bot') + (extra ? ' ' + extra : '');
    el.innerHTML = format(text);
    msgs.appendChild(el);
    msgs.scrollTop = msgs.scrollHeight;
    return el;
  }

  // "★ 4.9 en Google" (con textContent: nada del config se interpreta como HTML).
  function ratingEl() {
    var rating = document.createElement(cfg.rating.url ? 'a' : 'span');
    rating.className = 'rating';
    if (cfg.rating.url) {
      rating.href = cfg.rating.url;
      rating.target = '_blank';
      rating.rel = 'noopener';
      rating.title = 'Ver reseñas en ' + cfg.rating.source;
    }
    var star = document.createElement('span');
    star.className = 'star';
    star.setAttribute('aria-hidden', 'true');
    star.textContent = '★';
    var value = document.createElement('b');
    value.textContent = cfg.rating.value;
    rating.appendChild(star);
    rating.appendChild(value);
    rating.appendChild(document.createTextNode(' en ' + cfg.rating.source));
    return rating;
  }

  // Bienvenida: camino "quiero pagar" (WhatsApp directo) + chips de temas para el asistente.
  function welcome() {
    var box = document.createElement('div');
    box.className = 'welcome';
    var quick = document.createElement('div');
    quick.className = 'quick';


    if (cfg.pay && cfg.whatsapp) {
      var pay = document.createElement('a');
      pay.className = 'pay';
      pay.target = '_blank';
      pay.rel = 'noopener';
      pay.href = waLink(cfg.pay.message);
      pay.textContent = cfg.pay.short || cfg.pay.title;
      pay.title = cfg.pay.title + ' · ' + cfg.pay.subtitle;
      quick.appendChild(pay);
    }

    if (cfg.call) {
      var call = document.createElement('button');
      call.type = 'button';
      call.className = 'pay call';
      call.textContent = cfg.call.short || cfg.call.title;
      call.title = cfg.call.subtitle;
      call.addEventListener('click', function () { openCallForm(); });
      quick.appendChild(call);
    }

    if (quick.children.length) box.appendChild(quick);

    if (cfg.topics.length) {
      var label = document.createElement('div');
      label.className = 'label';
      label.textContent = cfg.topics_title;
      var chips = document.createElement('div');
      chips.className = 'chips';
      cfg.topics.forEach(function (topic) {
        var chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'chip';
        chip.textContent = topic.label;
        chip.addEventListener('click', function () { send(topic.message); });
        chips.appendChild(chip);
      });
      box.appendChild(label);
      box.appendChild(chips);
    }

    // Link(s) del dueño al pie (recomendado: uno solo, ej. su blog).
    if (cfg.links.length) {
      var links = document.createElement('nav');
      links.className = 'links';
      links.setAttribute('aria-label', 'Más de ' + cfg.title);
      cfg.links.forEach(function (link) {
        var a = document.createElement('a');
        a.href = link.url;
        a.target = '_blank';
        a.rel = 'noopener';
        a.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
          (ICONS[link.type] || ICONS.link) + '</svg>';
        a.appendChild(document.createTextNode(link.label));
        links.appendChild(a);
      });
      box.appendChild(links);
    }

    msgs.appendChild(box);
  }

  function renderAll() {
    msgs.innerHTML = '';
    bubble('bot', cfg.greeting);
    if (!state.messages.length) welcome();
    state.messages.forEach(function (m) { bubble(m.role, m.content); });
    updateCallbar();
  }

  // ---------- Horarios en la hora del visitante (cualquier país) ----------
  var visitorTz = (function () {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { return ''; }
  })();

  // Código de país según la zona horaria del navegador, para completar el campo de WhatsApp.
  var DIAL = {
    'America/Lima': '+51', 'America/Bogota': '+57', 'America/Santiago': '+56', 'America/Caracas': '+58',
    'America/Guayaquil': '+593', 'America/La_Paz': '+591', 'America/Asuncion': '+595', 'America/Montevideo': '+598',
    'America/Costa_Rica': '+506', 'America/Panama': '+507', 'America/Guatemala': '+502', 'America/El_Salvador': '+503',
    'America/Tegucigalpa': '+504', 'America/Managua': '+505', 'America/Havana': '+53', 'America/Santo_Domingo': '+1',
    'America/Puerto_Rico': '+1', 'Pacific/Honolulu': '+1', 'Europe/Madrid': '+34', 'Atlantic/Canary': '+34',
    'Europe/Lisbon': '+351', 'Europe/London': '+44', 'Europe/Paris': '+33', 'Europe/Rome': '+39',
    'Europe/Berlin': '+49', 'Europe/Amsterdam': '+31', 'Europe/Brussels': '+32', 'Europe/Zurich': '+41',
  };
  function dialCode() {
    var tz = visitorTz;
    if (DIAL[tz]) return DIAL[tz];
    if (/^America\/(Argentina\/|Buenos_Aires)/.test(tz)) return '+54';
    if (/^America\/(Mexico_City|Cancun|Merida|Monterrey|Matamoros|Chihuahua|Ciudad_Juarez|Ojinaga|Mazatlan|Bahia_Banderas|Hermosillo|Tijuana)$/.test(tz)) return '+52';
    if (/^America\/(Sao_Paulo|Fortaleza|Recife|Bahia|Belem|Manaus|Cuiaba|Campo_Grande|Porto_Velho|Boa_Vista|Rio_Branco|Maceio|Araguaina|Santarem|Noronha)$/.test(tz)) return '+55';
    if (/^America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Detroit|Boise|Indiana\/|Kentucky\/|North_Dakota\/|Toronto|Vancouver|Edmonton|Winnipeg|Halifax|Regina|St_Johns)/.test(tz)) return '+1';
    // Zona conocida pero país sin mapear: solo "+" (mejor que un código equivocado).
    return tz ? '+' : (cfg.call.country_code || '');
  }

  function ymd(date, tz) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  }
  function hourIn(date, tz) {
    return Number(new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hourCycle: 'h23' }).format(date));
  }
  // "Hoy", "Mañana" o "Jueves 29" según el calendario de esa zona horaria.
  function dayLabel(date, tz) {
    var now = new Date();
    if (ymd(date, tz) === ymd(now, tz)) return 'Hoy';
    if (ymd(date, tz) === ymd(new Date(now.getTime() + 864e5), tz)) return 'Mañana';
    var d = new Intl.DateTimeFormat('es', { timeZone: tz, weekday: 'long', day: 'numeric' }).format(date);
    return d.charAt(0).toUpperCase() + d.slice(1);
  }
  // Rango de horas en el formato del país del visitante (12 h con am/pm o 24 h).
  function timeRange(start, end, tz) {
    var f = new Intl.DateTimeFormat(undefined, { timeZone: tz, hour: 'numeric', minute: '2-digit' });
    return f.formatRange ? f.formatRange(start, end) : f.format(start) + ' – ' + f.format(end);
  }
  function countdown(start) {
    var min = Math.round((start - Date.now()) / 6e4);
    if (min <= 0) return 'ahora';
    if (min < 60) return 'en ' + min + ' min';
    var h = Math.round(min / 60);
    return h < 48 ? 'en ' + h + ' h' : 'en ' + Math.round(h / 24) + ' días';
  }
  function tzName(tz) {
    var styles = ['longGeneric', 'long'];
    for (var i = 0; i < styles.length; i++) {
      try {
        var part = new Intl.DateTimeFormat('es', { timeZone: tz, timeZoneName: styles[i] })
          .formatToParts(new Date()).filter(function (p) { return p.type === 'timeZoneName'; })[0];
        if (part) return part.value;
      } catch (e) {}
    }
    return tz;
  }

  // ---------- "Que me llame": formulario dentro del chat ----------
  function openCallForm() {
    if (busy) return;
    var existing = $('.card');
    if (existing) return focusInput(existing.querySelector('input'));
    var box = $('.welcome');
    if (box) box.remove();

    var card = document.createElement('form');
    card.className = 'card';
    card.innerHTML = '<p class="intro"></p><p class="loading">Buscando horarios…</p>';
    card.querySelector('.intro').innerHTML = format(cfg.call.intro);
    msgs.appendChild(card);
    msgs.scrollTop = msgs.scrollHeight;
    updateCallbar();

    fetch(base + '/api/call-slots?count=9')
      .then(function (res) { return res.json(); })
      .then(function (data) { buildCallForm(card, data); })
      .catch(function () { card.querySelector('.loading').textContent = 'No pude cargar los horarios. Intenta de nuevo.'; });
  }

  function closeCallForm(card) {
    card.remove();
    if (!state.messages.length) renderAll();
    updateCallbar();
  }

  function buildCallForm(card, data) {
    card.querySelector('.loading').remove();

    if (!data.slots || !data.slots.length) {
      var none = document.createElement('p');
      none.textContent = 'Ahora no hay horarios libres. Escríbele por WhatsApp con el botón de arriba 🙏';
      card.appendChild(none);
      return;
    }

    var tz = visitorTz || data.timezone;
    // ¿El visitante tiene otra hora que el negocio? (ej. México, España)
    var differs = !!visitorTz && data.slots.some(function (slot) {
      return timeRange(new Date(slot.start), new Date(slot.end), visitorTz) !== timeRange(new Date(slot.start), new Date(slot.end), data.timezone);
    });
    var night = function (slot) {
      var h = hourIn(new Date(slot.start), tz);
      return !slot.now && (h >= 22 || h < 7);
    };

    // Se muestran 3 franjas; si las 3 le caen de noche al visitante, se agregan las siguientes que no.
    var shown = data.slots.slice(0, 3);
    if (shown.every(night)) {
      shown = shown.concat(data.slots.slice(3).filter(function (slot) { return !night(slot); }).slice(0, 3));
    }
    var firstDay = shown.filter(function (slot) { return !night(slot); })[0] || shown[0];

    var html =
      '<label>Tu nombre<input name="name" maxlength="80" required autocomplete="name"></label>' +
      '<label>Tu WhatsApp (con código de país)<input name="whatsapp" type="tel" maxlength="25" required autocomplete="tel"></label>' +
      '<label>¿De qué es tu proyecto?<input name="project" maxlength="300" required></label>' +
      '<label class="hp" aria-hidden="true">Web<input name="website" tabindex="-1" autocomplete="off"></label>' +
      '<div class="when-title">¿Cuándo te llamo?<small></small></div>';
    card.insertAdjacentHTML('beforeend', html);
    if (differs) card.querySelector('.when-title small').textContent = 'Horarios en tu hora: ' + tzName(visitorTz);
    if (shown.every(night)) {
      card.querySelector('.when-title').insertAdjacentHTML('beforeend', '<span class="night-note"></span>');
      card.querySelector('.night-note').textContent = '🌙 En tu país estos horarios caen de noche. Si prefieres, escríbele por WhatsApp con el botón de arriba.';
    }

    shown.forEach(function (slot) {
      var start = new Date(slot.start), end = new Date(slot.end);
      var opt = document.createElement('label');
      opt.className = 'slot' + (night(slot) ? ' night' : '');
      opt.innerHTML = '<input type="radio" name="slot" required><span><span class="row"><b></b><em></em></span><small></small></span>';
      opt.querySelector('input').value = slot.id;
      opt.querySelector('input').checked = slot === firstDay;
      opt.querySelector('b').textContent = slot.now
        ? 'Ahora (en los próximos minutos)'
        : (night(slot) ? '🌙 ' : '') + dayLabel(start, tz) + ' · ' + timeRange(start, end, tz);
      opt.querySelector('em').textContent = slot.now ? '' : countdown(start);
      var notes = [];
      if (differs && !slot.now) notes.push(timeRange(start, end, data.timezone) + ' ' + data.timezone_label);
      if (night(slot)) notes.push(hourIn(start, tz) < 7 ? 'de madrugada para ti' : 'de noche para ti');
      opt.querySelector('small').textContent = notes.join(' · ');
      card.appendChild(opt);
    });

    card.insertAdjacentHTML('beforeend',
      '<p class="privacy"></p><p class="error" hidden></p>' +
      '<div class="actions"><button type="button" class="cancel">Cancelar</button>' +
      '<button type="submit" class="main">Agendar llamada</button></div>');

    card.querySelector('.privacy').textContent = cfg.call.privacy || '';
    card.querySelector('[name=whatsapp]').value = dialCode() + ' ';
    card.querySelector('.cancel').addEventListener('click', function () { closeCallForm(card); });
    card.addEventListener('submit', function (e) {
      e.preventDefault();
      submitCall(card);
    });
    focusInput(card.querySelector('[name=name]'));
    msgs.scrollTop = msgs.scrollHeight;
  }

  function submitCall(card) {
    var field = function (name) { return card.querySelector('[name=' + name + ']'); };
    var error = card.querySelector('.error');
    var submit = card.querySelector('.main');
    submit.disabled = true;
    error.hidden = true;

    fetch(base + '/api/call-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        session_id: state.session,
        name: field('name').value.trim(),
        whatsapp: field('whatsapp').value.trim(),
        project: field('project').value.trim(),
        slot: card.querySelector('[name=slot]:checked').value,
        timezone: visitorTz,
        website: field('website').value,
      }),
    })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (body) {
          if (res.status === 429) throw new Error('Ya enviaste varias solicitudes hoy. Escríbele por WhatsApp 🙏');
          if (!res.ok) {
            var errors = body.errors || {};
            var first = Object.keys(errors)[0];
            throw new Error(first ? errors[first][0] : 'No se pudo agendar. Intenta de nuevo.');
          }
          return body;
        });
      })
      .then(function (body) {
        card.remove();
        bubble('bot', body.message);
        state.messages.push({ role: 'assistant', content: body.message });
        save();
        updateCallbar();
      })
      .catch(function (err) {
        error.textContent = err.message;
        error.hidden = false;
        submit.disabled = false;
      });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    send(input.value);
  });

  function send(text) {
    text = text.trim();
    if (!text || busy) return;
    input.value = '';
    var box = $('.welcome');
    if (box) box.remove();
    var card = $('.card');
    if (card) card.remove();
    bubble('user', text);
    updateCallbar();
    state.messages.push({ role: 'user', content: text });
    save();
    ask(text);
  }

  function setBusy(on) {
    busy = on;
    sendBtn.disabled = on;
    typing.style.display = on ? 'block' : 'none';
  }

  function ask(text) {
    setBusy(true);
    var reply = '', el = null;

    fetch(base + '/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify({ session_id: state.session, message: text }),
    })
      .then(function (res) {
        if (res.status === 429) {
          return res.json().catch(function () { return {}; }).then(function (data) {
            throw new Error(data.message || 'Estás enviando muchos mensajes. Espera un momento 🙏');
          });
        }
        if (!res.ok || !res.body) throw new Error('No pude conectar con el chat. Intenta de nuevo.');

        var reader = res.body.getReader(), decoder = new TextDecoder(), buffer = '';

        function read() {
          return reader.read().then(function (chunk) {
            if (chunk.done) return;
            buffer += decoder.decode(chunk.value, { stream: true });
            var events = buffer.split('\n\n');
            buffer = events.pop();
            events.forEach(function (ev) {
              if (ev.indexOf('data: ') !== 0) return;
              var data = JSON.parse(ev.slice(6));
              if (data.delta) {
                reply += data.delta;
                if (!el) el = bubble('bot', '');
                el.innerHTML = format(reply);
                msgs.scrollTop = msgs.scrollHeight;
              } else if (data.error) {
                bubble('bot', data.error, 'err');
              }
            });
            return read();
          });
        }
        return read();
      })
      .catch(function (err) { bubble('bot', err.message, 'err'); })
      .then(function () {
        if (reply) {
          state.messages.push({ role: 'assistant', content: reply });
          save();
        }
        setBusy(false);
        focusInput();
      });
  }
})();
