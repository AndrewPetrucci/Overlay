const path = require('path');
const fs = require('fs');

function loadFromExeDir(filename) {
    // Prioritize dev and packaged scenarios for .env loading
    const exeDir = path.dirname(process.argv[0]);
    const parentDir = path.dirname(exeDir);
    let candidatePaths;
    if (filename === '.env' || path.extname(filename).toLowerCase() === '.env') {
        // For .env, always prioritize exeDir and parentDir
        candidatePaths = [
            path.join(exeDir, filename),        // next to the executable
            path.join(parentDir, filename),     // parent of exe dir
            path.resolve(__dirname, filename),  // src/ or dist/ directory
            path.join(process.cwd(), filename)  // project root (where npm run dev is called)
        ];
    } else {
        candidatePaths = [
            path.resolve(__dirname, filename),
            path.join(process.cwd(), filename),
            path.join(exeDir, filename),
            path.join(parentDir, filename)
        ];
    }
    const triedPaths = [];
    for (const filePath of candidatePaths) {
        console.log(`[ENV] trying: ${filePath}`);

        triedPaths.push(filePath);
        if (fs.existsSync(filePath)) {
            try {
                const ext = path.extname(filename).toLowerCase();
                let data;
                if (ext === '.json') {
                    data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                    console.log(`[CONFIG] Loaded JSON ${filename} from: ${filePath}`);
                } else if (filename === '.env') {
                    data = fs.readFileSync(filePath, 'utf8');
                    data.split(/\r?\n/).forEach(line => {
                        const trimmed = line.trim();
                        if (!trimmed || trimmed.startsWith('#')) return;
                        const eqIdx = trimmed.indexOf('=');
                        if (eqIdx === -1) return;
                        const key = trimmed.slice(0, eqIdx).trim();
                        let value = trimmed.slice(eqIdx + 1).trim();
                        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                            value = value.slice(1, -1);
                        }
                        process.env[key] = value;
                    });
                    console.log(`[ENV] Loaded and set .env from: ${filePath}`);
                } else {
                    data = fs.readFileSync(filePath);
                    console.log(`[CONFIG] Loaded raw ${filename} from: ${filePath}`);
                }
                return data;
            } catch (err) {
                if (path.extname(filename).toLowerCase() === '.json') {
                    console.error(`[CONFIG] Failed to parse ${filename}:`, err);
                } else {
                    console.error(`[CONFIG] Failed to load ${filename}:`, err);
                }
                return null;
            }
        }
    }
    console.warn(`[CONFIG] No ${filename} found in any of: ${triedPaths.join(', ')}`);
    return null;
}

module.exports = {
    loadFromExeDir
};
