const tmi = require('tmi.js');

class TwitchClient {
    constructor() {
        this.client = null;
        this.isConnected = false;
        this.setupClient();
    }

    setupClient() {
        // Configure with your Twitch credentials
        this.client = new tmi.Client({
            options: { debug: false },
            connection: { reconnect: true, secure: true },
            identity: {
                username: process.env.TWITCH_BOT_USERNAME || 'your_bot_username',
                password: process.env.TWITCH_OAUTH_TOKEN || 'oauth:your_token_here'
            },
            channels: [process.env.TWITCH_CHANNEL || 'your_channel']
        });

        this.setupEventHandlers();
    }

    setupEventHandlers() {
        this.client.on('connected', () => {
            console.log('Connected to Twitch Chat');
            this.isConnected = true;
            // Notify renderer of successful connection
            const { BrowserWindow } = require('electron');
            const mainWindow = BrowserWindow.getAllWindows()[0];
            if (mainWindow) {
                mainWindow.webContents.send('twitch-status-changed', { isConnected: true });
            }
        });

        this.client.on('message', (channel, tags, message, self) => {
            if (self) return;

            // Check for !spin command
            if (message.toLowerCase() === '!spin') {
                console.log(`${tags.username} triggered spin`);
                // Emit event to main window
                const mainWindow = require('electron').BrowserWindow.getAllWindows()[0];
                if (mainWindow) {
                    mainWindow.webContents.send('twitch-spin-triggered', {
                        user: tags.username,
                        timestamp: new Date()
                    });
                }
            }
        });

        this.client.on('cheer', (channel, userstate, message) => {
            console.log(`${userstate.username} cheered ${userstate.bits} bits!`);
            // Trigger spin on cheer
            const mainWindow = require('electron').BrowserWindow.getAllWindows()[0];
            if (mainWindow) {
                mainWindow.webContents.send('twitch-cheer-received', {
                    user: userstate.username,
                    bits: userstate.bits
                });
            }
        });

        this.client.on('error', (error) => {
            console.error('Twitch client error:', error);
            this.isConnected = false;
            // Notify renderer of connection failure
            const { BrowserWindow } = require('electron');
            const mainWindow = BrowserWindow.getAllWindows()[0];
            if (mainWindow) {
                mainWindow.webContents.send('twitch-status-changed', { isConnected: false });
            }
        });
    }

    connect() {
        if (!this.client) return;

        this.client.connect().catch(error => {
            console.error('Failed to connect to Twitch:', error);
            console.log('Set TWITCH_BOT_USERNAME, TWITCH_OAUTH_TOKEN, and TWITCH_CHANNEL environment variables');

            // Notify renderer of connection failure
            this.isConnected = false;
            const { BrowserWindow } = require('electron');
            const mainWindow = BrowserWindow.getAllWindows()[0];
            if (mainWindow) {
                mainWindow.webContents.send('twitch-status-changed', { isConnected: false });
            }
        });
    }

    disconnect() {
        if (this.client) {
            this.client.disconnect();
        }
    }
}

module.exports = TwitchClient;
