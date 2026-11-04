// Helpers de formato pensados para no depender de la zona horaria.
// MySQL devuelve las columnas DATE como "YYYY-MM-DD" (ver dateStrings en
// connection.js), así que las formateamos como texto y no con new Date():
// new Date("2027-01-02") se interpreta como UTC y en Argentina resta un día.

export function formatearFecha(fecha) {
  if (!fecha) return '';
  const [anio, mes, dia] = String(fecha).slice(0, 10).split('-');
  if (!anio || !mes || !dia) return String(fecha);
  return `${dia}/${mes}/${anio}`;
}

// "18:00:00" -> "18:00"
export function formatearHora(hora) {
  if (!hora) return '';
  return String(hora).slice(0, 5);
}

// Fecha de hoy en horario local (no UTC), como "YYYY-MM-DD".
export function fechaHoyLocal() {
  const ahora = new Date();
  const anio = ahora.getFullYear();
  const mes = String(ahora.getMonth() + 1).padStart(2, '0');
  const dia = String(ahora.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}
