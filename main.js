const { app, BrowserWindow, ipcMain, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const TwitchClient = require('./src/twitch');
const ModIntegration = require('./src/mod-integration');
const ApplicationConfigLoader = require('./src/application-config-loader');

const windows = {}; // Map to store windows by ID
let twitchClient;
let modIntegration;
let gameConfig;
let applicationConfigs = {};
let uniqueApplications = new Set(); // Move to global scope

// Get auto-spin setting from environment (default: false)
// Set AUTO_SPIN=true to enable
const AUTO_SPIN = process.env.AUTO_SPIN === 'true' || process.argv.includes('--enable-auto-spin');

const WINDOW_WIDTH = 600;
const WINDOW_HEIGHT = 600;

function createWindow(htmlFile = 'src/windows/wheel/index.html') {
    const window = new BrowserWindow({
        width: WINDOW_WIDTH,
        height: WINDOW_HEIGHT,
        minWidth: WINDOW_WIDTH,
        minHeight: WINDOW_HEIGHT,
        maxWidth: WINDOW_WIDTH,
        maxHeight: WINDOW_HEIGHT,
        x: require('electron').screen.getPrimaryDisplay().workAreaSize.width - WINDOW_WIDTH,
        y: require('electron').screen.getPrimaryDisplay().workAreaSize.height - WINDOW_HEIGHT,
        alwaysOnTop: true,
        transparent: true,
        frame: false,
        resizable: false,
        skipTaskbar: false,
        icon: path.join(__dirname, 'assets/icon.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false
        }
    });

    const windowId = window.id;
    windows[windowId] = window;
    console.log(`Created window with ID: ${windowId} - Loading: ${htmlFile}`);

    window.loadFile(htmlFile);

    // Force window to stay at exact size (set after load to ensure it takes effect)
    window.webContents.on('did-finish-load', () => {
        window.setMinimumSize(WINDOW_WIDTH, WINDOW_HEIGHT);
        window.setMaximumSize(WINDOW_WIDTH, WINDOW_HEIGHT);
    });

    // Start with mouse events ignored so clicks pass through
    window.setIgnoreMouseEvents(true, { forward: true });

    // Open DevTools in dev mode
    if (process.argv.includes('--dev')) {
        window.webContents.openDevTools({ mode: 'detach' });
    }

    window.on('closed', () => {
        delete windows[windowId];
        console.log(`Window ${windowId} closed`);
    });

    return windowId;
}

function registerIpcHandlers() {
    // Helper to get window from IPC event
    const getWindowFromEvent = (event) => {
        return BrowserWindow.fromWebContents(event.sender);
    };

    // Listen for messages from renderer about interactive elements
    ipcMain.on('mouse-over-interactive', (event, isOver) => {
        const window = getWindowFromEvent(event);
        if (window) {
            window.setIgnoreMouseEvents(!isOver, { forward: true });
        }
    });

    ipcMain.on('move-window', (event, { deltaX, deltaY }) => {
        const window = getWindowFromEvent(event);
        if (window) {
            const bounds = window.getBounds();
            window.setBounds({
                x: bounds.x + deltaX,
                y: bounds.y + deltaY,
                width: WINDOW_WIDTH,
                height: WINDOW_HEIGHT
            });
        }
    });

    ipcMain.on('move-window-to', (event, { x, y }) => {
        const window = getWindowFromEvent(event);
        if (window) {
            window.setBounds({
                x: x,
                y: y,
                width: WINDOW_WIDTH,
                height: WINDOW_HEIGHT
            });
        }
    });

    ipcMain.on('get-window-position', (event) => {
        const window = getWindowFromEvent(event);
        if (window) {
            const [x, y] = window.getPosition();
            event.returnValue = { x, y };
        }
    });

    ipcMain.on('resize-window', (event, { width, height }) => {
        const window = getWindowFromEvent(event);
        if (window) {
            window.setSize(width, height);
        }
    });

    // Mod integration handlers
    ipcMain.on('wheel-spin-result', (event, result) => {
        console.log('Wheel result:', result);
        // Note: Writing wheel results to file is handled by controller-specific implementations
    });

    ipcMain.on('get-mapped-mods', (event, wheelResult) => {
        const mods = modIntegration.getMappedMods(wheelResult);
        event.returnValue = mods;
    });

    ipcMain.on('trigger-mod-action', (event, { modKey, actionKey }) => {
        const result = modIntegration.triggerModAction(modKey, actionKey);
        event.returnValue = result;
    });

    ipcMain.on('get-all-mods', (event) => {
        const mods = modIntegration.getAllMods();
        event.returnValue = mods;
    });

    ipcMain.on('get-mod-config', (event, modKey) => {
        const config = modIntegration.getModConfig(modKey);
        event.returnValue = config;
    });

    ipcMain.on('set-mod-enabled', (event, { modKey, enabled }) => {
        const result = modIntegration.setModEnabled(modKey, enabled);
        event.returnValue = result;
    });

    ipcMain.on('add-wheel-mapping', (event, { wheelResult, modKey }) => {
        const result = modIntegration.addWheelMapping(wheelResult, modKey);
        event.returnValue = result;
    });

    ipcMain.on('remove-wheel-mapping', (event, { wheelResult, modKey }) => {
        const result = modIntegration.removeWheelMapping(wheelResult, modKey);
        event.returnValue = result;
    });

    ipcMain.handle('get-game-name', () => {
        return null; // No default application
    });

    ipcMain.handle('get-auto-spin-config', () => {
        return AUTO_SPIN;
    });

    ipcMain.on('minimize-window', (event) => {
        const window = getWindowFromEvent(event);
        if (window) {
            window.minimize();
        }
    });

    ipcMain.on('close-window', (event) => {
        const window = getWindowFromEvent(event);
        if (window) {
            window.close();
        }
    });
}

app.on('ready', () => {
    registerIpcHandlers();

    // Load windows configuration
    const windowsConfigPath = path.join(__dirname, 'windows-config.json');
    let windowsConfig = { windows: [] };

    try {
        const configContent = fs.readFileSync(windowsConfigPath, 'utf-8');
        windowsConfig = JSON.parse(configContent);
        console.log(`[Main] Loaded windows configuration with ${windowsConfig.windows.length} window(s)`);
    } catch (error) {
        console.warn(`[Main] Failed to load windows-config.json: ${error.message}. Using default.`);
    }

    // Create windows from config
    const createdWindows = [];
    windowsConfig.windows.forEach((windowConfig, index) => {
        if (windowConfig.enabled) {
            const windowId = createWindow(windowConfig.html);
            createdWindows.push({ id: windowId, config: windowConfig });
            console.log(`[Main] Created window "${windowConfig.name}" (ID: ${windowId}) from ${windowConfig.html}`);

            // Apply position offset if configured
            const window = windows[windowId];
            if (window && windowConfig.position && (windowConfig.position.xOffset !== 0 || windowConfig.position.yOffset !== 0)) {
                window.webContents.once('did-finish-load', () => {
                    const bounds = window.getBounds();
                    window.setBounds({
                        x: bounds.x + windowConfig.position.xOffset,
                        y: bounds.y + windowConfig.position.yOffset,
                        width: bounds.width,
                        height: bounds.height
                    });
                    console.log(`[Main] Positioned window "${windowConfig.name}" at offset (${windowConfig.position.xOffset}, ${windowConfig.position.yOffset})`);
                });
            }

            // Pass wheel options to wheel window via IPC
            if (windowConfig.id === 'wheel' && windowConfig.wheelOptions) {
                window.webContents.once('did-finish-load', () => {
                    window.webContents.send('load-wheel-options', windowConfig.wheelOptions);
                    console.log(`[Main] Sent ${windowConfig.wheelOptions.length} wheel options to wheel window`);
                });
            }
        } else {
            console.log(`[Main] Window "${windowConfig.name}" is disabled, skipping creation`);
        }
    });

    // Extract wheel options from config instead of loading from file
    const wheelWindowConfig = windowsConfig.windows.find(w => w.id === 'wheel');
    let allWheelOptions = wheelWindowConfig?.wheelOptions || [];
    uniqueApplications.clear(); // Clear any previous applications

    // Extract unique applications
    allWheelOptions.forEach(option => {
        if (option.application) {
            uniqueApplications.add(option.application.toLowerCase());
        }
    });

    console.log(`[Main] Discovered applications: ${Array.from(uniqueApplications).join(', ')}`);
    console.log(`[Main] Loaded ${allWheelOptions.length} wheel options from windows-config.json`);

    // Load configuration for each discovered application
    uniqueApplications.forEach(appName => {
        try {
            const configLoader = new ApplicationConfigLoader(appName);
            applicationConfigs[appName] = configLoader.loadAll();
            console.log(`[Main] Loaded configuration for application: ${appName}`);
        } catch (error) {
            console.warn(`[Main] Failed to load config for ${appName}: ${error.message}`);
        }
    });

    // Use first discovered application as reference (or null if none)
    gameConfig = Object.values(applicationConfigs)[0] || {
        wheelOptions: allWheelOptions,
        executorScript: null
    };

    console.log(`[Main] Loaded configuration for ${uniqueApplications.size} application(s): ${Array.from(uniqueApplications).join(', ')}`);
    console.log(`[Main] Total wheel options: ${allWheelOptions.length}`);
    console.log(`[Main] System is application-agnostic - applications defined by wheel-options.json`);

    // Build application -> controller and controller -> application mappings
    const appToControllers = {};  // app -> Set<controllers>
    const controllerToApps = {}; // controller -> Set<apps>

    allWheelOptions.forEach(option => {
        const app = option.application;
        const controller = option.controller;

        if (app && controller) {
            // Add to appToControllers mapping
            if (!appToControllers[app]) {
                appToControllers[app] = new Set();
            }
            appToControllers[app].add(controller);

            // Add to controllerToApps mapping
            if (!controllerToApps[controller]) {
                controllerToApps[controller] = new Set();
            }
            controllerToApps[controller].add(app);
        }
    });

    // Convert Sets to Arrays for logging and saving
    const appToControllersLog = {};
    const controllerToAppsLog = {};

    Object.keys(appToControllers).forEach(app => {
        appToControllersLog[app] = Array.from(appToControllers[app]);
    });

    Object.keys(controllerToApps).forEach(controller => {
        controllerToAppsLog[controller] = Array.from(controllerToApps[controller]);
    });

    console.log('[Main] Application -> Controller Mappings:', appToControllersLog);
    console.log('[Main] Controller -> Application Mappings:', controllerToAppsLog);

    // Save mapping files to application data directory (not game-specific)
    const appDataDir = path.join(process.env.APPDATA, 'TwitchWheel');
    const appToControllersFile = path.join(appDataDir, 'app-to-controllers.json');
    const controllerToAppsFile = path.join(appDataDir, 'controller-to-apps.json');

    try {
        // Ensure directory exists
        if (!fs.existsSync(appDataDir)) {
            fs.mkdirSync(appDataDir, { recursive: true });
            console.log(`[Main] Created application data directory: ${appDataDir}`);
        }

        // Write app -> controllers mapping
        fs.writeFileSync(appToControllersFile, JSON.stringify(appToControllersLog, null, 2));
        console.log(`[Main] Saved app-to-controllers mapping to ${appToControllersFile}`);

        // Write controller -> apps mapping
        fs.writeFileSync(controllerToAppsFile, JSON.stringify(controllerToAppsLog, null, 2));
        console.log(`[Main] Saved controller-to-apps mapping to ${controllerToAppsFile}`);
    } catch (error) {
        console.warn(`[Main] Failed to save mapping files: ${error.message}`);
    }

    // Initialize Mod Integration with current application
    const currentApp = Array.from(uniqueApplications)[0] || null;
    modIntegration = new ModIntegration('mod-config.json', appToControllersLog, controllerToAppsLog, currentApp);
    console.log('Mod Integration initialized');

    // Initialize Twitch Client (optional - skip if credentials missing)
    try {
        if (process.env.TWITCH_BOT_USERNAME && process.env.TWITCH_OAUTH_TOKEN && process.env.TWITCH_CHANNEL) {
            twitchClient = new TwitchClient();
            twitchClient.connect();
        } else {
            console.log('Twitch credentials not configured - Twitch integration disabled');
            const spinStatus = AUTO_SPIN ? 'Auto-spin enabled' : 'Auto-spin disabled';
            console.log(`[Main] ${spinStatus} (configurable via AUTO_SPIN environment variable)`);
        }
    } catch (error) {
        console.warn('Failed to initialize Twitch client:', error.message);
        console.log('Continuing without Twitch integration...');
    }

    // Clear log files and event queue on startup
    clearStartupQueues();
});

function clearStartupQueues() {
    const logFile = path.join(__dirname, 'command-executor.log');

    // Clear AutoHotkey log
    try {
        if (fs.existsSync(logFile)) {
            fs.writeFileSync(logFile, '');
            console.log('Cleared command executor log');
        }
    } catch (error) {
        console.warn('Could not clear log:', error);
    }
}

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (Object.keys(windows).length === 0) {
        createWindow('src/windows/wheel/index.html');
    }
});

