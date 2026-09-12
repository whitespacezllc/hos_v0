# Reservas, packs, pagos y correos — cómo funciona y qué hay que configurar

Este es el camino por el que entra el dinero. Todo lo que hace lo hace en
**hora de Costa Rica** (Santa Teresa, UTC−6, sin horario de verano): las
clases se guardan como instantes en Postgres y se muestran, reservan y
envían por correo en hora local del estudio, sin importar dónde esté el
visitante, la administradora o el servidor (`lib/costa-rica-time.ts`).

## El flujo, de punta a punta

**Clase suelta (drop-in).** `/yoga` → `/booking/[classId]` (4 pasos) →
`startBookingCheckout` (`app/actions/checkout.ts`):

| Cómo paga | Qué pasa | Correo al cliente |
| --- | --- | --- |
| Tarjeta | Reserva `pending`, cupo tomado, redirección a la página de pago de Tilopay. Al volver, el callback **verifica el pago contra la API de Tilopay** y confirma. | "Confirmed" con adjunto de calendario |
| Efectivo / Venmo | Reserva `pending`, cupo tomado. La administradora la marca como cobrada en `/admin/reservas`. | "Reserved" con instrucciones de pago (monto, cuenta de Venmo, referencia) y luego "Payment received" |
| Código de pack | La clase sale $0; el crédito se descuenta **al crear la reserva** (y vuelve si la reserva muere: rechazada, abandonada, cancelada). Los extras se cobran aparte (tarjeta/efectivo/Venmo). | "Confirmed" (o "Reserved" si hay extras por cobrar) |
| Código de referido | Descuento por porcentaje, fijo o extra gratis; se consume al confirmar el pago. | según el método |

**Pack de clases.** Desde `/paquetes` (solo tarjeta) o desde el paso 4 de
una reserva (tarjeta, efectivo o Venmo, junto con esa clase). Al confirmarse
el pago se genera el código `PACK-XXXXXX`, se gasta el primer crédito en la
clase reservada (si la hubo) y se envía el correo con el código y las clases
que quedan. El cliente lo escribe en el campo "Referral / packs code" al
reservar; `redeem_pack_code` descuenta un crédito por reserva.

**Recibos.** Tarjeta: `/booking/confirmacion?order=<id>` (clase) o
`/paquetes/resultado?order=<id>` (pack, muestra el código); el id es el uuid
de la orden, que nadie puede adivinar. Efectivo, Venmo y gratis: la pantalla
final del propio flujo.

**Cancelación desde el admin.** Libera el cupo, cancela un pack pendiente
comprado con esa clase, devuelve el crédito si la clase se había pagado con
un pack y avisa al cliente por correo.

**Limpieza.** Un pago con tarjeta que nunca volvió de Tilopay retiene el cupo
45 minutos; después el sistema le pregunta a Tilopay si se pagó (lo confirma
si sí) y si no, lo libera. Corre después de responder `/yoga`, como mucho
cada 5 minutos y de a 10 órdenes. Si el cliente paga tarde, cuando su orden
ya fue liberada, el retorno igual la verifica y la revive con su cupo.

## Verificación de pagos (Tilopay)

El retorno de Tilopay es un GET que hace el navegador del cliente, y
cualquiera puede escribirlo. Por eso **nada se confirma sin preguntarle a
Tilopay**: `POST /api/v1/consult` con el `orderNumber` (el id de la reserva o
del pack) tiene que responder aprobado y por el monto cobrado
(`lib/checkout/verify.ts`). Según lo que responda:

- aprobado por el monto → se confirma (aunque la orden se hubiera liberado
  entre tanto: el cliente pagó);
- rechazado → se libera, como un retorno rechazado;
- Tilopay no conoce la orden (un retorno inventado, o uno que llegó antes de
  que Tilopay lo indexe) → no cambia nada; el barrido vuelve a preguntar más
  tarde y confirma o libera;
