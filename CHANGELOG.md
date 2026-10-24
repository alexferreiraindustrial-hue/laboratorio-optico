# Histórico de versões

O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e as versões seguem o [SemVer](https://semver.org/lang/pt-BR/).

## [0.2.0] – 2026-10-24

### Melhoria contínua (novo módulo)
- Visão Lean com recomendações automáticas de onde atacar (Pareto, gargalo, WIP, 5S e prazo).
- Lean Six Sigma: nível sigma, DPMO, FPY, OTD, lead time, throughput, Lei de Little e takt time, Pareto 80/20, carta de controle u e tempo de ciclo por etapa com gargalo.
- Kaizen: quadro PDCA com arrastar e soltar, 5 Porquês, causa raiz, matriz impacto × esforço e ganho em minutos por dia.
- Auditoria 5S: checklist de 20 itens por área, nota por senso, radar, evolução e histórico.
- Kanban com limite WIP por coluna.

### Fluidez
- Movimentação otimista no Kanban: o cartão muda de coluna na hora.
- Indicador de carregamento no item do menu clicado e transição suave entre telas.
- Avisos (toasts) de sucesso e erro.

## [0.1.0] – 2026-10-24

Primeira versão funcional, em uso em laboratório de montagem óptica.

### Ordens de serviço e laboratório
- Cadastro completo de OS com grau (OD/OE, adição), armação, loja, vendedor e prazo.
- Lançamento rápido: abre OS só com número, só com nome ou com os dois; aceita leitor de código e lista colada.
- Chegada de lentes e saída/entrega em lote.
- Lista e Kanban com arrastar e soltar, abas por situação e busca.
- Etiquetas com QR Code.

### Bancada de montagem
- Cinco etapas (Conferência inicial, Lensometria, Blocagem, Facetadora, Conferência de qualidade) com registro de quem fez e quando.
- Bancada com a próxima ação de cada OS em um toque.
- Ocorrências de qualidade que bloqueiam a OS de ficar pronta.

### Previsão e comunicação
- Progresso em % e previsão de atraso antes do prazo vencer.
- Radar de prazos no dashboard e aviso ao vendedor pelo WhatsApp com mensagem pronta.
- Portal do vendedor e da loja (link seguro, sem senha) com progresso, linha do tempo e recados.

### Gestão
- Dashboard de fila, produção, metas e qualidade.
- Ranking de montadores, vendedores e lojas com pódio, metas, prêmios e modo TV.
- Estoque de lentes por grau com QR Code e movimentações.
- Relatórios com exportação CSV.
- Perfis de acesso (administrador, gestor, montador, estoquista, consulta) com Row Level Security no banco.
