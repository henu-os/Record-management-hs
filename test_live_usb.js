const fs = require('fs');
const http = require('http');

const imgBytes = fs.readFileSync('g:/Astro/testvoucher.jpeg');
const b64 = imgBytes.toString('base64');

const data = JSON.stringify({
  image_base64: b64,
  filename: 'testvoucher.jpeg'
});

const req = http.request('http://127.0.0.1:8080/ocr', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
}, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    try {
      const json = JSON.parse(body);
      console.log('--- ENGINE_RESULTS ---');
      console.log(JSON.stringify(json.engine_results, null, 2));
      console.log('--- ALL FIELDS AND EVIDENCE ---');
      for (const [k, v] of Object.entries(json.fields || {})) {
        console.log(`FIELD [${k}]: val=${JSON.stringify(v.value)}, evidence=${JSON.stringify(v.evidence)}, conf=${v.confidence}`);
      }
    } catch (e) {
      console.error('Error parsing JSON:', e, body);
    }
  });
});

req.on('error', (e) => console.error('Request error:', e));
req.write(data);
req.end();
