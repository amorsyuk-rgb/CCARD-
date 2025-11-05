import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Serve static files from current directory
app.use(express.static(__dirname));

// Route for root path
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'gracewise_v5_full.html'));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`GraceWise v5 server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser`);
});
