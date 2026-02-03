# 🟢 WA Agent — Smart Value

Agent de gestion des conversations WhatsApp pour Smart Value.
Se connecte directement à WhatsApp (comme WhatsApp Web) et offre un dashboard de suivi complet.

## 🚀 Installation (5 minutes)

### Prérequis
- **Node.js 18+** — [Télécharger ici](https://nodejs.org/)
- **WhatsApp** sur ton iPhone (compte actif)

### Étapes

```bash
# 1. Extraire le projet et entrer dans le dossier
cd whatsapp-agent

# 2. Installer les dépendances
npm install

# 3. Lancer l'application
npm run dev
```

### 4. Ouvrir dans le navigateur
```
http://localhost:3000
```

### 5. Connecter WhatsApp
1. Aller dans **Paramètres** (icône ⚙️ dans la sidebar)
2. Cliquer sur **"Connecter WhatsApp"**
3. Un QR code s'affiche
4. Sur ton iPhone : **WhatsApp** → **⋮ Menu** → **Appareils connectés** → **Connecter un appareil**
5. Scanner le QR code
6. ✅ C'est connecté ! Les messages arrivent en temps réel.

---

## 📱 Accès depuis l'iPhone

L'app tourne sur ton PC. Pour y accéder depuis ton iPhone :

1. Trouve l'IP locale de ton PC : `ipconfig` (Windows) ou `ifconfig` (Mac)
2. Sur ton iPhone, ouvre Safari et va sur : `http://[TON_IP]:3000`
3. **Ajouter à l'écran d'accueil** : Safari → Partager → "Sur l'écran d'accueil"

> L'app s'installe comme une app native sur ton iPhone (PWA).

---

## 🎯 Fonctionnalités

### Dashboard
- Vue d'ensemble : messages non lus, conversations en attente, documents à traiter
- Alertes conversations urgentes
- Conversations à relancer (sans activité depuis 3+ jours)

### Pipeline (Kanban)
- 5 colonnes : Nouveau → En attente → Doc à traiter → En cours → Résolu
- **Drag & drop** pour changer le statut
- Vue de chaque conversation avec priorité et catégorie

### Conversations
- Liste complète avec recherche
- Historique des messages en temps réel
- Envoi de messages directement depuis l'app
- Notes par client
- Catégorisation : Nouvelle souscription, Sinistre, Résiliation, Devis, etc.

### Documents
- Détection automatique de tous les fichiers partagés (PDF, images, etc.)
- Téléchargement automatique dans `data/media/`
- Suivi de statut : Reçu → Identifié → Classé → Traité
- Filtrage par statut

### Analytics
- Taux de résolution
- Répartition par statut et catégorie
- Volume de documents

---

## ⚠️ Points importants

### WhatsApp Web
- Cette app **remplace** WhatsApp Web (une seule session web autorisée par WhatsApp)
- WhatsApp sur ton iPhone continue de fonctionner normalement
- La session reste active tant que le serveur tourne

### Sécurité
- Toutes les données restent en **local sur ton PC** (SQLite dans `data/`)
- Aucune donnée envoyée sur le cloud
- Les documents sont stockés dans `data/media/`

### Risques
- WhatsApp peut théoriquement bannir les comptes utilisant des librairies tierces
- En usage personnel/professionnel normal, c'est très rare
- Ne pas faire de spam ou d'envoi massif

---

## 📁 Structure du projet

```
whatsapp-agent/
├── data/                    # Créé automatiquement
│   ├── auth/                # Session WhatsApp
│   ├── media/               # Documents téléchargés
│   └── whatsapp-agent.db    # Base SQLite
├── src/
│   ├── app/
│   │   ├── api/whatsapp/    # API routes (backend)
│   │   ├── layout.js
│   │   ├── page.js
│   │   └── globals.css
│   ├── lib/
│   │   ├── whatsapp-client.js  # Connexion Baileys
│   │   └── database.js         # SQLite
│   └── components/
│       └── WhatsAppAgent.jsx   # Interface complète
├── package.json
└── README.md
```

---

## 🔧 Dépannage

### Le QR code ne s'affiche pas
- Vérifier que le port 3000 n'est pas déjà utilisé
- Essayer : `npx kill-port 3000` puis relancer

### Déconnexion fréquente
- Normal au début, WhatsApp valide la session
- Après 2-3 connexions stables, ça se stabilise

### Erreur `better-sqlite3`
- Windows : `npm install --global windows-build-tools` puis `npm install`
- Mac : `xcode-select --install` puis `npm install`

### Réinitialiser la connexion
- Supprimer le dossier `data/auth/` et relancer

---

## 🔮 Évolutions possibles

- [ ] Intégration Google Drive (classement automatique des documents)
- [ ] Intégration Notion (création de tâches)
- [ ] Réponses automatiques (messages d'absence)
- [ ] Notifications push (via ntfy.sh ou Pushover)
- [ ] Export des conversations en PDF
- [ ] Hébergement sur VPS pour accès permanent
