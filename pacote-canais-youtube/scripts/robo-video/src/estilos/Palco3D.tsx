import {useThree} from '@react-three/fiber';
import {Video} from '@remotion/media';
import {ThreeCanvas} from '@remotion/three';
import {loadFont} from '@remotion/google-fonts/Oswald';
import {useLayoutEffect, useMemo, useRef, useState} from 'react';
import {AbsoluteFill, Sequence, cancelRender, continueRender, delayRender, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {CanvasTexture, Shape} from 'three';
import type {Cena, Take} from '../tipos';
import {semente} from './util';

// Estilo Palco 3D (base: template React Three Fiber do Remotion). A foto ou o vídeo da cena vira a
// tela de um painel 3D com espessura e borda colorida, que entra girando e flutua num fundo escuro
// com partículas. Cena sem mídia: frase grande com formas 3D girando atrás.

const {fontFamily: oswald} = loadFont('normal', {weights: ['700'], subsets: ['latin', 'latin-ext']});
const COR_PADRAO = '#f2c230';
const FUNDO = 'radial-gradient(ellipse at 50% 35%, #1d2230 0%, #0d0f15 60%, #050608 100%)';

// Câmera: fov 30 a 10 unidades mostra 5,36 unidades de altura.
const CAMERA = {fov: 30, position: [0, 0, 10] as [number, number, number]};

type Medidas = {largura: number; altura: number; y: number; px: [number, number]};

// Tamanho do painel em unidades da cena e resolução da textura. No vertical sobe pra deixar o terço
// de baixo livre pra legenda.
const medidasPainel = (vertical: boolean, semLegenda: boolean): Medidas => vertical
  ? (semLegenda ? {largura: 2.75, altura: 3.45, y: 0.1, px: [1080, 1355]} : {largura: 2.35, altura: 2.6, y: 0.5, px: [1080, 1195]})
  : {largura: 6.6, altura: 3.71, y: 0.15, px: [1600, 900]};

const retanguloArredondado = (w: number, h: number, r: number) => {
  const s = new Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x, y + r);
  s.lineTo(x, y + h - r);
  s.quadraticCurveTo(x, y + h, x + r, y + h);
  s.lineTo(x + w - r, y + h);
  s.quadraticCurveTo(x + w, y + h, x + w, y + h - r);
  s.lineTo(x + w, y + r);
  s.quadraticCurveTo(x + w, y, x + w - r, y);
  s.lineTo(x + r, y);
  s.quadraticCurveTo(x, y, x, y + r);
  return s;
};

export const Palco3D = ({cena, indice, semLegenda, cor}: {cena: Cena; indice: number; idioma?: string; semLegenda?: boolean; cor?: string | null}) => {
  const {width, height} = useVideoConfig();
  const vertical = height > width;
  const destaque = cor || COR_PADRAO;
  const temMidia = cena.takes.length > 0;

  return (
    <AbsoluteFill style={{background: FUNDO}}>
      <ThreeCanvas linear width={width} height={height} camera={CAMERA}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[3, 4, 6]} intensity={1.8} />
        <pointLight position={[-4, -2, 3]} intensity={6} color={destaque} />
        <Particulas indice={indice} cor={destaque} />
        {temMidia
          ? <Painel takes={cena.takes} indice={indice} cor={destaque} medidas={medidasPainel(vertical, !!semLegenda)} />
          : <Formas indice={indice} cor={destaque} vertical={vertical} />}
      </ThreeCanvas>
      <AbsoluteFill style={{background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.55) 100%)'}} />
      {!temMidia ? <Frase texto={cena.destaque || cena.texto} titulo={!!cena.destaque} vertical={vertical} cor={destaque} /> : null}
      {cena.destaque && temMidia ? <Carimbo texto={cena.destaque} vertical={vertical} cor={destaque} /> : null}
    </AbsoluteFill>
  );
};

