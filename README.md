# Kruang — certificados de graduação de Muay Thai

Aplicação web que transforma a lista de alunos aptos (Word, Excel ou CSV) nos certificados de graduação prontos para imprimir, preservando o certificado original criado no InDesign/Illustrator.

Tudo roda no navegador: não há servidor, banco de dados, login nem envio de dados para a internet. O site é estático e pode ser hospedado de graça (GitHub Pages, Cloudflare Pages ou qualquer hospedagem de arquivos).

## Como o professor usa

1. **Importar** — arrasta a lista de alunos aptos (`.docx`, `.xlsx` ou `.csv`). A aplicação identifica nomes, graduações e o resumo do pedido de kruangs, se houver.
2. **Conferir** — revisa a lista agrupada por graduação: corrige nomes, troca graduações, adiciona ou remove alunos. Itens que precisam de atenção ficam marcados (graduação não reconhecida, nomes repetidos, nome com uma palavra só etc.).
3. **Configurar** — informa a data e o local do exame e escolhe como os nomes aparecem. A prévia ao lado já é o PDF real.
4. **Gerar** — navega pelos certificados na prévia, baixa um individual ou gera todos: um ZIP com um PDF por aluno (`certificado-maria-oliveira.pdf`) e um PDF único com todas as páginas para a gráfica.

O trabalho é salvo automaticamente neste navegador. Se a página for fechada, a lista em andamento é oferecida para continuar na próxima visita.

## Formatos de lista reconhecidos

- **Nomes sob o título da graduação** (o formato usual em Word): cada título de graduação vale para os nomes abaixo dele até o próximo título. Aceita listas numeradas do Word, numeração digitada (`1.`, `01 -`, `3)`), numeração contínua entre graduações e graduações sem alunos.
- **Tabela** com uma coluna de nome e outra de graduação, com ou sem cabeçalho, em Excel, CSV ou tabela do Word. Quando há colunas de graduação “atual” e “pretendida”, a pretendida é escolhida — e o professor pode trocar a coluna.
- **Planilhas com várias abas**: a aba com mais alunos é selecionada e as outras ficam disponíveis.
- **CSV** com vírgula, ponto e vírgula ou tabulação, em UTF-8, UTF-16 ou Windows-1252 (o padrão do Excel no Brasil).

Variações de grafia são normalizadas (`AZUL CLARO`/`Azul-claro`, `MARRON`/`MARROM`, `Branco`/`Branca`, `PONTA`/`PONTEIRA`). Erros de digitação são corrigidos apenas quando não há ambiguidade e sempre ficam marcados para confirmação (ex.: `GRAL PRETO` → Preta). Seções de resumo do pedido de kruangs não são confundidas com alunos e servem para conferir a contagem. Nenhuma linha é descartada em silêncio: o que não foi entendido aparece para o professor incluir ou ignorar.

## Rodar localmente

Requer Node.js 20.9 ou superior.

```bash
npm ci
npm run dev
```

Abra http://localhost:3000.

| Script | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Gera o site estático em `out/` |
| `npm run preview` | Serve `out/` em http://localhost:4173 |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript em modo estrito |
| `npm test` | Testes unitários (Vitest) |
| `npm run test:e2e` | Testes de interface (Playwright) sobre o build estático |

Antes da primeira execução dos testes de interface: `npx playwright install chromium`.

## Publicar

### GitHub Pages

O workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) roda lint, tipos, testes unitários e de interface e publica o site a cada push na `main`.

1. Envie o repositório para o GitHub.
2. Em **Settings → Pages**, escolha **Source: GitHub Actions**.
3. Faça um push na `main`. O endereço será `https://<usuário>.github.io/<repositório>/`.

O workflow define `NEXT_PUBLIC_BASE_PATH=/<repositório>` automaticamente. Para um domínio próprio (servido na raiz), remova essa variável do workflow.

### Cloudflare Pages

- Comando de build: `npm run build`
- Pasta de saída: `out`
- Variável de ambiente: `NODE_VERSION=22`

