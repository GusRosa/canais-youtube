#!/usr/bin/env node
// Robô de vídeo.
//
// Uso:
//   node gerar.mjs <pasta-do-video>              prepara (voz + mídia) e renderiza o MP4
//   node gerar.mjs <pasta-do-video> --candidatos monta 1 cartela por cena com as opções de imagem numeradas
//   node gerar.mjs <pasta-do-video> --conferir   prepara e tira 1 PNG por cena em build/conferir/
//   node gerar.mjs <pasta-do-video> --conferir --cenas 8,15   só os quadros dessas cenas
//
// Mídia por cena: "tipo": "foto" (padrão) ou "video" (ou "midia_padrao" no topo do cenas.json).
// Cena de vídeo vira takes de até 5s ("take_max"), um clipe diferente por take.
// Escolha (campo "escolha"): ausente → primeiras opções ainda não usadas · número ou lista →
// aquelas opções da cartela; em vídeo, "3b" = opção 3 a partir do quadro b · 0 → cartão de texto
//
// A pasta precisa ter um cenas.json (formato em exemplo/cenas.json).
// Saídas: video.mp4, video.srt e creditos.md na própria pasta.

import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {bundle} from '@remotion/bundler';
import {renderMedia, renderStill, selectComposition} from '@remotion/renderer';
import {narrar, fornecedorVoz} from './lib/narrar.mjs';
import {duracaoWav} from './lib/wav.mjs';
import {cortarTrecho} from './lib/corte.mjs';
import {buscarCandidatos, buscarVideos, filtrarValidos, filtrarVideos, baixar, MOMENTOS} from './lib/midia.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const FPS = 30;

const raizRepo = path.resolve(AQUI, '../..');
if (fs.existsSync(path.join(raizRepo, '.env'))) process.loadEnvFile(path.join(raizRepo, '.env'));

const pasta = path.resolve(process.argv[2] ?? '');
const conferir = process.argv.includes('--conferir');
const modoCandidatos = process.argv.includes('--candidatos');
const argCenas = process.argv[process.argv.indexOf('--cenas') + 1];
const soCenas = process.argv.includes('--cenas') ? new Set(argCenas.split(',').map(Number)) : null;
if (!process.argv[2] || !fs.existsSync(path.join(pasta, 'cenas.json'))) {
  console.error('Uso: node gerar.mjs <pasta-com-cenas.json> [--conferir]');
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(path.join(pasta, 'cenas.json'), 'utf8'));
const RESPIRO = config.respiro ?? 0.35; // segundos de silêncio entre cenas (Reels pede menos)
const build = path.join(pasta, 'build');
const pastaAudio = path.join(build, 'audio');
const pastaMidia = path.join(build, 'midia');
fs.mkdirSync(pastaAudio, {recursive: true});
fs.mkdirSync(pastaMidia, {recursive: true});

// 1. Narração e mídia, cena a cena
console.log(`\n▶ ${config.titulo ?? path.basename(pasta)}`);
console.log(`  voz: ${fornecedorVoz(config)} · estilo: ${config.estilo ?? 'dossie'} · ${config.formato ?? 'horizontal'} · ${config.cenas.length} cenas\n`);

// Ordem das fontes de busca. Sem chave, Pexels e Pixabay são puladas sozinhas.
// Pode trocar por vídeo inteiro ("fontes_foto", "fontes_video") ou por cena ("fontes").
const fontesFoto = config.fontes_foto ?? config.fontes_midia ?? ['wikimedia', 'openverse', 'pexels', 'pixabay'];
const fontesVideo = config.fontes_video ?? ['pexels', 'pixabay', 'wikimedia', 'archive'];
const usadas = new Set();
// Candidatos ficam em cache pra numeração da cartela não mudar entre rodadas.
const arquivoCache = path.join(build, 'candidatos.json');
const cacheBuscas = fs.existsSync(arquivoCache) ? JSON.parse(fs.readFileSync(arquivoCache, 'utf8')) : {};
const opcoesPorCena = [];
const miniaturasPorCena = [];
const creditos = [];
const cenas = [];

