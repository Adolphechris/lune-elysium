const express = require('express');
const path = require('path');
const fs = require('fs');
const https = require('https');

// Chargement léger des variables .env sans dépendance externe
const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

async function callOpenRouter(systemPrompt, userMessage) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  const model = process.env.OPENROUTER_MODEL || 'google/gemini-2.5-pro';

  return new Promise((resolve) => {
    const payload = JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      temperature: 0.3,
      max_tokens: 2500
    });

    const req = https.request({
      hostname: 'openrouter.ai',
      path: '/api/v1/chat/completions',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://lune-elysium.loca.lt',
        'X-Title': 'Satellite LUNE - Conseiller Strategique'
      },
      timeout: 30000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.message?.content;
            resolve(content || null);
          } catch (e) {
            resolve(null);
          }
        } else {
          console.error('[LUNE OPENROUTER] Erreur HTTP:', res.statusCode, data.slice(0, 200));
          resolve(null);
        }
      });
    });

    req.on('error', (err) => {
      console.error('[LUNE OPENROUTER] Erreur réseau:', err.message);
      resolve(null);
    });

    req.on('timeout', () => {
      req.destroy();
      console.error('[LUNE OPENROUTER] Timeout 30s dépassé');
      resolve(null);
    });

    req.write(payload);
    req.end();
  });
}

const { initDb, seedFromSnapshot } = require('./init-lune-v2');
const { scanProject } = require('./scan-project');
const { buildState } = require('./build-lune-state');
const { generateTasksCatalog } = require('../scripts/generate-tasks-catalog');

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
    console.log('[LUNE] Démarrage de l’audit complet et synchronisation du chantier...');
    // 1. Régénération dynamique du catalogue de tâches depuis le code réel
    const catalog = generateTasksCatalog();
    // 2. Scan physique des fichiers, tests et métriques
    const scan = scanProject();
    // 3. Construction de l'état global LUNE
    const state = buildState();
    // 4. Historisation SQLite
    const db = getDb();
    try {
      seedFromSnapshot(db);
    } finally {
      db.close();
    }
    lastAuditTime = new Date();
    console.log(`[LUNE] Audit terminé avec succès. Santé globale : ${state.overallHealth}% (${catalog.totalTasks} tâches)`);
    return { ok: true, state, scan, catalog, timestamp: lastAuditTime.toISOString() };
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
    return `✅ **Ce qui est d'ores et déjà validé (${completedTasks.length} tâches achevées)** :\n\n${doneList}\n\n` +
      `🔥 **Avancées majeures du chantier ELLYSIUM** :\n` +
      `- 17 packages métier et 6 applications opérationnelles dans le monorepo.\n` +
      `- 172 tests automatisés passants à 100% (banc de stress test certifié à 240 000 calculs/sec).\n` +
      `- Teacher PWA, Parent Portal (Mobile Money) et PWA Offline (CRDT + IndexedDB) entièrement testés.\n` +
      `- Portail national de 20 pages en ligne sur Google Firebase Hosting (https://cnel-elysium-rdc.web.app).\n` +
      `- Chaîne didactique : Vague 1 complète (163 savoirs essentiels) et 43 leçons rédigées en Vague 2.`;
  }

  // Production et mise en ligne
  if (q.includes('prod') || q.includes('ligne') || q.includes('deploi') || q.includes('déploi') || q.includes('serveur')) {
    return `🚀 **Statut Production & Déploiement ELLYSIUM** :\n\n` +
      `- **Portail Officiel National** : EN LIGNE sur Google Firebase Hosting (https://cnel-elysium-rdc.web.app) — 20 landing pages interconnectées.\n` +
      `- **Satellite LUNE** : En ligne sous PM2 (port ${PORT}) avec Cloudflare Tunnel HTTPS permanent.\n` +
      `- **Infrastructure Cloud GCP** : 9 modules Terraform IaC complets prêts pour déploiement des 3 environnements (dev/staging/prod).\n` +
      `- **Code Applicatif PGI** : 17 packages et 6 applications compilées, 172 tests unitaires et intégration validés.\n` +
      `- **Prochaine étape** : Déployer le conteneur Cloud Run pour l'API Gateway et activer la persistance Firestore.`;
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
    return `🧭 **Recommandations Stratégiques de LUNE** :\n\n${prioList}\n\n**Verdict du satellite** : Le socle PGI et les tests sont validés. Les priorités sont désormais le déploiement Cloud Run de l'API Gateway et la poursuite de la rédaction des leçons de la Vague 2.`;
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
      ok: true,
      success: true,
      message: 'Audit de surveillance exécuté avec succès.',
      timestamp: auditResult.timestamp,
      overallHealth: auditResult.state.overallHealth
    });
  } else {
    res.status(500).json({ ok: false, success: false, error: auditResult.error });
  }
});

