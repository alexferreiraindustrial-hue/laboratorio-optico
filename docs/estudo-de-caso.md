# Estudo de caso · Melhoria contínua em um laboratório de montagem óptica

> Projeto aplicado de Engenharia de Produção: um problema real de gestão do dia a dia, tratado com o roteiro **DMAIC** (Lean Six Sigma) e resolvido com um sistema construído com apoio de Inteligência Artificial.

---

## 1. Definir

**Processo:** montagem de óculos sob encomenda. A ordem de serviço (OS) chega da ótica, espera as lentes, passa por cinco operações na bancada e volta para a loja.

**Problema:** o fluxo era controlado em papel e mensagens de WhatsApp. Ninguém sabia com certeza em que etapa cada óculos estava, o atraso só aparecia quando o cliente cobrava na loja e o vendedor precisava ligar para o laboratório para ter notícia.

**Cliente do processo (VOC):**

| Quem | O que precisa |
| --- | --- |
| Cliente final | Receber o óculos no prazo prometido |
| Vendedor / ótica | Saber a situação sem precisar ligar e ser avisado antes de um atraso |
| Montador | Saber o que fazer agora, sem procurar papel |
| Gestor do laboratório | Ver a fila, os gargalos e a produção do dia |

**Escopo:** da entrada da OS até a entrega na loja.

**SIPOC resumido**

| Fornecedores | Entradas | Processo | Saídas | Clientes |
| --- | --- | --- | --- | --- |
| Óticas, fornecedor de lentes | OS com grau e armação, lentes | Receber → aguardar lentes → montar (5 etapas) → conferir → entregar | Óculos montado e conferido | Ótica, vendedor, cliente final |

## 2. Medir

O primeiro ganho foi **tornar o processo medível**. Antes do sistema não havia dado; agora cada evento fica registrado com data, hora e responsável:

- entrada da OS, prazo combinado e situação atual;
- início e fim de cada uma das 5 etapas (conferência inicial, lensometria, blocagem, facetadora e conferência de qualidade) e **quem** fez;
- ocorrências de qualidade por categoria e por etapa;
- data de conclusão e de entrega.

**Indicadores que passam a existir:**

| Indicador | Onde aparece |
| --- | --- |
| OS em fila por situação (WIP) | Dashboard e Kanban |
| Montagens por dia × meta diária / semanal / mensal | Dashboard |
| % de OS com ocorrência de qualidade (por categoria) | Dashboard e Relatórios |
| OS atrasadas e em risco de atraso | Radar de prazos |
| Produção por montador, vendedor e loja | Ranking |

## 3. Analisar

Pontos de perda (desperdícios do Lean) observados no processo:

| Desperdício | Como aparecia |
| --- | --- |
| **Espera** | OS parada aguardando lentes sem ninguém saber |
| **Movimentação / busca** | Montador procurando a OS e o grau no papel |
| **Retrabalho (defeito)** | Lente riscada, erro de blocagem ou de grau descoberto só no final |
| **Superprocessamento de informação** | Vendedor ligando várias vezes para perguntar a situação |
| **Falta de priorização** | Fila atendida por ordem de chegada, não por prazo |

Causa raiz comum: **falta de gestão visual e de padronização do fluxo**.

## 4. Melhorar

Cada contramedida do sistema corresponde a uma ferramenta de Engenharia de Produção:

| Ferramenta | Como foi aplicada no sistema |
| --- | --- |
| **Kanban** | Quadro com as colunas do fluxo (aguardando lentes → montagem → conferência → pronta), arrastar e soltar e limite visual de fila |
| **Gestão visual / Andon** | Cores de risco, radar de prazos e alerta vermelho no topo quando uma OS vai atrasar |
| **Trabalho padronizado** | As 5 etapas sempre na mesma ordem; a bancada mostra só a **próxima ação** de cada OS |
| **Poka-yoke (à prova de erro)** | O banco de dados **não deixa** marcar a OS como pronta sem as 5 etapas concluídas e sem ocorrência aberta; não deixa repetir número de pedido |
| **Puxar pelo prazo** | A bancada e a fila são ordenadas pelo prazo, não pela chegada |
| **5S (organizar e padronizar)** | Cadastros padronizados, etiquetas com QR Code para a OS e para as lentes, estoque por grau organizado em grade |
| **Qualidade na fonte (Jidoka)** | Ocorrências registradas na etapa onde aconteceram, bloqueando o avanço até o tratamento |
| **Comunicação com o cliente** | Portal do vendedor com progresso em % e aviso antecipado de atraso |

## 5. Controlar

- **Indicadores diários** no dashboard com metas (diária, semanal e mensal) e projeção do período.
- **Ranking com metas e modo TV** na parede do laboratório: gestão à vista e reconhecimento da equipe.
- **Histórico completo** de cada OS para auditoria e análise de causa.
- **Ciclo PDCA contínuo:** cada melhoria nova entra como uma [Issue](https://github.com/alexferreiraindustrial-hue/laboratorio-optico/issues) (Plan), é desenvolvida (Do), verificada automaticamente pela esteira de testes do GitHub (Check) e publicada em uma nova versão (Act).

### Próximos ciclos de melhoria

- Medir o **tempo médio por etapa e por montador** para encontrar o gargalo da bancada.
- Calibrar a previsão de atraso com o **histórico real** em vez de tempos padrão.
- Aviso automático ao vendedor quando a OS ficar pronta ou entrar em risco.

---

## Como o sistema foi construído

Não sou programador de formação. Uso a **Inteligência Artificial como ferramenta de engenharia**: eu defino o problema, o processo, as regras do negócio e os critérios de aceite, e uso a IA para transformar isso em software, revisando e testando cada entrega em uso real no laboratório.

O resultado é um sistema web completo (Next.js, TypeScript e Supabase/PostgreSQL), em produção em [lab.oticahub.com](https://lab.oticahub.com).