### Qualquer outra hospedagem estática

Rode `npm run build` e envie o conteúdo de `out/`. Se o site ficar em um subcaminho (ex.: `/certificados`), gere com `NEXT_PUBLIC_BASE_PATH=/certificados npm run build`.

## O modelo do certificado

O certificado original está em [`public/templates/certificado-rl-fight-team.pdf`](public/templates/certificado-rl-fight-team.pdf). Cada certificado gerado copia essa página sem alterações e escreve por cima apenas os campos variáveis, com a fonte **Tinos** (métricas idênticas à Times New Roman usada no original, licença OFL, embutida no PDF com acentuação completa).

- **Nome** e **graduação** ficam sobre as linhas em branco do modelo.
- A frase **“em exame realizado no dia …, em ….”** vem impressa no PDF original com uma data fixa. Um retângulo branco, desenhado dentro da faixa branca que já existe atrás dessa frase, cobre o texto antigo, e a frase é redesenhada com a data e o local informados, centralizada no mesmo ponto.
- Textos longos diminuem automaticamente até o tamanho mínimo de cada campo. Se mesmo assim não couberem, a prévia e a tela final avisam.

As posições, fontes, tamanhos e cores ficam em [`src/lib/pdf/template.ts`](src/lib/pdf/template.ts), com coordenadas em pontos do PDF.

### Ajustar sem editar código

Na etapa **Configurar**, o botão **Ajustar posições** abre o modo de calibração: os campos aparecem sobre a prévia real e podem ser arrastados, redimensionados ou movidos com as setas do teclado (Shift = 10 pt, Alt = largura). Os ajustes ficam salvos no navegador. **Exportar** gera um JSON com as posições; para torná-las padrão para todos, copie o conteúdo de `layout` para `RL_FIGHT_TEAM_LAYOUT`.

### Trocar o modelo

**Usar outro PDF** aceita um novo certificado em PDF (ele fica guardado apenas no navegador e as posições são adaptadas ao tamanho da página para calibração). Para trocar o modelo padrão de todos, substitua o arquivo em `public/templates/` e ajuste `BUILT_IN_TEMPLATES` em `src/lib/pdf/template.ts`.

## Graduações

A lista de graduações, a ordem e as cores dos kruangs ficam em [`src/lib/graduations/catalog.ts`](src/lib/graduations/catalog.ts). O reconhecimento de variações de grafia, a interface e o texto impresso derivam dessa lista.

## Arquitetura

```
src/
  lib/                     lógica pura, sem React (testada com Vitest)
    import/                leitura (DOCX, XLSX, CSV), classificação de linhas e interpretação
    graduations/           catálogo e reconhecimento de graduações
    validation/            pendências por aluno e conferência com o resumo de kruangs
    students/              modelo de aluno, agrupamento e ordenação
    certificate/           dados do exame (data em pt-BR, local) e valores impressos
    pdf/                   modelo, ajuste tipográfico, geração (pdf-lib), lote e ZIP
    browser/               downloads, armazenamento local, PDF.js e execução em Web Worker
  state/                   sessão (persistida no navegador), modelo ativo e prévia
  components/              interface das quatro etapas, calibração e componentes base
  workers/                 geração em lote fora da thread da interface
tests/                     testes unitários com DOCX/XLSX/CSV gerados em memória
e2e/                       testes de interface (Playwright)
```

Bibliotecas pesadas (Mammoth, read-excel-file, Papa Parse, pdf-lib, PDF.js) são carregadas sob demanda.

## Privacidade

Os arquivos são lidos e os PDFs são gerados no próprio navegador. A lista em andamento fica salva apenas no armazenamento local deste navegador e pode ser descartada a qualquer momento. Os testes usam listas fictícias; não versione listas reais de alunos.

## Licenças de terceiros

- Fonte Tinos — SIL Open Font License 1.1 ([`public/fonts/OFL-Tinos.txt`](public/fonts/OFL-Tinos.txt)).
