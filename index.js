const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, delay } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const os = require('os');
const pino = require('pino');

const SESSION_DIR = './sessions';
const PLUGINS_DIR = './plugins';
const LOGO_PATH   = './assets/logo.jpeg';
const VARS_PATH   = './database/vars.json';

const BOT_NAME = 'RedSkull';
const VERSION  = '5.5.5';

const isPairingMode = process.argv.includes('--pair');

const state = {
    prefix: '.',
    mode: 'public',
    owners: [],
    sudos: [],
};

function decodeJid(jid) {
    if (!jid) return jid;
    jid = String(jid);
    if (/:\d+@/gi.test(jid)) {
        const parts = jid.match(/^([-+\d]+):(\d+)@/i);
        if (parts) {
            return `${parts[1]}@${jid.split('@')[1]}`;
        }
    }
    return jid.trim();
}

function cleanJid(jid) {
    if (!jid) return '';
    return String(jid).split('@')[0].split(':')[0].replace(/\D/g, '');
}

function readVars() {
    try {
        const data = fs.readFileSync(VARS_PATH, 'utf-8');
        return JSON.parse(data);
    }
    catch { return {}; }
}

function writeVars(obj) {
    try {
        fs.mkdirSync(path.dirname(VARS_PATH), { recursive: true });
        fs.writeFileSync(VARS_PATH, JSON.stringify(obj, null, 2));
        return true;
    } catch { return false; }
}

function setVar(key, value) {
    const vars = readVars();
    vars[key] = value;
    return writeVars(vars);
}

function getSenderJid(msg) {
    return msg.key.participant || msg.key.remoteJid || '';
}

function checkOwner(jid) {
    if (!jid) return false;
    const baseJid = decodeJid(jid).split(':')[0];
    return state.owners.some(owner => decodeJid(owner).split(':')[0] === baseJid);
}

function checkSudo(jid) {
    if (!jid) return false;
    if (checkOwner(jid)) return true;
    const baseJid = decodeJid(jid).split(':')[0];
    return state.sudos.some(sudo => decodeJid(sudo).split(':')[0] === baseJid);
}

function reloadVars() {
    const raw = readVars();

    state.owners = raw.OWNERS ? (Array.isArray(raw.OWNERS) ? raw.OWNERS : raw.OWNERS.split(',').map(s => s.trim()).filter(Boolean)) : [];
    state.sudos = raw.SUDOS ? (Array.isArray(raw.SUDOS) ? raw.SUDOS : raw.SUDOS.split(',').map(s => s.trim()).filter(Boolean)) : [];

    state.owners = [...new Set(state.owners.map(decodeJid))];
    state.sudos = [...new Set([...state.owners, ...state.sudos.map(decodeJid)])];

    if (raw.PREFIX) state.prefix = raw.PREFIX;
    if (raw.MODE) state.mode = raw.MODE;

    console.log('\n🔄 Reloaded vars:');
    console.log('👑 Owners:', state.owners);
    console.log('🛡 Sudo:', state.sudos);
    console.log('🔣 Prefix:', state.prefix);
    console.log('🌐 Mode:', state.mode);
    console.log('');
}

function initVars() {
    if (!fs.existsSync(VARS_PATH)) {
        console.log('📝 vars.json not found, creating default...');
        writeVars({ OWNERS: [], SUDOS: [], PREFIX: '.', MODE: 'public' });
    }
    reloadVars();
}

async function getSenderName(sock, msg) {
    try {
        const jid = getSenderJid(msg);
        const contact = await sock.getContact?.(jid) || null;
        if (contact) {
            const name = contact.name || contact.notify || contact.verifiedName || contact.pushName;
            if (name && name !== 'undefined') return name;
        }
        if (msg.pushName) return msg.pushName;
        return 'User';
    } catch (_) { return 'User'; }
}

const commands = new Map();
const categories = {};

function registerCommand(def) {
    const names = [def.name, ...(def.aliases || [])];
    const category = def.category || 'General';
    for (const name of names) {
        commands.set(name, {
            name: def.name,
            description: def.description || 'No description',
            category,
            ownerOnly: def.ownerOnly || false,
            sudoOnly: def.sudoOnly || false,
            execute: def.execute,
        });
    }
    if (!categories[category]) categories[category] = [];
    if (!categories[category].includes(def.name)) categories[category].push(def.name);
}

function collectPluginFiles(dir) {
    let results = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results = results.concat(collectPluginFiles(fullPath));
        } else if (entry.isFile() && entry.name.endsWith('.js') && !entry.name.startsWith('_')) {
            results.push(fullPath);
        }
    }
    return results;
}

