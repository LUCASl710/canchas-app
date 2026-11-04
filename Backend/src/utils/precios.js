// Regla de precio nocturno.
//
// Una franja que EMPIEZA a partir de la hora de corte usa `precio_nocturno`.
// Si la franja no tiene precio nocturno cargado (0), se usa `precio_base`.
// La hora de corte se puede cambiar por .env sin tocar código.
const HORA_NOCTURNA_INICIO = process.env.HORA_NOCTURNA_INICIO || '20:00';

function esHorarioNocturno(horaInicio) {
  // "20:00:00" -> "20:00". Comparar strings funciona en formato HH:MM.
  return String(horaInicio).slice(0, 5) >= HORA_NOCTURNA_INICIO;
}

function calcularMonto(franja) {
  const precioBase = Number(franja.precio_base);
  const precioNocturno = Number(franja.precio_nocturno);

  if (esHorarioNocturno(franja.hora_inicio) && precioNocturno > 0) {
    return precioNocturno;
  }

  return precioBase;
}

module.exports = { HORA_NOCTURNA_INICIO, esHorarioNocturno, calcularMonto };
