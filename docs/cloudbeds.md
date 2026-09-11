# Motor de reservas de Cloudbeds — Immersive Experience 2.0 (estándar)

Las habitaciones se venden con Cloudbeds. El motor está embebido en el sitio con la **Immersive Experience 2.0 en modo estándar**: un script de Cloudbeds y un web component (`<cb-immersive-experience>`) que dibuja todo el flujo —fechas, habitaciones, extras, datos del huésped, pago— dentro de nuestra propia página, sin iframe. Es la única forma que Cloudbeds soporta desde Booking Engine Plus; el loader por iframe (`us2.cloudbeds.com/widget/load/<código>/immersive`) que usaba el sitio antes fue retirado con el motor legacy en el primer trimestre de 2026.

Código de propiedad: `zE6Wy8`. Es público (es el final de la URL del motor alojado, `https://hotels.cloudbeds.com/reservation/zE6Wy8`), no una credencial.

Documentación oficial: <https://myfrontdesk.cloudbeds.com/hc/en-us/articles/32048321731739>

## Dónde vive

| Qué | Dónde |
|---|---|
| La página | `/book` y `/es/book` — `app/[locale]/book/` |
| El componente y la carga del script | `components/booking-engine/CloudbedsImmersive.tsx` |
| Código de propiedad, URLs y helpers | `lib/cloudbeds.ts` |
| Tipos del web component para JSX | `global.d.ts` |
| Los CTAs | "Reservar" en el navbar, la barra de fechas del hero del home y "Ver disponibilidad" en `/stay-with-us` — todos son links a `/book` |

El script (1,3 MB) se carga **solo** en `/book`, no en el `<head>` global: ninguna otra página lo necesita y todas las demás solo enlazan ahí. El elemento ya está en el HTML cuando el script llega y se "upgradea" solo.

## Lo que hay que configurar en Cloudbeds (una sola vez, desde el panel)

1. **Settings → Booking Engine → Embeds → Premium → Immersive Experience 2.0** (opción *Standard*).
2. En **Whitelisted domains** agregar los dominios desde los que se sirve el sitio (máximo 5). El componente llama a la API de Cloudbeds desde nuestro origen y un origen que no está en la lista es rechazado:
   - `houseofshakticr.com`
   - `www.houseofshakticr.com`
   - el dominio de preview de Vercel (por ejemplo `hos-v0.vercel.app`), si se quiere probar ahí
   - `localhost`, si se quiere desarrollar contra el motor real
3. **Premium Embeds** tiene que estar incluido en la suscripción. Si en esa sección aparece *Contact sales*, no lo está y el embed no va a funcionar hasta que se contrate.

Nada de esto vive en el código: cambia el dominio → hay que actualizar la lista en Cloudbeds.

**Estado al 2026-09-10 (verificado con `curl` contra la API de Cloudbeds):** `houseofshakticr.com` ya está en la lista; `www.houseofshakticr.com` y `localhost` no. Y el sitio en producción redirige `houseofshakticr.com` → `www.houseofshakticr.com` (308, configurado en Vercel), así que el navegador siempre está en `www` y el motor queda bloqueado por CORS hasta que se agregue `www.houseofshakticr.com`. Cómo comprobarlo desde la terminal (si la respuesta trae `access-control-allow-origin`, el dominio está autorizado):

```bash
curl -sI -H "Origin: https://www.houseofshakticr.com" "https://api.cloudbeds.com/mapping/v1.0/mfd/property?hash=zE6Wy8" | grep -i access-control-allow-origin
```

## Pre-llenar la búsqueda

El componente lee el query string de la página **al montarse** (una sola vez) y acepta los mismos parámetros que el motor alojado: `checkin`, `checkout` (formato `YYYY-MM-DD`), `adults`, `kids`, `promo`, `currency`, `rate_plan`, `room_type`, `rid`, `utm_source`…

```
/book?checkin=2026-12-01&checkout=2026-12-05
/es/book?checkin=2026-12-01&checkout=2026-12-05&adults=2
```

La barra del hero arma exactamente eso con `bookHref()` de `lib/cloudbeds.ts`. Cambiar la URL con el motor ya cargado no lo actualiza: hay que recargar.

## Idioma y moneda

- `lang` se pasa con el locale de la página (`en` / `es`); si faltara, el motor lee `<html lang>`.
- Moneda: la predeterminada de la propiedad. Para fijarla, `currency="usd"` en el componente.
- Se ocultan el header y el footer personalizados del panel de Cloudbeds (`hide-custom-header` / `hide-custom-footer`): están pensados para la página alojada y acá el sitio ya pone su navbar y su footer.

## Si no carga

- **Consola con 403 / CORS en llamadas a `*.cloudbeds.com`** → el dominio no está en Whitelisted domains (o Premium Embeds no está en el plan).
- **El script no llega** (bloqueado por red o extensión) → la página muestra un aviso con el link al motor alojado, con la misma búsqueda.
- El link al motor alojado está siempre al pie de `/book`, discreto, como segunda puerta.

## Lo que no hay que hacer

- No poner el componente dentro de un iframe (Cloudbeds lo desaconseja: rompe el scroll y obliga a whitelistear toda la cadena).
- No volver al loader `widget/load/…/immersive` ni a `openImmersiveExperiencePopup`: el primero es el popup por iframe del motor legacy; el segundo es el modo *overlay* de la 2.0, que no es el que usa el sitio.
- El CSS/JS personalizado que se escribe en el panel de Cloudbeds **no** aplica al embed. Si hace falta, va en el sitio, en un `<style data-cb-immersive-experience-root>` acotado a `.cb-bookingengine-root`.
- Los elementos flotantes del motor (modales, calendario, barra del carrito en móvil) se montan en portales al final del `<body>` con `z-index` 1100 (sticky), 1400 (modal), 1500 (popover) y 1800 (tooltip). El navbar del sitio está en `z-50`, por debajo, como corresponde. Por eso el botón flotante de WhatsApp no se muestra en `/book`: compartiría la esquina con la barra del carrito.
