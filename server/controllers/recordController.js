import { pool } from '../config/db.js';

const recordFields = `r.id, r.file_name AS "fileName", r.file_type AS "fileType", r.ipfs_cid AS "ipfsCid", r.record_hash AS "recordHash", r.blockchain_tx_hash AS "blockchainTxHash", r.blockchain_record_id AS "blockchainRecordId", r.uploaded_by_doctor_id AS "uploadedByDoctorId", r.created_at AS "createdAt"`;

export const createRecord = async (req, res) => {
  try {
    const { fileName, fileType, ipfsCid, recordHash, blockchainTxHash } = req.body;
    if (!fileName?.trim() || !ipfsCid?.trim()) return res.status(400).json({ message: 'fileName and ipfsCid are required' });
    const result = await pool.query(
      `INSERT INTO health_records (patient_id, file_name, file_type, ipfs_cid, record_hash, blockchain_tx_hash)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, file_name AS "fileName", file_type AS "fileType", ipfs_cid AS "ipfsCid", record_hash AS "recordHash", blockchain_tx_hash AS "blockchainTxHash", created_at AS "createdAt"`,
      [req.user.id, fileName.trim(), fileType?.trim() || null, ipfsCid.trim(), recordHash?.trim() || null, blockchainTxHash?.trim() || null]
    );
    return res.status(201).json({ message: 'Record metadata saved', record: result.rows[0] });
  } catch (error) {
    console.error('Create record error:', error.message);
    return res.status(500).json({ message: 'Unable to save record metadata' });
  }
};

export const getMyRecords = async (req, res) => {
  try {
    const records = await pool.query(`SELECT ${recordFields}, du.full_name AS "uploadedByDoctorName"
      FROM health_records r LEFT JOIN users du ON du.id = r.uploaded_by_doctor_id
      WHERE r.patient_id = $1 ORDER BY r.created_at DESC`, [req.user.id]);
    return res.json({ records: records.rows });
  } catch (error) {
    console.error('Get records error:', error.message);
    return res.status(500).json({ message: 'Unable to load records' });
  }
};

