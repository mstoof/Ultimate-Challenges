# Ultimate Challenges

Gedeelde agenda voor sportuitdagingen. Iedereen kan een event posten, de rest
meldt zich aan als deelnemer of als support crew.

## Opzetten

```bash
npm install
cp .env.example .env.local     # DATABASE_URL, AUTH_SECRET, RESEND_API_KEY
npx drizzle-kit push           # schema naar Neon
npm run dev
```

Nodig in `.env.local`:

| Variabele              | Waarvoor                                        |
| ---------------------- | ----------------------------------------------- |
| `DATABASE_URL`         | Neon connectiestring                            |
| `AUTH_SECRET`          | `openssl rand -base64 32`                       |
| `RESEND_API_KEY`       | magic links versturen                           |
| `NEXT_PUBLIC_SITE_URL` | volledige URL, gebruikt in ICS en OG-kaartjes   |
| `EMAIL_FROM`           | afzender, moet op een geverifieerd Resend-domein |
| `ALLOWED_EMAILS`       | komma-gescheiden lijst van wie mag inloggen      |

## Inloggen

Magic links via Resend. Iemand vult zijn mailadres in, krijgt een link die 15
minuten en één keer werkt, en heeft daarna 90 dagen een sessie.

`ALLOWED_EMAILS` is de deurbeleid: staat een adres er niet op, dan wordt de
inlog geweigerd. Laat je de variabele leeg, dan kan iedereen die de URL kent een
account maken — voor deze groep wil je dat niet.

Verifieer eerst je domein bij Resend, anders belandt de mail in spam of wordt
hij helemaal geweigerd. Zonder eigen domein kun je tijdens het bouwen
`onboarding@resend.dev` gebruiken, maar dat verstuurt alleen naar je eigen adres.

Publiek blijven `/e/[slug]` en de ICS-routes. Dat is met opzet: een event-link
in WhatsApp moet openen zonder inlog, anders ziet niemand een preview. Pas bij
het aanmelden wordt om een sessie gevraagd.

## Naar Vercel

Repo koppelen aan Vercel, dezelfde variabelen in de projectinstellingen zetten.
Elke pull request krijgt een preview-deploy, merge naar `main` gaat live.
Zet in Vercel de Neon-integratie aan: die maakt per preview een database-branch,
zodat je nooit met echte aanmeldingen test.

De GitHub Action doet lint, types, `drizzle-kit check` en een build. Die is
bewust een poort op PR's en geen deploy-stap — deployen doet Vercel zelf.

## Agenda-integratie

Drie routes, want geen enkele werkt overal.

**1. Abonneren op de hele agenda (`/api/calendar.ics`)**

Op Android kan dit *niet* vanuit de Google Agenda-app. Het moet één keer via de
browser:

1. Ga naar `calendar.google.com` (desktop, of mobiel op "desktopsite")
2. Links onderaan: **Andere agenda's → +  → Via URL**
3. Plak de https-URL van de feed, niet `webcal://`
4. Toevoegen — daarna verschijnt hij vanzelf in de Android-app

Let op: Google ververst zo'n externe feed op zijn eigen tempo, vaak pas na
8 tot 24 uur en soms langer. Voor een event over drie weken prima, voor een
tijdswijziging van morgen niet. Daarom bestaat route 2.

**2. Losse event-knop (Google Agenda)**

De knop "Zet in Google Agenda" gebruikt de `render?action=TEMPLATE` URL. Op
Android opent die direct de Google Agenda-app met alles ingevuld. Instant, geen
sync. Dit is voor de meeste mensen de knop die ze daadwerkelijk gebruiken.

**3. Losse .ics download (`/api/event/[slug]/ics`)**

Voor Samsung Agenda, Outlook en Apple Agenda. Wordt als `attachment` geserveerd
zodat Android hem aan de agenda-app aanbiedt in plaats van als tekst te tonen.

## Delen in WhatsApp

Er is geen officiële manier om automatisch in een WhatsApp-groep of -kanaal te
posten. De aanpak hier: je plakt `/e/[slug]` in de groep en `opengraph-image.tsx`
rendert live een kaartje met sport, datum, locatie en het aantal aanmeldingen.
WhatsApp haalt die afbeelding op bij het plakken, dus de stand klopt.

Werkt het kaartje niet? WhatsApp cachet previews per URL vrij agressief. Test
met een verse slug of via de Facebook Sharing Debugger.

## Structuur

```
db/schema.ts                       users, events, rsvps
lib/calendar.ts                    ICS-generatie + Google deeplink
app/e/[id]/page.tsx                event-pagina met aanmeldknoppen
app/e/[id]/opengraph-image.tsx     het WhatsApp-kaartje
app/api/calendar.ics/route.ts      de feed
app/api/event/[id]/ics/route.ts    losse download
```