// Painel: corpo extrudado escuro, aro colorido atrás e a mídia na frente. Cada take troca só a tela.
const Painel = ({takes, indice, cor, medidas}: {takes: Take[]; indice: number; cor: string; medidas: Medidas}) => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const {largura, altura, y} = medidas;
  const lado = indice % 2 === 0 ? -1 : 1;
  const entrada = spring({frame, fps, config: {damping: 15, mass: 0.9}});
  const deriva = interpolate(frame, [0, durationInFrames], [0.16, -0.16]) * lado;

  const corpo = useMemo(() => retanguloArredondado(largura + 0.12, altura + 0.12, 0.16), [largura, altura]);
  const aro = useMemo(() => retanguloArredondado(largura + 0.22, altura + 0.22, 0.2), [largura, altura]);

  let inicio = 0;
  return (
    <group
      position={[lado * (1 - entrada) * 3, y + Math.sin(frame / 32 + indice) * 0.04, -4 * (1 - entrada)]}
      rotation={[interpolate(frame, [0, durationInFrames], [0.06, -0.04]), lado * (1 - entrada) * 1.3 + deriva, lado * (1 - entrada) * -0.15]}
    >
      <mesh position={[0, 0, -0.2]}>
        <extrudeGeometry args={[corpo, {depth: 0.18, bevelEnabled: false, curveSegments: 12}]} />
        <meshStandardMaterial color="#14161c" metalness={0.4} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0, -0.22]}>
        <shapeGeometry args={[aro, 12]} />
        <meshBasicMaterial color={cor} toneMapped={false} />
      </mesh>
      {takes.map((t, k) => {
        const de = inicio;
        inicio += t.frames;
        return (
          <Sequence key={k} from={de} durationInFrames={t.frames} layout="none">
            <Tela take={t} semente={indice * 7 + k} medidas={medidas} />
          </Sequence>
        );
      })}
    </group>
  );
};

// A mídia é desenhada num canvas 2D (corte "cover", cantos arredondados, zoom lento) que vira textura.
const Tela = ({take, semente: s, medidas}: {take: Take; semente: number; medidas: Medidas}) => {
  const frame = useCurrentFrame();
  const {advance} = useThree();
  const [W, H] = medidas.px;
  const src = staticFile(`midia/${take.arquivo}`);

  const [canvas] = useState(() => new OffscreenCanvas(W, H));
  const [ctx] = useState(() => canvas.getContext('2d')!);
  const [textura] = useState(() => new CanvasTexture(canvas));
  const foto = useFoto(take.tipo === 'foto' ? src : null);

  // Foto: zoom de 1,04 a 1,16 com leve deslize; vídeo: zoom bem leve (ele já tem movimento).
  const p = interpolate(frame, [0, take.frames], [0, 1], {extrapolateRight: 'clamp'});
  const zoom = take.tipo === 'video' ? 1.02 + p * 0.05 : (s % 2 === 0 ? 1.04 + p * 0.12 : 1.16 - p * 0.12);
  const dx = take.tipo === 'video' ? 0 : (semente(s, 2) - 0.5) * 70 * p;
  const movimento = useRef({zoom, dx});
  movimento.current = {zoom, dx};

  const desenhar = (fonte: CanvasImageSource, sw: number, sh: number) => {
    const {zoom, dx} = movimento.current;
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(0, 0, W, H, W * 0.025);
    ctx.clip();
    const escala = Math.max(W / sw, H / sh) * zoom;
    const w = sw * escala, h = sh * escala;
    ctx.drawImage(fonte, (W - w) / 2 + dx, (H - h) / 2, w, h);
    ctx.restore();
    textura.needsUpdate = true;
    advance(performance.now());
  };

  useLayoutEffect(() => {
    if (foto) desenhar(foto, foto.naturalWidth, foto.naturalHeight);
  });

  return (
    <>
      {take.tipo === 'video' ? (
        <Video src={src} headless muted trimBefore={take.inicio}
          onVideoFrame={(f) => {
            // No render chega ImageBitmap (width/height); no estúdio, VideoFrame (displayWidth/displayHeight).
            const q = f as {displayWidth?: number; displayHeight?: number; width: number; height: number};
            desenhar(f, q.displayWidth ?? q.width, q.displayHeight ?? q.height);
          }} />
      ) : null}
      <mesh>
        <planeGeometry args={[medidas.largura, medidas.altura]} />
        <meshBasicMaterial map={textura} transparent toneMapped={false} />
      </mesh>
    </>
  );
};

const useFoto = (src: string | null) => {
  const [foto, setFoto] = useState<HTMLImageElement | null>(null);
  const [espera] = useState(() => (src ? delayRender(`foto ${src}`) : null));
  useLayoutEffect(() => {
    if (!src || espera === null) return;
    const img = new Image();
    img.onload = () => { setFoto(img); continueRender(espera); };
    img.onerror = () => cancelRender(new Error(`não abriu a foto ${src}`));
    img.src = src;
  }, [src, espera]);
  return foto;
};