// IPC Handlers
ipcMain.on('spin-wheel', (event, wheelResult) => {
    try {
        console.log('Wheel spun! Result:', wheelResult);

        // wheelResult is now the full option object with config
        if (wheelResult.config) {
            // Determine which executor to use based on application and controller
            const application = wheelResult.application || 'Notepad';
            const controller = wheelResult.controller || 'AutoHotkey';

            if (controller === 'AutoHotkey') {
                // Execute executor.ahk with entire config object as JSON
                const ahkScript = path.join(__dirname, 'controllers', 'autohotkey', 'executor.ahk');
                const configJson = JSON.stringify(wheelResult.config);

                // Get the application's AutoHotkey configuration (use lowercase for lookup)
                const appConfig = applicationConfigs[application.toLowerCase()] || {};
                const autohotKeyConfig = appConfig.controllers?.AutoHotkey || {};
                const autohotKeyJson = JSON.stringify(autohotKeyConfig);

                console.log(`Executing: ${ahkScript} with config: ${configJson}`);
                console.log(`With AutoHotkey config: ${autohotKeyJson}`);

                // Use AutoHotkey executable directly, not PowerShell
                const ahkExe = 'C:\\Program Files\\AutoHotkey\\v2\\AutoHotkey.exe';
                spawn(ahkExe, [ahkScript, configJson, autohotKeyJson], {
                    detached: false,
                    stdio: 'ignore'
                }).unref();
            }
        }

        // TODO: Send to Skyrim mod via HTTP or file I/O
        // For now, just broadcast back to renderer
        const window = BrowserWindow.fromWebContents(event.sender);
        if (window && window.webContents) {
            window.webContents.send('spin-result', wheelResult.name || wheelResult);
        }
    } catch (error) {
        console.error('Error handling spin-wheel:', error);
        // Silently handle errors (e.g., broken pipe, closed window)
        // Don't crash the process
    }
});

ipcMain.on('twitch-status-request', (event) => {
    event.sender.send('twitch-status', {
        isConnected: twitchClient && twitchClient.isConnected
    });
});

ipcMain.handle('get-config', async () => {
    // Return available applications and their wheel options
    const wheelOptionsMap = {};
    Object.entries(applicationConfigs).forEach(([appName, config]) => {
        wheelOptionsMap[appName] = config.wheelOptions ? config.wheelOptions.map(opt => opt.name) : [];
    });

    return {
        applications: Array.from(uniqueApplications),
        wheelOptions: wheelOptionsMap,
        channel: process.env.TWITCH_CHANNEL || 'your_channel'
    };
});
