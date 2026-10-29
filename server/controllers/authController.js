import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '../config/db.js';

const validRoles = ['patient', 'doctor'];
const getSecret = () => process.env.JWT_SECRET;
const normalizeDoctorName = (value = '') => {
  const trimmed = String(value).trim();
  if (!trimmed) return '';
  const withoutPrefix = trimmed.replace(/^Dr\.?\s+/i, '').trim();
  return withoutPrefix ? `Dr. ${withoutPrefix}` : '';
};

export const registerUser = async (req, res) => {
  try {
    const { fullName, email, password, confirmPassword, role, walletAddress } = req.body;
    const normalizedRole = (role || '').trim().toLowerCase();
    const normalizedName = normalizedRole === 'doctor' ? normalizeDoctorName(fullName) : (fullName || '').trim();
    const normalizedEmail = (email || '').trim().toLowerCase();
    const normalizedWalletAddress = (walletAddress || '').trim();

    if (!normalizedName || !normalizedEmail || !password || !confirmPassword || !normalizedRole) return res.status(400).json({ message: 'All fields are required' });
    if (!validRoles.includes(normalizedRole)) return res.status(400).json({ message: 'Role must be patient or doctor' });
    if (password.length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters' });
    if (password !== confirmPassword) return res.status(400).json({ message: 'Passwords do not match' });
    if (normalizedWalletAddress && !/^0x[a-fA-F0-9]{40}$/.test(normalizedWalletAddress)) return res.status(400).json({ message: 'Wallet address must be a valid Ethereum address' });
    if (!getSecret()) return res.status(500).json({ message: 'JWT_SECRET is not configured' });

    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    if (existingUser.rowCount) return res.status(409).json({ message: 'Email already exists' });

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      'INSERT INTO users (full_name, email, password_hash, role, wallet_address) VALUES ($1, $2, $3, $4, $5) RETURNING id, full_name, email, role, wallet_address',
      [normalizedName, normalizedEmail, passwordHash, normalizedRole, normalizedWalletAddress || null]
    );
    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, getSecret(), { expiresIn: '1d' });
    return res.status(201).json({ message: 'User registered successfully', token, user: { id: user.id, fullName: user.full_name, email: user.email, role: user.role, walletAddress: user.wallet_address } });
  } catch (error) {
    console.error('Registration error:', error.message);
    return res.status(500).json({ message: 'Server error during registration' });
  }
};

export const loginUser = async (req, res) => {
  try {
    const { email, password, role } = req.body;
    const normalizedEmail = (email || '').trim().toLowerCase();
    const requestedRole = (role || '').trim().toLowerCase();
    if (!normalizedEmail || !password || !validRoles.includes(requestedRole)) return res.status(400).json({ message: 'Valid email, password, and portal role are required' });
    if (!getSecret()) return res.status(500).json({ message: 'JWT_SECRET is not configured' });

    const result = await pool.query('SELECT id, full_name, email, password_hash, role FROM users WHERE email = $1', [normalizedEmail]);
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) return res.status(401).json({ message: 'Invalid email or password' });
    if (user.role !== requestedRole) return res.status(403).json({ message: `Use the ${user.role} portal for this account` });

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, getSecret(), { expiresIn: '1d' });
    const fullName = user.role === 'doctor' ? normalizeDoctorName(user.full_name) : user.full_name;
    return res.json({ message: 'Login successful', token, user: { id: user.id, fullName, email: user.email, role: user.role } });
  } catch (error) {
    console.error('Login error:', error.message);
    return res.status(500).json({ message: 'Server error during login' });
  }
};
