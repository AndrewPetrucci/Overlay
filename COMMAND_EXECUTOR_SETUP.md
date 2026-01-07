# Skyrim Command Executor (AutoHotkey)

Automatically executes console commands in Skyrim by monitoring the command queue file.

## Installation

1. **Install AutoHotkey v2.0** (free, open source)
   - Download from: https://www.autohotkey.com/
   - Install the latest v2.0 version

2. **Run the script**
   - Double-click `skyrim-command-executor.ahk` to start
   - You should see a tray icon appear (AutoHotkey script running)

## How It Works

1. **Monitors** `Documents/My Games/Skyrim Special Edition/SKSE/Plugins/overlay-commands.txt`
2. **Detects** when the wheel spins and new commands are queued
3. **Executes** by:
   - Activating Skyrim window
   - Opening console with `~` (grave/backtick key)
   - Typing the command
   - Pressing Enter
   - Closing console with Escape
4. **Clears** executed commands from the queue file

## Usage

### Normal Operation
- Start the script and leave it running
- Wheel will auto-spin every 30 seconds
- Commands will automatically execute in Skyrim
- Commands are logged to `command-executor.log`

### Right-Click Tray Menu
- **Show Log** - View the command execution log
- **Clear Queue** - Manually empty the command queue
- **Exit** - Stop the script

### Keyboard Shortcut
- **Ctrl+Alt+C** - Future toggle feature (not yet implemented)

## Troubleshooting

**Commands not executing:**
- Make sure Skyrim is running and in focus when commands are queued
- Check that the console key is `~` (backtick/grave accent)
- Look at `command-executor.log` for error messages
- Verify `overlay-commands.txt` file exists and contains commands

**Timing Issues:**
- If typing is too fast/slow, adjust `commandTypingDelay` (currently 50ms)
- Increase `commandDelay` if console operations aren't completing

**File Access Issues:**
- Make sure Skyrim folder is not read-only
- Check Windows file permissions for `Documents/My Games/Skyrim Special Edition/`

## File Locations

**Queue file:** `C:\Users\[YourUsername]\Documents\My Games\Skyrim Special Edition\SKSE\Plugins\overlay-commands.txt`

**Log file:** `C:\Users\[YourUsername]\Documents\Overlay\command-executor.log`

## Notes

- This script uses AutoHotkey v2.0 syntax
- Commands are executed in real-time as they appear in the queue
- Executed commands are automatically removed from the queue file
- The script can handle multiple commands in the queue
- Comments in the queue file (starting with #) are skipped
