import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {loadFont} from '@remotion/google-fonts/Oswald';
import {geoAlbersUsa, geoPath} from 'd3-geo';
import {feature} from 'topojson-client';
import estadosTopo from 'us-atlas/states-albers-10m.json';
import {Takes} from './Takes';
import type {Cena, MapaCena} from '../tipos';
import {fadeEntrada} from './util';

// Estilo Mapped: mapa dos EUA contínuo no vídeo inteiro (MapaFundo, fora da Series). Cada cena diz
// para onde a câmera vai ("mapa": {"foco": ["ID"]}), quais estados acendem ("marcar": ["ID"] ou
// "TODOS") e se tem pino ("pino": {"lon", "lat", "rotulo"}). Cena sem "mapa" herda a anterior.

const {fontFamily: oswald} = loadFont('normal', {weights: ['500', '700'], subsets: ['latin', 'latin-ext']});
const AMARELO = '#f2c230';
const VERMELHO = '#e8322e';

// O arquivo "albers" já vem projetado em 975×610; a projeção abaixo é a mesma, pra posicionar pinos.
const projecao = geoAlbersUsa().scale(1300).translate([487.5, 305]);
const caminho = geoPath();
const colecao = feature(estadosTopo as any, (estadosTopo as any).objects.states) as any;
const ESTADOS: {id: string; nome: string; d: string; bounds: number[][]; centro: number[]}[] = colecao.features.map((f: any) => ({
  id: f.id, nome: f.properties.name, d: caminho(f) ?? '', bounds: caminho.bounds(f), centro: caminho.centroid(f),
}));

