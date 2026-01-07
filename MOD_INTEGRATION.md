# Skyrim Mod Integration Guide

This overlay has an extensible mod integration system that supports multiple mods with different action types.

## How It Works

1. **Wheel Spin**: When the wheel completes a spin, it determines the winning result
2. **Mod Registry**: The system looks up which mods are mapped to that result
3. **Actions Executed**: Each mapped mod's action is executed and written to a JSON file
4. **Mod Reads**: Your Skyrim mod monitors the JSON file and executes effects

Data is written to:
```
C:\Users\[YourUsername]\Documents\My Games\Skyrim Special Edition\SKSE\Plugins\overlay-data.json
```

## Configuration

Edit `mod-config.json` to define mods, their actions, and wheel mappings:

```json
{
  "dataPath": "%USERPROFILE%\\Documents\\My Games\\Skyrim Special Edition\\SKSE\\Plugins\\overlay-data.json",
  "mods": {
    "sillyDeathPhysics": {
      "name": "Silly Death Physics",
      "nexusModId": 15927,
      "enabled": true,
      "actions": {
        "toggle": {
          "type": "toggle",
          "key": "sillyphysics"
        }
      }
    },
    "anotherMod": {
      "name": "Another Mod Example",
      "nexusModId": 12345,
      "enabled": false,
      "actions": {
        "execute": {
          "type": "execute",
          "command": "SomeModCommand"
        }
      }
    }
  },
  "wheelMappings": {
    "Dragons": ["sillyDeathPhysics"],
    "Spiders": ["sillyDeathPhysics", "anotherMod"],
    "Fire": ["sillyDeathPhysics"]
  }
}
```

## Mod Definition

Each mod in the `mods` object contains:

- **name**: Human-readable mod name
- **nexusModId**: Nexus Mods ID (for reference)
- **enabled**: Whether the mod is active (default: true)
- **actions**: Object containing action definitions

### Action Types

#### Toggle Action
Toggles a boolean flag in the mod:
```json
"actions": {
  "toggle": {
    "type": "toggle",
    "key": "flagName"
  }
}
```

#### Execute Action
Executes a command in the mod:
```json
"actions": {
  "execute": {
    "type": "execute",
    "command": "ConsoleCommand"
  }
}
```

#### Set Action
Sets a value in the mod:
```json
"actions": {
  "setValue": {
    "type": "set",
    "key": "settingName",
    "value": 42
  }
}
```

## Wheel Mappings

The `wheelMappings` object maps wheel results to arrays of mods:

```json
"wheelMappings": {
  "ResultName": ["modKey1", "modKey2"],
  "AnotherResult": ["modKey3"]
}
```

Multiple mods can respond to the same wheel result. All enabled mods in the array will be triggered.

## Output Format

When a wheel spins, a JSON file is written:

```json
{
  "result": "Dragons",
  "timestamp": "2026-01-06T12:34:56.789Z",
  "mods": ["sillyDeathPhysics"],
  "actions": [
    {
      "action": "toggle",
      "mod": "sillyDeathPhysics",
      "key": "sillyphysics",
      "timestamp": "2026-01-06T12:34:56.789Z"
    }
  ]
}
```

## Runtime API (from overlay)

The mod client exposes methods for dynamic control:

```javascript
// Trigger a mod action manually
modClient.toggleMod('sillyDeathPhysics', true);

// Add a new wheel mapping at runtime
modClient.addMapping('NewResult', 'sillyDeathPhysics');

// Remove a wheel mapping
modClient.removeMapping('Dragons', 'sillyDeathPhysics');

// Get mod configuration
const config = modClient.getModConfig('sillyDeathPhysics');
```

## Adding New Mods

1. Define the mod in `mods` section with its actions
2. Add wheel result mappings in `wheelMappings`
3. Reload the overlay
4. Test by spinning the wheel

Example - adding a new mod:

```json
{
  "mods": {
    "myNewMod": {
      "name": "My New Mod",
      "nexusModId": 99999,
      "enabled": true,
      "actions": {
        "primary": {
          "type": "toggle",
          "key": "newModToggle"
        }
      }
    }
  },
  "wheelMappings": {
    "Dragons": ["sillyDeathPhysics", "myNewMod"]
  }
}
```

## Creating a Skyrim Mod to Read This

For SKSE-based mods, monitor the JSON file and parse:

```papyrus
Event OnUpdate()
    ; Read overlay-data.json
    string jsonPath = "overlay-data.json"
    
    ; Parse the JSON
    ; Check the "mods" array for your mod key
    ; Check "actions" array for relevant actions
    ; Execute accordingly
    
    ; Example:
    ; if jsonData contains "sillyDeathPhysics"
    ;   if jsonData contains "toggle"
    ;     ToggleSillyPhysics()
    ;   endif
    ; endif
EndEvent
```

## Troubleshooting

- **File not created**: Check directory path exists and is writable
- **Mod not responding**: Ensure your mod is reading the overlay-data.json file
- **Wrong actions**: Verify action types and keys match your mod's expectations
- **Mod disabled**: Check `"enabled": true` in mod configuration
- **Multiple mods not triggering**: All enabled mods in the array should execute; check logs for errors

