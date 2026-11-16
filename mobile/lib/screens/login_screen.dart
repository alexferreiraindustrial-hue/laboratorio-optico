import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../design/la_design.dart';
import '../domain.dart';
import '../lab_api.dart';
import '../session.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key, required this.session});
  final Session session;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final email = TextEditingController();
  final password = TextEditingController();
  final sellerLogin = TextEditingController();
  final sellerPin = TextEditingController();
  final portal = TextEditingController();
  bool sellerMode = false;
  bool pending = false;
  String? error;

  @override
  void dispose() {
    email.dispose();
    password.dispose();
    sellerLogin.dispose();
    sellerPin.dispose();
    portal.dispose();
    super.dispose();
  }

  Future<void> submitLab() async {
    if (pending) return;
    setState(() {
      pending = true;
      error = null;
    });
    try {
      await widget.session.signIn(email.text, password.text);
    } catch (_) {
      if (!mounted) return;
      setState(
        () => error = widget.session.error ?? 'Não foi possível entrar.',
      );
    } finally {
      if (mounted) setState(() => pending = false);
    }
  }

  Future<void> submitSellerPin() async {
    if (pending) return;
    if (sellerLogin.text.trim().isEmpty || sellerPin.text.trim().length < 4) {
      setState(
        () => error =
            'Informe o código (v3) e o PIN que o laboratório criou para você.',
      );
      return;
    }
    setState(() {
      pending = true;
      error = null;
    });
    try {
      await widget.session.restore();
      final access = await LabApi().sellerAppLogin(
        sellerLogin.text,
        sellerPin.text,
        widget.session.deviceHash,
      );
      await widget.session.signInPortal(
        kind: access.kind,
        token: access.token,
        name: access.name,
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => error = friendlyError(e));
    } finally {
      if (mounted) setState(() => pending = false);
    }
  }

  Future<void> submitPortal() async {
    if (pending) return;
    final parsed = parsePortalLogin(portal.text);
    if (parsed == null) {
      setState(() => error = 'Cole o link do PWA que o laboratório enviou.');
      return;
    }
    setState(() {
      pending = true;
      error = null;
    });
    try {
      await widget.session.restore();
      final identity = await LabApi().portalIdentity(
        parsed.token,
        widget.session.deviceHash,
      );
      await widget.session.signInPortal(
        kind: identity.kind,
        token: parsed.token,
        name: identity.name,
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => error = friendlyError(e));
    } finally {
      if (mounted) setState(() => pending = false);
    }
  }

  Widget _form() => AutofillGroup(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        LaSegmented(
          opcoes: const ['Laboratório', 'Vendedor'],
          selecionado: sellerMode ? 1 : 0,
          onChanged: (index) => setState(() {
            sellerMode = index == 1;
            error = null;
          }),
        ),
        const SizedBox(height: LaSpace.secao),
        if (!sellerMode) ...[
          TextField(
            controller: email,
            keyboardType: TextInputType.emailAddress,
            autofillHints: const [AutofillHints.username, AutofillHints.email],
            decoration: const InputDecoration(labelText: 'E-mail'),
            textInputAction: TextInputAction.next,
          ),
          const SizedBox(height: LaSpace.item),
          TextField(
            controller: password,
            obscureText: true,
            autofillHints: const [AutofillHints.password],
            decoration: const InputDecoration(labelText: 'Senha'),
            onSubmitted: (_) => submitLab(),
          ),
        ] else ...[
          TextField(
            controller: sellerLogin,
            textCapitalization: TextCapitalization.none,
            autofillHints: const [AutofillHints.username],
            style: LaType.tituloSecao,
            decoration: const InputDecoration(
              labelText: 'Código',
              hintText: 'v3',
            ),
            textInputAction: TextInputAction.next,
          ),
          const SizedBox(height: LaSpace.item),
          TextField(
            controller: sellerPin,
            obscureText: true,
            keyboardType: TextInputType.number,
            inputFormatters: [
              FilteringTextInputFormatter.digitsOnly,
              LengthLimitingTextInputFormatter(8),
            ],
            autofillHints: const [AutofillHints.password],
            decoration: const InputDecoration(
              labelText: 'PIN',
              helperText: 'O PIN tem de 4 a 8 dígitos.',
            ),
            onSubmitted: (_) => submitSellerPin(),
          ),
          ExpansionTile(
            tilePadding: EdgeInsets.zero,
            title: Text('Já tenho o link', style: LaType.rotulo),
            children: [
              TextField(
                controller: portal,
                minLines: 2,
                maxLines: 4,
                decoration: const InputDecoration(labelText: 'Cole o link'),
              ),
              const SizedBox(height: LaSpace.item),
              LaButton(
                label: 'Abrir pelo link',
                variant: LaButtonVariant.contorno,
                onPressed: pending ? null : submitPortal,
              ),
            ],
          ),
        ],
        if (error != null) ...[
          const SizedBox(height: LaSpace.item),
          Text(error!, style: LaType.rotulo.copyWith(color: LaColors.perigo)),
        ],
        const SizedBox(height: LaSpace.secao),
        LaButton(
          key: const ValueKey('entrar'),
          label: 'Entrar',
          height: 58,
          loading: pending,
          onPressed: pending
              ? null
              : () => sellerMode ? submitSellerPin() : submitLab(),
        ),
      ],
    ),
  );

  Widget _brand() => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      const LaMonogram(size: 48),
      const SizedBox(height: 20),
      Text('ÓticaHub Lab', style: LaType.tituloTela),
      const SizedBox(height: 8),
      Text(
        'Cada OS no lugar. Cada etapa no tempo.',
        style: LaType.corpoForte.copyWith(color: LaColors.acento),
      ),
      const SizedBox(height: 8),
      Text(
        'Entre para continuar a produção do laboratório.',
        style: LaType.corpo.copyWith(color: LaColors.regua),
      ),
    ],
  );

  @override
  Widget build(BuildContext context) => Scaffold(
    resizeToAvoidBottomInset: true,
    body: SafeArea(
      child: LayoutBuilder(
        builder: (context, box) {
          final wide = box.maxWidth >= 760;
          return SingleChildScrollView(
            keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
            padding: EdgeInsets.all(wide ? 32 : 20),
            child: Align(
              alignment: Alignment.topCenter,
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 920),
                child: wide
                    ? Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Padding(
                              padding: const EdgeInsets.only(
                                top: 40,
                                right: 40,
                              ),
                              child: _brand(),
                            ),
                          ),
                          Expanded(child: _loginCard()),
                        ],
                      )
                    : Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          _brand(),
                          const SizedBox(height: 24),
                          _loginCard(),
                        ],
                      ),
              ),
            ),
          );
        },
      ),
    ),
  );

  Widget _loginCard() => Material(
    color: LaColors.branco,
    shape: const RoundedRectangleBorder(
      borderRadius: LaRadius.rCartao,
      side: BorderSide(color: LaColors.filete),
    ),
    child: Padding(padding: const EdgeInsets.all(20), child: _form()),
  );
}
