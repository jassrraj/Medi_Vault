import express from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes.js';
import recordRoutes from './routes/recordRoutes.js';
import fileRoutes from './routes/fileRoutes.js';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (_req, res) => {
  res.json({
    message: 'Backend is running successfully',
    ipfsConfigured: Boolean(process.env.PINATA_JWT),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/records', recordRoutes);
app.use('/api/files', fileRoutes);

export default app;
