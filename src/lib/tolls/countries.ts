/**
 * Road tolls per country for trucks: which roads are tolled (taken from OpenStreetMap)
 * and the average price per km for the truck's class. Prices are what is paid on the
 * road (VAT included where it is charged), from the operators' official price lists.
 *
 * The aim is ±10 % per tour, not the exact euro: section-based systems (Serbia, Croatia,
 * Italy, France) are turned into an average per km from long official routes.
 * Update the rates here when the operators change them (usually 1 January / 1 February).
 */

export type AxleBucket = 2 | 3 | 4 | 5;
export type Rate = { perKm: number; estimated?: boolean };
export type Currency = "EUR" | "RSD" | "HUF" | "PLN" | "CZK" | "RON";

/**
 * A stretch with its own price inside a country (a concession motorway, an Alpine pass,
 * Romania's motorways). Its roads are stored under its own key ("PL-A2"); where a road is
 * both, the stretch wins.
 */
export type TollZone = {
  key: string;
  name: { sr: string; en: string };
  /** OpenStreetMap `ref` of the roads, as a regex ("^A ?2$") */
  ref: string;
  /** where the stretch is [south, west, north, east] */
  bbox: [number, number, number, number];
  rates: Record<AxleBucket, Rate>;
  basis: string;
};

export type TollCountry = {
  code: string;
  name: { sr: string; en: string };
  currency: Currency;
  /** price per km by total axles (truck + trailer); 5 = five or more */
  rates: Record<AxleBucket, Rate>;
  /**
   * Which roads count as tolled, from OpenStreetMap:
   * - "tagged": motorways/expressways tagged toll=yes (systems with free motorways too: Italy, France, Spain)
   * - "motorways": every motorway/expressway unless tagged toll=no (Serbia, Croatia)
   * - "all": every motorway/expressway (per-km truck tolls: Slovenia, Hungary, Austria, Germany, Czechia, Slovakia, Poland)
   * - "national": motorways, expressways and main national roads (Bulgaria, Romania)
   */
  network: "tagged" | "motorways" | "all" | "national";
  zones?: TollZone[];
  /** Romania until TollRo (1 Oct 2026): a time vignette per day instead of a price per km */
  vignette?: { until: string; byBucket: Record<AxleBucket, { days: number; eur: number }[]>; basis: string };
  /** country bounding box [south, west, north, east], cut into tiles when the network is loaded */
  bbox: [number, number, number, number];
  /** roughly how many km of tolled road there are, to spot a bad network load */
  expectKm: number;
  validFrom: string;
  /** what the rate is based on, shown in the admin panel */
  basis: string;
  sources: string[];
  /** what this estimate leaves out */
  caveats?: string;
};

/** Units of the local currency per 1 EUR, for the countries that don't use the euro (RSD comes from the NBS rate). Approximate; update now and then. */
export const FX_PER_EUR: Record<Exclude<Currency, "EUR" | "RSD">, number> = { HUF: 400, PLN: 4.25, CZK: 24.6, RON: 5.08 };
export const HUF_PER_EUR = FX_PER_EUR.HUF;

