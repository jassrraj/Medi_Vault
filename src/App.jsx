import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import PatientLogin from './pages/PatientLogin';
import DoctorLogin from './pages/DoctorLogin';
import PatientSignup from './pages/PatientSignup';
import DoctorSignup from './pages/DoctorSignup';
import PatientDashboard from './pages/PatientDashboard';
import DoctorDashboard from './pages/DoctorDashboard';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/patient/login" element={<PatientLogin />} />
        <Route path="/doctor/login" element={<DoctorLogin />} />
        <Route path="/patient/signup" element={<PatientSignup />} />
        <Route path="/doctor/signup" element={<DoctorSignup />} />
        <Route path="/patient/dashboard" element={<PatientDashboard />} />
        <Route path="/doctor/dashboard" element={<DoctorDashboard />} />
      </Routes>
    </BrowserRouter>
  );
}
