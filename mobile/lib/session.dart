import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart' hide Session;

class Profile {
  Profile({required this.id, required this.fullName, required this.role, required this.active});
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

  bool get isLab => Supabase.instance.client.auth.currentSession != null && profile?.active == true;
  bool get isPortal => portalToken != null && portalToken!.isNotEmpty;
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
    deviceHash = prefs.getString('device_hash') ?? 'app-${DateTime.now().millisecondsSinceEpoch}';
    await prefs.setString('device_hash', deviceHash);
    portalToken = prefs.getString('portal_token');
    portalKind = prefs.getString('portal_kind');
    portalName = prefs.getString('portal_name');
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
      await Supabase.instance.client.auth.signInWithPassword(email: email.trim(), password: password);
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

  Future<void> signInPortal({required String kind, required String token, required String name}) async {
    error = null;
    await Supabase.instance.client.auth.signOut();
    profile = null;
    final prefs = await SharedPreferences.getInstance();
    portalToken = token;
    portalKind = kind;
    portalName = name;
    await prefs.setString('portal_token', token);
    await prefs.setString('portal_kind', kind);
    await prefs.setString('portal_name', name);
    notifyListeners();
  }

  Future<void> signOut() async {
    await Supabase.instance.client.auth.signOut();
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
