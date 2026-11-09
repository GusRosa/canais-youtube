import {AbsoluteFill, Img, OffthreadVideo, Series, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {loadFont as loadAnton} from '@remotion/google-fonts/Anton';
import {loadFont as loadMontserrat} from '@remotion/google-fonts/Montserrat';
import type {Cena, Take} from '../tipos';
import {kenBurns} from './util';

const {fontFamily: anton} = loadAnton('normal', {weights: ['400'], subsets: ['latin', 'latin-ext']});
const {fontFamily: montserrat} = loadMontserrat('normal', {weights: ['800'], subsets: ['latin', 'latin-ext']});

// Paleta tropical: amarelo sol (padrão de "cor_destaque"), turquesa, coral e azul fundo do mar.
export const AMARELO = '#ffd23f';
const TURQUESA = '#19d3c5';
const CORAL = '#ff5a5f';
const MAR = '#053b47';

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

// Estilo de Reels de viagem: mídia em tela cheia com cor viva, transição diferente a cada corte
// (zoom-soco, chicote lateral, chicote vertical, giro), soco de zoom também entre os takes da cena,
// etiqueta de lugar com pino, título em adesivo amarelo (número conta de 0 até o valor) e cartão
// final de "salva e manda". Cena sem mídia vira cartão de texto palavra por palavra.
export const Viagem = ({cena, indice, cor}: {cena: Cena; indice: number; idioma?: string; semLegenda?: boolean; cor?: string | null}) => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames, width, height} = useVideoConfig();
  const destaque = cor ?? AMARELO;
  const temMidia = cena.takes.length > 0;

  const entra = spring({frame, fps, config: {damping: 18, stiffness: 190}, durationInFrames: 9});
  const sai = interpolate(frame, [durationInFrames - 4, durationInFrames], [0, 1], clamp);
  const tipo = indice === 0 ? 0 : indice % 4;
  const camera: React.CSSProperties =
    tipo === 0 ? {transform: `scale(${(1.35 - 0.35 * entra) * (1 + sai * 0.25)})`, filter: `blur(${(1 - entra) * 18 + sai * 12}px)`}
    : tipo === 1 ? {transform: `translateX(${(1 - entra) * width - sai * width * 0.35}px) skewX(${(1 - entra) * -8}deg)`, filter: `blur(${(1 - entra + sai) * 16}px)`}
    : tipo === 2 ? {transform: `translateY(${(1 - entra) * height * 0.6 - sai * height * 0.25}px) scale(${1.1 - 0.1 * entra})`, filter: `blur(${(1 - entra + sai) * 16}px)`}
    : {transform: `rotate(${(1 - entra) * -12 + sai * 6}deg) scale(${(1.4 - 0.4 * entra) * (1 + sai * 0.2)})`, filter: `blur(${(1 - entra) * 14 + sai * 10}px)`};
  const flash = indice === 0 ? 0 : interpolate(frame, [0, 6], [0.6, 0], clamp);

  return (
    <AbsoluteFill style={{backgroundColor: MAR, overflow: 'hidden'}}>
      {temMidia ? (
        <AbsoluteFill style={camera}>
          <TakesViagem takes={cena.takes} indice={indice}
            filtro={cena.cta ? 'blur(18px) brightness(0.5) saturate(1.3)' : 'saturate(1.3) contrast(1.1) brightness(1.03)'} />
        </AbsoluteFill>
      ) : (
        <FundoCartao frame={frame} camera={camera} cor={destaque} />
      )}

      {/* Degradês só em cima e embaixo, pra etiqueta, título e legenda lerem sem escurecer a paisagem. */}
      <AbsoluteFill style={{background: 'linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, transparent 26%, transparent 52%, rgba(0,0,0,0.6) 100%)'}} />

      {cena.local && !cena.cta ? <Local texto={cena.local} frame={frame} fps={fps} /> : null}
      {cena.cta ? <CartaoCta cta={cena.cta} frame={frame} fps={fps} cor={destaque} />
        : !temMidia ? <CartaoTexto texto={cena.destaque ?? cena.texto} frame={frame} fps={fps} cor={destaque} />
        : cena.destaque ? <Adesivo texto={cena.destaque} frame={frame} fps={fps} cor={destaque} comLocal={!!cena.local} /> : null}

      <AbsoluteFill style={{backgroundColor: '#fff', opacity: flash}} />
    </AbsoluteFill>
  );
};

