import 'package:flutter/foundation.dart';
import 'lawyer_api.dart';
import 'models.dart';

class LawyerStore extends ChangeNotifier {
  final LawyerApi api;
  LawyerStore(this.api);
  List<Lawyer> lawyers = [];
  List<Catalog> specializations = [];
  bool loading = false;
  String? error;
  String searchText = '';
  int? specializationId;
  int page = 1, total = 0;
  int _request = 0;
  bool _disposed = false;

  Future<void> load({
    String? search,
    int? specialization,
    bool changeFilter = false,
    int? nextPage,
  }) async {
    if (search != null) searchText = search;
    if (changeFilter) specializationId = specialization;
    page = nextPage ?? 1;
    final request = ++_request;
    loading = true;
    error = null;
    notifyListeners();
    try {
      final specs = specializations.isEmpty
          ? await api.specializations()
          : specializations;
      final result = await api.search(
        search: searchText,
        specializationId: specializationId,
        page: page,
      );
      if (_disposed || request != _request) return;
      specializations = specs;
      lawyers = result.items;
      total = result.total;
    } catch (_) {
      if (_disposed || request != _request) return;
      error = 'Unable to load lawyers. Check your connection and try again.';
    } finally {
      if (!_disposed && request == _request) {
        loading = false;
        notifyListeners();
      }
    }
  }

  @override
  void dispose() {
    _disposed = true;
    super.dispose();
  }
}

class LawyerProfileStore extends ChangeNotifier {
  final LawyerApi api;
  final String id;
  LawyerProfileStore(this.api, this.id);
  Lawyer? lawyer;
  List<Availability> availability = [];
  bool loading = false, _disposed = false;
  String? error;

  Future<void> load() async {
    loading = true;
    error = null;
    notifyListeners();
    try {
      final profile = await api.lawyer(id);
      final periods = await api.availability(id);
      if (!_disposed) {
        lawyer = profile;
        availability = periods;
      }
    } catch (_) {
      if (!_disposed) {
        error = 'Unable to load this profile. It may no longer be available.';
      }
    } finally {
      if (!_disposed) {
        loading = false;
        notifyListeners();
      }
    }
  }

  @override
  void dispose() {
    _disposed = true;
    super.dispose();
  }
}
