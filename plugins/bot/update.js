const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPO_URL = 'https://github.com/hanifssh/redskull.git';
const BRANCH = 'main';

module.exports = {
    name: 'update',
    aliases: [],
    category: 'Bot',
    desc: 'Pull latest code from GitHub and restart the bot (owner/sudo only)',

    execute: async (sock, from, msg, args, perms) => {
        if (!perms.isOwner && !perms.isSudo) {
            return sock.sendMessage(from, { text: '❌ Only the bot owner or sudo users can update.' });
        }

        await sock.sendMessage(from, { text: '⏳ Updating from GitHub…' });

        try {
            const cwd = process.cwd();

            let gitAvailable = false;
            try {
                execSync('git --version', { stdio: 'pipe' });
                gitAvailable = true;
            } catch {}

            if (gitAvailable) {
                const hasGit = fs.existsSync(path.join(cwd, '.git'));

                if (!hasGit) {
                    execSync(`git init && git remote add origin ${REPO_URL}`, { cwd, stdio: 'pipe' });
                }

                execSync(`git fetch origin ${BRANCH}`, { cwd, stdio: 'pipe' });
                execSync(`git reset --hard origin/${BRANCH}`, { cwd, stdio: 'pipe' });
            } else {
                const zipUrl = `https://github.com/hanifssh/redskull/archive/refs/heads/${BRANCH}.zip`;
                execSync(`curl -L ${zipUrl} -o /tmp/redskull.zip`, { stdio: 'pipe' });
                execSync(`unzip -o /tmp/redskull.zip -d /tmp/`, { stdio: 'pipe' });
                execSync(`cp -r /tmp/redskull-${BRANCH}/* ${cwd}/`, { stdio: 'pipe' });
                execSync(`rm -rf /tmp/redskull.zip /tmp/redskull-${BRANCH}`, { stdio: 'pipe' });
            }

            try {
                execSync('npm install', { cwd, stdio: 'pipe' });
            } catch (npmErr) {
                console.error('[update] npm install failed:', npmErr.message);
            }

            await sock.sendMessage(from, { text: '✅ Update complete. Restarting bot…' });

            // Restart
            setTimeout(() => process.exit(0), 2000);

        } catch (err) {
            console.error('[update] Error:', err);
            await sock.sendMessage(from, {
                text: '❌ Update failed. See console for details.'
            });
        }
    }
};
