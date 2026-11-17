# Adaptar questão a partir do banco

## Objetivo

A criação de quiz ganha um segundo modo. Nesse modo, o servidor busca no banco uma família de até três questões da mesma habilidade e pede ao modelo uma questão nova, no tema, na série e na dificuldade pedidos. A habilidade e o raciocínio correto permanecem. Tema, redação e números podem mudar dentro dos limites gravados na questão.

O modo atual, gerar a questão do zero, continua disponível e é o padrão.

O mesmo trabalho inclui a página em que uma questão pública, ou uma questão transcrita por você, entra no banco. A entrada é por texto ou por foto.

## Contexto

Hoje `POST /api/generate-question` manda série, assunto, temática, dificuldade e uma nota opcional ao Groq. A resposta é um JSON com `question`, `options` (5), `correctIndex` e `explanation`. O professor aceita ou recusa, ajusta a dificuldade da próxima e salva o quiz. O jogador, em `app.js`, lê só esses quatro campos.

A série na tela vai do 1º ao 9º ano. A dificuldade visível tem cinco rótulos: muito fácil, fácil, médio, difícil, muito difícil.

## Decisões

- O banco guarda o esqueleto da habilidade, com enunciado neutro. A temática entra só na reescrita.
- Dificuldade 1–10 é a dificuldade dentro da faixa de série da questão. Se o pedido cai fora da faixa de um item, a busca escolhe outra semente.
- A busca filtra assunto, série e dificuldade. O vetor entra só quando o professor escreveu uma nota e há embeddings disponíveis. Ele compara a nota com o embedding do item (`skill` + enunciado neutro). A temática não entra nesse texto.
- A família tem no máximo 3 questões com a mesma string de `skill` e a mesma `theme_policy`. Se só existir uma, segue com uma. A família não é completada com outra habilidade.
- Questão de cenário intercambiável (`reskin`) troca o cenário pelo tema pedido. Questão de fato (`wording`) mantém o fato e só ajusta vocabulário e complexidade.
- A rota continua `POST /api/generate-question`, com um campo `mode`.
- O formulário oferece as séries até o pós-médio. No gerador livre, a única mudança de texto é usar o rótulo e o estágio certos (fundamental, médio ou pós-médio).
- Banco vazio não troca o modo da sessão. A tela oferece gerar só aquela questão do zero.
- Toda questão do banco foi escrita por uma pessoa. A entrada é manual: questão pública da internet, ou questão que você transcreve. Questão redigida pelo modelo fica de fora do banco.

## Origem

Cada item traz a procedência:

| Campo | Papel |
| --- | --- |
| `origin` | `public` ou `manual` |
| `source_label` | Texto curto da fonte: endereço da questão pública ou uma descrição da que você inseriu |

A busca ignora item sem um desses valores. Gerar do zero, adaptar e salvar o quiz não escrevem em `question_bank`. A questão aceita no quiz permanece só no JSON do quiz. Quem escreve no banco é a página de inclusão, e só com o que você envia depois de revisar.

## Fora de escopo

- Como os embeddings dos itens são calculados e gravados. A inclusão grava `embedding` nulo. Este spec só embute a nota do professor na hora da busca.
- Códigos da BNCC, índice ANN e um banco vetorial separado.
- Mudar o fluxo de jogar, aceitar, recusar ou salvar.

## O item

Cada questão do banco tem:

| Campo | Papel |
| --- | --- |
| `id` | Identificador estável |
| `subject` | Matemática, Português, Geografia, História, Ciências, Inglês, Física, Química, Biologia |
| `grade_min`, `grade_max` | Índices inclusivos. A série pedida precisa cair dentro da faixa |
| `difficulty` | Inteiro de 1 a 10, dentro da faixa de série |
| `skill` | Uma frase. É a chave da família e o texto principal do embedding |
| `skill_tags` | Lista curta, só para leitura e depuração. Não completa família |
| `theme_policy` | `reskin` ou `wording` |
| `stem` | Enunciado neutro |
| `options` | Quatro ou cinco alternativas, como na questão de origem |
| `correct_index` | Índice da correta, de 0 a 4 |
| `explanation` | O conceito, em linguagem neutra |
| `invariant.preserve` | Lista de frases que a reescrita tem de obedecer, inclusive limites numéricos |
| `distractors` | Lista de `{ "index", "error" }` com o tipo de erro de cada alternativa errada |
| `embedding` | Vetor opcional de 1536 dimensões, de `skill` + `stem`. Nulo é válido |
| `origin` | `public` ou `manual` |
| `source_label` | Procedência, texto não vazio |
| `status` | `draft` ou `usable`. A busca só lê `usable` |

