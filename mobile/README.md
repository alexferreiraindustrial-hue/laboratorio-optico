# Laboratório ALEX

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
