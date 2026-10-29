import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  Bell,
  CalendarDays,
  ChevronRight,
  FileText,
  HeartPulse,
  LayoutDashboard,
  LockKeyhole,
  MessageSquareText,
  Plus,
  ShieldCheck,
  Stethoscope,
  Upload,
  UsersRound,
} from 'lucide-react';
import { api, downloadRecord } from '../lib/api';
import { connectWallet, grantRecordAccess, registerRecordOnChain, revokeRecordAccess } from '../lib/ehrContract';

const formatDateTime = (value) => new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const formatDoctorName = (name) => {
  const cleanedName = (name || '').replace(/^Dr\.?\s*/i, '').trim();
  return cleanedName ? `Dr. ${cleanedName}` : 'Doctor';
};

export default function PatientDashboard() {
  const [activePage, setActivePage] = useState('Dashboard');
  const [toast, setToast] = useState('');
  const [records, setRecords] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [accessRequests, setAccessRequests] = useState([]);
  const [doctorConnections, setDoctorConnections] = useState([]);
  const [doctorNotes, setDoctorNotes] = useState([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState(null);
  const [conversation, setConversation] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const fileInputRef = useRef(null);
  const storedUser = JSON.parse(localStorage.getItem('patientAuthUser') || '{}');
  const patientName = storedUser.fullName || '';
  const orderedRecords = [...records].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const loadRecords = async () => {
    try {
      const data = await api('/api/records/mine');
      setRecords(data.records || []);
    } catch (error) {
      showMessage(error.message);
    }
  };

  useEffect(() => { loadRecords(); }, []);

  const loadDoctors = async () => {
    try {
      const data = await api('/api/records/doctors');
      setDoctors(data.doctors || []);
    } catch (error) {
      showMessage(error.message);
    }
  };

  useEffect(() => { loadDoctors(); }, []);

  const loadAccessRequests = async () => {
    try {
      const data = await api('/api/records/requests');
      setAccessRequests(data.requests || []);
    } catch (error) { showMessage(error.message); }
  };
  useEffect(() => { loadAccessRequests(); }, []);

  const loadDoctorConnections = async () => {
    try {
      const data = await api('/api/records/doctor-connections');
      setDoctorConnections(data.connections || []);
    } catch (error) { showMessage(error.message); }
  };
  useEffect(() => { loadDoctorConnections(); }, []);

  const loadDoctorNotes = async () => {
    try {
      const data = await api('/api/records/doctor-notes');
      setDoctorNotes(data.notes || []);
    } catch (error) { showMessage(error.message); }
  };
  useEffect(() => { loadDoctorNotes(); }, []);

  const loadConversation = async (doctorId) => {
    if (!doctorId) return;
    try {
      const data = await api(`/api/records/messages/${doctorId}`);
      setConversation(data.messages || []);
    } catch (error) { showMessage(error.message); }
  };

  useEffect(() => {
    if (selectedDoctorId) loadConversation(selectedDoctorId);
    else setConversation([]);
  }, [selectedDoctorId]);

  const linkedDoctors = doctors.filter((doctor) => doctorConnections.some((connection) => Number(connection.doctorId) === Number(doctor.id) && connection.status === 'approved'));
  const availableDoctors = doctors.filter((doctor) => !linkedDoctors.some((linkedDoctor) => Number(linkedDoctor.id) === Number(doctor.id)));
  const doctorDocuments = doctorNotes.filter((note) => note.uploadedByDoctorId);

  const showMessage = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 3200);
  };

  const requestDoctorConnection = async (doctorId) => {
    try {
      await api('/api/records/doctor-connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doctorId }),
      });
      await loadDoctorConnections();
      showMessage('Connection request sent.');
    } catch (error) { showMessage(error.message); }
  };

  const sendMessage = async () => {
    if (!selectedDoctorId || !messageText.trim()) return;
    setIsSendingMessage(true);
    try {
      await api('/api/records/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientId: selectedDoctorId, message: messageText }),
      });
      setMessageText('');
      await loadConversation(selectedDoctorId);
    } catch (error) { showMessage(error.message); }
    finally { setIsSendingMessage(false); }
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('patientAuthUser');
  };

  const handleRecordUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const data = await api('/api/files/upload', { method: 'POST', body: formData });
      setRecords((current) => [data.record, ...current]);
      try {
        const blockchainRecord = await registerRecordOnChain(data.record.ipfsCid, data.record.recordHash);
        await api(`/api/records/${data.record.id}/blockchain`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ blockchainTxHash: blockchainRecord.transactionHash, blockchainRecordId: blockchainRecord.blockchainRecordId }) });
        setRecords((current) => current.map((record) => record.id === data.record.id ? { ...record, blockchainTxHash: blockchainRecord.transactionHash, blockchainRecordId: blockchainRecord.blockchainRecordId } : record));
        showMessage(`${file.name} was encrypted, saved to IPFS, and registered on-chain.`);
      } catch (chainError) {
        showMessage(`${file.name} was encrypted and saved to IPFS. Blockchain registration: ${chainError.message}`);
      }
    } catch (error) {
      showMessage(error.message);
    } finally {
      event.target.value = '';
      setIsUploading(false);
    }
  };

  const handleConnectWallet = async () => {
    try {
      const address = await connectWallet();
      setWalletAddress(address);
      showMessage(`Wallet connected: ${address.slice(0, 6)}…${address.slice(-4)}`);
    } catch (error) {
      showMessage(error.message);
    }
  };

  const decideAccessRequest = async (requestId, decision) => {
    try {
      const request = accessRequests.find((item) => item.id === requestId);
      if (decision === 'approve') {
        if (!request?.doctorWalletAddress) {
          throw new Error('The doctor wallet address is missing. Ask the doctor to connect a wallet before requesting access.');
        }
        await connectWallet();
        const record = records.find((item) => item.id === request.recordId);
        if (!record?.blockchainRecordId) throw new Error('This record is not registered on-chain yet. Register it before approving access.');
        const blockchainTxHash = await grantRecordAccess(record.blockchainRecordId, request.doctorWalletAddress);
        await api(`/api/records/${request.recordId}/blockchain`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ blockchainTxHash, blockchainRecordId: record.blockchainRecordId }) });
      }

      await api(`/api/records/requests/${requestId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision }) });
      await loadAccessRequests();
      showMessage(`Access request ${decision === 'approve' ? 'approved' : 'declined'}.`);
    } catch (error) { showMessage(error.message); }
  };

  const revokeAccessRequest = async (request) => {
    try {
      const record = records.find((item) => item.id === request.recordId);
      if (!record?.blockchainRecordId) throw new Error('This record has no stored blockchain ID. Register the record on-chain first.');
      if (!request.doctorWalletAddress) throw new Error('The doctor wallet address is missing.');
      await connectWallet();
      const blockchainTxHash = await revokeRecordAccess(record.blockchainRecordId, request.doctorWalletAddress);
      await api(`/api/records/requests/${request.id}/revoke`, { method: 'PATCH' });
      await loadAccessRequests();
      showMessage(`Access revoked. Blockchain transaction: ${blockchainTxHash.slice(0, 10)}…`);
    } catch (error) { showMessage(error.message); }
  };

  const navItems = [
    { label: 'Dashboard', icon: LayoutDashboard },
    { label: 'All records', icon: FileText },
    { label: 'Doctors', icon: Stethoscope },
  ];

  const renderRecordsScreen = () => (
    <motion.section
      key="all-records-screen"
      initial={{ opacity: 0, y: 18, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.98 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
      className="mt-7 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-blue-600">Patient records</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">All uploaded documents</h2>
        </div>
        <button type="button" onClick={() => setActivePage('Dashboard')} className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100">
          Back to dashboard
        </button>
      </div>

      <div className="mt-5 flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Total</p>
          <p className="text-xl font-bold text-slate-900">{orderedRecords.length}</p>
        </div>
        <button type="button" onClick={() => fileInputRef.current?.click()} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700">
          Upload new record
        </button>
      </div>

      {orderedRecords.length > 0 ? (
        <div className="mt-6 space-y-3">
          {orderedRecords.map((record) => (
            <motion.button
              type="button"
              key={record.id}
              whileHover={{ x: 2, scale: 1.002 }}
              onClick={() => downloadRecord(record.id, record.fileName).catch((error) => showMessage(error.message))}
              className="flex w-full items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-left transition hover:border-blue-200 hover:bg-blue-50"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                <FileText size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base font-semibold text-slate-900">{record.fileName}</span>
                <span className="mt-1 block text-sm text-slate-500">
                  {record.fileType || 'Medical document'} · Uploaded {formatDateTime(record.createdAt)} · {record.recordHash ? 'Encrypted' : 'Hash pending'}
                </span>
              </span>
              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-500">Open</span>
            </motion.button>
          ))}
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-12 text-center">
          <FileText size={28} className="mx-auto text-slate-400" />
          <p className="mt-3 text-lg font-semibold text-slate-700">No records uploaded yet</p>
          <p className="mt-1 text-sm text-slate-500">Your uploaded medical documents will appear here in chronological order.</p>
          <button type="button" onClick={() => fileInputRef.current?.click()} className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
            Upload your first record
          </button>
        </div>
      )}
    </motion.section>
  );

  const renderDoctorsScreen = () => (
    <motion.section
      key="all-doctors-screen"
      initial={{ opacity: 0, y: 18, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.98 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
      className="mt-7 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-blue-600">Care team</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Doctors</h2>
        </div>
        <button type="button" onClick={() => setActivePage('Dashboard')} className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100">
          Back to dashboard
        </button>
      </div>

      <div className="mt-5 flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Connected</p>
          <p className="text-xl font-bold text-slate-900">{linkedDoctors.length}</p>
        </div>
        <button type="button" onClick={() => document.getElementById('doctors-on-medivault')?.scrollIntoView({ behavior: 'smooth' })} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700">
          Add doctor
        </button>
      </div>

      {linkedDoctors.length > 0 ? (
        <div className="mt-6 space-y-3">
          {linkedDoctors.map((doctor) => (
            <div key={doctor.id} className="space-y-3">
              <button
                type="button"
                onClick={() => { setSelectedDoctorId(doctor.id); setMessageText(''); loadConversation(doctor.id); }}
                className={`flex w-full flex-col gap-3 rounded-2xl border p-4 text-left transition sm:flex-row sm:items-center sm:justify-between ${selectedDoctorId === doctor.id ? 'border-blue-300 bg-blue-50 shadow-sm' : 'border-slate-200 bg-slate-50 hover:border-blue-200 hover:bg-blue-50'}`}
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-sm font-bold text-blue-700">
                    {doctor.fullName?.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase() || 'DR'}
                  </span>
                  <span>
                    <span className="block text-base font-semibold text-slate-900">{formatDoctorName(doctor.fullName)}</span>
                    <span className="block text-sm text-slate-500">{doctor.email}</span>
                  </span>
                </span>
                <span className="inline-flex w-fit items-center gap-2 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700"><MessageSquareText size={13} /> View notes</span>
              </button>
              {doctorDocuments.filter((document) => Number(document.doctorId) === Number(doctor.id)).map((document) => (
                <button type="button" key={document.id} onClick={() => downloadRecord(document.recordId, document.fileName).catch((error) => showMessage(error.message))} className="ml-4 flex w-[calc(100%-1rem)] items-start gap-3 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-left transition hover:border-emerald-300">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-emerald-700"><FileText size={16} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-900">{document.fileName}</span>
                    <span className="mt-1 block text-xs text-slate-500">Uploaded {formatDateTime(document.createdAt)}</span>
                    <span className="mt-1 block text-sm leading-5 text-slate-700">{document.note}</span>
                  </span>
                  <span className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-emerald-700">Open</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-12 text-center">
          <Stethoscope size={28} className="mx-auto text-slate-400" />
          <p className="mt-3 text-lg font-semibold text-slate-700">No connected doctors yet</p>
          <p className="mt-1 text-sm text-slate-500">Connected doctors and their notes will appear here.</p>
        </div>
      )}

      {selectedDoctorId && (
        <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-5">
          <div className="flex items-center gap-3">
            <MessageSquareText size={20} className="text-blue-600" />
            <div>
              <h3 className="font-bold text-slate-900">Notes from {formatDoctorName(linkedDoctors.find((doctor) => Number(doctor.id) === Number(selectedDoctorId))?.fullName)}</h3>
              <p className="text-sm text-slate-500">Notes shared with you by this connected doctor</p>
            </div>
          </div>
          {doctorNotes.filter((note) => Number(note.doctorId) === Number(selectedDoctorId)).length > 0 ? (
            <div className="mt-4 space-y-3">
              {doctorNotes.filter((note) => Number(note.doctorId) === Number(selectedDoctorId)).map((note) => (
                <div key={note.id} className="rounded-xl border border-blue-100 bg-white p-4">
                  <p className="text-sm leading-6 text-slate-700">{note.note}</p>
                  <p className="mt-2 text-xs text-slate-400">{note.fileName} · Uploaded {formatDateTime(note.createdAt)}</p>
                </div>
              ))}
            </div>
          ) : <p className="mt-4 rounded-xl border border-dashed border-blue-200 bg-white px-4 py-5 text-sm text-slate-500">This doctor has not added any notes yet.</p>}
        </div>
      )}

      {selectedDoctorId && (
        <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <MessageSquareText size={20} className="text-blue-600" />
            <div>
              <h3 className="font-bold text-slate-900">Message your doctor</h3>
              <p className="text-sm text-slate-500">Send a question and continue the conversation here.</p>
            </div>
          </div>
          <div className="mt-4 max-h-72 space-y-3 overflow-y-auto rounded-xl bg-slate-50 p-3">
            {conversation.length > 0 ? conversation.map((item) => {
              const isMine = Number(item.senderId) === Number(storedUser.id);
              return (
                <div key={item.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${isMine ? 'bg-blue-600 text-white' : 'border border-slate-200 bg-white text-slate-700'}`}>
                    <p className="text-xs font-semibold opacity-75">{isMine ? 'You' : item.senderName}</p>
                    <p className="mt-1 text-sm leading-5">{item.message}</p>
                    <p className="mt-2 text-[10px] opacity-60">{formatDateTime(item.createdAt)}</p>
                  </div>
                </div>
              );
            }) : <p className="py-8 text-center text-sm text-slate-500">No messages yet. Start the conversation.</p>}
          </div>
          <div className="mt-3 flex gap-2">
            <input value={messageText} onChange={(event) => setMessageText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') sendMessage(); }} placeholder="Type your question..." className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500" />
            <button type="button" onClick={sendMessage} disabled={isSendingMessage || !messageText.trim()} className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">{isSendingMessage ? 'Sending...' : 'Send'}</button>
          </div>
        </div>
      )}

      <div id="doctors-on-medivault" className="mt-8 border-t border-slate-200 pt-6">
        <div>
          <h3 className="font-bold text-slate-900">Doctors on MediVault</h3>
          <p className="mt-1 text-sm text-slate-500">Find doctors and request a connection.</p>
        </div>
        {availableDoctors.length > 0 ? (
          <div className="mt-4 space-y-3">
            {availableDoctors.map((doctor) => {
              const connection = doctorConnections.find((item) => Number(item.doctorId) === Number(doctor.id));
              const isPending = connection?.status === 'pending';
              return (
                <div key={doctor.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{formatDoctorName(doctor.fullName)}</p>
                    <p className="text-xs text-slate-500">{doctor.email}</p>
                  </div>
                  <button type="button" disabled={isPending} onClick={() => requestDoctorConnection(doctor.id)} className={`rounded-xl px-3 py-2 text-xs font-bold ${isPending ? 'cursor-not-allowed bg-amber-100 text-amber-700' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
                    {isPending ? 'Request sent' : 'Connect'}
                  </button>
                </div>
              );
            })}
          </div>
        ) : <p className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">You are connected with all available doctors.</p>}
      </div>
    </motion.section>
  );

  const renderDashboard = () => (
    <>
      <motion.section className="rounded-3xl bg-gradient-to-br from-blue-700 via-blue-600 to-cyan-500 px-6 py-7 text-white shadow-xl shadow-blue-100 sm:px-8 sm:py-9" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.55, delay: 0.12 }}>
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-blue-50 ring-1 ring-white/20"><LockKeyhole size={13} /> PRIVATE & SECURE</div>
            <h2 className="max-w-xl text-2xl font-bold tracking-tight sm:text-3xl">Your health, all in one protected place.</h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-blue-50">View your medical history, manage record sharing, and stay connected with your care team.</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2"><motion.button type="button" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.98 }} onClick={handleConnectWallet} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/40 bg-white/15 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/25"><LockKeyhole size={17} /> {walletAddress ? 'Wallet connected' : 'Connect wallet'}</motion.button><motion.button type="button" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.98 }} onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-blue-700 shadow-sm transition hover:bg-blue-50 disabled:opacity-70"><Upload size={17} /> {isUploading ? 'Encrypting & uploading…' : 'Upload record'}</motion.button></div>
          <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={handleRecordUpload} />
        </div>
      </motion.section>

      <section className="mt-7 grid gap-4 md:grid-cols-3">
        {[
          { title: 'My records', text: 'View and upload your medical documents', count: String(records.length), icon: FileText, color: 'bg-blue-50 text-blue-600', action: () => setActivePage('All records') },
          { title: 'Appointments', text: 'No upcoming appointments', count: '0', icon: CalendarDays, color: 'bg-emerald-50 text-emerald-600', action: () => showMessage('Appointments will be available soon.') },
          { title: 'Access requests', text: 'Review doctor requests for your records', count: String(accessRequests.filter((request) => request.status === 'pending').length), icon: UsersRound, color: 'bg-violet-50 text-violet-600', action: () => setActivePage('Access requests') },
        ].map(({ title, text, count, icon: Icon, color, action }, index) => (
          <motion.button type="button" key={title} onClick={action} initial={{ opacity: 0, x: -10, y: 14 }} animate={{ opacity: 1, x: 0, y: 0 }} transition={{ duration: 0.38, delay: 0.16 + index * 0.08 }} whileHover={{ y: -5, scale: 1.01 }} whileTap={{ scale: 0.98 }} className="group rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-blue-200 hover:shadow-lg hover:shadow-slate-200/60">
            <div className="flex items-start justify-between"><span className={`flex h-11 w-11 items-center justify-center rounded-xl ${color}`}><Icon size={21} /></span><span className="text-2xl font-bold text-slate-900">{count}</span></div>
            <h3 className="mt-5 font-bold">{title}</h3><p className="mt-1 text-sm text-slate-500">{text}</p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-blue-600">Open <ArrowUpRight size={15} className="transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" /></span>
          </motion.button>
        ))}
      </section>

      <section className="mt-7 grid gap-6 xl:grid-cols-5">
        <motion.div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-3" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.25 }}>
          <div className="flex items-center justify-between"><div><h2 className="font-bold">Recent records</h2><p className="mt-1 text-sm text-slate-500">Your latest uploaded medical documents</p></div><button type="button" onClick={() => setActivePage('All records')} className="text-sm font-bold text-blue-600 hover:text-blue-800">View all</button></div>
          {orderedRecords.length > 0 ? <div className="mt-5 divide-y divide-slate-100">
          {orderedRecords.slice(0, 5).map((record) => (<button type="button" key={record.id} onClick={() => downloadRecord(record.id, record.fileName).catch((error) => showMessage(error.message))} className="flex w-full items-center gap-3 py-4 text-left first:pt-0 last:pb-0"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><FileText size={18} /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{record.fileName}</span><span className="mt-0.5 block text-xs text-slate-500">{record.fileType || 'Medical document'} · Uploaded {formatDateTime(record.createdAt)}</span></span><ChevronRight size={18} className="text-slate-400" /></button>))}
          </div> : <div className="mt-5 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-5 py-7 text-center"><FileText size={22} className="mx-auto text-slate-400" /><p className="mt-2 text-sm font-semibold text-slate-700">No records uploaded yet</p><button type="button" onClick={() => fileInputRef.current?.click()} className="mt-2 text-sm font-bold text-blue-600 hover:text-blue-800">Upload your first record</button></div>}
        </motion.div>

        <motion.div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.34 }}>
          <div className="flex items-center justify-between"><div><h2 className="font-bold">Doctors</h2><p className="mt-1 text-sm text-slate-500">Doctors connected to your care team</p></div><button type="button" onClick={() => setActivePage('Doctors')} aria-label="Add doctor" className="rounded-lg bg-slate-100 p-2 text-slate-600 hover:bg-slate-200"><Plus size={18} /></button></div>

          {linkedDoctors.length > 0 ? (
            <div className="mt-5 space-y-3">
              {linkedDoctors.slice(0, 3).map((doctor) => {
                return (
                  <div key={doctor.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">{formatDoctorName(doctor.fullName)}</p>
                      <p className="truncate text-xs text-slate-500">{doctor.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold text-emerald-700">Connected</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-5 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-5 py-7 text-center"><Stethoscope size={22} className="mx-auto text-slate-400" /><p className="mt-2 text-sm font-semibold text-slate-700">No connected doctors yet</p><p className="mt-1 text-xs leading-5 text-slate-500">Your connected doctors will appear here.</p></div>
          )}
        </motion.div>
      </section>

      {accessRequests.some((request) => request.status === 'pending' || request.status === 'approved') && <section className="mt-7 rounded-2xl border border-violet-100 bg-white p-5 shadow-sm"><h2 className="font-bold">Record access</h2><div className="mt-4 space-y-3">{accessRequests.filter((request) => request.status === 'pending' || request.status === 'approved').map((request) => <div key={request.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-violet-50 p-4"><div><p className="text-sm font-semibold">{formatDoctorName(request.doctorName)}</p><p className="text-xs text-slate-600">{request.status === 'pending' ? `requests access to ${request.fileName}` : `has access to ${request.fileName}`}</p></div><div className="flex gap-2">{request.status === 'pending' ? <><button type="button" onClick={() => decideAccessRequest(request.id, 'decline')} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700">Decline</button><button type="button" onClick={() => decideAccessRequest(request.id, 'approve')} className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold text-white">Approve</button></> : <button type="button" onClick={() => revokeAccessRequest(request)} className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-bold text-rose-600">Revoke access</button>}</div></div>)}</div></section>}
    </>
  );

  return (
    <motion.div className="min-h-screen bg-[#f7faff] text-slate-900" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.45 }}>
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <aside className="hidden w-72 shrink-0 flex-col border-r border-slate-200 bg-white px-5 py-7 lg:flex">
          <Link to="/" className="flex items-center gap-3 px-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-200">
              <HeartPulse size={21} strokeWidth={2.5} />
            </span>
            <span>
              <span className="block text-lg font-bold tracking-tight">MediVault</span>
              <span className="block text-xs font-medium text-slate-400">Secure health records</span>
            </span>
          </Link>

          <nav className="mt-12 space-y-2">
            <p className="px-3 pb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Workspace</p>
            {navItems.map(({ label, icon: Icon }) => (
              <button
                type="button"
                key={label}
                onClick={() => setActivePage(label)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold transition ${
                  activePage === label ? 'bg-blue-600 text-white shadow-md shadow-blue-100' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon size={19} />
                {label}
              </button>
            ))}
          </nav>

          <div className="mt-auto rounded-2xl bg-slate-900 p-4 text-white">
            <ShieldCheck size={20} className="text-blue-300" />
            <p className="mt-3 text-sm font-semibold">Your records are protected</p>
            <p className="mt-1 text-xs leading-5 text-slate-300">You control who can view your health information.</p>
          </div>
        </aside>

        <div className="min-w-0 flex-1 px-4 py-5 sm:px-7 lg:px-10 lg:py-7">
          <motion.header className="flex items-center justify-between gap-4" initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.05 }}>
            <div className="flex items-center gap-3 lg:hidden">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white"><HeartPulse size={20} /></span>
              <span className="font-bold">MediVault</span>
            </div>
            <div className="hidden lg:block">
              <p className="text-sm font-medium text-slate-500">Patient portal</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight">Hello{patientName ? `, ${patientName}` : ''}</h1>
            </div>
            <div className="ml-auto flex items-center gap-3">
              <button type="button" aria-label="Notifications" className="relative rounded-xl border border-slate-200 bg-white p-2.5 text-slate-500 transition hover:bg-slate-50">
                <Bell size={19} />
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-blue-600 ring-2 ring-white" />
              </button>
              <Link to="/" onClick={handleLogout} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600">
                Logout
              </Link>
            </div>
          </motion.header>

          <main className="mt-8">
            {activePage === 'All records' ? renderRecordsScreen() : activePage === 'Doctors' ? renderDoctorsScreen() : renderDashboard()}
          </main>
          {toast && <div role="status" className="fixed bottom-5 right-5 rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-xl">{toast}</div>}
        </div>
      </div>
    </motion.div>
  );
}
