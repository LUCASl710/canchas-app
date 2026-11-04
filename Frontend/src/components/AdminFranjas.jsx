import { useState, useEffect } from 'react';
import { apiFetch } from '../api';
import './AdminCanchas.css';

function AdminFranjas() {
  const [canchas, setCanchas] = useState([]);
  const [form, setForm] = useState({
    cancha_id: '',
    hora_inicio: '',
    hora_fin: '',
    precio_base: '',
    precio_nocturno: '',
  });
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    apiFetch('/api/canchas')
      .then((res) => res.json())
      .then((data) => setCanchas(Array.isArray(data) ? data : []))
      .catch(() => setError('No se pudieron cargar las canchas'));
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMensaje('');
    setError('');
    setCargando(true);

    try {
      const response = await apiFetch('/api/franjas', {
        method: 'POST',
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (response.ok) {
        setMensaje('¡Franja horaria creada correctamente!');
        setForm({ cancha_id: '', hora_inicio: '', hora_fin: '', precio_base: '', precio_nocturno: '' });
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
      <h2 className="admin-titulo">Crear franja horaria</h2>

      <form className="admin-form" onSubmit={handleSubmit}>
        <select
          className="admin-select"
          name="cancha_id"
          value={form.cancha_id}
          onChange={handleChange}
          required
        >
          <option value="">Elegí una cancha</option>
          {canchas.map((c) => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </select>

        <input className="admin-input" type="time" name="hora_inicio" value={form.hora_inicio} onChange={handleChange} required />
        <input className="admin-input" type="time" name="hora_fin" value={form.hora_fin} onChange={handleChange} required />

        <input
          className="admin-input"
          type="number"
          name="precio_base"
          placeholder="Precio base"
          value={form.precio_base}
          onChange={handleChange}
          min="0"
          step="0.01"
          required
        />

        <input
          className="admin-input"
          type="number"
          name="precio_nocturno"
          placeholder="Precio nocturno (opcional)"
          value={form.precio_nocturno}
          onChange={handleChange}
          min="0"
          step="0.01"
        />

        <button className="admin-btn" type="submit" disabled={cargando}>
          {cargando ? 'Creando...' : 'Crear franja'}
        </button>
      </form>

      <p className="admin-ayuda">
        Las franjas que empiezan a las 20:00 o después cobran el precio nocturno
        si lo cargás. Si lo dejás vacío, se cobra el precio base.
      </p>

      {error && <p className="admin-mensaje">{error}</p>}
      {mensaje && <p className="admin-mensaje">{mensaje}</p>}
    </div>
  );
}

export default AdminFranjas;