function loadPlugins() {
    const pluginsPath = path.join(process.cwd(), PLUGINS_DIR);
    if (!fs.existsSync(pluginsPath)) {
        fs.mkdirSync(pluginsPath, { recursive: true });
        return;
    }
    const files = collectPluginFiles(pluginsPath);
    let loaded = 0;
    for (const pluginPath of files) {
        try {
            delete require.cache[require.resolve(pluginPath)];
            const plugin = require(pluginPath);
            if (plugin.name && typeof plugin.execute === 'function') {
                registerCommand(plugin);
                loaded++;
                console.log(`✅ ${plugin.name}${plugin.aliases ? ' [+' + plugin.aliases.join(',') + ']' : ''} (${plugin.category || 'General'})`);
            }
        } catch (err) {
            console.log(`❌ ${path.relative(pluginsPath, pluginPath)}: ${err.message}`);
        }
    }
    console.log(`📦 Loaded ${loaded} plugins\n`);
}

async function showMenu(sock, from, senderName) {
    const uptime = process.uptime();
    const days = Math.floor(uptime / 86400);
    const hours = Math.floor((uptime % 86400) / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const uptimeStr = days > 0 ? `${days}d ${hours}h ${minutes}m` : `${hours}h ${minutes}m`;

    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit' });
    const dayStr = now.toLocaleDateString('en-US', { weekday: 'long' });
    const dateStr = now.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });

    const totalMem = Math.round(os.totalmem() / (1024 * 1024));
    const freeMem = Math.round(os.freemem() / (1024 * 1024));
    const usedMem = totalMem - freeMem;

    const modeEmoji = state.mode === 'public' ? '🌐 Public' : '🔒 Private';

    let menu = `╭━─━─━─≪✠≫─━─━─━╮\n        *${BOT_NAME} 👑*\n╰━─━─━─≪✠≫─━─━─━╯\n╭━─━─━─≪✠≫─━─━─━╮\n`;
    menu += `┃🍷│ *Prefix* : ${state.prefix}\n┃👤│ *User* : ${senderName || 'User'}\n┃⏰│ *Time* : ${timeStr}\n`;
    menu += `┃⛅│ *Day* : ${dayStr}\n┃📅│ *Date* : ${dateStr}\n┃🔔│ *Version* : ${VERSION}\n`;
    menu += `┃📦│ *Plugins* : ${commands.size}\n┃🗃️│ *Ram* : ${usedMem}/${totalMem}MB\n┃⏳│ *Uptime* : ${uptimeStr}\n`;
    menu += `┃💻│ *Platform* : ${os.platform()} (${os.type()})\n┃🌐│ *Mode* : ${modeEmoji}\n╰━─━─━─≪✠≫─━─━─━╯\n`;

    const categoryOrder = ['AI', 'Download', 'Admin', 'Group', 'Tools', 'Editor', 'Audio', 'Video', 'Economy', 'User', 'Bot', 'Game', 'General'];
    for (const cat of categoryOrder) {
        if (!categories[cat] || categories[cat].length === 0) continue;
        menu += `╭━─━─━─≪❥≫\n│   *${cat.toUpperCase()} ❞*\n╰━─━─━─≪❥≫\n`;
        for (const cmd of categories[cat].sort()) menu += `│ ✗ ${cmd}\n`;
    }
    menu += `╰━─━─━─≪✠≫─━─━─━╯\n`;

    try {
        if (fs.existsSync(LOGO_PATH)) {
            await sock.sendMessage(from, { image: fs.readFileSync(LOGO_PATH), caption: menu });
        } else {
            await sock.sendMessage(from, { text: menu });
        }
    } catch (_) {
        await sock.sendMessage(from, { text: menu });
    }
}

registerCommand({
    name: 'menu',
    description: 'Show bot menu',
    category: 'General',
    execute: async (sock, from, msg) => {
        const senderName = await getSenderName(sock, msg);
        await showMenu(sock, from, senderName);
    }
});

