import http.server
import socketserver
import os

PORT = 5455

class SPAHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        # Als het pad geen extensie heeft (zoals /lotte), stuur dan index.html terug (net als Vercel)
        if "." not in self.path:
            self.path = '/index.html'
        return super().do_GET()

print(f"Start een lokale server met Vercel-achtige routing op http://localhost:{PORT}")
with socketserver.TCPServer(("", PORT), SPAHandler) as httpd:
    httpd.serve_forever()
