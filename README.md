# ERA

Installation interactive d'electroacoustique generative vivante.

Le projet utilise `p5.js` pour le visuel et la Web Audio API pour le moteur sonore. Chaque cellule est une voix autonome avec position, vitesse, taille, energie, age, et gene sonore. Le `Conductor` ajuste la densite, le chaos, les filtres, la reverberation et les probabilites biologiques pour garder une musique organique et ecoutable.

Chaque cellule possede aussi une signature sonore et visuelle reconnaissable. Les familles `drone`, `granular`, `pulsing`, `spectral` et `unstable` ont des formes, des halos, des attaques et des accents differents. Les collisions, divisions, fusions et morts affichent des anneaux, lignes et libelles (`TOUCH`, `SPLIT`, `FUSE`, `FADE`) qui indiquent les cellules sources du son dans la barre d'etat.

La version actuelle charge par defaut un profil `Performance max` : moins de cellules, moins de particules, moins d'oscillateurs et un rendu canvas volontairement plus sobre pour eviter de saturer la machine.

## Lancer

```bash
python3 -m http.server 4173
```

Puis ouvrir `http://127.0.0.1:4173`.

Le son demarre uniquement apres un clic sur `Start Audio`, conformement aux regles des navigateurs.

## Controles

- `Clic` : ajouter une cellule ou mettre une cellule en solo.
- `Clic long` : creer une cellule drone massive.
- `Double-clic` : forcer une division.
- `Clic droit` : faire mourir une cellule progressivement.
- `Molette` : modifier l'energie globale.
- `C`, `S`, `X` : modes calme, stable, chaos.
- `R` : renaissance depuis la seed.
- `M` : mutation.
- `A` : activer/desactiver l'auto-evolution.
- `F` : passer en plein ecran installation, avec interface masquee.
- `Espace` : pause/reprise.
- `H` : masquer/afficher l'interface.

## Exports

- `Record WAV` enregistre le mix final en WAV via un tap Web Audio.
- `Export WAV` telecharge le dernier enregistrement.
- `Record Video` capture une video WebM du canvas, avec le mix sonore si l'audio est actif.
- `Save State` exporte l'organisme en JSON.
- `Load State` recharge un organisme sauvegarde.
- `Snapshot PNG` exporte l'image du canvas.

L'export MP3 n'est pas inclus afin d'eviter une dependance d'encodage lourde cote navigateur. Le WAV et le WebM sont les formats fiables sans service externe.
