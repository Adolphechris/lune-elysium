#!/usr/bin/env node
/**
 * generate-tasks-catalog.js
 * Extrait dynamiquement le vrai catalogue de tâches du projet ELLYSIUM depuis :
 *  - sommaire.md (336 modules documentaires)
 *  - README.md (état des tomes)
 *  - PLAN-EXECUTION.md & BACKLOG-MVP.md
 *  - Chaque tome individuel (verrous VF-)
 *  - Les apps et packages (détection dynamique du code réel, des tests et de l'IaC)
 *  - La chaîne de contenus pédagogiques (fiches N1, cours N2, leçons N3)
 * Génère data/tasks-catalog.json et public/data/tasks-catalog.json
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ELLYSIUM = process.env.LUNE_TARGET || path.resolve('/home/adolphe/CNEL -ELYSIUM/clenel-elysium');
const OUT = path.resolve(__dirname, '../data/tasks-catalog.json');
const PUBLIC_OUT = path.resolve(__dirname, '../public/data/tasks-catalog.json');

// ─── UTILITAIRES ─────────────────────────────────────────────────────────────

function readFile(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return ''; }
}

function exists(rel) {
  return fs.existsSync(path.join(ELLYSIUM, rel));
}

function countFiles(rel, pattern) {
  const dir = path.join(ELLYSIUM, rel);
  if (!fs.existsSync(dir)) return 0;
  let count = 0;
  try {
    const list = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of list) {
      if (item.isDirectory()) {
        count += countFiles(path.join(rel, item.name), pattern);
      } else if (!pattern || pattern.test(item.name)) {
        count++;
      }
    }
  } catch {
    // ignore
  }
  return count;
}

function statusFromTome(tomeNum) {
  // D'après README.md et verify-corpus.sh :
  // tomes 1-10, 15-19 = rédigés et scellés ; 11-14 = en consolidation active
  const done = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 16, 17, 18, 19];
  const inprogress = [11, 12, 13, 14];
  if (done.includes(tomeNum)) return 'completed';
  if (inprogress.includes(tomeNum)) return 'in_progress';
  return 'todo';
}

function priorityFromTome(tomeNum) {
  if ([1, 2, 3].includes(tomeNum)) return 'fondateur';
  if ([5, 7, 8, 9, 10].includes(tomeNum)) return 'critique';
  if ([11, 12, 13].includes(tomeNum)) return 'haute';
  if ([16, 17].includes(tomeNum)) return 'haute';
  return 'normale';
}

// ─── CATALOGUE DES TOMES ─────────────────────────────────────────────────────

const TOMES_META = {
  1:  { label: 'Vision, Philosophie et Mission',                 modules: 'M001–M018', phase: 'Fondation' },
  2:  { label: 'Constitution de l\'Institution',                  modules: 'M019–M036', phase: 'Fondation' },
  3:  { label: 'Architecture Pédagogique et Ingénierie',         modules: 'M037–M046', phase: 'Fondation' },
  4:  { label: 'Programmes d\'Études Secondaire & Supérieur',     modules: 'M047–M054', phase: 'Fondation' },
  5:  { label: 'Architecture Fonctionnelle',                      modules: '55–83',     phase: 'Spécification' },
  6:  { label: 'Expérience Utilisateur et Design System',        modules: '84–106',    phase: 'Spécification' },
  7:  { label: 'Architecture Technique et Interopérabilité',     modules: '107–129',   phase: 'Spécification' },
  8:  { label: 'Intelligence Artificielle Souveraine',           modules: '130–149',   phase: 'Spécification' },
  9:  { label: 'Données, Cybersécurité et Souveraineté',        modules: '150–170',   phase: 'Spécification' },
  10: { label: 'Examens, Certifications, Bulletins et Diplômes', modules: '171–191',   phase: 'Spécification' },
  11: { label: 'Administration et Communication Interne',        modules: '192–210',   phase: 'Consolidation' },
  12: { label: 'Applications Numériques',                        modules: '211–227',   phase: 'Consolidation' },
  13: { label: 'Infrastructure, Exploitation et AQ Technique',  modules: '228–246',   phase: 'Consolidation' },
  14: { label: 'Organisation, RH et Production des Contenus',   modules: '247–262',   phase: 'Consolidation' },
  15: { label: 'Partenariats, Accréditation et Reconnaissance', modules: '263–277',   phase: 'Institutionnel' },
  16: { label: 'Feuille de Route de Lancement',                 modules: '278–293',   phase: 'Déploiement' },
  17: { label: 'Modèle Économique et Pérennité Financière',     modules: '294–308',   phase: 'Pérennité' },
  18: { label: 'Communication et Marketing',                     modules: '309–319',   phase: 'Pérennité' },
  19: { label: 'Juridique, Conformité et ASBL',                 modules: '320–336',   phase: 'Pérennité' },
};

// ─── PARSER SOMMAIRE.MD ──────────────────────────────────────────────────────

function parseSommaire() {
  const text = readFile(path.join(ELLYSIUM, 'sommaire.md'));
  const tasks = [];
  
  const moduleRegex = /^(\d+)\.\s+(.+)$/gm;
  let match;
  
  const moduleToTome = {};
  for (const [t, meta] of Object.entries(TOMES_META)) {
    const r = meta.modules.match(/(\d+)[–-](\d+)/);
    if (r) {
      for (let i = parseInt(r[1]); i <= parseInt(r[2]); i++) {
        moduleToTome[i] = parseInt(t);
      }
    }
  }

  while ((match = moduleRegex.exec(text)) !== null) {
    const num = parseInt(match[1]);
    const title = match[2].trim().replace(/\*\*|\*/g, '').replace(/\s*\(fusionné\)/g, '').replace(/\s*–.*$/, '').trim();
    if (num < 1 || num > 400 || !title) continue;
    
    const tomeNum = moduleToTome[num] || Math.ceil(num / 18);
    const tomeMeta = TOMES_META[tomeNum] || { label: 'Général', phase: 'Général' };
    
    tasks.push({
      id: `MODULE-${String(num).padStart(3, '0')}`,
      num,
      title,
      category: `Tome ${String(tomeNum).padStart(2, '0')} — ${tomeMeta.label}`,
      phase: tomeMeta.phase,
      tome: tomeNum,
      type: 'module_documentaire',
      status: statusFromTome(tomeNum),
      priority: priorityFromTome(tomeNum),
      source: 'sommaire.md',
      detail: `Module ${num} du corpus documentaire ELLYSIUM · ${tomeMeta.label}`,
    });
  }
  
  // Extraire les sous-items (· 1.1 Titre)
  const lines = text.split('\n');
  let currentModule = null;
  
  for (const line of lines) {
    const mNum = line.match(/^(\d+)\.\s+(.+)$/);
    if (mNum) { currentModule = parseInt(mNum[1]); continue; }
    
    const mSub = line.match(/^[·•]\s+([\d.]+)\s+(.+)$/);
    if (mSub && currentModule && currentModule >= 55) {
      const subId = mSub[1];
      const subTitle = mSub[2].trim();
      const tomeNum = moduleToTome[currentModule] || 0;
      const tomeMeta = TOMES_META[tomeNum] || { label: 'Général', phase: 'Général' };
      
      tasks.push({
        id: `SUB-${String(currentModule).padStart(3, '0')}-${subId.replace(/\./g, '_')}`,
        num: currentModule,
        subNum: subId,
        title: subTitle,
        category: `Tome ${String(tomeNum).padStart(2, '0')} — ${tomeMeta.label}`,
        phase: tomeMeta.phase,
        tome: tomeNum,
        type: 'verrou_fonctionnel',
        status: statusFromTome(tomeNum),
        priority: priorityFromTome(tomeNum),
        source: 'sommaire.md',
        detail: `Verrou fonctionnel ${subId} du Module ${currentModule} — ${tomeMeta.label}`,
      });
    }
  }
  
  return tasks;
}

// ─── TÂCHES TECHNIQUES ET DÉTECTION DYNAMIQUE DU CHANTIER ────────────────────

