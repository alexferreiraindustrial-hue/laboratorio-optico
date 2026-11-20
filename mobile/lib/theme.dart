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
  ink: Color(0xFF222222),
  muted: Color(0xFF6E6A63),
  accent: Color(0xFF8C6239),
  accentStrong: Color(0xFF734F2D),
  glow: Color(0xFFF3ECE2),
  paper: Color(0xFFFFFFFF),
  canvas: Color(0xFFF7F6F3),
  hairline: Color(0xFFE2DDD5),
  danger: Color(0xFFB83A3A),
  warn: Color(0xFF87601F),
  ok: Color(0xFF286F51),
  warnFill: Color(0xFFFBF3E4),
  dangerFill: Color(0xFFF9EAEA),
  okFill: Color(0xFFE8F3EE),
);

ThemeData labTheme() => laTheme().copyWith(extensions: const [_lightColors]);

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
