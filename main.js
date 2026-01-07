const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const TwitchClient = require('./src/twitch');

let mainWindow;
let twitchClient;

const WINDOW_WIDTH = 600;
const WINDOW_HEIGHT = 600;

function createWindow() {
    mainWindow = new BrowserWindow({
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

    mainWindow.loadFile('src/index.html');

    // Force window to stay at exact size (set after load to ensure it takes effect)
    mainWindow.webContents.on('did-finish-load', () => {
        mainWindow.setMinimumSize(WINDOW_WIDTH, WINDOW_HEIGHT);
        mainWindow.setMaximumSize(WINDOW_WIDTH, WINDOW_HEIGHT);
    });

    // Start with mouse events ignored so clicks pass through
    mainWindow.setIgnoreMouseEvents(true, { forward: true });

    // Listen for messages from renderer about interactive elements
    ipcMain.on('mouse-over-interactive', (event, isOver) => {
        mainWindow.setIgnoreMouseEvents(!isOver, { forward: true });
    });

    ipcMain.on('move-window', (event, { deltaX, deltaY }) => {
        const bounds = mainWindow.getBounds();
        mainWindow.setBounds({
            x: bounds.x + deltaX,
            y: bounds.y + deltaY,
            width: WINDOW_WIDTH,
            height: WINDOW_HEIGHT
        });
    });

    ipcMain.on('move-window-to', (event, { x, y }) => {
        mainWindow.setBounds({
            x: x,
            y: y,
            width: WINDOW_WIDTH,
            height: WINDOW_HEIGHT
        });
    });

    ipcMain.on('get-window-position', (event) => {
        const [x, y] = mainWindow.getPosition();
        event.returnValue = { x, y };
    });

    ipcMain.on('resize-window', (event, { width, height }) => {
        mainWindow.setSize(width, height);
    });

    ipcMain.on('minimize-window', () => {
        mainWindow.minimize();
    });

    ipcMain.on('close-window', () => {
        mainWindow.close();
    });

    // Open DevTools in dev mode
    if (process.argv.includes('--dev')) {
        mainWindow.webContents.openDevTools({ mode: 'detach' });
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.on('ready', () => {
    createWindow();

    // Initialize Twitch Client
    twitchClient = new TwitchClient();
    twitchClient.connect();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});

// IPC Handlers
ipcMain.on('spin-wheel', (event, wheelResult) => {
    console.log('Wheel spun! Result:', wheelResult);

    // TODO: Send to Skyrim mod via HTTP or file I/O
    // For now, just broadcast back to renderer
    mainWindow.webContents.send('spin-result', wheelResult);
});

ipcMain.on('twitch-status-request', (event) => {
    event.sender.send('twitch-status', {
        isConnected: twitchClient && twitchClient.isConnected
    });
});

ipcMain.handle('get-config', async () => {
    let wheelOptions = [];
    try {
        const csvPath = path.join(__dirname, 'options.csv');
        const csvContent = fs.readFileSync(csvPath, 'utf-8');
        wheelOptions = csvContent.split('\n').filter(line => line.trim() !== '');
    } catch (error) {
        console.error('Failed to read options.csv:', error);
        wheelOptions = [
            'Teleport to random location',
            'Give random weapon',
            'Spawn enemy',
            'Apply random spell',
            'Set difficulty to max',
            'Give 10000 gold',
            'Blind effect',
            'Speed boost'
        ];
    }

    return {
        channel: process.env.TWITCH_CHANNEL || 'your_channel',
        wheelOptions: wheelOptions
    };
});
