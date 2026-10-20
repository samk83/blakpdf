// Electron 메인 프로세스: 창 만들기, 파일 열기/저장 대화상자, 닫기 전 확인
const { app, BrowserWindow, dialog, ipcMain, Menu, net, protocol, shell } = require('electron')
const fs = require('node:fs/promises')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

// 앱 화면은 app:// 주소로 연다 (file:// 은 fetch·모듈 워커가 막혀 pdf.js 글꼴 파일을 못 읽는다)
const DIST = path.join(__dirname, '..', 'dist')
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
])

let win = null
let dirty = false

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    title: 'BlakPDF',
    backgroundColor: '#f1f3f5',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  Menu.setApplicationMenu(null)
  win.once('ready-to-show', () => win.show())
  win.loadURL('app://bundle/index.html')

  // 외부 링크는 기본 브라우저로
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
  // 개발자 도구: Ctrl+Shift+I
  win.webContents.on('before-input-event', (e, input) => {
    if (input.control && input.shift && input.key.toLowerCase() === 'i') win.webContents.toggleDevTools()
  })

  win.on('close', (e) => {
    if (!dirty) return
    const choice = dialog.showMessageBoxSync(win, {
      type: 'warning',
      buttons: ['저장하지 않고 닫기', '취소'],
      defaultId: 1,
      cancelId: 1,
      title: '저장하지 않은 변경',
      message: '저장하지 않은 마크업이 있습니다.',
      detail: '닫으면 마지막 저장 이후의 변경이 사라집니다.',
    })
    if (choice !== 0) e.preventDefault()
  })
}

const PDF_FILTER = [{ name: 'PDF 문서', extensions: ['pdf'] }]

async function readPdf(filePath) {
  const data = await fs.readFile(filePath)
  return { path: filePath, name: path.basename(filePath), bytes: new Uint8Array(data) }
}

ipcMain.handle('file:open', async () => {
  const r = await dialog.showOpenDialog(win, { title: 'PDF 열기', properties: ['openFile'], filters: PDF_FILTER })
  if (r.canceled || !r.filePaths[0]) return null
  return readPdf(r.filePaths[0])
})

ipcMain.handle('file:read', async (_e, filePath) => {
  if (typeof filePath !== 'string' || !filePath.toLowerCase().endsWith('.pdf')) throw new Error('PDF 파일만 열 수 있습니다.')
  return readPdf(filePath)
})

ipcMain.handle('file:save', async (_e, filePath, bytes) => {
  // 임시 파일에 먼저 쓰고 바꿔치기: 쓰다가 실패해도 원본이 깨지지 않는다
  const tmp = `${filePath}.blakpdf-tmp`
  await fs.writeFile(tmp, Buffer.from(bytes))
  await fs.rename(tmp, filePath)
  return { path: filePath, name: path.basename(filePath) }
})

ipcMain.handle('file:saveAs', async (_e, suggestedName, bytes) => {
  const r = await dialog.showSaveDialog(win, { title: '다른 이름으로 저장', defaultPath: suggestedName, filters: PDF_FILTER })
  if (r.canceled || !r.filePath) return null
  await fs.writeFile(r.filePath, Buffer.from(bytes))
  return { path: r.filePath, name: path.basename(r.filePath) }
})

ipcMain.handle('csv:save', async (_e, suggestedName, text) => {
  const r = await dialog.showSaveDialog(win, {
    title: '마크업 목록 내보내기',
    defaultPath: suggestedName,
    filters: [{ name: 'CSV (Excel)', extensions: ['csv'] }],
  })
  if (r.canceled || !r.filePath) return null
  await fs.writeFile(r.filePath, text, 'utf8')
  return r.filePath
})

ipcMain.on('doc:dirty', (_e, value) => {
  dirty = Boolean(value)
})

app.whenReady().then(() => {
  protocol.handle('app', (req) => {
    const rel = decodeURIComponent(new URL(req.url).pathname).replace(/^\/+/, '')
    const file = path.normalize(path.join(DIST, rel))
    if (!file.startsWith(DIST)) return new Response('Not found', { status: 404 })
    return net.fetch(pathToFileURL(file).toString())
  })
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
