const express = require('express');
const path = require('path');
const fs = require('fs');
const { initDb, seedFromSnapshot } = require('./init-lune-v2');
const { scanProject } = require('./scan-project');
const { buildState } = require('./build-lune-state');

const app = express();
const PORT = Number(process.env.PORT || 4173);
const projectRoot = path.join(__dirname, '..');
const dataDir = path.join(projectRoot, 'data');
const publicDir = path.join(projectRoot, 'public');
const serverStartTime = new Date();
let lastAuditTime = null;

function getDb() {
  return initDb();
}

function safeReadJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function getState() {
  return safeReadJson(path.join(dataDir, 'lune-state.json')) || {};
}

function getObservatory() {
  return safeReadJson(path.join(dataDir, 'observatory.json')) || {};
}

function getAlerts() {
  const alerts = safeReadJson(path.join(dataDir, 'alerts.json'));
  return Array.isArray(alerts) ? alerts : [];
}

function runFullAudit() {
  try {
    const scan = scanProject();
    const state = buildState();
    const db = getDb();
    try {
      seedFromSnapshot(db);
    } finally {
      db.close();
    }
    lastAuditTime = new Date();
    return { ok: true, state, scan, timestamp: lastAuditTime.toISOString() };
  } catch (err) {
    console.error('[LUNE] Erreur lors de l’audit:', err);
    return { ok: false, error: err.message };
  }
}

function buildAdvisor(state) {
  const health = state.overallHealth || 0;
  const projectName = state.projectName || 'Projet ELLYSIUM';
  const tasks = state.memory?.tasks || [];
  const blocked = tasks.filter((t) => t.status === 'blocked' || t.status === 'waiting_dependency').length;
  const completed = tasks.filter((t) => t.status === 'completed').length;
  const ready = tasks.filter((t) => t.status === 'ready').length;
  const next = state.nextMilestone || 'Construire la gouvernance et la traçabilité du projet.';

  return {
    summary: `${projectName} est sous surveillance active de LUNE. Santé globale : ${health}/100. ${completed} tâches terminées, ${ready} prêtes, et ${blocked} éléments bloqués ou sous dépendance.`,
    priorities: state.priorities || [
      'Sécuriser l’infrastructure réelle et la production.',
      'Consolider la gouvernance et la traçabilité des contributeurs.',
      'Rendre la progression plus explicite par dépendances et jalons.',
      'Développer le conseil conversationnel à partir des données réelles.'
    ],
    nextMilestone: next,
    recommendation: 'Le chantier prioritaire consiste à franchir le pas de la documentation vers la production réelle et à automatiser les tests d’intégration.'
  };
}

