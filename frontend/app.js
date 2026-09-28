let currentBank = null;

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
  loadBrief();
}

async function loadBrief() {
  document.getElementById('tab-brief').innerHTML = '<p class="recalled" style="color: var(--muted)">Thinking... recalling memory and writing brief...</p>';
  try {
    const res = await fetch(`/api/brief/${currentBank}`);
    if (!res.ok) throw new Error(`Server returned ${res.status}`);
    const brief = await res.json();
    document.getElementById('tab-brief').innerHTML = `
      <p class="recalled">${brief.tldr}</p>
      <h3>Follow-ups</h3>
      <ul>${(brief.follow_ups || []).map(f => `<li class="recalled">${f}</li>`).join('')}</ul>
      <h3>Quirks</h3>
      <ul>${(brief.quirks || []).map(q => `<li>${q}</li>`).join('')}</ul>
      <h3>Suggested opener</h3>
      <p class="recalled">${brief.icebreaker}</p>
      
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
  } catch (error) {
    document.getElementById('tab-brief').innerHTML = `
      <p class="recalled" style="color: var(--danger, #d9534f);">Failed to generate brief. The AI might have returned an invalid response.</p>
      <button onclick="loadBrief()" style="margin-top: 10px; padding: 5px 10px; cursor: pointer;">Try Again</button>
    `;
  }
}

async function submitFeedback() {
  const input = document.getElementById('feedback-input');
  if (!input.value.trim()) return;
  const btn = input.nextElementSibling;
  btn.innerText = "Saving...";
  btn.disabled = true;
  await fetch('/api/preferences', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ preference: input.value })
  });
  input.value = '';
  btn.innerText = "Saved!";
  setTimeout(() => {
    btn.innerText = "Save Preference";
    btn.disabled = false;
    loadBrief(); // Regenerate brief to show changes
  }, 1000);
}

async function loadMemory() {
  document.getElementById('tab-memory').innerHTML = '<p class="recalled" style="color: var(--muted)">Extracting raw memory...</p>';
  try {
    const res = await fetch(`/api/memory/${currentBank}`);
    if (!res.ok) throw new Error(`Server returned ${res.status}`);
    const mem = await res.json();
    const factsHtml = (mem.facts || []).map(f => `<li style="margin-bottom: 8px; line-height: 1.4;">${f.text || f}</li>`).join('');
    const modelsHtml = (mem.mental_models || []).map(m => `<li style="margin-bottom: 8px; line-height: 1.4;">${m.text || m}</li>`).join('');
    
    document.getElementById('tab-memory').innerHTML = `
      <h3 style="margin-top: 0;">Extracted Facts</h3>
      <ul style="color: var(--text); padding-left: 20px;">
        ${factsHtml || '<li>No facts recorded yet.</li>'}
      </ul>
      <h3 style="margin-top: 20px;">Mental Models (Patterns)</h3>
      <ul style="color: var(--text); padding-left: 20px;">
        ${modelsHtml || '<li>No mental models formed yet.</li>'}
      </ul>
    `;
  } catch (error) {
    document.getElementById('tab-memory').innerHTML = `
      <p class="recalled" style="color: var(--danger, #d9534f);">Failed to load memory.</p>
      <button onclick="loadMemory()" style="margin-top: 10px; padding: 5px 10px; cursor: pointer;">Try Again</button>
    `;
  }
}

async function submitIngest() {
  const textInput = document.getElementById('ingest-text');
  if (!textInput.value.trim()) return;
  const btn = document.getElementById('ingest-btn');
  const status = document.getElementById('ingest-status');
  btn.innerText = "Saving to Memory...";
  btn.disabled = true;
  status.innerText = "";
  
  try {
    const res = await fetch(`/api/ingest/${currentBank}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: textInput.value })
    });
    if (!res.ok) throw new Error("Failed to save");
    textInput.value = '';
    status.style.color = "green";
    status.innerText = "Successfully saved to memory! The Briefing tab will now reflect this new information.";
  } catch (error) {
    status.style.color = "red";
    status.innerText = "Error saving to memory.";
  } finally {
    btn.innerText = "Save to Memory";
    btn.disabled = false;
    // Reload data in background
    loadMemory();
    loadBrief();
  }
}

document.querySelectorAll('.tab').forEach(tab => {
  tab.onclick = () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('tab-brief').style.display = tab.dataset.tab === 'brief' ? 'block' : 'none';
    document.getElementById('tab-memory').style.display = tab.dataset.tab === 'memory' ? 'block' : 'none';
    document.getElementById('tab-ingest').style.display = tab.dataset.tab === 'ingest' ? 'block' : 'none';
    if (tab.dataset.tab === 'memory') loadMemory();
  };
});

loadContacts();
