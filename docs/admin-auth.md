# Acceso al panel de administración

Cómo entra un admin, cómo se crean las cuentas y qué hay que configurar en Supabase. Todo lo que decide quién es admin vive en `lib/auth/roles.ts`: el rol se lee de `app_metadata.role`, que **solo el service key puede escribir** (el panel, la página de contraseña o un usuario logueado no pueden otorgárselo a nadie, ni a sí mismos).

## Las páginas

| Ruta | Qué hace |
|---|---|
| `/login` | Email y contraseña. Solo entra una cuenta con rol `admin`; cualquier otra se desloguea con un aviso. Respeta `?redirect=/admin/...` (el proxy lo agrega al mandar al login), nunca a otro sitio. |
| `/forgot-password` | Pide un mail y Supabase envía el link de recuperación. La respuesta en pantalla es la misma exista o no la cuenta. |
| `/set-password` | Donde aterrizan los links de invitación y de recuperación. Canjea el token, la persona elige la contraseña y entra a su puerta (`/admin` o `/instructor`). Un link vencido muestra un aviso y un botón para pedir otro. |
| Sidebar del panel | Muestra el mail del admin logueado y el botón de salir (server action: borra la sesión y manda a `/login`). |

## Crear o resetear cuentas de admin

Con el service key en el entorno (nunca en git):

```bash
 ADMIN_PASSWORD='la contraseña' node --env-file=.env.local scripts/create-admins.mjs nancyshantishanti@gmail.com houseofshaktiyoga@gmail.com
```

- Crea cada cuenta ya confirmada, con esa contraseña y `app_metadata.role = 'admin'`. Si la cuenta existe, le resetea la contraseña y le asegura el rol.
- El espacio inicial evita que el comando quede en el historial de zsh. La contraseña se lee del entorno; nada la escribe en disco.
- `.env.local` necesita `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` (Supabase → Project Settings → API).

Alternativa por invitación (la persona elige su contraseña desde un link): `node --env-file=.env.local scripts/invite-admins.mjs mail@...` imprime el link listo para compartir; también deja el rol en `app_metadata`.

Alternativa sin script: Supabase → Authentication → Users → *Add user* (marcar *Auto Confirm User*) y luego, en el SQL Editor:

```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
where email = 'mail@ejemplo.com';
```

## Configuración en Supabase (una sola vez)

1. **SQL Editor** → correr `supabase/migrations/008_roles_in_app_metadata.sql` (mueve los roles existentes a `app_metadata` y redefine `is_admin()` / `is_instructor()`). Idempotente.
2. **Authentication → URL Configuration**
   - Site URL: `https://houseofshakticr.com`
   - Redirect URLs: `https://houseofshakticr.com/set-password` (y `http://localhost:3300/set-password` para desarrollo).
3. **Authentication → Email Templates**
   - *Reset Password*: pegar el cuerpo de `supabase/templates/recovery.html`. Asunto sugerido: "Choose a new password for the House of Shakti panel".
   - *Invite user*: pegar `supabase/templates/invite.html`. Asunto: "You've been invited to the House of Shakti panel".
   - Los links llevan `{{ .TokenHash }}` y aterrizan en `/set-password`, así el mail se puede abrir en cualquier dispositivo (los links por defecto de Supabase solo funcionan en el navegador que los pidió).
4. **Authentication → SMTP Settings** → *Enable Custom SMTP*. El remitente por defecto de Supabase solo entrega a los miembros del proyecto y con un límite de pocos mails por hora; para que "Forgot your password?" llegue a los admins hace falta un SMTP propio. Con Resend (ya usado para los códigos de packs): host `smtp.resend.com`, puerto `465`, usuario `resend`, contraseña = la API key, remitente en un dominio verificado en Resend.
5. **Authentication → Providers → Email**: *Minimum password length* 10; opcional, exigir letras y números. *Allow new users to sign up* puede quedar apagado: el sitio no registra usuarios por su cuenta (las cuentas las crean los scripts o el panel).
6. **Authentication → Auth settings**: *Email OTP Expiration* en 3600 (una hora), que es lo que prometen los mails.

## Si algo falla

- "Incorrect email or password" con la contraseña correcta → la cuenta no existe o no está confirmada; correr `create-admins.mjs` la deja lista.
- "This account doesn't have access to the admin panel" → la cuenta existe pero no tiene `app_metadata.role = 'admin'`; el script o el SQL de arriba lo arreglan.
- El mail de recuperación no llega → revisar el SMTP (punto 4) y los *Auth Logs* de Supabase.
- Link "expired or already used" → pedir otro desde `/forgot-password`. Cada link sirve una vez y dura una hora.