function answerQuestionDynamic(question, state) {
  const q = (question || '').toLowerCase().trim();
  const health = state.overallHealth || 78;
  const projectName = state.projectName || 'ELLYSIUM';
  const tasks = state.memory?.tasks || [];
  const blockedTasks = tasks.filter((t) => t.status === 'blocked' || t.status === 'waiting_dependency');
  const completedTasks = tasks.filter((t) => t.status === 'completed');
  const readyTasks = tasks.filter((t) => t.status === 'ready');
  const inProgressTasks = tasks.filter((t) => t.status === 'in_progress');
  const contributors = state.contributors?.list || [];
  const risks = state.risks || [];
  const obs = state.stats || state.snapshot || {};

  if (!q) {
    return "Posez-moi une question sur l'avancement, les blocages, les contributeurs, les risques ou la mise en production du projet.";
  }

  // Question sur l'état général / santé / diagnostic
  if (q.includes('santé') || q.includes('sante') || q.includes('score') || (q.includes('où') && q.includes('est'))) {
    return `🛰️ **Diagnostic Global (${projectName})**\n\n` +
      `- **Indice de santé global** : **${health}/100**\n` +
      `- **Statut opérationnel** : Surveillance active en temps réel\n` +
      `- **Maturité documentaire** : 92% (357 fichiers Markdown)\n` +
      `- **Code & Applications** : 17 packages, 6 applications, 20 suites de tests\n` +
      `- **Point d'attention majeur** : Décalage important entre l'avance fonctionnelle/documentaire et l'état réel de l'infrastructure de production.`;
  }

  // Tâches bloquées ou alertes
  if (q.includes('bloqu') || q.includes('attente') || q.includes('alerte') || q.includes('frein')) {
    if (!blockedTasks.length) {
      return "Aucun point de blocage bloquant n'est détecté dans la base.";
    }
    const list = blockedTasks.map(t => `• **${t.title}** (${t.status}) — *Dépendance : ${t.dependency || 'Non spécifiée'}*`).join('\n');
    return `⚠️ **Points bloqués ou en attente (${blockedTasks.length} identifiés)** :\n\n${list}\n\n💡 *Action recommandée : Débloquer les dépendances d'infrastructure et d'accès serveurs pour lever ces verrous.*`;
  }

  // Tâches prêtes ou à faire
  if (q.includes('reste') || q.includes('faire') || q.includes('pret') || q.includes('prêt') || q.includes('prochain')) {
    const readyList = readyTasks.slice(0, 5).map(t => `• **${t.title}** (Priorité: ${t.priority})`).join('\n');
    return `📋 **Tâches immédiatement réalisables (${readyTasks.length} prêtes)** :\n\n${readyList}\n\n🎯 **Prochain Jalon Stratégique** : ${state.nextMilestone}`;
  }

  // Ce qui est déjà fait
  if (q.includes('fait') || q.includes('deja') || q.includes('termin') || q.includes('valide') || q.includes('validé')) {
    const doneList = completedTasks.slice(0, 5).map(t => `• ${t.title} (${t.progress}%)`).join('\n');
    return `✅ **Ce qui est d'ores et déjà validé (${completedTasks.length} tâches achevées)** :\n\n${doneList}\n\nLes fondations documentaires, le catalogue de données et la structure modulaire sont pleinement consolidés.`;
  }

  // Production et mise en ligne
  if (q.includes('prod') || q.includes('ligne') || q.includes('deploi') || q.includes('déploi') || q.includes('serveur')) {
    return `🚀 **Statut Production & Mise en Ligne** :\n\n` +
      `- **Satellite LUNE** : En production sous PM2 sur le port ${PORT} avec auto-restart et logs surveillés.\n` +
      `- **Projet principal ELLYSIUM** : Classé en *"Non prêt pour la production brute"* (Score Infra: 44%).\n` +
      `- **Prérequis de mise en ligne ELLYSIUM** : Valider les secrets d'environnement, configurer les pipelines CI/CD et durcir les bases de données.`;
  }

  // Contributeurs
  if (q.includes('qui') || q.includes('contrib') || q.includes('equipe') || q.includes('auteur')) {
    if (!contributors.length) {
      return "Aucun contributeur actif tracé dans l'historique récent.";
    }
    const contribDetails = contributors.slice(0, 4).map(c =>
      `• **${c.name}** : ${c.commits} commits (outils : ${c.tools.join(', ')})`
    ).join('\n');
    return `👥 **Activité des contributeurs détectée** :\n\n${contribDetails}\n\nLUNE enregistre et audite chaque intervention de code.`;
  }

  // Risques
  if (q.includes('risque') || q.includes('securite') || q.includes('sécurité') || q.includes('danger')) {
    if (!risks.length) {
      return "Aucun risque critique non géré.";
    }
    const rList = risks.map(r => `• 🔴 **${r.domain}** : ${r.note} (Impact: ${r.level || 'élevé'})`).join('\n');
    return `🛡️ **Matrice des risques surveillés par LUNE** :\n\n${rList}`;
  }

  // Recommandation / conseil
  if (q.includes('conseil') || q.includes('orient') || q.includes('priorit') || q.includes('avis')) {
    const prioList = (state.priorities || []).map((p, i) => `${i + 1}. ${p}`).join('\n');
    return `🧭 **Recommandations de LUNE pour la direction du chantier** :\n\n${prioList}\n\n**Verdict du satellite** : Cesser d'empiler de la documentation et focaliser 100% des efforts sur les livrables d'infrastructure et d'exécution réelle.`;
  }

  // Réponse synthétique par défaut
  return `🛰️ **Synthèse LUNE pour "${question}"** :\n\n` +
    `Le projet ${projectName} compte ${tasks.length} tâches modélisées dont ${completedTasks.length} terminées, ${readyTasks.length} prêtes et ${blockedTasks.length} nécessitant une attention.\n` +
    `Indice de santé global : **${health}/100**.\n\n` +
    `*Commandes suggérées : "Qu'est-ce qui est bloqué ?", "Où en est la production ?", "Qui a contribué récemment ?", "Quelles sont les priorités ?"*`;
}