No rascunho, alternativas e gabarito podem estar incompletos. Item utilizável tem quatro ou cinco alternativas e um `correct_index` válido.

Índice de série:

| Índice | Rótulo | Estágio no prompt |
| --- | --- | --- |
| 1–9 | 1º ano … 9º ano | ensino fundamental |
| 10–12 | 1º ano do médio … 3º ano do médio | ensino médio |
| 13 | Pós-médio | pós-médio |

Dificuldade pedida, a partir dos rótulos que a tela já usa:

| Rótulo | Alvo |
| --- | --- |
| muito fácil | 2 |
| fácil | 4 |
| médio | 6 |
| difícil | 8 |
| muito difícil | 10 |

## Busca

`retrieveFamily(query, rng)` recebe `subject`, `gradeIndex`, `difficultyTarget`, `note`, `excludeIds`, `usedSkills` e um gerador aleatório injetável.

1. A janela começa em ±1 em torno do alvo.
2. Os candidatos têm o assunto pedido, `grade_min <= série <= grade_max`, dificuldade dentro da janela, `status = usable`, `origin` em `public` ou `manual`, `source_label` não vazio e `id` fora de `excludeIds`.
3. Com menos de 3 candidatos e janela menor que ±3, a janela abre um ponto por vez: primeiro ±2, depois ±3.
4. Zero candidatos produz o resultado vazio.
5. Com nota não vazia e embeddings configurados, os candidatos que têm vetor sobem pela similaridade de cosseno entre o embedding da nota e o embedding da questão. Candidato sem vetor fica no fim.
6. Sem nota, ou sem embeddings, a ordem é a distância absoluta até o alvo. Empate na mesma distância é aleatório.
7. A lista curta são os 8 primeiros.
8. Habilidade já aceita neste quiz pesa 0,25. As outras pesam 1. A âncora é um sorteio com esses pesos.
9. Os irmãos são outros candidatos com a mesma `skill` e a mesma `theme_policy`, até 2. Enunciado igual ao da âncora vem depois. A proximidade da dificuldade desempata.
10. A família é a âncora mais os irmãos. Tamanho de 1 a 3.

`excludeIds` são os ids já mostrados nesta sessão, aceitos ou recusados. `usedSkills` são as habilidades das questões aceitas. Recusar não bane a habilidade.

## Reescrita

O modelo de chat continua o Groq já configurado. A temperatura deste modo é 0,4. O modo livre permanece em 0,8.

O prompt inclui o rótulo da série, o estágio, o assunto, a temática, o rótulo da dificuldade, a nota quando existir, e cada membro da família: enunciado, alternativas, texto da correta, explicação, habilidade, `theme_policy`, frases de `invariant.preserve` e os tipos de erro dos distratores.

A instrução pede uma questão nova que:

- teste a mesma habilidade;
- não copie um enunciado da família;
- obedeça cada frase de `preserve`;
- siga a `theme_policy` da família (`reskin` troca o cenário; `wording` conserva o fato e não o substitui pelo tema);
- tenha exatamente cinco alternativas e uma correta;
- faça as erradas expressarem os tipos de erro listados, em qualquer ordem;
- quando a família tiver quatro alternativas, crie a quinta como mais um distrator de um tipo de erro já listado;
- use redação adequada à série.

A saída do modelo é o mesmo JSON de hoje. O servidor acrescenta `sourceIds` (os ids da família), `skill` (a habilidade da âncora) e `mode: "bank"`. Esses três campos não vêm do modelo.

A extração de JSON hoje em `server.js` passa para `lib/parse-question.js` e serve aos dois modos. A validação estrutural continua: enunciado, cinco opções, `correctIndex` de 0 a 4, explicação com um texto padrão se vier vazia. Enunciado idêntico ao de um membro da família conta como resposta inválida. Resposta inválida dispara uma nova tentativa. Na segunda falha, a rota responde erro.

O item no banco usa os nomes da tabela acima. A questão entregue ao navegador usa o camelCase que o jogador já lê: `question`, `options`, `correctIndex`, `explanation`.

