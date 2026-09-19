#!/usr/bin/env node
/**
 * generate-tasks-catalog.js
 * Extrait le vrai catalogue de tâches du projet ELLYSIUM depuis :
 *  - sommaire.md (336 modules documentaires)
 *  - README.md (état des tomes)
 *  - PLAN-EXECUTION.md (backlog et séquences)
 *  - Chaque tome individuel (verrous VF-)
 *  - Les apps et packages (tâches techniques)
 * Génère data/tasks-catalog.json
 */

const fs = require('fs');
const path = require('path');

const ELLYSIUM = path.resolve('/home/adolphe/CNEL -ELYSIUM/clenel-elysium');
const OUT = path.resolve(__dirname, '../data/tasks-catalog.json');

// ─── UTILITAIRES ─────────────────────────────────────────────────────────────

function readFile(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return ''; }
}

function statusFromTome(tomeNum) {
  // D'après README.md : tomes 1-10, 15-19 = rédigés/complets ; 11-14 = à consolider
  const done = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 16, 17, 18, 19];
  const inprogress = [11, 12, 13, 14];
  if (done.includes(tomeNum)) return 'completed';
  if (inprogress.includes(tomeNum)) return 'in_progress';
  return 'todo';
}

function priorityFromTome(tomeNum) {
  // Tomes fondateurs et critiques
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
  
  // Extraire les sections numérotées (ex: "55. Périmètre du Tome 5")
  const moduleRegex = /^(\d+)\.\s+(.+)$/gm;
  let match;
  
  // Map numéro → tome
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
  const subRegex = /^[·•]\s+([\d.]+\s+.+)$/gm;
  let currentModule = null;
  const lines = text.split('\n');
  let lineNum = 0;
  
  for (const line of lines) {
    lineNum++;
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

// ─── TÂCHES TECHNIQUES D'IMPLÉMENTATION ──────────────────────────────────────

function buildTechnicalBacklog() {
  return [
    // SÉQUENCE 0 - Clôture BLOC A
    { id: 'SEQ0-001', title: 'Consolider statuts des tomes 11–14 (validation des verrous VF)', category: 'Séquence 0 — Clôture BLOC A', phase: 'Préparation', type: 'backlog_ia', status: 'in_progress', priority: 'haute', detail: 'Bookkeeping documentaire — passage à consolidated pour tomes 11 à 14' },
    { id: 'SEQ0-002', title: 'Finaliser module 228 (Infrastructure — périmètre)', category: 'Séquence 0 — Clôture BLOC A', phase: 'Préparation', type: 'backlog_ia', status: 'in_progress', priority: 'haute', detail: 'Module en cours de rédaction — périmètre T13' },
    { id: 'SEQ0-003', title: 'Vérifier count 1 680/1 680 verrous VF avec verify-corpus.sh', category: 'Séquence 0 — Clôture BLOC A', phase: 'Préparation', type: 'backlog_ia', status: 'todo', priority: 'haute', detail: '258 verrous manquants à boucler (M001-M054 non unitarisés)' },

    // SÉQUENCE 1 - Montage du chantier HUMAIN
    { id: 'SEQ1-H001', title: 'Immatriculation ASBL — dépôt des statuts + RCCM', category: 'Séquence 1 — Montage du Chantier (HUMAIN)', phase: 'Institutionnel', type: 'tache_humaine', status: 'todo', priority: 'critique', detail: 'Statuts prêts dans Tome 19 — démarche physique au tribunal de grande instance de Kinshasa' },
    { id: 'SEQ1-H002', title: 'Ouverture compte bancaire institutionnel ASBL', category: 'Séquence 1 — Montage du Chantier (HUMAIN)', phase: 'Institutionnel', type: 'tache_humaine', status: 'todo', priority: 'critique', detail: 'Nécessaire pour compte GCP et paiement des factures infrastructure' },
    { id: 'SEQ1-H003', title: 'Création compte Google Cloud organisationnel (3 projets : dev / staging / prod)', category: 'Séquence 1 — Montage du Chantier (HUMAIN)', phase: 'Institutionnel', type: 'tache_humaine', status: 'todo', priority: 'critique', detail: 'Bloque le déploiement de l\'IaC réelle — développement possible sur émulateurs en attendant' },
    { id: 'SEQ1-H004', title: 'Recrutement équipe cœur : 4–6 développeurs', category: 'Séquence 1 — Montage du Chantier (HUMAIN)', phase: 'Institutionnel', type: 'tache_humaine', status: 'todo', priority: 'haute', detail: 'Fiches de poste disponibles dans le Tome 14' },
    { id: 'SEQ1-H005', title: 'Recrutement : 1 SRE (Site Reliability Engineer)', category: 'Séquence 1 — Montage du Chantier (HUMAIN)', phase: 'Institutionnel', type: 'tache_humaine', status: 'todo', priority: 'haute', detail: 'Responsable SLA / monitoring / résilience infrastructure GCP' },
    { id: 'SEQ1-H006', title: 'Recrutement : 1 QA Engineer', category: 'Séquence 1 — Montage du Chantier (HUMAIN)', phase: 'Institutionnel', type: 'tache_humaine', status: 'todo', priority: 'haute', detail: 'Tests automatisés, intégration continue, qualité logicielle' },
    { id: 'SEQ1-H007', title: 'Recrutement : 1 Designer UX/UI', category: 'Séquence 1 — Montage du Chantier (HUMAIN)', phase: 'Institutionnel', type: 'tache_humaine', status: 'todo', priority: 'normale', detail: 'Implémentation du Design System ELLYSIUM (Tome 6)' },
    { id: 'SEQ1-I001', title: 'Créer monorepo code + structure GCP Terraform', category: 'Séquence 1 — Montage du Chantier (PISTE IA)', phase: 'Préparation', type: 'backlog_ia', status: 'todo', priority: 'haute', detail: 'Squelettes IaC Cloud Run / Firestore / Firebase à générer' },
    { id: 'SEQ1-I002', title: 'Configurer pipeline CI/CD Cloud Build', category: 'Séquence 1 — Montage du Chantier (PISTE IA)', phase: 'Préparation', type: 'backlog_ia', status: 'todo', priority: 'haute', detail: 'Build → Test → Deploy sur dev/staging/prod selon Tome 13' },

    // SÉQUENCE 2 - MVP PGI (~520 SP)
    // Socle identité / RBAC
    { id: 'MVP-001', title: 'Service d\'authentification — inscription + vérification email', category: 'Séquence 2 — MVP PGI · Identité & RBAC', phase: 'Développement', type: 'backlog_ia', status: 'todo', priority: 'critique', detail: 'Firebase Authentication + Cloud Firestore users collection' },
    { id: 'MVP-002', title: 'Système RBAC — rôles (apprenant, enseignant, direction, admin)', category: 'Séquence 2 — MVP PGI · Identité & RBAC', phase: 'Développement', type: 'backlog_ia', status: 'todo', priority: 'critique', detail: 'Custom Claims Firebase + règles Firestore par rôle' },
    { id: 'MVP-003', title: 'Parcours d\'identification Établissement vs Personne', category: 'Séquence 2 — MVP PGI · Identité & RBAC', phase: 'Développement', type: 'backlog_ia', status: 'todo', priority: 'critique', detail: 'Module 4.1 de la Constitution — onboarding bifurqué' },
    { id: 'MVP-004', title: 'Gestion du profil apprenant (AIS / AIU / affilié)', category: 'Séquence 2 — MVP PGI · Identité & RBAC', phase: 'Développement', type: 'backlog_ia', status: 'todo', priority: 'haute', detail: 'Apprenant Indépendant Secondaire, Apprenant Indépendant Universitaire' },
    { id: 'MVP-005', title: 'SSO — Single Sign-On organisationnel', category: 'Séquence 2 — MVP PGI · Identité & RBAC', phase: 'Développement', type: 'backlog_ia', status: 'todo', priority: 'haute', detail: 'Google Identity / SAML pour les établissements' },
    { id: 'MVP-006', title: 'Gestion des sessions et timeout sécurisé', category: 'Séquence 2 — MVP PGI · Identité & RBAC', phase: 'Développement', type: 'backlog_ia', status: 'todo', priority: 'haute', detail: 'Révocation de tokens, refresh flows, audit log connexions' },
    { id: 'MVP-007', title: 'Journalisation des accès (audit log immuable)', category: 'Séquence 2 — MVP PGI · Identité & RBAC', phase: 'Développement', type: 'backlog_ia', status: 'todo', priority: 'haute', detail: 'Cloud Logging + BigQuery pour auditabilité' },
    { id: 'MVP-008', title: 'Authentification 2FA pour les comptes direction', category: 'Séquence 2 — MVP PGI · Identité & RBAC', phase: 'Développement', type: 'backlog_ia', status: 'todo', priority: 'critique', detail: 'TOTP / SMS pour rôles privilégiés (Tome 9)' },
    { id: 'MVP-009', title: 'Vérification de l\'identité documentaire (pièce d\'identité)', category: 'Séquence 2 — MVP PGI · Identité & RBAC', phase: 'Développement', type: 'backlog_ia', status: 'todo', priority: 'normale', detail: 'Module Art. 16 Constitution — fraude documentaire' },

    // Gestion des établissements
    { id: 'MVP-010', title: 'Fiche établissement — création + validation admin', category: 'Séquence 2 — MVP PGI · Établissements', phase: 'Développement', type: 'backlog_ia', status: 'todo', priority: 'critique', detail: 'Nom, code établissement, localisation, directeur, type (public/privé)' },
    { id: 'MVP-011', title: 'Gestion des classes et sections par établissement', category: 'Séquence 2 — MVP PGI · Établissements', phase: 'Développement', type: 'backlog_ia', status: 'todo', priority: 'critique', detail: '6ème–4ème secondaire, L1–L3 supérieur, sections officielles RDC' },
    { id: 'MVP-012', title: 'Inscription et affiliation d\'un élève à un établissement', category: 'Séquence 2 — MVP PGI · Établissements', phase: 'Développement', type: 'backlog_ia', status: 'todo', priority: 'critique', detail: 'Workflow inscription → validation direction → badge élève affilié' },
    { id: 'MVP-013', title: 'Tableau de bord direction — statistiques de l\'établissement', category: 'Séquence 2 — MVP PGI · Établissements', phase: 'Développement', type: 'backlog_ia', status: 'todo', priority: 'haute', detail: 'Effectifs, absences, résultats, alertes en temps réel' },
    { id: 'MVP-014', title: 'Gestion du calendrier académique par établissement', category: 'Séquence 2 — MVP PGI · Établissements', phase: 'Développement', type: 'backlog_ia', status: 'todo', priority: 'haute', detail: 'Trimestres, périodes d\'examen, jours fériés RDC' },
    { id: 'MVP-015', title: 'Import en masse des élèves (CSV + validation)', category: 'Séquence 2 — MVP PGI · Établissements', phase: 'Développement', type: 'backlog_ia', status: 'todo', priority: 'normale', detail: 'Outil de migration depuis registres Excel/papier des écoles' },
    { id: 'MVP-016', title: 'Portail enseignant — liste des classes, cours assignés', category: 'Séquence 2 — MVP PGI · Établissements', phase: 'Développement', type: 'backlog_ia', status: 'todo', priority: 'haute', detail: 'Interface réservée au corps enseignant affilié à l\'établissement' },
    { id: 'MVP-017', title: 'Gestion des transferts d\'élèves inter-établissements', category: 'Séquence 2 — MVP PGI · Établissements', phase: 'Développement', type: 'backlog_ia', status: 'todo', priority: 'normale', detail: 'Historique de scolarité portable et signé' },

    // Présences et scolarité
    { id: 'MVP-018', title: 'Module appel — saisie des présences par l\'enseignant', category: 'Séquence 2 — MVP PGI · Scolarité & Présences', phase: 'Développement', type: 'backlog_ia', status: 'todo', priority: 'critique', detail: 'Interface mobile optimisée, mode hors-ligne avec sync différée' },
    { id: 'MVP-019', title: 'Calcul automatique du taux d\'assiduité par élève/période', category: 'Séquence 2 — MVP PGI · Scolarité & Présences', phase: 'Développement', type: 'backlog_ia', status: 'todo', priority: 'haute', detail: 'Seuil d\'alerte paramétrable (ex : < 80%)' },
    { id: 'MVP-020', title: 'Notification parents — absence non justifiée', category: 'Séquence 2 — MVP PGI · Scolarité & Présences', phase: 'Développement', type: 'backlog_ia', status: 'todo', priority: 'haute', detail: 'SMS + push notification via FCM' },
    { id: 'MVP-021', title: 'Justification d\'absence — workflow élève/parent → direction', category: 'Séquence 2 — MVP PGI · Scolarité & Présences', phase: 'Développement', type: 'backlog_ia', status: 'todo', priority: 'normale', detail: 'Pièce justificative + validation enseignant' },
    { id: 'MVP-022', title: 'Rapport mensuel d\'assiduité par classe', category: 'Séquence 2 — MVP PGI · Scolarité & Présences', phase: 'Développement', type: 'backlog_ia', status: 'todo', priority: 'normale', detail: 'Export PDF/CSV pour la direction' },

    // Cotes et évaluations
    { id: 'MVP-023', title: 'Saisie des cotes par l\'enseignant — interface de délibération', category: 'Séquence 2 — MVP PGI · Cotes & Délibération', phase: 'Développement', type: 'backlog_ia', status: 'todo', priority: 'critique', detail: 'Grille de saisie par cours, fraction, trimestre' },
    { id: 'MVP-024', title: 'Moteur de calcul officiel de la formule RDC', category: 'Séquence 2 — MVP PGI · Cotes & Délibération', phase: 'Développement', type: 'backlog_ia', status: 'todo', priority: 'critique', detail: 'Taux = (ΣPointsObtenus / ΣMaxima) × 100 — implémentation certifiée' },
    { id: 'MVP-025', title: 'Délibération automatique — mention, passage, redoublement', category: 'Séquence 2 — MVP PGI · Cotes & Délibération', phase: 'Développement', type: 'backlog_ia', status: 'todo', priority: 'critique', detail: 'Selon barème DIPROMAD officiel RDC' },
    { id: 'MVP-026', title: 'Validation humaine obligatoire des résultats de délibération', category: 'Séquence 2 — MVP PGI · Cotes & Délibération', phase: 'Développement', type: 'backlog_ia', status: 'todo', priority: 'critique', detail: 'Art. 6 Constitution — aucune décision académique définitive sans arbitrage humain' },
    { id: 'MVP-027', title: 'Historique immuable des cotes — signature cryptographique', category: 'Séquence 2 — MVP PGI · Cotes & Délibération', phase: 'Développement', type: 'backlog_ia', status: 'todo', priority: 'critique', detail: 'Cloud KMS — hachage de chaque enregistrement de cote' },
    { id: 'MVP-028', title: 'Gestion de la révision de cotes — workflow de contestation', category: 'Séquence 2 — MVP PGI · Cotes & Délibération', phase: 'Développement', type: 'backlog_ia', status: 'todo', priority: 'haute', detail: 'Art. 8 Constitution — droit à la révision des décisions' },
    { id: 'MVP-029', title: 'Bulletin de notes électronique — template officiel RDC', category: 'Séquence 2 — MVP PGI · Cotes & Délibération', phase: 'Développement', type: 'backlog_ia', status: 'todo', priority: 'critique', detail: 'Format DIPROMAD, générateur PDF, signature numérique directeur' },

    // Bulletins et diplômes
    { id: 'MVP-030', title: 'Génération du bulletin annuel scellé — export PDF', category: 'Séquence 2 — MVP PGI · Bulletins & Diplômes', phase: 'Développement', type: 'backlog_ia', status: 'todo', priority: 'critique', detail: 'Bulletin trimestriel + annuel signé et certifié' },
    { id: 'MVP-031', title: 'QR Code dynamique sur chaque document officiel', category: 'Séquence 2 — MVP PGI · Bulletins & Diplômes', phase: 'Développement', type: 'backlog_ia', status: 'todo', priority: 'critique', detail: 'Vérification anti-fraude — Module 10 (Tome 10 Art. 16)' },
    { id: 'MVP-032', title: 'Portail de vérification publique des documents (QR + hash)', category: 'Séquence 2 — MVP PGI · Bulletins & Diplômes', phase: 'Développement', type: 'backlog_ia', status: 'todo', priority: 'critique', detail: 'URL publique dédiée — scan par n\'importe qui (employeurs, universités)' },
    { id: 'MVP-033', title: 'Diplôme numérique scellé — fin de cycle secondaire', category: 'Séquence 2 — MVP PGI · Bulletins & Diplômes', phase: 'Développement', type: 'backlog_ia', status: 'todo', priority: 'haute', detail: 'Diplôme d\'État analogue — cryptographiquement infalsifiable' },
    { id: 'MVP-034', title: 'Archivage légal des documents sur 30 ans — Cloud Storage', category: 'Séquence 2 — MVP PGI · Bulletins & Diplômes', phase: 'Développement', type: 'backlog_ia', status: 'todo', priority: 'haute', detail: 'Rétention Firestore + Storage conforme Tome 19 Art. 333' },
    { id: 'MVP-035', title: 'Service de duplicata certifié — paiement Mobile Money', category: 'Séquence 2 — MVP PGI · Bulletins & Diplômes', phase: 'Développement', type: 'backlog_ia', status: 'todo', priority: 'normale', detail: 'Source de revenus premium — Tome 17 Art. 298' },

    // Caisse et finance
    { id: 'MVP-036', title: 'Module caisse — enregistrement des paiements de minerval', category: 'Séquence 2 — MVP PGI · Caisse Scolaire', phase: 'Développement', type: 'backlog_ia', status: 'todo', priority: 'critique', detail: 'Étanchéité totale caisse/scolarité — Art. 5 Constitution' },
    { id: 'MVP-037', title: 'Règle Art. 5 — aucun blocage académique pour raison financière', category: 'Séquence 2 — MVP PGI · Caisse Scolaire', phase: 'Développement', type: 'backlog_ia', status: 'todo', priority: 'critique', detail: 'Garde-fou technique : impossible de bloquer accès cours via dette caisse' },
    { id: 'MVP-038', title: 'Intégration Mobile Money — M-Pesa', category: 'Séquence 2 — MVP PGI · Caisse Scolaire', phase: 'Développement', type: 'backlog_ia', status: 'todo', priority: 'haute', detail: 'API Safaricom M-Pesa pour paiements depuis mobile' },
    { id: 'MVP-039', title: 'Intégration Mobile Money — Orange Money', category: 'Séquence 2 — MVP PGI · Caisse Scolaire', phase: 'Développement', type: 'backlog_ia', status: 'todo', priority: 'haute', detail: 'API Orange Money RDC / Airtel Money' },
    { id: 'MVP-040', title: 'Reçu de paiement numérique — email + SMS', category: 'Séquence 2 — MVP PGI · Caisse Scolaire', phase: 'Développement', type: 'backlog_ia', status: 'todo', priority: 'haute', detail: 'PDF signé avec QR de validation de paiement' },
    { id: 'MVP-041', title: 'Tableau de trésorerie établissement — rapport mensuel', category: 'Séquence 2 — MVP PGI · Caisse Scolaire', phase: 'Développement', type: 'backlog_ia', status: 'todo', priority: 'normale', detail: 'Agrégation recettes/dépenses pour le directeur' },
    { id: 'MVP-042', title: 'Audit financier — rapport annuel exportable', category: 'Séquence 2 — MVP PGI · Caisse Scolaire', phase: 'Développement', type: 'backlog_ia', status: 'todo', priority: 'normale', detail: 'Conforme Tome 17 Art. 305 — audit financier annuel' },

    // Messagerie et notifications
    { id: 'MVP-043', title: 'Messagerie interne — enseignant ↔ élève ↔ parent ↔ direction', category: 'Séquence 2 — MVP PGI · Messagerie', phase: 'Développement', type: 'backlog_ia', status: 'todo', priority: 'haute', detail: 'Chat sécurisé chiffré — historique conservé 3 ans minimum' },
    { id: 'MVP-044', title: 'Notifications push — Firebase Cloud Messaging (FCM)', category: 'Séquence 2 — MVP PGI · Messagerie', phase: 'Développement', type: 'backlog_ia', status: 'todo', priority: 'haute', detail: 'Alertes absence, résultats, annonces importantes' },
    { id: 'MVP-045', title: 'Système d\'annonces officielles par établissement', category: 'Séquence 2 — MVP PGI · Messagerie', phase: 'Développement', type: 'backlog_ia', status: 'todo', priority: 'normale', detail: 'Tableau d\'affichage numérique — ciblage classe/section/établissement' },
    { id: 'MVP-046', title: 'Intégration SMS — Twilio / Africa\'s Talking pour zones sans data', category: 'Séquence 2 — MVP PGI · Messagerie', phase: 'Développement', type: 'backlog_ia', status: 'todo', priority: 'haute', detail: 'Accessibilité zones rurales sans accès internet mobile' },

    // PWA et mode hors-ligne
    { id: 'MVP-047', title: 'PWA — Progressive Web App avec Service Worker', category: 'Séquence 2 — MVP PGI · Applications', phase: 'Développement', type: 'backlog_ia', status: 'todo', priority: 'critique', detail: 'Cache offline — cours, devoirs, résultats disponibles sans réseau' },
    { id: 'MVP-048', title: 'Mode hors-ligne — saisie des présences sans réseau', category: 'Séquence 2 — MVP PGI · Applications', phase: 'Développement', type: 'backlog_ia', status: 'todo', priority: 'critique', detail: 'Sync différée via IndexedDB → Firebase quand réseau disponible' },
    { id: 'MVP-049', title: 'Application Android — APK natif', category: 'Séquence 2 — MVP PGI · Applications', phase: 'Développement', type: 'backlog_ia', status: 'todo', priority: 'haute', detail: 'Android minimum API 21 (Android 5.0) — parc matériel RDC' },
    { id: 'MVP-050', title: 'Application iOS — compatibilité iPhone 8+', category: 'Séquence 2 — MVP PGI · Applications', phase: 'Développement', type: 'backlog_ia', status: 'todo', priority: 'normale', detail: 'Phase 2 uniquement — priorité Android pour la RDC' },
    { id: 'MVP-051', title: 'Optimisation réseau 2G — payload < 100KB par écran', category: 'Séquence 2 — MVP PGI · Applications', phase: 'Développement', type: 'backlog_ia', status: 'todo', priority: 'critique', detail: 'Test sur banc Kinshasa 2G/800ms/25% perte paquets (Phase 0 labo)' },
    { id: 'MVP-052', title: 'Gestion des coupures électriques — UPS et état de session', category: 'Séquence 2 — MVP PGI · Applications', phase: 'Développement', type: 'backlog_ia', status: 'todo', priority: 'haute', detail: 'Auto-sauvegarde locale toutes les 30 secondes pendant la saisie' },

    // Sécurité et données
    { id: 'MVP-053', title: 'Chiffrement CMEK — Cloud KMS avec clés sous contrôle RDC', category: 'Séquence 2 — MVP PGI · Sécurité', phase: 'Développement', type: 'backlog_ia', status: 'todo', priority: 'critique', detail: 'Immunité Cloud Act — souveraineté cryptographique (Art. 1 bis)' },
    { id: 'MVP-054', title: 'Firestore Security Rules — matrice complète par rôle', category: 'Séquence 2 — MVP PGI · Sécurité', phase: 'Développement', type: 'backlog_ia', status: 'todo', priority: 'critique', detail: 'Read/Write par rôle, collection, document — test exhaustif' },
    { id: 'MVP-055', title: 'Protection DDoS — Cloud Armor rules + rate limiting', category: 'Séquence 2 — MVP PGI · Sécurité', phase: 'Développement', type: 'backlog_ia', status: 'todo', priority: 'critique', detail: 'Cloud Armor WAF configuré pour Cloud Run endpoints' },
    { id: 'MVP-056', title: 'Politique RGPD + loi RDC n° 15/023 — module de consentement', category: 'Séquence 2 — MVP PGI · Sécurité', phase: 'Développement', type: 'backlog_ia', status: 'todo', priority: 'critique', detail: 'Consentement parental pour mineurs — Tome 19 Art. 327' },
    { id: 'MVP-057', title: 'Plan de reprise d\'activité (PRA) et sauvegarde quotidienne', category: 'Séquence 2 — MVP PGI · Sécurité', phase: 'Développement', type: 'backlog_ia', status: 'todo', priority: 'haute', detail: 'RTO < 4h, RPO < 1h — Tome 13 Art. 244' },
    { id: 'MVP-058', title: 'Détection d\'anomalies — Security Command Center', category: 'Séquence 2 — MVP PGI · Sécurité', phase: 'Développement', type: 'backlog_ia', status: 'todo', priority: 'haute', detail: 'Alertes intrusion, exfiltration de données, comptes compromis' },
    { id: 'MVP-059', title: 'Pen test initial — rapport de vulnérabilités', category: 'Séquence 2 — MVP PGI · Sécurité', phase: 'Développement', type: 'backlog_ia', status: 'todo', priority: 'haute', detail: 'Avant la Phase 1 pilote — obligatoire Tome 9' },

    // Infrastructure Cloud
    { id: 'MVP-060', title: 'Cloud Run — service API PGI containerisé', category: 'Séquence 2 — MVP PGI · Infrastructure GCP', phase: 'Développement', type: 'backlog_ia', status: 'todo', priority: 'critique', detail: 'Node.js / Go — autoscaling 0→N — régions europe-west1 + africa-south1' },
    { id: 'MVP-061', title: 'Firestore — schéma de données principal (collections + index)', category: 'Séquence 2 — MVP PGI · Infrastructure GCP', phase: 'Développement', type: 'backlog_ia', status: 'todo', priority: 'critique', detail: 'Collections : users, schools, classes, students, grades, attendance, documents' },
    { id: 'MVP-062', title: 'Cloud SQL — base de données relationnelle pour cotes et finances', category: 'Séquence 2 — MVP PGI · Infrastructure GCP', phase: 'Développement', type: 'backlog_ia', status: 'todo', priority: 'haute', detail: 'PostgreSQL — données financières et audit trail immuable' },
    { id: 'MVP-063', title: 'BigQuery — entrepôt analytique pour rapports direction + COPIL', category: 'Séquence 2 — MVP PGI · Infrastructure GCP', phase: 'Développement', type: 'backlog_ia', status: 'todo', priority: 'normale', detail: 'Dashboard analytique temps quasi-réel — Looker Studio' },
    { id: 'MVP-064', title: 'Cloud Storage — stockage documents, bulletins, pièces justificatives', category: 'Séquence 2 — MVP PGI · Infrastructure GCP', phase: 'Développement', type: 'backlog_ia', status: 'todo', priority: 'haute', detail: 'Bucket par établissement — lifecycle policies pour archivage légal' },
    { id: 'MVP-065', title: 'Memorystore Redis — cache sessions et rate limiting', category: 'Séquence 2 — MVP PGI · Infrastructure GCP', phase: 'Développement', type: 'backlog_ia', status: 'todo', priority: 'normale', detail: 'TTL 30 min sessions — performance API' },
    { id: 'MVP-066', title: 'Firebase Hosting — déploiement PWA / app web', category: 'Séquence 2 — MVP PGI · Infrastructure GCP', phase: 'Développement', type: 'backlog_ia', status: 'todo', priority: 'haute', detail: 'CDN Firebase mondial — SLA 99.9%' },
    { id: 'MVP-067', title: 'Cloud Monitoring — dashboards SLA / alertes SLO', category: 'Séquence 2 — MVP PGI · Infrastructure GCP', phase: 'Développement', type: 'backlog_ia', status: 'todo', priority: 'haute', detail: 'SLA ≥ 99.5% requis pour Phase 1 (feu vert M290)' },
    { id: 'MVP-068', title: 'Cloud Build — pipeline CI/CD complet', category: 'Séquence 2 — MVP PGI · Infrastructure GCP', phase: 'Développement', type: 'backlog_ia', status: 'todo', priority: 'haute', detail: 'Build → Tests unitaires → Tests intégration → Deploy staging → Deploy prod' },
    { id: 'MVP-069', title: 'Terraform — IaC (Infrastructure as Code) pour les 3 environnements', category: 'Séquence 2 — MVP PGI · Infrastructure GCP', phase: 'Développement', type: 'backlog_ia', status: 'todo', priority: 'haute', detail: 'Dev / Staging / Production — idempotent et versionné' },

    // IA et Vertex AI
    { id: 'MVP-070', title: 'Vertex AI — Gemini intégré comme IA auxiliaire pédagogique', category: 'Séquence 2 — MVP PGI · Intelligence Artificielle', phase: 'Développement', type: 'backlog_ia', status: 'todo', priority: 'haute', detail: 'Art. 6 Constitution — IA auxiliaire, arbitrage humain obligatoire' },
    { id: 'MVP-071', title: 'Moteur de recommandation de cours — Vertex AI Recommendations', category: 'Séquence 2 — MVP PGI · Intelligence Artificielle', phase: 'Développement', type: 'backlog_ia', status: 'todo', priority: 'normale', detail: 'Suggestion de révision basée sur les lacunes détectées dans les cotes' },
    { id: 'MVP-072', title: 'Détection d\'anomalies dans les cotes — alertes suspectes', category: 'Séquence 2 — MVP PGI · Intelligence Artificielle', phase: 'Développement', type: 'backlog_ia', status: 'todo', priority: 'haute', detail: 'ML pipeline — détection saisie suspecte (fraude aux cotes)' },
    { id: 'MVP-073', title: 'Assistant IA pour enseignants — aide à la rédaction d\'évaluations', category: 'Séquence 2 — MVP PGI · Intelligence Artificielle', phase: 'Développement', type: 'backlog_ia', status: 'todo', priority: 'normale', detail: 'Gemini API — génération de questions selon le programme officiel RDC' },
    { id: 'MVP-074', title: 'Proctoring IA — surveillance d\'examen à distance', category: 'Séquence 2 — MVP PGI · Intelligence Artificielle', phase: 'Développement', type: 'backlog_ia', status: 'todo', priority: 'normale', detail: 'Phase 2 uniquement — service premium (Tome 17 Art. 298)' },
    { id: 'MVP-075', title: 'Analyse prédictive du décrochage scolaire — alertes précoces', category: 'Séquence 2 — MVP PGI · Intelligence Artificielle', phase: 'Développement', type: 'backlog_ia', status: 'todo', priority: 'haute', detail: 'BigQuery ML — signal combinant absences + résultats + engagement' },

    // Tests
    { id: 'MVP-076', title: 'Tests unitaires — couverture ≥ 80% codebase critique', category: 'Séquence 2 — MVP PGI · Qualité & Tests', phase: 'Développement', type: 'backlog_ia', status: 'todo', priority: 'haute', detail: 'Jest / Vitest — modules identité, cotes, formule RDC, bulletins' },
    { id: 'MVP-077', title: 'Tests d\'intégration — API PGI end-to-end', category: 'Séquence 2 — MVP PGI · Qualité & Tests', phase: 'Développement', type: 'backlog_ia', status: 'todo', priority: 'haute', detail: 'Supertest — endpoints CRUD pour chaque domaine' },
    { id: 'MVP-078', title: 'Tests de charge — simulation 2 600 élèves simultanés', category: 'Séquence 2 — MVP PGI · Qualité & Tests', phase: 'Développement', type: 'backlog_ia', status: 'todo', priority: 'critique', detail: 'k6 — scénario journée de remise des bulletins (pic de charge)' },
    { id: 'MVP-079', title: 'Tests de performance 2G — latence 800ms, 25% perte paquets', category: 'Séquence 2 — MVP PGI · Qualité & Tests', phase: 'Développement', type: 'backlog_ia', status: 'todo', priority: 'critique', detail: 'tc/netem simulation réseau dégradé — banc Kinshasa Module 281' },
    { id: 'MVP-080', title: 'Analyse statique du code — SonarQube / SonarCloud', category: 'Séquence 2 — MVP PGI · Qualité & Tests', phase: 'Développement', type: 'backlog_ia', status: 'todo', priority: 'haute', detail: 'Zéro vulnérabilité critique, dette technique contrôlée' },

    // SÉQUENCE 3 - Phase 0 Labo
    { id: 'SEQ3-H001', title: 'Montage laboratoire physique Kinshasa — 50 postes', category: 'Séquence 3 — Phase 0 Laboratoire (HUMAIN)', phase: 'Phase Labo', type: 'tache_humaine', status: 'todo', priority: 'critique', detail: 'Ordinateurs hétérogènes, simulateur WAN 2G/800ms, onduleurs (Module 281)' },
    { id: 'SEQ3-H002', title: 'Recrutement 50 testeurs internes à Kinshasa', category: 'Séquence 3 — Phase 0 Laboratoire (HUMAIN)', phase: 'Phase Labo', type: 'tache_humaine', status: 'todo', priority: 'critique', detail: 'Cohorte de testeurs — élèves, enseignants, directeurs — Module 281' },
    { id: 'SEQ3-H003', title: '4 épreuves de certification labo — définition des critères', category: 'Séquence 3 — Phase 0 Laboratoire (HUMAIN)', phase: 'Phase Labo', type: 'tache_humaine', status: 'todo', priority: 'haute', detail: 'PV de certification requis pour passage Phase 1 (Module 281)' },
    { id: 'SEQ3-I001', title: 'Jeux de données de test réalistes — 50 établissements fictifs', category: 'Séquence 3 — Phase 0 Laboratoire (PISTE IA)', phase: 'Phase Labo', type: 'backlog_ia', status: 'todo', priority: 'haute', detail: 'Données synthétiques conformes à la structure des écoles kinoise' },
    { id: 'SEQ3-I002', title: 'Scripts de correction automatique des jeux de test', category: 'Séquence 3 — Phase 0 Laboratoire (PISTE IA)', phase: 'Phase Labo', type: 'backlog_ia', status: 'todo', priority: 'normale', detail: 'Validation automatique des résultats de simulation' },

    // SÉQUENCE 4 - Contenus pédagogiques
    { id: 'SEQ4-001', title: 'Catalogue L1 Informatique — ≈200 leçons à rédiger', category: 'Séquence 4 — Contenus Pédagogiques L1 Informatique', phase: 'Contenus', type: 'backlog_ia', status: 'todo', priority: 'normale', detail: 'Phase 2 — démarrage prévu mois 10 — voir CATALOGUE-LECONS-L1-INFORMATIQUE.md' },
    { id: 'SEQ4-002', title: 'Contenus de test pilote — 5 cours témoins + devoirs formateurs', category: 'Séquence 4 — Contenus Pédagogiques L1 Informatique', phase: 'Contenus', type: 'backlog_ia', status: 'todo', priority: 'haute', detail: 'Minimum viable pour Phase 1 pilote en condition réelle' },
    { id: 'SEQ4-003', title: 'Validation didactique des contenus par auteurs humains', category: 'Séquence 4 — Contenus Pédagogiques L1 Informatique', phase: 'Contenus', type: 'tache_humaine', status: 'todo', priority: 'haute', detail: 'IA rédige — validateurs humains approuvent avant publication' },

    // SÉQUENCE 5 - Phase 1 Pilote
    { id: 'SEQ5-H001', title: 'Signature conventions avec 10 établissements pilotes de Kinshasa', category: 'Séquence 5 — Phase 1 Pilote (HUMAIN)', phase: 'Phase Pilote', type: 'tache_humaine', status: 'todo', priority: 'critique', detail: '2 600 élèves, 100 enseignants — Module 282' },
    { id: 'SEQ5-H002', title: 'Formation des directions et enseignants des 10 écoles pilotes', category: 'Séquence 5 — Phase 1 Pilote (HUMAIN)', phase: 'Phase Pilote', type: 'tache_humaine', status: 'todo', priority: 'critique', detail: 'Modules de formation — manuels + tutoriels vidéo (Module 286-287)' },
    { id: 'SEQ5-H003', title: 'Déploiement J0 — lancement officiel Phase 1', category: 'Séquence 5 — Phase 1 Pilote (HUMAIN)', phase: 'Phase Pilote', type: 'tache_humaine', status: 'todo', priority: 'critique', detail: 'Jalon J0 — Module 290 — décision COPIL Go/No-Go' },
    { id: 'SEQ5-H004', title: 'Revue J+30 — premier bilan terrain (Module 290)', category: 'Séquence 5 — Phase 1 Pilote (HUMAIN)', phase: 'Phase Pilote', type: 'tache_humaine', status: 'todo', priority: 'haute', detail: 'NPS, rétention, incidents signalés' },
    { id: 'SEQ5-H005', title: 'Revue J+60 — analyse assiduité + satisfaction enseignants', category: 'Séquence 5 — Phase 1 Pilote (HUMAIN)', phase: 'Phase Pilote', type: 'tache_humaine', status: 'todo', priority: 'haute', detail: '6 feux verts à mesurer — Module 290' },
    { id: 'SEQ5-H006', title: 'Revue J+90 — premier bulletin électronique délivré', category: 'Séquence 5 — Phase 1 Pilote (HUMAIN)', phase: 'Phase Pilote', type: 'tache_humaine', status: 'todo', priority: 'critique', detail: 'Validation formule RDC en conditions réelles' },
    { id: 'SEQ5-H007', title: 'Revue J+180 — décision Go/No-Go généralisation', category: 'Séquence 5 — Phase 1 Pilote (HUMAIN)', phase: 'Phase Pilote', type: 'tache_humaine', status: 'todo', priority: 'critique', detail: 'Critères : rétention ≥ 75%, réussite ≥ 65%, NPS ≥ +40, SLA ≥ 99.5%' },
    { id: 'SEQ5-I001', title: 'Programme Ambassadeurs ELLYSIUM — formation et certification', category: 'Séquence 5 — Phase 1 Pilote (PISTE IA)', phase: 'Phase Pilote', type: 'backlog_ia', status: 'todo', priority: 'normale', detail: 'Module 285 — 1 ambassadeur par école pilote' },
    { id: 'SEQ5-I002', title: 'Tableaux de suivi des jalons J+30→J+180', category: 'Séquence 5 — Phase 1 Pilote (PISTE IA)', phase: 'Phase Pilote', type: 'backlog_ia', status: 'todo', priority: 'haute', detail: 'Dashboard LUNE en temps réel des 6 feux verts — Module 290' },

    // SÉQUENCE 6 - Passage à l'échelle
    { id: 'SEQ6-001', title: 'Phase 2 — lancement filière Informatique L1 (15 000 apprenants)', category: 'Séquence 6 — Passage à l\'échelle', phase: 'Généralisation', type: 'backlog_ia', status: 'todo', priority: 'normale', detail: 'EAD complet — Module 283 — démarrage après feu vert J+180' },
    { id: 'SEQ6-002', title: 'Phase 3 — généralisation SGS nationale (100+ établissements)', category: 'Séquence 6 — Passage à l\'échelle', phase: 'Généralisation', type: 'backlog_ia', status: 'todo', priority: 'normale', detail: 'Module 284 — extension progressive, provinces par provinces' },
    { id: 'SEQ6-H001', title: 'Accréditation CAMES — dossier de reconnaissance', category: 'Séquence 6 — Passage à l\'échelle (HUMAIN)', phase: 'Généralisation', type: 'tache_humaine', status: 'todo', priority: 'haute', detail: 'Tome 15 Art. 267 — reconnaissance des diplômes dans l\'espace CAMES' },
    { id: 'SEQ6-H002', title: 'Partenariats universités accréditées — double diplôme', category: 'Séquence 6 — Passage à l\'échelle (HUMAIN)', phase: 'Généralisation', type: 'tache_humaine', status: 'todo', priority: 'haute', detail: 'Tome 15 Art. 268 — reconnaissance de crédits transférables' },

    // Contenus vague 1 (déjà produits mais à étendre)
    { id: 'CONT-001', title: 'Fiche-matière + syllabus Mathématiques 7ème année — PRODUIT ✅', category: 'Contenus Pédagogiques — Vague 1 Terminale', phase: 'Contenus', type: 'contenu_pedagogique', status: 'completed', priority: 'haute', detail: 'Adossé programme DIPROMAD — 163/163 savoirs essentiels officiels couverts' },
    { id: 'CONT-002', title: 'Fiche-matière + syllabus SVT 7ème année — PRODUIT ✅', category: 'Contenus Pédagogiques — Vague 1 Terminale', phase: 'Contenus', type: 'contenu_pedagogique', status: 'completed', priority: 'haute', detail: 'Sciences de la Vie et de la Terre — programme officiel MEPSP' },
    { id: 'CONT-003', title: 'Fiche-matière + syllabus SPTTIC 7ème année — PRODUIT ✅', category: 'Contenus Pédagogiques — Vague 1 Terminale', phase: 'Contenus', type: 'contenu_pedagogique', status: 'completed', priority: 'haute', detail: 'Sciences Physiques, Techniques, TIC — programme officiel' },
    { id: 'CONT-004', title: 'Fiche-matière + syllabus Mathématiques 8ème année — PRODUIT ✅', category: 'Contenus Pédagogiques — Vague 1 Terminale', phase: 'Contenus', type: 'contenu_pedagogique', status: 'completed', priority: 'haute', detail: 'Terminale — adossé aux 117 documents PDF MINEDU-NC recensés' },
    { id: 'CONT-005', title: 'Fiche-matière + syllabus SVT 8ème année — PRODUIT ✅', category: 'Contenus Pédagogiques — Vague 1 Terminale', phase: 'Contenus', type: 'contenu_pedagogique', status: 'completed', priority: 'haute', detail: 'Terminale — couverture intégrale des savoirs essentiels officiels' },
    { id: 'CONT-006', title: 'Fiche-matière + syllabus SPTTIC 8ème année — PRODUIT ✅', category: 'Contenus Pédagogiques — Vague 1 Terminale', phase: 'Contenus', type: 'contenu_pedagogique', status: 'completed', priority: 'haute', detail: 'Terminale — programme officiel MEPSP certifié' },
    { id: 'CONT-007', title: 'Vague 2 — fiches-matières secondaire (6ème–4ème) : Français', category: 'Contenus Pédagogiques — Vague 2', phase: 'Contenus', type: 'contenu_pedagogique', status: 'todo', priority: 'haute', detail: 'Production à démarrer — programme DIPROMAD officiel' },
    { id: 'CONT-008', title: 'Vague 2 — fiches-matières secondaire : Histoire', category: 'Contenus Pédagogiques — Vague 2', phase: 'Contenus', type: 'contenu_pedagogique', status: 'todo', priority: 'normale', detail: 'Histoire nationale et générale — référentiels officiels' },
    { id: 'CONT-009', title: 'Vague 2 — fiches-matières secondaire : Géographie', category: 'Contenus Pédagogiques — Vague 2', phase: 'Contenus', type: 'contenu_pedagogique', status: 'todo', priority: 'normale', detail: 'Géographie de la RDC et du monde — programme officiel' },
    { id: 'CONT-010', title: 'Vague 2 — fiches-matières secondaire : Physique-Chimie', category: 'Contenus Pédagogiques — Vague 2', phase: 'Contenus', type: 'contenu_pedagogique', status: 'todo', priority: 'normale', detail: 'Sciences physiques — cycles orientation et humanités' },
    { id: 'CONT-011', title: 'Vague 2 — fiches-matières secondaire : Éducation Civique', category: 'Contenus Pédagogiques — Vague 2', phase: 'Contenus', type: 'contenu_pedagogique', status: 'todo', priority: 'normale', detail: 'Éducation à la citoyenneté — programme officiel RDC' },
    { id: 'CONT-012', title: 'Vague 2 — fiches-matières secondaire : Anglais', category: 'Contenus Pédagogiques — Vague 2', phase: 'Contenus', type: 'contenu_pedagogique', status: 'todo', priority: 'normale', detail: 'Langue anglaise — niveaux A1 à B2 selon référentiel secondaire' },

    // Infrastructure actuelle LUNE
    { id: 'LUNE-001', title: 'LUNE — Serveur Express API (port 4173) — EN LIGNE ✅', category: 'Infrastructure LUNE (Satellite)', phase: 'Production', type: 'infrastructure', status: 'completed', priority: 'critique', detail: 'PM2 process lune-elysium · 10 endpoints API · audit auto toutes les 5 min' },
    { id: 'LUNE-002', title: 'LUNE — Tunnel public loca.lt — EN LIGNE ✅', category: 'Infrastructure LUNE (Satellite)', phase: 'Production', type: 'infrastructure', status: 'completed', priority: 'critique', detail: 'https://lune-elysium.loca.lt · PM2 process lune-tunnel · reconnexion auto' },
    { id: 'LUNE-003', title: 'LUNE — 7 landing pages charte ELLYSIUM — LIVRÉES ✅', category: 'Infrastructure LUNE (Satellite)', phase: 'Production', type: 'infrastructure', status: 'completed', priority: 'haute', detail: 'index, audit, tâches, conseiller, risques, contributeurs, passerelle' },
    { id: 'LUNE-004', title: 'LUNE — Connexion bidirectionnelle LUNE ↔ ELLYSIUM — ACTIVE ✅', category: 'Infrastructure LUNE (Satellite)', phase: 'Production', type: 'infrastructure', status: 'completed', priority: 'haute', detail: 'Boutons croisés dans les deux portails' },
    { id: 'LUNE-005', title: 'LUNE — Base SQLite historique des audits', category: 'Infrastructure LUNE (Satellite)', phase: 'Production', type: 'infrastructure', status: 'completed', priority: 'normale', detail: 'data/history.db — journal des scans et états du projet' },
    { id: 'LUNE-006', title: 'LUNE — Migrer vers domaine permanent (hors localtunnel)', category: 'Infrastructure LUNE (Satellite)', phase: 'Production', type: 'infrastructure', status: 'todo', priority: 'haute', detail: 'Firebase Hosting ou Cloud Run dédié pour LUNE en production permanente' },
    { id: 'LUNE-007', title: 'LUNE — Authentification admin pour accès au satellite', category: 'Infrastructure LUNE (Satellite)', phase: 'Production', type: 'infrastructure', status: 'todo', priority: 'haute', detail: 'Protéger les endpoints sensibles contre accès non autorisé' },
    { id: 'LUNE-008', title: 'LUNE — Graphiques de progression dans le cockpit (Chart.js)', category: 'Infrastructure LUNE (Satellite)', phase: 'Production', type: 'infrastructure', status: 'todo', priority: 'normale', detail: 'Visualisation historique des cycles d\'audit — courbes de maturité' },
    { id: 'LUNE-009', title: 'LUNE — Export PDF du rapport d\'audit complet', category: 'Infrastructure LUNE (Satellite)', phase: 'Production', type: 'infrastructure', status: 'todo', priority: 'normale', detail: 'Rapport formel pour le COPIL — puppeteer ou html2pdf' },
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

function main() {
  console.log('🔍 Extraction du catalogue réel ELLYSIUM...');

  const sommaireItems = parseSommaire();
  console.log(`  ✅ Sommaire : ${sommaireItems.length} items extraits`);

  const vfItems = parseVFMarkersFromModules();
  console.log(`  ✅ Verrous VF- extraits des 290 modules : ${vfItems.length} items`);

  const technicalItems = buildTechnicalBacklog();
  console.log(`  ✅ Backlog technique : ${technicalItems.length} items`);

  const allTasks = [...sommaireItems, ...vfItems, ...technicalItems];

  // Déduplication par ID
  const seen = new Set();
  const tasks = allTasks.filter(t => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });

  const byCategory = {};
  const byStatus = {};
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

  fs.writeFileSync(OUT, JSON.stringify(catalog, null, 2));
  console.log(`\n✅ Catalogue généré : ${tasks.length} tâches réelles`);
  console.log(`   Statuts :`, byStatus);
  console.log(`   Types :`, byType);
  console.log(`   Phases :`, Object.keys(byPhase).length, 'phases distinctes');
  console.log(`   Catégories :`, Object.keys(byCategory).length, 'catégories');
  console.log(`   → ${OUT}`);
}

main();
