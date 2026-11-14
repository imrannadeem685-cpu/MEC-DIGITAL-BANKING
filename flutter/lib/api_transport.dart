import 'package:http/http.dart' as http;

import 'api_transport_stub.dart'
    if (dart.library.io) 'api_transport_io.dart'
    if (dart.library.html) 'api_transport_web.dart' as transport;

http.Client createHttpClient() => transport.createHttpClient();
