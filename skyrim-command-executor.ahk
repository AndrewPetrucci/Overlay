; Skyrim Console Command Executor via AutoHotkey v2.0
; Monitors overlay-commands.txt and executes commands in Skyrim console

#Requires AutoHotkey v2.0

; Configuration
commandQueueFile := EnvGet("USERPROFILE") . "\Documents\My Games\Skyrim Special Edition\SKSE\Plugins\overlay-commands.txt"
logFile := A_ScriptDir . "\command-executor.log"
checkInterval := 2000  ; Check every 2 seconds
commandDelay := 100    ; Delay between console operations (ms)
commandTypingDelay := 30  ; Delay between typing characters (ms)

; Global state
executedCommands := ""
isProcessing := false

; Initialize tray
A_TrayMenu.Add("Show Log", ShowLogFile)
A_TrayMenu.Add("Exit", ExitScript)

; Log startup
LogMessage("Script started - monitoring " . commandQueueFile)

; Main monitoring timer
SetTimer(MonitorCommandQueue, checkInterval)

return

MonitorCommandQueue() {
    global commandQueueFile, isProcessing
    
    if (isProcessing) {
        return
    }
    
    if (!FileExist(commandQueueFile)) {
        return
    }
    
    ; Read file
    try {
        fileContent := FileRead(commandQueueFile)
    } catch {
        return
    }
    
    if (fileContent = "") {
        return
    }
    
    ; Process each line
    lines := StrSplit(Trim(fileContent), "`n")
    
    for index, line in lines {
        line := Trim(line)
        if (line = "" || SubStr(line, 1, 1) = "#") {
            continue
        }
        
        isProcessing := true
        ExecuteConsoleCommand(line)
        isProcessing := false
        
        Sleep(200)
    }
    
    ; Clear the file
    try {
        FileDelete(commandQueueFile)
        FileAppend("", commandQueueFile)
    } catch {
        ; Ignore
    }
}

ExecuteConsoleCommand(command) {
    global commandDelay, commandTypingDelay
    
    LogMessage("Executing: " . command)
    
    ; Try to activate Skyrim by window title
    try {
        WinActivate("Skyrim Special Edition")
    } catch {
        LogMessage("ERROR: Skyrim window not found")
        return
    }
    
    Sleep(commandDelay)
    
    ; Open console
    Send("``")
    Sleep(commandDelay)
    
    ; Type command character by character
    Loop Parse command {
        Send(A_LoopField)
        Sleep(commandTypingDelay)
    }
    
    Sleep(commandDelay)
    
    ; Execute
    Send("{Enter}")
    Sleep(commandDelay)
    
    ; Close console
    Send("{Escape}")
    Sleep(commandDelay)
    
    LogMessage("OK: " . command)
}

LogMessage(msg) {
    global logFile
    timestamp := FormatTime(A_Now, "HH:mm:ss")
    entry := "[" . timestamp . "] " . msg . "`n"
    
    try {
        FileAppend(entry, logFile)
    }
}

ShowLogFile(ItemName, ItemID, MenuName) {
    global logFile
    if (FileExist(logFile)) {
        Run("notepad " . logFile)
    }
}

ExitScript(ItemName, ItemID, MenuName) {
    LogMessage("Script stopped")
    ExitApp()
}
