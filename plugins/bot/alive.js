module.exports = {
    name: 'alive',
    aliases: ['uptime'],
    category: 'Bot',
    desc: 'Check if the bot is alive and show system uptime',

    execute: async (sock, from, msg) => {
        const uptime = process.uptime();
        const days = Math.floor(uptime / 86400);
        const hours = Math.floor((uptime % 86400) / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = Math.floor(uptime % 60);

        const parts = [];
        if (days > 0) parts.push(`${days}d`);
        if (hours > 0) parts.push(`${hours}h`);
        if (minutes > 0) parts.push(`${minutes}m`);
        parts.push(`${seconds}s`);

        const uptimeStr = parts.join(' ');

        const text =
        `╭━─━─━─≪ 🟢 ≫─━─━─━╮\n` +
        `│   *REDSKULL IS ALIVE*   \n` +
        `╰━─━─━─≪ 🟢 ≫─━─━─━╯\n\n` +
        `⏱️ *Uptime:* ${uptimeStr}\n` +
        `🧵 *Process:* Node.js ${process.version}\n` +
        `💻 *Platform:* ${process.platform} (${process.arch})\n` +
        `🧠 *Memory:* ${(process.memoryUsage().rss / 1024 / 1024).toFixed(1)} MB\n` +
        `\n╰━─━─━─≪ ✨ ≫─━─━─━╯`;

        await sock.sendMessage(from, { text });
    }
};
