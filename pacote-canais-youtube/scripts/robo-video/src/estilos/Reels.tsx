import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {Takes} from './Takes';
import {loadFont as loadPlayfair} from '@remotion/google-fonts/PlayfairDisplay';
import {loadFont as loadInter} from '@remotion/google-fonts/Inter';
import type {Cena} from '../tipos';

const {fontFamily: playfair} = loadPlayfair('italic', {weights: ['600'], subsets: ['latin', 'latin-ext']});
const {fontFamily: inter} = loadInter('normal', {weights: ['600', '900'], subsets: ['latin', 'latin-ext']});

// Paleta: vinho, dourado, creme rosado.
const VINHO = '#4a1526';
const VINHO_ESCURO = '#2a0d18';
const OURO = '#eccd86';
const CREME = '#f4e9e5';

// Estilo de Reels de venda: vídeo em tela cheia com tratamento de cor quente, transição em cada
// corte (zoom com desfoque e flash, alternando o sentido) e título em serifa itálica no topo.
// Cena sem mídia vira cartão de texto; cena com "cta" vira o cartão final de chamada.
export const Reels = ({cena, indice}: {cena: Cena; indice: number; idioma?: string; semLegenda?: boolean}) => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const temMidia = cena.takes.length > 0;

  // Entrada: 9 frames. Alterna entre zoom de dentro pra fora, de fora pra dentro e subida rápida.
  const entra = spring({frame, fps, config: {damping: 20, stiffness: 160}, durationInFrames: 10});
  const tipo = indice % 3;
  const escalaEntrada = tipo === 0 ? 1.28 - 0.28 * entra : tipo === 1 ? 0.86 + 0.14 * entra : 1.1 - 0.1 * entra;
  const subida = tipo === 2 ? (1 - entra) * 260 : 0;
  const desfoqueEntrada = (1 - entra) * 22;
  // Saída: nos últimos 5 frames a imagem acelera o zoom e desfoca, emendando no próximo corte.
  const sai = interpolate(frame, [durationInFrames - 5, durationInFrames], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const flash = indice === 0 ? 0 : interpolate(frame, [0, 7], [0.55, 0], {extrapolateRight: 'clamp'});

  const camera = {
    transform: `translateY(${subida}px) scale(${escalaEntrada * (1 + sai * 0.12)})`,
    filter: `blur(${desfoqueEntrada + sai * 14}px)`,
  };

  return (
    <AbsoluteFill style={{backgroundColor: VINHO_ESCURO, overflow: 'hidden'}}>
      {temMidia ? (
        <AbsoluteFill style={camera}>
          <Takes takes={cena.takes} indice={indice}
            filtro={cena.cta ? 'blur(26px) brightness(0.45) saturate(1.2)' : 'saturate(1.12) contrast(1.08) brightness(0.8) sepia(0.12)'} />
          {/* Tinta vinho por cima pra todos os clipes de banco parecerem do mesmo filme. */}
          <AbsoluteFill style={{background: `linear-gradient(160deg, ${VINHO}55 0%, transparent 45%, ${VINHO_ESCURO}66 100%)`, mixBlendMode: 'multiply'}} />
        </AbsoluteFill>
      ) : (
        <FundoCartao frame={frame} camera={camera} />
      )}

      {/* Vinheta e degradês pra leitura do título (topo) e da legenda (baixo). */}
      <AbsoluteFill style={{background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.55) 100%)'}} />
      <AbsoluteFill style={{background: 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, transparent 28%, transparent 55%, rgba(0,0,0,0.7) 100%)'}} />

      {cena.cta ? <CartaoCta cta={cena.cta} frame={frame} fps={fps} />
        : cena.destaque ? <Destaque texto={cena.destaque} central={!temMidia} frame={frame} fps={fps} /> : null}

      <AbsoluteFill style={{backgroundColor: CREME, opacity: flash}} />
    </AbsoluteFill>
  );
};

// Fundo do cartão de texto: vinho com um brilho dourado que se move devagar.
const FundoCartao = ({frame, camera}: {frame: number; camera: React.CSSProperties}) => {
  const x = 50 + Math.sin(frame / 40) * 18;
  const y = 42 + Math.cos(frame / 55) * 10;
  return (
    <AbsoluteFill style={{...camera, background: `radial-gradient(circle at ${x}% ${y}%, #7a3348 0%, ${VINHO} 35%, ${VINHO_ESCURO} 75%)`}}>
      <AbsoluteFill style={{background: `radial-gradient(circle at ${100 - x}% ${100 - y}%, ${OURO}22 0%, transparent 40%)`}} />
    </AbsoluteFill>
  );
};

const Destaque = ({texto, central, frame, fps}: {texto: string; central: boolean; frame: number; fps: number}) => {
  const p = spring({frame: frame - 5, fps, config: {damping: 16}});
  const linha = spring({frame: frame - 2, fps, config: {damping: 22}});
  return (
    <div style={{position: 'absolute', left: 80, right: 80, textAlign: 'center',
      ...(central ? {top: 0, bottom: 900, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end'} : {top: 250})}}>
      <div style={{width: 140 * linha, height: 4, background: OURO, margin: '0 auto 34px'}} />
      <div style={{fontFamily: playfair, fontStyle: 'italic', fontWeight: 600, color: CREME,
        fontSize: central ? 104 : 86, lineHeight: 1.12, opacity: p,
        transform: `translateY(${(1 - p) * 40}px)`, textShadow: '0 6px 30px rgba(0,0,0,0.6)'}}>
        {texto}
      </div>
    </div>
  );
};

const CartaoCta = ({cta, frame, fps}: {cta: NonNullable<Cena['cta']>; frame: number; fps: number}) => {
  const p1 = spring({frame: frame - 4, fps, config: {damping: 14}});
  const p2 = spring({frame: frame - 12, fps, config: {damping: 10, stiffness: 180}});
  const p3 = spring({frame: frame - 24, fps, config: {damping: 16}});
  const pulso = 1 + Math.max(0, Math.sin((frame - 20) / 6)) * 0.05 * (frame > 20 ? 1 : 0);
  return (
    <div style={{position: 'absolute', top: 300, left: 70, right: 70, textAlign: 'center', fontFamily: inter}}>
      <div style={{color: CREME, fontWeight: 600, fontSize: 52, letterSpacing: 10, opacity: p1,
        transform: `translateY(${(1 - p1) * 30}px)`}}>
        COMENTE
      </div>
      <div style={{display: 'inline-block', marginTop: 34, padding: '18px 64px', borderRadius: 26,
        background: `linear-gradient(135deg, ${OURO}, #c9a15a)`, color: VINHO_ESCURO, fontWeight: 900, fontSize: 150,
        letterSpacing: 4, transform: `scale(${p2 * pulso})`, boxShadow: '0 20px 60px rgba(201,161,90,0.45)'}}>
        {cta.palavra}
      </div>
      <div style={{fontFamily: playfair, fontStyle: 'italic', fontWeight: 600, color: CREME, fontSize: 64, marginTop: 44,
        opacity: p2}}>
        {cta.depois ?? 'e receba no direct'}
      </div>
      <div style={{color: OURO, fontWeight: 600, fontSize: 44, letterSpacing: 3, marginTop: 70, opacity: p3,
        transform: `translateY(${(1 - p3) * 30}px)`}}>
        {cta.alternativa ?? 'OU TOQUE NO LINK DA BIO'}
      </div>
    </div>
  );
};