export const TOLL_COUNTRIES: TollCountry[] = [
  {
    code: "RS",
    name: { sr: "Srbija", en: "Serbia" },
    currency: "RSD",
    rates: { 2: { perKm: 20, estimated: true }, 3: { perKm: 20, estimated: true }, 4: { perKm: 33 }, 5: { perKm: 33 } },
    network: "motorways",
    bbox: [42.2, 18.8, 46.2, 23.1],
    expectKm: 1000,
    validFrom: "2026-07-01",
    basis:
      "Kategorija IV, cenovnik od 1. 7. 2026. Prosek dugih relacija: Beograd–Niš 7.080 RSD / 211 km, Beograd–Preševo 12.340 / 354 km, Dimitrovgrad–Beograd 10.830 / ~304 km (34–36 RSD/km na A1, 38–42 na A2–A4), mešano po broju km na turama (A1 je najviše) i umanjeno 6 % za elektronsku naplatu (TAG) ≈ 33 RSD/km. Obilaznica oko Beograda (IV, od 1. 4. 2026) je u istom proseku. Kategorija III je procena (≈ 60 % od IV).",
    sources: ["https://www.putevi-srbije.rs/images/pdf/cene_putarina_cir.pdf", "https://www.b92.net/biz/srbija/vesti/220638/evo-koliko-ce-iznositi-putarina-na-obilaznici-oko-beograda/vest"],
    caveats: "Popust do 10 % za EURO 6 nije uračunat (nije zvanično potvrđen).",
  },
  {
    code: "HR",
    name: { sr: "Hrvatska", en: "Croatia" },
    currency: "EUR",
    rates: { 2: { perKm: 0.11, estimated: true }, 3: { perKm: 0.11, estimated: true }, 4: { perKm: 0.18 }, 5: { perKm: 0.18 } },
    network: "motorways",
    bbox: [42.3, 13.4, 46.6, 19.5],
    expectKm: 1340,
    validFrom: "2025-07-01",
    basis:
      "Skupina IV (HAC, sa PDV-om): Zagreb–Split 83,70 € / 378 km, Zagreb–Rijeka 39,40 € / 148 km, Zagreb–Lipovac 56,20 € / ~250 km ≈ 0,23 €/km; sa ENC popustom 21,74 % ≈ 0,18 €/km. Skupina III je procena.",
    sources: ["https://www.hac.hr/hr/cestarina/cjenik/a1", "https://www.hac.hr/hr/cestarina/cjenik/a3", "https://www.novilist.hr/novosti/hrvatska/hac-najavio-ujednacavanje-popusta-za-sve-enc-korisnike/"],
    caveats: "Od marta 2027. naplata bez kućica (free-flow); cene treba proveriti tada.",
  },
  {
    code: "SI",
    name: { sr: "Slovenija", en: "Slovenia" },
    currency: "EUR",
    rates: { 2: { perKm: 0.21, estimated: true }, 3: { perKm: 0.21, estimated: true }, 4: { perKm: 0.335 }, 5: { perKm: 0.335 } },
    network: "all",
    bbox: [45.4, 13.3, 46.9, 16.7],
    expectKm: 620,
    validFrom: "2026-01-01",
    basis: "DarsGo R4, EURO VI: Šentilj–Ljubljana 37,37 € / 136,8 km, Ljubljana–Koper 30,36 € / 108,5 km ≈ 0,275 €/km bez PDV-a, 0,335 €/km sa 22 % PDV-a. R3 je procena.",
    sources: ["https://www.uradni-list.si/files/RS_-2025-102-03504-OB~P001-0000.PDF"],
    caveats: "Tunel Karavanke (R4 13,13 €) se plaća posebno i nije uračunat.",
  },
  {
    code: "IT",
    name: { sr: "Italija", en: "Italy" },
    currency: "EUR",
    rates: { 2: { perKm: 0.1, estimated: true }, 3: { perKm: 0.13, estimated: true }, 4: { perKm: 0.161 }, 5: { perKm: 0.19 } },
    network: "tagged",
    bbox: [36.6, 6.6, 47.1, 18.6],
    expectKm: 6000,
    validFrom: "2026-01-01",
    basis: "Autostrade per l'Italia, sa 22 % PDV-a: klasa 5 0,19034 €/km (ravnica) / 0,22437 (planina), klasa 4 0,16108. A22 Brennero ≈ 0,156, A4 Venecija–Trst ≈ 0,187. Klase 2–3 su procena.",
    sources: ["https://www.autostrade.it/it/servizi-al-cliente/pedaggio/come-si-calcola-il-pedaggio", "https://www.mit.gov.it/nfsmitgov/files/media/documentazione/2025-03/A22_Brennero.pdf"],
    caveats: "Planinske deonice su ~18 % skuplje; računa se po ravničarskoj ceni.",
  },
  {
    code: "FR",
    name: { sr: "Francuska", en: "France" },
    currency: "EUR",
    rates: { 2: { perKm: 0.24, estimated: true }, 3: { perKm: 0.35 }, 4: { perKm: 0.35 }, 5: { perKm: 0.35 } },
    network: "tagged",
    bbox: [42.3, -4.8, 51.1, 8.3],
    expectKm: 9200,
    validFrom: "2026-02-01",
    basis: "Klasa 4 (3+ osovine), sa 20 % PDV-a, cene od 1. 2. 2026: Pariz–Bordo 187,60 € / ~520 km, Pariz–Nant 133,10 € / ~345 km, Lion–Marsej 81,70 € / ~270 km, Pariz–Kale 72,50 € / ~200 km ≈ 0,35 €/km (0,29–0,39). Klasa 3 (2 osovine) je procena.",
    sources: ["https://www.vinci-autoroutes.com/static/b9b8279934080436ee3bba255c7835e2/vinci_autoroutes-tarifs-principales-liaisons-2026.pdf", "https://www.autoroutes.sanef.com/sites/default/files/2026-01/2026_02-Grille-Sanef.pdf"],
    caveats: "Km relacija su naša procena; Francuska je najmanje sigurna zemlja (±15 %).",
  },
  {
    code: "HU",
    name: { sr: "Mađarska", en: "Hungary" },
    currency: "HUF",
    rates: { 2: { perKm: 95, estimated: true }, 3: { perKm: 140, estimated: true }, 4: { perKm: 200.28 }, 5: { perKm: 214.37 } },
    network: "all",
    bbox: [45.7, 16.1, 48.6, 22.9],
    expectKm: 1900,
    validFrom: "2026-01-01",
    basis: "HU-GO, EURO VI, autoput, sa 27 % PDV-a: J5 (5+ osovina) 170,94 infrastruktura + 3,95 vazduh/buka + 39,48 CO₂ = 214,37 HUF/km; J4 200,28 HUF/km. J2/J3 su procena.",
    sources: ["https://nemzetiutdij.hu/api/uploads/A4_UTDIJTABLA_KKD_20260101_v2_pdf_5fe39b407c.pdf"],
    caveats: "Magistralni putevi (főút) pod naplatom nisu u mreži, samo autoputevi; kurs HUF je fiksan (400 za 1 €).",
  },
  {
    code: "AT",
    name: { sr: "Austrija", en: "Austria" },
    currency: "EUR",
    rates: { 2: { perKm: 0.3, estimated: true }, 3: { perKm: 0.48, estimated: true }, 4: { perKm: 0.687 }, 5: { perKm: 0.687 } },
    network: "all",
    bbox: [46.3, 9.5, 49.1, 17.2],
    expectKm: 2250,
    validFrom: "2026-01-01",
    basis: "GO-Maut, 4+ osovine, EURO VI, CO₂ klasa 1: 57,24 ct/km bez PDV-a = 0,687 €/km sa 20 % PDV-a. 2–3 osovine su procena.",
    sources: ["https://www.go-maut.at/en/paying-the-go-toll/go-toll-rates", "https://www.go-maut.at/media/xj4k352b/go-maut-tarife-2026_streckenmaut_en.pdf"],
    zones: [
      {
        key: "AT-A13",
        name: { sr: "Brenner (A13)", en: "Brenner (A13)" },
        ref: "^A ?13$",
        bbox: [46.98, 11.33, 47.27, 11.56],
        rates: { 2: { perKm: 1.2, estimated: true }, 3: { perKm: 1.2, estimated: true }, 4: { perKm: 1.98 }, 5: { perKm: 1.98 } },
        basis: "Posebna putarina Innsbruck-Amras–Brenner 57,65 € bez PDV-a (69,18 sa PDV-om) za ~35 km ≈ 1,98 €/km danju; noću 110,34 € nije uračunato.",
      },
      {
        key: "AT-A10",
        name: { sr: "Tauern (A10)", en: "Tauern (A10)" },
        ref: "^A ?10$",
        bbox: [47.0, 13.35, 47.36, 13.66],
        rates: { 2: { perKm: 0.8, estimated: true }, 3: { perKm: 0.8, estimated: true }, 4: { perKm: 1.27 }, 5: { perKm: 1.27 } },
        basis: "Posebna putarina Flachau–Rennweg 49,74 € bez PDV-a (59,69 sa PDV-om) za ~47 km ≈ 1,27 €/km.",
      },
    ],
    caveats: "Ostale posebne deonice nisu uračunate: Gleinalm A9 28,11 €, Arlberg S16 21,43, Karawanken A11 20,91, Bosruck 11,54 (bez PDV-a); Brenner noću 110,34.",
  },
  {
    code: "DE",
    name: { sr: "Nemačka", en: "Germany" },
    currency: "EUR",
    rates: { 2: { perKm: 0.2, estimated: true }, 3: { perKm: 0.28, estimated: true }, 4: { perKm: 0.33, estimated: true }, 5: { perKm: 0.348 } },
    network: "all",
    bbox: [47.2, 5.8, 55.1, 15.1],
    expectKm: 14000,
    validFrom: "2023-12-01",
    basis: "Toll Collect, preko 18 t, 5+ osovina, EURO 6, CO₂ klasa 1: 34,8 ct/km (infrastruktura 15,5 + vazduh 2,3 + buka 1,2 + CO₂ 15,8), bez PDV-a. 2–4 osovine su procena.",
    sources: ["https://www.bussgeldkatalog.org/lkw-maut/", "https://logistivo.com/en/truck-toll-calculator-europe-toll-per-km"],
    caveats: "U mreži su autoputevi i brze ceste; savezni putevi (Bundesstraßen) van njih nisu.",
  },
  {
    code: "CZ",
    name: { sr: "Češka", en: "Czechia" },
    currency: "CZK",
    rates: { 2: { perKm: 2.834 }, 3: { perKm: 3.7433 }, 4: { perKm: 4.9285 }, 5: { perKm: 5.9644 } },
    network: "all",
    bbox: [48.5, 12.0, 51.1, 18.9],
    expectKm: 1400,
    validFrom: "2026-01-01",
    basis: "Mýto (NV 327/2025), preko 12 t, EURO VI, CO₂ klasa 1, autoput: 5+ osovina 5,9644 CZK/km, 4 osovine 4,9285, 3 osovine 3,7433, 2 osovine 2,8340. Broje se osovine cele kombinacije sa prikolicom. Mýto nije pod PDV-om.",
    sources: ["https://www.epravo.cz/top/zakony/sbirka-zakonu/sb/2025/327", "https://www.mytocz.eu/"],
    caveats: "Putevi I reda pod naplatom (3,65 CZK/km za 5+ osovina) nisu u mreži, samo autoputevi i brze ceste; kurs CZK je fiksan.",
  },
  {
    code: "SK",
    name: { sr: "Slovačka", en: "Slovakia" },
    currency: "EUR",
    rates: { 2: { perKm: 0.236 }, 3: { perKm: 0.3321 }, 4: { perKm: 0.3692 }, 5: { perKm: 0.3293 } },
    network: "all",
    bbox: [47.7, 16.8, 49.7, 22.6],
    expectKm: 900,
    validFrom: "2025-07-01",
    basis: "Emyto (NV 418/2024), preko 12 t, EURO VI, CO₂ klasa 1, autoput, bez PDV-a: 5+ osovina 0,2677 €/km, 4 osovine 0,3002, 3 osovine 0,2700, 2 osovine 0,1919; ovde sa 23 % PDV-a. (5+ je zaista jeftinije od 4 u zvaničnoj tabeli.)",
    sources: ["https://static.slov-lex.sk/pdf/prilohy/SK/ZZ/2024/418/20250701_5704381-2.pdf"],
    caveats: "Putevi I reda pod naplatom (0,1942 €/km bez PDV-a za 5+ osovina) nisu u mreži.",
  },
  {
    code: "PL",
    name: { sr: "Poljska", en: "Poland" },
    currency: "PLN",
    rates: { 2: { perKm: 0.56 }, 3: { perKm: 0.56 }, 4: { perKm: 0.56 }, 5: { perKm: 0.56 } },
    network: "all",
    bbox: [49.0, 14.1, 54.9, 24.2],
    expectKm: 5000,
    validFrom: "2026-02-01",
    basis: "e-TOLL, 12 t i više, EURO 5 i noviji, autoputevi i brze ceste: 0,56 PLN/km (ostali državni putevi 0,42). U Poljskoj se gleda ukupna masa i EURO klasa, ne broj osovina. e-TOLL nije pod PDV-om.",
    sources: ["https://eli.gov.pl/eli/DU/2026/33/ogl/pol/pdf", "https://www.gov.pl/web/kss/zmiany-w-systemie-e-toll-od-1-lutego-2026-r"],
    caveats: "Državni putevi van autoputeva i brzih cesta nisu u mreži; kurs PLN je fiksan.",
    zones: [
      {
        key: "PL-A2",
        name: { sr: "A2 Nowy Tomyśl–Konin (koncesija)", en: "A2 Nowy Tomyśl–Konin (concession)" },
        ref: "^A ?2$",
        bbox: [52.0, 16.1, 52.45, 18.25],
        rates: { 2: { perKm: 1.5, estimated: true }, 3: { perKm: 2.2, estimated: true }, 4: { perKm: 3.3 }, 5: { perKm: 3.3 } },
        basis: "AWSA, kategorija 4 (od 11. 9. 2026., sa PDV-om): Nowy Tomyśl–Konin 495 PLN / ~150 km ≈ 3,30 PLN/km.",
      },
      {
        key: "PL-A4",
        name: { sr: "A4 Katowice–Kraków (koncesija)", en: "A4 Katowice–Kraków (concession)" },
        ref: "^A ?4$",
        bbox: [49.95, 19.05, 50.3, 19.95],
        rates: { 2: { perKm: 1.05 }, 3: { perKm: 1.05 }, 4: { perKm: 1.8 }, 5: { perKm: 1.8 } },
        basis: "Stalexport, kategorije 4–5 (od 1. 4. 2026., sa PDV-om): 2 × 55 PLN / ~61 km ≈ 1,80 PLN/km; kategorije 2–3: 2 × 32 PLN ≈ 1,05.",
      },
      {
        key: "PL-A1",
        name: { sr: "A1 Gdanjsk–Torunj (koncesija)", en: "A1 Gdańsk–Toruń (concession)" },
        ref: "^A ?1$",
        bbox: [52.95, 18.45, 54.3, 18.85],
        rates: { 2: { perKm: 0.47 }, 3: { perKm: 0.47 }, 4: { perKm: 0.47 }, 5: { perKm: 0.47 } },
        basis: "AmberOne, kategorije 2–4, sa PDV-om: Rusocin–Nowa Wieś 71 PLN / 152 km ≈ 0,47 PLN/km.",
      },
    ],
  },
  {
    code: "BG",
    name: { sr: "Bugarska", en: "Bulgaria" },
    currency: "EUR",
    rates: { 2: { perKm: 0.135 }, 3: { perKm: 0.135 }, 4: { perKm: 0.2 }, 5: { perKm: 0.2 } },
    network: "national",
    bbox: [41.2, 22.3, 44.3, 28.7],
    expectKm: 4500,
    validFrom: "2026-06-01",
    basis: "BG TOLL, preko 12 t, EURO VI, CO₂ klasa 1 (u evrima od 2026.): 4+ osovine 0,21 €/km autoput, 0,19 put I reda; 2–3 osovine 0,14 / 0,13. Ovde prosek 0,20 i 0,135 jer mreža obuhvata i autoputeve i glavne puteve.",
    sources: ["https://www.a1.bg/a1-tolling", "https://www.bgtoll.bg/"],
    caveats: "Putevi II reda (0,18 €/km) nisu u mreži.",
  },
  {
    code: "RO",
    name: { sr: "Rumunija", en: "Romania" },
    currency: "RON",
    rates: { 2: { perKm: 0.24 }, 3: { perKm: 0.24 }, 4: { perKm: 0.24 }, 5: { perKm: 0.24 } },
    network: "national",
    bbox: [43.6, 20.2, 48.3, 29.7],
    expectKm: 9000,
    validFrom: "2026-10-01",
    basis: "TollRo od 1. 10. 2026., 12 t i više, EURO VI, sa 21 % PDV-a: državni put (DN) 0,24 RON/km, autoput i brza cesta 0,48 RON/km. Gleda se najveća dozvoljena masa vozila i EURO klasa, ne osovine.",
    sources: ["https://erovinieta.net/tollro", "https://alba24.ro/noi-tarife-tollro-pentru-camioanele-electrice-cat-costa-fiecare-kilometru-pe-autostrazi-si-drumuri-nationale-1161779.html"],
    caveats: "Mostovi se plaćaju posebno i nisu uračunati: Fetești–Cernavodă 133 RON, Giurgeni–Vadu Oii 94 RON (4+ osovine). Kurs RON je fiksan.",
    zones: [
      {
        key: "RO-A",
        name: { sr: "Rumunija, autoputevi", en: "Romania, motorways" },
        ref: "^A ?[0-9]+$",
        bbox: [43.6, 20.2, 48.3, 29.7],
        rates: { 2: { perKm: 0.48 }, 3: { perKm: 0.48 }, 4: { perKm: 0.48 }, 5: { perKm: 0.48 } },
        basis: "TollRo, autoputevi i brze ceste: 0,48 RON/km (EURO VI, 12 t i više, sa PDV-om).",
      },
    ],
    vignette: {
      until: "2026-10-01",
      byBucket: {
        2: [{ days: 1, eur: 17 }, { days: 7, eur: 42.5 }, { days: 30, eur: 85.5 }],
        3: [{ days: 1, eur: 17 }, { days: 7, eur: 42.5 }, { days: 30, eur: 85.5 }],
        4: [{ days: 1, eur: 28.5 }, { days: 7, eur: 71 }, { days: 30, eur: 142.5 }],
        5: [{ days: 1, eur: 28.5 }, { days: 7, eur: 71 }, { days: 30, eur: 142.5 }],
      },
      basis: "Do 30. 9. 2026. rovinieta (vinjeta po danima), 12 t i više: 4+ osovine 28,5 € dan / 71 € 7 dana / 142,5 € 30 dana; do 3 osovine 17 / 42,5 / 85,5.",
    },
  },
  {
    code: "ES",
    name: { sr: "Španija", en: "Spain" },
    currency: "EUR",
    rates: { 2: { perKm: 0.19 }, 3: { perKm: 0.19 }, 4: { perKm: 0.23 }, 5: { perKm: 0.23 } },
    network: "tagged",
    bbox: [36.0, -9.4, 43.8, 3.4],
    expectKm: 2500,
    validFrom: "2026-01-01",
    basis: "Autopistas de peaje, sa 21 % PDV-a, cene 2026: Pesados 2 (4+ osovine) AP-68 Bilbao–Zaragoza 84,15 € / 294 km = 0,286, AP-9 34,25 € / 219 km = 0,156 (sa popustom za kamione), AP-7 Málaga–Estepona 0,23, AP-66 0,194, AP-7 Alicante–Cartagena 0,17–0,19 ≈ 0,23 €/km u proseku; Pesados 1 (2–3 osovine) ≈ 0,19.",
    sources: ["https://cdnfomento.blob.core.windows.net/portal-web-transportes/carreteras/nuestrared/autopistaspeaje/peajes-actuales/autopista-ap-68,-bilbao---zaragoza-2026.pdf", "https://www.autopistadelsol.com/es/tarifas-y-descuentos/tarifas"],
    caveats: "Velike deonice su besplatne od 2020–2021. (AP-7 Katalonija/Valensija, AP-2, AP-4); AP-68 prestaje da se naplaćuje u Aragonu i La Rioji od novembra 2026. AP-6 (0,51 €/km) je skuplji od proseka.",
  },
];

