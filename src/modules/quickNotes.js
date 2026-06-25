// Quick Notes / Sticky Notes Module

export function getNotesKey(userId = 'guest') {
  return `sfjr:${userId}:notes`;
}

export function loadNotes(userId = 'guest') {
  try {
    const data = localStorage.getItem(getNotesKey(userId));
    if (data) return JSON.parse(data);
  } catch (e) {
    console.error('[NOTES] Failed to load notes', e);
  }
  return [];
}

export function saveNotes(notes, userId = 'guest') {
  try {
    localStorage.setItem(getNotesKey(userId), JSON.stringify(notes));
  } catch (e) {
    console.error('[NOTES] Failed to save notes', e);
  }
}

export function addNote(title, text, tag = '', userId = 'guest') {
  const notes = loadNotes(userId);
  notes.unshift({
    id: 'note_' + Math.random().toString(36).substr(2, 9),
    title,
    text,
    tag,
    createdAt: new Date().toISOString()
  });
  saveNotes(notes, userId);
  renderNotesList(userId);
  
  if (typeof window.showToast === 'function') {
    window.showToast('📝 Note added successfully!', false);
  }
}

export function deleteNote(id, userId = 'guest') {
  let notes = loadNotes(userId);
  notes = notes.filter(n => n.id !== id);
  saveNotes(notes, userId);
  renderNotesList(userId);
}

export function renderNotesList(userId = 'guest') {
  const container = document.getElementById('quickNotesList');
  if (!container) return;

  const notes = loadNotes(userId);
  if (notes.length === 0) {
    container.innerHTML = `<div style="padding: 24px; text-align: center; color: var(--muted); font-size: 0.8rem; font-style: italic;">No quick notes added yet. Click "+" to write one.</div>`;
    return;
  }

  container.innerHTML = notes.map(n => `
    <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border); border-radius: 12px; padding: 1rem; margin-bottom: 12px; position: relative;">
      <button onclick="window.deleteQuickNote('${n.id}')" style="position: absolute; top: 12px; right: 12px; background: none; border: none; color: var(--red); font-size: 1rem; cursor: pointer;">&times;</button>
      <h4 style="font-size: 0.85rem; font-weight: 700; color: var(--text); margin: 0 0 6px 0; padding-right: 20px;">${n.title || 'Untitled'}</h4>
      ${n.tag ? `<span style="font-size: 0.65rem; background: rgba(59,130,246,0.1); color: var(--blue); padding: 2px 6px; border-radius: 4px; display: inline-block; margin-bottom: 8px;">${n.tag}</span>` : ''}
      <p style="font-size: 0.8rem; color: var(--muted); margin: 0; line-height: 1.4; white-space: pre-wrap;">${n.text}</p>
    </div>
  `).join('');
}

export function initQuickNotes(userId = 'guest') {
  // Expose global handler for deleting
  window.deleteQuickNote = (id) => deleteNote(id, userId);

  // Expose global handler for adding from modal
  window.submitQuickNote = () => {
    const titleEl = document.getElementById('noteTitleInput');
    const textEl = document.getElementById('noteTextInput');
    const tagEl = document.getElementById('noteTagInput');
    
    if (textEl && textEl.value.trim().length > 0) {
      addNote(
        titleEl ? titleEl.value.trim() : 'Note',
        textEl.value.trim(),
        tagEl ? tagEl.value.trim() : '',
        userId
      );
      if (titleEl) titleEl.value = '';
      if (textEl) textEl.value = '';
      if (tagEl) tagEl.value = '';
      
      const modal = document.getElementById('addNoteModal');
      if (modal) modal.style.display = 'none';
    }
  };

  injectNoteModal();
  renderNotesList(userId);
}

function injectNoteModal() {
  if (document.getElementById('addNoteModal')) return;

  const modal = document.createElement('div');
  modal.id = 'addNoteModal';
  modal.className = 'modal-overlay';
  modal.style.cssText = `
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.85);
    backdrop-filter: blur(10px);
    z-index: 12000;
    align-items: center;
    justify-content: center;
  `;

  modal.innerHTML = `
    <div style="background: var(--surface, #111827); border: 1px solid var(--border, rgba(255,255,255,0.08)); width: 90%; max-width: 440px; border-radius: 20px; padding: 2rem; position: relative; box-shadow: var(--shadow-lg);">
      <button onclick="document.getElementById('addNoteModal').style.display='none'" style="position: absolute; top: 16px; right: 16px; background: none; border: none; color: var(--muted, #64748b); font-size: 1.5rem; cursor: pointer;">&times;</button>
      <h3 style="font-size: 1.25rem; font-weight: 700; color: var(--text, #f8fafc); margin-bottom: 1.5rem; display: flex; align-items: center; gap: 8px;">
        📝 Create Quick Note
      </h3>
      <div style="display: flex; flex-direction: column; gap: 15px;">
        <div>
          <label style="display:block; font-size:0.7rem; color:var(--muted); text-transform:uppercase; margin-bottom:6px;">Title</label>
          <input id="noteTitleInput" type="text" placeholder="e.g. LWC lifecycle hooks info" style="width:100%; background:var(--bg); border:1px solid var(--border); color:var(--text); padding:10px; border-radius:8px; font-family:inherit;">
        </div>
        <div>
          <label style="display:block; font-size:0.7rem; color:var(--muted); text-transform:uppercase; margin-bottom:6px;">Tag (Optional)</label>
          <input id="noteTagInput" type="text" placeholder="e.g. LWC" style="width:100%; background:var(--bg); border:1px solid var(--border); color:var(--text); padding:10px; border-radius:8px; font-family:inherit;">
        </div>
        <div>
          <label style="display:block; font-size:0.7rem; color:var(--muted); text-transform:uppercase; margin-bottom:6px;">Note Content *</label>
          <textarea id="noteTextInput" placeholder="Write anything..." style="width:100%; background:var(--bg); border:1px solid var(--border); color:var(--text); padding:10px; border-radius:8px; font-family:inherit; min-height:120px; resize:none;"></textarea>
        </div>
        <button onclick="window.submitQuickNote()" style="width: 100%; background: var(--blue); color: white; border: none; padding: 12px; border-radius: 10px; font-weight: 700; font-size: 0.85rem; cursor: pointer; box-shadow: 0 4px 15px rgba(59,130,246,0.3);">Save Note</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
}

export function toggleQuickNotes() {
  const modal = document.getElementById('addNoteModal');
  if (modal) {
    const isVisible = modal.style.display === 'flex';
    modal.style.display = isVisible ? 'none' : 'flex';
  }
}
