(function (window, document) {
  'use strict';
  const scriptUrl = document.currentScript?.src || document.baseURI;
  const defaultQuestions = [
    '最近首都经济贸易大学有哪些教育合作事件？',
    '北京和雄安新区近期有哪些合作？',
    '2026年京津冀有哪些教育协同事件？',
    '北京近十年教育发展指数变化情况？',
    '分析一下最近协同度变化趋势。'
  ];
  const demoRequest = ({ question }) => new Promise(resolve => setTimeout(() => resolve({
    answer: `已收到“${question}”。目前是交互演示；接入智能体接口后，这里会显示基于平台数据的回答。`, sources: ['演示模式']
  }), 650));

  function mount(options = {}) {
    const config = {
      title: '京津冀教育协同总助手', greeting: '你好，我是京津冀教育协同总助手。想了解哪些协同动态？',
      questions: defaultQuestions, request: demoRequest, getPageContext: () => ({}), onAction: () => {}, onNewChat: () => {}, ...options
    };
    const assetBase = config.assetBase || new URL('./assets/', scriptUrl).href;
    const image = state => assetBase + ({ idle: 'assistant-mascot-v2.png', hover: 'assistant-hover-v2.png', thinking: 'assistant-thinking-v2.png' }[state]);
    const root = document.createElement('div');
    root.className = 'jjj-assistant';
    root.innerHTML = `<button class="jjj-launcher" type="button" aria-label="打开智能助手" aria-expanded="false"><span class="jjj-avatar"><img data-launcher-image alt="" draggable="false"></span></button>
      <section class="jjj-window" role="dialog" aria-label="智能助手" hidden>
        <header class="jjj-header"><span class="jjj-header-avatar"><img data-header-image alt="" draggable="false"></span><span class="jjj-header-copy"><strong></strong><small><i></i><span data-status>随时为你解答</span></small></span><button class="jjj-mode" type="button" hidden></button><button class="jjj-new-chat" type="button" aria-label="开始新对话">新对话</button><button class="jjj-minimize" type="button" aria-label="收起助手">−</button></header>
        <div class="jjj-content"><div class="jjj-intro"><span>✦</span><p></p></div><div class="jjj-suggestions"><div class="jjj-section-title">你可以这样问 <span>✦</span></div><div class="jjj-suggestion-list"></div></div><div class="jjj-messages" role="log" aria-live="polite"></div></div>
        <form class="jjj-compose"><input aria-label="输入问题" placeholder="输入你想了解的问题…" maxlength="500" autocomplete="off"><button type="submit" aria-label="发送问题">➤</button></form><div class="jjj-footer">京津冀教育协同发展监测平台 · 智能助手</div><iframe class="jjj-web-frame" title="FastGPT 网页对话" referrerpolicy="no-referrer" allow="clipboard-write" hidden></iframe>
      </section>`;
    document.body.appendChild(root);
    const q = selector => root.querySelector(selector);
    const launcher = q('.jjj-launcher'), panel = q('.jjj-window'), messages = q('.jjj-messages');
    messages.style.display = 'flex';
    messages.style.flexDirection = 'column';
    const input = q('.jjj-compose input'), sendButton = q('.jjj-compose button');
    q('[data-launcher-image]').src = image('idle'); q('[data-header-image]').src = image('idle');
    ['hover', 'thinking'].forEach(state => { const preload = new window.Image(); preload.src = image(state); });
    q('.jjj-header-copy strong').textContent = config.title; q('.jjj-intro p').textContent = config.greeting;
    let opened = false, busy = false, hovered = false, saved = null;
    let webMode = !!config.webUrl && config.initialMode === 'web';
    const modeButton = q('.jjj-mode'), webFrame = q('.jjj-web-frame');
    function setMode(value) {
      webMode = value;
      root.classList.toggle('jjj-web-mode', webMode);
      modeButton.textContent = webMode ? '站内对话' : '网页对话';
      q('.jjj-new-chat').hidden = webMode;
      webFrame.hidden = !webMode;
      if (webMode && opened && !webFrame.src) webFrame.src = config.webUrl;
      q('[data-status]').textContent = webMode ? 'FastGPT 网页对话' : '随时为你解答';
    }
    if (config.webUrl) { if (config.allowSiteMode !== false) { modeButton.hidden = false; modeButton.addEventListener('click', () => setMode(!webMode)); } setMode(webMode); }
    function updateLauncherImage() { q('[data-launcher-image]').src = image(busy ? 'thinking' : hovered ? 'hover' : 'idle'); }
    try { saved = JSON.parse(localStorage.getItem('jjj-assistant-position')); } catch (_) {}
    const clamp = (n, min, max) => Math.min(Math.max(n, min), max);
    function place(x, y, persist) {
      const left = clamp(x, 8, Math.max(8, innerWidth - launcher.offsetWidth - 8));
      const top = clamp(y, 8, Math.max(8, innerHeight - launcher.offsetHeight - 8));
      root.style.left = left + 'px'; root.style.top = top + 'px';
      root.classList.toggle('jjj-open-left', left > innerWidth / 2);
      const panelHeight = Math.min(570, innerHeight - 24);
      const desiredTop = top > innerHeight / 2 ? top + launcher.offsetHeight - panelHeight : top;
      panel.style.top = (clamp(desiredTop, 12, Math.max(12, innerHeight - panelHeight - 12)) - top) + 'px';
      if (persist) try { localStorage.setItem('jjj-assistant-position', JSON.stringify({ x: left / innerWidth, y: top / innerHeight })); } catch (_) {}
    }
    function restore() {
      const x = Number.isFinite(saved?.x) ? saved.x * innerWidth : innerWidth - launcher.offsetWidth - 24;
      const y = Number.isFinite(saved?.y) ? saved.y * innerHeight : innerHeight - launcher.offsetHeight - 24;
      place(x, y);
    }
    restore(); addEventListener('resize', restore);
    function setOpen(value) {
      opened = value; panel.hidden = !value; launcher.setAttribute('aria-expanded', String(value));
      if (value && webMode && !webFrame.src) webFrame.src = config.webUrl;
      updateLauncherImage();
      if (value && !webMode) input.focus(); else if (!value) launcher.focus();
    }
    const drag = { active: false, moved: false };
    launcher.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      Object.assign(drag, { active: true, moved: false, x: e.clientX, y: e.clientY, left: root.offsetLeft, top: root.offsetTop });
      launcher.setPointerCapture(e.pointerId);
    });
    launcher.addEventListener('pointermove', e => {
      if (!drag.active) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 6) drag.moved = true;
      if (drag.moved) { root.classList.add('jjj-dragging'); place(drag.left + dx, drag.top + dy); }
    });
    function endDrag() {
      if (!drag.active) return;
      drag.active = false; root.classList.remove('jjj-dragging');
      if (drag.moved) { saved = { x: root.offsetLeft / innerWidth, y: root.offsetTop / innerHeight }; place(root.offsetLeft, root.offsetTop, true); }
    }
    launcher.addEventListener('pointerup', endDrag); launcher.addEventListener('pointercancel', endDrag);
    launcher.addEventListener('click', () => { if (drag.moved) { drag.moved = false; return; } setOpen(!opened); });
    launcher.addEventListener('mouseenter', () => { hovered = true; updateLauncherImage(); });
    launcher.addEventListener('mouseleave', () => { hovered = false; updateLauncherImage(); });
    q('.jjj-minimize').addEventListener('click', () => setOpen(false));
    function newChat() {
      if (busy) return;
      config.onNewChat();
      messages.replaceChildren();
      q('.jjj-suggestions').hidden = false;
      input.value = '';
      input.focus();
    }
    q('.jjj-new-chat').addEventListener('click', newChat);
    root.addEventListener('keydown', e => { if (e.key === 'Escape' && opened) setOpen(false); });
    function addMessage(kind, value) {
      const row = document.createElement('div'); row.className = 'jjj-message jjj-' + kind.replace('assistant', 'response');
      row.style.alignSelf = kind === 'user' ? 'flex-end' : 'flex-start';
      if (kind.startsWith('assistant')) { row.style.background = '#144d72'; row.style.borderBottomLeftRadius = '4px'; }
      const text = document.createElement('div'); text.textContent = value; row.appendChild(text);
      messages.appendChild(row); row.scrollIntoView({ block: 'nearest' }); return row;
    }
    async function send(question) {
      const value = String(question || '').trim(); if (!value || busy) return;
      q('.jjj-suggestions').hidden = true; addMessage('user', value); input.value = '';
      busy = true; input.disabled = true; sendButton.disabled = true;
      updateLauncherImage();
      q('[data-status]').textContent = '正在思考…'; q('[data-header-image]').src = image('thinking');
      const pending = addMessage('assistant jjj-waiting', '正在整理回答…');
      try {
        const reply = await config.request({ question: value, context: config.getPageContext() });
        pending.remove(); const row = addMessage('assistant', reply?.answer || '暂时没有找到相关信息。');
        if (reply?.sources?.length) { const source = document.createElement('small'); source.textContent = '来源：' + reply.sources.join('、'); row.appendChild(source); }
        if (reply?.actions?.length) {
          const actions = document.createElement('div'); actions.className = 'jjj-actions';
          reply.actions.forEach(action => { const button = document.createElement('button'); button.type = 'button'; button.textContent = action.label; button.onclick = () => config.onAction(action); actions.appendChild(button); }); row.appendChild(actions);
        }
        if (reply?.retryable) {
          const retry = document.createElement('button');
          retry.type = 'button'; retry.className = 'jjj-retry'; retry.textContent = '新对话中重新检索';
          retry.addEventListener('click', () => { newChat(); send(value); });
          row.appendChild(retry);
        }
      } catch (error) { pending.textContent = error?.message || '连接暂时不可用，请稍后重试。'; console.error('[JJJ Assistant]', error); }
      finally { busy = false; input.disabled = false; sendButton.disabled = false; q('[data-status]').textContent = webMode ? 'FastGPT 网页对话' : '随时为你解答'; q('[data-header-image]').src = image('idle'); updateLauncherImage(); if (!webMode) input.focus(); }
    }
    config.questions.forEach((question, index) => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'jjj-suggestion';
      const n = document.createElement('span'); n.textContent = String(index + 1).padStart(2, '0');
      const label = document.createElement('span'); label.textContent = question;
      const arrow = document.createElement('span'); arrow.textContent = '↗'; arrow.setAttribute('aria-hidden', 'true');
      button.append(n, label, arrow); button.onclick = () => send(question); q('.jjj-suggestion-list').appendChild(button);
    });
    q('.jjj-compose').addEventListener('submit', e => { e.preventDefault(); send(input.value); });
    return { open: () => setOpen(true), close: () => setOpen(false), newChat, ask: question => { setOpen(true); return send(question); }, destroy: () => { removeEventListener('resize', restore); root.remove(); } };
  }
  window.JJJAssistant = { mount };
})(window, document);
