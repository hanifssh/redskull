const { createCanvas } = require("canvas");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const TEMP_DIR = path.join(__dirname, "../../temp");

module.exports = {
  name: "qc",
  aliases: [],
  category: "Tools",
  desc: "Create a text sticker from a replied message.\n.qc → white text on black bg (default)\n.qc black → white text on black bg\n.qc white → black text on white bg",

  execute: async (sock, from, msg, args) => {
    try {
      const rawText = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";
      const prefix = rawText.charAt(0);
      const mode = args[0]?.toLowerCase() || "black";

      if (mode !== "black" && mode !== "white") {
        return sock.sendMessage(from, {
          text: `❌ Usage: Reply to a message with \`${prefix}qc\` (default black) or \`${prefix}qc black\` or \`${prefix}qc white\``
        }, { quoted: msg });
      }

      const contextInfo =
      msg.message?.extendedTextMessage?.contextInfo ||
      msg.message?.imageMessage?.contextInfo ||
      msg.message?.videoMessage?.contextInfo;
      const quotedMsg = contextInfo?.quotedMessage;
      if (!quotedMsg) {
        return sock.sendMessage(from, {
          text: `❌ Reply to a message with \`${prefix}qc\``
        }, { quoted: msg });
      }

      let text = quotedMsg?.conversation || quotedMsg?.extendedTextMessage?.text || quotedMsg?.imageMessage?.caption || "";
      if (!text) return sock.sendMessage(from, { text: "❌ The replied message has no text." }, { quoted: msg });
      if (text.length > 200) text = text.slice(0, 200) + "...";

      const isBlack = mode === "black";
      const bgColor = isBlack ? "#000000" : "#ffffff";
      const textColor = isBlack ? "#ffffff" : "#000000";

      const W = 512, H = 512;
      const canvas = createCanvas(W, H);
      const ctx = canvas.getContext("2d");

      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, W, H);

      ctx.fillStyle = textColor;
      const fontSize = text.length > 80 ? 28 : text.length > 40 ? 36 : 48;
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const words = text.split(" ");
      const lines = [];
      let line = "";
      const maxWidth = W - 80;

      for (const word of words) {
        const test = line + word + " ";
        if (ctx.measureText(test).width > maxWidth && line) {
          lines.push(line.trim());
          line = word + " ";
        } else {
          line = test;
        }
      }
      lines.push(line.trim());

      const lineHeight = fontSize + 12;
      const totalHeight = lines.length * lineHeight;
      let y = (H - totalHeight) / 2 + lineHeight / 2;

      for (const l of lines) {
        ctx.fillText(l, W / 2, y);
        y += lineHeight;
      }

      const pngBuffer = canvas.toBuffer("image/png");

      if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });
      const tmpPng = path.join(TEMP_DIR, `qc_${Date.now()}.png`);
      const tmpWebp = path.join(TEMP_DIR, `qc_${Date.now()}.webp`);
      fs.writeFileSync(tmpPng, pngBuffer);

      execSync(`ffmpeg -y -i "${tmpPng}" -vf "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(512-iw)/2:(512-ih)/2:color=0x00000000,setsar=1" -vcodec libwebp -lossless 1 "${tmpWebp}"`, { stdio: "ignore" });

      const webpBuffer = fs.readFileSync(tmpWebp);
      await sock.sendMessage(from, { sticker: webpBuffer }, { quoted: msg });

      try { fs.unlinkSync(tmpPng); } catch {}
      try { fs.unlinkSync(tmpWebp); } catch {}

    } catch (err) {
      console.error("[qc] Error:", err.message);
      await sock.sendMessage(from, { text: "❌ Failed to generate sticker." }, { quoted: msg });
    }
  }
};
