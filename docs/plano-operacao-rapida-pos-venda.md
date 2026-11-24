# Operação rápida, conferência opcional e pós-venda

## Regra de preservação

Nenhuma atualização deve mover OS existentes, marcar etapas antigas como realizadas, alterar locais físicos, completar datas ou contatos, apagar registros ou presumir entrega ao cliente. Migrações devem ser aditivas e alterar regras/funções sem DML de preenchimento retroativo. Testes de fluxo usam banco isolado e dados fictícios. Antes/depois de eventual aplicação, conferir contagens e fingerprint dos campos antigos.

## Diagnóstico inicial

- [x] Revisar montagem, saída, ocorrência e conferência médica.
- [x] Identificar a escolha automática de destino: OrderActions inicializa a opção com o primeiro destino e mantém estado ao atualizar a OS. O formulário precisa exigir escolha explícita e descartar a escolha quando o status de origem mudar.
- [x] Identificar a regra automática: concluir facetadora encaminha para em_conferencia, hoje rotulada como Médico, sem decisão explícita. Retirar essa transição.
- [x] Confirmar que cinco etapas concluídas são exigidas no banco e no app antes de liberar. A exigência conflita com a operação relatada.
- [x] Confirmar que a saída atual representa entrega ao vendedor/loja, sem confirmação própria de entrega ao cliente. Não usar delivered_at antigo como início do pós-venda.

## 1. Movimentação explícita

- [x] Remover destino automático no site e app. Exibir a ação e o destino antes de executar.
- [x] Pronto é o destino normal da conclusão; correção exige decisão explícita e motivo.
- [x] Garantir que atualização de tela não reaproveite o destino de um status anterior.

## 2. Montagem e registros rápidos

- [x] Liberar conclusão da montagem sem clicar nas cinco etapas, mantendo impedimentos reais e permissões.
- [x] Não preencher etapas como concluídas por consequência da liberação.
- [x] Manter etapas técnicas como referência e histórico opcional, com descrição e fotos por etapa.
- [x] Separar registro informativo de ocorrência que bloqueia o serviço. Registro informativo não muda status.
- [x] Não reclassificar ocorrências anteriores automaticamente.

## 3. Decisão médica posterior

- [x] Permitir Pronto → Conferência Médico por ação explícita, inclusive arrastar, sem passar por correção.
- [x] Marcar a indicação médica e criar histórico na mesma transação da movimentação.
- [x] Manter retorno médico como ação própria e impedir entrega enquanto houver pendência médica.
- [x] Não encaminhar ao médico OS sem decisão do operador.

## 4. Cadastro de serviço já pronto

- [x] Acrescentar “Já veio pronto / registrar passagem pelo laboratório”.
- [x] Criar novo registro pronto em uma transação autorizada, com data informada e histórico de cadastro posterior.
- [x] Não inventar execução das etapas e não alterar registros já existentes.
- [x] Deixar claras as opções de lançamento normal e lançamento já pronto.

## 5. Entrega ao cliente e acompanhamento

- [x] Distinguir saída do laboratório de entrega efetiva ao cliente.
- [x] Criar confirmação explícita de entrega ao cliente, com data real e telefone opcional.
- [x] Só confirmações novas iniciam o acompanhamento. Não importar entregas antigas automaticamente.
- [x] Calcular lembrete após cinco dias corridos, a partir da entrega ao cliente.
- [x] Mostrar pendências por vendedora, telefone ausente e mensagem de acompanhamento para copiar.
- [x] Permitir marcar contato realizado/feedback registrado, sem enviar mensagens automaticamente.
- [x] Repetir confirmação não reinicia o prazo de cinco dias; manter autoria e histórico.

## 6. Validação e publicação

- [x] Testar matriz de transições, liberação sem etapas, registros informativos, retorno médico e impedimentos.
- [x] Testar permissões, criação atômica, preservação de registros antigos e ausência de reclassificação retroativa.
- [x] Testar entrega à loja versus entrega ao cliente, prazo de cinco dias, duplicidade e acompanhamento concluído.
- [ ] Validar interface, build do site e app; gerar APK atualizado.
- [x] Aplicar apenas migração desta entrega após validar preservação. Nunca executar migrações pendentes em lote.
- [ ] Publicar e verificar. Não criar ou movimentar OS reais durante a validação.

## Fluxo proposto

Entrada normal → montagem → pronto. Correção e médico são desvios explícitos. Serviço que já passou pronto entra pelo cadastro próprio, sem etapas fictícias. Saída do laboratório continua separada da confirmação de entrega ao cliente; somente esta última inicia os cinco dias do pós-venda.

## Conferência da aplicação

A migração 20261123150000 foi aplicada isoladamente no projeto do laboratório, com bloqueio curto de escrita e comparações integrais antes/depois dentro da mesma transação. As 99 OS, 495 etapas e 185 entradas de histórico mantiveram as mesmas contagens e fingerprints. As duas tabelas novas iniciaram vazias. Nenhuma OS real foi usada para teste de movimentação.

As OS que já estavam em médico/correção continuam onde estavam. A atualização não decide seu destino: o operador pode abrir cada uma e escolher o destino correto. Quando a indicação médica estiver marcada, removê-la é uma decisão explícita antes de liberar sem retorno médico.
