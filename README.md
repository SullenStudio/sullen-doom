# SULLEN DESCENT — Sullen Studio

A cramped corridor shooter. First-person raycaster, procedural world art.

Weapon overlays are [FPS Gun Sprites by Rekkimaru](https://rekkimaru.itch.io/fps-gun-sprites).
Indexed pixel viewmodels stay as a fallback if the sheets fail to load.

**Play:** https://sullenstudio.github.io/sullen-doom/

## Controls

| Input | Action |
| --- | --- |
| WASD / arrows | move |
| mouse | look |
| click / space | fire |
| 1–4 / Q | weapons |
| walk onto the exit | next map |
| Phone | left stick + FIRE, drag the view to look |

Best kill count is stored in `localStorage`.

```bash
npm install
npm run dev
```

## Development

```bash
npm install
npm run dev      # dev server
npm test         # unit tests
npm run build    # production build into dist/
```

The renderer draws into a 480-pixel-wide buffer and scales it up, so the
game looks the same on every display. World art is generated from a seed at
startup; first-person guns are the Rekkimaru sheets in `public/sprites/guns/`.
