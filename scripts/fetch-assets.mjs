// Downloads the assets that are too big (or not ours) to keep in git: the twelve
// piece images, the menu songs, the board surface and the menu background.
// Only missing files are fetched, so a local rebuild does not re-download them.
import { createWriteStream, existsSync, mkdirSync } from 'node:fs';
import { stat, unlink } from 'node:fs/promises';
import { dirname } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const PIECES =
  'https://raw.githubusercontent.com/GiorgioMegrelli/chess.com-boards-and-pieces/v2.x/pieces/classic';
const SET = ['wb', 'wk', 'wn', 'wp', 'wq', 'wr', 'bb', 'bk', 'bn', 'bp', 'bq', 'br'];

const files = [
  ...SET.map((piece) => [`src/assets/pieces/${piece}.png`, `${PIECES}/${piece}.png`]),
  ['public/assets/chess.m4a', 'https://files.catbox.moe/0fcoov.m4a'],
  ['public/assets/simple-diversion.mp3', 'https://files.catbox.moe/e2k166.mp3'],
  ['public/assets/queen.mp3', 'https://files.catbox.moe/jojrjv.mp3'],
  ['public/assets/field-of-hopes.mp3', 'https://files.catbox.moe/og82ow.mp3'],
  ['public/assets/board-wood.jpg', 'https://files.catbox.moe/uudqnj.jpg'],
  ['public/assets/chess-bg.jpg', 'https://files.catbox.moe/pversw.jpg'],
];

const ATTEMPTS = 5;
let missing = [];

for (const [target, url] of files) {
  if (existsSync(target) && (await stat(target)).size > 0) continue;
  mkdirSync(dirname(target), { recursive: true });

  let done = false;
  for (let attempt = 1; attempt <= ATTEMPTS && !done; attempt += 1) {
    try {
      const response = await fetch(url);
      if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);
      await pipeline(Readable.fromWeb(response.body), createWriteStream(target));
      const size = (await stat(target)).size;
      if (size === 0) throw new Error('empty file');
      console.log(`${target} <- ${url} (${size} bytes)`);
      done = true;
    } catch (error) {
      if (existsSync(target)) await unlink(target);
      console.warn(`${target}: attempt ${attempt}/${ATTEMPTS} failed (${error.message})`);
      if (attempt < ATTEMPTS) await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
    }
  }
  if (!done) missing.push(target);
}

if (missing.length > 0) {
  console.error(`Could not download: ${missing.join(', ')}`);
  process.exit(1);
}
