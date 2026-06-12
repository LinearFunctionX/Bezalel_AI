// EXAM PREP STUDIO (RESTORATION + FIXED FEATURES)

let appState = {
  currentStep: 1,
  material: { text: '', files: [], images: [], urls: [] },
  selectedFormat: null,
  quizData: { score: 0, total: 0, answered: 0, history: [] },
  gameType: 'quiz',
  language: 'Spanish',
  flashcardMode: 'qa'
};

// --- SOUND ENGINE ---
const Sound = {
  ctx: new (window.AudioContext || window.webkitAudioContext)(),
  play(f, t, d, v = 0.3) {
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
    o.type = t; o.frequency.setValueAtTime(f, this.ctx.currentTime);
    g.gain.setValueAtTime(v, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + d);
    o.connect(g); g.connect(this.ctx.destination);
    o.start(); o.stop(this.ctx.currentTime + d);
  },
  click() { this.play(800, 'sine', 0.1, 0.15); },
  success() { this.play(1200, 'sine', 0.4, 0.3); },
  error() { this.play(150, 'square', 0.3, 0.2); },
  transition() { this.play(500, 'triangle', 0.4, 0.1); }
};

// --- NAVIGATION ---
function goStep(n) {
  Sound.transition();
  document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(`step${n}`);
  if(target) target.classList.add('active');
  appState.currentStep = n;
  updateStepIndicators();
}

function goStep2() {
  const material = document.getElementById('materialInput').value.trim();
  if (material || appState.material.files.length || appState.material.images.length || appState.material.urls.length) {
    appState.material.text = material;
    goStep(2);
  } else {
    Sound.error();
    showToast('ADD CONTENT FIRST');
  }
}

function updateStepIndicators() {
  const dots = document.querySelectorAll('.dot');
  dots.forEach((dot, i) => {
    dot.classList.toggle('active', i + 1 === appState.currentStep);
    dot.classList.toggle('done', i + 1 < appState.currentStep);
  });
}

function toggleInputType(type, btn) {
  Sound.click();
  document.querySelectorAll('.itype-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.input-block').forEach(b => b.classList.remove('show'));
  btn.classList.add('active');
  const block = document.getElementById(`iblock-${type}`);
  if(block) block.classList.add('show');
}

// --- FILE & IMAGE HANDLING ---
function handleFileSelect(e) {
  const file = e.target.files[0]; if (!file) return;
  const preview = document.getElementById('filePreview');
  preview.innerHTML = '<div class="file-chip"><div class="yellow-spinner"></div> ANALYZING DOCUMENT...</div>';

  fetch('http://localhost:8080/upload', { method: 'POST', body: file })
    .then(r => r.json()).then(data => {
        if (data.error) throw new Error(data.error);
        appState.material.files = [{ name: file.name, content: data.file_text }];
        renderFiles();
        showToast('DOCUMENT READY');
    }).catch(err => {
        console.error(err);
        preview.innerHTML = '';
        showToast('ERROR READING FILE');
    });
}

function renderFiles() {
  const preview = document.getElementById('filePreview');
  preview.innerHTML = appState.material.files.map((f, i) => 
    `<div class="file-chip">📄 ${f.name} <span onclick="removeFile(${i})" style="margin-left:8px; cursor:pointer; color:var(--muted2); font-weight:bold">✕</span></div>`
  ).join('');
}

function removeFile(idx) {
  appState.material.files.splice(idx, 1);
  renderFiles();
  showToast('FILE REMOVED');
}

function handleImgSelect(e) {
    const file = e.target ? e.target.files[0] : e[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        document.getElementById('imgPreview').src = ev.target.result;
        document.getElementById('imgPreviewWrap').style.display = 'block';
        appState.material.images = [ev.target.result];
        showToast('IMAGE READY');
    };
    reader.readAsDataURL(file);
}

async function saveUrl() {
    const input = document.getElementById('urlInput');
    const url = input.value.trim();
    if (!url) return;
    const ok = document.getElementById('urlOk');
    ok.innerHTML = '<div class="yellow-spinner"></div> EXTRACTING...';
    ok.style.display = 'block';
    try {
        const response = await fetch(`http://localhost:8080/fetch-url?url=${encodeURIComponent(url)}`);
        const data = await response.json();
        appState.material.urls.push({ title: data.title || 'Website', content: data.text });
        renderUrls();
        input.value = '';
        showToast('LINK ADDED');
    } catch (e) {
        ok.textContent = '❌ ERROR';
        showToast('COULD NOT FETCH');
    }
}

function renderUrls() {
  const ok = document.getElementById('urlOk');
  ok.innerHTML = appState.material.urls.map((u, i) => 
    `<div style="margin-bottom:4px; font-size:0.75rem; color:var(--green)">✅ ${u.title} <span onclick="removeUrl(${i})" style="margin-left:6px; cursor:pointer; color:var(--muted2); font-weight:bold">✕</span></div>`
  ).join('');
  ok.style.display = appState.material.urls.length ? 'block' : 'none';
}

