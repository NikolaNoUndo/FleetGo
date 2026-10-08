/**
 * Izmene i ideje koje stižu sa kodom (Claude ih dopisuje posle svake izmene).
 * Pri otvaranju admin panela svaka stavka se jednom upiše u bazu (po ključu `key`);
 * posle toga se menja i briše u panelu, a ovaj fajl je više ne vraća.
 * Novu stavku dodaj NA KRAJ liste, sa novim jedinstvenim ključem.
 */
export type ShippedChange = { key: string; date: string; text: string };
export type ShippedIdea = { key: string; text: string };

export const CHANGES: ShippedChange[] = [
  { key: "c-2026-09-26-1", date: "2026-09-26", text: "Prva verzija (FleetGo v0.1 → Roadline v0.2): prijava, uloge, admin panel, NBS kurs, dobavljači, izveštaji (gorivo, uplate, servisi i delovi, troškovi po vozilu)." },
  { key: "c-2026-09-26-2", date: "2026-09-26", text: "Wialon token po firmi, povezivanje vozila po IMEI-ju, mapa na OpenStreetMap-u. Deploy na Vercel sa migracijama baze u buildu." },
  { key: "c-2026-09-27-1", date: "2026-09-27", text: "Vozila: glavni vozač plus drugi, treći… Kamioni i prikolice povezani više-na-više. Manje opterećenje servera (bez prefetch-a, keš za Wialon)." },
  { key: "c-2026-09-28-1", date: "2026-09-28", text: "Novi Roadline logo i ikonica, smaragdni akcenat. Mapa: pretraga i centriranje, prodavnice, servisi i pumpe (sa cenom dizela) na mapi." },
  { key: "c-2026-09-29-1", date: "2026-09-29", text: "Ostali troškovi (mesečni, pomereni, raspoređeni). Servisi i delovi bez cene. Unos datuma dd.mm.gggg sa našim kalendarom." },
  { key: "c-2026-09-29-2", date: "2026-09-29", text: "Pristup podrške samo uz dozvolu vlasnika (24h); admin ne vidi podatke firmi. Sedište i parking iz Podešavanja." },
  { key: "c-2026-09-30-1", date: "2026-09-30", text: "Obnova dokumenta: period, od kad se računa, broj i cena. Novi dokumenti: CMR osiguranje, TIR, FRC. Telefon izgleda kao aplikacija (donja traka, kartice)." },
  { key: "c-2026-10-01-1", date: "2026-10-01", text: "Pretraga u svakoj padajućoj listi, svoje vrste dokumenata, sertifikat tahografa, gorivo za frigo prikolicu, ovaj mesec naspram celog prošlog." },
  { key: "c-2026-10-02-1", date: "2026-10-02", text: "Uvoz iz Excela (kamioni, prikolice, vozači, rokovi) sa pregledom pre čuvanja. Kilometraža sa praćenja (CAN / senzor)." },
  { key: "c-2026-10-02-2", date: "2026-10-02", text: "Mapa uživo: kartica kamiona sa vozačem, km, gorivom u rezervoaru i koordinatama za kopiranje." },
  { key: "c-2026-10-02-3", date: "2026-10-02", text: "Ture i klijenti: troškovi kamiona i vozača u periodu ture, isplativost po turi i klijentu; cena i zarada iza posebnih dozvola." },
  { key: "c-2026-10-03-1", date: "2026-10-03", text: "Tura je krug sa vožnjama (Čačak → Beograd → Kraljevo → Čačak), svaka vožnja sa svojim klijentom i cenom." },
  { key: "c-2026-10-05-1", date: "2026-10-05", text: "Sve vožnje ture se unose odjednom u istoj formi; ostale kasnije kroz Izmeni." },
  { key: "c-2026-10-07-1", date: "2026-10-07", text: "Dugme „Pošalji utisak” iznad Podešavanja; utisci stižu u admin panel." },
  { key: "c-2026-10-07-2", date: "2026-10-07", text: "Očitavanje tahografa (90 dana) i kartice vozača (28 dana) vezano za kamion i vozača, sa dugmetom Obnovi; vidi se u rokovima i na Pregledu." },
  { key: "c-2026-10-07-3", date: "2026-10-07", text: "Admin: utisak se otvara na svojoj strani (ko, firma, strana, ostali utisci, odgovor mejlom) i može da se obriše." },
  { key: "c-2026-10-07-4", date: "2026-10-07", text: "„Označi plaćeno” u meniju na tri tačke za neplaćene servise, delove i ostale troškove." },
  { key: "c-2026-10-08-1", date: "2026-10-08", text: "Admin: Izmene po danima i Ideje za kasnije (ručno ili ih dopisuje Claude)." },
];

export const IDEAS: ShippedIdea[] = [
  { key: "i-gorivo-racun", text: "Gorivo: dogovoriti kako se računa potrošnja (način čoveka sa 40 kamiona: po turi ili mesečno, norme, pun rezervoar…), da bude ispravno u svim slučajevima." },
  { key: "i-plate-po-turi", text: "Plata i dnevnice za ceo mesec se sada računaju na turu u kojoj je datum isplate. Pitati kako ih on raspoređuje po turama." },
  { key: "i-km-ture-wialon", text: "Kilometri ture automatski sa praćenja (Wialon) za period ture." },
  { key: "i-fiksni-troskovi", text: "Fiksni troškovi po danu (lizing, osiguranje, plata) u isplativosti ture." },
  { key: "i-demo-osvezi", text: "Osvežiti demo nalog test@gmail.com: u folderu fleetgo pokrenuti „node demo-osvezi.mjs”." },
  { key: "i-sajt-domen", text: "Marketing sajt na roadline.app, aplikacija na my.roadline.app." },
];
