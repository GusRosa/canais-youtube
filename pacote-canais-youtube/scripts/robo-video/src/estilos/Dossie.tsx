import {AbsoluteFill, spring, useCurrentFrame, useVideoConfig, interpolate} from 'remotion';
import {Takes} from './Takes';
import {loadFont as carregarMaquina} from '@remotion/google-fonts/SpecialElite';
import {loadFont as carregarOswald} from '@remotion/google-fonts/Oswald';
import type {Cena} from '../tipos';
import {fadeEntrada, semente} from './util';

const {fontFamily: maquina} = carregarMaquina('normal', {weights: ['400'], subsets: ['latin', 'latin-ext']});
const {fontFamily: oswald} = carregarOswald('normal', {weights: ['700'], subsets: ['latin', 'latin-ext']});

const PAPEL = '#e8dcc2';
const TINTA = '#2b2620';
const CARIMBO = '#b3261e';

// Fundo de mesa: papel envelhecido com manchas e linhas finas.
const Papel = () => (
  <AbsoluteFill
    style={{
      backgroundColor: PAPEL,
      backgroundImage: [
        'radial-gradient(ellipse at 20% 15%, rgba(255,255,255,0.35), transparent 55%)',
        'radial-gradient(ellipse at 85% 90%, rgba(120,90,50,0.22), transparent 50%)',
        'radial-gradient(circle at 70% 25%, rgba(140,100,60,0.10), transparent 18%)',
        'repeating-linear-gradient(0deg, rgba(60,40,20,0.035) 0 1px, transparent 1px 38px)',
      ].join(','),
    }}
  />
);

const Fita = ({style}: {style: React.CSSProperties}) => (
  <div style={{position: 'absolute', width: 170, height: 46, background: 'rgba(235,225,190,0.78)',
    boxShadow: '0 1px 3px rgba(0,0,0,0.15)', ...style}} />
);

export const Dossie = ({cena, indice, idioma = 'pt', semLegenda = false}: {cena: Cena; indice: number; idioma?: string; semLegenda?: boolean}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const L = height > width ? (semLegenda ? VERTICAL_SEM_LEGENDA : VERTICAL) : HORIZONTAL;
  const T = ROTULOS[idioma] ?? ROTULOS.pt;
  const entrada = spring({frame, fps, config: {damping: 16, mass: 0.9}});
  const giro = (semente(indice) - 0.5) * 5;
  const carimbo = spring({frame: frame - 14, fps, config: {damping: 9, stiffness: 160}});
  const numero = String(indice + 1).padStart(3, '0');

  return (
    <AbsoluteFill style={{opacity: fadeEntrada(frame)}}>
      <Papel />

      <div style={{position: 'absolute', top: L.topoCabecalho, left: L.margem, fontFamily: maquina, fontSize: 30, color: TINTA, opacity: 0.75, letterSpacing: 2}}>
        {T.arquivo} {numero}
      </div>
      <div style={{position: 'absolute', top: L.topoCabecalho, right: L.margem, fontFamily: maquina, fontSize: 30, color: CARIMBO, opacity: 0.7, letterSpacing: 4}}>
        {T.confidencial}
      </div>

      {cena.takes.length ? (
        <div style={{
          position: 'absolute', left: '50%', top: L.centroFoto, width: L.foto[0], height: L.foto[1],
          transform: `translate(-50%, -50%) translateY(${(1 - entrada) * 700}px) rotate(${giro}deg)`,
          background: '#f7f3ea', padding: 22, paddingBottom: 70,
          boxShadow: '0 25px 50px rgba(40,25,10,0.35), 0 4px 10px rgba(40,25,10,0.2)',
        }}>
          <div style={{position: 'relative', width: '100%', height: '100%', overflow: 'hidden'}}>
            <Takes takes={cena.takes} indice={indice} filtro="sepia(0.35) contrast(1.05)" />
          </div>
          <Fita style={{top: -20, left: 60, transform: 'rotate(-8deg)'}} />
          <Fita style={{top: -18, right: 70, transform: 'rotate(6deg)'}} />
        </div>
      ) : (
        <div style={{
          position: 'absolute', left: '50%', top: L.centroFoto, width: 'max-content', maxWidth: L.larguraCartao, textAlign: 'center',
          transform: `translate(-50%, -50%) rotate(${giro / 2}deg) scale(${0.9 + entrada * 0.1})`,
          background: '#f4eedf', padding: L.vertical ? '60px 56px' : '70px 90px', boxShadow: '0 20px 40px rgba(40,25,10,0.3)',
          fontFamily: maquina, fontSize: (cena.destaque || cena.texto).length < 40 ? L.fonteCartao[0] : L.fonteCartao[1], lineHeight: 1.45, color: TINTA,
        }}>
          {revelarTexto(cena.destaque || cena.texto, frame, 1.6)}
        </div>
      )}

      {cena.destaque && cena.takes.length ? (
        <div style={{
          position: 'absolute', right: L.carimbo.right, top: L.carimbo.top,
          transform: `rotate(${-8 + giro}deg) scale(${interpolate(carimbo, [0, 1], [2.2, 1])})`,
          opacity: Math.min(1, carimbo * 1.5),
          border: `7px solid ${CARIMBO}`, color: CARIMBO, padding: '10px 34px',
          fontFamily: oswald, fontWeight: 700, fontSize: L.carimbo.fonte, letterSpacing: 3, textTransform: 'uppercase',
          maxWidth: L.carimbo.largura, lineHeight: 1.05, mixBlendMode: 'multiply',
        }}>
          {cena.destaque}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

// Medidas por formato. No vertical a foto fica no terço de cima e a legenda (Legenda.tsx) no de baixo,
// longe do topo e do rodapé que o app cobre com interface.
const HORIZONTAL = {
  vertical: false, margem: 80, topoCabecalho: 54, centroFoto: '50%', foto: [1180, 760],
  larguraCartao: 1300, fonteCartao: [88, 52], carimbo: {right: 150, top: 840, fonte: 64, largura: 820},
};
// Vertical sem legenda na tela: a foto cresce e desce pro centro, ocupando o espaço da legenda.
const VERTICAL_SEM_LEGENDA = {
  vertical: true, margem: 70, topoCabecalho: 190, centroFoto: 900, foto: [960, 880],
  larguraCartao: 920, fonteCartao: [92, 56], carimbo: {right: 80, top: 1330, fonte: 64, largura: 760},
};

const ROTULOS: Record<string, {arquivo: string; confidencial: string}> = {
  pt: {arquivo: 'ARQUIVO Nº', confidencial: 'CONFIDENCIAL'},
  en: {arquivo: 'FILE NO.', confidencial: 'CONFIDENTIAL'},
  es: {arquivo: 'ARCHIVO Nº', confidencial: 'CONFIDENCIAL'},
};

const VERTICAL = {
  vertical: true, margem: 70, topoCabecalho: 190, centroFoto: 690, foto: [960, 740],
  larguraCartao: 920, fonteCartao: [92, 56], carimbo: {right: 80, top: 990, fonte: 60, largura: 760},
};

// Efeito máquina de escrever: mostra o texto aos poucos.
const revelarTexto = (texto: string, frame: number, letrasPorFrame: number) => {
  const visiveis = Math.floor(frame * letrasPorFrame);
  return (
    <>
      {texto.slice(0, visiveis)}
      <span style={{opacity: 0}}>{texto.slice(visiveis)}</span>
    </>
  );
};