- aprobado por otro monto, o Tilopay no responde y el `OrderHash` (fórmula no
  publicada) tampoco cierra → la orden queda **retenida con la transacción
  anotada** y el estudio recibe un aviso (una sola vez por orden): se
  confirma a mano con "Confirm payment" en `/admin/reservas` (o en
  `/admin/paquetes`) después de mirar el panel de Tilopay, o se cancela.

Un retorno "rechazado" solo libera órdenes que siguen pendientes: un reenvío
no deshace un pago real.

`TILOPAY_TRUST_CALLBACK=true` apaga toda verificación. Solo para una
emergencia.

Tilopay también ofrece un **webhook** para `processPayment` (aviso servidor a
servidor, 1 intento); hay que pedir el contrato a sac@tilopay.com. Con eso el
callback dejaría de depender del navegador del cliente.

## Variables de entorno (Vercel · Production)

| Variable | Para qué | Estado |
| --- | --- | --- |
| `RESEND_API_KEY` | Enviar correos | ya cargada |
| `EMAIL_FROM` | Remitente. **Tiene que ser una dirección de un dominio verificado en Resend**, p. ej. `House of Shakti <hello@houseofshakticr.com>`. Con el valor por defecto (`onboarding@resend.dev`) Resend solo entrega a la casilla dueña de la cuenta: los clientes no reciben nada. | **pendiente** |
| `BOOKING_NOTIFY_EMAIL` | Opcional. Casilla(s) del estudio que reciben aviso de cada reserva y de cada pago en efectivo/Venmo por cobrar. Varias, separadas por coma. Lo natural es `yogastudio@houseofshakticr.com`. | opcional |
| `NEXT_PUBLIC_SITE_URL` | `https://houseofshakticr.com`. Base del retorno de Tilopay y de los enlaces de los correos. Sin ella, producción cae a ese mismo dominio (`lib/site-url.ts`), pero conviene fijarla. | verificar |
| `TILOPAY_API_USER`, `TILOPAY_API_PASSWORD`, `TILOPAY_API_KEY` | Pago con tarjeta y verificación (`consult`) | verificar |
| `TILOPAY_TRUST_CALLBACK` | Dejar sin definir (o `false`) | — |
| `NEXT_PUBLIC_VENMO_HANDLE` | Cuenta de Venmo que se muestra al cliente (`@Nancy-Goodfellow` por defecto) | verificar |

### Verificar el dominio en Resend

1. Resend → Domains → Add domain → `houseofshakticr.com` (desde el
   2026-09-12 las casillas viven en ese mismo dominio).
2. Cargar en el DNS los registros que Resend indica (DKIM `resend._domainkey`,
   SPF/Return-Path `send`, y opcionalmente DMARC).
3. Cuando el dominio figure como *Verified*, poner `EMAIL_FROM` en Vercel y
   redeployar.
4. Las respuestas de los clientes van a `yogastudio@houseofshakticr.com` en
   los correos de clases y packs, y a `hello@houseofshakticr.com` en el resto
   (`Reply-To`, desde `lib/business.ts`).

## Base de datos

Migración **009** (`supabase/migrations/009_booking_locale.sql`), a correr en
el SQL Editor de Supabase antes del deploy o inmediatamente después:

- columna `locale` en `bookings` y `pack_purchases` (idioma del cliente, para
  los correos que manda la administradora después);
- referencias `HOS-AAAAMMDD-XXXX` con la fecha de Costa Rica;
- políticas de inserción pública restringidas a órdenes pendientes;
- `redeem_pack_code`, `decrement_spots` e `increment_spots` solo ejecutables
  por el servidor.

Si el deploy sale antes que la migración, nada se rompe: las inserciones
reintentan sin `locale` y los correos posteriores salen en inglés.

## Probar en local

`TILOPAY_API_BASE` y `RESEND_BASE_URL` apuntan los clientes a un servidor
de mentira; la sesión del 2026-09-10 dejó uno (Tilopay + Resend en un solo
proceso) con el que se recorrió todo el flujo contra un Supabase local.