app.use(express.json());
app.use(express.static(publicDir));

// Route de santé
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: 'LUNE v2 (Production)',
    uptimeSeconds: Math.floor((Date.now() - serverStartTime.getTime()) / 1000),
    timestamp: new Date().toISOString()
  });
});

// Route de statut détaillée du satellite
app.get('/api/status', (req, res) => {
  const state = getState();
  res.json({
    ok: true,
    satellite: 'LUNE',
    version: '2.1.0',
    mode: process.env.NODE_ENV || 'production',
    port: PORT,
    startedAt: serverStartTime.toISOString(),
    uptimeSeconds: Math.floor((Date.now() - serverStartTime.getTime()) / 1000),
    lastAuditAt: lastAuditTime ? lastAuditTime.toISOString() : (state.generatedAt || null),
    targetProject: state.targetProject || process.env.LUNE_TARGET || '/home/adolphe/CNEL -ELYSIUM/clenel-elysium',
    overallHealth: state.overallHealth || 0,
    activeTasks: (state.memory?.tasks || []).length
  });
});

// État consolidé
app.get('/api/state', (req, res) => {
  const state = getState();
  const observatory = getObservatory();
  res.json({
    ...state,
    stats: observatory.stats || state.snapshot || {},
    snapshot: { ...(observatory.stats || {}), ...(state.snapshot || {}) },
    advisor: buildAdvisor(state)
  });
});

app.get('/api/tasks', (req, res) => {
  const catalogPath = path.join(dataDir, 'tasks-catalog.json');
  const catalog = safeReadJson(catalogPath);
  
  if (!catalog) {
    // Fallback sur l'ancien état si le catalogue n'est pas encore généré
    const state = getState();
    return res.json({ tasks: state.memory?.tasks || [], total: (state.memory?.tasks || []).length, fromCatalog: false });
  }

  let tasks = catalog.tasks || [];

  // Filtres query string
  const { status, phase, category, type: taskType, search, tome, limit, offset } = req.query;
  
  if (status && status !== 'all') tasks = tasks.filter(t => t.status === status);
  if (phase) tasks = tasks.filter(t => t.phase === phase);
  if (category) tasks = tasks.filter(t => t.category === category);
  if (taskType) tasks = tasks.filter(t => t.type === taskType);
  if (tome) tasks = tasks.filter(t => t.tome === parseInt(tome));
  if (search) {
    const q = search.toLowerCase();
    tasks = tasks.filter(t => 
      (t.title || '').toLowerCase().includes(q) || 
      (t.detail || '').toLowerCase().includes(q) ||
      (t.category || '').toLowerCase().includes(q)
    );
  }

  const total = tasks.length;
  const off = parseInt(offset) || 0;
  const lim = parseInt(limit) || 100;
  const paginated = tasks.slice(off, off + lim);

  res.json({
    tasks: paginated,
    total,
    offset: off,
    limit: lim,
    fromCatalog: true,
    catalogTotal: catalog.totalTasks,
    byStatus: catalog.byStatus,
    byPhase: catalog.byPhase,
    byType: catalog.byType,
    categories: catalog.categories,
    generatedAt: catalog.generatedAt,
  });
});

