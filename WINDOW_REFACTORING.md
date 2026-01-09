# Window Refactoring Complete

## What Was Done

### 1. **Folder Structure**
Created a modular window system under `src/windows/`:

```
src/windows/
├── wheel/              (Existing wheel implementation)
│   ├── index.html      (UI)
│   ├── styles.css      (Styling)
│   ├── wheel.js        (Spin wheel class)
│   ├── window-bar.js   (Window controls)
│   ├── twitch-client.js (Twitch integration)
│   └── mod-client.js   (Mod system)
│
├── boilerplate/        (Template for future windows)
│   ├── index.html      (Basic UI template)
│   ├── styles.css      (Base styling)
│   ├── app.js          (Main application class)
│   └── window-controls.js (Min/close handlers)
│
└── README.md           (Complete documentation)
```

### 2. **Window Manager System**
- Updated `main.js` to support creating multiple windows
- `createWindow(htmlFile)` function accepts path to window HTML
- Each window gets a unique ID for tracking
- Windows are stored in a `windows` map by their ID
- IPC handlers use `BrowserWindow.fromWebContents()` to identify the window

### 3. **Currently Running**
The app now creates **two windows**:
1. **Wheel Window** - `src/windows/wheel/index.html` (right side)
2. **Boilerplate Window** - `src/windows/boilerplate/index.html` (left side, positioned offset)

### 4. **Boilerplate Template**
A complete template for creating new windows with:
- **index.html** - Basic responsive UI structure
- **styles.css** - Pre-styled with consistent color scheme
- **app.js** - Application class with event setup pattern
- **window-controls.js** - Standard minimize/close button handling
- Clear comments for customization

## How to Create New Windows

### Step 1: Copy Template
```
cp -r src/windows/boilerplate src/windows/my-window
```

### Step 2: Edit Files
- Update `index.html` with your UI
- Customize `styles.css` for your design
- Add logic to `app.js` (rename the class)
- Add additional `.js` files as needed

### Step 3: Register in main.js
```javascript
const myWindowId = createWindow('src/windows/my-window/index.html');
```

## Key Features

✅ **Modular** - Each window is self-contained  
✅ **Dynamic IPC** - Handlers work with any window  
✅ **Template** - Boilerplate for quick setup  
✅ **Documentation** - Comprehensive README in `src/windows/`  
✅ **Scalable** - Easy to add more windows  
✅ **Consistent** - Shared styling patterns and conventions  

## File Paths

Old structure still exists for backwards compatibility:
- `src/index.html` → Now in `src/windows/wheel/index.html`
- `src/wheel.js` → Now in `src/windows/wheel/wheel.js`
- `src/styles.css` → Now in `src/windows/wheel/styles.css`
- etc.

*Note: Original files can be deleted or kept as reference.*

## IPC & Electron API

All windows use the same preload API accessed via `window.electron`:

```javascript
// Window controls
window.electron.minimizeWindow();
window.electron.closeWindow();

// Mouse events
window.electron.mouseOverInteractive(true);
window.electron.mouseOverInteractive(false);

// Window positioning
window.electron.getWindowPosition();
window.electron.moveWindowTo(x, y);

// Wheel-specific (in wheel window)
window.electron.spinWheel(result);
window.electron.getAllMods();
// etc.
```

## Next Steps

1. **Old files**: Can be deleted from `src/` root if desired
2. **Add more windows**: Copy boilerplate, customize, register in main.js
3. **Window communication**: Implement if windows need to talk to each other
4. **Settings**: Create a settings window from the boilerplate
5. **Dashboard**: Create a monitoring/control dashboard

## Debugging

Each window logs with a prefix:
```
[Wheel] Window spun with result...
[BoilerplateApp] Initializing...
```

Run with DevTools:
```bash
npm start -- --dev
```

All windows will have DevTools open.

---

**Summary**: You now have an encapsulated wheel window, a boilerplate template for future windows, and the ability to easily create multiple independent windows that all work with the same backend system!
