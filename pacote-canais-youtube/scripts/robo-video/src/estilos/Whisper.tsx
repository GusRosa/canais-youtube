import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {loadFont as loadKalam} from '@remotion/google-fonts/Kalam';
import {loadFont as loadGreatVibes} from '@remotion/google-fonts/GreatVibes';
import {Takes} from './Takes';
import type {Cena} from '../tipos';
import {fadeEntrada} from './util';

const {fontFamily: kalam} = loadKalam('normal', {weights: ['400'], subsets: ['latin']});
const {fontFamily: greatVibes} = loadGreatVibes('normal', {weights: ['400'], subsets: ['latin']});

// Reels de frase (formato "Whisprs"): ilustração em tela cheia com zoom lento, um pedaço da frase
// por cena, em letra manuscrita no centro, e o @ da página em letra cursiva logo abaixo.
// Sem legenda separada: o texto da cena (ou o `destaque`) é a própria legenda.
export const Whisper = ({cena, indice, marca}: {cena: Cena; indice: number; marca?: string | null}) => {
  const frame = useCurrentFrame();
  const texto = cena.destaque || cena.texto;
  const entrada = interpolate(frame, [4, 16], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  return (
    <AbsoluteFill style={{opacity: fadeEntrada(frame, 10), backgroundColor: '#000'}}>
      {cena.takes.length ? <Takes takes={cena.takes} indice={indice} /> : null}
      {/* Escurece de leve o centro, onde fica a frase, sem apagar a ilustração. */}
      <AbsoluteFill style={{background: 'radial-gradient(ellipse 80% 30% at 50% 47%, rgba(0,0,0,0.32) 0%, transparent 100%)'}} />
      <AbsoluteFill style={{background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.45) 100%)'}} />

      <div style={{position: 'absolute', left: 80, right: 80, top: 860, textAlign: 'center',
        fontFamily: kalam, fontSize: 66, lineHeight: 1.3, color: '#fff',
        textShadow: '0 0 4px rgba(0,0,0,0.9), 0 2px 18px rgba(0,0,0,0.75)',
        opacity: entrada, transform: `translateY(${(1 - entrada) * 12}px)`}}>
        {texto}
      </div>

      {marca ? (
        <div style={{position: 'absolute', left: 0, right: 0, top: 1420, textAlign: 'center',
          fontFamily: greatVibes, fontSize: 52, color: 'rgba(255,255,255,0.88)',
          textShadow: '0 0 3px rgba(0,0,0,0.8), 0 2px 10px rgba(0,0,0,0.6)'}}>
          {marca}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
