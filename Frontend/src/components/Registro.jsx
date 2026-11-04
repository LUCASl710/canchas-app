import { useState } from 'react';
import { apiFetch } from '../api';
import './Login.css';

function Registro({ onVolver }) {
  const [form, setForm] = useState({
    nombre: '',
    apellido: '',
    email: '',
    telefono: '',
    password: '',
  });
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMensaje('');
    setError('');
    setCargando(true);

    try {
      const response = await apiFetch('/api/auth/registro', {
        method: 'POST',
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (response.ok) {
        setMensaje('¡Usuario registrado correctamente! Ya podés iniciar sesión.');
        setForm({ nombre: '', apellido: '', email: '', telefono: '', password: '' });
      } else {
        setError(data.error || 'No se pudo crear la cuenta');
      }
    } catch {
      setError('No se pudo conectar con el servidor');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h2 className="login-titulo">Crear cuenta</h2>

        <form className="login-form" onSubmit={handleSubmit}>
          <input className="login-input" name="nombre" placeholder="Nombre" value={form.nombre} onChange={handleChange} required />
          <input className="login-input" name="apellido" placeholder="Apellido" value={form.apellido} onChange={handleChange} required />
          <input className="login-input" name="email" type="email" placeholder="Email" value={form.email} onChange={handleChange} required />
          <input className="login-input" name="telefono" placeholder="Teléfono" value={form.telefono} onChange={handleChange} />
          <input className="login-input" name="password" type="password" placeholder="Contraseña" value={form.password} onChange={handleChange} required minLength={6} />

          {error && <p className="login-error">{error}</p>}
          {mensaje && <p className="login-ok">{mensaje}</p>}

          <button className="login-btn-primario" type="submit" disabled={cargando}>
            {cargando ? 'Creando cuenta...' : 'Registrarse'}
          </button>
        </form>

        <button className="login-btn-secundario" onClick={onVolver}>
          Volver al login
        </button>
      </div>
    </div>
  );
}

export default Registro;
