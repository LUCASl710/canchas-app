# ⚽ Canchas App

[![CI](https://github.com/LUCASl710/canchas-app/actions/workflows/ci.yml/badge.svg)](https://github.com/LUCASl710/canchas-app/actions/workflows/ci.yml)

Sistema de gestión y reserva de turnos para complejos de canchas de fútbol.
Incluye un panel de administración para el complejo y una vista pública para los clientes.

## Demo

- **Frontend:** <https://canchas-app-mu.vercel.app>
- **API:** <https://canchas-api-2m2q.onrender.com>
- **Health check:** <https://canchas-api-2m2q.onrender.com/api/health>

> El backend corre en Render free: si estuvo 15 minutos sin tráfico, el primer
> request puede tardar ~1 minuto en despertar.

![Captura de Canchas App](docs/canchas-app.png)

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 19 + Vite |
| Backend | Node.js + Express 5 |
| Base de datos | MySQL 8 / TiDB Cloud Starter (driver `mysql2`) |
| Autenticación | JWT + bcrypt |
| Pagos | Mercado Pago (Checkout Pro) |

## Estructura

```
canchas-app/
├── Backend/
│   ├── index.js                 # Arranque del servidor Express
│   ├── .env.example             # Variables de entorno (copiar a .env)
│   ├── test/concurrencia.js     # Prueba de doble reserva simultánea
│   ├── uploads/                 # Videos subidos (ignorado por git)
│   └── src/
│       ├── config/
│       │   └── mercadopago.js   # Cliente de Mercado Pago compartido
│       ├── db/
│       │   ├── connection.js    # Pool de conexiones MySQL
│       │   └── query.js         # Helper de consultas con async/await
│       ├── middleware/
│       │   ├── auth.js          # Verifica el JWT
│       │   ├── roles.js         # Autorización por rol (soloAdmin)
│       │   └── rateLimit.js     # Límite de intentos en login/registro
│       └── routes/              # auth, usuarios, canchas, franjas, reservas, grabaciones, pagos
├── Frontend/
│   ├── .env.example             # VITE_API_URL (URL del backend)
│   └── src/
│       ├── api.js               # URL del backend + fetch con token
│       ├── App.jsx              # Navegación y control de sesión
│       └── components/          # Login, Registro, Canchas, MisReservas, Admin...
└── db/
    ├── schema.sql               # Estructura completa de la base
    └── seed.sql                 # Datos de prueba
```

## Puesta en marcha

### 1. Base de datos

Con MySQL corriendo (Laragon / XAMPP):

```bash
mysql -u root < db/schema.sql
mysql -u root < db/seed.sql
```

### 2. Backend

```bash
cd Backend
cp .env.example .env      # completar credenciales
npm install
npm run dev
```

Servidor en `http://localhost:3001`.

### 3. Frontend

```bash
cd Frontend
npm install
npm run dev
```

App en `http://localhost:5173`.

## Tests

Con el backend corriendo y MySQL arriba:

```bash
cd Backend
npm test
```

Corre dos suites:

- **Concurrencia** (`test/concurrencia.js`): dispara dos reservas simultáneas
  al mismo turno. El resultado correcto es una `201` y una `409`.
- **API** (`test/api.test.js`): 23 tests de integración contra HTTP real
  (permisos, validaciones, doble reserva, cambios de estado, 404 y JSON
  malformado).

También se pueden correr por separado con `npm run test:concurrencia` y
`npm run test:api`. Los tests limpian las reservas que crean.

En cada push a `main` que toque `Backend/`, `Frontend/` o `db/`, GitHub Actions
levanta un MySQL 8.4, importa el schema y el seed, corre `npm test` y buildea el
frontend ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)).

## Usuarios de prueba

| Rol | Email | Contraseña |
|---|---|---|
| Cliente (demo) | `cliente@test.com` | `Cliente1234` |
| Admin | `admin@canchas.com` | No publicada |

> El cliente demo está disponible en la demo pública. La contraseña del admin
> no se publica: se configura con `npm run crear-admin` (ver [`DEPLOY.md`](DEPLOY.md)).

## Roles y permisos

| Acción | Cliente | Admin |
|---|---|---|
| Ver canchas y horarios | ✅ | ✅ |
| Crear reserva | ✅ | ✅ |
| Ver reservas | Solo las propias | Todas |
| Cancelar reserva | Solo las propias, hasta 24 h antes | Todas |
| Ver grabaciones | Solo las de sus reservas | Todas |
| Crear canchas / franjas | ❌ | ✅ |
| Listar usuarios | ❌ | ✅ |
| Filtrar reservas por día | Solo las propias | Todas |
| Cambiar estado de una reserva | ❌ | ✅ |
| Subir grabaciones | ❌ | ✅ |

## Seguridad implementada

