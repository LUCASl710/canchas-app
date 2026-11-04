import { useState, useEffect } from 'react';
import { apiFetch, API_URL } from '../api';
import './MisReservas.css';

function MisReservas({ esAdmin = false }) {
  const [reservas, setReservas] = useState([]);
  const [mensaje, setMensaje] = useState('');
  const [grabacionAbierta, setGrabacionAbierta] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [fechaFiltro, setFechaFiltro] = useState('');
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    let activo = true;

    const cargar = async () => {
      setCargando(true);
      try {
        const url = fechaFiltro ? `/api/reservas?fecha=${fechaFiltro}` : '/api/reservas';
        const res = await apiFetch(url);
        const data = await res.json();
        if (activo) setReservas(Array.isArray(data) ? data : []);
      } catch {
        if (activo) setMensaje('No se pudieron cargar las reservas');
      } finally {
        if (activo) setCargando(false);
      }
    };

    cargar();
    return () => { activo = false; };
  }, [fechaFiltro, recarga]);

  const recargar = () => setRecarga((n) => n + 1);

  const cancelarReserva = async (id) => {
    try {
      const response = await apiFetch(`/api/reservas/${id}`, { method: 'DELETE' });
      const data = await response.json();

      if (response.ok) {
        setMensaje('Reserva cancelada correctamente');
        recargar();
      } else {
        setMensaje('Error: ' + data.error);
      }
    } catch {
      setMensaje('Error de conexión con el servidor');
    }
  };

  const cambiarEstado = async (id, estado) => {
    try {
      const response = await apiFetch(`/api/reservas/${id}/estado`, {
        method: 'PATCH',
        body: JSON.stringify({ estado }),
      });
      const data = await response.json();

      if (response.ok) {
        setMensaje(`Reserva marcada como ${estado}`);
        recargar();
      } else {
        setMensaje('Error: ' + data.error);
      }
    } catch {
      setMensaje('Error de conexión con el servidor');
    }
  };

  const verGrabacion = async (reservaId) => {
    try {
      const response = await apiFetch(`/api/grabaciones/reserva/${reservaId}`);
      const data = await response.json();

      if (!response.ok) {
        setMensaje('Error: ' + (data.error || 'No se pudo acceder a la grabación'));
        return;
      }

      if (Array.isArray(data) && data.length > 0) {
        setGrabacionAbierta(data[0]);
      } else {
        setMensaje('Todavía no hay grabación disponible para esta reserva');
      }
    } catch {
      setMensaje('Error de conexión con el servidor');
    }
  };

  return (
    <div>
      <h2 className="reservas-titulo">{esAdmin ? 'Reservas del complejo' : 'Mis reservas'}</h2>

      {esAdmin && (
        <div className="reservas-filtro">
          <label className="reservas-filtro-label" htmlFor="fecha-filtro">
            Filtrar por día:
          </label>
          <input
            id="fecha-filtro"
            className="reservas-filtro-input"
            type="date"
            value={fechaFiltro}
            onChange={(e) => setFechaFiltro(e.target.value)}
          />
          {fechaFiltro && (
            <button className="reservas-filtro-btn" onClick={() => setFechaFiltro('')}>
              Ver todas
            </button>
          )}
        </div>
      )}

      {cargando && <p className="reservas-vacio">Cargando reservas...</p>}

      {!cargando && reservas.length === 0 && (
        <p className="reservas-vacio">
          {esAdmin
            ? (fechaFiltro ? 'No hay reservas para ese día.' : 'Todavía no hay reservas registradas.')
            : 'No tenés reservas todavía.'}
        </p>
      )}

      {reservas.map((reserva) => (
        <div key={reserva.id} className="reserva-card">
          <div className="reserva-card-header">
            <span className="reserva-card-cancha">{reserva.cancha_nombre} — {reserva.cancha_tipo}</span>
            <span className={`reserva-estado ${reserva.estado}`}>{reserva.estado}</span>
          </div>

          {esAdmin && (
            <p className="reserva-detalle">
              Cliente: {reserva.nombre} {reserva.apellido} ({reserva.email})
            </p>
          )}

          <p className="reserva-detalle">Fecha: {new Date(reserva.fecha).toLocaleDateString('es-AR')}</p>
          <p className="reserva-detalle">Horario: {reserva.hora_inicio} - {reserva.hora_fin}</p>
          <p className="reserva-detalle">Monto: ${reserva.monto_total}</p>
          <p className="reserva-detalle">Pago: {reserva.metodo_pago}</p>

          <div className="reserva-acciones">
            {esAdmin && reserva.estado === 'pendiente' && (
              <button className="reserva-btn-confirmar" onClick={() => cambiarEstado(reserva.id, 'confirmada')}>
                Confirmar
              </button>
            )}

            {esAdmin && reserva.estado === 'confirmada' && (
              <button className="reserva-btn-completar" onClick={() => cambiarEstado(reserva.id, 'completada')}>
                Marcar completada
              </button>
            )}

            {reserva.estado !== 'cancelada' && reserva.estado !== 'completada' && (
              <button className="reserva-btn-cancelar" onClick={() => cancelarReserva(reserva.id)}>
                Cancelar
              </button>
            )}

            {(reserva.estado === 'confirmada' || reserva.estado === 'completada') && (
              <button className="reserva-btn-grabacion" onClick={() => verGrabacion(reserva.id)}>
                Ver grabación
              </button>
            )}
          </div>
        </div>
      ))}

      {grabacionAbierta && (
        <div className="grabacion-modal">
          <div className="grabacion-modal-contenido">
            <h3 className="grabacion-titulo">{grabacionAbierta.titulo}</h3>
            <video
              className="grabacion-video"
              src={`${API_URL}${grabacionAbierta.archivo_url}`}
              controls
              playsInline
            />
            <button className="grabacion-cerrar" onClick={() => setGrabacionAbierta(null)}>
              Cerrar
            </button>
          </div>
        </div>
      )}

      {mensaje && <p className="reservas-mensaje">{mensaje}</p>}
    </div>
  );
}

export default MisReservas;
