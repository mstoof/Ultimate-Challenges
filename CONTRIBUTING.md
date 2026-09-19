# Contributing to Ultimate Challenges

Bedankt dat je wilt bijdragen aan Ultimate Challenges. Goede bugreports, gerichte featurevoorstellen, documentatie en codebijdragen zijn welkom voor niet-commercieel gebruik.

Lees deze richtlijnen voordat je een issue of pull request opent. Zo blijft het project overzichtelijk en voorkom je dubbel werk.

## Inhoud

- [Gedrag en communicatie](#gedrag-en-communicatie)
- [Een bug melden](#een-bug-melden)
- [Een feature voorstellen](#een-feature-voorstellen)
- [Securityproblemen melden](#securityproblemen-melden)
- [Ontwikkelworkflow](#ontwikkelworkflow)
- [Codekwaliteit](#codekwaliteit)
- [Databasewijzigingen](#databasewijzigingen)
- [Pull requests](#pull-requests)
- [Licentie](#licentie)

## Gedrag en communicatie

- Behandel andere gebruikers en bijdragers met respect.
- Houd discussies technisch, concreet en relevant voor het issue.
- Gebruik GitHub-reactions voor een eenvoudige `+1` in plaats van losse reacties zonder nieuwe informatie.
- Deel nooit wachtwoorden, tokens, database-URL’s, persoonsgegevens of inhoud uit een productiedatabase.
- De issue tracker is bedoeld voor bugs en productontwikkeling, niet voor persoonlijke installatieondersteuning zonder reproduceerbaar probleem.

## Een bug melden

Controleer eerst:

1. of het probleem ook op de laatste versie van `master` bestaat;
2. of er al een open of gesloten issue over bestaat;
3. of de database het actuele schema heeft;
4. of alle vereiste omgevingsvariabelen zijn ingesteld.

Gebruik daarna het bugformulier en vermeld minimaal:

- wat je verwachtte;
- wat er daadwerkelijk gebeurde;
- exacte stappen om het probleem te reproduceren;
- lokale installatie of Vercel;
- Node.js- en browserversie;
- relevante foutmelding of log;
- screenshot of video als dat het probleem verduidelijkt.

Verwijder secrets en persoonsgegevens uit logs en screenshots.

## Een feature voorstellen

Zoek eerst in open én gesloten issues. Bestaat het voorstel al, gebruik dan een reaction en voeg alleen aanvullende context toe als die echt nieuw is.

Een goed featurevoorstel bevat:

- het probleem dat je wilt oplossen;
- voor wie dit probleem relevant is;
- een concreet gebruiksscenario;
- de gewenste gebruikerservaring;
- mogelijke wijzigingen aan data, UI of integraties;
- privacy-, security- en migratiegevolgen;
- een duidelijke afbakening van wat niet bij het voorstel hoort.

Houd voorstellen klein genoeg om in één of enkele gerichte pull requests te implementeren.

## Securityproblemen melden

Open geen publiek issue voor kwetsbaarheden, gelekte secrets, authenticatieproblemen of toegang tot gegevens van andere gebruikers.

Neem privé contact op met de repository-eigenaar via het GitHub-profiel van [Maurice Stoof](https://github.com/mstoof). Vermeld:

- het getroffen onderdeel;
- de impact;
- reproduceerstappen;
- een mogelijke oplossing, indien bekend.

Publiceer details pas nadat een oplossing beschikbaar is.

## Ontwikkelworkflow

### 1. Fork en clone

```bash
git clone https://github.com/<jouw-gebruikersnaam>/Ultimate-Challenges.git
cd Ultimate-Challenges
git remote add upstream https://github.com/mstoof/Ultimate-Challenges.git
```

### 2. Installeer en configureer

```bash
npm install
cp .env.example .env.local
```

Gebruik uitsluitend ontwikkelcredentials en een aparte Neon-database of branch. Gebruik nooit de productiedatabase van iemand anders.

```bash
set -a
source .env.local
set +a
npm run db:push
npm run dev
```

### 3. Werk vanaf de laatste `master`

```bash
git checkout master
git pull upstream master
git checkout -b feat/korte-beschrijving
```

Gebruik herkenbare branchnamen, bijvoorbeeld:

- `feat/event-weather`
- `fix/gear-budget`
- `docs/vercel-setup`
- `test/calendar-timezone`

### 4. Maak gerichte commits

Houd commits logisch en beperkt. Goede voorbeelden:

```text
add shared transport cost summary
fix gear price deduplication
document Neon preview branches
```

Vermijd generieke berichten zoals `changes`, `fix` of `update stuff`.

### 5. Synchroniseer en push

```bash
git fetch upstream
git rebase upstream/master
git push origin feat/korte-beschrijving
```

Open daarna een pull request naar `master`.

## Codekwaliteit

Voer vóór iedere pull request uit:

```bash
npm run lint
npx tsc --noEmit
npm test
npx drizzle-kit check
npm run build
```

Alle checks moeten slagen. Voeg tests toe bij wijzigingen in domeinlogica, datums, agenda-export, training, kostenberekening, gear of integraties.

### Richtlijnen

- Gebruik TypeScript strict en vermijd onnodige type assertions.
- Houd databasequeries altijd owner- of event-scoped.
- Valideer invoer opnieuw op de server; vertrouw niet alleen op browservalidatie.
- Sla secrets nooit op in clientcomponenten, logs of Git.
- Houd server-only imports buiten clientcomponents.
- Behoud tijdzonegedrag voor `Europe/Amsterdam` en test zomertijdgevoelige wijzigingen.
- Maak UI mobiel bruikbaar en toegankelijk met labels en passende ARIA-attributen.
- Hergebruik bestaande componenten, helpers en CSS-patronen waar mogelijk.

## Databasewijzigingen

Wijzig bij een schema-aanpassing altijd `db/schema.ts` en genereer daarna een migratie:

```bash
npm run db:generate
npx drizzle-kit check
```

Neem het SQL-bestand, de snapshot en `_journal.json` samen op in de pull request.

Een database-pull request moet beschrijven:

- welke tabellen of kolommen veranderen;
- of bestaande data moet worden aangevuld;
- of de wijziging backwards compatible is;
- hoe de wijziging veilig kan worden teruggedraaid;
- hoe de migratie is getest.

Voer historische migraties niet opnieuw uit op een bestaande database en commit nooit een database-export met gebruikersdata.

## Pull requests

Open bij grotere functionaliteit eerst een issue om richting en scope af te stemmen. Kleine bugfixes en documentatieverbeteringen mogen direct als pull request worden aangeboden.

Een pull request moet:

- één duidelijk probleem oplossen;
- gekoppeld zijn aan een issue als dat bestaat;
- uitleggen wat er is veranderd en waarom;
- teststappen bevatten;
- screenshots tonen bij zichtbare UI-wijzigingen;
- database- en configuratiegevolgen benoemen;
- geen secrets, gegenereerde buildmappen of persoonlijke data bevatten;
- alle CI-checks doorstaan.

Reviewers kunnen om wijzigingen vragen. Houd nieuwe commits gericht en los feedback inhoudelijk op. Een goedgekeurde pull request kan alsnog worden uitgesteld als die conflicteert met de productrichting, security of de niet-commerciële licentie.

## Licentie

Door code, documentatie of andere inhoud bij te dragen, ga je ermee akkoord dat jouw bijdrage onder dezelfde [PolyForm Noncommercial License 1.0.0](LICENSE) wordt verspreid als het project.

Bijdragen geven geen toestemming om het project commercieel te gebruiken. Neem voor commercieel gebruik of commerciële distributie apart contact op met de rechthebbende.

