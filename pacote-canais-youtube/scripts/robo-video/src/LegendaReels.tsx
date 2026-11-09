import {AbsoluteFill, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {loadFont} from '@remotion/google-fonts/Inter';
import type {BlocoLegenda} from './tipos';

const {fontFamily: inter} = loadFont('normal', {weights: ['900'], subsets: ['latin', 'latin-ext']});
const OURO = '#eccd86';

// Legenda do estilo Reels: até 3 palavras por vez, a palavra falada acende em dourado e cresce.
// Fica no terço de baixo, acima da área que os botões e a descrição do Instagram cobrem.
// `caixa` (estilo Alerta): a palavra falada ganha um bloco na cor, com a letra branca.
export const LegendaReels = ({blocos, cor = OURO, caixa = false}: {blocos: BlocoLegenda[]; cor?: string; caixa?: boolean}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const bloco = blocos.find(b => frame >= b.de && frame < b.ate);
  if (!bloco) return null;
  const pulo = spring({frame: frame - bloco.de, fps, config: {damping: 12, stiffness: 240}, durationInFrames: 7});
  const palavras = bloco.palavras ?? [{texto: bloco.texto, de: bloco.de, ate: bloco.ate}];

  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div style={{position: 'absolute', top: 1170, left: 60, right: 60, display: 'flex', flexWrap: 'wrap',
        justifyContent: 'center', columnGap: 26, rowGap: 6, transform: `scale(${0.8 + pulo * 0.2})`, lineHeight: 1.18}}>
        {palavras.map((p, k) => {
          const falando = frame >= p.de && frame < Math.max(p.ate, p.de + 4);
          const dita = frame >= p.de;
          return (
            <span key={k} style={{
              display: 'inline-block', fontFamily: inter, fontWeight: 900, fontSize: 76,
              textTransform: 'uppercase', color: falando && !caixa ? cor : '#fff', opacity: dita ? 1 : 0.6,
              transform: `translateY(${falando ? -8 : 0}px) rotate(${falando && caixa ? -3 : 0}deg)`,
              ...(caixa ? {padding: '0 14px', background: falando ? cor : 'transparent'} : {}),
              WebkitTextStroke: '3px rgba(0,0,0,0.9)', paintOrder: 'stroke fill',
              textShadow: '0 6px 18px rgba(0,0,0,0.75)',
            }}>
              {p.texto}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
