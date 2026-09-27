# Roadline

Upravljanje voznim parkom za prevozničke, transportne i logističke firme: vozila, prikolice, zaposleni, rokovi dokumenata, gorivo, servisi, delovi, dobavljači i uplate vozačima, uz mapu uživo preko Wialona.

**Verzija 0.2**: prijava emailom i lozinkom, uloge i prava po modulu, više firmi po jednom emailu, admin panel za celu platformu, dnevni kurs NBS i posebna lista dobavljača.

## Šta radi

| Modul | Šta prati |
| --- | --- |
| Pregled | Aktivna vozila, istekla i dokumenta koja uskoro ističu, troškovi po mesecima (gorivo, servisi, delovi, uplate), troškovi i potrošnja po vozilu, mini mapa |
| Mapa uživo | Pozicije, brzina, status (u vožnji / stoji / van mreže), vozač. Wialon ili simulacija |
| Vozila | Tip, marka/model, VIN, EURO norma, kilometraža, glavni vozač i po potrebi drugi, treći… vozač, prikačena prikolica, Wialon ID; detalj sa dokumentima, servisima, gorivom, delovima i potrošnjom l/100 km |
| Prikolice | Tip (cerada, hladnjača, cisterna…), osovine, nosivost, na koje vozilo je prikačena; dokumenta, servisi, delovi |
| Zaposleni | Vozači i ostali; dokumenta vozača, uplate, sipanja |
| Rokovi i dokumenta | Registracija, tehnički, šestomesečni, zeleni karton, bela potvrda, baždarenje tahografa, CEMT, licenca, ATP, ADR, PP aparat, prva pomoć; za vozače: vozačka, kartica za tahograf, CPC/kod 95, lekarsko, ADR kartica, pasoš, radna dozvola. „Obnovi“ predlaže novi rok po tipičnom trajanju dokumenta |
| Gorivo | Litri (obavezno), iznos (opciono), cena po litru, pumpa, država, kilometraža, način plaćanja |
| Servisi / Delovi | Šta je rađeno ili kupljeno, za koje vozilo ili prikolicu, dobavljač/servis, iznos, plaćeno / nije plaćeno |
| Dobavljači | Servisi i dobavljači delova. Novi se dodaje direktno iz forme (upišeš naziv → „Dodaj …“) i ostaje u bazi za filtriranje |
| Uplate vozačima | Dnevnice, akontacije, plate, bonusi, troškovi puta |
| Izveštaji | Gorivo, uplate vozačima, servisi i delovi, troškovi po vozilu – za izabrani period i filtere (vozilo, vozač, dobavljač, plaćeno). Štampa ili „Sačuvaj kao PDF“ na A4 sa zaglavljem firme i zbirovima |
| Podešavanja | Podaci o firmi, kurs (NBS automatski ili ručno), broj dana za upozorenje, članovi tima i njihova prava, provera Wialon veze |

Interfejs je na srpskom i engleskom (klik na svoje ime dole levo → Jezik / Valuta / Odjava). Svaki trošak se čuva u valuti u kojoj je plaćen (EUR ili RSD), a zbirovi se prikazuju u izabranoj valuti.

## Prijava, uloge i admin

- **Admin panel** (`/admin`) je samo za tebe kao developera. Korisničko ime i hash lozinke su u env promenljivama `ADMIN_USERNAME` i `ADMIN_PASSWORD_HASH` (lozinka se nigde ne čuva u čistom obliku). Tu vidiš zahteve za pristup, firme, korisnike i dnevnik aktivnosti; praviš firmu sa vlasnikom, dodaješ člana/vlasnika postojećoj firmi, šalješ link za lozinku ili privremenu lozinku, blokiraš korisnika ili firmu i možeš da „uđeš kao“ vlasnik (2 sata, uz traku na vrhu).
- **Lozinke se ne mogu videti** ni u adminu ni u bazi; čuvaju se kao scrypt hash. Umesto toga admin šalje jednokratni link (važi 7 dana) ili privremenu lozinku koju korisnik menja pri prvoj prijavi.
- **Registracija** (`/register`) je samo zahtev. Kad ga odobriš u adminu, pravi se firma i vlasnik, a ti dobiješ link koji mu pošalješ.
- **Vlasnik** u Podešavanjima → Članovi dodaje ljude emailom i bira ulogu: dispečer, servis ili knjigovodstvo. Za svaki modul može da podesi Nema / Gleda / Menja.
- **Jedan email u više firmi**: posle prijave bira se firma, a menja se klikom na naziv firme u meniju.
- Posle 8 pogrešnih pokušaja u 15 minuta prijava se privremeno blokira.
- **Profil i bezbednost** (klik na ime dole levo): promena lozinke (ostali uređaji se odjave) i spisak aktivnih prijava sa odjavom pojedinačnih ili svih ostalih uređaja.

Hash admin lozinke pravi se ovako (lozinku stavi pod navodnike, ništa se ne čuva):

```bash
npm run admin:hash -- "tvoja-lozinka"
```

Dobijeni red `ADMIN_PASSWORD_HASH=…` ide u `.env` i u Vercel env promenljive, zajedno sa `ADMIN_USERNAME`.

## Kurs NBS

Kad je u Podešavanjima izabrano „NBS“, aplikacija jednom dnevno uzima zvanični srednji kurs EUR iz NBS kursne liste (preko javnog API-ja kurs.resenje.org) i čuva ga u bazi. Ako servis nije dostupan, koristi se poslednji sačuvani kurs. „Ručno“ ostavlja kurs koji sam upišeš.

