# Pacote de canais de YouTube

Skills para o Claude Code que levam um canal da pesquisa ao vídeo pronto para publicar.

| Etapa | O que usar | O que faz |
|---|---|---|
| Criar o canal | `modelos/CLAUDE-canal.md` | Define posicionamento, regras e o teste de validação |
| Pesquisar | `/radar` | Acha vídeos fortes em canais pequenos e checa a concorrência de um tema |
| Modelar | `/modelar-canal` | Analisa um canal de referência e adapta os títulos |
| Escrever o roteiro | `/video-longo` | Escolhe o molde pelo título e escreve roteiro e fontes para você aprovar |
| Produzir e editar | `/video-longo` | Narra, busca e escolhe imagens, edita e entrega MP4, legenda, miniatura e descrição |

## O que você precisa

- Claude Code
- Node.js 22 ou mais novo
- Python 3 com Pillow: `pip3 install pillow`
- yt-dlp, para o `/modelar-canal`: `brew install yt-dlp`
- Cerca de 500 MB livres para a instalação, mais cerca de 1 GB por vídeo em produção
- Chaves: ElevenLabs (voz, paga) e Pixabay ou Pexels (imagens, gratuitas)

## Instalação

1. Baixe o pacote e abra o Claude Code dentro da pasta:
   ```bash
   git clone https://github.com/GusRosa/canais-youtube.git
   cd canais-youtube
   claude
   ```
   Sem git, use **Code > Download ZIP** nesta página e descompacte.
2. Instale o robô de vídeo:
   ```bash
   cd scripts/robo-video && npm install
   ```
3. Na raiz da pasta, copie `.env.exemplo` para `.env` e preencha as chaves.

## Como começar

Peça ao Claude Code, nesta ordem:

1. "Roda o /radar nesses nichos: ..."
2. "/modelar-canal https://www.youtube.com/@canal"
3. "Cria o canal X em `canais/X` usando o modelo"
4. "/video-longo sobre o tema Y"

O Claude mostra o roteiro antes de gerar a voz. Nada é publicado automaticamente: o envio ao YouTube é manual.

## Bom saber

- **Custo:** a ElevenLabs cobra por caractere. Um vídeo de 10 minutos usa cerca de 9 mil caracteres.
- **Tempo:** o render de um vídeo de 10 minutos pode levar mais de 30 minutos. Não feche a sessão enquanto ele roda.
- **Direitos:** confira a licença de cada imagem no `creditos.md` e dê o crédito na descrição quando ela exigir.
- **Radar:** ele lê a busca pública do YouTube, então pode falhar se o YouTube mudar a página.
- **Sistema:** testado no macOS com Apple Silicon. Outros sistemas não foram testados.
