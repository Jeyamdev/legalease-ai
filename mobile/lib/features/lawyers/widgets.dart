import 'package:flutter/material.dart';
import 'models.dart';

class LoadError extends StatelessWidget {
  final String message;
  final VoidCallback retry;
  const LoadError({super.key, required this.message, required this.retry});
  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(message),
          const SizedBox(height: 12),
          FilledButton(onPressed: retry, child: const Text('Try again')),
        ],
      ),
    ),
  );
}

class LawyerCard extends StatelessWidget {
  final Lawyer lawyer;
  final VoidCallback onTap;
  const LawyerCard({super.key, required this.lawyer, required this.onTap});
  @override
  Widget build(BuildContext context) => Card(
    child: ListTile(
      title: Text(lawyer.name),
      subtitle: Text(
        '${lawyer.experience} years experience\n${lawyer.specializations.map((s) => s.name).join(', ')}',
      ),
      isThreeLine: true,
      trailing: const Icon(Icons.chevron_right),
      onTap: onTap,
    ),
  );
}
