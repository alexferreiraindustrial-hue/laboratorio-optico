# Adaptação do Kanban do CRM Industrial

## Origem e limites

Referência local: `crm-industrial/atendimento/chatwoot-marca/branding/kanban.js`, funções `boardHeader`, `boardStages`, `visibleStages` e seus filtros. Consultados também `docs/kanban/KANBAN_TECHNICAL_AUDIT.md` e `OPEN_SOURCE_LICENSES.md`.

O repositório raiz contém Twenty sob AGPL e trechos comerciais. O módulo de atendimento documenta uma base Chatwoot Community MIT e bibliotecas com licenças próprias. Nenhum arquivo, dependência ou trecho literal desse repositório foi incorporado. As interações foram reimplementadas no React existente; não há importação de código Enterprise, autenticação, dados ou tabelas do CRM.

## Primeira entrega

| Antes | Depois | Motivo |
|---|---|---|
| Quadro sem busca local | Busca por OS, cliente, vendedor, loja, laboratório e referência do pedido | Localizar serviço sem abrir cartões |
| Ordem recebida do servidor | Maior risco primeiro, prazo ou entrada mais antiga | Destacar atraso e risco antes do vencimento |
| Urgência antiga no cartão | Diagnóstico calculado com previsão de lentes e montagem | Usar a mesma previsão operacional do laboratório |
| Apenas arrastar | Alça dedicada e seletor de próximo status permitido | Operação por toque, teclado e mouse |
| Todas as colunas abertas | Recolher conteúdo por coluna | Reduzir ruído visual |
| Informações resumidas | Progresso das cinco etapas, lentes recebidas/previsão e referência do pedido | Acompanhar produção sem abrir detalhes |

Os filtros combinam vendedor, pesquisa e foco (prazos, prioridade crítica ou lentes sem previsão). O WIP usa a contagem carregada antes dos filtros locais, evitando esconder sobrecarga ao pesquisar. A consulta existente continua limitada a 400 OS: filtros e ordenação locais não representam busca integral no banco. Preferências duram enquanto o quadro estiver montado.

## Regras preservadas

Mesmos status, permissões, painel lateral e histórico. Arraste e seletor passam pela mesma ação de servidor e RPC; a liberação continua sujeita às etapas concluídas e às ocorrências de qualidade. Não foram criadas colunas livres que contornem essas regras. Nenhuma migração ou alteração de registros foi executada.

## Próximas etapas

1. Busca e ordenação global no servidor para volume superior ao limite da consulta.
2. Localização física estruturada (gaveta, bancada, retirada), com migração aditiva e histórico.
3. Responsável da OS e bloqueios estruturados; não confundir vendedor com montador.
4. Calendário, alertas persistentes e automações somente após definir SLA e permissões.

Esses itens exigem avaliação separada; não foram simulados com campos de observação. O APK Flutter mantém a versão anterior: esta entrega modifica o Kanban web compartilhado pelas telas que já o utilizam.
