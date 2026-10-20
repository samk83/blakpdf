// 화면(React)이 쓸 수 있는 기능만 골라서 연결한다 (Node 전체를 열지 않음)
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('blakpdf', {
  openFile: () => ipcRenderer.invoke('open-file'),
  saveFile: (path, data, suggestedName) => ipcRenderer.invoke('save-file', { path, data, suggestedName }),
  onMenu: (cb) => {
    const listener = (_e, cmd) => cb(cmd);
    ipcRenderer.on('menu', listener);
    return () => ipcRenderer.removeListener('menu', listener);
  },
  setDirty: (dirty) => ipcRenderer.send('set-dirty', dirty),
  setTitle: (title) => ipcRenderer.send('set-title', title),
});
