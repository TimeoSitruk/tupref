# 🚀 Guide de déploiement sur Vercel

## Étapes rapides

### 1. **Aller sur Vercel**
Va sur https://vercel.com et connecte-toi avec ton compte GitHub.

### 2. **Importer le projet**
- Clique sur **"New Project"** (ou "Add New..." → "Project")
- Sélectionne le repository `tupref` dans ta liste GitHub
- Clique sur **"Import"**

### 3. **Configurer les paramètres du projet**
Dans la page de configuration:
- **Framework**: Laisse vide (Aucun)
- **Root Directory**: `.` (ou laisse vide)
- **Build Command**: `echo 'Build complete'`
- **Output Directory**: `public`

### 4. **Déployer**
Clique sur **"Deploy"** et attends 2-3 minutes.

Voilà ! Ton application sera disponible à une URL du type:
`https://tupref-[random].vercel.app`

## Structure du projet

```
tupref/
├── public/                 # Fichiers statiques servis par Vercel
│   ├── index.html         # Page principale
│   ├── app.js             # Logique du jeu (mis à jour avec les corrections)
│   └── objets.csv         # Liste des objets
├── api/
│   └── vote.py            # API serverless pour la gestion des salons
├── vercel.json            # Configuration Vercel
└── package.json           # Metadata du projet
```

## Fonctionnement

### Frontend
Les fichiers dans `/public/` sont servis directement en tant que site web statique.

### Backend
L'API Python (`/api/vote.py`) s'exécute comme fonction serverless Vercel à:
- `https://tupref-[random].vercel.app/api/vote`

### Points importants

| Point | Description |
|-------|-------------|
| **Stockage** | Les données des salons sont en mémoire (réinitialisées au redéploiement) |
| **Limite gratuite** | Vercel gratuit supporte jusqu'à 100 exécutions d'API par jour |
| **CORS** | Activé pour permettre l'accès cross-origin |
| **Python** | Version 3.11 configurable dans `vercel.json` |

## Redéploiement automatique

Tout push vers `main` redéploiera automatiquement ton application sur Vercel.

## URL de l'API en production

Depuis `app.js`, remplace:
```javascript
fetch('/api/vote', { ... })
```

Par:
```javascript
fetch('https://tupref-[random].vercel.app/api/vote', { ... })
```

(Normalement c'est automatique grâce aux rewrites dans `vercel.json`)

## Dépannage

### "API not found"
- Vérifie que `api/vote.py` existe et est committé
- Redéploie avec Vercel ("Redeploy" depuis le tableau de bord)

### Les sauvegardes disparaissent
- C'est normal, les données en mémoire se réinitialisent. Voir la section **Persistance** ci-dessous.

## Persistance des données

Pour garder les salons entre les redéploiements, intègre une base de données:

### Option 1: MongoDB (gratuit)
```bash
pip install pymongo
```

### Option 2: PostgreSQL (gratuit sur Railway)
```bash
pip install psycopg2-binary
```

### Option 3: Supabase (gratuit)
Utilise l'API REST de Supabase (sans dépendances).

## Domaine personnalisé

1. Va dans les paramètres du projet Vercel
2. Va à **Domains**
3. Ajoute ton domaine personnel
4. Suis les instructions pour configurer les DNS

## Support

Pour toute question: https://vercel.com/docs/concepts/functions/serverless-functions/python
