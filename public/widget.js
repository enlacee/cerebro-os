/*!
 * Cerebro OS — widget de chat embebible.
 *
 * Uso:
 *   <script src="https://chat.tudominio.com/widget.js"
 *           data-title="Aníbal Linux"
 *           data-whatsapp="51970142637"
 *           data-greeting="¡Hola! 👋 ¿En qué te ayudo?"
 *           data-color="#16a34a" defer></script>
 */
(function () {
  'use strict';

  var script = document.currentScript;
  if (!script || window.__cerebroWidget) return;
  window.__cerebroWidget = true;

  var cfg = {
    api: new URL(script.src).origin + '/api/chat',
    title: script.dataset.title || 'Asistente',
    whatsapp: (script.dataset.whatsapp || '').replace(/\D/g, ''),
    greeting: script.dataset.greeting || '¡Hola! 👋 ¿En qué te puedo ayudar?',
    color: script.dataset.color || '#16a34a',
  };

  var STORE = 'cerebro-chat';
  var state = load();
  var busy = false;

  // ---------- almacenamiento (puede fallar en modo privado) ----------
  function load() {
    try {
      var saved = JSON.parse(localStorage.getItem(STORE));
      if (saved && saved.session) return saved;
    } catch (e) {}
    return { session: uuid(), messages: [] };
  }

  function save() {
    try {
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
    ':host{all:initial;--c:' + cfg.color + ';--bg:#fff;--fg:#111827;--muted:#6b7280;--bot:#f3f4f6;--line:#e5e7eb;' +
    'font:15px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}' +
    '@media (prefers-color-scheme:dark){:host{--bg:#111827;--fg:#f9fafb;--muted:#9ca3af;--bot:#1f2937;--line:#374151}}' +
    '*{box-sizing:border-box}' +
    '.fab{position:fixed;right:20px;bottom:20px;width:58px;height:58px;border-radius:50%;border:0;background:var(--c);color:#fff;' +
    'cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.25);font-size:26px;z-index:2147483000}' +
    '.panel{position:fixed;right:20px;bottom:90px;width:370px;height:560px;max-height:calc(100vh - 110px);display:none;flex-direction:column;' +
    'background:var(--bg);color:var(--fg);border-radius:16px;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,.3);z-index:2147483000}' +
    '.panel.open{display:flex}' +
    '.head{display:flex;align-items:center;gap:8px;padding:12px 14px;background:var(--c);color:#fff}' +
    '.head b{flex:1;font-size:16px}' +
    '.head a,.head button{color:#fff;background:rgba(255,255,255,.18);border:0;border-radius:8px;padding:6px 10px;font:inherit;font-size:13px;cursor:pointer;text-decoration:none}' +
    '.msgs{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:8px}' +
    '.m{max-width:85%;padding:9px 12px;border-radius:14px;word-wrap:break-word;white-space:normal}' +
    '.m.bot{background:var(--bot);align-self:flex-start;border-bottom-left-radius:4px}' +
    '.m.user{background:var(--c);color:#fff;align-self:flex-end;border-bottom-right-radius:4px}' +
    '.m a{color:inherit;text-decoration:underline}' +
    '.m.err{background:#fef2f2;color:#991b1b}' +
    '.typing{color:var(--muted);font-size:13px;padding:0 14px 6px;display:none}' +
    'form{display:flex;gap:8px;padding:10px;border-top:1px solid var(--line)}' +
    'input{flex:1;padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:var(--bg);color:var(--fg);font:inherit;min-width:0}' +
    'input:focus{outline:2px solid var(--c);border-color:transparent}' +
    'form button{border:0;border-radius:10px;padding:0 14px;background:var(--c);color:#fff;font:inherit;cursor:pointer}' +
    'form button:disabled{opacity:.5;cursor:default}' +
    '@media (max-width:480px){.panel{right:0;bottom:0;width:100vw;height:100%;max-height:100%;border-radius:0}}' +
    '</style>' +
    '<div class="panel" role="dialog" aria-label="Chat">' +
    '<div class="head"><b></b>' +
    (cfg.whatsapp ? '<a class="wa" target="_blank" rel="noopener">WhatsApp</a>' : '') +
    '<button class="close" aria-label="Cerrar">✕</button></div>' +
    '<div class="msgs" aria-live="polite"></div>' +
    '<div class="typing">Escribiendo…</div>' +
    '<form><input maxlength="1000" placeholder="Escribe tu mensaje…" aria-label="Mensaje">' +
    '<button type="submit">Enviar</button></form>' +
    '</div>' +
    '<button class="fab" aria-label="Abrir chat">💬</button>';

  var $ = function (sel) { return root.querySelector(sel); };
  var panel = $('.panel'), msgs = $('.msgs'), typing = $('.typing'), form = $('form'), input = $('input'), sendBtn = $('form button');

  $('.head b').textContent = cfg.title;
  if (cfg.whatsapp) {
    $('.wa').href = 'https://wa.me/' + cfg.whatsapp + '?text=' +
      encodeURIComponent('Hola, vengo del chat de la web 👋');
  }

  function toggle(open) {
    panel.classList.toggle('open', open);
    $('.fab').textContent = open ? '✕' : '💬';
    if (open) {
      if (!msgs.children.length) renderAll();
      input.focus();
    }
  }

  $('.fab').addEventListener('click', function () { toggle(!panel.classList.contains('open')); });
  $('.close').addEventListener('click', function () { toggle(false); });

  function bubble(role, text, extra) {
    var el = document.createElement('div');
    el.className = 'm ' + (role === 'user' ? 'user' : 'bot') + (extra ? ' ' + extra : '');
    el.innerHTML = format(text);
    msgs.appendChild(el);
    msgs.scrollTop = msgs.scrollHeight;
    return el;
  }

  function renderAll() {
    msgs.innerHTML = '';
    bubble('bot', cfg.greeting);
    state.messages.forEach(function (m) { bubble(m.role, m.content); });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var text = input.value.trim();
    if (!text || busy) return;
    input.value = '';
    bubble('user', text);
    state.messages.push({ role: 'user', content: text });
    save();
    ask(text);
  });

  function setBusy(on) {
    busy = on;
    sendBtn.disabled = on;
    typing.style.display = on ? 'block' : 'none';
  }

  function ask(text) {
    setBusy(true);
    var reply = '', el = null;

    fetch(cfg.api, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify({ session_id: state.session, message: text }),
    })
      .then(function (res) {
        if (res.status === 429) throw new Error('Estás enviando muchos mensajes. Espera un momento 🙏');
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
        input.focus();
      });
  }
})();
