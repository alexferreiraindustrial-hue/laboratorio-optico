# Sessão ao lançar uma OS

Os logs de produção registraram `refresh_token_already_used` no domínio do laboratório. Esse erro indica tentativa de renovar uma sessão com um token de renovação já consumido. Os registros disponíveis não determinam qual navegador ou requisição iniciou a reutilização.

## Correção

- Clientes de navegador, servidor e proxy usam o nome exclusivo `oticahub-lab-auth-v2`. Cookies antigos deixam de ser lidos pelo laboratório, sem apagar cookies de outros sistemas.
- A mudança exige entrar novamente uma vez. Não muda senha, perfil, RLS ou validade dos tokens no provedor.
- O proxy acumula as escritas de cookie durante a renovação, mantendo todos os fragmentos e os cabeçalhos ant-cache fornecidos pelo SDK.
- Redirecionamentos mantêm os cookies renovados e os cabeçalhos ant-cache. O nome efetivo do fragmento prevalece sobre opções de cookie.
- Autenticação no servidor continua sendo verificada por `getUser()`. Não há autorização baseada apenas em dados locais ou relaxamento de permissões.

## Verificação

Testes com o SDK instalado e transporte simulado verificam login, isolamento de cookies antigos, renovação de token expirado e uma requisição seguinte sem repetir a renovação. Testes do proxy verificam cookies, fragmentos, redirecionamentos, POST e bloqueio de usuário sem sessão.

Nenhuma OS real é criada nos testes e não há migração de banco. A validação final com a conta do operador deve ser feita após novo login no domínio publicado; não foram solicitadas ou utilizadas credenciais do usuário.

Referências: [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [ciclo de renovação](https://supabase.com/docs/guides/auth/server-side/advanced-guide).
