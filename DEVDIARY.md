# Development Diary

## Overview
I wanted an informal space to chronical my thoughts and how the project is progressing. Oldest -> Newest.

## Diary

### 1/9/2026
Diary - Now you may be asking; What is this project???
In simple terms, that depends on what type of person you are.
1. The streamer! - a highly customizable twitch integration that hands you the keys to the kingdom.
2. The gamer! - Custom ui overlays for your favorite games! Want to make a game in a game? Here is a tool to do it!
3. The technologist! - All of your tools have interfaces and it would be sick if your tools talked to each other.
4. The stranger! - If not the above reason please email me why you are here!

My goal is to make this relatively lightweight framework with plug and play functionality for a variety of integrations and ui elements.

The current implementation has been tested from the ui, to autohotkey, to a target application (notepad/skyrim).

#### Step-by-Step Flow

1. **Wheel Spin Triggered** (`src/wheel.js`)
   - renders wheel options based off the root wheel-options.json. This is effectively the api you as the human care about.
   - User clicks SPIN button or auto-spin activates

2. **Spin Complete** (`src/wheel.js` - `onSpinComplete()`)
   - Calculates winning option based on final rotation
   - Passes the selected option object to the rest of the system (includes config with action, value, etc.)

3. **Electron Main Process**
   - Receives option object via IPC
   - Sends the event to wherever it needs to go. (currently it just spawns the autohotkey process directly)
   - Spawns AutoHotkey executor process with config as JSON argument

4. **AutoHotkey Executor** (`controllers/autohotkey/executor.ahk`)
   - Recieves and parses json configurations
   - auto focuses the target applicaiton
   - Does an operation based off said json congigs that either sends keys or inserts text.

5. **Notepad Receives Text**
   - This is the target application where the text gets written or commands getsent! Enjoy your ascii art hud!
