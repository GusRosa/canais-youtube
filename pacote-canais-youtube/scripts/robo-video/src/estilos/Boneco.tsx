import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {loadFont as loadLuckiest} from '@remotion/google-fonts/LuckiestGuy';
import {loadFont as loadPatrick} from '@remotion/google-fonts/PatrickHand';
import type {BonecoCena, Cena, Personagem} from '../tipos';
import {fadeEntrada, semente} from './util';

// Estilo Stick: bonequinhos desenhados em código (cabeça redonda, corpo de palito, camiseta colorida),
// cenários chapados e balão de fala. Cada cena descreve o quadro em "boneco" (ver tipos.ts).
// As poses são posições de mão e pé; braço e perna se dobram sozinhos (cinemática inversa de 2 ossos).

const {fontFamily: titulo} = loadLuckiest('normal', {weights: ['400'], subsets: ['latin']});
const {fontFamily: mao} = loadPatrick('normal', {weights: ['400'], subsets: ['latin']});
const PRETO = '#141414';
const CHAO = 900;

// ---------- Boneco ----------

const OMBRO = -190;
const QUADRIL = -112;
const BRACO: [number, number] = [56, 52];
const PERNA: [number, number] = [58, 56];

// Junta do meio (cotovelo/joelho) pra ligar a origem ao alvo; "lado" escolhe pra onde dobra.
const junta = (ox: number, oy: number, tx: number, ty: number, [l1, l2]: [number, number], lado: number) => {
  let dx = tx - ox;
  let dy = ty - oy;
  let d = Math.hypot(dx, dy);
  const max = l1 + l2 - 0.5;
  if (d > max) { dx *= max / d; dy *= max / d; d = max; }
  const base = Math.atan2(dy, dx);
  const a = Math.acos(Math.min(1, Math.max(-1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))));
  const ang = base + a * lado;
  return {jx: ox + l1 * Math.cos(ang), jy: oy + l1 * Math.sin(ang), fx: ox + dx, fy: oy + dy};
};

type Pose = {mE: [number, number]; mD: [number, number]; cabeca?: number};
// Mão esquerda (mE) e direita (mD) relativas ao ombro; x positivo = pra direita da tela.
const pose = (nome: string, t: number): Pose => {
  const osc = Math.sin(t / 6);
  switch (nome) {
    case 'fala': return {mE: [-28, 102], mD: [70 + osc * 8, -8 + osc * 10]};
    case 'aponta': return {mE: [-28, 102], mD: [104, -18]};
    case 'choque': return {mE: [-52, -82 + osc * 4], mD: [52, -82 - osc * 4]};
    case 'pensa': return {mE: [22, 48], mD: [16, -22]};
    case 'triste': return {mE: [-16, 104], mD: [16, 104], cabeca: 12};
    case 'comemora': return {mE: [-62, -80 + osc * 10], mD: [62, -80 - osc * 10]};
    case 'segura': return {mE: [-24, 58], mD: [24, 58]};
    case 'liga': return {mE: [-28, 102], mD: [18, -36]};
    case 'le': return {mE: [-30, 48], mD: [30, 48], cabeca: 8};
    case 'lupa': return {mE: [-28, 102], mD: [80, -30]};
    default: return {mE: [-30, 100 + osc * 2], mD: [30, 100 - osc * 2]};
  }
};

