#!/usr/bin/env node
// Renderiza de novo um vídeo que já foi preparado (build/props.json, build/audio, build/midia),
// sem narrar nem buscar imagem. Serve para trocar de estilo ou testar um estilo novo.
//
// Uso:
//   node renderizar.mjs <pasta-do-video>                    MP4 em <pasta>/video.mp4
//   node renderizar.mjs <pasta-do-video> --estilo iceberg   troca o estilo antes de renderizar
//   node renderizar.mjs <pasta-do-video> --quadros 30,400   só PNGs desses frames em build/conferir/

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {bundle} from '@remotion/bundler';
import {renderMedia, renderStill, selectComposition} from '@remotion/renderer';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const pasta = path.resolve(process.argv[2] ?? '');
const build = path.join(pasta, 'build');
const arquivoProps = path.join(build, 'props.json');
if (!process.argv[2] || !fs.existsSync(arquivoProps)) {
  console.error('uso: node renderizar.mjs <pasta-do-video> [--estilo nome] [--quadros f1,f2]  (precisa de build/props.json)');
  process.exit(1);
}
const arg = nome => {
  const i = process.argv.indexOf(nome);
  return i > 0 ? process.argv[i + 1] : null;
};

const props = JSON.parse(fs.readFileSync(arquivoProps, 'utf8'));
if (arg('--estilo')) props.estilo = arg('--estilo');
const chromiumOptions = props.estilo === 'palco3d' ? {gl: 'angle'} : {};

const serveUrl = await bundle({entryPoint: path.join(AQUI, 'src/index.ts'), publicDir: build});
process.on('exit', () => { try { fs.rmSync(serveUrl, {recursive: true, force: true}); } catch {} });
const composition = await selectComposition({serveUrl, id: 'Video', inputProps: props, chromiumOptions});

if (arg('--quadros')) {
  const saida = path.join(build, 'conferir');
  fs.mkdirSync(saida, {recursive: true});
  for (const f of arg('--quadros').split(',').map(Number)) {
    const png = path.join(saida, `quadro-${String(f).padStart(5, '0')}.png`);
    await renderStill({composition, serveUrl, inputProps: props, chromiumOptions, output: png, frame: f});
    console.log(`  ✓ ${png}`);
  }
} else {
  const saida = path.join(pasta, 'video.mp4');
  let ultimo = -1;
  await renderMedia({
    composition, serveUrl, inputProps: props, chromiumOptions, codec: 'h264', crf: 23, outputLocation: saida,
    concurrency: Number(process.env.RENDER_ABAS) || 4, timeoutInMilliseconds: 120000,
    onProgress: ({progress}) => {
      const pct = Math.floor(progress * 100);
      if (pct % 10 === 0 && pct !== ultimo) { ultimo = pct; process.stdout.write(`  renderizando ${pct}%\r`); }
    },
  });
  console.log(`\n✓ ${saida}`);
}
