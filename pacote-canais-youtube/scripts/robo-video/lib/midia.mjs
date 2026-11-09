import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const UA = 'RoboVideo/0.1';

// Busca candidatos nas fontes configuradas, na ordem. Cada candidato:
// {url, largura, altura, credito, fonte}
export async function buscarCandidatos(busca, fontes) {
  const todos = [];
  for (const fonte of fontes) {
    try {
      if (fonte === 'wikimedia') todos.push(...await wikimedia(busca));
      if (fonte === 'openverse') todos.push(...await openverse(busca));
      if (fonte === 'pexels' && process.env.PEXELS_API_KEY) todos.push(...await pexels(busca));
      if (fonte === 'pixabay' && process.env.PIXABAY_API_KEY) todos.push(...await pixabay(busca));
    } catch (e) {
      console.warn(`  ! ${fonte} falhou para "${busca}": ${e.message}`);
    }
  }
  return todos;
}

// Momentos do clipe mostrados na cartela (a, b, c). O juiz escolhe "3b" = opção 3 começando no momento b.
export const MOMENTOS = [0.2, 0.5, 0.8];

// Mesma ideia pra vídeo. Cada candidato traz também {tipo: 'video', duracao, quadros: [a, b, c]}.
// `vertical` pede arquivo em pé na Pexels (na Wikimedia quase tudo é horizontal).
export async function buscarVideos(busca, fontes, vertical = false) {
  const todos = [];
  for (const fonte of fontes) {
    try {
      if (fonte === 'wikimedia') todos.push(...await wikimediaVideos(busca));
      if (fonte === 'archive') todos.push(...await archiveVideos(busca));
      if (fonte === 'pexels' && process.env.PEXELS_API_KEY) todos.push(...await pexelsVideos(busca, vertical));
      if (fonte === 'pixabay' && process.env.PIXABAY_API_KEY) todos.push(...await pixabayVideos(busca));
    } catch (e) {
      console.warn(`  ! vídeo ${fonte} falhou para "${busca}": ${e.message}`);
    }
  }
  return todos;
}

// A Wikimedia não tem filtro de conteúdo adulto e a busca por termo genérico já trouxe vídeo explícito.
// Descarta pelo título/crédito; a revisão humana da cartela continua obrigatória.
const IMPROPRIO = /\b(nud(e|ity)|naked|porn|sex(ual)?|erotic|masturbat|ejaculat|semen|penis|penile|vagina|genital|breast|nipple|fetish|bdsm|xxx|gore|corpse|beheading)\w*/i;
const proprio = c => !IMPROPRIO.test(`${c.credito ?? ''} ${c.url ?? ''}`);

// Vídeo: aceita resolução baixa (filmagem histórica), mas exige duração pra caber um take.
export function filtrarVideos(candidatos, limite = 8) {
  return intercalar(candidatos.filter(proprio).filter(c => c.duracao >= 4 && c.largura >= 320)).slice(0, limite);
}

// Alterna as fontes (1º da Pexels, 1º da Wikimedia, 2º da Pexels…), mantendo a ordem de relevância
// dentro de cada uma. Assim a cartela mostra todas as fontes em vez de 8 opções da primeira.
function intercalar(candidatos) {
  const porFonte = new Map();
  for (const c of candidatos) porFonte.set(c.fonte, [...(porFonte.get(c.fonte) ?? []), c]);
  const filas = [...porFonte.values()];
  const saida = [];
  while (filas.some(f => f.length)) for (const f of filas) if (f.length) saida.push(f.shift());
  return saida;
}

// Mantém só imagens horizontais e grandes o bastante pra 1080p, na ordem de relevância da busca.
export function filtrarValidos(candidatos, limite = 8) {
  candidatos = candidatos.filter(proprio);
  const bons = candidatos.filter(c => c.largura >= 1000 && c.largura / c.altura >= 1.2);
  const aceitaveis = candidatos.filter(c => !bons.includes(c) && c.largura >= 800);
  return [...intercalar(bons), ...intercalar(aceitaveis)].slice(0, limite);
}

