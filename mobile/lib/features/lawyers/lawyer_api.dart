import 'dart:convert';
import 'package:http/http.dart' as http;
import 'models.dart';

class LawyerApi {
  final http.Client client;
  final String baseUrl;
  LawyerApi(this.client, this.baseUrl);

  Future<dynamic> _get(String path, [Map<String, String>? query]) async {
    if (baseUrl.isEmpty) {
      throw Exception('Configure API_BASE_URL to connect to the platform.');
    }
    final uri = Uri.parse(
      '${baseUrl.replaceFirst(RegExp(r'/+$'), '')}/$path',
    ).replace(queryParameters: query);
    final response = await client.get(uri).timeout(const Duration(seconds: 15));
    if (response.statusCode == 404) {
      throw Exception('This lawyer is no longer available.');
    }
    if (response.statusCode != 200) {
      throw Exception('Unable to load platform data. Please try again.');
    }
    return jsonDecode(response.body);
  }

  Future<List<Catalog>> specializations() async =>
      (await _get('specializations') as List)
          .map((s) => Catalog.fromJson(s as Map<String, dynamic>))
          .toList();

  Future<LawyerPage> search({
    String search = '',
    int? specializationId,
    int page = 1,
  }) async {
    final result =
        await _get('lawyer-management/search', {
              'search': search,
              'page': '$page',
              'pageSize': '20',
              'status': 'Active',
              if (specializationId != null)
                'specializationId': '$specializationId',
            })
            as Map<String, dynamic>;
    return LawyerPage(
      (result['items'] as List)
          .map((s) => Lawyer.fromJson(s as Map<String, dynamic>))
          .toList(),
      result['totalCount'] as int,
    );
  }

  Future<Lawyer> lawyer(String id) async =>
      Lawyer.fromJson(await _get('lawyer-management/$id') as Map<String, dynamic>);
  Future<List<Availability>> availability(String id) async =>
      (await _get('lawyer-management/$id/availability') as List)
          .map((s) => Availability.fromJson(s as Map<String, dynamic>))
          .toList();
  void dispose() => client.close();
}
