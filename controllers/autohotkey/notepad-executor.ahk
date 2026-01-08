#Requires AutoHotkey v2.0

; Notepad Command Executor via AutoHotkey v2
; Executes keyboard commands in the Notepad window
;
; WORKFLOW:
; 1. Detects wheel spin result
; 2. Focuses Notepad window
; 3. Sends appropriate keyboard input
; 4. Logs execution

A_SendMode := "Input"

; Configuration
notepadWindowTitle := "ahk_class Notepad"
checkIntervalMs := 500  ; Check for new commands every 500ms

; Main execution
Execute()

Execute()
{
    ; First, focus on Notepad window
    try
    {
        WinActivate(notepadWindowTitle)
        Sleep(500)
    }
    catch
    {
        ; Try by class name directly
        WinActivate("ahk_class Notepad")
        Sleep(500)
    }
    
    ; Verify Notepad is active
    activeTitle := WinGetTitle("A")
    if (!InStr(activeTitle, "Notepad") && !InStr(activeTitle, "Untitled"))
    {
        MsgBox(0x10, "Error", "Failed to activate Notepad window")
        ExitApp(1)
    }
    
    ; Type "hello world" character by character to ensure proper input
    Send("h")
    Sleep(50)
    Send("e")
    Sleep(50)
    Send("l")
    Sleep(50)
    Send("l")
    Sleep(50)
    Send("o")
    Sleep(50)
    Send(" ")
    Sleep(50)
    Send("w")
    Sleep(50)
    Send("o")
    Sleep(50)
    Send("r")
    Sleep(50)
    Send("l")
    Sleep(50)
    Send("d")
    Sleep(100)
    
    ; Press Enter to confirm
    Send("{Enter}")
    Sleep(500)
    
    ExitApp(0)
}
