module.exports = {
    name: 'approveall',
    aliases: ['acceptall'],
    category: 'Group',
    desc: 'Accept all pending join requests in the group',

    execute: async (sock, from, msg, args, perms) => {
        if (!from.endsWith('@g.us'))
            return sock.sendMessage(from, { text: '❌ This command only works in groups.' });

        const senderJid = msg.key.participant || msg.key.remoteJid;

        const meta = await sock.groupMetadata(from);
        const isGroupAdmin = meta.participants.some(p =>
        p.id === senderJid && (p.admin === 'admin' || p.admin === 'superadmin')
        );
        const allowed = isGroupAdmin || perms?.isOwner;
        if (!allowed)
            return sock.sendMessage(from, { text: '❌ Only *Group Admins* or *Owner* can approve requests.' });

        try {
            const requests = await sock.groupRequestParticipantsList(from);
            if (!requests || requests.length === 0) {
                return sock.sendMessage(from, { text: '📭 No pending join requests.' });
            }

            const jids = requests.map(r => r.jid);
            await sock.groupRequestParticipantsUpdate(from, jids, 'approve');
            await sock.sendMessage(from, { text: `✅ Approved *${jids.length}* pending request(s).` });
        } catch (err) {
            console.error('[approveall] Error:', err.message);
            await sock.sendMessage(from, { text: '❌ Failed to approve requests. Make sure I am an admin and there are pending requests.' });
        }
    }
};
