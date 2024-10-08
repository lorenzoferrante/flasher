// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  selectDirectory: () => ipcRenderer.invoke('dialog:selectDirectory'),
  receiveBranches: (callback) => ipcRenderer.on('git-branches', (event, branches) => callback(branches)),
  receiveFetchResult: (callback) => ipcRenderer.on('git-fetch', (event, fetchResult) => callback(fetchResult)),
  checkoutAndPull: (branch) => ipcRenderer.invoke('git-checkout-and-pull', branch),
  buildAndFlash: () => ipcRenderer.invoke('build-and-flash'),
  receiveBuildResult: (callback) => ipcRenderer.on('build-result', (event, result) => callback(result)),
});