const { contextBridge, ipcRenderer } = require('electron');

// Auto-generated preload.js from lifecycle manager APIs
// This file is generated automatically - do not edit manually
contextBridge.exposeInMainWorld('electron', {
    buttonClick: (clickData) => ipcRenderer.send("button-click", {clickData}),
    closeWindow: (data) => ipcRenderer.send("close-window", {data}),
    getAutoSpinConfig: () => ipcRenderer.invoke("get-auto-spin-config"),
    getConfig: () => ipcRenderer.invoke("get-config"),
    getWindowPosition: () => ipcRenderer.sendSync("get-window-position"),
    minimizeWindow: (data) => ipcRenderer.send("minimize-window", {data}),
    mouseOverInteractive: (isOver) => ipcRenderer.send("mouse-over-interactive", {isOver}),
    moveWindowBy: (deltaX, deltaY) => ipcRenderer.send("move-window", {deltaX: deltaX, deltaY: deltaY}),
    moveWindowTo: (x, y) => ipcRenderer.send("move-window-to", {x: x, y: y}),
    onLoadWheelOptions: (callback) => ipcRenderer.on("load-wheel-options", (event, data) => callback(data)),
    onSpinHotkey: (callback) => ipcRenderer.on("spin-wheel-hotkey", () => callback()),
    onSpinResult: (callback) => ipcRenderer.on("spin-result", (event, data) => callback(data)),
    onTwitchSpinTriggered: (callback) => ipcRenderer.on("twitch-spin-triggered", () => callback()),
    onTwitchStatusChanged: (callback) => ipcRenderer.on("twitch-status-changed", (event, data) => callback(data)),
    resizeWindow: (width, height) => ipcRenderer.send("resize-window", {width: width, height: height}),
    sendMessage: (channel, data) => ipcRenderer.send(channel, data),
    spinWheel: (result) => ipcRenderer.send("spin-wheel", result)
});
