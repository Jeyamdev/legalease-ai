import 'package:flutter/foundation.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:shared_preferences/shared_preferences.dart';

class ApiConfig {
  static const String _backendPrefKey = 'config_backend_url';
  static const String _buildBackendUrl = String.fromEnvironment('BACKEND_URL');

  static String get defaultBackendUrl {
    if (kReleaseMode && (!_buildBackendUrl.startsWith('https://'))) {
      throw StateError('Release builds require --dart-define=BACKEND_URL=https://your-api.example');
    }
    return _buildBackendUrl.isNotEmpty
        ? _buildBackendUrl
        : (dotenv.env['BACKEND_URL'] ?? 'http://localhost:5000');
  }

  static final ValueNotifier<String> backendUrl = ValueNotifier<String>(defaultBackendUrl);

  static Future<void> initialize() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getString(_backendPrefKey);
    backendUrl.value = kReleaseMode && (saved == null || !saved.startsWith('https://'))
        ? defaultBackendUrl
        : (saved ?? defaultBackendUrl);
  }

  static String normalizeBackendUrl(String url) {
    return url.trim().replaceAll(RegExp(r'/+      throw ArgumentError('Release API URL must use HTTPS.');
    }
    backendUrl.value = clean;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_backendPrefKey, clean);
  }
}
), '');
  }

  static Future<void> setBackendUrl(String url) async {
    final clean = normalizeBackendUrl(url);
    if (kReleaseMode && !clean.startsWith('https://')) {
      throw ArgumentError('Release API URL must use HTTPS.');
    }
    backendUrl.value = clean;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_backendPrefKey, clean);
  }
}
