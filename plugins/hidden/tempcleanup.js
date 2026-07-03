/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  TEMP CLEANER — Background Maintenance Script            ║
 * ╚══════════════════════════════════════════════════════════╝
 *
 * This is NOT a user command.
 * It runs silently in the background and automatically
 * deletes old files inside the "temp/" folder every 10 minutes.
 *
 * If you remove this file, your temp folder may grow
 * indefinitely and fill up your disk space.
 *
 * Do not delete or rename this file.
 *
 * — Redskull Developer (Hanif)
 */

const fs = require('fs');
const path = require('path');

const TEMP_DIR = path.join(__dirname, '../../temp');
const MAX_AGE = 10 * 60 * 1000;

function cleanTemp() {
    if (!fs.existsSync(TEMP_DIR)) return;
    const now = Date.now();
    const files = fs.readdirSync(TEMP_DIR);
    for (const file of files) {
        const filePath = path.join(TEMP_DIR, file);
        try {
            const stats = fs.statSync(filePath);
            if (now - stats.mtimeMs > MAX_AGE) {
                if (stats.isDirectory()) {
                    fs.rmSync(filePath, { recursive: true, force: true });
                } else {
                    fs.unlinkSync(filePath);
                }
                console.log(`[cleanup] Deleted: ${filePath}`);
            }
        } catch (err) {
        }
    }
}

cleanTemp();
setInterval(cleanTemp, 10 * 60 * 1000);
console.log('[cleanup] Temp cleaner active (every 10 minutes)');

module.exports = {
    name: 'cleanup',
    category: 'Hidden',
    desc: 'Auto-cleans temp folder',
    execute: () => {},
};
