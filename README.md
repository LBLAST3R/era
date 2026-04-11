# Era - organisme electro-acoustique

Site JavaScript generatif pour canvas plein ecran et Web Audio.

## Lancer en local

```bash
npm install
npm run dev
```

## Build de production

```bash
npm run build
```

Le build final est genere dans `dist/`.

## Deploiement Hostinger avec GitHub

Option recommandee pour les deploiements automatiques :

1. Dans Hostinger hPanel, ouvrir `Websites`, puis ajouter ou gerer le site.
2. Choisir `Node.js Apps` / app front-end, puis `Import Git Repository`.
3. Autoriser GitHub et selectionner le repo `LBLAST3R/era`.
4. Utiliser la branche `main`.
5. Laisser Hostinger detecter `Vite`, ou entrer ces reglages :
   - Install command: `npm ci`
   - Build command: `npm run build`
   - Output directory: `dist`
6. Activer les deploiements automatiques depuis Hostinger.

Alternative hebergement web classique :

1. Dans hPanel, ouvrir `Advanced` puis `Git`.
2. Utiliser le repo `https://github.com/LBLAST3R/era.git`.
3. Branche : `main`.
4. Laisser `Install Path` vide pour deployer vers `/public_html`.
5. Activer le webhook de deploiement automatique si disponible.

Le projet reste statique : aucun serveur backend n'est necessaire.
