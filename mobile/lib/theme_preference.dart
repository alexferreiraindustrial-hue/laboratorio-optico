import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

class ThemePreference extends ChangeNotifier {
  bool dark = false;
  bool _disposed = false;
  Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    if (_disposed) return;
    dark = prefs.getBool('lab_gold_dark') ?? false;
    notifyListeners();
  }
  Future<void> toggle() async {
    dark = !dark;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('lab_gold_dark', dark);
  }
  @override
  void dispose() { _disposed = true; super.dispose(); }
}
