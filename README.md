# Tu Préfères - Version GM

Un jeu interactif de tournoi "tu préfères" avec modes solo et multijoueur.

## 🎮 Fonctionnalités

- **Mode Solo** : Tournoi avec sélection du nombre de paires
- **Mode Multijoueur** : Créer et rejoindre des salons avec amis
- **Votes en temps réel** : Système de vote synchronisé
- **Top Victoires** : Classement des éléments les plus appréciés

## 🚀 Déploiement sur Vercel

### Prérequis
- Compte GitHub
- Compte Vercel (gratuit)

### Étapes de déploiement

1. **Fork ou clone ce repository**
```bash
git clone https://github.com/TimeoSitruk/tupref.git
cd tupref
```

2. **Connecte-toi à Vercel**
   - Va sur [vercel.com](https://vercel.com)
   - Connecte-toi avec GitHub
   - Clique sur "New Project"
   - Sélectionne ce repository

3. **Configure les paramètres**
   - Framework: Aucun (custom)
   - Root Directory: `.`
   - Clique sur "Deploy"

Vercel déploiera automatiquement :
- Les fichiers statiques (`public/`) en tant que site web
- L'API Python (`api/vote.py`) en tant que fonction serverless

## 📁 Structure du projet

```
tupref/
├── public/              # Fichiers statiques
│   ├── index.html      # Page principale
│   ├── app.js          # Logique du jeu
│   ├── objets.csv      # Liste des objets
│   └── ...
├── api/
│   └── vote.py         # API serverless pour la gestion des salons
├── vercel.json         # Configuration Vercel
├── package.json        # Metadata du projet
├── requirements.txt    # Dépendances Python
└── .gitignore         # Fichiers à ignorer dans git
```

## 🔧 Développement local

```bash
# Servir les fichiers statiques
python3 -m http.server 3000 --directory public

# Accède à http://localhost:3000
```

## 🌐 Endpoints API

- `POST /api/vote` - Gestion des actions multijoueur
  - `create_room` - Créer un salon
  - `join_room` - Rejoindre un salon
  - `get_state` - Récupérer l'état du salon
  - `vote` - Enregistrer un vote
  - `next` - Passer à la paire suivante

## 📝 Notes importantes

- Les données des salons sont stockées en mémoire (réinitialisées au déploiement)
- Pour une persistance, intégrer une base de données (MongoDB, PostgreSQL, etc.)
- Les API Python Vercel sont serverless (redémarrage entre les requêtes)

## 📄 Licence

MIT

## 👨‍💻 Auteur

Timeo Sitruk
