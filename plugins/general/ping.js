module.exports = {
  name: 'ping',
  description: 'Check bot latency',
  category: 'General',
  execute: async (sock, from) => {
    const startTime = Date.now();

    await sock.sendMessage(from, {
      text: "_🏓 Pinging..._"
    });

    const latency = Date.now() - startTime;

    await sock.sendMessage(from, {
      text: "_📡 *Latency:* " + latency + "ms_"
    });
  }
};