function removeUrl(idx) {
  appState.material.urls.splice(idx, 1);
  renderUrls();
  showToast('LINK REMOVED');
}

function handleImgDrop(e) { e.preventDefault(); e.stopPropagation(); handleImgSelect(e.dataTransfer.files); }
function handleFileDrop(e) { e.preventDefault(); e.stopPropagation(); handleFileSelect({ target: { files: e.dataTransfer.files } }); }
function clearImg() { document.getElementById('imgPreviewWrap').style.display = 'none'; appState.material.images = []; }

// --- GENERATION ---
async function generate() {
  Sound.transition();
  appState.material.text = document.getElementById('materialInput').value.trim();
  const resArea = document.getElementById('resultArea');

  resArea.innerHTML = `
    <div class="quantum-loader">
      <div class="q-ring"></div>
      <div style="font-family:'Bebas Neue'; font-size:1.5rem; margin-top:1.5rem; color:var(--accent); letter-spacing:2px">AI IS THINKING</div>
    </div>`;
  goStep(3);

  try {
    const payload = { prompt: buildPrompt(), images: appState.material.images };
    const response = await fetch('http://localhost:8080/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (data.error) throw new Error(data.error);
    resArea.innerHTML = formatResponse(data.response);
  } catch (e) {
    resArea.innerHTML = `<div style="color:red;padding:2rem">ERROR: ${e.message}</div>`;
  }
}

function buildPrompt() {
  const f = appState.selectedFormat;
  let p = `You are an expert study assistant. Generate ${f.toUpperCase()} based on the provided content.
STRICT RULES:
1. NO introductory text, NO headers, NO conclusions.
2. ONLY output the raw data in the exact format specified below.
3. NO bolding (**).
4. Language: Use the same language as the input content (unless the format is TRANSLATION, then use ${appState.language}).

FORMATS:
- If flashcards:
Front: [question]
Back: [answer]

- If quiz:
Question | Option 1 | Option 2 | Option 3 | Option 4 | CorrectNum(1-4)
(One question per line. CorrectNum must be ONLY the number 1, 2, 3, or 4)

- If notes/research/timeline:
Use clean, structured text with line breaks for readability.

CONTENT:
${appState.material.text}
${appState.material.files.map(f => f.content).join('\n')}
${appState.material.urls.map(u => u.content).join('\n')}`;  
  return p;
}

function formatResponse(text) {
  const f = appState.selectedFormat;
  const clean = text.replace(/\*\*/g, '').trim();
  let html = `<div class="card-result"><div class="card-header">${f.toUpperCase()}</div><div style="padding:1.5rem">`;

  if (f === 'flashcards') {
      const lines = clean.split('\n').map(l => l.trim()).filter(l => l !== '');
      let curF = '';
      for (let l of lines) {
          if (/^front:/i.test(l)) curF = l.replace(/^front:/i, '').trim();
          else if (/^back:/i.test(l) && curF) {
              html += `<div class="flashcard-3d" onclick="this.classList.toggle('flipped'); Sound.click();">
                  <div class="fc-inner">
                    <div class="fc-front"><span>${escapeHtml(curF)}</span></div>
                    <div class="fc-back"><span>${escapeHtml(l.replace(/^back:/i, '').trim())}</span></div>
                  </div>
                </div>`;
              curF = '';
          }
      }
      if (html.endsWith('<div style="padding:1.5rem">')) {
          html += `<div style="color:var(--muted2)">No flashcards could be parsed. Check the input content.</div>`;
      }
  } else if (f === 'quiz') {
      appState.quizData.total = 0;
      appState.quizData.score = 0;
      appState.quizData.answered = 0;
      appState.quizData.history = [];

      const lines = clean.split('\n').filter(l => l.includes('|'));
      lines.forEach((line) => {
          const p = line.split('|').map(s => s.trim());
          if(p.length >= 6) {
              const correctIdx = parseInt(p[5]);
              if (isNaN(correctIdx) || correctIdx < 1 || correctIdx > 4) return;
              
              appState.quizData.total++;
              html += `<div class="quiz-q-block" style="margin-bottom:2rem"><p style="font-weight:bold;margin-bottom:1rem">Q${appState.quizData.total}: ${escapeHtml(p[0])}</p>`;
              for(let j=1; j<=4; j++) {
                const isCorrect = (j == correctIdx);
                const qText = p[0].replace(/'/g, "\\'");
                const oText = p[j].replace(/'/g, "\\'");
                const cText = p[correctIdx].replace(/'/g, "\\'");
                
                html += `<button class="quiz-btn-thematic q-opt-btn" style="display:block;width:100%;text-align:left;padding:1rem;margin-bottom:.5rem;background:var(--surface2);border:1px solid var(--border);color:#fff;border-radius:8px;cursor:pointer" onclick="checkAnswer(this, ${isCorrect}, '${qText}', '${oText}', '${cText}')">${escapeHtml(p[j])}</button>`;
              }
              html += '</div>';
          }
      });
      if (appState.quizData.total === 0) {
          html += `<div style="color:var(--muted2)">No quiz questions could be parsed. Check the input content.</div>`;
      }
  } else {
      html += `<div style="white-space:pre-wrap;line-height:1.7;color:#ccc">${escapeHtml(clean)}</div>`;
  }
  return html + '</div></div>';
}

function checkAnswer(btn, isCorrect, q, u, c) {
  const block = btn.parentElement;
  if (block.classList.contains('answered')) return;
  block.classList.add('answered');
  
  appState.quizData.answered++;
  if (isCorrect) {
    appState.quizData.score++;
    btn.style.background = 'var(--green)';
    btn.style.color = '#000';
    Sound.success();
  } else {
    btn.style.background = 'var(--accent2)';
    btn.style.color = '#fff';
    Sound.error();
  }
  
  appState.quizData.history.push({ q, u, c, isCorrect });
  
  if (appState.quizData.answered === appState.quizData.total) {
    setTimeout(showReport, 800);
  }
}

function showReport() {
  const area = document.getElementById('reportArea');
  const percent = Math.round((appState.quizData.score / appState.quizData.total) * 100);
  
  let grade = 'F';
  let msg = 'Keep studying!';
  if (percent >= 90) { grade = 'A'; msg = 'Excellent work!'; }
  else if (percent >= 80) { grade = 'B'; msg = 'Great job!'; }
  else if (percent >= 70) { grade = 'C'; msg = 'Good effort!'; }
  else if (percent >= 60) { grade = 'D'; msg = 'You can do better!'; }

  area.innerHTML = `
    <div class="report-card-full">
      <div class="report-lbl">Final Score</div>
      <div class="report-grade">${percent}%</div>
      <div class="report-msg">${msg}</div>
      
      <div class="report-grid">
        <div class="report-item">
          <div class="report-val">${appState.quizData.score}/${appState.quizData.total}</div>
          <div class="report-lbl">Correct</div>
        </div>
        <div class="report-item">
          <div class="report-val">${grade}</div>
          <div class="report-lbl">Grade</div>
        </div>
        <div class="report-item">
          <div class="report-val">${appState.quizData.total}</div>
          <div class="report-lbl">Questions</div>
        </div>
      </div>

      <div class="history-list" style="text-align:left; margin-top:2rem; border-top:1px solid var(--border); padding-top:1rem;">
        ${appState.quizData.history.map(item => `
          <div class="history-item" style="padding:0.8rem 0; border-bottom:1px solid rgba(255,255,255,0.05);">
            <div style="font-weight:500; margin-bottom:0.3rem;">${escapeHtml(item.q)}</div>
            <div style="font-size:0.85rem; color:${item.isCorrect ? 'var(--green)' : 'var(--accent2)'}">
              ${item.isCorrect ? '✓ Correct' : '✕ Wrong (Answer: ' + escapeHtml(item.c) + ')'}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  goStep(4);
}

function initStep2() {
    const LIST = {
        classic: [{id:'flashcards', name:'FLASHCARDS', desc:'3D study deck'}, {id:'quiz', name:'QUIZ', desc:'Scored test'}, {id:'notes', name:'NOTES', desc:'Summary'}],
        analysis: [{id:'research', name:'RESEARCH', desc:'Analysis'}, {id:'timeline', name:'TIMELINE', desc:'History'}],
        interactive: [{id:'game', name:'GAME', desc:'Study game'}, {id:'translation', name:'TRANSLATE', desc:'Translate'}]
    };
    Object.keys(LIST).forEach(id => {
        const g = document.getElementById('grid-' + id);
        if(g) g.innerHTML = LIST[id].map(item => `
          <div class="opt-card" onclick="selectOption('${item.id}', this); Sound.click();">
            <div class="opt-body"><div class="opt-name">${item.name}</div><div class="opt-desc">${item.desc}</div></div>
          </div>`).join('');
    });
}

function selectOption(id, el) {
  document.querySelectorAll('.opt-card').forEach(c => c.classList.remove('sel'));
  el.classList.add('sel');
  appState.selectedFormat = id;
  document.getElementById('genBtn').disabled = false;
  const gs=document.getElementById('gameSel'); if(gs) gs.style.display=id==='game'?'block':'none';
  const ls=document.getElementById('langSel'); if(ls) ls.style.display=id==='translation'?'block':'none';
  const fs=document.getElementById('flashSel'); if(fs) fs.style.display=id==='flashcards'?'block':'none';
}

function showToast(m) { const t=document.getElementById('toast'); if(t){ t.textContent=m; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),2000); } }
function escapeHtml(t) { const d=document.createElement('div'); d.textContent=t; return d.innerHTML; }
function openShare() { Sound.click(); document.getElementById('shareModal').classList.add('open'); }
function closeShare() { document.getElementById('shareModal').classList.remove('open'); }
function restart() {
  Sound.transition();
  appState.material={text:'',files:[],images:[],urls:[]};
  appState.quizData={score:0,total:0,answered:0,history:[]};
  document.getElementById('materialInput').value='';
  document.getElementById('filePreview').innerHTML='';
  document.getElementById('imgPreviewWrap').style.display='none';
  goStep(1);
}

document.addEventListener('DOMContentLoaded', initStep2);

