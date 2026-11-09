import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {pcmParaWav} from './wav.mjs';

// Escolhe o fornecedor de voz pelo que existe no .env.
// ElevenLabs > OpenAI > voz do macOS (grátis, qualidade de teste).
export function fornecedorVoz(config) {
  if (config.fornecedor_voz) return config.fornecedor_voz;
  if (process.env.ELEVENLABS_API_KEY) return 'elevenlabs';
  if (process.env.OPENAI_API_KEY) return 'openai';
  return 'mac';
}

// Gera o WAV de uma cena. Usa cache pelo hash de (fornecedor, voz, texto).
export async function narrar({texto, indice, pastaAudio, config}) {
  const fornecedor = fornecedorVoz(config);
  const voz = config.voz?.[fornecedor] ?? VOZ_PADRAO[fornecedor];
  // "ajustes_voz" (ElevenLabs): stability, similarity_boost, style. Só entra no hash se existir,
  // pra não invalidar o cache dos vídeos antigos.
  // "velocidade" no cenas.json: 1 = normal, 1.1 = 10% mais rápido (ElevenLabs aceita de 0.7 a 1.2).
  const velocidade = config.velocidade ?? 1;
  // "continuidade" (ElevenLabs): manda o texto das cenas vizinhas, pra frase cortada em várias cenas
  // (estilo Whisper, um pedaço por imagem) manter a entonação de frase inteira.
  const vizinhos = config.continuidade && fornecedor === 'elevenlabs'
    ? {previous_text: config.cenas[indice - 1]?.texto, next_text: config.cenas[indice + 1]?.texto} : null;
  const hash = crypto.createHash('md5').update(`${fornecedor}|${voz}|${velocidade}|${config.ajustes_voz ? JSON.stringify(config.ajustes_voz) + '|' : ''}${vizinhos ? JSON.stringify(vizinhos) + '|' : ''}${texto}`).digest('hex').slice(0, 8);
  const nome = `cena-${String(indice + 1).padStart(2, '0')}-${hash}.wav`;
  const destino = path.join(pastaAudio, nome);
  if (fs.existsSync(destino)) return nome;
  // Mesmo texto e voz já narrados com outro número de cena (cena inserida ou removida antes): reaproveita.
  const mesmoHash = fs.readdirSync(pastaAudio).find(f => f.endsWith(`-${hash}.wav`));
  if (mesmoHash) { fs.copyFileSync(path.join(pastaAudio, mesmoHash), destino); return nome; }

  if (fornecedor === 'mac') {
    const txt = destino.replace(/\.wav$/, '.txt');
    fs.writeFileSync(txt, texto);
    execFileSync('say', ['-v', voz, '-r', String(Math.round((config.velocidade_mac ?? 180) * velocidade)), '-f', txt, '-o', destino, '--data-format=LEI16@24000']);
    fs.unlinkSync(txt);
  } else if (fornecedor === 'openai') {
    const res = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json'},
      body: JSON.stringify({model: 'gpt-4o-mini-tts', voice: voz, input: texto, response_format: 'wav',
        speed: velocidade,
        instructions: config.instrucao_voz ?? 'Narrador de documentário, tom sério e envolvente, ritmo firme.'}),
    });
    if (!res.ok) throw new Error(`OpenAI TTS ${res.status}: ${await res.text()}`);
    fs.writeFileSync(destino, Buffer.from(await res.arrayBuffer()));
  } else if (fornecedor === 'elevenlabs') {
    // Endpoint com timestamps: além do áudio, devolve o tempo de cada letra. Fica em <nome>.json
    // e vira a legenda palavra por palavra do estilo Reels.
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voz}/with-timestamps?output_format=pcm_24000`, {
      method: 'POST',
      headers: {'xi-api-key': process.env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json'},
      body: JSON.stringify({text: texto, model_id: 'eleven_multilingual_v2', ...vizinhos,
        ...(config.ajustes_voz || velocidade !== 1 ? {voice_settings: {...config.ajustes_voz,
          ...(velocidade !== 1 ? {speed: Math.min(1.2, Math.max(0.7, velocidade))} : {})}} : {})}),
    });
    if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${await res.text()}`);
    const {audio_base64, alignment} = await res.json();
    fs.writeFileSync(destino, pcmParaWav(Buffer.from(audio_base64, 'base64'), 24000));
    if (alignment) fs.writeFileSync(destino.replace(/\.wav$/, '.json'), JSON.stringify(alignment));
  } else {
    throw new Error(`Fornecedor de voz desconhecido: ${fornecedor}`);
  }
  return nome;
}

const VOZ_PADRAO = {
  mac: 'Luciana',
  openai: 'onyx',
  elevenlabs: 'QAmlwgbPtjxpk7u98Qs9', // Adam - Compelling (biblioteca ElevenLabs), voz padrão
};