export async function baixar(candidato, pastaMidia, campo = 'url') {
  const url = candidato[campo];
  const ext = (url.split('?')[0].match(/\.(jpe?g|png|webp|webm|mp4)$/i)?.[1] ?? 'jpg').toLowerCase();
  const nome = `${crypto.createHash('md5').update(url).digest('hex').slice(0, 12)}.${ext}`;
  const destino = path.join(pastaMidia, nome);
  if (!fs.existsSync(destino)) {
    const res = await fetch(url, {headers: {'User-Agent': UA}});
    if (!res.ok) throw new Error(`download ${res.status}`);
    fs.writeFileSync(destino, Buffer.from(await res.arrayBuffer()));
  }
  return nome;
}

async function wikimedia(busca) {
  const params = new URLSearchParams({
    action: 'query', format: 'json', generator: 'search', gsrnamespace: '6', gsrlimit: '12',
    gsrsearch: `${busca} filetype:bitmap`, prop: 'imageinfo', iiprop: 'url|size|extmetadata', iiurlwidth: '1920',
  });
  const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, {headers: {'User-Agent': UA}});
  const dados = await res.json();
  const paginas = Object.values(dados.query?.pages ?? {}).sort((a, b) => a.index - b.index);
  return paginas.map(p => {
    const info = p.imageinfo?.[0];
    if (!info?.thumburl) return null;
    const meta = info.extmetadata ?? {};
    const limpar = s => (s ?? '').replace(/<[^>]+>/g, '').trim();
    return {
      url: info.thumburl,
      miniatura: info.thumburl.replace(/\/\d+px-/, '/500px-'),
      largura: info.thumbwidth,
      altura: info.thumbheight,
      fonte: 'wikimedia',
      credito: `${p.title.replace(/^File:/, '')}, ${limpar(meta.Artist?.value) || 'autor desconhecido'}, ${limpar(meta.LicenseShortName?.value) || 'licença na página'}, ${info.descriptionurl}`,
    };
  }).filter(Boolean);
}

