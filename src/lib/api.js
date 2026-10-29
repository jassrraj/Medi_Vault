const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

export const api = async (path, options = {}) => {
  const token = localStorage.getItem('authToken');
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) },
    });
  } catch {
    throw new Error(`Cannot reach the backend at ${API_URL}. Start the server and confirm its port.`);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Request failed');
  return data;
};

export const downloadRecord = async (recordId, fileName) => {
  const token = localStorage.getItem('authToken');
  const response = await fetch(`${API_URL}/api/files/${recordId}/download`, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || 'Download failed');
  }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
};
