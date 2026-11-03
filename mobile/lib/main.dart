import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:supabase_flutter/supabase_flutter.dart' hide Session;

import 'router.dart';
import 'session.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  ErrorWidget.builder = (details) {
    return ColoredBox(
      color: const Color(0xFF8B0000),
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Text(
          '${details.exception}',
          style: const TextStyle(color: Colors.white, fontSize: 16),
        ),
      ),
    );
  };
  await dotenv.load(fileName: '.env');
  String env(List<String> keys) {
    for (final key in keys) {
      final value = dotenv.env[key];
      if (value != null && value.trim().isNotEmpty) return value.trim();
    }
    return '';
  }

  final url = env(['SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL']);
  final key = env(['SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_PUBLISHABLE_KEY']);
  if (url.isEmpty || key.isEmpty) {
    throw StateError('Faltam SUPABASE_URL e SUPABASE_ANON_KEY no arquivo .env (as mesmas do lab.oticahub.com).');
  }
  await Supabase.initialize(url: url, publishableKey: key);
  final session = Session();
  await session.restore();
  session.listenAuth();
  runApp(LabApp(session: session));
}
