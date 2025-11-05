import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;

// Serve static files from current directory
app.use(express.static(__dirname));

// Health check endpoint for Render
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Server is running' });
});

// Serve the main app
app.get('/', (req, res) => {
  console.log('Serving HTML file...');
  res.sendFile(path.join(__dirname, 'gracewise_v5_full.html'));
});

// Catch all other routes
app.get('*', (req, res) => {
  res.redirect('/');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 GraceWise Server running on port ${PORT}`);
  console.log(`📁 Directory: ${__dirname}`);
  console.log(`🔍 Health check: http://localhost:${PORT}/health`);
});
