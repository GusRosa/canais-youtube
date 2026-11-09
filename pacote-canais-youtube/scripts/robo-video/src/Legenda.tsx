import {AbsoluteFill, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {loadFont} from '@remotion/google-fonts/Oswald';
import type {BlocoLegenda} from './tipos';

const {fontFamily: oswald} = loadFont('normal', {weights: ['700'], subsets: ['latin', 'latin-ext']});

// Legenda gravada na imagem (Reels/Shorts/TikTok). Um bloco por vez, com "pulo" na entrada.
// No vertical fica no terço inferior, acima da área coberta pelos botões e pela descrição do app.
export const Legenda = ({blocos, variante}: {blocos: BlocoLegenda[]; variante: string}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const bloco = blocos.find(b => frame >= b.de && frame < b.ate);
  if (!bloco) return null;

  const vertical = height > width;
  const pulo = spring({frame: frame - bloco.de, fps, config: {damping: 12, stiffness: 220}, durationInFrames: 8});
  const papel = variante === 'dossie';

  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'flex-start', pointerEvents: 'none'}}>
      <div style={{
        position: 'absolute', top: vertical ? 1250 : height - 190, left: vertical ? 70 : 160, right: vertical ? 70 : 160,
        textAlign: 'center', transform: `scale(${0.85 + pulo * 0.15})`,
      }}>
        <span style={{
          fontFamily: oswald, fontWeight: 700, fontSize: vertical ? 72 : 54, lineHeight: 1.4,
          textTransform: 'uppercase', letterSpacing: 1,
          color: papel ? '#f7f3ea' : '#fff',
          background: papel ? 'rgba(43,38,32,0.92)' : 'transparent',
          padding: papel ? '6px 22px' : 0,
          boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone',
          textShadow: papel ? 'none' : '0 0 3px #000, 0 4px 14px rgba(0,0,0,0.85), 0 0 2px #000',
        }}>
          {bloco.texto}
        </span>
      </div>
    </AbsoluteFill>
  );
};
