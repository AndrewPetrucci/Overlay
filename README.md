# Skyrim Twitch Wheel Overlay

An Electron-based overlay application that displays an interactive spinning wheel controlled by Twitch chat events. Perfect for streamers who want to add interactivity to their Skyrim streams.

## Features

- **Interactive Spinning Wheel** - Visual wheel that spins with smooth animations
- **Twitch Integration** - Responds to `!spin` chat commands and cheer events
- **Always-on-Top Window** - Stays above your game window
- **Customizable Options** - Easy to modify wheel options
- **Transparent Window** - Blends seamlessly with your game

## Setup Instructions

### Prerequisites

- Node.js 14+ installed
- Twitch account with OAuth token

### Installation

1. Install dependencies:
```bash
npm install
```

2. Get your Twitch OAuth token:
   - Go to https://twitchtokengenerator.com/
   - Generate an OAuth token for your bot account
   - Copy the token (starts with `oauth:`)

3. Configure environment variables:

Create a `.env` file in the project root:
```
TWITCH_BOT_USERNAME=your_bot_username
TWITCH_OAUTH_TOKEN=oauth:your_token_here
TWITCH_CHANNEL=your_channel_name
```

### Running the Application

```bash
npm start
```

For development with DevTools:
```bash
npm run dev
```

## Customizing the Wheel

Edit `src/wheel.js` to modify the wheel options array:

```javascript
options = [
  'Teleport to random location',
  'Give random weapon',
  'Spawn enemy',
  'Your custom option here',
  // ...
];
```

Or edit the `wheelOptions` in `main.js` under the `get-config` IPC handler.

## Twitch Integration

### Chat Commands

- `!spin` - Triggers the wheel to spin

### Cheer Events

- Cheers automatically trigger a wheel spin

### Setting Up Chat Commands

Make sure your bot account has the proper permissions in your channel. You may need to:
1. Make the bot a moderator
2. Configure bot permissions in your Twitch channel settings

## Connecting to Skyrim

To actually make changes in Skyrim based on wheel results, you have two options:

### Option 1: SKSE Mod (Recommended)
Create an SKSE mod that listens for HTTP requests and executes the commands. See `docs/skyrim-mod-setup.md` for details.

### Option 2: File-Based Communication
The wheel results are written to a file that an SKSE mod can read:
- Results are saved to `wheel_result.txt`
- Your mod reads this file and executes the command

## Architecture

- **main.js** - Electron main process, handles window management
- **preload.js** - Security bridge between renderer and main process
- **src/wheel.js** - Wheel physics and animation logic
- **src/twitch.js** - Twitch chat client integration
- **src/twitch-client.js** - Renderer process Twitch handler
- **src/index.html** - UI markup
- **src/styles.css** - Styling for the overlay

## Troubleshooting

### Wheel doesn't spin
- Check that `spinButton` exists in HTML
- Verify no JavaScript errors in DevTools (npm run dev)

### Twitch not connecting
- Verify OAuth token is correct and not expired
- Check bot username and channel name
- Make sure bot is in the channel

### Overlay not staying on top
- Verify `alwaysOnTop: true` in main.js
- Windows may prevent this for security reasons

## Next Steps

1. Set up Twitch OAuth token
2. Test wheel spinning locally
3. Create SKSE mod or file-based integration
4. Customize wheel options for your stream
5. Build executable with `npm run build`

## License

MIT