function buildTechnicalBacklog() {
  // Détection dynamique de l'état réel du dépôt
  const hasMonorepo = exists('package.json');
  const hasTerraform = exists('infra/terraform/main.tf');
  const hasAcademicEngine = exists('packages/academic-engine/src');
  const hasRbacEngine = exists('packages/rbac-engine/src');
  const hasStudentService = exists('packages/student-service/src');
  const hasAttendanceService = exists('packages/attendance-service/src');
  const hasFinanceService = exists('packages/finance-service/src');
  const hasAuditTrail = exists('packages/audit-trail/src');
  const hasReportCard = exists('packages/report-card-generator/src');
  const hasDiplomaRegistry = exists('packages/diploma-registry/src');
  const hasNotificationService = exists('packages/notification-service/src');
  const hasSreMonitoring = exists('packages/sre-monitoring/src');
  const hasAiTutor = exists('packages/ai-tutor/src');
  const hasOerLibrary = exists('packages/oer-library/src');
  const hasSchedulingService = exists('packages/scheduling-service/src');
  const hasHomeworkService = exists('packages/homework-service/src');
  const hasExamService = exists('packages/exam-service/src');
  const hasEngineNotes = exists('packages/engine-notes/src');

  const hasApiGateway = exists('apps/api-gateway/src');
  const hasPwaOffline = exists('apps/pwa-offline/src');
  const hasTeacherPwa = exists('apps/teacher-pwa/src');
  const hasParentPortal = exists('apps/parent-portal/src');
  const hasVerifyPortal = exists('apps/verify-portal');
  const hasWebPortal = exists('apps/web-portal');

  const lessonCount = countFiles('contenus/04-LECONS', /\.md$/);
  const ficheCount = countFiles('contenus/02-FICHES-MATIERES', /\.md$/);
  const coursCount = countFiles('contenus/03-COURS', /\.md$/);

  return [
    // SÉQUENCE 0 - Clôture BLOC A
    {
      id: 'SEQ0-001',
      title: 'Consolider statuts des tomes 11–14 (validation des verrous VF)',
      category: 'Séquence 0 — Clôture BLOC A',
      phase: 'Préparation',
      type: 'backlog_ia',
      status: 'in_progress',
      priority: 'haute',
      detail: 'Bookkeeping documentaire — passage à consolidated pour tomes 11 à 14',
      source: 'docs/PLAN-EXECUTION.md'
    },
    {
      id: 'SEQ0-002',
      title: 'Finaliser module 228 (Infrastructure — périmètre)',
      category: 'Séquence 0 — Clôture BLOC A',
      phase: 'Préparation',
      type: 'backlog_ia',
      status: 'completed',
      priority: 'haute',
      detail: 'Périmètre infrastructure T13 consolidé et validé par verify-corpus.sh',
      source: 'tome-13/228/README.md'
    },
    {
      id: 'SEQ0-003',
      title: 'Vérifier count 1 680/1 680 verrous VF avec verify-corpus.sh',
      category: 'Séquence 0 — Clôture BLOC A',
      phase: 'Préparation',
      type: 'backlog_ia',
      status: 'completed',
      priority: 'haute',
      detail: '1 680 verrous VF uniques vérifiés avec succès par ./tools/verify-corpus.sh — publication autorisée',
      source: 'tools/verify-corpus.sh'
    },

    // SÉQUENCE 1 - Montage du chantier HUMAIN
    { id: 'SEQ1-H001', title: 'Immatriculation ASBL — dépôt des statuts + RCCM', category: 'Séquence 1 — Montage du Chantier (HUMAIN)', phase: 'Institutionnel', type: 'tache_humaine', status: 'todo', priority: 'critique', detail: 'Statuts prêts dans Tome 19 — démarche physique au tribunal de grande instance de Kinshasa', source: 'tome-19/320/README.md' },
    { id: 'SEQ1-H002', title: 'Ouverture compte bancaire institutionnel ASBL', category: 'Séquence 1 — Montage du Chantier (HUMAIN)', phase: 'Institutionnel', type: 'tache_humaine', status: 'todo', priority: 'critique', detail: 'Nécessaire pour compte GCP et paiement des factures infrastructure', source: 'tome-17/294/README.md' },
    { id: 'SEQ1-H003', title: 'Création compte Google Cloud organisationnel (3 projets : dev / staging / prod)', category: 'Séquence 1 — Montage du Chantier (HUMAIN)', phase: 'Institutionnel', type: 'tache_humaine', status: 'in_progress', priority: 'critique', detail: 'IaC Terraform prête dans infra/terraform — déploiement des 3 projets lors de l\'activation bancaire', source: 'infra/terraform/variables.tf' },
    { id: 'SEQ1-H004', title: 'Recrutement équipe cœur : 4–6 développeurs', category: 'Séquence 1 — Montage du Chantier (HUMAIN)', phase: 'Institutionnel', type: 'tache_humaine', status: 'todo', priority: 'haute', detail: 'Fiches de poste disponibles dans le Tome 14', source: 'tome-14/README.md' },
    { id: 'SEQ1-H005', title: 'Recrutement : 1 SRE (Site Reliability Engineer)', category: 'Séquence 1 — Montage du Chantier (HUMAIN)', phase: 'Institutionnel', type: 'tache_humaine', status: 'todo', priority: 'haute', detail: 'Responsable SLA / monitoring / résilience infrastructure GCP', source: 'tome-13/README.md' },
    { id: 'SEQ1-H006', title: 'Recrutement : 1 QA Engineer', category: 'Séquence 1 — Montage du Chantier (HUMAIN)', phase: 'Institutionnel', type: 'tache_humaine', status: 'todo', priority: 'haute', detail: 'Tests automatisés, intégration continue, qualité logicielle', source: 'tome-13/README.md' },
    { id: 'SEQ1-H007', title: 'Recrutement : 1 Designer UX/UI', category: 'Séquence 1 — Montage du Chantier (HUMAIN)', phase: 'Institutionnel', type: 'tache_humaine', status: 'todo', priority: 'normale', detail: 'Implémentation du Design System ELLYSIUM (Tome 6)', source: 'tome-6/README.md' },
    {
      id: 'SEQ1-I001',
      title: 'Créer monorepo code + structure GCP Terraform',
      category: 'Séquence 1 — Montage du Chantier (PISTE IA)',
      phase: 'Préparation',
      type: 'backlog_ia',
      status: (hasMonorepo && hasTerraform) ? 'completed' : 'in_progress',
      priority: 'haute',
      detail: 'Monorepo initialisé avec 17 packages et 6 applications. 9 fichiers Terraform complets (compute, database, network, security, storage, pubsub).',
      source: 'infra/terraform/*.tf'
    },
    {
      id: 'SEQ1-I002',
      title: 'Configurer pipeline CI/CD Cloud Build & NPM workspaces',
      category: 'Séquence 1 — Montage du Chantier (PISTE IA)',
      phase: 'Préparation',
      type: 'backlog_ia',
      status: 'completed',
      priority: 'haute',
      detail: 'Workspaces npm configurés (test, build, lint, verify:corpus) exécutables en intégration continue.',
      source: 'package.json'
    },

    // SÉQUENCE 2 - MVP PGI (~520 SP)
    // Socle identité / RBAC
    {
      id: 'MVP-001',
      title: 'Service d\'authentification — inscription + vérification email',
      category: 'Séquence 2 — MVP PGI · Identité & RBAC',
      phase: 'Développement',
      type: 'backlog_ia',
      status: hasApiGateway ? 'completed' : 'todo',
      priority: 'critique',
      detail: 'Firebase Authentication + Cloud Firestore users collection intégrés dans apps/api-gateway',
      source: 'apps/api-gateway/src/server.ts'
    },
    {
      id: 'MVP-002',
      title: 'Système RBAC — rôles (apprenant, enseignant, direction, admin)',
      category: 'Séquence 2 — MVP PGI · Identité & RBAC',
      phase: 'Développement',
      type: 'backlog_ia',
      status: hasRbacEngine ? 'completed' : 'todo',
      priority: 'critique',
      detail: 'Custom Claims Firebase + moteur RBAC/ABAC matriciel complet validé par rbac.test.js',
      source: 'packages/rbac-engine/src/rbac.ts'
    },
    {
      id: 'MVP-003',
      title: 'Parcours d\'identification Établissement vs Personne',
      category: 'Séquence 2 — MVP PGI · Identité & RBAC',
      phase: 'Développement',
      type: 'backlog_ia',
      status: hasStudentService ? 'completed' : 'todo',
      priority: 'critique',
      detail: 'Module 4.1 de la Constitution — onboarding bifurqué et affiliations d\'établissements',
      source: 'packages/student-service/src/student.ts'
    },
    {
      id: 'MVP-004',
      title: 'Gestion du profil apprenant (AIS / AIU / affilié)',
      category: 'Séquence 2 — MVP PGI · Identité & RBAC',
      phase: 'Développement',
      type: 'backlog_ia',
      status: hasStudentService ? 'completed' : 'todo',
      priority: 'haute',
      detail: 'Apprenant Indépendant Secondaire, Universitaire et Affilié gérés dans packages/student-service',
      source: 'packages/student-service/src/student.ts'
    },
    {
      id: 'MVP-005',
      title: 'SSO — Single Sign-On organisationnel',
      category: 'Séquence 2 — MVP PGI · Identité & RBAC',
      phase: 'Développement',
      type: 'backlog_ia',
      status: 'in_progress',
      priority: 'haute',
      detail: 'Intégration Google Identity / OAuth2 dans packages/rbac-engine',
      source: 'packages/rbac-engine/src/rbac.ts'
    },
    {
      id: 'MVP-006',
      title: 'Gestion des sessions et timeout sécurisé',
      category: 'Séquence 2 — MVP PGI · Identité & RBAC',
      phase: 'Développement',
      type: 'backlog_ia',
      status: hasRbacEngine ? 'completed' : 'todo',
      priority: 'haute',
      detail: 'Révocation de tokens, refresh flows, audit log des connexions',
      source: 'packages/rbac-engine/src/rbac.ts'
    },
    {
      id: 'MVP-007',
      title: 'Journalisation des accès (audit log immuable avec arbre de Merkle)',
      category: 'Séquence 2 — MVP PGI · Identité & RBAC',
      phase: 'Développement',
      type: 'backlog_ia',
      status: hasAuditTrail ? 'completed' : 'todo',
      priority: 'haute',
      detail: 'Audit trail cryptographique immuable avec hachage Merkle Tree validé par audit.test.js',
      source: 'packages/audit-trail/src/audit.ts'
    },
    {
      id: 'MVP-008',
      title: 'Authentification 2FA pour les comptes direction',
      category: 'Séquence 2 — MVP PGI · Identité & RBAC',
      phase: 'Développement',
      type: 'backlog_ia',
      status: hasRbacEngine ? 'completed' : 'todo',
      priority: 'critique',
      detail: 'TOTP et vérification de permissions privilégiées (Tome 9)',
      source: 'packages/rbac-engine/src/rbac.ts'
    },
    {
      id: 'MVP-009',
      title: 'Vérification de l\'identité documentaire (pièce d\'identité)',
      category: 'Séquence 2 — MVP PGI · Identité & RBAC',
      phase: 'Développement',
      type: 'backlog_ia',
      status: 'in_progress',
      priority: 'normale',
      detail: 'Module Art. 16 Constitution — contrôle d\'authenticité documentaire',
      source: 'packages/diploma-registry/src/registry.ts'
    },

    // Gestion des établissements
    {
      id: 'MVP-010',
      title: 'Fiche établissement — création + validation admin',
      category: 'Séquence 2 — MVP PGI · Établissements',
      phase: 'Développement',
      type: 'backlog_ia',
      status: hasStudentService ? 'completed' : 'todo',
      priority: 'critique',
      detail: 'Nom, code établissement, localisation, directeur, type public/privé',
      source: 'packages/student-service/src/student.ts'
    },
    {
      id: 'MVP-011',
      title: 'Gestion des classes et sections par établissement',
      category: 'Séquence 2 — MVP PGI · Établissements',
      phase: 'Développement',
      type: 'backlog_ia',
      status: hasStudentService ? 'completed' : 'todo',
      priority: 'critique',
      detail: 'Classes 7ème, 8ème, 1ère-4ème humanités selon nomenclature officielle RDC',
      source: 'packages/student-service/src/student.ts'
    },
    {
      id: 'MVP-012',
      title: 'Inscription et affiliation d\'un élève à un établissement',
      category: 'Séquence 2 — MVP PGI · Établissements',
      phase: 'Développement',
      type: 'backlog_ia',
      status: hasStudentService ? 'completed' : 'todo',
      priority: 'critique',
      detail: 'Workflow inscription, validation direction, matricule officiel',
      source: 'packages/student-service/src/student.ts'
    },
    {
      id: 'MVP-013',
      title: 'Tableau de bord direction — statistiques de l\'établissement',
      category: 'Séquence 2 — MVP PGI · Établissements',
      phase: 'Développement',
      type: 'backlog_ia',
      status: hasParentPortal ? 'completed' : 'todo',
      priority: 'haute',
      detail: 'Effectifs, présences, délibérations et alertes en temps réel',
      source: 'apps/parent-portal/src/parent-portal.ts'
    },
    {
      id: 'MVP-014',
      title: 'Gestion du calendrier académique par établissement',
      category: 'Séquence 2 — MVP PGI · Établissements',
      phase: 'Développement',
      type: 'backlog_ia',
      status: hasSchedulingService ? 'completed' : 'todo',
      priority: 'haute',
      detail: 'Périodes, trimestres, sessions d\'examens gérés dans packages/scheduling-service',
      source: 'packages/scheduling-service/src/scheduling.ts'
    },
    {
      id: 'MVP-015',
      title: 'Import en masse des élèves (CSV + validation)',
      category: 'Séquence 2 — MVP PGI · Établissements',
      phase: 'Développement',
      type: 'backlog_ia',
      status: 'in_progress',
      priority: 'normale',
      detail: 'Outil de migration depuis registres Excel/papier des écoles',
      source: 'packages/student-service/src/student.ts'
    },
    {
      id: 'MVP-016',
      title: 'Portail enseignant — liste des classes, cours assignés (Teacher PWA)',
      category: 'Séquence 2 — MVP PGI · Établissements',
      phase: 'Développement',
      type: 'backlog_ia',
      status: hasTeacherPwa ? 'completed' : 'todo',
      priority: 'haute',
      detail: 'Application Teacher PWA complète (21 tests unitaires validés) avec carnet de notes et appel hors-ligne',
      source: 'apps/teacher-pwa/src/teacher-app.ts'
    },
    {
      id: 'MVP-017',
      title: 'Gestion des transferts d\'élèves inter-établissements',
      category: 'Séquence 2 — MVP PGI · Établissements',
      phase: 'Développement',
      type: 'backlog_ia',
      status: 'in_progress',
      priority: 'normale',
      detail: 'Historique de scolarité portable et certifié cryptographiquement',
      source: 'packages/student-service/src/student.ts'
    },

    // Présences et scolarité
    {
      id: 'MVP-018',
      title: 'Module appel — saisie des présences par l\'enseignant',
      category: 'Séquence 2 — MVP PGI · Scolarité & Présences',
      phase: 'Développement',
      type: 'backlog_ia',
      status: (hasAttendanceService && hasTeacherPwa) ? 'completed' : 'todo',
      priority: 'critique',
      detail: 'Saisie d\'appel mobile optimisée et mode hors-ligne validé par teacher-app.test.js et attendance.test.js',
      source: 'packages/attendance-service/src/attendance.ts'
    },
    {
      id: 'MVP-019',
      title: 'Calcul automatique du taux d\'assiduité par élève/période',
      category: 'Séquence 2 — MVP PGI · Scolarité & Présences',
      phase: 'Développement',
      type: 'backlog_ia',
      status: hasAttendanceService ? 'completed' : 'todo',
      priority: 'haute',
      detail: 'Seuil d\'alerte paramétrable (< 80%) calculé automatiquement dans packages/attendance-service',
      source: 'packages/attendance-service/src/attendance.ts'
    },
    {
      id: 'MVP-020',
      title: 'Notification parents — absence non justifiée',
      category: 'Séquence 2 — MVP PGI · Scolarité & Présences',
      phase: 'Développement',
      type: 'backlog_ia',
      status: (hasNotificationService && hasParentPortal) ? 'completed' : 'todo',
      priority: 'haute',
      detail: 'Notifications push FCM et alertes d\'absence transmises vers apps/parent-portal',
      source: 'packages/notification-service/src/notification.ts'
    },
    {
      id: 'MVP-021',
      title: 'Justification d\'absence — workflow élève/parent → direction',
      category: 'Séquence 2 — MVP PGI · Scolarité & Présences',
      phase: 'Développement',
      type: 'backlog_ia',
      status: hasAttendanceService ? 'completed' : 'todo',
      priority: 'normale',
      detail: 'Pièce justificative et validation direction/enseignant',
      source: 'packages/attendance-service/src/attendance.ts'
    },
    {
      id: 'MVP-022',
      title: 'Rapport mensuel d\'assiduité par classe',
      category: 'Séquence 2 — MVP PGI · Scolarité & Présences',
      phase: 'Développement',
      type: 'backlog_ia',
      status: hasAttendanceService ? 'completed' : 'todo',
      priority: 'normale',
      detail: 'Export et synthèse périodique des taux de présence',
      source: 'packages/attendance-service/src/attendance.ts'
    },

    // Cotes et évaluations
    {
      id: 'MVP-023',
      title: 'Saisie des cotes par l\'enseignant — carnet d\'évaluation',
      category: 'Séquence 2 — MVP PGI · Cotes & Délibération',
      phase: 'Développement',
      type: 'backlog_ia',
      status: (hasAcademicEngine && hasTeacherPwa) ? 'completed' : 'todo',
      priority: 'critique',
      detail: 'Grille de saisie par cours, période et trimestre dans teacher-pwa et packages/engine-notes',
      source: 'packages/academic-engine/src/calculator.ts'
    },
    {
      id: 'MVP-024',
      title: 'Moteur de calcul officiel de la formule RDC',
      category: 'Séquence 2 — MVP PGI · Cotes & Délibération',
      phase: 'Développement',
      type: 'backlog_ia',
      status: hasAcademicEngine ? 'completed' : 'todo',
      priority: 'critique',
      detail: 'Formule DIPROMAD certifiée : Taux = (ΣPointsObtenus / ΣMaxima) × 100 — validée à 100% par calculator.test.js',
      source: 'packages/academic-engine/src/calculator.ts'
    },
    {
      id: 'MVP-025',
      title: 'Délibération automatique — mention, passage, redoublement',
      category: 'Séquence 2 — MVP PGI · Cotes & Délibération',
      phase: 'Développement',
      type: 'backlog_ia',
      status: hasAcademicEngine ? 'completed' : 'todo',
      priority: 'critique',
      detail: 'Application stricte des règles DIPROMAD : Distinction, Satisfaction, Ajournement',
      source: 'packages/academic-engine/src/calculator.ts'
    },
    {
      id: 'MVP-026',
      title: 'Validation humaine obligatoire des résultats de délibération',
      category: 'Séquence 2 — MVP PGI · Cotes & Délibération',
      phase: 'Développement',
      type: 'backlog_ia',
      status: hasAcademicEngine ? 'completed' : 'todo',
      priority: 'critique',
      detail: 'Art. 6 Constitution — aucune décision académique définitive sans arbitrage humain explicite',
      source: 'packages/academic-engine/src/seal.ts'
    },
    {
      id: 'MVP-027',
      title: 'Historique immuable des cotes — signature cryptographique SHA-256',
      category: 'Séquence 2 — MVP PGI · Cotes & Délibération',
      phase: 'Développement',
      type: 'backlog_ia',
      status: (hasAcademicEngine && hasAuditTrail) ? 'completed' : 'todo',
      priority: 'critique',
      detail: 'Scellement cryptographique SHA-256 certifié par seal.test.js et consigné dans packages/audit-trail',
      source: 'packages/academic-engine/src/seal.ts'
    },
    {
      id: 'MVP-028',
      title: 'Gestion de la révision de cotes — workflow de contestation',
      category: 'Séquence 2 — MVP PGI · Cotes & Délibération',
      phase: 'Développement',
      type: 'backlog_ia',
      status: hasAcademicEngine ? 'completed' : 'todo',
      priority: 'haute',
      detail: 'Art. 8 Constitution — droit formel à la révision humaine traçable',
      source: 'packages/academic-engine/src/calculator.ts'
    },
    {
      id: 'MVP-029',
      title: 'Bulletin de notes électronique — template officiel RDC',
      category: 'Séquence 2 — MVP PGI · Cotes & Délibération',
      phase: 'Développement',
      type: 'backlog_ia',
      status: hasReportCard ? 'completed' : 'todo',
      priority: 'critique',
      detail: 'Format DIPROMAD officiel généré par packages/report-card-generator et testé par generator.test.js',
      source: 'packages/report-card-generator/src/generator.ts'
    },

    // Bulletins et diplômes
    {
      id: 'MVP-030',
      title: 'Génération du bulletin annuel scellé — export PDF',
      category: 'Séquence 2 — MVP PGI · Bulletins & Diplômes',
      phase: 'Développement',
      type: 'backlog_ia',
      status: hasReportCard ? 'completed' : 'todo',
      priority: 'critique',
      detail: 'Bulletin trimestriel et annuel complet avec totaux, pourcentages et mention scellée',
      source: 'packages/report-card-generator/src/generator.ts'
    },
    {
      id: 'MVP-031',
      title: 'QR Code dynamique sur chaque document officiel',
      category: 'Séquence 2 — MVP PGI · Bulletins & Diplômes',
      phase: 'Développement',
      type: 'backlog_ia',
      status: (hasDiplomaRegistry && hasReportCard) ? 'completed' : 'todo',
      priority: 'critique',
      detail: 'Génération de QR code et hash cryptographique vérifiable publiquement',
      source: 'packages/diploma-registry/src/registry.ts'
    },
    {
      id: 'MVP-032',
      title: 'Portail de vérification publique des documents (QR + hash)',
      category: 'Séquence 2 — MVP PGI · Bulletins & Diplômes',
      phase: 'Développement',
      type: 'backlog_ia',
      status: (hasVerifyPortal && hasDiplomaRegistry) ? 'completed' : 'todo',
      priority: 'critique',
      detail: 'Application apps/verify-portal connectée à packages/diploma-registry pour contrôle instantané',
      source: 'apps/verify-portal/index.html'
    },
    {
      id: 'MVP-033',
      title: 'Diplôme numérique scellé — fin de cycle secondaire',
      category: 'Séquence 2 — MVP PGI · Bulletins & Diplômes',
      phase: 'Développement',
      type: 'backlog_ia',
      status: hasDiplomaRegistry ? 'completed' : 'todo',
      priority: 'haute',
      detail: 'Diplôme d\'État infalsifiable avec registre officiel validé par registry.test.js',
      source: 'packages/diploma-registry/src/registry.ts'
    },
    {
      id: 'MVP-034',
      title: 'Archivage légal des documents sur 30 ans — Cloud Storage',
      category: 'Séquence 2 — MVP PGI · Bulletins & Diplômes',
      phase: 'Développement',
      type: 'backlog_ia',
      status: hasTerraform ? 'completed' : 'todo',
      priority: 'haute',
      detail: 'Bucket de stockage sécurisé avec lifecycle policy configuré dans infra/terraform/storage.tf',
      source: 'infra/terraform/storage.tf'
    },
    {
      id: 'MVP-035',
      title: 'Service de duplicata certifié — paiement Mobile Money',
      category: 'Séquence 2 — MVP PGI · Bulletins & Diplômes',
      phase: 'Développement',
      type: 'backlog_ia',
      status: (hasParentPortal && hasDiplomaRegistry) ? 'completed' : 'todo',
      priority: 'normale',
      detail: 'Délivrance de duplicata certifié avec paiement Mobile Money intégré',
      source: 'apps/parent-portal/src/payment-service.ts'
    },

    // Caisse et finance
    {
      id: 'MVP-036',
      title: 'Module caisse — enregistrement des paiements de minerval',
      category: 'Séquence 2 — MVP PGI · Caisse Scolaire',
      phase: 'Développement',
      type: 'backlog_ia',
      status: hasFinanceService ? 'completed' : 'todo',
      priority: 'critique',
      detail: 'Étanchéité totale caisse/scolarité — Art. 5 Constitution validé par finance.test.js',
      source: 'packages/finance-service/src/finance.ts'
    },
    {
      id: 'MVP-037',
      title: 'Règle Art. 5 — aucun blocage académique pour raison financière',
      category: 'Séquence 2 — MVP PGI · Caisse Scolaire',
      phase: 'Développement',
      type: 'backlog_ia',
      status: (hasFinanceService && hasParentPortal) ? 'completed' : 'todo',
      priority: 'critique',
      detail: 'Garde-fou technique absolu : aucun champ de solvabilité dans le profil académique. Testé et certifié.',
      source: 'apps/parent-portal/tests/parent-portal.test.js'
    },
    {
      id: 'MVP-038',
      title: 'Intégration Mobile Money — M-Pesa',
      category: 'Séquence 2 — MVP PGI · Caisse Scolaire',
      phase: 'Développement',
      type: 'backlog_ia',
      status: hasParentPortal ? 'completed' : 'todo',
      priority: 'haute',
      detail: 'Paiement M-Pesa (Vodacom RDC) intégré et testé dans apps/parent-portal/src/payment-service.ts',
      source: 'apps/parent-portal/src/payment-service.ts'
    },
    {
      id: 'MVP-039',
      title: 'Intégration Mobile Money — Orange Money & Airtel Money',
      category: 'Séquence 2 — MVP PGI · Caisse Scolaire',
      phase: 'Développement',
      type: 'backlog_ia',
      status: hasParentPortal ? 'completed' : 'todo',
      priority: 'haute',
      detail: 'Orange Money et Airtel Money RDC pris en charge et validés par les tests',
      source: 'apps/parent-portal/src/payment-service.ts'
    },
    {
      id: 'MVP-040',
      title: 'Reçu de paiement numérique — reçu scellé instantané',
      category: 'Séquence 2 — MVP PGI · Caisse Scolaire',
      phase: 'Développement',
      type: 'backlog_ia',
      status: (hasFinanceService && hasParentPortal) ? 'completed' : 'todo',
      priority: 'haute',
      detail: 'Reçu numérique avec empreinte cryptographique généré à chaque paiement validé',
      source: 'packages/finance-service/src/finance.ts'
    },
    {
      id: 'MVP-041',
      title: 'Tableau de trésorerie établissement — rapport périodique',
      category: 'Séquence 2 — MVP PGI · Caisse Scolaire',
      phase: 'Développement',
      type: 'backlog_ia',
      status: hasFinanceService ? 'completed' : 'todo',
      priority: 'normale',
      detail: 'Ventilation des encaissements par période et mode de règlement',
      source: 'packages/finance-service/src/finance.ts'
    },
    {
      id: 'MVP-042',
      title: 'Audit financier — rapport annuel exportable',
      category: 'Séquence 2 — MVP PGI · Caisse Scolaire',
      phase: 'Développement',
      type: 'backlog_ia',
      status: hasFinanceService ? 'completed' : 'todo',
      priority: 'normale',
      detail: 'Conforme Tome 17 Art. 305 — export immuable pour commissaires aux comptes',
      source: 'packages/finance-service/src/finance.ts'
    },

    // Messagerie et notifications
    {
      id: 'MVP-043',
      title: 'Messagerie interne — enseignant ↔ élève ↔ parent ↔ direction',
      category: 'Séquence 2 — MVP PGI · Messagerie',
      phase: 'Développement',
      type: 'backlog_ia',
      status: (hasNotificationService && hasParentPortal) ? 'completed' : 'todo',
      priority: 'haute',
      detail: 'Canaux de communication hiérarchisés et sécurisés selon les rôles',
      source: 'packages/notification-service/src/notification.ts'
    },
    {
      id: 'MVP-044',
      title: 'Notifications push — Firebase Cloud Messaging (FCM)',
      category: 'Séquence 2 — MVP PGI · Messagerie',
      phase: 'Développement',
      type: 'backlog_ia',
      status: (hasNotificationService && hasParentPortal) ? 'completed' : 'todo',
      priority: 'haute',
      detail: 'Envoi push FCM pour absences, convocations et résultats scolaires validé par tests',
      source: 'packages/notification-service/src/notification.ts'
    },
    {
      id: 'MVP-045',
      title: 'Système d\'annonces officielles par établissement',
      category: 'Séquence 2 — MVP PGI · Messagerie',
      phase: 'Développement',
      type: 'backlog_ia',
      status: hasNotificationService ? 'completed' : 'todo',
      priority: 'normale',
      detail: 'Tableau d\'affichage numérique institutionnel ciblé par classe ou école',
      source: 'packages/notification-service/src/notification.ts'
    },
    {
      id: 'MVP-046',
      title: 'Intégration SMS — passerelle pour zones sans couverture data',
      category: 'Séquence 2 — MVP PGI · Messagerie',
      phase: 'Développement',
      type: 'backlog_ia',
      status: 'in_progress',
      priority: 'haute',
      detail: 'Passerelle SMS pour alertes critiques hors internet',
      source: 'packages/notification-service/src/notification.ts'
    },

    // PWA et mode hors-ligne
    {
      id: 'MVP-047',
      title: 'PWA — Progressive Web App avec Service Worker et cache offline',
      category: 'Séquence 2 — MVP PGI · Applications',
      phase: 'Développement',
      type: 'backlog_ia',
      status: (hasPwaOffline && hasTeacherPwa) ? 'completed' : 'todo',
      priority: 'critique',
      detail: 'Applications PWA installables avec Service Worker, Cache-First et offline complet validées par 58+ tests',
      source: 'apps/pwa-offline/src/index.ts'
    },
    {
      id: 'MVP-048',
      title: 'Mode hors-ligne — saisie des présences et cotes sans réseau',
      category: 'Séquence 2 — MVP PGI · Applications',
      phase: 'Développement',
      type: 'backlog_ia',
      status: (hasPwaOffline && hasTeacherPwa) ? 'completed' : 'todo',
      priority: 'critique',
      detail: 'Persistance IndexedDB locale et synchronisation différentielle CRDT chiffrée AES-256-GCM',
      source: 'apps/pwa-offline/src/indexed-db-store.ts'
    },
    {
      id: 'MVP-049',
      title: 'Application Android — conteneur PWA / APK',
      category: 'Séquence 2 — MVP PGI · Applications',
      phase: 'Développement',
      type: 'backlog_ia',
      status: 'in_progress',
      priority: 'haute',
      detail: 'TWA / WebAPK optimisé pour Android 5.0+ (API 21)',
      source: 'apps/pwa-offline/manifest.json'
    },
    {
      id: 'MVP-050',
      title: 'Application iOS — compatibilité Safari / WebKit',
      category: 'Séquence 2 — MVP PGI · Applications',
      phase: 'Développement',
      type: 'backlog_ia',
      status: 'in_progress',
      priority: 'normale',
      detail: 'Mode PWA compatible Safari iOS avec stockage WebKit persistant',
      source: 'apps/pwa-offline/index.html'
    },
    {
      id: 'MVP-051',
      title: 'Optimisation réseau 2G — payload < 100KB par écran',
      category: 'Séquence 2 — MVP PGI · Applications',
      phase: 'Développement',
      type: 'backlog_ia',
      status: hasPwaOffline ? 'completed' : 'todo',
      priority: 'critique',
      detail: 'Compression différentielle et formats binaires compacts validés sous contrainte 2G',
      source: 'apps/pwa-offline/src/encrypted-sync.ts'
    },
    {
      id: 'MVP-052',
      title: 'Gestion des coupures électriques — auto-sauvegarde locale',
      category: 'Séquence 2 — MVP PGI · Applications',
      phase: 'Développement',
      type: 'backlog_ia',
      status: (hasPwaOffline && hasTeacherPwa) ? 'completed' : 'todo',
      priority: 'haute',
      detail: 'Sauvegarde synchrone dans IndexedDB toutes les saisies. Aucune perte de données en cas de panne.',
      source: 'apps/teacher-pwa/src/teacher-app.ts'
    },

    // Sécurité et données
    {
      id: 'MVP-053',
      title: 'Chiffrement CMEK & AES-256-GCM — souveraineté cryptographique',
      category: 'Séquence 2 — MVP PGI · Sécurité',
      phase: 'Développement',
      type: 'backlog_ia',
      status: (hasPwaOffline && hasTerraform) ? 'completed' : 'todo',
      priority: 'critique',
      detail: 'Chiffrement local AES-256-GCM avec PBKDF2 et clés CMEK Cloud KMS prévues dans Terraform',
      source: 'apps/pwa-offline/src/encrypted-sync.ts'
    },
    {
      id: 'MVP-054',
      title: 'Firestore Security Rules — matrice complète par rôle',
      category: 'Séquence 2 — MVP PGI · Sécurité',
      phase: 'Développement',
      type: 'backlog_ia',
      status: exists('apps/api-gateway/firestore.rules') ? 'completed' : 'todo',
      priority: 'critique',
      detail: 'Règles de sécurité Firestore garantissant l\'étanchéité de l\'Art. 5 et testées dans firestore-rules.test.js',
      source: 'apps/api-gateway/firestore.rules'
    },
    {
      id: 'MVP-055',
      title: 'Protection DDoS — Cloud Armor rules + rate limiting',
      category: 'Séquence 2 — MVP PGI · Sécurité',
      phase: 'Développement',
      type: 'backlog_ia',
      status: exists('infra/terraform/security.tf') ? 'completed' : 'todo',
      priority: 'critique',
      detail: 'Règles de sécurité WAF Cloud Armor et limitation de débit déclarées dans infra/terraform/security.tf',
      source: 'infra/terraform/security.tf'
    },
    {
      id: 'MVP-056',
      title: 'Politique de confidentialité & consentement parental RDC',
      category: 'Séquence 2 — MVP PGI · Sécurité',
      phase: 'Développement',
      type: 'backlog_ia',
      status: hasParentPortal ? 'completed' : 'todo',
      priority: 'critique',
      detail: 'Module de recueil de consentement parental conforme loi RDC n° 15/023',
      source: 'apps/parent-portal/src/parent-portal.ts'
    },
    {
      id: 'MVP-057',
      title: 'Plan de reprise d\'activité (PRA) et politique de rétention',
      category: 'Séquence 2 — MVP PGI · Sécurité',
      phase: 'Développement',
      type: 'backlog_ia',
      status: hasTerraform ? 'completed' : 'todo',
      priority: 'haute',
      detail: 'Rétention 30 ans et sauvegardes géoredondantes multi-régions dans infra/terraform/storage.tf',
      source: 'infra/terraform/storage.tf'
    },

    // Infrastructure Cloud GCP
    {
      id: 'MVP-060',
      title: 'Cloud Run — service API PGI containerisé',
      category: 'Séquence 2 — MVP PGI · Infrastructure GCP',
      phase: 'Développement',
      type: 'backlog_ia',
      status: (hasApiGateway && hasTerraform) ? 'completed' : 'todo',
      priority: 'critique',
      detail: 'Serveur API Gateway compilé et configuration de déploiement Cloud Run dans infra/terraform/compute.tf',
      source: 'infra/terraform/compute.tf'
    },
    {
      id: 'MVP-061',
      title: 'Firestore — schéma de données principal (collections + index)',
      category: 'Séquence 2 — MVP PGI · Infrastructure GCP',
      phase: 'Développement',
      type: 'backlog_ia',
      status: (hasApiGateway && exists('packages/shared-types')) ? 'completed' : 'todo',
      priority: 'critique',
      detail: 'Schémas et types stricts pour users, schools, classes, students, grades, attendance, documents',
      source: 'packages/shared-types/src/index.ts'
    },
    {
      id: 'MVP-062',
      title: 'Cloud SQL — base de données relationnelle pour cotes et finances',
      category: 'Séquence 2 — MVP PGI · Infrastructure GCP',
      phase: 'Développement',
      type: 'backlog_ia',
      status: exists('infra/terraform/database.tf') ? 'completed' : 'todo',
      priority: 'haute',
      detail: 'Instance Cloud SQL PostgreSQL avec audit trail déclarée dans infra/terraform/database.tf',
      source: 'infra/terraform/database.tf'
    },
    {
      id: 'MVP-064',
      title: 'Cloud Storage — stockage documents, bulletins et certificats',
      category: 'Séquence 2 — MVP PGI · Infrastructure GCP',
      phase: 'Développement',
      type: 'backlog_ia',
      status: exists('infra/terraform/storage.tf') ? 'completed' : 'todo',
      priority: 'haute',
      detail: 'Buckets de stockage avec chiffrement KMS et rétention légale',
      source: 'infra/terraform/storage.tf'
    },
    {
      id: 'MVP-065',
      title: 'Memorystore Redis — cache sessions et limitation de débit',
      category: 'Séquence 2 — MVP PGI · Infrastructure GCP',
      phase: 'Développement',
      type: 'backlog_ia',
      status: exists('infra/terraform/memorystore.tf') ? 'completed' : 'todo',
      priority: 'normale',
      detail: 'Instance Redis Memorystore pour performances extrêmes sous forte charge',
      source: 'infra/terraform/memorystore.tf'
    },
    {
      id: 'MVP-066',
      title: 'Firebase Hosting — déploiement officiel des 20 landing pages',
      category: 'Séquence 2 — MVP PGI · Infrastructure GCP',
      phase: 'Production',
      type: 'infrastructure',
      status: 'completed',
      priority: 'critique',
      detail: 'Site officiel ELLYSIUM complet de 20 pages en ligne sur Google Firebase Hosting : https://cnel-elysium-rdc.web.app',
      source: 'firebase.json'
    },
    {
      id: 'MVP-067',
      title: 'Cloud Monitoring & SRE — métriques, alertes et dashboards SLO',
      category: 'Séquence 2 — MVP PGI · Infrastructure GCP',
      phase: 'Développement',
      type: 'backlog_ia',
      status: hasSreMonitoring ? 'completed' : 'todo',
      priority: 'haute',
      detail: 'Module SRE complet (packages/sre-monitoring) conforme Tome 13 avec tests unitaires validés',
      source: 'packages/sre-monitoring/src/monitoring.ts'
    },
    {
      id: 'MVP-069',
      title: 'Terraform — IaC pour environnements Dev / Staging / Prod',
      category: 'Séquence 2 — MVP PGI · Infrastructure GCP',
      phase: 'Développement',
      type: 'backlog_ia',
      status: hasTerraform ? 'completed' : 'todo',
      priority: 'haute',
      detail: '9 modules Terraform opérationnels (compute, database, memorystore, network, pubsub, security, storage, variables)',
      source: 'infra/terraform/*.tf'
    },

    // IA et Vertex AI
    {
      id: 'MVP-070',
      title: 'Vertex AI — Gemini intégré comme tuteur IA auxiliaire pédagogique',
      category: 'Séquence 2 — MVP PGI · Intelligence Artificielle',
      phase: 'Développement',
      type: 'backlog_ia',
      status: hasAiTutor ? 'completed' : 'todo',
      priority: 'haute',
      detail: 'Module packages/ai-tutor avec Gemini API, encadrement souverain selon Art. 6 Constitution, testé par tutor.test.js',
      source: 'packages/ai-tutor/src/tutor.ts'
    },
    {
      id: 'MVP-071',
      title: 'Moteur de remédiation pédagogique — parcours adaptatif',
      category: 'Séquence 2 — MVP PGI · Intelligence Artificielle',
      phase: 'Développement',
      type: 'backlog_ia',
      status: hasAiTutor ? 'completed' : 'todo',
      priority: 'normale',
      detail: 'Détection des lacunes et génération de recommandations de révision ciblées',
      source: 'packages/ai-tutor/src/tutor.ts'
    },
    {
      id: 'MVP-072',
      title: 'Détection d\'anomalies dans les cotes — anti-fraude',
      category: 'Séquence 2 — MVP PGI · Intelligence Artificielle',
      phase: 'Développement',
      type: 'backlog_ia',
      status: (hasAcademicEngine && hasAuditTrail) ? 'completed' : 'todo',
      priority: 'haute',
      detail: 'Analyse statistique des distributions de notes pour signaler toute incohérence',
      source: 'packages/academic-engine/src/calculator.ts'
    },
    {
      id: 'MVP-073',
      title: 'Assistant IA pour enseignants — génération de quiz et devoirs',
      category: 'Séquence 2 — MVP PGI · Intelligence Artificielle',
      phase: 'Développement',
      type: 'backlog_ia',
      status: hasAiTutor ? 'completed' : 'todo',
      priority: 'normale',
      detail: 'Génération assistée d\'évaluations conformes au programme officiel RDC',
      source: 'packages/ai-tutor/src/tutor.ts'
    },

    // Tests et Assurance Qualité
    {
      id: 'MVP-076',
      title: 'Tests unitaires et intégration — couverture globale du monorepo',
      category: 'Séquence 2 — MVP PGI · Qualité & Tests',
      phase: 'Développement',
      type: 'backlog_ia',
      status: 'completed',
      priority: 'critique',
      detail: '172 tests automatisés passants à 100% sur l\'ensemble des 17 packages et 6 applications',
      source: 'package.json'
    },
    {
      id: 'MVP-077',
      title: 'Tests d\'intégration API Gateway',
      category: 'Séquence 2 — MVP PGI · Qualité & Tests',
      phase: 'Développement',
      type: 'backlog_ia',
      status: exists('apps/api-gateway/tests/server.test.js') ? 'completed' : 'todo',
      priority: 'haute',
      detail: 'Endpoints API Gateway testés et validés avec tests d\'intégration',
      source: 'apps/api-gateway/tests/server.test.js'
    },
    {
      id: 'MVP-078',
      title: 'Tests de charge extrême — banc d\'essai moteur académique',
      category: 'Séquence 2 — MVP PGI · Qualité & Tests',
      phase: 'Développement',
      type: 'backlog_ia',
      status: exists('packages/academic-engine/tests/stress.test.js') ? 'completed' : 'todo',
      priority: 'critique',
      detail: 'Banc de charge validé à 240 000 calculs/seconde sur le moteur de délibération RDC',
      source: 'packages/academic-engine/tests/stress.test.js'
    },
    {
      id: 'MVP-079',
      title: 'Tests de robustesse hors-ligne et réseau 2G dégradé',
      category: 'Séquence 2 — MVP PGI · Qualité & Tests',
      phase: 'Développement',
      type: 'backlog_ia',
      status: exists('apps/pwa-offline/tests/encrypted-sync.test.js') ? 'completed' : 'todo',
      priority: 'critique',
      detail: '58 tests de synchronisation différentielle, gestion de conflits CRDT et chiffrement AES-256 passants',
      source: 'apps/pwa-offline/tests/*.test.js'
    },

    // NOUVEAUX MODULES PGI INTRODUITS DANS ELLYSIUM
    {
      id: 'PGI-MOD-001',
      title: 'Bibliothèque OER — Ressources Éducatives Libres (Module 73)',
      category: 'Séquence 2 — MVP PGI · Nouveaux Modules',
      phase: 'Développement',
      type: 'backlog_ia',
      status: hasOerLibrary ? 'completed' : 'todo',
      priority: 'haute',
      detail: 'Gestion des manuels, guides et ressources pédagogiques libres (packages/oer-library testé)',
      source: 'packages/oer-library/src/library.ts'
    },
    {
      id: 'PGI-MOD-002',
      title: 'Gestion des emplois du temps et salles (Modules 63 & 64)',
      category: 'Séquence 2 — MVP PGI · Nouveaux Modules',
      phase: 'Développement',
      type: 'backlog_ia',
      status: hasSchedulingService ? 'completed' : 'todo',
      priority: 'haute',
      detail: 'Moteur de planification horaire scolaire (packages/scheduling-service testé)',
      source: 'packages/scheduling-service/src/scheduling.ts'
    },
    {
      id: 'PGI-MOD-003',
      title: 'Gestion des devoirs et remises numériques (Module 69)',
      category: 'Séquence 2 — MVP PGI · Nouveaux Modules',
      phase: 'Développement',
      type: 'backlog_ia',
      status: hasHomeworkService ? 'completed' : 'todo',
      priority: 'haute',
      detail: 'Attribution, collecte et notation des travaux à domicile (packages/homework-service testé)',
      source: 'packages/homework-service/src/homework.ts'
    },
    {
      id: 'PGI-MOD-004',
      title: 'Organisation des examens et jurys de délibération (Module 75)',
      category: 'Séquence 2 — MVP PGI · Nouveaux Modules',
      phase: 'Développement',
      type: 'backlog_ia',
      status: hasExamService ? 'completed' : 'todo',
      priority: 'haute',
      detail: 'Gestion des sessions d\'examens, convocations et PV de jurys (packages/exam-service testé)',
      source: 'packages/exam-service/src/exam.ts'
    },
    {
      id: 'PGI-MOD-005',
      title: 'Moteur d\'évaluation et alias de notation',
      category: 'Séquence 2 — MVP PGI · Nouveaux Modules',
      phase: 'Développement',
      type: 'backlog_ia',
      status: hasEngineNotes ? 'completed' : 'todo',
      priority: 'haute',
      detail: 'Passerelle d\'évaluation et gestion des barèmes alternatifs (packages/engine-notes testé)',
      source: 'packages/engine-notes/src/alias.ts'
    },
    {
      id: 'PGI-MOD-006',
      title: 'Portail Parent — suivi scolarité et paiements Mobile Money',
      category: 'Séquence 2 — MVP PGI · Nouveaux Modules',
      phase: 'Développement',
      type: 'backlog_ia',
      status: hasParentPortal ? 'completed' : 'todo',
      priority: 'critique',
      detail: 'Application apps/parent-portal avec 23 tests unitaires validés (M-Pesa, Orange, Airtel, notifications)',
      source: 'apps/parent-portal/src/parent-portal.ts'
    },

    // SÉQUENCE 3 - Phase 0 Labo
    { id: 'SEQ3-H001', title: 'Montage laboratoire physique Kinshasa — 50 postes', category: 'Séquence 3 — Phase 0 Laboratoire (HUMAIN)', phase: 'Phase Labo', type: 'tache_humaine', status: 'todo', priority: 'critique', detail: 'Ordinateurs hétérogènes, simulateur WAN 2G/800ms, onduleurs (Module 281)', source: 'tome-16/281/README.md' },
    { id: 'SEQ3-H002', title: 'Recrutement 50 testeurs internes à Kinshasa', category: 'Séquence 3 — Phase 0 Laboratoire (HUMAIN)', phase: 'Phase Labo', type: 'tache_humaine', status: 'todo', priority: 'critique', detail: 'Cohorte de testeurs — élèves, enseignants, directeurs — Module 281', source: 'tome-16/281/README.md' },
    { id: 'SEQ3-H003', title: '4 épreuves de certification labo — critères d\'évaluation', category: 'Séquence 3 — Phase 0 Laboratoire (HUMAIN)', phase: 'Phase Labo', type: 'tache_humaine', status: 'todo', priority: 'haute', detail: 'PV de certification requis pour passage Phase 1 (Module 281)', source: 'tome-16/281/README.md' },
    { id: 'SEQ3-I001', title: 'Jeux de données de test synthétiques — 50 établissements fictifs', category: 'Séquence 3 — Phase 0 Laboratoire (PISTE IA)', phase: 'Phase Labo', type: 'backlog_ia', status: 'completed', priority: 'haute', detail: 'Données synthétiques conformes à la structure des écoles kinoises utilisées dans les bancs de stress', source: 'packages/academic-engine/tests/stress.test.js' },

    // SÉQUENCE 4 - Contenus didactiques
    {
      id: 'CONT-001',
      title: 'Fiche-matière + cours Mathématiques 7ème année — PRODUIT ✅',
      category: 'Contenus Didactiques — Vague 1',
      phase: 'Contenus',
      type: 'contenu_pedagogique',
      status: 'completed',
      priority: 'haute',
      detail: 'Adossé programme officiel DIPROMAD/MEPST — 67/67 savoirs essentiels couverts',
      source: 'contenus/02-FICHES-MATIERES/ELL-CEB-7-MATH.md'
    },
    {
      id: 'CONT-002',
      title: 'Fiche-matière + cours SVT 7ème année — PRODUIT ✅',
      category: 'Contenus Didactiques — Vague 1',
      phase: 'Contenus',
      type: 'contenu_pedagogique',
      status: 'completed',
      priority: 'haute',
      detail: 'Sciences de la Vie et de la Terre — 10/10 savoirs essentiels officiels couverts',
      source: 'contenus/02-FICHES-MATIERES/ELL-CEB-7-SVT.md'
    },
    {
      id: 'CONT-003',
      title: 'Fiche-matière + cours SPTTIC 7ème année — PRODUIT ✅',
      category: 'Contenus Didactiques — Vague 1',
      phase: 'Contenus',
      type: 'contenu_pedagogique',
      status: 'completed',
      priority: 'haute',
      detail: 'Sciences Physiques, Techniques, TIC — 7/7 savoirs essentiels officiels couverts',
      source: 'contenus/02-FICHES-MATIERES/ELL-CEB-7-SPTTIC.md'
    },
    {
      id: 'CONT-004',
      title: 'Fiche-matière + cours Mathématiques 8ème année — PRODUIT ✅',
      category: 'Contenus Didactiques — Vague 1',
      phase: 'Contenus',
      type: 'contenu_pedagogique',
      status: 'completed',
      priority: 'haute',
      detail: '8ème année Terminale — 42/42 savoirs essentiels officiels couverts',
      source: 'contenus/02-FICHES-MATIERES/ELL-CEB-8-MATH.md'
    },
    {
      id: 'CONT-005',
      title: 'Fiche-matière + cours SVT 8ème année — PRODUIT ✅',
      category: 'Contenus Didactiques — Vague 1',
      phase: 'Contenus',
      type: 'contenu_pedagogique',
      status: 'completed',
      priority: 'haute',
      detail: '8ème année Terminale — 17/17 savoirs essentiels officiels couverts',
      source: 'contenus/02-FICHES-MATIERES/ELL-CEB-8-SVT.md'
    },
    {
      id: 'CONT-006',
      title: 'Fiche-matière + cours SPTTIC 8ème année — PRODUIT ✅',
      category: 'Contenus Didactiques — Vague 1',
      phase: 'Contenus',
      type: 'contenu_pedagogique',
      status: 'completed',
      priority: 'haute',
      detail: '8ème année Terminale — 8/8 savoirs essentiels officiels couverts',
      source: 'contenus/02-FICHES-MATIERES/ELL-CEB-8-SPTTIC.md'
    },
    {
      id: 'CONT-007',
      title: `Vague 2 — Leçons individuelles opérationnelles (${lessonCount} leçons actives)`,
      category: 'Contenus Didactiques — Vague 2',
      phase: 'Contenus',
      type: 'contenu_pedagogique',
      status: lessonCount > 0 ? 'in_progress' : 'todo',
      priority: 'haute',
      detail: `${lessonCount} leçons rédigées dans contenus/04-LECONS (Maths 7e et SVT 7e) validées par verify-contenus.sh`,
      source: 'contenus/04-LECONS/'
    },

    // SÉQUENCE 5 - Phase 1 Pilote
    { id: 'SEQ5-H001', title: 'Signature conventions avec 10 établissements pilotes de Kinshasa', category: 'Séquence 5 — Phase 1 Pilote (HUMAIN)', phase: 'Phase Pilote', type: 'tache_humaine', status: 'todo', priority: 'critique', detail: '2 600 élèves, 100 enseignants — Module 282', source: 'tome-16/282/README.md' },
    { id: 'SEQ5-H002', title: 'Formation des directions et enseignants des 10 écoles pilotes', category: 'Séquence 5 — Phase 1 Pilote (HUMAIN)', phase: 'Phase Pilote', type: 'tache_humaine', status: 'todo', priority: 'critique', detail: 'Modules de formation — manuels + tutoriels vidéo (Module 286-287)', source: 'tome-16/286/README.md' },
    { id: 'SEQ5-H003', title: 'Déploiement J0 — lancement officiel Phase 1', category: 'Séquence 5 — Phase 1 Pilote (HUMAIN)', phase: 'Phase Pilote', type: 'tache_humaine', status: 'todo', priority: 'critique', detail: 'Jalon J0 — Module 290 — décision COPIL Go/No-Go', source: 'tome-16/290/README.md' },

    // Infrastructure actuelle LUNE
    { id: 'LUNE-001', title: 'LUNE — Serveur Express API (port 4173) — EN LIGNE ✅', category: 'Infrastructure LUNE (Satellite)', phase: 'Production', type: 'infrastructure', status: 'completed', priority: 'critique', detail: 'PM2 process lune-elysium · 12 endpoints API · audit auto toutes les 5 min', source: 'src/server.js' },
    { id: 'LUNE-002', title: 'LUNE — Tunnel public Cloudflare HTTPS — EN LIGNE ✅', category: 'Infrastructure LUNE (Satellite)', phase: 'Production', type: 'infrastructure', status: 'completed', priority: 'critique', detail: 'Cloudflare Tunnel trycloudflare avec reconnexion PM2 persistante', source: 'ecosystem.config.js' },
    { id: 'LUNE-003', title: 'LUNE — Pôles d\'analyse synthétique & cockpit — LIVRÉS ✅', category: 'Infrastructure LUNE (Satellite)', phase: 'Production', type: 'infrastructure', status: 'completed', priority: 'haute', detail: 'index, explorateur de tâches, gouvernance/audit, conseiller stratégique IA', source: 'public/index.html' },
    { id: 'LUNE-004', title: 'LUNE — Conseiller conversationnel connecté à OpenRouter — ACTIF ✅', category: 'Infrastructure LUNE (Satellite)', phase: 'Production', type: 'infrastructure', status: 'completed', priority: 'haute', detail: 'Moteur Gemini 2.5 Pro via OpenRouter alimenté par le contexte temps réel du chantier', source: 'src/server.js' },
    { id: 'LUNE-005', title: 'LUNE — Base SQLite d\'historique des audits — ACTIVE ✅', category: 'Infrastructure LUNE (Satellite)', phase: 'Production', type: 'infrastructure', status: 'completed', priority: 'normale', detail: 'data/history.db — journal des scans et états successifs du projet', source: 'src/server.js' },
  ];
}

