# Instalação e operação

Guia para subir o sistema do zero (Supabase + Vercel) e entender as regras do fluxo. Para a visão geral do produto, veja o [README](../README.md).

Não há ordens, estoque nem usuários de exemplo carregados automaticamente. O arquivo `supabase/seed/demo.sql` é opcional e está marcado como demonstração. Para treinar a equipe, a instância de produção recebeu uma carga de simulação (OS `SIM-…`); o script `supabase/remover-dados-simulacao.sql` remove esses dados.

## Limites dos planos gratuitos

Conferido na documentação pública em outubro de 2026:

- Supabase Free: 500 MB de banco por projeto ativo, 1 GB de arquivos, 5 GB de egress, 50 mil usuários ativos por mês e até dois projetos ativos. O projeto gratuito pausa após uma semana sem uso. Não há backup automático. Este sistema não depende de cron, filas ou Edge Functions pagas.
- Vercel Hobby: uso pessoal e não comercial. Um laboratório em operação comercial precisa do plano Pro. O aplicativo em si não exige cron nem recursos pagos da Vercel.
- Anexos ficam limitados a 8 MB, JPG, PNG, WEBP ou PDF, dentro do teto do Storage.

## Variáveis

Copie `.env.example` para `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

`SUPABASE_SERVICE_ROLE_KEY` só é usada no servidor, para o administrador criar usuários. Não use o prefixo `NEXT_PUBLIC_` nela e não a coloque no repositório.

## Banco de dados

1. Crie um projeto em [supabase.com](https://supabase.com).
2. Em Authentication, deixe o provedor de e-mail ativo. Para um laboratório interno, desative a confirmação obrigatória de e-mail ou configure um SMTP. Sem isso, o primeiro administrador precisa confirmar o e-mail antes de entrar.
3. Abra o SQL Editor e execute, nesta ordem:
   - `supabase/migrations/20261019120000_init.sql`
   - `supabase/migrations/20261019120100_operations.sql`
   - `supabase/migrations/20261019180000_stores_portal.sql`
   - `supabase/migrations/20261020120000_portal_orders_priority.sql`
4. Confira se o bucket privado `lab-files` foi criado em Storage. As policies de leitura e gravação estão na segunda migration. Arquivos não ficam públicos.
5. Em Project Settings → API, copie a URL e a chave `anon` para `.env.local`. A `service_role` é opcional e fica só no servidor.

A segunda migration cria as categorias iniciais de qualidade e os parâmetros da grade, do expediente e do alerta de prazo. Isso é configuração, não dado operacional.

## Primeiro administrador

1. Rode `npm install` e `npm run dev`.
2. Abra `/acesso-inicial`.
3. Crie a primeira conta. O gatilho do banco atribui o perfil administrador somente quando ainda não existe nenhum usuário.
4. Entre em `/login`.
5. Em Configurações, cadastre laboratórios, vendedores, metas e usuários.

Usuários seguintes podem ser criados em Configurações se `SUPABASE_SERVICE_ROLE_KEY` estiver definida. Sem essa chave, crie o usuário em Authentication no Supabase. Ele entra como consulta e o administrador altera o perfil na tela de configurações.

O banco impede que o último administrador ativo seja rebaixado ou desativado.

## Permissões

| Ação | Administrador | Gestor | Montagem | Estoque | Consulta |
| --- | --- | --- | --- | --- | --- |
| OS, status operacional e etapas | sim | sim | sim, sem cancelar ou entregar | não | não |
| Cancelar e marcar entrega | sim | sim | não | não | não |
| Estoque | sim | sim | só consumo por OS | sim | não |
| Saldo negativo excepcional | sim | sim | não | não | não |
| Configurações | sim | sim | não | não | não |
| Perfis de acesso | sim | não | não | não | não |

Esconder um botão não é a proteção. As policies e as funções SQL recusam a operação.

## Fluxo operacional

Uma OS nova começa em **Aguardando lentes** ou **Aguardando montagem**. O número sai da sequência `OS-AAAA-000001`.

O status **Pronto** só é aceito depois das cinco etapas concluídas e sem ocorrência aberta. **Entregue** é um passo posterior. Voltar uma ordem pronta para correção zera a data de conclusão, para ela não continuar contando como produção.

A baixa de lente não acompanha a mudança de status. O consumo é explícito e a mesma OS não consome o mesmo item duas vezes.

Graus são gravados em centésimos de dioptria, como inteiros. `-1,25` vale `-125`.

O QR Code contém apenas a URL do identificador `LN-XXXXXXXXXX`. Se o código não existir, a tela diz que nenhuma lente foi identificada.

## Scripts

```bash
npm run dev
npm run test
npm run typecheck
npm run lint
npm run build
```

## Publicar na Vercel

O projeto `laboratorio-optico` está publicado em produção em **https://lab.oticahub.com** (o endereço `laboratorio-optico.vercel.app` continua respondendo). As funções rodam na região `gru1` (São Paulo), a mesma do banco, definida em `vercel.json`.

O repositório no GitHub está ligado à Vercel: cada push na `main` publica em produção e cada pull request ganha uma URL de prévia. As variáveis `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` estão em Production, Preview e Development. `SUPABASE_SERVICE_ROLE_KEY` ainda não foi configurada: o primeiro administrador entra por `/acesso-inicial`; criar outros usuários pela tela de configurações só funciona depois dessa chave.

No Supabase, em Authentication → URL Configuration, defina Site URL e Redirect URLs para `https://lab.oticahub.com`. Sem isso, o retorno do login por e-mail pode falhar. Se a confirmação de e-mail estiver ligada, desative-a ou confirme o e-mail do administrador antes do primeiro acesso.

Uso comercial do laboratório não cabe no plano Hobby da Vercel. Nesse caso, o time precisa do plano Pro.

## Checklist

- [x] Migrations executadas sem erro.
- [x] Bucket `lab-files` privado.
- [ ] Confirmação de e-mail decidida.
- [x] `.env.local` preenchido e fora do Git.
- [x] Primeiro administrador criado.
- [x] Laboratório, vendedor e metas cadastrados.
- [x] Domínio próprio (lab.oticahub.com) e região São Paulo.
- [x] Variáveis públicas configuradas na Vercel.
- [ ] URL da Vercel liberada no Supabase Auth.
- [ ] Plano da Vercel compatível com uso comercial, se o laboratório for operar de verdade.
