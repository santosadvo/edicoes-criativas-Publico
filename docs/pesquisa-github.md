# Pesquisa: ferramentas de edição de vídeo para agentes (nov/2026)

Antes de escrever o manual de direção criativa, foram analisados 12 repositórios
públicos de edição de vídeo por agente de IA. Todos foram lidos com o código
desativado: nada foi instalado nem executado. O critério foi único: **o que ensina
a editar melhor um vídeo vertical de uma pessoa falando para a câmera**.

## Veredito por repositório

| Repositório | O que é | Licença | Veredito |
|---|---|---|---|
| [nateherkai/herk-edit-kit](https://github.com/nateherkai/herk-edit-kit) | Kit de edição de reels (HyperFrames + GSAP) | MIT | **Aprender.** O `docs/EDITING-PLAYBOOK.md` tem as melhores medidas de ritmo de talking-head. |
| [Tejashmakwana/motionmaxxing](https://github.com/Tejashmakwana/motionmaxxing) | Filmes de marca em HTML; estudo de 53 momentos profissionais | Apache-2.0 | **Aprender.** Tabela de 12 curvas medidas; "corte no movimento"; nenhum quadro morto. |
| [Vincentwei1021/video-shotcraft](https://github.com/Vincentwei1021/video-shotcraft) | 124 receitas de planos em Remotion | Apache-2.0 | **Incorporado** em `skill/references/shotcraft/`, com licença e aviso. |
| [Remocn/remocn](https://github.com/Remocn/remocn) | ~780 componentes Remotion (transições, legendas, fundos) | MIT | **Fonte sob demanda.** Copiar um componente por vez; não usar o MCP nem o instalador. |
| [remotion-dev/skills](https://github.com/remotion-dev/skills) | Skills oficiais do Remotion | — | **Instalar/atualizar** (`remotion-best-practices`). |
| [JuneYaooo/rea-video](https://github.com/JuneYaooo/rea-video) | Decompõe qualquer vídeo plano a plano | Apache-2.0 | **Aprender.** Método de análise de referência (papel narrativo por plano, gancho, destaques). |
| [jordanrendric/claude-video-vision](https://github.com/jordanrendric/claude-video-vision) | Plugin para "assistir" vídeos | MIT | **Pular o plugin** (roda `npx …@latest` sem versão fixa); copiado só o procedimento barato→caro com filtros do ffmpeg. |
| [OpenMontageInc/OpenMontage](https://github.com/OpenMontageInc/OpenMontage) | Sistema completo de produção | AGPL-3.0 | **Só ideias.** Por ser AGPL, nada foi copiado; as regras foram reescritas. |
| [lemomo-ai/lemo-opuscar](https://github.com/lemomo-ai/lemo-opuscar) | 99 estilos de filme em código | MIT + CC BY-NC | **Pular.** O instalador baixa muito código; os textos são não comerciais. |
| [av/remotion-bits](https://github.com/av/remotion-bits) | Componentes animados para Remotion | MIT (sem arquivo) | **Pular** (o Remocn cobre o mesmo, maior). |
| [iart-ai/motion-skills](https://github.com/iart-ai/motion-skills) | README de marketing de serviço pago | MIT | **Pular.** |
| [zhuyansen/awesome-claude-video-skills](https://github.com/zhuyansen/awesome-claude-video-skills) | Lista curada de 180+ skills de vídeo | — | **Índice** para próximas pesquisas. |

## Próximos candidatos (da lista curada, ainda não analisados)

- [kurbaitaev/ghost-editor](https://github.com/kurbaitaev/ghost-editor): gravação bruta de talking-head entra, reel pronto sai.
- [YeJe-cpu/SeeCut](https://github.com/YeJe-cpu/SeeCut): editor que assiste o próprio corte (revisão automática).
- [echris6/motion-video-kit](https://github.com/echris6/motion-video-kit): crítico independente e princípios de movimento.
- [Vibha-Ramprakash/claude-video-effects](https://github.com/Vibha-Ramprakash/claude-video-effects): 51 efeitos com rastreamento de rosto.
- [hassancs91/claude-youtube-editor](https://github.com/hassancs91/claude-youtube-editor): corte de talking-head com biblioteca de efeitos sonoros.

## O que entrou no manual

Tudo está em [`skill/references/creative-direction.md`](../skill/references/creative-direction.md):

- **Roteiro de batidas:** cada trecho tem um papel e um visual próprio.
- **Ritmo medido:** algo muda a cada 1–3 s; o primeiro corte cai entre 0,6 e 1 s.
- **Gramática de movimento:** a entrada desacelera, a saída acelera, nada nasce do zero e o corte cai no meio do movimento.
- **Som:** a trilha fica cerca de 11 dB abaixo da voz, e o efeito sonoro só entra em evento visível.
- **Checagens antes de entregar** e o método para estudar um vídeo de referência.
