const fs = require('fs');

const p = 'D:/HENU AI/engines/ocr/paddleocr_vl_adapter.py';
let content = fs.readFileSync(p, 'utf-8');

content = content.replace(
  '            torch.set_num_threads(num_threads)\n            torch.set_num_interop_threads(1)',
  '            try:\n                torch.set_num_threads(num_threads)\n                torch.set_num_interop_threads(1)\n            except Exception:\n                pass'
);

fs.writeFileSync(p, content, 'utf-8');
console.log('Successfully updated paddleocr_vl_adapter.py');
