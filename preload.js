const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    spinWheel: (result) => ipcRenderer.send('spin-wheel', result),
    onSpinResult: (callback) => ipcRenderer.on('spin-result', (event, result) => callback(result)),
    onTwitchStatusChanged: (callback) => ipcRenderer.on('twitch-status-changed', (event, status) => callback(status)),
    mouseOverInteractive: (isOver) => ipcRenderer.send('mouse-over-interactive', isOver),
    setWindowDragging: (isDragging) => ipcRenderer.send('set-window-dragging', isDragging),
    moveWindowBy: (deltaX, deltaY) => ipcRenderer.send('move-window', { deltaX, deltaY }),
    moveWindowTo: (x, y) => ipcRenderer.send('move-window-to', { x, y }),
    getWindowPosition: () => ipcRenderer.sendSync('get-window-position'),
    getConfig: () => ipcRenderer.invoke('get-config'),
    removeSpinResultListener: () => ipcRenderer.removeAllListeners('spin-result'),
    minimizeWindow: () => ipcRenderer.send('minimize-window'),
    closeWindow: () => ipcRenderer.send('close-window')
});
