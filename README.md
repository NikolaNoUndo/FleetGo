# FleetGo

Upravljanje voznim parkom za prevozničke, transportne i logističke firme: vozila, prikolice, zaposleni, rokovi dokumenata, gorivo, servisi, delovi i uplate vozačima, uz mapu uživo preko Wialona.

**Verzija 0.1** radi kao vlasnik firme i vidi sve podatke. Verzija 0.2 dodaje prijavu (naziv firme + korisničko ime + lozinka) i prava pristupa po ulozi; šema baze je već multi-tenant (`company_id` na svakoj tabeli).

## Šta radi

| Modul | Šta prati |
| --- | --- |
| Pregled | Aktivna vozila, istekla i dokumenta koja uskoro ističu, troškovi po mesecima (gorivo, servisi, delovi, uplate), troškovi i potrošnja po vozilu, mini mapa |
| Mapa uživo | Pozicije, brzina, status (u vožnji / stoji / van mreže), vozač. Wialon ili simulacija |
| Vozila | Tip, marka/model, VIN, EURO norma, kilometraža, vozač, prikačena prikolica, Wialon ID; detalj sa dokumentima, servisima, gorivom, delovima i potrošnjom l/100 km |
| Prikolice | Tip (cerada, hladnjača, cisterna…), osovine, nosivost, na koje vozilo je prikačena; dokumenta, servisi, delovi |
| Zaposleni | Vozači i ostali; dokumenta vozača, uplate, sipanja |
| Rokovi i dokumenta | Registracija, tehnički, šestomesečni, zeleni karton, bela potvrda, baždarenje tahografa, CEMT, licenca, ATP, ADR, PP aparat, prva pomoć; za vozače: vozačka, kartica za tahograf, CPC/kod 95, lekarsko, ADR kartica, pasoš, radna dozvola. „Obnovi“ predlaže novi rok po tipičnom trajanju dokumenta |
| Gorivo | Litri, iznos, cena po litru, pumpa, država, kilometraža, način plaćanja |
| Servisi / Delovi | Šta je rađeno ili kupljeno, za koje vozilo ili prikolicu, iznos, plaćeno / nije plaćeno |
| Uplate vozačima | Dnevnice, akontacije, plate, bonusi, troškovi puta |
| Podešavanja | Podaci o firmi, kurs EUR→RSD, broj dana za upozorenje, provera Wialon veze |

Interfejs je na srpskom i engleskom (prekidač u meniju). Svaki trošak se čuva u valuti u kojoj je plaćen (EUR ili RSD), a zbirovi se prikazuju u izabranoj valuti po kursu iz podešavanja.

## Tehnologija

Next.js 16 (App Router, Server Actions) · TypeScript · Tailwind CSS 4 · Drizzle ORM · Postgres (Supabase) · Leaflet (OpenStreetMap / CARTO) · Wialon Remote API

## Pokretanje lokalno

```bash
npm install
cp .env.example .env        # upiši DATABASE_URL (i DIRECT_URL)
npm run db:migrate          # pravi tabele
npm run db:seed             # opciono: demo firma sa podacima
npm run dev                 # http://localhost:3000
```

Za lokalni Postgres bez Supabase-a dovoljno je `DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/fleetgo`.

## Čist start za pravu firmu

Kad završiš sa demo podacima, obriši sve i napravi praznu firmu sa pravim nazivom:

```bash
npm run db:fresh -- --name "Naziv Firme d.o.o." --pib 123456789 --address "Ulica 1, Grad" --yes
```

Bez `--yes` komanda samo ispiše šta je u bazi i ništa ne briše. Brisanje je trajno.

## Supabase

1. Napravi projekat na supabase.com (region Frankfurt je najbliži).
2. **Connect → ORMs / Connection string**: kopiraj *Transaction pooler* (port 6543) u `DATABASE_URL`, a *Session pooler* (port 5432) u `DIRECT_URL`.
3. Pokreni `npm run db:migrate` (i po želji `npm run db:seed`).

Migracija `0001_enable_rls.sql` uključuje Row Level Security na svim tabelama bez politika, tako da javni Supabase API ključevi ne mogu da čitaju podatke. Aplikacija se na bazu povezuje direktno sa servera. Politike po firmi dolaze u v0.2 zajedno sa prijavom.

## Deploy na Vercel

1. Importuj repo na vercel.com.
2. U **Settings → Environment Variables** dodaj `DATABASE_URL` (i kasnije `WIALON_TOKEN`).
3. Deploy. Migracije pokreći lokalno protiv Supabase baze (`npm run db:migrate`) kad se šema promeni.

## Wialon

Bez tokena mapa prikazuje simulirane kamione koji se kreću po stvarnim koridorima (Beograd, Budimpešta, Beč, Sofija, Solun…), da bi se sve moglo isprobati.

Kad dodaš token:

```bash
WIALON_TOKEN=tvoj_token
WIALON_HOST=https://hst-api.wialon.com   # opciono; za Wialon Local tvoj host
```

aplikacija se prijavljuje preko `token/login`, čita jedinice i poslednje pozicije preko `core/search_items` i osvežava mapu na 10 sekundi. Jedinica se vezuje za vozilo:

1. preko polja **Wialon ID jedinice** na vozilu, ili
2. automatski, ako se registarska oznaka vozila nalazi u nazivu jedinice u Wialonu (npr. jedinica „BG 1742-TK Scania“).

U **Podešavanjima** dugme „Proveri vezu“ pokazuje koliko jedinica je pronađeno i koliko ih je povezano sa vozilima. Ako Wialon ne odgovori, mapa privremeno prelazi na simulaciju i prikazuje grešku.

Kod: `src/lib/telematics/` (jedan interfejs, provajderi `wialon.ts` i `simulator.ts`, pa se lako dodaje i drugi GPS sistem).

## Struktura

```
src/
  app/                 stranice (App Router) + actions.ts (unos, izmena, brisanje)
  app/api/positions    pozicije za mapu
  components/          UI, tabele, forme, grafikon, mapa
  db/                  Drizzle šema i seed
  lib/catalog.ts       tipovi dokumenata, statusi, države… (SR/EN nazivi)
  lib/resources.ts     definicija polja za svaki unos (forme i validacija iz istog izvora)
  lib/i18n.ts          prevodi
  lib/telematics/      Wialon i simulacija
drizzle/               SQL migracije
```

Novo polje se dodaje na tri mesta: `src/db/schema.ts` (pa `npm run db:generate`), `src/lib/resources.ts` (forma i validacija) i kolona u odgovarajućoj tabeli u `src/components/tables/`.

## Plan za 0.2

- Prijava: naziv firme + korisničko ime + lozinka
- Uloge (vlasnik, dispečer, knjigovodstvo, vozač) i prava pristupa po modulu
- RLS politike po `company_id`
