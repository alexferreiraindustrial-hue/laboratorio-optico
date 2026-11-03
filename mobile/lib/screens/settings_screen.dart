import 'package:flutter/material.dart';

import '../domain.dart';
import '../lab_api.dart';
import '../session.dart';
import '../theme.dart';
import '../widgets.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key, required this.session});
  final Session session;

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final api = LabApi();
  final name = TextEditingController();
  final email = TextEditingController();
  final password = TextEditingController();
  final labName = TextEditingController();
  final labCode = TextEditingController();
  final goalTarget = TextEditingController();
  List<Map<String, dynamic>> labs = [];
  List<Map<String, dynamic>> users = [];
  List<Map<String, dynamic>> goals = [];
  String newRole = 'montador';
  String goalScope = 'daily';
  String? error;
  String? message;
  bool loading = true;
  bool pending = false;

  String get role => widget.session.profile?.role ?? 'consulta';
  bool get admin => canUsersManage(role);
  bool get writable => canSettingsWrite(role);

  @override
  void initState() {
    super.initState();
    load();
  }

  @override
  void dispose() {
    name.dispose();
    email.dispose();
    password.dispose();
    labName.dispose();
    labCode.dispose();
    goalTarget.dispose();
    super.dispose();
  }

  Future<void> load() async {
    try {
      final nextLabs = await api.catalogs(activeOnly: false);
      final nextUsers = admin ? await api.staffUsers() : <Map<String, dynamic>>[];
      final nextGoals = writable ? await api.productionGoals() : <Map<String, dynamic>>[];
      if (mounted) {
        setState(() {
          labs = nextLabs;
          users = nextUsers;
          goals = nextGoals;
          loading = false;
          error = null;
        });
      }
    } catch (e) {
      if (mounted) setState(() { error = friendlyError(e); loading = false; });
    }
  }

  Future<void> createUser() async {
    setState(() { pending = true; error = null; message = null; });
    try {
      await api.createStaffUser(
        email: email.text.trim(),
        password: password.text,
        fullName: name.text.trim(),
        role: newRole,
      );
      name.clear();
      email.clear();
      password.clear();
      message = 'Usuário criado. Pode entrar no app com este e-mail e senha.';
      await load();
    } catch (e) {
      if (mounted) setState(() => error = friendlyError(e));
    } finally {
      if (mounted) setState(() => pending = false);
    }
  }

  Future<void> saveLab() async {
    setState(() { pending = true; error = null; message = null; });
    try {
      await api.saveLaboratory(name: labName.text.trim(), code: labCode.text.trim().toUpperCase());
      labName.clear();
      labCode.clear();
      message = 'Laboratório salvo.';
      await load();
    } catch (e) {
      if (mounted) setState(() => error = friendlyError(e));
    } finally {
      if (mounted) setState(() => pending = false);
    }
  }

  Future<void> saveGoal() async {
    final target = int.tryParse(goalTarget.text.trim());
    if (target == null) {
      setState(() => error = 'Informe a meta numérica.');
      return;
    }
    setState(() { pending = true; error = null; message = null; });
    try {
      await api.saveProductionGoal(
        scope: goalScope,
        target: target,
        validFrom: DateTime.now().toIso8601String().substring(0, 10),
      );
      goalTarget.clear();
      message = 'Meta registrada.';
      await load();
    } catch (e) {
      if (mounted) setState(() => error = friendlyError(e));
    } finally {
      if (mounted) setState(() => pending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final profile = widget.session.profile;
    return Scaffold(
      appBar: AppBar(title: const Text('Configurações')),
      body: loading
          ? Center(child: error == null ? const CircularProgressIndicator() : LabError(message: error!, onRetry: load))
          : RefreshIndicator(
              onRefresh: load,
              child: ListView(
                padding: const EdgeInsets.all(AppSpace.md),
                children: [
                  if (error != null) LabError(message: error!),
                  if (message != null) Text(message!, style: const TextStyle(fontWeight: FontWeight.w700)),
                  Text(profile?.fullName ?? '', style: Theme.of(context).textTheme.headlineMedium),
                  Text('Perfil: ${roleLabel[profile?.role] ?? profile?.role ?? ''}'),
                  const SizedBox(height: AppSpace.lg),
                  Text('Laboratórios', style: Theme.of(context).textTheme.titleLarge),
                  for (final lab in labs)
                    SwitchListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text('${lab['name']}'),
                      subtitle: Text('${lab['code'] ?? ''}'),
                      value: lab['active'] == true,
                      onChanged: !writable
                          ? null
                          : (value) async {
                              try {
                                await api.saveLaboratory(
                                  id: lab['id'] as String,
                                  name: '${lab['name']}',
                                  code: '${lab['code']}',
                                  color: '${lab['color'] ?? '#0e6b62'}',
                                  notes: lab['notes'] as String?,
                                  active: value,
                                );
                                await load();
                              } catch (e) {
                                if (mounted) setState(() => error = friendlyError(e));
                              }
                            },
                    ),
                  if (writable) ...[
                    TextField(controller: labName, decoration: const InputDecoration(labelText: 'Novo laboratório')),
                    TextField(controller: labCode, decoration: const InputDecoration(labelText: 'Código (ex.: LAB)')),
                    const SizedBox(height: 8),
                    FilledButton.tonal(onPressed: pending ? null : saveLab, child: const Text('Cadastrar laboratório')),
                  ],
                  const SizedBox(height: AppSpace.lg),
                  Text('Metas de produção', style: Theme.of(context).textTheme.titleLarge),
                  if (goals.isEmpty) const Text('Nenhuma meta cadastrada.'),
                  for (final goal in goals.take(8))
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text('${goal['target']} OS · ${goal['scope']}'),
                      subtitle: Text('${goal['valid_from'] ?? ''}'),
                    ),
                  if (writable) ...[
                    DropdownButtonFormField<String>(
                      initialValue: goalScope,
                      items: const [
                        DropdownMenuItem(value: 'daily', child: Text('Diária')),
                        DropdownMenuItem(value: 'weekly', child: Text('Semanal')),
                        DropdownMenuItem(value: 'monthly', child: Text('Mensal')),
                      ],
                      onChanged: (value) => setState(() => goalScope = value ?? 'daily'),
                      decoration: const InputDecoration(labelText: 'Período da meta'),
                    ),
                    TextField(controller: goalTarget, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Quantidade')),
                    const SizedBox(height: 8),
                    FilledButton.tonal(onPressed: pending ? null : saveGoal, child: const Text('Registrar meta')),
                  ],
                  if (admin) ...[
                    const SizedBox(height: AppSpace.lg),
                    Text('Usuários internos', style: Theme.of(context).textTheme.titleLarge),
                    const Text('Quem entra no app e no sistema para acompanhar e movimentar OS.'),
                    const SizedBox(height: 8),
                    TextField(controller: name, decoration: const InputDecoration(labelText: 'Nome completo')),
                    TextField(controller: email, keyboardType: TextInputType.emailAddress, decoration: const InputDecoration(labelText: 'E-mail')),
                    TextField(controller: password, obscureText: true, decoration: const InputDecoration(labelText: 'Senha (mínimo 8)')),
                    DropdownButtonFormField<String>(
                      initialValue: newRole,
                      items: [
                        for (final item in staffRoles)
                          DropdownMenuItem(value: item, child: Text(roleLabel[item] ?? item)),
                      ],
                      onChanged: (value) => setState(() => newRole = value ?? 'montador'),
                      decoration: const InputDecoration(labelText: 'Perfil'),
                    ),
                    const SizedBox(height: 8),
                    FilledButton(onPressed: pending ? null : createUser, child: Text(pending ? 'Criando...' : 'Criar usuário')),
                    const SizedBox(height: AppSpace.md),
                    for (final user in users)
                      ListTile(
                        contentPadding: EdgeInsets.zero,
                        title: Text('${user['full_name']}'),
                        subtitle: Text(roleLabel['${user['role']}'] ?? '${user['role']}'),
                        trailing: Switch(
                          value: user['active'] == true,
                          onChanged: (value) async {
                            try {
                              await api.updateStaffUser(user['id'] as String, active: value);
                              await load();
                            } catch (e) {
                              if (mounted) setState(() => error = friendlyError(e));
                            }
                          },
                        ),
                        onTap: () async {
                          final next = await showModalBottomSheet<String>(
                            context: context,
                            builder: (context) => ListView(
                              shrinkWrap: true,
                              children: [
                                for (final item in staffRoles)
                                  ListTile(
                                    title: Text(roleLabel[item] ?? item),
                                    onTap: () => Navigator.pop(context, item),
                                  ),
                              ],
                            ),
                          );
                          if (next == null) return;
                          try {
                            await api.updateStaffUser(user['id'] as String, role: next);
                            await load();
                          } catch (e) {
                            if (mounted) setState(() => error = friendlyError(e));
                          }
                        },
                      ),
                  ],
                ],
              ),
            ),
    );
  }
}
