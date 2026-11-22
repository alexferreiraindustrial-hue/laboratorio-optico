# VTA, montagem expressa e avisos — Lab Gold

Regra: preservar todos os registros em execução. Nenhum backfill, exclusão ou mudança automática de status de OS existentes.

- [x] Migração aditiva e transacional: armação, duração expressa, relógio e registro de avisos.
- [x] Lançamento: 20/40/60 minutos, bancada direta, armação opcional.
- [x] Recebimento de lente VTA separado da bancada; recebimento da armação libera o serviço.
- [x] Contador persistente inicia no primeiro início da montagem, sem reiniciar ao atualizar.
- [x] Edição posterior da armação/duração com histórico e proteção contra mudanças concorrentes.
- [x] Mensagens por vendedora: recebidos, lentes, VTA, prontos, vencimentos e pedidos sem número externo.
- [x] Lista de montados por período, distinta de liberados.
- [x] Copiar não marca envio; confirmação manual registra destinatário e evento.
- [x] Login por nome único, código ou e-mail; senhas existentes preservadas.
- [x] Senha individual configurável, sem redefinição automática das vendedoras.
- [x] Testes locais: 166 na web (163 versionados; 3 locais não incluídos), 33 no Flutter.
- [ ] Aplicar a migração no projeto Supabase kmtravqwntdvivbekqhm e conferir os dados antes/depois.
- [ ] Confirmar build de prévia e publicar somente depois da ativação do banco.

Não incluir a funcionalidade local de arquivamento nem sua migração nesta entrega.

## Ativação

Aplicar somente `supabase/migrations/20261122120000_vta_express_notices.sql`. Não executar migrações pendentes em lote: existe uma migração local de arquivamento fora desta entrega.

A migração é transacional, aditiva e reaplicável. Adiciona colunas nulas, funções, um gatilho e a tabela de confirmações manuais. Não recria a view existente nem percorre serviços antigos para reatribuir campos/status. Em caso de bloqueio de DDL, o timeout é de 5 segundos e a transação deve ser revertida.

Não publicar a branch antes de confirmar a migração. A versão antiga continua compatível com as colunas nulas. Serviços explicitamente marcados VTA passam a ser protegidos também contra movimentação indevida por versões antigas do cliente.

O aplicativo existente já aceita texto no campo de login e usa o mesmo RPC; o nome completo único passa a funcionar após a migração. O texto do código Flutter foi atualizado, mas um novo APK não faz parte desta publicação web. As novas operações VTA/expressa e a central de avisos estão na interface web.

As senhas atuais não mudam. O administrador pode preencher o nome na senha e salvar individualmente, se desejar. Nomes duplicados exigem o código da vendedora.
