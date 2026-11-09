import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {Takes} from './Takes';
import {loadFont as loadAnton} from '@remotion/google-fonts/Anton';
import {loadFont as loadPlayfair} from '@remotion/google-fonts/PlayfairDisplay';
import {loadFont as loadInter} from '@remotion/google-fonts/Inter';
import type {Cena} from '../tipos';

const {fontFamily: anton} = loadAnton('normal', {weights: ['400'], subsets: ['latin', 'latin-ext']});
const {fontFamily: playfair} = loadPlayfair('italic', {weights: ['600'], subsets: ['latin', 'latin-ext']});
const {fontFamily: inter} = loadInter('normal', {weights: ['700', '900'], subsets: ['latin', 'latin-ext']});

// Estilo "Alerta": Reels de gatilho/segredo. Preto e vermelho, mídia quase sem cor, coração batendo
// na vinheta, corte com glitch, título em tarja vermelha e a palavra do CTA escondida atrás de uma
// tarja preta que sai na hora. Mesma estrutura do Reels: cena sem mídia vira cartão, "cta" vira o final.
export const VERMELHO = '#e3122b';
const PRETO = '#0a0506';
const CREME = '#f6ece6';

// Batida dupla (tum-tum) a cada 1,1s: devolve 0 a 1.
const batida = (frame: number, fps: number) => {
  const t = (frame / fps) % 1.1;
  const pico = (c: number, a: number) => Math.exp(-((t - c) ** 2) / 0.0025) * a;
  return Math.min(1, pico(0.08, 1) + pico(0.3, 0.7));
};

// Linhas de TV e grão: textura fixa por cima de tudo pra parecer gravação "vazada".
const grao = (frame: number) =>
  `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><filter id='g'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' seed='${frame % 7}'/></filter><rect width='100%' height='100%' filter='url(%23g)' opacity='0.6'/></svg>")`;
const LINHAS = 'repeating-linear-gradient(to bottom, rgba(0,0,0,0.22) 0px, rgba(0,0,0,0.22) 2px, transparent 2px, transparent 5px)';

export const Alerta = ({cena, indice, marca}: {cena: Cena; indice: number; idioma?: string; semLegenda?: boolean; marca?: string | null}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const temMidia = cena.takes.length > 0;

  // Glitch de entrada (7 frames): a imagem treme na horizontal, faixas vermelhas cortam a tela.
  const glitch = indice === 0 ? 0 : interpolate(frame, [0, 7], [1, 0], {extrapolateRight: 'clamp'});
  const tremor = glitch * (frame % 2 === 0 ? 38 : -26);
  const entra = spring({frame, fps, config: {damping: 22, stiffness: 170}, durationInFrames: 10});
  const camera = {transform: `translateX(${tremor}px) scale(${1.14 - 0.14 * entra})`};
  const pulso = batida(frame, fps);

  return (
    <AbsoluteFill style={{backgroundColor: PRETO, overflow: 'hidden'}}>
      {temMidia ? (
        <AbsoluteFill style={camera}>
          <Takes takes={cena.takes} indice={indice}
            filtro={cena.cta ? 'grayscale(1) blur(24px) brightness(0.35)' : 'grayscale(0.7) contrast(1.25) brightness(0.8)'} />
          {/* Vermelho só nas sombras: une os clipes de banco num filme só. */}
          <AbsoluteFill style={{background: `linear-gradient(170deg, ${VERMELHO}55 0%, #3a040b88 60%, ${PRETO}aa 100%)`, mixBlendMode: 'multiply'}} />
          <AbsoluteFill style={{background: `${VERMELHO}22`, mixBlendMode: 'color'}} />
        </AbsoluteFill>
      ) : (
        <AbsoluteFill style={{...camera, background: `radial-gradient(circle at 50% 45%, #4a0610 0%, #1a0306 45%, ${PRETO} 80%)`}} />
      )}

      {/* Coração batendo: a vinheta vermelha aperta e solta. */}
      <AbsoluteFill style={{background: `radial-gradient(ellipse at center, transparent ${48 - pulso * 10}%, ${VERMELHO}${Math.round(40 + pulso * 70).toString(16)} 100%)`}} />
      <AbsoluteFill style={{background: 'linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 26%, transparent 55%, rgba(0,0,0,0.75) 100%)'}} />
      <AbsoluteFill style={{backgroundImage: LINHAS, opacity: 0.5}} />
      <AbsoluteFill style={{backgroundImage: grao(frame), opacity: 0.09, mixBlendMode: 'overlay'}} />

      {cena.cta ? <CartaoCta cta={cena.cta} />
        : indice === 0 ? <Aviso texto={cena.destaque} />
        : cena.destaque ? <Tarja texto={cena.destaque} central={!temMidia} /> : null}

      <Etiqueta marca={marca} />

      {glitch > 0 ? <FaixasGlitch forca={glitch} frame={frame} /> : null}
      <AbsoluteFill style={{backgroundColor: VERMELHO, opacity: glitch * 0.35, mixBlendMode: 'screen'}} />
    </AbsoluteFill>
  );
};

