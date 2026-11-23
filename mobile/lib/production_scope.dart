import 'package:flutter/foundation.dart';

import 'lab_api.dart';

const unassignedSeller = '__unassigned__';

class ProductionScope extends ChangeNotifier {
  ProductionScope({Future<List<Map<String, dynamic>>> Function()? sellerLoader})
    : _sellerLoader =
          sellerLoader ?? (() => LabApi().sellers(activeOnly: false));
  final Future<List<Map<String, dynamic>>> Function() _sellerLoader;
  List<Map<String, dynamic>> sellers = [];
  String? sellerId;
  String? error;
  bool _disposed = false;
  Future<void>? _loading;
  String get label => sellerId == null
      ? 'Todas as vendedoras'
      : sellerId == unassignedSeller
      ? 'Sem vendedora'
      : sellers
                .where((s) => s['id'] == sellerId)
                .map((s) => '${s['name']}')
                .firstOrNull ??
            'Vendedora selecionada';
  void select(String? id) {
    if (_disposed || sellerId == id) return;
    sellerId = id;
    notifyListeners();
  }

  Future<void> refreshSellers() {
    return _loading ??= _refresh().whenComplete(() => _loading = null);
  }

  Future<void> _refresh() async {
    try {
      final rows = await _sellerLoader();
      if (_disposed) return;
      sellers = rows;
      error = null;
      notifyListeners();
    } catch (_) {
      if (!_disposed) {
        error = 'Não foi possível atualizar as vendedoras. Tente novamente.';
        notifyListeners();
      }
    }
  }

  bool matches(Map<String, dynamic> row) =>
      sellerId == null ||
      (sellerId == unassignedSeller
          ? (row['seller_id'] == null || row['seller_id'] == '')
          : row['seller_id'] == sellerId);
  @override
  void dispose() {
    _disposed = true;
    super.dispose();
  }
}
