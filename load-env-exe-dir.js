// This script ensures that the .env file in the same directory as the .exe is loaded at runtime.
// Place this file in your project root. It will be required at the top of main.js.
const path = require('path');
const fs = require('fs');

function loadEnvFromExeDir() {
    // Get the directory of the running executable or script
    const exeDir = path.dirname(process.execPath);
    const envPath = path.join(exeDir, '.env');
    if (fs.existsSync(envPath)) {
        require('dotenv').config({ path: envPath });
        console.log(`[ENV] Loaded .env from: ${envPath}`);
    } else {
        console.warn(`[ENV] No .env file found in: ${envPath}`);
    }
}

module.exports = loadEnvFromExeDir;
