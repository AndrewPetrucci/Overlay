class ModClient {
    constructor() {
        this.wheel = null;
        this.loadAvailableMods();
    }

    loadAvailableMods() {
        if (window.electron) {
            try {
                this.mods = window.electron.getAllMods();
                console.log('Available mods:', this.mods);
            } catch (error) {
                console.error('Failed to load mods:', error);
                this.mods = [];
            }
        }
    }

    onWheelSpin(wheelResult) {
        console.log('Wheel spun with result:', wheelResult);

        if (!window.electron) return;

        // Send wheel result to main process
        window.electron.wheelSpinResult(wheelResult);

        // Get all mods mapped to this result
        const mappedMods = window.electron.getMappedMods(wheelResult);
        console.log(`Mods triggered for '${wheelResult}':`, mappedMods);

        // Execute all mapped mods
        for (const modKey of mappedMods) {
            try {
                const result = window.electron.triggerModAction(modKey);
                console.log(`Executed mod '${modKey}':`, result);
            } catch (error) {
                console.error(`Failed to trigger mod '${modKey}':`, error);
            }
        }
    }

    toggleMod(modKey, enabled) {
        if (window.electron) {
            try {
                const result = window.electron.setModEnabled(modKey, enabled);
                console.log(`Mod '${modKey}' toggle result:`, result);
                return result;
            } catch (error) {
                console.error(`Failed to toggle mod '${modKey}':`, error);
                return false;
            }
        }
        return false;
    }

    addMapping(wheelResult, modKey) {
        if (window.electron) {
            try {
                const result = window.electron.addWheelMapping(wheelResult, modKey);
                console.log(`Added mapping '${wheelResult}' -> '${modKey}':`, result);
                return result;
            } catch (error) {
                console.error(`Failed to add mapping:`, error);
                return false;
            }
        }
        return false;
    }

    removeMapping(wheelResult, modKey) {
        if (window.electron) {
            try {
                const result = window.electron.removeWheelMapping(wheelResult, modKey);
                console.log(`Removed mapping '${wheelResult}' -> '${modKey}':`, result);
                return result;
            } catch (error) {
                console.error(`Failed to remove mapping:`, error);
                return false;
            }
        }
        return false;
    }

    getModConfig(modKey) {
        if (window.electron) {
            try {
                return window.electron.getModConfig(modKey);
            } catch (error) {
                console.error(`Failed to get mod config:`, error);
                return null;
            }
        }
        return null;
    }
}

// Initialize
const modClient = new ModClient();