## API

`POST /api/generate-question`

Modo livre (`mode` ausente ou `"free"`): o corpo atual, com `serie` no índice de 1 a 13. A resposta continua só com `question`, `options`, `correctIndex` e `explanation`. O prompt usa o rótulo e o estágio da tabela, então o 2º ano do médio não aparece como ensino fundamental e o pós-médio não aparece como "13º ano".

Modo banco:

```json
{
  "mode": "bank",
  "serie": 4,
  "assunto": "Matemática",
  "tematica": "Pokemon",
  "dificuldade": "médio",
  "nota": "quero conta de vezes",
  "excludeIds": ["math-mul-001"],
  "usedSkills": ["Somar dois números de um dígito"]
}
```

`serie` é o índice de 1 a 13. Resposta de sucesso:

```json
{
  "question": "...",
  "options": ["...", "...", "...", "...", "..."],
  "correctIndex": 2,
  "explanation": "...",
  "sourceIds": ["math-mul-002", "math-mul-003"],
  "skill": "Multiplicar dois números de um dígito, produto até 50",
  "mode": "bank"
}
```

Erros do modo banco, com corpo `{ "error", "code" }`:

| Situação | HTTP | `code` |
| --- | --- | --- |
| Nenhum candidato depois da janela ±3 | 422 | `bank_empty` |
| Supabase desligado e arquivo local ausente | 503 | `bank_unavailable` |
| JSON inválido depois da segunda tentativa | 500 | o erro já usado hoje |
| `GROQ_API_KEY` ausente | 500 | o erro já usado hoje |
| Leitura do banco falha (tabela ausente, rede, arquivo ilegível) | 503 | `bank_unavailable` |
| Embedding configurado devolve vetor com tamanho diferente de 1536 | 500 | erro explícito de dimensão |

O quiz salvo pode guardar `sourceIds`, `skill` e `mode` em cada questão. `app.js` ignora esses campos.

## Tela

Na configuração, um par de opções:

- Gerar do zero, selecionado por padrão
- Adaptar do banco

O seletor de série passa a listar os índices 1 a 13, com os rótulos da tabela. O título da sessão usa o texto da opção escolhida.

O seletor de assunto usa a mesma lista do item, inclusive Física, Química e Biologia. Os botões de dificuldade, a nota, aceitar, recusar e finalizar ficam como estão. O texto de espera no modo banco é "Adaptando pergunta do banco...".

O cliente guarda os `sourceIds` já mostrados e as `skill` aceitas e os reenvia. Aceitar uma questão livre, vinda do botão de reserva, não acrescenta habilidade.

Para `bank_empty` e `bank_unavailable`, a área da pergunta mostra a mensagem e um botão "Gerar esta do zero". Esse botão chama a rota com `mode: "free"` uma vez, com a mesma série, assunto, temática, dificuldade e nota, e não muda o modo da sessão.

## Página de inclusão

A página é `incluir.html`, com `incluir.js`, reusando `styles.css` e `criar.css`. A configuração de `criar.html` aponta para ela com o link "Incluir questão no banco". Não há login novo: o acesso é o mesmo do restante do servidor.

A foto não fica gravada. O banco recebe o texto que você confirma.

### Formulário

O topo pede a procedência, `public` ou `manual`, e o `source_label`. Os dois são obrigatórios.

Em seguida há dois jeitos de preencher a questão. Digitar o enunciado e as alternativas, ou escolher uma foto e usar "Ler foto". A foto aceita é JPEG, PNG ou WebP, até 8 MB, uma por vez. "Ler foto" chama a extração e preenche o formulário. Essa chamada não grava nada.

O restante do formulário, editável nos dois caminhos:

- assunto, na mesma lista do item
- série mínima e série máxima, índices 1 a 13, com os rótulos da tabela
- dificuldade, de 1 a 10
- habilidade e etiquetas
- política de tema, com os rótulos "Pode trocar o cenário" (`reskin`) e "Manter o fato" (`wording`)
- enunciado
- alternativas, com a correta marcada. Dá para acrescentar e tirar. O rascunho pode ter menos de quatro. O item utilizável exige quatro ou cinco
- explicação
- uma frase de limite por linha, gravada em `invariant.preserve`
- o tipo de erro de cada alternativa errada

