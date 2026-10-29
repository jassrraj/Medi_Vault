import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-emerald-50 px-4 py-10 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: 'easeOut' }}
        className="mx-auto flex max-w-6xl flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white/80 px-6 py-12 shadow-sm backdrop-blur sm:px-10 lg:px-16"
      >
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5, ease: 'easeOut' }}
          className="max-w-3xl text-center"
        >
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-emerald-600">
            Secure Healthcare Access
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">
            Blockchain-Based Secure Electronic Health Records
          </h1>
          <p className="mt-4 text-lg text-slate-600">
            Choose your portal to continue.
          </p>
        </motion.div>

        <div className="mt-10 grid w-full gap-6 md:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5, ease: 'easeOut' }}
            whileHover={{ y: -6, scale: 1.015 }}
            className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center shadow-sm"
          >
            <h2 className="text-2xl font-semibold text-slate-900">Patient Portal</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Access your secure health records and continue your care journey.
            </p>
            <Link
              to="/patient/login"
              className="mt-6 inline-flex rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              Enter Patient Portal
            </Link>
            <p className="mt-4 text-sm text-slate-600">
              New user?{' '}
              <Link to="/patient/signup" className="font-semibold text-blue-600 hover:text-blue-700">
                Sign up
              </Link>
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.42, duration: 0.5, ease: 'easeOut' }}
            whileHover={{ y: -6, scale: 1.015 }}
            className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center shadow-sm"
          >
            <h2 className="text-2xl font-semibold text-slate-900">Doctor Portal</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Review shared records and support patient care safely.
            </p>
            <Link
              to="/doctor/login"
              className="mt-6 inline-flex rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
            >
              Enter Doctor Portal
            </Link>
            <p className="mt-4 text-sm text-slate-600">
              New user?{' '}
              <Link to="/doctor/signup" className="font-semibold text-emerald-600 hover:text-emerald-700">
                Sign up
              </Link>
            </p>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
