# Sete Povos

Protótipo de **tactics por turnos em hexágonos** sobre o mapa de uma redução jesuítica. Você comanda
três defensores (lanceiro, arqueiro e curandeira) contra quatro invasores que avançam sobre a praça
da igreja. É um puzzle tático: sem sorte, todo dano é fixo e mostrado antes de você agir.

Feito com Phaser 3 + TypeScript + Vite. Toda a arte (hexes isométricos 2.5D, árvores, igreja,
unidades "chunky") é gerada por código; os sons são sintetizados com Web Audio.

**GitHub Pages:** https://dunkelhai.github.io/sete-povos/

## Como jogar

- **Objetivo:** eliminar os 4 invasores em até **8 turnos**.
- **Derrota:** perder as 3 unidades, ou terminar o turno 8 com invasores de pé.
- Em cada turno, cada unidade sua pode **mover e depois agir** (atacar, usar a habilidade ou esperar).
  Depois de agir ela fica acinzentada. Quando todas agiram, o turno termina sozinho (ou aperte E).
- Os invasores então agem um a um: cada um ataca a unidade sua de **menor vida atual** que consiga
  alcançar; se não alcança ninguém, aproxima-se da de menor vida.

### Cores dos hexes

| Cor                   | Significado                                            |
| --------------------- | ------------------------------------------------------ |
| Turquesa              | para onde a unidade selecionada pode mover             |
| Vermelho              | alcance de ataque (forte = há um inimigo atacável ali) |
| Amarelo               | área da habilidade (modo habilidade)                   |
| Borda branca pulsante | cursor                                                 |
| Pontinhos brancos     | caminho planejado                                      |

Passe o mouse (ou o cursor do teclado) sobre um alvo para ver a **previsão**: dano, vida resultante e
"ABATE!" quando o golpe derruba.

### Terrenos

| Terreno        | Custo de movimento | Linha de visão                                                                                |
| -------------- | ------------------ | --------------------------------------------------------------------------------------------- |
| Campo          | 1                  | livre                                                                                         |
| Mata (árvores) | **2**              | **bloqueia** tiros que passam por ela (dá para atirar de dentro dela ou num alvo dentro dela) |
| Muro / igreja  | intransponível     | bloqueia                                                                                      |

### Unidades

| Unidade                | Vida | Mov. | Alcance | Dano | Habilidade (recarga em turnos)                                                                                                                                       |
| ---------------------- | ---- | ---- | ------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lanceiro               | 16   | 3    | 1       | 5    | **Estocada** (2): atinge os 2 hexes em linha numa direção (4 de dano cada) e empurra o 1º alvo 1 hex; se o empurrão for bloqueado (muro, unidade, borda), +2 de dano |
| Arqueiro               | 10   | 3    | 1–4     | 4    | **Tiro perfurante** (3): linha reta de até 5 hexes, 5 de dano em cada inimigo; atravessa mata, para no muro                                                          |
| Curandeira             | 11   | 4    | 1       | 2    | **Chá de ervas** (2): cura 6 em si mesma ou num aliado adjacente                                                                                                     |
| Saqueador (inimigo) ×2 | 10   | 3    | 1       | 4    | —                                                                                                                                                                    |
| Fundeiro (inimigo)     | 7    | 3    | 2–3     | 3    | — (atira pedras, precisa de visão)                                                                                                                                   |
| Capitão (inimigo)      | 14   | 2    | 1       | 5    | —                                                                                                                                                                    |

Ataques à distância (alcance > 1) precisam de linha de visão. Unidades atravessam aliados, mas não
inimigos. Todos os números estão em `src/config/balance.ts`.

## Controles

| Ação                                                             | Mouse                                                    | Teclado                                              |
| ---------------------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------- |
| Mover o cursor                                                   | mover o mouse                                            | Setas / WASD                                         |
| Selecionar / mover / atacar / confirmar                          | clique esquerdo                                          | Z / Espaço (Enter também)                            |
| Alternar modo habilidade                                         | botão "Habilidade"                                       | X / Shift                                            |
| Cancelar (sai da habilidade → desfaz o movimento → desseleciona) | clique direito                                           | Backspace (ou X quando não há habilidade disponível) |
| Esperar (encerra a ação da unidade)                              | botão "Esperar" ou clicar na própria unidade selecionada | Z / Espaço sobre a própria unidade                   |
| Próxima unidade                                                  | —                                                        | Q / Tab                                              |
| Encerrar turno                                                   | botão "Encerrar turno"                                   | E                                                    |
| Pausa (com opção "Reduzir tremor/flash")                         | —                                                        | Esc                                                  |
| Reiniciar                                                        | —                                                        | R                                                    |

**Sobre o X/Shift:** com a unidade selecionada, X entra no modo habilidade (hexes amarelos); X de novo
volta ao modo normal. Se a habilidade estiver em recarga ou sem alvos, X funciona como **cancelar**
(desfaz o movimento ainda não confirmado por uma ação, ou desseleciona).

## Como rodar

```bash
npm install
npm run dev
```

Abra http://localhost:5173/sete-povos/ (o `base` do Vite é `/sete-povos/` por causa do GitHub Pages).

### Scripts

| Script            | O que faz                                     |
| ----------------- | --------------------------------------------- |
| `npm run dev`     | servidor de desenvolvimento (Vite)            |
| `npm run build`   | `tsc --noEmit` + build de produção em `dist/` |
| `npm run preview` | serve o `dist/` localmente                    |
| `npm run lint`    | ESLint + Prettier (`--check`)                 |
| `npm run format`  | formata tudo com Prettier                     |