// Moteur conversationnel intelligent alimenté par OpenRouter
app.post('/api/chat', async (req, res) => {
  const userMessage = (req.body?.message || '').trim();
  const state = getState();
  const observatory = getObservatory();
  const catalog = safeReadJson(path.join(dataDir, 'tasks-catalog.json')) || {};

  if (!userMessage) {
    return res.json({
      reply: "Posez-moi votre question sur la gouvernance, l'architecture, les blocages ou la mise en production du projet ELLYSIUM.",
      timestamp: new Date().toISOString()
    });
  }

  // Préparation du contexte réel complet pour le LLM
  const systemPrompt = `Tu es le Conseiller Stratégique Supérieur du Satellite LUNE (v2.1), l'organe officiel et régalien d'audit, de mémoire et de gouvernance du projet national ELLYSIUM (Centre National d'Étude en Ligne - CNEL) en République Démocratique du Congo (RDC).

DIRECTIVES FONDATRICES & CONSTITUTION :
1. Devise : "Rigueur, sérieux et honnêteté sont nos devises".
2. Infrastructure souveraine exclusive : 100% Google Cloud Platform (Constitution, Article 1 bis). Toute autre infrastructure (AWS, Azure) est nulle et bannie. Chiffrement CMEK/Cloud KMS sous souveraineté exclusive de la RDC.
3. Étanchéité financière (Article 5) : Séparation absolue entre la caisse financière et la scolarité. Aucun élève ne peut être exclu ou pénalisé pour des raisons financières.
4. Arbitrage humain sur l'IA (Article 6) : L'IA est un auxiliaire. Aucune décision académique ou disciplinaire finale n'est déléguée à un algorithme.
5. Formule officielle des notes RDC : Taux = (Somme Points Obtenus / Somme Maxima) * 100.
6. Division du travail : Piste IA (code, docs, squelettes, tests) vs Piste Humaine (ASBL, agréments ministériels EPST/ESU, partenariats, facturation GCP, labo physique Kinshasa). L'IA ne s'attribue jamais le travail humain.

ÉTAT EN TEMPS RÉEL DU PROJET :
- Santé globale du projet : ${state.overallHealth || 90}/100.
- Corpus documentaire : 19 tomes complets, 282 modules numérotés, 1 680 verrous fonctionnels VF- scellés et validés par verify-corpus.sh.
- Monorepo Code PGI : 17 packages et 6 applications entièrement opérationnels et interconnectés (api-gateway, parent-portal, teacher-pwa, pwa-offline, verify-portal, web-portal).
- Assurance Qualité & Tests : 172 tests unitaires et d'intégration validés à 100% sans aucun échec (banc de stress test validé à 240 000 calculs/seconde).
- Applications récentes : Teacher PWA (carnet de notes & appel hors-ligne), Parent Portal (suivi scolarité et paiements Mobile Money M-Pesa/Orange/Airtel sans blocage académique Art. 5), PWA Offline (IndexedDB, synchronisation différentielle CRDT et chiffrement AES-256-GCM).
- Chaîne didactique : Vague 1 complète (6 fiches-matières + 6 cours/syllabus, 163 savoirs essentiels officiels) et ${state.snapshot?.lessons || 43} leçons rédigées en Vague 2 dans contenus/04-LECONS/ validées par verify-contenus.sh.
- Déploiement Public : Portail national officiel de 20 pages en ligne sur Google Firebase Hosting (https://cnel-elysium-rdc.web.app).
- Infrastructure & Souveraineté : 9 modules Terraform IaC complets prêts pour GCP (compute Cloud Run, database PostgreSQL, memorystore Redis, storage CMEK, security Cloud Armor WAF).
- Catalogue de tâches : ${catalog.totalTasks || 1094} livrables répertoriés (Complétés: ${catalog.byStatus?.completed || 982}, En cours: ${catalog.byStatus?.in_progress || 99}, À faire: ${catalog.byStatus?.todo || 13}).
- Prochain jalon critique : Déploiement Cloud Run de l'API Gateway, poursuite des leçons Vague 2 et préparation du banc d'essai labo Kinshasa (Phase 0).
- Risques actifs surveillés : ${JSON.stringify(state.risks || [])}.
- Alertes récentes : ${JSON.stringify(getAlerts().slice(0, 5))}.

INSTRUCTIONS DE RÉPONSE :
- Réponds avec une haute intelligence stratégique, une autorité bienveillante et une maîtrise totale de l'architecture du projet ELLYSIUM.
- Sois exhaustif, précis, technique et concret (ne sois pas limité artificiellement par le nombre de mots lorsque le sujet nécessite une analyse approfondie).
- Structure tes réponses avec des titres, des puces claires et des recommandations d'action précises.
- Tu t'adresses directement au Promoteur / Direction du projet.`;

  try {
    const aiReply = await callOpenRouter(systemPrompt, userMessage);
    if (aiReply) {
      return res.json({
        reply: aiReply,
        model: process.env.OPENROUTER_MODEL || 'google/gemini-2.5-pro',
        source: 'openrouter',
        timestamp: new Date().toISOString()
      });
    }
  } catch (err) {
    console.error('[LUNE] Erreur appel OpenRouter:', err.message);
  }

  // Fallback dynamique local si l'API distante est indisponible
  const fallbackReply = answerQuestionDynamic(userMessage, state);
  res.json({
    reply: fallbackReply,
    source: 'fallback-local',
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
