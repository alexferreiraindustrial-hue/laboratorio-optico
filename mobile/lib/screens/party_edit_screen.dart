import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../domain.dart';
import '../lab_api.dart';
import '../theme.dart';
import '../widgets.dart';

class PartyEditScreen extends StatefulWidget {
  const PartyEditScreen({super.key, required this.kind, this.id});
  final String kind;
  final String? id;

  @override
  State<PartyEditScreen> createState() => _PartyEditScreenState();
}

class _PartyEditScreenState extends State<PartyEditScreen> {
  final api = LabApi();
  final name = TextEditingController();
  final extra = TextEditingController();
  final phone = TextEditingController();
  final whatsapp = TextEditingController();
  final email = TextEditingController();
  final address = TextEditingController();
  final notes = TextEditingController();
  final code = TextEditingController();
  final pin = TextEditingController();
  List<Map<String, dynamic>> stores = [];
  final selectedStores = <String>{};
  bool active = true;
  bool loading = true;
  bool pending = false;
  String? error;
  String? portalLink;

  bool get loja => widget.kind == 'lojas';

  @override
  void initState() {
    super.initState();
    load();
  }

  @override
  void dispose() {
    name.dispose();
    extra.dispose();
    phone.dispose();
    whatsapp.dispose();
    email.dispose();
    address.dispose();
    notes.dispose();
    code.dispose();
    pin.dispose();
    super.dispose();
  }

  Future<void> load() async {
    try {
      final nextStores = await api.stores(activeOnly: false);
      Map<String, dynamic>? row;
      List<String> linked = [];
      if (widget.id != null) {
        if (loja) {
          for (final item in nextStores) {
            if (item['id'] == widget.id) row = item;
          }
        } else {
          final sellers = await api.sellers(activeOnly: false);
          for (final item in sellers) {
            if (item['id'] == widget.id) row = item;
          }
          linked = await api.sellerStoreIds(widget.id!);
        }
      }
      if (!mounted) return;
      setState(() {
        stores = nextStores;
        selectedStores.addAll(linked);
        if (row != null) {
          name.text = '${loja ? row['trade_name'] : row['name'] ?? ''}';
          extra.text = '${loja ? row['legal_name'] : ''}';
          phone.text = '${row['phone'] ?? ''}';
          whatsapp.text = '${row['whatsapp'] ?? ''}';
          email.text = '${row['email'] ?? ''}';
          address.text = '${row['address'] ?? ''}';
          notes.text = '${row['notes'] ?? ''}';
          code.text = '${row['quick_code'] ?? ''}';
          active = row['active'] == true;
        }
        loading = false;
        error = null;
      });
    } catch (e) {
      if (mounted) setState(() { error = friendlyError(e); loading = false; });
    }
  }

