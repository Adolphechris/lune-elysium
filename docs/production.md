# Guide d'Exploitation et Mise en Production de LUNE

Ce guide présente le fonctionnement de **LUNE v2** en environnement de production continu.

---

## 1. Architecture de Production

LUNE tourne en tant que service d'arrière-plan autonome géré par le gestionnaire de processus **PM2** :
* **Fichier de configuration** : `ecosystem.config.js`
* **Processus** : `lune-elysium`
* **Port d'écoute** : `4173` (configurable via variable d'environnement `PORT`)
* **Surveillance continue** : Cycle d'audit automatique toutes les 5 minutes (`AUTO_AUDIT_INTERVAL_MS`).
* **Gestion des pannes** : Redémarrage automatique en cas de crash (`autorestart: true`), avec limite mémoire à 300 Mo.
* **Logs applicatifs** : `logs/out.log` et `logs/error.log` avec horodatage automatique.

---

## 2. Commandes de Contrôle (via npm ou pm2)

### Démarrage du service
```bash
npm run prod:start
# ou directement
npx pm2 start ecosystem.config.js
```

### Vérification du statut et de la santé
```bash
npm run prod:status
# ou
curl http://localhost:4173/api/health
curl http://localhost:4173/api/status
```

### Consultation des logs en direct
```bash
npm run prod:logs
# ou
npx pm2 logs lune-elysium
```

### Redémarrage ou rechargement
```bash
npm run prod:restart
```

### Arrêt du service
```bash
npm run prod:stop
```

---

## 3. Déclenchement d'un Audit à la Demande

Pour forcer un rafraîchissement immédiat de la base sans attendre le cycle de 5 minutes :
* **Depuis l'interface web** : Cliquer sur le bouton **"Relancer l'audit"** en haut à droite du tableau de bord.
* **Via l'API HTTP** :
  ```bash
  curl -X POST http://localhost:4173/api/scan
  ```
* **En ligne de commande** :
  ```bash
  npm run scan && npm run build-state && npm run init-db
  ```

---

## 4. Interaction avec l'Advisor Conversationnel

L'Advisor peut être interrogé en direct sur le web ou par API REST :
```bash
curl -X POST http://localhost:4173/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Quels sont les blocages majeurs ?"}'
```

---

## 5. Accès Réseau & Mise en Ligne

* **Local / Machine hôte** : `http://localhost:4173`
* **Réseau Local (LAN)** : Accessible via l'adresse IP locale de la machine sur le port 4173.
* **Reverse Proxy Nginx (Optionnel)** : Configurer un bloc `proxy_pass http://127.0.0.1:4173;` pour lier un nom de domaine ou un certificat SSL/HTTPS.
