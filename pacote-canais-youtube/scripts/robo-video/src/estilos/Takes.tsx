import {AbsoluteFill, Img, OffthreadVideo, Series, interpolate, staticFile, useCurrentFrame} from 'remotion';
import type {Take} from '../tipos';
import {kenBurns} from './util';

// Toca os takes da cena em sequência, preenchendo o container (que precisa ter position relative/absolute).
// `filtro` permite o estilo tingir a mídia (ex.: sépia no Dossiê) ou desfocar (fundo do vertical).
// inteira: a foto aparece toda (contain), sem cortar rosto de retrato vertical.
export const Takes = ({takes, indice, filtro, semMovimento, inteira}: {takes: Take[]; indice: number; filtro?: string; semMovimento?: boolean; inteira?: boolean}) => (
  <Series>
    {takes.map((t, k) => (
      <Series.Sequence key={k} durationInFrames={t.frames}>
        <UmTake take={t} semente={indice * 7 + k} filtro={filtro} semMovimento={semMovimento} inteira={inteira} />
      </Series.Sequence>
    ))}
  </Series>
);

const UmTake = ({take, semente, filtro, semMovimento, inteira}: {take: Take; semente: number; filtro?: string; semMovimento?: boolean; inteira?: boolean}) => {
  const frame = useCurrentFrame();
  const src = staticFile(`midia/${take.arquivo}`);
  // Vídeo já tem movimento: só um zoom bem leve. Foto: Ken Burns completo.
  const transform = semMovimento ? 'scale(1.2)'
    : take.tipo === 'video' ? `scale(${interpolate(frame, [0, take.frames], [1.02, 1.08])})`
    : kenBurns(frame, take.frames, semente);
  const estilo = {width: '100%', height: '100%', objectFit: (inteira ? 'contain' : 'cover') as 'contain' | 'cover', transform, filter: filtro};
  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      {take.tipo === 'video'
        ? <OffthreadVideo src={src} muted trimBefore={take.inicio} style={estilo} />
        : <Img src={src} style={estilo} />}
    </AbsoluteFill>
  );
};
