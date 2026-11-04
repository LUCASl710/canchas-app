// Punto único de conexión con el backend.
// Si mañana cambia el puerto o el dominio, se cambia SOLO acá.
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * fetch con el token agregado automáticamente.
 * Si el backend responde 401 (token vencido o inválido),
 * limpia la sesión y vuelve al login.
 */
export async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('token');

  const headers = { ...(options.headers || {}) };

  // FormData (subida de archivos) define su propio Content-Type con boundary.
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (response.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    window.location.reload();
  }

  return response;
}

export function cerrarSesion() {
  localStorage.removeItem('token');
  localStorage.removeItem('usuario');
  window.location.reload();
}
