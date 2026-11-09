import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {once} from 'node:events';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const UA = 'RoboVideo/0.1';
const PASTA_FFMPEG = path.resolve(path.dirname(fileURLToPath(import.meta.url)),
  `../node_modules/@remotion/compositor-${process.platform}-${process.arch}`);

// Baixa só um trecho de um vídeo remoto e salva como MP4 H.264 sem áudio.
// Servidor lento (Archive) às vezes derruba a conexão no meio: o FFmpeg termina "com sucesso" e grava
// um MP4 vazio. Por isso confere o arquivo e tenta de novo.
export async function cortarTrecho(opcoes, tentativas = 2) {
  for (let n = 1; ; n++) {
    let erro, avisos = '';
    try { avisos = await cortarUmaVez(opcoes); } catch (e) { erro = e; }
    const tamanho = fs.existsSync(opcoes.destino) ? fs.statSync(opcoes.destino).size : 0;
    if (!erro && tamanho > 10_000) return;
    fs.rmSync(opcoes.destino, {force: true});
    if (n >= tentativas) throw erro ?? new Error(`corte vazio depois de ${n} tentativas: ${avisos.trim().split('\n').at(-1) ?? ''}`);
  }
}

// Serve pra filme longo (Internet Archive, Wikimedia): pega 5s sem baixar 200 MB.
//
// O FFmpeg que vem com o Remotion falha ao reabrir conexão HTTPS (erro de TLS no salto pro trecho),
// então ele lê de um proxy local, e o proxy busca no servidor com o fetch do Node, repassando o Range.
// A Archive às vezes fica minutos sem responder a um pedido de trecho: desiste em 60s.
async function buscar(url, inicio, fim, signal) {
  const headers = {'User-Agent': UA, Range: `bytes=${inicio}-${fim ?? ''}`};
  const limite = new AbortController();
  const relogio = setTimeout(() => limite.abort(new Error('servidor não respondeu em 60s')), 60_000);
  try {
    return await fetch(url, {headers, signal: AbortSignal.any([signal, limite.signal])});
  } finally {
    clearTimeout(relogio);
  }
}

async function cortarUmaVez({url, inicioSeg, duracaoSeg, destino}) {
  const servidor = http.createServer(async (req, res) => {
    const controle = new AbortController();
    res.on('close', () => controle.abort());
    const log = msg => process.env.DEBUG_CORTE && console.error(`[proxy] ${msg}`);
    try {
      const [, ini, fim] = (req.headers.range ?? '').match(/bytes=(\d*)-(\d*)/) ?? [];
      const inicio = Number(ini || 0);
      let origem = await buscar(url, inicio, fim, controle.signal);
      const repassar = {};
      for (const k of ['content-type', 'content-length', 'content-range', 'accept-ranges']) {
        const v = origem.headers.get(k);
        if (v) repassar[k] = v;
      }
      log(`${req.method} ${req.headers.range ?? '-'} → ${origem.status} ${JSON.stringify(repassar)}`);
      res.writeHead(origem.status, repassar);
      if (req.method === 'HEAD' || !origem.body) return res.end();

      // A Archive derruba a conexão no meio: retoma de onde parou (até 8 vezes) em vez de entregar
      // um arquivo truncado, que o FFmpeg leria como "fim do vídeo".
      const [, rIni, rFim] = (repassar['content-range'] ?? '').match(/bytes (\d+)-(\d+)/) ?? [];
      const total = rFim ? Number(rFim) - Number(rIni) + 1 : Number(repassar['content-length'] ?? NaN);
      let enviados = 0;
      for (let retomadas = 0; ; retomadas++) {
        try {
          for await (const pedaco of origem.body) {
            enviados += pedaco.length;
            if (!res.write(pedaco)) await once(res, 'drain');
          }
          break;
        } catch (e) {
          if (controle.signal.aborted || retomadas >= 8 || !(enviados < total)) throw e;
          log(`caiu em ${enviados}/${total} (${e.cause?.code ?? e.message}), retomando`);
          origem = await buscar(url, inicio + enviados, fim, controle.signal);
        }
      }
      res.end();
    } catch (e) {
      if (!controle.signal.aborted) log(`falhou: ${e.message} ${e.cause?.code ?? ''}`);
      res.destroy();
    }
  });
  servidor.listen(0, '127.0.0.1');
  await once(servidor, 'listening');
  const local = `http://127.0.0.1:${servidor.address().port}/video`;

  try {
    return await new Promise((resolve, reject) => {
      const ffmpeg = spawn(path.join(PASTA_FFMPEG, 'ffmpeg'), [
        '-hide_banner', '-loglevel', 'warning', '-y',
        '-ss', String(inicioSeg), '-i', local, '-t', String(duracaoSeg),
        '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', destino,
      ], {env: {...process.env, DYLD_LIBRARY_PATH: PASTA_FFMPEG, LD_LIBRARY_PATH: PASTA_FFMPEG}});
      let erro = '';
      ffmpeg.stderr.on('data', d => { erro += d; });
      ffmpeg.on('error', reject);
      ffmpeg.on('close', codigo => codigo === 0 ? resolve(erro) : reject(new Error(`ffmpeg ${codigo}: ${erro.trim().slice(-300)}`)));
    });
  } finally {
    servidor.closeAllConnections();
    servidor.close();
  }
}