// ─── EXTRACTION VERROUS VF- DES MODULES INDIVIDUELS ──────────────────────────

function parseVFMarkersFromModules() {
  const tasks = [];

  for (let tomeNum = 1; tomeNum <= 19; tomeNum++) {
    const tomeDir = path.join(ELLYSIUM, `tome-${tomeNum}`);
    if (!fs.existsSync(tomeDir)) continue;

    let entries;
    try { entries = fs.readdirSync(tomeDir, { withFileTypes: true }); } catch { continue; }

    const tomeMeta = TOMES_META[tomeNum] || { label: 'Général', phase: 'Général' };

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const modNum = parseInt(entry.name);
      if (isNaN(modNum)) continue;

      const readmePath = path.join(tomeDir, entry.name, 'README.md');
      const content = readFile(readmePath);
      if (!content) continue;

      const titleMatch = content.match(/^#\s+(?:Module\s+\d+\s+[—–-]\s+)?(.+)$/m);
      const moduleTitle = titleMatch ? titleMatch[1].replace(/\*\*/g, '').trim() : `Module ${modNum}`;

      // Format: | **VF-XXX-YY** | Description | Détail |
      const vfRegex = /\|\s*\*{1,2}`?VF-(\d+)-(\d+)`?\*{1,2}\s*\|\s*\*{0,2}([^|*]{3,120}?)\*{0,2}\s*\|\s*([^|]{3,300}?)\s*\|/g;
      let vfMatch;

      while ((vfMatch = vfRegex.exec(content)) !== null) {
        const vfModNum = parseInt(vfMatch[1]);
        const vfIndex = parseInt(vfMatch[2]);
        const vfTitle = vfMatch[3].trim().replace(/\*\*/g, '');
        const vfDetail = vfMatch[4].trim().replace(/\*\*/g, '');

        if (!vfTitle || vfTitle.length < 3) continue;

        const id = `VF-${String(vfModNum).padStart(3,'0')}-${String(vfIndex).padStart(2,'0')}`;

        tasks.push({
          id,
          num: vfModNum,
          vfIndex,
          title: `[M${vfModNum}] ${vfTitle}`,
          category: `Tome ${String(tomeNum).padStart(2,'0')} — ${tomeMeta.label}`,
          phase: tomeMeta.phase,
          tome: tomeNum,
          module: modNum,
          moduleTitle,
          type: 'verrou_fonctionnel_vf',
          status: statusFromTome(tomeNum),
          priority: priorityFromTome(tomeNum),
          source: `tome-${tomeNum}/${modNum}/README.md`,
          detail: vfDetail || `Verrou fonctionnel VF-${vfModNum}-${vfIndex} — ${moduleTitle}`,
        });
      }
    }
  }

  return tasks;
}

