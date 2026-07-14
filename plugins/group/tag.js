module.exports = {
  name: "tag",
  description: "Tag all members, admins, or non-admins",
  category: "Group",
  execute: async (sock, from, msg, args, perms) => {
    if (!from.endsWith("@g.us")) {
      await sock.sendMessage(from, {
        text: "❌ This command can only be used in groups!",
      });
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
        return sock.sendMessage(from, {
          text: "❌ Only *Group Admins*, *Sudo*, or *Owner* can use the tag command.",
        });
      }

      const match = args && args.length > 0 ? args.join(" ") : "";

      const addSpace = (num, total) => {
        const spaces = total.toString().length - num.toString().length;
        return " ".repeat(spaces + 1);
      };

      if (match.toLowerCase() === "all") {
        let mesaj = "";
        const mentionedJid = participants.map((p) => p.id);
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
        const admins = participants.filter(
          (p) => p.admin === "admin" || p.admin === "superadmin",
        );
        const mentionedJid = admins.map((p) => p.id);
        let mesaj = "";
        admins.forEach((p) => {
          mesaj += `@${p.id.split("@")[0]}\n`;
        });
        await sock.sendMessage(from, {
          text: mesaj.trim(),
                               mentions: mentionedJid,
        });
        return;
      }

      if (
        match.toLowerCase() === "notadmin" ||
        match.toLowerCase() === "not admins"
      ) {
        const nonAdmins = participants.filter(
          (p) => p.admin !== "admin" && p.admin !== "superadmin",
        );
        const mentionedJid = nonAdmins.map((p) => p.id);
        let mesaj = "";
        nonAdmins.forEach((p) => {
          mesaj += `@${p.id.split("@")[0]}\n`;
        });
        await sock.sendMessage(from, {
          text: mesaj.trim(),
                               mentions: mentionedJid,
        });
        return;
      }

      if (match) {
        const mentionedJid = participants.map((p) => p.id);
        await sock.sendMessage(from, {
          text: match,
          mentions: mentionedJid,
        });
        return;
      }

      const quotedMsg =
      msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      if (quotedMsg) {
        const mentionedJid = participants.map((p) => p.id);
        const replyText =
        quotedMsg.conversation ||
        quotedMsg.extendedTextMessage?.text ||
        "📢 Message from admin";
        await sock.sendMessage(from, {
          text: replyText,
          mentions: mentionedJid,
        });
        return;
      }

      await sock.sendMessage(from, {
        text:
        `📋 *Tag Command Usage*\n\n` +
        `.tag all - List all members with numbers\n` +
        `.tag admin - Tag only admins\n` +
        `.tag notadmin - Tag non-admins\n` +
        `.tag <message> - Send message tagging everyone\n` +
        `Reply to a message with .tag - Forward it tagging everyone`,
      });
    } catch (error) {
      console.error("❌ Tag error:", error.message);
      await sock.sendMessage(from, {
        text: `❌ Failed to tag: ${error.message}`,
      });
    }
  },
};
