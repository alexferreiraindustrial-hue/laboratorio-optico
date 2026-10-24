# Histórico de versões

O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e as versões seguem o [SemVer](https://semver.org/lang/pt-BR/).

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
