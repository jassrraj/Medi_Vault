import express from 'express';
import multer from 'multer';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import { downloadApprovedRecord, uploadDoctorRecordFile, uploadRecordFile } from '../controllers/fileController.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: (_req, file, done) => done(null, ['application/pdf', 'image/jpeg', 'image/png', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'].includes(file.mimetype)) });

router.use(requireAuth);
router.post('/upload', requireRole('patient'), upload.single('file'), uploadRecordFile);
router.post('/upload-for-patient', requireRole('doctor'), upload.single('file'), uploadDoctorRecordFile);
router.get('/:recordId/download', downloadApprovedRecord);
router.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError) return res.status(400).json({ message: error.code === 'LIMIT_FILE_SIZE' ? 'File must be 10 MB or smaller' : 'Invalid upload' });
  return res.status(400).json({ message: 'Only PDF, JPG, JPEG, PNG, DOC, DOCX, and TXT files are allowed' });
});

export default router;
