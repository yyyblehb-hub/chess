# Chess

A phone-sized chess lobby: pick a name, get a table code or find a random
opponent, then play on the board. `AAA4` is always open as a solo test table.

```bash
npm install
npm run dev      # http://localhost:3000
npm run build
npm start        # production server on $PORT
```

Notes

- The board artwork, menu background and menu music live in `public/assets/`
  and are left out of the repo because of their size. `render.yaml` downloads
  them during the deploy build, before the client is built.
- House rules live in `src/lib/chess.ts`, which is bundled to `server/chess.mjs`
  by `npm run engine`, so the server checks every move with the same code the
  board uses.
- Pieces are the JohnPablok/Cburnett set (CC BY-SA 3.0); see
  `src/assets/pieces/CREDITS.txt`.