"Guardar rascunho" grava `status: "draft"`. Para isso bastam procedência, `source_label` e enunciado. "Incluir no banco" grava `status: "usable"` e só segue quando o item passa na validação completa. O botão fica desabilitado enquanto faltar campo.

A validação de um item utilizável exige procedência válida, `source_label` não vazio, assunto da lista, faixas de série com mínimo menor ou igual ao máximo, dificuldade de 1 a 10, habilidade, `theme_policy`, enunciado, quatro ou cinco alternativas preenchidas, `correct_index` válido, explicação, ao menos uma frase em `preserve` e um tipo de erro para cada alternativa errada.

Abaixo do formulário, a lista troca entre "Rascunhos" e "No banco". Os dois abrem o item no mesmo formulário. Dá para atualizar e dá para excluir. A lista vem sem o campo `embedding`, a mais recente primeiro.

Digitar a questão não chama modelo nenhum. As sugestões da foto aparecem no formulário para você corrigir. O que é gravado é o conteúdo do formulário no momento do envio.

### Extração da foto

`POST /api/extract-question` recebe `{ "imageDataUrl": "data:image/jpeg;base64,..." }`. O servidor recusa outro tipo ou arquivo acima de 8 MB com 400 e `code: "invalid_image"`.

A chamada usa a mesma chave e o mesmo endpoint de chat do Groq. O modelo padrão é `qwen/qwen3.8-27b`, trocável por `GROQ_VISION_MODEL`. A mensagem leva o texto e a imagem em `image_url`. A temperatura é 0,1 e a resposta pede JSON.

O prompt manda transcrever enunciado e alternativas como estão impressos. Não reescreve, não traduz, não simplifica e não cria alternativa. `correct_index` só vem preenchido quando a imagem mostra o gabarito. A explicação só vem quando a imagem mostra a resolução. Habilidade, série, dificuldade, política de tema, limites e tipos de erro voltam à parte, como sugestão.

A resposta separa as duas coisas:

```json
{
  "transcription": {
    "stem": "Uma pessoa tem 3 pacotes. Cada pacote tem 5 itens. Quantos itens há no total?",
    "options": ["8", "12", "15", "18"],
    "correct_index": null,
    "explanation": ""
  },
  "suggestions": {
    "subject": "Matemática",
    "grade_min": 4,
    "grade_max": 5,
    "difficulty": 4,
    "skill": "Multiplicar dois números de um dígito",
    "skill_tags": ["multiplicação"],
    "theme_policy": "reskin",
    "preserve": ["Os dois fatores continuam de um dígito e o produto é o total."],
    "distractors": [
      { "index": 0, "error": "soma em vez de produto" }
    ]
  }
}
```

JSON inválido depois de duas tentativas, ou transcrição sem enunciado, responde 422 e `code: "extract_failed"`. O formulário permanece como estava.

### Rotas que gravam

Estas são as únicas rotas que escrevem em `question_bank`. O servidor gera o `id` com UUID. `embedding` sai nulo.

| Rota | Efeito |
| --- | --- |
| `GET /api/question-bank?status=draft` ou `status=usable` | Lista os itens daquele status, sem `embedding`. Sem `status`, responde 400 |
| `POST /api/question-bank` | Cria o item. Corpo sem `id`. `status` é `draft` ou `usable` |
| `PUT /api/question-bank/:id` | Substitui o item existente. O `id` da URL prevalece |
| `DELETE /api/question-bank/:id` | Remove o item |

Item utilizável inválido responde 400 e `code: "invalid_item"`. Rascunho sem procedência, sem `source_label` ou sem enunciado também. `id` desconhecido no `PUT` e no `DELETE` responde 404.

No arquivo local, a escrita lê `question_bank/items.json`, inclui ou substitui pelo `id` e grava de novo. Ausência do arquivo na primeira inclusão cria o array. No Supabase, a mesma operação é um upsert na tabela `question_bank`.

## Armazenamento

A leitura e a escrita usam a mesma fonte.

Com `SUPABASE_URL` e `SUPABASE_KEY`, a tabela `question_bank` no Postgres já usado pelo projeto, com a extensão pgvector. Colunas iguais aos campos do item. `invariant` e `distractors` são `jsonb`. `embedding` é `vector(1536)`, nulo permitido. A ordenação por cosseno é exata dentro do conjunto filtrado.