### Debug / QA

Abra com `?debug=1` (ex.: http://localhost:5173/sete-povos/?debug=1):

| Tecla | Efeito                                          |
| ----- | ----------------------------------------------- |
| F1    | vitória imediata (abate todos os invasores)     |
| F2    | derrota imediata (abate todas as suas unidades) |
| F3    | abate um invasor aleatório                      |
| F4    | liga/desliga o contador de FPS                  |

Sem `?debug=1` nada disso fica ativo. O `Phaser.Game` fica em `window.__game`; o estado do combate em
`__game.scene.getScene('Game').battle` (classe `Battle`, lógica pura sem Phaser, em
`src/systems/battle.ts`).

## Estrutura

```
src/
  main.ts                 aguarda as fontes e cria o Phaser.Game (window.__game)
  config/balance.ts       TODAS as constantes de balanceamento
  config/map.ts           mapa 9×7 desenhado à mão + posições iniciais
  style/palette.ts        paleta (STYLE_GUIDE, seção sete-povos)
  systems/hex.ts          coordenadas axiais, distância, linha hex, pixel↔hex
  systems/battle.ts       regras: Dijkstra de movimento, visão, ataques, habilidades, IA
  systems/textures.ts     arte gerada por código (generateTexture)
  systems/audio.ts        efeitos sonoros com Web Audio
  systems/ui.ts           botões, painéis, helpers de tween
  entities/UnitView.ts    visual da unidade (sprite, barra de vida, flash, glow)
  scenes/                 Boot, Title, Game (mapa + HUD + turnos), Pause
```

## Créditos

- Código e arte: gerados por código para este protótipo (sem assets externos).
- Fontes: [Alegreya SC](https://fonts.google.com/specimen/Alegreya+SC) e
  [Baloo 2](https://fonts.google.com/specimen/Baloo+2), via Google Fonts (SIL Open Font License).
- Engine: [Phaser 3](https://phaser.io) (MIT).
- Nomes, personagens e mapa são inventados.

## Decisões

- **Mapa:** 9×7 em "offset" de linhas ímpares deslocadas, convertido para axial na carga. A igreja
  ocupa 2 hexes de muro (`I` no mapa). Jogador começa no canto inferior esquerdo, invasores no
  superior direito, com muros e matas no meio para criar cobertura.
- **Mata:** custa 2 de movimento e bloqueia linha de visão apenas quando está **entre** atirador e
  alvo; atirar de dentro dela ou num alvo dentro dela é permitido. Muros também bloqueiam a visão.
  A linha de visão usa a linha hex com pequeno desvio (epsilon) para desempatar bordas.
- **Sem sorte:** dano fixo, sem acerto/erro, para que a previsão seja exata e o jogo seja um puzzle.
- **Movimento:** Dijkstra com custo por terreno; dá para atravessar aliados, mas não inimigos;
  não é possível terminar num hex ocupado.
- **Mover → agir:** depois de agir a unidade não move mais. O movimento pode ser desfeito
  (clique direito/Backspace) enquanto a unidade não agiu. Selecionar outra unidade depois de mover
  conta como "esperar" para a anterior.
- **Fim automático do turno** quando todas as unidades agiram.
- **Recarga:** "recarga N" = a habilidade volta N turnos depois de usada (recarga 2 → usa no turno 1,
  de novo no turno 3). Usar a habilidade conta como a ação da unidade.
- **Estocada** só é oferecida em direções onde atinge algum inimigo; o mesmo vale para o tiro
  perfurante. O empurrão só acontece se o alvo sobreviver ao dano base.
- **IA:** para cada inimigo, na ordem, procura entre os hexes alcançáveis um de onde possa atacar,
  priorizando o alvo de **menor vida atual** (desempate: o mais próximo) e o hex de menor custo. Se
  ninguém está ao alcance, usa um campo de distâncias até as posições de ataque do alvo de menor vida
  e para no hex livre mais próximo dele.
- **Limite de turnos:** a derrota por tempo acontece ao fim da fase inimiga do turno 8.
- **Balanceamento:** verificado com um bot guloso headless (vence no turno ~5 perdendo uma unidade;
  um bot que só avança perde no turno 4). A ideia é que um humano pensando vença em 5–8 turnos,
  protegendo o arqueiro (vida mais baixa, alvo preferido da IA).
- **Visual:** muro elevado 18 px sobre uma base de 10 px (face lateral total de 28 px) para dar
  altura; campo 10 px e mata 12 px de espessura. As árvores e os muros entram na mesma ordenação
  por profundidade das unidades, então um muro na frente cobre a unidade atrás dele.
- **Postfx:** vinheta de câmera (0.2) e `addGlow` turquesa só na unidade selecionada.
- **Acessibilidade:** a opção "Reduzir tremor/flash" fica no menu de pausa (tecla T) e zera o
  screen shake. Não há flashes de tela cheia no jogo.
- **Sem save:** a preferência de tremor vale só para a sessão.

## Próximos passos

- Pré-visualizar o ataque a partir do hex de destino antes de mover.
- Mais mapas e uma pequena campanha; inimigos com habilidades (ex.: escudo, carga).
- Bônus de defesa na mata e altura do muro como vantagem para o arqueiro.
- Música ambiente leve e mais variações de som.
- Tela de tutorial interativo no primeiro turno.
