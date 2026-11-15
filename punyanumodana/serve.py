#!/usr/bin/env python3
"""
Simple local static server for Punyanumodana web app.
Usage: python3 serve.py [port]
"""

import http.server
import socketserver
import webbrowser
import os
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
os.chdir(os.path.dirname(os.path.abspath(__file__)))

Handler = http.server.SimpleHTTPRequestHandler
# Add proper svg and javascript mime types
Handler.extensions_map.update({
    '.svg': 'image/svg+xml',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.html': 'text/html',
})

print(f"☸ Starting Punyanumodana Server at http://localhost:{PORT}")
print(f"Directory: {os.getcwd()}")
print("Press Ctrl+C to stop.")

try:
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        webbrowser.open(f"http://localhost:{PORT}")
        httpd.serve_forever()
except KeyboardInterrupt:
    print("\nServer stopped.")
except OSError as e:
    if "Address already in use" in str(e):
        ALT_PORT = PORT + 1
        print(f"Port {PORT} in use, trying {ALT_PORT}...")
        with socketserver.TCPServer(("", ALT_PORT), Handler) as httpd:
            webbrowser.open(f"http://localhost:{ALT_PORT}")
            httpd.serve_forever()
    else:
        raise

