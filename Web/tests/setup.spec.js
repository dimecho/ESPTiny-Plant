const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const common = fs.readFileSync(path.join(root, 'js', 'common.js'), 'utf8');
const setup = fs.readFileSync(path.join(root, 'js', 'setup.js'), 'utf8');

class El {
  constructor(id){ this.id=id; this.listeners={}; this.attrs={}; this._v=''; this._cls=new Set(); this.checked=false; this._style={};
    this.classList={ add:(c)=>this._cls.add(c), remove:(c)=>this._cls.delete(c), contains:(c)=>this._cls.has(c) }; this.children=[]; this.contentDocument=null; }
  get parentNode(){ return this.parent; }
  addEventListener(t,f){ (this.listeners[t]=this.listeners[t]||[]).push(f); }
  getAttribute(k){ return this.attrs[k]!==undefined?this.attrs[k]:null; }
  setAttribute(k,v){ this.attrs[k]=v; }
  click(){ (this.listeners['click']||[]).forEach(f=>f.call(this)); }
  set value(v){ this._v=v; } get value(){ return this._v; }
  set textContent(t){ this._tc=t; } get textContent(){ return this._tc; }
  set className(c){ this._cls=new Set(c.split(' ')); } get className(){ return [...this._cls].join(' '); }
  set innerHTML(h){ this.children=[]; } get innerHTML(){ return this._html||''; }
  get style(){ return this._style; }
  appendChild(c){ c.parent=this; this.children.push(c); }
  removeChild(c){ const i=this.children.indexOf(c); if(i>-1) this.children.splice(i,1); c.parent=null; }
  insertBefore(c,ref){ c.parent=this; const i=this.children.indexOf(ref); if(i<0) this.children.push(c); else this.children.splice(i,0,c); }
  get nextSibling(){ if(!this.parent) return null; const i=this.parent.children.indexOf(this); return this.parent.children[i+1]||null; }
  focus(){}
  dispatchEvent(ev){ ev.preventDefault=ev.preventDefault||(()=>{}); (this.listeners[ev.type]||[]).forEach(f=>f.call(this,ev)); }
  querySelector(sel){ const cls=sel.replace('.',''); const q=(n)=>{ for(const c of n.children){ if(c._cls.has(cls)) return c; const r=q(c); if(r) return r; } return null; }; return q(this); }
}
const els = {};
const get = (id) => els[id] || (els[id] = new El(id));
const alertCbs = [0,1,2,3,4,5,6,7].map(i => new El('aCb'+i));
alertCbs[0].checked = true; alertCbs[5].checked = true;
location = { protocol:'http:', host:'192.168.4.1', pathname:'/' };
document = {
  getElementById: get,
  documentElement: get('htmlRoot'),
  querySelectorAll(sel){
    if(sel === '.setup-step') return ['step-power','step-connect','step-wifi','step-scan','step-alerts','step-plant-password'].map(get);
    if(sel === '.setup-tile') return ['tileBattery','tileOutlet','tileInternet','tileLocal'].map(get);
    if(sel === '#setupAlertsGrid .tab-checkbox') return alertCbs;
    return [];
  },
  createElement(){ return new El(); }
};
get('htmlRoot').setAttribute('data-theme', 'dark');
get('htmlRoot').setAttribute('data-font', 'medium');
const navs = [];
const sends = [];
const xhrs = [];
window = { addEventListener(){}, isSecureContext:false, location:{ set href(v){ navs.push(v); } } };
let theme='dark', font='medium';
localStorage = { getItem(k){ return k==='theme'?theme:k==='fontSize'?font:null; }, setItem(k,v){ if(k==='theme')theme=v; if(k==='fontSize')font=v; } };
const FakeXHR = function(){ this.open=(m,u)=>{ this.url=u; }; this.send=()=>{ sends.push(this.url); xhrs.push(this); }; };
XMLHttpRequest = FakeXHR;
const savedTheme = theme, savedFont = font;

const assert = (c,m) => { if(!c){ console.log('FAIL:', m); process.exit(1); } };
const tick = (ms) => new Promise(r => setTimeout(r, ms));

eval(common);
eval(setup);

get('setupWaiting').classList.add('hidden');
get('reconnectMsg').classList.add('hidden');
get('plantPasswordForm').classList.remove('hidden');
get('scanWarning').classList.add('hidden');
get('wifiSsidRequired').classList.add('hidden');
get('wifiPassMismatch').classList.add('hidden');