registerCommand({
    name: 'mode',
    description: 'Switch bot between public and private mode',
    category: 'Bot',
    sudoOnly: true,
    execute: async (sock, from, msg, args) => {
        const input = (args[0] || '').toLowerCase();
        if (input !== 'public' && input !== 'private') {
            await sock.sendMessage(from, {
                text: `╭━─━─━─≪✠≫─━─━─━╮\n*⚙️ BOT MODE*\n╰━─━─━─≪✠≫─━─━─━╯\n\nCurrent mode: *${state.mode === 'public' ? '🌐 Public' : '🔒 Private'}*\n\nUsage:\n• \`${state.prefix}mode public\`\n• \`${state.prefix}mode private\``
            });
            return;
        }
        state.mode = input;
        setVar('MODE', input);
        const emoji = input === 'public' ? '🌐' : '🔒';
        await sock.sendMessage(from, { text: `╭━─━─━─≪✠≫─━─━─━╮\n*${emoji} MODE CHANGED*\n╰━─━─━─≪✠≫─━─━─━╯\n\nBot is now in *${input.toUpperCase()}* mode.` });
    }
});

registerCommand({
    name: 'prefix',
    description: 'Change the bot command prefix',
    category: 'Bot',
    sudoOnly: true,
    execute: async (sock, from, msg, args) => {
        const newPrefix = args[0];
        if (!newPrefix || newPrefix.length > 5) {
            await sock.sendMessage(from, { text: `⚙️ Current prefix: *${state.prefix}*\nUsage: \`${state.prefix}prefix <new>\`` });
            return;
        }
        state.prefix = newPrefix;
        setVar('PREFIX', newPrefix);
        await sock.sendMessage(from, { text: `✅ *PREFIX CHANGED* to \`${newPrefix}\`` });
    }
});

registerCommand({
    name: 'owner',
    description: 'Show bot owner information',
    category: 'Bot',
    execute: async (sock, from, msg) => {
        const raw = readVars();
        const ownerList = raw.OWNERS || [];
        let text = `╭━─━─━─≪✠≫─━─━─━╮\n*👑 BOT OWNER*\n╰━─━─━─≪✠≫─━─━─━╯\n\n`;
        if (ownerList.length === 0) text += `│ Bot number is the owner\n`;
        else ownerList.forEach((num, i) => { text += `│ ✗ ${i + 1}. ${num.split('@')[0]}\n`; });
        text += `\n╰━─━─━─≪✠≫─━─━─━╯`;
        await sock.sendMessage(from, { text });
    }
});

registerCommand({
    name: 'sudo',
    aliases: ['listsudo', 'setsudo', 'delsudo'],
    description: 'Manage sudo users',
    category: 'Bot',
    ownerOnly: true,
    execute: async (sock, from, msg, args, perms) => {
        let rawText = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
        const typedCmd = rawText.slice(state.prefix.length).trim().split(/\s+/)[0].toLowerCase();

        if (typedCmd === 'listsudo' || typedCmd === 'sudo') {
            const raw = readVars();
            const sudoList = raw.SUDOS || [];
            let text = `╭━─━─━─≪✠≫─━─━─━╮\n*👑 SUDO USERS*\n╰━─━─━─≪✠≫─━─━─━╯\n\n`;
            if (sudoList.length === 0) text += `📭 No sudo users added yet.\n`;
            else sudoList.forEach((num, i) => { text += `│ ✗ ${i + 1}. ${num}\n`; });
            text += `\n╰━─━─━─≪✠≫─━─━─━╯`;
            await sock.sendMessage(from, { text });
            return;
        }

        if (typedCmd === 'setsudo') {
            let target = args[0] || null;
            const qi = msg.message?.extendedTextMessage?.contextInfo;

            if (!target && qi?.participant) {
                target = qi.participant;
            }

            if (!target && qi?.mentionedJid?.[0]) {
                target = qi.mentionedJid[0];
            }

            if (!target) {
                await sock.sendMessage(from, { text: `❌ Usage: \`${state.prefix}setsudo <mention/reply>\`` });
                return;
            }

            let targetJid = decodeJid(target.includes('@') ? target.trim() : target.replace(/[^0-9]/g, '') + '@s.whatsapp.net');

            if (!targetJid.endsWith('@lid')) {
                try {
                    const contactInfo = await sock.getContact?.(targetJid);
                    if (contactInfo && contactInfo.lid) {
                        console.log(`🎯 Map Resolution Success: Swapped standard phone format for LID: ${contactInfo.lid}`);
                        targetJid = decodeJid(contactInfo.lid);
                    }
                } catch (_) {  }
            }

            const raw = readVars();
            let sudoArray = raw.SUDOS || [];
            if (!sudoArray.includes(targetJid)) {
                sudoArray.push(targetJid);
                setVar('SUDOS', sudoArray);
                reloadVars();
            }

            await sock.sendMessage(from, { text: `✅ *Sudo Added Successfully!*\n\nSaved Identity: \`${targetJid}\`` });
            return;
        }

        if (typedCmd === 'delsudo') {
            let target = args[0] || null;
            const qi = msg.message?.extendedTextMessage?.contextInfo;
            if (!target && qi?.participant) target = qi.participant;
            if (!target && qi?.mentionedJid?.[0]) target = qi.mentionedJid[0];

            if (!target) return;

            const cleanTarget = target.split('@')[0];
            const raw = readVars();
            let sudoArray = raw.SUDOS || [];

            sudoArray = sudoArray.filter(s => {
                const cleanSudoItem = s.split('@')[0];
                return cleanSudoItem !== cleanTarget;
            });

            setVar('SUDOS', sudoArray);
            reloadVars();
            await sock.sendMessage(from, { text: `✅ *Sudo Access Revoked!*` });
            return;
        }
    }
});

