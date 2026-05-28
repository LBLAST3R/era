# Bionum

Installation interactive d'électroacoustique générative vivante.

Le projet utilise `p5.js` pour le visuel et la Web Audio API pour le moteur sonore. Chaque cellule est une voix autonome avec position, vitesse, taille, énergie, âge, et gène sonore. Le `Conductor` ajuste la densité, le chaos, les filtres, la réverbération et les probabilités biologiques pour garder une musique organique et écoutable.

Chaque cellule possède aussi une signature sonore et visuelle reconnaissable. Les familles `drone`, `granular`, `pulsing`, `spectral` et `unstable` ont des formes, des halos, des attaques et des accents différents. Les collisions, divisions, fusions et morts affichent des anneaux, lignes et libellés (`TOUCH`, `SPLIT`, `FUSE`, `FADE`) qui indiquent les cellules sources du son dans la barre d'état.

La version actuelle charge par défaut un profil `Performance max` : moins de cellules, moins de particules, moins d'oscillateurs et un rendu canvas volontairement plus sobre pour éviter de saturer la machine.

Le mode `Rituel` redémarre l'organisme depuis la seed active et lance une pièce narrative complète. Il masque automatiquement l'interface comme la touche `H`, affiche une introduction défilante, coupe parfois tout l'organisme pour laisser apparaître de nouvelles générations, puis termine par un générique animé qui explique comment les cellules, le Conductor et les événements sonores ont construit la pièce.

## Lancer

```bash
python3 -m http.server 4173
```

Puis ouvrir `http://127.0.0.1:4173`.

Le son démarre uniquement après un clic sur `Start Audio`, conformément aux règles des navigateurs.

## Controles

- `Clic` : ajouter une cellule ou mettre une cellule en solo.
- `Clic long` : créer une cellule drone massive.
- `Double-clic` : forcer une division.
- `Clic droit` : faire mourir une cellule progressivement.
- `Molette` : modifier l'énergie globale.
- `C`, `S`, `X` : modes calme, stable, chaos.
- `Rituel` : redémarre la seed active, masque l'interface, affiche l'introduction, traverse le récit biologique, puis termine par un générique.
- `R` : renaissance depuis la seed.
- `M` : mutation.
- `A` : activer/désactiver l'auto-évolution.
- `F` : masquer/afficher l'interface, comme `H`.
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
