import express from 'express';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import {
  addBlockchainTransaction,
  createDoctorNote,
  createRecord,
  decideAccess,
  decideDoctorConnection,
  getDoctorConnectionRequests,
  getDoctorRecords,
  getMyDoctorConnections,
  getPatientDoctorNotes,
  getConversation,
  getMyRecords,
  getPatientRequests,
  listDoctors,
  requestAccess,
  requestDoctorConnection,
  revokeAccess,
  sendMessage,
} from '../controllers/recordController.js';

const router = express.Router();
router.use(requireAuth);
router.get('/doctors', listDoctors);
router.get('/doctor-connections', requireRole('patient'), getMyDoctorConnections);
router.post('/doctor-connections', requireRole('patient'), requestDoctorConnection);
router.get('/doctor-notes', requireRole('patient'), getPatientDoctorNotes);
router.post('/doctor-notes', requireRole('doctor'), createDoctorNote);
router.get('/messages/:userId', getConversation);
router.post('/messages', sendMessage);
router.get('/connection-requests', requireRole('doctor'), getDoctorConnectionRequests);
router.patch('/connection-requests/:connectionId', requireRole('doctor'), decideDoctorConnection);
router.post('/', requireRole('patient'), createRecord);
router.get('/mine', requireRole('patient'), getMyRecords);
router.patch('/:recordId/blockchain', requireRole('patient'), addBlockchainTransaction);
router.get('/requests', requireRole('patient'), getPatientRequests);
router.patch('/requests/:requestId', requireRole('patient'), decideAccess);
router.patch('/requests/:requestId/revoke', requireRole('patient'), revokeAccess);
router.post('/access-requests', requireRole('doctor'), requestAccess);
router.get('/shared-with-me', requireRole('doctor'), getDoctorRecords);

export default router;
