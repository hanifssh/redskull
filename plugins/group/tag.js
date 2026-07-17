const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

module.exports = {
  name: "tag",
  description: "Tag all members, admins, or non-admins",
  category: "Group",
  execute: async (sock, from, msg, args, perms) => {
    if (!from.endsWith("@g.us")) {
      await sock.sendMessage(from, { text: "❌ This command can only be used in groups!" });
      return;
    }

    try {
      const senderJid = msg.key.participant || msg.key.remoteJid;
      const groupMetadata = await sock.groupMetadata(from);
      const participants = groupMetadata.participants;

      const isGroupAdmin = participants.some(
        (p) => p.id === senderJid && (p.admin === "admin" || p.admin === "superadmin"),
      );

      const allowed = isGroupAdmin || perms?.isOwner || perms?.isSudo;
      if (!allowed) {
        return sock.sendMessage(from, { text: "❌ Only *Group Admins*, *Sudo*, or *Owner* can use the tag command." });
      }

      const match = args && args.length > 0 ? args.join(" ") : "";
      const mentionedJid = participants.map((p) => p.id);
      const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
      const quotedMsg = contextInfo?.quotedMessage;

      if (quotedMsg) {
        const quoted = quotedMsg;

        if (quoted.conversation || quoted.extendedTextMessage?.text) {
          const text = quoted.conversation || quoted.extendedTextMessage?.text || "";
          await sock.sendMessage(from, { text, mentions: mentionedJid });
          return;
        }

        if (quoted.imageMessage) {
          const stream = await downloadContentFromMessage(quoted.imageMessage, 'image');
          let buffer = Buffer.from([]);
          for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
          await sock.sendMessage(from, {
            image: buffer,
            caption: quoted.imageMessage.caption || "",
            mentions: mentionedJid
          });
          return;
        }

        if (quoted.videoMessage) {
          const stream = await downloadContentFromMessage(quoted.videoMessage, 'video');
          let buffer = Buffer.from([]);
          for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
          await sock.sendMessage(from, {
            video: buffer,
            caption: quoted.videoMessage.caption || "",
            mentions: mentionedJid
          });
          return;
        }

        if (quoted.stickerMessage) {
          const stream = await downloadContentFromMessage(quoted.stickerMessage, 'sticker');
          let buffer = Buffer.from([]);
          for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
          await sock.sendMessage(from, {
            sticker: buffer,
            mentions: mentionedJid
          });
          return;
        }

        if (quoted.audioMessage) {
          const stream = await downloadContentFromMessage(quoted.audioMessage, 'audio');
          let buffer = Buffer.from([]);
          for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
          await sock.sendMessage(from, {
            audio: buffer,
            mimetype: quoted.audioMessage.mimetype || 'audio/mpeg',
            mentions: mentionedJid
          });
          return;
        }

        if (quoted.documentMessage) {
          const stream = await downloadContentFromMessage(quoted.documentMessage, 'document');
          let buffer = Buffer.from([]);
          for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
          await sock.sendMessage(from, {
            document: buffer,
            mimetype: quoted.documentMessage.mimetype || 'application/octet-stream',
            fileName: quoted.documentMessage.fileName || 'file',
            mentions: mentionedJid
          });
          return;
        }

        await sock.sendMessage(from, { text: "❌ Unsupported message type." });
        return;
      }

      const addSpace = (num, total) => {
        const spaces = total.toString().length - num.toString().length;
        return " ".repeat(spaces + 1);
      };

      if (match.toLowerCase() === "all") {
        let mesaj = "";
        mentionedJid.forEach((jid, i) => {
          const num = i + 1;
          mesaj += `${num}${addSpace(num, participants.length)} @${jid.split("@")[0]}\n`;
        });
        await sock.sendMessage(from, {
          text: "```" + mesaj.trim() + "```",
                               mentions: mentionedJid,
        });
        return;
      }

      if (match.toLowerCase() === "admin" || match.toLowerCase() === "admins") {
        const admins = participants.filter(p => p.admin === "admin" || p.admin === "superadmin");
        const adminJids = admins.map(p => p.id);
        let mesaj = "";
        admins.forEach(p => { mesaj += `@${p.id.split("@")[0]}\n`; });
        await sock.sendMessage(from, { text: mesaj.trim(), mentions: adminJids });
        return;
      }

      if (match.toLowerCase() === "notadmin" || match.toLowerCase() === "not admins") {
        const nonAdmins = participants.filter(p => p.admin !== "admin" && p.admin !== "superadmin");
        const nonAdminJids = nonAdmins.map(p => p.id);
        let mesaj = "";
        nonAdmins.forEach(p => { mesaj += `@${p.id.split("@")[0]}\n`; });
        await sock.sendMessage(from, { text: mesaj.trim(), mentions: nonAdminJids });
        return;
      }

      if (match) {
        await sock.sendMessage(from, { text: match, mentions: mentionedJid });
        return;
      }

      await sock.sendMessage(from, {
        text:
        `📋 *Tag Command Usage*\n\n` +
        `.tag all - List all members with numbers\n` +
        `.tag admin - Tag only admins\n` +
        `.tag notadmin - Tag non-admins\n` +
        `.tag <message> - Send message tagging everyone\n` +
        `Reply to any message with .tag - Forward it with hidden tag`,
      });

    } catch (error) {
      console.error("❌ Tag error:", error.message);
      await sock.sendMessage(from, { text: `❌ Failed to tag: ${error.message}` });
    }
  },
};
