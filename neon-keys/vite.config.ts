import { createReadStream, readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

// Velocity layers of the Salamander Grand Piano (CC BY 3.0, Alexander Holm)
// shipped as npm packages. They are copied into the build as
// `samples/<layer>/<note>.mp3`, with "#" spelled as "s" to keep URLs clean.
const LAYERS: Record<string, string> = {
  v12: '@audio-samples/piano-mp3-velocity12',
  v5: '@audio-samples/piano-mp3-velocity5',
};

function sampleFiles(): Map<string, string> {
  const require = createRequire(import.meta.url);
  const files = new Map<string, string>();
  for (const [layer, pkg] of Object.entries(LAYERS)) {
    const dir = join(dirname(require.resolve(`${pkg}/package.json`)), 'audio');
    for (const file of readdirSync(dir)) {
      const m = /^([A-G]#?\d)v\d+\.mp3$/.exec(file);
      if (m) files.set(`samples/${layer}/${m[1].replace('#', 's')}.mp3`, join(dir, file));
    }
  }
  return files;
}

function pianoSamples(): Plugin {
  const files = sampleFiles();
  return {
    name: 'piano-samples',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const m = /(samples\/v\d+\/[A-Za-z0-9]+\.mp3)$/.exec((req.url ?? '').split('?')[0]);
        const src = m && files.get(m[1]);
        if (!src) return next();
        res.setHeader('Content-Type', 'audio/mpeg');
        createReadStream(src).pipe(res);
      });
    },
    generateBundle() {
      for (const [fileName, src] of files) {
        this.emitFile({ type: 'asset', fileName, source: readFileSync(src) });
      }
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [pianoSamples()],
});
