const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
const notesFilePath = path.join(app.getPath('userData'), 'notes_db.json');
const settingsFilePath = path.join(app.getPath('userData'), 'app_settings.json');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile('index.html');
  createApplicationMenu();
}

function createApplicationMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Note',
          accelerator: 'CmdOrCtrl+N',
          click: () => mainWindow.webContents.send('menu-new-note')
        },
        {
          label: 'Open External Text File',
          accelerator: 'CmdOrCtrl+O',
          click: () => mainWindow.webContents.send('menu-open-file')
        },
        {
          label: 'Save Note',
          accelerator: 'CmdOrCtrl+S',
          click: () => mainWindow.webContents.send('menu-save')
        },
        {
          label: 'Save As...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => mainWindow.webContents.send('menu-save-as')
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Filter',
      submenu: [
        {
          label: 'Toggle Favorites Only',
          accelerator: 'CmdOrCtrl+F',
          click: () => mainWindow.webContents.send('menu-favorite-notes')
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
  ipcMain.handle('get-notes', () => {
    if (!fs.existsSync(notesFilePath)) return [];
    try {
      return JSON.parse(fs.readFileSync(notesFilePath, 'utf8'));
    } catch (e) {
      return [];
    }
  });

  ipcMain.handle('save-notes', (event, notesArray) => {
    try {
      fs.writeFileSync(notesFilePath, JSON.stringify(notesArray, null, 2), 'utf8');
      return true;
    } catch (e) {
      return false;
    }
  });

  ipcMain.handle('get-settings', () => {
    if (!fs.existsSync(settingsFilePath)) return { fontSize: 16, darkMode: false, fontFamily: "", textColor: "", bgColor: "" };
    try {
      return JSON.parse(fs.readFileSync(settingsFilePath, 'utf8'));
    } catch (e) {
      return { fontSize: 16, darkMode: false, fontFamily: "", textColor: "", bgColor: "" };
    }
  });

  ipcMain.handle('save-settings', (event, settingsObj) => {
    try {
      fs.writeFileSync(settingsFilePath, JSON.stringify(settingsObj, null, 2), 'utf8');
      return true;
    } catch (e) {
      return false;
    }
  });

  ipcMain.handle('confirm-new-note', async () => {
    const { response } = await dialog.showMessageBox(mainWindow, {
      type: 'question',
      buttons: ['Yes', 'No'],
      defaultId: 1,
      title: 'Unsaved Changes Detected',
      message: 'You have unsaved workspace progress. Abandon changes and structural targets?'
    });
    return response === 0;
  });

  ipcMain.handle('save-as', async (event, textContent) => {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Export Raw Text Artifact',
      defaultPath: path.join(app.getPath('documents'), 'note_export.txt'),
      filters: [{ name: 'Text Files', extensions: ['txt', 'md'] }]
    });

    if (canceled || !filePath) return null;

    try {
      fs.writeFileSync(filePath, textContent, 'utf8');
      return filePath;
    } catch (e) {
      return null;
    }
  });

  ipcMain.handle('open-file', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Import Native File',
      properties: ['openFile'],
      filters: [{ name: 'Text Artifacts', extensions: ['txt', 'md', 'json'] }]
    });

    if (canceled || filePaths.length === 0) return null;

    try {
      const content = fs.readFileSync(filePaths[0], 'utf8');
      return { filePath: filePaths[0], content };
    } catch (e) {
      return null;
    }
  });

  ipcMain.handle('export-pdf', async (event, htmlContent) => {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Export Compiled PDF Document',
      defaultPath: path.join(app.getPath('documents'), 'document.pdf'),
      filters: [{ name: 'Adobe PDF Document', extensions: ['pdf'] }]
    });

    if (canceled || !filePath) return null;

    const workerWindow = new BrowserWindow({ show: false });
    await workerWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
    
    try {
      const pdfBuffer = await workerWindow.webContents.printToPDF({
        margins: { top: 0.5, bottom: 0.5, left: 0.5, right: 0.5 },
        pageSize: 'A4',
        printBackground: true
      });
      fs.writeFileSync(filePath, pdfBuffer);
      workerWindow.close();
      return filePath;
    } catch (err) {
      workerWindow.close();
      throw err;
    }
  });

  ipcMain.handle('print-note', async (event, htmlContent) => {
    const workerWindow = new BrowserWindow({ show: false });
    await workerWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
    
    return new Promise((resolve, reject) => {
      workerWindow.webContents.print({ silent: false, printBackground: true }, (success, failureReason) => {
        workerWindow.close();
        if (success) resolve(true);
        else reject(new Error(failureReason));
      });
    });
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});