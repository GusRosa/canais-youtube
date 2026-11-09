import {AbsoluteFill, Audio, Series, interpolate, staticFile, useVideoConfig} from 'remotion';
import type {VideoProps} from './tipos';
import {Dossie} from './estilos/Dossie';
import {Classico} from './estilos/Classico';
import {Reels} from './estilos/Reels';
import {Desejo} from './estilos/Desejo';
import {Sombra} from './estilos/Sombra';
import {Palco3D} from './estilos/Palco3D';
import {Viagem, BarraProgresso, AMARELO} from './estilos/Viagem';
import {Iceberg, IcebergFundo, niveisDasCenas} from './estilos/Iceberg';
import {Mapa, MapaFundo} from './estilos/Mapa';
import {Stick} from './estilos/Boneco';
import {Whisper} from './estilos/Whisper';
import {Alerta, VERMELHO} from './estilos/Alerta';
import {Legenda} from './Legenda';
import {LegendaReels} from './LegendaReels';

const ESTILOS = {dossie: Dossie, classico: Classico, reels: Reels, desejo: Desejo, sombra: Sombra, palco3d: Palco3D, viagem: Viagem, iceberg: Iceberg, mapa: Mapa, stick: Stick, whisper: Whisper, alerta: Alerta};

export const Video = ({estilo, idioma, cenas, legendas, trilha, volumeTrilha, sfx, volumeSfx, cor, niveis, marca, variante}: VideoProps) => {
  const Estilo = ESTILOS[estilo] ?? Dossie;
  const {durationInFrames, fps} = useVideoConfig();
  const nivelPorCena = niveisDasCenas(cenas);
  // Com "sfx": true em alguma cena, o som de transição toca só nelas; sem isso, toca em todo corte.
  const sfxMarcado = cenas.some((c) => c.sfx);
  // Trilha entra e sai suave (1,5s e 3s), sem depender de filtro de áudio externo.
  const volumeComFade = (f: number) => volumeTrilha * interpolate(f, [0, fps * 1.5, durationInFrames - fps * 3, durationInFrames], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill style={{backgroundColor: '#000'}}>
      {/* Iceberg: o fundo é um só para o vídeo inteiro, pra câmera descer sem cortar entre cenas. */}
      {estilo === 'iceberg' ? <IcebergFundo cenas={cenas} niveis={niveis ?? []} /> : null}
      {estilo === 'mapa' ? <MapaFundo cenas={cenas} /> : null}
      <Series>
        {cenas.map((cena, i) => (
          <Series.Sequence key={i} durationInFrames={cena.frames}>
            <Estilo cena={cena} indice={i} idioma={idioma} semLegenda={!legendas?.length} cor={cor} niveis={niveis} nivel={nivelPorCena[i]} marca={marca} variante={variante} />
            <Audio src={staticFile(`audio/${cena.audio}`)} />
            {sfx && i > 0 && (!sfxMarcado || cena.sfx) ? <Audio src={staticFile(sfx)} volume={volumeSfx ?? 0.35} /> : null}
          </Series.Sequence>
        ))}
      </Series>
      {estilo === 'viagem' ? <BarraProgresso cor={cor ?? AMARELO} /> : null}
      {legendas?.length ? (estilo === 'reels' ? <LegendaReels blocos={legendas} />
        : estilo === 'alerta' ? <LegendaReels blocos={legendas} cor={VERMELHO} caixa />
        : estilo === 'viagem' ? <LegendaReels blocos={legendas} cor={cor ?? AMARELO} /> : <Legenda blocos={legendas} variante={estilo} />) : null}
      {trilha ? <Audio src={staticFile(trilha)} volume={volumeComFade} loop /> : null}
    </AbsoluteFill>
  );
};
