const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

let CACHE;
function loadPatches() {
  if (CACHE) return CACHE;
  try {
    const p = path.join(__dirname, '../../../config/bank_patches.yaml');
    CACHE = yaml.load(fs.readFileSync(p, 'utf8')) || {};
  } catch (e) {
    CACHE = {};
  }
  return CACHE;
}

function normalizeDate(str) {
  const m = str.match(/([A-Za-z]{3})\s+(\d{1,2}),?\s+(\d{4})/);
  if (!m) return null;
  const months = {Jan:'01',Feb:'02',Mar:'03',Apr:'04',May:'05',Jun:'06',Jul:'07',Aug:'08',Sep:'09',Oct:'10',Nov:'11',Dec:'12'};
  return `${m[3]}-${months[m[1].slice(0,3)]}-${m[2].padStart(2,'0')}`;
}

function parseAmount(text, label, alt=[]) {
  const labels=[label,...alt];
  for (const l of labels) {
    const re=new RegExp(l+"[^0-9$]*\\$?\\s*([0-9,]+\\.\\d{2})(?:-)?","i");
    const m=text.match(re);
    if(m) return parseFloat(m[1].replace(/,/g,''));
  }
  return null;
}

function extractBankStatement({text='',vendor,confidence=0.9}) {
  const patches=loadPatches();
  const patch=vendor&&patches[vendor]?patches[vendor]:{};
  const syn=patch.synonyms||{};

  const acct=/(Account\s*Number|Acct\.?\s*No\.?)\s*:?[\s\-]*([*Xx\d\s-]{4,})/i;
  const mAcct=text.match(acct);
  let last4=null;
  if(mAcct){last4=mAcct[2].replace(/\D/g,'').slice(-4);}

  const period=/(Statement\s*Period|Period)\s*:?[\s]*([A-Za-z]{3}\s+\d{1,2},?\s+\d{4})\s*(?:through|–|-|to)\s*([A-Za-z]{3}\s+\d{1,2},?\s+\d{4})/i;
  const mPer=text.match(period);
  const statement_period=mPer?{start:normalizeDate(mPer[2]),end:normalizeDate(mPer[3])}:{start:null,end:null};

  const beginning_balance=parseAmount(text,'Beginning Balance',syn.beginning_balance||['Starting Balance'])||0;
  const ending_balance=parseAmount(text,'Ending Balance',syn.ending_balance||['Closing Balance'])||0;
  const deposits=parseAmount(text,'Total Deposits',syn.deposits_total||[])||0;
  const withdrawals=parseAmount(text,'Total Withdrawals',syn.withdrawals_total||[])||0;
  const checks_paid=parseAmount(text,'Total Checks',syn.checks_total||[])||0;

  const transactions=[];
  const lines=text.split(/\n+/);
  const token=/^(?:[A-Za-z]{3}\s+\d{1,2}|\d{2}\/\d{2}|\d{4}-\d{2}-\d{2})/;
  for(const line of lines){
    if(token.test(line)){
      const dateStr=line.match(token)[0];
      let date;
      if(/^[A-Za-z]{3}/.test(dateStr)){
        const y=statement_period.start?statement_period.start.slice(0,4):'1970';
        date=normalizeDate(`${dateStr}, ${y}`);
      }else if(/\d{4}-\d{2}-\d{2}/.test(dateStr)){
        date=dateStr;
      }else{
        const [m,d]=dateStr.split('/');
        const y=statement_period.start?statement_period.start.slice(0,4):'1970';
        date=`${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
      }
      const a=line.match(/\$?\s*([0-9,]+\.\d{2})(\-)?/);
      if(a){
        const amt=parseFloat(a[1].replace(/,/g,''));
        const neg=a[2]!=null;
        transactions.push({date,type:neg?'withdrawal':'deposit',counterparty:null,amount:amt});
      }
      if(transactions.length>=20) break;
    }
  }

  const warnings=[];
  const expected=beginning_balance+deposits-withdrawals-checks_paid;
  if(Math.abs(expected-ending_balance)>1) warnings.push('balance_mismatch');

  return {
    doc_type:'bank_statement',
    bank_name:vendor||null,
    account_number_last4:last4,
    statement_period,
    beginning_balance,
    ending_balance,
    totals:{deposits,withdrawals,checks_paid},
    transactions,
    confidence,
    warnings,
  };
}

module.exports={extractBankStatement};

