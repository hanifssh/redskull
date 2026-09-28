const activePaymentMessages = new Map();

module.exports = {
    name: 'bombpayment',
    aliases: ['bombpay', 'bombpayment'],
    description: 'Send payment request messages with hidden tag + quote shield',
    category: 'Group',
    ownerOnly: true,

    execute: async (sock, from, msg, args) => {
        if (!args || args.length === 0) {
            await sock.sendMessage(from, {
                text: `╭━─━─━─≪ ✠ ≫─━─━─━╮\n*PAYMENT BOMBER 💳*\n╰━─━─━─≪ ✠ ≫─━─━─━╯\n│ ✗ .pay <count> <note>\n│ ✗ .pay 10 hi guys\n│ ✗ Max 50 messages\n╰━─━─━─≪ ✠ ≫─━─━─━╯`
            });
            return;
        }

        try {
            const count = parseInt(args[0]) || 1;
            const totalMessages = Math.min(count, 50);
            const note = args.slice(1).join(' ') || 'Payment Request';
            const fromJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';

            let mentionedJid = [];

            if (from.endsWith('@g.us')) {
                try {
                    const groupMetadata = await sock.groupMetadata(from);
                    mentionedJid = groupMetadata.participants.map(p => p.id);
                } catch {}
            } else {
                const senderJid = msg.key.participant || msg.key.remoteJid;
                mentionedJid = [senderJid];
            }

            for (let i = 0; i < totalMessages; i++) {
                try {
                    const paymentPayload = {
                        requestPaymentMessage: {
                            amount1000: 0,
                            currencyCodeIso4217: 'USD',
                            requestFrom: fromJid,
                            expiryTimestamp: Math.floor(Date.now() / 1000) + 86400,
                            noteMessage: {
                                extendedTextMessage: {
                                    text: note,
                                    contextInfo: {
                                        mentionedJid: mentionedJid
                                    }
                                }
                            }
                        }
                    };

                    const sent = await sock.relayMessage(from, paymentPayload, {});

                    if (sent?.key?.id) {
                        activePaymentMessages.set(sent.key.id, {
                            from,
                            msgKey: sent.key,
                            timestamp: Date.now()
                        });

                        setTimeout(() => {
                            activePaymentMessages.delete(sent.key.id);
                        }, 10 * 60 * 1000);
                    }

                    await new Promise(r => setTimeout(r, 500));
                } catch (e) {
                    console.error('[pay] execution error:', e.message);
                }
            }

        } catch (error) {
            await sock.sendMessage(from, { text: `❌ Failed: ${error.message}` });
        }
    }
};

(function paymentShieldListener() {
    if (!global.sock) return setTimeout(paymentShieldListener, 500);

    global.sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

        for (const msg of messages) {
            if (!msg.message) continue;
            if (!msg.key.fromMe) continue;
            if (!activePaymentMessages.has(msg.key.id)) continue;

            const entry = activePaymentMessages.get(msg.key.id);

            try {
                await global.sock.sendMessage(entry.from, { text: '\u200b' }, { quoted: msg });
                activePaymentMessages.delete(msg.key.id);
            } catch (e) {
                console.error('[pay-shield] quote failed:', e.message);
            }
        }
    });
})();
