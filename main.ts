// The Velvet Vault — hand-in program (Node 22, standard library only).
// Copies game/ and screenshots/ from beside this file into the output
// directory and writes /output/dossier.json with the vendored
// make.fun library. Outside the grader, MAKEFUN_OUTPUT_DIR stands
// in for /output, so a local check is:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The repository root is the directory holding this file.
const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The scorer's own caps, as the kit's gate describes them: at most
// four screenshots of 256 KiB each, at most 993 game files totalling
// 48 MiB, no game path over 1000 bytes, and a 160 KiB text budget
// for the dossier's source outline.
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
} as const;

function copyGameFiles() {
  const gameSrc = join(repoRoot, 'game');
  const gameDst = join(outputDir, 'game');
  mkdirSync(outputDir, { recursive: true });
  cpSync(gameSrc, gameDst, { recursive: true });
}

function copyScreenshots() {
  const shotsSrc = join(repoRoot, 'screenshots');
  const shotsDst = join(outputDir, 'screenshots');
  mkdirSync(shotsDst, { recursive: true });
  if (!existsSync(shotsSrc)) return;
  const names = readdirSync(shotsSrc)
    .filter((n) => /\.(png|jpe?g)$/i.test(n))
    .sort();
  for (const name of names) {
    cpSync(join(shotsSrc, name), join(shotsDst, name));
  }
}

copyGameFiles();
copyScreenshots();

writeFileSync(join(outputDir, 'dossier.json'), buildDossier(outputDir, CAPS));

// A short report so a local run shows what was handed in.
const dossierBytes = readdirSync(outputDir).length;
console.log('Velvet Vault handed in to ' + outputDir + ' (' + dossierBytes + ' top-level entries, dossier.json written).');
