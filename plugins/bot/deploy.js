const DEPLOY_GUIDES = {
    arch: {
        name: 'Arch Linux',
        commands: `📦 REDSKULL DEPLOY - ARCH LINUX

        1. Update System:
        sudo pacman -Syu

        2. Install Dependencies:
        sudo pacman -S nodejs npm git ffmpeg
        sudo pacman -S yt-dlp chromium

        3. Clone & Setup:
        git clone https://github.com/hanifssh/redskull.git
        cd redskull
        npm install

        4. Install Playwright Browsers:
        npx playwright install chromium

        5. Start Bot:
        node index.js

        📱 Pairing Mode:
        node index.js --pair --phone=923001234567

        6. PM2 (Auto Restart):
        sudo npm install -g pm2
        pm2 start index.js --name redskull
        pm2 save
        pm2 startup

        🐳 Docker (Optional):
        docker build -t redskull .
        docker run -d --name redskull redskull`
    },
    debian: {
        name: 'Debian Linux',
        commands: `📦 REDSKULL DEPLOY - DEBIAN

        1. Update System:
        sudo apt update && sudo apt upgrade -y

        2. Install Dependencies:
        sudo apt install nodejs npm git ffmpeg -y
        sudo apt install python3-pip -y
        pip3 install yt-dlp
        sudo apt install chromium-browser -y

        3. Clone & Setup:
        git clone https://github.com/hanifssh/redskull.git
        cd redskull
        npm install

        4. Install Playwright Browsers:
        npx playwright install chromium

        5. Start Bot:
        node index.js

        📱 Pairing Mode:
        node index.js --pair --phone=923001234567

        6. PM2 (Auto Restart):
        sudo npm install -g pm2
        pm2 start index.js --name redskull
        pm2 save
        pm2 startup

        🐳 Docker (Optional):
        docker build -t redskull .
        docker run -d --name redskull redskull`
    },
    ubuntu: {
        name: 'Ubuntu',
        commands: `📦 REDSKULL DEPLOY - UBUNTU

        1. Update System:
        sudo apt update && sudo apt upgrade -y

        2. Install Node.js 20:
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

        3. Install Dependencies:
        sudo apt install nodejs git ffmpeg -y
        sudo apt install python3-pip -y
        pip3 install yt-dlp
        sudo apt install chromium-browser -y

        4. Clone & Setup:
        git clone https://github.com/hanifssh/redskull.git
        cd redskull
        npm install

        5. Install Playwright Browsers:
        npx playwright install chromium

        6. Start Bot:
        node index.js

        📱 Pairing Mode:
        node index.js --pair --phone=923001234567

        7. PM2 (Auto Restart):
        sudo npm install -g pm2
        pm2 start index.js --name redskull
        pm2 save
        pm2 startup

        🐳 Docker (Optional):
        docker build -t redskull .
        docker run -d --name redskull redskull`
    },
    termux: {
        name: 'Termux (Android)',
        commands: `📦 REDSKULL DEPLOY - TERMUX (ANDROID)

        🔋 Keep Termux Awake (prevents sleep):
        termux-wake-lock

        1. Update Packages:
        pkg update && pkg upgrade -y

        2. Install Dependencies:
        pkg install nodejs git ffmpeg python -y
        pip install yt-dlp

        3. Install Chromium:
        pkg install chromium -y

        If that fails, try:
        pkg install x11-repo
        pkg install chromium

        4. Clone & Setup:
        git clone https://github.com/hanifssh/redskull.git
        cd redskull
        npm install

        5. Install Playwright Browsers:
        npx playwright install chromium

        6. Start Bot:
        node index.js

        📱 Scan QR code to connect.

        7. PM2 (Auto Restart):
        npm install -g pm2
        pm2 start index.js --name redskull
        pm2 save

        📝 Important Notes:
        - Turn off battery optimization for Termux
        - Run termux-wake-lock after every reboot
        - Docker is NOT available on Termux
        - If Playwright fails, the bot still works without it`
    }
};

const ALIASES = {
    arch: 'arch',
    archlinux: 'arch',
    'arch linux': 'arch',
    debian: 'debian',
    deb: 'debian',
    ubuntu: 'ubuntu',
    ubu: 'ubuntu',
    termux: 'termux',
    term: 'termux',
    android: 'termux'
};

module.exports = {
    name: 'deploy',
    aliases: ['setup', 'install'],
    category: 'Bot',
    desc: 'Get deployment guide for different platforms.\n.deploy → choose platform\n.deploy termux → direct guide',

    execute: async (sock, from, msg, args) => {
        const input = args[0]?.toLowerCase();
        const platform = ALIASES[input];

        if (platform && DEPLOY_GUIDES[platform]) {
            await sock.sendMessage(from, {
                text: DEPLOY_GUIDES[platform].commands
            }, { quoted: msg });
            return;
        }

        if (input && !platform) {
            await sock.sendMessage(from, {
                text: `❌ Unknown platform: ${input}\n\nAvailable: arch, debian, ubuntu, termux\nOr type .deploy to choose from list.`
            }, { quoted: msg });
            return;
        }

        let text = `📦 REDSKULL DEPLOYMENT\n\nChoose your platform:\n\n`;
        const platforms = ['arch', 'debian', 'ubuntu', 'termux'];
        platforms.forEach((p, i) => {
            text += `${i + 1}. ${DEPLOY_GUIDES[p].name}\n`;
        });
        text += `\nReply with a number (1-4) or type .deploy termux directly.\nExpires in 2 minutes.`;

        const sent = await sock.sendMessage(from, { text }, { quoted: msg });

        if (!global.deployListeners) global.deployListeners = {};
        const key = `${from}_${msg.key.participant || msg.key.remoteJid}`;
        global.deployListeners[key] = {
            platforms,
            messageId: sent.key.id,
            timestamp: Date.now()
        };

        setTimeout(() => {
            delete global.deployListeners[key];
        }, 120000);
    }
};

(function deployListener() {
    if (!global.sock) return setTimeout(deployListener, 500);
    global.sock.ev.on('messages.upsert', async ({ messages }) => {
        for (const msg of messages) {
            if (!msg.message) continue;
            const from = msg.key.remoteJid;
            const sender = msg.key.participant || msg.key.remoteJid;
            const text = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '').trim();
            const choice = parseInt(text);

            if (isNaN(choice) || choice < 1 || choice > 4) continue;

            const key = `${from}_${sender}`;
            const listener = global.deployListeners?.[key];
            if (!listener) continue;
            if (Date.now() - listener.timestamp > 120000) {
                delete global.deployListeners[key];
                continue;
            }

            const platform = listener.platforms[choice - 1];
            delete global.deployListeners[key];

            await global.sock.sendMessage(from, {
                text: DEPLOY_GUIDES[platform].commands
            }, { quoted: msg });
        }
    });
})();