export const addBlockchainTransaction = async (req, res) => {
  try {
    const recordId = Number(req.params.recordId);
    const transactionHash = (req.body.blockchainTxHash || '').trim();
    const blockchainRecordId = Number(req.body.blockchainRecordId);
    if (!Number.isInteger(recordId) || !/^0x[a-fA-F0-9]{64}$/.test(transactionHash) || !Number.isInteger(blockchainRecordId) || blockchainRecordId < 1) return res.status(400).json({ message: 'A valid blockchain transaction hash and record ID are required' });
    const result = await pool.query(
      `UPDATE health_records SET blockchain_tx_hash = $1, blockchain_record_id = $2 WHERE id = $3 AND patient_id = $4
       RETURNING id, blockchain_tx_hash AS "blockchainTxHash", blockchain_record_id AS "blockchainRecordId"`, [transactionHash, blockchainRecordId, recordId, req.user.id]
    );
    if (!result.rowCount) return res.status(404).json({ message: 'Record not found' });
    return res.json({ record: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to save blockchain transaction' });
  }
};

export const listDoctors = async (_req, res) => {
  try {
    const doctors = await pool.query("SELECT id, full_name AS \"fullName\", email FROM users WHERE role = 'doctor' ORDER BY full_name");
    return res.json({ doctors: doctors.rows });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to load doctors' });
  }
};

export const requestDoctorConnection = async (req, res) => {
  try {
    const doctorId = Number(req.body.doctorId);
    if (!Number.isInteger(doctorId)) return res.status(400).json({ message: 'A valid doctorId is required' });

    const doctor = await pool.query("SELECT id FROM users WHERE id = $1 AND role = 'doctor'", [doctorId]);
    if (!doctor.rowCount) return res.status(404).json({ message: 'Doctor not found' });

    const result = await pool.query(
      `INSERT INTO doctor_connections (patient_id, doctor_id, status)
       VALUES ($1, $2, 'pending')
       ON CONFLICT (patient_id, doctor_id) DO UPDATE SET status = 'pending', requested_at = CURRENT_TIMESTAMP, decided_at = NULL
       RETURNING id, patient_id AS "patientId", doctor_id AS "doctorId", status, requested_at AS "requestedAt"`,
      [req.user.id, doctorId]
    );

    return res.status(201).json({ message: 'Connection request sent to doctor', connection: result.rows[0] });
  } catch (error) {
    console.error('Doctor connection request error:', error.message);
    return res.status(500).json({ message: 'Unable to send doctor connection request' });
  }
};

export const getMyDoctorConnections = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT dc.id, dc.status, dc.requested_at AS "requestedAt", dc.decided_at AS "decidedAt",
              u.id AS "doctorId", u.full_name AS "doctorName", u.email AS "doctorEmail"
       FROM doctor_connections dc
       JOIN users u ON u.id = dc.doctor_id
       WHERE dc.patient_id = $1
       ORDER BY dc.requested_at DESC`, [req.user.id]
    );
    return res.json({ connections: result.rows });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to load doctor connections' });
  }
};

export const getPatientDoctorNotes = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT dn.id, dn.record_id AS "recordId", dn.note, dn.created_at AS "createdAt", dn.updated_at AS "updatedAt",
              u.id AS "doctorId", u.full_name AS "doctorName", r.file_name AS "fileName", r.uploaded_by_doctor_id AS "uploadedByDoctorId"
       FROM doctor_notes dn
       JOIN users u ON u.id = dn.doctor_id
       JOIN health_records r ON r.id = dn.record_id
       JOIN doctor_connections dc ON dc.patient_id = dn.patient_id AND dc.doctor_id = dn.doctor_id AND dc.status = 'approved'
       WHERE dn.patient_id = $1
       ORDER BY dn.created_at DESC`, [req.user.id]
    );
    return res.json({ notes: result.rows });
  } catch (error) {
    console.error('Get doctor notes error:', error.message);
    return res.status(500).json({ message: 'Unable to load doctor notes' });
  }
};

export const createDoctorNote = async (req, res) => {
  try {
    const recordId = Number(req.body.recordId);
    const note = req.body.note?.trim();
    if (!Number.isInteger(recordId) || !note) return res.status(400).json({ message: 'A recordId and note are required' });

    const access = await pool.query(
      `SELECT r.patient_id AS "patientId"
       FROM health_records r
       LEFT JOIN record_access_requests ar ON ar.record_id = r.id AND ar.doctor_id = $2 AND ar.status = 'approved'
       LEFT JOIN doctor_connections dc ON dc.patient_id = r.patient_id AND dc.doctor_id = $2 AND dc.status = 'approved'
       WHERE r.id = $1 AND (ar.id IS NOT NULL OR dc.id IS NOT NULL)`, [recordId, req.user.id]
    );
    if (!access.rowCount) return res.status(403).json({ message: 'You do not have approved access to this record' });

    const result = await pool.query(
      `INSERT INTO doctor_notes (record_id, doctor_id, patient_id, note)
       VALUES ($1, $2, $3, $4)
       RETURNING id, record_id AS "recordId", note, created_at AS "createdAt", updated_at AS "updatedAt"`,
      [recordId, req.user.id, access.rows[0].patientId, note]
    );
    return res.status(201).json({ note: result.rows[0] });
  } catch (error) {
    console.error('Create doctor note error:', error.message);
    return res.status(500).json({ message: 'Unable to save doctor note' });
  }
};

const getApprovedConversation = async (userId, otherUserId) => {
  const result = await pool.query(
    `SELECT 1 FROM doctor_connections
     WHERE ((patient_id = $1 AND doctor_id = $2) OR (patient_id = $2 AND doctor_id = $1))
       AND status = 'approved'`, [userId, otherUserId]
  );
  return result.rowCount > 0;
};