Sem Supabase, a fonte é `question_bank/items.json`, um array de itens. Na busca, a ausência do arquivo é `bank_unavailable`. A primeira inclusão cria o arquivo. Array vazio, ou nenhum item aceito pela busca, é `bank_empty`.

Embeddings da nota usam um endpoint compatível com a API de embeddings da OpenAI:

- `EMBEDDING_API_URL`
- `EMBEDDING_API_KEY`
- `EMBEDDING_MODEL`, padrão `text-embedding-3-small`, 1536 dimensões

Sem essas variáveis, a busca não ranqueia por vetor. A nota segue só para o prompt de reescrita. Vetor de nota com tamanho diferente de 1536 não é usado para reordenar: a rota do modo banco responde 500 com erro de dimensão.

A tabela não é exposta ao navegador. O servidor usa a mesma chave Supabase de hoje.

## Módulos

- `lib/grades.js` — índice, rótulo, estágio e alvo de dificuldade
- `lib/parse-question.js` — extração e validação estrutural do JSON
- `lib/question-bank.js` — `retrieveFamily`, validação, lista, criação, atualização, exclusão e a leitura ou escrita no Supabase ou no arquivo
- `lib/adapt-question.js` — montagem do prompt e chamada ao Groq
- `lib/extract-question.js` — leitura da foto pelo modelo visual e separação entre transcrição e sugestão
- `server.js` — escolhe o ramo pelo `mode`, mantém `generateQuestion` para o modo livre e expõe as rotas do banco
- `criar.html` e `criar.js` — modo, séries, estado da sessão e o link para a inclusão
- `incluir.html` e `incluir.js` — formulário, foto, rascunho e confirmação

## Testes

A busca é testada com itens fixos e um `rng` determinístico:

- a série pedida cai dentro de `grade_min` e `grade_max`;
- item `draft`, sem `origin` válida ou sem `source_label`, fica de fora;
- a janela abre de ±1 até ±3, um ponto por vez, para ao chegar a 3 candidatos e não passa de ±3;
- `excludeIds` não volta;
- a família tem uma só `skill` e uma só `theme_policy`, com tamanho de 1 a 3;
- habilidade presente em `usedSkills` sai menos vezes no sorteio da âncora;
- com nota e embeddings, a habilidade mais próxima da nota fica à frente de outra do mesmo filtro;
- sem configuração de embedding, a nota não reordena os candidatos.

O construtor do prompt é testado com uma família fixa: o texto contém a habilidade, as frases de `preserve`, a `theme_policy` e a temática, e pede uma questão nova. Com uma família de quatro alternativas, o texto pede a quinta como distrator de um tipo já listado.

O construtor do prompt da foto pede transcrição fiel e proíbe criar alternativa. O interpretador mantém `correct_index` nulo quando a resposta não traz gabarito.

A rota, com Groq e embeddings substituídos:

- `mode` livre devolve o JSON antigo, sem `sourceIds`;
- `mode` banco devolve `sourceIds`, `skill` e `mode`;
- banco sem candidatos devolve 422 e `bank_empty`;
- gerar, adaptar e salvar o quiz não escrevem em `question_bank`;
- `POST /api/extract-question` não escreve no banco;
- `POST /api/question-bank` com item válido grava `usable`, e com campos obrigatórios faltando responde 400;
- um rascunho exige procedência, `source_label` e enunciado, e pode seguir sem gabarito.

## Critérios de aceite

- Com o modo padrão, criar um quiz produz o mesmo tipo de questão de hoje, e o prompt de uma série do médio não chama essa série de ensino fundamental.
- No modo banco, cada pergunta mostrada vem de uma família de uma habilidade, e a questão nova entra no quiz pelo mesmo aceitar de hoje.
- Recusar não repete os ids já mostrados.
- Aceitar várias questões espalha as habilidades: as já aceitas pesam menos na próxima âncora.
- Sem candidatos, a tela oferece gerar só aquela do zero e a sessão continua no modo banco.
- Um quiz salvo com os campos extras abre e joga em `index.html`.
- Gerar, adaptar e salvar o quiz não inserem questão no banco. Questão gerada ou adaptada permanece só no quiz.
- Na página de inclusão, uma foto preenche o formulário e só entra no banco depois de "Incluir no banco". O enunciado gravado é o que ficou no formulário.
