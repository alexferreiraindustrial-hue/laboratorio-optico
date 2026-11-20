# Acesso dos vendedores: site, app e link

## Preparar um vendedor

1. Entre como administrador ou gestor e abra Vendedores.
2. Abra o cadastro da pessoa e confira o código rápido, por exemplo `v3`.
3. Em Acesso no site e no app, defina um PIN de 4 a 8 dígitos. Entregue o código e o PIN somente para essa pessoa. O PIN não é exibido novamente.
4. Para acesso por link, use o gerenciador de Link de acompanhamento no mesmo cadastro. Links podem ser revogados independentemente do acesso por PIN.

## Site

Abra `https://lab.oticahub.com/vendedor/login`, ou escolha Sou vendedor na entrada do sistema. Informe código e PIN. A área Meus serviços mostra produção, prazos, prontas para retirada, entregues e histórico. Os recados existentes continuam disponíveis na OS.

O login guarda o token em cookie HttpOnly separado da sessão da equipe, restrito ao caminho `/vendedor`, por até sete dias. O token do login não aparece na URL nem é enviado como propriedade dos componentes de acompanhamento. A identidade é verificada no servidor e apenas credenciais do tipo vendedor são aceitas nessa área.

O acesso por link continua em `/acompanhar/vendedor/...`. Links de loja existentes mantêm o escopo da loja; não são transformados em login de vendedor.

## App Android

Na entrada, escolha Vendedor e use o mesmo código e PIN. A opção Já tenho o link também continua disponível. Depois de um acesso bem-sucedido, o app lembra o perfil escolhido, sem guardar o PIN.

O app valida a identidade do token ao entrar e ao restaurar um acesso salvo. Token revogado ou perfil incompatível volta ao login. Falta de rede não apaga automaticamente o token; as consultas continuam dependendo da validação no servidor. O roteamento do acompanhamento bloqueia as telas de operação, estoque e gestão. Sair no app usa encerramento local da sessão da equipe, sem encerrar acessos da equipe em outros dispositivos.

## Escopo e política atual

- O código usa as RPCs existentes: `seller_app_login`, `portal_identity`, `portal_orders`, `portal_order_detail` e `portal_send_message`.
- O vendedor é identificado pelo token validado no banco. Um parâmetro de vendedor enviado pela tela não amplia o escopo.
- A política existente de PIN mantém o login mais recente: entrar por PIN em outro dispositivo pode revogar o acesso por PIN anterior. Os links são independentes. Esta entrega não altera essa política nem cria contas da equipe para vendedores.
- A migração `20261120210000_portal_permission_fail_closed.sql` torna o resultado da verificação de propriedade sempre verdadeiro ou falso: OS sem vínculo são negadas também nas funções de detalhe e recados. Não muda registros nem permissões concedidas.
- A consulta existente retorna até 200 OS por filtro. A autorização não depende de filtros locais do app.

## Verificação e implantação

Testes cobrem sessão web HttpOnly, credencial obtida do cookie em vez de formulário, recusa de perfil de loja na área pessoal e separação das rotas da equipe. No Flutter, testes cobrem o bloqueio das rotas internas e o login de vendedor em telas pequenas e fontes ampliadas.

A existência da RPC de login em produção foi confirmada com PIN vazio e IP nulo, sem consultar vendedores nem criar sessões. A função de permissão também foi consultada com valores compostos fictícios, sem ler tabelas: o caso de OS sem vendedor retornou NULL, confirmando a necessidade da migração antes de liberar a entrega. Não foram usados PINs reais, criadas OS ou alterados cadastros nos testes. A validação completa de duas pessoas reais deve ser feita pelo gestor após a aplicação da migração e publicação.
