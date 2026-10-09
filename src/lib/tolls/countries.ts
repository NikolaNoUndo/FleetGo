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

export type TollCountry = {
  code: string;
  name: { sr: string; en: string };
  currency: "EUR" | "RSD" | "HUF";
  /** price per km by total axles (truck + trailer); 5 = five or more */
  rates: Record<AxleBucket, Rate>;
  /**
   * Which roads count as tolled, from OpenStreetMap:
   * - "tagged": motorways/expressways tagged toll=yes (systems with free motorways too: Italy, France)
   * - "motorways": every motorway/expressway unless tagged toll=no (Serbia, Croatia)
   * - "all": every motorway/expressway (per-km truck tolls: Slovenia, Hungary, Austria, Germany)
   */
  network: "tagged" | "motorways" | "all";
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

/** HUF per EUR, for Hungary. Not on the NBS list we read; update now and then. */
export const HUF_PER_EUR = 400;

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
    caveats: "Posebne deonice nisu uračunate: Brenner A13 57,65 € (noću 110,34), Tauern A10 49,74, Gleinalm 28,11, Arlberg 21,43, Karawanken 20,91, Bosruck 11,54 (bez PDV-a).",
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
];

export const tollCountry = (code: string) => TOLL_COUNTRIES.find((c) => c.code === code);

export const axleBucket = (axles: number): AxleBucket => (axles >= 5 ? 5 : axles <= 2 ? 2 : (axles as 3 | 4));

/** Tiles the country's bbox is cut into for loading (about 1.5° each). */
export function countryTiles(c: TollCountry, size = 1.5): [number, number, number, number][] {
  const [s, w, n, e] = c.bbox;
  const out: [number, number, number, number][] = [];
  for (let lat = s; lat < n; lat += size) for (let lon = w; lon < e; lon += size) out.push([lat, lon, Math.min(lat + size, n), Math.min(lon + size, e)]);
  return out;
}
