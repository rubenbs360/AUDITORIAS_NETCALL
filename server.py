import http.server
import socketserver
import webbrowser
import threading
import time

PORT = 8010

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Habilitar cabeceras CORS por seguridad de desarrollo local
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

def start_server():
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"[SERVIDOR] Corriendo en http://localhost:{PORT}")
        httpd.serve_forever()

if __name__ == "__main__":
    # Iniciar servidor en hilo secundario
    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()
    
    # Esperar 1 segundo y abrir navegador web automáticamente
    time.sleep(1.0)
    url = f"http://localhost:{PORT}/index.html"
    print(f"[NAVEGADOR] Abriendo el portal de auditorías: {url}")
    webbrowser.open(url)
    
    # Mantener el hilo principal activo
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n[STOP] Servidor detenido por el usuario.")
