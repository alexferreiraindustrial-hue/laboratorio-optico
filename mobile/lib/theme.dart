import 'package:flutter/material.dart';

import 'design/la_theme.dart';

@immutable
class AppColors extends ThemeExtension<AppColors> {
  const AppColors({
    required this.ink,
    required this.muted,
    required this.accent,
    required this.accentStrong,
    required this.glow,
    required this.paper,
    required this.canvas,
    required this.hairline,
    required this.danger,
    required this.warn,
    required this.ok,
    required this.warnFill,
    required this.dangerFill,
    required this.okFill,
  });

  final Color ink;
  final Color muted;
  final Color accent;
  final Color accentStrong;
  final Color glow;
  final Color paper;
  final Color canvas;
  final Color hairline;
  final Color danger;
  final Color warn;
  final Color ok;
  final Color warnFill;
  final Color dangerFill;
  final Color okFill;

  static AppColors of(BuildContext context) {
    final ext = Theme.of(context).extension<AppColors>();
    assert(ext != null, 'AppColors missing. Use labTheme().');
    return ext!;
  }

  @override
  AppColors copyWith({
    Color? ink,
    Color? muted,
    Color? accent,
    Color? accentStrong,
    Color? glow,
    Color? paper,
    Color? canvas,
    Color? hairline,
    Color? danger,
    Color? warn,
    Color? ok,
    Color? warnFill,
    Color? dangerFill,
    Color? okFill,
  }) {
    return AppColors(
      ink: ink ?? this.ink,
      muted: muted ?? this.muted,
      accent: accent ?? this.accent,
      accentStrong: accentStrong ?? this.accentStrong,
      glow: glow ?? this.glow,
      paper: paper ?? this.paper,
      canvas: canvas ?? this.canvas,
      hairline: hairline ?? this.hairline,
      danger: danger ?? this.danger,
      warn: warn ?? this.warn,
      ok: ok ?? this.ok,
      warnFill: warnFill ?? this.warnFill,
      dangerFill: dangerFill ?? this.dangerFill,
      okFill: okFill ?? this.okFill,
    );
  }

  @override
  AppColors lerp(ThemeExtension<AppColors>? other, double t) {
    if (other is! AppColors) return this;
    return AppColors(
      ink: Color.lerp(ink, other.ink, t)!,
      muted: Color.lerp(muted, other.muted, t)!,
      accent: Color.lerp(accent, other.accent, t)!,
      accentStrong: Color.lerp(accentStrong, other.accentStrong, t)!,
      glow: Color.lerp(glow, other.glow, t)!,
      paper: Color.lerp(paper, other.paper, t)!,
      canvas: Color.lerp(canvas, other.canvas, t)!,
      hairline: Color.lerp(hairline, other.hairline, t)!,
      danger: Color.lerp(danger, other.danger, t)!,
      warn: Color.lerp(warn, other.warn, t)!,
      ok: Color.lerp(ok, other.ok, t)!,
      warnFill: Color.lerp(warnFill, other.warnFill, t)!,
      dangerFill: Color.lerp(dangerFill, other.dangerFill, t)!,
      okFill: Color.lerp(okFill, other.okFill, t)!,
    );
  }
}

abstract final class AppSpace {
  static const xs = 4.0;
  static const sm = 8.0;
  static const md = 16.0;
  static const lg = 24.0;
  static const xl = 32.0;
}

abstract final class AppRadius {
  static const control = 12.0;
  static const card = 16.0;
  static const sheet = 28.0;
  static const pill = 999.0;
}

abstract final class AppTouch {
  static const min = 48.0;
}

abstract final class AppAssets {
  static const marbleLight = 'assets/marble_light.png';
  static const marbleDark = 'assets/marble_dark.jpg';
}

const _lightColors = AppColors(
  ink: Color(0xFF111B21),
  muted: Color(0xFF54656F),
  accent: Color(0xFF008069),
  accentStrong: Color(0xFF005C4B),
  glow: Color(0xFFD9FDD3),
  paper: Color(0xFFFFFFFF),
  canvas: Color(0xFFF0F2F5),
  hairline: Color(0xFFE9EDEF),
  danger: Color(0xFFB0002A),
  warn: Color(0xFF7A5000),
  ok: Color(0xFF008069),
  warnFill: Color(0xFFFFF4D6),
  dangerFill: Color(0xFFFFE6EC),
  okFill: Color(0xFFD9FDD3),
);

const _darkColors = AppColors(
  ink: Color(0xFFE9EDEF),
  muted: Color(0xFFAEBAC1),
  accent: Color(0xFF00A884),
  accentStrong: Color(0xFF06CF9C),
  glow: Color(0xFF103529),
  paper: Color(0xFF111B21),
  canvas: Color(0xFF0B141A),
  hairline: Color(0xFF2A3942),
  danger: Color(0xFFFF8FA3),
  warn: Color(0xFFFFD279),
  ok: Color(0xFF06CF9C),
  warnFill: Color(0xFF3A3120),
  dangerFill: Color(0xFF3D1F27),
  okFill: Color(0xFF103529),
);

ThemeData labTheme({bool dark = false}) =>
    laTheme(brightness: dark ? Brightness.dark : Brightness.light)
        .copyWith(extensions: [dark ? _darkColors : _lightColors]);

Color stockFillOf(BuildContext context, String tone) {
  final colors = AppColors.of(context);
  switch (tone) {
    case 'vermelho':
      return colors.dangerFill;
    case 'amarelo':
      return colors.warnFill;
    default:
      return colors.okFill;
  }
}