// Takes da cena com soco de zoom e flash curto em cada troca de clipe (o corte cai no ritmo da fala).
const TakesViagem = ({takes, indice, filtro}: {takes: Take[]; indice: number; filtro: string}) => (
  <Series>
    {takes.map((t, k) => (
      <Series.Sequence key={k} durationInFrames={t.frames}>
        <UmTake take={t} semente={indice * 7 + k} filtro={filtro} soco={k > 0} />
      </Series.Sequence>
    ))}
  </Series>
);

const UmTake = ({take, semente, filtro, soco}: {take: Take; semente: number; filtro: string; soco: boolean}) => {
  const frame = useCurrentFrame();
  const src = staticFile(`midia/${take.arquivo}`);
  const golpe = soco ? interpolate(frame, [0, 6], [1.18, 1], {...clamp, easing: (t) => 1 - (1 - t) ** 3}) : 1;
  const base = take.tipo === 'video' ? `scale(${interpolate(frame, [0, take.frames], [1.04, 1.14])})` : kenBurns(frame, take.frames, semente);
  const estilo = {width: '100%', height: '100%', objectFit: 'cover' as const, transform: `scale(${golpe}) ${base}`, filter: filtro};
  const brilho = soco ? interpolate(frame, [0, 4], [0.3, 0], clamp) : 0;
  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      {take.tipo === 'video'
        ? <OffthreadVideo src={src} muted trimBefore={take.inicio} style={estilo} />
        : <Img src={src} style={estilo} />}
      <AbsoluteFill style={{backgroundColor: '#fff', opacity: brilho}} />
    </AbsoluteFill>
  );
};

// Etiqueta de lugar: pílula branca com pino coral que entra da esquerda e digita o nome.
const Local = ({texto, frame, fps}: {texto: string; frame: number; fps: number}) => {
  const p = spring({frame: frame - 3, fps, config: {damping: 14, stiffness: 170}});
  const letras = Math.round(interpolate(frame, [6, 6 + texto.length * 0.9], [0, texto.length], clamp));
  return (
    <div style={{position: 'absolute', top: 150, left: 0, right: 0, display: 'flex', justifyContent: 'center'}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 16, padding: '16px 34px 16px 22px', borderRadius: 60,
        background: 'rgba(255,255,255,0.95)', boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
        transform: `translateX(${(1 - p) * -700}px)`, opacity: p}}>
        <svg width="40" height="40" viewBox="0 0 24 24"><path fill={CORAL} d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z" /></svg>
        <span style={{fontFamily: montserrat, fontWeight: 800, fontSize: 34, letterSpacing: 3, color: MAR, whiteSpace: 'nowrap'}}>
          {texto.slice(0, letras)}
        </span>
      </div>
    </div>
  );
};

// Título em adesivo amarelo, levemente torto, que estoura na tela. Número no texto conta de 0 até o valor.
const Adesivo = ({texto, frame, fps, cor, comLocal}: {texto: string; frame: number; fps: number; cor: string; comLocal: boolean}) => {
  const p = spring({frame: frame - 6, fps, config: {damping: 9, stiffness: 200}});
  const conta = interpolate(frame, [6, 24], [0, 1], {...clamp, easing: (t) => 1 - (1 - t) ** 2});
  const exibido = texto.replace(/\d+/, n => String(Math.round(Number(n) * conta)));
  const balanço = Math.sin(frame / 9) * 1.2;
  return (
    <div style={{position: 'absolute', top: comLocal ? 270 : 230, left: 50, right: 50, display: 'flex', justifyContent: 'center'}}>
      <div style={{fontFamily: anton, fontSize: 112, lineHeight: 1.05, textTransform: 'uppercase', textAlign: 'center',
        color: MAR, background: cor, padding: '14px 36px 18px', borderRadius: 14,
        boxShadow: `10px 10px 0 ${MAR}`, transform: `rotate(${-3 + balanço}deg) scale(${p})`, maxWidth: 940}}>
        {exibido}
      </div>
    </div>
  );
};

