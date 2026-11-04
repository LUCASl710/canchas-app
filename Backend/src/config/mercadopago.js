const { MercadoPagoConfig } = require('mercadopago');

// Cliente de Mercado Pago compartido por todas las rutas.
// El token sale del .env. Si está vacío, las llamadas a la API fallan
// y cada ruta lo maneja sin romper el servidor.
const mp = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });

module.exports = mp;
