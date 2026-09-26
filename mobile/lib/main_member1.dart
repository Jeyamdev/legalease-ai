import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:provider/provider.dart';
import 'features/lawyers/lawyer_api.dart';
import 'features/lawyers/lawyer_store.dart';
import 'features/lawyers/screens.dart';

void main() => runApp(const LegalServiceApp());

class LegalServiceApp extends StatelessWidget {
  const LegalServiceApp({super.key});
  @override
  Widget build(BuildContext context) => Provider<LawyerApi>(
    create: (_) =>
        LawyerApi(http.Client(), const String.fromEnvironment('API_BASE_URL')),
    dispose: (_, api) => api.dispose(),
    child: ChangeNotifierProvider(
      create: (context) => LawyerStore(context.read<LawyerApi>())..load(),
      child: MaterialApp(
        title: 'LegalEase',
        theme: ThemeData(
          colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xff0f172a)),
          scaffoldBackgroundColor: const Color(0xfff8f7f4),
          useMaterial3: true,
        ),
        home: const LawyerBrowseScreen(),
      ),
    ),
  );
}
