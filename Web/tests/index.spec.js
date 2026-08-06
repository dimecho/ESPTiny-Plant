const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const common = fs.readFileSync(path.join(root, 'js', 'common.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'js', 'index.js'), 'utf8');

class El {
  constructor(id){ this.id=id; this.listeners={}; this.attrs={}; this._v=''; this._cls=new Set(); this.checked=false;
    this._style={ getPropertyValue: () => '', setProperty: () => {}, background: '' };
    this.classList={ add:(c)=>this._cls.add(c), remove:(c)=>this._cls.delete(c), contains:(c)=>this._cls.has(c) }; this.children=[]; this.contentDocument=null; }
  addEventListener(t,f){ (this.listeners[t]=this.listeners[t]||[]).push(f); }
  getAttribute(k){ return this.attrs[k]!==undefined?this.attrs[k]:null; }
  setAttribute(k,v){ this.attrs[k]=v; }
  click(){ (this.listeners['click']||[]).forEach(f=>f.call(this)); }
  set value(v){ this._v=v; } get value(){ return this._v; }
  set textContent(t){ this._tc=t; } get textContent(){ return this._tc; }
  set innerHTML(h){ this.children=[]; } get innerHTML(){ return this._html||''; }
  get style(){ return this._style; }
  appendChild(c){ c.parent=this; this.children.push(c); }
  dispatchEvent(ev){ ev.preventDefault=ev.preventDefault||(()=>{}); (this.listeners[ev.type]||[]).forEach(f=>f.call(this,ev)); }
}
const els = {};
const get = (id) => els[id] || (els[id] = new El(id));
const alertCbs = [0,1,2,3,4,5,6,7].map(i => new El('tCb'+i));
alertCbs[0].checked = true; alertCbs[7].checked = true;
location = { protocol:'http:', host:'192.168.4.1', pathname:'/' };
document = {
  getElementById: get,
  documentElement: get('htmlRoot'),
  querySelectorAll(sel){
    if(sel === '#tab-alerts .tab-checkbox') return alertCbs;
    return [];
  },
  querySelector(sel){ return get('query:'+sel); },
  createElement(){ return new El(); },
  body: new El('body')
};
get('htmlRoot').setAttribute('data-theme', 'dark');
get('htmlRoot').setAttribute('data-font', 'medium');
const sends = [];
window = { addEventListener(){}, isSecureContext:false, location:{ hostname:'192.168.4.1', protocol:'http:', host:'192.168.4.1', pathname:'/', set href(v){} }, open(){ } };
let theme='dark', font='medium';
localStorage = { getItem(k){ return k==='theme'?theme:k==='fontSize'?font:null; }, setItem(k,v){ if(k==='theme')theme=v; if(k==='fontSize')font=v; } };
const FakeXHR = function(){ this.responseType=null; this.open=(m,u)=>{ this.url=u; }; this.send=()=>sends.push(this.url); this.setRequestHeader=()=>{}; };
XMLHttpRequest = FakeXHR;
const savedTheme = theme, savedFont = font;

const assert = (c,m) => { if(!c){ console.log('FAIL:', m); process.exit(1); } };

eval(common);
eval(index);

assert(typeof nvramGet === 'function', 'nvramGet shared');
assert(typeof buildAlertBits === 'function', 'buildAlertBits shared');
assert(typeof saveAlertFields === 'function', 'saveAlertFields shared');
assert(typeof initThemeFont === 'function', 'initThemeFont shared');
assert(typeof hideSvgMenu === 'function', 'hideSvgMenu shared');
assert(typeof saveAlertField === 'undefined', 'index.js no longer defines saveAlertField');
assert(WIFI_MODE === 1 && DEEP_SLEEP === 21 && PLANT_POT_SIZE === 15 && PNP_ADC === 31, 'constants from common.js');

get('AlertEmail').value = 'x@y.z';
get('AlertSMTPServer').value = 'smtp';
get('AlertSMTPUsername').value = 'u';
get('AlertSMTPPassword').value = 'p';
get('AlertPlantName').value = 'Plant';
saveAlertsSettings();
assert(get('Alerts').value === '100000010', 'saveAlertsSettings bits: ' + get('Alerts').value);
assert(sends.some(u => u === 'nvram.json?offset=22&value=x%40y.z'), 'EMAIL_ALERT via nvramGet');
assert(sends.some(u => u === 'nvram.json?offset=27&value=100000010'), 'ALERTS via nvramGet');
assert(sends.some(u => u === 'nvram.json?offset=24&value=u'), 'SMTP_USERNAME via nvramGet');

console.log('ALL index.spec assertions PASS');
process.exit(0);