  Future<void> save({bool? nextActive}) async {
    if (name.text.trim().length < 2) {
      setState(() => error = loja ? 'Informe o nome da loja.' : 'Informe o nome do vendedor.');
      return;
    }
    setState(() => pending = true);
    try {
      final quick = int.tryParse(code.text.trim());
      if (loja) {
        await api.saveStore(
          id: widget.id,
          tradeName: name.text.trim(),
          legalName: extra.text.trim().isEmpty ? null : extra.text.trim(),
          phone: phone.text.trim().isEmpty ? null : phone.text.trim(),
          whatsapp: whatsapp.text.trim().isEmpty ? null : whatsapp.text.trim(),
          email: email.text.trim().isEmpty ? null : email.text.trim(),
          address: address.text.trim().isEmpty ? null : address.text.trim(),
          notes: notes.text.trim().isEmpty ? null : notes.text.trim(),
          quickCode: quick,
          active: nextActive ?? active,
        );
      } else {
        final saved = await api.saveSeller(
          id: widget.id,
          name: name.text.trim(),
          phone: phone.text.trim().isEmpty ? null : phone.text.trim(),
          whatsapp: whatsapp.text.trim().isEmpty ? null : whatsapp.text.trim(),
          email: email.text.trim().isEmpty ? null : email.text.trim(),
          notes: notes.text.trim().isEmpty ? null : notes.text.trim(),
          quickCode: quick,
          active: nextActive ?? active,
          storeIds: selectedStores.toList(),
        );
        final nextPin = pin.text.trim();
        if (nextPin.isNotEmpty) {
          if (!RegExp(r'^[0-9]{4,8}$').hasMatch(nextPin)) {
            throw Exception('O PIN do app deve ter de 4 a 8 dígitos.');
          }
          await api.setSellerAppAccess('${saved['id']}', nextPin);
        }
      }
      if (!mounted) return;
      context.pop();
    } catch (e) {
      if (mounted) setState(() => error = friendlyError(e));
    } finally {
      if (mounted) setState(() => pending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.id == null ? (loja ? 'Nova loja' : 'Novo vendedor') : (loja ? 'Editar loja' : 'Editar vendedor'))),
      body: loading
          ? Center(child: error == null ? const CircularProgressIndicator() : LabError(message: error!, onRetry: load))
          : ListView(
              padding: const EdgeInsets.all(AppSpace.md),
              children: [
                if (error != null) LabError(message: error!),
                TextField(controller: name, decoration: InputDecoration(labelText: loja ? 'Nome fantasia' : 'Nome')),
                if (loja) TextField(controller: extra, decoration: const InputDecoration(labelText: 'Razão social')),
                TextField(controller: code, decoration: InputDecoration(labelText: loja ? 'Código rápido (l)' : 'Código rápido (v)')),
                TextField(controller: phone, decoration: const InputDecoration(labelText: 'Telefone')),
                TextField(controller: whatsapp, decoration: const InputDecoration(labelText: 'WhatsApp')),
                TextField(controller: email, decoration: const InputDecoration(labelText: 'E-mail')),
                if (loja) TextField(controller: address, decoration: const InputDecoration(labelText: 'Endereço')),
                TextField(controller: notes, maxLines: 3, decoration: const InputDecoration(labelText: 'Observações')),
                if (!loja)
                  TextField(
                    controller: pin,
                    keyboardType: TextInputType.number,
                    obscureText: true,
                    decoration: InputDecoration(
                      labelText: 'PIN do app (4 a 8 dígitos)',
                      helperText: widget.id == null
                          ? 'Você cria o acesso. O vendedor entra no app com v${code.text.trim().isEmpty ? '…' : code.text.trim()} e este PIN. Só vê as OS dele.'
                          : 'Deixe em branco para não alterar. O vendedor entra com o código rápido e este PIN.',
                    ),
                  ),
                if (!loja) ...[
                  const SizedBox(height: AppSpace.md),
                  Text('Lojas vinculadas', style: Theme.of(context).textTheme.titleMedium),
                  for (final store in stores.where((row) => row['active'] == true || selectedStores.contains(row['id'])))
                    CheckboxListTile(
                      value: selectedStores.contains(store['id']),
                      title: Text('${store['trade_name']}'),
                      onChanged: (value) => setState(() {
                        if (value == true) {
                          selectedStores.add(store['id'] as String);
                        } else {
                          selectedStores.remove(store['id']);
                        }
                      }),
                    ),
                ],
                const SizedBox(height: AppSpace.md),
                FilledButton(onPressed: pending ? null : () => save(), child: Text(pending ? 'Salvando...' : 'Salvar')),
                if (widget.id != null && active)
                  TextButton(
                    onPressed: pending ? null : () => save(nextActive: false),
                    child: Text(loja ? 'Desativar loja (não apaga o histórico)' : 'Desativar vendedor (não apaga o histórico)'),
                  ),
                if (widget.id != null && !active)
                  TextButton(onPressed: pending ? null : () => save(nextActive: true), child: const Text('Reativar cadastro')),
                if (widget.id != null) ...[
                  const SizedBox(height: AppSpace.md),
                  Text(loja ? 'Link da loja' : 'Link PWA (opcional)', style: Theme.of(context).textTheme.titleMedium),
                  Text(loja
                      ? 'Gera o link do PWA. A loja vê só as OS dela.'
                      : 'O acesso principal do vendedor é o PIN acima. O link é extra, para o navegador.'),
                  OutlinedButton(
                    onPressed: pending
                        ? null
                        : () async {
                            setState(() => pending = true);
                            try {
                              final token = await api.issuePortalLink(loja ? 'store' : 'seller', widget.id!);
                              if (mounted) {
                                setState(() {
                                  portalLink = '$portalSite/acompanhar/${loja ? 'loja' : 'vendedor'}/$token';
                                  pending = false;
                                  error = null;
                                });
                              }
                            } catch (e) {
                              if (mounted) setState(() { error = friendlyError(e); pending = false; });
                            }
                          },
                    child: const Text('Gerar link de acompanhamento'),
                  ),
                  if (portalLink != null) SelectableText(portalLink!),
                ],
              ],
            ),
    );
  }
}
