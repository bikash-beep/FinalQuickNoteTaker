const textarea = document.getElementById('editor-textarea');
const previewArea = document.getElementById('editor-preview');
const titleInput = document.getElementById('note-title-input');
const categoryInput = document.getElementById('note-category-input');
const saveStatus = document.getElementById('save-status');
const wordCountEl = document.getElementById('word-count');
const searchBar = document.getElementById('search-bar');
const noteListContainer = document.getElementById('note-list');

const newNoteBtn = document.getElementById('new-note-btn');
const saveBtn = document.getElementById('save-btn');
const saveAsBtn = document.getElementById('save-as-btn');
const openFileBtn = document.getElementById('open-file-btn');
const pinBtn = document.getElementById('pin-btn');
const fontIncBtn = document.getElementById('font-inc-btn');
const fontDecBtn = document.getElementById('font-dec-btn');
const darkModeToggle = document.getElementById('dark-mode-toggle');

const togglePreviewBtn = document.getElementById('toggle-preview-btn');
const favoriteBtn = document.getElementById('favorite-btn');
const filterFavBtn = document.getElementById('filter-fav-btn');
const exportPdfBtn = document.getElementById('export-pdf-btn');
const printBtn = document.getElementById('print-btn');

const fontFamilySelect = document.getElementById('font-family-select');
const textColorPicker = document.getElementById('text-color-picker');
const bgColorPicker = document.getElementById('bg-color-picker');

let notes = [];
let activeNoteId = null;
let appSettings = { fontSize: 16, darkMode: false, fontFamily: "", textColor: "", bgColor: "" };
let debounceTimer = null;
let showingFavoritesOnly = false;
let isPreviewActive = false;

let lastSavedText = '';
let lastSavedTitle = '';
let lastSavedCategory = '';

function updateWordCount() {
  const text = textarea.value.trim();
  const chars = text.length;
  const words = text === '' ? 0 : text.split(/\s+/).length;
  wordCountEl.textContent = `Words: ${words} | Characters: ${chars}`;
}

function updateLivePreviewUI() {
  let bodyHtml = textarea.value
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\n/g, '<br>');
  previewArea.innerHTML = bodyHtml;
}

function hasUnsavedChanges() {
  return textarea.value !== lastSavedText || 
         titleInput.value !== lastSavedTitle ||
         categoryInput.value !== lastSavedCategory;
}

function updateSaveAnchors() {
  lastSavedText = textarea.value;
  lastSavedTitle = titleInput.value;
  lastSavedCategory = categoryInput.value;
}

function sortNotes() {
  notes.sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.updatedAt) - new Date(a.updatedAt);
  });
}

function renderNoteList(filter = '', customNotes = null) {
  noteListContainer.innerHTML = '';
  const query = filter.toLowerCase().trim();
  let sourceNotes = customNotes || notes;

  if (showingFavoritesOnly && !customNotes) {
    sourceNotes = sourceNotes.filter(n => n.favorited);
  }

  sourceNotes.forEach(note => {
    const matchTitle = (note.title || '').toLowerCase().includes(query);
    const matchContent = (note.content || '').toLowerCase().includes(query);
    
    if (filter && !matchTitle && !matchContent) return;

    const li = document.createElement('li');
    li.className = `note-item ${note.id === activeNoteId ? 'active' : ''}`;
    
    const catTag = note.category ? `<span class="category-badge">${note.category}</span>` : '';
    const pinIndicator = note.pinned ? `<span class="pin-badge">📌</span>` : '';
    const favIndicator = note.favorited ? `<span class="fav-badge">⭐</span>` : '';

    const cleanDisplayTitle = note.title || 'Untitled Note';

    li.innerHTML = `
      <div class="note-title-text">${cleanDisplayTitle}</div>
      <div class="note-meta">${pinIndicator}${favIndicator}${catTag} Mod: ${new Date(note.updatedAt).toLocaleTimeString()}</div>
      <button class="delete-btn" data-id="${note.id}">Delete</button>
    `;

    li.addEventListener('click', (e) => {
      if (e.target.classList.contains('delete-btn')) return;
      switchNoteHandle(note.id);
    });

    const deleteBtn = li.querySelector('.delete-btn');
    deleteBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await deleteNoteRecord(note.id);
    });

    noteListContainer.appendChild(li);
  });
}

function loadNote(id) {
  const note = notes.find(n => n.id === id);
  if (!note) return;

  activeNoteId = id;
  titleInput.value = note.title || '';
  categoryInput.value = note.category || '';
  textarea.value = note.content || '';

  if (isPreviewActive) updateLivePreviewUI();
  updateSaveAnchors();
  updateWordCount();
  saveStatus.textContent = "No changes - already saved";
  renderNoteList(searchBar.value);
}

function initBlankNote() {
  activeNoteId = 'note_' + Date.now();
  titleInput.value = '';
  categoryInput.value = '';
  textarea.value = '';
  if (isPreviewActive) previewArea.innerHTML = '';
  updateSaveAnchors();
  updateWordCount();
  saveStatus.textContent = "New blank note created";
  renderNoteList(searchBar.value);
}

