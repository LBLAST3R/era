# Era — Organisme sonore

**« Organisme sonore : émergence, espace-temps et morphogenèse acoustique »**

Œuvre interactive : simulation de cellules en **p5.js** (rendu organique, halos, traînées, membranes NURBS, liaisons) couplée à une **synthèse électroacoustique** via **Tone.js** (bus delay / réverb / distorsion, **pool de 20 voix** assignées aux cellules les plus saillantes — le navigateur ne peut pas maintenir des centaines d’oscillateurs indépendants en temps réel).

- **Mouvement** : champs de type Perlin (simplex), attraction / répulsion, bords, souris, collision / fusion.
- **Mémoire** : historiques de position, d’énergie et de collisions influencent timbre et stabilité.
- **Harmonie émergente** : rapprochement doux des fréquences vers des intervalles consonants pour les paires proches.
- **Modes** : calme, stable, chaos ; extinction / renaissance peuvent surgir quand l’énergie globale est basse (boucle automatique).
- **Seed** : rejouable via le champ *Seed reproductible* (RNG mulberry32 déterministe).

## Commandes

| Action | Détail |
|--------|--------|
| C / S / X | Modes calme, stable, chaos |
| R | Réinitialise (garde la seed du champ si présente, sinon aléatoire) |
| M | Mute |
| E | Export JSON de l’état |
| P | Capture PNG du canvas |
| H | Plein écran |
| Clic court | Ajoute un amas de cellules |
| Clic long (>420 ms) ou clic droit | Amas plus énergétique |
| Molette | Ajoute une cellule (densité si sous la capacité du mode) |

Les boutons du panneau reprennent sauvegarde locale, chargement, enregistrement audio (WebM via `MediaRecorder` sur la sortie master).

## Développement

```bash
npm ci
npm run dev
```

## Build

```bash
npm run build
```

Sortie dans `dist/` — déployable en statique (Hostinger, GitHub Pages, etc.).

## Limitation audio (important)

Chaque cellule possède en logique sa propre *voix* (fréquence, filtre, pan, etc.) ; seules les **K** cellules les plus audibles reçoivent une voix de synthèse en parallèle. Le reste du spectre est porté par le mélange global et les paramètres temporels.
