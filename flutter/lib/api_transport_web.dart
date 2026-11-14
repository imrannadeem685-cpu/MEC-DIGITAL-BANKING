import 'package:http/browser_client.dart' as browser;
import 'package:http/http.dart' as http;

http.Client createHttpClient() => browser.BrowserClient()..withCredentials = true;
