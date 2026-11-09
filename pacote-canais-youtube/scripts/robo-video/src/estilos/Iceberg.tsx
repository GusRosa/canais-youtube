import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {loadFont} from '@remotion/google-fonts/Oswald';
import {Takes} from './Takes';
import type {Cena} from '../tipos';
import {fadeEntrada, semente} from './util';

// Estilo Iceberg: um iceberg desenhado em camadas (ponta acima d'água, o resto cada vez mais fundo).
// O fundo é contínuo no vídeo inteiro (IcebergFundo, fora da Series) e a câmera desce quando a cena
// muda de camada ("nivel" no cenas.json, nomes em "niveis"). Por cima, a cena mostra a mídia num
// cartão à direita, com o destaque embaixo.

const {fontFamily: oswald} = loadFont('normal', {weights: ['500', '700'], subsets: ['latin', 'latin-ext']});
const AMARELO = '#f2c230';

// Geometria do "mundo" (coordenadas de tela horizontal, 1920 de largura).
const TOPO_PONTA = 170;   // onde começa a ponta do iceberg
const AGUA = 640;         // linha d'água
const FAIXA = 760;        // altura de cada camada submersa
const CENTRO_X = 640;     // eixo do iceberg (fica à esquerda, o cartão vai à direita)

const topoNivel = (n: number) => (n <= 1 ? TOPO_PONTA : AGUA + (n - 2) * FAIXA);
const fimNivel = (n: number) => (n <= 1 ? AGUA : AGUA + (n - 1) * FAIXA);
const alturaMundo = (total: number) => fimNivel(Math.max(2, total)) + 500;

// Câmera: posição do topo da tela no mundo para mostrar a camada n centralizada.
// Nível -1 = iceberg inteiro (a câmera se afasta, ver zoomNivel).
const cameraNivel = (n: number, altura: number) => {
  if (n <= 1) return 0;
  return Math.max(0, (topoNivel(n) + fimNivel(n)) / 2 - altura / 2);
};

const zoomNivel = (n: number, altura: number, mundo: number) => (n === -1 ? altura / mundo : 1);

// Largura do iceberg em cada altura: ponta estreita, base larga.
const larguraEm = (y: number) => {
  const t = Math.max(0, y - TOPO_PONTA);
  const ponta = AGUA - TOPO_PONTA;
  return Math.min(1300, 110 + Math.min(t, ponta) * 1.35 + Math.max(0, t - ponta) * 0.3);
};

// Camada de cada cena: herda a anterior quando a cena não diz.
export const niveisDasCenas = (cenas: Cena[]) => {
  let atual = 0;
  return cenas.map(c => (atual = c.nivel ?? atual));
};

const contorno = (altura: number) => {
  const esq: string[] = [];
  const dir: string[] = [];
  for (let y = TOPO_PONTA, k = 0; y <= altura; y += 90, k++) {
    const meia = larguraEm(y) / 2;
    const j1 = (semente(k, 4) - 0.5) * 60;
    const j2 = (semente(k, 9) - 0.5) * 60;
    dir.push(`${CENTRO_X + meia + j2},${y}`);
    esq.unshift(`${CENTRO_X - meia + j1},${y}`);
  }
  return [`${CENTRO_X - 20},${TOPO_PONTA - 30}`, `${CENTRO_X + 25},${TOPO_PONTA - 10}`, ...dir, ...esq].join(' ');
};