const Boneco = ({p, quadro, indice, variante}: {p: Personagem; quadro: number; indice: number; variante?: string | null}) => {
  const expressivo = !!variante?.includes('expressivo');
  const pintado = !!variante?.includes('pintado');
  const {width, durationInFrames} = useVideoConfig();
  const esc = p.escala ?? 1.6;
  const entra = spring({frame: quadro - 4 - Math.min(indice, 8) * 4, fps: 30, config: {damping: 11, stiffness: 140}});
  // Andar: vai de "de" até "ate" (fração da largura) nos primeiros 60% da cena.
  const andando = p.anda && quadro < durationInFrames * 0.6;
  const x = (p.anda ? interpolate(quadro, [0, durationInFrames * 0.6], [p.anda.de, p.anda.ate], {extrapolateRight: 'clamp'}) : p.x ?? 0.5) * width;
  const passo = andando ? Math.sin(quadro / 4) : 0;
  const respira = Math.sin((quadro + indice * 17) / 14) * 3;
  const pz = pose(andando ? 'parado' : p.pose ?? 'parado', quadro + indice * 9);
  const cab = pz.cabeca ?? 0;
  const virado = (p.olha ?? (p.anda && p.anda.ate < p.anda.de ? 'esq' : 'dir')) === 'esq' ? -1 : 1;

  const sy = OMBRO + respira;
  const hy = QUADRIL + respira * 0.5;
  const maoE = pz.mE.map((v, k) => (k === 0 ? v * virado : v));
  const maoD = pz.mD.map((v, k) => (k === 0 ? v * virado : v));
  if (andando) { maoE[0] += passo * 22; maoD[0] -= passo * 22; }
  const bE = junta(-14, sy, -14 + maoE[0], sy + maoE[1], BRACO, 1);
  const bD = junta(14, sy, 14 + maoD[0], sy + maoD[1], BRACO, -1);
  const pE = junta(-12, hy, -26 + passo * 26, 0, PERNA, -1);
  const pD = junta(12, hy, 26 - passo * 26, 0, PERNA, 1);
  const cor = p.cor ?? '#3d7cc9';
  const cabY = -250 + respira + cab;
  const exp = p.expressao ?? (p.pose === 'choque' ? 'surpreso' : p.pose === 'triste' ? 'triste' : p.pose === 'comemora' ? 'feliz'
    : expressivo && p.pose === 'pensa' ? 'pensativo' : expressivo && (p.pose === 'aponta' || p.pose === 'lupa') ? 'confiante' : 'neutro');
  const falando = p.pose === 'fala' || p.pose === 'liga';
  const piscando = (quadro + indice * 23) % 95 < 4;
  const boca = falando ? 4 + Math.abs(Math.sin(quadro / 2.3)) * 10 : 0;
  const linha = {stroke: PRETO, strokeWidth: 9, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none'};

  return (
    <g transform={`translate(${x} ${CHAO + (1 - entra) * 60}) scale(${esc * (0.85 + entra * 0.15)})`} opacity={entra}>
      {pintado ? <ellipse cx={6} cy={6} rx={58} ry={12} fill="rgba(40,25,10,0.28)" filter="url(#pb-blur)" />
        : <ellipse cx={0} cy={4} rx={48} ry={9} fill="rgba(0,0,0,0.15)" />}
      {/* pernas */}
      <path d={`M-12 ${hy} L${pE.jx} ${pE.jy} L${pE.fx} ${pE.fy}`} {...linha} />
      <path d={`M12 ${hy} L${pD.jx} ${pD.jy} L${pD.fx} ${pD.fy}`} {...linha} />
      {/* camiseta */}
      <rect x={-26} y={sy - 14} width={52} height={hy - sy + 22} rx={18} fill={cor} stroke={PRETO} strokeWidth={6} />
      {pintado ? <><rect x={-23} y={sy - 11} width={46} height={hy - sy + 16} rx={15} fill="url(#pb-sombra-roupa)" />
        <path d={`M-14 ${sy - 6} Q-18 ${(sy + hy) / 2} -14 ${hy}`} stroke="rgba(255,255,255,0.35)" strokeWidth={5} strokeLinecap="round" fill="none" /></> : null}
      {/* braços (mangas da cor da camiseta até o cotovelo) */}
      <path d={`M-14 ${sy} L${bE.jx} ${bE.jy} L${bE.fx} ${bE.fy}`} {...linha} />
      <path d={`M14 ${sy} L${bD.jx} ${bD.jy} L${bD.fx} ${bD.fy}`} {...linha} />
      {/* cabeça */}
      <g transform={`translate(0 ${cabY})`}>
        <g transform={expressivo ? 'scale(1.15)' : undefined}>
          <circle cx={0} cy={0} r={44} fill={pintado ? 'url(#pb-pele)' : '#fff'} stroke={PRETO} strokeWidth={7} />
          <Acessorio tipo={p.acessorio} cor={p.corAcessorio ?? cor} corPropria={p.corAcessorio} />
          {expressivo
            ? <RostoExpressivo exp={exp} piscando={piscando} boca={boca} olhar={virado} quadro={quadro + indice * 11} />
            : <Rosto exp={exp} piscando={piscando} boca={boca} olhar={virado * 5} />}
        </g>
      </g>
      {/* objeto depois da cabeça, pra telefone e lupa ficarem na frente do rosto */}
      <Objeto tipo={p.segura} x={p.pose === 'segura' || p.pose === 'le' ? 0 : bD.fx} y={p.pose === 'segura' || p.pose === 'le' ? sy + 40 : bD.fy}
        naMao={p.pose !== 'segura' && p.pose !== 'le'} texto={p.textoObjeto} />
    </g>
  );
};

const Rosto = ({exp, piscando, boca, olhar}: {exp: string; piscando: boolean; boca: number; olhar: number}) => {
  const olhoR = exp === 'surpreso' ? 8 : 6;
  const ry = piscando ? 1 : olhoR;
  const sob = {stroke: PRETO, strokeWidth: 4, strokeLinecap: 'round' as const, fill: 'none'};
  return (
    <g transform={`translate(${olhar} 0)`}>
      <ellipse cx={-15} cy={-4} rx={olhoR} ry={ry} fill={PRETO} />
      <ellipse cx={15} cy={-4} rx={olhoR} ry={ry} fill={PRETO} />
      {exp === 'preocupado' || exp === 'triste' ? <><path d="M-24 -20 L-8 -24" {...sob} /><path d="M24 -20 L8 -24" {...sob} /></> : null}
      {exp === 'bravo' ? <><path d="M-24 -24 L-8 -17" {...sob} /><path d="M24 -24 L8 -17" {...sob} /></> : null}
      {exp === 'surpreso' ? <><path d="M-24 -26 Q-15 -32 -6 -26" {...sob} /><path d="M24 -26 Q15 -32 6 -26" {...sob} /></> : null}
      {boca > 0 ? <ellipse cx={0} cy={18} rx={9} ry={boca / 1.6} fill={PRETO} />
        : exp === 'surpreso' ? <ellipse cx={0} cy={20} rx={8} ry={10} fill={PRETO} />
        : exp === 'feliz' ? <path d="M-14 13 Q0 28 14 13" {...sob} strokeWidth={5} />
        : exp === 'triste' || exp === 'preocupado' ? <path d="M-12 24 Q0 14 12 24" {...sob} strokeWidth={5} />
        : <path d="M-10 18 L10 18" {...sob} strokeWidth={5} />}
    </g>
  );
};

// Rosto da variante 'expressivo': olho branco com pupila, sobrancelha sempre, bocas e efeitos (corado, suor, lágrima, raiva).
// Expressões: neutro, feliz, triste, preocupado, bravo, surpreso, pensativo, confiante.
const RostoExpressivo = ({exp, piscando, boca, olhar, quadro}: {exp: string; piscando: boolean; boca: number; olhar: number; quadro: number}) => {
  const tr = {stroke: PRETO, strokeWidth: 4.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none'};
  const susto = exp === 'surpreso';
  const olhoRx = susto ? 12 : 10;
  const olhoRy = susto ? 15 : exp === 'confiante' ? 8 : 12;
  // Pupila: segue o lado do corpo; pensativo olha pra cima, triste pra baixo.
  const [px, py] = exp === 'pensativo' ? [olhar * 3 + 2, -6] : exp === 'triste' ? [olhar * 2, 4] : [olhar * 3.5, 1];
  const pupila = susto ? 3.5 : 5.5;
  const sobe = boca > 0 ? Math.sin(quadro / 5) * 2 : 0;
  const sobr: Record<string, [string, string]> = {
    neutro: ['M-25 -22 Q-16 -26 -7 -22', 'M7 -22 Q16 -26 25 -22'],
    feliz: ['M-25 -23 Q-16 -30 -7 -24', 'M7 -24 Q16 -30 25 -23'],
    confiante: ['M-25 -20 Q-16 -24 -7 -20', 'M7 -26 Q16 -32 25 -27'],
    triste: ['M-25 -20 Q-16 -22 -7 -28', 'M7 -28 Q16 -22 25 -20'],
    preocupado: ['M-25 -20 Q-16 -24 -7 -29', 'M7 -29 Q16 -24 25 -20'],
    bravo: ['M-25 -29 Q-16 -25 -6 -19', 'M6 -19 Q16 -25 25 -29'],
    surpreso: ['M-26 -32 Q-16 -40 -6 -32', 'M6 -32 Q16 -40 26 -32'],
    pensativo: ['M-25 -24 Q-16 -28 -7 -24', 'M7 -30 Q16 -36 25 -29'],
  };
  const [sE, sD] = sobr[exp] ?? sobr.neutro;
  const bocaD = boca > 0
    ? <path d={`M-13 12 Q0 ${14 + boca * 1.6} 13 12 Q0 ${10 + boca * 0.4} -13 12 Z`} fill="#7a1f1f" stroke={PRETO} strokeWidth={4} />
    : exp === 'feliz' ? <g><path d="M-17 10 Q0 34 17 10 Z" fill="#7a1f1f" stroke={PRETO} strokeWidth={4} strokeLinejoin="round" />
        <path d="M-15 11 L15 11 L13 15 L-13 15 Z" fill="#fff" /></g>
    : exp === 'surpreso' ? <ellipse cx={0} cy={21} rx={9} ry={12} fill="#7a1f1f" stroke={PRETO} strokeWidth={4} />
    : exp === 'triste' ? <path d="M-13 26 Q0 14 13 26" {...tr} strokeWidth={5} />
    : exp === 'preocupado' ? <path d="M-14 22 Q-7 17 0 22 Q7 27 14 22" {...tr} strokeWidth={5} />
    : exp === 'bravo' ? <g><rect x={-15} y={14} width={30} height={12} rx={3} fill="#fff" stroke={PRETO} strokeWidth={4} /><path d="M-15 20 L15 20 M-5 14 L-5 26 M5 14 L5 26" stroke={PRETO} strokeWidth={2.5} /></g>
    : exp === 'pensativo' ? <path d="M-6 20 Q4 17 14 21" {...tr} strokeWidth={5} />
    : exp === 'confiante' ? <path d="M-12 17 Q2 26 15 13" {...tr} strokeWidth={5} />
    : <path d="M-11 17 Q0 24 11 17" {...tr} strokeWidth={5} />;
  const gota = (quadro % 60) / 60;
  return (
    <g>
      {[-15, 15].map(cx => piscando
        ? <path key={cx} d={`M${cx - 9} -3 Q${cx} 3 ${cx + 9} -3`} {...tr} />
        : <g key={cx}><ellipse cx={cx} cy={-4} rx={olhoRx} ry={olhoRy} fill="#fff" stroke={PRETO} strokeWidth={3.5} />
            <circle cx={cx + px} cy={-4 + py} r={pupila} fill={PRETO} /><circle cx={cx + px + 1.8} cy={-6 + py} r={1.6} fill="#fff" />
            {exp === 'confiante' ? <path d={`M${cx - 11} -9 L${cx + 11} -9`} stroke={PRETO} strokeWidth={4} /> : null}</g>)}
      <g transform={`translate(0 ${-sobe})`}><path d={sE} {...tr} strokeWidth={5} /><path d={sD} {...tr} strokeWidth={5} /></g>
      {bocaD}
      {exp === 'feliz' || exp === 'confiante' ? <><ellipse cx={-27} cy={12} rx={7} ry={4} fill="#f4a6a6" opacity={0.8} /><ellipse cx={27} cy={12} rx={7} ry={4} fill="#f4a6a6" opacity={0.8} /></> : null}
      {exp === 'preocupado' || exp === 'surpreso' ? <path d={`M38 ${-26 + gota * 8} q5 9 0 12 q-5 -3 0 -12 Z`} fill="#8fd3ff" stroke={PRETO} strokeWidth={2.5} /> : null}
      {exp === 'triste' ? <path d={`M-18 ${8 + gota * 22} q4 7 0 10 q-4 -3 0 -10 Z`} fill="#8fd3ff" stroke={PRETO} strokeWidth={2} opacity={1 - gota * 0.6} /> : null}
      {exp === 'bravo' ? <g transform="translate(30 -34)" stroke="#e8322e" strokeWidth={4} strokeLinecap="round"><path d="M-7 -2 Q-2 -2 -2 -7 M2 -7 Q2 -2 7 -2 M7 2 Q2 2 2 7 M-2 7 Q-2 2 -7 2" fill="none" /></g> : null}
      {exp === 'pensativo' ? <g fill="#fff" stroke={PRETO} strokeWidth={2.5}><circle cx={44} cy={-44} r={4} /><circle cx={54} cy={-58} r={6} /></g> : null}
    </g>
  );
};

const Acessorio = ({tipo, cor, corPropria}: {tipo?: string | null; cor: string; corPropria?: string}) => {
  if (tipo === 'inca') return <g>
    {/* cabelo preto em franja + llauto (faixa trançada colorida) */}
    <path d="M-47 8 Q-52 -50 0 -52 Q52 -50 47 8 Q44 -26 30 -36 L-30 -36 Q-44 -26 -47 8 Z" fill="#1d1a18" stroke={PRETO} strokeWidth={5} />
    <rect x={-46} y={-48} width={92} height={13} rx={5} fill="#c0392b" stroke={PRETO} strokeWidth={4} />
    {[-36, -18, 0, 18, 36].map(x => <rect key={x} x={x - 4} y={-46} width={8} height={9} fill={['#f1c40f', '#27ae60', '#f1c40f', '#27ae60', '#f1c40f'][(x + 36) / 18]} />)}
    <path d="M42 -40 L50 -18 M46 -41 L56 -22" stroke="#c0392b" strokeWidth={5} strokeLinecap="round" /></g>;
  if (tipo === 'maya') return <g>
    {/* cabelo preto preso no alto, faixa de tecido e pena verde */}
    <path d="M-46 4 Q-50 -48 0 -50 Q50 -48 46 4 Q40 -30 0 -36 Q-40 -30 -46 4 Z" fill="#1d1a18" stroke={PRETO} strokeWidth={5} />
    <ellipse cx={4} cy={-58} rx={14} ry={12} fill="#1d1a18" stroke={PRETO} strokeWidth={4} />
    <rect x={-44} y={-46} width={88} height={11} rx={5} fill="#e9dcc0" stroke={PRETO} strokeWidth={4} />
    <path d="M10 -64 Q34 -110 52 -120 Q44 -92 18 -60 Z" fill="#16a085" stroke={PRETO} strokeWidth={4} />
    <path d="M14 -64 Q32 -96 48 -112" stroke="#0e6655" strokeWidth={2.5} fill="none" /></g>;

  if (tipo === 'gorro') return <g><path d="M-44 -6 Q-46 -58 0 -60 Q46 -58 44 -6 Z" fill={cor} stroke={PRETO} strokeWidth={6} />
    <rect x={-48} y={-16} width={96} height={18} rx={8} fill={cor} stroke={PRETO} strokeWidth={6} /></g>;
  if (tipo === 'bone') return <g><path d="M-42 -12 Q-40 -52 0 -52 Q40 -52 42 -12 Z" fill={cor} stroke={PRETO} strokeWidth={6} />
    <path d="M10 -14 L66 -10 L62 -2 L10 -6 Z" fill={cor} stroke={PRETO} strokeWidth={5} /></g>;
  if (tipo === 'cabelo') return <path d="M-46 4 Q-52 -52 0 -54 Q50 -52 46 4 Q40 -26 18 -32 Q-10 -20 -40 -26 Z" fill="#3a2a20" stroke={PRETO} strokeWidth={5} />;
  if (tipo === 'coque') return <g><circle cx={0} cy={-52} r={16} fill="#5a3a22" stroke={PRETO} strokeWidth={5} />
    <path d="M-46 0 Q-48 -48 0 -48 Q48 -48 46 0 Q36 -30 0 -32 Q-36 -30 -46 0 Z" fill="#5a3a22" stroke={PRETO} strokeWidth={5} /></g>;
  if (tipo === 'oculos') return <g fill="none" stroke={PRETO} strokeWidth={4}><circle cx={-15} cy={-4} r={13} /><circle cx={15} cy={-4} r={13} /><path d="M-2 -4 L2 -4" /></g>;
  if (tipo === 'chapeu') return <g><path d="M-62 -14 L62 -14 L56 -2 L-56 -2 Z" fill="#e9dcc0" stroke={PRETO} strokeWidth={5} />
    <path d="M-36 -14 L-30 -56 Q0 -66 30 -56 L36 -14 Z" fill="#e9dcc0" stroke={PRETO} strokeWidth={5} /><rect x={-34} y={-26} width={68} height={10} fill="#3a2a16" /></g>;
  if (tipo === 'capacete') return <g><path d="M-48 -8 Q-48 -62 0 -64 Q48 -62 48 -8 Z" fill={cor} stroke={PRETO} strokeWidth={6} />
    <rect x={-56} y={-14} width={112} height={14} rx={6} fill={cor} stroke={PRETO} strokeWidth={5} /><path d="M0 -62 L0 -14" stroke={PRETO} strokeWidth={4} /></g>;
  if (tipo === 'cangaco' || tipo === 'lampiao') return <g>
    {/* chapéu de couro em meia-lua, aba virada pra cima, estrela na frente */}
    <path d="M-78 -20 Q-60 -96 0 -104 Q60 -96 78 -20 Q40 -44 0 -46 Q-40 -44 -78 -20 Z" fill="#9b6a35" stroke={PRETO} strokeWidth={6} />
    <path d="M-40 -30 Q0 -58 40 -30" fill="none" stroke="#e9c46a" strokeWidth={5} />
    <path d="M0 -82 L5 -71 L17 -70 L8 -62 L11 -50 L0 -57 L-11 -50 L-8 -62 L-17 -70 L-5 -71 Z" fill="#e9c46a" stroke={PRETO} strokeWidth={3} />
    {tipo === 'lampiao' ? <g fill="none" stroke={PRETO} strokeWidth={4}><circle cx={-15} cy={-4} r={12} /><circle cx={15} cy={-4} r={12} /><path d="M-3 -4 L3 -4" /></g> : null}</g>;
  if (tipo === 'quepe') return <g><path d="M-44 -14 L-40 -50 L40 -50 L44 -14 Z" fill={corPropria ?? '#6b4f2a'} stroke={PRETO} strokeWidth={6} />
    <path d="M-48 -14 L54 -14 L60 -2 L-48 -6 Z" fill="#3a2a16" stroke={PRETO} strokeWidth={5} /></g>;
  if (tipo === 'medico') return <g><path d="M-40 -18 Q-40 -50 0 -50 Q40 -50 40 -18 Z" fill="#7fd1c7" stroke={PRETO} strokeWidth={5} /></g>;
  return null;
};

// ---------- Objetos ----------

const Objeto = ({tipo, x, y, naMao, texto, grande}: {tipo?: string | null; x: number; y: number; naMao?: boolean; texto?: string | null; grande?: boolean}) => {
  if (!tipo) return null;
  const k = grande ? 3.2 : naMao ? 0.8 : 1;
  const t = `translate(${x} ${y}) scale(${k})`;
  if (tipo === 'conta') return (
    <g transform={t}>
      <rect x={-34} y={-44} width={68} height={88} rx={4} fill="#fff" stroke={PRETO} strokeWidth={5} />
      <rect x={-34} y={-44} width={68} height={16} fill="#e8322e" stroke={PRETO} strokeWidth={5} />
      {[0, 1, 2, 3].map(i => <path key={i} d={`M-24 ${-16 + i * 12} L${i === 3 ? 0 : 24} ${-16 + i * 12}`} stroke="#9a9a9a" strokeWidth={4} strokeLinecap="round" />)}
      {texto ? <text x={0} y={40} textAnchor="middle" fontFamily={titulo} fontSize={14} fill="#e8322e">{texto}</text> : null}
    </g>);
  if (tipo === 'telefone') return <g transform={t}><rect x={-10} y={-20} width={20} height={38} rx={5} fill="#2b2b2b" stroke={PRETO} strokeWidth={3} /></g>;
  if (tipo === 'lupa') return <g transform={t}><path d="M0 0 L-22 22" stroke="#7a4a20" strokeWidth={9} strokeLinecap="round" />
    <circle cx={16} cy={-16} r={24} fill="rgba(180,225,255,0.6)" stroke={PRETO} strokeWidth={6} /></g>;
  if (tipo === 'dinheiro') return <g transform={t}><rect x={-38} y={-20} width={76} height={40} rx={4} fill="#7cc46a" stroke={PRETO} strokeWidth={5} />
    <text x={0} y={12} textAnchor="middle" fontFamily={titulo} fontSize={28} fill="#2e6b25">$</text></g>;
  if (tipo === 'livro') return <g transform={t}><path d="M-40 -26 L0 -18 L40 -26 L40 26 L0 34 L-40 26 Z" fill="#f4ecd8" stroke={PRETO} strokeWidth={5} />
    <path d="M0 -18 L0 34" stroke={PRETO} strokeWidth={4} /></g>;
  if (tipo === 'calendario') return <g transform={t}><rect x={-46} y={-40} width={92} height={84} rx={6} fill="#fff" stroke={PRETO} strokeWidth={5} />
    <rect x={-46} y={-40} width={92} height={22} fill="#e8322e" stroke={PRETO} strokeWidth={5} />
    {texto ? <text x={0} y={30} textAnchor="middle" fontFamily={titulo} fontSize={34} fill={PRETO}>{texto}</text> : null}</g>;
  if (tipo === 'saco') return <g transform={t}><path d="M-30 30 Q-40 -10 -18 -36 L18 -36 Q40 -10 30 30 Z" fill="#c9b48a" stroke={PRETO} strokeWidth={5} />
    <path d="M-18 -36 L-10 -46 L10 -46 L18 -36" fill="none" stroke={PRETO} strokeWidth={4} /></g>;
  if (tipo === 'pepita') return <g transform={t}><path d="M-34 6 L-22 -22 L4 -30 L30 -14 L36 10 L14 28 L-18 26 Z" fill="#f2c230" stroke={PRETO} strokeWidth={5} />
    <path d="M-12 -12 L2 -18 M10 0 L20 -6" stroke="#fff5c0" strokeWidth={5} strokeLinecap="round" /></g>;
  if (tipo === 'bateia') return <g transform={t}><ellipse cx={0} cy={0} rx={44} ry={14} fill="#6b4a2a" stroke={PRETO} strokeWidth={5} />
    <circle cx={4} cy={-2} r={5} fill="#f2c230" /><circle cx={-10} cy={2} r={3} fill="#f2c230" /></g>;
  if (tipo === 'camera') return <g transform={t}><rect x={-26} y={-16} width={52} height={34} rx={5} fill="#2b2b2b" stroke={PRETO} strokeWidth={4} />
    <circle cx={2} cy={1} r={11} fill="#5a6b7a" stroke="#fff" strokeWidth={3} /></g>;
  if (tipo === 'papel') return <g transform={t}><rect x={-32} y={-42} width={64} height={84} fill="#fff" stroke={PRETO} strokeWidth={5} />
    {[0, 1, 2, 3].map(i => <path key={i} d={`M-22 ${-26 + i * 14} L${i === 3 ? 4 : 22} ${-26 + i * 14}`} stroke="#9a9a9a" strokeWidth={4} strokeLinecap="round" />)}
    <circle cx={14} cy={28} r={8} fill="#2f6fb3" /></g>;
  if (tipo === 'lotes') return <g transform={t}><rect x={-90} y={-60} width={180} height={120} fill="#b5764a" stroke={PRETO} strokeWidth={5} />
    {[-30, 30].map(x => <path key={x} d={`M${x} -60 L${x} 60`} stroke={PRETO} strokeWidth={3} strokeDasharray="8 6" />)}
    <path d="M-90 0 L90 0" stroke={PRETO} strokeWidth={3} strokeDasharray="8 6" /></g>;
  if (tipo === 'escada') return <g transform={t}><path d="M-22 70 L-10 -80 M22 70 L34 -80" stroke="#7a4a24" strokeWidth={8} />
    {[0, 1, 2, 3, 4, 5].map(i => <path key={i} d={`M${-21 + i * 2} ${55 - i * 25} L${23 + i * 2} ${55 - i * 25}`} stroke="#7a4a24" strokeWidth={6} />)}</g>;
  if (tipo === 'balde') return <g transform={t}><path d="M-28 -24 L-22 30 L22 30 L28 -24 Z" fill="#9aa1a8" stroke={PRETO} strokeWidth={5} />
    <ellipse cx={0} cy={-24} rx={28} ry={7} fill="#8c8c8c" stroke={PRETO} strokeWidth={4} /><path d="M-28 -24 Q0 -60 28 -24" fill="none" stroke={PRETO} strokeWidth={4} /></g>;
  if (tipo === 'tijolos') return <g transform={t}>{[[-30, 0], [0, 0], [-15, -20]].map(([x, y], i) =>
    <rect key={i} x={x} y={y} width={30} height={18} fill="#c8553d" stroke={PRETO} strokeWidth={4} />)}</g>;
  if (tipo === 'colher') return <g transform={t}><path d="M0 0 L0 -26" stroke="#7a4a24" strokeWidth={8} strokeLinecap="round" />
    <path d="M-16 0 L16 0 L0 34 Z" fill="#b8bec4" stroke={PRETO} strokeWidth={4} /></g>;
  if (tipo === 'projeto') return <g transform={t}><rect x={-46} y={-34} width={92} height={68} fill="#3a6ea5" stroke={PRETO} strokeWidth={5} />
    <path d="M-34 -20 L10 -20 L10 20 L-34 20 Z M10 0 L34 0 L34 20 L10 20" fill="none" stroke="#fff" strokeWidth={3} /></g>;
  if (tipo === 'parede') return <g transform={t}>{Array.from({length: 6}, (_, r) => Array.from({length: 5}, (_, k) =>
    <rect key={`${r}-${k}`} x={-75 + k * 30 + (r % 2) * 15} y={-60 + r * 20} width={30} height={20} fill="#c8553d" stroke={PRETO} strokeWidth={3} />))}</g>;
  if (tipo === 'predio') return <g transform={t}><rect x={-50} y={-90} width={100} height={180} fill="#d5dde6" stroke={PRETO} strokeWidth={5} />
    {Array.from({length: 6}, (_, r) => [0, 1, 2].map(k => <rect key={`${r}-${k}`} x={-38 + k * 28} y={-78 + r * 28} width={18} height={16} fill="#8fc3e6" stroke={PRETO} strokeWidth={2} />))}
    <path d="M60 90 L60 -110 L-20 -110 M60 -110 L90 -90" stroke="#f2c230" strokeWidth={8} fill="none" /></g>;
  if (tipo === 'grafico') return <g transform={t}><rect x={-60} y={-46} width={120} height={92} fill="#fff" stroke={PRETO} strokeWidth={5} />
    <path d="M-48 -30 L-20 -10 L4 -20 L44 30" stroke="#e8322e" strokeWidth={7} fill="none" /><path d="M36 22 L44 30 L48 18" stroke="#e8322e" strokeWidth={6} fill="none" /></g>;
  if (tipo === 'placa') return <g transform={t}><path d="M0 -50 L48 34 L-48 34 Z" fill="#f2c230" stroke={PRETO} strokeWidth={6} />
    <text x={0} y={22} textAnchor="middle" fontFamily={titulo} fontSize={54} fill={PRETO}>!</text><path d="M0 34 L0 90" stroke={PRETO} strokeWidth={8} /></g>;
  if (tipo === 'corda') return <g transform={t}><path d="M0 0 Q20 -40 0 -80 Q-20 -120 0 -160" stroke="#d9a441" strokeWidth={6} fill="none" /></g>;
  if (tipo === 'marmita') return <g transform={t}><rect x={-26} y={-14} width={52} height={28} rx={6} fill="#c0c6cc" stroke={PRETO} strokeWidth={4} /></g>;
  if (tipo === 'enxada') return <g transform={t}><path d="M0 40 L0 -70" stroke="#8a5a2b" strokeWidth={8} strokeLinecap="round" />
    <path d="M-4 -70 L-34 -62 L-30 -48 L-2 -58 Z" fill="#9aa1a8" stroke={PRETO} strokeWidth={4} /></g>;
  if (tipo === 'comida') return <g transform={t}><path d="M-34 -6 Q0 40 34 -6 Z" fill="#8a5a2b" stroke={PRETO} strokeWidth={5} />
    <ellipse cx={0} cy={-8} rx={34} ry={9} fill="#f2e2b6" stroke={PRETO} strokeWidth={4} /></g>;
  if (tipo === 'patente') return <g transform={t}><rect x={-40} y={-30} width={80} height={60} rx={4} fill="#f6ecd2" stroke={PRETO} strokeWidth={5} />
    <circle cx={22} cy={14} r={10} fill="#e8322e" stroke={PRETO} strokeWidth={3} />
    {[0, 1, 2].map(i => <path key={i} d={`M-28 ${-16 + i * 11} L${i === 2 ? 0 : 26} ${-16 + i * 11}`} stroke="#9a9a9a" strokeWidth={4} strokeLinecap="round" />)}</g>;
  if (tipo === 'cartaz') return <g transform={t}><rect x={-40} y={-50} width={80} height={96} fill="#f3e1b0" stroke={PRETO} strokeWidth={5} />
    <text x={0} y={-24} textAnchor="middle" fontFamily={titulo} fontSize={16} fill="#8a2a1a">PROCURA-SE</text>
    <circle cx={0} cy={8} r={18} fill="#fff" stroke={PRETO} strokeWidth={4} /><path d="M-24 2 Q0 -26 24 2 Z" fill="#9b6a35" stroke={PRETO} strokeWidth={3} /></g>;
  if (tipo === 'foto') return <g transform={t}><rect x={-60} y={-44} width={120} height={88} fill="#e8dcc0" stroke={PRETO} strokeWidth={5} />
    <rect x={-50} y={-34} width={100} height={60} fill="#b7a685" /><path d="M-50 20 L-20 -6 L4 14 L24 -2 L50 20 Z" fill="#8c7b5c" /></g>;
  if (tipo === 'bebe') return <g transform={t}><ellipse cx={0} cy={6} rx={30} ry={20} fill="#f4ecd8" stroke={PRETO} strokeWidth={5} />
    <circle cx={-18} cy={-6} r={14} fill="#fff" stroke={PRETO} strokeWidth={4} /><circle cx={-22} cy={-8} r={2} fill={PRETO} /><circle cx={-14} cy={-8} r={2} fill={PRETO} /></g>;
  if (tipo === 'papa') return <g transform={t}><ellipse cx={0} cy={0} rx={30} ry={22} fill="#b08452" stroke={PRETO} strokeWidth={5} />
    {[[-12, -6], [8, 4], [14, -10]].map(([a, b], i) => <circle key={i} cx={a} cy={b} r={2.5} fill="#6b4a2a" />)}</g>;
  if (tipo === 'mazorca') return <g transform={t}><path d="M-8 34 Q-22 0 -14 -34 Q-2 -4 -8 34 Z M8 34 Q22 0 14 -34 Q2 -4 8 34 Z" fill="#7aa35a" stroke={PRETO} strokeWidth={4} />
    <ellipse cx={0} cy={-4} rx={12} ry={34} fill="#f2c230" stroke={PRETO} strokeWidth={4} />
    {[-22, -10, 2, 14].map(y => <path key={y} d={`M-10 ${y} L10 ${y}`} stroke="#c99a1e" strokeWidth={3} />)}</g>;
  if (tipo === 'quipu') return <g transform={t}><path d="M-60 -40 L60 -40" stroke="#8a5a2b" strokeWidth={8} strokeLinecap="round" />
    {[-48, -32, -16, 0, 16, 32, 48].map((x, i) => <g key={x}><path d={`M${x} -40 Q${x + 4} 0 ${x - 2} ${30 + (i % 3) * 14}`} stroke={['#c0392b', '#f1c40f', '#27ae60', '#e9dcc0', '#2980b9'][i % 5]} strokeWidth={5} fill="none" />
      {[-18, 4, 22].slice(0, 1 + (i % 3)).map(y => <circle key={y} cx={x + 2} cy={y} r={4.5} fill="#5a3a1a" />)}</g>)}</g>;
  if (tipo === 'llama') return <g transform={t}><ellipse cx={0} cy={0} rx={44} ry={26} fill="#f4ecd8" stroke={PRETO} strokeWidth={5} />
    <path d="M30 -10 L36 -70 L54 -70 L50 -8 Z" fill="#f4ecd8" stroke={PRETO} strokeWidth={5} /><ellipse cx={52} cy={-74} rx={18} ry={11} fill="#f4ecd8" stroke={PRETO} strokeWidth={5} />
    <path d="M40 -84 L38 -98 M50 -84 L52 -98" stroke={PRETO} strokeWidth={5} strokeLinecap="round" /><circle cx={58} cy={-76} r={2.5} fill={PRETO} />
    {[-30, -12, 14, 30].map(x => <path key={x} d={`M${x} 20 L${x} 56`} stroke={PRETO} strokeWidth={6} strokeLinecap="round" />)}
    <rect x={-24} y={-30} width={40} height={18} rx={4} fill="#c0392b" stroke={PRETO} strokeWidth={3} /></g>;
  if (tipo === 'vasija') return <g transform={t}><path d="M-22 -36 L22 -36 L18 -26 Q46 -6 30 28 Q0 46 -30 28 Q-46 -6 -18 -26 Z" fill="#c8693d" stroke={PRETO} strokeWidth={5} />
    <path d="M-34 0 Q0 10 34 0" stroke="#7a3a1a" strokeWidth={4} fill="none" /><path d="M-30 12 L30 12" stroke="#f2d0a0" strokeWidth={3} strokeDasharray="6 5" /></g>;
  if (tipo === 'cacao') return <g transform={t}><ellipse cx={0} cy={0} rx={22} ry={38} fill="#a0522d" stroke={PRETO} strokeWidth={5} />
    {[-10, 0, 10].map(x => <path key={x} d={`M${x} -34 Q${x * 1.6} 0 ${x} 34`} stroke="#6e3216" strokeWidth={3} fill="none" />)}
    {[[34, 18], [44, 30], [28, 32]].map(([a, b], i) => <ellipse key={i} cx={a} cy={b} rx={7} ry={5} fill="#5a2a12" stroke={PRETO} strokeWidth={2} />)}</g>;
  if (tipo === 'codice') return <g transform={t}>{[0, 1, 2, 3].map(i => <rect key={i} x={-64 + i * 32} y={-40} width={32} height={80} fill="#efe2c2" stroke={PRETO} strokeWidth={4} />)}
    {[0, 1, 2, 3].map(i => <g key={i}><rect x={-58 + i * 32} y={-30} width={20} height={16} rx={4} fill="#c0392b" /><circle cx={-48 + i * 32} cy={6} r={6} fill="#16a085" />
      <path d={`M${-58 + i * 32} 24 L${-38 + i * 32} 24`} stroke={PRETO} strokeWidth={3} /></g>)}</g>;
  if (tipo === 'bola') return <g transform={t}><circle cx={0} cy={0} r={22} fill="#2b2b2b" stroke={PRETO} strokeWidth={4} /><path d="M-10 -12 Q-2 -18 6 -14" stroke="#777" strokeWidth={4} fill="none" strokeLinecap="round" /></g>;
  if (tipo === 'fuzil') return <g transform={t}><g transform="rotate(-35)">
    <path d="M-70 0 L56 0" stroke="#3a3a3a" strokeWidth={7} strokeLinecap="round" />
    <path d="M-30 -6 L-74 -4 L-82 14 L-40 8 Z" fill="#7a4a24" stroke={PRETO} strokeWidth={4} />
    <path d="M56 0 L80 0" stroke="#b8bec4" strokeWidth={4} strokeLinecap="round" /></g></g>;
  if (tipo === 'navio') return <g transform={t}>
    <path d="M-90 10 L90 10 L72 40 L-76 40 Z" fill="#4a3a2a" stroke={PRETO} strokeWidth={5} />
    <path d="M-90 10 L90 10" stroke="#f2c230" strokeWidth={4} />
    <rect x={-16} y={-28} width={22} height={38} fill="#2b2b2b" stroke={PRETO} strokeWidth={4} />
    <path d="M-40 10 L-40 -70 M40 10 L40 -60" stroke="#6b4a2a" strokeWidth={5} />
    <path d="M-40 -66 L-12 -40 L-40 -36 Z M40 -56 L66 -34 L40 -30 Z" fill="#f4ecd8" stroke={PRETO} strokeWidth={3} />
    <path d="M-40 -70 L-24 -76 L-40 -82" fill="#2f8a3e" stroke={PRETO} strokeWidth={2} />
    <circle cx={-6} cy={-40} r={9} fill="rgba(120,120,120,0.55)" /><circle cx={2} cy={-54} r={12} fill="rgba(120,120,120,0.4)" />
    <path d="M-110 46 Q-90 38 -70 46 T-30 46 T10 46 T50 46 T90 46 T120 46" stroke="#2f7fb8" strokeWidth={5} fill="none" /></g>;
  if (tipo === 'canhao') return <g transform={t}>
    <path d="M-10 -8 L-62 -26 L-66 -12 L-12 10 Z" fill="#3a3a3a" stroke={PRETO} strokeWidth={5} />
    <circle cx={-66} cy={-19} r={5} fill={PRETO} />
    <circle cx={0} cy={16} r={22} fill="#7a4a24" stroke={PRETO} strokeWidth={5} /><circle cx={0} cy={16} r={5} fill={PRETO} />
    <path d="M10 6 L50 34" stroke="#7a4a24" strokeWidth={10} strokeLinecap="round" />
    {[[60, 30], [72, 30], [66, 20]].map(([a, b], i) => <circle key={i} cx={a} cy={b} r={6} fill="#2b2b2b" stroke={PRETO} strokeWidth={2} />)}</g>;
  if (tipo === 'balao') return <g transform={t}>
    <path d="M0 -70 C42 -70 54 -30 40 0 Q24 30 12 40 L-12 40 Q-24 30 -40 0 C-54 -30 -42 -70 0 -70 Z" fill="#e9dcc0" stroke={PRETO} strokeWidth={5} />
    {[-20, 0, 20].map(x => <path key={x} d={`M${x * 0.4} -70 Q${x * 1.6} -16 ${x * 0.5} 40`} stroke="#b8a77f" strokeWidth={3} fill="none" />)}
    <path d="M-12 40 L-10 56 M12 40 L10 56" stroke={PRETO} strokeWidth={3} />
    <rect x={-14} y={56} width={28} height={16} fill="#7a4a24" stroke={PRETO} strokeWidth={4} />
    <path d="M0 72 Q14 110 -6 150 Q-20 180 4 220" stroke="#d9a441" strokeWidth={3} fill="none" strokeDasharray="6 4" /></g>;
  if (tipo === 'placa_rua') return <g transform={t}>
    <path d="M0 10 L0 120" stroke="#5a5a5a" strokeWidth={8} />
    <rect x={-90} y={-30} width={180} height={44} rx={6} fill="#2f5fa7" stroke={PRETO} strokeWidth={5} />
    <rect x={-84} y={-24} width={168} height={32} rx={4} fill="none" stroke="#fff" strokeWidth={2} />
    {texto ? <text x={0} y={-2} textAnchor="middle" fontFamily={titulo} fontSize={13} fill="#fff">{texto}</text> : null}</g>;
  if (tipo === 'iceberg') return <g transform={t}>
    <rect x={-120} y={0} width={240} height={110} fill="#2f7fb8" />
    <path d="M-30 0 L-8 -46 L14 -30 L34 0 Z" fill="#fff" stroke={PRETO} strokeWidth={5} />
    <path d="M-30 0 L-70 50 L-40 104 L50 108 L80 40 L34 0 Z" fill="#9fd6f2" stroke={PRETO} strokeWidth={5} opacity={0.85} />
    <path d="M-120 0 L120 0" stroke={PRETO} strokeWidth={5} /></g>;
  return null;
};

// ---------- Cenários pintados (variante "pintado") ----------
// Mesmo traço do Stick, com céu em degradê, camadas de montanha/mata que clareiam com a distância (perspectiva
// atmosférica), faces de luz e sombra nos volumes, chão com textura e vinheta. Cenário sem versão pintada usa o normal.

const DefsPintado = () => (
  <defs>
    <linearGradient id="pb-ceu-andes" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7fb8e6" /><stop offset="0.75" stopColor="#f3e3c4" /></linearGradient>
    <linearGradient id="pb-ceu-selva" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#9fd0e8" /><stop offset="0.8" stopColor="#f6efcf" /></linearGradient>
    <linearGradient id="pb-chao-terra" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#b38c5c" /><stop offset="1" stopColor="#7d5c36" /></linearGradient>
    <linearGradient id="pb-chao-selva" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#9a7a4a" /><stop offset="1" stopColor="#6a4f2c" /></linearGradient>
    <linearGradient id="pb-parede" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f6e8cc" /><stop offset="1" stopColor="#e6cfa6" /></linearGradient>
    <linearGradient id="pb-papel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f8f3e8" /><stop offset="1" stopColor="#ece2cd" /></linearGradient>
    <linearGradient id="pb-sombra-roupa" x1="0" y1="0" x2="1" y2="0"><stop offset="0.45" stopColor="rgba(0,0,0,0)" /><stop offset="1" stopColor="rgba(0,0,0,0.28)" /></linearGradient>
    <radialGradient id="pb-pele" cx="0.4" cy="0.35" r="0.75"><stop offset="0.6" stopColor="#ffffff" /><stop offset="1" stopColor="#e9e2d6" /></radialGradient>
    <radialGradient id="pb-sol" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor="rgba(255,236,170,0.9)" /><stop offset="1" stopColor="rgba(255,236,170,0)" /></radialGradient>
    <radialGradient id="pb-vinheta" cx="0.5" cy="0.45" r="0.75"><stop offset="0.6" stopColor="rgba(0,0,0,0)" /><stop offset="1" stopColor="rgba(40,20,0,0.35)" /></radialGradient>
    <filter id="pb-blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6" /></filter>
    <filter id="pb-grao" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="n" />
      <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.3  0 0 0 0 0.22  0 0 0 0 0.12  0 0 0 0.55 0" />
    </filter>
    <filter id="pb-mancha" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.012 0.04" numOctaves="3" seed="3" result="n" />
      <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.25  0 0 0 0 0.16  0 0 0 0 0.06  0 0 0 0.35 0" />
    </filter>
  </defs>
);

const Arvore = ({x, k, cor, escuro}: {x: number; k: number; cor: string; escuro: string}) => (
  <g transform={`translate(${x} ${CHAO}) scale(${k})`}>
    <path d="M-9 0 Q-6 -110 -4 -200 L4 -200 Q6 -110 9 0 Z" fill="#5e3f22" stroke={PRETO} strokeWidth={6} />
    <circle cx={0} cy={-250} r={92} fill={cor} stroke={PRETO} strokeWidth={7} />
    <circle cx={34} cy={-226} r={62} fill={escuro} />
    <circle cx={-30} cy={-282} r={38} fill="rgba(255,255,255,0.18)" />
    <circle cx={0} cy={-250} r={92} fill="none" stroke={PRETO} strokeWidth={7} />
  </g>
);

const FundoPintado = ({tipo, W, H}: {tipo: string; W: number; H: number}) => {
  const linha = {stroke: PRETO, strokeWidth: 7};
  const chaoTextura = <rect y={CHAO} width={W} height={H - CHAO} filter="url(#pb-grao)" opacity={0.5} />;
  switch (tipo) {
    case 'andes': return <g>
      <rect width={W} height={H} fill="url(#pb-ceu-andes)" />
      <circle cx={1640} cy={190} r={180} fill="url(#pb-sol)" /><circle cx={1640} cy={190} r={58} fill="#ffe08a" {...linha} />
      {[[300, 150, 1], [980, 110, 1.3], [1380, 260, .8]].map(([x, y, k], i) =>
        <g key={i} opacity={0.75}><ellipse cx={x} cy={y} rx={110 * k} ry={30 * k} fill="#fff" /><ellipse cx={x + 50 * k} cy={y - 18 * k} rx={60 * k} ry={30 * k} fill="#fff" /></g>)}
      {/* cordilheira distante, sem contorno e azulada */}
      <path d={`M0 ${CHAO - 430} L180 ${CHAO - 600} L360 ${CHAO - 470} L620 ${CHAO - 700} L900 ${CHAO - 480} L1180 ${CHAO - 660} L1460 ${CHAO - 470} L1720 ${CHAO - 640} L${W} ${CHAO - 500} L${W} ${CHAO} L0 ${CHAO} Z`} fill="#b9c8da" />
      {[[180, 600], [620, 700], [1180, 660], [1720, 640]].map(([x, h], i) => <path key={i} d={`M${x - 55} ${CHAO - h + 70} L${x} ${CHAO - h} L${x + 55} ${CHAO - h + 70} Q${x} ${CHAO - h + 52} ${x - 55} ${CHAO - h + 70} Z`} fill="#f4f8fc" />)}
      {/* cordilheira do meio, com face iluminada e face na sombra */}
      {[[260, 560, 330], [800, 640, 400], [1400, 600, 380]].map(([x, h, b], i) => <g key={i}>
        <path d={`M${x - b} ${CHAO - 150} L${x} ${CHAO - h} L${x + b} ${CHAO - 150} Z`} fill="#8796ad" stroke={PRETO} strokeWidth={6} strokeLinejoin="round" />
        <path d={`M${x} ${CHAO - h} L${x + b} ${CHAO - 150} L${x + 40} ${CHAO - 150} Z`} fill="#6c7b93" />
        <path d={`M${x - 70} ${CHAO - h + 120} L${x} ${CHAO - h} L${x + 70} ${CHAO - h + 120} L${x + 34} ${CHAO - h + 96} L${x + 6} ${CHAO - h + 118} L${x - 30} ${CHAO - h + 92} Z`} fill="#fbfdff" stroke={PRETO} strokeWidth={5} strokeLinejoin="round" />
        <path d={`M${x - b} ${CHAO - 150} L${x} ${CHAO - h} L${x + b} ${CHAO - 150}`} fill="none" stroke={PRETO} strokeWidth={6} strokeLinejoin="round" /></g>)}
      {/* encosta verde e terraços com degrau iluminado e muro de pedra na sombra */}
      <path d={`M0 ${CHAO - 160} Q500 ${CHAO - 240} 900 ${CHAO - 170} T${W} ${CHAO - 340} L${W} ${CHAO} L0 ${CHAO} Z`} fill="#7f9a55" stroke={PRETO} strokeWidth={6} />
      {[0, 1, 2, 3, 4, 5].map(k => { const y = CHAO - 330 + k * 55; const x = 1040 + k * 26; return <g key={k}>
        <path d={`M${x} ${y} L${W} ${y - 30} L${W} ${y + 20} L${x} ${y + 34} Z`} fill={k % 2 ? '#86a95a' : '#93b565'} stroke={PRETO} strokeWidth={5} />
        <path d={`M${x} ${y + 34} L${W} ${y + 20} L${W} ${y + 34} L${x} ${y + 50} Z`} fill="#8c7a62" />
        {Array.from({length: 10}, (_, j) => <path key={j} d={`M${x + 40 + j * 85} ${y + 34 - j * 1.4} l0 13`} stroke="#5c4c38" strokeWidth={3} />)}</g>; })}
      <rect y={CHAO} width={W} height={H - CHAO} fill="url(#pb-chao-terra)" />{chaoTextura}
      <path d={`M0 ${CHAO} L${W} ${CHAO}`} {...linha} />
      {[[150, 940, 1], [430, 1010, .7], [760, 960, .9], [1560, 990, .8]].map(([x, y, k], i) =>
        <g key={i} transform={`translate(${x} ${y}) scale(${k})`}><path d="M-34 10 Q-30 -22 0 -24 Q32 -20 36 10 Z" fill="#9aa1a8" stroke={PRETO} strokeWidth={5} /><path d="M-8 -16 Q6 -20 18 -10" stroke="#fff" strokeWidth={4} opacity={0.5} fill="none" /></g>)}
      {[260, 620, 1100, 1800].map((x, i) => <path key={i} d={`M${x} ${CHAO + 30} l-10 -26 M${x + 8} ${CHAO + 30} l2 -32 M${x + 16} ${CHAO + 30} l12 -24`} stroke="#5e7a35" strokeWidth={5} strokeLinecap="round" />)}</g>;
    case 'piramide': case 'mata': return <g>
      <rect width={W} height={H} fill="url(#pb-ceu-selva)" />
      <circle cx={tipo === 'piramide' ? 300 : 1620} cy={180} r={170} fill="url(#pb-sol)" />
      <circle cx={tipo === 'piramide' ? 300 : 1620} cy={180} r={56} fill="#ffe08a" {...linha} />
      {/* selva distante em duas camadas, a de trás mais clara */}
      <path d={`M0 ${CHAO - 300} ${Array.from({length: 17}, (_, k) => `Q${k * 120 + 60} ${CHAO - 380 - (k % 3) * 30} ${(k + 1) * 120} ${CHAO - 300}`).join(' ')} L${W} ${CHAO} L0 ${CHAO} Z`} fill="#a9cf9a" />
      <path d={`M0 ${CHAO - 200} ${Array.from({length: 13}, (_, k) => `Q${k * 160 + 80} ${CHAO - 300 - (k % 2) * 40} ${(k + 1) * 160} ${CHAO - 200}`).join(' ')} L${W} ${CHAO} L0 ${CHAO} Z`} fill="#6fa862" stroke={PRETO} strokeWidth={5} />
      {tipo === 'piramide' ? <g>
        {[0, 1, 2, 3, 4].map(k => { const x = 1020 + k * 70; const w = 700 - k * 140; const y = CHAO - (k + 1) * 110; return <g key={k}>
          <rect x={x} y={y} width={w} height={110} fill="#d9caa4" stroke={PRETO} strokeWidth={6} />
          <rect x={x + w * 0.62} y={y} width={w * 0.38} height={110} fill="#b9a983" />
          <rect x={x} y={y} width={w} height={16} fill="#eadfbe" />
          {Array.from({length: Math.floor(w / 70)}, (_, j) => <path key={j} d={`M${x + 35 + j * 70} ${y + 30} l0 70`} stroke="#9f8f6a" strokeWidth={3} />)}
          <rect x={x} y={y} width={w} height={110} fill="none" stroke={PRETO} strokeWidth={6} /></g>; })}
        <rect x={1270} y={CHAO - 650} width={200} height={100} fill="#d9caa4" {...linha} /><rect x={1400} y={CHAO - 650} width={70} height={100} fill="#b9a983" />
        <rect x={1270} y={CHAO - 650} width={200} height={100} fill="none" {...linha} />
        <path d={`M1250 ${CHAO - 650} L1370 ${CHAO - 700} L1490 ${CHAO - 650} Z`} fill="#c7b68e" {...linha} />
        <rect x={1340} y={CHAO - 620} width={60} height={70} fill="#2e2012" {...linha} />
        <path d={`M1330 ${CHAO} L1330 ${CHAO - 550} M1410 ${CHAO} L1410 ${CHAO - 550}`} stroke={PRETO} strokeWidth={4} />
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(k => <path key={k} d={`M1330 ${CHAO - 55 * k} L1410 ${CHAO - 55 * k}`} stroke={PRETO} strokeWidth={3} />)}
        <path d={`M1020 ${CHAO - 30} q40 -40 90 -10 M1640 ${CHAO - 40} q30 -30 70 0`} stroke="#3f7a3a" strokeWidth={10} strokeLinecap="round" fill="none" /></g>
      : null}
      {(tipo === 'piramide' ? [[90, 1.1], [360, .85], [640, 1.15], [1860, 1]] : [[80, 1], [360, 1.3], [640, .9], [1300, 1.2], [1600, 1], [1850, 1.3]]).map(([x, k], i) =>
        <Arvore key={i} x={x} k={k} cor={['#4f9a4b', '#3f8a40', '#5aa54f'][i % 3]} escuro={['#3b7d39', '#2f6f31', '#46893e'][i % 3]} />)}
      <rect y={CHAO} width={W} height={H - CHAO} fill="url(#pb-chao-selva)" />{chaoTextura}
      <path d={`M0 ${CHAO} L${W} ${CHAO}`} {...linha} />
      {[200, 520, 980, 1240, 1700].map((x, i) => <path key={i} d={`M${x} ${CHAO + 28} q-14 -30 -30 -34 M${x} ${CHAO + 28} q2 -34 -6 -48 M${x} ${CHAO + 28} q14 -28 32 -30`} stroke="#4c7a32" strokeWidth={6} strokeLinecap="round" fill="none" />)}</g>;
    case 'casa': return <g>
      <rect width={W} height={H} fill="url(#pb-parede)" />
      <rect y={CHAO} width={W} height={H - CHAO} fill="#b8875a" />
      {Array.from({length: 12}, (_, k) => <path key={k} d={`M${k * 170} ${CHAO} L${k * 170 - 60} ${H}`} stroke="#9a6d44" strokeWidth={4} />)}
      {chaoTextura}<path d={`M0 ${CHAO} L${W} ${CHAO}`} {...linha} />
      <path d={`M1300 500 L1180 ${CHAO} L1820 ${CHAO} L1640 500 Z`} fill="rgba(255,240,190,0.35)" />
      <rect x={1280} y={200} width={360} height={300} fill="#bfe3f5" {...linha} /><path d="M1300 480 L1460 220" stroke="#fff" strokeWidth={14} opacity={0.5} />
      <path d="M1460 200 L1460 500 M1280 350 L1640 350" {...linha} />
      <rect x={160} y={700} width={420} height={140} rx={30} fill="#d9654b" {...linha} /><rect x={140} y={620} width={460} height={110} rx={30} fill="#e07a5f" {...linha} />
      <rect x={160} y={790} width={420} height={50} rx={20} fill="#b8503a" />
      <rect x={1340} y={760} width={260} height={24} fill="#8a5a36" {...linha} /><path d="M1370 784 L1370 900 M1570 784 L1570 900" {...linha} /></g>;
    case 'vazio': return <g><rect width={W} height={H} fill="url(#pb-papel)" /><rect width={W} height={H} filter="url(#pb-mancha)" opacity={0.3} />
      <path d={`M0 ${CHAO} L${W} ${CHAO}`} stroke="#d6cdbb" strokeWidth={6} /></g>;
    default: return null;
  }
};

// ---------- Cenários ----------

const Fundo = ({tipo, W, H}: {tipo: string; W: number; H: number}) => {
  const linha = {stroke: PRETO, strokeWidth: 7};
  switch (tipo) {
    case 'casa': return <g>
      <rect width={W} height={H} fill="#f3e3c3" /><rect y={CHAO} width={W} height={H - CHAO} fill="#c99a6b" /><path d={`M0 ${CHAO} L${W} ${CHAO}`} {...linha} />
      <rect x={1280} y={200} width={360} height={300} fill="#bfe3f5" {...linha} /><path d="M1460 200 L1460 500 M1280 350 L1640 350" {...linha} />
      <rect x={160} y={700} width={420} height={140} rx={30} fill="#d9654b" {...linha} /><rect x={140} y={620} width={460} height={110} rx={30} fill="#e07a5f" {...linha} />
      <rect x={1340} y={760} width={260} height={24} fill="#8a5a36" {...linha} /><path d="M1370 784 L1370 900 M1570 784 L1570 900" {...linha} /></g>;
    case 'hospital': return <g>
      <rect width={W} height={H} fill="#dff1ef" /><rect y={CHAO} width={W} height={H - CHAO} fill="#b8d8d4" /><path d={`M0 ${CHAO} L${W} ${CHAO}`} {...linha} />
      <rect x={1160} y={640} width={560} height={90} rx={12} fill="#fff" {...linha} /><rect x={1160} y={560} width={120} height={90} rx={20} fill="#fff" {...linha} />
      <path d="M1190 730 L1190 900 M1690 730 L1690 900" {...linha} /><path d="M1800 360 L1800 900 M1760 900 L1840 900" {...linha} />
      <rect x={1770} y={360} width={60} height={90} rx={12} fill="#cfe9ff" {...linha} />
      <path d="M120 120 L120 600 Q200 560 280 600 Q360 560 440 600 L440 120" fill="#f5c4c4" {...linha} />
      <path d="M840 120 h120 v120 h-120 z" fill="#fff" {...linha} /><path d="M900 140 v80 M860 180 h80" stroke="#e8322e" strokeWidth={14} /></g>;
    case 'garimpo': return <g>
      <rect width={W} height={H} fill="#f2d39b" />
      {[0, 1, 2, 3, 4].map(k => <path key={k} d={`M${980 + k * 50} ${120 + k * 120} L${W} ${120 + k * 120} L${W} ${240 + k * 120} L${980 + k * 50} ${240 + k * 120} Z`}
        fill={['#b5764a', '#a8693f', '#9b5e37', '#8e5430', '#814a29'][k]} {...linha} />)}
      {[0, 1, 2, 3].map(k => <path key={k} d={`M${1020 + k * 50} ${240 + k * 120} L${1040 + k * 50} ${120 + k * 120} M${1060 + k * 50} ${240 + k * 120} L${1080 + k * 50} ${120 + k * 120}`} stroke="#5a3a1a" strokeWidth={5} />)}
      {Array.from({length: 14}, (_, k) => <g key={k} transform={`translate(${1100 + (k % 7) * 110} ${232 + Math.floor(k / 7) * 240})`}>
        <circle cx={0} cy={-34} r={9} fill="#fff" stroke={PRETO} strokeWidth={3} /><path d="M0 -25 L0 -6 M0 -6 L-6 8 M0 -6 L6 8" stroke={PRETO} strokeWidth={3} />
        <ellipse cx={-2} cy={-30} rx={9} ry={7} fill="#c9b48a" stroke={PRETO} strokeWidth={2} /></g>)}
      <rect y={CHAO} width={W} height={H - CHAO} fill="#b5764a" /><path d={`M0 ${CHAO} L${W} ${CHAO}`} {...linha} /></g>;
    case 'mata': return <g>
      <rect width={W} height={H} fill="#cfe9c4" />
      {[[80, 1], [360, 1.3], [640, .9], [1300, 1.2], [1600, 1], [1850, 1.3]].map(([x, k], i) => <g key={i} transform={`translate(${x} ${CHAO}) scale(${k})`}>
        <path d="M0 0 L0 -220" stroke="#6b4a2a" strokeWidth={18} /><circle cx={0} cy={-260} r={90} fill={['#4f9a4b', '#3f8a40', '#5aa54f'][i % 3]} {...linha} /></g>)}
      <rect y={CHAO} width={W} height={H - CHAO} fill="#8a6a3a" /><path d={`M0 ${CHAO} L${W} ${CHAO}`} {...linha} /></g>;
    case 'lago': return <g>
      <rect width={W} height={H} fill="#e8d7b0" />
      <rect y={560} width={W} height={H - 560} fill="#b5764a" /><path d={`M0 560 L${W} 560`} {...linha} />
      <ellipse cx={1100} cy={700} rx={760} ry={120} fill="#4a8a7a" {...linha} />
      <path d="M560 690 Q760 676 960 690 M1180 730 Q1400 716 1620 730" stroke="#bfe0d6" strokeWidth={6} fill="none" />
      {[[180, 1], [1900, 1.1]].map(([x, k], i) => <g key={i} transform={`translate(${x} 560) scale(${k})`}>
        <path d="M0 0 L0 -140" stroke="#6b4a2a" strokeWidth={14} /><circle cx={0} cy={-170} r={60} fill="#5aa54f" {...linha} /></g>)}</g>;
    case 'obra': return <g>
      <rect width={W} height={H} fill="#cdeefc" /><circle cx={260} cy={180} r={70} fill="#ffd25a" {...linha} />
      <rect y={CHAO} width={W} height={H - CHAO} fill="#b08a62" /><path d={`M0 ${CHAO} L${W} ${CHAO}`} {...linha} />
      <g>{Array.from({length: 4}, (_, r) => <g key={r}><rect x={1180} y={CHAO - (r + 1) * 150} width={560} height={150} fill={r < 3 ? '#d9d2c5' : 'none'} stroke={PRETO} strokeWidth={6} />
        {r < 3 ? [0, 1, 2].map(k => <rect key={k} x={1220 + k * 170} y={CHAO - (r + 1) * 150 + 40} width={90} height={70} fill="#5a6b7a" stroke={PRETO} strokeWidth={4} />) : null}</g>)}
        {[1160, 1450, 1760].map(x => <path key={x} d={`M${x} ${CHAO} L${x} ${CHAO - 620}`} stroke="#8a8a8a" strokeWidth={8} />)}
        <path d={`M1100 ${CHAO - 680} L1820 ${CHAO - 680} M1760 ${CHAO} L1760 ${CHAO - 760} L1500 ${CHAO - 760}`} stroke="#f2c230" strokeWidth={14} fill="none" />
        <path d={`M1560 ${CHAO - 760} L1560 ${CHAO - 640}`} stroke={PRETO} strokeWidth={4} /></g>
      <path d="M140 900 L200 820 L260 900 Z" fill="#c9a26b" {...linha} /><rect x={330} y={850} width={110} height={50} fill="#d6d0c4" {...linha} />
      <rect x={460} y={860} width={60} height={40} fill="#c8553d" {...linha} /></g>;
    case 'escritorio': return <g>
      <rect width={W} height={H} fill="#e9eef3" /><rect y={CHAO} width={W} height={H - CHAO} fill="#a9b6c2" /><path d={`M0 ${CHAO} L${W} ${CHAO}`} {...linha} />
      <rect x={1080} y={620} width={720} height={60} fill="#b07a4c" {...linha} /><rect x={1110} y={680} width={660} height={220} fill="#9a6a40" {...linha} />
      <rect x={1460} y={470} width={220} height={150} rx={8} fill="#3a4a5c" {...linha} /><path d="M1570 620 L1570 600" {...linha} />
      {[0, 1, 2].map(i => <rect key={i} x={200 + i * 150} y={180} width={110} height={260} fill="#d5dde6" {...linha} />)}
      <rect x={1170} y={200} width={300} height={160} fill="#fff" {...linha} /><path d="M1200 320 L1260 280 L1310 300 L1370 240 L1440 260" stroke="#3d7cc9" strokeWidth={8} fill="none" /><path d="M1200 230 L1330 230 M1200 255 L1290 255" stroke="#9a9a9a" strokeWidth={6} /></g>;
    case 'rua': return <g>
      <rect width={W} height={H} fill="#bfe6fb" /><circle cx={1700} cy={170} r={70} fill="#ffd25a" {...linha} />
      {[[60, 380, 260], [360, 260, 300], [700, 420, 240], [980, 300, 280], [1300, 360, 260], [1600, 280, 280]].map(([x, y, w], i) =>
        <rect key={i} x={x} y={y} width={w} height={CHAO - y} fill={['#e8d1a6', '#c9d6e2', '#e6b8a2', '#d2e2c4', '#e8d1a6', '#c9d6e2'][i]} {...linha} />)}
      <rect y={CHAO} width={W} height={H - CHAO} fill="#8e8e8e" /><path d={`M0 ${CHAO} L${W} ${CHAO}`} {...linha} /></g>;
    case 'agua': return <g>
      <rect width={W} height={H} fill="#cdeefc" /><rect y={560} width={W} height={H - 560} fill="#2f7fb8" /><path d={`M0 560 L${W} 560`} {...linha} /></g>;
    case 'sertao': return <g>
      <rect width={W} height={H} fill="#f7d58b" /><circle cx={260} cy={200} r={90} fill="#ffb347" {...linha} />
      <path d={`M0 ${CHAO - 120} Q300 ${CHAO - 200} 620 ${CHAO - 130} T1300 ${CHAO - 150} T${W} ${CHAO - 110} L${W} ${CHAO} L0 ${CHAO} Z`} fill="#d9a066" {...linha} />
      <rect y={CHAO} width={W} height={H - CHAO} fill="#c98a4b" /><path d={`M0 ${CHAO} L${W} ${CHAO}`} {...linha} />
      {[[180, 1], [1500, 1.2], [1780, 0.8]].map(([x, k], i) => <g key={i} transform={`translate(${x} ${CHAO}) scale(${k})`}>
        <path d="M-14 0 L-14 -230 Q0 -250 14 -230 L14 0 Z" fill="#6b9a4b" {...linha} />
        <path d="M-14 -120 L-60 -120 L-60 -190 Q-48 -205 -36 -190 L-36 -142 L-14 -142" fill="#6b9a4b" {...linha} />
        <path d="M14 -90 L56 -90 L56 -170 Q68 -185 80 -170 L80 -68 L14 -68" fill="#6b9a4b" {...linha} /></g>)}
      <path d="M760 900 L790 860 M800 900 L800 850 M840 900 L812 860" stroke="#7a5a30" strokeWidth={5} /></g>;
    case 'fazenda': return <g>
      <rect width={W} height={H} fill="#f7d58b" /><rect y={CHAO} width={W} height={H - CHAO} fill="#c98a4b" /><path d={`M0 ${CHAO} L${W} ${CHAO}`} {...linha} />
      <rect x={1080} y={480} width={640} height={420} fill="#d8a878" {...linha} /><path d="M1040 490 L1400 300 L1760 490 Z" fill="#b5523b" {...linha} />
      <rect x={1340} y={680} width={130} height={220} fill="#7a4a24" {...linha} /><rect x={1160} y={580} width={120} height={100} fill="#3a2a16" {...linha} />
      <rect x={1540} y={580} width={120} height={100} fill="#3a2a16" {...linha} />
      <path d="M100 900 L100 760 M60 790 L160 790 M260 900 L260 760 M220 790 L320 790" stroke="#7a5a30" strokeWidth={7} /></g>;
    case 'acampamento': return <g>
      <rect width={W} height={H} fill="#1d2440" />{[[200, 120], [520, 220], [900, 90], [1300, 180], [1650, 110], [1800, 260]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={4} fill="#fff" />)}
      <circle cx={1500} cy={170} r={60} fill="#f4ecd8" {...linha} />
      <rect y={CHAO} width={W} height={H - CHAO} fill="#4a3a2a" /><path d={`M0 ${CHAO} L${W} ${CHAO}`} {...linha} />
      <path d="M1100 900 L1170 860 M1110 860 L1180 900" stroke="#7a4a24" strokeWidth={14} strokeLinecap="round" />
      <path d="M1140 860 Q1110 800 1145 740 Q1160 790 1180 760 Q1195 820 1160 860 Z" fill="#ff9a3c" stroke="#e8322e" strokeWidth={5} />
      <ellipse cx={1145} cy={880} rx={260} ry={60} fill="rgba(255,154,60,0.18)" /></g>;
    case 'cidade': return <g>
      <rect width={W} height={H} fill="#cdeefc" /><rect y={CHAO} width={W} height={H - CHAO} fill="#b8a07a" /><path d={`M0 ${CHAO} L${W} ${CHAO}`} {...linha} />
      <rect x={1180} y={360} width={420} height={540} fill="#f4ecd8" {...linha} /><path d="M1150 370 L1390 220 L1630 370 Z" fill="#e8e1d0" {...linha} />
      <rect x={1340} y={140} width={100} height={130} fill="#f4ecd8" {...linha} /><path d="M1390 60 L1390 140 M1360 90 L1420 90" {...linha} />
      <rect x={1335} y={700} width={110} height={200} rx={50} fill="#7a4a24" {...linha} />
      {[0, 1, 2].map(i => <rect key={i} x={1140 - i * 30} y={900 - (i + 1) * 0} width={500 + i * 60} height={0} />)}
      {[[120, 520, 360], [520, 600, 300], [1700, 560, 220]].map(([x, y, w], i) => <g key={i}><rect x={x} y={y} width={w} height={CHAO - y} fill={['#e6b8a2', '#e8d1a6', '#d2e2c4'][i]} {...linha} />
        <rect x={x + w / 2 - 30} y={CHAO - 120} width={60} height={120} fill="#7a4a24" {...linha} /></g>)}</g>;
    case 'rio': return <g>
      <rect width={W} height={H} fill="#f7d58b" />
      <path d={`M0 470 Q500 440 960 470 T${W} 470 L${W} 520 L0 520 Z`} fill="#b8864b" {...linha} />
      <rect y={510} width={W} height={260} fill="#3f8fbf" /><path d={`M0 515 L${W} 515 M0 770 L${W} 770`} {...linha} />
      <path d="M100 600 Q400 580 700 600 M1000 680 Q1350 660 1700 680" stroke="#cdeefc" strokeWidth={6} fill="none" />
      <rect y={770} width={W} height={H - 770} fill="#c98a4b" /><path d={`M0 ${CHAO} L${W} ${CHAO}`} stroke="#a8743c" strokeWidth={4} />
      {[[140, 1], [1760, 1.2]].map(([x, k], i) => <g key={i} transform={`translate(${x} ${CHAO}) scale(${k})`}>
        <path d="M0 0 L0 -180" stroke="#6b4a2a" strokeWidth={16} /><circle cx={0} cy={-210} r={70} fill="#7aa35a" {...linha} /></g>)}</g>;
    case 'andes': return <g>
      <rect width={W} height={H} fill="#bfe3f5" /><circle cx={1640} cy={170} r={64} fill="#ffd25a" {...linha} />
      <path d={`M0 ${CHAO - 360} L260 ${CHAO - 640} L470 ${CHAO - 420} L760 ${CHAO - 760} L1080 ${CHAO - 400} L1380 ${CHAO - 700} L1660 ${CHAO - 430} L${W} ${CHAO - 600} L${W} ${CHAO} L0 ${CHAO} Z`} fill="#8a9bb0" {...linha} />
      {[[260, 640], [760, 760], [1380, 700]].map(([x, h], i) => <path key={i} d={`M${x - 70} ${CHAO - h + 90} L${x} ${CHAO - h} L${x + 70} ${CHAO - h + 90} Q${x} ${CHAO - h + 70} ${x - 70} ${CHAO - h + 90} Z`} fill="#fff" stroke={PRETO} strokeWidth={5} />)}
      {[0, 1, 2, 3, 4].map(k => <path key={k} d={`M${1000 + k * 40} ${CHAO - 300 + k * 60} L${W} ${CHAO - 330 + k * 60} L${W} ${CHAO - 270 + k * 60} L${1000 + k * 40} ${CHAO - 240 + k * 60} Z`}
        fill={['#7aa35a', '#6b9a4b', '#5d8c42', '#7aa35a', '#6b9a4b'][k]} stroke={PRETO} strokeWidth={5} />)}
      <rect y={CHAO} width={W} height={H - CHAO} fill="#a07a4a" /><path d={`M0 ${CHAO} L${W} ${CHAO}`} {...linha} />
      <path d="M120 900 L160 850 L200 900 Z M240 900 L300 830 L360 900 Z" fill="#9aa1a8" {...linha} /></g>;
    case 'piramide': return <g>
      <rect width={W} height={H} fill="#d9f0d0" /><circle cx={300} cy={170} r={64} fill="#ffd25a" {...linha} />
      {[0, 1, 2, 3, 4].map(k => <rect key={k} x={1020 + k * 70} y={CHAO - (k + 1) * 110} width={700 - k * 140} height={110} fill={['#cfc3a4', '#c7ba98', '#bfb18c', '#b7a880', '#cfc3a4'][k]} {...linha} />)}
      <rect x={1270} y={CHAO - 640} width={200} height={90} fill="#bfb18c" {...linha} /><rect x={1340} y={CHAO - 610} width={60} height={60} fill="#3a2a16" {...linha} />
      <path d={`M1330 ${CHAO} L1330 ${CHAO - 550} M1410 ${CHAO} L1410 ${CHAO - 550}`} stroke={PRETO} strokeWidth={4} />
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(k => <path key={k} d={`M1330 ${CHAO - 55 * k} L1410 ${CHAO - 55 * k}`} stroke={PRETO} strokeWidth={3} />)}
      {[[90, 1.1], [330, .9], [620, 1.2], [1860, 1]].map(([x, k], i) => <g key={i} transform={`translate(${x} ${CHAO}) scale(${k})`}>
        <path d="M0 0 L0 -200" stroke="#6b4a2a" strokeWidth={16} /><circle cx={0} cy={-240} r={84} fill={['#3f8a40', '#4f9a4b', '#2f7a35', '#4f9a4b'][i]} {...linha} /></g>)}
      <rect y={CHAO} width={W} height={H - CHAO} fill="#a8946a" /><path d={`M0 ${CHAO} L${W} ${CHAO}`} {...linha} /></g>;
    default: return <g><rect width={W} height={H} fill="#f6f1e7" /><path d={`M0 ${CHAO} L${W} ${CHAO}`} stroke="#d6cdbb" strokeWidth={6} /></g>;
  }
};

