const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function clearRequireCache(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            clearRequireCache(fullPath);
        } else if (entry.name.endsWith('.js') && !entry.name.startsWith('_')) {
            try {
                delete require.cache[require.resolve(fullPath)];
            } catch {}
        }
    }
}

module.exports = {
    name: 'update',
    aliases: [],
    category: 'Bot',
    desc: 'Pull latest code from GitHub, install new dependencies, and hot‑reload plugins (owner/sudo only)',

    execute: async (sock, from, msg, args, perms) => {
        if (!perms.isOwner && !perms.isSudo) {
            return sock.sendMessage(from, { text: '❌ Only the bot owner or sudo users can update.' });
        }

        if (!global.commands || !global.categories) {
            return sock.sendMessage(from, {
                text: '❌ Bot update system not fully configured.\n' +
                'Add these two lines in index.js after declaring commands and categories:\n' +
                '`global.commands = commands;`\n' +
                '`global.categories = categories;`\n' +
                'Then restart the bot.'
            });
        }

        await sock.sendMessage(from, { text: '⏳ Updating RedSkull…' });

        try {
            execSync('git pull origin main', {
                cwd: process.cwd(),
                     stdio: 'pipe'
            });

            try {
                execSync('npm install', {
                    cwd: process.cwd(),
                         stdio: 'pipe'
                });
            } catch (npmErr) {
                console.error('[update] npm install failed:', npmErr.message);
            }

            const pluginsDir = path.join(process.cwd(), 'plugins');
            clearRequireCache(pluginsDir);

            global.commands.clear();
            for (const cat in global.categories) {
                delete global.categories[cat];
            }

            const loadPlugins = () => {
                const collectFiles = (dir) => {
                    let results = [];
                    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                        const fullPath = path.join(dir, entry.name);
                        if (entry.isDirectory()) {
                            results = results.concat(collectFiles(fullPath));
                        } else if (entry.isFile() && entry.name.endsWith('.js') && !entry.name.startsWith('_')) {
                            results.push(fullPath);
                        }
                    }
                    return results;
                };
                const files = collectFiles(pluginsDir);
                let loaded = 0;
                for (const file of files) {
                    try {
                        delete require.cache[require.resolve(file)];
                        const plugin = require(file);
                        if (plugin.name && typeof plugin.execute === 'function') {
                            if (typeof global.registerCommand === 'function') {
                                global.registerCommand(plugin);
                            }
                            loaded++;
                        }
                    } catch (err) {
                        console.error(`[update] Error loading ${file}:`, err.message);
                    }
                }
                console.log(`[update] Reloaded ${loaded} plugins`);
            };

            loadPlugins();
            await sock.sendMessage(from, { text: '✅ Update complete. Plugins reloaded.' });

        } catch (err) {
            console.error('[update] Error:', err);
            await sock.sendMessage(from, {
                text: '❌ Update failed. See console for details.\n' +
                'Manual update: `git pull origin main && npm install` then restart the bot.'
            });
        }
    }
};
