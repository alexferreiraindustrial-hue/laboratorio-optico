import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart' hide Session;

class Profile {
  Profile({
    required this.id,
    required this.fullName,
    required this.role,
    required this.active,
  });
  final String id;
  final String fullName;
  final String role;
  final bool active;
}

class Session extends ChangeNotifier {
  Profile? profile;
  String? portalToken;
  String? portalKind;
  String? portalName;
  String? error;
  String deviceHash = 'app';
  String lastAccessKind = 'laboratorio';

  bool get isLab =>
      !isPortal &&
      Supabase.instance.client.auth.currentSession != null &&
      profile?.active == true;
  bool get isPortal =>
      portalToken != null &&
      portalToken!.isNotEmpty &&
      (portalKind == 'vendedor' || portalKind == 'loja');
  bool get isSignedIn => isLab || isPortal;

  void listenAuth() {
    Supabase.instance.client.auth.onAuthStateChange.listen((data) {
      if (data.event == AuthChangeEvent.signedOut) {
        profile = null;
        notifyListeners();
        return;
      }
      restore();
    });
  }

  Future<void> restore() async {
    final prefs = await SharedPreferences.getInstance();
    deviceHash =
        prefs.getString('device_hash') ??
        'app-${DateTime.now().millisecondsSinceEpoch}';
    await prefs.setString('device_hash', deviceHash);
    portalToken = prefs.getString('portal_token');
    portalKind = prefs.getString('portal_kind');
    portalName = prefs.getString('portal_name');
    lastAccessKind = prefs.getString('last_access_kind') ?? 'laboratorio';
    if (isPortal) {
      try {
        final data = await Supabase.instance.client.rpc(
          'portal_identity',
          params: {'p_token': portalToken, 'p_ip_hash': deviceHash},
        );
        final identity = Map<String, dynamic>.from(data as Map);
        final expected = portalKind == 'loja' ? 'store' : 'seller';
        if (identity['kind'] != expected) {
          throw const FormatException('Acesso incompatível.');
        }
        portalName = '${identity['name'] ?? portalName ?? 'Vendedor'}';
      } on PostgrestException catch (e) {
        final message = e.message.toLowerCase();
        if (message.contains('revogado') ||
            message.contains('inválido') ||
            message.contains('invalido')) {
          await _clearPortal();
          error = 'Seu acesso precisa ser renovado. Entre novamente com código e senha.';
        }
      } on FormatException {
        await _clearPortal();
        error = 'Entre novamente para confirmar seu perfil de acesso.';
      } catch (_) {
        // Keep the token during a network outage; the portal RPCs still validate every request.
      }
      if (isPortal) {
        profile = null;
        notifyListeners();
        return;
      }
    }
    final user = Supabase.instance.client.auth.currentUser;
    if (user == null) {
      profile = null;
      notifyListeners();
      return;
    }
    await _loadProfile(user.id);
  }

  Future<void> signIn(String email, String password) async {
    error = null;
    notifyListeners();
    try {
      await _clearPortal();
      await Supabase.instance.client.auth.signInWithPassword(
        email: email.trim(),
        password: password,
      );
      final prefs = await SharedPreferences.getInstance();
      lastAccessKind = 'laboratorio';
      await prefs.setString('last_access_kind', lastAccessKind);
      await restore();
      if (profile != null && !profile!.active) {
        await signOut();
        error = 'Este usuário está inativo.';
        notifyListeners();
      }
    } catch (e) {
      error = 'E-mail ou senha inválidos.';
      notifyListeners();
      rethrow;
    }
  }

  Future<void> signInPortal({
    required String kind,
    required String token,
    required String name,
  }) async {
    error = null;
    final data = await Supabase.instance.client.rpc(
      'portal_identity',
      params: {'p_token': token, 'p_ip_hash': deviceHash},
    );
    final identity = Map<String, dynamic>.from(data as Map);
    if (!['vendedor', 'loja'].contains(kind) ||
        identity['kind'] != (kind == 'loja' ? 'store' : 'seller')) {
      throw const FormatException(
        'O perfil deste acesso não corresponde ao vendedor.',
      );
    }
    await Supabase.instance.client.auth.signOut(scope: SignOutScope.local);
    profile = null;
    final prefs = await SharedPreferences.getInstance();
    portalToken = token;
    portalKind = kind;
    portalName = "${identity['name'] ?? name}";
    lastAccessKind = 'vendedor';
    await prefs.setString('last_access_kind', lastAccessKind);
    await prefs.setString('portal_token', token);
    await prefs.setString('portal_kind', kind);
    await prefs.setString('portal_name', portalName!);
    notifyListeners();
  }

  Future<void> signOut() async {
    await Supabase.instance.client.auth.signOut(scope: SignOutScope.local);
    profile = null;
    await _clearPortal();
    notifyListeners();
  }

  Future<void> _clearPortal() async {
    portalToken = null;
    portalKind = null;
    portalName = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('portal_token');
    await prefs.remove('portal_kind');
    await prefs.remove('portal_name');
  }

  Future<void> _loadProfile(String id) async {
    final row = await Supabase.instance.client
        .from('profiles')
        .select('id, full_name, role, active')
        .eq('id', id)
        .maybeSingle();
    if (row == null) {
      profile = null;
    } else {
      profile = Profile(
        id: row['id'] as String,
        fullName: row['full_name'] as String,
        role: row['role'] as String,
        active: row['active'] as bool? ?? true,
      );
    }
    notifyListeners();
  }
}
