export 'workspace_view_stub.dart'
    if (dart.library.html) 'workspace_view_web.dart'
    if (dart.library.io) 'workspace_view_mobile.dart';