async function switchNoteHandle(targetId) {
  if (hasUnsavedChanges()) {
    const discardAllowed = await window.electronAPI.confirmNewNote();
    if (!discardAllowed) return;
  }
  loadNote(targetId);
}

async function saveCurrentNoteState() {
  clearTimeout(debounceTimer);

  if (!hasUnsavedChanges()) {
    saveStatus.textContent = "No changes - already saved";
    return;
  }

  const index = notes.findIndex(n => n.id === activeNoteId);
  const timeStamp = new Date().toISOString();
  
  const notePayload = {
    id: activeNoteId,
    title: titleInput.value.trim() || 'Untitled Note',
    content: textarea.value,
    category: categoryInput.value.trim(),
    pinned: index !== -1 ? notes[index].pinned : false,
    favorited: index !== -1 ? notes[index].favorited : false,
    updatedAt: timeStamp
  };

  if (index !== -1) {
    notes[index] = notePayload;
  } else {
    notes.push(notePayload);
  }

  sortNotes();
  await window.electronAPI.saveNotes(notes);
  updateSaveAnchors();
  
  const displayTime = new Date().toLocaleTimeString();
  saveStatus.textContent = `Auto-saved at ${displayTime}`;
  renderNoteList(searchBar.value);
}

async function deleteNoteRecord(id) {
  notes = notes.filter(n => n.id !== id);
  await window.electronAPI.saveNotes(notes);
  
  if (activeNoteId === id) {
    if (notes.length > 0) {
      loadNote(notes[0].id);
    } else {
      initBlankNote();
    }
  } else {
    renderNoteList(searchBar.value);
  }
}

function triggerChangeDebounce() {
  saveStatus.textContent = "Typing...";
  updateWordCount();
  if (isPreviewActive) updateLivePreviewUI();
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(saveCurrentNoteState, 5000);
}

function compileDocumentHtml() {
  const title = titleInput.value.trim() || 'Untitled Note';
  const category = categoryInput.value.trim() ? `<span style="background:#eee; padding:3px 8px; border-radius:4px; font-size:14px;">${categoryInput.value.trim()}</span>` : '';
  let bodyHtml = textarea.value
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\n/g, '<br>');

  return `
    <html>
    <head>
      <style>
        body { 
          font-family: ${appSettings.fontFamily}; 
          padding: 30px; 
          color: ${appSettings.textColor}; 
          background-color: ${appSettings.bgColor};
          line-height: 1.6; 
        }
        h1 { margin-bottom: 5px; font-size: 28px; }
        .meta { margin-bottom: 30px; font-size: 14px; opacity: 0.8; display: flex; gap: 10px; align-items: center; }
        .content { font-size: ${appSettings.fontSize || 16}px; word-break: break-word; }
      </style>
    </head>
    <body>
      <h1>${title}</h1>
      <div class="meta">${category} <span>Generated: ${new Date().toLocaleDateString()}</span></div>
      <div class="content">${bodyHtml}</div>
    </body>
    </html>
  `;
}

async function adjustFontSize(delta) {
  let targetSize = appSettings.fontSize + delta;
  appSettings.fontSize = Math.min(102, Math.max(10, targetSize));
  applySettingsUI();
  await window.electronAPI.saveSettings(appSettings);
}

function applySettingsUI() {
  textarea.style.fontSize = `${appSettings.fontSize}px`;
  previewArea.style.fontSize = `${appSettings.fontSize}px`;
  
  textarea.style.fontFamily = appSettings.fontFamily;
  previewArea.style.fontFamily = appSettings.fontFamily;
  fontFamilySelect.value = appSettings.fontFamily;

  textarea.style.color = appSettings.textColor;
  previewArea.style.color = appSettings.textColor;
  textColorPicker.value = appSettings.textColor;

  textarea.style.backgroundColor = appSettings.bgColor;
  previewArea.style.backgroundColor = appSettings.bgColor;
  bgColorPicker.value = appSettings.bgColor;

  if (appSettings.darkMode) {
    document.body.classList.add('dark-mode');
  } else {
    document.body.classList.remove('dark-mode');
  }
}

textarea.addEventListener('input', triggerChangeDebounce);
titleInput.addEventListener('input', triggerChangeDebounce);
categoryInput.addEventListener('input', triggerChangeDebounce);

saveBtn.addEventListener('click', async () => {
  await saveCurrentNoteState();
  new Notification('Note Saved Successfully', {
    body: `"${titleInput.value || 'Untitled'}" written securely to storage array.`
  });
});

saveAsBtn.addEventListener('click', async () => {
  const rawContent = `Title: ${titleInput.value}\nCategory: ${categoryInput.value}\n\n${textarea.value}`;
  const targetExportPath = await window.electronAPI.saveAs(rawContent);
  if (targetExportPath) {
    saveStatus.textContent = `Successfully exported directly to external path: ${targetExportPath}`;
  }
});

