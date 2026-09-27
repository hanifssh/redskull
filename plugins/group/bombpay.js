module.exports = {
    name: 'payment',
    aliases: ['pay', 'bombpay', 'bombpayment'],
    description: 'Send payment request messages with hidden tag',
    category: 'Group',
    sudoOnly: true,

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

            let sent = 0;

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

                    await sock.relayMessage(from, paymentPayload, {});
                    sent++;

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
