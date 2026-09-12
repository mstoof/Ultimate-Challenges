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

## Trainingsplan exporteren naar Notion

Iedere vriend verbindt zijn eigen Notion-workspace vanuit **Mijn plan → Notion export**.
Daarna kiest diegene een gedeelde pagina en klikt op **Exporteer naar Notion**.
De app maakt daar één trainingstabel met datum, sport, duur, instructies, oefeningen,
weeknotities en een checkbox per sessie. De eerste export neemt afgevinkte trainingen
uit de app mee. Bij volgende exports blijven de Notion-checkboxes en eigen pagina-inhoud
behouden. Dit is een export: wijzigingen in Notion gaan niet terug naar de app.

### Eenmalig instellen

1. Maak in het [Notion Developer portal](https://www.notion.so/profile/integrations)
   een **public connection** met OAuth aan, zodat leden hun eigen workspace kunnen
   verbinden. Dit is het type verbinding, niet de zichtbaarheid van jullie plannen.
   Kies waar beschikbaar **Selected workspaces only** voor jullie workspaces, of
   **Any workspace** wanneer leden verschillende workspaces gebruiken. De app-login
   blijft beperkt via `ALLOWED_EMAILS`.
2. Geef de verbinding **Read content**, **Insert content** en **Update content**.
   Toegang tot gebruikers-e-mailadressen of reacties is niet nodig.
3. Registreer de exacte redirect-URL `https://<jouw-app-domein>/api/notion/callback`.
   Vul dezelfde URL in als `NOTION_REDIRECT_URI`. Gebruik voor lokaal testen een
   apart geregistreerde callback `http://localhost:3000/api/notion/callback`.
4. Zet `NOTION_CLIENT_ID`, `NOTION_CLIENT_SECRET`, `NOTION_REDIRECT_URI` en
   `NOTION_TOKEN_ENCRYPTION_KEY` in `.env.local` en/of de Vercel environment settings.
   Genereer de encryptiesleutel eenmaal met `openssl rand -base64 32`.
   Bewaar hem: wijzigen maakt opgeslagen tokens onleesbaar en vereist opnieuw verbinden.
   Gebruik voor previews aparte credentials/callbacks en een aparte database.
5. Pas de nieuwe database-migratie toe vóór je de credentials activeert.
   De gegenereerde migratie is `drizzle/0007_absent_la_nuit.sql`; volg de bestaande
   databaseprocedure (`npm run db:push` met de juiste `DATABASE_URL`, of de SQL-migratie
   via je migratietool). `drizzle-kit` leest niet automatisch `.env.local`:
   zorg dat `DATABASE_URL` in de omgeving beschikbaar is. Voer niet blind alle historische
   SQL-bestanden opnieuw uit op een database die al via `push` is bijgewerkt.
6. Deploy opnieuw. Laat elk lid via **Verbind Notion** een bestemming delen,
   vervolgens **Laad / vernieuw Notion-pagina’s** en de bestemming selecteren.

Zonder de vier Notion-variabelen blijft de rest van de app werken en toont het
exportpaneel dat de verbinding nog moet worden ingesteld. Er is geen databasewijziging
op afstand of Notion-accountregistratie onderdeel van de lokale build.

### Bijwerken en hervatten

**Werk plan bij in Notion** werkt dezelfde sessierijen bij. Verwijder of hernoem de
beheerde kolommen niet; eigen kolommen en notities kunnen wel. Vervallen sessies worden
niet verwijderd: hun **Actueel**-checkbox gaat uit. Filter daarop in Notion om alleen
het huidige plan te zien. Verwijder de kolom **Sessie-ID** niet: die helpt om een
onderbroken export zonder dubbele rijen te hervatten.

De export werkt in kleine requests met een opgeslagen voortgang en een lock per lid.
Houd de tab open tot de export klaar is. Na sluiten, een netwerkfout of een rate limit
kun je opnieuw klikken om verder te gaan. Een lopende export gebruikt een momentopname;
exporteer daarna opnieuw als je het plan tussentijds hebt aangepast. Een tijdelijk
achtergebleven lock verloopt na twee minuten.

**Notion loskoppelen** trekt het token in en verwijdert de opgeslagen tokens. De tabel
blijft in Notion staan. Opnieuw verbinden met dezelfde workspace hergebruikt de tabel.
Verbinden met een andere workspace begint daar met een nieuwe bestemming.

### Verifiëren

`npm test` controleert onder andere OAuth-state, versleuteling per lid, datums,
exportvelden en het bijwerken/herstellen van bestaande Notion-rijen met gemockte API's.
Test met een echte verbinding ook: toestemming weigeren, een lege bestemmingspagina
selecteren, een blok exporteren, in Notion een checkbox aanvinken, opnieuw exporteren,
een export onderbreken/hervatten en loskoppelen. Deze live controles vereisen jouw
Notion-credentials; de build heeft die niet nodig.

API-documentatie: [OAuth](https://developers.notion.com/guides/get-started/authorization),
[databases](https://developers.notion.com/reference/create-a-database),
[limieten](https://developers.notion.com/reference/request-limits).
De client gebruikt expliciet API-versie `2025-09-03` (databases en data sources).