async function pexels(busca) {
  const res = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(busca)}&orientation=landscape&per_page=10`,
    {headers: {Authorization: process.env.PEXELS_API_KEY}});
  const dados = await res.json();
  return (dados.photos ?? []).map(f => ({
    url: f.src.large2x,
    miniatura: f.src.medium,
    largura: 1880,
    altura: Math.round(1880 * f.height / f.width),
    fonte: 'pexels',
    credito: `Foto de ${f.photographer} no Pexels, ${f.url}`,
  }));
}

async function wikimediaVideos(busca) {
  const params = new URLSearchParams({
    action: 'query', format: 'json', generator: 'search', gsrnamespace: '6', gsrlimit: '12',
    gsrsearch: `${busca} filetype:video`, prop: 'videoinfo', viprop: 'url|size|derivatives|extmetadata', viurlwidth: '500',
  });
  const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, {headers: {'User-Agent': UA}});
  const dados = await res.json();
  const paginas = Object.values(dados.query?.pages ?? {}).sort((a, b) => a.index - b.index);
  const limpar = s => (s ?? '').replace(/<[^>]+>/g, '').trim();
  return paginas.map(p => {
    const info = p.videoinfo?.[0];
    if (!info?.duration) return null;
    // Versão convertida em WebM VP9: a de 720p se existir, senão a maior abaixo disso (o original pode ter 200 MB).
    const webms = (info.derivatives ?? []).filter(d => /webm/.test(d.type) && /vp9/.test(d.type) && d.width)
      .sort((a, b) => a.width - b.width);
    const arquivo = webms.filter(d => d.width <= 1280).at(-1) ?? webms[0];
    if (!arquivo) return null;
    const meta = info.extmetadata ?? {};
    // A miniatura da Wikimedia aceita "seek=<segundo>": quadro do momento exato, sem baixar o vídeo.
    const quadrosSeg = MOMENTOS.map(m => Math.floor(info.duration * m));
    const quadros = quadrosSeg.map(seg => info.thumburl.replace(/\/(\d+)px--/, `/$1px-seek=${seg}-`));
    return {
      tipo: 'video',
      url: arquivo.src,
      miniatura: info.thumburl,
      quadros,
      quadrosSeg,
      largura: arquivo.width,
      altura: Math.round(arquivo.width * info.height / info.width),
      duracao: info.duration,
      fonte: 'wikimedia',
      credito: `${p.title.replace(/^File:/, '')}, ${limpar(meta.Artist?.value) || 'autor desconhecido'}, ${limpar(meta.LicenseShortName?.value) || 'licença na página'}, ${info.descriptionurl}`,
    };
  }).filter(Boolean);
}

async function pexelsVideos(busca, vertical) {
  const res = await fetch(`https://api.pexels.com/videos/search?query=${encodeURIComponent(busca)}&orientation=${vertical ? 'portrait' : 'landscape'}&per_page=12`,
    {headers: {Authorization: process.env.PEXELS_API_KEY}});
  const dados = await res.json();
  return (dados.videos ?? []).map(v => {
    // Arquivo MP4 mais próximo de 1080p sem passar dele (4K pesa e não melhora o resultado).
    const lado = f => (vertical ? f.height : f.width);
    const mp4s = v.video_files.filter(f => f.file_type === 'video/mp4' && f.width).sort((a, b) => lado(a) - lado(b));
    const arquivo = mp4s.filter(f => lado(f) <= 1920).at(-1) ?? mp4s[0];
    if (!arquivo) return null;
    // A Pexels manda ~15 quadros espalhados pelo clipe: pega os mais próximos de cada momento.
    const fotos = v.video_pictures ?? [];
    const quadros = MOMENTOS.map(m => fotos[Math.min(fotos.length - 1, Math.round(m * (fotos.length - 1)))]?.picture ?? v.image);
    return {
      tipo: 'video',
      url: arquivo.link,
      miniatura: v.image,
      quadros,
      largura: arquivo.width,
      altura: arquivo.height,
      duracao: v.duration,
      fonte: 'pexels',
      credito: `Vídeo de ${v.user?.name ?? 'autor'} no Pexels, ${v.url}`,
    };
  }).filter(Boolean);
}

// Openverse: agrega Flickr, museus e outros acervos abertos. Só licenças que permitem uso comercial
// E modificação (canal monetizado + recorte/filtro no vídeo): BY, BY-SA, CC0 e domínio público.
async function openverse(busca) {
  const params = new URLSearchParams({q: busca, license: 'by,by-sa,cc0,pdm', page_size: '20', mature: 'false'});
  const res = await fetch(`https://api.openverse.org/v1/images/?${params}`, {headers: {'User-Agent': UA}});
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const dados = await res.json();
  return (dados.results ?? []).filter(r => r.width && r.height).map(r => ({
    url: r.url,
    miniatura: r.thumbnail,
    largura: r.width,
    altura: r.height,
    fonte: 'openverse',
    credito: `${r.title || 'sem título'}, ${r.creator || 'autor desconhecido'}, ${r.license.toUpperCase()} ${r.license_version ?? ''}, ${r.foreign_landing_url}`.replace(/ ,/g, ','),
  }));
}

