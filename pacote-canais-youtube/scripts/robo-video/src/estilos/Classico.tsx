import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {Takes} from './Takes';
import {loadFont} from '@remotion/google-fonts/Oswald';
import type {Cena} from '../tipos';
import {fadeEntrada} from './util';

const {fontFamily: oswald} = loadFont('normal', {weights: ['700'], subsets: ['latin', 'latin-ext']});
const DESTAQUE = '#f2c230';

export const Classico = ({cena, indice}: {cena: Cena; indice: number; idioma?: string; semLegenda?: boolean}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const vertical = height > width;
  const barra = spring({frame: frame - 6, fps, config: {damping: 18}});
  const temMidia = cena.takes.length > 0;

  return (
    <AbsoluteFill style={{opacity: fadeEntrada(frame, 10), backgroundColor: '#111'}}>
      {temMidia && !vertical ? <Takes takes={cena.takes} indice={indice} /> : null}

      {/* Vertical: a foto (quase sempre horizontal) vai inteira numa faixa, com ela mesma desfocada no fundo. */}
      {temMidia && vertical ? (
        <>
          <Takes takes={cena.takes} indice={indice} filtro="blur(40px) brightness(0.45)" semMovimento />
          <div style={{position: 'absolute', top: 380, left: 0, width: '100%', height: 780, overflow: 'hidden',
            boxShadow: '0 20px 60px rgba(0,0,0,0.6)'}}>
            <Takes takes={cena.takes} indice={indice} />
          </div>
        </>
      ) : null}

      {!vertical ? (
        <>
          <AbsoluteFill style={{background: 'radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,0.65) 100%)'}} />
          <AbsoluteFill style={{background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 38%)'}} />
        </>
      ) : null}

      {/* Cena sem mídia: cartão de texto. Fundo escuro com brilho lento, frase grande centralizada
          (o destaque, ou a própria narração quando não há destaque). */}
      {!temMidia ? <CartaoTexto texto={cena.destaque || cena.texto} titulo={!!cena.destaque} vertical={vertical} /> : null}

      {cena.destaque && temMidia ? (
        <div style={{position: 'absolute', display: 'flex', alignItems: 'stretch', gap: vertical ? 20 : 26,
          ...(vertical
            ? (temMidia ? {left: 70, right: 70, top: 230} : {left: 70, right: 70, top: 760})
            : {left: 110, bottom: 110}),
          transform: `translateX(${(1 - barra) * -80}px)`, opacity: barra}}>
          <div style={{width: vertical ? 10 : 12, background: DESTAQUE}} />
          <div style={{fontFamily: oswald, fontWeight: 700, color: '#fff', textTransform: 'uppercase', lineHeight: 1.05,
            fontSize: vertical ? (temMidia ? 72 : 110) : (temMidia ? 78 : 110),
            maxWidth: vertical ? 900 : 1400, textShadow: '0 4px 20px rgba(0,0,0,0.5)'}}>
            {cena.destaque}
          </div>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

const CartaoTexto = ({texto, titulo, vertical}: {texto: string; titulo: boolean; vertical: boolean}) => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const entrada = spring({frame: frame - 4, fps, config: {damping: 20}});
  const x = interpolate(frame, [0, durationInFrames], [30, 70]);
  const curto = texto.length < 40;
  const tamanho = titulo || curto ? (vertical ? 110 : 120) : (vertical ? 64 : 58);
  return (
    <AbsoluteFill style={{background: `radial-gradient(circle at ${x}% 40%, #2a2a2e 0%, #111 55%, #0a0a0a 100%)`,
      alignItems: 'center', justifyContent: 'center', padding: vertical ? 90 : 180}}>
      <div style={{width: 90, height: 8, background: DESTAQUE, marginBottom: 40, transform: `scaleX(${entrada})`}} />
      <div style={{fontFamily: oswald, fontWeight: 700, color: '#fff', textAlign: 'center', lineHeight: 1.15,
        fontSize: tamanho, textTransform: titulo || curto ? 'uppercase' : 'none', maxWidth: vertical ? 900 : 1500,
        opacity: entrada, transform: `translateY(${(1 - entrada) * 30}px)`}}>
        {texto}
      </div>
    </AbsoluteFill>
  );
};
