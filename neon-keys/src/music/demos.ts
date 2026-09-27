import type { ScoreDef } from './score';

/** Built-in demo pieces. All compositions are in the public domain; arrangements are simplified. */

const rep = (s: string, n: number) => Array(n).fill(s).join(' | ');

const eliseA = `E5:.25 D#5:.25 E5:.25 B4:.25 D5:.25 C5:.25 |
  A4:.5 R:.25 C4:.25 E4:.25 A4:.25 | B4:.5 R:.25 E4:.25 G#4:.25 B4:.25 |
  C5:.5 R:.25 E4:.25 E5:.25 D#5:.25 | E5:.25 D#5:.25 E5:.25 B4:.25 D5:.25 C5:.25 |
  A4:.5 R:.25 C4:.25 E4:.25 A4:.25 | B4:.5 R:.25 E4:.25 C5:.25 B4:.25`;
const arpA = 'A2:.25:1.5 E3:.25:1.25 A3:.25:1 R:.75';
const arpE = 'E2:.25:1.5 E3:.25:1.25 G#3:.25:1 R:.75';
const eliseLH = `R:1.5 | ${arpA} | ${arpE} | ${arpA} | R:1.5 | ${arpA} | ${arpE}`;

// Bach, Prelude in C major BWV 846: each bar is one broken chord played twice.
const preludeBars = [
  'C4 E4 G4 C5 E5', 'C4 D4 A4 D5 F5', 'B3 D4 G4 D5 F5', 'C4 E4 G4 C5 E5',
  'C4 E4 A4 E5 A5', 'C4 D4 F#4 A4 D5', 'B3 D4 G4 D5 G5', 'B3 C4 E4 G4 C5',
  'A3 C4 E4 G4 C5', 'D3 A3 D4 F#4 C5', 'G3 B3 D4 G4 B4',
].map(b => b.split(' '));
const preludeRH = preludeBars
  .map(([, , a, b, c]) => rep(`R:.5 ${a}:.25 ${b}:.25 ${c}:.25 ${a}:.25 ${b}:.25 ${c}:.25`, 2))
  .join(' | ') + ' | E4+G4+C5:4';
const preludeLH = preludeBars
  .map(([lo, hi]) => rep(`${lo}:.25:2 ${hi}:.25:1.75 R:1.5`, 2))
  .join(' | ') + ' | C3+G3+C4:4';

const canonBass = [['D3', 'A3'], ['A2', 'E3'], ['B2', 'F#3'], ['F#2', 'C#3'], ['G2', 'D3'], ['D2', 'A2'], ['G2', 'D3'], ['A2', 'E3']]
  .map(([lo, hi]) => `${lo}:1:2 ${hi}:1`).join(' | ');

export const DEMOS: (ScoreDef & { titleRu: string; composerRu: string })[] = [
  {
    id: 'minuet', title: 'Minuet in G', titleRu: 'Менуэт соль мажор',
    composer: 'C. Petzold', composerRu: 'К. Петцольд', bpm: 112, level: 1,
    voices: [
      {
        name: 'Right hand', velocity: 84,
        src: `D5 G4:.5 A4:.5 B4:.5 C5:.5 | D5 G4 G4 | E5 C5:.5 D5:.5 E5:.5 F#5:.5 | G5 G4 G4 |
              C5 D5:.5 C5:.5 B4:.5 A4:.5 | B4 C5:.5 B4:.5 A4:.5 G4:.5 | F#4 G4:.5 A4:.5 B4:.5 G4:.5 | A4:3 |
              D5 G4:.5 A4:.5 B4:.5 C5:.5 | D5 G4 G4 | E5 C5:.5 D5:.5 E5:.5 F#5:.5 | G5 G4 G4 |
              C5 D5:.5 C5:.5 B4:.5 A4:.5 | B4 C5:.5 B4:.5 A4:.5 G4:.5 | A4 B4:.5 A4:.5 G4:.5 F#4:.5 | G4:3`,
      },
      {
        name: 'Left hand', velocity: 62,
        src: `G3+B3+D4:2 A3 | B3:3 | C4:3 | B3:3 | A3:3 | G3:3 | D4 B3 G3 | D4 D3 C4 |
              G3+B3+D4:2 A3 | B3:3 | C4:3 | B3:3 | A3:3 | G3:3 | C4 D4 D3 | G3:2 G2`,
      },
    ],
  },
  {
    id: 'ode', title: 'Ode to Joy', titleRu: 'Ода к радости',
    composer: 'L. van Beethoven', composerRu: 'Л. ван Бетховен', bpm: 116, level: 1,
    voices: [
      {
        name: 'Right hand', velocity: 86,
        src: `E4 E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | E4:1.5 D4:.5 D4:2 |
              E4 E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | D4:1.5 C4:.5 C4:2 |
              D4 D4 E4 C4 | D4 E4:.5 F4:.5 E4 C4 | D4 E4:.5 F4:.5 E4 D4 | C4 D4 G3:2 |
              E4 E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | D4:1.5 C4:.5 C4:2`,
      },
      {
        name: 'Left hand', velocity: 60,
        src: `C3:2 G3:2 | G2:2 D3:2 | C3:2 G3:2 | G2:2 D3:2 |
              C3:2 G3:2 | G2:2 D3:2 | C3:2 G3:2 | G2:2 C3:2 |
              G2:2 D3:2 | G2:2 C3:2 | G2:2 D3:2 | C3:2 G2:2 |
              C3:2 G3:2 | G2:2 D3:2 | C3:2 G3:2 | G2:2 C3+G3:2`,
      },
    ],
  },
  {
    id: 'elise', title: 'Für Elise', titleRu: 'К Элизе',
    composer: 'L. van Beethoven', composerRu: 'Л. ван Бетховен', bpm: 66, level: 2,
    voices: [
      {
        name: 'Right hand', velocity: 78,
        src: `E5:.25 D#5:.25 | ${eliseA} | A4:.5 R:.5 E5:.25 D#5:.25 | ${eliseA} | A4:1.5`,
      },
      {
        name: 'Left hand', velocity: 58,
        src: `R:.5 | ${eliseLH} | ${arpA} | ${eliseLH} | ${arpA}`,
      },
    ],
  },
  {
    id: 'prelude', title: 'Prelude in C', titleRu: 'Прелюдия до мажор',
    composer: 'J. S. Bach', composerRu: 'И. С. Бах', bpm: 66, level: 2,
    voices: [
      { name: 'Right hand', velocity: 72, src: preludeRH },
      { name: 'Left hand', velocity: 64, src: preludeLH },
    ],
  },
  {
    id: 'canon', title: 'Canon in D', titleRu: 'Канон ре мажор',
    composer: 'J. Pachelbel', composerRu: 'И. Пахельбель', bpm: 72, level: 2,
    voices: [
      {
        name: 'Right hand', velocity: 80,
        src: `F#5:2 E5:2 D5:2 C#5:2 B4:2 A4:2 B4:2 C#5:2 |
              D5:2 C#5:2 B4:2 A4:2 G4:2 F#4:2 G4:2 E4:2 |
              D5 F#5 A5 G5 F#5 D5 F#5 E5 D5 B4 D5 A5 G5 B5 A5 G5 | F#5+A5+D6:4`,
      },
      { name: 'Left hand', velocity: 62, src: `${rep(canonBass, 3)} | D2+D3:4` },
    ],
  },
];
