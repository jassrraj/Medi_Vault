import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const normalizeDoctorName = (value = '') => {
  const trimmed = String(value).trim();
  if (!trimmed) return '';
  const withoutPrefix = trimmed.replace(/^Dr\.?\s+/i, '').trim();
  return withoutPrefix ? `Dr. ${withoutPrefix}` : '';
};

export default function DoctorSignup() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    walletAddress: '',
  });
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage('');
    setIsError(false);

    try {
      const normalizedDoctorName = normalizeDoctorName(formData.fullName);
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          fullName: normalizedDoctorName,
          role: 'doctor',
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Registration failed');
      }

      setMessage(data.message || 'Registration successful');

      if (data.token) {
        localStorage.setItem('authToken', data.token);
      }

      const doctorUser = {
        id: data.user?.id || '',
        fullName: normalizeDoctorName(data.user?.fullName || data.user?.full_name || data.user?.name || formData.fullName),
        email: data.user?.email || formData.email.trim().toLowerCase(),
        role: data.user?.role || 'doctor',
      };

      localStorage.setItem('doctorAuthUser', JSON.stringify(doctorUser));
      localStorage.removeItem('patientAuthUser');

      setFormData({ fullName: '', email: '', password: '', confirmPassword: '', walletAddress: '' });
      navigate('/doctor/dashboard');
    } catch (error) {
      setIsError(true);
      setMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-md flex-col rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <span className="text-xl font-semibold">D</span>
          </div>
          <h1 className="mt-4 text-2xl font-semibold text-slate-900">Doctor Signup</h1>
          <p className="mt-2 text-sm text-slate-600">Create your doctor account.</p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Full Name</label>
            <input
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              required
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Confirm Password</label>
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Wallet Address (optional)</label>
            <input
              name="walletAddress"
              value={formData.walletAddress}
              onChange={handleChange}
              placeholder="0x..."
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-full bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? 'Registering...' : 'Register'}
          </button>
        </form>

        {message ? (
          <p className={`mt-4 text-sm ${isError ? 'text-red-600' : 'text-emerald-600'}`}>{message}</p>
        ) : null}

        <Link to="/doctor/login" className="mt-6 text-center text-sm font-medium text-slate-600 hover:text-slate-900">
          Already have an account? Login
        </Link>
      </div>
    </div>
  );
}