export const tollCountry = (code: string) => TOLL_COUNTRIES.find((c) => c.code === code.slice(0, 2));

/** The country or the stretch inside it that a stored key ("PL" or "PL-A2") stands for. */
export function tollKey(key: string) {
  const c = tollCountry(key);
  if (!c) return null;
  const zone = key.length > 2 ? c.zones?.find((z) => z.key === key) : undefined;
  if (key.length > 2 && !zone) return null;
  return { country: c, zone, name: zone?.name ?? c.name, rates: zone?.rates ?? c.rates };
}

export const axleBucket = (axles: number): AxleBucket => (axles >= 5 ? 5 : axles <= 2 ? 2 : (axles as 3 | 4));

export type LoadStep = { kind: "tile"; bbox: [number, number, number, number] } | { kind: "zone"; zone: TollZone };

/** What loading a country takes: its tiles, then one step per priced stretch. */
export const loadSteps = (c: TollCountry): LoadStep[] => [...countryTiles(c).map((bbox) => ({ kind: "tile" as const, bbox })), ...(c.zones ?? []).map((zone) => ({ kind: "zone" as const, zone }))];

/** Tiles the country's bbox is cut into for loading (about 1.5° each). */
export function countryTiles(c: TollCountry, size = 1.5): [number, number, number, number][] {
  const [s, w, n, e] = c.bbox;
  const out: [number, number, number, number][] = [];
  for (let lat = s; lat < n; lat += size) for (let lon = w; lon < e; lon += size) out.push([lat, lon, Math.min(lat + size, n), Math.min(lon + size, e)]);
  return out;
}
