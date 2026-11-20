import 'package:flutter_test/flutter_test.dart';
import 'package:oticahub_lab/access_routing.dart';

void main() {
  test(
    'vendedor fica no acompanhamento mesmo ao tentar abrir tela interna',
    () {
      for (final path in [
        '/painel',
        '/estoque',
        '/montagem',
        '/configuracoes',
        '/ordens/nova',
        '/login',
      ]) {
        expect(
          accessRedirect(
            location: path,
            signedIn: true,
            portal: true,
            laboratory: false,
          ),
          '/portal',
        );
      }
      expect(
        accessRedirect(
          location: '/portal',
          signedIn: true,
          portal: true,
          laboratory: false,
        ),
        isNull,
      );
      expect(
        accessRedirect(
          location: '/portal/os/example',
          signedIn: true,
          portal: true,
          laboratory: false,
        ),
        isNull,
      );
    },
  );
  test('sem sessão não abre acompanhamento nem operação', () {
    for (final path in ['/painel', '/portal', '/portal/os/example']) {
      expect(
        accessRedirect(
          location: path,
          signedIn: false,
          portal: false,
          laboratory: false,
        ),
        '/login',
      );
    }
  });
  test(
    'equipe do laboratório mantém o painel e não mistura sessão de portal',
    () {
      expect(
        accessRedirect(
          location: '/portal',
          signedIn: true,
          portal: false,
          laboratory: true,
        ),
        '/painel',
      );
      expect(
        accessRedirect(
          location: '/montagem',
          signedIn: true,
          portal: false,
          laboratory: true,
        ),
        isNull,
      );
    },
  );
}
