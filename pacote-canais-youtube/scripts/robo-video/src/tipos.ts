export type Cena = {
  texto: string;
  destaque?: string | null; // texto curto na tela (carimbo, título, número)
  cta?: {palavra: string; depois?: string; alternativa?: string} | null; // Reels: cartão de chamada · Desejo: cartão do produto
  local?: string | null;    // Viagem: etiqueta de lugar com pino no topo
  nivel?: number | null;    // Iceberg: camada da cena (1 = ponta); ausente = mesma camada da cena anterior
  mapa?: MapaCena | null;   // Mapped: foco da câmera, estados acesos e pino; ausente = mesmo mapa da cena anterior
  boneco?: BonecoCena | null; // Stick: cenário, bonecos, objeto e balão da cena
  sfx?: boolean | null;     // som de transição só nesta cena (ver Video.tsx)
  takes: Take[];            // vazio = cartão de texto
  audio: string;            // arquivo dentro de build/audio
  frames: number;
};

export type Take = {
  arquivo: string;          // dentro de build/midia
  tipo: 'foto' | 'video';
  frames: number;
  inicio: number;           // vídeo: frame do clipe onde o take começa
};

// Em frames, tempo absoluto. `palavras` (estilo Reels) traz o tempo de cada palavra pra acender na fala.
export type BlocoLegenda = {texto: string; de: number; ate: number; palavras?: {texto: string; de: number; ate: number}[]};

export type VideoProps = {
  estilo: 'dossie' | 'classico' | 'reels' | 'desejo' | 'sombra' | 'palco3d' | 'viagem' | 'iceberg' | 'mapa' | 'stick' | 'whisper' | 'alerta';
  formato: 'horizontal' | 'vertical';
  idioma: string;               // rótulos fixos do estilo (pt, en, es)
  cenas: Cena[];
  legendas: BlocoLegenda[];
  trilha: string | null;
  volumeTrilha: number;
  sfx?: string | null;          // som curto na entrada de cada cena (transição)
  volumeSfx?: number;
  cor?: string | null;          // cor de destaque (estilos palco3d e viagem)
  niveis?: string[] | null;     // Iceberg: nome de cada camada, da ponta ao fundo
  marca?: string | null;        // Whisper: @ da página gravado embaixo da frase
  variante?: string | null;     // Stick: 'expressivo' = rosto com olho branco, sobrancelha e mais bocas
};

// Estilo Mapped: siglas dos estados ("ID", "MA") ou "US" pro país inteiro.
export type MapaCena = {foco?: string[] | 'US'; marcar?: string[] | 'TODOS'; pino?: {lon: number; lat: number; rotulo?: string} | null};

// Estilo Stick. Poses: parado, fala, aponta, choque, pensa, triste, comemora, segura, liga, le, lupa.
// Expressões: neutro, feliz, triste, preocupado, bravo, surpreso (+ pensativo, confiante na variante expressivo). Acessórios: cabelo, coque, gorro, bone, oculos, medico.
// Objetos: conta, telefone, lupa, dinheiro, livro, calendario, iceberg, navio, canhao, balao, placa_rua (com texto); segura fuzil. Fundos: casa, hospital, escritorio, rua, agua, vazio.
export type Personagem = {x?: number; y?: number; escala?: number; pose?: string; expressao?: string; olha?: 'esq' | 'dir';
  cor?: string; acessorio?: string | null; corAcessorio?: string; segura?: string | null; textoObjeto?: string | null;
  anda?: {de: number; ate: number} | null};
export type BonecoCena = {fundo?: string; personagens?: Personagem[]; multidao?: {n: number; destaque?: number; acessorios?: (string | null)[]} | null;
  objeto?: {tipo: string; x?: number; y?: number; texto?: string} | null; balao?: {quem?: number; texto: string} | null; corTitulo?: string;
  placar?: 'ALTA' | 'MÉDIA' | 'BAIXA' | 'QUASE ZERO' | null;
  placares?: {titulo: string; nivel: number; cor: string}[] | null};
