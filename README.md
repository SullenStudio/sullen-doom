# SULLEN DESCENT — Sullen Studio

A cramped corridor shooter. First-person raycaster, procedural art,
no external assets.

**Play:** https://sullenstudio.github.io/sullen-descent/

## Controls

| Input | Action |
| --- | --- |
| WASD / arrows | move |
| mouse | look |
| click / space | fire |
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
game looks the same on every display. All art is generated from a seed at
startup; there are no asset files.
