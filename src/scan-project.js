const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = process.env.LUNE_TARGET || '/home/adolphe/CNEL -ELYSIUM/clenel-elysium';
const OUT_FILE = path.join(__dirname, '..', 'data', 'observatory.json');
const PUBLIC_OUT_FILE = path.join(__dirname, '..', 'public', 'data', 'observatory.json');

function countFiles(dir, predicate) {
  let total = 0;
  if (!fs.existsSync(dir)) return total;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['.git', 'node_modules', 'dist'].includes(entry.name)) continue;
      total += countFiles(full, predicate);
    } else if (predicate(full)) {
      total += 1;
    }
  }
  return total;
}

function scanProject(root = PROJECT_ROOT) {
  const stats = {
    markdown: countFiles(root, (file) => file.endsWith('.md')),
    ts: countFiles(root, (file) => file.endsWith('.ts')),
    js: countFiles(root, (file) => file.endsWith('.js')),
    json: countFiles(root, (file) => file.endsWith('.json')),
    packages: 0,
    apps: 0,
    docs: 0,
    tests: 0,
  };

  if (fs.existsSync(path.join(root, 'packages'))) {
    stats.packages = fs.readdirSync(path.join(root, 'packages')).filter((entry) => fs.statSync(path.join(root, 'packages', entry)).isDirectory()).length;
  }

  if (fs.existsSync(path.join(root, 'apps'))) {
    stats.apps = fs.readdirSync(path.join(root, 'apps')).filter((entry) => fs.statSync(path.join(root, 'apps', entry)).isDirectory()).length;
  }

  if (fs.existsSync(path.join(root, 'docs'))) {
    stats.docs = countFiles(path.join(root, 'docs'), (file) => file.endsWith('.md'));
  }

  stats.tests = countFiles(root, (file) => /\/tests\//.test(file) || /\.test\.(js|ts)$/.test(file));

  const readme = fs.existsSync(path.join(root, 'README.md')) ? fs.readFileSync(path.join(root, 'README.md'), 'utf8') : '';
  const missionSummary = {
    projectName: /#\s+(.+)/.exec(readme)?.[1] || 'Projet non identifié',
    mission: readme.includes('Plateforme') ? 'Système éducatif numérique national' : 'Projet de référence',
  };

  const summary = {
    generatedAt: new Date().toISOString(),
    targetProject: root,
    projectName: missionSummary.projectName,
    mission: missionSummary.mission,
    stats,
    status: {
      corpus: 'documenté',
      code: 'actif',
      build: 'à vérifier',
      production: 'non prêt',
      purpose: 'gouvernance et suivi du chantier',
    },
    priorities: [
      'Sécuriser l’infrastructure réelle et la crédibilité du déploiement',
      'Classer le projet selon des phases, dépendances et jalons clairs',
      'Créer un système de mémoire de projet autonome et consultable',
      'Tracabiliser les contributeurs et leurs outils de travail',
      'Mettre en place l’audit permanent et le conseil d’orientation'
    ]
  };

  fs.mkdirSync(path.dirname(PUBLIC_OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(summary, null, 2), 'utf8');
  fs.writeFileSync(PUBLIC_OUT_FILE, JSON.stringify(summary, null, 2), 'utf8');
  return summary;
}

module.exports = { scanProject, PROJECT_ROOT, OUT_FILE };

if (require.main === module) {
  const result = scanProject(PROJECT_ROOT);
  console.log(JSON.stringify({
    projectName: result.projectName,
    targetProject: result.targetProject,
    markdown: result.stats.markdown,
    packages: result.stats.packages,
    apps: result.stats.apps,
    tests: result.stats.tests,
    output: OUT_FILE,
  }, null, 2));
}
