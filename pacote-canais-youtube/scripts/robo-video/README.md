# Robô de vídeo

Roteiro em cenas → narração → imagem por cena → edição (Remotion) → MP4 + SRT.
Horizontal 1920×1080 (YouTube) ou vertical 1080×1920 (Reels, Shorts, TikTok).
Roda local. A skill `/video-longo` conduz o fluxo completo.

## Instalação (uma vez)

```bash
cd scripts/robo-video && npm install
```

Na primeira renderização o Remotion baixa um Chrome próprio (~95 MB). Não precisa de FFmpeg do sistema:
o Remotion traz um em `node_modules/@remotion/compositor-darwin-arm64/` (sem filtros de áudio como fade).

## Uso

```bash
node gerar.mjs <pasta>               # renderiza video.mp4 + video.srt + creditos.md
node gerar.mjs <pasta> --candidatos  # cartelas com as opções de imagem numeradas, por cena
node gerar.mjs <pasta> --conferir    # 1 PNG por cena pra revisar antes do render
npm run estudio                      # editor visual do Remotion (mexer nos estilos)
python3 juntar_cartelas.py <cartelas> <saida>   # junta cartelas de 2 em 2 pra revisão
```

A `<pasta>` precisa de um `cenas.json` (ver `exemplo/cenas.json`). Campos por cena:
`texto` (narração), `busca` (termo de busca, em inglês), `tipo` (`foto` ou `video`), `destaque` (texto na tela),
`escolha` (número da opção na cartela; em vídeo, lista com momento: `["2b", "5a"]`; `0` = cartão de texto),
`imagem_local` (foto ou vídeo próprio).
No topo: `idioma` (`pt` padrão, `en`, `es`: muda os rótulos fixos do estilo, como "ARQUIVO Nº"), `velocidade` (voz: `1` normal, `1.1` = 10% mais rápida, ElevenLabs aceita 0.7 a 1.2), `midia_padrao` (`foto` ou `video`), `take_max` (segundos por take de vídeo, padrão 5), `formato` (`horizontal` padrão, ou `vertical`), `legenda_na_tela` (padrão: só no vertical),
`estilo` (`dossie`, `classico`, `reels` ou `palco3d`), `cor_destaque` (só `palco3d`: cor do aro, das partículas e da faixa, padrão `#f2c230`), `fontes_midia`, `voz`, `ajustes_voz` (ElevenLabs: stability, style…), `trilha` (mp3/wav na pasta),
`volume_trilha`, `sfx_transicao` e `volume_sfx` (som na entrada de cada cena), `respiro` (pausa entre cenas, padrão 0.35s),
`palavras_por_bloco` (legenda do Reels). Cena no estilo `reels` aceita `cta: {palavra, depois?, alternativa?}`.

Tudo tem cache em `build/`: mudar uma cena regenera só a voz dela.

## Fornecedores (chaves no `.env` da raiz)

| Fonte | Tipo | Chave no `.env` |
|---|---|---|
| Wikimedia Commons | fotos e vídeos (pouco vídeo, muito histórico) | não precisa |
| Openverse | fotos (Flickr, museus), só licença comercial + modificação | não precisa |
| Internet Archive, coleção Prelinger | filmes de 1930 a 1970 | não precisa |
| Pexels | fotos e vídeos de banco | `PEXELS_API_KEY` (gratuita) |
| Pixabay | fotos e vídeos de banco | `PIXABAY_API_KEY` (gratuita) |
| ElevenLabs / OpenAI | voz | `ELEVENLABS_API_KEY` / `OPENAI_API_KEY` |

Fonte sem chave é pulada sozinha. Ordem padrão: fotos `wikimedia, openverse, pexels, pixabay`;
vídeos `pexels, pixabay, wikimedia, archive`. Muda com `fontes_foto` / `fontes_video` no topo ou
`fontes` na cena (vídeo histórico: `["wikimedia", "archive"]`).

Wikimedia Commons não precisa de chave. As imagens são CC ou domínio público: os créditos
saem em `creditos.md` e vão na descrição do YouTube.

## Vídeo por cena

Cena com `"tipo": "video"` vira takes de até 5s, um clipe diferente por take (cena de 8s = 2 takes).
Na cartela, cada opção de vídeo mostra 3 momentos do clipe (a = 20%, b = 50%, c = 80%) e o juiz escolhe
opção + momento. Se a busca não achar vídeo, a cena cai pra foto sozinha. O `--conferir` tira 1 PNG
por take. Clipes antigos da Wikimedia vêm em baixa resolução: funcionam no Dossiê (moldura, sépia), não
em tela cheia no Clássico.

## Clipe longo

Vídeo com mais de 30s (filmes da Archive, Wikimedia de minutos) não é baixado inteiro:
`lib/corte.mjs` baixa só o trecho do take pelo FFmpeg do Remotion. A Archive é lenta e às vezes
trava num pedido de trecho: o robô espera até 60s, tenta 2 vezes e, se falhar, avisa e a cena
fica sem aquele take. Nesse caso, escolher outra opção. Os cortes ficam em cache em `build/midia/`.

