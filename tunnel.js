// Simple LocalTunnel starter
const localtunnel = require('localtunnel');

(async () => {
  try {
    const tunnel = await localtunnel({ port: 3000 });
    console.log(`LocalTunnel ativo: ${tunnel.url}`);
    console.log(`Host: ${tunnel.url}/host.html`);
    console.log(`Jogadores: ${tunnel.url}/player.html`);

    tunnel.on('close', () => {
      console.log('Túnel encerrado');
    });
  } catch (err) {
    console.error('Falha ao abrir túnel:', err.message || err);
    process.exit(1);
  }
})();
