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

- `npm run assets` (run automatically before `dev` and `build`) downloads the
  pieces, menu music and artwork that are not in the repo because of their size
  or licence; it only fetches files that are missing.
- House rules live in `src/lib/chess.ts`, which is bundled to `server/chess.mjs`
  by `npm run engine`, so the server checks every move with the same code the
  board uses.
- Pieces are chess.com's classic set, see `src/assets/pieces/CREDITS.txt`.
