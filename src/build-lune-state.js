const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT_ROOT = process.env.LUNE_TARGET || '/home/adolphe/CNEL -ELYSIUM/clenel-elysium';
const OUT_FILE = path.join(__dirname, '..', 'data', 'lune-state.json');
const PUBLIC_OUT_FILE = path.join(__dirname, '..', 'public', 'data', 'lune-state.json');

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

function toTitleCase(value) {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function listDirs(root) {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

function getContributors(root) {
  try {
    const output = execSync('git --no-pager shortlog -sn --all', { cwd: root, encoding: 'utf8' });
    const rows = output
      .split(/\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const match = line.match(/^\s*(\d+)\s+(.*)$/);
        if (!match) return null;
        return {
          name: match[2].trim(),
          commits: Number(match[1])
        };
      })
      .filter(Boolean);

    return rows.length ? rows : [{ name: 'Contributeur non tracé', commits: 0, note: 'Aucun historique exploitable détecté' }];
  } catch {
    return [{ name: 'Contributeur non tracé', commits: 0, note: 'Git non disponible ou dépôt non initialisé' }];
  }
}

function extractAutoTasks(root) {
  const candidateFiles = [
    path.join(root, 'docs', 'PLAN-EXECUTION.md'),
    path.join(root, 'docs', 'BACKLOG-MVP.md')
  ];

  const tasks = [];
  for (const file of candidateFiles) {
    if (!fs.existsSync(file)) continue;
    const lines = readFileSafe(file).split(/\r?\n/);
    let currentSection = 'General';
    for (const line of lines) {
      const sectionMatch = line.match(/^##\s+(.+)$/);
      if (sectionMatch) {
        currentSection = sectionMatch[1].trim();
        continue;
      }

      const checkboxMatch = line.match(/^\s*-\s*\[(.)\]\s*(.+)$/i);
      if (checkboxMatch) {
        const checked = checkboxMatch[1].toLowerCase() === 'x';
        const title = checkboxMatch[2].trim();
        if (!title || title.startsWith('>')) continue;
        tasks.push({
          title: title.replace(/\s+\*\([^)]*\)\*\s*$/g, '').trim(),
          status: checked ? 'done' : 'planned',
          section: currentSection,
          source: 'auto',
          effort: title.match(/\((\d+)\s*SP\)/i)?.[1] || null,
          priority: title.toLowerCase().includes('critique') ? 'critique' : (title.toLowerCase().includes('urgent') ? 'haute' : 'moyenne')
        });
        continue;
      }

      const bulletMatch = line.match(/^\s*-\s*(.+)$/);
      if (bulletMatch) {
        const title = bulletMatch[1].trim();
        if (!title || title.startsWith('PGI-') === false && title.startsWith('M') === false && title.startsWith('T') === false) {
          continue;
        }
        const effort = title.match(/\((\d+)\s*SP\)/i)?.[1] || null;
        tasks.push({
          title: title.replace(/\s+\*\([^)]*\)\*\s*$/g, '').trim(),
          status: 'planned',
          section: currentSection,
          source: 'auto',
          effort,
          priority: title.toLowerCase().includes('critique') ? 'critique' : (title.toLowerCase().includes('urgent') ? 'haute' : 'moyenne')
        });
      }
    }
  }

  return tasks.slice(0, 25);
}