const SIGLAS: Record<string, string> = {AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado',
  CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho',
  IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska',
  NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina',
  ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington',
  WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming'};
const porSigla = (s: string) => ESTADOS.find(e => e.nome === SIGLAS[s.toUpperCase()]);

// Mapa de cada cena: herda a anterior quando a cena não diz.
export const mapasDasCenas = (cenas: Cena[]) => {
  let atual: MapaCena = {foco: 'US'};
  return cenas.map(c => (atual = c.mapa ?? atual));
};

type Camera = {s: number; cx: number; cy: number};
// Enquadra os estados do foco (ou o país inteiro) na tela, com folga.
const cameraDe = (m: MapaCena, W: number, H: number, comMidia: boolean): Camera => {
  const lista = m.foco && m.foco !== 'US' ? m.foco.map(porSigla).filter(Boolean) as typeof ESTADOS : [];
  const b = lista.length
    ? [[Math.min(...lista.map(e => e.bounds[0][0])), Math.min(...lista.map(e => e.bounds[0][1]))],
       [Math.max(...lista.map(e => e.bounds[1][0])), Math.max(...lista.map(e => e.bounds[1][1]))]]
    : [[0, 0], [975, 610]];
  const bw = b[1][0] - b[0][0];
  const bh = b[1][1] - b[0][1];
  const folga = lista.length ? 0.62 : 0.72;
  const s = Math.min(9, (W * (comMidia ? 0.55 : folga)) / bw, (H * folga) / bh);
  return {s, cx: (b[0][0] + b[1][0]) / 2, cy: (b[0][1] + b[1][1]) / 2};
};

export const MapaFundo = ({cenas}: {cenas: Cena[]}) => {
  const frame = useCurrentFrame();
  const {fps, width: W, height: H} = useVideoConfig();
  const porCena = mapasDasCenas(cenas);

  let inicio = 0;
  let i = 0;
  while (i < cenas.length - 1 && frame >= inicio + cenas[i].frames) { inicio += cenas[i].frames; i++; }
  const m = porCena[i];
  const midia = (k: number) => cenas[k].takes.length > 0;
  const alvo = cameraDe(m, W, H, midia(i));
  const de = i > 0 ? cameraDe(porCena[i - 1], W, H, midia(i - 1)) : alvo;
  const p = spring({frame: frame - inicio, fps, config: {damping: 200}, durationInFrames: 50});
  // Zoom em escala logarítmica: a viagem entre país e estado fica com velocidade constante.
  const s = Math.exp(Math.log(de.s) + (Math.log(alvo.s) - Math.log(de.s)) * p);
  const cx = de.cx + (alvo.cx - de.cx) * p;
  const cy = de.cy + (alvo.cy - de.cy) * p;
  // Com cartão de mídia, a câmera vai pra esquerda e deixa o lado direito livre.
  const centroX = (i > 0 && midia(i - 1) ? 0.4 : 0.5) + ((midia(i) ? 0.4 : 0.5) - (i > 0 && midia(i - 1) ? 0.4 : 0.5)) * p;
  const ox = W * centroX - cx * s;
  const oy = H * 0.44 - cy * s;
  const naTela = (x: number, y: number) => [ox + x * s, oy + y * s];

  const marcados = m.marcar === 'TODOS' ? ESTADOS.map(e => e.id)
    : (m.marcar ?? (m.foco && m.foco !== 'US' ? m.foco : [])).map(x => porSigla(x)?.id).filter(Boolean) as string[];
  const todos = m.marcar === 'TODOS';
  const local = frame - inicio;

  const pino = m.pino ? projecao([m.pino.lon, m.pino.lat]) : null;
  const pinoTela = pino ? naTela(pino[0], pino[1]) : null;
  const pulso = (local % 45) / 45;

  return (
    <AbsoluteFill style={{background: 'radial-gradient(ellipse at 40% 45%, #11263d 0%, #08121f 60%, #040a12 100%)', overflow: 'hidden'}}>
      {/* Grade fina de fundo, que se move com a câmera */}
      <AbsoluteFill style={{opacity: 0.18, backgroundImage: 'linear-gradient(#3d6a8f 1px, transparent 1px), linear-gradient(90deg, #3d6a8f 1px, transparent 1px)',
        backgroundSize: `${80 * Math.sqrt(s)}px ${80 * Math.sqrt(s)}px`, backgroundPosition: `${ox % 80}px ${oy % 80}px`}} />
      <svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
        <defs>
          <filter id="brilho" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <g transform={`translate(${ox} ${oy}) scale(${s})`}>
          {ESTADOS.map((e, k) => {
            const marcado = marcados.includes(e.id);
            // "TODOS": os estados acendem em sequência, de oeste pra leste.
            const atraso = todos ? (e.centro[0] / 975) * 40 : 0;
            const luz = marcado ? interpolate(local, [atraso, atraso + 12], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}) : 0;
            return (
              <path key={k} d={e.d} fill={luz > 0 ? AMARELO : '#1b3550'} fillOpacity={luz > 0 ? 0.25 + luz * 0.6 : 1}
                stroke={luz > 0 ? AMARELO : '#3f6f96'} strokeWidth={luz > 0 ? 2 : 1} vectorEffect="non-scaling-stroke"
                filter={luz > 0.5 && !todos ? 'url(#brilho)' : undefined} />
            );
          })}
        </g>
      </svg>

      {/* Nome do estado marcado (até 3), em tamanho fixo de tela */}
      {!todos && marcados.length <= 3 && !m.pino ? marcados.map(id => {
        const e = ESTADOS.find(x => x.id === id)!;
        const [x, y] = naTela(e.centro[0], e.centro[1]);
        return <div key={id} style={{position: 'absolute', left: x - 300, top: y - 30, width: 600, textAlign: 'center', fontFamily: oswald,
          fontWeight: 700, fontSize: 52, letterSpacing: 4, color: '#0b1726', opacity: interpolate(local, [15, 30], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}}>
          {e.nome.toUpperCase()}</div>;
      }) : null}

      {pinoTela && m.pino ? (
        <>
          <div style={{position: 'absolute', left: pinoTela[0] - 60 * pulso, top: pinoTela[1] - 60 * pulso, width: 120 * pulso, height: 120 * pulso,
            borderRadius: '50%', border: `3px solid ${VERMELHO}`, opacity: 1 - pulso}} />
          <div style={{position: 'absolute', left: pinoTela[0] - 14, top: pinoTela[1] - 14, width: 28, height: 28, borderRadius: '50%',
            background: VERMELHO, border: '4px solid #fff', boxShadow: '0 0 20px rgba(0,0,0,0.6)'}} />
          {m.pino.rotulo ? (
            <div style={{position: 'absolute', left: pinoTela[0] + 34, top: pinoTela[1] - 52, fontFamily: oswald, color: '#fff',
              background: 'rgba(6,16,30,0.88)', padding: '10px 22px 12px', borderLeft: `6px solid ${VERMELHO}`,
              opacity: interpolate(local, [20, 35], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}}>
              <div style={{fontWeight: 700, fontSize: 42, textTransform: 'uppercase', lineHeight: 1.1}}>{m.pino.rotulo}</div>
              <div style={{fontWeight: 500, fontSize: 24, letterSpacing: 3, color: AMARELO}}>
                {Math.abs(m.pino.lat).toFixed(2)}°{m.pino.lat >= 0 ? 'N' : 'S'} · {Math.abs(m.pino.lon).toFixed(2)}°{m.pino.lon >= 0 ? 'E' : 'W'}</div>
            </div>
          ) : null}
        </>
      ) : null}

      {/* Moldura de "mapa": selo no canto e vinheta */}
      <div style={{position: 'absolute', left: 60, top: 50, fontFamily: oswald, fontWeight: 500, fontSize: 28, letterSpacing: 8, color: AMARELO}}>
        ◎ MAPPED</div>
      <AbsoluteFill style={{background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.55) 100%)', pointerEvents: 'none'}} />
    </AbsoluteFill>
  );
};

export const Mapa = ({cena, indice}: {cena: Cena; indice: number; idioma?: string; semLegenda?: boolean}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const entra = spring({frame: frame - 10, fps, config: {damping: 18}});
  const temMidia = cena.takes.length > 0;
  return (
    <AbsoluteFill style={{opacity: fadeEntrada(frame, 8)}}>
      {temMidia ? (
        <div style={{position: 'absolute', right: 70, top: 110, width: 560, height: 315, background: '#fff', padding: 8,
          boxShadow: '0 25px 60px rgba(0,0,0,0.6)', transform: `translateX(${(1 - entra) * 120}px)`, opacity: entra}}>
          <div style={{position: 'relative', width: '100%', height: '100%', overflow: 'hidden'}}>
            <Takes takes={cena.takes} indice={indice} />
          </div>
        </div>
      ) : null}
      {cena.destaque ? (
        <div style={{position: 'absolute', left: 60, bottom: 80, display: 'flex', gap: 22, alignItems: 'stretch',
          transform: `translateY(${(1 - entra) * 40}px)`, opacity: entra}}>
          <div style={{width: 12, background: AMARELO}} />
          <div style={{fontFamily: oswald, fontWeight: 700, color: '#fff', textTransform: 'uppercase', lineHeight: 1.02,
            fontSize: cena.destaque.length < 18 ? 120 : 76, maxWidth: 1300, textShadow: '0 4px 20px rgba(0,0,0,0.8)'}}>
            {cena.destaque}
          </div>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