const vertical = config.formato === 'vertical';
const TAKE_MAX = config.take_max ?? 5; // segundos: cena de vídeo é dividida em takes de até TAKE_MAX
// Opções por cena na cartela. Menos opções = cartela menor = menos tokens na revisão. "opcoes" no cenas.json muda.
const OPCOES = config.opcoes ?? 5;

for (const [i, c] of config.cenas.entries()) {
  const audio = await narrar({texto: c.texto, indice: i, pastaAudio, config});
  const segundos = duracaoWav(path.join(pastaAudio, audio));
  const frames = Math.ceil((segundos + RESPIRO) * FPS);
  let tipo = c.tipo ?? config.midia_padrao ?? 'foto';

  let takes = [];
  if (c.imagem_local) {
    fs.copyFileSync(path.join(pasta, c.imagem_local), path.join(pastaMidia, path.basename(c.imagem_local)));
    tipo = /\.(mp4|webm|mov)$/i.test(c.imagem_local) ? 'video' : 'foto';
    takes = [{arquivo: path.basename(c.imagem_local), tipo, frames, inicio: Math.round((c.inicio_local ?? 0) * FPS)}];
  } else if (c.busca && c.escolha !== 0) {
    let opcoes = await opcoesDaBusca(c.busca, tipo, c.fontes);
    // Sem vídeo pra essa busca: cai pra foto, pra cena não ficar vazia.
    if (tipo === 'video' && !opcoes.length) {
      console.warn(`  ! cena ${i + 1}: nenhum vídeo pra "${c.busca}", usando foto`);
      tipo = 'foto';
      opcoes = await opcoesDaBusca(c.busca, tipo, c.fontes);
    }
    opcoesPorCena[i] = opcoes;
    // Miniaturas precisam existir antes do empacotamento, que copia a pasta de mídia.
    if (modoCandidatos) {
      // Vídeo: os quadros de cada momento (a, b, c). Foto: a própria miniatura. Tudo em paralelo.
      miniaturasPorCena[i] = await Promise.all(opcoes.map((o, n) =>
        Promise.all((o.tipo === 'video' && o.quadros ? o.quadros : [o.miniatura]).map(url =>
          baixar({url}, pastaMidia).catch(e => {
            console.warn(`  ! cena ${i + 1}, opção ${n + 1}: ${e.message}`);
            return null;
          })))));
    }

    // "escolha": 3 (opção 3, momento a), "3b" (opção 3, momento b) ou lista disso, um item por take.
    // Sem escolha: as primeiras opções ainda não usadas, quantas couberem em takes de até TAKE_MAX.
    const quantos = tipo === 'video' ? Math.max(1, Math.ceil(frames / FPS / TAKE_MAX)) : 1;
    const candidatos = c.escolha == null
      ? opcoes.filter(o => !usadas.has(o.url)).slice(0, quantos).map(o => ({...o, momento: 0}))
      : [].concat(c.escolha).map(e => {
          const [, n, letra] = String(e).match(/^(\d+)([abc]?)$/i) ?? [];
          const opcao = opcoes[Number(n) - 1];
          if (!opcao) console.warn(`  ! cena ${i + 1}: escolha ${e} não existe (há ${opcoes.length} opções)`);
          return opcao && {...opcao, momento: 'abc'.indexOf((letra || 'a').toLowerCase())};
        }).filter(Boolean);

    // Na rodada de cartelas ninguém escolheu ainda: não baixa nem corta mídia, só mostra as opções.
    if (modoCandidatos) candidatos.length = 0;
    const partes = repartir(frames, candidatos.length);
    for (const [k, candidato] of candidatos.entries()) {
      usadas.add(candidato.url);
      try {
        takes.push(await prepararTake(candidato, tipo, partes[k]));
        creditos.push(`- Cena ${i + 1}: ${candidato.credito}`);
      } catch (e) {
        console.warn(`  ! cena ${i + 1}: mídia da opção falhou (${e.message})`);
      }
    }
    // Se algum take falhou, os que sobraram dividem a cena.
    if (takes.length && takes.length < candidatos.length) {
      repartir(frames, takes.length).forEach((f, k) => { takes[k].frames = f; });
    }
  }

  const icone = modoCandidatos ? (opcoesPorCena[i]?.length ? `${opcoesPorCena[i].length} opções` : '✎ texto') : !takes.length ? '✎ texto' : tipo === 'video' ? `▶ ${takes.length} take${takes.length > 1 ? 's' : ''}` : '🖼 foto';
  console.log(`  ${String(i + 1).padStart(2)}. ${segundos.toFixed(1)}s  ${icone.padEnd(9)} ${c.texto.slice(0, 55)}…`);
  cenas.push({texto: c.texto, destaque: c.destaque ?? null, cta: c.cta ?? null, local: c.local ?? null, nivel: c.nivel ?? null, mapa: c.mapa ?? null, boneco: c.boneco ?? null, sfx: c.sfx ?? null, takes, audio, segundos, frames});
}

