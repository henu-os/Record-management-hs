const fs = require('fs');

const p = 'D:/HENU AI/service/henu_ai_service.py';
let content = fs.readFileSync(p, 'utf-8');

// Update _set_headers
content = content.replace(
  `    def _set_headers(self, status_code: int = 200, content_type: str = "application/json"):
        self.send_response(status_code)
        self.send_header("Content-Type", content_type)
        self.send_header("Access-Control-Allow-Origin", "http://localhost:*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-HENU-Device-ID")
        self.send_header("Server", "HENU-AI-USB/1.0.0")
        self.end_headers()`,
  `    def _set_headers(self, status_code: int = 200, content_type: str = "application/json"):
        self.send_response(status_code)
        self.send_header("Content-Type", content_type)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, HEAD")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.send_header("Access-Control-Max-Age", "86400")
        self.send_header("Server", "HENU-AI-USB/1.0.0")
        self.end_headers()`
);

fs.writeFileSync(p, content, 'utf-8');
console.log('Successfully updated CORS in henu_ai_service.py');