const FaixasGlitch = ({forca, frame}: {forca: number; frame: number}) => (
  <AbsoluteFill style={{pointerEvents: 'none'}}>
    {[0.18, 0.47, 0.71].map((y, k) => (
      <div key={k} style={{position: 'absolute', left: 0, right: 0, top: `${(y * 100 + frame * 7 * (k + 1)) % 100}%`,
        height: 18 + k * 22, background: k === 1 ? CREME : VERMELHO, opacity: forca * 0.8, mixBlendMode: 'difference'}} />
    ))}
  </AbsoluteFill>
);

// Ponto vermelho piscando + @ do perfil no topo, o vídeo inteiro (cara de gravação).
const Etiqueta = ({marca}: {marca?: string | null}) => {
  const frame = useCurrentFrame();
  const aceso = Math.floor(frame / 15) % 2 === 0;
  return (
    <div style={{position: 'absolute', top: 110, left: 70, display: 'flex', alignItems: 'center', gap: 16,
      fontFamily: inter, fontWeight: 700, fontSize: 30, letterSpacing: 4, color: CREME, opacity: 0.85}}>
      <div style={{width: 20, height: 20, borderRadius: 10, background: VERMELHO, opacity: aceso ? 1 : 0.2,
        boxShadow: aceso ? `0 0 18px ${VERMELHO}` : 'none'}} />
      {(marca ?? 'REC').toUpperCase()}
    </div>
  );
};

// Primeira cena: faixa de AVISO com triângulo, carimbada, e o título embaixo.
const Aviso = ({texto}: {texto?: string | null}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const carimbo = spring({frame: frame - 3, fps, config: {damping: 9, stiffness: 220}});
  const titulo = spring({frame: frame - 12, fps, config: {damping: 16}});
  const pisca = frame < 30 && Math.floor(frame / 4) % 2 === 1 ? 0.55 : 1;
  return (
    <div style={{position: 'absolute', top: 230, left: 60, right: 60, textAlign: 'center'}}>
      <div style={{display: 'inline-flex', alignItems: 'center', gap: 22, padding: '14px 40px', background: VERMELHO,
        transform: `rotate(-3deg) scale(${2 - carimbo})`, opacity: Math.min(1, carimbo) * pisca,
        boxShadow: `0 0 50px ${VERMELHO}aa`}}>
        <svg width="62" height="56" viewBox="0 0 62 56">
          <path d="M31 3 L59 53 L3 53 Z" fill="none" stroke={CREME} strokeWidth="6" strokeLinejoin="round" />
          <rect x="28" y="20" width="6" height="18" fill={CREME} /><rect x="28" y="42" width="6" height="6" fill={CREME} />
        </svg>
        <span style={{fontFamily: anton, fontSize: 92, color: CREME, letterSpacing: 8}}>AVISO</span>
      </div>
      {texto ? (
        <div style={{fontFamily: anton, fontSize: 104, lineHeight: 1.05, color: CREME, marginTop: 56, textTransform: 'uppercase',
          opacity: titulo, transform: `translateY(${(1 - titulo) * 50}px)`, textShadow: '0 8px 30px rgba(0,0,0,0.8)'}}>
          {texto}
        </div>
      ) : null}
    </div>
  );
};

