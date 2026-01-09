#Requires AutoHotkey v2.0

; Simple script to detect Skyrim window info
; Make Skyrim the active window, then run this script

Sleep(5000)  ; Give you 5 seconds to focus Skyrim

activeWindow := WinGetTitle("A")
activeClass := WinGetClass("A")
activeID := WinGetID("A")

; Show in a message box
MsgBox("Window Title: " . activeWindow . "`n`nWindow Class: " . activeClass . "`n`nWindow ID: " . activeID)

ExitApp(0)
