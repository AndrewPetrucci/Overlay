# Preload API Lifecycle Hook

This document explains how to expose IPC handlers to the renderer process through lifecycle hooks.

## Overview

Instead of hardcoding `preload.js`, lifecycle managers can define their preload APIs using the `getPreloadAPI()` method. The framework automatically generates `preload.js` from these definitions.

## How It Works

1. Each lifecycle manager can implement `getPreloadAPI()` to return an object of API definitions
2. The framework collects all API definitions from enabled lifecycle managers
3. `preload.js` is automatically generated before windows are created
4. The generated file is regenerated after all lifecycle managers are initialized (to capture APIs that need full initialization)

## Implementing getPreloadAPI()

### Basic Example

```javascript
const { send, on, invoke } = require('../../preload-helpers');

class MyLifecycleManager extends SharedQueueManager {
    getPreloadAPI() {
        return {
            // Send a message
            myMethod: send('my-channel', 'data'),
            
            // Listen to an event
            onMyEvent: on('my-event'),
            
            // Invoke a handler
            getMyData: invoke('get-my-data')
        };
    }
}
```

### Using Preload Helpers

The `preload-helpers.js` module provides convenient functions:

- **`send(channel, args)`** - For `ipcRenderer.send()`
  - `send('my-channel', 'data')` → `(data) => ipcRenderer.send("my-channel", {data})`
  - `send('my-channel', 'x, y')` → `(x, y) => ipcRenderer.send("my-channel", {x, y})`

- **`sendSync(channel, args)`** - For `ipcRenderer.sendSync()`
  - `sendSync('get-data', 'key')` → `(key) => ipcRenderer.sendSync("get-data", {key})`

- **`invoke(channel)`** - For `ipcRenderer.invoke()`
  - `invoke('get-config')` → `() => ipcRenderer.invoke("get-config")`

- **`on(channel)`** - For `ipcRenderer.on()` with data
  - `on('my-event')` → `(callback) => ipcRenderer.on("my-event", (event, data) => callback(data))`

- **`onNoArgs(channel)`** - For `ipcRenderer.on()` without data
  - `onNoArgs('my-event')` → `(callback) => ipcRenderer.on("my-event", () => callback())`

### Custom Code Strings

You can also provide raw code strings:

```javascript
getPreloadAPI() {
    return {
        customMethod: '(arg1, arg2) => ipcRenderer.invoke("custom", arg1, arg2)',
        complexMethod: '(callback) => { /* custom logic */ }'
    };
}
```

## Examples

### File Watcher

```javascript
const { on } = require('../../preload-helpers');

getPreloadAPI() {
    return {
        onFileUpdated: on('file-updated'),
        onFileContent: on('file-content'),
        onFileWriterEvent: on('file-writer-event')
    };
}
```

### Wheel

```javascript
const { send, on, onNoArgs } = require('../../preload-helpers');

getPreloadAPI() {
    return {
        spinWheel: send('spin-wheel', 'result'),
        onSpinResult: on('spin-result'),
        onLoadWheelOptions: on('load-wheel-options'),
        onSpinHotkey: onNoArgs('spin-wheel-hotkey')
    };
}
```

## API Conflicts

If multiple lifecycle managers define the same API name, the framework will prefix the conflicting API with the window type:

- `fileWatcher_onFileUpdated` (if `onFileUpdated` conflicts)

## Core APIs

Some APIs are automatically added by the framework (from `main.js` handlers):
- Window management: `mouseOverInteractive`, `moveWindowBy`, `moveWindowTo`, etc.
- Core functionality: `getConfig`, `getAutoSpinConfig`, `sendMessage`

These are added automatically, but lifecycle managers can override them if needed.

## Best Practices

1. **Use helpers** - Prefer `preload-helpers.js` functions over raw strings for consistency
2. **Group related APIs** - Keep APIs for the same feature together
3. **Document your APIs** - Add comments in your lifecycle manager explaining what each API does
4. **Test your APIs** - Make sure the generated preload.js works correctly

## Notes

- The generated `preload.js` file is overwritten automatically - don't edit it manually
- APIs are collected both before and after lifecycle manager initialization
- If a lifecycle manager can't be instantiated early, its APIs will be collected after initialization