- Contraseñas con hash bcrypt (nunca en texto plano).
- JWT firmado con secreto en variable de entorno.
- El `usuario_id` de una reserva sale del token, no del body.
- El monto de la reserva se calcula en el servidor.
- Control de propiedad en reservas y grabaciones.
- Listado de usuarios restringido a admin y sin `password_hash`.
- Consultas parametrizadas (previene SQL injection).
- `401` = no autenticado (token vencido o inválido); `403` = autenticado sin permiso.
  El frontend limpia la sesión y vuelve al login ante un `401`.
- Si Mercado Pago falla al generar el link de pago, la reserva pasa a `cancelada`
  y el turno se libera (no queda bloqueado en `pendiente`).
- **Anti-doble-reserva:** transacción + `SELECT ... FOR UPDATE` sobre
  `franjas_horarias`. Dos clientes no pueden reservar el mismo turno a la vez.
- **Webhook de pagos:** no confía en el body; consulta el pago a la API de
  Mercado Pago y verifica que el monto coincida antes de confirmar.
- **Subida de grabaciones:** solo admin, solo archivos de video, máximo configurable con `MAX_VIDEO_MB` (500 MB por defecto, 100 MB en producción).
- **Rate limit:** 20 intentos por IP cada 15 minutos en login y registro
  (configurable con `AUTH_RATE_LIMIT_MAX` y `AUTH_RATE_LIMIT_WINDOW_MS`).
- **Headers de seguridad:** `helmet` (nosniff, X-Frame-Options, HSTS, etc.).
- **Validación de datos:** email con formato válido y contraseña de al menos
  8 caracteres en el registro; los errores siempre responden JSON.
- Dependencias auditadas: `npm audit` sin vulnerabilidades.

> ⚠️ **Mercado Pago:** el `MP_ACCESS_TOKEN` anterior quedó expuesto en texto plano.
> Fue eliminado del `.env`. Hay que generar uno nuevo desde el panel de
> desarrolladores de Mercado Pago antes de volver a usar Checkout Pro.
> En la demo pública la UI reserva con **efectivo**; Checkout Pro queda
> desactivado hasta rotar el token.

## Decisiones de producto

- **Turnos fijos (Opción A):** el complejo define franjas horarias fijas y el
  cliente elige una. No se permiten horarios libres ni duraciones arbitrarias.
- **Sin pádel por ahora:** el `ENUM` de `canchas.tipo` solo contempla `futbol5`
  y `futbol7`. Se agrega únicamente si un cliente lo pide.
- **`precio_nocturno`:** una franja que **empieza** a partir de las 20:00
  (configurable con `HORA_NOCTURNA_INICIO`) cobra `precio_nocturno` si está
  cargado. Si está en 0, cobra `precio_base`. El cálculo se hace siempre en el
  backend y el cliente ve el precio final en `GET /api/franjas/:canchaId`
  (`precio_vigente`).
- **Cancelación:** el cliente puede cancelar hasta 24 h antes del inicio del
  turno (`HORAS_CANCELACION_MINIMAS`). El admin puede cancelar siempre. La
  reserva no se borra: pasa a `cancelada` y libera el turno. El listado incluye
  `puede_cancelar` para que la UI no muestre un botón que va a fallar.
- **Turnos que ya empezaron:** no se pueden reservar (se compara fecha + hora,
  no solo la fecha).

## Pendientes

- [x] Transacción con bloqueo para evitar doble reserva (condición de carrera).
- [x] Panel de reservas del administrador (vista por día y cambio de estado).
- [x] Webhook de Mercado Pago para confirmar pagos.
- [x] Carga de grabaciones por parte del admin.
- [x] Ocultar el menú de admin a los clientes en el frontend.
- [x] Test de concurrencia (`npm test`).
- [x] Rate limiting en login y headers de seguridad (`helmet`).
- [x] Regla de precio nocturno (`precio_nocturno` desde las 20:00).
- [x] Regla de cancelación (24 h antes para el cliente).
- [ ] Reembolso automático en Mercado Pago al cancelar una reserva paga.
- [ ] Expirar reservas `pendiente` de pago (si el cliente no paga, el turno
  queda bloqueado hasta que se cancele a mano).
- [x] Tests de integración de la API (permisos, validaciones, concurrencia).
- [x] Despliegue (backend en Render, frontend en Vercel, base en TiDB Cloud).
- [ ] Mover las grabaciones a Cloudinary/S3 (el disco de Render free es efímero).

> **Webhook en desarrollo:** Mercado Pago necesita una URL pública para avisar
> los pagos. Configurá `MP_WEBHOOK_URL` con una URL de ngrok (por ejemplo
> `https://xxxx.ngrok-free.app/api/pagos/webhook`) y reiniciá el backend.

## Deploy

El paso a paso para publicarlo gratis (Render + TiDB Cloud + Vercel) está en
[`DEPLOY.md`](DEPLOY.md).

## Licencia

[MIT](LICENSE)
