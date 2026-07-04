module.exports = {
    name: 'creator',
    aliases: ['dev', 'about'],
    category: 'Bot',
    desc: 'About the developer and the bot',

    execute: async (sock, from, msg) => {
        const text =
        `╭━─━─━─≪ 👑 ≫─━─━─━╮\n` +
        `│   *REDSKULL CREATOR*   \n` +
        `╰━─━─━─≪ 👑 ≫─━─━─━╯\n\n` +
        `👤 *Developer:* Hanif\n` +
        `🌐 *Website:* https://hanifssh.pages.dev\n` +
        `💻 *GitHub:* https://github.com/hanifssh/redskull\n\n` +
        `📧 *Email:* hanifpublicmail@gmail.com\n` +
        `📱 *WhatsApp:* +923101136915\n` +
        `💬 *Signal:* +923101136915\n\n` +
        `📜 *License:* MIT — Free to use, modify, and share.\n\n` +
        `╰━─━─━─≪ 🚀 ≫─━─━─━╯`;

        await sock.sendMessage(from, { text });
    }
};
