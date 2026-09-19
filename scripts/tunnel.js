const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const PORT = Number(process.env.PORT || 4173);
const binPath = path.join(__dirname, '../bin/cloudflared');
const urlFilePath = path.join(__dirname, '../data/public-url.txt');

console.log(`[LUNE TUNNEL] Démarrage du Cloudflare Tunnel sur port ${PORT}...`);

const child = spawn(binPath, ['tunnel', '--url', `http://127.0.0.1:${PORT}`, '--no-autoupdate'], {
  stdio: ['ignore', 'pipe', 'pipe']
});

function handleOutput(data) {
  const str = data.toString();
  process.stdout.write(str);
  
  // Regex pour capturer l'URL quick tunnel trycloudflare.com
  const match = str.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
  if (match) {
    const url = match[0];
    console.log(`\n======================================================`);
    console.log(`🚀 [LUNE TUNNEL CLOUDFLARE] URL OFFICIELLE ACCESSIBLE :`);
    console.log(`   👉 ${url}`);
    console.log(`======================================================\n`);
    try {
      fs.writeFileSync(urlFilePath, url, 'utf8');
    } catch (e) {}
  }
}

child.stdout.on('data', handleOutput);
child.stderr.on('data', handleOutput);

child.on('close', (code) => {
  console.log(`[LUNE TUNNEL] Processus terminé avec le code ${code}. Redémarrage PM2...`);
  process.exit(code || 1);
});