// Opções de mídia de uma busca, com cache pra numeração da cartela não mudar entre rodadas.
async function opcoesDaBusca(busca, tipo, fontesCena) {
  const chave = tipo === 'video' ? `video:${busca}` : busca;
  cacheBuscas[chave] ??= tipo === 'video'
    ? filtrarVideos(await buscarVideos(busca, fontesCena ?? fontesVideo, vertical), OPCOES)
    : filtrarValidos(await buscarCandidatos(busca, fontesCena ?? fontesFoto), OPCOES);
  return cacheBuscas[chave];
}

// Divide `frames` em `n` partes inteiras (a última leva a sobra).
function repartir(frames, n) {
  if (!n) return [];
  const base = Math.floor(frames / n);
  return Array.from({length: n}, (_, k) => (k === n - 1 ? frames - base * (n - 1) : base));
}

// Baixa a mídia de um take. Vídeo começa no momento escolhido na cartela (recuando se passaria do
// fim). Clipe longo da Archive ou da Wikimedia não é baixado inteiro: corta só o trecho.
async function prepararTake(candidato, tipo, framesTake) {
  if (tipo !== 'video') return {arquivo: await baixar(candidato, pastaMidia), tipo, frames: framesTake, inicio: 0};

  const segTake = framesTake / FPS;
  const desejado = candidato.quadrosSeg?.[candidato.momento] ?? candidato.duracao * MOMENTOS[candidato.momento];
  const inicioSeg = Math.max(0, Math.min(desejado, candidato.duracao - segTake - 0.3));

  // Pexels e Pixabay em 1080p são arquivos pequenos em CDN rápida: baixa inteiro, é mais confiável.
  if (candidato.duracao > 30 && ['archive', 'wikimedia'].includes(candidato.fonte)) {
    const chave = crypto.createHash('md5').update(`${candidato.url}|${inicioSeg}|${segTake}`).digest('hex').slice(0, 12);
    const arquivo = `corte-${chave}.mp4`;
    if (!fs.existsSync(path.join(pastaMidia, arquivo))) {
      console.log(`      ✂ ${segTake.toFixed(1)}s de ${candidato.fonte}, a partir de ${inicioSeg.toFixed(0)}s`);
      await cortarTrecho({url: candidato.url, inicioSeg, duracaoSeg: segTake + 0.5, destino: path.join(pastaMidia, arquivo)});
    }
    return {arquivo, tipo, frames: framesTake, inicio: 0};
  }
  return {arquivo: await baixar(candidato, pastaMidia), tipo, frames: framesTake, inicio: Math.round(inicioSeg * FPS)};
}

fs.writeFileSync(arquivoCache, JSON.stringify(cacheBuscas, null, 2));

