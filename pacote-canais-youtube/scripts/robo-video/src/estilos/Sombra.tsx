import {AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {Takes} from './Takes';
import {loadFont as loadAnton} from '@remotion/google-fonts/Anton';
import {loadFont as loadInter} from '@remotion/google-fonts/Inter';
import type {Cena} from '../tipos';

const {fontFamily: anton} = loadAnton('normal', {weights: ['400'], subsets: ['latin', 'latin-ext']});
const {fontFamily: inter} = loadInter('normal', {weights: ['500', '700'], subsets: ['latin', 'latin-ext']});

// Canal de poder e sedução masculina: preto, cor apagada, uma palavra em vermelho (mesma lógica das miniaturas do nicho).
const PRETO = '#0a0a0b';
const AZUL_NOITE = '#0d1720';
const BRANCO = '#f4f1ec';
const CINZA = '#9a9894';
const VERMELHO = '#d7262e';

// Transição rápida: cena par entra com soco de zoom, cena ímpar com chicote lateral; as duas com desfoque e um
// clarão curto. A saída acelera um pouco (zoom e desfoque) pra emendar na próxima.
const ENTRADA = 9;
const SAIDA = 6;

const grao = (frame: number) =>
  `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><filter id='g'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' seed='${frame % 9}'/></filter><rect width='100%' height='100%' filter='url(%23g)' opacity='0.55'/></svg>")`;

// "*palavra*" marca a palavra vermelha; sem marca, a última palavra fica vermelha.
const Pintado = ({texto}: {texto: string}) => {
  const marcado = /\*(.+?)\*/.test(texto);
  const palavras = texto.split(' ');
  return (
    <>
      {palavras.map((p, i) => {
        const vermelho = marcado ? /^\*.*\*[.,!?]?$/.test(p) : i === palavras.length - 1 && palavras.length > 1;
        return <span key={i} style={{color: vermelho ? VERMELHO : undefined}}>{p.replace(/\*/g, '')}{i < palavras.length - 1 ? ' ' : ''}</span>;
      })}
    </>
  );
};

export const Sombra = ({cena, indice}: {cena: Cena; indice: number; idioma?: string; semLegenda?: boolean}) => {
  const frame = useCurrentFrame();
  const {durationInFrames, width, height} = useVideoConfig();
  const vertical = height > width;
  const temMidia = cena.takes.length > 0;
  const soFoto = temMidia && cena.takes.every((t) => t.tipo === 'foto');
  const t = Easing.out(Easing.cubic)(Math.min(1, frame / ENTRADA));
  const fim = interpolate(frame, [durationInFrames - SAIDA, durationInFrames], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const chicote = indice % 2 === 1;
  const lado = indice % 4 === 1 ? 1 : -1;
  const escala = (chicote ? 1.04 - 0.04 * t : 1.16 - 0.16 * t) + fim * 0.06;
  const desloca = chicote ? (1 - t) * 9 * lado : 0;
  const desfoque = (1 - t) * (chicote ? 18 : 12) + fim * 8;
  const clarao = indice === 0 ? 0 : interpolate(frame, [0, 6], [0.32, 0], {extrapolateRight: 'clamp'});
  const entra = indice === 0 ? interpolate(frame, [0, 14], [0, 1], {extrapolateRight: 'clamp'}) : 1;

  return (
    <AbsoluteFill style={{backgroundColor: PRETO, overflow: 'hidden'}}>
      <AbsoluteFill style={{opacity: entra, transform: `translateX(${desloca}%) scale(${escala})`, filter: desfoque > 0.3 ? `blur(${desfoque}px)` : undefined}}>
        {cena.cta ? <CartaoProduto cta={cena.cta} vertical={vertical} />
          : temMidia ? (
            <>
              {/* Cor apagada e contraste duro em tudo, pintura antiga e vídeo de banco viram o mesmo filme. */}
              {/* Foto (retrato, pintura) aparece inteira sobre ela mesma desfocada; vídeo ocupa a tela. */}
              {soFoto ? <Takes takes={cena.takes} indice={indice} filtro="blur(44px) saturate(0.3) brightness(0.35)" semMovimento /> : null}
              <Takes takes={cena.takes} indice={indice} filtro="saturate(0.45) contrast(1.18) brightness(0.7)" inteira={soFoto} />
              <AbsoluteFill style={{background: `linear-gradient(180deg, ${AZUL_NOITE}55 0%, transparent 45%, ${PRETO}aa 100%)`, mixBlendMode: 'multiply'}} />
              <AbsoluteFill style={{background: `radial-gradient(ellipse at center, transparent 35%, ${PRETO}e6 100%)`}} />
              {cena.destaque ? <AbsoluteFill style={{background: `linear-gradient(to top, ${PRETO}f0 0%, transparent 45%)`}} /> : null}
            </>
          ) : <CartaoTexto texto={cena.destaque || cena.texto} titulo={!!cena.destaque} vertical={vertical} />}

        {cena.destaque && temMidia && !cena.cta ? <Destaque texto={cena.destaque} vertical={vertical} /> : null}
        <AbsoluteFill style={{backgroundImage: grao(frame), opacity: 0.08, mixBlendMode: 'overlay'}} />
      </AbsoluteFill>
      {clarao > 0 ? <AbsoluteFill style={{background: `radial-gradient(ellipse at center, ${BRANCO} 0%, ${VERMELHO}66 60%, transparent 100%)`, opacity: clarao, mixBlendMode: 'screen'}} /> : null}
    </AbsoluteFill>
  );
};

// Título sobre a imagem: filete vermelho que corre e a frase em Anton, embaixo à esquerda.
const Destaque = ({texto, vertical}: {texto: string; vertical: boolean}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const linha = spring({frame: frame - 5, fps, config: {damping: 22}});
  const p = spring({frame: frame - 9, fps, config: {damping: 20}});
  return (
    <div style={{position: 'absolute', ...(vertical ? {left: 70, right: 70, top: 230} : {left: 120, bottom: 110}), maxWidth: vertical ? 940 : 1400}}>
      <div style={{width: 120, height: 6, background: VERMELHO, marginBottom: 24, transform: `scaleX(${linha})`, transformOrigin: 'left'}} />
      <div style={{fontFamily: anton, color: BRANCO, textTransform: 'uppercase', lineHeight: 1.02, letterSpacing: '0.01em',
        fontSize: vertical ? 84 : 96, textShadow: '0 4px 28px rgba(0,0,0,0.7)',
        opacity: p, transform: `translateY(${(1 - p) * 22}px)`}}>
        <Pintado texto={texto} />
      </div>
    </div>
  );
};

// Cena sem mídia: preto com uma luz fria que passeia devagar, frase grande centralizada.
// "1 · Entre no mundo dela" vira rótulo "PRINCÍPIO 1" em vermelho + frase.
const CartaoTexto = ({texto, titulo, vertical}: {texto: string; titulo: boolean; vertical: boolean}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const entrada = spring({frame: frame - 5, fps, config: {damping: 22}});
  const x = 50 + Math.sin(frame / 60) * 18;
  const y = 40 + Math.cos(frame / 80) * 10;
  const partes = texto.split(' · ');
  // "1 · Frase" vira PRINCÍPIO 1; "Motivo 1 · Frase" usa o próprio rótulo.
  const numerado = partes.length === 2 && /^(\d+|\S+ \d+)$/.test(partes[0]);
  const [rotulo, frase] = numerado ? [/^\d+$/.test(partes[0]) ? `Princípio ${partes[0]}` : partes[0], partes[1]] : [null, texto];
  const curto = frase.length < 48;
  const tamanho = titulo || curto ? (vertical ? 116 : 132) : (vertical ? 62 : 58);
  return (
    <AbsoluteFill style={{background: `radial-gradient(circle at ${x}% ${y}%, #1c2630 0%, #101418 35%, ${PRETO} 75%)`,
      alignItems: 'center', justifyContent: 'center', padding: vertical ? 90 : 200}}>
      {rotulo ? (
        <div style={{fontFamily: inter, fontWeight: 700, fontSize: 30, letterSpacing: '0.42em', textTransform: 'uppercase',
          color: VERMELHO, marginBottom: 30, opacity: entrada}}>{rotulo}</div>
      ) : (
        <div style={{width: 90, height: 6, background: VERMELHO, marginBottom: 40, transform: `scaleX(${entrada})`}} />
      )}
      <div style={{fontFamily: titulo || curto ? anton : inter, fontWeight: titulo || curto ? 400 : 500, color: BRANCO, textAlign: 'center',
        textTransform: titulo || curto ? 'uppercase' : 'none', lineHeight: titulo || curto ? 1.04 : 1.3,
        fontSize: tamanho, maxWidth: vertical ? 920 : 1500,
        opacity: entrada, transform: `scale(${0.96 + entrada * 0.04})`}}>
        {titulo || curto ? <Pintado texto={frase} /> : frase}
      </div>
    </AbsoluteFill>
  );
};

// Cartão final do produto: nome em Anton, faixa vermelha com a chamada.
const CartaoProduto = ({cta, vertical}: {cta: NonNullable<Cena['cta']>; vertical: boolean}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const p = spring({frame: frame - 6, fps, config: {damping: 20}});
  const q = spring({frame: frame - 20, fps, config: {damping: 20}});
  const brilho = 50 + Math.sin(frame / 40) * 20;
  return (
    <AbsoluteFill style={{background: `radial-gradient(circle at ${brilho}% 40%, #1c2630 0%, #101418 40%, ${PRETO} 85%)`,
      alignItems: 'center', justifyContent: 'center', padding: vertical ? 90 : 160}}>
      <div style={{position: 'absolute', inset: vertical ? 40 : 46, border: `1px solid ${CINZA}44`}} />
      <div style={{fontFamily: anton, color: BRANCO, textAlign: 'center', textTransform: 'uppercase', lineHeight: 1.02,
        fontSize: vertical ? 110 : 130, maxWidth: vertical ? 920 : 1500, opacity: p, transform: `translateY(${(1 - p) * 26}px)`}}>
        {cta.palavra}
      </div>
      <div style={{width: 130, height: 6, background: VERMELHO, margin: '44px 0 36px', transform: `scaleX(${q})`}} />
      {cta.depois ? (
        <div style={{fontFamily: inter, fontWeight: 700, fontSize: vertical ? 42 : 44, letterSpacing: '0.08em', textTransform: 'uppercase',
          color: BRANCO, background: VERMELHO, padding: '18px 48px', opacity: q}}>
          {cta.depois}
        </div>
      ) : null}
      {cta.alternativa ? (
        <div style={{fontFamily: inter, fontWeight: 500, fontSize: 32, color: CINZA, marginTop: 30, opacity: q}}>{cta.alternativa}</div>
      ) : null}
    </AbsoluteFill>
  );
};
