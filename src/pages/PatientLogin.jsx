import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function PatientLogin() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ email: '', password: '' });
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
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          role: 'patient',
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }

      if (data.user?.role && String(data.user.role).toLowerCase() !== 'patient') {
        throw new Error(`This account is a ${String(data.user.role).toLowerCase()} account. Use the correct portal.`);
      }

      if (data.token) {
        localStorage.setItem('authToken', data.token);
      }
      if (data.user) {
        const patientUser = {
          id: data.user.id || '',
          fullName: data.user.fullName || data.user.full_name || data.user.name || '',
          email: data.user.email || formData.email.trim().toLowerCase(),
          role: data.user.role || 'patient',
        };

        localStorage.setItem('patientAuthUser', JSON.stringify(patientUser));
        localStorage.removeItem('doctorAuthUser');
      }

      setMessage(data.message || 'Login successful');
      setFormData({ email: '', password: '' });
      navigate('/patient/dashboard');
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
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600">
            <span className="text-xl font-semibold">P</span>
          </div>
          <h1 className="mt-4 text-2xl font-semibold text-slate-900">Patient Login</h1>
          <p className="mt-2 text-sm text-slate-600">Access your secure health records.</p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="patient@example.com"
              required
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Enter your password"
              required
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-full bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? 'Logging in...' : 'Login'}
          </button>
        </form>

        {message ? (
          <p className={`mt-4 text-sm ${isError ? 'text-red-600' : 'text-emerald-600'}`}>{message}</p>
        ) : null}

        <Link to="/" className="mt-6 text-center text-sm font-medium text-slate-600 hover:text-slate-900">
          Back to Home
        </Link>
      </div>
    </div>
  );
}
