// Electron main 프로세스: 창 만들기, 파일 메뉴, 운영체제 열기/저장 창, 닫기 전 확인
const { app, BrowserWindow, Menu, dialog, ipcMain, protocol, net, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const { pathToFileURL } = require('node:url');

const DIST = path.join(__dirname, '..', 'dist');
const DEV_URL = process.env.BLAKPDF_DEV_URL;

// app:// 로 dist 폴더를 제공한다. file:// 보다 pdf.js 워커(모듈 워커)가 안정적으로 동작한다.
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);

/** @type {BrowserWindow | null} */
let win = null;
let dirty = false;

function send(cmd) {
  win?.webContents.send('menu', cmd);
}

function buildMenu() {
  const template = [
    {
      label: '파일(&F)',
      submenu: [
        { label: '열기...', accelerator: 'CmdOrCtrl+O', click: () => send('open') },
        { type: 'separator' },
        { label: '저장', accelerator: 'CmdOrCtrl+S', click: () => send('save') },
        { label: '다른 이름으로 저장...', accelerator: 'CmdOrCtrl+Shift+S', click: () => send('saveAs') },
        { type: 'separator' },
        { label: '끝내기', role: 'quit' },
      ],
    },
    {
      label: '보기(&V)',
      submenu: [
        { label: '전체 화면', role: 'togglefullscreen' },
        { label: '개발자 도구', role: 'toggleDevTools' },
        { label: '새로 고침', role: 'reload' },
      ],
    },
    {
      label: '도움말(&H)',
      submenu: [{ label: 'blakpdf 정보', click: () => dialog.showMessageBox(win, { title: 'blakpdf', message: `blakpdf ${app.getVersion()}`, detail: 'PDF 마크업·측정 프로그램 (React + Electron)' }) }],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#1e2126',
    title: 'blakpdf',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.loadURL(DEV_URL || 'app://bundle/index.html');

  // 외부 링크는 기본 브라우저로
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  win.on('close', (e) => {
    if (!dirty || process.env.BLAKPDF_TEST) return;
    const choice = dialog.showMessageBoxSync(win, {
      type: 'warning',
      buttons: ['저장 안 하고 닫기', '취소'],
      defaultId: 1,
      cancelId: 1,
      title: 'blakpdf',
      message: '저장하지 않은 마크업이 있습니다.',
      detail: '닫으면 저장하지 않은 마크업이 사라집니다.',
    });
    if (choice === 1) e.preventDefault();
  });
  win.on('closed', () => {
    win = null;
  });
}

ipcMain.handle('open-file', async () => {
  const res = await dialog.showOpenDialog(win, { title: 'PDF 열기', filters: [{ name: 'PDF', extensions: ['pdf'] }], properties: ['openFile'] });
  if (res.canceled || !res.filePaths[0]) return null;
  const p = res.filePaths[0];
  const data = await fs.readFile(p);
  return { name: path.basename(p), path: p, data: new Uint8Array(data) };
});

ipcMain.handle('save-file', async (_e, { path: target, data, suggestedName }) => {
  let p = target;
  if (!p) {
    const res = await dialog.showSaveDialog(win, { title: '마크업 PDF 저장', defaultPath: suggestedName, filters: [{ name: 'PDF', extensions: ['pdf'] }] });
    if (res.canceled || !res.filePath) return null;
    p = res.filePath;
  }
  await fs.writeFile(p, Buffer.from(data));
  return { path: p, name: path.basename(p) };
});

ipcMain.on('set-dirty', (_e, value) => {
  dirty = !!value;
});
ipcMain.on('set-title', (_e, title) => {
  if (win && typeof title === 'string') win.setTitle(title);
});

app.whenReady().then(() => {
  protocol.handle('app', (req) => {
    const { pathname } = new URL(req.url);
    const file = path.normalize(path.join(DIST, decodeURIComponent(pathname)));
    if (!file.startsWith(DIST)) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
  buildMenu();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
