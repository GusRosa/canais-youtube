# Pacote de canais de YouTube

Antes de executar uma tarefa, verificar se existe skill relevante em `.claude/skills/` e seguir as instruções dela.

- `/radar`: pesquisa de temas e concorrência.
- `/modelar-canal`: análise de canal de referência e adaptação de títulos.
- `/video-longo`: roteiro, narração, imagens, edição, miniatura e textos de publicação.
- Cada canal fica em `canais/<Nome>/`, com um `CLAUDE.md` baseado em `modelos/CLAUDE-canal.md`. Ele vale acima deste arquivo.
- Sempre aprovar roteiro e fontes com o usuário antes de gerar a voz, porque a voz gasta crédito.
- Número, estudo, data ou citação sem fonte no `fontes.md` do vídeo não entra no vídeo.
- Sem travessão na narração, no texto da tela e na descrição.
