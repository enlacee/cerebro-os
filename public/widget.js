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

  var origin = new URL(script.src).origin;
  var cfg = {
    title: 'Asistente',
    greeting: '¡Hola! 👋 ¿En qué te puedo ayudar?',
    color: '#16a34a',
    whatsapp: '',
    contact: { label: 'WhatsApp', message: 'Hola, vengo del chat de la web 👋' },
    pay: null,
    call: null,
    topics_title: '',
    topics: [],
  };
  var ready = fetch(origin + '/api/widget')
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
    ':host{all:initial;--c:#16a34a;--bg:#fff;--fg:#111827;--muted:#6b7280;--bot:#f3f4f6;--line:#e5e7eb;' +
    'font:15px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}' +
    '@media (prefers-color-scheme:dark){:host{--bg:#111827;--fg:#f9fafb;--muted:#9ca3af;--bot:#1f2937;--line:#374151}}' +
    '*{box-sizing:border-box}' +
    '.fab{position:fixed;right:20px;bottom:20px;width:58px;height:58px;border-radius:50%;border:0;background:var(--c);color:#fff;' +
    'cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.25);font-size:26px;z-index:2147483000}' +
    '.panel{position:fixed;right:20px;bottom:90px;width:370px;height:600px;max-height:calc(100vh - 110px);display:none;flex-direction:column;' +
    'background:var(--bg);color:var(--fg);border-radius:16px;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,.3);z-index:2147483000}' +
    '.panel.open{display:flex}' +
    '.head{display:flex;align-items:center;gap:8px;padding:12px 14px;background:var(--c);color:#fff}' +
    '.head b{flex:1;font-size:16px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.head a,.head button{color:#fff;background:rgba(255,255,255,.18);border:0;border-radius:8px;padding:6px 10px;font:inherit;font-size:13px;cursor:pointer;text-decoration:none;white-space:nowrap}' +
    '.msgs{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:8px}' +
    '.m{max-width:85%;padding:9px 12px;border-radius:14px;word-wrap:break-word;white-space:normal}' +
    '.m.bot{background:var(--bot);align-self:flex-start;border-bottom-left-radius:4px}' +
    '.m.user{background:var(--c);color:#fff;align-self:flex-end;border-bottom-right-radius:4px}' +
    '.m a{color:inherit;text-decoration:underline}' +
    '.m.err{background:#fef2f2;color:#991b1b}' +
    '.welcome{display:flex;flex-direction:column;gap:8px;margin-top:4px}' +
    '.pay{display:block;padding:12px 14px;border-radius:12px;background:var(--c);color:#fff;text-decoration:none;box-shadow:0 2px 8px rgba(0,0,0,.12)}' +
    '.pay b{display:block;font-size:15px}.pay span{font-size:13px;opacity:.9}' +
    '.pay.call{background:var(--bg);color:var(--fg);border:1.5px solid var(--c);box-shadow:none;width:100%;text-align:left;font:inherit;cursor:pointer}' +
    '.card{background:var(--bot);border-radius:14px;padding:12px;display:flex;flex-direction:column;gap:10px;align-self:stretch}' +
    '.card p{margin:0;font-size:14px}' +
    '.card label{font-size:13px;color:var(--muted);display:flex;flex-direction:column;gap:4px}' +
    '.card input{flex:none;width:100%}' +
    '.card .slot{flex-direction:row;align-items:flex-start;gap:8px;font-size:14px;color:var(--fg);cursor:pointer}' +
    '.card .slot input{width:auto;margin-top:3px}.card .slot small{display:block;color:var(--muted);font-size:12px}' +
    '.card .actions{display:flex;gap:8px}' +
    '.card .actions button{flex:1;border:1px solid var(--line);border-radius:10px;padding:10px;font:inherit;cursor:pointer;background:transparent;color:var(--fg)}' +
    '.card .actions .main{background:var(--c);border-color:var(--c);color:#fff}' +
    '.card .actions button:disabled{opacity:.5;cursor:default}' +
    '.card .error{color:#dc2626;font-size:13px;margin:0}' +
    '.hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}' +
    '.callbar{padding:0 10px 8px;display:none}' +
    '.callbar button{border:1px solid var(--c);background:transparent;color:var(--fg);border-radius:999px;padding:5px 12px;font:inherit;font-size:13px;cursor:pointer}' +
    '.label{color:var(--muted);font-size:13px;margin-top:6px}' +
    '.chips{display:flex;flex-wrap:wrap;gap:6px}' +
    '.chip{border:1px solid var(--c);background:transparent;color:var(--fg);border-radius:999px;padding:7px 12px;font:inherit;font-size:14px;cursor:pointer;text-align:left}' +
    '.chip:hover{background:var(--c);color:#fff}' +
    '.typing{color:var(--muted);font-size:13px;padding:0 14px 6px;display:none}' +
    '.composer{display:flex;gap:8px;padding:10px;border-top:1px solid var(--line)}' +
    'input{flex:1;padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:var(--bg);color:var(--fg);font:inherit;min-width:0}' +
    'input:focus{outline:2px solid var(--c);border-color:transparent}' +
    '.composer button{border:0;border-radius:10px;padding:0 14px;background:var(--c);color:#fff;font:inherit;cursor:pointer}' +
    '.composer button:disabled{opacity:.5;cursor:default}' +
    '@media (max-width:480px){.panel{right:0;bottom:0;width:100vw;height:100%;max-height:100%;border-radius:0}.panel.open~.fab{display:none}}' +
    '</style>' +
    '<div class="panel" role="dialog" aria-label="Chat">' +
    '<div class="head"><b></b><a class="wa" target="_blank" rel="noopener" hidden></a>' +
    '<button class="reset" aria-label="Nueva conversación" title="Nueva conversación">↻</button>' +
    '<button class="close" aria-label="Cerrar">✕</button></div>' +
    '<div class="msgs" aria-live="polite"></div>' +
    '<div class="typing">Escribiendo…</div>' +
    '<div class="callbar"><button type="button"></button></div>' +
    '<form class="composer"><input maxlength="1000" placeholder="Escribe tu mensaje…" aria-label="Mensaje">' +
    '<button type="submit">Enviar</button></form>' +
    '</div>' +
    '<button class="fab" aria-label="Abrir chat">💬</button>';

  var $ = function (sel) { return root.querySelector(sel); };
  var panel = $('.panel'), msgs = $('.msgs'), typing = $('.typing'), form = $('.composer'), input = $('.composer input'), sendBtn = $('.composer button');

  ready.then(function () {
    host.style.setProperty('--c', cfg.color);
    $('.head b').textContent = cfg.title;
    if (cfg.whatsapp) {
      var wa = $('.wa');
      wa.textContent = '💬 ' + cfg.contact.label;
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
    $('.fab').textContent = open ? '✕' : '💬';
    if (open) {
      if (!msgs.children.length) ready.then(renderAll);
      input.focus();
    }
  }

  $('.fab').addEventListener('click', function () { toggle(!panel.classList.contains('open')); });
  $('.close').addEventListener('click', function () { toggle(false); });

  // Nueva conversación: borra el historial local y vuelve a la bienvenida.
  $('.reset').addEventListener('click', function () {
    if (busy) return;
    state = fresh();
    save();
    renderAll();
    input.focus();
  });

  function bubble(role, text, extra) {
    var el = document.createElement('div');
    el.className = 'm ' + (role === 'user' ? 'user' : 'bot') + (extra ? ' ' + extra : '');
    el.innerHTML = format(text);
    msgs.appendChild(el);
    msgs.scrollTop = msgs.scrollHeight;
    return el;
  }

  // Bienvenida: camino "quiero pagar" (WhatsApp directo) + chips de temas para el asistente.
  function welcome() {
    var box = document.createElement('div');
    box.className = 'welcome';

    if (cfg.pay && cfg.whatsapp) {
      var pay = document.createElement('a');
      pay.className = 'pay';
      pay.target = '_blank';
      pay.rel = 'noopener';
      pay.href = waLink(cfg.pay.message);
      pay.innerHTML = '<b></b><span></span>';
      pay.querySelector('b').textContent = cfg.pay.title;
      pay.querySelector('span').textContent = cfg.pay.subtitle;
      box.appendChild(pay);
    }

    if (cfg.call) {
      var call = document.createElement('button');
      call.type = 'button';
      call.className = 'pay call';
      call.innerHTML = '<b></b><span></span>';
      call.querySelector('b').textContent = cfg.call.title;
      call.querySelector('span').textContent = cfg.call.subtitle;
      call.addEventListener('click', function () { openCallForm(); });
      box.appendChild(call);
    }

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

    msgs.appendChild(box);
  }

  function renderAll() {
    msgs.innerHTML = '';
    bubble('bot', cfg.greeting);
    if (!state.messages.length) welcome();
    state.messages.forEach(function (m) { bubble(m.role, m.content); });
    updateCallbar();
  }

  // ---------- "Que Aníbal me llame": formulario dentro del chat ----------
  function openCallForm() {
    if (busy) return;
    var existing = $('.card');
    if (existing) return existing.querySelector('input').focus();
    var box = $('.welcome');
    if (box) box.remove();

    var card = document.createElement('form');
    card.className = 'card';
    card.innerHTML = '<p class="intro"></p><p class="loading">Buscando horarios…</p>';
    card.querySelector('.intro').innerHTML = format(cfg.call.intro);
    msgs.appendChild(card);
    msgs.scrollTop = msgs.scrollHeight;
    updateCallbar();

    fetch(origin + '/api/call-slots')
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

    var visitorTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    var localDay = new Intl.DateTimeFormat('es', { weekday: 'short' });
    var localTime = new Intl.DateTimeFormat('es', { hour: 'numeric', minute: '2-digit' });
    var html =
      '<label>Tu nombre<input name="name" maxlength="80" required autocomplete="name"></label>' +
      '<label>Tu WhatsApp (con código de país)<input name="whatsapp" type="tel" maxlength="25" required autocomplete="tel"></label>' +
      '<label>¿De qué es tu proyecto?<input name="project" maxlength="300" required></label>' +
      '<label class="hp" aria-hidden="true">Web<input name="website" tabindex="-1" autocomplete="off"></label>' +
      '<label>¿Cuándo te llamo?</label>';
    card.insertAdjacentHTML('beforeend', html);

    data.slots.forEach(function (slot, i) {
      var opt = document.createElement('label');
      opt.className = 'slot';
      opt.innerHTML = '<input type="radio" name="slot" required><span><b></b><small></small></span>';
      opt.querySelector('input').value = slot.id;
      opt.querySelector('input').checked = i === 0;
      opt.querySelector('b').textContent = slot.label;
      if (visitorTz !== data.timezone && !slot.now) {
        var start = new Date(slot.start), end = new Date(slot.end);
        opt.querySelector('small').textContent = 'Tu hora: ' + localDay.format(start) + ' ' + localTime.format(start) + ' – ' + localTime.format(end);
      }
      card.appendChild(opt);
    });

    card.insertAdjacentHTML('beforeend',
      '<p class="error" hidden></p>' +
      '<div class="actions"><button type="button" class="cancel">Cancelar</button>' +
      '<button type="submit" class="main">Agendar llamada</button></div>');

    card.querySelector('[name=whatsapp]').value = (cfg.call.country_code || '') + ' ';
    card.querySelector('.cancel').addEventListener('click', function () { closeCallForm(card); });
    card.addEventListener('submit', function (e) {
      e.preventDefault();
      submitCall(card);
    });
    card.querySelector('[name=name]').focus();
    msgs.scrollTop = msgs.scrollHeight;
  }

  function submitCall(card) {
    var field = function (name) { return card.querySelector('[name=' + name + ']'); };
    var error = card.querySelector('.error');
    var submit = card.querySelector('.main');
    submit.disabled = true;
    error.hidden = true;

    fetch(origin + '/api/call-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        session_id: state.session,
        name: field('name').value.trim(),
        whatsapp: field('whatsapp').value.trim(),
        project: field('project').value.trim(),
        slot: card.querySelector('[name=slot]:checked').value,
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

    fetch(origin + '/api/chat', {
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
