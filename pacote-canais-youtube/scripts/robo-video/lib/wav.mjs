import fs from 'node:fs';

// Duração em segundos de um WAV PCM, lendo os chunks do cabeçalho.
export function duracaoWav(arquivo) {
  const buf = fs.readFileSync(arquivo);
  let byteRate = 0;
  let pos = 12;
  while (pos + 8 <= buf.length) {
    const id = buf.toString('ascii', pos, pos + 4);
    const tamanho = buf.readUInt32LE(pos + 4);
    if (id === 'fmt ') byteRate = buf.readUInt32LE(pos + 16);
    if (id === 'data') return tamanho / byteRate;
    pos += 8 + tamanho + (tamanho % 2);
  }
  throw new Error(`WAV sem chunk de dados: ${arquivo}`);
}

// Embrulha PCM 16 bits mono num WAV (usado pela ElevenLabs, que devolve PCM cru).
export function pcmParaWav(pcm, sampleRate) {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}