// Fundo do cartão de texto: mar profundo com um sol amarelo e uma luz turquesa passeando.
const FundoCartao = ({frame, camera, cor}: {frame: number; camera: React.CSSProperties; cor: string}) => {
  const x = 50 + Math.sin(frame / 18) * 22;
  const y = 40 + Math.cos(frame / 24) * 12;
  return (
    <AbsoluteFill style={{...camera, background: `radial-gradient(circle at ${x}% ${y}%, ${TURQUESA} 0%, #0a7d8a 30%, ${MAR} 75%)`}}>
      <AbsoluteFill style={{background: `radial-gradient(circle at ${100 - x}% ${100 - y}%, ${cor}55 0%, transparent 35%)`}} />
    </AbsoluteFill>
  );
};

// Frase de virada: palavra por palavra, a última em amarelo.
const CartaoTexto = ({texto, frame, fps, cor}: {texto: string; frame: number; fps: number; cor: string}) => {
  const palavras = texto.split(' ');
  return (
    <div style={{position: 'absolute', top: 380, left: 70, right: 70, display: 'flex', flexWrap: 'wrap', justifyContent: 'center',
      columnGap: 28, rowGap: 4}}>
      {palavras.map((w, k) => {
        const p = spring({frame: frame - 3 - k * 4, fps, config: {damping: 10, stiffness: 220}});
        return (
          <span key={k} style={{fontFamily: anton, fontSize: 150, lineHeight: 1.08, textTransform: 'uppercase',
            color: k === palavras.length - 1 ? cor : '#fff', transform: `scale(${p}) translateY(${(1 - p) * 40}px)`,
            display: 'inline-block', textShadow: '0 8px 30px rgba(0,0,0,0.45)'}}>
            {w}
          </span>
        );
      })}
    </div>
  );
};

// Cartão final: marcador de "salvar" pulando, a palavra grande e o avião de papel de "enviar".
const CartaoCta = ({cta, frame, fps, cor}: {cta: NonNullable<Cena['cta']>; frame: number; fps: number; cor: string}) => {
  const p1 = spring({frame: frame - 2, fps, config: {damping: 8, stiffness: 180}});
  const p2 = spring({frame: frame - 10, fps, config: {damping: 12}});
  const p3 = spring({frame: frame - 18, fps, config: {damping: 12}});
  const pulo = Math.abs(Math.sin(frame / 7)) * -26;
  const voo = interpolate((frame - 18) % 36, [0, 36], [0, 1], clamp);
  return (
    <div style={{position: 'absolute', top: 260, left: 60, right: 60, textAlign: 'center'}}>
      <svg width="170" height="170" viewBox="0 0 24 24" style={{transform: `translateY(${pulo}px) scale(${p1})`}}>
        <path fill={cor} stroke={MAR} strokeWidth="0.8" d="M6 2h12a1 1 0 0 1 1 1v19l-7-4.5L5 22V3a1 1 0 0 1 1-1z" />
      </svg>
      <div style={{fontFamily: anton, fontSize: 230, lineHeight: 1, color: cor, marginTop: 10, transform: `scale(${p1})`,
        textShadow: `8px 8px 0 ${MAR}`}}>
        {cta.palavra}
      </div>
      <div style={{fontFamily: montserrat, fontWeight: 800, fontSize: 60, color: '#fff', marginTop: 26, lineHeight: 1.2, maxWidth: 640, marginLeft: 'auto', marginRight: 'auto',
        opacity: p2, transform: `translateY(${(1 - p2) * 30}px)`, textShadow: '0 4px 20px rgba(0,0,0,0.6)'}}>
        {cta.depois ?? 'e manda pra quem vai com você'}
      </div>
      <svg width="110" height="110" viewBox="0 0 24 24" style={{marginTop: 34, opacity: p3,
        transform: `translate(${voo * 60}px, ${voo * -40}px) rotate(-20deg)`}}>
        <path fill={TURQUESA} d="M2 21l21-9L2 3v7l15 2-15 2z" />
      </svg>
    </div>
  );
};

// Barra fina no topo enchendo ao longo do vídeo: mostra que falta pouco e segura até o fim.
export const BarraProgresso = ({cor}: {cor: string}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div style={{position: 'absolute', top: 0, left: 0, height: 12, width: `${(frame / durationInFrames) * 100}%`,
        background: `linear-gradient(90deg, ${TURQUESA}, ${cor})`, boxShadow: '0 0 16px rgba(255,210,63,0.7)'}} />
    </AbsoluteFill>
  );
};
