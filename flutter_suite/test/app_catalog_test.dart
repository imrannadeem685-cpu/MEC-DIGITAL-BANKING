import 'package:flutter_test/flutter_test.dart';
import 'package:mec_flutter_suite/app_config.dart';

void main() {
  test('all six MEC workspaces have unique IDs and HTTPS URLs', () {
    expect(workspaces, hasLength(6));
    final ids = workspaces.map((workspace) => workspace.id).toSet();
    expect(ids, hasLength(6));

    for (final workspace in workspaces) {
      expect(Uri.parse(workspace.url).scheme, 'https');
      expect(Uri.parse(workspace.logoUrl).scheme, 'https');
      expect(workspace.name, isNotEmpty);
    }
  });

  test('all known workspace IDs resolve', () {
    for (final workspace in workspaces) {
      expect(workspaceForId(workspace.id), isNotNull);
    }
    expect(workspaceForId('not-a-project'), isNull);
  });
}
