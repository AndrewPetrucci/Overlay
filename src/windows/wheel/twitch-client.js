class TwitchIntegration {
    constructor() {
        this.isConnected = false;
        this.channel = 'your_channel'; // Replace with your Twitch channel
        this.chatStatus = document.getElementById('chatStatus');
        this.setupListeners();
    }

    setupListeners() {
        // Listen for connection status changes from backend
        if (window.electron) {
            window.electron.onTwitchStatusChanged((status) => {
                this.isConnected = status.isConnected;
                if (status.isConnected) {
                    this.updateStatus('Connected to Twitch', 'connected');
                } else {
                    this.updateStatus('Connection failed', 'error');
                }
            });
        }
    }

    async connect() {
        try {
            this.updateStatus('Connecting to Twitch...', 'connecting');
            // Status will be updated by backend event listener
        } catch (error) {
            console.error('Twitch connection error:', error);
            this.updateStatus('Connection failed', 'error');
        }
    }

    setupEventHandlers() {
        this.client.on('message', (channel, userstate, message, self) => {
            if (self) return;

            if (message.toLowerCase() === '!spin') {
                document.getElementById('spinButton').click();
            }
        });

        this.client.on('cheer', (channel, userstate, message) => {
            console.log('Cheer received:', userstate.bits);
            document.getElementById('spinButton').click();
        });
    }

    updateStatus(message, status) {
        let icon = '';
        if (status === 'connecting') {
            icon = '⏳';
        } else if (status === 'connected') {
            icon = '✅';
        } else if (status === 'error') {
            icon = '❌';
        }
        this.chatStatus.textContent = `Twitch: ${icon}`;
        this.chatStatus.className = status;
    }
}

// Initialize Twitch integration when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.twitch = new TwitchIntegration();
    window.twitch.connect();
});
