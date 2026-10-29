import { pool } from '../config/db.js';
import { decryptMedicalFile, encryptMedicalFile } from '../services/secureStorage.js';
import { downloadEncryptedFile, uploadEncryptedFile } from '../services/pinata.js';

export const uploadRecordFile = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'A PDF, JPG, JPEG, PNG, DOC, DOCX, or TXT file is required' });
    const encrypted = encryptMedicalFile(req.file.buffer);
    const ipfsCid = await uploadEncryptedFile(encrypted.encryptedFile, req.file.originalname);
    const result = await pool.query(
      `INSERT INTO health_records (patient_id, file_name, file_type, ipfs_cid, encrypted_file_key, record_hash)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, file_name AS "fileName", file_type AS "fileType", ipfs_cid AS "ipfsCid", record_hash AS "recordHash", created_at AS "createdAt"`,
      [req.user.id, req.file.originalname, req.file.mimetype, ipfsCid, encrypted.keyMetadata, encrypted.contentHash]
    );
    return res.status(201).json({ message: 'Encrypted file uploaded to IPFS', record: result.rows[0] });
  } catch (error) {
    console.error('Secure upload error:', error.message);
    if (error.message.includes('PINATA_JWT')) return res.status(502).json({ message: 'IPFS upload is not configured yet' });
    if (error.message.startsWith('Pinata upload failed') || error.message.includes('Pinata upload completed')) return res.status(502).json({ message: error.message });
    if (error.message.includes('FILE_ENCRYPTION_MASTER_KEY')) return res.status(500).json({ message: 'Server encryption key is invalid. Check FILE_ENCRYPTION_MASTER_KEY in server/.env.' });
    return res.status(502).json({ message: 'Upload failed after encryption. Check the backend terminal for the Secure upload error.' });
  }
};

export const uploadDoctorRecordFile = async (req, res) => {
  try {
    const patientId = Number(req.body.patientId);
    const note = req.body.note?.trim();
    if (!Number.isInteger(patientId) || !req.file || !note) return res.status(400).json({ message: 'patientId, file, and note are required' });

    const access = await pool.query(
      `SELECT 1 FROM users p
       WHERE p.id = $1 AND p.role = 'patient' AND (
         EXISTS (SELECT 1 FROM doctor_connections dc WHERE dc.patient_id = p.id AND dc.doctor_id = $2 AND dc.status = 'approved')
         OR EXISTS (SELECT 1 FROM record_access_requests ar JOIN health_records r ON r.id = ar.record_id WHERE r.patient_id = p.id AND ar.doctor_id = $2 AND ar.status = 'approved')
       )`, [patientId, req.user.id]
    );
    if (!access.rowCount) return res.status(403).json({ message: 'You do not have approved access to this patient' });

    const encrypted = encryptMedicalFile(req.file.buffer);
    const ipfsCid = await uploadEncryptedFile(encrypted.encryptedFile, req.file.originalname);
    const result = await pool.query(
      `INSERT INTO health_records (patient_id, file_name, file_type, ipfs_cid, encrypted_file_key, record_hash, uploaded_by_doctor_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, file_name AS "fileName", file_type AS "fileType", record_hash AS "recordHash", uploaded_by_doctor_id AS "uploadedByDoctorId", created_at AS "createdAt"`,
      [patientId, req.file.originalname, req.file.mimetype, ipfsCid, encrypted.keyMetadata, encrypted.contentHash, req.user.id]
    );
    await pool.query(
      'INSERT INTO doctor_notes (record_id, doctor_id, patient_id, note) VALUES ($1, $2, $3, $4)',
      [result.rows[0].id, req.user.id, patientId, note]
    );
    return res.status(201).json({ message: 'Document uploaded for patient', record: result.rows[0] });
  } catch (error) {
    console.error('Doctor document upload error:', error.message);
    if (error.message.includes('PINATA_JWT')) return res.status(502).json({ message: 'IPFS upload is not configured yet' });
    if (error.message.includes('FILE_ENCRYPTION_MASTER_KEY')) return res.status(500).json({ message: 'Server encryption key is invalid. Check FILE_ENCRYPTION_MASTER_KEY in server/.env.' });
    return res.status(502).json({ message: 'Upload failed after encryption. Check the backend terminal for the secure upload error.' });
  }
};

export const downloadApprovedRecord = async (req, res) => {
  try {
    const recordId = Number(req.params.recordId);
    if (!Number.isInteger(recordId)) return res.status(400).json({ message: 'Invalid record id' });
    const result = await pool.query(
      `SELECT r.id, r.patient_id, r.file_name, r.file_type, r.ipfs_cid, r.encrypted_file_key
       FROM health_records r WHERE r.id = $1`, [recordId]
    );
    const record = result.rows[0];
    if (!record) return res.status(404).json({ message: 'Record not found' });
    const isOwner = record.patient_id === req.user.id;
    const approvedRecordAccess = (await pool.query(`SELECT 1 FROM record_access_requests WHERE record_id = $1 AND doctor_id = $2 AND status = 'approved'`, [recordId, req.user.id])).rowCount > 0;
    const approvedConnection = (await pool.query(`SELECT 1 FROM doctor_connections WHERE patient_id = $1 AND doctor_id = $2 AND status = 'approved'`, [record.patient_id, req.user.id])).rowCount > 0;
    const access = isOwner || approvedRecordAccess || approvedConnection;
    if (!access) return res.status(403).json({ message: 'You do not have approved access to this record' });
    if (!record.encrypted_file_key) return res.status(409).json({ message: 'This legacy record has no encrypted file attached' });
    const encryptedFile = await downloadEncryptedFile(record.ipfs_cid);
    const file = decryptMedicalFile(encryptedFile, record.encrypted_file_key);
    res.setHeader('Content-Type', record.file_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(record.file_name)}"`);
    return res.send(file);
  } catch (error) {
    console.error('Secure download error:', error.message);
    return res.status(502).json({ message: 'Unable to retrieve and decrypt the record' });
  }
};