// ---------- Cena ----------

export const Boneco_ = ({cena, indice, variante}: {cena: Cena; indice: number; idioma?: string; semLegenda?: boolean; variante?: string | null}) => {
  const frame = useCurrentFrame();
  const {width: W, height: H, durationInFrames, fps} = useVideoConfig();
  const b: BonecoCena = cena.boneco ?? {fundo: 'vazio', personagens: [{pose: 'fala'}]};
  // Multidão: N bonecos pequenos em fileiras, um deles destacado em vermelho.
  const gente: Personagem[] = b.multidao
    ? Array.from({length: b.multidao.n}, (_, k) => ({x: 0.1 + (k % 10) * 0.088 + (Math.floor(k / 10) % 2) * 0.044, escala: 0.85,
        cor: k === (b.multidao!.destaque ?? -1) ? '#e8322e' : '#9aa6b2', pose: k === (b.multidao!.destaque ?? -1) ? 'triste' : 'parado',
        acessorio: (b.multidao!.acessorios ?? ['cabelo', null, 'bone', 'coque', null])[k % (b.multidao!.acessorios?.length ?? 5)], y: Math.floor(k / 10) * -70}))
        // fileira de trás primeiro, pra ficar atrás da da frente
        .sort((a, c) => a.y - c.y)
    : b.personagens ?? [];
  const zoom = interpolate(frame, [0, durationInFrames], [1, 1.04]);
  const pintado = !!variante?.includes('pintado');
  const fundoTipo = b.fundo ?? 'vazio';
  const temPintado = pintado && ['andes', 'piramide', 'mata', 'casa', 'vazio'].includes(fundoTipo);
  const tituloEntra = spring({frame: frame - 6, fps, config: {damping: 12}});
  const balaoEntra = spring({frame: frame - 18, fps, config: {damping: 14}});
  const quem = b.balao ? gente[b.balao.quem ?? 0] : null;
  const bx = quem ? (quem.anda ? quem.anda.ate : quem.x ?? 0.5) * W : 0;
  const by = quem ? CHAO - 300 * (quem.escala ?? 1.6) - 60 : 0;

  return (
    <AbsoluteFill style={{opacity: fadeEntrada(frame, 6), overflow: 'hidden', backgroundColor: '#f6f1e7'}}>
      <svg width={W} height={H} style={{transform: `scale(${zoom})`, transformOrigin: '50% 60%'}}>
        {pintado ? <DefsPintado /> : null}
        {temPintado ? <FundoPintado tipo={fundoTipo} W={W} H={H} /> : <Fundo tipo={fundoTipo} W={W} H={H} />}
        {b.objeto ? <g transform={`translate(0 ${(1 - spring({frame: frame - 10, fps, config: {damping: 12}})) * 80})`}>
          <Objeto tipo={b.objeto.tipo} x={(b.objeto.x ?? 0.72) * W} y={(b.objeto.y ?? 0.45) * H} grande texto={b.objeto.texto} /></g> : null}
        {gente.map((p, k) => (
          <g key={k} transform={`translate(0 ${p.y ?? 0})`}><Boneco p={p} quadro={frame} indice={k} variante={variante} /></g>
        ))}
        {pintado ? <><rect width={W} height={H} fill="url(#pb-vinheta)" /><rect width={W} height={H} filter="url(#pb-grao)" opacity={0.18} /></> : null}
      </svg>

      {b.balao && quem ? (
        <div style={{position: 'absolute', left: Math.min(W - 620, Math.max(40, bx - 120)), bottom: H - by + 10, maxWidth: 580,
          background: '#fff', border: `6px solid ${PRETO}`, borderRadius: 34, padding: '18px 30px', fontFamily: mao, fontSize: 62,
          lineHeight: 1.1, color: PRETO, transform: `scale(${balaoEntra})`, transformOrigin: '20% 100%'}}>
          {b.balao.texto}
          <div style={{position: 'absolute', left: Math.min(160, Math.max(40, bx - Math.min(W - 620, Math.max(40, bx - 120)) - 20)), bottom: -34,
            width: 0, height: 0, borderLeft: '22px solid transparent', borderRight: '22px solid transparent', borderTop: `34px solid ${PRETO}`}} />
        </div>
      ) : null}

      {b.placar ? <Placar nivel={b.placar} quadro={frame} /> : null}
      {b.placares?.length ? <Placares lista={b.placares} quadro={frame} /> : null}
      {cena.destaque ? (
        <div style={{position: 'absolute', ...(b.balao ? {bottom: 20} : {top: 60}), left: 0, right: 0, textAlign: 'center', fontFamily: titulo, fontSize: cena.destaque.length < 16 ? 150 : 100,
          color: b.corTitulo ?? '#fff', WebkitTextStroke: `10px ${PRETO}`, paintOrder: 'stroke fill', letterSpacing: 2, lineHeight: 1,
          transform: `scale(${0.6 + tituloEntra * 0.4}) rotate(${(semente(indice, 3) - 0.5) * 4}deg)`, opacity: tituloEntra,
          textShadow: '0 8px 0 rgba(0,0,0,0.25)'}}>
          {cena.destaque}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

export {Boneco_ as Stick};

// Placar "chance de sobreviver": qualitativo (sem porcentagem inventada), canto superior direito.
const NIVEIS_PLACAR: Record<string, [number, string]> = {'ALTA': [4, '#4caf50'], 'MÉDIA': [3, '#f2c230'], 'BAIXA': [2, '#ff8a3c'], 'QUASE ZERO': [1, '#e8322e']};
const Placar = ({nivel, quadro}: {nivel: string; quadro: number}) => {
  const [n, cor] = NIVEIS_PLACAR[nivel] ?? [2, '#ff8a3c'];
  const entra = spring({frame: quadro - 12, fps: 30, config: {damping: 14}});
  const pisca = n === 1 ? 0.6 + Math.abs(Math.sin(quadro / 8)) * 0.4 : 1;
  return (
    <div style={{position: 'absolute', right: 50, top: 50, background: '#fff', border: `6px solid ${PRETO}`, borderRadius: 22, padding: '14px 22px',
      transform: `scale(${entra})`, transformOrigin: 'top right', fontFamily: titulo, color: PRETO}}>
      <div style={{fontSize: 26, letterSpacing: 1}}>CHANCE DE SOBREVIVER</div>
      <div style={{display: 'flex', gap: 8, margin: '10px 0 6px'}}>
        {[1, 2, 3, 4].map(i => <div key={i} style={{width: 58, height: 26, borderRadius: 6, border: `4px solid ${PRETO}`, background: i <= n ? cor : '#eee', opacity: i <= n ? pisca : 1}} />)}
      </div>
      <div style={{fontSize: 40, color: cor, WebkitTextStroke: `2px ${PRETO}`}}>{nivel}</div>
    </div>
  );
};

// Placares de 1 a 4 (ex.: dinheiro e dor de cabeça), empilhados no canto superior direito.
const Placares = ({lista, quadro}: {lista: {titulo: string; nivel: number; cor: string}[]; quadro: number}) => {
  const entra = spring({frame: quadro - 10, fps: 30, config: {damping: 14}});
  return (
    <div style={{position: 'absolute', right: 50, top: 50, background: '#fff', border: `6px solid ${PRETO}`, borderRadius: 22, padding: '12px 20px',
      transform: `scale(${entra})`, transformOrigin: 'top right', fontFamily: titulo, color: PRETO, display: 'flex', flexDirection: 'column', gap: 8}}>
      {lista.map((p, k) => (
        <div key={k}>
          <div style={{fontSize: 24}}>{p.titulo}</div>
          <div style={{display: 'flex', gap: 8, marginTop: 4}}>
            {[1, 2, 3, 4].map(i => <div key={i} style={{width: 56, height: 24, borderRadius: 6, border: `4px solid ${PRETO}`, background: i <= p.nivel ? p.cor : '#eee'}} />)}
          </div>
        </div>
      ))}
    </div>
  );
};
