import { useState } from 'react';
import Login from './components/Login';
import Canchas from './components/Canchas';
import MisReservas from './components/MisReservas';
import AdminCanchas from './components/AdminCanchas';
import AdminFranjas from './components/AdminFranjas';
import AdminGrabaciones from './components/AdminGrabaciones';
import { cerrarSesion } from './api';
import './App.css';

function leerUsuario() {
  try {
    return JSON.parse(localStorage.getItem('usuario'));
  } catch {
    return null;
  }
}

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [usuario, setUsuario] = useState(leerUsuario());
  const [pantalla, setPantalla] = useState('canchas');

  const handleLogin = (data) => {
    localStorage.setItem('token', data.token);
    localStorage.setItem('usuario', JSON.stringify(data.usuario));
    setToken(data.token);
    setUsuario(data.usuario);
    setPantalla('canchas');
  };

  // Sin token o sin datos de usuario, no hay sesión válida.
  if (!token || !usuario) {
    return <Login onLogin={handleLogin} />;
  }

  const esAdmin = usuario.rol === 'admin';

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="app-logo">⚽ Canchas App</div>

        <nav className="app-nav">
          <button
            className={`app-nav-btn ${pantalla === 'canchas' ? 'activo' : ''}`}
            onClick={() => setPantalla('canchas')}
          >
            Canchas
          </button>

          <button
            className={`app-nav-btn ${pantalla === 'misreservas' ? 'activo' : ''}`}
            onClick={() => setPantalla('misreservas')}
          >
            {esAdmin ? 'Todas las reservas' : 'Mis reservas'}
          </button>

          {esAdmin && (
            <>
              <button
                className={`app-nav-btn ${pantalla === 'admin' ? 'activo' : ''}`}
                onClick={() => setPantalla('admin')}
              >
                Admin: Crear cancha
              </button>
              <button
                className={`app-nav-btn ${pantalla === 'adminfranjas' ? 'activo' : ''}`}
                onClick={() => setPantalla('adminfranjas')}
              >
                Admin: Crear franja
              </button>
              <button
                className={`app-nav-btn ${pantalla === 'admingrabaciones' ? 'activo' : ''}`}
                onClick={() => setPantalla('admingrabaciones')}
              >
                Admin: Grabaciones
              </button>
            </>
          )}

          <span className="app-usuario">
            {usuario.nombre} {usuario.apellido}
            <span className="app-rol">{usuario.rol}</span>
          </span>

          <button className="app-nav-btn-salir" onClick={cerrarSesion}>
            Cerrar sesión
          </button>
        </nav>
      </header>

      <main className="app-content">
        {pantalla === 'canchas' && <Canchas />}
        {pantalla === 'misreservas' && <MisReservas esAdmin={esAdmin} />}
        {esAdmin && pantalla === 'admin' && <AdminCanchas />}
        {esAdmin && pantalla === 'adminfranjas' && <AdminFranjas />}
        {esAdmin && pantalla === 'admingrabaciones' && <AdminGrabaciones />}
      </main>
    </div>
  );
}

export default App;