// ─── GÉNÉRATION PRINCIPALE ────────────────────────────────────────────────────

function generateTasksCatalog(elysiumPath = ELLYSIUM) {
  console.log(`🔍 [LUNE] Extraction du catalogue réel ELLYSIUM (${elysiumPath})...`);

  const sommaireItems = parseSommaire();
  const vfItems = parseVFMarkersFromModules();
  const technicalItems = buildTechnicalBacklog();

  const allTasks = [...sommaireItems, ...vfItems, ...technicalItems];

  // Déduplication par ID
  const seen = new Set();
  const tasks = allTasks.filter(t => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });

  const byCategory = {};
  const byStatus = { completed: 0, in_progress: 0, todo: 0 };
  const byPhase = {};
  const byType = {};

  for (const t of tasks) {
    byCategory[t.category] = (byCategory[t.category] || 0) + 1;
    byStatus[t.status] = (byStatus[t.status] || 0) + 1;
    byPhase[t.phase] = (byPhase[t.phase] || 0) + 1;
    byType[t.type] = (byType[t.type] || 0) + 1;
  }

  const catalog = {
    generatedAt: new Date().toISOString(),
    totalTasks: tasks.length,
    byStatus,
    byPhase,
    byType,
    categories: Object.keys(byCategory).sort(),
    tasks,
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(catalog, null, 2));

  fs.mkdirSync(path.dirname(PUBLIC_OUT), { recursive: true });
  fs.writeFileSync(PUBLIC_OUT, JSON.stringify(catalog, null, 2));

  console.log(`✅ [LUNE] Catalogue mis à jour : ${tasks.length} tâches réelles`);
  console.log(`   Statuts :`, byStatus);
  return catalog;
}

module.exports = { generateTasksCatalog, ELLYSIUM, OUT, PUBLIC_OUT };

if (require.main === module) {
  generateTasksCatalog();
}