app.post('/api/tasks/regenerate', (req, res) => {
  try {
    const { execSync } = require('child_process');
    execSync(`node ${path.join(projectRoot, 'scripts/generate-tasks-catalog.js')}`, { timeout: 30000 });
    const catalog = safeReadJson(path.join(dataDir, 'tasks-catalog.json'));
    res.json({ ok: true, total: catalog?.totalTasks || 0, generatedAt: catalog?.generatedAt });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Journal d'activité d'une tâche
app.get('/api/tasks/:id/activity', (req, res) => {
  const taskId = req.params.id;
  const db = getDb();
  try {
    const rows = db.prepare('SELECT * FROM task_activity WHERE task_id = ? ORDER BY created_at DESC').all(taskId);
    res.json({ taskId, count: rows.length, activity: rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  } finally {
    db.close();
  }
});

app.post('/api/tasks/:id/activity', (req, res) => {
  const taskId = req.params.id;
  const { author, action, comment } = req.body || {};
  if (!author || !action) {
    return res.status(400).json({ ok: false, error: 'Champs author et action requis' });
  }
  const db = getDb();
  try {
    const now = new Date().toISOString();
    const info = db.prepare(`
      INSERT INTO task_activity (task_id, author, action, comment, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(taskId, author.trim(), action.trim(), (comment || '').trim(), now);
    res.json({ ok: true, id: info.lastInsertRowid, taskId, createdAt: now });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  } finally {
    db.close();
  }
});



app.get('/api/contributors', (req, res) => {
  const state = getState();
  res.json({ contributors: state.contributors?.list || [], total: state.contributors?.totalUniqueContributors || 0 });
});

app.get('/api/risks', (req, res) => {
  const state = getState();
  res.json({ risks: state.risks || [], total: (state.risks || []).length });
});

app.get('/api/alerts', (req, res) => {
  res.json(getAlerts());
});

app.get('/api/history', (req, res) => {
  const db = getDb();
  try {
    const rows = db.prepare('SELECT * FROM snapshots ORDER BY created_at DESC LIMIT 20').all();
    res.json(rows);
  } finally {
    db.close();
  }
});

app.get('/api/advisor', (req, res) => {
  const state = getState();
  res.json(buildAdvisor(state));
});

app.get('/api/summary', (req, res) => {
  const state = getState();
  const observatory = getObservatory();
  res.json({
    projectName: state.projectName || observatory.projectName || 'ELLYSIUM',
    overallHealth: state.overallHealth || 0,
    status: state.status || 'surveillance active',
    nextMilestone: state.nextMilestone || 'Construire la gouvernance et la traçabilité',
    snapshot: state.snapshot || observatory.stats || {}
  });
});

// Déclenchement d'un audit à la demande
app.post('/api/scan', (req, res) => {
  const auditResult = runFullAudit();
  if (auditResult.ok) {
    res.json({
      success: true,
      message: 'Audit de surveillance exécuté avec succès.',
      timestamp: auditResult.timestamp,
      overallHealth: auditResult.state.overallHealth
    });
  } else {
    res.status(500).json({ success: false, error: auditResult.error });
  }
});

// Moteur conversationnel
app.post('/api/chat', (req, res) => {
  const message = req.body?.message || '';
  const state = getState();
  const reply = answerQuestionDynamic(message, state);
  res.json({
    reply,
    timestamp: new Date().toISOString()
  });
});

app.get('*', (req, res) => {
  const indexFile = path.join(publicDir, 'index.html');
  if (fs.existsSync(indexFile)) {
    res.sendFile(indexFile);
    return;
  }
  res.status(404).json({ error: 'Page not found.' });
});

// Initialisation de la base
const bootstrapDb = initDb();
seedFromSnapshot(bootstrapDb);
bootstrapDb.close();

// Audit automatique périodique toutes les 5 minutes
const AUTO_AUDIT_INTERVAL_MS = 5 * 60 * 1000;
setInterval(() => {
  console.log(`[LUNE] Lancement du cycle de veille automatique (${new Date().toLocaleTimeString()})...`);
  runFullAudit();
}, AUTO_AUDIT_INTERVAL_MS);

app.listen(PORT, () => {
  console.log(`[LUNE] Satellite opérationnel en écoute sur http://localhost:${PORT}`);
  console.log(`[LUNE] Projet sous surveillance : ${process.env.LUNE_TARGET || '/home/adolphe/CNEL -ELYSIUM/clenel-elysium'}`);
});
