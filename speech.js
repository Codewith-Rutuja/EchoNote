
(() => {
  const startBtn = document.getElementById('startBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const stopBtn = document.getElementById('stopBtn');
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');

  const languageSel = document.getElementById('language');
  const continuousChk = document.getElementById('continuous');
  const interimChk = document.getElementById('interim');
  const autoPunctChk = document.getElementById('autoPunct');

  const waveCanvas = document.getElementById('waveCanvas');
  const liveOutput = document.getElementById('liveOutput');
  const copyLive = document.getElementById('copyLive');
  const clearLive = document.getElementById('clearLive');

  const sessionList = document.getElementById('sessionList');
  const mergeAll = document.getElementById('mergeAll');
  const downloadTxt = document.getElementById('downloadTxt');
  const downloadJson = document.getElementById('downloadJson');

  const supportNote = document.getElementById('supportNote');
  const toggleTheme = document.getElementById('toggle-theme');

  let dark = true;
  toggleTheme.addEventListener('click', () => {
    dark = !dark;
    document.documentElement.style.filter = dark ? 'none' : 'invert(1) hue-rotate(180deg)';
    toggleTheme.textContent = dark ? 'Theme' : 'Theme (Light)';
  });

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const SpeechGrammarList = window.SpeechGrammarList || window.webkitSpeechGrammarList;

  if (!SpeechRecognition) {
    supportNote.textContent = 'Speech recognition is not supported in this browser. Use Chrome or Edge.';
  }

  const ctx = waveCanvas.getContext('2d');
  let amp = 0.15, dir = 1, runningViz = false;
  function drawWave() {
    const w = waveCanvas.width = waveCanvas.clientWidth;
    const h = waveCanvas.height = waveCanvas.clientHeight;
    ctx.clearRect(0, 0, w, h);
    ctx.lineWidth = 2;
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, '#7c9cff');
    grad.addColorStop(1, '#9cf0ff');
    ctx.strokeStyle = grad;

    ctx.beginPath();
    const freq = 0.02, mid = h / 2;
    for (let x = 0; x < w; x++) {
      const y = mid + Math.sin(x * freq + Date.now() * 0.004) * (h * amp);
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
    if (runningViz) requestAnimationFrame(drawWave);
  }

  function setStatus(state, text) {
    statusDot.className = 'dot';
    if (state === 'active') statusDot.classList.add('active');
    if (state === 'paused') statusDot.classList.add('paused');
    if (state === 'error') statusDot.classList.add('error');
    statusText.textContent = text;
  }

  let recognition = null;
  let recognizing = false;
  let paused = false;
  let sessionHistory = [];

  function initRecognition() {
    if (!SpeechRecognition) return;
    recognition = new SpeechRecognition();
    recognition.lang = languageSel.value;
    recognition.continuous = continuousChk.checked;
    recognition.interimResults = interimChk.checked;
   
    if (SpeechGrammarList && autoPunctChk.checked) {
      const grammar = '#JSGF V1.0;';
      const speechRecognitionList = new SpeechGrammarList();
      speechRecognitionList.addFromString(grammar, 1);
      recognition.grammars = speechRecognitionList;
    }

    recognition.onstart = () => {
      recognizing = true;
      paused = false;
      startBtn.disabled = true;
      pauseBtn.disabled = false;
      stopBtn.disabled = false;
      setStatus('active', 'Listening…');
      runningViz = true;
      drawWave();
    };

    recognition.onresult = (event) => {
      let interimText = '';
      let finalText = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript.trim();
        const isFinal = event.results[i].isFinal;
        if (isFinal) {
          finalText += smartPunct(transcript) + ' ';
        } else {
          interimText += transcript + ' ';
        }
      }
      renderLive(finalText, interimText);
    };

    recognition.onerror = (e) => {
      setStatus('error', `Error: ${e.error}`);
      runningViz = false;
      startBtn.disabled = false;
      pauseBtn.disabled = true;
      stopBtn.disabled = true;
    };

    recognition.onend = () => {
      recognizing = false;
      runningViz = false;

      startBtn.disabled = false;
      pauseBtn.disabled = true;
      stopBtn.disabled = true;

      const text = collectLiveText();
      if (text.trim().length) {
        addSession(text);
      }
      setStatus('paused', 'Stopped');
    };
  }

  function smartPunct(text) {
    const capitalized = text.replace(/(^\s*\w|\.\s+\w|\?\s+\w|!\s+\w)/g, s => s.toUpperCase());
    if (!/[.!?]$/.test(capitalized) && capitalized.length > 8) {
      return capitalized + '.';
    }
    return capitalized;
  }

  function renderLive(finalTextAppend, interimText) {
    if (finalTextAppend) {
      const span = document.createElement('span');
      span.className = 'final';
      span.textContent = finalTextAppend;
      liveOutput.appendChild(span);
    }

    const prevInterim = liveOutput.querySelector('.interim');
    if (prevInterim) prevInterim.remove();
    if (interimText) {
      const interimSpan = document.createElement('span');
      interimSpan.className = 'interim';
      interimSpan.textContent = interimText;
      liveOutput.appendChild(interimSpan);
    }
    liveOutput.scrollTop = liveOutput.scrollHeight;
  }

  function collectLiveText() {
    const parts = [];
    liveOutput.querySelectorAll('.final').forEach(node => parts.push(node.textContent));
    return parts.join(' ').trim();
  }

  function clearLiveOutput() {
    liveOutput.innerHTML = '';
  }

  function addSession(text) {
    const item = {
      id: 'sess_' + Math.random().toString(36).slice(2, 9),
      text,
      createdAt: new Date().toISOString(),
      lang: languageSel.value
    };
    sessionHistory.unshift(item);
    renderSessions();
  }

  function renderSessions() {
    sessionList.innerHTML = '';
    sessionHistory.forEach(sess => {
      const li = document.createElement('li');
      li.className = 'session-item';
      li.innerHTML = `
        <div class="session-head">
          <div class="session-meta">
            ${new Date(sess.createdAt).toLocaleString()} • ${sess.lang}
          </div>
          <div class="session-actions">
            <button class="ghost-btn" data-act="copy" data-id="${sess.id}">Copy</button>
            <button class="ghost-btn" data-act="download" data-id="${sess.id}">Download</button>
            <button class="ghost-btn" data-act="delete" data-id="${sess.id}">Delete</button>
          </div>
        </div>
        <div class="session-text">${escapeHTML(sess.text)}</div>
      `;
      sessionList.appendChild(li);
    });
  }

  function escapeHTML(str) {
    return str.replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }
  
  startBtn.addEventListener('click', () => {
    if (!SpeechRecognition) return;
    clearLiveOutput();
    initRecognition();
    recognition.start();
  });

  pauseBtn.addEventListener('click', () => {
    if (!recognizing) return;
    paused = !paused;
    if (paused) {
      recognition.stop(); 
      setStatus('paused', 'Paused');
      pauseBtn.textContent = 'Resume';
    } else {
      initRecognition();
      recognition.start();
      setStatus('active', 'Listening…');
      pauseBtn.textContent = 'Pause';
    }
  });

  stopBtn.addEventListener('click', () => {
    if (!recognizing) return;
    recognition.stop();
  });

  languageSel.addEventListener('change', () => {
    if (recognizing) {
      recognition.stop();
      initRecognition();
      recognition.start();
    }
  });

  continuousChk.addEventListener('change', () => {
    if (recognition) recognition.continuous = continuousChk.checked;
  });
  interimChk.addEventListener('change', () => {
    if (recognition) recognition.interimResults = interimChk.checked;
  });

  autoPunctChk.addEventListener('change', () => {
  });

  copyLive.addEventListener('click', async () => {
    const text = collectLiveText();
    if (!text) return;
    await navigator.clipboard.writeText(text);
    flash(copyLive, 'Copied!');
  });

  clearLive.addEventListener('click', () => {
    clearLiveOutput();
  });

  mergeAll.addEventListener('click', () => {
    const merged = sessionHistory.map(s => s.text).join('\n\n');
    if (!merged.trim()) return;
    clearLiveOutput();
    const span = document.createElement('span');
    span.className = 'final';
    span.textContent = merged;
    liveOutput.appendChild(span);
    flash(mergeAll, 'Merged to live');
  });

  downloadTxt.addEventListener('click', () => {
    const text = collectLiveText();
    const blob = new Blob([text || ''], { type: 'text/plain' });
    downloadBlob(blob, 'echonote.txt');
  });

  downloadJson.addEventListener('click', () => {
    const payload = {
      live: collectLiveText(),
      sessions: sessionHistory
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    downloadBlob(blob, 'echonote.json');
  });

  sessionList.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;
    const id = btn.dataset.id;
    const sess = sessionHistory.find(s => s.id === id);
    if (!sess) return;

    if (act === 'copy') {
      await navigator.clipboard.writeText(sess.text);
      flash(btn, 'Copied');
    } else if (act === 'download') {
      const blob = new Blob([sess.text], { type: 'text/plain' });
      downloadBlob(blob, `echonote_${id}.txt`);
    } else if (act === 'delete') {
      sessionHistory = sessionHistory.filter(s => s.id !== id);
      renderSessions();
    }
  });

  function flash(el, msg) {
    const prev = el.textContent;
    el.textContent = msg;
    el.disabled = true;
    setTimeout(() => { el.textContent = prev; el.disabled = false; }, 900);
  }

  function downloadBlob(blob, filename) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(a.href);
    a.remove();
  }

  window.addEventListener('resize', () => {
    if (runningViz) drawWave();
  });
})();
