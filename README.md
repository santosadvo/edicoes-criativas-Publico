# Edições Criativas

Uma skill para o [Claude Code](https://claude.com/claude-code) que transforma uma
gravação bruta de celular (uma pessoa falando para a câmera) num **Reels editado
de verdade**: corte apertado, zoom a cada trecho, gancho, gráficos animados ligados
ao que é dito, tela dividida, crash zoom, whip, placa de nome, legenda animada,
trilha e efeitos sonoros.

Você fala **"edições criativas"** e entrega o vídeo. O agente faz o resto.

Baseada no **edvid** (Creator Factory, MIT) e na variante **CRVID** (Thiago
Carrascossi Ramos, MIT). Esta versão acrescenta um **manual de direção criativa**,
gráficos e efeitos de câmera reutilizáveis e uma biblioteca de 124 receitas de
planos. Todos os créditos e licenças estão preservados em `skill/LICENSE` e em
`skill/references/shotcraft/`.

---

## O que vem de novo em relação ao edvid

| Recurso | Onde | O que faz |
|---|---|---|
| **Diretor criativo (agente)** | `skill/agents/video-director.md` | Lê a transcrição e os quadros, inventa 3 conceitos próprios do vídeo, recusa o que já foi usado e escreve o roteiro de batidas com efeitos NOVOS. É o que impede a edição de sair sempre igual |
| Registro anti-repetição | `skill/creative-ledger.md` | O que cada vídeo entregue usou; o diretor lê os 3 últimos |
| Efeitos na própria imagem | `fx[]` | 20 efeitos oficiais do `@remotion/effects` (térmico, halftone, pixelização, aberração cromática, sinal de TV…) aplicados ao vídeo numa janela de tempo |
| Família Espelho | `mirrorTurn`, `mirrorFold`, `syncDrift`, `endFreeze`… | Rosto dobrado em simetria, quadro que gira como espelho, boca atrasada, túnel de espelhos, congelamento com a voz continuando |
| Manual de direção | `skill/references/creative-direction.md` | Roteiro de batidas, ritmo medido, curvas de movimento, som, checagens, como estudar um vídeo de referência |
| `gfx:terminal` | tela dividida | Janela de app/terminal digitando um comando e executando etapas |
| `gfx:versus` | tela dividida | "A = B" ou "A vs B", com linha de escaneamento e porcentagem |
| `gfx:connect` | tela dividida | Dois nós ligados por uma linha pulsante e um selo que estoura na palavra-chave |
| `gfx:counter` | tela dividida | Número que rola até o valor |
| `gfx:bigword` | tela dividida | Palavras que batem na tela com desfoque que limpa |
| `punches[]` | câmera | Crash zoom com tremor de impacto e separação RGB |
| `whips[]` | câmera | Corte no movimento: sai acelerando com borrão, entra já em movimento |
| `nameTags[]` | sobreposição | Placa de nome com selo |
| `references/shotcraft/` | receitas | 124 planos do video-shotcraft (Apache-2.0) para criar efeitos novos |

Tudo é descrito por **dados** em `edit-data.json`. Nenhum tempo fica escrito no código.
Veja o exemplo completo em [`examples/edit-data.exemplo.json`](examples/edit-data.exemplo.json).

## Instalação

Você precisa de `uv`, `ffmpeg`, `node` (18+) e do Claude Code.

```bash
brew install uv ffmpeg node
```

```bash
git clone https://github.com/santosadvo/edicoes-criativas-Publico.git
```

```bash
mkdir -p ~/.claude/skills && cp -R edicoes-criativas-Publico/skill ~/.claude/skills/edvid
```

```bash
cd ~/.claude/skills/edvid && uv sync
```

A transcrição roda na sua máquina, sem chave de API. As chaves opcionais (imagens
por IA, banco de imagens, trilha por IA) vão em `~/.claude/skills/edvid/.env`; o
modelo é o `.env.example`. Detalhes em `skill/install.md`.

## Como usar

1. Ponha o vídeo numa pasta e abra o Claude Code nela.
2. Diga: **"edições criativas neste vídeo"**.
3. O agente transcreve, aperta o corte, chama o **diretor criativo**, que
   inventa um conceito só deste vídeo e escreve o roteiro de batidas, monta os gráficos, renderiza e confere os quadros antes
   de entregar `edit/final.mp4`.
4. Peça ajustes em linguagem normal: "troca o gráfico do meio", "mais zoom no
   final", "tira o whip".

Para ensinar o agente que "edições criativas" é a sua palavra-chave em qualquer
sessão, adicione ao seu `~/.claude/CLAUDE.md`:

```markdown
Quando eu disser "edições criativas", use a skill edvid e leia
references/creative-direction.md: edição completa e dirigida
(zoom, gráficos, transições, trilha), nunca só corte e legenda.
```

## Como foi feito

O manual saiu de uma pesquisa em 12 repositórios de edição por agente. Cada um
foi lido sem executar nada e avaliado em técnica, licença e segurança. O
relatório completo, com o veredito de cada um e os próximos candidatos, está em
[`docs/pesquisa-github.md`](docs/pesquisa-github.md).

## Licença

MIT. Veja `skill/LICENSE` (Creator Factory e CRVID) e
`skill/references/shotcraft/LICENSE` (Apache-2.0, video-shotcraft).
