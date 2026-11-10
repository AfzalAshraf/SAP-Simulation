/* SAP Simulation — GUI (ECC) + Fiori (S/4HANA) dual experience
   1-click mode switch preserves step + form data. Favorites are always pinned. */
'use strict';

/* ================= DATA ================= */
const FAVORITES = [
  {id:'me23n',  name:'Display Purchase Order',                    tcode:'ME23N', icon:'📋', color:'#7c3aed', desc:'View PO 4500123984 — header, items & status'},
  {id:'ml81n',  name:'Service Entry Sheet',                       tcode:'ML81N', icon:'🧾', color:'#0891b2', desc:'Create & accept a service entry sheet for the PO'},
  {id:'output', name:'* Output Processing for Matl Documents',    tcode:'MB90',  icon:'🖨️', color:'#475569', desc:'Print / output a material document (goods receipt)', starred:true},
  {id:'migo',   name:'Goods Movement',                            tcode:'MIGO',  icon:'📦', color:'#d97706', desc:'Post goods receipt — 50 laptops into stock'},
  {id:'me53n',  name:'* Display Purchase Requisition',            tcode:'ME53N', icon:'👁️', color:'#db2777', desc:'Display PR 10001234 and its release status', starred:true},
  {id:'me51n',  name:'Create Purchase Requisition',               tcode:'ME51N', icon:'📝', color:'#16a34a', desc:'Create PR for 50 laptops, then release it'},
];
const MAIN_SIMS = [
  {id:'me21n', module:'MM · Materials Management', title:'Procure-to-Pay — Create Purchase Order', tcode:'ME21N', icon:'🛒', color:'#0a6ed1',
   objective:'The warehouse needs to order <b>50 units of replacement laptops</b>. Create a Purchase Order for Global Tech Supplies (VND-90041).', steps:5},
  {id:'va01', module:'SD · Sales & Distribution', title:'Order-to-Cash — Create Sales Order', tcode:'VA01', icon:'📦', color:'#7c3aed',
   objective:'A wholesale customer (Apex Retail Corp, CUST-5002) wants to buy <b>industrial power inverters</b>. Create a Standard Order and check availability (ATP).', steps:6},
  {id:'fb50', module:'FI · Financial Accounting', title:'Finance — Post Journal Voucher (FB50)', tcode:'FB50', icon:'💼', color:'#107e3e',
   objective:'Record a direct ledger entry to pay an external office utility bill: <b>Debit Electricity Expense 450.00 / Credit Petty Cash 450.00</b>.', steps:5},
];
const QUICK_GUIDE = [
  {mod:'Logistics / MM', tcode:'MM03',  what:'Display Material Master (view parts / items catalog)', sim:'mm03'},
  {mod:'Logistics / MM', tcode:'MIGO',  what:'Goods Receipt / Goods Issue (moving inventory into stock)', sim:'migo'},
  {mod:'Sales / SD',     tcode:'VA03',  what:'Display Sales Order details', sim:'va03'},
  {mod:'Finance / FI',   tcode:'FBL3N', what:'G/L Account Line Item Display (check account balances)', sim:'fbl3n'},
  {mod:'System',         tcode:'/N',    what:'Cancels the current screen and returns you to home base', sim:'home'},
];
const TCODE_MAP = {ME21N:'me21n',VA01:'va01',FB50:'fb50',ME23N:'me23n',ML81N:'ml81n',MB90:'output',MIGO:'migo',ME51N:'me51n',ME53N:'me53n',MM03:'mm03',VA03:'va03',FBL3N:'fbl3n'};
const KEYWORD_MAP = [
  [/purchase order|procure|me21/, 'me21n'], [/sales order|order.to.cash|va01/, 'va01'],
  [/journal|voucher|fb50|finance|g\/l/, 'fb50'], [/display purchase|me23/, 'me23n'],
  [/service entry|ml81/, 'ml81n'], [/output|print.*material|mb90/, 'output'],
  [/goods|migo|movement|receipt/, 'migo'], [/display.*requisition|me53/, 'me53n'],
  [/create.*requisition|requisition|me51/, 'me51n'], [/material master|mm03/, 'mm03'],
  [/display sales|va03/, 'va03'], [/fbl3n|line item/, 'fbl3n'],
];
/* Fiori (S/4HANA) app names for the same tasks — shown when the app is in Fiori mode */
const FIORI_APP = {
  me21n:'Create Purchase Order – Advanced', va01:'Create Sales Order',
  fb50:'Post General Ledger Journal Entries', me23n:'Display Purchase Order',
  ml81n:'Manage Service Entry Sheets', output:'Output Processing for Material Documents',
  migo:'Post Goods Movement', me51n:'Create Purchase Requisition',
  me53n:'Display Purchase Requisition', mm03:'Display Material',
  va03:'Display Sales Order', fbl3n:'Manage G/L Account Line Items',
};
function fioriName(id){ return FIORI_APP[id] || ''; }
const RELATED = {
  me21n:['me23n','migo','ml81n'], va01:['va03'], fb50:['fbl3n'],
  me51n:['me53n','me21n'], migo:['output','me23n'], ml81n:['me23n'],
  me23n:['migo','ml81n'], output:['migo'], me53n:['me21n'], mm03:['migo'], va03:['va01'], fbl3n:['fb50'],
};

