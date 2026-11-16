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

**Estado al 2026-11-16 (verificado con `curl` contra la API de Cloudbeds):** `houseofshakticr.com` y `www.houseofshakticr.com` están en la lista; `localhost` no. Los dos hosts sirven el sitio (200, sin redirigir uno al otro) y en los dos el motor carga. Cómo comprobarlo desde la terminal (si la respuesta trae `access-control-allow-origin`, el dominio está autorizado). Tiene que ser un GET: a un `curl -I` (HEAD) Cloudbeds ya no le contesta el encabezado CORS aunque el dominio esté autorizado, y parece que no lo está:

```bash
curl -s -D - -o /dev/null -H "Origin: https://www.houseofshakticr.com" "https://api.cloudbeds.com/mapping/v1.0/mfd/property?hash=zE6Wy8" | grep -i access-control-allow-origin
```

## Medición: la conversión de reservas en Google Ads

El sitio carga Google Tag Manager (`GTM-5VWZBWCM`, solo en producción) desde `components/seo/GoogleTagManager.tsx`. Ahí viven el GA4 (`G-L8LPX1HHQH`) y el tag de Google Ads (`AW-18552728484`) que maneja quien lleva la publicidad. **La reserva no la mide GTM: la dispara Cloudbeds**, desde el motor embebido, con `window.gtag(...)` sobre el `dataLayer` de nuestra página:

| Evento | Cuándo | Llega a |
|---|---|---|
| `cb_booking_engine_load` | al cargar el motor | GA4 y Ads, vía los tags de GTM |
| `add_to_cart`, `begin_checkout`… | durante el flujo | ídem |
| `purchase` | al crearse la reserva, si la propiedad tiene `amplify_allow_ga4_purchase_event` | ídem |
| `conversion` (con `send_to: '<id>/<etiqueta>'`, `value`, `transaction_id`) | al crearse la reserva, **solo si se cumplen las cuatro condiciones de abajo** | la acción de conversión de Google Ads |

Las cuatro condiciones del evento `conversion`, sacadas del propio bundle de Cloudbeds (`index13.chunk.js`, noviembre de 2026):

1. `amplify_allow_ga4_purchase_event` en `true` para la propiedad. Lo está.
2. El flag `feature.booking-engine.trigger-ga-conversion-event` prendido en el LaunchDarkly de Cloudbeds para `property:152169755963593`. Lo está.
3. **ID y etiqueta de conversión cargados en Cloudbeds** → Settings → Booking Engine → Analytics → conexión GA4: ID `AW-18552728484` (con el `AW-`) y etiqueta `tpnlCOS60LUdEKTX0I5F`.
4. **Que el `dataLayer` de la página tenga un `gtag('config', '<el mismo ID>')`.** El tag de Ads dentro de GTM no deja esa entrada, así que la pone `GoogleTagManager.tsx` (con `send_page_view: false`, para no contar dos veces la visita). El ID tiene que coincidir carácter por carácter con el que está en Cloudbeds.

Si falta una sola, la reserva se crea igual pero la conversión no sale y no hay ningún error en consola.

El ID de medición de GA4 y el dominio que se cargan en esa misma pantalla **no los usa el motor embebido** (solo carga el GA4 interno de Cloudbeds, en su propio `beDataLayer`); sirven para el motor alojado en `hotels.cloudbeds.com`, que aparece solo si nuestro script no llega. Cargarlos no duplica nada en el sitio. Cloudbeds deja elegir conexión GA4 **o** GTM, no las dos: tiene que ser GA4.

**Cómo ver qué está cargado sin entrar al panel:** la configuración pública que recibe el motor (`POST https://us2.cloudbeds.com/booking/property_info`) trae esos campos. Desde la terminal Cloudbeds le devuelve 403 a `curl`; desde el navegador sí contesta. En `houseofshakticr.com/book`, consola de DevTools:

```js
const r = await fetch('https://us2.cloudbeds.com/booking/property_info', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'property_code=zE6Wy8&lang=en&booking_engine_source=immersive-experience&iframe=false' });
const d = (await r.json()).data;
['google_conversion_id', 'google_conversion_label', 'ga_client_id', 'ga_primary_domain', 'amplify_allow_ga4_purchase_event'].map((k) => `${k} = ${JSON.stringify(d[k])}`).join('\n');
```

(O en la pestaña Network, el pedido `property_info` → Response.) Al 2026-11-16, antes de la carga, los cuatro primeros estaban vacíos (`null` o `""`).

**Para probarla de punta a punta** hace falta una reserva real en `/book`: con Tag Assistant (tagassistant.google.com) conectado a la página se ve salir el `conversion` al confirmar. Esa reserva cuenta como una conversión real en Google Ads, con su valor; después se cancela en Cloudbeds.

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
- **El script no llega** (bloqueado por red o extensión) → en lugar del motor, la página muestra un aviso con el link al motor alojado, con la misma búsqueda. Es el único lugar donde aparece ese link: con el motor cargado no hay una segunda puerta a Cloudbeds.

## Lo que no hay que hacer

- No poner el componente dentro de un iframe (Cloudbeds lo desaconseja: rompe el scroll y obliga a whitelistear toda la cadena).
- No volver al loader `widget/load/…/immersive` ni a `openImmersiveExperiencePopup`: el primero es el popup por iframe del motor legacy; el segundo es el modo *overlay* de la 2.0, que no es el que usa el sitio.
- El CSS/JS personalizado que se escribe en el panel de Cloudbeds **no** aplica al embed. Si hace falta, va en el sitio, en un `<style data-cb-immersive-experience-root>` acotado a `.cb-bookingengine-root`.
- Los elementos flotantes del motor (modales, calendario, barra del carrito en móvil) se montan en portales al final del `<body>` con `z-index` 1100 (sticky), 1400 (modal), 1500 (popover) y 1800 (tooltip). El navbar del sitio está en `z-50`, por debajo, como corresponde. Por eso el botón flotante de WhatsApp no se muestra en `/book`: compartiría la esquina con la barra del carrito.
