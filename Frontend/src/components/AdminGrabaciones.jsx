import { useState, useEffect } from 'react';
import { apiFetch } from '../api';
import { formatearFecha, formatearHora } from '../utils/formato';
import './AdminCanchas.css';

function AdminGrabaciones() {
  const [reservas, setReservas] = useState([]);
  const [form, setForm] = useState({ reserva_id: '', titulo: '' });
  const [archivo, setArchivo] = useState(null);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    apiFetch('/api/reservas')
      .then((res) => res.json())
      .then((data) => setReservas(Array.isArray(data) ? data : []))
      .catch(() => setError('No se pudieron cargar las reservas'));
  }, []);

  // Solo tiene sentido subir una grabación de una reserva que se jugó.
  const reservasDisponibles = reservas.filter(
    (r) => r.estado === 'confirmada' || r.estado === 'completada'
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMensaje('');
    setError('');

    if (!archivo) {
      setError('Elegí un archivo de video');
      return;
    }

    setCargando(true);

    try {
      const datos = new FormData();
      datos.append('reserva_id', form.reserva_id);
      datos.append('titulo', form.titulo);
      datos.append('archivo', archivo);

      const response = await apiFetch('/api/grabaciones', {
        method: 'POST',
        body: datos,
      });

      const data = await response.json();

      if (response.ok) {
        setMensaje('¡Grabación subida correctamente!');
        setForm({ reserva_id: '', titulo: '' });
        setArchivo(null);
        e.target.reset();
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
      <h2 className="admin-titulo">Subir grabación</h2>

      <form className="admin-form" onSubmit={handleSubmit}>
        <select
          className="admin-select"
          name="reserva_id"
          value={form.reserva_id}
          onChange={(e) => setForm({ ...form, reserva_id: e.target.value })}
          required
        >
          <option value="">
            {reservasDisponibles.length === 0 ? 'No hay reservas confirmadas' : 'Elegí una reserva'}
          </option>
          {reservasDisponibles.map((r) => (
            <option key={r.id} value={r.id}>
              #{r.id} — {r.cancha_nombre} — {formatearFecha(r.fecha)} {formatearHora(r.hora_inicio)} ({r.nombre} {r.apellido})
            </option>
          ))}
        </select>

        <input
          className="admin-input"
          name="titulo"
          placeholder="Título de la grabación"
          value={form.titulo}
          onChange={(e) => setForm({ ...form, titulo: e.target.value })}
          required
        />

        <input
          className="admin-input"
          type="file"
          accept="video/*"
          onChange={(e) => setArchivo(e.target.files[0] || null)}
          required
        />

        <button className="admin-btn" type="submit" disabled={cargando}>
          {cargando ? 'Subiendo...' : 'Subir grabación'}
        </button>
      </form>

      {error && <p className="admin-mensaje">{error}</p>}
      {mensaje && <p className="admin-mensaje">{mensaje}</p>}
    </div>
  );
}

export default AdminGrabaciones;
