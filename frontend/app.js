let currentBank = null;
let mediaRecorder = null;
let recordedChunks = [];
let recordingTimerInterval = null;
let recordingStartTime = null;

// ─── Brief Cache (persists across page refreshes) ────────────

let briefCache = {};
try {
  briefCache = JSON.parse(localStorage.getItem('briefCache') || '{}');
} catch (e) { briefCache = {}; }

function saveBriefToCache(bankId, brief) {
  brief._cachedAt = new Date().toLocaleString();
  briefCache[bankId] = brief;
  localStorage.setItem('briefCache', JSON.stringify(briefCache));
}

// ─── Contacts ────────────────────────────────────────────────

async function loadContacts() {
  const res = await fetch('/api/contacts');
  const contacts = await res.json();
  const list = document.getElementById('contact-list');
  list.innerHTML = contacts.map(c =>
    `<div class="contact-item" data-bank="${c.bank_id}">${c.name}<br><small>${c.company}</small></div>`
  ).join('');
  list.querySelectorAll('.contact-item').forEach(el => {
    el.onclick = () => selectContact(el.dataset.bank);
  });
  if (contacts.length) selectContact(contacts[0].bank_id);
}

async function selectContact(bankId) {
  currentBank = bankId;
  document.querySelectorAll('.contact-item').forEach(el =>
    el.classList.toggle('active', el.dataset.bank === bankId));
  showBrief();
}

// ─── Briefing Tab (untouched) ────────────────────────────────

function renderBriefContent(brief) {
  return `
    <p class="recalled">${brief.tldr}</p>
    <h3>Follow-ups</h3>
    <ul>${(brief.follow_ups || []).map(f => `<li class="recalled">${f}</li>`).join('')}</ul>
    <h3>Quirks</h3>
    <ul>${(brief.quirks || []).map(q => `<li>${q}</li>`).join('')}</ul>
    <h3>Suggested opener</h3>
    <p class="recalled">${brief.icebreaker}</p>
  `;
}

function renderFeedbackBox() {
  return `
    <hr style="margin-top: 40px; border: 0; border-top: 1px solid var(--muted);" />
    <div class="feedback-box">
        <h3 style="margin-top: 0;">Tailor your briefs</h3>
        <p style="font-size: 0.9em; color: var(--muted); margin-bottom: 10px;">How would you like future briefs formatted?</p>
        <div style="display: flex; gap: 10px;">
          <input type="text" id="feedback-input" placeholder="e.g. Keep TL;DR to one bullet point" style="flex: 1; padding: 8px; border-radius: 4px;" />
          <button onclick="submitFeedback()" class="btn">Save Preference</button>
        </div>
    </div>
  `;
}

function showBrief() {
  const el = document.getElementById('tab-brief');
  const cached = briefCache[currentBank];

  if (cached) {
    el.innerHTML = `
      <div class="brief-actions">
        <button onclick="generateBrief()" class="btn btn-generate">🔄 Generate New Brief</button>
        <span class="cache-hint">Last generated: ${cached._cachedAt || 'unknown'}</span>
      </div>
      ${renderBriefContent(cached)}
      ${renderFeedbackBox()}
    `;
  } else {
    el.innerHTML = `
      <div class="brief-empty">
        <p style="color: var(--muted); margin-bottom: 15px;">No brief generated for this contact yet.</p>
        <button onclick="generateBrief()" class="btn btn-generate">⚡ Generate Brief</button>
      </div>
    `;
  }
}

async function generateBrief() {
  const el = document.getElementById('tab-brief');
  const cached = briefCache[currentBank];

  el.innerHTML = `
    <div class="transcribing-indicator">
      <div class="spinner"></div>
      <span>Recalling memory and generating brief... This may take a moment.</span>
    </div>
    ${cached ? '<button onclick="showBrief()" class="btn" style="margin-top: 15px;">← View Last Brief</button>' : ''}
  `;

  try {
    const res = await fetch(`/api/brief/${currentBank}`);
    if (!res.ok) throw new Error(`Server returned ${res.status}`);
    const brief = await res.json();
    saveBriefToCache(currentBank, brief);
    showBrief();
  } catch (error) {
    el.innerHTML = `
      <p style="color: #d9534f; margin-bottom: 15px;">❌ Failed to generate brief: ${error.message}</p>
      <div style="display: flex; gap: 10px; flex-wrap: wrap;">
        <button onclick="generateBrief()" class="btn">🔄 Try Again</button>
        ${cached ? '<button onclick="showBrief()" class="btn" style="background: var(--muted);">📄 View Last Brief</button>' : ''}
      </div>
    `;
  }
}

