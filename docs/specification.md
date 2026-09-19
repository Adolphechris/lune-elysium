# Spécification fonctionnelle de LUNE

## 1. Objet

LUNE est le satellite de mémoire, de surveillance, d’audit, de gouvernance et de conseil du projet ELLYSIUM.

Il a pour mission de :
- observer automatiquement le dépôt principal
- cataloguer le projet en profondeur
- classer les tâches, modules et livrables selon leur état réel
- surveiller le bon déroulement du chantier
- détecter les écarts, oublis, redondances et blocages
- conserver la mémoire du projet dans le temps
- orienter l’utilisateur par des recommandations claires
- fournir un espace de conversation pour consulter et questionner l’état du projet

## 2. Rôles de LUNE

### 2.1. Conservateur du projet
LUNE garde la mémoire du projet : ce qui a été fait, ce qui est en cours, ce qui est en attente, ce qui a été abandonné, ce qui a été validé.

### 2.2. Auditeur automatique
LUNE compare l’état réel à la logique du projet, aux principes et aux objectifs.

### 2.3. Surveillant de progression
LUNE schématise l’état de chaque élément du chantier selon des niveaux de priorité, criticité, dépendance et validation.

### 2.4. Conseiller de direction
LUNE synthétise les informations et oriente les décisions à prendre : ce qu’il faut faire maintenant, ce qui est urgent, ce qui est secondaire, ce qui est bloqué.

### 2.5. Assistant conversationnel
LUNE accepte des questions naturelles et donne des réponses structurées.

## 3. Données du système

LUNE gère les objets suivants :
- projet
- phase
- module
- tâche
- livrable
- validation
- dépendance
- contributeur
- outil
- observation
- recommandation
- risque
- statut

## 4. États de tâches

Les tâches doivent être classées selon les états suivants :
- unknown
- identified
- planned
- waiting_dependency
- in_progress
- partial
- locally_validated
- human_validated
- ready
- completed
- completed_early
- blocked
- abandoned
- forgotten
- deprecated
- out_of_scope
- rejected
- invalid

## 5. Critères de progression

Chaque tâche reçoit :
- un score de progression
- un niveau de priorité
- un niveau de criticité
- une dépendance
- une preuve de validation
- un statut final

## 6. Mécanique automatique

LUNE doit être capable de :
- scanner le dépôt principal
- indexer les README et docs
- lire les fichiers de configuration
- compter les packages, apps, tests, documents
- identifier les modules du projet
- repérer les éléments de planification et d’exécution
- détecter les incohérences
- produire un état synthétique

## 7. Conversation consultative

LUNE doit répondre à des requêtes telles que :
- Où en est le projet ?
- Qu’est-ce qui est déjà fait ?
- Qu’est-ce qui reste à faire ?
- Qu’est-ce qui est bloqué ?
- Qu’est-ce qu’il faut faire maintenant ?
- Quel est le prochain jalon ?
- Quelle est la priorité du moment ?
- Qu’a été fait récemment ?
- Qu’est-ce qui a été oublié ?
- Quelles sont les tâches non validées ?

## 8. Rôle de l’utilisateur

L’utilisateur est un observateur, un décideur et un orchestrateur. Il ne doit pas être obligé de renseigner les informations manuellement. LUNE doit les obtenir automatiquement.

## 9. Objectif de l’UX

LUNE doit offrir :
- une landing page professionnellement conçue
- un dashboard de synthèse
- des vues détaillées par phase et module
- une interface de conversation liquidement lisible
- une vision claire de l’état réel du chantier

## 10. Livrables de la phase 1

- fondation du dépôt LUNE
- scan automatique du dépôt principal
- architecture du système
- définition des états et des objets de travail
- landing page de démonstration
- premier moteur de synthèse automatique