export const getConversation = async (req, res) => {
  try {
    const otherUserId = Number(req.params.userId);
    if (!Number.isInteger(otherUserId) || !(await getApprovedConversation(req.user.id, otherUserId))) {
      return res.status(403).json({ message: 'Messaging is available only for approved connections' });
    }
    const result = await pool.query(
      `SELECT m.id, m.sender_id AS "senderId", m.recipient_id AS "recipientId", m.message,
              m.created_at AS "createdAt", u.full_name AS "senderName"
       FROM messages m JOIN users u ON u.id = m.sender_id
       WHERE (m.sender_id = $1 AND m.recipient_id = $2) OR (m.sender_id = $2 AND m.recipient_id = $1)
       ORDER BY m.created_at ASC`, [req.user.id, otherUserId]
    );
    return res.json({ messages: result.rows });
  } catch (error) {
    console.error('Get conversation error:', error.message);
    return res.status(500).json({ message: 'Unable to load conversation' });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const recipientId = Number(req.body.recipientId);
    const message = req.body.message?.trim();
    if (!Number.isInteger(recipientId) || !message) return res.status(400).json({ message: 'recipientId and message are required' });
    if (!(await getApprovedConversation(req.user.id, recipientId))) return res.status(403).json({ message: 'Messaging is available only for approved connections' });

    const result = await pool.query(
      `INSERT INTO messages (sender_id, recipient_id, message) VALUES ($1, $2, $3)
       RETURNING id, sender_id AS "senderId", recipient_id AS "recipientId", message, created_at AS "createdAt"`,
      [req.user.id, recipientId, message]
    );
    return res.status(201).json({ message: result.rows[0] });
  } catch (error) {
    console.error('Send message error:', error.message);
    return res.status(500).json({ message: 'Unable to send message' });
  }
};

export const getDoctorConnectionRequests = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT dc.id, dc.status, dc.requested_at AS "requestedAt", dc.decided_at AS "decidedAt",
              u.id AS "patientId", u.full_name AS "patientName", u.email AS "patientEmail"
       FROM doctor_connections dc
       JOIN users u ON u.id = dc.patient_id
       WHERE dc.doctor_id = $1
       ORDER BY dc.requested_at DESC`, [req.user.id]
    );
    return res.json({ connections: result.rows });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to load patient connection requests' });
  }
};

export const decideDoctorConnection = async (req, res) => {
  try {
    const connectionId = Number(req.params.connectionId);
    const { decision } = req.body;
    const status = decision === 'approve' ? 'approved' : decision === 'decline' ? 'declined' : null;
    if (!Number.isInteger(connectionId) || !status) return res.status(400).json({ message: 'Decision must be approve or decline' });

    const result = await pool.query(
      `UPDATE doctor_connections
       SET status = $1, decided_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND doctor_id = $3 AND status = 'pending'
       RETURNING id, patient_id AS "patientId", doctor_id AS "doctorId", status, decided_at AS "decidedAt"`, [status, connectionId, req.user.id]
    );

    if (!result.rowCount) return res.status(404).json({ message: 'Pending connection request not found' });

    if (status === 'approved') {
      const patientRecords = await pool.query('SELECT id FROM health_records WHERE patient_id = $1', [result.rows[0].patientId]);
      if (patientRecords.rowCount) {
        const insertValues = patientRecords.rows.map((record) => `(${record.id}, ${result.rows[0].doctorId}, ${result.rows[0].patientId}, 'approved', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`);
        await pool.query(
          `INSERT INTO record_access_requests (record_id, doctor_id, patient_id, status, requested_at, decided_at)
           VALUES ${insertValues.join(', ')}
           ON CONFLICT (record_id, doctor_id)
           DO UPDATE SET status = 'approved', decided_at = CURRENT_TIMESTAMP`,
        );
      }
    }

    return res.json({ message: `Connection ${status}`, connection: result.rows[0] });
  } catch (error) {
    console.error('Doctor connection decision error:', error.message);
    return res.status(500).json({ message: 'Unable to update doctor connection request' });
  }
};

export const requestAccess = async (req, res) => {
  try {
    const recordId = Number(req.body.recordId);
    if (!Number.isInteger(recordId)) return res.status(400).json({ message: 'A valid recordId is required' });
    const record = await pool.query('SELECT id, patient_id FROM health_records WHERE id = $1', [recordId]);
    if (!record.rowCount) return res.status(404).json({ message: 'Record not found' });
    const result = await pool.query(
      `INSERT INTO record_access_requests (record_id, doctor_id, patient_id) VALUES ($1, $2, $3)
       ON CONFLICT (record_id, doctor_id) DO UPDATE SET status = 'pending', requested_at = CURRENT_TIMESTAMP, decided_at = NULL
       RETURNING id, record_id AS "recordId", status, requested_at AS "requestedAt"`,
      [recordId, req.user.id, record.rows[0].patient_id]
    );
    return res.status(201).json({ message: 'Access request sent to patient', request: result.rows[0] });
  } catch (error) {
    console.error('Request access error:', error.message);
    return res.status(500).json({ message: 'Unable to request access' });
  }
};

export const getPatientRequests = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ar.id, ar.status, ar.requested_at AS "requestedAt", ar.decided_at AS "decidedAt", ${recordFields}, u.id AS "doctorId", u.full_name AS "doctorName", u.email AS "doctorEmail", u.wallet_address AS "doctorWalletAddress"
       FROM record_access_requests ar JOIN health_records r ON r.id = ar.record_id JOIN users u ON u.id = ar.doctor_id
       WHERE ar.patient_id = $1 ORDER BY ar.requested_at DESC`, [req.user.id]
    );
    return res.json({ requests: result.rows });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to load access requests' });
  }
};