// Poeira de luz ao fundo, girando devagar. Posições fixas por cena (mesma imagem em todo render).
const Particulas = ({indice, cor}: {indice: number; cor: string}) => {
  const frame = useCurrentFrame();
  const posicoes = useMemo(() => {
    const n = 450;
    const a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      a[i * 3] = (semente(i, 11 + indice) - 0.5) * 16;
      a[i * 3 + 1] = (semente(i, 23 + indice) - 0.5) * 10;
      a[i * 3 + 2] = -2 - semente(i, 37 + indice) * 8;
    }
    return a;
  }, [indice]);
  return (
    <group rotation={[0, frame * 0.0015, 0]} position={[0, frame * 0.002, 0]}>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[posicoes, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.035} color={cor} transparent opacity={0.55} sizeAttenuation />
      </points>
    </group>
  );
};

// Cartão de texto: sólidos em arame girando em profundidades diferentes, atrás da frase.
const Formas = ({indice, cor, vertical}: {indice: number; cor: string; vertical: boolean}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const entrada = spring({frame, fps, config: {damping: 20}});
  // Horizontal: formas nas laterais. Vertical (tela estreita): acima e abaixo da frase.
  const formas = vertical ? [
    {pos: [-0.8, 2.0, -2], tam: 0.5, tipo: 0},
    {pos: [0.9, -2.1, -3], tam: 0.7, tipo: 1},
    {pos: [1.2, 2.6, -5], tam: 0.5, tipo: 2},
    {pos: [-1.3, -2.9, -4], tam: 0.6, tipo: 1},
  ] : [
    {pos: [-3.4, 1.3, -2], tam: 0.9, tipo: 0},
    {pos: [3.6, -1.1, -3], tam: 1.2, tipo: 1},
    {pos: [2.6, 1.9, -5], tam: 0.7, tipo: 2},
    {pos: [-2.4, -1.8, -4], tam: 0.8, tipo: 1},
  ];
  return (
    <>
      {formas.map((f, i) => (
        <mesh key={i} scale={f.tam * entrada}
          position={[f.pos[0], f.pos[1] + Math.sin(frame / 40 + i) * 0.15, f.pos[2]]}
          rotation={[frame * 0.01 * (i + 1) + semente(indice, i), frame * 0.013, 0]}>
          {f.tipo === 0 ? <icosahedronGeometry args={[1, 0]} /> : f.tipo === 1 ? <torusGeometry args={[0.8, 0.25, 12, 36]} /> : <octahedronGeometry args={[1, 0]} />}
          <meshBasicMaterial color={cor} wireframe transparent opacity={0.45} toneMapped={false} />
        </mesh>
      ))}
    </>
  );
};

const Frase = ({texto, titulo, vertical, cor}: {texto: string; titulo: boolean; vertical: boolean; cor: string}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const entrada = spring({frame: frame - 4, fps, config: {damping: 20}});
  const curto = texto.length < 40;
  const tamanho = titulo || curto ? (vertical ? 110 : 120) : (vertical ? 64 : 58);
  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', padding: vertical ? 90 : 180}}>
      <div style={{width: 90, height: 8, background: cor, marginBottom: 40, transform: `scaleX(${entrada})`}} />
      <div style={{fontFamily: oswald, fontWeight: 700, color: '#fff', textAlign: 'center', lineHeight: 1.15,
        fontSize: tamanho, textTransform: titulo || curto ? 'uppercase' : 'none', maxWidth: vertical ? 900 : 1500, whiteSpace: 'pre-line',
        opacity: entrada, transform: `translateY(${(1 - entrada) * 30}px) scale(${0.94 + entrada * 0.06})`,
        textShadow: '0 6px 30px rgba(0,0,0,0.6)'}}>
        {texto}
      </div>
    </AbsoluteFill>
  );
};

// Destaque por cima do painel: faixa colorida + texto em caixa alta, entra deslizando depois do painel.
const Carimbo = ({texto, vertical, cor}: {texto: string; vertical: boolean; cor: string}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const barra = spring({frame: frame - 12, fps, config: {damping: 18}});
  return (
    <div style={{position: 'absolute', display: 'flex', alignItems: 'stretch', gap: vertical ? 20 : 26,
      ...(vertical ? {left: 90, right: 90, top: 170} : {left: 150, bottom: 80}),
      transform: `translateX(${(1 - barra) * -80}px)`, opacity: barra}}>
      <div style={{width: vertical ? 10 : 12, background: cor}} />
      <div style={{fontFamily: oswald, fontWeight: 700, color: '#fff', textTransform: 'uppercase', lineHeight: 1.05,
        fontSize: vertical ? 72 : 76, maxWidth: vertical ? 900 : 1400, textShadow: '0 4px 24px rgba(0,0,0,0.8)'}}>
        {texto}
      </div>
    </div>
  );
};
