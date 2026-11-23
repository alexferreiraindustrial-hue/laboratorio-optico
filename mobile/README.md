# LabGold Android

## APK de teste 1.4.0 (7)

Novo visual alinhado ao site: preto e dourado, fonte Plus Jakarta Sans e opção clara preservada. Fontes incluídas no APK para funcionar sem rede. Preferências de tema existentes são mantidas; instalações novas começam no escuro. Cartões da bancada começam compactos, exibem o prazo e abrem processos, fotos e histórico ao expandir.

Acompanhamento médico opcional com registro de retorno, assistências vinculadas à OS original, recebimento de lentes pela RPC de VTA, recebimento de armação e leitura do contador de montagens expressas já registradas. O lançamento pode indicar a conferência médica. As permissões do banco e as cinco etapas técnicas continuam vigentes.

Vendedoras: o lançamento tem um botão para atualizar vendedoras e laboratórios; a consulta de vendedoras ativas é ordenada pelo nome. No site, os filtros de lentes e bancada incluem vendedoras ativas sem serviços na fila. O cadastro relatado foi conferido como ativo e vinculado à loja. Não houve alteração de cadastros reais ou vínculos.

Mantidos o identificador Android e a assinatura de teste existentes, para permitir atualização sobre o APK anterior compatível. Não desinstale o aplicativo anterior para atualizar.

Validação: análise Flutter sem erros ou warnings, testes de regras, permissões, contraste e responsividade, compilação release e verificação da assinatura. O APK contém somente a chave pública de cliente do Supabase.

# Laboratório ALEX

## APK de teste 1.1.0 (3)

Interface alinhada ao ÓticaHub Lab: superfícies claras, ações em verde-petróleo e alertas com cores e texto. Login em uma única área rolável para funcionar com teclado aberto e em paisagem. Fontes Manrope incluídas no app, sem carregamento pela rede.

Celulares usam navegação inferior; a partir de 720 pixels lógicos o menu passa para a lateral. O conteúdo tem largura máxima, os cartões respeitam nomes longos e fontes ampliadas e a bancada usa grades de altura natural. A navegação lateral pode rolar em janelas baixas.

Validação: `flutter test`, `flutter analyze --no-fatal-infos` e `flutter build apk --release`. Os testes incluem 320px, paisagem, tablet, fonte ampliada e teclado aberto. O APK mantém o identificador Android existente e usa a assinatura de teste já configurada. Não foram alterados banco, usuários, permissões ou regras de produção.

Aplicativo Flutter do chão de fábrica. Faz parte do [Laboratório Óptico](../README.md) e usa o mesmo Supabase de [lab.oticahub.com](https://lab.oticahub.com): login, lançamento, bancada, pedido de lentes e conversa da ordem de serviço.

A chave de serviço do banco não entra neste app. Use só a chave anônima. A permissão fica no PostgreSQL (RLS e funções).

## Configurar

1. Instale o [Flutter SDK](https://docs.flutter.dev/get-started/install).
2. Copie `.env.example` para `.env`.
3. Preencha `SUPABASE_URL` e `SUPABASE_ANON_KEY` com os mesmos valores `NEXT_PUBLIC_*` do site.

```bash
flutter pub get
flutter test
flutter run
```

No Android, ative a depuração USB ou use um emulador. A barra de baixo guarda Painel, Lançar, Bancada, Lentes e Mais.

## O que olhar no código

| Pasta | Conteúdo |
| --- | --- |
| `lib/screens/` | Telas da operação |
| `lib/lab_api.dart` | Chamadas ao banco |
| `lib/floor_format.dart` | Prazo do cliente e acompanhamento da lente |
| `lib/design/` | Visual do chão de fábrica |
| `test/` | Testes do prazo e da casa da lente |
