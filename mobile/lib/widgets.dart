import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'design/widgets/la_responsive.dart';
import 'theme.dart';

class LabHeader extends StatelessWidget {
  const LabHeader({super.key, required this.title, this.subtitle});
  final String title;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpace.md,
        AppSpace.sm,
        AppSpace.md,
        AppSpace.md,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: Theme.of(context).textTheme.headlineMedium),
          if (subtitle != null) ...[
            const SizedBox(height: AppSpace.sm),
            Text(
              subtitle!,
              style: Theme.of(context).textTheme.bodyMedium
                  ?.copyWith(color: colors.muted),
            ),
          ],
        ],
      ),
    );
  }
}

class LabError extends StatelessWidget {
  const LabError({super.key, required this.message, this.onRetry});
  final String message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Semantics(
      liveRegion: true,
      child: Container(
        width: double.infinity,
        margin: const EdgeInsets.symmetric(
          horizontal: AppSpace.md,
          vertical: AppSpace.sm,
        ),
        padding: const EdgeInsets.all(AppSpace.md),
        decoration: BoxDecoration(
          color: colors.dangerFill,
          borderRadius: BorderRadius.circular(AppRadius.control),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              message,
              style: TextStyle(
                color: colors.danger,
                fontWeight: FontWeight.w700,
              ),
            ),
            if (onRetry != null) ...[
              const SizedBox(height: AppSpace.sm),
              FilledButton(
                onPressed: onRetry,
                child: const Text('Tentar de novo'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class LabEmpty extends StatelessWidget {
  const LabEmpty({
    super.key,
    required this.title,
    this.actionLabel,
    this.onAction,
  });
  final String title;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Padding(
      padding: const EdgeInsets.all(AppSpace.lg),
      child: Column(
        children: [
          Icon(Icons.inbox_outlined, size: 36, color: colors.muted),
          const SizedBox(height: AppSpace.sm),
          Text(
            title,
            textAlign: TextAlign.center,
            style: TextStyle(color: colors.muted),
          ),
          if (onAction != null && actionLabel != null) ...[
            const SizedBox(height: AppSpace.md),
            FilledButton(onPressed: onAction, child: Text(actionLabel!)),
          ],
        ],
      ),
    );
  }
}

class LabChoice extends StatelessWidget {
  const LabChoice({
    super.key,
    required this.label,
    required this.selected,
    required this.onTap,
    this.code,
  });
  final String label;
  final bool selected;
  final VoidCallback onTap;
  final String? code;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return LabPressable(
      semanticLabel: label,
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 140),
        constraints: const BoxConstraints(minHeight: AppTouch.min),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: selected
              ? colors.accent
              : colors.paper.withValues(alpha: 0.82),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: selected ? colors.accent : colors.hairline),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (code != null) ...[
              Text(
                code!,
                style: TextStyle(
                  fontFamily: 'Manrope',
                  fontWeight: FontWeight.w800,
                  color: selected ? Colors.white : colors.muted,
                ),
              ),
              const SizedBox(width: 6),
            ],
            Flexible(
              child: Text(
                label,
                style: TextStyle(
                  fontWeight: FontWeight.w700,
                  color: selected ? Colors.white : colors.ink,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class LabPressable extends StatefulWidget {
  const LabPressable({
    super.key,
    required this.onTap,
    required this.child,
    this.semanticLabel,
  });
  final VoidCallback? onTap;
  final Widget child;
  final String? semanticLabel;

  @override
  State<LabPressable> createState() => _LabPressableState();
}

class _LabPressableState extends State<LabPressable> {
  var down = false;

  @override
  Widget build(BuildContext context) {
    final reduce = MediaQuery.disableAnimationsOf(context);
    return Semantics(
      button: true,
      label: widget.semanticLabel,
      child: GestureDetector(
        onTapDown: widget.onTap == null
            ? null
            : (_) => setState(() => down = true),
        onTapCancel: () => setState(() => down = false),
        onTapUp: (_) => setState(() => down = false),
        onTap: widget.onTap == null
            ? null
            : () {
                HapticFeedback.selectionClick();
                widget.onTap!();
              },
        child: AnimatedScale(
          scale: down && !reduce ? 0.97 : 1,
          duration: reduce ? Duration.zero : const Duration(milliseconds: 90),
          curve: Curves.easeOut,
          child: widget.child,
        ),
      ),
    );
  }
}

class GoldPlate extends StatelessWidget {
  const GoldPlate({
    super.key,
    required this.child,
    this.radius = 22,
    this.center = const Alignment(0.15, 0),
  });
  final Widget child;
  final double radius;
  final Alignment center;

  static const ink = Color(0xFF24180A);

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(radius),
        boxShadow: const [
          BoxShadow(
            color: Color(0x55000000),
            blurRadius: 16,
            offset: Offset(0, 8),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(radius),
        child: Stack(
          fit: StackFit.passthrough,
          children: [
            Positioned.fill(
              child: CustomPaint(painter: _BrushedGoldPainter(center: center)),
            ),
            child,
          ],
        ),
      ),
    );
  }
}

class _BrushedGoldPainter extends CustomPainter {
  _BrushedGoldPainter({required this.center});
  final Alignment center;

  @override
  void paint(Canvas canvas, Size size) {
    final origin = Offset(
      size.width * (center.x + 1) / 2,
      size.height * (center.y + 1) / 2,
    );
    final radius = size.longestSide * 1.15;
    canvas.drawRect(
      Offset.zero & size,
      Paint()
        ..shader = RadialGradient(
          colors: const [
            Color(0xFFF8E7B8),
            Color(0xFFE4C56A),
            Color(0xFFC9A227),
            Color(0xFF8C6A1E),
            Color(0xFFD7B45A),
          ],
          stops: const [0, 0.22, 0.48, 0.78, 1],
        ).createShader(Rect.fromCircle(center: origin, radius: radius)),
    );
    final ring = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.1
      ..color = const Color(0x28FFF6D6);
    for (var i = 1; i < 28; i++) {
      canvas.drawCircle(origin, 7.0 * i, ring);
    }
    final shade = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1
      ..color = const Color(0x22000000);
    for (var i = 1; i < 28; i++) {
      canvas.drawCircle(origin, 7.0 * i + 0.6, shade);
    }
  }

  @override
  bool shouldRepaint(covariant _BrushedGoldPainter oldDelegate) =>
      oldDelegate.center != center;
}

class LabDock extends StatelessWidget {
  const LabDock({super.key, required this.index, required this.onSelect});
  final int index;
  final ValueChanged<int> onSelect;

  static const _items = [
    (Icons.grid_view_outlined, Icons.grid_view, 'Painel'),
    (Icons.bolt_outlined, Icons.bolt, 'Lançar'),
    (Icons.handyman_outlined, Icons.handyman, 'Bancada'),
    (Icons.visibility_outlined, Icons.visibility, 'Lentes'),
    (Icons.more_horiz, Icons.more_horiz, 'Mais'),
  ];

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return SafeArea(
      minimum: const EdgeInsets.fromLTRB(
        AppSpace.md,
        0,
        AppSpace.md,
        AppSpace.sm,
      ),
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: const Color(0xF2141615),
          borderRadius: BorderRadius.circular(AppRadius.sheet),
          border: Border.all(color: colors.accent.withValues(alpha: 0.28)),
          boxShadow: const [
            BoxShadow(
              color: Color(0x66000000),
              blurRadius: 24,
              offset: Offset(0, 10),
            ),
          ],
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 8),
          child: Row(
            children: [
              for (var i = 0; i < _items.length; i++)
                Expanded(
                  child: _DockItem(
                    selected: i == index,
                    icon: i == index ? _items[i].$2 : _items[i].$1,
                    label: _items[i].$3,
                    onTap: () => onSelect(i),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _DockItem extends StatelessWidget {
  const _DockItem({
    required this.selected,
    required this.icon,
    required this.label,
    required this.onTap,
  });
  final bool selected;
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return LabPressable(
      semanticLabel: label,
      onTap: onTap,
      child: AnimatedContainer(
        duration: MediaQuery.disableAnimationsOf(context)
            ? Duration.zero
            : const Duration(milliseconds: 160),
        curve: Curves.easeOut,
        padding: const EdgeInsets.symmetric(vertical: 8),
        decoration: BoxDecoration(
          color: Colors.transparent,
          borderRadius: BorderRadius.circular(20),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: 22,
              color: selected
                  ? const Color(0xFFE4C56A)
                  : const Color(0xFF9A7A3C),
            ),
            const SizedBox(height: 4),
            Text(
              label,
              style: TextStyle(
                fontFamily: 'Manrope',
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: selected
                    ? const Color(0xFFE4C56A)
                    : const Color(0xFF9A7A3C),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class PushedScaffold extends StatelessWidget {
  const PushedScaffold({super.key, required this.title, required this.child});
  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(title: Text(title)),
      body: LensSafeBody(child: child),
    );
  }
}

class LensSafeBody extends StatelessWidget {
  const LensSafeBody({super.key, required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: AppColors.of(context).canvas,
      child: SafeArea(
        top: false,
        bottom: false,
        child: LaContent(child: child),
      ),
    );
  }
}

class LabSheet extends StatelessWidget {
  const LabSheet({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(AppSpace.md),
  });
  final Widget child;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.paper.withValues(alpha: 0.92),
        borderRadius: BorderRadius.circular(AppRadius.card),
        border: Border.all(color: colors.accent.withValues(alpha: 0.22)),
      ),
      child: Padding(padding: padding, child: child),
    );
  }
}

class LabSection extends StatelessWidget {
  const LabSection({super.key, required this.title, required this.child});
  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: AppSpace.md),
      child: LabSheet(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: AppSpace.sm),
            child,
          ],
        ),
      ),
    );
  }
}

class LabMeta extends StatelessWidget {
  const LabMeta({super.key, required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 7),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 118,
            child: Text(
              label,
              style: Theme.of(context).textTheme.bodySmall
                  ?.copyWith(color: colors.muted),
            ),
          ),
          Expanded(
            child: Text(value, style: Theme.of(context).textTheme.titleMedium),
          ),
        ],
      ),
    );
  }
}
