const localtunnel = require('localtunnel');

const PORT = Number(process.env.PORT || 4173);
const SUBDOMAIN = process.env.TUNNEL_SUBDOMAIN || 'lune-elysium';

async function start() {
  try {
    const tunnel = await localtunnel({ port: PORT, subdomain: SUBDOMAIN });
    console.log(`[LUNE TUNNEL] En ligne publiquement : ${tunnel.url}`);

    tunnel.on('close', () => {
      console.warn('[LUNE TUNNEL] Fermeture détectée, relance...');
      process.exit(1);
    });

    tunnel.on('error', (err) => {
      console.error('[LUNE TUNNEL] Erreur:', err);
      process.exit(1);
    });
  } catch (err) {
    console.error('[LUNE TUNNEL] Échec ouverture:', err);
    process.exit(1);
  }
}

start();
