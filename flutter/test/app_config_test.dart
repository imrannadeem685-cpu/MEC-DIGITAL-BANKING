import 'package:flutter_test/flutter_test.dart';
import 'package:mec_detail_banking_flutter/main.dart';

void main() {
  test('MEC Banking retains its brand and finance modules', () {
    expect(appConfig.name, 'MEC Detail Banking System');
    expect(appConfig.logoUrl, contains('mec-logo.webp'));
    expect(appConfig.features, isNotEmpty);
  });
}
