const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const common = fs.readFileSync(path.join(root, 'js', 'common.js'), 'utf8');

class El {
  constructor(id){ this.id=id; this.listeners={}; this.attrs={}; this._v=''; this._cls=new Set(); this.checked=false;
    this._style={ getPropertyValue: () => '', setProperty: () => {}, background: '' };
    this.classList={ add:(c)=>this._cls.add(c), remove:(c)=>this._cls.delete(c), contains:(c)=>this._cls.has(c) }; this.children=[]; }
  addEventListener(t,f){ (this.listeners[t]=this.listeners[t]||[]).push(f); }
  getAttribute(k){ return this.attrs[k]!==undefined?this.attrs[k]:null; }
  setAttribute(k,v){ this.attrs[k]=v; }
  click(){ (this.listeners['click']||[]).forEach(f=>f.call(this)); }
  set value(v){ this._v=v; } get value(){ return this._v; }
  set textContent(t){ this._tc=t; } get textContent(){ return this._tc; }
  set className(c){ this._cls=new Set(c.split(' ')); } get className(){ return [...this._cls].join(' '); }
  get style(){ return this._style; }
  appendChild(c){ c.parent=this; this.children.push(c); }
  dispatchEvent(ev){ ev.preventDefault=ev.preventDefault||(()=>{}); (this.listeners[ev.type]||[]).forEach(f=>f.call(this,ev)); }
}
const els = {};
const get = (id) => els[id] || (els[id] = new El(id));
let theme = 'dark', font = 'medium';
const store = {};
const cbEls = [0,1,2,3,4,5,6,7].map(i => new El('cb'+i));
cbEls[0].checked = true; cbEls[3].checked = true;
const savedTheme = theme, savedFont = font;
location = { protocol:'http:', host:'192.168.4.1', pathname:'/' };
document = {
  getElementById: get,
  documentElement: get('htmlRoot'),
  querySelectorAll(sel){ return sel === '.alerts .tab-checkbox' ? cbEls : []; },
  createElement(){ return new El(); }
};
get('htmlRoot').setAttribute('data-theme', savedTheme);
get('htmlRoot').setAttribute('data-font', savedFont);
const sends = [];
const FakeXHR = function(){ this.open=(m,u)=>{ this.url=u; }; this.send=()=>sends.push(this.url); };
XMLHttpRequest = FakeXHR;
window = { isSecureContext: true };
localStorage = { getItem(k){ return k==='theme'?theme:k==='fontSize'?font:null; }, setItem(k,v){ if(k==='theme')theme=v; if(k==='fontSize')font=v; store[k]=v; } };

const assert = (c,m) => { if(!c){ console.log('FAIL:', m); process.exit(1); } };
const tick = (ms) => new Promise(r => setTimeout(r, ms));

eval(common);

(async function(){
  assert(typeof nvramGet === 'function', 'nvramGet defined');
  assert(typeof buildAlertBits === 'function', 'buildAlertBits defined');
  assert(typeof saveAlertFields === 'function', 'saveAlertFields defined');
  assert(typeof applySvgTheme === 'function', 'applySvgTheme defined');
  assert(typeof initThemeFont === 'function', 'initThemeFont defined');
  assert(typeof finishPreloader === 'function', 'finishPreloader defined');
  assert(typeof hideSvgMenu === 'function', 'hideSvgMenu defined');
  assert(WIFI_MODE === 1 && DEEP_SLEEP === 21 && DEMO_PASSWORD === 28 && FIRST_SETUP === 20, 'constants intact');

  nvramGet(6, 'hello world');
  assert(sends[0] === 'nvram.json?offset=6&value=hello%20world', 'nvramGet url: ' + sends[0]);

  const bits = buildAlertBits('.alerts .tab-checkbox');
  assert(bits === '100100000', 'buildAlertBits: ' + bits);

  get('AlertEmail').value = 'a@b.c'; get('AlertSMTPServer').value = 'smtp.x';
  get('AlertSMTPUsername').value = 'u'; get('AlertSMTPPassword').value = 'p'; get('AlertPlantName').value = 'My Plant';
  saveAlertFields(bits, { email:'AlertEmail', server:'AlertSMTPServer', username:'AlertSMTPUsername', password:'AlertSMTPPassword', plant:'AlertPlantName' });
  assert(sends.some(u => u === 'nvram.json?offset=22&value=a%40b.c'), 'EMAIL_ALERT written');
  assert(sends.some(u => u === 'nvram.json?offset=27&value=100100000'), 'ALERTS written');

  hideSvgMenu({ getElementById: () => null, querySelectorAll: () => [] }); // no-throw

  initThemeFont();
  assert(get('themeToggle').textContent === '\u2600', 'theme toggle init dark');
  get('themeToggle').click();
  assert(get('htmlRoot').getAttribute('data-theme') === 'light', 'theme toggled to light');
  assert(get('themeToggle').textContent === '\u263E', 'theme toggle label updated');
  get('fontToggle').click();
  assert(get('htmlRoot').getAttribute('data-font') === 'large', 'font toggled');

  finishPreloader(1);
  await tick(10);
  assert(get('preloader-overlay').classList.contains('done'), 'preloader done added');

  console.log('ALL common.spec assertions PASS');
  process.exit(0);
})();
