# SAP-Simulation

Learn SAP by doing — an interactive, browser-based simulation of the three most
common daily enterprise workflows, in **both SAP GUI (ECC)** and **SAP Fiori
(S/4HANA)**, switchable with **1 click**.

No install, no build step, no backend. Just open `index.html` (or serve the
folder) and start typing T-Codes.

---

## 🖥️ Two experiences, one click

| | SAP GUI (ECC) | SAP Fiori (S/4HANA) |
|---|---|---|
| Look | Classic Easy Access, dark header, SAP Menu tree | Launchpad, white tiles, app names instead of T-Codes |
| Navigate | Command field + T-Codes | Search field + app tiles |
| Data | Same documents, same steps, same entries | Same documents, same steps, same entries |

The toggle in the top bar switches instantly — **your current step and every
field you already typed stay exactly as they were**.

## 🧭 The 3 core simulations

| # | Workflow | Module | T-Code | Result |
|---|----------|--------|--------|--------|
| 1 | Procure-to-Pay — Create Purchase Order | MM | `ME21N` | PO `4500123984` |
| 2 | Order-to-Cash — Create Sales Order | SD | `VA01` | Standard Order `14002395` |
| 3 | Finance — Post Journal Voucher | FI | `FB50` | G/L Document `100004921` |

Each is a guided wizard with required-field validation, ✨ auto-fill, a
Check / ATP / balance traffic-light, and a Save or Post that writes the real
(simulated) document number to the status bar.

**Original training data is preserved:**

- **ME21N** — Vendor `VND-90041` (Global Tech Supplies) · Purch. Org `1000` ·
  Pur. Group `001` · Company Code `1000` · Item `10` `MAT-4402` Laptop
  Enterprise Edition, `50 PC` @ `1,200.00`, Plant `1000`, Stor. Loc `0001`.
- **VA01** — `OR` · `1000 / 10 / 00` · Sold-to `CUST-5002` (Apex Retail Corp) ·
  Cust. PO `PO-99821` · Item `10` `ELEC-100` `10 PC` Industrial Power Inverter ·
  ATP delivery `11/15/2026`.
- **FB50** — Doc date `11/10/2026` · Company Code `1000` · `USD` ·
  Line 1 `400000` Electricity Expense, Debit `450.00`, Cost Center `CC-ADMIN` ·
  Line 2 `113100` Petty Cash Account, Credit `450.00` · Balance `0.00`.

## ⭐ Favorites (pinned in both modes)

| Favorite | T-Code | What it does |
|----------|--------|--------------|
| Display Purchase Order | `ME23N` | PO header, items, document flow |
| Service Entry Sheet | `ML81N` | Create & accept SES `1000001234` |
| ★ Output Processing for Matl Documents | `MB90` | Print material document `4900012345` → spool |
| Goods Movement | `MIGO` | Goods receipt, stock `120 → 170 PC`, mat. doc `4900012345` |
| ★ Display Purchase Requisition | `ME53N` | PR `10001234`, status Released |
| Create Purchase Requisition | `ME51N` | Create & release PR `10001234` |

Also clickable from the Quick Guide: `MM03` (material master), `MIGO`, `VA03`
(display sales order), `FBL3N` (G/L line items incl. `100004921`), and `/N`
(return to home).

## ✨ Features

- **1-click GUI ⇄ Fiori toggle** — the same step, same entries, same documents.
- **Command field / Fiori search** — type a T-Code (`ME21N`, `VA01`, `FB50`,
  `MIGO`, `/N`…) or an app name ("create purchase requisition", "print material
  document") and it routes you to the right app.
- **Step-by-step wizards** — validation on required fields, live totals
  (PO value, sales order value, service value), live stock preview, and an FI
  debit/credit balance traffic-light that really turns red.
- **SAP-like feedback** — spinner → 🟢 success / 🔴 error system response,
  status-bar message on save, toast confirmations.
- **My Documents** — every saved document lands on the home screen with a
  link to the matching Display transaction; persisted in `localStorage`.
- **Keyboard shortcuts** — `Ctrl/⌘ + S` = Save/Post on the current step,
  `F2` = flip between SAP GUI and Fiori.
- **Deep links** — `#me21n`, `#va01`, `#migo`, `#fiori` open the app directly.
- **Responsive** — usable on a laptop or a phone (Favorites stay pinned).

All data is simulated in your browser. Nothing is sent anywhere and no real SAP
system is connected.

## ▶️ Run it

```bash
# option 1 — just open the file
open index.html

# option 2 — serve the folder
python3 -m http.server 8000
# → http://localhost:8000
```

## 🗂️ Files

| File | Purpose |
|------|---------|
| `index.html` | Page shell |
| `style.css` | SAP GUI (ECC) + Fiori (S/4HANA) theming, responsive layout |
| `app.js` | All scenarios, favorites, routing, validation, live calculations, state |

## 🎯 Suggested learning path

1. Run **ME21N** in SAP GUI until you can do it without auto-fill.
2. Flip to **Fiori** mid-way and confirm your entries survived the switch.
3. Open **Display Purchase Order (ME23N)** → see the document flow.
4. Post the **Goods Movement (MIGO)** → stock goes `120 → 170 PC`.
5. Print it via **Output Processing for Matl Documents (MB90)**.
6. Do **VA01** with the ATP check, then **FB50** and break the balance on
   purpose to see the red traffic light.
7. Finish with **Create / Display Purchase Requisition** (`ME51N` / `ME53N`).
