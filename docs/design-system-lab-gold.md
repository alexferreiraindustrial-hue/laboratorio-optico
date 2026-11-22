# Design System Lab Gold

A direção aprovada usa branco quente (#F7F6F3), superfícies brancas, grafite e bronze (#8C6239). Os tokens semânticos ficam no bloco `Lab Gold design system` de `src/app/globals.css`. Aliases de cores legadas continuam disponíveis para evitar regressões nos módulos existentes.

Manrope é a família da interface; IBM Plex Mono permanece para códigos e contadores. Componentes compartilhados em `src/components/ui.tsx` usam raios de controle/painel centralizados, superfície opaca e foco consistente. `MetricStrip` em `lean-ui.tsx` oferece resumo compacto por fila.

| Before | After | Why |
| --- | --- | --- |
| Mármore, preto e efeitos metálicos concorrentes | Fundo uniforme, ações bronze, navegação grafite | Identidade consistente com leitura operacional |
| Tema flutuante sobre ações | Controle no cabeçalho via portal React | Evitar obstrução sem duplicar o estado do tema |
| Superfícies misturadas com branco no modo escuro | Superfície semântica opaca | Preservar contraste |
| Indicadores isolados em Lentes | Faixa de indicadores compartilhada | Economizar espaço |
| Instruções da bancada sempre abertas | Ajuda contextual recolhível | Dar prioridade aos cartões |
| Fontes e controles ampliados globalmente no modo simples | Escala mais controlada e alvos de toque mantidos no celular | Equilibrar legibilidade e densidade |

## Escopo aplicado

Base global de temas e identidade; primitivas compartilhadas; cabeçalho e sidebar; resumo e filtros de Lentes; densidade e ajuda da bancada. Não representa a conclusão de uma revisão individual de todas as 52 rotas. Login, portais e módulos de gestão herdam os tokens/primitivas, mas ainda precisam de revisão visual completa de seus estados autenticados.

Sem mudanças no banco, APIs, permissões ou regras operacionais. Nenhuma alteração em registros reais. Nenhum arquivo de arquivamento previamente não versionado integra esta etapa.

## Verificação em 22/11/2026

- Suite local: 167 testes aprovados (inclui 3 testes locais de arquivos preexistentes não versionados).
- Typecheck e ESLint dos arquivos alterados aprovados após correções; há avisos preexistentes no lint geral.
- Teste de contraste ampliado para pares claros/escuros atuais: aprovado.
- Prévia temporária com componentes reais e dados fictícios: Lentes em janela desktop e tablet; Lentes e Montagem em emulação 390 × 844; alternância claro/escuro conferida. Rota temporária removida.
- Capturas locais em `outputs/design-audit-2026-11-22/after` na raiz do chat. Não publicar capturas de dados reais. As capturas com dados fictícios não são uma comparação controlada dos mesmos registros da produção.
- Build webpack compilou, validou TypeScript e gerou páginas. A primeira execução apresentou `SecurityFatalError`, emitido pelo Next instalado. O comando foi repetido dentro do prazo previsto pelo Next e terminou com sucesso. O aviso de atualização do framework continua existente; a dependência Next não foi alterada nesta reformulação.

## Próxima etapa

Continuar a avaliação com a equipe na operação real e revisar os estados de gestão não reproduzidos na prévia. Não ampliar backend nem atualizar o framework sem avaliar o impacto.

## Complemento da revisão

- Início: quatro ações principais com menos altura, ícones e bordas mais discretos.
- Lançamento: navegação por operação compacta e opções de serviço mais claras. Variantes de lentes, expressa e manutenção conferidas com componentes reais e dados fictícios, sem salvar.
- Painel da OS: superfície única e controle de fechamento com alvo de toque maior.
- Portal: nome Lab Gold, resumos com cores semânticas e contraste nos dois temas; campo de mensagem acompanha a superfície do tema.
- Tema: localização no cabeçalho acompanha a substituição do DOM em navegação e atualização, inclusive sem mudança de URL.
- Sucesso em texto usa #286F51 sobre #E8F3EE: a medição encontrou 4,40:1 na combinação original #2E7D5B e foi corrigida para atender AA em texto pequeno. Os testes agora leem os tokens reais da folha de estilos.
- Corrigida a compilação Tailwind com o plugin oficial PostCSS, em versão compatível com o Tailwind existente. Evita build webpack aprovado sem classes utilitárias. Referência: https://tailwindcss.com/docs/installation/using-postcss.
- `scripts/check-build-css.mjs` verifica layout, classes de acessibilidade e media queries no CSS de produção; a CI executa essa verificação após o build.
- Comparação controlada de lançamento: mesma fixture, estado inicial e janela Chrome 1360 × 720 nas versões anterior e nova, registrada em `outputs/design-audit-2026-11-22/comparison`. Portal conferido em desktop claro/escuro e 390 × 844 escuro; lançamento em desktop nas três variantes e celular escuro. Não equivale a ensaio autenticado de todas as 52 rotas nem a teste ponta a ponta do banco.
- Prévia temporária e dados fictícios removidos do código a publicar. Capturas permanecem locais.