A prévia da Archive é de ~15 quadros por filme: o take começa no segundo da prévia, mas a cena do
filme pode mudar logo depois. Por isso o `--conferir` é obrigatório com clipe da Archive.

## Estrutura

- `gerar.mjs` orquestra tudo
- `lib/narrar.mjs` voz · `lib/midia.mjs` busca nas 5 fontes e download · `lib/corte.mjs` trecho de clipe longo · `lib/wav.mjs` duração do áudio
- `src/estilos/` um componente React por estilo de edição (`Dossie.tsx`, `Classico.tsx`) e `Takes.tsx` (toca foto ou vídeo)
- `src/Cartela.tsx` folha de opções pro juiz visual
- `src/Video.tsx` monta as cenas, a legenda e a trilha (com entrada de 1,5s e saída de 3s automáticas)
- `src/estilos/Classico.tsx` também desenha o cartão de texto (cena sem mídia): fundo escuro com brilho,
  fio amarelo e o `destaque` grande; sem `destaque`, mostra a narração em letra pequena
- `src/estilos/Palco3D.tsx` estilo 3D (base: template React Three Fiber do Remotion). A mídia vira a tela
  de um painel 3D com aro colorido que entra girando e flutua sobre fundo escuro com partículas; cartão
  de texto ganha sólidos em arame girando atrás da frase. Usa WebGL, então o `gerar.mjs` renderiza com
  `gl: 'angle'` só nesse estilo. Pacotes: `@remotion/three`, `@remotion/media`, `three`, `@react-three/fiber`

## Estilo Iceberg

`"estilo": "iceberg"` desenha um iceberg em camadas e a câmera desce a cada camada nova. No topo do
`cenas.json`, `"niveis": ["Nome da camada 1", ...]` (da ponta ao fundo). Em cada cena, `"nivel": n` marca
onde a camada começa; as cenas seguintes herdam. Cena antes do nível 1 (abertura) fica com o iceberg inteiro.
A mídia aparece num cartão à direita, com o `destaque` embaixo; cena sem mídia mostra o destaque grande.

## Estilo Mapped

`"estilo": "mapa"` desenha o mapa dos EUA (us-atlas + d3-geo) contínuo no vídeo inteiro. Em cada cena,
`"mapa": {"foco": ["ID"] | "US", "marcar": ["ID"] | "TODOS", "pino": {"lon": -116.2, "lat": 43.62, "rotulo": "Boise, Idaho"}}`.
A câmera voa até o foco, os estados marcados acendem em amarelo ("TODOS" acende de oeste a leste) e o pino
vermelho mostra rótulo e coordenadas. Cena sem `mapa` herda a anterior. Mídia (se houver) entra num cartão
no canto direito e o mapa se desloca pra esquerda.

## Estilo Stick

`"estilo": "stick"`: bonequinhos desenhados em código (`src/estilos/Boneco.tsx`), cenário chapado, título em
Luckiest Guy e balão em Patrick Hand. Cada cena descreve o quadro em `"boneco"`:
`{"fundo": "casa|hospital|escritorio|rua|agua|vazio", "personagens": [{"x": 0.4, "pose": "fala", "expressao": "preocupado",
"acessorio": "coque", "cor": "#e8322e", "segura": "conta", "anda": {"de": 0.1, "ate": 0.5}}], "objeto": {"tipo": "calendario",
"texto": "30"}, "balao": {"quem": 0, "texto": "..."}, "multidao": {"n": 20, "destaque": 13}}`.
Poses, expressões, acessórios e objetos listados em `src/tipos.ts`. `"variante_stick": "expressivo"` no topo do
`cenas.json` troca o rosto (olho branco com pupila, sobrancelha sempre, bocas com dentes, corado, suor, lágrima, raiva;
expressões extras `pensativo` e `confiante`, automáticas nas poses pensa e aponta). Acrescentar `pintado` (`"expressivo pintado"`) liga o acabamento com céu em degradê,
montanhas em camadas, luz e sombra nos volumes, chão com textura, sombra na roupa, vinheta e granulação (cenários
`andes`, `piramide`, `mata`, `casa`, `vazio`; os outros caem no desenho normal).
Cenários `andes` e `piramide`; acessórios `inca` e `maya`; objetos `papa`, `mazorca`, `quipu`, `llama`, `vasija`, `cacao`, `codice`, `bola`. Manter o mesmo protagonista (cor + acessório)
no vídeo todo.

## Renderizar de novo sem gastar voz

`node renderizar.mjs <pasta> [--estilo iceberg] [--quadros 30,400]` usa o `build/props.json` já pronto
(áudio e mídia em `build/`). Serve para trocar de estilo ou testar um estilo novo num vídeo existente.

## Disco

O `bundle()` do Remotion copia a pasta `build/` (com toda a mídia) pro temporário do sistema a cada
execução. O `gerar.mjs` apaga essa cópia ao sair (antes, sobravam ~600 MB por vídeo). Vídeo publicado:
pode apagar `build/midia`, `build/cartelas`, `build/conferir`, `build/pares`; manter `build/audio`.
