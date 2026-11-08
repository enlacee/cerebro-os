/*!
 * Cerebro OS — widget de chat embebible.
 *
 * Uso (todo lo demás se configura en config/cerebro.php → GET /api/widget):
 *   <script src="https://chat.tudominio.com/widget.js" defer></script>
 *   data-open en el <script> → el chat empieza abierto solo en escritorio (en celular queda la burbuja).
 *   data-open="always" → abierto también en celular. Un link <a href="#chat"> lo abre.
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
    launcher: '',
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
  // Teléfono (SVG): igual en todos los sistemas, a diferencia del emoji.
  var PHONE = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>';
  // Texto del botón sin el emoji del .env (el ícono ya es SVG): "📞 Que Aníbal me llame" → "Que Aníbal me llame".
  function callText() {
    return (cfg.call.short || cfg.call.title).replace(/^[^\p{L}\p{N}¿¡]+/u, '');
  }
  // Botón "que me llame" con ícono SVG.
  function callButton(className) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = className;
    b.innerHTML = PHONE;
    b.appendChild(document.createTextNode(callText()));
    b.title = cfg.call.subtitle;
    b.addEventListener('click', function () { openCallForm(); });
    return b;
  }

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
    ':host .chip,:host .icon.phone{color:#8ab4f8}' +
    ':host .icon.reset,:host .icon.reset:hover{color:#8ab4f8;background:rgba(138,180,248,.14)}' +
    ':host .chip:hover,:host .chip:active{background:rgba(138,180,248,.12);border-color:var(--line)}}' +
    '*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}' +
    'button,a{touch-action:manipulation}' +
    '.fab{position:fixed;right:calc(16px + env(safe-area-inset-right));bottom:calc(16px + env(safe-area-inset-bottom));' +
    'width:56px;height:56px;border-radius:50%;border:0;background:var(--c);color:#fff;display:flex;align-items:center;justify-content:center;gap:8px;' +
    'cursor:pointer;box-shadow:0 3px 10px rgba(60,64,67,.35);font:600 15px/1 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;white-space:nowrap;z-index:2147483000}' +
    // Botón con texto (píldora, CEREBRO_LAUNCHER_TEXT); abierto vuelve a ser círculo con ✕.
    '.fab.ext{width:auto;height:50px;padding:0 20px 0 16px;border-radius:25px}' +
    '.fab .x,.fab.open .chat,.fab.open .fab-text,.fab .fab-text:empty{display:none}.fab.open .x{display:block}' +
    '.fab.ext.open{width:56px;height:56px;padding:0;border-radius:50%}' +
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
    // "Que me llame": ícono de teléfono en la cabecera y como chip dentro de la conversación.
    '.icon.phone{color:var(--c)}.pay.call svg,.offer svg{flex:none;margin-right:6px}' +
    '.offer{align-self:flex-start;display:inline-flex;align-items:center}' +
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
    '.chip:active{background:#e8f0fe;border-color:#d2e3fc}.pay.call:active{background:var(--hover)}' +
    // Formulario: tarjeta blanca con cabecera azul, para que se lea como algo aparte de los mensajes.
    '.card{flex:none;align-self:stretch;background:var(--bg);border-radius:18px;overflow:hidden;' +
    'box-shadow:0 0 0 1px rgba(26,115,232,.18),0 8px 24px rgba(26,115,232,.18),0 2px 6px rgba(60,64,67,.12);animation:cerebro-pop .25s ease}' +
    // Cabecera premium: degradado azul, título + subtítulo.
    // Con el formulario abierto, el campo de mensaje y el aviso se esconden: así entra todo sin scroll (la ✕ los devuelve).
    '.panel:has(.card) .composer,.panel:has(.card) .foot{display:none}' +
    '.card .card-head{display:flex;align-items:center;justify-content:space-between;gap:8px;color:#fff;padding:10px 8px 10px 16px;' +
    'background:linear-gradient(135deg,var(--c) 0%,#1557b0 100%)}' +
    '.card .card-head b{display:block;font-size:16px;font-weight:700;letter-spacing:.1px}' +
    '.card .card-head small{display:block;font-size:12.5px;opacity:.9;margin-top:2px}' +
    '.card .x{flex:none;width:34px;height:34px;border:0;border-radius:50%;background:transparent;color:#fff;font:inherit;font-size:18px;line-height:1;cursor:pointer}' +
    '.card .x:active{background:rgba(255,255,255,.2)}' +
    '.card .body{display:flex;flex-direction:column;gap:8px;padding:10px 14px 12px}' +
    '.card p{margin:0;font-size:14px}.card .intro{font-size:12.5px;line-height:1.35;color:var(--muted)}' +
    '.card input{flex:none;width:100%}.card input:not([type=radio]),.card textarea{min-height:46px;padding:19px 12px 5px}' +
    // Etiqueta flotante: centrada como placeholder; al enfocar o con texto, sube chica arriba.
    '.card .fl{position:relative;display:block}' +
    '.card .fl .lb{position:absolute;left:13px;right:10px;top:13px;font-size:15px;color:var(--muted);pointer-events:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;' +
    'transition:top .15s,font-size .15s,color .15s}' +
    '.card .fl :focus~.lb,.card .fl :not(:placeholder-shown)~.lb{top:5px;font-size:11.5px;font-weight:500}.card .fl :focus~.lb{color:var(--c)}' +
    '.card .bad .lb{color:#dc2626!important}' +
    '.card textarea{display:block;width:100%;border:1px solid var(--line);border-radius:12px;background:var(--bg);color:var(--fg);font:inherit;font-size:16px;resize:none;line-height:1.35}' +
    '.card textarea:focus{outline:2px solid var(--c);outline-offset:-1px;border-color:transparent}' +
    '.card ::placeholder{color:var(--muted);opacity:.8}' +
    // WhatsApp: código de país angosto + número; al completarlo, el número ya listo.
    '.card .num-box input{padding-right:34px}' +
    '.card .ok{position:absolute;right:12px;top:50%;transform:translateY(-50%);color:var(--c);font-weight:700;pointer-events:none}.card .ok[hidden]{display:none}' +
    '.card .err{display:block;font-size:12px;font-weight:400;margin:3px 0 0 2px}' +
    '.card .err{color:#dc2626}.card .err:empty{display:none}.card .bad input,.card .bad textarea{border-color:#dc2626}' +
    // Horarios: botones chicos en 2 columnas.
    '.card .when{display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:500}.card .when small{font-weight:400;color:var(--muted);font-size:12px}' +
    '.card .slots{display:grid;grid-template-columns:1fr 1fr;gap:6px}' +
    '.card .slot{position:relative;flex-direction:row;align-items:center;justify-content:center;min-height:38px;padding:6px 8px;border:1px solid var(--line);border-radius:10px;' +
    'background:var(--bg);color:var(--fg);font-size:13px;font-weight:500;text-align:center;cursor:pointer}' +
    '.card .slot input{position:absolute;opacity:0;pointer-events:none}' +
    '.card .slot:has(input:checked){border-color:var(--c);background:rgba(26,115,232,.1);color:var(--c);font-weight:600}' +
    '.card .slot:has(input:focus-visible){outline:2px solid var(--c);outline-offset:1px}.card .slot.night{color:var(--muted)}' +
    '.card .night-note{font-size:12px;font-weight:400;color:var(--muted)}' +
    '.card .privacy{font-size:11.5px;color:var(--muted);text-align:center}.card .privacy:empty{display:none}' +
    '.card .main{width:100%;min-height:46px;border:0;border-radius:14px;padding:10px;color:#fff;font:inherit;font-size:15px;font-weight:700;cursor:pointer;' +
    'background:linear-gradient(135deg,var(--c) 0%,#1557b0 100%);box-shadow:0 4px 12px rgba(26,115,232,.35);transition:transform .15s,box-shadow .15s}' +
    '.card .main:active{transform:scale(.98);box-shadow:0 2px 6px rgba(26,115,232,.3)}' +
    '.card .main:disabled{opacity:.5;cursor:default}' +
    '.card .error{color:#dc2626;font-size:13px;margin:0}' +
    // Botón cargando, temblor en campos con error.
    '.card .main .spin{display:inline-block;width:15px;height:15px;margin-right:8px;vertical-align:-2px;border:2px solid rgba(255,255,255,.45);border-top-color:#fff;border-radius:50%;animation:cerebro-spin .7s linear infinite}' +
    '.shake{animation:cerebro-shake .35s ease}' +
    '@keyframes cerebro-shake{20%,60%{transform:translateX(-5px)}40%,80%{transform:translateX(5px)}}' +
    // Tarjeta de llamada agendada.
    '.booked{flex:none;align-self:stretch;background:var(--bg);border-radius:18px;padding:18px 16px 14px;text-align:center;animation:cerebro-pop .3s ease;' +
    'box-shadow:0 0 0 1px rgba(26,115,232,.18),0 8px 24px rgba(26,115,232,.16)}' +
    '.booked .check{width:54px;height:54px;margin:0 auto 10px;border-radius:50%;display:grid;place-items:center;color:#fff;' +
    'background:linear-gradient(135deg,var(--c),#1557b0);box-shadow:0 4px 12px rgba(26,115,232,.35);animation:cerebro-check .5s cubic-bezier(.2,1.5,.4,1)}' +
    '.booked .check path{stroke-dasharray:24;animation:cerebro-draw .4s .25s ease backwards}' +
    '@keyframes cerebro-check{from{transform:scale(0)}to{transform:scale(1)}}@keyframes cerebro-draw{from{stroke-dashoffset:24}to{stroke-dashoffset:0}}' +
    '.booked h3{margin:0;font-size:18px}.booked .sub{margin:3px 0 0;color:var(--muted);font-size:13px}' +
    '.booked .info{margin:14px 0 0;padding:12px 4px 0;border-top:1px solid var(--line);display:flex;flex-direction:column;gap:7px;font-size:14px;text-align:left}' +
    '.booked .info b{font-weight:600}' +
    '.booked .cal{display:flex;gap:6px;margin-top:14px}' +
    '.booked .cal a{flex:1;display:flex;align-items:center;justify-content:center;min-height:40px;padding:6px 8px;border:1px solid var(--line);border-radius:12px;' +
    'color:var(--c);font-size:13px;font-weight:600;text-decoration:none;background:var(--bg)}' +
    '.booked .cal a:active{background:rgba(26,115,232,.08)}' +
    '@media (prefers-reduced-motion:reduce){.booked,.booked .check,.booked .check path,.shake{animation:none}}' +
    // Pantallas bajas (laptop con ventana chica): más compacto para que siga entrando sin scroll.
    '@media (max-height:700px){.card .body{gap:6px;padding:8px 14px 10px}.card .card-head{padding:8px 8px 8px 16px}' +
    '.card textarea{height:46px;min-height:46px}.card .main{min-height:42px}.card .slot{min-height:36px}}' +
    '.hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}' +
    // "Escribiendo" con tres puntos animados (se nota que hay reacción).
    '.typing{flex:none;color:var(--muted);font-size:13px;padding:0 16px 6px;display:none;align-items:center;gap:6px}' +
    '.dots{display:inline-flex;gap:3px}.dots i{width:6px;height:6px;border-radius:50%;background:var(--c);opacity:.35;animation:cerebro-dot 1.1s infinite ease-in-out}' +
    '.dots i:nth-child(2){animation-delay:.15s}.dots i:nth-child(3){animation-delay:.3s}' +
    '@keyframes cerebro-dot{0%,60%,100%{opacity:.35;transform:none}30%{opacity:1;transform:translateY(-3px)}}' +
    // Respuesta recién terminada: un destello azul suave para que el ojo la encuentre.
    '.m.bot.fresh{animation:cerebro-fresh 1.8s ease-out}' +
    '@keyframes cerebro-fresh{0%{box-shadow:0 0 0 2px rgba(26,115,232,.55);background:rgba(26,115,232,.12)}100%{box-shadow:0 0 0 0 rgba(26,115,232,0)}}' +
    // Burbuja cerrada con respuesta sin leer: punto rojo.
    '.fab.unread::after{content:"";position:absolute;top:2px;right:2px;width:14px;height:14px;border-radius:50%;background:#d93025;border:2px solid #fff}' +
    '.foot .snd{border:0;background:transparent;color:var(--muted);font:inherit;font-size:11px;cursor:pointer;padding:2px 4px;border-radius:6px}' +
    '.foot .snd:hover{color:var(--fg)}' +
    // Bienvenida: los botones y chips entran uno tras otro.
    '.in{animation:cerebro-in .32s ease backwards}@keyframes cerebro-in{from{opacity:0;transform:translateY(6px)}}' +
    // Globito que invita junto a la burbuja cerrada (una vez por visita).
    '.nudge{position:fixed;right:calc(16px + env(safe-area-inset-right));bottom:calc(84px + env(safe-area-inset-bottom));z-index:2147483000;' +
    'display:flex;align-items:center;gap:2px;max-width:min(280px,calc(100vw - 32px));padding:4px 4px 4px 14px;background:var(--bg);color:var(--fg);' +
    'border-radius:16px 16px 4px 16px;box-shadow:0 6px 20px rgba(60,64,67,.25),0 0 0 1px rgba(60,64,67,.08);animation:cerebro-pop .3s ease}' +
    '.nudge[hidden]{display:none}' +
    '.nudge-text{flex:1;border:0;background:none;color:inherit;font:inherit;font-size:14px;text-align:left;cursor:pointer;padding:8px 0}' +
    '.nudge-x{flex:none;width:30px;height:30px;border:0;border-radius:50%;background:none;color:var(--muted);font:inherit;font-size:14px;cursor:pointer}' +
    '.panel.open~.nudge{display:none}' +
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
    '.chip:hover{background:#e8f0fe;border-color:#d2e3fc}.pay.call:hover{background:var(--hover)}}' +
    // Celular angosto (≤360px): el botón de WhatsApp queda solo con ícono.
    // Cabecera angosta (celular y panel de 400px, con el botón de llamada): queda la calificación, sin "En línea".
    '.rated .status,.rated::before{display:none}' +
    '@media (max-width:360px){.wa{width:38px;padding:0;justify-content:center}.wa .short{display:none}}' +
    // Escritorio / tablet: panel flotante.
    '@media (min-width:481px){.nudge{right:20px;bottom:90px}}' +
    '@media (min-width:481px){' +
    '.fab{right:20px;bottom:20px;width:58px;height:58px}.fab.ext{height:52px;border-radius:26px}.fab.ext.open{width:58px;height:58px;border-radius:50%}' +
    '.panel{inset:auto 20px 90px auto;width:400px;height:620px;max-height:calc(100vh - 110px);border-radius:16px;border:1px solid var(--line);box-shadow:0 8px 28px rgba(60,64,67,.28)}' +
    '.head{padding:10px 8px 10px 14px}.icon{width:36px;height:36px;border-radius:10px}' +
    '.backdrop{display:block}.panel.open{animation:cerebro-pop .2s ease-out}' +
    '.msgs{padding:14px}.composer{padding:10px}.foot-on .composer{padding-bottom:4px}' +
    '}' +
    '.panel.open~.fab{display:none}' +
    '@media (prefers-reduced-motion:reduce){.panel.open,.reset.spin svg,.dots i,.m.bot.fresh,.in,.nudge{animation:none}.backdrop{transition:none}}' +
    '@media (min-width:481px){.panel.open~.fab{display:flex}}' +
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
    '<button class="icon phone" aria-label="Pedir una llamada" title="Pedir una llamada" hidden>' + PHONE + '</button>' +
    '<button class="icon reset" aria-label="Nueva conversación" title="Nueva conversación">' +
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M3 12a9 9 0 0 1 15.5-6.2L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16"/><path d="M3 21v-5h5"/></svg></button>' +
    '<button class="icon close" aria-label="Cerrar chat" title="Cerrar">' +
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true">' +
    '<path d="M18 6 6 18M6 6l12 12"/></svg></button>' +
    '</div></div>' +
    '<div class="msgs" aria-live="polite"></div>' +
    '<div class="typing" aria-hidden="true"><span class="dots"><i></i><i></i><i></i></span><span class="typing-text">Escribiendo…</span></div>' +
    '<form class="composer"><input maxlength="1000" placeholder="Escribe tu mensaje…" aria-label="Mensaje" enterkeyhint="send" autocomplete="off">' +
    '<button type="submit" class="send" aria-label="Enviar">' +
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4 20-7z"/></svg></button></form>' +
    '<div class="foot"><span class="disc"></span><button type="button" class="snd"></button></div>' +
    '</div>' +
    '<button class="fab" aria-label="Abrir chat">' +
    // Ícono de chat dibujado (el emoji se veía distinto en cada sistema).
    '<svg class="chat" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>' +
    '<svg class="x" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true">' +
    '<path d="M18 6 6 18M6 6l12 12"/></svg>' +
    '<span class="fab-text"></span></button>' +
    '<div class="nudge" role="status" hidden><button type="button" class="nudge-text"></button>' +
    '<button type="button" class="nudge-x" aria-label="Cerrar">✕</button></div>';

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
  // ---------- Scroll "pegado abajo" ----------
  // Si el visitante está al final, se queda al final aunque el área cambie de alto ("Escribiendo…",
  // teclado del celular, formulario). Si subió a leer, no se le mueve mientras llega la respuesta.
  var stick = true;
  msgs.addEventListener('scroll', function () {
    stick = msgs.scrollHeight - msgs.scrollTop - msgs.clientHeight < 60;
  }, { passive: true });
  function toEnd(force) {
    if (force || stick) {
      msgs.scrollTop = msgs.scrollHeight;
      stick = true;
    }
  }
  if (window.ResizeObserver) {
    new ResizeObserver(function () { if (stick) msgs.scrollTop = msgs.scrollHeight; }).observe(msgs);
  }

  function fitViewport() {
    var full = panel.classList.contains('open') && mobile.matches;
    if (full && vv) {
      panel.style.height = vv.height + 'px';
      panel.style.top = vv.offsetTop + 'px';
      if (state.messages.length) toEnd();
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
      $('.foot .disc').textContent = cfg.disclaimer + ' · ';
    }
    if (cfg.whatsapp) {
      var wa = $('.wa');
      wa.querySelector('.short').textContent = cfg.contact.short || 'WhatsApp';
      wa.setAttribute('aria-label', cfg.contact.label);
      wa.title = cfg.contact.label;
      wa.href = waLink(cfg.contact.message);
      wa.hidden = false;
    }
    if (cfg.call) $('.icon.phone').hidden = false;
    if (cfg.launcher) {
      $('.fab .fab-text').textContent = cfg.launcher;
      $('.fab').classList.add('ext');
    }
  });

  $('.icon.phone').addEventListener('click', function () { openCallForm(); });

  // Chip "Que Aníbal me llame" bajo una respuesta del bot: una vez tras la 2.ª respuesta
  // y cada vez que el bot sugiere la llamada. Se guarda en el mensaje (m.call) para redibujarlo.
  function wantsCallChip(reply) {
    if (!cfg.call) return false;
    var replies = state.messages.filter(function (m) { return m.role === 'assistant'; }).length;
    var offered = state.messages.some(function (m) { return m.call; });
    return (replies === 2 && !offered) || reply.toLowerCase().indexOf(callText().toLowerCase()) !== -1;
  }
  function callChip() {
    var chip = callButton('chip offer');
    msgs.appendChild(chip);
    toEnd();
  }

  // byUser: lo abrió/cerró el visitante (clic, Esc). Solo entonces suena: sin clic el navegador no deja.
  function toggle(open, byUser) {
    if (byUser && open !== panel.classList.contains('open')) (open ? openSound : closeSound)();
    if (open) hideNudge();
    panel.classList.toggle('open', open);
    $('.backdrop').classList.toggle('show', open);
    $('.fab').classList.toggle('open', open);
    $('.fab').setAttribute('aria-label', open ? 'Cerrar chat' : 'Abrir chat');
    fitViewport();
    if (open) {
      if (!msgs.children.length) ready.then(renderAll);
      $('.fab').classList.remove('unread');
      if (pendingFlash && !document.hidden) { flash(pendingFlash); pendingFlash = null; }
      focusInput();
    }
  }

  $('.fab').addEventListener('click', function () { toggle(!panel.classList.contains('open'), true); });
  $('.close').addEventListener('click', function () { toggle(false, true); });
  // Clic fuera del chat o tecla Esc: se cierra.
  $('.backdrop').addEventListener('click', function () { toggle(false, true); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && panel.classList.contains('open')) toggle(false, true);
  });

  // Abrir solo: data-open en el <script> (página propia del chat) o al llegar con #chat en la URL.
  // data-open: abierto al cargar solo en escritorio; en celular o tablet queda la burbuja (no tapa la página).
  // Celular = pantalla angosta o táctil sin mouse (así un celular grande o en horizontal no pasa por escritorio).
  // data-open="always": abierto también en celular. Entrar con #chat lo abre en cualquier dispositivo.
  var touch = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  var openMode = script.getAttribute('data-open');
  if ((openMode !== null && (openMode === 'always' || !(mobile.matches || touch))) || location.hash === '#chat') toggle(true);
  // Cualquier link a #chat de la web abre el chat (ej. un botón "Pregúntale a mi asistente").
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href="#chat"]');
    if (!a) return;
    e.preventDefault();
    toggle(true, true);
  });

  // ---------- Globito que invita (una vez por visita, sin sonido) ----------
  var NUDGE = 'cerebro-nudge', everOpened = panel.classList.contains('open');
  function hideNudge() {
    everOpened = true;
    $('.nudge').hidden = true;
  }
  ready.then(function () {
    var n = cfg.nudge;
    if (!n || !n.text || everOpened || state.messages.length) return;
    try { if (sessionStorage.getItem(NUDGE)) return; } catch (e) {}
    setTimeout(function () {
      if (everOpened || panel.classList.contains('open')) return;
      $('.nudge-text').textContent = n.text;
      $('.nudge').hidden = false;
      try { sessionStorage.setItem(NUDGE, '1'); } catch (e) {}
    }, Math.max(3, n.delay || 20) * 1000);
  });
  $('.nudge-text').addEventListener('click', function () { toggle(true, true); });
  $('.nudge-x').addEventListener('click', function () { $('.nudge').hidden = true; });

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
    toEnd();
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
  function greet(el) {
    var text = cfg.greeting, shown = 0;
    el.hidden = true;
    typing.style.display = 'flex';
    setTimeout(function () {
      typing.style.display = busy ? 'flex' : 'none';
      if (!el.isConnected) return; // la cerraron o reiniciaron a mitad
      el.hidden = false;
      (function step() {
        if (!el.isConnected) return;
        shown = Math.min(text.length, shown + 2);
        el.innerHTML = format(text.slice(0, shown));
        tick();
        toEnd();
        if (shown < text.length) setTimeout(step, 22);
        else if (!state.messages.length && !$('.card')) welcome(true);
      })();
    }, 650);
  }

  function welcome(animate) {
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

    if (cfg.call) quick.appendChild(callButton('pay call'));

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
    // Entrada escalonada (60 ms entre cada uno): se siente que el chat "se arma" para ti.
    if (animate) {
      box.querySelectorAll('.quick > *, .label, .chip, .links a').forEach(function (item, i) {
        item.style.animationDelay = (i * 60) + 'ms';
        item.classList.add('in');
      });
    }
    toEnd();
  }

  function renderAll() {
    msgs.innerHTML = '';
    // Primera vez (o tras "Nueva conversación"): el saludo se escribe en vivo, como si alguien atendiera.
    if (!state.messages.length && !state.greeted) {
      state.greeted = true;
      save();
      greet(bubble('bot', ''));
      return;
    }
    bubble('bot', cfg.greeting);
    if (!state.messages.length) welcome();
    state.messages.forEach(function (m) {
      if (m.booked) bookedCard(m.booked);
      else bubble(m.role, m.content);
      if (m.call && cfg.call) callChip();
    });
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
  // "Hoy", "Mañana" o "Lun 10".
  function shortDay(date, tz) {
    var d = dayLabel(date, tz);
    if (d === 'Hoy' || d === 'Mañana') return d;
    d = new Intl.DateTimeFormat('es', { timeZone: tz, weekday: 'short', day: 'numeric' }).format(date).replace('.', '').replace(',', '');
    return d.charAt(0).toUpperCase() + d.slice(1);
  }

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
    card.setAttribute('autocomplete', 'off'); // sin sugerencias de nombres o números guardados
    card.setAttribute('aria-label', 'Agendar llamada');
    card.innerHTML = '<div class="card-head"><span><b>📞 Agendar llamada</b><small></small></span><button type="button" class="x" aria-label="Cerrar">✕</button></div>' +
      '<div class="body"><p class="intro"></p><p class="loading">Buscando horarios…</p></div>';
    card.querySelector('.intro').innerHTML = format(cfg.call.intro);
    card.querySelector('.card-head small').textContent = cfg.call.subtitle || '';
    card.querySelector('.x').addEventListener('click', function () { closeCallForm(card); });
    msgs.appendChild(card);
    toEnd();

    fetch(base + '/api/call-slots?count=9')
      .then(function (res) { return res.json(); })
      .then(function (data) { buildCallForm(card, data); })
      .catch(function () { card.querySelector('.loading').textContent = 'No pude cargar los horarios. Intenta de nuevo.'; });
  }

  function closeCallForm(card) {
    card.remove();
    if (!state.messages.length) renderAll();
  }

  function buildCallForm(card, data) {
    card.querySelector('.loading').remove();
    var body = card.querySelector('.body');

    if (!data.slots || !data.slots.length) {
      var none = document.createElement('p');
      none.textContent = 'Ahora no hay horarios libres. Escríbele por WhatsApp con el botón de arriba 🙏';
      body.appendChild(none);
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

    // Se muestran las 2 próximas franjas; si ambas le caen de noche al visitante, se agregan las 2 siguientes que no.
    var shown = data.slots.slice(0, 2);
    if (shown.every(night)) {
      shown = shown.concat(data.slots.slice(2).filter(function (slot) { return !night(slot); }).slice(0, 2));
    }
    var firstDay = shown.filter(function (slot) { return !night(slot); })[0] || shown[0];

    var html =
      // Etiqueta flotante: va dentro del campo y sube al escribir (ahorra una línea por campo).
      '<div data-f="name"><label class="fl"><input data-k="name" maxlength="80" autocomplete="off" autocapitalize="words" spellcheck="false" placeholder=" " enterkeyhint="next"><span class="lb">Tu nombre</span></label><small class="err"></small></div>' +
      // Un solo campo: empieza con el código del país del visitante (+51 ) y solo escribe su número.
      '<div data-f="whatsapp"><label class="fl num-box"><input data-k="whatsapp" inputmode="tel" maxlength="22" placeholder=" " autocomplete="off" enterkeyhint="next">' +
      '<span class="lb">Tu WhatsApp</span><span class="ok" hidden aria-hidden="true">✓</span></label><small class="err"></small></div>' +
      '<div data-f="project"><label class="fl"><textarea data-k="project" rows="2" maxlength="300" placeholder=" " autocomplete="off" autocapitalize="sentences" enterkeyhint="send"></textarea><span class="lb">¿De qué quieres hablar? (ej: publicar mi app)</span></label><small class="err"></small></div>' +
      '<label class="hp" aria-hidden="true">Web<input name="website" data-k="website" tabindex="-1" autocomplete="off"></label>' +
      '<div class="when">¿Cuándo te llamo?<small hidden></small><div class="slots"></div></div>';
    body.insertAdjacentHTML('beforeend', html);
    var note = card.querySelector('.when small');
    if (differs) { note.hidden = false; note.textContent = 'En tu hora (' + tzName(visitorTz) + ')'; }
    if (shown.every(night)) {
      card.querySelector('.when').insertAdjacentHTML('beforeend', '<span class="night-note"></span>');
      card.querySelector('.night-note').textContent = '🌙 En tu país estos horarios caen de noche. Si prefieres, escríbele por WhatsApp.';
    }
    var slotsBox = card.querySelector('.slots');

    shown.forEach(function (slot) {
      var start = new Date(slot.start), end = new Date(slot.end);
      var opt = document.createElement('label');
      opt.className = 'slot' + (night(slot) ? ' night' : '');
      opt.innerHTML = '<input type="radio" name="slot" required><span></span>';
      opt.querySelector('input').value = slot.id;
      card._slots = card._slots || {};
      card._slots[slot.id] = { start: slot.start, end: slot.end, now: !!slot.now,
        text: slot.now ? 'Ahora, en los próximos minutos' : dayLabel(start, tz) + ' · ' + timeRange(start, end, tz) };
      opt.querySelector('input').checked = slot === firstDay;
      opt.querySelector('span').textContent = slot.now
        ? 'Ahora mismo'
        : (night(slot) ? '🌙 ' : '') + shortDay(start, tz) + ' ' + timeRange(start, end, tz).replace(/:00/g, '');
      // Detalle completo al pasar el mouse o con lector de pantalla.
      opt.title = slot.now ? 'En los próximos minutos' : dayLabel(start, tz) + ' · ' + timeRange(start, end, tz) + ' · ' + countdown(start) +
        (differs ? ' · ' + timeRange(start, end, data.timezone) + ' ' + data.timezone_label : '');
      slotsBox.appendChild(opt);
    });

    body.insertAdjacentHTML('beforeend',
      '<p class="error" hidden></p><button type="submit" class="main">Agendar mi llamada →</button><p class="privacy"></p>');

    card.querySelector('.privacy').textContent = cfg.call.privacy || '';
    card.noValidate = true; // validamos nosotros, con mensajes claros bajo cada campo
    var num = card.querySelector('[data-k=whatsapp]');
    num.value = dialCode() === '+' ? '+' : dialCode() + ' ';
    var refresh = function (strict) { phoneFeedback(card, strict); };
    // Solo números y espacios ("+" únicamente al inicio); con el cursor al final, se agrupa: +51 987 654 321.
    num.addEventListener('input', function () {
      var v = num.value, atEnd = num.selectionStart === v.length;
      v = (v.trim()[0] === '+' ? '+' : '') + v.replace(/[^\d ]/g, '').replace(/^\s+/, '');
      num.value = atEnd ? phoneFormat(v) : v;
      refresh(false);
    });
    // Nombre con formato mientras escribe ("juan PÉREZ" → "Juan Pérez"), sin mover el cursor.
    // En celular el teclado arma cada palabra ("composición"): tocar el texto a mitad rompe letras,
    // así que se espera a que termine la palabra (compositionend). Al salir se limpian espacios dobles.
    var nameInput = card.querySelector('[data-k=name]');
    liveFormat(nameInput, titleLive);
    nameInput.addEventListener('blur', function () { nameInput.value = titleName(nameInput.value); });
    // Tema: solo la primera letra en mayúscula (lo demás como lo escribió: "Play Store", "WhatsApp").
    liveFormat(card.querySelector('[data-k=project]'), firstUpper);
    // Enter / "Siguiente" del teclado: pasa al campo siguiente; en el último, envía.
    var order = ['name', 'whatsapp', 'project'];
    order.forEach(function (key, i) {
      card.querySelector('[data-k=' + key + ']').addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return;
        e.preventDefault();
        if (order[i + 1]) card.querySelector('[data-k=' + order[i + 1] + ']').focus();
        else if (card.requestSubmit) card.requestSubmit();
        else card.dispatchEvent(new Event('submit', { cancelable: true }));
      });
    });
    // Al tocarlo, el cursor va al final (después del +51).
    num.addEventListener('focus', function () { setTimeout(function () { num.setSelectionRange(num.value.length, num.value.length); }, 0); });
    num.addEventListener('blur', function () { if (num.value.trim()) refresh(true); });
    ['name', 'project'].forEach(function (name) {
      card.querySelector('[data-k=' + name + ']').addEventListener('input', function () { fieldError(card, name, ''); });
    });
    refresh(false);
    card.addEventListener('submit', function (e) {
      e.preventDefault();
      if (checkCallForm(card)) submitCall(card);
    });
    focusInput(card.querySelector('[data-k=name]'));
    // Que se vea el formulario desde arriba (no solo el final).
    msgs.scrollTop += card.getBoundingClientRect().top - msgs.getBoundingClientRect().top - 8;
  }

  // ---------- Validación del celular (mismas reglas que el servidor: cfg.call.phones) ----------
  // Número completo en un campo: "+51 987 654 321". Sin "+", se asume el país del visitante.
  function phoneSplit(value) {
    var v = String(value).trim(), d = v.replace(/\D/g, '');
    if (!d) return { error: 'Escribe tu número de WhatsApp.', empty: true };
    if (v[0] !== '+') {
      var home = String(dialCode() === '+' ? cfg.call.country_code || '' : dialCode()).replace(/\D/g, '');
      d = home + d.replace(/^0+/, '');
    }
    var codes = Object.keys(cfg.call.phones || {}).sort(function (a, b) { return b.length - a.length; });
    for (var i = 0; i < codes.length; i++) {
      if (d.indexOf(codes[i]) === 0) return phoneCheck(codes[i], d.slice(codes[i].length));
    }
    return d.length >= 8 && d.length <= 15
      ? { pretty: '+' + d, digits: d }
      : { error: 'Revisa tu número con el código de país (ej. +51 987 654 321).', short: d.length < 8 };
  }

  function phoneCheck(code, number) {
    code = String(code).replace(/\D/g, '');
    var national = String(number).replace(/\D/g, '');
    var rule = (cfg.call.phones || {})[code];
    var max = rule ? Math.max.apply(null, rule.digits) : 13;
    if (!code) return { error: 'Escribe el código de país (ej. +51).' };
    if (national.indexOf(code) === 0 && national.length > max) national = national.slice(code.length); // repitió el código
    national = national.replace(/^0+/, ''); // 0 de larga distancia
    if (!national) return { error: 'Escribe tu número de WhatsApp.', empty: true };
    if (rule) {
      var starts = rule.starts && rule.starts.indexOf(national[0]) === -1;
      if (starts) return { error: 'Tu celular debe empezar con ' + rule.starts.split('').join(' o ') + '.' };
      if (national.length > max) return { error: 'Tiene ' + national.length + ' dígitos: un celular aquí tiene ' + rule.digits.join(' u ') + '.' };
      if (rule.digits.indexOf(national.length) === -1) return { error: 'Faltan dígitos: un celular aquí tiene ' + rule.digits.join(' u ') + '.', short: true };
    } else if (national.length < 6 || (code + national).length > 15) {
      return { error: 'Revisa tu número de WhatsApp.', short: national.length < 6 };
    }
    return { pretty: '+' + code + ' ' + groupDigits(national), digits: code + national };
  }

  // Mientras escribe: agrupa según el largo esperado del país (Perú 3-3-3 desde el primer dígito).
  function phoneFormat(v) {
    var plus = v[0] === '+', d = v.replace(/\D/g, ''), phones = cfg.call.phones || {};
    var code = '', rest = d;
    if (plus) {
      code = Object.keys(phones).sort(function (a, b) { return b.length - a.length; })
        .filter(function (c) { return d.indexOf(c) === 0; })[0];
      if (!code) return '+' + d; // código sin regla: se deja como está
      rest = d.slice(code.length);
      if (!rest) return '+' + code + (/\s$/.test(v) ? ' ' : '');
    }
    var home = plus ? code : String(dialCode() === '+' ? cfg.call.country_code || '' : dialCode()).replace(/\D/g, '');
    var rule = phones[home], max = rule ? Math.max.apply(null, rule.digits) : 0;
    var sizes = { 8: [4, 4], 9: [3, 3, 3], 10: [3, 3, 4], 11: [3, 4, 4] }[max];
    var grouped;
    if (!sizes || rest.length > max) grouped = rest.replace(/(\d{3})(?=\d)/g, '$1 ');
    else {
      var out = [], r = rest;
      sizes.forEach(function (n) { if (r) { out.push(r.slice(0, n)); r = r.slice(n); } });
      grouped = out.join(' ');
    }
    return plus ? '+' + code + ' ' + grouped : grouped;
  }

  // "maría DE LA cruz" → "María de la Cruz" (misma regla que el servidor: App\Services\Name).
  var PARTICLES = ['de', 'del', 'la', 'las', 'los', 'y', 'e', 'da', 'do', 'dos', 'van', 'von'];
  function titleName(v) {
    return v.trim().split(/\s+/).filter(Boolean).map(function (w, i) {
      var l = w.toLowerCase();
      if (i > 0 && PARTICLES.indexOf(l) !== -1) return l;
      return l.replace(/(^|[-'’])(\p{L})/gu, function (m, a, b) { return a + b.toUpperCase(); });
    }).join(' ');
  }

  // Aplica un formato mientras escribe sin mover el cursor. En celular el teclado arma cada palabra
  // ("composición"): tocar el texto a mitad duplica letras, así que se espera a que la termine.
  function liveFormat(el, fn) {
    var composing = false;
    var apply = function () {
      var v = el.value, next = fn(v);
      if (next === v || next.length !== v.length) return;
      var a = el.selectionStart, b = el.selectionEnd;
      el.value = next;
      if (root.activeElement === el && a !== null) el.setSelectionRange(a, b);
    };
    el.addEventListener('compositionstart', function () { composing = true; });
    el.addEventListener('compositionend', function () { composing = false; apply(); });
    el.addEventListener('input', function (e) { if (!composing && !e.isComposing) apply(); });
  }

  // "quiero publicar mi app" → "Quiero publicar mi app".
  function firstUpper(v) {
    return v.replace(/^(\s*)(\p{L})/u, function (m, sp, ch) { return sp + ch.toUpperCase(); });
  }

  // Versión en vivo: mismo largo (el cursor no se mueve) y la palabra que se está escribiendo no se
  // pasa a partícula hasta terminarla ("De" → "de" al poner espacio; así "Delia" no parpadea).
  function titleLive(v) {
    var out = v.replace(/\S+/g, function (w, at) {
      var l = w.toLowerCase(), first = !v.slice(0, at).trim(), done = /\s/.test(v.charAt(at + w.length));
      if (!first && done && PARTICLES.indexOf(l) !== -1) return l;
      return l.replace(/(^|[-'’])(\p{L})/gu, function (m, a, b) { return a + b.toUpperCase(); });
    });
    return out.length === v.length ? out : v; // letras raras que cambian de largo: no se toca
  }

  function shake(el) {
    if (!el) return;
    el.classList.remove('shake');
    void el.offsetWidth;
    el.classList.add('shake');
  }

  function groupDigits(d) {
    var sizes = { 8: [4, 4], 9: [3, 3, 3], 10: [3, 3, 4], 11: [3, 4, 4] }[d.length];
    if (!sizes) return d.replace(/(\d{3})(?=\d)/g, '$1 ');
    var out = [];
    sizes.forEach(function (n) { out.push(d.slice(0, n)); d = d.slice(n); });
    return out.join(' ');
  }

  // Pista del país mientras escribe; el error solo si ya se pasó, empieza mal o salió del campo.
  function phoneFeedback(card, strict) {
    var ok = card.querySelector('[data-f=whatsapp] .ok');
    var res = phoneSplit(card.querySelector('[data-k=whatsapp]').value);
    ok.hidden = !res.pretty;
    fieldError(card, 'whatsapp', res.error && !res.empty && (strict || !res.short) ? res.error : '');
    return res;
  }

  function fieldError(card, name, message) {
    var box = card.querySelector('[data-f=' + name + ']');
    if (!box) return false;
    box.querySelector('.err').textContent = message || '';
    box.classList.toggle('bad', !!message);
    return !!message;
  }

  function checkCallForm(card) {
    var value = function (name) { return card.querySelector('[data-k=' + name + ']').value.trim(); };
    var bad = [];
    var nameEl = card.querySelector('[data-k=name]');
    nameEl.value = titleName(nameEl.value);
    if (fieldError(card, 'name', /\p{L}.*\p{L}/u.test(value('name')) ? '' : 'Escribe tu nombre.')) bad.push('name');
    var phone = phoneSplit(value('whatsapp'));
    phoneFeedback(card, true);
    if (phone.error) { fieldError(card, 'whatsapp', phone.error); bad.push('whatsapp'); }
    if (fieldError(card, 'project', value('project').length >= 3 ? '' : 'Cuéntame en pocas palabras de qué quieres hablar.')) bad.push('project');
    bad.forEach(function (key) { shake(card.querySelector('[data-f=' + key + ']')); });
    if (bad.length) card.querySelector('[data-k=' + bad[0] + ']').focus();
    return !bad.length;
  }

  function submitCall(card) {
    var field = function (name) { return card.querySelector('[data-k=' + name + ']'); };
    var error = card.querySelector('.error');
    var submit = card.querySelector('.main');
    var label = submit.textContent;
    submit.disabled = true;
    submit.innerHTML = '<span class="spin" aria-hidden="true"></span>Agendando…';
    error.hidden = true;
    var slotId = card.querySelector('[name=slot]:checked').value;
    var info = { name: titleName(field('name').value), phone: phoneSplit(field('whatsapp').value).pretty, slot: (card._slots || {})[slotId] || {} };

    fetch(base + '/api/call-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        session_id: state.session,
        name: field('name').value.trim(),
        whatsapp: '+' + phoneSplit(field('whatsapp').value).digits, // ya validado y normalizado
        project: firstUpper(field('project').value.trim()),
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
            // Error de un campo: se muestra bajo ese campo.
            if (first && fieldError(card, first, errors[first][0])) {
              shake(card.querySelector('[data-f=' + first + ']'));
              card.querySelector('[data-k=' + first + ']').focus();
              throw new Error('');
            }
            throw new Error(first ? errors[first][0] : 'No se pudo agendar. Intenta de nuevo.');
          }
          return body;
        });
      })
      .then(function (body) {
        card.remove();
        var booked = { name: info.name, phone: info.phone, when: info.slot.text || '', start: info.slot.start, end: info.slot.end, now: info.slot.now };
        bookedCard(booked);
        var thanks = '¡Gracias, ' + info.name.split(' ')[0] + '! Mientras tanto, ¿te ayudo con algo más? 😊';
        bubble('bot', thanks);
        state.messages.push({ role: 'assistant', content: body.message, booked: booked }, { role: 'assistant', content: thanks });
        save();
        chime();
        if (navigator.vibrate) try { navigator.vibrate(30); } catch (e) {}
        focusInput();
      })
      .catch(function (err) {
        error.textContent = err.message;
        error.hidden = !err.message;
        submit.disabled = false;
        submit.textContent = label;
      });
  }

  // ---------- Llamada agendada: tarjeta con resumen y "agregar al calendario" ----------
  function bookedCard(b) {
    var el = document.createElement('div');
    el.className = 'booked';
    el.setAttribute('role', 'status');
    el.innerHTML = '<div class="check"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div><h3></h3><p class="sub"></p>' +
      '<div class="info"><span>📅 <b class="when"></b></span><span>📱 <b class="phone"></b></span></div>';
    el.querySelector('h3').textContent = '¡Listo, ' + String(b.name || '').split(' ')[0] + '!';
    el.querySelector('.sub').textContent = (cfg.owner || 'Te') + (cfg.owner ? ' te' : '') + ' llamará por WhatsApp';
    el.querySelector('.when').textContent = b.when;
    el.querySelector('.phone').textContent = b.phone;

    // Calendario: se arma en el navegador (sin servidor). Solo si la llamada es más adelante.
    if (b.start && b.end && !b.now && new Date(b.end) > new Date()) {
      var title = 'Llamada con ' + (cfg.owner || cfg.title) + ' por WhatsApp';
      var stamp = function (iso) { return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); };
      var google = 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(title) +
        '&dates=' + stamp(b.start) + '/' + stamp(b.end) + '&details=' + encodeURIComponent('Llamada rápida por WhatsApp.');
      var ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Cerebro//Chat//ES', 'BEGIN:VEVENT',
        'UID:' + stamp(b.start) + '-' + state.session + '@cerebro', 'DTSTAMP:' + stamp(new Date().toISOString()),
        'DTSTART:' + stamp(b.start), 'DTEND:' + stamp(b.end), 'SUMMARY:' + title,
        'BEGIN:VALARM', 'TRIGGER:-PT10M', 'ACTION:DISPLAY', 'DESCRIPTION:' + title, 'END:VALARM',
        'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
      var cal = document.createElement('div');
      cal.className = 'cal';
      cal.innerHTML = '<a class="g" target="_blank" rel="noopener">📆 Google Calendar</a><a class="i" download="llamada.ics">📆 Apple / Outlook</a>';
      cal.querySelector('.g').href = google;
      cal.querySelector('.i').href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
      el.appendChild(cal);
    }
    msgs.appendChild(el);
    toEnd();
    return el;
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
    toEnd(true); // lo que acaba de escribir siempre se ve completo
    state.messages.push({ role: 'user', content: text });
    save();
    audioCtx(); // toque del visitante: el navegador ya deja sonar
    ask(text);
  }

  function setBusy(on) {
    busy = on;
    sendBtn.disabled = on;
    typing.style.display = on ? 'flex' : 'none';
    toEnd(); // el indicador le quita alto al área de mensajes
  }

  // ---------- Sonido: sintetizado con Web Audio (0 KB, nada que descargar del servidor) ----------
  var SOUND = 'cerebro-sound', audio = null, noise = null, lastTick = 0;
  var soundOn = (function () { try { return localStorage.getItem(SOUND) !== 'off'; } catch (e) { return true; } })();

  // El navegador solo deja sonar después de un toque o tecla del visitante: se activa al enviar.
  function audioCtx() {
    if (!soundOn) return null;
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    try {
      if (!audio) audio = new Ctx();
      if (audio.state === 'suspended') audio.resume();
    } catch (e) { return null; }
    return audio;
  }

  // Tecla suave: un golpe de ruido de 25 ms filtrado, a volumen bajo y con ritmo irregular (como una persona).
  function tick() {
    var now = Date.now();
    if (document.hidden || now - lastTick < 45 + Math.random() * 90) return;
    var a = audioCtx();
    if (!a) return;
    lastTick = now;
    if (!noise) {
      noise = a.createBuffer(1, Math.floor(a.sampleRate * 0.025), a.sampleRate);
      var d = noise.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 4);
    }
    var src = a.createBufferSource(), filter = a.createBiquadFilter(), gain = a.createGain();
    src.buffer = noise;
    filter.type = 'bandpass';
    filter.frequency.value = 1800 + Math.random() * 1400;
    gain.gain.value = 0.05 + Math.random() * 0.03;
    src.connect(filter).connect(gain).connect(a.destination);
    src.start();
  }

  // Respuesta lista: dos notas suaves que suben (sobrio, se oye aunque estés en otra pestaña).
  function chime() {
    var a = audioCtx();
    if (!a) return;
    [[659.25, 0], [987.77, 0.11]].forEach(function (n) {
      var osc = a.createOscillator(), gain = a.createGain(), t = a.currentTime + n[1];
      osc.type = 'sine';
      osc.frequency.value = n[0];
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.09, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      osc.connect(gain).connect(a.destination);
      osc.start(t);
      osc.stop(t + 0.4);
    });
  }

  // Abrir: "pop" corto que sube (algo empieza). Cerrar: más bajo y descendente, casi imperceptible.
  function glide(from, to, dur, vol) {
    var a = audioCtx();
    if (!a) return;
    var osc = a.createOscillator(), gain = a.createGain(), t = a.currentTime;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(to, t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);
    osc.connect(gain).connect(a.destination);
    osc.start(t);
    osc.stop(t + dur + 0.08);
  }
  function openSound() { glide(420, 880, 0.13, 0.08); }
  function closeSound() { glide(620, 380, 0.1, 0.04); }

  function paintSound() {
    var b = $('.foot .snd');
    b.textContent = soundOn ? '🔊 Sonido' : '🔇 Sin sonido';
    b.setAttribute('aria-label', soundOn ? 'Quitar sonido' : 'Activar sonido');
  }
  paintSound();
  panel.classList.add('foot-on'); // el pie siempre está (aviso de IA + botón de sonido)
  $('.foot .snd').addEventListener('click', function () {
    soundOn = !soundOn;
    try { localStorage.setItem(SOUND, soundOn ? 'on' : 'off'); } catch (e) {}
    paintSound();
    if (soundOn) chime(); // así sabe cómo suena
  });

  // ---------- Aviso de respuesta: para quien tiene muchas pestañas y se olvida del chat ----------
  var titleTimer = null, savedTitle = '', pendingFlash = null;

  function notifyReply(el) {
    chime();
    if (!panel.classList.contains('open')) $('.fab').classList.add('unread');
    if (document.hidden) {
      pendingFlash = el; // el destello se muestra cuando vuelva a la pestaña
      if (!titleTimer) {
        savedTitle = document.title;
        var on = false;
        titleTimer = setInterval(function () {
          on = !on;
          document.title = on ? '💬 Nueva respuesta' : savedTitle;
        }, 1200);
      }
    } else {
      flash(el);
    }
  }

  function flash(el) {
    if (!el) return;
    el.classList.remove('fresh');
    void el.offsetWidth; // reinicia la animación
    el.classList.add('fresh');
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) return;
    if (titleTimer) {
      clearInterval(titleTimer);
      titleTimer = null;
      document.title = savedTitle;
    }
    if (pendingFlash && panel.classList.contains('open')) {
      flash(pendingFlash);
      pendingFlash = null;
    }
  });

  function ask(text) {
    setBusy(true);
    var reply = '', el = null, shown = 0, timer = null, caught = null;

    // Escritura progresiva: el texto llega en bloques y se muestra letra a letra (más rápido si hay mucho pendiente).
    function step() {
      timer = null;
      var left = reply.length - shown;
      if (left <= 0) {
        if (caught) caught();
        return;
      }
      shown = document.hidden ? reply.length : Math.min(reply.length, shown + Math.max(2, Math.ceil(left / 25)));
      el.innerHTML = format(reply.slice(0, shown));
      toEnd();
      tick();
      timer = setTimeout(step, 28);
    }
    function caughtUp() {
      return new Promise(function (resolve) {
        if (shown >= reply.length) return resolve();
        caught = resolve;
        if (!timer) step();
      });
    }

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
                if (!timer) step();
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
      .then(caughtUp)
      .then(function () {
        if (reply) {
          el.innerHTML = format(reply);
          notifyReply(el);
          var msg = { role: 'assistant', content: reply };
          state.messages.push(msg);
          if (wantsCallChip(reply)) {
            msg.call = true;
            callChip();
          }
          save();
        }
        setBusy(false);
        focusInput();
      });
  }
})();
