import { useState, useEffect } from 'react';
import { apiFetch } from '../api';
import './Canchas.css';

function Canchas() {
  const [canchas, setCanchas] = useState([]);
  const [canchaSeleccionada, setCanchaSeleccionada] = useState(null);
  const [franjas, setFranjas] = useState([]);
  const [fecha, setFecha] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    apiFetch('/api/canchas')
      .then((res) => res.json())
      .then((data) => setCanchas(Array.isArray(data) ? data : []))
      .catch(() => setMensaje('No se pudieron cargar las canchas'))
      .finally(() => setCargando(false));
  }, []);

  const verHorarios = async (cancha) => {
    setCanchaSeleccionada(cancha);
    setMensaje('');

    try {
      const res = await apiFetch(`/api/franjas/${cancha.id}`);
      const data = await res.json();
      setFranjas(Array.isArray(data) ? data : []);
    } catch {
      setMensaje('No se pudieron cargar los horarios');
    }
  };

  const reservar = async (franja) => {
    if (!fecha) {
      setMensaje('Seleccioná una fecha primero');
      return;
    }

    try {
      const response = await apiFetch('/api/reservas', {
        method: 'POST',
        body: JSON.stringify({
          cancha_id: canchaSeleccionada.id,
          franja_id: franja.id,
          fecha: fecha,
          metodo_pago: 'efectivo',
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMensaje('¡Reserva creada correctamente!');
      } else {
        setMensaje('Error: ' + data.error);
      }
    } catch {
      setMensaje('Error de conexión con el servidor');
    }
  };

  const hoy = new Date().toISOString().split('T')[0];

  return (
    <div>
      <h2 className="canchas-titulo">Canchas disponibles</h2>

      {cargando && <p className="canchas-vacio">Cargando canchas...</p>}

      <div className="canchas-grid">
        {canchas.map((cancha) => (
          <div key={cancha.id} className="cancha-card">
            <div className="cancha-card-nombre">{cancha.nombre}</div>
            <div className="cancha-card-detalle">Tipo: {cancha.tipo}</div>
            <div className="cancha-card-detalle">Superficie: {cancha.superficie}</div>
            <button className="cancha-card-btn" onClick={() => verHorarios(cancha)}>
              Ver horarios
            </button>
          </div>
        ))}
      </div>

      {canchaSeleccionada && (
        <div className="horarios-panel">
          <h3 className="horarios-titulo">Horarios para {canchaSeleccionada.nombre}</h3>

          <label className="horarios-fecha-label">Elegí una fecha:</label>
          <input
            className="horarios-fecha-input"
            type="date"
            min={hoy}
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />

          {franjas.map((franja) => (
            <div key={franja.id} className="franja-item">
              <span className="franja-info">
                {franja.hora_inicio} - {franja.hora_fin} | ${franja.precio_base}
              </span>
              <button className="franja-btn" onClick={() => reservar(franja)}>
                Reservar
              </button>
            </div>
          ))}

          {mensaje && <p className="horarios-mensaje">{mensaje}</p>}
        </div>
      )}
    </div>
  );
}

export default Canchas;