if (categories['Bot']) {
    ['listsudo', 'setsudo', 'delsudo'].forEach(a => {
        if (!categories['Bot'].includes(a)) categories['Bot'].push(a);
    });
}

let qrDisplayed = false;

async function startBot() {
    console.log('\n╭━─━─━─≪✠≫─━─━─━╮\n    ' + BOT_NAME + ' 🤖\n╰━─━─━─≪✠≫─━─━─━╯\n');
    initVars();
    loadPlugins();

    if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true });
    const { state: authState, saveCreds } = await useMultiFileAuthState(SESSION_DIR);

    const sock = makeWASocket({
        auth: authState,
        printQRInTerminal: !isPairingMode,
        logger: pino({ level: 'silent' }),
                              browser: ['Ubuntu', 'Chrome', '20.0.04'],
    });

    global.sock = sock;

    sock.ev.on('creds.update', saveCreds);

    if (isPairingMode && !sock.authState.creds.registered) {
        let phoneNumber = process.argv.find(arg => arg.startsWith('--phone='))?.split('=')[1];
        if (!phoneNumber) process.exit(1);
        phoneNumber = phoneNumber.replace(/[^0-9]/g, '');
        await delay(3000);
        try {
            let code = await sock.requestPairingCode(phoneNumber);
            code = code?.match(/.{1,4}/g)?.join('-') || code;
            console.log(`\n======================================\n🔑 REDSKULL PAIRING CODE: ${code}\n======================================\n`);
        } catch (error) { process.exit(1); }
    }

    sock.ev.on('connection.update', async (update) => {
        const { connection, qr, lastDisconnect } = update;
        if (qr && !qrDisplayed && !isPairingMode) {
            qrDisplayed = true;
            QRCode.generate(qr, { small: true });
            setTimeout(() => { qrDisplayed = false; }, 60000);
        }
        if (connection === 'close') {
            qrDisplayed = false;
            if (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) {
                setTimeout(() => startBot(), 5000);
            }
        }
        if (connection === 'open') {
            qrDisplayed = false;
            console.log('\n✅ CONNECTED TO WHATSAPP!');
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        for (const msg of messages) {
            try {
                if (!msg.message) continue;
                const from = msg.key.remoteJid;
                if (!from) continue;

                const senderJid = decodeJid(getSenderJid(msg));

                const senderIsOwner = msg.key.fromMe || checkOwner(senderJid);
                const senderIsSudo  = msg.key.fromMe || checkSudo(senderJid);

                let text = msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || msg.message.videoMessage?.caption || '';

                if (text.startsWith(state.prefix)) {
                    const command = text.slice(state.prefix.length).trim().split(/\s+/)[0].toLowerCase();
                    console.log(`📨 ${command} from ${senderJid} [owner:${senderIsOwner} sudo:${senderIsSudo}]`);
                }

                if (!text || !text.startsWith(state.prefix)) continue;

                const parts = text.slice(state.prefix.length).trim().split(/\s+/);
                const command = parts.shift().toLowerCase();
                const args = parts;

                if (!commands.has(command)) continue;
                const cmd = commands.get(command);

                if (state.mode === 'private' && !senderIsSudo) {
                    continue;
                }
                if (cmd.ownerOnly && !senderIsOwner) {
                    await sock.sendMessage(from, { text: '❌ This command is for the *Owner* only!' });
                    continue;
                }
                if (cmd.sudoOnly && !senderIsSudo) {
                    await sock.sendMessage(from, { text: '❌ This command is for *Owner & Sudo* users only!' });
                    continue;
                }

                const perms = { isOwner: senderIsOwner, isSudo: senderIsSudo };
                await cmd.execute(sock, from, msg, args, perms);
            } catch (err) {
                console.error('Message error:', err);
            }
        }
    });
}

startBot();

process.on('SIGINT', () => {
    process.exit(0);
});