## Tehnologija

Next.js 16 (App Router, Server Actions) · TypeScript · Tailwind CSS 4 · Drizzle ORM · Postgres (Supabase) · Leaflet (OpenStreetMap) · Wialon Remote API

## Pokretanje lokalno

```bash
npm install
cp .env.example .env        # upiši DATABASE_URL, DIRECT_URL, ADMIN_USERNAME, ADMIN_PASSWORD_HASH
npm run db:migrate          # pravi tabele
npm run db:seed             # opciono: demo firma sa podacima
npm run dev                 # http://localhost:3000 → /admin/login, pa dodaj vlasnika firmi
```

Za lokalni Postgres bez Supabase-a dovoljno je `DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/fleetgo`.

## Čist start za pravu firmu

Kad završiš sa demo podacima, obriši sve i napravi praznu firmu sa pravim nazivom:

```bash
npm run db:fresh -- --name "Naziv Firme d.o.o." --pib 123456789 --address "Ulica 1, Grad" --yes
```

Bez `--yes` komanda samo ispiše šta je u bazi i ništa ne briše. Brisanje je trajno. Posle toga u admin panelu dodaj vlasnika toj firmi. (Firmu možeš napraviti i direktno iz admin panela, bez ove komande.)

## Supabase

1. Napravi projekat na supabase.com (region Frankfurt je najbliži).
2. **Connect → ORMs / Connection string**: kopiraj *Transaction pooler* (port 6543) u `DATABASE_URL`, a *Session pooler* (port 5432) u `DIRECT_URL`.
3. Pokreni `npm run db:migrate` (i po želji `npm run db:seed`).

Row Level Security je uključen na svim tabelama bez politika, tako da javni Supabase API ključevi ne mogu da čitaju podatke. Aplikacija se na bazu povezuje direktno sa servera, a svaki upit je ograničen na firmu i prava prijavljenog korisnika.

## Deploy na Vercel

1. Importuj repo na vercel.com.
2. U **Settings → Environment Variables** dodaj `DATABASE_URL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`.
3. Region funkcija je podešen u `vercel.json` na Dablin (`dub1`), pored Supabase baze u Irskoj (`eu-west-1`). Ako je baza u drugom regionu, promeni ga tamo.
4. Deploy. Vercel pri svakom deployu prvo pokrene migracije (`scripts/vercel-build.mjs`: `drizzle-kit migrate`, pa `next build`), pa se baza sama ažurira. Za to mora da postoji `DIRECT_URL` (ili bar `DATABASE_URL`).

## Wialon (GPS uživo)

Mapa prikazuje samo prave pozicije, nema simulacije. Svaka firma ima svoj Wialon token: vlasnik (ili ko ima pravo da menja podešavanja) ga upisuje u **Podešavanja → Wialon**, uz opcionu adresu Wialon Local servera. Token se čuva samo na serveru; u pregledaču se vidi samo da postoji i njegova poslednja 4 znaka.

Aplikacija se prijavljuje preko `token/login`, čita jedinice i poslednje pozicije preko `core/search_items` i osvežava mapu na 10 sekundi. Jedinica se vezuje za vozilo:

1. preko polja **Wialon ID / IMEI** na vozilu: upiše se Wialon ID jedinice ili „Unique ID“ (IMEI) sa kartice Hardver u Wialonu, ili
2. automatski, ako se registarska oznaka vozila nalazi u nazivu jedinice u Wialonu (npr. jedinica „BG 1742-TK Scania“).

Dugme „Proveri vezu“ pokazuje koliko jedinica je pronađeno i koliko ih je povezano sa vozilima. Bez tokena mapa piše „Wialon nije povezan“, a ako Wialon ne odgovori, prikazuje grešku.

Kod: `src/lib/telematics/` (jedan ulaz `getPositions`, provajder `wialon.ts`, pa se lako dodaje i drugi GPS sistem).

## Struktura

```
src/
  app/(app)/           stranice aplikacije (traže prijavu)
  app/(auth)/          prijava, zahtev za pristup, postavljanje lozinke, izbor firme
  app/admin/           admin panel
  app/actions.ts       unos, izmena, brisanje (uz proveru prava)
  proxy.ts             preusmerava neprijavljene na /login
  app/api/positions    pozicije za mapu
  components/          UI, tabele, forme, grafikon, mapa
  db/                  Drizzle šema i seed
  lib/catalog.ts       tipovi dokumenata, statusi, države… (SR/EN nazivi)
  lib/resources.ts     definicija polja za svaki unos (forme i validacija iz istog izvora)
  lib/i18n.ts          prevodi
  lib/telematics/      Wialon i simulacija
  lib/auth/            sesije, lozinke, uloge i prava, dnevnik
  lib/fx.ts            kurs NBS
drizzle/               SQL migracije
```

Novo polje se dodaje na tri mesta: `src/db/schema.ts` (pa `npm run db:generate`), `src/lib/resources.ts` (forma i validacija) i kolona u odgovarajućoj tabeli u `src/components/tables/`.

## Plan dalje

- 0.3 / 0.4: uloga vozača sa mobilnim prikazom (dani prelaska granice, sipanje goriva, troškovi sa slikom računa, oznaka „fizički račun predat“)
- Slanje emailova (odobren zahtev, link za lozinku) umesto ručnog slanja linka
