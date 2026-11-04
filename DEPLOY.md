# Deploy gratis: Render + TiDB Cloud + Vercel

Stack elegido para que el proyecto quede online **sin pagar**:

| Pieza | Servicio | Plan |
|---|---|---|
| Backend (Express) | [Render](https://render.com) | Free web service |
| Base de datos | [TiDB Cloud Starter](https://tidbcloud.com) | Free (MySQL compatible) |
| Frontend (React/Vite) | [Vercel](https://vercel.com) | Hobby |

> **Límites del plan free (importante):**
> - Render duerme el backend después de 15 minutos sin tráfico. El primer request tarda ~1 minuto.
> - El disco de Render free es efímero: los videos subidos se pierden al reiniciar/redeployar. Para producción real hay que moverlos a Cloudinary/S3.
> - TiDB Starter tiene una cuota mensual de storage y request units. Alcanza de sobra para un portfolio.
> - Render free da 750 horas/mes. Si lo mantenés despierto 24/7 son ~730, así que entra justo.

---

## 0. Requisitos

- Cuenta de GitHub (el repo se conecta desde ahí).
- Cuenta en Render (se crea con GitHub).
- Cuenta en TiDB Cloud (GitHub o Google).
- Cuenta en Vercel (se crea con GitHub).

---

## 1. Subir el repo a GitHub

```powershell
cd C:\Users\User\Desktop\canchas-app
gh auth login          # solo la primera vez
gh repo create canchas-app --public --source=. --remote=origin --push
```

Si no usás `gh`: creá el repo vacío en GitHub y después

```powershell
git remote add origin https://github.com/<usuario>/canchas-app.git
git branch -M main
git push -u origin main
```

Verificá que `.env`, `node_modules`, `uploads` y `dist` **no** se hayan subido.

---

## 2. Base de datos en TiDB Cloud

1. Entrá a <https://tidbcloud.com> → **Create Cluster** → **Starter**.
2. Región: **AWS us-west-2 (Oregon)** (la misma que Render, para menos latencia).
3. Cuando esté lista, abrí **Connect** y copiá:
   - Host
   - Port (`4000`)
   - User
   - Password
   - (Descargá el CA si la consola lo ofrece.)
4. Guardá esos datos en `Backend/.env.production` (está gitignoreado):

```dotenv
DB_HOST=gateway01.us-west-2.prod.aws.tidbcloud.com
DB_PORT=4000
DB_USER=xxxxxxxx.root
DB_PASSWORD=xxxxxxxx
DB_NAME=canchas_db
DB_SSL=true
```

### Crear las tablas y los datos demo

Desde la raíz del repo, con el cliente MySQL de Laragon:

```powershell
$mysql = "C:\laragon\bin\mysql\mysql-8.4.3-winx64\bin\mysql.exe"
$env:MYSQL_PWD = "<PASSWORD>"

# 1) Crear la base
& $mysql --host <HOST> --port 4000 --user "<USER>" --ssl-mode=REQUIRED `
  --execute="CREATE DATABASE IF NOT EXISTS canchas_db CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;"

# 2) Schema (sin CREATE DATABASE/USE, con CHECK habilitado)
$schema = Get-Content "db\schema.sql" -Raw
$schema = $schema -replace '(?is)CREATE DATABASE.*?;\s*', '' -replace '(?is)USE canchas_db;\s*', ''
$schema = "SET tidb_enable_check_constraint = ON;`n" + $schema
$schema | & $mysql --host <HOST> --port 4000 --user "<USER>" --ssl-mode=REQUIRED --database canchas_db

# 3) Datos demo
$seed = Get-Content "db\seed.sql" -Raw
$seed = $seed -replace '(?is)USE canchas_db;\s*', ''
$seed | & $mysql --host <HOST> --port 4000 --user "<USER>" --ssl-mode=REQUIRED --database canchas_db
```

Comprobación rápida:

```powershell
& $mysql --host <HOST> --port 4000 --user "<USER>" --ssl-mode=REQUIRED --database canchas_db `
  --execute="SELECT COUNT(*) AS usuarios FROM usuarios; SELECT COUNT(*) AS canchas FROM canchas;"
```

> Si `SET tidb_enable_check_constraint` falla, quitá esa línea y volvé a correr el schema. Las validaciones de la app siguen funcionando; los `CHECK` son una red de seguridad extra.

---

## 3. Backend en Render

1. Entrá a <https://dashboard.render.com> → **New +** → **Blueprint**.
2. Conectá GitHub y elegí el repo `canchas-app`.
3. Render lee `render.yaml` y crea el servicio `canchas-api` (plan free, root `Backend`).
4. Completá los secretos que pide:
   - `DB_HOST`, `DB_USER`, `DB_PASSWORD`: los de TiDB.
   - `FRONTEND_URL`: por ahora `http://localhost:5173` (lo cambiamos en el paso 5).
5. **Apply** y esperá el deploy.
6. Probá:

```powershell
curl.exe https://canchas-api.onrender.com/api/health
# {"ok":true}
```

Si falla la conexión a la base, revisá los logs de Render. Si el error es de certificado TLS, agregá en Render:

- `DB_SSL_CA` = ruta al CA dentro del repo (por ejemplo `./certs/tidb-ca.pem`), o
- descargá el CA de TiDB, guardalo en `Backend/certs/tidb-ca.pem` y subilo.

---

## 4. Frontend en Vercel

1. <https://vercel.com/new> → importá el repo `canchas-app`.
2. Configuración:
   - **Root Directory**: `Frontend`
   - **Framework Preset**: Vite
   - **Environment Variable**: `VITE_API_URL=https://canchas-api.onrender.com`
3. **Deploy**.
4. Anotá la URL de producción (ej. `https://canchas-app.vercel.app`).

---

## 5. Conectar frontend y backend (CORS)

1. En Render → servicio `canchas-api` → **Environment**.
2. Editá `FRONTEND_URL` y poné la URL de Vercel (sin barra final).
3. Guardá y redeployá.
4. Entrá a la URL de Vercel y probá login/registro/reserva.

---

## 6. Cambiar la contraseña del admin demo

El seed crea `admin@canchas.com / Admin1234`. **No lo dejes así en un sitio público.**

Desde `Backend/`, con `Backend/.env.production` apuntando a TiDB:

```powershell
$env:DOTENV_CONFIG_PATH = ".env.production"
$env:ADMIN_EMAIL = "tu-email@ejemplo.com"
$env:ADMIN_PASSWORD = "UnaClaveLargaYUnica123"
npm run crear-admin
```

El script crea el admin si no existe o actualiza la contraseña si ya existe.
Después podés borrar el usuario demo `admin@canchas.com` desde el panel o con SQL.

---

## 7. Mantener Render despierto (opcional pero recomendado)

Render free duerme a los 15 minutos. Para que un visitante no espere ~1 minuto:

1. Creá una cuenta gratis en <https://cron-job.org>.
2. Creá un cron job cada 10 minutos apuntando a:
   `https://canchas-api.onrender.com/api/health`
3. Listo. Consume ~730 de las 750 horas free mensuales.

---

## 8. Mercado Pago (cuando tengas el token)

1. Rotá el token en el panel de Mercado Pago (el anterior estuvo expuesto).
2. En Render → Environment agregá:
   - `MP_ACCESS_TOKEN=APP_USR-...`
   - `MP_WEBHOOK_URL=https://canchas-api.onrender.com/api/pagos/webhook`
3. Redeploy.
4. En Mercado Pago, configurá la URL de notificación si la consola lo pide.

---

## Checklist final

- [ ] `https://canchas-api.onrender.com/api/health` devuelve `{"ok":true}`.
- [ ] El frontend carga canchas y franjas.
- [ ] Login de cliente y admin funciona.
- [ ] Se puede reservar y el turno queda ocupado.
- [ ] El admin ve el panel y puede cancelar.
- [ ] `FRONTEND_URL` en Render es exactamente la URL de Vercel.
- [ ] La contraseña del admin demo fue cambiada.
- [ ] (Opcional) cron-job.org mantiene el backend despierto.
