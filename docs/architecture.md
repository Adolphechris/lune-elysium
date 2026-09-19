# Architecture de LUNE

## Vue d’ensemble

LUNE est un système de gouvernance autonome qui se compose de 7 modules :

1. Discover
2. Catalogue
3. Audit
4. Governance
5. Contributors
6. Advisor
7. UI

## 1. Discover

Ce module lit automatiquement le dépôt principal et recense :
- fichiers
- dossiers
- modules
- README
- manifests
- tests
- scripts
- documents
- dépendances

## 2. Catalogue

Ce module construit une base de référence du projet :
- types de livrables
- modules d’architecture
- tâches et sous-tâches
- phases
- jalons
- priorités

## 3. Audit

Ce module vérifie :
- cohérence entre docs et code
- présence de dépendances
- validité d’un statut
- qualité d’une tâche
- conformité au cadre fondamental
- absence d’oublis ou de redondances

## 4. Governance

Ce module gère :
- progression globale
- niveaux de priorité
- état d’avancement
- critiques
- blocages
- dépendances
- plan de séquencement

## 5. Contributors

Ce module collecte la trace des contributeurs :
- nom
- rôle
- outil
- date
- durée
- fichier touché
- commit
- validation associée

## 6. Advisor

Ce module répond à des questions naturelles et synthétise :
- état du projet
- risques
- priorités
- recommandations
- chemin d’action

## 7. UI

Ce module donne au système une expression visuelle :
- landing page institutionnelle
- tableau de bord des états
- vues par phase et par module
- vue de synthèse quantifiée
- vue de conseil

## Données centrales

LUNE gère des objets comme :
- project
- module
- task
- phase
- contributor
- validation
- evidence
- issue
- dependency
- recommendation
- state

## Objectif final

LUNE doit permettre de savoir, à tout instant :
- où est le projet
- ce qui est fait
- ce qui manque
- ce qui est bloqué
- ce qui est prioritaire
- qui a fait quoi
- ce qu’il faut faire ensuite
