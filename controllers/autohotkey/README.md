# AutoHotkey Controller

This controller uses AutoHotkey v2.0+ to automate keyboard input in Windows applications based on wheel spin results.

## Requirements

- **AutoHotkey v2.0+** - Download from https://www.autohotkey.com/download/
- Windows 7 or later
- Target application must be able to receive keyboard input

## Installation

### 1. Install AutoHotkey

1. Visit https://www.autohotkey.com/download/
2. Download the latest v2.0+ installer
3. Run the installer with default settings
4. This installs AutoHotkey to `C:\Program Files\AutoHotkey\v2\`

### 2. Add to PATH (Optional but Recommended)

In PowerShell as Administrator, run:

```powershell
$ahkPath = "C:\Program Files\AutoHotkey\v2"
$currentPath = [Environment]::GetEnvironmentVariable("PATH", "User")
if ($currentPath -notlike "*$ahkPath*") {
    [Environment]::SetEnvironmentVariable("PATH", "$currentPath;$ahkPath", "User")
}
```

This allows you to run AutoHotkey scripts directly without specifying the full path.

### 3. Verify Installation

In PowerShell, run:

```powershell
AutoHotkey.exe --version
```

You should see output like: `2.0-a### (###)`

## Scripts

### notepad-executor.ahk

Executes keyboard input in Notepad (test/demo executor).

**Workflow:**
1. Detects wheel spin result
2. Focuses Notepad window
3. Types the specified text
4. Presses Enter

**Running manually:**
```powershell
AutoHotkey.exe notepad-executor.ahk
```

## Configuration

### Modifying Scripts

Edit the `.ahk` files to customize behavior:

- **Window detection**: Change window class or title in `WinActivate()` calls
- **Timing delays**: Adjust `Sleep()` values if keyboard input is too fast/slow
- **Key sequences**: Modify `Send()` calls for different keystrokes

### Key Syntax Reference

| Syntax | Key |
|--------|-----|
| `{Enter}` | Enter key |
| `{Escape}` | Escape key |
| `{Tab}` | Tab key |
| `{BackSpace}` | Backspace key |
| `^a` | Ctrl+A |
| `^c` | Ctrl+C |
| `^v` | Ctrl+V |
| `^s` | Ctrl+S |

### Sleep Times

If keyboard input is too fast or too slow:

```ahk
Sleep(1000)  ; Wait 1 second
```

Increase for slower applications, decrease for faster response.

## Troubleshooting

### Scripts don't execute

**Problem**: "AutoHotkey.exe not found"

**Solution**: 
- Install AutoHotkey from https://www.autohotkey.com/download/
- Or add to PATH: Run the PowerShell command above
- Or use full path: `"C:\Program Files\AutoHotkey\v2\AutoHotkey.exe" script.ahk`

### Text is not being typed correctly

**Problem**: Keyboard input appears incomplete or incorrect

**Solutions**:
1. Increase sleep delays in the script:
   ```ahk
   Sleep(500)  ; Increase from 200
   ```

2. Ensure target window is active and responsive

3. Check for conflicting keyboard hooks from other software

4. Disable fast user switching / lock screen

### Window focus not working

**Problem**: Script activates but window doesn't get focus

**Solutions**:
1. Verify window class/title is correct:
   ```ahk
   WinGetActiveTitle activeTitle  ; Debug which window is active
   MsgBox, %activeTitle%
   ```

2. Try different window identification methods:
   ```ahk
   WinActivate("ahk_class ClassName")  ; By class
   WinActivate("Window Title")          ; By title
   WinActivate("ahk_pid processID")     ; By process ID
   ```

3. Add delays for slow-starting applications:
   ```ahk
   Sleep(2000)  ; Wait 2 seconds before focusing
   WinActivate("Target Window")
   ```

### Permission denied errors

**Problem**: Script won't run due to permissions

**Solution**:
- Right-click script and select "Run with AutoHotkey"
- Or run PowerShell as Administrator
- Or check file permissions: Right-click → Properties → Security

## Development Tips

### Testing a Script

Create a test script without the monitor loop:

```ahk
#Requires AutoHotkey v2.0

; Test: Focus Notepad and type hello world
WinActivate("ahk_class Notepad")
Sleep(500)
Send("hello world")
Sleep(500)
```

Run it: `AutoHotkey.exe test.ahk`

### Debugging

Add message boxes to debug:

```ahk
MsgBox("About to send keypress")
Send("hello")
MsgBox("Keypress sent")
```

### Getting Window Information

Use the built-in Window Spy tool:
1. Right-click AutoHotkey tray icon → Window Spy
2. Hover over target window
3. Copy class name, window title, etc. for your script

## References

- [AutoHotkey v2.0 Documentation](https://v2.autohotkey.com/)
- [Send Function](https://v2.autohotkey.com/docs/commands/Send.htm)
- [WinActivate Function](https://v2.autohotkey.com/docs/commands/WinActivate.htm)
- [Sleep Function](https://v2.autohotkey.com/docs/commands/Sleep.htm)