async function submitFeedback() {
  const input = document.getElementById('feedback-input');
  if (!input.value.trim()) return;
  const btn = input.nextElementSibling;
  btn.innerText = "Saving...";
  btn.disabled = true;
  try {
    await fetch('/api/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preference: input.value })
    });
    input.value = '';
    btn.innerText = "Saved! ✓";
    btn.disabled = false;
  } catch (e) {
    btn.innerText = "Error";
    btn.disabled = false;
  }
}

// ─── Add Transcript Tab ──────────────────────────────────────

async function submitTranscript() {
  const input = document.getElementById('transcript-input');
  const btn = document.getElementById('save-transcript-btn');
  const status = document.getElementById('transcript-save-status');

  if (!input.value.trim()) {
    status.style.color = '#d9534f';
    status.textContent = 'Please paste a transcript first.';
    return;
  }

  btn.innerText = "Saving...";
  btn.disabled = true;
  status.textContent = '';

  try {
    const res = await fetch(`/api/ingest/${currentBank}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: input.value })
    });
    if (!res.ok) throw new Error("Failed to save");
    input.value = '';
    status.style.color = '#5cb85c';
    status.textContent = '✅ Saved to memory! Go to Briefing tab and click Generate to see updated brief.';
  } catch (error) {
    status.style.color = '#d9534f';
    status.textContent = '❌ Error saving to memory. Please try again.';
  } finally {
    btn.innerText = "Save to Memory";
    btn.disabled = false;
  }
}

// ─── Recording Tab ───────────────────────────────────────────

function updateTimer() {
  const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
  const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const secs = String(elapsed % 60).padStart(2, '0');
  document.getElementById('record-timer').textContent = `${mins}:${secs}`;
}

async function toggleRecording() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    stopRecording();
  } else {
    await startRecording();
  }
}

async function startRecording() {
  const status = document.getElementById('transcription-status');
  const preview = document.getElementById('camera-preview');
  status.innerHTML = '';
  document.getElementById('transcript-result').style.display = 'none';

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    preview.srcObject = stream;
    preview.style.display = 'block';

    recordedChunks = [];
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : MediaRecorder.isTypeSupported('video/webm')
        ? 'video/webm'
        : '';
    mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});

    mediaRecorder.ondataavailable = e => {
      if (e.data.size > 0) recordedChunks.push(e.data);
    };

    mediaRecorder.onstop = () => {
      stream.getTracks().forEach(t => t.stop());
      preview.srcObject = null;
      preview.style.display = 'none';
      const blob = new Blob(recordedChunks, { type: mediaRecorder.mimeType });
      uploadAndTranscribe(blob, 'recording.webm');
    };

    mediaRecorder.start(1000);

    document.getElementById('record-btn').classList.add('recording');
    document.getElementById('record-btn-text').textContent = 'Stop Recording';
    document.getElementById('record-timer').style.display = 'inline';
    recordingStartTime = Date.now();
    recordingTimerInterval = setInterval(updateTimer, 1000);

  } catch (err) {
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      status.innerHTML = '<p style="color: #d9534f;">⚠️ Camera/microphone permission denied. Please allow access and try again.</p>';
    } else if (err.name === 'NotFoundError' || err.name === 'OverconstrainedError') {
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        preview.style.display = 'none';
        recordedChunks = [];
        mediaRecorder = new MediaRecorder(audioStream);

        mediaRecorder.ondataavailable = e => {
          if (e.data.size > 0) recordedChunks.push(e.data);
        };
        mediaRecorder.onstop = () => {
          audioStream.getTracks().forEach(t => t.stop());
          const blob = new Blob(recordedChunks, { type: mediaRecorder.mimeType });
          uploadAndTranscribe(blob, 'recording.webm');
        };
        mediaRecorder.start(1000);

        document.getElementById('record-btn').classList.add('recording');
        document.getElementById('record-btn-text').textContent = 'Stop Recording';
        document.getElementById('record-timer').style.display = 'inline';
        recordingStartTime = Date.now();
        recordingTimerInterval = setInterval(updateTimer, 1000);
        status.innerHTML = '<p style="color: var(--muted);">🎙️ Recording audio only (no camera detected)</p>';
      } catch (audioErr) {
        status.innerHTML = '<p style="color: #d9534f;">⚠️ No microphone found. Please connect one and try again.</p>';
      }
    } else {
      status.innerHTML = `<p style="color: #d9534f;">⚠️ Recording error: ${err.message}</p>`;
    }
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
  }
  clearInterval(recordingTimerInterval);
  document.getElementById('record-btn').classList.remove('recording');
  document.getElementById('record-btn-text').textContent = 'Start Recording';
  document.getElementById('record-timer').style.display = 'none';
}

function handleFileUpload(input) {
  const file = input.files[0];
  if (!file) return;
  document.getElementById('file-name').textContent = file.name;
  uploadAndTranscribe(file, file.name);
}

async function uploadAndTranscribe(blob, filename) {
  const status = document.getElementById('transcription-status');
  const resultDiv = document.getElementById('transcript-result');
  const textDiv = document.getElementById('transcript-text');
  const recordBtn = document.getElementById('record-btn');

  recordBtn.disabled = true;
  resultDiv.style.display = 'none';
  status.innerHTML = `
    <div class="transcribing-indicator">
      <div class="spinner"></div>
      <span>Uploading & transcribing with AI... This may take a moment.</span>
    </div>
  `;

  const formData = new FormData();
  formData.append('file', blob, filename);

  try {
    const res = await fetch(`/api/transcribe/${currentBank}`, {
      method: 'POST',
      body: formData
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || `Server returned ${res.status}`);
    }

    const data = await res.json();
    status.innerHTML = '<p style="color: #5cb85c;">✅ Transcribed and saved to memory! Go to Briefing tab and click Generate to see updated brief.</p>';
    textDiv.textContent = data.transcript;
    resultDiv.style.display = 'block';
  } catch (error) {
    status.innerHTML = `
      <p style="color: #d9534f;">❌ Transcription failed: ${error.message}</p>
      <button onclick="document.getElementById('transcription-status').innerHTML=''" style="margin-top: 5px; padding: 5px 10px; cursor: pointer;">Dismiss</button>
    `;
  } finally {
    recordBtn.disabled = false;
    document.getElementById('file-name').textContent = '';
    const uploadInput = document.getElementById('upload-file');
    if (uploadInput) uploadInput.value = '';
  }
}

// ─── Transcript Logs Tab ───────────────────────────────────────

async function loadLogs() {
  const container = document.getElementById('logs-container');
  container.innerHTML = '<div class="spinner"></div>';
  try {
    const res = await fetch(`/api/transcripts/${currentBank}`);
    const logs = await res.json();
    if (!logs.length) {
      container.innerHTML = '<p style="color: var(--muted)">No transcripts found for this contact.</p>';
      return;
    }
    container.innerHTML = logs.reverse().map(log => `
      <div style="background: var(--line); padding: 15px; border-radius: var(--radius); margin-bottom: 15px;">
        <div style="font-size: 0.8em; color: var(--muted); margin-bottom: 8px;">🕒 ${log.timestamp}</div>
        <div style="font-size: 0.95em; white-space: pre-wrap;">${log.text}</div>
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = '<p style="color: #d9534f">Failed to load logs.</p>';
  }
}

// ─── New Contact ─────────────────────────────────────────────

async function saveNewContact() {
  const name = document.getElementById('new-contact-name').value;
  const company = document.getElementById('new-contact-company').value;
  if (!name || !company) return alert("Please fill both fields");

  try {
    const res = await fetch('/api/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, company })
    });
    if (res.ok) {
      const data = await res.json();
      document.getElementById('new-contact-modal').style.display = 'none';
      document.getElementById('new-contact-name').value = '';
      document.getElementById('new-contact-company').value = '';
      await loadContacts();
      selectContact(data.bank_id);
    }
  } catch (err) {
    alert("Failed to add contact");
  }
}

// ─── Tab switching ───────────────────────────────────────────

document.querySelectorAll('.tab').forEach(tab => {
  tab.onclick = () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    const target = document.getElementById('tab-' + tab.dataset.tab);
    if (target) target.classList.add('active');
    if (tab.dataset.tab === 'logs') loadLogs();
  };
});

loadContacts();
