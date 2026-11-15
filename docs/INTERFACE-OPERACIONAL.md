# Interface operacional · ÓticaHub Lab

## Escopo

A interface usa superfícies claras, navegação escura e uma única cor de ação. Vermelho e amarelo permanecem reservados para alertas. Os componentes compartilhados propagam os ajustes a estoque, assistência, portais, indicadores, equipe e configurações.

| Antes | Depois | Motivo |
| --- | --- | --- |
| Gestão e operação sempre expandidas | Gestão e equipe recolhidas, com a seção atual aberta | Dar prioridade às tarefas frequentes sem retirar módulos |
| Editar exigia sair da fila | Painel lateral com dados, pedido de lentes e produção/histórico | Preservar filtros e posição na lista |
| Cadastro completo como ação principal | Entrada rápida em destaque; cadastro completo disponível | Respeitar a entrada mínima seguida de complementação |
| Pedido opcional disputava espaço na entrada | Detalhes de pedido recolhidos | Reduzir carga visual |
| Previsão geral ignorava a data informada da lente | Data informada mais a reserva de montagem já usada no módulo de lentes | Evitar prometer conclusão antes de receber material |
| Elementos do detalhe podiam exceder a largura móvel | Grades com largura mínima zero e arquivos limitados ao contêiner | Permitir uso no celular |

## Referências de processo e licenças

Foram usados conceitos, sem copiar código, imagens ou marcas dos projetos:

- [Carbon: produção, compras e qualidade](https://github.com/crbnos/carbon/tree/main/apps/erp/app/modules). [Licença](https://github.com/crbnos/carbon/blob/main/LICENSE): AGPLv3, com exceções comerciais Enterprise.
- [ERPNext: operações, roteiros e job cards](https://github.com/frappe/erpnext/tree/develop/erpnext/manufacturing/doctype). [Licença](https://github.com/frappe/erpnext/blob/develop/license.txt): GPLv3.
- [Odoo: ordens de trabalho](https://github.com/odoo/odoo/blob/19.0/addons/mrp/models/mrp_workorder.py). [Licença](https://github.com/odoo/odoo/blob/19.0/LICENSE): LGPLv3; arquivos específicos podem ter exceções.
- [OpenLIMS](https://github.com/polon25/OpenLIMS): referência de domínio óptico, identificado como MIT no GitHub. Não houve reutilização de implementação.

## Compatibilidade e validação

- Nenhuma migração, alteração de credenciais ou mudança no esquema.
- O aplicativo Flutter e os identificadores de OS permanecem compatíveis.
- As funções existentes continuam responsáveis por gravação, acesso, qualidade e avanço das etapas.
- A reserva de 24 horas é uma estimativa em horas corridas já existente; calendário de capacidade e dias úteis continuam como evolução futura.
- A edição lateral é aberta pela URL `/laboratorio?...&os=UUID`, inclusive a partir do Kanban. As rotas completas continuam disponíveis.
- Homologar gravação com uma OS de teste em ambiente apropriado, permissões de consulta, anexos e transições antes de promover produção. A inspeção visual local usa dados fictícios, sem gravações no banco.

## Fora deste incremento

Localização física da OS, cadastro estruturado de fornecedores, recebimento parcial e estados independentes de pedido/recebimento exigem evolução aditiva de dados. Não foram simulados em campos livres. A fila geral mantém a ordenação de prazo no servidor; a prioridade global por risco deve ser implementada antes da paginação em etapa própria.

Não reaplicar automaticamente migrações antigas: a branch base contém alteração anterior de renumeração de OS, que não faz parte deste incremento.

## Publicação e reversão

Revisar a prévia autenticada antes de mesclar. O retorno à publicação anterior não exige reversão de banco porque este incremento não modifica o esquema.