let trilha = null;
if (config.trilha) {
  fs.copyFileSync(path.join(pasta, config.trilha), path.join(build, path.basename(config.trilha)));
  trilha = path.basename(config.trilha);
}
// Som curto tocado na entrada de cada cena (whoosh de transição), opcional.
let sfx = null;
if (config.sfx_transicao) {
  fs.copyFileSync(path.join(pasta, config.sfx_transicao), path.join(build, path.basename(config.sfx_transicao)));
  sfx = path.basename(config.sfx_transicao);
}

// Vertical (9:16) é pra Reels/Shorts/TikTok: legenda gravada na imagem, em blocos curtos.
const formato = config.formato === 'vertical' ? 'vertical' : 'horizontal';
const legendaNaTela = config.legenda_na_tela ?? formato === 'vertical';
const estilo = config.estilo ?? 'dossie';
const legendas = !legendaNaTela ? []
  : ['reels', 'viagem', 'alerta'].includes(estilo) ? blocosPalavras(cenas, config.palavras_por_bloco ?? 3)
  : blocosLegenda(cenas, formato === 'vertical' ? 20 : 42).map(b => ({texto: b.texto, de: Math.round(b.inicio * FPS), ate: Math.round(b.fim * FPS)}));

const props = {estilo, formato, idioma: config.idioma ?? 'pt', cenas, legendas, trilha, volumeTrilha: config.volume_trilha ?? 0.12,
  sfx, volumeSfx: config.volume_sfx ?? 0.35, cor: config.cor_destaque ?? null, niveis: config.niveis ?? null,
  marca: config.marca_dagua ?? null, variante: config.variante_stick ?? null};
// O estilo 3D desenha com WebGL: o Chrome do render precisa da placa de vídeo (ANGLE).
const chromiumOptions = estilo === 'palco3d' ? {gl: 'angle'} : {};
fs.writeFileSync(path.join(build, 'props.json'), JSON.stringify(props, null, 2));
fs.writeFileSync(path.join(pasta, 'video.srt'), gerarSrt(blocosLegenda(cenas, 42)));
fs.writeFileSync(path.join(pasta, 'creditos.md'), `# Créditos de imagem\n\n${[...new Set(creditos)].join("\n") || "- (nenhuma imagem externa)"}\n`);

const total = cenas.reduce((t, c) => t + c.frames, 0) / FPS;
console.log(`\n  duração total: ${Math.floor(total / 60)}min${String(Math.round(total % 60)).padStart(2, '0')}s`);

// 2. Montagem (Remotion)
console.log('  empacotando estilos…');
const serveUrl = await bundle({entryPoint: path.join(AQUI, 'src/index.ts'), publicDir: build});
// O bundle copia toda a pasta de mídia para o temporário do sistema (centenas de MB por vídeo)
// e o Remotion não apaga depois. Remove ao sair, com ou sem erro.
const limparBundle = () => { try { fs.rmSync(serveUrl, {recursive: true, force: true}); } catch {} };
process.on('exit', limparBundle);
const composition = await selectComposition({serveUrl, id: 'Video', inputProps: props, chromiumOptions});