// Pixabay: banco de fotos e vídeos, uso comercial liberado sem atribuição (a gente credita mesmo assim).
async function pixabay(busca) {
  const params = new URLSearchParams({key: process.env.PIXABAY_API_KEY, q: busca, image_type: 'photo',
    orientation: 'horizontal', per_page: '20', safesearch: 'true'});
  const res = await fetch(`https://pixabay.com/api/?${params}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const dados = await res.json();
  return (dados.hits ?? []).map(h => ({
    url: h.largeImageURL, // até 1280 px de largura
    miniatura: h.webformatURL,
    largura: Math.min(1280, h.imageWidth),
    altura: Math.round(Math.min(1280, h.imageWidth) * h.imageHeight / h.imageWidth),
    fonte: 'pixabay',
    credito: `Foto de ${h.user} no Pixabay, ${h.pageURL}`,
  }));
}

async function pixabayVideos(busca) {
  const params = new URLSearchParams({key: process.env.PIXABAY_API_KEY, q: busca, per_page: '20', safesearch: 'true'});
  const res = await fetch(`https://pixabay.com/api/videos/?${params}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const dados = await res.json();
  return (dados.hits ?? []).map(h => {
    // "large" costuma ser 4K (até 150 MB): pega o maior que não passe de 1080p.
    const opcoes = [h.videos?.large, h.videos?.medium, h.videos?.small].filter(v => v?.url);
    const arquivo = opcoes.find(v => v.width <= 1920) ?? opcoes.at(-1);
    if (!arquivo) return null;
    // A Pixabay só manda 1 quadro por vídeo: a cartela mostra esse, e a escolha vale pelo momento a.
    return {
      tipo: 'video',
      url: arquivo.url,
      miniatura: arquivo.thumbnail,
      quadros: [arquivo.thumbnail],
      largura: arquivo.width,
      altura: arquivo.height,
      duracao: h.duration,
      fonte: 'pixabay',
      credito: `Vídeo de ${h.user} no Pixabay, ${h.pageURL}`,
    };
  }).filter(Boolean);
}

// Internet Archive, só a coleção Prelinger: filmes institucionais, educativos e caseiros dos anos
// 1930 a 1970, curados e liberados. O resto da Archive tem licença declarada por quem subiu, sem garantia.
// Os filmes são longos: o robô baixa só o trecho do take (lib/corte.mjs).
async function archiveVideos(busca) {
  const params = new URLSearchParams({q: `(${busca}) AND mediatype:movies AND collection:prelinger`, rows: '8', output: 'json'});
  params.append('fl[]', 'identifier');
  params.append('fl[]', 'title');
  const res = await fetch(`https://archive.org/advancedsearch.php?${params}`, {headers: {'User-Agent': UA}});
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const itens = (await res.json()).response?.docs ?? [];

  const segundos = v => String(v ?? '').split(':').reduce((t, p) => t * 60 + Number(p), 0);
  const detalhados = await Promise.all(itens.map(async item => {
    try {
      const meta = await (await fetch(`https://archive.org/metadata/${item.identifier}`, {headers: {'User-Agent': UA}})).json();
      const base = `https://archive.org/download/${item.identifier}/`;
      // MP4 de maior resolução até 1080p.
      const mp4s = (meta.files ?? []).filter(f => /\.mp4$/i.test(f.name) && f.width && f.length)
        .sort((a, b) => Number(a.width) - Number(b.width));
      const arquivo = mp4s.filter(f => Number(f.width) <= 1920).at(-1) ?? mp4s[0];
      if (!arquivo) return null;
      const duracao = segundos(arquivo.length);
      // Quadros de prévia que a Archive já gera: o número no nome é o segundo do filme.
      const previas = (meta.files ?? []).filter(f => f.format === 'Thumbnail')
        .map(f => ({url: base + encodeURI(f.name), seg: Number(f.name.match(/_(\d{6})\.jpg$/)?.[1] ?? NaN)}))
        .filter(q => !Number.isNaN(q.seg));
      if (!previas.length) return null;
      const perto = alvo => previas.reduce((m, q) => (Math.abs(q.seg - alvo) < Math.abs(m.seg - alvo) ? q : m));
      const escolhidas = MOMENTOS.map(m => perto(duracao * m));
      return {
        tipo: 'video',
        url: base + encodeURI(arquivo.name),
        miniatura: escolhidas[0].url,
        quadros: escolhidas.map(q => q.url),
        quadrosSeg: escolhidas.map(q => q.seg),
        largura: Number(arquivo.width),
        altura: Number(arquivo.height),
        duracao,
        fonte: 'archive',
        credito: `${item.title}, Prelinger Archives, ${meta.metadata?.licenseurl ?? 'domínio público (ver página)'}, https://archive.org/details/${item.identifier}`,
      };
    } catch {
      return null;
    }
  }));
  return detalhados.filter(Boolean);
}
