import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {Takes} from './Takes';
import {loadFont as loadPlayfair} from '@remotion/google-fonts/PlayfairDisplay';
import {loadFont as loadInter} from '@remotion/google-fonts/Inter';
import type {Cena} from '../tipos';

const {fontFamily: playfair} = loadPlayfair('italic', {weights: ['500', '600'], subsets: ['latin', 'latin-ext']});
const {fontFamily: inter} = loadInter('normal', {weights: ['500', '700'], subsets: ['latin', 'latin-ext']});

// Estilo vinho, dourado e rosé. Troque a ASSINATURA abaixo pelo nome do seu canal.
const VINHO = '#2a0d18';
const VINHO_ESCURO = '#140a10';
const OURO = '#c9a15a';
const OURO_CLARO = '#eccd86';
const ROSE = '#e0a9a4';
const CREME = '#fbf2ee';
const ASSINATURA = 'Seu Canal';

// Fusão lenta: cada cena nasce do vinho escuro e se apaga nele, então os cortes viram um respiro.
const FUSAO = 14;

// Grão de filme em SVG (ruído fractal), deslocado a cada frame pra não parecer textura parada.
const grao = (frame: number) =>
  `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><filter id='g'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' seed='${frame % 9}'/></filter><rect width='100%' height='100%' filter='url(%23g)' opacity='0.55'/></svg>")`;

export const Desejo = ({cena, indice}: {cena: Cena; indice: number; idioma?: string; semLegenda?: boolean}) => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames, width, height} = useVideoConfig();
  const vertical = height > width;
  const temMidia = cena.takes.length > 0;
  const entra = interpolate(frame, [0, FUSAO], [0, 1], {extrapolateRight: 'clamp'});
  const sai = interpolate(frame, [durationInFrames - FUSAO / 2, durationInFrames], [1, 0.25], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  return (
    <AbsoluteFill style={{backgroundColor: VINHO_ESCURO, overflow: 'hidden'}}>
      <AbsoluteFill style={{opacity: entra * sai}}>
        {cena.cta ? <CartaoProduto cta={cena.cta} vertical={vertical} />
          : temMidia ? (
            <>
              {/* Tom quente e suave em todos os clipes de banco: leve rosado, menos saturação, contraste macio. */}
              <Takes takes={cena.takes} indice={indice} filtro="saturate(0.88) contrast(1.04) brightness(0.86) sepia(0.18)" />
              <AbsoluteFill style={{background: `linear-gradient(160deg, ${ROSE}33 0%, transparent 50%, ${VINHO}88 100%)`, mixBlendMode: 'soft-light'}} />
              <AbsoluteFill style={{background: `radial-gradient(ellipse at center, transparent 42%, ${VINHO_ESCURO}cc 100%)`}} />
              {cena.destaque ? <AbsoluteFill style={{background: `linear-gradient(to top, ${VINHO_ESCURO}e6 0%, transparent 42%)`}} /> : null}
            </>
          ) : <CartaoTexto texto={cena.destaque || cena.texto} titulo={!!cena.destaque} vertical={vertical} />}

        {cena.destaque && temMidia && !cena.cta ? <Destaque texto={cena.destaque} vertical={vertical} /> : null}
        <AbsoluteFill style={{backgroundImage: grao(frame), opacity: 0.07, mixBlendMode: 'overlay'}} />
      </AbsoluteFill>

      {indice === 0 ? <Assinatura vertical={vertical} /> : null}
    </AbsoluteFill>
  );
};

// Título sobre a imagem: Playfair itálico creme, com um filete dourado que cresce antes.
const Destaque = ({texto, vertical}: {texto: string; vertical: boolean}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const linha = spring({frame: frame - 6, fps, config: {damping: 22}});
  const p = spring({frame: frame - 10, fps, config: {damping: 20}});
  return (
    <div style={{position: 'absolute', ...(vertical ? {left: 70, right: 70, top: 230} : {left: 120, bottom: 110}), maxWidth: vertical ? 940 : 1300}}>
      <div style={{width: 110, height: 3, background: OURO, marginBottom: 26, transform: `scaleX(${linha})`, transformOrigin: 'left'}} />
      <div style={{fontFamily: playfair, fontStyle: 'italic', fontWeight: 600, color: CREME, lineHeight: 1.08,
        fontSize: vertical ? 76 : 84, textShadow: '0 4px 30px rgba(0,0,0,0.55)',
        opacity: p, transform: `translateY(${(1 - p) * 24}px)`}}>
        {texto}
      </div>
    </div>
  );
};

