class Catalog {
  final int id;
  final String name, description;
  final String? category;
  Catalog.fromJson(Map<String, dynamic> json)
    : id = json['id'] as int,
      name = json['name'] as String,
      description = json['description'] as String,
      category = json['category'] as String?;
}

class Lawyer {
  final String id, name, status;
  final int experience;
  final List<Catalog> specializations, services;
  final String? email, phone, qualification, description;
  Lawyer.fromJson(Map<String, dynamic> json)
    : id = json['lawyerId'] as String,
      name = json['name'] as String,
      status = json['status'] as String,
      experience = json['experience'] as int,
      specializations = (json['specializations'] as List)
          .map((s) => Catalog.fromJson(s as Map<String, dynamic>))
          .toList(),
      services = (json['legalServices'] as List)
          .map((s) => Catalog.fromJson(s as Map<String, dynamic>))
          .toList(),
      email = json['email'] as String?,
      phone = json['phoneNumber'] as String?,
      qualification = json['qualification'] as String?,
      description = json['profileDescription'] as String?;
}

class Availability {
  final String date, start, end;
  Availability.fromJson(Map<String, dynamic> json)
    : date = json['date'] as String,
      start = (json['startTime'] as String).substring(0, 5),
      end = (json['endTime'] as String).substring(0, 5);
}

class LawyerPage {
  final List<Lawyer> items;
  final int total;
  LawyerPage(this.items, this.total);
}
