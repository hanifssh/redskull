module.exports = {
  name: 'bomb',
  description: 'Bomb the group with repeated messages',
  category: 'Group',
  sudoOnly: true,

  execute: async (sock, from, msg, args) => {
    if (!from.endsWith('@g.us')) {
      await sock.sendMessage(from, { text: '❌ This command can only be used in groups.' });
      return;
    }

    if (!args || args.length === 0) {
      await sock.sendMessage(from, {
        text: `╭━─━─━─≪✠≫─━─━─━╮\n*REDSKULL BOMBER 💣*\n╰━─━─━─≪✠≫─━─━─━╯\n│ ✗ .bomb <count> <message>\n│ ✗ .bomb 10 Hello\n│ ✗ Max 500 messages\n╰━─━─━─≪✠≫─━─━─━╯`
      });
      return;
    }

    try {
      const groupMetadata = await sock.groupMetadata(from);
      const mentionedJid = groupMetadata.participants.map(p => p.id);

      let count = 5;
      let message = '📢 Attention everyone!';
      const num = parseInt(args[0]);

      if (!isNaN(num) && num > 0) {
        count = Math.min(num, 500);
        message = args.slice(1).join(' ') || message;
      } else {
        message = args.join(' ');
      }

      await sock.sendMessage(from, {
        text: `╭━─━─━─≪✠≫─━─━─━╮\n*💣 BOMBER STARTED*\n📊 Count: ${count}\n⚡ Speed: Ultra\n╰━─━─━─≪✠≫─━─━─━╯`
      });

      const startTime = Date.now();

      const batchSize = 10;
      const totalBatches = Math.ceil(count / batchSize);
      let sent = 0;

      for (let batch = 0; batch < totalBatches; batch++) {
        const batchPromises = [];
        const currentBatchSize = Math.min(batchSize, count - sent);

        for (let i = 0; i < currentBatchSize; i++) {
          batchPromises.push(
            sock.sendMessage(from, {
              text: message,
              mentions: mentionedJid
            }).catch(e => null)
          );
        }

        await Promise.all(batchPromises);
        sent += currentBatchSize;

        if (sent % 50 === 0 || sent === count) {
          await sock.sendMessage(from, {
            text: `📊 Progress: ${sent}/${count} (${Math.round(sent/count*100)}%)`
          }).catch(() => {});
        }
      }

      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;
      const speed = Math.round(count / duration);

      await sock.sendMessage(from, {
        text: `╭━─━─━─≪✠≫─━─━─━╮\n*✅ BOMBING COMPLETE*\n📊 Total: ${count} messages\n⏱️ Time: ${duration.toFixed(2)}s\n⚡ Speed: ${speed} msgs/sec\n╰━─━─━─≪✠≫─━─━─━╯`
      });

    } catch (error) {
      await sock.sendMessage(from, { text: `❌ Failed to bomb: ${error.message}` });
    }
  }
};