openFileBtn.addEventListener('click', async () => {
  const fileData = await window.electronAPI.openFile();
  if (fileData) {
    if (hasUnsavedChanges()) {
      const discardAllowed = await window.electronAPI.confirmNewNote();
      if (!discardAllowed) return;
    }
    activeNoteId = 'note_' + Date.now();
    titleInput.value = "Imported: " + fileData.filePath.split(/[\\/]/).pop();
    categoryInput.value = "External Drive File";
    textarea.value = fileData.content;
    if (isPreviewActive) updateLivePreviewUI();
    updateSaveAnchors();
    updateWordCount();
    saveStatus.textContent = `Loaded file: ${fileData.filePath}`;
    await saveCurrentNoteState();
  }
});

newNoteBtn.addEventListener('click', async () => {
  if (hasUnsavedChanges()) {
    const discardAllowed = await window.electronAPI.confirmNewNote();
    if (!discardAllowed) return;
  }
  initBlankNote();
});

pinBtn.addEventListener('click', async () => {
  const index = notes.findIndex(n => n.id === activeNoteId);
  if (index !== -1) {
    notes[index].pinned = !notes[index].pinned;
    sortNotes();
    await window.electronAPI.saveNotes(notes);
    renderNoteList(searchBar.value);
  }
});

favoriteBtn.addEventListener('click', async () => {
  const index = notes.findIndex(n => n.id === activeNoteId);
  if (index !== -1) {
    notes[index].favorited = !notes[index].favorited;
    await window.electronAPI.saveNotes(notes);
    renderNoteList(searchBar.value);
  }
});

filterFavBtn.addEventListener('click', () => {
  showingFavoritesOnly = !showingFavoritesOnly;
  filterFavBtn.textContent = showingFavoritesOnly ? "⭐ Show All Notes" : "⭐ Show Favorites";
  renderNoteList(searchBar.value);
});

togglePreviewBtn.addEventListener('click', () => {
  isPreviewActive = !isPreviewActive;
  if (isPreviewActive) {
    updateLivePreviewUI();
    textarea.style.display = 'none';
    previewArea.style.display = 'block';
    togglePreviewBtn.textContent = '✍️ Edit Mode';
  } else {
    previewArea.style.display = 'none';
    textarea.style.display = 'block';
    textarea.focus();
    togglePreviewBtn.textContent = '👁️ Preview Mode';
  }
});

fontFamilySelect.addEventListener('change', async () => {
  appSettings.fontFamily = fontFamilySelect.value;
  applySettingsUI();
  await window.electronAPI.saveSettings(appSettings);
});

textColorPicker.addEventListener('input', async () => {
  appSettings.textColor = textColorPicker.value;
  applySettingsUI();
  await window.electronAPI.saveSettings(appSettings);
});

bgColorPicker.addEventListener('input', async () => {
  appSettings.bgColor = bgColorPicker.value;
  applySettingsUI();
  await window.electronAPI.saveSettings(appSettings);
});

exportPdfBtn.addEventListener('click', async () => {
  saveStatus.textContent = "Compiling PDF...";
  try {
    const html = compileDocumentHtml();
    const pathExported = await window.electronAPI.exportPDF(html);
    saveStatus.textContent = pathExported ? `PDF saved to: ${pathExported}` : "PDF export cancelled.";
  } catch (err) {
    saveStatus.textContent = "Error generating PDF.";
  }
});

printBtn.addEventListener('click', async () => {
  saveStatus.textContent = "Opening Print Dialog...";
  try {
    const html = compileDocumentHtml();
    await window.electronAPI.printNote(html);
    saveStatus.textContent = "Print command dispatched.";
  } catch (err) {
    saveStatus.textContent = "Printing failed.";
  }
});

searchBar.addEventListener('input', () => {
  renderNoteList(searchBar.value);
});

fontIncBtn.addEventListener('click', () => adjustFontSize(2));
fontDecBtn.addEventListener('click', () => adjustFontSize(-2));

darkModeToggle.addEventListener('click', async () => {
  appSettings.darkMode = !appSettings.darkMode;
  applySettingsUI();
  await window.electronAPI.saveSettings(appSettings);
});

document.addEventListener('DOMContentLoaded', async () => {
  notes = await window.electronAPI.getNotes();
  appSettings = await window.electronAPI.getSettings();

  if (!appSettings.fontFamily) appSettings.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  if (!appSettings.textColor) appSettings.textColor = "#333333";
  if (!appSettings.bgColor) appSettings.bgColor = "#ffffff";

  applySettingsUI();
  
  if (notes.length > 0) {
    sortNotes();
    loadNote(notes[0].id);
  } else {
    initBlankNote();
  }
});

window.electronAPI.onMenuNewNote(() => { initBlankNote(); });
window.electronAPI.onMenuOpenFile(async () => { openFileBtn.click(); });
window.electronAPI.onMenuSave(async () => { saveBtn.click(); });
window.electronAPI.onMenuSaveAs(async () => { saveAsBtn.click(); });
window.electronAPI.onMenuFavoriteNotes(() => { filterFavBtn.click(); });