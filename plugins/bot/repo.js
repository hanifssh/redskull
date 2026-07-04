module.exports = {
    name: 'repo',
    aliases: [],
    category: 'Bot',
    desc: 'Show the bot source code and developer contact',

    execute: async (sock, from, msg) => {
        const text =
        `╭━─━─━─≪ 📂 ≫─━─━─━╮\n` +
        `│   *REDSKULL REPO*   \n` +
        `╰━─━─━─≪ 📂 ≫─━─━─━╯\n\n` +
        `💻 *GitHub:*\n` +
        `https://github.com/hanifssh/redskull\n\n` +
        `🌐 *Developer Site:*\n` +
        `https://hanifssh.pages.dev\n\n` +
        `📬 _For help, or personal queries, visit the site above._\n\n` +
        `╰━─━─━─≪ ✨ ≫─━─━─━╯`;

        await sock.sendMessage(from, { text });
    }
};
