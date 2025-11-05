import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url); const __dirname = path.dirname(__filename);
const app = express(); app.use(express.static(__dirname)); app.get('/', (req,res)=>res.sendFile(path.join(__dirname,'gracewise_v5_full.html'))); app.listen(process.env.PORT||10000, ()=>console.log('running'));