if (modoCandidatos) {
  const pastaCartelas = path.join(build, 'cartelas');
  fs.mkdirSync(pastaCartelas, {recursive: true});
  for (const [i, opcoes] of opcoesPorCena.entries()) {
    if (!opcoes?.length) continue;
    const imagens = miniaturasPorCena[i];
    const rotulos = opcoes.map(o => o.tipo === 'video'
      ? `▶ ${o.duracao.toFixed(0)}s · ${o.largura}×${o.altura} · ${o.fonte}`
      : `${o.largura}×${o.altura} · ${o.fonte}`);
    const cartela = {titulo: `Cena ${i + 1} · "${config.cenas[i].busca}" · ${config.cenas[i].texto}`, imagens, rotulos};
    const comp = await selectComposition({serveUrl, id: 'Cartela', inputProps: cartela});
    // scale 2/3: cartela sai em 1280×720, legível pra escolher e bem mais leve pra revisar.
    await renderStill({composition: comp, serveUrl, inputProps: cartela, frame: 0, scale: 2 / 3,
      output: path.join(pastaCartelas, `cena-${String(i + 1).padStart(2, '0')}.png`)});
  }
  console.log(`\n✓ cartelas em ${pastaCartelas}\n  Grave a escolha de cada cena no cenas.json ("escolha": n) e rode de novo.`);
} else if (conferir) {
  const pastaConferir = path.join(build, 'conferir');
  fs.mkdirSync(pastaConferir, {recursive: true});
  let inicio = 0;
  for (const [i, c] of cenas.entries()) {
    // Um quadro por take (cena de vídeo com 2 clipes gera 2 PNGs: cena-01a, cena-01b).
    if (soCenas && !soCenas.has(i + 1)) { inicio += c.frames; continue; }
    const partes = c.takes.length > 1 ? c.takes : [{frames: c.frames}];
    let dentro = 0;
    for (const [k, t] of partes.entries()) {
      const sufixo = partes.length > 1 ? 'abcdefgh'[k] : '';
      const saida = path.join(pastaConferir, `cena-${String(i + 1).padStart(2, '0')}${sufixo}.png`);
      await renderStill({composition, serveUrl, inputProps: props, chromiumOptions, output: saida, frame: inicio + dentro + Math.min(t.frames - 1, 45), scale: 1 / 3});
      dentro += t.frames;
    }
    inicio += c.frames;
  }
  console.log(`\n✓ quadros em ${pastaConferir}`);
} else {
  const saida = path.join(pasta, 'video.mp4');
  let ultimo = -1;
  await renderMedia({
    composition, serveUrl, inputProps: props, chromiumOptions, codec: 'h264', crf: 23, outputLocation: saida,
    // Menos abas em paralelo deixa vídeo longo mais estável (o Chrome caía perto do fim). RENDER_ABAS=n para mudar.
    concurrency: Number(process.env.RENDER_ABAS) || 4, timeoutInMilliseconds: 120000,
    onProgress: ({progress}) => {
      const pct = Math.floor(progress * 100);
      if (pct % 10 === 0 && pct !== ultimo) { ultimo = pct; process.stdout.write(`  renderizando ${pct}%\r`); }
    },
  });
  console.log(`\n✓ ${saida}\n✓ ${path.join(pasta, 'video.srt')}`);
}

// Legenda: quebra o texto de cada cena em blocos curtos e distribui o tempo pelo tamanho de cada bloco.
// Devolve [{inicio, fim, texto}] em segundos.
function blocosLegenda(cenas, maxLetras) {
  const saida = [];
  let inicioCena = 0;
  for (const c of cenas) {
    const blocos = [];
    let atual = '';
    for (const palavra of c.texto.split(/\s+/)) {
      if ((atual + ' ' + palavra).trim().length > maxLetras && atual) {
        // Artigo/preposição no fim do bloco desce pro próximo ("caros da | história" → "caros | da história").
        const partes = atual.split(' ');
        const ultima = partes.at(-1);
        if (partes.length > 1 && ultima.length <= 3 && !/[.,!?;:]$/.test(ultima)) {
          blocos.push(partes.slice(0, -1).join(' '));
          atual = `${ultima} ${palavra}`;
        } else {
          blocos.push(atual);
          atual = palavra;
        }
      } else atual = (atual + ' ' + palavra).trim();
    }
    // Palavra solta no fim volta pro bloco anterior (evita legenda de meio segundo).
    // Se a junção estourar a linha, redivide os dois últimos blocos no ponto mais equilibrado.
    if (atual && atual.length < maxLetras / 3 && blocos.length) {
      const junto = `${blocos.at(-1)} ${atual}`;
      if (junto.length <= maxLetras + 3) blocos[blocos.length - 1] = junto;
      else {
        const palavras = junto.split(' ');
        let melhor = 1;
        for (let k = 1; k < palavras.length; k++) {
          const dif = k => Math.abs(palavras.slice(0, k).join(' ').length - palavras.slice(k).join(' ').length);
          if (dif(k) < dif(melhor)) melhor = k;
        }
        blocos[blocos.length - 1] = palavras.slice(0, melhor).join(' ');
        blocos.push(palavras.slice(melhor).join(' '));
      }
    } else if (atual) blocos.push(atual);
    const letras = blocos.reduce((t, b) => t + b.length, 0);
    let t = inicioCena;
    for (const b of blocos) {
      const d = c.segundos * (b.length / letras);
      saida.push({inicio: t, fim: t + d, texto: b});
      t += d;
    }
    inicioCena += c.frames / FPS;
  }
  return saida;
}

