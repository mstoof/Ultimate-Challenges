<div align="center">

<img src="./public/uc-logo.svg" alt="Ultimate Challenges logo" width="112" height="112" />

# Ultimate Challenges

### Plan. Train. Travel. Challenge together.

Een self-hosted platform voor vriendengroepen en sportteams die samen races, outdoorreizen en sportuitdagingen organiseren.

[![CI](https://github.com/mstoof/Ultimate-Challenges/actions/workflows/ci.yml/badge.svg)](https://github.com/mstoof/Ultimate-Challenges/actions/workflows/ci.yml)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=nextdotjs)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-4169E1?logo=postgresql&logoColor=white)](https://neon.tech/)
[![License](https://img.shields.io/badge/license-PolyForm%20Noncommercial-orange)](LICENSE)

[Functionaliteit](#functionaliteit) · [Snel starten](#snel-starten) · [Deployen](#deployen-op-vercel) · [Configuratie](#configuratie) · [Architectuur](#architectuur) · [Bijdragen](#bijdragen) · [Licentie](#licentie)

</div>

---

## Over het project

Ultimate Challenges brengt de volledige voorbereiding op een sportevent samen in één mobiele webapp: van uitnodiging en deelname tot training, vervoer, verblijf, materiaal, kosten en deadlines.

De app is oorspronkelijk gebouwd voor een actieve vriendengroep, maar kan door iedere niet-commerciële groep zelfstandig worden geïnstalleerd en gehost.

> [!IMPORTANT]
> Dit project is publiek beschikbaar onder een **niet-commerciële** licentie. Persoonlijk, educatief en ander niet-commercieel gebruik is toegestaan. Zakelijk of commercieel gebruik vereist voorafgaande schriftelijke toestemming.

## Functionaliteit

| Onderdeel | Mogelijkheden |
| --- | --- |
| **Events** | Agenda, AI-import, deelnemers, support crew, publieke deelpagina’s en WhatsApp-previews |
| **Dashboard** | Teamstatus, reisplanning, trainingsvoortgang, ontbrekende gear, kosten en deadlines |
| **Reizen** | Auto, trein, vliegtuig, zitplaatsen, meerijden, aankomst, vertrek en verblijf |
| **Training** | Persoonlijke AI-plannen, krachttraining, herstelvoorkeuren en voortgang |
| **Gear** | Doelrace-specifieke checklists, budget, productopties, tweedehands zoeken en gedeelde items |
| **Agenda** | Google Agenda, ICS-downloads en een abonneerbare kalenderfeed |
| **Integraties** | Neon, Resend, Gemini, Notion en Vercel |

<details>
<summary><strong>Alle features bekijken</strong></summary>

### Events en deelnemers

- Events handmatig aanmaken of importeren vanaf een officiële URL.
- Aanmelden als deelnemer of support crew.
- Openbare eventpagina’s die direct gedeeld kunnen worden.
- Automatisch gegenereerde Open Graph-afbeeldingen voor WhatsApp.
- Eventtaken en belangrijke deadlines beheren.
- Gezamenlijke kosten toevoegen en per persoon verdelen.

### Reisplanning

- Vervoer vastleggen: auto, trein, vliegtuig of anders.
- Aangeven hoeveel vrije plaatsen een auto heeft.
- Een meerijdverzoek plaatsen.
- Aankomst- en vertrekmomenten delen.
- Accommodatie, boekingslink en verblijfsperiode opslaan.
- Contactpersoon en verwachte kosten vastleggen.

### Training

- Vragenlijst voor sport, ervaring, doelen en beschikbaarheid.
- AI-gegenereerde trainingsblokken.
- Gymdagen, splits en oefeningen.
- Herstelmethoden en hartslagzones.
- Sessies afvinken en voortgang volgen.
- Optioneel exporteren naar een eigen Notion-workspace.

### Gear en budget

- Gearlijsten per sport en geselecteerde doelrace.
- Advies op basis van lengte, gewicht, schoenmaat en kledingmaat.
- Rekening houden met locatie, seizoen, terrein en waarschijnlijke omstandigheden.
- Meerdere concrete productopties met maat en richtprijs.
- Productprijzen uitlezen vanaf een webshoplink.
- Marktplaats-zoeklinks voor geschikte tweedehands producten.
- Gedeelde producten, zoals een fiets-GPS, synchroniseren tussen sporten.
- Afgevinkte items verbergen en filters lokaal bewaren.

### Agenda en delen

- Direct toevoegen aan Google Agenda.
- ICS-download voor Apple Agenda, Outlook en Samsung Agenda.
- Abonneerbare feed via `/api/calendar.ics`.
- Deelbare eventlinks met actuele deelnemersinformatie.

</details>

## Snel starten

### Vereisten

- Node.js 22 of nieuwer
- npm
- PostgreSQL, bij voorkeur via Neon
- Resend voor magic-link-e-mails

```bash
git clone https://github.com/mstoof/Ultimate-Challenges.git
cd Ultimate-Challenges
npm install
cp .env.example .env.local
```

Vul `.env.local` in en initialiseer daarna de database:

```bash
set -a
source .env.local
set +a
npm run db:push
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

> [!NOTE]
> Drizzle Kit leest `.env.local` niet automatisch. Laad het bestand daarom eerst in je shell. Gebruik op Windows PowerShell of een eigen env-loader.

<details>
<summary><strong>Windows PowerShell-instructies</strong></summary>

Maak `.env.local` aan en zet `DATABASE_URL` tijdelijk in de actieve PowerShell-sessie:

```powershell
$env:DATABASE_URL="postgresql://..."
npm run db:push
npm run dev
```

De overige variabelen worden door Next.js rechtstreeks uit `.env.local` gelezen.

</details>

## Deployen op Vercel

1. Fork deze repository.
2. Maak een project aan bij [Neon](https://neon.tech/).
3. Importeer je fork via [vercel.com/new](https://vercel.com/new).
4. Voeg de verplichte omgevingsvariabelen toe in Vercel.
5. Zet `NEXT_PUBLIC_SITE_URL` op je eigen publieke domein.
6. Voer lokaal eenmaal `npm run db:push` uit tegen de productiedatabase.
7. Start een nieuwe deployment.

> [!TIP]
> Gebruik voor iedere previewdeployment een aparte Neon-branch. Zo kunnen previews geen productie-events, accounts of gear wijzigen.

<details>
<summary><strong>Uitgebreide Vercel-checklist</strong></summary>

### Buildinstellingen

Vercel herkent Next.js automatisch. De standaardinstellingen zijn voldoende:

```text
Framework preset: Next.js
Install command: npm install
Build command: npm run build
Output: automatisch
```

### Productiedatabase

Kopieer de gepoolde Neon-connectiestring naar `DATABASE_URL`. Gebruik verschillende databases of branches voor:

- Production
- Preview
- Development

### E-mail

Verifieer een eigen domein in Resend en stel `EMAIL_FROM` in op een afzender van dat domein. De Resend-testafzender kan alleen naar het eigen account mailen.

### Na de eerste deployment

- Controleer magic-link-login.
- Maak een testevent aan.
- Controleer de publieke eventlink in een privévenster.
- Test Google Agenda en ICS.
- Controleer dat previewdeployments niet naar productie schrijven.

</details>

## Configuratie

Gebruik [.env.example](.env.example) als sjabloon.

| Variabele | Verplicht | Beschrijving |
| --- | --- | --- |
| `DATABASE_URL` | Ja | PostgreSQL-/Neon-connectiestring |
| `AUTH_SECRET` | Ja | Sessiesleutel; genereer met `openssl rand -base64 32` |
| `RESEND_API_KEY` | Ja | Resend-key voor magic links |
| `EMAIL_FROM` | Ja | Afzender op een geverifieerd domein |
| `NEXT_PUBLIC_SITE_URL` | Ja | Publieke URL zonder afsluitende slash |
| `ALLOWED_EMAILS` | Nee | Komma-gescheiden allowlist; leeg staat open registratie toe |
| `SUPER_ADMIN_EMAIL` | Nee | Account dat admins mag beheren |
| `GEMINI_API_KEY` | Nee | Activeert AI-import, training en gearadvies |
| `GEMINI_MODEL` | Nee | Te gebruiken Gemini-model |
| `NOTION_CLIENT_ID` | Nee | Notion OAuth-client |
| `NOTION_CLIENT_SECRET` | Nee | Notion OAuth-secret |
| `NOTION_REDIRECT_URI` | Nee | Exact geregistreerde callback-URL |
| `NOTION_TOKEN_ENCRYPTION_KEY` | Nee | Sleutel voor versleutelde Notion-tokens |

<details>
<summary><strong>Voorbeeldconfiguratie en uitleg</strong></summary>

```dotenv
DATABASE_URL="postgresql://user:password@host/database?sslmode=require"
AUTH_SECRET="genereer-een-unieke-lange-sleutel"
RESEND_API_KEY=""
EMAIL_FROM="Ultimate Challenges <hallo@jouwdomein.nl>"
NEXT_PUBLIC_SITE_URL="http://localhost:3000"
ALLOWED_EMAILS="jij@voorbeeld.nl,vriend@voorbeeld.nl"
SUPER_ADMIN_EMAIL="jij@voorbeeld.nl"
```

Laat `ALLOWED_EMAILS` alleen leeg als iedereen met een e-mailadres zich daadwerkelijk mag registreren.

</details>

## Database

Voor een nieuwe installatie:

```bash
set -a && source .env.local && set +a
npm run db:push
```

<details>
<summary><strong>Migraties en bestaande installaties</strong></summary>

De map [`drizzle/`](drizzle/) bevat SQL-migraties en Drizzle-metadata.

- Gebruik voor een volledig nieuwe installatie bij voorkeur `npm run db:push`.
- Gebruik in een beheerde productieomgeving alleen migraties die daar nog niet zijn uitgevoerd.
- Voer historische migraties niet opnieuw uit op een database die eerder met `db:push` is bijgewerkt.
- Maak vóór handmatige productiemigraties altijd een Neon-back-up of branch.

</details>

## Architectuur

```text
app/
├── e/[id]/              eventpagina, dashboard en reisplanning
├── gear/                gear-, budget- en productbeheer
├── plan/                vragenlijst en trainingsplan
├── admin/               leden- en rollenbeheer
└── api/                 auth, agenda, AI, Notion en prijsophaling

db/schema.ts             relationeel Drizzle-datamodel
drizzle/                 SQL-migraties en snapshots
lib/                     domeinlogica en integraties
```

<details>
<summary><strong>Technische keuzes</strong></summary>

### Applicatie

- Next.js App Router
- React Server Components en Server Actions
- TypeScript strict mode
- Mobiel-eerst CSS zonder afzonderlijk componentframework

### Data

- PostgreSQL via Neon
- Drizzle ORM en SQL-migraties
- Eigenaar-gebaseerde queries voor persoonlijke training en gear

### Diensten

- Auth.js voor sessies
- Resend voor magic links
- Google Gemini voor optionele AI
- Notion OAuth voor optionele export
- Vercel voor hosting en previewdeployments

</details>

## Integraties

<details>
<summary><strong>Google Gemini</strong></summary>

Met `GEMINI_API_KEY` kan de app:

- eventinformatie uit een officiële URL halen;
- persoonlijke trainingsblokken genereren;
- gear adviseren op basis van sport, doelrace, locatie, seizoen, terrein en maten;
- concrete productopties en tweedehands zoekopdrachten voorstellen.

Zonder Gemini blijft de kern van de app werken. Controleer AI-output altijd zelf, vooral trainingsbelasting, veiligheidsmateriaal, maten, prijzen en weersomstandigheden.

</details>

<details>
<summary><strong>Notion</strong></summary>

Maak een publieke OAuth-connection in het [Notion Developer Portal](https://www.notion.so/profile/integrations) en registreer:

```text
https://jouw-domein.nl/api/notion/callback
```

Vul vervolgens de vier `NOTION_*`-variabelen in. Iedere gebruiker verbindt zijn eigen workspace. Tokens worden versleuteld opgeslagen.

> Wijzig `NOTION_TOKEN_ENCRYPTION_KEY` niet na ingebruikname. Bestaande verbindingen worden dan onleesbaar en moeten opnieuw worden gekoppeld.

</details>

<details>
<summary><strong>Agenda en ICS</strong></summary>

- `/api/calendar.ics`: abonneerbare feed met alle events.
- `/api/event/[id]/ics`: losse download voor Apple Agenda, Outlook en Samsung Agenda.
- Eventpagina’s bevatten een directe Google Agenda-link.

Google vernieuwt externe feeds niet onmiddellijk. Gebruik voor last-minute wijzigingen de losse Google Agenda-knop of download het ICS-bestand opnieuw.

</details>

## Security en privacy

<details open>
<summary><strong>Checklist voor publieke deployments</strong></summary>

- Commit nooit `.env.local`, database-URL’s, tokens of API-sleutels.
- Gebruik `ALLOWED_EMAILS` als de installatie alleen voor een besloten groep is.
- Gebruik afzonderlijke databases voor productie en previews.
- Verifieer je Resend-domein.
- Houd dependencies en Next.js actueel.
- Controleer publieke eventpagina’s op informatie die je niet openbaar wilt delen.
- Roteer een secret onmiddellijk als die ooit in Gitgeschiedenis of logs verschijnt.

</details>

Eventpagina’s en kalenderfeeds zijn bewust publiek voor delen en agenda-integraties. Persoonlijke beheerpagina’s vereisen authenticatie.

## Ontwikkelen

```bash
npm run lint
npx tsc --noEmit
npm test
npm run build
```

<details>
<summary><strong>Continuous Integration</strong></summary>

GitHub Actions controleert bij pushes en pull requests:

1. ESLint
2. TypeScript
3. Drizzle-migratieconsistentie
4. Productiebuild
5. Vitest-tests

Tijdens CI gebruikt de build een syntactisch geldige lokale placeholder voor `DATABASE_URL`. Er wordt tijdens `next build` niet met een echte database verbonden. Runtimeomgevingen zoals Vercel hebben wel een echte Neon-URL nodig.

</details>

## Bijdragen

Issues en pull requests voor niet-commercieel gebruik zijn welkom. Lees eerst de volledige [contribution guide](CONTRIBUTING.md); GitHub toont deze ook automatisch bij het openen van issues en pull requests.

1. Maak een fork.
2. Open een featurebranch.
3. Voeg waar mogelijk tests toe.
4. Controleer lint, types, tests en build.
5. Open een duidelijke pull request.

Meld beveiligingsproblemen bij voorkeur privé bij de repository-eigenaar en niet als openbaar issue.

## Author

<table>
  <tr>
    <td>
      <img src="https://github.com/mstoof.png" alt="Maurice Stoof" width="120" height="120" />
    </td>
    <td>
      <strong>Maurice Stoof</strong><br />
      Creator and maintainer of Ultimate Challenges<br /><br />
      Cyber Security &amp; Engineering
    </td>
    <td>
      <a href="https://github.com/mstoof">GitHub @mstoof</a><br />
      <a href="mailto:m.stoof@watchmen.io">m.stoof@watchmen.io</a>
    </td>
  </tr>
</table>

Ultimate Challenges is gebouwd door Maurice Stoof vanuit een praktisch idee: één rustige, centrale plek maken waar een actieve vriendengroep gezamenlijke uitdagingen kan plannen, zonder events, trainingsschema’s, reizen, gear en kosten over allerlei losse apps en chats te verspreiden.

Maurice werkt met een focus op Cyber Security en Engineering. In zijn vrije tijd programmeert hij graag en bouwt hij praktische projecten zoals Ultimate Challenges: software die echte planning eenvoudiger, veiliger en leuker maakt.

Het project wordt ontwikkeld met een sterke focus op bruikbaarheid op mobiel, overzicht voor de hele groep en slimme automatisering waar die daadwerkelijk tijd bespaart. Feedback, bugreports en niet-commerciële bijdragen zijn welkom via GitHub.

## Licentie

Ultimate Challenges gebruikt de [PolyForm Noncommercial License 1.0.0](LICENSE).

**Toegestaan:**

- persoonlijk gebruik;
- hobbyprojecten;
- onderzoek en onderwijs;
- gebruik door niet-commerciële organisaties;
- aanpassen en delen binnen de licentievoorwaarden.

**Niet toegestaan zonder aparte schriftelijke licentie:**

- de software verkopen;
- betaalde hosting of diensten aanbieden;
- de software zakelijk inzetten met een commercieel doel;
- op een andere manier geld verdienen met de software.

Dit is een **source-available** project en geen OSI-open-sourceproject, omdat commercieel gebruik wordt beperkt. Neem voor commerciële licenties contact op met de repository-eigenaar.

---

<div align="center">

Built for people who would rather plan the next challenge than sit still.

</div>