/* ================= STATE ================= */
let state = {
  mode: localStorage.getItem('sapMode') || 'gui',
  busy: false,
  view: 'home', // home | sim
  scenarioId: null, step: 0, completed: false, docNumber: null, doneSteps: [],
  formCache: {}, status: {msg:'Ready. Enter a T-Code or pick a Favorite above.', type:'ok'},
  documents: JSON.parse(localStorage.getItem('sapDocs') || '[]'),
  progress: JSON.parse(localStorage.getItem('sapProgress') || '{}'),
};
function saveDocs(){ localStorage.setItem('sapDocs', JSON.stringify(state.documents)); }
function saveProgress(){ localStorage.setItem('sapProgress', JSON.stringify(state.progress)); }
function $(id){ return document.getElementById(id); }
function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;'); }
function fmt(n){ const v=parseFloat(n); return isNaN(v)?'0.00':v.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function today(){ return '11/10/2026'; }

/* ================= SCENARIOS =================
   Each step: title, desc, instruction, body(), autofill{}, primary? */
/* ---- layout wrappers: SAP group boxes in GUI mode, cards in Fiori ---- */
function fgOpen(){
  return state.mode==='gui' ? '<fieldset class="ggroup"><legend>Data</legend><div class="gfields">' : '<div class="form-grid">';
}
function fgEnd(){ return '</div>'; }               // both modes close with a div
function gtOpen(){
  return state.mode==='gui' ? '<div class="ggrid">' : '<div class="grid-table">';
}
function totalOpen(){ return state.mode==='gui' ? '<div class="gtotal">' : '<div class="total-row">'; }

function fld(label,id,value,hint,req){
  if(state.mode==='gui') return gf(label,id,{value:value||'',hint:hint,req});
  return `<div class="field"><label for="${id}">${label}${req?' <span class="req">*</span>':''}</label>
    <input id="${id}" value="${esc(value||'')}" ${req?'class="req-field"':''} autocomplete="off">
    ${hint?`<div class="hint">${hint}</div>`:''}</div>`;
}
function sel(label,id,options,value,hint,req){
  if(state.mode==='gui') return gfSel(label,id,options,{value:value,hint:hint,req});
  const opts = options.map(o=>`<option value="${esc(o[0])}" ${o[0]===value?'selected':''}>${esc(o[1])}</option>`).join('');
  return `<div class="field"><label for="${id}">${label}${req?' <span class="req">*</span>':''}</label>
    <select id="${id}" ${req?'class="req-field"':''}>${opts}</select>${hint?`<div class="hint">${hint}</div>`:''}</div>`;
}

const SCENARIOS = {
me21n:{
  id:'me21n', tcode:'ME21N', title:'Create Purchase Order', module:'MM · Materials Management', icon:'🛒', color:'#0a6ed1',
  objective:'The warehouse needs to order <b>50 units of replacement laptops</b>. You need to create a Purchase Order (PO) for Global Tech Supplies.',
  docType:'Purchase Order', docPrefix:'4500123984',
  steps:[
    {title:'Enter the T-Code', desc:'ME21N — Create Purchase Order', instruction:'In the command field at the top left, type <b>ME21N</b> and press Enter. <b>Try it now</b> — type ME21N in the bar above, or click the button below.',
     body:()=>`<div class="display-block"><h5>📟 Command Field</h5><p class="tip">SAP GUI command field is always at the top. In Fiori you would instead tap the <b>Create Purchase Order</b> tile — same app, same data. Use the 1-click toggle above to switch and watch this step stay exactly where you left it.</p>
       <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button class="btn btn-primary" onclick="document.getElementById('cmdInput').value='ME21N';routeTcode('ME21N')">▶ Open ME21N</button>
       <button class="btn" onclick="toast('Tip: you can also type ME21N in the top bar and press Enter','info')">⌨️ Or type it in the top bar</button></div></div>`,
     autofill:{}},
    {title:'Fill Out the Header Data', desc:'Vendor & organizational data', instruction:'Enter the vendor and purchasing organization. Fields marked <span class="req">*</span> are required. Use <b>✨ Auto-fill</b> to fill instantly, or type manually.',
     body:()=>`${fgOpen()}
       ${fld('Vendor','me21_vendor','','e.g. <code>VND-90041</code> — Global Tech Supplies',true)}
       ${fld('Purch. Org','me21_porg','','e.g. <code>1000</code>',true)}
       ${fld('Pur. Group','me21_pgroup','','e.g. <code>001</code> — IT Procurement',true)}
       ${fld('Company Code','me21_cocode','','e.g. <code>1000</code>',true)}
       ${fld('Order Date','me21_date',today(),'Document date',false)}
       ${sel('Doc. Type','me21_type',[['NB','NB — Standard PO'],['NC','NC — Consignment']],'NB','',false)}
       </div><p class="tip">💡 Vendor <code>VND-90041</code> = Global Tech Supplies. Purchasing Org <code>1000</code> buys for Company Code <code>1000</code>.</p>`,
     autofill:{me21_vendor:'VND-90041',me21_porg:'1000',me21_pgroup:'001',me21_cocode:'1000',me21_date:'11/10/2026'}},
    {title:'Fill Out the Item Overview Grid', desc:'One line: 50 laptops @ 1,200.00', instruction:'Enter the item line below. The total updates live: <b>50 × 1,200.00 = 60,000.00</b>.',
     body:()=>`${gtOpen()}<table><thead><tr><th>Item</th><th>Material *</th><th>Short Text *</th><th>Qty *</th><th>Unit</th><th>Price *</th><th>Plant</th><th>Stor. Loc</th></tr></thead><tbody>
       <tr><td class="ro">10</td><td><input id="me21_mat" class="req-field" placeholder="MAT-4402"></td><td><input id="me21_text" class="req-field" placeholder="Laptop Enterprise Edition"></td>
       <td><input id="me21_qty" class="req-field" type="number" placeholder="50" oninput="updatePOTotal()"></td><td><input id="me21_unit" value="PC"></td>
       <td><input id="me21_price" class="req-field" type="number" placeholder="1200.00" oninput="updatePOTotal()"></td><td><input id="me21_plant" value="1000"></td><td><input id="me21_storloc" value="0001"></td></tr>
       </tbody></table></div>
       ${totalOpen()}<span>Net Order Value:</span><b id="poTotal">0.00 USD</b><span class="tip">(Qty × Price)</span></div>
       <p class="tip">Plant <code>1000</code> / Storage Location <code>0001</code> = Main Warehouse. Unit <code>PC</code> = Piece.</p>`,
     autofill:{me21_mat:'MAT-4402',me21_text:'Laptop Enterprise Edition',me21_qty:'50',me21_unit:'PC',me21_price:'1200.00',me21_plant:'1000',me21_storloc:'0001'}},
    {title:'Check for Errors', desc:'Run the consistency check', instruction:'Click <b>[ 📋 Check ]</b> on the toolbar. The system validates vendor, material, plant and pricing.',
     body:()=>`<div class="display-block"><h5>📋 Pre-Save Summary</h5>
       <div class="kv"><span>Vendor</span><b id="sumVendor">—</b></div><div class="kv"><span>Material</span><b id="sumMat">—</b></div>
       <div class="kv"><span>Quantity</span><b id="sumQty">—</b></div><div class="kv"><span>Net Value</span><b id="sumTotal">—</b></div></div>
       <p class="tip">Press <b>📋 Check</b> below — a healthy PO returns <b>🟢 No messages issued during check.</b></p>`,
     autofill:{}, primary:{label:'📋 Check', cls:'btn-primary', handler:'checkPO'}},
    {title:'Save the Purchase Order', desc:'Ctrl+S — create the PO', instruction:'Click <b>[ 💾 Save ]</b>. The system assigns the PO number and writes it to the status bar.',
     body:()=>`<div class="display-block"><h5>💾 Ready to Save</h5><p class="tip">Saving creates PO <b>4500123984</b> in Purchasing Org 1000. After saving you can open it with Favorite <b>Display Purchase Order (ME23N)</b> or receive the goods with <b>Goods Movement (MIGO)</b>.</p></div>`,
     autofill:{}, primary:{label:'💾 Save', cls:'btn-green', handler:'savePO'}},
  ]
},
va01:{
  id:'va01', tcode:'VA01', title:'Create Sales Order', module:'SD · Sales & Distribution', icon:'📦', color:'#7c3aed',
  objective:'A long-time wholesale customer calls and wants to buy <b>industrial equipment</b> from your inventory. Create a Standard Order for Apex Retail Corp.',
  docType:'Sales Order', docPrefix:'14002395',
  steps:[
    {title:'Enter the T-Code', desc:'VA01 — Create Sales Order', instruction:'Return to the main menu and type <b>VA01</b> and press Enter (or use the button below).',
     body:()=>`<div class="display-block"><h5>📟 Command Field</h5><p class="tip">In Fiori this is the <b>Create Sales Order</b> app tile. Same transaction, modern tiles.</p>
       <button class="btn btn-primary" onclick="document.getElementById('cmdInput').value='VA01';routeTcode('VA01')">▶ Open VA01</button></div>`, autofill:{}},
    {title:'Initial Screen — Order Type & Org', desc:'OR · 1000 / 10 / 00', instruction:'Select the order type and sales organization, then click <b>Continue (Enter)</b>.',
     body:()=>`${fgOpen()}
       ${sel('Order Type','va_type',[['OR','OR — Standard Order'],['RE','RE — Returns'],['FD','FD — Rush Order']],'OR','',true)}
       ${fld('Sales Org','va_sorg','','e.g. <code>1000</code>',true)}
       ${fld('Distribution Channel','va_dc','','e.g. <code>10</code> — Direct',true)}
       ${fld('Division','va_div','','e.g. <code>00</code> — All Divisions',true)}
       </div><p class="tip">💡 <code>OR</code> = Standard Order. Sales Org <code>1000</code> / Channel <code>10</code> / Division <code>00</code> is the default wholesale setup.</p>`,
     autofill:{va_type:'OR',va_sorg:'1000',va_dc:'10',va_div:'00'}},
    {title:'Order Header — Sold-to Party', desc:'Customer & their PO reference', instruction:'Enter the sold-to party and the customer\'s own PO number.',
     body:()=>`${fgOpen()}
       ${fld('Sold-to Party','va_soldto','','e.g. <code>CUST-5002</code> — Apex Retail Corp',true)}
       ${fld('PO Number (customer ref)','va_custpo','','e.g. <code>PO-99821</code>',true)}
       ${fld('Ship-to Party','va_shipto','CUST-5002','Defaults to sold-to',false)}
       ${sel('Payment Terms','va_pay',[['Z001','Z001 — Net 30 days'],['Z002','Z002 — 2% / 10 days']],'Z001','',false)}
       ${fld('Requested Delivery','va_reqdate','11/15/2026','',false)}
       </div>`, autofill:{va_soldto:'CUST-5002',va_custpo:'PO-99821',va_shipto:'CUST-5002',va_reqdate:'11/15/2026'}},
    {title:'Item Data Block', desc:'10 × Industrial Power Inverter', instruction:'Enter the item line. Price 850.00 × 10 = <b>8,500.00</b>.',
     body:()=>`${gtOpen()}<table><thead><tr><th>Item</th><th>Material *</th><th>Order Qty *</th><th>Unit</th><th>Description *</th><th>Price</th></tr></thead><tbody>
       <tr><td class="ro">10</td><td><input id="va_mat" class="req-field" placeholder="ELEC-100"></td><td><input id="va_qty" class="req-field" type="number" placeholder="10" oninput="updateSOTotal()"></td>
       <td><input id="va_unit" value="PC"></td><td><input id="va_desc" class="req-field" placeholder="Industrial Power Inverter"></td><td><input id="va_price" type="number" placeholder="850.00" oninput="updateSOTotal()"></td></tr>
       </tbody></table></div>${totalOpen()}<span>Order Value:</span><b id="soTotal">0.00 USD</b></div>`,
     autofill:{va_mat:'ELEC-100',va_qty:'10',va_unit:'PC',va_desc:'Industrial Power Inverter',va_price:'850.00'}},
    {title:'Check Availability (ATP)', desc:'Background stock check', instruction:'The system automatically runs a background check against warehouse plant stocks. Click <b>Run ATP Check</b>.',
     body:()=>`<div class="display-block"><h5>🏭 Availability Check (ATP)</h5><p class="tip">ATP = <b>Available-To-Promise</b>. SAP checks unrestricted stock minus commitments for Plant 1000.</p>
       <div id="atpResult" style="margin-top:10px"><p class="tip">Not run yet — click below.</p></div></div>`,
     autofill:{}, primary:{label:'▶ Run ATP Check', cls:'btn-primary', handler:'runATP'}},
    {title:'Save the Sales Order', desc:'Create order 14002395', instruction:'Click <b>[ 💾 Save ]</b> to create the Standard Order.',
     body:()=>`<div class="display-block"><h5>💾 Ready to Save</h5><p class="tip">Saving creates Standard Order <b>14002395</b> for Apex Retail Corp. Delivery is scheduled for <b>11/15/2026</b>.</p></div>`,
     autofill:{}, primary:{label:'💾 Save', cls:'btn-green', handler:'saveSO'}},
  ]
},
fb50:{
  id:'fb50', tcode:'FB50', title:'Enter G/L Account Document', module:'FI · Financial Accounting', icon:'💼', color:'#107e3e',
  objective:'Record a direct financial ledger entry to pay an external office utility bill — <b>double-entry bookkeeping</b>: Debit = Credit.',
  docType:'G/L Document', docPrefix:'100004921',
  steps:[
    {title:'Enter the T-Code', desc:'FB50 — Enter G/L Account Document', instruction:'In the command line, type <b>FB50</b> and press Enter.',
     body:()=>`<div class="display-block"><h5>📟 Command Field</h5><p class="tip">In Fiori this is <b>Post Journal Entry</b>. The accounting logic is identical.</p>
       <button class="btn btn-primary" onclick="document.getElementById('cmdInput').value='FB50';routeTcode('FB50')">▶ Open FB50</button></div>`, autofill:{}},
    {title:'Document Header', desc:'Company Code 1000 · USD', instruction:'Enter the document date and company code.',
     body:()=>`${fgOpen()}
       ${fld('Document Date','fb_docdate',today(),'',true)}
       ${fld('Company Code','fb_cocode','','e.g. <code>1000</code>',true)}
       ${sel('Currency','fb_curr',[['USD','USD — US Dollar'],['EUR','EUR — Euro'],['AED','AED — UAE Dirham']],'USD','',false)}
       ${sel('Document Type','fb_doctype',[['SA','SA — G/L Account Document'],['AA','AA — Asset Posting']],'SA','',false)}
       ${fld('Posting Date','fb_postdate',today(),'',false)}
       ${fld('Reference / Text','fb_ref','Utility Bill — Oct 2026','Free text',false)}
       </div>`, autofill:{fb_docdate:'11/10/2026',fb_cocode:'1000',fb_postdate:'11/10/2026',fb_ref:'Utility Bill — Oct 2026'}},
    {title:'Line Item Entry — Double Entry', desc:'Debit Electricity Expense / Credit Petty Cash', instruction:'Enter both lines. The <b>traffic-light balance</b> must show <b>0.00</b> before posting. Try changing an amount to see it turn red.',
     body:()=>`<div id="fbBalance" class="balance-box ok"><span class="traffic green" id="fbTraffic"></span><span>Balance:</span><b id="fbBalVal">0.00 USD</b><span id="fbBalMsg">🟢 Debit equals Credit — ready to post.</span></div>
       ${gtOpen()}<table><thead><tr><th>Line</th><th>G/L Account *</th><th>Short Text *</th><th>D/C</th><th>Amount (Doc. Curr.) *</th><th>Cost Center</th></tr></thead><tbody>
       <tr><td class="ro">1</td><td><input id="fb1_acct" class="req-field" placeholder="400000" oninput="updateFBBalance()"></td><td><input id="fb1_text" class="req-field" placeholder="Electricity Expense"></td>
       <td><select id="fb1_dc" onchange="updateFBBalance()"><option value="D">Debit</option><option value="C">Credit</option></select></td>
       <td><input id="fb1_amt" class="req-field" type="number" placeholder="450.00" oninput="updateFBBalance()"></td><td><input id="fb1_cc" placeholder="CC-ADMIN"></td></tr>
       <tr><td class="ro">2</td><td><input id="fb2_acct" class="req-field" placeholder="113100" oninput="updateFBBalance()"></td><td><input id="fb2_text" class="req-field" placeholder="Petty Cash Account"></td>
       <td><select id="fb2_dc" onchange="updateFBBalance()"><option value="D">Debit</option><option value="C" selected>Credit</option></select></td>
       <td><input id="fb2_amt" class="req-field" type="number" placeholder="450.00" oninput="updateFBBalance()"></td><td><input id="fb2_cc" placeholder="Leave Blank"></td></tr>
       </tbody></table></div>
       <p class="tip">Rule of double entry: <b>Σ Debits − Σ Credits = 0</b>. Account <code>400000</code> (expense) is debited; <code>113100</code> (petty cash) is credited.</p>`,
     autofill:{fb1_acct:'400000',fb1_text:'Electricity Expense',fb1_dc:'D',fb1_amt:'450.00',fb1_cc:'CC-ADMIN',fb2_acct:'113100',fb2_text:'Petty Cash Account',fb2_dc:'C',fb2_amt:'450.00'}},
    {title:'Verify Traffic Light Balance', desc:'Must be green 0.00', instruction:'Look at the top-right balance indicator. It must be <b>🟢 Balance: 0.00 USD</b>.',
     body:()=>`<div id="fbBalance2" class="balance-box ok"><span class="traffic green" id="fbTraffic2"></span><span>Balance:</span><b id="fbBalVal2">0.00 USD</b><span id="fbBalMsg2">🟢 Debit equals Credit.</span></div>
       <div class="display-block"><h5>⚖️ Why It Must Balance</h5><p class="tip">Every FI posting follows <b>Debit = Credit</b>. If the balance is not zero, SAP blocks posting with a red traffic light. Go back to Step 3 if it is red.</p></div>`,
     autofill:{}, primary:{label:'🔍 Verify Balance', cls:'btn-primary', handler:'verifyFB'}},
    {title:'Post the Document', desc:'Create G/L document 100004921', instruction:'Click <b>[ 💾 Post ]</b> on the toolbar.',
     body:()=>`<div class="display-block"><h5>💾 Ready to Post</h5><p class="tip">Posting writes document <b>100004921</b> in Company Code 1000 and updates G/L accounts 400000 &amp; 113100. Verify afterwards with <b>FBL3N</b>.</p></div>`,
     autofill:{}, primary:{label:'💾 Post', cls:'btn-green', handler:'postFI'}},
  ]
},
me23n:{
  id:'me23n', tcode:'ME23N', title:'Display Purchase Order', module:'MM · Materials Management', icon:'📋', color:'#7c3aed',
  objective:'Display Purchase Order <b>4500123984</b> (created in Simulation 1) — header, items and order status. Read-only: nothing can be changed here.',
  docType:'Purchase Order', docPrefix:'4500123984',
  steps:[
    {title:'Enter the T-Code', desc:'ME23N — Display Purchase Order', instruction:'Type <b>ME23N</b> in the command field and press Enter.',
     body:()=>`<div class="display-block"><h5>📟 Command Field</h5><button class="btn btn-primary" onclick="document.getElementById('cmdInput').value='ME23N';routeTcode('ME23N')">▶ Open ME23N</button></div>`, autofill:{}},
    {title:'Enter PO Number & Execute', desc:'4500123984', instruction:'Enter the PO number and click <b>Execute (Enter)</b>.',
     body:()=>`${fgOpen()}${fld('Purchase Order Number','dpo_num','','e.g. <code>4500123984</code>',true)}</div>
       <div id="dpoResult" style="display:none">
       <div class="display-block"><h5>Header Data</h5>
         <div class="kv"><span>Vendor</span><b>VND-90041 — Global Tech Supplies</b></div>
         <div class="kv"><span>Purch. Org / Group</span><b>1000 / 001</b></div>
         <div class="kv"><span>Company Code</span><b>1000</b></div>
         <div class="kv"><span>Order Date</span><b>11/10/2026</b></div>
         <div class="kv"><span>Status</span><b>🟢 Ordered — not yet delivered</b></div></div>
       ${gtOpen()}<table><thead><tr><th>Item</th><th>Material</th><th>Short Text</th><th>Qty</th><th>Unit</th><th>Price</th><th>Plant</th><th>Stor. Loc</th></tr></thead><tbody>
         <tr><td class="ro">10</td><td>MAT-4402</td><td>Laptop Enterprise Edition</td><td>50</td><td>PC</td><td>1,200.00</td><td>1000</td><td>0001</td></tr></tbody></table></div>
       ${totalOpen()}<span>Net Order Value:</span><b>60,000.00 USD</b></div></div>`,
     autofill:{dpo_num:'4500123984'}, primary:{label:'▶ Execute', cls:'btn-primary', handler:'execDisplayPO'}},
    {title:'Review & Next Actions', desc:'Print · History · Goods Receipt', instruction:'Review the PO. From here you can print it, view its history, or jump to <b>Goods Movement (MIGO)</b> to receive the laptops.',
     body:()=>`<div class="display-block"><h5>🕘 PO History — Document Flow</h5>
       <div class="kv"><span>Purchase Order</span><b>4500123984 · 60,000.00 USD</b></div>
       <div class="kv"><span>Goods Receipt (MIGO)</span><b>4900012345 · 50 PC — posted</b></div>
       <div class="kv"><span>Service Entry Sheet (ML81N)</span><b>1000001234 · 500.00 USD — accepted</b></div>
       <div class="kv"><span>Invoice (MIRO)</span><b>510560012 · 60,000.00 USD — parked</b></div>
       <div class="kv"><span>Order Quantity / Received</span><b>50 PC / 50 PC</b></div>
       <div class="kv"><span>Still to be delivered</span><b>0 PC — 🟢 Delivered</b></div></div>
       <div class="display-block"><h5>✅ What You Can Do From ME23N</h5>
       <p class="tip">🖨️ <b>Print</b> the PO &nbsp;·&nbsp; 🕘 <b>PO History</b> (GR / invoice status) &nbsp;·&nbsp; 📦 <b>Goods Receipt</b> → MIGO &nbsp;·&nbsp; 🧾 <b>Invoice Verification</b> → MIRO</p>
       <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
       <button class="btn" onclick="toast('🖨️ PO 4500123984 sent to printer LOCL — spool 100234','info')">🖨️ Print PO</button>
       <button class="btn" onclick="startScenario('migo')">📦 Goods Receipt (MIGO)</button>
       <button class="btn" onclick="startScenario('ml81n')">🧾 Service Entry Sheet</button></div></div>`,
     autofill:{}, primary:{label:'✓ Done — Display PO', cls:'btn-green', handler:'finishGeneric'}},
  ]
},
ml81n:{
  id:'ml81n', tcode:'ML81N', title:'Service Entry Sheet', module:'MM · Materials Management', icon:'🧾', color:'#0891b2',
  objective:'Create a <b>Service Entry Sheet</b> for PO 4500123984 — record the laptop installation service, accept it, and save.',
  docType:'Service Entry Sheet', docPrefix:'1000001234',
  steps:[
    {title:'Enter the T-Code', desc:'ML81N — Create Service Entry Sheet', instruction:'Type <b>ML81N</b> and press Enter.',
     body:()=>`<div class="display-block"><h5>📟 Command Field</h5><button class="btn btn-primary" onclick="document.getElementById('cmdInput').value='ML81N';routeTcode('ML81N')">▶ Open ML81N</button></div>`, autofill:{}},
    {title:'Header — PO & Entry Sheet Type', desc:'PO 4500123984', instruction:'Enter the PO number the service belongs to.',
     body:()=>`${fgOpen()}
       ${fld('Purchase Order Number','ses_po','','e.g. <code>4500123984</code>',true)}
       ${sel('Entry Sheet Type','ses_type',[['','— Select —'],['ES','ES — Service Entry Sheet']],'ES','',true)}
       ${fld('Service Org','ses_org','1000','',false)}
       ${fld('Entry Date','ses_date',today(),'',false)}</div>`,
     autofill:{ses_po:'4500123984',ses_type:'ES',ses_org:'1000',ses_date:'11/10/2026'}},
    {title:'Service Lines & Accept', desc:'Installation service · 500.00', instruction:'Enter the service line and tick <b>Accept</b> to accept the service as rendered.',
     body:()=>`${gtOpen()}<table><thead><tr><th>Item</th><th>Service *</th><th>Description *</th><th>Qty *</th><th>Unit</th><th>Price *</th><th>Accept</th></tr></thead><tbody>
       <tr><td class="ro">10</td><td><input id="ses_svc" class="req-field" placeholder="SVC-INST"></td><td><input id="ses_desc" class="req-field" placeholder="Installation & Setup"></td>
       <td><input id="ses_qty" class="req-field" type="number" placeholder="1" oninput="updateSESTotal()"></td><td><input id="ses_unit" value="AU"></td>
       <td><input id="ses_price" class="req-field" type="number" placeholder="500.00" oninput="updateSESTotal()"></td>
       <td><input type="checkbox" id="ses_accept" checked style="width:18px;height:18px"></td></tr></tbody></table></div>
       ${totalOpen()}<span>Service Value:</span><b id="sesTotal">0.00 USD</b></div>`,
     autofill:{ses_svc:'SVC-INST',ses_desc:'Installation & Setup',ses_qty:'1',ses_unit:'AU',ses_price:'500.00'}},
    {title:'Save the Entry Sheet', desc:'Create SES 1000001234', instruction:'Click <b>[ 💾 Save ]</b>. The accepted service can now be invoiced via MIRO.',
     body:()=>`<div class="display-block"><h5>💾 Ready to Save</h5><p class="tip">Saving creates Service Entry Sheet <b>1000001234</b> with status <b>Accepted</b>.</p></div>`,
     autofill:{}, primary:{label:'💾 Save', cls:'btn-green', handler:'saveSES'}},
  ]
},
output:{
  id:'output', tcode:'MB90', title:'* Output Processing for Matl Documents', module:'MM · Materials Management', icon:'🖨️', color:'#475569',
  objective:'Produce <b>output (print)</b> for a material document — the goods receipt created by MIGO (4900012345).',
  docType:'Material Document Output', docPrefix:'SPOOL-100234',
  steps:[
    {title:'Enter the T-Code', desc:'MB90 — Print List of Material Documents', instruction:'Type <b>MB90</b> and press Enter. (Output processing = printing / sending the material document.)',
     body:()=>`<div class="display-block"><h5>📟 Command Field</h5><button class="btn btn-primary" onclick="document.getElementById('cmdInput').value='MB90';routeTcode('MB90')">▶ Open MB90</button></div>`, autofill:{}},
    {title:'Selection Screen', desc:'Material document & output device', instruction:'Enter the material document and output device, then Execute.',
     body:()=>`${fgOpen()}
       ${fld('Material Document','out_doc','','e.g. <code>4900012345</code> (from MIGO)',true)}
       ${fld('Plant','out_plant','1000','',true)}
       ${sel('Output Device','out_dev',[['LOCL','LOCL — Local Printer'],['PDF','PDF — Save as PDF'],['EMAIL','EMAIL — Send by Mail']],'LOCL','',false)}
       ${sel('Output Type','out_type',[['GR','GR — Goods Receipt'],['GI','GI — Goods Issue']],'GR','',false)}
       </div>`,
     autofill:{out_doc:'4900012345',out_plant:'1000',out_dev:'LOCL',out_type:'GR'}, primary:{label:'▶ Execute — Print Preview', cls:'btn-primary', handler:'execOutput'}},
    {title:'Print Preview', desc:'Check the output before printing', instruction:'Review the print preview of the material document.',
     body:()=>`<div id="outPreview" style="display:${state.outputDoc?'block':'none'}"><div class="print-preview">
       <div class="pp-head"><h4>Material Document — Goods Receipt</h4><p style="margin:2px 0;color:#666">Plant 1000 · Storage Location 0001 · <span id="ppDoc">${esc(state.outputDoc||'4900012345')}</span></p></div>
       <table><thead><tr><th>Item</th><th>Material</th><th>Description</th><th>Qty</th><th>Unit</th></tr></thead><tbody>
       <tr><td>1</td><td>MAT-4402</td><td>Laptop Enterprise Edition</td><td>50</td><td>PC</td></tr></tbody></table>
       <p style="margin-top:10px;color:#666">PO Reference: 4500123984 · Posting Date: 11/10/2026 · User: ENTERPRISE_USER</p></div></div>
       <p class="tip" id="outPreviewHint" style="display:${state.outputDoc?'none':'block'}">⚠️ Run Execute on the previous step to generate the preview.</p>`,
     autofill:{}},
    {title:'Print / Output', desc:'Send to output device', instruction:'Click <b>[ 🖨️ Print ]</b> to send the document to the output device.',
     body:()=>`<div class="display-block"><h5>🖨️ Ready to Output</h5><p class="tip">Output will be spooled to <b>LOCL</b> (or your selected device) with spool number <b>100234</b>.</p></div>`,
     autofill:{}, primary:{label:'🖨️ Print', cls:'btn-green', handler:'printOutput'}},
  ]
},
migo:{
  id:'migo', tcode:'MIGO', title:'Goods Movement', module:'MM · Materials Management', icon:'📦', color:'#d97706',
  objective:'Post a <b>Goods Receipt</b> for PO 4500123984 — move <b>50 laptops</b> into stock (Plant 1000 / Stor. Loc 0001).',
  docType:'Material Document', docPrefix:'4900012345',
  steps:[
    {title:'Enter the T-Code', desc:'MIGO — Goods Movement', instruction:'Type <b>MIGO</b> and press Enter.',
     body:()=>`<div class="display-block"><h5>📟 Command Field</h5><button class="btn btn-primary" onclick="document.getElementById('cmdInput').value='MIGO';routeTcode('MIGO')">▶ Open MIGO</button></div>`, autofill:{}},
    {title:'Select Goods Receipt & PO', desc:'R10 · PO 4500123984', instruction:'Choose <b>Goods Receipt</b> and enter the PO number.',
     body:()=>`${fgOpen()}
       ${sel('Movement Type','migo_type',[['R10','R10 — Goods Receipt'],['R11','R11 — Goods Issue'],['R02','R02 — Transfer Posting']],'R10','',true)}
       ${fld('Purchase Order','migo_po','','e.g. <code>4500123984</code>',true)}
       ${fld('Posting Date','migo_date',today(),'',false)}</div>`,
     autofill:{migo_type:'R10',migo_po:'4500123984',migo_date:'11/10/2026'}},
    {title:'Item — Quantity & Storage', desc:'50 PC · Plant 1000 / 0001', instruction:'Enter the quantity to receive and the storage location.',
     body:()=>`${gtOpen()}<table><thead><tr><th>Item</th><th>Material</th><th>Qty *</th><th>Unit</th><th>Plant</th><th>Stor. Loc *</th><th>Batch</th></tr></thead><tbody>
       <tr><td class="ro">1</td><td>MAT-4402</td><td><input id="migo_qty" class="req-field" type="number" placeholder="50" oninput="updateMIGOStock()"></td><td>PC</td>
       <td>1000</td><td><input id="migo_stor" class="req-field" value="0001"></td><td><input id="migo_batch" placeholder="B-2026-11"></td></tr></tbody></table></div>
       <div class="display-block"><h5>📊 Stock Preview — MAT-4402 / Plant 1000 / 0001</h5>
       <div class="kv"><span>Current unrestricted stock</span><b>120 PC</b></div>
       <div class="kv"><span>After this goods receipt</span><b id="migoAfter">170 PC</b></div>
       <div class="stock-bar"><div id="migoBar" style="width:71%"></div></div>
       <p class="tip">120 → <b id="migoAfter2">170</b> PC (preview updates as you type the quantity).</p></div>`,
     autofill:{migo_qty:'50',migo_stor:'0001',migo_batch:'B-2026-11'}},
    {title:'Check & Post', desc:'Post the goods receipt', instruction:'Click <b>[ 💾 Post ]</b>. SAP posts the material document and updates stock.',
     body:()=>`<div class="display-block"><h5>💾 Ready to Post</h5><p class="tip">Posting creates Material Document <b>4900012345</b> and increases stock of MAT-4402 by 50 PC. You can then print it via <b>* Output Processing for Matl Documents (MB90)</b>.</p></div>
       ${gtOpen()}<table><thead><tr><th>Mat. Doc</th><th>Item</th><th>Movement</th><th>Material</th><th>Qty</th><th>PO Ref</th><th>Posting Date</th><th>Status</th></tr></thead><tbody>
       <tr><td class="ro">4900012344</td><td>1</td><td>101 GR</td><td>MAT-4410</td><td>20 PC</td><td>4500123971</td><td>11/06/2026</td><td>🟢 Posted</td></tr>
       <tr><td class="ro">4900012345</td><td>1</td><td>101 GR (new)</td><td>MAT-4402</td><td>50 PC</td><td>4500123984</td><td>11/10/2026</td><td>⏳ To be posted</td></tr></tbody></table></div>`,
     autofill:{}, primary:{label:'💾 Post', cls:'btn-green', handler:'postMIGO'}},
  ]
},
me51n:{
  id:'me51n', tcode:'ME51N', title:'Create Purchase Requisition', module:'MM · Materials Management', icon:'📝', color:'#16a34a',
  objective:'Create a <b>Purchase Requisition (PR)</b> for 50 laptops — the internal request that triggers procurement. Then release it.',
  docType:'Purchase Requisition', docPrefix:'10001234',
  steps:[
    {title:'Enter the T-Code', desc:'ME51N — Create Purchase Requisition', instruction:'Type <b>ME51N</b> and press Enter.',
     body:()=>`<div class="display-block"><h5>📟 Command Field</h5><button class="btn btn-primary" onclick="document.getElementById('cmdInput').value='ME51N';routeTcode('ME51N')">▶ Open ME51N</button></div>`, autofill:{}},
    {title:'Header — PR Type & Org', desc:'NB · 1000 / 001 / Plant 1000', instruction:'Enter the PR type and purchasing organization.',
     body:()=>`${fgOpen()}
       ${sel('PR Type','pr_type',[['NB','NB — Standard'],['D','D — Services']],'NB','',true)}
       ${fld('Purch. Org','pr_porg','','e.g. <code>1000</code>',true)}
       ${fld('Pur. Group','pr_pgroup','','e.g. <code>001</code>',true)}
       ${fld('Plant','pr_plant','','e.g. <code>1000</code>',true)}</div>`,
     autofill:{pr_type:'NB',pr_porg:'1000',pr_pgroup:'001',pr_plant:'1000'}},
    {title:'Item — What Is Needed', desc:'50 laptops · needed by 11/20/2026', instruction:'Enter the material, quantity and delivery date.',
     body:()=>`${gtOpen()}<table><thead><tr><th>Item</th><th>Material *</th><th>Short Text *</th><th>Qty *</th><th>Unit</th><th>Delivery Date *</th></tr></thead><tbody>
       <tr><td class="ro">10</td><td><input id="pr_mat" class="req-field" placeholder="MAT-4402"></td><td><input id="pr_text" class="req-field" placeholder="Laptop Enterprise Edition"></td>
       <td><input id="pr_qty" class="req-field" type="number" placeholder="50"></td><td>PC</td><td><input id="pr_date" class="req-field" placeholder="11/20/2026"></td></tr></tbody></table></div>
       <p class="tip">Requester: Warehouse (Plant 1000). Reason: replacement laptops for the IT refresh.</p>`,
     autofill:{pr_mat:'MAT-4402',pr_text:'Laptop Enterprise Edition',pr_qty:'50',pr_date:'11/20/2026'}},
    {title:'Save & Release', desc:'Create PR 10001234 · Released', instruction:'Click <b>[ 💾 Save ]</b>, then <b>Release</b> the PR so Purchasing can convert it to a PO (ME21N).',
     body:()=>`<div class="display-block"><h5>💾 Ready to Save</h5><p class="tip">Saving creates PR <b>10001234</b>. Releasing sets its status to <b>Released</b> — ready for ME21N.</p></div>`,
     autofill:{}, primary:{label:'💾 Save & Release', cls:'btn-green', handler:'savePR'}},
  ]
},
me53n:{
  id:'me53n', tcode:'ME53N', title:'* Display Purchase Requisition', module:'MM · Materials Management', icon:'👁️', color:'#db2777',
  objective:'Display Purchase Requisition <b>10001234</b> — who requested what, when it is needed, and its release status.',
  docType:'Purchase Requisition', docPrefix:'10001234',
  steps:[
    {title:'Enter the T-Code', desc:'ME53N — Display Purchase Requisition', instruction:'Type <b>ME53N</b> and press Enter.',
     body:()=>`<div class="display-block"><h5>📟 Command Field</h5><button class="btn btn-primary" onclick="document.getElementById('cmdInput').value='ME53N';routeTcode('ME53N')">▶ Open ME53N</button></div>`, autofill:{}},
    {title:'Enter PR Number & Execute', desc:'10001234', instruction:'Enter the PR number and click <b>Execute</b>.',
     body:()=>`${fgOpen()}${fld('Purchase Requisition','dpr_num','','e.g. <code>10001234</code>',true)}</div>
       <div id="dprResult" style="display:none">
       <div class="display-block"><h5>Header</h5>
         <div class="kv"><span>PR Type</span><b>NB — Standard</b></div>
         <div class="kv"><span>Purch. Org / Group</span><b>1000 / 001</b></div>
         <div class="kv"><span>Plant</span><b>1000</b></div>
         <div class="kv"><span>Status</span><b>🟢 Released</b></div>
         <div class="kv"><span>Requester</span><b>Warehouse — Plant 1000</b></div></div>
       ${gtOpen()}<table><thead><tr><th>Item</th><th>Material</th><th>Short Text</th><th>Qty</th><th>Unit</th><th>Delivery Date</th></tr></thead><tbody>
         <tr><td class="ro">10</td><td>MAT-4402</td><td>Laptop Enterprise Edition</td><td>50</td><td>PC</td><td>11/20/2026</td></tr></tbody></table></div></div>`,
     autofill:{dpr_num:'10001234'}, primary:{label:'▶ Execute', cls:'btn-primary', handler:'execDisplayPR'}},
    {title:'Review & Convert to PO', desc:'Next: ME21N', instruction:'A released PR can be converted into a Purchase Order. Jump to <b>Create Purchase Order (ME21N)</b> to continue the Procure-to-Pay flow.',
     body:()=>`<div class="display-block"><h5>🔁 Next Step</h5><p class="tip">PR 10001234 → <b>ME21N</b> (Create PO) → <b>MIGO</b> (Goods Receipt) → <b>MIRO</b> (Invoice). That is the full Procure-to-Pay chain.</p>
       <button class="btn btn-primary" onclick="startScenario('me21n')">🛒 Create Purchase Order (ME21N)</button></div>`,
     autofill:{}, primary:{label:'✓ Done — Display PR', cls:'btn-green', handler:'finishGeneric'}},
  ]
},
mm03:{
  id:'mm03', tcode:'MM03', title:'Display Material Master', module:'MM · Materials Management', icon:'🔍', color:'#0a6ed1',
  objective:'Display Material Master for <b>MAT-4402</b> — the catalog record for the laptops used in all MM simulations.',
  docType:'Material Master', docPrefix:'MAT-4402',
  steps:[
    {title:'Enter the T-Code', desc:'MM03 — Display Material Master', instruction:'Type <b>MM03</b> and press Enter.',
     body:()=>`<div class="display-block"><h5>📟 Command Field</h5><button class="btn btn-primary" onclick="document.getElementById('cmdInput').value='MM03';routeTcode('MM03')">▶ Open MM03</button></div>`, autofill:{}},
    {title:'Enter Material & Execute', desc:'MAT-4402', instruction:'Enter the material number and click <b>Execute</b>.',
     body:()=>`${fgOpen()}${fld('Material','mm_mat','','e.g. <code>MAT-4402</code>',true)}</div>
       <div id="mmResult" style="display:none">
       <div class="display-block"><h5>Basic Data 1</h5>
         <div class="kv"><span>Material</span><b>MAT-4402</b></div>
         <div class="kv"><span>Description</span><b>Laptop Enterprise Edition</b></div>
         <div class="kv"><span>Base Unit</span><b>PC</b></div>
         <div class="kv"><span>Material Type</span><b>ROH — Raw Material / Finished</b></div>
         <div class="kv"><span>Industry Sector</span><b>ELEC — Electronics</b></div></div>
       <div class="display-block"><h5>Plant Data (Plant 1000)</h5>
         <div class="kv"><span>Storage Location</span><b>0001 — Main Warehouse</b></div>
         <div class="kv"><span>Unrestricted Stock</span><b>120 PC</b></div>
         <div class="kv"><span>Reorder Point</span><b>20 PC</b></div></div></div>`,
     autofill:{mm_mat:'MAT-4402'}, primary:{label:'▶ Execute', cls:'btn-primary', handler:'execMM03'}},
    {title:'Review', desc:'Read-only display', instruction:'MM03 is display-only. Use <b>MM01</b> to create or <b>MM02</b> to change a material master.',
     body:()=>`<div class="display-block"><h5>✅ Done</h5><p class="tip">Material MAT-4402 is stocked in Plant 1000 / 0001 with 120 PC — the same stock MIGO will increase to 170 PC.</p></div>`,
     autofill:{}, primary:{label:'✓ Done — MM03', cls:'btn-green', handler:'finishGeneric'}},
  ]
},
va03:{
  id:'va03', tcode:'VA03', title:'Display Sales Order', module:'SD · Sales & Distribution', icon:'👁️', color:'#7c3aed',
  objective:'Display Sales Order <b>14002395</b> created in Simulation 2.',
  docType:'Sales Order', docPrefix:'14002395',
  steps:[
    {title:'Enter the T-Code', desc:'VA03 — Display Sales Order', instruction:'Type <b>VA03</b> and press Enter.',
     body:()=>`<div class="display-block"><h5>📟 Command Field</h5><button class="btn btn-primary" onclick="document.getElementById('cmdInput').value='VA03';routeTcode('VA03')">▶ Open VA03</button></div>`, autofill:{}},
    {title:'Enter Order Number & Execute', desc:'14002395', instruction:'Enter the sales order number and click <b>Execute</b>.',
     body:()=>`${fgOpen()}${fld('Sales Order','va03_num','','e.g. <code>14002395</code>',true)}</div>
       <div id="va03Result" style="display:none">
       <div class="display-block"><h5>Header</h5>
         <div class="kv"><span>Order Type</span><b>OR — Standard Order</b></div>
         <div class="kv"><span>Sold-to Party</span><b>CUST-5002 — Apex Retail Corp</b></div>
         <div class="kv"><span>Customer PO</span><b>PO-99821</b></div>
         <div class="kv"><span>Delivery Date</span><b>11/15/2026</b></div>
         <div class="kv"><span>Status</span><b>🟢 Open — ATP confirmed</b></div></div>
       ${gtOpen()}<table><thead><tr><th>Item</th><th>Material</th><th>Description</th><th>Qty</th><th>Unit</th><th>Price</th></tr></thead><tbody>
         <tr><td class="ro">10</td><td>ELEC-100</td><td>Industrial Power Inverter</td><td>10</td><td>PC</td><td>850.00</td></tr></tbody></table></div>
       ${totalOpen()}<span>Order Value:</span><b>8,500.00 USD</b></div></div>`,
     autofill:{va03_num:'14002395'}, primary:{label:'▶ Execute', cls:'btn-primary', handler:'execVA03'}},
    {title:'Review', desc:'Read-only display', instruction:'VA03 is display-only. Use <b>VA02</b> to change or <b>VA01</b> to create a sales order.',
     body:()=>`<div class="display-block"><h5>✅ Done</h5><p class="tip">Order 14002395 is confirmed for delivery on 11/15/2026 — the ATP result from Simulation 2.</p></div>`,
     autofill:{}, primary:{label:'✓ Done — VA03', cls:'btn-green', handler:'finishGeneric'}},
  ]
},
fbl3n:{
  id:'fbl3n', tcode:'FBL3N', title:'G/L Account Line Item Display', module:'FI · Financial Accounting', icon:'📊', color:'#107e3e',
  objective:'Display G/L line items for account <b>400000 (Electricity Expense)</b> — including the FB50 document 100004921 from Simulation 3.',
  docType:'G/L Line Items', docPrefix:'400000',
  steps:[
    {title:'Enter the T-Code', desc:'FBL3N — G/L Line Item Display', instruction:'Type <b>FBL3N</b> and press Enter.',
     body:()=>`<div class="display-block"><h5>📟 Command Field</h5><button class="btn btn-primary" onclick="document.getElementById('cmdInput').value='FBL3N';routeTcode('FBL3N')">▶ Open FBL3N</button></div>`, autofill:{}},
    {title:'Selection & Execute', desc:'Account 400000 · CoCode 1000', instruction:'Enter the G/L account and company code, then click <b>Execute</b>.',
     body:()=>`${fgOpen()}
       ${fld('G/L Account','fbl_acct','','e.g. <code>400000</code>',true)}
       ${fld('Company Code','fbl_co','','e.g. <code>1000</code>',true)}</div>
       <div id="fblResult" style="display:none">
       ${gtOpen()}<table><thead><tr><th>Doc. No.</th><th>Posting Date</th><th>Text</th><th>Debit</th><th>Credit</th><th>Balance</th></tr></thead><tbody>
         <tr><td class="ro">100004921</td><td>11/10/2026</td><td>Utility Bill — Oct 2026</td><td>450.00</td><td>—</td><td>450.00 D</td></tr>
         <tr><td class="ro">100004850</td><td>10/10/2026</td><td>Utility Bill — Sep 2026</td><td>430.00</td><td>—</td><td>430.00 D</td></tr>
         <tr><td class="ro">100004701</td><td>09/10/2026</td><td>Utility Bill — Aug 2026</td><td>410.00</td><td>—</td><td>410.00 D</td></tr>
       </tbody></table></div>
       ${totalOpen()}<span>Total Balance (400000):</span><b>1,290.00 USD Debit</b></div></div>`,
     autofill:{fbl_acct:'400000',fbl_co:'1000'}, primary:{label:'▶ Execute', cls:'btn-primary', handler:'execFBL3N'}},
    {title:'Review', desc:'Check account balances', instruction:'FBL3N shows every posting to the account. Document <b>100004921</b> from FB50 is the newest line.',
     body:()=>`<div class="display-block"><h5>✅ Done</h5><p class="tip">Tip: <b>FBL3N</b> for G/L accounts · <b>FBL1N</b> for vendors · <b>FBL5N</b> for customers.</p></div>`,
     autofill:{}, primary:{label:'✓ Done — FBL3N', cls:'btn-green', handler:'finishGeneric'}},
  ]
},
};

/* ================= HELPERS ================= */
function captureForm(){
  if(state.view!=='sim') return;
  document.querySelectorAll('input,select').forEach(el=>{ if(el.id) state.formCache[el.id]=el.value; });
}
function restoreForm(){
  Object.keys(state.formCache).forEach(id=>{ const el=$(id); if(el && state.formCache[id]!=null) el.value=state.formCache[id]; });
  // refresh live calcs
  if($('me21_qty')) updatePOTotal();
  if($('va_qty')) updateSOTotal();
  if($('fb1_amt')) updateFBBalance();
  if($('ses_qty')) updateSESTotal();
  if($('migo_qty')) updateMIGOStock();
  if($('fbBalance')||$('fbBalance2')) updateFBBalance();
  // refresh summaries
  if($('sumVendor')) refreshPOSummary();
}
function toast(msg,type){
  const w=$('toastWrap'); const t=document.createElement('div');
  t.className='toast '+(type||''); t.innerHTML=`<span>${type==='err'?'⛔':type==='info'?'ℹ️':'✅'}</span><span>${msg}</span>`;
  w.appendChild(t); setTimeout(()=>{ t.style.opacity='0'; t.style.transition='opacity .4s'; setTimeout(()=>t.remove(),400); },4200);
}
function setStatus(msg,type){
  state.status={msg,type:type||'ok'}; renderStatusBar();
}
/* status bar text only — cheap path used by the clock */
function refreshStatusClock(){
  if(state.mode!=='gui') return;
  const el=$('statusBar'); if(!el) return;
  const cells=el.querySelectorAll('.gsb-c');
  const last=cells[cells.length-2];
  if(!last) return;
  const now=new Date();
  last.textContent=String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0')+':'+String(now.getSeconds()).padStart(2,'0');
}
function renderStatusBar(){
  const el=$('statusBar'); if(!el) return;
  if(state.mode==='gui'){
    const ico = state.status.type==='err' ? '🔴' : state.status.type==='info' ? '🔵' : '🟢';
    const now=new Date();
    const hm=String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0')+':'+String(now.getSeconds()).padStart(2,'0');
    el.className='gui-statusbar';
    el.innerHTML=`<span class="gsb-sys">${ico}</span><span class="gsb-msg" id="statusMsg">${esc(state.status.msg)}</span>
      <span class="gsb-spacer"></span>
      <span class="gsb-c">PRD (1)</span><span class="gsb-c">100</span><span class="gsb-c">EN</span>
      <span class="gsb-c">${hm}</span><span class="gsb-c gsb-user">ENTERPRISE_USER</span>`;
    return;
  }
  const dot = state.status.type==='err'?'err':state.status.type==='info'?'info':'';
  el.className='statusbar';
  el.innerHTML=`<span class="sdot ${dot}"></span><span id="statusMsg">${esc(state.status.msg)}</span><span class="spacer"></span>
    <span class="mono">Fiori · S/4HANA · Client 100 · ENTERPRISE_USER</span>`;
}
function showSys(type,html){
  const el=$('sysResponse'); if(!el) return;
  if(el.classList.contains('gsys')){
    el.className='gsys gsys-'+type;
    el.innerHTML=`<span class="gmsg-ico">${type==='err'?'🔴':type==='info'?'🔵':'🟢'}</span> <span>${html}</span>`;
    return;
  }
  el.className='sys-response show '+type; el.innerHTML=html;
}
function sysSpinner(text){ showSys('info',`<span class="spin"></span><span>${text}</span>`); }
function sysOk(text){ showSys('ok', text); }
function sysErr(text){ showSys('err', text); }
function validateRequired(){
  let ok=true;
  document.querySelectorAll('.req-field').forEach(el=>{
    const bad = !el.value || !String(el.value).trim();
    el.classList.toggle('invalid',bad); if(bad) ok=false;
  });
  return ok;
}
function clearDocs(){
  if(!confirm('Clear all saved (simulated) documents from this browser?')) return;
  state.documents=[]; saveDocs(); render();
  setStatus('Document list cleared.','info'); toast('🗑️ Document list cleared','info');
}
function addDocument(type,number,scenarioId){
  if(state.documents.some(d=>d.number===number)) return;
  state.documents.unshift({type,number,scenarioId,date:today()}); saveDocs();
}
function markProgress(scenarioId,step,completed,docNumber){
  state.progress[scenarioId]={step,completed:!!completed,docNumber:docNumber||null}; saveProgress();
}
function simStatus(id){
  const p=state.progress[id];
  if(p && p.completed) return {cls:'done', label:`✅ Completed — ${p.docNumber||''}`};
  if(p && p.step>0) return {cls:'prog', label:`▶ In progress — Step ${p.step+1}`};
  return {cls:'', label:'○ Not started'};
}

/* ================= LIVE CALCS ================= */
function updatePOTotal(){
  const q=parseFloat(($('me21_qty')||{}).value)||0, p=parseFloat(($('me21_price')||{}).value)||0;
  const el=$('poTotal'); if(el) el.textContent=fmt(q*p)+' USD';
  refreshPOSummary();
}
function refreshPOSummary(){
  if(!$('sumVendor')) return;
  const gv=(id)=>{ const el=$(id); return (el&&el.value)||state.formCache[id]||''; };
  $('sumVendor').textContent=gv('me21_vendor')||'—';
  $('sumMat').textContent=gv('me21_mat')||'—';
  $('sumQty').textContent=(gv('me21_qty')||'—')+' PC';
  const q=parseFloat(gv('me21_qty'))||0, p=parseFloat(gv('me21_price'))||0;
  $('sumTotal').textContent=fmt(q*p)+' USD';
}
function updateSOTotal(){
  const q=parseFloat(($('va_qty')||{}).value)||0, p=parseFloat(($('va_price')||{}).value)||0;
  const el=$('soTotal'); if(el) el.textContent=fmt(q*p)+' USD';
}
function fbCalc(){
  // read from the live inputs, falling back to the cached form values when a field is not on screen
  const val=id=>{ const el=$(id); return el?el.value:(state.formCache[id]!==undefined?state.formCache[id]:''); };
  let d=0,c=0;
  [['fb1_dc','fb1_amt'],['fb2_dc','fb2_amt']].forEach(([dc,amt])=>{
    const v=parseFloat(val(amt))||0;
    if(val(dc)==='D') d+=v; else c+=v;
  });
  return d-c;
}
function updateFBBalance(){
  const bal=fbCalc(), ok=Math.abs(bal)<0.005;
  [['fbBalance','fbTraffic','fbBalVal','fbBalMsg'],['fbBalance2','fbTraffic2','fbBalVal2','fbBalMsg2']].forEach(([box,tr,val,msg])=>{
    const b=$(box); if(!b) return;
    b.className='balance-box '+(ok?'ok':'bad');
    $(tr).className='traffic '+(ok?'green':'red');
    $(val).textContent=fmt(Math.abs(bal))+' USD';
    $(msg).textContent= ok?'🟢 Debit equals Credit — ready to post.':`🔴 Out of balance by ${fmt(Math.abs(bal))} — Debit must equal Credit.`;
  });
}
function updateSESTotal(){
  const q=parseFloat(($('ses_qty')||{}).value)||0, p=parseFloat(($('ses_price')||{}).value)||0;
  const el=$('sesTotal'); if(el) el.textContent=fmt(q*p)+' USD';
}
function updateMIGOStock(){
  const q=parseFloat(($('migo_qty')||{}).value)||0, after=120+q;
  if($('migoAfter')) $('migoAfter').textContent=after+' PC';
  if($('migoAfter2')) $('migoAfter2').textContent=after;
  if($('migoBar')) $('migoBar').style.width=Math.min(100,after/2)+'%';
}

/* ================= NAVIGATION ================= */
function setMode(m){
  captureForm();
  state.mode=m; localStorage.setItem('sapMode',m);
  document.body.dataset.mode=m;
  render();
  const label = m==='fiori' ? '✨ Fiori (S/4HANA)' : '🖥️ SAP GUI for Windows (ECC)';
  toast(`Switched to ${label} — 1 click, your step &amp; entries are kept ✓`,'info');
  setStatus(`Mode: ${label}. Progress preserved.`,'info');
}
function goHome(){ captureForm(); state.view='home'; state.scenarioId=null; render(); window.scrollTo({top:0}); }
function startScenario(id){
  captureForm();
  state.view='sim'; state.scenarioId=id; state.step=0; state.completed=false; state.docNumber=null; state.doneSteps=[];
  // clear cached fields belonging to this scenario so it starts fresh
  const sc=SCENARIOS[id];
  if(sc) sc.steps.forEach(s=>Object.keys(s.autofill||{}).forEach(k=>delete state.formCache[k]));
  markProgress(id,0,false,null);
  render(); window.scrollTo({top:0});
  setStatus(`${sc.tcode} — ${sc.title} opened.`,'info');
}
function goStep(n){
  captureForm();
  const sc=SCENARIOS[state.scenarioId];
  state.step=Math.max(0,Math.min(n,sc.steps.length-1));
  if(!state.doneSteps.includes(state.step)) state.doneSteps.push(state.step);
  markProgress(state.scenarioId,state.step,false,null);
  render(); window.scrollTo({top:0});
}
function nextStep(){
  if(state.busy){ toast('⏳ The system is still processing — one moment…','info'); return; }
  captureForm();
  const sc=SCENARIOS[state.scenarioId];
  if(!validateRequired()){
    sysErr('⚠️ Please fill all required fields marked <b>*</b> before continuing.');
    setStatus('Validation failed — required fields missing.','err');
    toast('Fill the required (*) fields first','err'); return;
  }
  if(state.step < sc.steps.length-1){ goStep(state.step+1); return; }
  if(state.completed) return;
  // last step: run its Save/Post/Print action if there is one, otherwise finish with the document number
  const p=stepPrimary(sc, state.step);
  if(p && !/finish/i.test(p.handler)) runAction(p.handler);
  else completeScenario(sc.docPrefix);
}
function stepPrimary(sc, idx){ return (sc.steps[idx]||{}).primary || null;
}
function prevStep(){ if(state.step>0) goStep(state.step-1); }
function autoFill(){
  const sc=SCENARIOS[state.scenarioId]; const step=sc.steps[state.step];
  Object.entries(step.autofill||{}).forEach(([id,v])=>{ const el=$(id); if(el){ el.value=v; state.formCache[id]=v; } });
  document.querySelectorAll('.req-field').forEach(el=>el.classList.remove('invalid'));
  restoreForm();
  toast('✨ Step auto-filled — review &amp; click Next','info');
  setStatus('Auto-fill applied for this step.','info');
}
function resetScenario(){
  const id=state.scenarioId;
  delete state.progress[id]; saveProgress();
  startScenario(id);
}
function routeTcode(raw){
  const code=String(raw||'').trim().toUpperCase();
  if(!code){ toast('Enter a T-Code first, e.g. ME21N','err'); return; }
  if(code==='/N'){ goHome(); setStatus('Returned to SAP Easy Access ( /N ).','info'); return; }
  const id=TCODE_MAP[code];
  if(id){ startScenario(id); return; }
  // keyword search (Fiori-style)
  const lower=code.toLowerCase();
  for(const [re,sid] of KEYWORD_MAP){ if(re.test(lower)){ startScenario(sid); return; } }
  sysErr(`Transaction ${esc(code)} does not exist. Try: ME21N · VA01 · FB50 · ME23N · ML81N · MB90 · MIGO · ME51N · ME53N`);
  setStatus(`Transaction ${code} does not exist.`,'err');
  toast(`Unknown T-Code: ${esc(code)}`,'err');
}
function cmdGo(){ const v=$('cmdInput')?$('cmdInput').value:''; routeTcode(v); }
function finishGeneric(){
  const sc=SCENARIOS[state.scenarioId];
  completeScenario(sc.docPrefix);
}
function completeScenario(docNumber, scenarioId, stepIdx){
  const id = scenarioId || state.scenarioId;
  const sc = SCENARIOS[id];
  if(!sc) return;
  const doneStep = (stepIdx!=null) ? stepIdx : (state.scenarioId===id ? state.step : 0);
  if(state.scenarioId === id){ state.completed=true; state.docNumber=docNumber; }
  addDocument(sc.docType,docNumber,id);
  markProgress(id,doneStep,true,docNumber);
  if(state.scenarioId !== id) return; // user already navigated away — record the document, don't hijack the screen
  setStatus(`${sc.docType} ${docNumber} created successfully.`,'ok');
  render(); window.scrollTo({top:0});
}
/* UI-only timer: cancelled if the user leaves the scenario mid-action (prevents stale messages on another transaction) */
function later(ms, fn){
  const id=state.scenarioId, step=state.step;
  return setTimeout(()=>{
    if(state.view!=='sim' || state.scenarioId!==id) return;
    fn(id, step);
  }, ms);
}
/* Commit timer: always records the document for the scenario it was started from, but never hijacks the screen
   if the user has already moved on (e.g. clicked Save and immediately opened another Favorite). */
function laterCommit(ms, fn){
  const id=state.scenarioId, step=state.step;
  state.busy=true;
  return setTimeout(()=>{
    try{ fn(id, step); } finally { state.busy=false; }
  }, ms);
}

/* ================= ACTION HANDLERS ================= */
const HANDLERS = {
  checkPO(){
    if(!validateRequired()){ sysErr('⚠️ Fill the header &amp; item fields first (go back to Steps 2–3).'); return; }
    sysSpinner('Checking PO consistency…');
    later(900,()=>{
      sysOk('<b>No messages issued during check.</b> Vendor, material, plant &amp; pricing are valid.'); setStatus('Check: No messages issued during check.','ok'); toast('🟢 Check passed — no messages');
    });
  },
  savePO(){
    sysSpinner('Saving Purchase Order…');
    laterCommit(900,(id, step)=>{
      completeScenario('4500123984', id, step); toast('💾 Standard PO 4500123984 created');
    });
  },
  runATP(){
    sysSpinner('Running ATP check against Plant 1000 stock…');
    later(1100,()=>{
      const r=$('atpResult');
      if(r) r.innerHTML=`<div class="atp-box"><b>🟢 Item 10 is available.</b><br><span class="tip">Material ELEC-100 · Plant 1000 · Unrestricted stock: 85 PC · Committed: 15 PC · <b>Available: 70 PC</b> · Delivery scheduled for <b>11/15/2026</b>.</span></div>`;
      sysOk('<b>ATP confirmed:</b> Item 10 available — delivery 11/15/2026.'); setStatus('ATP: Item 10 available. Delivery 11/15/2026.','ok');
    });
  },
  saveSO(){
    sysSpinner('Saving Sales Order…');
    laterCommit(900,(id, step)=>{
      completeScenario('14002395', id, step); toast('💾 Standard Order 14002395 saved');
    });
  },
  verifyFB(){
    updateFBBalance();
    if(Math.abs(fbCalc())<0.005){ sysOk('<b>🟢 Balance: 0.00 USD</b> — Debit equals Credit.'); setStatus('Balance check: 0.00 USD (green).','ok'); }
    else { sysErr('<b>Out of balance!</b> Go back to Step 3 and fix the amounts.'); setStatus('Balance check failed — out of balance.','err'); }
  },
  postFI(){
    if(Math.abs(fbCalc())>=0.005){ sysErr('Cannot post — document is out of balance. Fix Step 3 first.'); return; }
    sysSpinner('Posting G/L document…');
    laterCommit(900,(id, step)=>{
      completeScenario('100004921', id, step); toast('💾 Document 100004921 posted in Company Code 1000');
    });
  },
  execDisplayPO(){
    if(!validateRequired()){ sysErr('⚠️ Enter the PO number first.'); return; }
    sysSpinner('Reading PO 4500123984…');
    later(700,()=>{
      const r=$('dpoResult'); if(r) r.style.display='block'; sysOk('PO 4500123984 displayed.'); setStatus('ME23N: PO 4500123984 displayed.','ok');
    });
  },
  execDisplayPR(){
    if(!validateRequired()){ sysErr('⚠️ Enter the PR number first.'); return; }
    sysSpinner('Reading PR 10001234…');
    later(700,()=>{
      const r=$('dprResult'); if(r) r.style.display='block'; sysOk('PR 10001234 displayed — status Released.'); setStatus('ME53N: PR 10001234 displayed.','ok');
    });
  },
  execMM03(){
    if(!validateRequired()){ sysErr('⚠️ Enter the material number first.'); return; }
    sysSpinner('Reading material master…');
    later(700,()=>{
      const r=$('mmResult'); if(r) r.style.display='block'; sysOk('Material MAT-4402 displayed.'); setStatus('MM03: MAT-4402 displayed.','ok');
    });
  },
  execVA03(){
    if(!validateRequired()){ sysErr('⚠️ Enter the order number first.'); return; }
    sysSpinner('Reading sales order…');
    later(700,()=>{
      const r=$('va03Result'); if(r) r.style.display='block'; sysOk('Sales Order 14002395 displayed.'); setStatus('VA03: Order 14002395 displayed.','ok');
    });
  },
  execFBL3N(){
    if(!validateRequired()){ sysErr('⚠️ Enter G/L account &amp; company code first.'); return; }
    sysSpinner('Reading G/L line items…');
    later(700,()=>{
      const r=$('fblResult'); if(r) r.style.display='block'; sysOk('Line items for 400000 displayed — incl. doc 100004921.'); setStatus('FBL3N: Account 400000 displayed.','ok');
    });
  },
  execOutput(){
    if(!validateRequired()){ sysErr('⚠️ Enter the material document first.'); return; }
    sysSpinner('Generating print preview…');
    later(800,()=>{
const doc=($('out_doc')||{}).value||state.formCache.out_doc||'4900012345';
      state.outputDoc=doc; state.formCache.out_doc=doc;
      sysOk(`Print preview ready for material document ${esc(doc)}. Go to the next step to print.`); setStatus('MB90: Print preview generated.','ok');
    });
  },
  printOutput(){
    sysSpinner('Sending output to device…');
    laterCommit(900,(id, step)=>{
      completeScenario('SPOOL-100234', id, step); toast('🖨️ Output processed — spool 100234');
    });
  },
  saveSES(){
    if(!validateRequired()){ sysErr('⚠️ Fill the service lines first.'); return; }
    sysSpinner('Saving Service Entry Sheet…');
    laterCommit(900,(id, step)=>{
      completeScenario('1000001234', id, step); toast('💾 Service Entry Sheet 1000001234 saved — Accepted');
    });
  },
  postMIGO(){
    if(!validateRequired()){ sysErr('⚠️ Enter quantity &amp; storage location first.'); return; }
    sysSpinner('Posting goods receipt…');
    laterCommit(1000,(id, step)=>{
      completeScenario('4900012345', id, step); toast('💾 Material Document 4900012345 posted — stock 120 → 170 PC');
    });
  },
  savePR(){
    if(!validateRequired()){ sysErr('⚠️ Fill the PR header &amp; item first.'); return; }
    sysSpinner('Saving &amp; releasing Purchase Requisition…');
    laterCommit(900,(id, step)=>{
      completeScenario('10001234', id, step); toast('💾 PR 10001234 created &amp; Released');
    });
  },
};
function runAction(name){
  if(state.busy){ toast('⏳ The system is still processing — one moment…','info'); return; }
  captureForm();
  // re-apply cached values of fields that are not on the current screen so validation on later steps still works
  Object.keys(state.formCache).forEach(id=>{ const el=$(id); if(el && el.value!==state.formCache[id]) el.value=state.formCache[id]; });
  if(HANDLERS[name]) HANDLERS[name](); else if(typeof window[name]==='function') window[name]();
}

/* ================= RENDER ================= */
function render(){
  document.body.dataset.mode=state.mode;
  const app=$('app');
  if(state.mode==='gui'){
    // Authentic SAP GUI for Windows desktop shell — on the home screen and on every step
    app.innerHTML = state.view==='sim' ? renderGuiSim() : renderGuiHome();
  } else {
    app.innerHTML = renderHeader() + renderFavBar() + `<div class="layout">${renderSidebar()}<main class="main" id="main">${state.view==='sim'?renderSim():renderHome()}</main></div>` + renderStatusBarHTML() + `<div class="footer-note">SAP Simulation for learning — SAP GUI (ECC) &amp; Fiori (S/4HANA) in one app. Data is simulated locally in your browser; no real SAP system is connected.</div>`;
  }
  renderStatusBar();
  restoreForm();
  updateClock();
  // finished scenarios show a green success view — make sure the status bar reflects it
  if(state.view==='sim' && state.completed && state.docNumber){
    const sc=SCENARIOS[state.scenarioId];
    if(sc && !state.status.msg.startsWith(sc.docType)) setStatus(`${sc.docType} ${state.docNumber} has been saved.`,'ok');
  }
}
function renderHeader(){
  const fiori = state.mode==='fiori';
  return `<header class="topbar"><div class="topbar-inner">
    <div class="logo"><div class="logo-badge">SAP<span>®</span></div>
      <div class="logo-text"><b>${fiori?'SAP Fiori Launchpad':'SAP Easy Access'}</b><small>${fiori?'S/4HANA · Fiori Apps':'SAP GUI · ECC · Client 100'}</small></div></div>
    <div class="sysinfo">
      <span><span class="dot"></span>System <b>PRD</b></span>
      <span>Client <b>100</b></span><span>Production</span>
      <span>User <b>ENTERPRISE_USER</b></span>
    </div>
    <div class="topbar-right">
      <span class="clock" id="clockEl">—</span>
      <div class="mode-toggle" role="tablist" aria-label="Switch SAP experience">
        <button class="${!fiori?'active':''}" onclick="setMode('gui')" title="Classic SAP GUI (ECC)">🖥️ SAP GUI (ECC)</button>
        <button class="${fiori?'active':''}" onclick="setMode('fiori')" title="Modern Fiori (S/4HANA)">✨ Fiori (S/4HANA)</button>
      </div>
      <div class="userchip"><div class="avatar">EU</div><span>ENTERPRISE_USER</span></div>
    </div></div></header>
  <div class="cmdbar"><div class="cmdbar-inner">
    <div class="cmd-label">${fiori?'🔍 Search Apps':'⌨️ Command Field'}<small>${fiori?'Type an app name or T-Code — e.g. “Create Purchase Order” or ME21N':'Enter a Transaction Code (T-Code)'}</small></div>
    <div class="cmd-input">
      <input id="cmdInput" placeholder="${fiori?'Search apps… e.g. ME21N, purchase order, journal':'e.g. ME21N, VA01, FB50, MIGO…  (/N = home)'}" onkeydown="if(event.key==='Enter')cmdGo()" autocomplete="off">
      <button class="btn btn-primary" onclick="cmdGo()">${fiori?'🔍 Search':'▶ Execute'}</button>
    </div>
    <div class="cmd-hints"><span>Try:</span>
      ${['ME21N','VA01','FB50','ME23N','ML81N','MB90','MIGO','ME51N','ME53N','/N'].map(c=>`<span class="tcode-chip" onclick="document.getElementById('cmdInput').value='${c}';routeTcode('${c}')">${c}</span>`).join('')}
    </div></div></div>`;
}
function renderFavBar(){
  const fiori = state.mode==='fiori';
  const items = FAVORITES.map(f=>{
    const active = state.view==='sim' && state.scenarioId===f.id;
    const st = simStatus(f.id);
    return `<button class="fav-item ${active?'active':''}" onclick="startScenario('${f.id}')" title="${esc(f.desc)} — ${f.tcode}">
      <span class="fav-icon" style="background:${f.color}">${f.icon}</span>
      <span><span class="fav-name">${f.starred?'<span class="fav-star">★</span> ':''}${esc(fiori&&fioriName(f.id)?fioriName(f.id):f.name)}</span><br><span class="fav-tcode">${f.tcode}</span>${st.cls==='done'?' <span style="color:var(--sap-green);font-weight:800">✓</span>':''}</span>
    </button>`;
  }).join('');
  return `<div class="favbar"><div class="favbar-inner">
    <div class="fav-head"><h3>⭐ ${fiori?'My Favorite Apps':'Favorites'}</h3><span class="count">${FAVORITES.length} pinned</span>
    <p>${fiori?'Your pinned Fiori apps — tap any tile to open it.':'Your pinned transactions — click any favorite to open it. Same in both modes.'}</p></div>
    <div class="fav-list">${items}</div></div></div>`;
}
function renderSidebar(){
  if(state.mode==='fiori') return '';
  const node=(label,tcode,sim,active)=>`<div class="menu-node ${active?'active':''}" onclick="${sim?`startScenario('${sim}')`:`toast('Open ${tcode} from the command field or Favorites','info')`}"><span class="arrow">›</span> ${label} ${tcode?`<span class="menu-badge">${tcode}</span>`:''}</div>`;
  const is=(id)=>state.view==='sim'&&state.scenarioId===id;
  return `<aside class="sidebar">
    <div class="menu-card"><div class="menu-card-head"><span>📂 SAP Menu</span><span style="font-size:11px;opacity:.8">ECC</span></div>
    <div class="menu-tree">
      <div class="menu-node" onclick="goHome()"><span class="arrow">▾</span> 📂 <b>Logistics</b></div>
      <div class="menu-children">
        <div class="menu-node"><span class="arrow">▾</span> 📂 Materials Management (MM)</div>
        <div class="menu-children">
          ${node('Create Purchase Order','ME21N','me21n',is('me21n'))}
          ${node('Display Purchase Order','ME23N','me23n',is('me23n'))}
          ${node('Create Purchase Requisition','ME51N','me51n',is('me51n'))}
          ${node('Display Purchase Requisition','ME53N','me53n',is('me53n'))}
          ${node('Service Entry Sheet','ML81N','ml81n',is('ml81n'))}
          ${node('Goods Movement','MIGO','migo',is('migo'))}
          ${node('* Output Processing for Matl Docs','MB90','output',is('output'))}
          ${node('Display Material Master','MM03','mm03',is('mm03'))}
        </div>
        <div class="menu-node"><span class="arrow">▾</span> 📂 Sales and Distribution (SD)</div>
        <div class="menu-children">
          ${node('Create Sales Order','VA01','va01',is('va01'))}
          ${node('Display Sales Order','VA03','va03',is('va03'))}
        </div>
      </div>
      <div class="menu-node" onclick="goHome()"><span class="arrow">▾</span> 📂 <b>Financial Accounting (FI)</b></div>
      <div class="menu-children">
        ${node('Enter G/L Account Document','FB50','fb50',is('fb50'))}
        ${node('G/L Line Item Display','FBL3N','fbl3n',is('fbl3n'))}
      </div>
      <div class="menu-node" onclick="goHome()"><span class="arrow">›</span> ⭐ Favorites (${FAVORITES.length})</div>
    </div></div>
    <div class="side-note"><b>⚠️ Use code with caution.</b>Training simulation — Client 100, Production look-alike. No real postings are made.</div>
    <div class="side-note" style="background:#e3f0fd;border-color:#bcd9f7;color:#0b3a66"><b>✨ 1-click Fiori</b>Flip the toggle in the top bar to S/4HANA Fiori — same documents, same step, modern tiles.</div>
  </aside>`;
}
function renderStatusBarHTML(){ return `<div class="statusbar" id="statusBar"></div>`; }

/* ================= SAP GUI FOR WINDOWS DESKTOP ================= */
/* Everything from the Windows window chrome down to the SAP status bar. */

const GUI_MENU = [
  ['SAP Easy Access', goHome],
  ['SAP Business Workplace', ()=>toast('🖥️ SAP Business Workplace — no messages','info')],
  ['Functional area', ()=>toast('🖥️ Functional area: Logistics / Accounting','info')],
  ['Quick links', ()=>toast('🖥️ Quick links: ME21N · VA01 · FB50','info')],
  ['Refresh', ()=>render()],
  ['Exit', goHome],
];

function shellMenuItems(items){
  return items.map(([label, fn],i)=>{
    const slot='__menu'+i;
    (window.__menuFns=window.__menuFns||{})[slot]=fn;
    return `<button class="gmenu-item" onclick="runMenu('${slot}')">${esc(label)}</button>`;
  }).join('');
}
function runMenu(slot){
  const fn=(window.__menuFns||{})[slot];
  if(typeof fn==='function') fn();
}

/* Classic SAP GUI icon toolbar button: icon + tiny label underneath */
function guiBtn(icon, label, onclick, opts){
  const o=opts||{};
  return `<button class="gtb-btn ${o.cls||''}" onclick="${onclick}" ${o.disabled?'disabled':''} title="${esc(o.title||label)}">
    <span class="gtb-ico">${icon}</span><span class="gtb-lbl">${esc(label)}</span></button>`;
}

function renderGuiShell(inner, opts){
  const o=opts||{};
  const pic=o.picture||{icon:'🖥️', line1:'SAP Easy Access', line2:'SAP Easy Access Menu'};
  const title=o.windowTitle||'SAP Easy Access';
  const transaction=o.transaction||null;
  const menus = o.menus || GUI_MENU;
  return `
  <div class="sapdesktop" data-mode="gui">
    <div class="sapwin">
      <div class="sapwin-title">
        <span class="swt-ico">🪟</span>
        <span class="swt-text">${esc(title)}</span>
        <span class="swt-ctrl"><span>—</span><span>▢</span><span class="x">✕</span></span>
      </div>

      <div class="sapmenubar">${shellMenuItems(menus)}<span class="spacer"></span><span class="gmenu-conn">PRD (1) 100 · ENTERPRISE_USER</span></div>

      <div class="saptoolbar">
        <div class="gtb-group">
          ${guiBtn('⬅','Back','guiBack()',{title:'Back (F3)'})}
          ${guiBtn('➡','Exit','guiExit()',{title:'Exit (Shift+F3)'})}
          ${guiBtn('🚪','Log off','guiLogoff()',{title:'Log off'})}
          ${guiBtn('🚩','Print','guiPrint()',{title:'Print (Ctrl+P)'})}
          ${guiBtn('🔎','Find','guiFind()',{title:'Find'})}
          ${guiBtn('⌚','Clock','toast(\'🕐 Local time — system time is shown in the status bar\',\'info\')',{title:'Time'})}
        </div>
        <div class="gtb-sep"></div>
        ${transaction
          ? `<div class="gtb-group">${guiBtn('📄','Enter','nextStep()',{cls:'primary',title:'Enter / Next step'})}
             ${guiBtn('💡','Tip','toggleGuiTip()',{title:'Show / hide the guided tip'})}</div>`
          : `<div class="gtb-group">${guiBtn('⊕','Create','guiHint()',{title:'Create'})}
             ${guiBtn('📂','Open','guiHint()')}
             ${guiBtn('💾','Save','guiHint()')}</div>`}
        <span class="spacer"></span>
        <div class="gtb-group">
          ${guiBtn('🖥️ SAP GUI','','',{cls:'mode',title:'You are in SAP GUI (ECC)'})}
          ${guiBtn('✨','Fiori','setMode(\'fiori\')',{cls:'mode-flip',title:'Switch to Fiori (S/4HANA) — 1 click'})}
        </div>
      </div>

      <div class="sapwin-screen">
        <div class="gcmdbar">
          <span class="gcmd-ico">▸</span>
          <div class="gcmd-box"><input id="cmdInput" placeholder="${transaction?esc(transaction.parent)+' · '+esc(transaction.tcode):'Transaction code'}" value="${transaction?esc(transaction.tcode):''}" onkeydown="if(event.key==='Enter')cmdGo()" autocomplete="off" spellcheck="false"></div>
          <button class="gcmd-go" onclick="cmdGo()" title="Enter">⏎</button>
          <span class="gcmd-spacer"></span>
          <span class="gcmd-sys">PRD (1) 100 · ${o.production===false?'Development':'Production'}</span>
        </div>
        <div class="gscreen-body" id="gscreenBody">
          ${inner}
        </div>
      </div>

      <div class="gui-statusbar" id="statusBar"></div>
    </div>
    <div class="gui-hintline">🖥️ SAP GUI for Windows (ECC) · Client 100 · PRD — a faithful simulation, not a real SAP system. Switch to <b>✨ Fiori</b> any time with the toolbar button (top right).</div>
  </div>`;
}

/* Standard SAP screen title row */
function guiTitle(t){
  return `<table class="gtitle"><tbody><tr>
    <td class="gtitle-l">${esc(t.line1||'')}</td>
    <td class="gtitle-r">${esc(t.line2||'')}</td></tr></tbody></table>`;
}
/* Transaction title: "Create Purchase Order" */
function guiTcodeTitle(tcode, name){
  return `<table class="gtitle"><tbody><tr>
    <td class="gtitle-l">${esc(name)}</td>
    <td class="gtitle-r"><b>${esc(tcode)}</b></td></tr></tbody></table>`;
}

/* Screen wrapper: title + optional tabstrip + body */
function guiScreen(inner, t){
  return `<div class="gscreen">
    ${t ? guiTitle(t) : ''}
    ${inner}
  </div>`;
}

/* Tabstrip (like "Item Overview | Header | ...") */
function guiTabs(tabs, activeIdx){
  return `<div class="gtabs">${tabs.map((t,i)=>
    `<span class="gtab ${i===activeIdx?'active':''}" onclick="${t.onclick||'void 0'}">${esc(t.label||t)}</span>`).join('')}</div>`;
}

/* Field legend box — the classic SAP "group box" with a titled frame */
function guiGroup(title, inner, cols){
  return `<fieldset class="ggroup"><legend>${esc(title)}</legend>
    <div class="gfields ${cols?('cols'+cols):''}">${inner}</div></fieldset>`;
}

/* SAP input: label left, input right (label box 210px) */
function gf(label, id, opts){
  const o=opts||{};
  const val=o.value!=null?o.value:'';
  const req=o.req;
  return `<div class="gf ${req?'gf-req':''}">
    <label class="gf-l" for="${id}">${esc(label)}${req?'<span class="gf-asterix">*</span>':''}</label>
    <span class="gf-c">
      <input id="${id}" class="gf-i ${req?'req-field':''}" value="${esc(val)}" ${o.type?`type="${o.type}"`:''} ${o.placeholder?`placeholder="${esc(o.placeholder)}"`:''} ${o.oninput?`oninput="${o.oninput}"`:''} autocomplete="off">
      ${o.unit?`<span class="gf-unit">${esc(o.unit)}</span>`:''}
      ${o.hint?`<span class="gf-hint">${o.hint}</span>`:''}
    </span></div>`;
}
function gfSel(label, id, options, opts){
  const o=opts||{};
  const optsHTML=options.map(x=>`<option value="${esc(x[0])}" ${String(x[0])===String(o.value)?'selected':''}>${esc(x[1])}</option>`).join('');
  return `<div class="gf ${o.req?'gf-req':''}">
    <label class="gf-l" for="${id}">${esc(label)}${o.req?'<span class="gf-asterix">*</span>':''}</label>
    <span class="gf-c"><select id="${id}" class="gf-i ${o.req?'req-field':''}">${optsHTML}</select>
    ${o.hint?`<span class="gf-hint">${o.hint}</span>`:''}</span></div>`;
}
/* Read-only display field */
function gfRO(label, value){
  return `<div class="gf"><span class="gf-l">${esc(label)}</span><span class="gf-c"><span class="gf-ro">${esc(value)}</span></span></div>`;
}

/* Classic SAP grid (ALV-ish) with header bar */
function guiGrid(headers, rows, opts){
  const o=opts||{};
  return `<div class="ggrid ${o.scroll?'scroll':''}"><table>
    <thead><tr>${headers.map(h=>`<th ${h.w?`style="width:${h.w}"`:''}>${esc(h.label!=null?h.label:h)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c==null?'':c}</td>`).join('')}</tr>`).join('')}</tbody>
  </table></div>`;
}
/* Editable SAP grid cell */
function gcell(id, opts){
  const o=opts||{};
  return `<input id="${id}" class="ggrid-i ${o.req?'req-field':''}" value="${esc(o.value!=null?o.value:'')}" ${o.type?`type="${o.type}"`:''} ${o.placeholder?`placeholder="${esc(o.placeholder)}"`:''} ${o.oninput?`oninput="${o.oninput}"`:''} ${o.ro?'readonly':''}>`;
}

/* Bottom-of-screen message line, like SAP's "No messages issued" row */
function guiMessages(){
  return `<div class="gmsgrow"><span class="gmsg-dot"></span><span id="sysResponse" class="gsys">No messages issued during check.</span></div>`;
}

/* F4 value-help hint (the little yellow box) */
function guiHint(text){
  return `<div class="gvaluehelp">💡 ${text}</div>`;
}
function toggleGuiTip(){
  const el=$('guiTip'); if(el) el.classList.toggle('hidden');
}
function guiBack(){
  if(state.view!=='sim'){ toast('🖥️ You are already at SAP Easy Access','info'); return; }
  if(state.step>0) goStep(state.step-1);
  else goHome();
}
function guiExit(){
  if(state.view==='sim'){ setStatus('Transaction closed — back at SAP Easy Access.','info'); goHome(); }
  else goHome();
}
function guiLogoff(){ goHome(); setStatus('Logoff from system PRD — you are back at SAP Easy Access.','info'); toast('🚪 Logged off (simulated)','info'); }
function guiPrint(){ toast('🖨️ Print dialog — output device LOCL (spool 100234)','info'); setStatus('Print: output device LOCL selected.','info'); }
function guiFind(){ if($('cmdInput')){ $('cmdInput').focus(); $('cmdInput').select(); } toast('🔎 Find — type a T-Code or app name','info'); }

/* ---- SAP Easy Access (GUI home) ---- */
function renderGuiHome(){
  const is=(id)=>state.view==='sim'&&state.scenarioId===id;
  const node=(label,tcode,sim,indent,opened)=>{
    const st=sim?simStatus(sim):null;
    const mark = st && st.cls==='done' ? ' <span class="gtree-ok">✔</span>' : '';
    return `<div class="gtree-node l${indent} ${sim&&is(sim)?'active':''}" onclick="startScenario('${sim}')">
      ${opened?'<span class="gtree-arrow">⊟</span>':'<span class="gtree-arrow">⊞</span>'}
      <span class="gtree-ico">${opened?'📂':'📄'}</span>
      <span class="gtree-lab">${esc(label)}</span>${mark}
      ${tcode?`<span class="gtree-tc">${esc(tcode)}</span>`:''}</div>`;
  };
  const favRows = FAVORITES.map(f=>{
    const st=simStatus(f.id);
    return `<tr onclick="startScenario('${f.id}')" class="grow-link">
      <td class="gtd-fav">${f.starred?'★ ':''}${esc(f.name)}</td>
      <td class="gtd-tc">${f.tcode}</td>
      <td class="gtd-st">${st.cls==='done'?'<span class="gtree-ok">✔ saved</span>':esc(st.label)}</td></tr>`;
  }).join('');

  const tree = `
  <div class="geasy-access">
    <div class="gtree-head"><span>📂</span> <b>SAP Easy Access</b><span class="gtree-spacer"></span><span class="gtree-fav">★ ${FAVORITES.length}</span></div>
    <div class="gtree">
      <div class="gtree-node l0"><span class="gtree-arrow">⊟</span><span class="gtree-ico">📁</span><span class="gtree-lab"><b>Favorites</b></span></div>
      ${FAVORITES.map(f=>`<div class="gtree-node l1" onclick="startScenario('${f.id}')"><span class="gtree-arrow">└</span><span class="gtree-ico">⭐</span><span class="gtree-lab">${f.starred?'★ ':''}${esc(f.name)}</span><span class="gtree-tc">${f.tcode}</span></div>`).join('')}
      <div class="gtree-node l0"><span class="gtree-arrow">⊟</span><span class="gtree-ico">📁</span><span class="gtree-lab"><b>Logistics</b></span></div>
      <div class="gtree-node l1"><span class="gtree-arrow">⊟</span><span class="gtree-ico">📂</span><span class="gtree-lab">Materials Management</span></div>
      <div class="gtree-node l2" onclick="startScenario('me21n')"><span class="gtree-arrow">└</span><span class="gtree-ico">📄</span><span class="gtree-lab">Purchasing</span><span class="gtree-tc">MM</span></div>
      ${node('Create Purchase Order','ME21N','me21n',3)}
      ${node('Display Purchase Order','ME23N','me23n',3)}
      ${node('Create Purchase Requisition','ME51N','me51n',3)}
      ${node('Display Purchase Requisition','ME53N','me53n',3)}
      ${node('Service Entry Sheet','ML81N','ml81n',3)}
      ${node('Goods Movement','MIGO','migo',3)}
      ${node('* Output Processing for Matl Documents','MB90','output',3)}
      ${node('Display Material Master','MM03','mm03',3)}
      <div class="gtree-node l1"><span class="gtree-arrow">⊟</span><span class="gtree-ico">📂</span><span class="gtree-lab">Sales and Distribution</span></div>
      ${node('Create Sales Order','VA01','va01',3)}
      ${node('Display Sales Order','VA03','va03',3)}
      <div class="gtree-node l0"><span class="gtree-arrow">⊟</span><span class="gtree-ico">📁</span><span class="gtree-lab"><b>Accounting</b></span></div>
      <div class="gtree-node l1"><span class="gtree-arrow">⊟</span><span class="gtree-ico">📂</span><span class="gtree-lab">Financial Accounting</span></div>
      ${node('Enter G/L Account Document','FB50','fb50',3)}
      ${node('G/L Line Item Display','FBL3N','fbl3n',3)}
    </div>
  </div>`;

  const work = `
  <div class="gworkarea">
    ${guiTitle({line1:'SAP Easy Access', line2:'SAP Easy Access Menu'})}
    <div class="gwork-cols">
      <div class="gwork-main">
        <div class="gmenu-title">SAP Easy Access</div>
        <div class="gwork-list">
          <div class="gwork-row" onclick="startScenario('me21n')"><span class="gwr-ico">🛒</span><span class="gwr-lab"><b>Create Purchase Order</b><small>ME21N · 5 steps · Procure-to-Pay</small></span><span class="gwr-tc">ME21N</span></div>
          <div class="gwork-row" onclick="startScenario('va01')"><span class="gwr-ico">📦</span><span class="gwr-lab"><b>Create Sales Order</b><small>VA01 · 6 steps · Order-to-Cash</small></span><span class="gwr-tc">VA01</span></div>
          <div class="gwork-row" onclick="startScenario('fb50')"><span class="gwr-ico">💼</span><span class="gwr-lab"><b>Enter G/L Account Document</b><small>FB50 · 5 steps · Finance</small></span><span class="gwr-tc">FB50</span></div>
          <div class="gwork-sep">Favorites — pinned in this menu and in the tree</div>
          ${FAVORITES.map(f=>`<div class="gwork-row" onclick="startScenario('${f.id}')"><span class="gwr-ico">${f.icon}</span><span class="gwr-lab"><b>${f.starred?'★ ':''}${esc(f.name)}</b><small>${esc(f.desc)}</small></span><span class="gwr-tc">${f.tcode}</span></div>`).join('')}
        </div>
        <div class="gvaluehelp" style="margin-top:10px">💡 <b>How to drive it like the real thing:</b> type a T-Code in the command field (top left) and press <b>Enter</b>, or double-click any node in the tree. The toolbar's <b>Back / Exit / Log off</b> icons work too.</div>
      </div>
      <div class="gwork-side">
        <div class="gside-box"><div class="gside-head">My Documents</div>
          ${state.documents.length ? `<table class="gside-table">${state.documents.slice(0,8).map(d=>`<tr onclick="startScenario('${d.scenarioId}')" class="grow-link"><td>${esc(d.type)}</td><td class="gtd-tc">${esc(d.number)}</td></tr>`).join('')}</table>` : `<div class="gside-empty">No documents yet — run a transaction and save.</div>`}
        </div>
        <div class="gside-box"><div class="gside-head">System Info</div>
          <table class="gside-table">
            <tr><td>System</td><td><b>PRD (1)</b></td></tr>
            <tr><td>Client</td><td><b>100</b></td></tr>
            <tr><td>User</td><td><b>ENTERPRISE_USER</b></td></tr>
            <tr><td>Language</td><td><b>EN</b></td></tr>
            <tr><td>Date</td><td><b>11/10/2026</b></td></tr>
          </table>
        </div>
      </div>
    </div>
  </div>`;

  return renderGuiShell(`
    <div class="geasy-wrap">${tree}${work}</div>
    <div class="gstatusarea">
      <div class="gstatus-auto">Your Favorites (${FAVORITES.length})</div>
      ${guiGrid(['Favorite','T-Code','Status'], FAVORITES.map(f=>{
        const st=simStatus(f.id);
        return [`<a onclick="startScenario('${f.id}')">★ ${esc(f.name)}</a>`, f.tcode, st.cls==='done'?'✔ '+esc(st.label):esc(st.label)];
      }))}
    </div>`,
    {windowTitle:'SAP Easy Access', picture:{icon:'🖥️',line1:'SAP Easy Access',line2:'SAP Easy Access Menu'}});
}

/* ---- GUI screen for a transaction step ---- */
const GUI_TABS = {
  me21n:['Header','Item Overview','Delivery/Invoicing','Conditions','Account Assignment'],
  va01:['Header','Item Overview','Order Header','Business Data'],
  fb50:['Basic Data','Line Items','Tax'],
  me23n:['Header','Item Overview','PO History','Status'],
  ml81n:['Header 1','Header 2','Service Lines'],
  output:['Selection','Output'],
  migo:['Header','Item','Output'],
  me51n:['Header','Item Overview','Requisition Notes'],
  me53n:['Header','Item Overview','Release'],
  mm03:['Basic Data','Sales','Purchasing'],
  va03:['Header','Item Overview','Conditions'],
  fbl3n:['Selection','Line Items'],
};
const GUI_TAB_BY_STEP = {
  me21n:[0,0,1,1,1], va01:[0,0,0,1,1,1], fb50:[0,0,1,1,1], me23n:[0,1,1,3],
  ml81n:[0,0,2,2], output:[0,0,1,1], migo:[0,0,1,1], me51n:[0,0,1,1],
  me53n:[0,1,1,2], mm03:[0,0,0], va03:[0,1,1,1], fbl3n:[0,1,1],
};
const GUI_STEP_LABEL = {
  me21n:['Initial Screen','Header Data','Item Overview','Check','Save'],
  va01:['Initial Screen','Order Type','Order Header','Item Overview','Availability','Save'],
  fb50:['Initial Screen','Document Header','Line Items','Balance','Post'],
  me23n:['Command Field','Selection','Purchase Order'],
  ml81n:['Command Field','Header','Service Lines','Save'],
  output:['Command Field','Selection','Print Preview','Print'],
  migo:['Command Field','Goods Receipt','Item Data','Post'],
  me51n:['Command Field','Header','Item Overview','Save'],
  me53n:['Command Field','Selection','Purchase Requisition'],
  mm03:['Command Field','Selection','Material Master'],
  va03:['Command Field','Selection','Sales Order'],
  fbl3n:['Command Field','Selection','Line Items'],
};

/* Guided reference panel that keeps the wizard teaching intact, docked on the right like an SAP side panel */
function guiGuidePanel(sc, step, idx){
  const total=sc.steps.length;
  const rows=sc.steps.map((s,i)=>{
    const done=state.completed || (state.doneSteps.includes(i)&&i<state.step);
    const cur=i===state.step && !state.completed;
    return `<div class="gteam-step ${done?'done':''} ${cur?'cur':''}">
      <span class="gts-n">${done?'✔':i+1}</span><span class="gts-t">${esc(GUI_STEP_LABEL[sc.id]&&GUI_STEP_LABEL[sc.id][i]||s.title)}</span></div>`;
  }).join('');
  return `<div class="gteam">
    <div class="gteam-head">🎓 Guided Simulation</div>
    <div class="gteam-sub">${esc(sc.tcode)} · ${esc(sc.title)}</div>
    <div class="gteam-prog"><div style="width:${state.completed?100:Math.round(((idx)/Math.max(1,total-1))*100)}%"></div></div>
    <div class="gteam-body">${rows}</div>
    <div class="gteam-task"><b>Task ${idx+1} of ${total}</b><br>${step.desc||''}</div>
    <ol class="gteam-instr"><li>${step.instruction||''}</li></ol>
    <div class="gteam-actions">
      <button class="gbtn" onclick="prevStep()" ${idx===0?'disabled':''}>◀ Back</button>
      ${(step.autofill&&Object.keys(step.autofill).length)?`<button class="gbtn" onclick="autoFill()">💡 Fill values</button>`:''}
      <button class="gbtn gbtn-enter" onclick="nextStep()">${idx===total-1?'✔ Finish':'Enter ▶'}</button>
    </div>
    <div class="gteam-foot">Switch to <b>✨ Fiori</b> at the top right — your step and entries stay.</div>
  </div>`;
}

function renderGuiSim(){
  const sc=SCENARIOS[state.scenarioId];
  if(!sc) return renderGuiHome();
  const step=sc.steps[state.step];
  const allTabs=GUI_TABS[sc.id]||['Header','Items'];
  const activeTab=Math.min((GUI_TAB_BY_STEP[sc.id]||[])[state.step]||0, allTabs.length-1);
  // only show the tabs this transaction really opens during the guided steps (no dead tabs)
  const tabs=allTabs.slice(0, Math.max(...(GUI_TAB_BY_STEP[sc.id]||[0]).concat([0]))+1);
  const shownTab=Math.min(activeTab, tabs.length-1);

  let screenBody;
  if(state.completed){
    screenBody = `
      ${guiTcodeTitle(sc.tcode,'Display '+sc.docType)}
      ${guiTabs(tabs, 0)}
      <div class="gbox gbox-success">
        <div class="gsuccess-ico">✔</div>
        <div class="gsuccess-txt"><b>${esc(sc.docType)} ${esc(state.docNumber)} has been saved</b>
        <p>${esc(sc.title)} completed in ${state.mode==='gui'?'SAP GUI (ECC)':'Fiori'}. The document is now in the database of client 100.</p></div>
      </div>
      ${guiGroup('Document', guiGrid(['Document','Type','Company / Org','Status'],[
        [esc(state.docNumber), esc(sc.docType), esc(sc.module.replace('·','')), '✔ Posted / saved']]))}
      ${guiMessages()}
      <div class="gbtnrow">
        <button class="gbtn gbtn-enter" onclick="goHome()">✔ Continue</button>
        <button class="gbtn" onclick="resetScenario()">🔄 Restart ${sc.tcode}</button>
        <button class="gbtn" onclick="setMode('fiori')">✨ View in Fiori</button>
      </div>`;
  } else {
    const hasAuto = step.autofill && Object.keys(step.autofill).length>0;
    screenBody = `
      ${guiTcodeTitle(sc.tcode, step.title)}
      ${guiTabs(tabs, shownTab)}
      <div class="gscreen-scroll">
        <div class="ginstr"><b>📌 What to do:</b> ${step.instruction}</div>
        ${step.body()}
        ${guiMessages()}
        <div class="gbtnrow">
          <button class="gbtn" onclick="prevStep()" ${state.step===0?'disabled':''}>◀ Back</button>
          ${hasAuto?`<button class="gbtn" onclick="autoFill()">💡 Fill values</button>`:''}
          ${step.primary?`<button class="gbtn gbtn-enter" onclick="runAction('${step.primary.handler}')">${step.primary.label}</button>`:''}
          <span class="gbtn-spacer"></span>
          <button class="gbtn gbtn-enter" onclick="nextStep()">${state.step===sc.steps.length-1?'✔ Finish':'Enter ▶'}</button>
        </div>
      </div>`;
  }

  return renderGuiShell(`
    <div class="gsim-wrap">
      <div class="gsim-screen">${guiScreen(screenBody)}</div>
      ${guiGuidePanel(sc, step, state.step)}
    </div>`,
    {windowTitle:`${sc.tcode} — ${sc.title}`, transaction:{tcode:sc.tcode, parent:sc.module.split('·')[1]?sc.module.split('·')[1].trim():'SAP'}});
}

/* Fiori launchpad tile shown instead of the T-Code command field when in Fiori mode */
function fioriTileBody(sc){
  const name=fioriName(sc.id)||sc.title;
  const related=FAVORITES.filter(f=>f.id!==sc.id).slice(0,3);
  return `<div class="fiori-tilewrap">
    <div class="fiori-tile" onclick="toast('App opened from the launchpad — continue to the next step','info')">
      <span class="ft-icon" style="background:${sc.color}">${sc.icon}</span>
      <span class="ft-text"><b>${esc(name)}</b><small>${esc(sc.module)} · S/4HANA</small></span>
      <span class="ft-badge">Open</span>
    </div>
    <p class="tip" style="margin:10px 0 0">Underlying transaction in the classic GUI: <b style="font-family:var(--mono)">${sc.tcode}</b> — switch to SAP GUI (ECC) any time with the toggle at the top.</p>
  </div>
  <div class="display-block" style="margin-top:14px"><h5>🧩 Other apps in this area</h5>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      ${related.map(f=>`<button class="btn btn-sm" onclick="startScenario('${f.id}')">${f.icon} ${esc(fioriName(f.id)||f.name)}</button>`).join('')}
    </div></div>`;
}

function renderHome(){
  const fiori = state.mode==='fiori';
  const simCards = MAIN_SIMS.map(s=>{
    const st=simStatus(s.id);
    return `<article class="sim-card" style="--c:${s.color}">
      <div class="sim-top"><div class="sim-icon" style="background:${s.color}">${s.icon}</div>
        <div><div class="sim-module">${s.module}</div><h3>${s.title}</h3></div><span class="sim-tcode">${s.tcode}</span></div>
      <p>${s.objective}</p>
      <div class="sim-steps"><span>🧭 ${s.steps} steps</span><span>🎓 Guided + auto-fill</span><span>🔁 GUI ⇄ Fiori</span></div>
      <div class="sim-status ${st.cls}">${st.label}</div>
      <div class="sim-actions"><button class="btn btn-primary" onclick="startScenario('${s.id}')">▶ Start Simulation</button>
      <button class="btn" onclick="startScenario('${s.id}')">Open ${s.tcode}</button></div></article>`;
  }).join('');
  const favCards = FAVORITES.map(f=>{
    const st=simStatus(f.id);
    return `<article class="fav-card"><span class="fav-icon" style="background:${f.color}">${f.icon}</span>
      <div class="fav-card-body"><h4>${f.starred?'<span class="fav-star">★</span> ':''}${esc(fiori&&fioriName(f.id)?fioriName(f.id):f.name)}</h4><p>${esc(f.desc)}</p>
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap"><span class="fav-tcode">${f.tcode}</span>
      <span style="font-size:11px;font-weight:700;color:${st.cls==='done'?'var(--sap-green)':'var(--sap-muted)'}">${st.label}</span></div>
      <div style="margin-top:10px"><button class="btn btn-sm btn-primary" onclick="startScenario('${f.id}')">▶ Open</button></div></div></article>`;
  }).join('');
  const guideRows = QUICK_GUIDE.map(g=>`<tr><td>${g.mod}</td><td><span class="tcode-chip" onclick="routeTcode('${g.tcode}')">${g.tcode}</span></td><td>${g.what}</td>
    <td>${g.sim==='home'?'<button class="btn btn-sm" onclick="goHome()">🏠 Home</button>':`<button class="btn btn-sm" onclick="startScenario('${g.sim}')">▶ Try it</button>`}</td></tr>`).join('');
  const displayFor = id => ({me21n:'me23n', va01:'va03', fb50:'fbl3n', me51n:'me53n', migo:'output'}[id] || id);
  const docs = state.documents.length ? `<div class="doc-log">${state.documents.map(d=>{
      const disp=displayFor(d.scenarioId), dsc=SCENARIOS[disp]||{};
      return `<div class="doc-item">
      <span class="doc-type" style="background:${(SCENARIOS[d.scenarioId]||{}).color||'#0a6ed1'}">${esc(d.type)}</span>
      <span class="doc-num">${esc(d.number)}</span><span style="color:var(--sap-muted);font-size:12px">${esc(d.date)} · ENTERPRISE_USER</span>
      <span style="flex:1"></span>
      <button class="btn btn-sm" onclick="toast('📄 Document ${esc(d.number)} opened in read-only display','info')">📄 Details</button>
      <button class="btn btn-sm" onclick="startScenario('${disp}')">👁️ Display via ${dsc.tcode||disp.toUpperCase()}</button></div>`;
    }).join('')}
    <div style="display:flex;justify-content:flex-end"><button class="btn btn-sm" onclick="clearDocs()">🗑️ Clear document list</button></div></div>`
    : `<div class="empty-note">No documents yet. Complete a simulation (e.g. ME21N) and your PO / order / document will appear here — then open it again via <b>Display Purchase Order (ME23N)</b>.</div>`;
  return `
  <section class="hero">
    <h1>${fiori?'👋 Welcome to SAP Fiori Launchpad':'🖥️ Welcome to the SAP Easy Access Menu'}</h1>
    <p>Learn the three most common daily workflows across global enterprises — <b>Procure-to-Pay (MM)</b>, <b>Order-to-Cash (SD)</b> and <b>Finance &amp; Accounting (FI)</b> — as a step-by-step interactive simulation. Switch between <b>SAP GUI (ECC)</b> and <b>Fiori (S/4HANA)</b> with <b>1 click</b> at any moment; your current step and entries are kept.</p>
    <div class="hero-meta"><span class="pill">🖥️ SAP GUI · ECC</span><span class="pill">✨ Fiori · S/4HANA</span><span class="pill green">🔁 1-click switch — progress kept</span><span class="pill">⭐ ${FAVORITES.length} Favorites pinned</span></div>
  </section>

  <div class="section-title"><h2>🧭 The 3 Core Simulations</h2><span class="line"></span><p>Follow each wizard step-by-step. Type the values yourself or use ✨ Auto-fill. Every Save creates a real (simulated) document you can display later.</p></div>
  <div class="cards3">${simCards}</div>

  <div class="section-title"><h2>⭐ My Favorites</h2><span class="line"></span><p>Your ${FAVORITES.length} pinned transactions — always visible in the bar above, in both GUI and Fiori modes. ★ marks the two you starred.</p></div>
  <div class="fav-grid">${favCards}</div>

  <div class="section-title"><h2>🔍 Quick Guide: Essential SAP T-Codes</h2><span class="line"></span><p>Memorize these core navigation shortcuts — click any T-Code to try it live.</p></div>
  <div class="table-wrap"><table><thead><tr><th>Module</th><th>T-Code</th><th>What It Does</th><th></th></tr></thead><tbody>${guideRows}</tbody></table></div>

  <div class="section-title"><h2>🗂️ My Documents (this session)</h2><span class="line"></span><p>Everything you save in the simulations lands here.</p></div>
  ${docs}`;
}

function renderSim(){
  const sc=SCENARIOS[state.scenarioId];
  if(!sc) return renderHome();
  const step=sc.steps[state.step];
  const pct=Math.round(((state.step+ (state.completed?1:0))/sc.steps.length)*100);
  const dots=sc.steps.map((s,i)=>{
    const done=state.doneSteps.includes(i)&&i<state.step||state.completed;
    const cur=i===state.step&&!state.completed;
    return `<button class="step-dot ${done?'done':''} ${cur?'current':''}" onclick="goStep(${i})"><span class="n">${done?'✓':i+1}</span> ${esc(s.title)}</button>`;
  }).join('');
  const checklist=sc.steps.map((s,i)=>{
    const done=state.doneSteps.includes(i)&&i<state.step||state.completed;
    const cur=i===state.step&&!state.completed;
    return `<li class="${done?'done':''} ${cur?'current':''}"><span class="cb">${done?'✓':cur?'▶':i+1}</span><span>${esc(s.title)}</span></li>`;
  }).join('');
  let bodyHTML;
  if(state.completed){
    const rel=(RELATED[state.scenarioId]||[]).map(id=>{
      const f=FAVORITES.find(x=>x.id===id); const s2=SCENARIOS[id];
      if(!s2) return '';
      return `<button class="btn" onclick="startScenario('${id}')">${s2.icon} ${esc(f?f.name:s2.title)} (${s2.tcode})</button>`;
    }).join('');
    bodyHTML=`<div class="step-card"><div class="step-body"><div class="success-card">
      <div class="success-icon">✅</div><h3>${esc(sc.docType)} Created!</h3>
      <p style="color:var(--sap-muted);margin:0">Status bar: <b>${esc(sc.docType)} ${esc(state.docNumber)} has been saved</b></p>
      <div class="doc-number">${esc(state.docNumber)}</div>
      <p class="tip">Saved to <b>My Documents</b> on the home screen. Continue the chain with a related Favorite:</p>
      <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:14px 0">${rel}</div>
      <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
        <button class="btn btn-primary" onclick="goHome()">🏠 Back to Home</button>
        <button class="btn" onclick="resetScenario()">🔁 Restart ${sc.tcode}</button>
        <button class="btn" onclick="setMode('${state.mode==='gui'?'fiori':'gui'}')">${state.mode==='gui'?'✨ View in Fiori':'🖥️ View in SAP GUI'}</button>
      </div></div></div></div>`;
  } else {
    const hasAuto = step.autofill && Object.keys(step.autofill).length>0;
    const fioriMode = state.mode==='fiori';
    const isTcodeStep = /T-Code/i.test(step.title);
    const instr = (fioriMode && isTcodeStep)
      ? `Tap the Fiori app tile <b>${esc(fioriName(state.scenarioId)||sc.title)}</b> on your launchpad (or use the Search field: “${esc(fioriName(state.scenarioId)||sc.title)}”). Fiori apps have no T-Codes — the same task behind <b>${sc.tcode}</b>.`
      : step.instruction;
    const stepBody = (fioriMode && isTcodeStep) ? fioriTileBody(sc) : step.body();
    bodyHTML=`<div class="step-card">
      <div class="step-card-head"><span class="step-num">${state.step+1}</span>
        <div style="flex:1;min-width:200px"><h3>Step ${state.step+1} of ${sc.steps.length}: ${esc(step.title)}</h3><p>${esc(step.desc)}</p></div>
        <span class="sim-tcode">${sc.tcode}</span></div>
      <div class="step-body">
        <div class="instruction">📌 <b>What to do:</b> ${instr}</div>
        ${stepBody}
        <div id="sysResponse" class="sys-response"></div>
        <div class="step-actions">
          <button class="btn" onclick="prevStep()" ${state.step===0?'disabled':''}>← Back</button>
          ${hasAuto?`<button class="btn" onclick="autoFill()">✨ Auto-fill this step</button>`:''}
          <span class="spacer"></span>
          ${step.primary?`<button class="btn ${step.primary.cls}" onclick="runAction('${step.primary.handler}')">${step.primary.label}</button>`:''}
          <button class="btn btn-primary" onclick="nextStep()">${state.step===sc.steps.length-1?'Finish →':'Next →'}</button>
        </div>
        <p class="tip" style="margin-top:10px">💡 Switch to <b>${state.mode==='gui'?'Fiori (S/4HANA)':'SAP GUI (ECC)'}</b> with the 1-click toggle above — this step and your entries stay exactly here.</p>
      </div></div>`;
  }
  return `
  <div class="crumb"><button onclick="goHome()">🏠 Home</button><span>›</span><span>${esc(sc.module)}</span><span>›</span><b>${sc.tcode} — ${esc(sc.title)}</b>
    <span style="flex:1"></span><span>Mode: <b>${state.mode==='gui'?'🖥️ SAP GUI (ECC)':'✨ Fiori (S/4HANA)'}</b></span></div>
  <div class="sim-head">
    <div class="sim-head-top"><div class="sim-icon" style="background:${sc.color};width:48px;height:48px;font-size:24px">${sc.icon}</div>
      <div style="flex:1;min-width:220px"><h2>${esc(sc.title)}</h2><div style="color:var(--sap-muted);font-size:12.5px">${state.mode==='fiori'?`Fiori App: <b>${esc(fioriName(state.scenarioId)||sc.title)}</b> · `:''}${esc(sc.module)} · T-Code <b style="font-family:var(--mono)">${sc.tcode}</b> · ${state.mode==='gui'?'SAP GUI (ECC)':'Fiori (S/4HANA)'}</div></div>
      <button class="btn" onclick="resetScenario()">🔁 Restart</button><button class="btn" onclick="goHome()">✕ Close</button></div>
    <div class="objective"><b>🎯 Objective:</b> ${sc.objective}</div>
    <div class="stepper">${dots}</div>
    <div class="progressbar"><div style="width:${pct}%"></div></div>
    <div style="font-size:12px;color:var(--sap-muted)">${state.completed?'✅ Completed':`Step ${state.step+1} of ${sc.steps.length} · ${pct}% complete`}</div>
  </div>
  <div class="sim-layout">
    <div>${bodyHTML}</div>
    <aside class="side-panel">
      <div class="panel"><h4>☑️ Checklist</h4><ul class="checklist">${checklist}</ul></div>
      <div class="panel"><h4>ℹ️ Transaction Info</h4>
        <div class="kv"><span>T-Code</span><b>${sc.tcode}</b></div>
        <div class="kv"><span>Module</span><b>${esc(sc.module.split('·')[0].trim())}</b></div>
        <div class="kv"><span>Experience</span><b>${state.mode==='gui'?'SAP GUI':'Fiori'}</b></div>
        <div class="kv"><span>Client</span><b>100 · PRD</b></div>
        <div class="kv"><span>User</span><b>ENTERPRISE_USER</b></div></div>
      <div class="panel"><h4>💡 Tips</h4><p class="tip">• <code>/N</code> returns home.<br>• ✨ Auto-fill fills the correct values.<br>• Your Favorites stay pinned in both modes.<br>• Switch GUI ⇄ Fiori anytime — nothing is lost.</p></div>
    </aside>
  </div>`;
}

/* ================= CLOCK & INIT ================= */
function updateClock(){
  const el=$('clockEl'); if(!el) return;
  const now=new Date();
  const d=String(now.getDate()).padStart(2,'0'), m=String(now.getMonth()+1).padStart(2,'0'), y=now.getFullYear();
  const hh=String(now.getHours()).padStart(2,'0'), mm=String(now.getMinutes()).padStart(2,'0'), ss=String(now.getSeconds()).padStart(2,'0');
  el.textContent=`📅 ${m}/${d}/${y} · 🕐 ${hh}:${mm}:${ss}`;
}
setInterval(()=>{ updateClock(); refreshStatusClock(); },1000);

/* ================= KEYBOARD SHORTCUTS ================= */
document.addEventListener('keydown',e=>{
  if(e.key==='F2'){ e.preventDefault(); setMode(state.mode==='gui'?'fiori':'gui'); return; }
  if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='s'){
    e.preventDefault();
    if(state.view!=='sim') return;
    const sc=SCENARIOS[state.scenarioId]; if(!sc) return;
    const p=(sc.steps[state.step]||{}).primary;
    // Ctrl+S in SAP = Save/Post of the current transaction
    if(p && /save|post|print|release/i.test(p.label)) runAction(p.handler);
    else if(/save|post|print/i.test(sc.steps[state.step].title)) { const q=(sc.steps[state.step].primary||{}); if(q.handler) runAction(q.handler); }
    else toast('Nothing to save on this step — use Next →','info');
  }
});

/* ================= DEEP LINKS (#me21n, #va01, #migo, #fiori…) ================= */
function applyHash(){
  const h=decodeURIComponent((location.hash||'').replace(/^#/,'').toLowerCase());
  if(!h) return;
  if(h==='fiori'||h==='gui'){ setMode(h); return; }
  const id=TCODE_MAP[h.toUpperCase()] || (SCENARIOS[h]?h:null);
  if(id) startScenario(id);
}
window.addEventListener('hashchange',applyHash);
applyHash();

render();