export const decideAccess = async (req, res) => {
  try {
    const requestId = Number(req.params.requestId);
    const { decision } = req.body;
    const status = decision === 'approve' ? 'approved' : decision === 'decline' ? 'declined' : null;
    if (!Number.isInteger(requestId) || !status) return res.status(400).json({ message: 'Decision must be approve or decline' });
    const result = await pool.query(
      `UPDATE record_access_requests SET status = $1, decided_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND patient_id = $3 AND status = 'pending'
       RETURNING id, status, decided_at AS "decidedAt"`, [status, requestId, req.user.id]
    );
    if (!result.rowCount) return res.status(404).json({ message: 'Pending request not found' });
    return res.json({ message: `Access ${status}`, request: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to update access request' });
  }
};

export const getDoctorRecords = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT ${recordFields}, u.id AS "patientId", u.full_name AS "patientName"
       FROM health_records r
       JOIN users u ON u.id = r.patient_id
       WHERE r.id IN (
         SELECT ar.record_id
         FROM record_access_requests ar
         WHERE ar.doctor_id = $1 AND ar.status = 'approved'
       )
       OR r.patient_id IN (
         SELECT dc.patient_id
         FROM doctor_connections dc
         WHERE dc.doctor_id = $1 AND dc.status = 'approved'
       )
       ORDER BY r.created_at DESC`, [req.user.id]
    );
    return res.json({ records: result.rows });
  } catch (error) {
    console.error('Get doctor records error:', error.message);
    return res.status(500).json({ message: 'Unable to load approved records' });
  }
};

export const revokeAccess = async (req, res) => {
  try {
    const requestId = Number(req.params.requestId);
    const result = await pool.query(
      `UPDATE record_access_requests SET status = 'revoked', decided_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND patient_id = $2 AND status = 'approved' RETURNING id, status`, [requestId, req.user.id]
    );
    if (!result.rowCount) return res.status(404).json({ message: 'Approved access request not found' });
    return res.json({ message: 'Access revoked', request: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to revoke access' });
  }
};