const doWifi = (ssid, pass) => { get('setupSSID').value=ssid; get('setupPassword').value=pass; get('setupConfirmPassword').value=pass; get('wifiSetupForm').dispatchEvent({type:'submit'}); };
const doPlant = () => { get('setupPlantPassword').value=''; get('setupConfirmPlantPassword').value=''; get('plantPasswordForm').dispatchEvent({type:'submit'}); };
const resetWaiting = () => { get('setupWaiting').classList.add('hidden'); get('plantPasswordForm').classList.remove('hidden'); get('reconnectMsg').classList.add('hidden'); };

(async function(){
  // Power tile -> offset 21
  get('tileBattery').click();
  assert(sends[0] === 'nvram.json?offset=21&value=10', 'battery tile offset 21/10');
  assert(get('step-connect').classList.contains('active'), 'battery -> step-connect');

  // Internet -> scan fires
  get('tileInternet').click();
  assert(xhrs.some(x => x.url === 'api?wifi=scan'), 'scan fired');

  // good scan -> 2 items, no warning
  const scanReq = xhrs.filter(x => x.url === 'api?wifi=scan').pop();
  scanReq.status = 200; scanReq.responseText = 'NetA\nNetB';
  scanReq.onload();
  assert(get('scanList').children.length === 2, 'scan list rendered 2 items');
  assert(get('scanWarning').classList.contains('hidden'), 'no warning when scan ok');

  // bad scan -> warning shown, list cleared
  scanWifi();
  const badReq = xhrs.filter(x => x.url === 'api?wifi=scan').pop();
  badReq.status = 200; badReq.responseText = 'error: no wifi';
  badReq.onload();
  assert(!get('scanWarning').classList.contains('hidden'), 'warning shown on bad scan');
  assert(get('scanList').children.length === 0, 'list cleared on bad scan');

  // connect via first item (no password) -> alerts
  scanWifi();
  const okReq = xhrs.filter(x => x.url === 'api?wifi=scan').pop();
  okReq.status = 200; okReq.responseText = 'NetA\nNetB';
  okReq.onload();
  get('scanList').children[0].click();
  const connBtn = get('scanList').children[0].nextSibling.children[1];
  connBtn.click();
  assert(sends.some(u => u === 'nvram.json?offset=6&value=NetA'), 'WIFI_SSID written');
  assert(get('step-alerts').classList.contains('active'), 'connect -> step-alerts');

  // alerts save -> bits + offsets 22..27
  get('setupAlertEmail').value = 'a@b.c';
  get('setupAlertSMTPServer').value = 's';
  get('setupAlertSMTPUsername').value = 'u';
  get('setupAlertSMTPPassword').value = 'p';
  get('setupConfirmSMTPPassword').value = 'p';
  get('setupAlertPlantName').value = 'My';
  get('alertsSaveBtn').click();
  assert(get('setupAlerts').value === '100001000', 'alerts bits: ' + get('setupAlerts').value);
  assert(sends.some(u => u === 'nvram.json?offset=22&value=a%40b.c'), 'EMAIL_ALERT');
  assert(sends.some(u => u === 'nvram.json?offset=27&value=100001000'), 'ALERTS');
  assert(get('step-plant-password').classList.contains('active'), 'alerts -> plant-password');

  // plant password mismatch blocks
  get('setupPlantPassword').value = 'x';
  get('setupConfirmPlantPassword').value = 'y';
  get('plantPasswordForm').dispatchEvent({type:'submit'});
  assert(!get('plantPassMismatch').classList.contains('hidden'), 'mismatch blocks');

  // internet finalize: no reboot, 6s -> find.html
  doPlant();
  assert(!sends.includes('reboot'), 'internet path no reboot');
  await tick(6200);
  assert(navs[0] === 'find.html', 'internet -> find.html');

  // local finalize: reboot + redirects
  resetWaiting();
  get('tileLocal').click();
  doWifi('Plant','');
  assert(sends.some(u => u === 'nvram.json?offset=6&value=Plant'), 'local SSID written');
  assert(sends.some(u => u === 'nvram.json?offset=2&value=0'), 'WIFI_HIDE written');
  doPlant();
  assert(sends[sends.length-1] === 'reboot', 'local Plant reboot');
  assert(navs[1] === 'index.html', 'local Plant -> index.html immediately');

  resetWaiting();
  get('tileLocal').click();
  doWifi('MyAP','');
  doPlant();
  assert(sends[sends.length-1] === 'reboot', 'local MyAP reboot');
  assert(!get('setupWaiting').classList.contains('hidden'), 'MyAP shows waiting bar');
  await tick(12200);
  assert(navs[2] === 'index.html', 'MyAP -> index.html after 12s');

  console.log('ALL setup.spec assertions PASS');
  process.exit(0);
})();
