"use strict";
/* Sample household used until you import or sync your own data.
   Deterministic (seeded) so screenshots and numbers are stable for a given day. */
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

function sampleState() {
  const r = mulberry32(20260927), rand = (a, b) => a + r() * (b - a), pick = a => a[Math.floor(r() * a.length)];
  const start = addMonths(CUR_MONTH, -23) + "-01";
  const T = [], cardSpend = { sap: {}, amx: {} };
  const add = (date, desc, amount, category, account, extra) => { const t = { id: uid(), date, desc, merchant: cleanMerchant(desc), amount: round2(amount), category, account, ...extra }; T.push(t); return t; };
  const spend = (card, d, desc, amt, cat, extra) => { amt = round2(amt); const t = add(d, desc, -amt, cat, card, extra); cardSpend[card][d.slice(0, 7)] = (cardSpend[card][d.slice(0, 7)] || 0) + amt; return t; };
  const flightDay = addMonths(CUR_MONTH, -6) + "-09", tripMonth = addMonths(CUR_MONTH, -4);
  const trip = { tags: ["japan-trip"] };

  for (let d = start; d <= TODAY; d = addDays(d, 1)) {
    const day = +d.slice(8), ym = d.slice(0, 7), mo = +ym.slice(5), dow = new Date(d + "T12:00:00").getDay();
    // income
    if (day === 1 || day === 15) add(d, "ACME CORP PAYROLL DIRECT DEP", 4850 + (mo === 3 && day === 15 ? 6200 : 0), "Paycheck", "chk");
    if (dow === 5 && dayDiff("2024-01-05", d) % 14 === 0) add(d, "NORTHWIND HEALTH PAYROLL", 2150, "Paycheck", "chk");
    if (day === 28) add(d, "INTEREST PAYMENT", rand(150, 190), "Interest & dividends", "sav");
    // 1418 Linden Ave — the family home
    if (day === 1) add(d, "ROCKET MORTGAGE PMT LINDEN", -2890, "Mortgage", "chk", { property: "linden" });
    if (day === 4) add(d, "LINDEN PARK HOA DUES", -185, "HOA", "chk", { property: "linden" });
    if (day === 12) add(d, "PG&E ELECTRIC WEB PMT", -rand(110, 245), "Property utilities", "chk", { property: "linden" });
    if (day === 19 && mo % 2 === 0) add(d, "EBMUD WATER BILL", -rand(88, 132), "Property utilities", "chk", { property: "linden" });
    if (day === 10 && (mo === 4 || mo === 12)) add(d, "ALAMEDA CTY PROPERTY TAX LINDEN", -4210, "Property tax", "chk", { property: "linden" });
    if (day === 8 && mo === 6) add(d, "STATE FARM HOMEOWNERS", -1640, "Home insurance", "chk", { property: "linden" });
    if (r() < 0.035) spend("sap", d, pick(["HOME DEPOT #6621", "ACE HARDWARE 0412"]), rand(24, 260), "Repairs & maintenance", { property: "linden" });
    // 412 Maple St — rental
    if (day === 3) add(d, "ZELLE FROM J MARTINEZ RENT", 2450, "Rental income", "chk", { property: "maple" });
    if (day === 5) add(d, "MR COOPER MORTGAGE MAPLE", -1420, "Mortgage", "chk", { property: "maple" });
    if (day === 6) add(d, "BAYSIDE PROPERTY MGMT", -196, "Property management", "chk", { property: "maple" });
    if (day === 10 && (mo === 4 || mo === 12)) add(d, "ALAMEDA CTY PROPERTY TAX MAPLE", -2310, "Property tax", "chk", { property: "maple" });
    if (day === 14 && mo === 9) add(d, "FOREMOST LANDLORD POLICY", -980, "Home insurance", "chk", { property: "maple" });
    if (r() < 0.006) add(d, pick(["MAPLE ST PLUMBING CO", "EASTBAY APPLIANCE REPAIR"]), -rand(160, 880), "Repairs & maintenance", "chk", { property: "maple" });
    // bills
    if (day === 5) add(d, "GEICO AUTO INSURANCE", -168, "Insurance", "chk");
    if (day === 10) add(d, "TOYOTA FINANCIAL PMT", -412, "Auto loan", "chk");
    if (day === 12) add(d, "NELNET STUDENT LN PMT", -375, "Student loan", "chk");
    if (day === 18) add(d, "COMCAST XFINITY", -89.99, "Internet & phone", "chk");
    if (day === 22) add(d, "VERIZON WIRELESS", -142, "Internet & phone", "chk");
    // savings & investing
    if (day === 3) add(d, "FIDELITY BROKERAGE TRANSFER", -1000, "Transfer", "chk");
    if (day === 16) { add(d, "ONLINE TRANSFER TO SAVINGS", -2500, "Transfer", "chk"); add(d, "ONLINE TRANSFER FROM CHECKING", 2500, "Transfer", "sav"); }
    // card payments: last month's statement
    if (day === 25) for (const [card, label] of [["sap", "CHASE CREDIT CRD AUTOPAY"], ["amx", "AMEX EPAYMENT ACH PMT"]]) {
      const amt = round2(cardSpend[card][addMonths(ym, -1)] || 0);
      if (amt > 0) { add(d, label, -amt, "Credit card payment", "chk"); add(d, "AUTOMATIC PAYMENT - THANK YOU", amt, "Credit card payment", card); }
    }
    // subscriptions
    if (day === 2) spend("sap", d, "EQUINOX FITNESS #214", 210, "Fitness");
    if (day === 3) spend("amx", d, "APPLE.COM/BILL ICLOUD", 2.99, "Subscriptions");
    if (day === 7) spend("amx", d, "NETFLIX.COM", 22.99, "Subscriptions");
    if (day === 11) spend("amx", d, "NYTIMES DIGITAL", 4, "Subscriptions");
    if (day === 14) spend("amx", d, "SPOTIFY USA", 16.99, "Subscriptions");
    if (day === 16) spend("amx", d, "CHEWY.COM AUTOSHIP", 64.2, "Pets");
    if (day === 20) spend("sap", d, "CLAUDE.AI SUBSCRIPTION", 20, "Subscriptions");
    // everyday spending
    if (dow === 0 || (dow === 3 && r() < 0.5)) spend("amx", d, pick(["TRADER JOE S #552", "WHOLE FOODS MKT #10", "SAFEWAY #1834"]), rand(48, 175), "Groceries");
    if (dow === 6 && r() < 0.5) {
      const amt = round2(rand(160, 340)), g = round2(amt * rand(0.45, 0.7));
      const t = spend("amx", d, "COSTCO WHSE #0482", amt, "Groceries");
      t.splits = [{ amount: -g, category: "Groceries" }, { amount: -round2(amt - g), category: "Household" }];
    }
    if (dow === 6 && r() < 0.3) spend("sap", d, "SQ *RIVERSIDE FARMERS MKT", rand(18, 46), "Groceries");
    if (r() < 0.34) spend("sap", d, pick(["SWEETGREEN MISSION", "CHIPOTLE 2291", "DOORDASH*THAI BASIL", "TST* NOPA", "SUSHI RAN", "TACOLICIOUS"]), rand(16, 96), "Restaurants");
    if (dow >= 1 && dow <= 5 && r() < 0.5) spend("sap", d, pick(["BLUE BOTTLE COFFEE", "STARBUCKS STORE 0441", "PEETS COFFEE 118"]), rand(4.5, 8), "Coffee");
    if (r() < 0.12) spend("sap", d, pick(["UBER *TRIP", "LYFT *RIDE", "BART CLIPPER"]), rand(9, 38), "Rideshare & transit");
    if (r() < 0.05) spend("sap", d, "SFMTA PARKING METER", rand(4, 26), "Parking & tolls");
    if (day % 8 === 0) spend("sap", d, pick(["SHELL OIL 57442", "CHEVRON 0091"]), rand(46, 72), "Gas");
    if (r() < 0.004) spend("sap", d, "JIFFY LUBE #1182", rand(85, 540), "Auto maintenance");
    if (r() < 0.16) spend("sap", d, pick(["AMAZON.COM*MK2L", "TARGET 00123", "AMAZON MKTPL*4R1"]), rand(14, 150), "Household");
    if (r() < 0.03) spend("sap", d, pick(["UNIQLO UNION SQ", "NORDSTROM #88"]), rand(30, 190), "Clothing");
    if (r() < 0.006) spend("sap", d, "BEST BUY 00412", rand(60, 900), "Electronics");
    if (r() < 0.02) spend("sap", d, "MIDTOWN FAMILY MEDICINE", rand(25, 180), "Medical");
    if (r() < 0.03) spend("sap", d, "CVS/PHARMACY 9921", rand(8, 60), "Pharmacy");
    if (r() < 0.05) spend("sap", d, pick(["AMC THEATRES", "TICKETMASTER", "STEAMGAMES.COM"]), rand(15, 140), "Entertainment");
    if (r() < 0.02) spend("sap", d, "SUPERCUTS 0213", rand(28, 64), "Personal care");
    if (r() < 0.01) spend("sap", d, pick(["ETSY.COM", "KIVA.ORG DONATION"]), rand(25, 120), "Gifts & donations");
    if (r() < 0.025) add(d, "VENMO PAYMENT 1022" + Math.floor(r() * 90), -round2(rand(20, 120)), "Uncategorized", "chk");
    if (r() < 0.015) { const amt = round2(rand(15, 60)); add(d, "AMAZON.COM REFUND", amt, "Household", "sap"); cardSpend.sap[ym] = (cardSpend.sap[ym] || 0) - amt; }
    // the Japan trip
    if (d === flightDay) spend("sap", d, "JAPAN AIRLINES", 2972.4, "Flights", trip);
    if (ym === tripMonth && day === 2) spend("sap", d, "AIRBNB * HMTOKYO", 1980.5, "Lodging", trip);
    if (ym === tripMonth && day >= 4 && day <= 14 && r() < 0.8) spend("sap", d, pick(["ICHIRAN SHIBUYA", "LAWSON 0931 TOKYO", "JR EAST SUICA CHARGE", "FAMILYMART KYOTO", "NISHIKI MARKET KYOTO"]), rand(8, 60), "Travel spending", trip);
  }
  // Farmers market charges come in as uncategorized, like they would from a bank.
  for (const t of T) if (/FARMERS MKT/.test(t.desc)) t.category = "Uncategorized";
  T.sort((a, b) => a.date < b.date ? 1 : -1);
  // The newest few need a look, as they would right after a sync.
  let flagged = 0;
  for (const t of T) { if (kindOf2(t.category) === "transfer") continue; if (flagged < 9 || t.category === "Uncategorized") { t.needsReview = true; flagged++; } }
  const dup = T.find(t => t.merchant === "Amazon" && t.amount < 0);
  if (dup) T.push({ ...dup, id: uid(), hidden: true, notes: "Duplicate charge, reversed by the bank" });

  const accounts = [
    { id: "chk", name: "Joint Checking", org: "Chase", type: "checking", balance: 9400 },
    { id: "sav", name: "High-Yield Savings", org: "Ally", type: "savings", balance: 31000 },
    { id: "sap", name: "Sapphire Preferred", org: "Chase", type: "credit", balance: 0 },
    { id: "amx", name: "Blue Cash card", org: "American Express", type: "credit", balance: 0 },
    { id: "brk", name: "Brokerage", org: "Fidelity", type: "investment" },
    { id: "k401", name: "401(k)", org: "Fidelity", type: "retirement" },
    { id: "roth", name: "Roth IRA", org: "Vanguard", type: "retirement" },
    { id: "hlinden", name: "1418 Linden Ave", org: "Zillow estimate", type: "property" },
    { id: "hmaple", name: "412 Maple St", org: "Zillow estimate", type: "property" },
    { id: "mlinden", name: "Linden Ave mortgage", org: "Rocket Mortgage", type: "loan", loan: { rate: 6.125, payment: 2890, original: 468000 } },
    { id: "mmaple", name: "Maple St mortgage", org: "Mr. Cooper", type: "loan", loan: { rate: 3.25, payment: 1420, original: 296000 } },
    { id: "auto", name: "Auto loan", org: "Toyota Financial", type: "loan", loan: { rate: 4.9, payment: 412, original: 28500 } },
    { id: "stud", name: "Student loan", org: "Nelnet", type: "loan", loan: { rate: 5.5, payment: 375, original: 42000 } }
  ];
  for (const a of accounts.slice(0, 4)) a.balance = round2(a.balance + sum(T.filter(t => t.account === a.id && !t.hidden).map(t => t.amount)));
  const grow = { brk: [96000, 0.004, 0.03, 1000], k401: [184000, 0.004, 0.028, 2100], roth: [61000, 0.004, 0.03, 580], hlinden: [648000, 0.003, 0.004, 0], hmaple: [392000, 0.0025, 0.004, 0] };
  const pay = { mlinden: [-441800, 820], mmaple: [-251400, 745], auto: [-24100, 330], stud: [-24800, 262] };
  for (const a of accounts) {
    if (grow[a.id]) { let [v, drift, vol, add] = grow[a.id]; a.snapshots = []; for (let k = -24; k <= 0; k++) { if (k > -24) v = v * (1 + drift + rand(-vol, vol)) + add; a.snapshots.push({ date: k === 0 ? TODAY : monthEnd(addMonths(CUR_MONTH, k)), balance: round2(v) }); } a.balance = round2(v); }
    if (pay[a.id]) { let [v, p] = pay[a.id]; a.snapshots = []; for (let k = -24; k <= 0; k++) { if (k > -24) v = Math.min(0, v + p); a.snapshots.push({ date: k === 0 ? TODAY : monthEnd(addMonths(CUR_MONTH, k)), balance: round2(v) }); } a.balance = round2(v); }
  }
  const properties = [
    { id: "linden", name: "1418 Linden Ave", address: "Oakland, CA · Primary home", color: 1, valueAccount: "hlinden", loanAccount: "mlinden" },
    { id: "maple", name: "412 Maple St", address: "Alameda, CA · Long-term rental", color: 7, valueAccount: "hmaple", loanAccount: "mmaple" }
  ];
  const budgets = { "Groceries": 950, "Restaurants": 750, "Coffee": 100, "Rideshare & transit": 160, "Gas": 260, "Parking & tolls": 40, "Household": 650, "Clothing": 120,
    "Subscriptions": 90, "Internet & phone": 235, "Insurance": 170, "Student loan": 375, "Auto loan": 412, "Medical": 80, "Pharmacy": 50, "Fitness": 210,
    "Entertainment": 130, "Personal care": 50, "Pets": 70, "Gifts & donations": 40, "Travel spending": 150, "Flights": 250, "Lodging": 170 };
  const now = new Date();
  return normalize({
    accounts, transactions: T, properties, budgets,
    sync: { lastSync: new Date(now.getTime() - 3.2 * 3600e3).toISOString(), sample: true },
    settings: { currency: "USD", savingsGoal: 2500, demo: true }
  });
}
function kindOf2(name) { const c = DEFAULT_CATS.find(x => x.name === name); return c ? c.kind : "expense"; }