// Título das cenas: letras grandes condensadas com uma tarja vermelha que corre por trás.
const Tarja = ({texto, central}: {texto: string; central: boolean}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const corre = spring({frame: frame - 3, fps, config: {damping: 20}, durationInFrames: 14});
  const letra = spring({frame: frame - 8, fps, config: {damping: 15}});
  return (
    <div style={{position: 'absolute', left: 60, right: 60, textAlign: 'center',
      ...(central ? {top: 0, bottom: 900, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end'} : {top: 250})}}>
      <div style={{display: 'inline-block', position: 'relative', padding: '6px 34px', transform: 'rotate(-2deg)', alignSelf: 'center'}}>
        <div style={{position: 'absolute', inset: 0, background: VERMELHO, transformOrigin: 'left center', transform: `scaleX(${corre})`}} />
        <div style={{position: 'relative', fontFamily: anton, fontSize: central ? 128 : 96, lineHeight: 1.08, color: CREME,
          textTransform: 'uppercase', opacity: letra, transform: `translateY(${(1 - letra) * 30}px)`}}>
          {texto}
        </div>
      </div>
    </div>
  );
};

// Final: "COMENTE" e a palavra presa atrás de uma tarja preta de documento censurado, que sai de lado.
const CartaoCta = ({cta}: {cta: NonNullable<Cena['cta']>}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const p1 = spring({frame: frame - 2, fps, config: {damping: 14}});
  const revela = spring({frame: frame - 16, fps, config: {damping: 18, stiffness: 120}});
  const p3 = spring({frame: frame - 30, fps, config: {damping: 16}});
  const seta = Math.sin(frame / 5) * 14;
  const pulso = 1 + batida(frame, fps) * 0.05;
  return (
    <div style={{position: 'absolute', top: 280, left: 60, right: 60, textAlign: 'center'}}>
      <div style={{fontFamily: inter, fontWeight: 900, color: CREME, fontSize: 54, letterSpacing: 14, opacity: p1,
        transform: `translateY(${(1 - p1) * 30}px)`}}>
        COMENTE
      </div>
      <div style={{position: 'relative', display: 'inline-block', marginTop: 40, padding: '10px 60px', background: CREME,
        transform: `rotate(-2deg) scale(${pulso})`, boxShadow: `0 0 70px ${VERMELHO}99`}}>
        <span style={{fontFamily: anton, fontSize: 190, lineHeight: 1.1, color: VERMELHO, letterSpacing: 10}}>{cta.palavra}</span>
        <div style={{position: 'absolute', inset: -4, background: PRETO, transformOrigin: 'right center', transform: `scaleX(${1 - revela})`}} />
      </div>
      <div style={{fontFamily: playfair, fontStyle: 'italic', fontWeight: 600, color: CREME, fontSize: 62, marginTop: 48, opacity: revela}}>
        {cta.depois ?? 'e receba no direct'}
      </div>
      <svg width="90" height="110" viewBox="0 0 90 110" style={{marginTop: 34, opacity: p3, transform: `translateY(${seta}px)`}}>
        <path d="M45 6 V92 M12 60 L45 96 L78 60" fill="none" stroke={VERMELHO} strokeWidth="14" strokeLinecap="square" />
      </svg>
      {cta.alternativa ? (
        <div style={{fontFamily: inter, fontWeight: 700, color: CREME, fontSize: 38, letterSpacing: 3, opacity: p3 * 0.85}}>
          {cta.alternativa}
        </div>
      ) : null}
    </div>
  );
};
