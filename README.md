# Atelier — Gestion des commandes

Application 100 % locale (aucun serveur, aucun compte, aucune connexion nécessaire une fois les polices chargées la première fois). Toutes les données sont stockées directement dans le navigateur, sur l'appareil utilisé.

## Installation — c'est très simple

1. Dézippez le dossier `patisserie-app` où vous voulez (Bureau, Documents...).
2. Double-cliquez sur `index.html`. Il s'ouvre dans votre navigateur par défaut (Chrome, Edge, Safari...).
3. C'est prêt — aucune installation supplémentaire.

**Sur iPad :** envoyez le dossier via AirDrop, mail ou une clé/app de fichiers, ouvrez `index.html` avec Safari. Vous pouvez ensuite l'ajouter à l'écran d'accueil (bouton Partager → « Sur l'écran d'accueil ») pour l'ouvrir comme une vraie appli, en plein écran.

**Sur Windows :** double-clic sur `index.html`, ça marche directement dans Edge ou Chrome.

## Important à savoir

- **Les données restent sur l'appareil.** Si vous ouvrez l'app sur l'iPad, les commandes saisies sur l'iPad n'apparaissent pas sur l'ordinateur, et inversement — ce sont deux mémoires séparées. Utilisez de préférence toujours le même appareil pour la saisie quotidienne.
- **Ne videz pas les données de navigation** (cache/historique) de l'onglet où l'app est ouverte, ou tout serait perdu, comme pour n'importe quel site. Dans le doute, ne pas toucher aux réglages de confidentialité du navigateur pour ce dossier.
- **Le devis PDF** : sur la page d'une commande, bouton « Voir le devis » puis « Télécharger en PDF ». Ça ouvre la fenêtre d'impression du navigateur — il suffit de choisir « Enregistrer en PDF » comme imprimante. Vous pouvez revenir sur ce devis et le re-télécharger à tout moment, les infos ne bougent pas même si vous changez un prix d'ingrédient plus tard.

## Ordre de prise en main conseillé

1. **Paramètres** — renseignez le poids d'une part, le coefficient de marge, et vos infos pour le devis.
2. **Inventaire** — ajoutez vos ingrédients avec leur prix réel (prix d'1 œuf, prix d'1 gramme de farine, etc.).
3. **Recettes** — créez vos fiches de base (« Génoise pour 4 personnes », etc.).
4. **Création gâteau** — assemblez des recettes pour composer un gâteau, indiquez son nombre de parts.
5. **Commandes** — ajoutez les gâteaux commandés par un client, suivez le statut, générez le devis.

## Note technique pour Marc

- Vanilla HTML/CSS/JS, aucune dépendance, aucun build.
- Stockage via IndexedDB (`js/db.js`), un store par entité (ingredients, parametres, recettes, gateaux, commandes).
- Scripts chargés en `<script defer>` classiques (pas de `type="module"`) exprès, pour que ça fonctionne en ouvrant simplement le fichier via `file://` — les modules ES sont bloqués par CORS sous ce protocole dans la plupart des navigateurs.
- Routage par hash (`#/commandes`, `#/recettes`, etc.) dans `js/router.js`.
- Le devis est généré à la volée en HTML/CSS (`css/print.css`) et converti en PDF via l'impression native du navigateur — pas de librairie PDF externe.
- Un service worker (`sw.js`) met l'app en cache pour un usage hors-ligne une fois chargée une première fois (best effort, ignoré silencieusement si indisponible).
