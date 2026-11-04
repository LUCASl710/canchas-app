import { useState } from 'react';
import { apiFetch } from '../api';
import './AdminCanchas.css';

function AdminCanchas() {
  const [form, setForm] = useState({
    nombre: '',
    tipo: 'futbol5',
    superficie: '',
    tiene_techo: false,
    tiene_iluminacion: true,
  });
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm({ ...form, [name]: type === 'checkbox' ? checked : value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMensaje('');
    setError('');
    setCargando(true);

    try {
      const response = await apiFetch('/api/canchas', {
        method: 'POST',
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (response.ok) {
        setMensaje('¡Cancha creada correctamente!');
        setForm({ nombre: '', tipo: 'futbol5', superficie: '', tiene_techo: false, tiene_iluminacion: true });
      } else {
        setError('Error: ' + data.error);
      }
    } catch {
      setError('Error de conexión con el servidor');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div>
      <h2 className="admin-titulo">Crear cancha nueva</h2>

      <form className="admin-form" onSubmit={handleSubmit}>
        <input
          className="admin-input"
          name="nombre"
          placeholder="Nombre"
          value={form.nombre}
          onChange={handleChange}
          required
        />

        <select className="admin-select" name="tipo" value={form.tipo} onChange={handleChange}>
          <option value="futbol5">Fútbol 5</option>
          <option value="futbol7">Fútbol 7</option>
        </select>

        <input
          className="admin-input"
          name="superficie"
          placeholder="Superficie"
          value={form.superficie}
          onChange={handleChange}
          required
        />

        <label className="admin-checkbox-label">
          <input type="checkbox" name="tiene_techo" checked={form.tiene_techo} onChange={handleChange} />
          Tiene techo
        </label>

        <label className="admin-checkbox-label">
          <input type="checkbox" name="tiene_iluminacion" checked={form.tiene_iluminacion} onChange={handleChange} />
          Tiene iluminación
        </label>

        <button className="admin-btn" type="submit" disabled={cargando}>
          {cargando ? 'Creando...' : 'Crear cancha'}
        </button>
      </form>

      {error && <p className="admin-mensaje">{error}</p>}
      {mensaje && <p className="admin-mensaje">{mensaje}</p>}
    </div>
  );
}

export default AdminCanchas;
