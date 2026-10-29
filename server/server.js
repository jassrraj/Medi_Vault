import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import app from './app.js';
import { connectDB } from './config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const PORT = Number(process.env.PORT || 5000);

const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`IPFS (Pinata) configuration: ${process.env.PINATA_JWT ? 'configured' : 'missing PINATA_JWT'}`);
    });
  } catch {
    console.error('Server did not start: PostgreSQL must be running and match server/.env.');
    process.exit(1);
  }
};

startServer();
