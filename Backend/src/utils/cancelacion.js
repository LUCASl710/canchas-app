// Regla de cancelación.
//
// El cliente puede cancelar hasta N horas antes del inicio del turno.
// El admin puede cancelar siempre (salvo una reserva ya completada).
// N se configura por .env (default 24).
//
// OJO: el cálculo usa la hora local del servidor. En producción conviene
// arrancar Node con TZ=America/Argentina/Buenos_Aires para que coincida con
// la zona horaria del complejo.
const valorConfigurado = process.env.HORAS_CANCELACION_MINIMAS;
const configurado = valorConfigurado === undefined || valorConfigurado === ''
  ? NaN
  : Number(valorConfigurado);

const HORAS_CANCELACION_MINIMAS = Number.isFinite(configurado) ? configurado : 24;

// Une fecha ("YYYY-MM-DD") y hora ("HH:MM:SS") en un Date local.
// Se construye explícitamente para no depender del parseo del runtime.
function fechaHoraLocal(fecha, hora) {
  const [anio, mes, dia] = String(fecha).split('-').map(Number);
  const [hh, mm, ss] = String(hora).split(':').map(Number);
  return new Date(anio, mes - 1, dia, hh, mm, ss || 0);
}

// Horas que faltan para el inicio del turno (negativo si ya empezó).
function horasHasta(fecha, hora, ahora = new Date()) {
  return (fechaHoraLocal(fecha, hora) - ahora) / (1000 * 60 * 60);
}

function puedeCancelar(fecha, horaInicio, ahora = new Date()) {
  return horasHasta(fecha, horaInicio, ahora) >= HORAS_CANCELACION_MINIMAS;
}

module.exports = {
  HORAS_CANCELACION_MINIMAS,
  fechaHoraLocal,
  horasHasta,
  puedeCancelar,
};
