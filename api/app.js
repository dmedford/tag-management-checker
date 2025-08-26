import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const jsPath = join(__dirname, '..', 'public', 'app.js');
    const js = readFileSync(jsPath, 'utf8');
    
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.status(200).send(js);
  } catch (error) {
    console.error('Error serving app.js:', error);
    res.status(404).send('File not found');
  }
}