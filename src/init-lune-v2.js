const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const projectRoot = path.join(__dirname, '..');
const dataDir = path.join(projectRoot, 'data');
const dbPath = path.join(dataDir, 'lune.db');
const statePath = path.join(dataDir, 'lune-state.json');
const observatoryPath = path.join(dataDir, 'observatory.json');

function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function ensureDirectories() {
  fs.mkdirSync(dataDir, { recursive: true });
}

function initDb() {
  ensureDirectories();
  const db = new Database(dbPath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL,
      label TEXT,
      state_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      status TEXT NOT NULL,
      progress INTEGER DEFAULT 0,
      priority TEXT,
      dependency TEXT,
      validation TEXT,
      source TEXT,
      auto_detected INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS contributors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      commits INTEGER DEFAULT 0,
      commits_last_7 INTEGER DEFAULT 0,
      tools TEXT,
      last_commit TEXT,
      metadata TEXT
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      level TEXT,
      domain TEXT,
      path TEXT,
      note TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recommendations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      created_at TEXT NOT NULL,
      details TEXT
    );

    CREATE TABLE IF NOT EXISTS task_activity (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT NOT NULL,
      author TEXT NOT NULL,
      action TEXT NOT NULL,
      comment TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_task_activity_task ON task_activity(task_id);
  `);

  return db;
}

function upsertTask(db, task) {
  const stmt = db.prepare(`
    INSERT INTO tasks (id, title, status, progress, priority, dependency, validation, source, auto_detected)
    VALUES (@id, @title, @status, @progress, @priority, @dependency, @validation, @source, @auto_detected)
    ON CONFLICT(id) DO UPDATE SET
      title=excluded.title,
      status=excluded.status,
      progress=excluded.progress,
      priority=excluded.priority,
      dependency=excluded.dependency,
      validation=excluded.validation,
      source=excluded.source,
      auto_detected=excluded.auto_detected
  `);
  stmt.run({
    id: `${Date.now()}-${task.title}`.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase(),
    title: task.title || 'Tâche sans titre',
    status: task.status || 'planned',
    progress: Number(task.progress || 0),
    priority: task.priority || 'moyenne',
    dependency: task.dependency || 'Aucune',
    validation: task.validation || 'non déterminée',
    source: task.source || 'manual',
    auto_detected: task.autoDetected ? 1 : 0
  });
}

function upsertContributor(db, contributor) {
  const stmt = db.prepare(`
    INSERT INTO contributors (id, name, email, commits, commits_last_7, tools, last_commit, metadata)
    VALUES (@id, @name, @email, @commits, @commits_last_7, @tools, @last_commit, @metadata)
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name,
      email=excluded.email,
      commits=excluded.commits,
      commits_last_7=excluded.commits_last_7,
      tools=excluded.tools,
      last_commit=excluded.last_commit,
      metadata=excluded.metadata
  `);
  stmt.run({
    id: (contributor.name || 'contributeur').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    name: contributor.name || 'Contributeur inconnu',
    email: contributor.email || '',
    commits: Number(contributor.commits || 0),
    commits_last_7: Number(contributor.commitsLast7 || 0),
    tools: JSON.stringify(contributor.tools || []),
    last_commit: contributor.lastCommit || null,
    metadata: JSON.stringify({ recentFiles: contributor.recentFiles || [], recentCommits: contributor.recentCommits || [] })
  });
}

function upsertAlert(db, alert) {
  const id = `${alert.type}-${alert.domain || alert.path || 'alert'}-${alert.when || Date.now()}`.replace(/[^a-zA-Z0-9-_]/g, '-');
  const stmt = db.prepare(`
    INSERT INTO alerts (id, type, level, domain, path, note, created_at)
    VALUES (@id, @type, @level, @domain, @path, @note, @created_at)
    ON CONFLICT(id) DO UPDATE SET
      type=excluded.type,
      level=excluded.level,
      domain=excluded.domain,
      path=excluded.path,
      note=excluded.note,
      created_at=excluded.created_at
  `);
  stmt.run({
    id,
    type: alert.type || 'risk',
    level: alert.level || 'medium',
    domain: alert.domain || '',
    path: alert.path || '',
    note: alert.note || '',
    created_at: alert.when || new Date().toISOString()
  });
}

function seedFromSnapshot(db) {
  const state = readJson(statePath, null) || readJson(observatoryPath, { projectName: 'LUNE' });
  if (!state) return;

  const now = new Date().toISOString();
  db.prepare('INSERT INTO snapshots (created_at, label, state_json) VALUES (?, ?, ?)').run(now, 'initial', JSON.stringify(state));

  const tasks = Array.isArray(state.memory?.tasks) ? state.memory.tasks : [];
  for (const task of tasks) upsertTask(db, task);

  const contributors = Array.isArray(state.contributors?.list) ? state.contributors.list : [];
  for (const contributor of contributors) upsertContributor(db, contributor);

  const alerts = Array.isArray(state.alerts) ? state.alerts : [];
  for (const alert of alerts) upsertAlert(db, alert);

  const recommendations = Array.isArray(state.recommendations) ? state.recommendations : [];
  for (const text of recommendations) {
    db.prepare('INSERT OR IGNORE INTO recommendations (text, created_at) VALUES (?, ?)').run(text, now);
  }

  db.prepare('INSERT OR IGNORE INTO events (type, title, created_at, details) VALUES (?, ?, ?, ?)')
    .run('snapshot', 'Projet LUNE initialisé', now, JSON.stringify({ projectName: state.projectName, overallHealth: state.overallHealth }));
}

function main() {
  const db = initDb();
  seedFromSnapshot(db);
  db.close();
  console.log(`LUNE v2 initialized at ${dbPath}`);
}

if (require.main === module) {
  main();
}

module.exports = { initDb, seedFromSnapshot, readJson };
