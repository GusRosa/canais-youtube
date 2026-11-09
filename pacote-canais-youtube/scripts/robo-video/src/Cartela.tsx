import {AbsoluteFill, Img, staticFile} from 'remotion';

// imagens[i] = lista de quadros da opção i: 1 pra foto, 3 (a, b, c) pra vídeo.
export type CartelaProps = {titulo: string; imagens: (string | null)[][]; rotulos?: string[]; colunas?: number};

const Numero = ({n}: {n: number}) => (
  <div style={{position: 'absolute', top: 10, left: 10, background: '#f2c230', color: '#000', fontWeight: 700,
    fontSize: 36, width: 58, height: 58, borderRadius: 29, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2}}>{n}</div>
);

const Quadro = ({arquivo, letra}: {arquivo: string | null; letra?: string}) => (
  <div style={{position: 'relative', flex: 1, background: '#000', overflow: 'hidden'}}>
    {arquivo ? <Img src={staticFile(`midia/${arquivo}`)} style={{width: '100%', height: '100%', objectFit: 'contain'}} /> : null}
    {letra ? <div style={{position: 'absolute', bottom: 6, right: 8, fontSize: 30, fontWeight: 700, color: '#f2c230',
      textShadow: '0 0 6px #000'}}>{letra}</div> : null}
  </div>
);

// Folha de contato pro juiz visual: opções numeradas; em vídeo, 3 momentos do clipe por opção.
export const Cartela = ({titulo, imagens, rotulos = [], colunas = 4}: CartelaProps) => {
  const video = imagens.some(q => q.length > 1);
  return (
    <AbsoluteFill style={{background: '#16161a', padding: 36, fontFamily: 'Helvetica, Arial, sans-serif', color: '#fff'}}>
      <div style={{fontSize: 26, marginBottom: 20, lineHeight: 1.3, opacity: 0.9}}>{titulo}</div>
      <div style={{display: 'grid', gridTemplateColumns: video ? 'repeat(2, 1fr)' : `repeat(${colunas}, 1fr)`,
        gridAutoRows: video ? 'calc((100% - 60px) / 4)' : 'minmax(0, 1fr)', gap: 20, flex: 1}}>
        {imagens.map((quadros, i) => (
          <div key={i} style={{position: 'relative', display: 'flex', gap: 4, background: '#000', borderRadius: 8, overflow: 'hidden'}}>
            <Numero n={i + 1} />
            {quadros.map((q, k) => <Quadro key={k} arquivo={q} letra={quadros.length > 1 ? 'abc'[k] : undefined} />)}
            {rotulos[i] ? (
              <div style={{position: 'absolute', top: 14, left: 80, fontSize: 20, padding: '3px 10px',
                background: 'rgba(0,0,0,0.75)', borderRadius: 4}}>{rotulos[i]}</div>
            ) : null}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};
