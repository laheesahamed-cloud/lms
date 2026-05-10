const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('lmsDesktop', {
  titlebarDoubleClick() {
    ipcRenderer.send('lms:titlebar-double-click');
  },
});