// Cena sem mídia: vinho com um brilho dourado que passeia devagar, frase grande centralizada.
const CartaoTexto = ({texto, titulo, vertical}: {texto: string; titulo: boolean; vertical: boolean}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const entrada = spring({frame: frame - 6, fps, config: {damping: 22}});
  const x = 50 + Math.sin(frame / 50) * 16;
  const y = 44 + Math.cos(frame / 70) * 8;
  const curto = texto.length < 48;
  const tamanho = titulo || curto ? (vertical ? 104 : 112) : (vertical ? 60 : 56);
  // "Fase 2 · A curiosidade": com um único " · ", a parte antes vira um rótulo pequeno em caixa alta.
  const partes = texto.split(' · ');
  const [rotulo, frase] = partes.length === 2 && texto.length < 60 ? partes : [null, texto];
  return (
    <AbsoluteFill style={{background: `radial-gradient(circle at ${x}% ${y}%, #5a2236 0%, ${VINHO} 38%, ${VINHO_ESCURO} 80%)`,
      alignItems: 'center', justifyContent: 'center', padding: vertical ? 90 : 200}}>
      <AbsoluteFill style={{background: `radial-gradient(circle at ${100 - x}% ${100 - y}%, ${OURO}1f 0%, transparent 42%)`}} />
      {rotulo ? (
        <div style={{fontFamily: inter, fontWeight: 700, fontSize: vertical ? 30 : 30, letterSpacing: '0.32em', textTransform: 'uppercase',
          color: OURO_CLARO, marginBottom: 28, opacity: entrada}}>{rotulo}</div>
      ) : null}
      <div style={{width: 110, height: 3, background: OURO, marginBottom: 40, transform: `scaleX(${entrada})`}} />
      <div style={{fontFamily: playfair, fontStyle: 'italic', fontWeight: titulo || curto ? 600 : 500, color: CREME, textAlign: 'center',
        lineHeight: 1.15, fontSize: tamanho, maxWidth: vertical ? 920 : 1450,
        opacity: entrada, transform: `translateY(${(1 - entrada) * 26}px)`}}>
        {frase}
      </div>
    </AbsoluteFill>
  );
};

// Cartão final do produto: nome em Playfair, linha de apoio (preço, onde está o link) em Inter.
const CartaoProduto = ({cta, vertical}: {cta: NonNullable<Cena['cta']>; vertical: boolean}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const p = spring({frame: frame - 6, fps, config: {damping: 20}});
  const q = spring({frame: frame - 20, fps, config: {damping: 20}});
  const brilho = 50 + Math.sin(frame / 40) * 20;
  return (
    <AbsoluteFill style={{background: `radial-gradient(circle at ${brilho}% 40%, #5a2236 0%, ${VINHO} 40%, ${VINHO_ESCURO} 85%)`,
      alignItems: 'center', justifyContent: 'center', padding: vertical ? 90 : 160}}>
      <div style={{position: 'absolute', inset: vertical ? 40 : 46, border: `1px solid ${OURO_CLARO}55`}} />
      <div style={{fontFamily: inter, fontWeight: 700, fontSize: 28, letterSpacing: '0.34em', textTransform: 'uppercase', color: OURO_CLARO, marginBottom: 34, opacity: p}}>
        {ASSINATURA}
      </div>
      <div style={{fontFamily: playfair, fontStyle: 'italic', fontWeight: 600, color: CREME, textAlign: 'center', lineHeight: 1.05,
        fontSize: vertical ? 104 : 124, maxWidth: vertical ? 920 : 1500, opacity: p, transform: `translateY(${(1 - p) * 26}px)`}}>
        {cta.palavra}
      </div>
      <div style={{width: 130, height: 3, background: OURO, margin: '44px 0 36px', transform: `scaleX(${q})`}} />
      {cta.depois ? (
        <div style={{fontFamily: inter, fontWeight: 700, fontSize: vertical ? 44 : 46, letterSpacing: '0.06em', color: '#1a0a12',
          background: OURO, padding: '18px 48px', opacity: q}}>
          {cta.depois}
        </div>
      ) : null}
      {cta.alternativa ? (
        <div style={{fontFamily: inter, fontWeight: 500, fontSize: 32, color: ROSE, marginTop: 30, opacity: q}}>{cta.alternativa}</div>
      ) : null}
    </AbsoluteFill>
  );
};

// Assinatura na abertura: aparece no canto e some sozinha nos primeiros segundos.
const Assinatura = ({vertical}: {vertical: boolean}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const op = interpolate(frame, [fps * 0.6, fps * 1.4, fps * 5, fps * 6], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <div style={{position: 'absolute', ...(vertical ? {top: 120, left: 0, right: 0, textAlign: 'center'} : {top: 70, left: 120}),
      fontFamily: inter, fontWeight: 700, fontSize: 26, letterSpacing: '0.36em', textTransform: 'uppercase', color: CREME, opacity: op,
      textShadow: '0 2px 16px rgba(0,0,0,0.6)'}}>
      {ASSINATURA}
    </div>
  );
};
