const axios = require("axios");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const LIDMAP_PATH = path.join(__dirname, "../../database/lidmap.json");

function readLidMap() {
  try {
    if (!fs.existsSync(LIDMAP_PATH)) return {};
    return JSON.parse(fs.readFileSync(LIDMAP_PATH, "utf8"));
  } catch {
    return {};
  }
}

function saveLidMap(map) {
  fs.mkdirSync(path.dirname(LIDMAP_PATH), { recursive: true });
  fs.writeFileSync(LIDMAP_PATH, JSON.stringify(map));
}

let lidMap = readLidMap();

(function updateLidMap() {
  if (!global.sock) return setTimeout(updateLidMap, 500);
  global.sock.ev.on("messages.upsert", ({ messages }) => {
    let changed = false;
    for (const msg of messages) {
      const participant = msg.key.participant;
      const participantAlt = msg.key.participantAlt;
      if (participant && participantAlt && !lidMap[participant]) {
        lidMap[participant] = participantAlt;
        changed = true;
      }
    }
    if (changed) saveLidMap(lidMap);
  });
})();

function getPhoneJidForPfp(lidJid, groupJid) {
  if (lidMap[lidJid]) return lidMap[lidJid];

  const cache = global.messageCache;
  if (cache) {
    const msgs = cache.get(groupJid);
    if (msgs && Array.isArray(msgs)) {
      for (let i = msgs.length - 1; i >= 0; i--) {
        const m = msgs[i];
        if (m.participant === lidJid && m.participantAlt) {
          return m.participantAlt;
        }
      }
    }
  }
  return null;
}

function cleanJid(jid) {
  if (!jid) return "";
  const parts = String(jid).split("@");
  const local = parts[0].split(":")[0];
  return local + "@" + (parts[1] || "s.whatsapp.net");
}

module.exports = {
  name: "qc",
  aliases: [],
  category: "Tools",
  desc: "Create a quote sticker.\n1. .qc Name;Message\n2. .qc Name (when replying to a message)",

  execute: async (sock, from, msg, args) => {
    try {
      const rawText =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        "";
      const prefix = rawText.charAt(0);
      const contextInfo =
        msg.message?.extendedTextMessage?.contextInfo ||
        msg.message?.imageMessage?.contextInfo ||
        msg.message?.videoMessage?.contextInfo;
      const isReply = !!contextInfo?.quotedMessage;

      let name = "";
      let text = "";
      let ppTargetJid = msg.key.participant || msg.key.remoteJid;

      const cmdContent = rawText.slice(prefix.length + 2).trim();
      if (!cmdContent) {
        return sock.sendMessage(from, {
          text: `❌ Usage:\n• \`${prefix}qc Name;Message\`\n• \`${prefix}qc Name\` (when replying to a message)`,
        });
      }

      const semiIdx = cmdContent.indexOf(";");
      if (semiIdx !== -1) {
        name = cmdContent.slice(0, semiIdx).trim();
        text = cmdContent.slice(semiIdx + 1).trim();
        if (!text)
          return sock.sendMessage(from, {
            text: "❌ Please provide a message after the semicolon.",
          });
      } else {
        if (isReply) {
          name = cmdContent.trim();
          const quotedMsg = contextInfo.quotedMessage;
          text =
            quotedMsg.conversation ||
            quotedMsg.extendedTextMessage?.text ||
            quotedMsg.imageMessage?.caption ||
            quotedMsg.videoMessage?.caption ||
            "";
          if (!text)
            return sock.sendMessage(from, {
              text: "❌ The replied message has no text.",
            });
        } else {
          text = cmdContent.trim();
          name = msg.pushName || "User";
        }
      }

      if (isReply && contextInfo.participant) {
        ppTargetJid = contextInfo.participant;
      }

      if (text.length > 80) text = text.slice(0, 80) + "...";

      let ppUrl =
        "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png";

      const phoneJid = getPhoneJidForPfp(ppTargetJid, from);
      if (phoneJid) {
        try {
          const u = await sock.profilePictureUrl(phoneJid, "image");
          if (typeof u === "string" && u) ppUrl = u;
        } catch {}
      }

      if (ppUrl.includes("pixabay")) {
        const cleaned = cleanJid(ppTargetJid);
        if (cleaned !== ppTargetJid) {
          try {
            const u = await sock.profilePictureUrl(cleaned, "image");
            if (typeof u === "string" && u) ppUrl = u;
          } catch {}
        }
      }

      if (ppUrl.includes("pixabay")) {
        try {
          const u = await sock.profilePictureUrl(ppTargetJid, "image");
          if (typeof u === "string" && u) ppUrl = u;
        } catch {}
      }

      if (typeof ppUrl !== "string" || !ppUrl) {
        ppUrl =
          "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png";
      }

      const obj = {
        type: "quote",
        format: "png",
        backgroundColor: "#1f2c34",
        width: 512,
        height: 768,
        scale: 2,
        messages: [
          {
            avatar: true,
            from: {
              id: 1,
              name: name,
              photo: { url: ppUrl },
            },
            text: text,
            replyMessage: {},
          },
        ],
      };

      const response = await axios.post(
        "https://quote.yuri.ly/quote/generate",
        obj,
        {
          headers: { "Content-Type": "application/json" },
          timeout: 15000,
        },
      );

      if (!response.data?.result?.image) {
        return sock.sendMessage(from, {
          text: "❌ API failed to return image data.",
        });
      }

      const imgBuffer = Buffer.from(response.data.result.image, "base64");
      const tmpDir = path.join(__dirname, "../../temp");
      if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
      const tmpPng = path.join(tmpDir, `qc_${Date.now()}.png`);
      const tmpWebp = path.join(tmpDir, `qc_${Date.now()}.webp`);
      fs.writeFileSync(tmpPng, imgBuffer);

      execSync(
        `ffmpeg -y -i "${tmpPng}" -vf "scale='min(512,iw)':'min(512,ih)':force_original_aspect_ratio=decrease,pad=512:512:(512-iw)/2:(512-ih)/2:color=0x00000000,setsar=1" -vcodec libwebp -lossless 1 "${tmpWebp}"`,
        {
          stdio: "ignore",
        },
      );

      const webpBuffer = fs.readFileSync(tmpWebp);
      await sock.sendMessage(from, { sticker: webpBuffer });

      try {
        fs.unlinkSync(tmpPng);
      } catch {}
      try {
        fs.unlinkSync(tmpWebp);
      } catch {}
    } catch (err) {
      console.error("[qc] Error:", err);
      await sock.sendMessage(from, { text: "❌ Can't generate sticker." });
    }
  },
};