export const IcebergFundo = ({cenas, niveis}: {cenas: Cena[]; niveis: string[]}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const total = niveis.length;
  const mundo = alturaMundo(total);
  const porCena = niveisDasCenas(cenas);

  // Cena atual e câmera (com descida suave quando a camada muda).
  let inicio = 0;
  let i = 0;
  while (i < cenas.length - 1 && frame >= inicio + cenas[i].frames) { inicio += cenas[i].frames; i++; }
  const alvo = cameraNivel(porCena[i], height);
  const anterior = i > 0 ? cameraNivel(porCena[i - 1], height) : alvo;
  const p = spring({frame: frame - inicio, fps, config: {damping: 200}, durationInFrames: 45});
  const cam = anterior + (alvo - anterior) * p;
  const nivelAtual = porCena[i];
  const zAnterior = i > 0 ? zoomNivel(porCena[i - 1], height, mundo) : zoomNivel(nivelAtual, height, mundo);
  const zoom = zAnterior + (zoomNivel(nivelAtual, height, mundo) - zAnterior) * p;
  const tudo = nivelAtual === -1;

  const pontos = contorno(mundo);
  const fundoMar = Math.min(1, cam / (mundo - height));

  return (
    <AbsoluteFill style={{overflow: 'hidden', backgroundColor: '#020814'}}>
      <div style={{position: 'absolute', left: 0, top: 0, width, height: mundo, transform: `translateY(${-cam}px) scale(${zoom})`, transformOrigin: `${CENTRO_X}px 0px`}}>
        <svg width={width} height={mundo} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
          <defs>
            <linearGradient id="ceu" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={AGUA}>
              <stop offset="0" stopColor="#0d1b2e" />
              <stop offset="1" stopColor="#3d6b8f" />
            </linearGradient>
            <linearGradient id="mar" gradientUnits="userSpaceOnUse" x1="0" y1={AGUA} x2="0" y2={mundo}>
              <stop offset="0" stopColor="#1f6fa3" />
              <stop offset="0.35" stopColor="#0b3557" />
              <stop offset="1" stopColor="#01060d" />
            </linearGradient>
            <linearGradient id="gelo" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={mundo}>
              <stop offset="0" stopColor="#f4fbff" />
              <stop offset={String(AGUA / mundo)} stopColor="#d6eef9" />
              <stop offset={String((AGUA + 1) / mundo)} stopColor="#7fc4e6" stopOpacity="0.85" />
              <stop offset="1" stopColor="#1d5a85" stopOpacity="0.75" />
            </linearGradient>
            <linearGradient id="sombra" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0.35" stopColor="#000" stopOpacity="0" />
              <stop offset="1" stopColor="#000" stopOpacity="0.35" />
            </linearGradient>
          </defs>
          {/* Céu e mar bem mais largos que a tela, pra não sobrar borda preta quando a câmera se afasta. */}
          <rect x={-4 * width} y={-mundo} width={9 * width} height={AGUA + mundo} fill="url(#ceu)" />
          <rect x={-4 * width} y={AGUA} width={9 * width} height={mundo * 2} fill="url(#mar)" />
          <polygon points={pontos} fill="url(#gelo)" />
          <polygon points={pontos} fill="url(#sombra)" />
          {/* Linha d'água com brilho */}
          <rect x={-4 * width} y={AGUA - 3} width={9 * width} height={6} fill="#bfe6ff" opacity={0.55} />
          {/* Divisórias das camadas, tracejadas sobre o gelo */}
          {niveis.map((_, k) => k > 0 ? (
            <line key={k} x1={CENTRO_X - larguraEm(topoNivel(k + 1)) / 2 - 40} x2={CENTRO_X + larguraEm(topoNivel(k + 1)) / 2 + 40}
              y1={topoNivel(k + 1)} y2={topoNivel(k + 1)} stroke="#ffffff" strokeOpacity={0.35} strokeWidth={3} strokeDasharray="18 14" />
          ) : null)}
        </svg>

        {/* Rótulo de cada camada sobre o gelo: a atual acesa, as outras apagadas. */}
        {niveis.map((nome, k) => {
          const n = k + 1;
          const aceso = n === nivelAtual || tudo;
          const y = n === 1 ? (tudo ? TOPO_PONTA + 40 : AGUA - 200) : topoNivel(n) + 40;
          const escuro = n === 1;
          return (
            <div key={k} style={{position: 'absolute', left: CENTRO_X - 330, top: y, width: 660, textAlign: 'center',
              opacity: aceso ? 1 : 0.35, transform: `scale(${Math.min(4, 0.55 / zoom) > 1 ? Math.min(4, 0.55 / zoom) : 1})`, transformOrigin: 'center top'}}>
              <div style={{fontFamily: oswald, fontWeight: 500, fontSize: 30, letterSpacing: 6,
                color: aceso ? AMARELO : (escuro ? '#0b2236' : '#cfe9f7')}}>LEVEL {n}</div>
              <div style={{fontFamily: oswald, fontWeight: 700, fontSize: escuro ? 52 : 58, lineHeight: 1.05, textTransform: 'uppercase',
                color: escuro ? '#0b2236' : '#ffffff', textShadow: escuro ? 'none' : '0 3px 14px rgba(0,0,0,0.6)'}}>{nome}</div>
            </div>
          );
        })}
      </div>

      {/* Bolhas subindo quando a câmera está debaixo d'água */}
      <Bolhas opacidade={interpolate(cam, [0, 300], [0, 0.5], {extrapolateRight: 'clamp'})} />
      {/* Escurece a borda conforme desce */}
      <AbsoluteFill style={{background: `radial-gradient(ellipse at 35% 50%, transparent 40%, rgba(0,0,0,${0.35 + fundoMar * 0.4}) 100%)`}} />
      <Profundidade total={total} de={i > 0 ? (porCena[i - 1] === -1 ? total : porCena[i - 1]) : nivelAtual} para={tudo ? total : nivelAtual} p={p} />
    </AbsoluteFill>
  );
};