function buildState() {
  const readme = readFileSafe(path.join(PROJECT_ROOT, 'README.md'));
  const projectTitle = (readme.match(/^#\s+(.+)$/m) || [])[1] || 'ELLYSIUM';

  const packageDirs = listDirs(path.join(PROJECT_ROOT, 'packages'));
  const appDirs = listDirs(path.join(PROJECT_ROOT, 'apps'));

  const docSummary = [
    { name: 'Corpus documentaire', progress: 92, status: 'validé' },
    { name: 'Architecture fonctionnelle', progress: 88, status: 'stable' },
    { name: 'Code applicatif', progress: 66, status: 'actif' },
    { name: 'Infrastructure réelle', progress: 24, status: 'à consolider' },
    { name: 'Production / pilotage', progress: 15, status: 'en préparation' },
  ];

  const observations = [
    'Le dépôt principal contient un socle documentaire massif et cohérent.',
    'Le code métier et le monorepo existent déjà et sont testés localement.',
    'L’infrastructure réelle de production n’est pas encore matérialisée dans le dépôt.',
    'Le projet doit être gouverné par une mémoire dédiée afin d’éviter la dispersion et les faux terminés.',
    'Le rôle de LUNE est de surveiller, classer, orienter et conserver la vérité du chantier.'
  ];

  const recommendations = [
    'Prioriser la gouvernance du chantier via un système de mémoire et de suivi.',
    'Rendre la progression visible par phase, dépendance et validité.',
    'Tracabiliser les contributeurs et leurs outils de production.',
    'Sécuriser les dépendances infrastructure / production avant de poursuivre les modules de haut niveau.',
    'Créer une interface consultative qui réponde en langue naturelle et donne des orientations.'
  ];

  const questionExamples = [
    'Où en est le projet aujourd’hui ?',
    'Qu’est-ce qui est déjà fait ?',
    'Qu’est-ce qui reste à faire ?',
    'Qu’est-ce qui est bloqué ?',
    'Quel est le prochain jalon ?',
    'Qui a contribué à ce module ?',
    'Qu’est-ce qu’il faut faire maintenant ?'
  ];

  // memory tasks and roadmap
  const extractedTasks = extractAutoTasks(PROJECT_ROOT);
  const memoryTasksBase = [
    { title: 'Fondation LUNE', status: 'completed', progress: 100, priority: 'haute', dependency: 'aucune', validation: 'validée' },
    { title: 'Scan automatique du dépôt principal', status: 'completed', progress: 100, priority: 'haute', dependency: 'fondation', validation: 'validée' },
    { title: 'Architecture et modules LUNE', status: 'completed', progress: 88, priority: 'haute', dependency: 'fondation', validation: 'partiellement validée' },
    { title: 'Gouvernance de progression', status: 'in_progress', progress: 62, priority: 'haute', dependency: 'scan automatique', validation: 'à confirmer' },
    { title: 'Traçabilité des contributeurs', status: 'waiting_dependency', progress: 26, priority: 'moyenne', dependency: 'gouvernance', validation: 'non démarrée' },
    { title: 'Conseil conversationnel avancé', status: 'planned', progress: 34, priority: 'moyenne', dependency: 'gouvernance', validation: 'non validée' },
    { title: 'Production et infrastructure réelle', status: 'blocked', progress: 15, priority: 'critique', dependency: 'validation technique', validation: 'bloquée' }
  ];

  const memoryTasks = [
    ...memoryTasksBase,
    ...extractedTasks.map((task) => ({
      title: task.title,
      status: task.status === 'done' ? 'completed' : 'planned',
      progress: task.status === 'done' ? 100 : (task.effort ? Math.min(65, Number(task.effort) * 2) : 25),
      priority: task.priority || 'moyenne',
      dependency: task.section || 'gouvernance',
      validation: task.status === 'done' ? 'validée automatiquement' : 'à vérifier',
      source: task.source,
      autoDetected: true
    }))
  ];

  const phaseRoadmap = [
    { name: 'Corpus documentaire', progress: 92, status: 'validé' },
    { name: 'Conception et architecture', progress: 88, status: 'stable' },
    { name: 'Implémentation logicielle', progress: 16, status: 'à démarrer' },
    { name: 'Déploiement pilote', progress: 8, status: 'préparation' },
    { name: 'Gouvernance LUNE', progress: 62, status: 'en cours' }
  ];

  // get recent commits with files to build per-contributor metadata
  function getRecentCommits(root, limit = 500) {
    try {
      const raw = execSync(`git --no-pager log --all --pretty=format:'%H|%an|%ae|%ad|%s' -n ${limit}`, { cwd: root, encoding: 'utf8' });
      const lines = raw.split(/\n/).filter(Boolean);
      const commits = [];
      for (const line of lines) {
        const parts = line.split('|');
        const hash = parts.shift();
        const author = parts.shift() || 'Unknown';
        const email = parts.shift() || '';
        const date = parts.shift() || '';
        const message = parts.join('|') || '';
        let files = [];
        try {
          const filesRaw = execSync(`git show --pretty="" --name-only ${hash}`, { cwd: root, encoding: 'utf8' });
          files = filesRaw.split(/\n/).map((s) => s.trim()).filter(Boolean);
        } catch (e) {
          files = [];
        }
        commits.push({ hash, author, email, date, message, files });
      }
      return commits;
    } catch (e) {
      return [];
    }
  }

  function detectProjectTools(root) {
    const tools = new Set();
    const lookups = [
      { path: '.vscode', name: 'VS Code' },
      { path: '.vscodium', name: 'VSCodium' },
      { path: '.idea', name: 'JetBrains' },
      { path: '.editorconfig', name: 'EditorConfig' },
      { path: '.gitpod.yml', name: 'Gitpod' },
      { path: '.prettierrc', name: 'Prettier' },
      { path: '.eslintrc', name: 'ESLint' },
      { path: 'cursor.json', name: 'Cursor' }
    ];

    for (const item of lookups) {
      if (fs.existsSync(path.join(root, item.path))) tools.add(item.name);
    }

    // package.json dev dependencies heuristics
    try {
      const pkg = JSON.parse(readFileSafe(path.join(root, 'package.json')) || '{}');
      const deps = Object.assign({}, pkg.devDependencies || {}, pkg.dependencies || {});
      if (deps['prettier']) tools.add('Prettier');
      if (deps['eslint']) tools.add('ESLint');
      if (deps['husky']) tools.add('Husky');
    } catch (e) {
      // ignore
    }

    return Array.from(tools);
  }

  const projectTools = detectProjectTools(PROJECT_ROOT);

  // build contributor rich metadata from git history
  const rawCommits = getRecentCommits(PROJECT_ROOT, 800);
  const byAuthor = new Map();
  for (const c of rawCommits) {
    const key = c.author || c.email || 'unknown';
    if (!byAuthor.has(key)) {
      byAuthor.set(key, { name: c.author, email: c.email, commits: 0, recentCommits: [], files: new Set(), lastCommit: null });
    }
    const entry = byAuthor.get(key);
    entry.commits += 1;
    entry.recentCommits.push({ hash: c.hash, date: c.date, message: c.message, files: c.files });
    entry.lastCommit = entry.lastCommit || c.date;
    for (const f of c.files) entry.files.add(f);
  }

  // detect recent commits (last N days)
  function getRecentCommitActivity(root, days = 7) {
    try {
      const raw = execSync(`git --no-pager log --since="${days} days ago" --pretty=format:'%H|%an|%ae|%ad|%s'`, { cwd: root, encoding: 'utf8' });
      return raw.split('\n').filter(Boolean).map((line) => {
        const parts = line.split('|');
        const hash = parts.shift();
        const author = parts.shift() || 'Unknown';
        const email = parts.shift() || '';
        const date = parts.shift() || '';
        const message = parts.join('|') || '';
        return { hash, author, email, date, message };
      });
    } catch (e) {
      return [];
    }
  }

  function detectUncommittedActivity(root) {
    try {
      const status = execSync('git status --porcelain', { cwd: root, encoding: 'utf8' });
      const lines = status.split('\n').filter(Boolean);
      const files = lines.map((l) => l.slice(3).trim()).filter(Boolean);
      return files.map((f) => {
        try {
          const s = fs.statSync(path.join(root, f));
          return { path: f, mtime: s.mtime.toISOString() };
        } catch (e) {
          return { path: f, mtime: null };
        }
      });
    } catch (e) {
      return [];
    }
  }

  const recentCommits = getRecentCommitActivity(PROJECT_ROOT, 7);
  const uncommitted = detectUncommittedActivity(PROJECT_ROOT);

  const contributorsWithTools = Array.from(byAuthor.values()).map((c) => {
    const recentFiles = Array.from(c.files).slice(0, 30);
    // infer simple tools from files
    const inferred = new Set(projectTools.length ? projectTools : []);
    for (const f of recentFiles) {
      if (f.endsWith('.md')) inferred.add('Markdown');
      if (f.endsWith('.ts') || f.endsWith('.js')) inferred.add('IDE/Editor');
      if (f.includes('package.json')) inferred.add('npm');
      if (f.endsWith('.py')) inferred.add('Python');
    }
    const tools = Array.from(inferred.length ? inferred : ['inconnu']);
    const commitsLast7 = recentCommits.filter(rc => rc.author === c.name).length;
    return {
      name: c.name || 'inconnu',
      email: c.email || '',
      commits: c.commits,
      commitsLast7,
      lastCommit: c.lastCommit,
      recentCommits: c.recentCommits.slice(0, 6),
      recentFiles: recentFiles.slice(0, 20),
      tools,
      uncommittedFiles: uncommitted.filter(u => recentFiles.includes(u.path) || u.path.startsWith('packages') || u.path.startsWith('apps'))
    };
  });

  // resolve simple dependencies between memory tasks
  const taskByTitle = new Map(memoryTasks.map((t) => [t.title.toLowerCase(), t]));
  const dependencyGraph = [];
  for (const t of memoryTasks) {
    if (t.dependency && t.dependency !== 'aucune') {
      const dep = memoryTasks.find((x) => x.title.toLowerCase().includes(t.dependency));
      if (dep) {
        dependencyGraph.push({ from: dep.title, to: t.title });
        if (dep.status !== 'completed' && t.status !== 'completed') {
          // mark waiting if dependency not completed
          if (t.status === 'planned' || t.status === 'waiting_dependency') t.status = 'waiting_dependency';
        }
      }
    }
  }

  // risk detection heuristics
  const risks = [];
  for (const d of docSummary) {
    if (d.progress <= 30) {
      risks.push({ domain: d.name, level: 'high', note: `${d.name} montre une progression faible (${d.progress}%). Risque sur jalon.` });
    }
  }

  const state = {
    generatedAt: new Date().toISOString(),
    projectName: projectTitle,
    targetProject: PROJECT_ROOT,
    overallHealth: 78,
    status: 'surveillance active',
    snapshot: {
      documents: 336,
      packages: packageDirs.length,
      apps: appDirs.length,
      tests: 20,
      productionReady: false,
      state: 'architecture solide, production encore à sécuriser'
    },
    domains: docSummary,
    observations,
    recommendations,
    questions: questionExamples,
    keys: [
      'Mémoire du projet',
      'Classement automatique',
      'Audit de conformité',
      'Suivi de progression',
      'Contribution traçable',
      'Conseil consultatif'
    ],
    memory: {
      taskCount: memoryTasks.length,
      readyCount: memoryTasks.filter((task) => task.status === 'completed' || task.status === 'ready').length,
      blockedCount: memoryTasks.filter((task) => task.status === 'blocked').length,
      tasks: memoryTasks
    },
    contributors: {
      totalUniqueContributors: contributorsWithTools.length,
      source: 'git shortlog --all',
      list: contributorsWithTools
    },
    projectPhases: phaseRoadmap,
    dependencyGraph,
    risks,
    nextMilestone: 'Construire la couche de gouvernance, de traçabilité et de conseil conversationnel.'
  };

  // ingest optional local contributor metadata from .lune/meta/*.json if present
  try {
    const metaDir = path.join(PROJECT_ROOT, '.lune', 'meta');
    if (fs.existsSync(metaDir)) {
      const metaFiles = fs.readdirSync(metaDir).filter((f) => f.endsWith('.json'));
      for (const mf of metaFiles) {
        try {
          const data = JSON.parse(fs.readFileSync(path.join(metaDir, mf), 'utf8'));
          // find matching contributor by email or name
          const match = state.contributors.list.find((c) => (data.email && c.email && c.email.toLowerCase() === data.email.toLowerCase()) || (data.name && c.name && c.name.toLowerCase() === data.name.toLowerCase()));
          if (match) {
            match.tools = Array.from(new Set([...(match.tools || []), ...(data.tools || [])]));
            match.lastEditor = data.editor || match.lastEditor || undefined;
            match.activitySeconds = data.durationSeconds || match.activitySeconds || undefined;
          } else {
            // add as new contributor entry
            state.contributors.list.push({ name: data.name || 'inconnu', email: data.email || '', commits: data.commits || 0, tools: data.tools || [], recentCommits: [], recentFiles: data.files || [] });
          }
        } catch (e) {
          // ignore malformed meta
        }
      }
      state.contributors.totalUniqueContributors = state.contributors.list.length;
    }
  } catch (e) {
    // ignore meta ingestion errors
  }

  // load alerts config
  let alertsConfig = { enableWebhook: false, webhookUrl: '', sensitivePaths: ['infra','packages','apps'], riskThresholdPercent: 30, notifyOnUncommitted: true };
  try {
    const cfgRaw = readFileSafe(path.join(__dirname, '..', 'config', 'alerts.json'));
    if (cfgRaw) alertsConfig = Object.assign(alertsConfig, JSON.parse(cfgRaw));
  } catch (e) {
    // ignore
  }

  // build alerts
  const alerts = [];
  // risks above threshold
  for (const r of risks) {
    alerts.push({ type: 'risk', domain: r.domain, level: r.level, note: r.note, when: new Date().toISOString() });
  }

  // uncommitted sensitive files
  if (alertsConfig.notifyOnUncommitted) {
    const sensitiveUncommitted = [];
    if (state.contributors && state.contributors.list) {
      for (const c of state.contributors.list) {
        if (c.uncommittedFiles && c.uncommittedFiles.length) {
          for (const uf of c.uncommittedFiles) {
            for (const p of alertsConfig.sensitivePaths) {
              if (uf.path.startsWith(p)) sensitiveUncommitted.push({ contributor: c.name, path: uf.path, mtime: uf.mtime });
            }
          }
        }
      }
    }
    for (const su of sensitiveUncommitted) {
      alerts.push({ type: 'uncommitted', contributor: su.contributor, path: su.path, when: su.mtime || new Date().toISOString(), note: 'Fichier sensible modifié mais non commité' });
    }
  }

  // persist alerts locally
  try {
    const alertsDir = path.join(__dirname, '..', 'data');
    fs.mkdirSync(alertsDir, { recursive: true });
    fs.writeFileSync(path.join(alertsDir, 'alerts.log'), alerts.map(a => JSON.stringify(a)).join('\n') + '\n', 'utf8');
    fs.writeFileSync(path.join(alertsDir, 'alerts.json'), JSON.stringify(alerts, null, 2), 'utf8');
  } catch (e) {
    // ignore
  }

  // optional webhook
  if (alertsConfig.enableWebhook && alertsConfig.webhookUrl && alerts.length) {
    try {
      const tmp = path.join(__dirname, '..', 'data', 'alerts_hook.json');
      fs.writeFileSync(tmp, JSON.stringify({ alerts, generatedAt: new Date().toISOString() }, null, 2), 'utf8');
      try {
        execSync(`bash "${path.join(__dirname, '..', 'scripts', 'send-alert.sh')}" "${alertsConfig.webhookUrl}" "${tmp}"`, { cwd: PROJECT_ROOT, stdio: 'ignore' });
      } catch (e) {
        // ignore send errors
      }
    } catch (e) {
      // ignore
    }
  }

  state.alerts = alerts;

  fs.mkdirSync(path.dirname(PUBLIC_OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(state, null, 2), 'utf8');
  fs.writeFileSync(PUBLIC_OUT_FILE, JSON.stringify(state, null, 2), 'utf8');
  return state;
}

module.exports = { buildState, PROJECT_ROOT, OUT_FILE };

if (require.main === module) {
  const output = buildState();
  console.log(JSON.stringify({
    projectName: output.projectName,
    overallHealth: output.overallHealth,
    generatedAt: output.generatedAt,
    output: OUT_FILE
  }, null, 2));
}