// Legenda do estilo Reels: blocos de poucas palavras, cada palavra com o próprio tempo (em frames,
// absoluto) pra acender no momento em que é falada. Usa o tempo por letra que a ElevenLabs devolve
// (build/audio/<cena>.json); sem ele, estima pelo tamanho da palavra.
function blocosPalavras(cenas, maxPalavras) {
  const saida = [];
  let inicioCena = 0;
  for (const c of cenas) {
    const palavras = palavrasDaCena(c);
    const blocos = [];
    let atual = [];
    for (const p of palavras) {
      const letras = [...atual, p].map(w => w.texto).join(' ').length;
      if (atual.length && (atual.length >= maxPalavras || letras > 18)) { blocos.push(atual); atual = []; }
      atual.push(p);
      if (/[.!?…:]$/.test(p.texto)) { blocos.push(atual); atual = []; }
    }
    if (atual.length) blocos.push(atual);
    const fimCena = inicioCena + c.frames / FPS;
    blocos.forEach((b, k) => {
      const de = inicioCena + b[0].inicio;
      const ate = k < blocos.length - 1 ? inicioCena + blocos[k + 1][0].inicio : Math.min(fimCena, inicioCena + b.at(-1).fim + 0.3);
      saida.push({
        texto: b.map(w => w.texto).join(' '),
        de: Math.round(de * FPS), ate: Math.round(ate * FPS),
        palavras: b.map(w => ({texto: w.texto, de: Math.round((inicioCena + w.inicio) * FPS), ate: Math.round((inicioCena + w.fim) * FPS)})),
      });
    });
    inicioCena = fimCena;
  }
  return saida;
}

function palavrasDaCena(c) {
  const arquivo = path.join(pastaAudio, c.audio.replace(/\.wav$/, '.json'));
  if (fs.existsSync(arquivo)) {
    const {characters, character_start_times_seconds: ini, character_end_times_seconds: fim} = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
    const palavras = [];
    let atual = null;
    characters.forEach((ch, k) => {
      if (/\s/.test(ch)) { if (atual) palavras.push(atual); atual = null; return; }
      atual ??= {texto: '', inicio: ini[k], fim: fim[k]};
      atual.texto += ch;
      atual.fim = fim[k];
    });
    if (atual) palavras.push(atual);
    return palavras;
  }
  const lista = c.texto.split(/\s+/).filter(Boolean);
  const total = lista.reduce((t, w) => t + w.length + 1, 0);
  let t = 0;
  return lista.map(w => {
    const d = c.segundos * (w.length + 1) / total;
    const p = {texto: w, inicio: t, fim: t + d};
    t += d;
    return p;
  });
}

function gerarSrt(blocos) {
  const tempo = s => {
    const ms = Math.round(s * 1000);
    const p = (n, d = 2) => String(n).padStart(d, '0');
    return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
  };
  return blocos.map((b, i) => `${i + 1}\n${tempo(b.inicio)} --> ${tempo(b.fim)}\n${b.texto}\n`).join('\n');
}
