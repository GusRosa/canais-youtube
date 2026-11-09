import {Composition} from 'remotion';
import {Video} from './Video';
import type {VideoProps} from './tipos';
import {Cartela} from './Cartela';

const padrao: VideoProps = {estilo: 'dossie', formato: 'horizontal', idioma: 'pt', cenas: [], legendas: [], trilha: null, volumeTrilha: 0.12};

export const Root = () => (
  <>
  <Composition
    id="Video"
    component={Video as any}
    width={1920}
    height={1080}
    fps={30}
    durationInFrames={300}
    defaultProps={padrao}
    calculateMetadata={({props}: {props: VideoProps}) => ({
      durationInFrames: Math.max(30, props.cenas.reduce((total, c) => total + c.frames, 0)),
      ...(props.formato === 'vertical' ? {width: 1080, height: 1920} : {width: 1920, height: 1080}),
    })}
  />
  <Composition id="Cartela" component={Cartela as any} width={1920} height={1080} fps={30} durationInFrames={1}
    defaultProps={{titulo: '', imagens: []}} />
  </>
);
