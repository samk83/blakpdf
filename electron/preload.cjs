// 렌더러에 안전한 파일 기능만 노출한다
const { contextBridge, ipcRenderer, webUtils } = require('electron')

contextBridge.exposeInMainWorld('blakpdf', {
  openPdf: () => ipcRenderer.invoke('file:open'),
  readPdf: (filePath) => ipcRenderer.invoke('file:read', filePath),
  savePdf: (filePath, bytes) => ipcRenderer.invoke('file:save', filePath, bytes),
  savePdfAs: (name, bytes) => ipcRenderer.invoke('file:saveAs', name, bytes),
  saveCsv: (name, text) => ipcRenderer.invoke('csv:save', name, text),
  setDirty: (value) => ipcRenderer.send('doc:dirty', value),
  pathForFile: (file) => {
    try {
      return webUtils.getPathForFile(file) || null
    } catch {
      return null
    }
  },
})
