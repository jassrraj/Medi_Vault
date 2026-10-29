import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Bell,
  Check,
  ClipboardList,
  FileText,
  HeartPulse,
  LayoutDashboard,
  LockKeyhole,
  MessageSquareText,
  ShieldCheck,
  Stethoscope,
  Upload,
  UsersRound,
  X,
} from 'lucide-react';
import { api, downloadRecord } from '../lib/api';

const formatDateTime = (value) => new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export default function DoctorDashboard() {
  const [activePage, setActivePage] = useState('Dashboard');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [approvedRecords, setApprovedRecords] = useState([]);
  const [connectionRequests, setConnectionRequests] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState(null);
  const [selectedRecordId, setSelectedRecordId] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [isUploadingDocument, setIsUploadingDocument] = useState(false);
  const [conversation, setConversation] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const storedUser = JSON.parse(localStorage.getItem('doctorAuthUser') || '{}');
  const doctorPhotoStorageKey = `doctorPhoto:${storedUser.id || storedUser.email || 'current'}`;
  const [doctorPhoto, setDoctorPhoto] = useState(() => localStorage.getItem(doctorPhotoStorageKey) || '');
  const photoInputRef = useRef(null);
  const documentInputRef = useRef(null);
  const doctorName = storedUser.fullName || '';

  useEffect(() => {
    localStorage.removeItem('doctorPhoto');
  }, []);

  const requestRecordAccess = async () => {
    const recordId = window.prompt('Enter the record ID supplied by the patient:');
    if (!recordId) return;
    try {
      await api('/api/records/access-requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recordId: Number(recordId) }) });
      showMessage('Access request sent to the patient.');
    } catch (error) { showMessage(error.message); }
  };

  const loadApprovedRecords = async () => {
    try {
      const data = await api('/api/records/shared-with-me');
      const records = data.records || [];
      setApprovedRecords(records);
      setSelectedPatientId((current) => current && records.some((record) => record.patientId === current) ? current : null);
      setSelectedRecordId(null);
    } catch (error) {
      showMessage(error.message);
    }
  };

  const loadConnectionRequests = async () => {
    try {
      const data = await api('/api/records/connection-requests');
      setConnectionRequests(data.connections || []);
    } catch (error) { showMessage(error.message); }
  };

  const refreshDoctorData = async () => {
    await Promise.all([loadConnectionRequests(), loadApprovedRecords()]);
  };

  const loadConversation = async (patientId) => {
    if (!patientId) return;
    try {
      const data = await api(`/api/records/messages/${patientId}`);
      setConversation(data.messages || []);
    } catch (error) { showMessage(error.message); }
  };

  useEffect(() => {
    refreshDoctorData();
  }, []);

  const decideConnectionRequest = async (connectionId, decision) => {
    try {
      await api(`/api/records/connection-requests/${connectionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      });
      await refreshDoctorData();
      showMessage(`Connection request ${decision === 'approve' ? 'accepted' : 'declined'}.`);
    } catch (error) { showMessage(error.message); }
  };

  const sendMessage = async () => {
    if (!selectedPatientId || !messageText.trim()) return;
    setIsSendingMessage(true);
    try {
      await api('/api/records/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientId: selectedPatientId, message: messageText }),
      });
      setMessageText('');
      await loadConversation(selectedPatientId);
    } catch (error) { showMessage(error.message); }
    finally { setIsSendingMessage(false); }
  };

  const saveDoctorNote = async (recordId) => {
    if (!noteText.trim()) {
      showMessage('Write a note before saving.');
      return;
    }
    try {
      await api('/api/records/doctor-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordId, note: noteText }),
      });
      setNoteText('');
      showMessage('Consultation note saved.');
    } catch (error) { showMessage(error.message); }
  };

  const handleDoctorDocumentUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !selectedPatientId) return;
    if (!noteText.trim()) {
      showMessage('Add a note before uploading the document.');
      event.target.value = '';
      return;
    }
    setIsUploadingDocument(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('patientId', String(selectedPatientId));
      formData.append('note', noteText);
      await api('/api/files/upload-for-patient', { method: 'POST', body: formData });
      setNoteText('');
      await refreshDoctorData();
      showMessage(`${file.name} uploaded for the patient.`);
    } catch (error) { showMessage(error.message); }
    finally {
      event.target.value = '';
      setIsUploadingDocument(false);
    }
  };

  const showMessage = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 3200);
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('doctorAuthUser');
  };

  const handleDoctorPhotoUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      setDoctorPhoto(result);
      localStorage.setItem(doctorPhotoStorageKey, result);
      showMessage(`${file.name} ${doctorPhoto ? 'updated' : 'uploaded'} on your doctor profile.`);
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const navItems = [
    { label: 'Dashboard', icon: LayoutDashboard },
    { label: 'Patients', icon: UsersRound },
    { label: 'Patients request', icon: ClipboardList },
  ];

  const renderPatientsScreen = () => {
    const patients = approvedRecords.reduce((patientList, record) => {
      if (!patientList.some((patient) => patient.id === record.patientId)) {
        patientList.push({ id: record.patientId, name: record.patientName, recordCount: 1 });
      } else {
        patientList.find((patient) => patient.id === record.patientId).recordCount += 1;
      }
      return patientList;
    }, []);
    const selectedPatient = patients.find((patient) => patient.id === selectedPatientId);
    const patientRecords = approvedRecords.filter((record) => record.patientId === selectedPatientId);
    const selectedRecord = patientRecords.find((record) => record.id === selectedRecordId) || patientRecords[0];

    return (
      <motion.section
        key="patients-screen"
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.28, ease: 'easeOut' }}
        className="mt-7 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-emerald-600">Patients</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{selectedPatient ? `${selectedPatient.name}'s records` : 'All patients'}</h2>
          </div>
          <button type="button" onClick={() => selectedPatient ? (setSelectedPatientId(null), setSelectedRecordId(null)) : setActivePage('Dashboard')} className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100">
            {selectedPatient ? 'Back to patients' : 'Back to dashboard'}
          </button>
        </div>

        {approvedRecords.length ? (
          selectedPatient ? (
            <div className="mt-6 grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-3">
                <p className="text-sm text-slate-500">{patientRecords.length} approved record{patientRecords.length === 1 ? '' : 's'} for this patient</p>
                {patientRecords.map((record) => (
                <motion.button
                  type="button"
                  key={record.id}
                  whileHover={{ x: 3 }}
                  onClick={() => { setSelectedRecordId(record.id); setNoteText(''); }}
                  className={`flex w-full items-center gap-4 rounded-2xl border px-4 py-4 text-left transition ${selectedRecord && selectedRecord.id === record.id ? 'border-emerald-300 bg-emerald-50 shadow-sm shadow-emerald-100/60' : 'border-slate-200 bg-slate-50 hover:border-emerald-200 hover:bg-emerald-50'}`}
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700"><FileText size={20} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-semibold text-slate-900">{record.fileName}</span>
                    <span className="mt-1 block text-sm text-slate-500">{record.patientName} · Uploaded {formatDateTime(record.createdAt)}</span>
                  </span>
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-500">Open</span>
                </motion.button>
              ))}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700"><MessageSquareText size={18} /></span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Care notes</p>
                  <h3 className="text-lg font-bold text-slate-900">{selectedRecord ? selectedRecord.patientName : 'Select a patient'}</h3>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                <button type="button" onClick={() => selectedRecord && downloadRecord(selectedRecord.id, selectedRecord.fileName).catch((error) => showMessage(error.message))} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700">
                  <FileText size={16} /> Open record
                </button>
                <button type="button" onClick={() => documentInputRef.current?.click()} disabled={isUploadingDocument} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-60">
                  <Upload size={16} /> {isUploadingDocument ? 'Uploading document...' : 'Upload document for patient'}
                </button>
                <input ref={documentInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.txt" onChange={handleDoctorDocumentUpload} className="hidden" />
                <label className="mt-2 block text-sm font-semibold text-slate-700">Consultation note</label>
                <textarea
                  rows={7}
                  value={noteText}
                  onChange={(event) => setNoteText(event.target.value)}
                  placeholder="Add observations, diagnosis, medication updates, and follow-up recommendations..."
                  className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-emerald-500"
                />
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => selectedRecord && saveDoctorNote(selectedRecord.id)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100">Save note</button>
                </div>
              </div>

              <div className="mt-6 border-t border-slate-200 pt-5">
                <div className="flex items-center gap-2">
                  <MessageSquareText size={17} className="text-emerald-600" />
                  <h3 className="font-bold text-slate-900">Message patient</h3>
                </div>
                <div className="mt-3 max-h-56 space-y-3 overflow-y-auto rounded-xl bg-white p-3">
                  {conversation.length > 0 ? conversation.map((item) => {
                    const isMine = Number(item.senderId) === Number(storedUser.id);
                    return (
                      <div key={item.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[88%] rounded-2xl px-3 py-2 ${isMine ? 'bg-emerald-600 text-white' : 'border border-slate-200 bg-slate-50 text-slate-700'}`}>
                          <p className="text-xs font-semibold opacity-75">{isMine ? 'You' : item.senderName}</p>
                          <p className="mt-1 text-sm leading-5">{item.message}</p>
                          <p className="mt-1 text-[10px] opacity-60">{formatDateTime(item.createdAt)}</p>
                        </div>
                      </div>
                    );
                  }) : <p className="py-6 text-center text-sm text-slate-500">No messages yet.</p>}
                </div>
                <div className="mt-3 flex gap-2">
                  <input value={messageText} onChange={(event) => setMessageText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') sendMessage(); }} placeholder="Type a reply..." className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500" />
                  <button type="button" onClick={sendMessage} disabled={isSendingMessage || !messageText.trim()} className="rounded-xl bg-emerald-600 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">{isSendingMessage ? '...' : 'Send'}</button>
                </div>
              </div>
              </div>
            </div>
          ) : (
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {patients.map((patient) => (
                <motion.button
                  type="button"
                  key={patient.id}
                  whileHover={{ y: -2 }}
                  onClick={() => { setSelectedPatientId(patient.id); setSelectedRecordId(null); setMessageText(''); loadConversation(patient.id); }}
                  className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-left transition hover:border-emerald-300 hover:bg-emerald-50"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700"><UsersRound size={21} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-semibold text-slate-900">{patient.name}</span>
                    <span className="mt-1 block text-sm text-slate-500">{patient.recordCount} approved record{patient.recordCount === 1 ? '' : 's'}</span>
                  </span>
                  <span className="text-sm font-semibold text-emerald-600">View</span>
                </motion.button>
              ))}
            </div>
          )
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-12 text-center">
            <UsersRound size={28} className="mx-auto text-slate-400" />
            <p className="mt-3 text-lg font-semibold text-slate-700">No approved patient records yet</p>
            <p className="mt-1 text-sm text-slate-500">Records appear here after patients approve your access request.</p>
          </div>
        )}
      </motion.section>
    );
  };

  const renderAccessRequestsScreen = () => (
    <motion.section
      key="access-requests-screen"
      initial={{ opacity: 0, y: 18, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
      className="mt-7 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-emerald-600">Patients request</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Patient connection requests</h2>
        </div>
        <button type="button" onClick={() => setActivePage('Dashboard')} className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100">
          Back to dashboard
        </button>
      </div>

      <div className="mt-6 space-y-3">
        {connectionRequests.length ? (
          connectionRequests.map((connection) => (
            <div key={connection.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-800">Patient: {connection.patientName}</p>
                  <p className="text-sm text-slate-500">{connection.patientEmail}</p>
                  <p className="mt-1 text-xs text-slate-500">Requested {new Date(connection.requestedAt).toLocaleDateString()}</p>
                </div>
                {connection.status === 'pending' ? (
                  <div className="flex gap-2">
                    <button type="button" onClick={() => decideConnectionRequest(connection.id, 'decline')} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700">Decline</button>
                    <button type="button" onClick={() => decideConnectionRequest(connection.id, 'approve')} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white">Accept</button>
                  </div>
                ) : (
                  <span className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${connection.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                    {connection.status === 'approved' ? 'Accepted' : 'Declined'}
                  </span>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-12 text-center">
            <ClipboardList size={28} className="mx-auto text-slate-400" />
            <p className="mt-3 text-lg font-semibold text-slate-700">No connection requests yet</p>
            <p className="mt-1 text-sm text-slate-500">Requests from patients to connect will appear here.</p>
          </div>
        )}
      </div>
    </motion.section>
  );

  const renderDashboard = () => (
    <>
      <motion.section className="rounded-3xl bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-500 px-6 py-7 text-white shadow-xl shadow-emerald-100 sm:px-8 sm:py-9" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.55, delay: 0.12 }}>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-emerald-50 ring-1 ring-white/20"><LockKeyhole size={13} /> APPROVED ACCESS ONLY</div>
            <h2 className="max-w-xl text-2xl font-bold tracking-tight sm:text-3xl">Deliver informed care with every record in one place.</h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-emerald-50">Review approved patient records, manage access requests, and document follow-up care securely.</p>
          </div>

          <button type="button" onClick={() => photoInputRef.current?.click()} aria-label={doctorPhoto ? 'Update doctor profile photo' : 'Upload doctor profile photo'} className="group relative flex h-36 w-36 items-center justify-center overflow-hidden rounded-2xl border border-white/40 bg-white/10 shadow-lg shadow-emerald-950/10 backdrop-blur-sm transition hover:bg-white/15 sm:h-40 sm:w-40">
            {doctorPhoto ? (
              <img src={doctorPhoto} alt="Doctor profile" className="h-full w-full object-cover" />
            ) : (
              <span className="h-24 w-24 rounded-2xl border border-dashed border-white/50 sm:h-28 sm:w-28" />
            )}
            <span className="absolute inset-x-0 bottom-0 bg-slate-900/45 px-2 py-1 text-[10px] font-semibold tracking-[0.12em] text-white/90">{doctorPhoto ? 'UPDATE PHOTO' : 'UPLOAD PHOTO'}</span>
          </button>
          <input type="file" accept="image/*" ref={photoInputRef} onChange={handleDoctorPhotoUpload} className="hidden" />
        </div>
      </motion.section>

      <section className="mt-7 grid gap-4 md:grid-cols-2">
        {[
          { title: 'Patients', text: approvedRecords.length ? `${approvedRecords.length} approved record${approvedRecords.length === 1 ? '' : 's'}` : 'No patient records approved yet', icon: UsersRound, action: () => setActivePage('Patients') },
          { title: 'Patients request', text: 'Review pending and approved patient requests', icon: ClipboardList, action: () => setActivePage('Patients request') },
        ].map(({ title, text, icon: Icon, action }, index) => (
          <motion.button type="button" key={title} onClick={action} initial={{ opacity: 0, x: -10, y: 14 }} animate={{ opacity: 1, x: 0, y: 0 }} transition={{ duration: 0.38, delay: 0.16 + index * 0.08 }} whileHover={{ y: -5, scale: 1.01 }} whileTap={{ scale: 0.98 }} className="group rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-emerald-200 hover:shadow-lg hover:shadow-slate-200/60">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><Icon size={21} /></span>
            <h3 className="mt-5 font-bold">{title}</h3>
            <p className="mt-1 text-sm text-slate-500">{text}</p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-emerald-600">Open <Check size={15} /></span>
          </motion.button>
        ))}
      </section>

      <section className="mt-7 grid gap-6 xl:grid-cols-5">
        <motion.div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-3" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.25 }}>
          <div className="flex items-center justify-between">
            <div><h2 className="font-bold">Patient records</h2><p className="mt-1 text-sm text-slate-500">Only records approved by their patient are available here.</p></div>
            <button type="button" onClick={() => setActivePage('Patients')} className="text-sm font-bold text-emerald-600 hover:text-emerald-800">View all</button>
          </div>
          {approvedRecords.length ? <div className="mt-5 divide-y divide-slate-100">{approvedRecords.slice(0, 4).map((record) => <button type="button" key={record.id} onClick={() => downloadRecord(record.id, record.fileName).catch((error) => showMessage(error.message))} className="flex w-full items-center gap-3 py-4 text-left"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><FileText size={18} /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{record.fileName}</span><span className="mt-0.5 block text-xs text-slate-500">{record.patientName} · Uploaded {formatDateTime(record.createdAt)}</span></span></button>)}</div> : <div className="mt-5 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-5 py-9 text-center"><UsersRound size={25} className="mx-auto text-slate-400" /><p className="mt-3 text-sm font-semibold text-slate-700">No approved patient records yet</p><p className="mt-1 text-xs leading-5 text-slate-500">A record appears here after its patient approves your access request.</p></div>}
        </motion.div>

        <motion.div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.34 }}>
          <div><h2 className="font-bold">Clinical overview</h2><p className="mt-1 text-sm text-slate-500">Open a patient record to document treatment and review findings.</p></div>
          <div className="mt-5 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-5 py-9 text-center"><MessageSquareText size={25} className="mx-auto text-slate-400" /><p className="mt-3 text-sm font-semibold text-slate-700">Patient notes live inside each record</p><p className="mt-2 text-xs leading-5 text-slate-500">The note editor is now attached to the selected patient workflow for a cleaner clinical flow.</p></div>
        </motion.div>
      </section>
    </>
  );

  return (
    <motion.div className="min-h-screen bg-[#f7faff] text-slate-900" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.45 }}>
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <aside className="hidden w-72 shrink-0 flex-col border-r border-slate-200 bg-white px-5 py-7 lg:flex">
          <Link to="/" className="flex items-center gap-3 px-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-lg shadow-emerald-200"><HeartPulse size={21} strokeWidth={2.5} /></span>
            <span><span className="block text-lg font-bold tracking-tight">MediVault</span><span className="block text-xs font-medium text-slate-400">Doctor workspace</span></span>
          </Link>
          <nav className="mt-12 space-y-2">
            <p className="px-3 pb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Workspace</p>
            {navItems.map(({ label, icon: Icon }) => (
              <button type="button" key={label} onClick={() => setActivePage(label)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold transition ${activePage === label ? 'bg-emerald-600 text-white shadow-md shadow-emerald-100' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}><Icon size={19} />{label}</button>
            ))}
          </nav>
          <div className="mt-auto rounded-2xl bg-slate-900 p-4 text-white"><ShieldCheck size={20} className="text-emerald-300" /><p className="mt-3 text-sm font-semibold">Protected patient data</p><p className="mt-1 text-xs leading-5 text-slate-300">Only approved records are available in your workspace.</p></div>
        </aside>

        <div className="min-w-0 flex-1 px-4 py-5 sm:px-7 lg:px-10 lg:py-7">
          <motion.header className="flex items-center justify-between gap-4" initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.05 }}>
            <div className="flex items-center gap-3 lg:hidden"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white"><HeartPulse size={20} /></span><span className="font-bold">MediVault</span></div>
            <div className="hidden lg:block"><p className="text-sm font-medium text-slate-500">Doctor portal</p><h1 className="mt-1 text-2xl font-bold tracking-tight">Welcome Dr.{doctorName ? ` ${doctorName}` : ''}</h1></div>
            <div className="ml-auto flex items-center gap-3">
              <div className="relative">
                <button type="button" aria-label="Notifications" onClick={() => setNotificationsOpen((open) => !open)} className="relative rounded-xl border border-slate-200 bg-white p-2.5 text-slate-500 transition hover:bg-slate-50"><Bell size={19} /><span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white" /></button>
                {notificationsOpen && <div className="absolute right-0 top-13 z-20 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-300/40">
                  <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4"><div><p className="font-bold">Notifications</p><p className="text-xs text-slate-500">Patient connection requests</p></div><button type="button" aria-label="Close notifications" onClick={() => setNotificationsOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X size={18} /></button></div>
                  {connectionRequests.some((request) => request.status === 'pending') ? (
                    <div className="max-h-[320px] overflow-y-auto p-3">
                      {connectionRequests.filter((request) => request.status === 'pending').map((request) => (
                        <div key={request.id} className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <p className="text-sm font-semibold text-slate-800">{request.patientName}</p>
                          <p className="mt-1 text-xs text-slate-500">wants to connect with you</p>
                          <div className="mt-3 flex gap-2">
                            <button type="button" onClick={() => decideConnectionRequest(request.id, 'approve')} className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-bold text-white">Accept</button>
                            <button type="button" onClick={() => decideConnectionRequest(request.id, 'decline')} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-700">Decline</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="px-5 py-9 text-center"><Bell size={23} className="mx-auto text-slate-400" /><p className="mt-3 text-sm font-semibold text-slate-700">No pending requests</p><p className="mt-1 text-xs leading-5 text-slate-500">Patient connection requests will appear here. You can accept or decline them from this panel.</p></div>
                  )}
                </div>}
              </div>
              <Link to="/" onClick={handleLogout} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600">Logout</Link>
            </div>
          </motion.header>

          <main className="mt-8">
            {activePage === 'Patients' ? renderPatientsScreen() : activePage === 'Patients request' ? renderAccessRequestsScreen() : renderDashboard()}
          </main>
          {toast && <div role="status" className="fixed bottom-5 right-5 rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-xl">{toast}</div>}
        </div>
      </div>
    </motion.div>
  );
}
