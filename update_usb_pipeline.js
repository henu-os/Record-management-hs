const fs = require('fs');

const p = 'D:/HENU AI/engines/ocr/voucher_pipeline.py';
let content = fs.readFileSync(p, 'utf-8');

if (!content.includes('"raw_text": full_combined_text')) {
  content = content.replace(
    'canonical_result = {',
    'full_combined_text = "\\n\\n".join(["\\n".join(texts) for texts in engine_raw_texts.values() if texts]).strip()\n        canonical_result = {\n            "raw_text": full_combined_text,\n            "raw_ocr": {"full_text": full_combined_text, "engine_texts": engine_raw_texts},'
  );
  fs.writeFileSync(p, content, 'utf-8');
  console.log('Successfully updated D:/HENU AI/engines/ocr/voucher_pipeline.py');
} else {
  console.log('Already updated');
}