const Bolhas = ({opacidade}: {opacidade: number}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  if (opacidade <= 0) return null;
  return (
    <AbsoluteFill style={{opacity: opacidade}}>
      {Array.from({length: 28}, (_, k) => {
        const x = semente(k, 11) * width;
        const vel = 0.6 + semente(k, 12) * 1.6;
        const y = height - ((semente(k, 13) * height + frame * vel) % (height + 40));
        const r = 3 + semente(k, 14) * 7;
        return <div key={k} style={{position: 'absolute', left: x + Math.sin((frame + k * 20) / 25) * 8, top: y, width: r, height: r,
          borderRadius: '50%', border: '2px solid rgba(220,240,255,0.8)'}} />;
      })}
    </AbsoluteFill>
  );
};

// Régua de profundidade na borda direita: uma marca por camada e o marcador da atual.
const Profundidade = ({total, de, para, p}: {total: number; de: number; para: number; p: number}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const topo = 160;
  const passo = 760 / Math.max(1, total - 1);
  const yDe = topo + Math.max(0, de - 1) * passo;
  const y = yDe + (topo + Math.max(0, para - 1) * passo - yDe) * p;
  const atual = para;
  return (
    <div style={{position: 'absolute', right: 34, top: 0, height: '100%', width: 60}}>
      <div style={{position: 'absolute', left: 28, top: topo, height: 760, width: 3, background: 'rgba(255,255,255,0.3)'}} />
      {Array.from({length: total}, (_, k) => (
        <div key={k} style={{position: 'absolute', left: 18, top: topo + k * passo - 1, width: 23, height: 3,
          background: k + 1 <= atual ? AMARELO : 'rgba(255,255,255,0.45)'}} />
      ))}
      {atual > 0 ? <div style={{position: 'absolute', left: 14, top: y - 16, width: 32, height: 32, borderRadius: '50%',
        background: AMARELO, boxShadow: `0 0 ${18 + Math.sin(frame / fps * 4) * 6}px ${AMARELO}`}} /> : null}
    </div>
  );
};

export const Iceberg = ({cena, indice, niveis, nivel}: {cena: Cena; indice: number; idioma?: string; semLegenda?: boolean; niveis?: string[] | null; nivel?: number}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const sobe = spring({frame: frame - 8, fps, config: {damping: 16}});
  const barra = spring({frame: frame - 16, fps, config: {damping: 18}});
  const temMidia = cena.takes.length > 0;
  const giro = (semente(indice, 5) - 0.5) * 3;
  const total = niveis?.length ?? 0;

  return (
    <AbsoluteFill style={{opacity: fadeEntrada(frame, 8)}}>
      {nivel && nivel > 0 && total ? (
        <div style={{position: 'absolute', left: 1090, top: 92, fontFamily: oswald, fontWeight: 500, fontSize: 30, letterSpacing: 6,
          color: AMARELO, textShadow: '0 2px 10px rgba(0,0,0,0.7)'}}>LEVEL {nivel} OF {total}</div>
      ) : null}

      {temMidia ? (
        <div style={{position: 'absolute', left: 1090, top: 150, width: 720, height: 405, background: '#fff', padding: 10,
          boxShadow: '0 30px 70px rgba(0,0,0,0.6)', transform: `translateY(${(1 - sobe) * 120}px) rotate(${giro}deg)`, opacity: sobe}}>
          <div style={{position: 'relative', width: '100%', height: '100%', overflow: 'hidden'}}>
            <Takes takes={cena.takes} indice={indice} />
          </div>
        </div>
      ) : null}

      {cena.destaque || !temMidia ? (
        <div style={{position: 'absolute', left: 1090, width: 720, display: 'flex', gap: 22, alignItems: 'stretch',
          ...(temMidia ? {top: 610} : {top: 0, bottom: 0, alignItems: 'center'}),
          transform: `translateX(${(1 - barra) * 60}px)`, opacity: barra}}>
          <div style={{width: 10, background: AMARELO, alignSelf: 'stretch', ...(temMidia ? {} : {height: 160, alignSelf: 'center'})}} />
          <div style={{fontFamily: oswald, fontWeight: 700, color: '#fff', textTransform: 'uppercase', lineHeight: 1.05,
            fontSize: temMidia ? 66 : ((cena.destaque || cena.texto).length < 30 ? 96 : (cena.destaque || cena.texto).length < 60 ? 76 : 54),
            textShadow: '0 4px 18px rgba(0,0,0,0.75)'}}>
            {cena.destaque || cena.texto}
          </div>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
