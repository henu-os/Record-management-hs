const fs = require('fs');

const p = 'D:/HENU AI/engines/ocr/voucher_pipeline.py';
let content = fs.readFileSync(p, 'utf-8');

content = content.replace(
  'enable_paddleocr_vl: bool = True',
  'enable_paddleocr_vl: bool = False'
);

fs.writeFileSync(p, content, 'utf-8');
console.log('Successfully updated D:/HENU AI/engines/ocr/voucher_pipeline.py default enable_paddleocr_vl');
