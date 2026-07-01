(function(){
"use strict";

/* ============================================================
   AUDIO – jednoduché tóny přes Web Audio API (nejsou to originální
   zvuky Windows, pouze inspirace jednoduchými pípnutími)
   ============================================================ */
let actx = null;
function getCtx(){
  if(!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
  return actx;
}
function tone(freq, start, dur, type, gainPeak){
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type || 'sine';
  osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
  gain.gain.setValueAtTime(0, ctx.currentTime + start);
  gain.gain.linearRampToValueAtTime(gainPeak||0.15, ctx.currentTime + start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
  osc.connect(gain); gain.connect(ctx.destination);
  osc.start(ctx.currentTime + start);
  osc.stop(ctx.currentTime + start + dur + 0.05);
}
const Sound = {
  startup(){ tone(392,0,0.35,'sine',0.12); tone(523,0.15,0.4,'sine',0.12); tone(659,0.3,0.5,'sine',0.14); },
  click(){ tone(700,0,0.05,'square',0.05); },
  open(){ tone(500,0,0.08,'sine',0.09); tone(750,0.06,0.12,'sine',0.09); },
  error(){ tone(200,0,0.15,'square',0.12); tone(150,0.12,0.2,'square',0.12); },
  close(){ tone(600,0,0.06,'triangle',0.07); tone(400,0.05,0.09,'triangle',0.07); }
};

/* ============================================================
   PERZISTENCE (localStorage)
   ============================================================ */
const LS = {
  get user(){ return localStorage.getItem('win7_username'); },
  set user(v){ localStorage.setItem('win7_username', v); },
  get pass(){ return localStorage.getItem('win7_password') || ''; },
  set pass(v){ localStorage.setItem('win7_password', v); },
  get setupDone(){ return localStorage.getItem('win7_setup_done') === '1'; },
  set setupDone(v){ localStorage.setItem('win7_setup_done', v ? '1':'0'); }
};

/* ============================================================
   SETUP / LOGIN FLOW
   ============================================================ */
const setupScreen = document.getElementById('setup-screen');
const loginScreen = document.getElementById('login-screen');
const licenseScreen = document.getElementById('license-screen');
const bootSplashScreen = document.getElementById('boot-splash-screen');
const desktop = document.getElementById('desktop');
const shutdownScreen = document.getElementById('shutdown-screen');

/* Pořadí prvního spuštění: Instalace -> Licenční podmínky -> Nastavení uživatele -> Spouštění systému -> Přihlášení
   Při každém dalším spuštění: Spouštění systému -> Přihlášení */
function boot(){
  if(LS.setupDone && LS.user){
    showBootSplash(showLogin);
  } else {
    runInstallSequence();
  }
}

/* ---------- 1) INSTALACE ---------- */
const installStages = [
  'Kopírování souborů Windows...',
  'Získávání informací o funkcích a aktualizacích...',
  'Instalace funkcí...',
  'Instalace aktualizací...',
  'Dokončování instalace...',
  'Kontrola videovýkonu...',
  'Příprava vašeho počítače k prvnímu použití...'
];
function runInstallSequence(){
  const screen = document.getElementById('install-screen');
  const bar = document.getElementById('install-progress');
  const stageText = document.getElementById('install-stage-text');
  const list = document.getElementById('install-stage-list');
  list.innerHTML = installStages.map((s,i)=>'<div id="ist-'+i+'">'+s+'</div>').join('');
  screen.style.display = 'flex';
  bar.style.width = '0%';
  let i = 0;
  Sound.click();
  function nextStage(){
    if(i >= installStages.length){
      stageText.textContent = 'Instalace dokončena.';
      setTimeout(()=>{
        screen.style.display = 'none';
        showLicenseScreen();
      }, 700);
      return;
    }
    stageText.textContent = installStages[i];
    const pct = Math.round(((i+1)/installStages.length)*100);
    bar.style.width = pct+'%';
    const el = document.getElementById('ist-'+i);
    if(el) el.classList.add('done');
    i++;
    setTimeout(nextStage, 550 + Math.random()*450);
  }
  setTimeout(nextStage, 400);
}

/* ---------- 2) LICENČNÍ PODMÍNKY ---------- */
function showLicenseScreen(){
  const chk = document.getElementById('license-checkbox');
  const nextBtn = document.getElementById('license-next-btn');
  chk.checked = false;
  nextBtn.disabled = true;
  licenseScreen.style.display = 'flex';
}
document.getElementById('license-checkbox').addEventListener('change', (e)=>{
  document.getElementById('license-next-btn').disabled = !e.target.checked;
});
document.getElementById('license-next-btn').addEventListener('click', ()=>{
  if(document.getElementById('license-next-btn').disabled) return;
  Sound.click();
  licenseScreen.style.display = 'none';
  setupScreen.style.display = 'flex';
});

/* ---------- 3) NASTAVENÍ UŽIVATELE ---------- */
document.getElementById('setup-finish-btn').addEventListener('click', ()=>{
  const uname = document.getElementById('setup-username').value.trim();
  const p1 = document.getElementById('setup-password').value;
  const p2 = document.getElementById('setup-password2').value;
  const err = document.getElementById('setup-error');
  if(!uname){ err.textContent = 'Zadejte prosím uživatelské jméno.'; Sound.error(); return; }
  if(p1 !== p2){ err.textContent = 'Hesla se neshodují.'; Sound.error(); return; }
  LS.user = uname; LS.pass = p1; LS.setupDone = true;
  initFileSystem(uname);
  setupScreen.style.display = 'none';
  showBootSplash(showLogin);
});

/* ---------- 4) SPOUŠTĚNÍ SYSTÉMU (Windows 7 startup logo) ---------- */
function showBootSplash(next){
  bootSplashScreen.style.display = 'flex';
  Sound.startup();
  setTimeout(()=>{
    bootSplashScreen.style.display = 'none';
    next();
  }, 2400);
}

/* ---------- 5) PŘIHLÁŠENÍ ---------- */
function showLogin(){
  document.getElementById('login-username-display').textContent = LS.user || 'Uživatel';
  loginScreen.style.display = 'flex';
  document.getElementById('login-password').value = '';
  document.getElementById('login-error').textContent = '';
}

document.getElementById('login-btn').addEventListener('click', doLogin);
document.getElementById('login-password').addEventListener('keydown', e=>{ if(e.key==='Enter') doLogin(); });

function doLogin(){
  const p = document.getElementById('login-password').value;
  if(p === LS.pass){
    Sound.click();
    loginScreen.style.display = 'none';
    if(!fsRoot) initFileSystem(LS.user);
    desktop.style.display = 'block';
    document.getElementById('sm-user-header').textContent = LS.user;
    startClock();
  } else {
    document.getElementById('login-error').textContent = 'Nesprávné heslo. Zkuste to znovu.';
    Sound.error();
  }
}

/* ============================================================
   HODINY
   ============================================================ */
function startClock(){
  function upd(){
    const d = new Date();
    const hh = String(d.getHours()).padStart(2,'0');
    const mm = String(d.getMinutes()).padStart(2,'0');
    const ss = String(d.getSeconds()).padStart(2,'0');
    document.getElementById('clock-time').textContent = hh+':'+mm+':'+ss;
    document.getElementById('clock-date').textContent =
      String(d.getDate()).padStart(2,'0')+'.'+String(d.getMonth()+1).padStart(2,'0')+'.'+d.getFullYear();
  }
  upd();
  setInterval(upd, 1000);
}

/* ============================================================
   SOUBOROVÝ SYSTÉM (simulace)
   ============================================================ */
let fsRoot = null;

function folderNode(system){ return { type:'folder', system: !!system, unlocked: !system, children:{} }; }
function fileNode(system){ return { type:'file', system: !!system, unlocked: !system, children:null }; }

function initFileSystem(username){
  // --- reálné (zjednodušené) podsložky C:\Windows z Windows 7 ---
  const winChildren = {
    'System32': { type:'folder', system:true, unlocked:false, children:{
      'kernel32.dll': fileNode(true), 'ntoskrnl.exe': fileNode(true), 'explorer.exe': fileNode(true),
      'cmd.exe': fileNode(true), 'notepad.exe': fileNode(true), 'taskmgr.exe': fileNode(true),
      'winlogon.exe': fileNode(true), 'services.exe': fileNode(true), 'drivers': folderNode(true),
      'config': folderNode(true), 'DriverStore': folderNode(true)
    }},
    'SysWOW64': folderNode(true),
    'WinSxS': folderNode(true),
    'Fonts': folderNode(true),
    'Cursors': folderNode(true),
    'Media': folderNode(true),
    'Help': folderNode(true),
    'inf': folderNode(true),
    'Boot': folderNode(true),
    'Temp': folderNode(false),
    'Tasks': folderNode(true),
    'Prefetch': folderNode(true),
    'Logs': folderNode(true),
    'Installer': folderNode(true),
    'servicing': folderNode(true),
    'Microsoft.NET': folderNode(true),
    'assembly': folderNode(true),
    'ServiceProfiles': folderNode(true),
    'Globalization': folderNode(true),
    'Setup': folderNode(true),
    'twain_32': folderNode(true),
    'Web': folderNode(true)
  };

  const programFilesChildren = {
    'Internet Explorer': folderNode(true),
    'Windows Media Player': folderNode(true),
    'Common Files': folderNode(true),
    'Windows Defender': folderNode(true),
    'Chromium Beta': { type:'folder', system:false, unlocked:true, children:{
      'chromium.exe': { ...fileNode(false), app:'browser' },
      'chrome_100_percent.pak': fileNode(false),
      'chromium.dll': fileNode(false)
    }},
    'Uninstall Information': folderNode(true)
  };

  fsRoot = {
    'C:': { type:'drive', name:'Místní disk (C:)', system:true, unlocked:false, children:{
      'Program Files': { type:'folder', system:true, unlocked:false, children: programFilesChildren },
      'Program Files (x86)': { type:'folder', system:true, unlocked:false, children:{
        'Common Files': folderNode(true)
      }},
      'Windows': { type:'folder', system:true, unlocked:false, children: winChildren },
      'ProgramData': { type:'folder', system:true, unlocked:false, children:{
        'Microsoft': folderNode(true)
      }},
      'Users': { type:'folder', system:false, unlocked:true, children:{
        [username]: { type:'folder', system:false, unlocked:true, children:{
          'Plocha': { type:'folder', system:false, unlocked:true, children:{} },
          'Dokumenty': { type:'folder', system:false, unlocked:true, children:{} },
          'Stažené soubory': { type:'folder', system:false, unlocked:true, children:{} },
          'AppData': folderNode(true)
        }}
      }}
    }}
  };
}

/* rekurzivní odemknutí (takeown) celé podstromu */
function unlockRecursive(node){
  node.unlocked = true;
  if(node.children){
    Object.values(node.children).forEach(unlockRecursive);
  }
}

/* vyhledá položku podle názvu kdekoliv ve stromu (case-insensitive), nejen v aktuální složce */
function findNodeAnywhere(nameLower){
  const results = [];
  function walk(children){
    if(!children) return;
    Object.keys(children).forEach(k=>{
      if(k.toLowerCase() === nameLower) results.push({ key:k, node: children[k] });
      if(children[k].children) walk(children[k].children);
    });
  }
  walk(fsRoot);
  return results.length ? results[0] : null;
}

/* ============================================================
   STAV POŠKOZENÍ SYSTÉMU (glitch při smazání systémových složek / viru)
   ============================================================ */
let systemCorrupted = false;
let virusActive = false;
function corruptSystem(reason){
  if(systemCorrupted) return;
  systemCorrupted = true;
  desktop.classList.add('corrupted');
  showGlitchToast(reason || 'Byl zjištěn problém se systémovými soubory.');
  Sound.error();
}
function showGlitchToast(msg){
  const t = document.createElement('div');
  t.className = 'glitch-error-toast';
  t.textContent = '⚠ '+msg;
  document.body.appendChild(t);
  setTimeout(()=>t.remove(), 3200);
}
function healSystem(username){
  systemCorrupted = false;
  desktop.classList.remove('corrupted');
  initFileSystem(username || LS.user);
}

/* ============================================================
   OKNA – obecný systém oken
   ============================================================ */
let zTop = 100;
let winCount = 0;
const openWindows = {};

function createWindow(opts){
  // opts: {title, icon, width, height, x, y, content(el|html), onClose, id}
  winCount++;
  const id = opts.id || ('win-'+winCount);
  if(openWindows[id]){ focusWindow(id); return openWindows[id]; }

  const win = document.createElement('div');
  win.className = 'win';
  win.style.width = (opts.width||360)+'px';
  win.style.height = (opts.height||280)+'px';
  win.style.left = (opts.x!=null?opts.x:(20+winCount*18)%220)+'px';
  win.style.top = (opts.y!=null?opts.y:(20+winCount*14)%160)+'px';
  win.style.zIndex = ++zTop;
  win.dataset.winId = id;

  win.innerHTML =
    '<div class="win-titlebar">'+
      '<div class="wt-title"><span>'+(opts.icon||'🗔')+'</span><span>'+opts.title+'</span></div>'+
      '<div class="wt-btns"><span class="wt-min">_</span><span class="wt-max">▢</span><span class="wt-close">✕</span></div>'+
    '</div>'+
    '<div class="win-body"></div>';

  document.getElementById('windows-container').appendChild(win);
  const body = win.querySelector('.win-body');
  if(typeof opts.content === 'string') body.innerHTML = opts.content;
  else if(opts.content instanceof Node) body.appendChild(opts.content);

  win.addEventListener('mousedown', ()=>focusWindow(id));
  win.addEventListener('touchstart', ()=>focusWindow(id), {passive:true});

  makeDraggable(win, win.querySelector('.win-titlebar'));

  win.querySelector('.wt-close').addEventListener('click', (e)=>{ e.stopPropagation(); closeWindow(id); });
  win.querySelector('.wt-min').addEventListener('click', (e)=>{ e.stopPropagation(); win.classList.toggle('minimized'); });
  win.querySelector('.wt-max').addEventListener('click', (e)=>{
    e.stopPropagation();
    if(win.dataset.maxed==='1'){
      win.style.width = win.dataset.prevW; win.style.height = win.dataset.prevH;
      win.style.left = win.dataset.prevX; win.style.top = win.dataset.prevY;
      win.dataset.maxed = '0';
    } else {
      win.dataset.prevW = win.style.width; win.dataset.prevH = win.style.height;
      win.dataset.prevX = win.style.left; win.dataset.prevY = win.style.top;
      win.style.left='0px'; win.style.top='0px'; win.style.width='100%'; win.style.height='calc(100% - 40px)';
      win.dataset.maxed = '1';
    }
  });

  // taskbar button
  const tbtn = document.createElement('div');
  tbtn.className = 'taskbar-win-btn active';
  tbtn.innerHTML = '<span>'+(opts.icon||'🗔')+'</span><span>'+opts.title+'</span>';
  tbtn.addEventListener('click', ()=>{
    if(win.classList.contains('minimized')){ win.classList.remove('minimized'); focusWindow(id); }
    else { win.classList.add('minimized'); }
  });
  document.getElementById('taskbar-windows').appendChild(tbtn);

  openWindows[id] = { el: win, btn: tbtn };
  Sound.open();
  focusWindow(id);
  return openWindows[id];
}

function focusWindow(id){
  const w = openWindows[id]; if(!w) return;
  w.el.style.zIndex = ++zTop;
  Object.values(openWindows).forEach(o=>o.btn.classList.remove('active'));
  w.btn.classList.add('active');
}

function closeWindow(id){
  const w = openWindows[id]; if(!w) return;
  Sound.close();
  w.el.remove(); w.btn.remove();
  delete openWindows[id];
}

function makeDraggable(win, handle){
  let dragging=false, offX=0, offY=0;
  function start(clientX, clientY){
    dragging = true;
    const r = win.getBoundingClientRect();
    offX = clientX - r.left; offY = clientY - r.top;
    focusWindow(win.dataset.winId);
  }
  function move(clientX, clientY){
    if(!dragging) return;
    let nx = clientX - offX, ny = clientY - offY;
    ny = Math.max(0, ny);
    win.style.left = nx+'px'; win.style.top = ny+'px';
  }
  function end(){ dragging = false; }
  handle.addEventListener('mousedown', e=>{ start(e.clientX, e.clientY); e.preventDefault(); });
  window.addEventListener('mousemove', e=> move(e.clientX, e.clientY));
  window.addEventListener('mouseup', end);
  handle.addEventListener('touchstart', e=>{ const t=e.touches[0]; start(t.clientX,t.clientY); }, {passive:true});
  handle.addEventListener('touchmove', e=>{ const t=e.touches[0]; move(t.clientX,t.clientY); }, {passive:true});
  handle.addEventListener('touchend', end);
}

/* ============================================================
   PLOCHA – IKONY
   ============================================================ */
const desktopIcons = [
  { id:'recyclebin', name:'Koš', icon:'🗑️', x:14, y:10, action: openRecycleBin },
  { id:'computer', name:'Tento počítač', icon:'💻', x:14, y:110, action: openComputer },
  { id:'notes', name:'Poznámky.txt', icon:'📄', x:14, y:210, action: ()=>openTextFile('Poznámky.txt') },
  { id:'browser', name:'Chromium Beta', icon:'🌐', x:14, y:310, action: openBrowser }
];

function renderIcons(){
  const layer = document.getElementById('icons-layer');
  layer.innerHTML = '';
  desktopIcons.forEach(ic=>{
    const el = document.createElement('div');
    el.className = 'desktop-icon';
    el.style.left = ic.x+'px'; el.style.top = ic.y+'px';
    el.dataset.iconId = ic.id;
    el.innerHTML = '<div class="ic">'+ic.icon+'</div><div class="lbl">'+ic.name+'</div>';

    let lastTap = 0, holdTimer = null;
    el.addEventListener('click', (e)=>{
      e.stopPropagation();
      selectOnlyIcon(el);
      Sound.click();
      const now = Date.now();
      if(now - lastTap < 380){ ic.action(); }
      lastTap = now;
    });
    el.addEventListener('contextmenu', (e)=>{ e.preventDefault(); e.stopPropagation(); selectOnlyIcon(el); ic.action(); });

    // touch: hold = context menu equivalent (open on desktop icons we just open on hold too, tap=select/dblfor open)
    el.addEventListener('touchstart', (e)=>{
      e.stopPropagation();
      holdTimer = setTimeout(()=>{ selectOnlyIcon(el); showDesktopIconMenu(el, ic); holdTimer=null; }, 550);
    }, {passive:true});
    el.addEventListener('touchend', ()=>{ if(holdTimer){ clearTimeout(holdTimer); } });
    el.addEventListener('touchmove', ()=>{ if(holdTimer){ clearTimeout(holdTimer); holdTimer=null; } });

    layer.appendChild(el);
  });
}

function selectOnlyIcon(el){
  document.querySelectorAll('.desktop-icon').forEach(i=>i.classList.remove('selected'));
  el.classList.add('selected');
}

function showDesktopIconMenu(el, ic){
  // simple menu: open / delete (if recycle/computer -> no delete)
  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.style.display = 'block';
  const r = el.getBoundingClientRect();
  menu.style.left = r.left+'px'; menu.style.top = (r.bottom)+'px';
  menu.innerHTML = '<div class="cm-item" data-a="open">Otevřít</div><div class="cm-sep"></div><div class="cm-item" data-a="props">Vlastnosti</div>';
  document.body.appendChild(menu);
  menu.addEventListener('click', (e)=>{
    const a = e.target.dataset.a;
    if(a==='open') ic.action();
    if(a==='props') alert(ic.name+'\nTyp: Systémová ikona');
    menu.remove();
  });
  setTimeout(()=>document.addEventListener('click', function h(){ menu.remove(); document.removeEventListener('click',h); }), 10);
}

function openTextFile(name){
  createWindow({ id:'txt-'+name, title:name, icon:'📄', width:280, height:220,
    content: '<div style="padding:10px;color:#222;">Zde nic zajímavého — jen prázdný textový soubor v simulaci.</div>' });
}

/* ============================================================
   VÝBĚROVÝ OBDÉLNÍK (drag select na ploše)
   ============================================================ */
(function selectRectSetup(){
  const layer = document.getElementById('icons-layer');
  const rect = document.getElementById('select-rect');
  let startX=0, startY=0, active=false;

  function onDown(x,y,target){
    if(target.closest('.desktop-icon')) return;
    active = true; startX = x; startY = y;
    rect.style.left = x+'px'; rect.style.top = y+'px';
    rect.style.width = '0px'; rect.style.height='0px';
    rect.style.display = 'block';
    document.querySelectorAll('.desktop-icon').forEach(i=>i.classList.remove('selected'));
    hideAllContextMenus();
  }
  function onMove(x,y){
    if(!active) return;
    const l = Math.min(x,startX), t = Math.min(y,startY);
    const w = Math.abs(x-startX), h = Math.abs(y-startY);
    rect.style.left=l+'px'; rect.style.top=t+'px'; rect.style.width=w+'px'; rect.style.height=h+'px';
    const rb = rect.getBoundingClientRect();
    document.querySelectorAll('.desktop-icon').forEach(icEl=>{
      const ir = icEl.getBoundingClientRect();
      const overlap = !(ir.right<rb.left || ir.left>rb.right || ir.bottom<rb.top || ir.top>rb.bottom);
      icEl.classList.toggle('selected', overlap);
    });
  }
  function onUp(){ active=false; rect.style.display='none'; }

  desktop.addEventListener('mousedown', e=>{
    if(e.target.closest('.win') || e.target.closest('#taskbar')) return;
    onDown(e.clientX, e.clientY, e.target);
  });
  window.addEventListener('mousemove', e=> onMove(e.clientX,e.clientY));
  window.addEventListener('mouseup', onUp);

  desktop.addEventListener('touchstart', e=>{
    if(e.target.closest('.win') || e.target.closest('#taskbar')) return;
    const t = e.touches[0]; onDown(t.clientX, t.clientY, e.target);
  }, {passive:true});
  desktop.addEventListener('touchmove', e=>{
    const t = e.touches[0]; onMove(t.clientX, t.clientY);
  }, {passive:true});
  desktop.addEventListener('touchend', onUp);
})();

/* ============================================================
   KONTEXTOVÁ MENU – plocha a taskbar
   ============================================================ */
function hideAllContextMenus(){
  document.querySelectorAll('.context-menu').forEach(m=>{ if(m.id!=='ctx-desktop' && m.id!=='ctx-taskbar' && !m.classList.contains('sub-menu')) return; m.style.display='none'; });
}

const ctxDesktop = document.getElementById('ctx-desktop');
const ctxTaskbar = document.getElementById('ctx-taskbar');

let menuJustOpenedAt = 0;
function openMenuAt(menu, x, y){
  hideAllContextMenus();
  menu.style.display='block';
  const mw = 200, mh = 260;
  let px = x, py = y;
  if(px + mw > window.innerWidth) px = window.innerWidth - mw - 6;
  if(py + mh > window.innerHeight) py = window.innerHeight - mh - 6;
  menu.style.left = px+'px'; menu.style.top = py+'px';
  menuJustOpenedAt = Date.now();
}

let pressTimer = null;
desktop.addEventListener('contextmenu', e=>{
  if(e.target.closest('.win') || e.target.closest('#taskbar') || e.target.closest('.desktop-icon')) return;
  e.preventDefault();
  openMenuAt(ctxDesktop, e.clientX, e.clientY);
});
desktop.addEventListener('touchstart', e=>{
  if(e.target.closest('.win') || e.target.closest('#taskbar') || e.target.closest('.desktop-icon')) return;
  const t = e.touches[0];
  pressTimer = setTimeout(()=>{ openMenuAt(ctxDesktop, t.clientX, t.clientY); pressTimer=null; }, 550);
}, {passive:true});
desktop.addEventListener('touchmove', ()=>{ if(pressTimer){clearTimeout(pressTimer); pressTimer=null;} });
desktop.addEventListener('touchend', ()=>{ if(pressTimer){clearTimeout(pressTimer); pressTimer=null;} });

document.getElementById('taskbar').addEventListener('contextmenu', e=>{
  e.preventDefault(); e.stopPropagation(); openMenuAt(ctxTaskbar, e.clientX, e.clientY);
});
let tbPressTimer=null, tbPressMoved=false;
document.getElementById('taskbar').addEventListener('touchstart', e=>{
  // dlouhý stisk na tlačítku Start nebo na oknech v taskbaru neotevírá vlastnosti hl. panelu
  if(e.target.closest('#start-button') || e.target.closest('.taskbar-win-btn')) return;
  tbPressMoved = false;
  const t=e.touches[0];
  tbPressTimer = setTimeout(()=>{
    if(!tbPressMoved) openMenuAt(ctxTaskbar, t.clientX, t.clientY);
    tbPressTimer=null;
  }, 500);
}, {passive:true});
document.getElementById('taskbar').addEventListener('touchmove', ()=>{ tbPressMoved = true; if(tbPressTimer){clearTimeout(tbPressTimer); tbPressTimer=null;} });
document.getElementById('taskbar').addEventListener('touchend', ()=>{ if(tbPressTimer){clearTimeout(tbPressTimer); tbPressTimer=null;} });

document.addEventListener('click', (e)=>{
  // ignoruj "klik", pokud právě teď (do 400ms) otevřelo menu dlouhé podržení - jinak by se menu hned zavřelo
  if(Date.now() - menuJustOpenedAt < 400) return;
  if(!e.target.closest('.context-menu')) hideAllContextMenus();
});

// submenu toggles
document.querySelectorAll('[data-sub]').forEach(item=>{
  item.addEventListener('click', (e)=>{
    e.stopPropagation();
    const sub = document.getElementById(item.dataset.sub);
    const r = item.getBoundingClientRect();
    document.querySelectorAll('.sub-menu').forEach(s=>{ if(s!==sub) s.style.display='none'; });
    const showing = sub.style.display === 'block';
    sub.style.display = showing ? 'none' : 'block';
    sub.style.left = (r.right)+'px';
    sub.style.top = (r.top)+'px';
  });
});

ctxDesktop.addEventListener('click', e=>{
  const act = e.target.dataset.act; if(!act) return;
  handleDesktopAction(act);
  hideAllContextMenus();
});
[document.getElementById('view-sub'), document.getElementById('sort-sub'), document.getElementById('new-sub')].forEach(sm=>{
  sm.addEventListener('click', e=>{
    const act = e.target.dataset.act; if(!act) return;
    handleDesktopAction(act);
    hideAllContextMenus();
  });
});

function handleDesktopAction(act){
  switch(act){
    case 'refresh': Sound.click(); break;
    case 'new-folder': {
      const n = 'Nová složka';
      desktopIcons.push({id:'df'+Date.now(), name:n, icon:'📁', x: 14, y: 40+desktopIcons.length*90, action:()=>alert('Prázdná složka: '+n)});
      renderIcons(); Sound.click(); break;
    }
    case 'new-file': {
      const n = 'Nový textový dokument.txt';
      desktopIcons.push({id:'nf'+Date.now(), name:n, icon:'📄', x: 14, y: 40+desktopIcons.length*90, action:()=>openTextFile(n)});
      renderIcons(); Sound.click(); break;
    }
    case 'properties':
      createWindow({id:'props-desktop', title:'Vlastnosti - Displej', icon:'🖥️', width:300, height:200,
        content:'<div style="padding:12px;color:#222;">Rozlišení obrazovky: responzivní<br>Motiv: Windows 7 Aero (simulace)<br>Pozadí: výchozí modré</div>'});
      break;
    default:
      // view-*/sort-* – kosmetické, jen pípnutí
      Sound.click();
  }
}

ctxTaskbar.addEventListener('click', e=>{
  const act = e.target.dataset.act; if(!act) return;
  if(act==='open-taskmgr') openTaskManager();
  if(act==='taskbar-props') openTaskbarProperties();
  hideAllContextMenus();
});

function openTaskbarProperties(){
  const taskbarEl = document.getElementById('taskbar');
  const content = document.createElement('div');
  content.style.cssText = 'padding:12px;color:#222;font-size:13px;';
  content.innerHTML =
    '<label><input type="checkbox" checked disabled> Uzamknout hlavní panel</label><br><br>'+
    '<label><input type="checkbox" id="tb-autohide-chk"'+(taskbarEl.classList.contains('autohide')?' checked':'')+'> Automaticky skrývat hlavní panel</label><br><br>'+
    '<label><input type="checkbox" checked disabled> Používat malé ikony</label>'+
    '<div class="cp-msg" id="tb-props-msg"></div>';
  createWindow({id:'taskbar-props', title:'Vlastnosti hlavního panelu', icon:'📌', width:300, height:220, content});
  content.querySelector('#tb-autohide-chk').addEventListener('change', (e)=>{
    taskbarEl.classList.toggle('autohide', e.target.checked);
    content.querySelector('#tb-props-msg').textContent = e.target.checked ? 'Hlavní panel se nyní automaticky skrývá.' : 'Automatické skrývání vypnuto.';
    Sound.click();
  });
}

/* ============================================================
   START MENU
   ============================================================ */
const startBtn = document.getElementById('start-button');
const startMenu = document.getElementById('start-menu');
startBtn.addEventListener('click', (e)=>{
  e.stopPropagation();
  Sound.click();
  startMenu.style.display = startMenu.style.display === 'block' ? 'none' : 'block';
});
document.addEventListener('click', (e)=>{
  if(!e.target.closest('#start-menu') && !e.target.closest('#start-button')){
    startMenu.style.display = 'none';
  }
});
startMenu.addEventListener('click', (e)=>{
  const act = e.target.closest('[data-act]');
  if(!act) return;
  const a = act.dataset.act;
  startMenu.style.display = 'none';
  if(a==='open-computer') openComputer();
  if(a==='open-controlpanel') openControlPanel();
  if(a==='open-cmd') openCmd();
  if(a==='open-taskmgr') openTaskManager();
  if(a==='open-recyclebin') openRecycleBin();
  if(a==='restart') doShutdown('restart');
  if(a==='shutdown') doShutdown('shutdown');
});

/* ============================================================
   VYPNUTÍ / RESTART
   ============================================================ */
function doShutdown(mode){
  Sound.close();
  desktop.classList.remove('corrupted');
  desktop.classList.remove('no-explorer');
  desktop.style.display = 'none';
  shutdownScreen.style.display = 'flex';
  document.getElementById('shutdown-text').textContent =
    mode === 'restart' ? 'Restartování systému...' : 'Vypínání systému...';
  setTimeout(()=>{
    shutdownScreen.style.display = 'none';
    if(mode === 'restart'){
      showBootSplash(showLogin);
    } else {
      document.getElementById('poweroff-screen').style.display = 'flex';
    }
  }, 2600);
}

/* ---------- ODHALENÍ AUTOMATICKY SKRYTÉHO HLAVNÍHO PANELU (dotyk) ---------- */
(function taskbarPeekSetup(){
  const strip = document.getElementById('taskbar-peek-strip');
  const taskbarEl = document.getElementById('taskbar');
  let hideTimer = null;
  strip.addEventListener('touchstart', ()=>{
    taskbarEl.classList.add('peek');
    if(hideTimer) clearTimeout(hideTimer);
  }, {passive:true});
  taskbarEl.addEventListener('touchstart', ()=>{
    taskbarEl.classList.add('peek');
    if(hideTimer) clearTimeout(hideTimer);
  }, {passive:true});
  document.addEventListener('touchend', ()=>{
    if(hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(()=>{ taskbarEl.classList.remove('peek'); }, 2500);
  }, {passive:true});
})();

/* ---------- SKŘÍŇ PC – power tlačítko (klik = zapnout, rychlý dvojklik = automatická oprava) ---------- */
(function powerButtonSetup(){
  const btn = document.getElementById('pc-power-btn');
  let lastPress = 0;
  function press(){
    btn.classList.add('lit');
    Sound.click();
    const now = Date.now();
    if(now - lastPress < 600){
      // dvojklik -> automatická oprava při startu
      document.getElementById('poweroff-screen').style.display = 'none';
      runAutomaticRepair(true);
    } else {
      // jeden klik -> normální zapnutí
      setTimeout(()=>{
        if(Date.now() - lastPress >= 600){
          document.getElementById('poweroff-screen').style.display = 'none';
          showBootSplash(showLogin);
        }
      }, 650);
    }
    lastPress = now;
  }
  btn.addEventListener('click', press);
  btn.addEventListener('touchstart', (e)=>{ e.preventDefault(); press(); }, {passive:false});
})();

/* ============================================================
   PRŮZKUMNÍK / TENTO POČÍTAČ
   ============================================================ */
function openComputer(){ openExplorerAt([]); }

/* historie navigace průzkumníka (pro tlačítko Zpět/Vpřed) */
let explorerHistory = [];
let explorerHistoryIndex = -1;

function openExplorerAt(pathArr, fromHistory){
  pathArr = pathArr || [];
  const winId = 'explorer-win';

  if(!fromHistory){
    // ořízni "budoucí" historii a přidej novou cestu
    explorerHistory = explorerHistory.slice(0, explorerHistoryIndex+1);
    explorerHistory.push(pathArr);
    explorerHistoryIndex = explorerHistory.length - 1;
  }

  let node;
  if(!pathArr || pathArr.length===0){
    node = null; // root = list of drives
  } else {
    let cur = { children: fsRoot };
    for(const p of pathArr){ cur = cur.children[p]; }
    node = cur;
  }

  const pathLabel = pathArr && pathArr.length ? pathArr.join(' \u203A ') : 'Tento počítač';
  const canBack = explorerHistoryIndex > 0;
  const canFwd = explorerHistoryIndex < explorerHistory.length - 1;

  const container = document.createElement('div');
  container.style.height = '100%';
  container.innerHTML =
    '<div class="explorer-toolbar" style="display:flex;align-items:center;gap:6px;">'+
      '<span id="exp-back-btn" style="cursor:var(--w7-hand);padding:2px 8px;border:1px solid '+(canBack?'#7a9bc2':'#ccc')+';border-radius:3px;background:'+(canBack?'#eef3fb':'#f2f2f2')+';color:'+(canBack?'#222':'#aaa')+';">◀</span>'+
      '<span id="exp-fwd-btn" style="cursor:var(--w7-hand);padding:2px 8px;border:1px solid '+(canFwd?'#7a9bc2':'#ccc')+';border-radius:3px;background:'+(canFwd?'#eef3fb':'#f2f2f2')+';color:'+(canFwd?'#222':'#aaa')+';">▶</span>'+
      '<span style="flex:1;">📍 '+pathLabel+'</span>'+
    '</div>'+
    '<div class="explorer-body">'+
      '<div class="explorer-side">Oblíbené položky<br>📁 Plocha<br>📄 Dokumenty<br><br>Počítač<br>💽 Místní disk (C:)</div>'+
      '<div class="explorer-main" id="explorer-main"></div>'+
    '</div>';

  let w;
  if(openWindows[winId]){
    // okno už existuje - aktualizuj jeho obsah (lišta Zpět/Vpřed, cesta) místo pouhého zaostření
    w = openWindows[winId];
    w.el.querySelector('.win-body').innerHTML = '';
    w.el.querySelector('.win-body').appendChild(container);
    w.el.querySelector('.wt-title span:last-child').textContent = 'Průzkumník - '+pathLabel;
    w.btn.querySelector('span:last-child').textContent = 'Průzkumník - '+pathLabel;
    focusWindow(winId);
  } else {
    w = createWindow({ id: winId, title: 'Průzkumník - '+pathLabel, icon:'💻', width:380, height:300, content: container });
  }
  populateExplorer(w.el.querySelector('#explorer-main'), pathArr||[], node);

  const backBtn = w.el.querySelector('#exp-back-btn');
  const fwdBtn = w.el.querySelector('#exp-fwd-btn');
  backBtn.addEventListener('click', (e)=>{
    e.stopPropagation();
    if(explorerHistoryIndex > 0){
      explorerHistoryIndex--;
      Sound.click();
      openExplorerAt(explorerHistory[explorerHistoryIndex], true);
    }
  });
  fwdBtn.addEventListener('click', (e)=>{
    e.stopPropagation();
    if(explorerHistoryIndex < explorerHistory.length - 1){
      explorerHistoryIndex++;
      Sound.click();
      openExplorerAt(explorerHistory[explorerHistoryIndex], true);
    }
  });
}

function populateExplorer(mainEl, pathArr, node){
  mainEl.innerHTML = '';
  let entries;
  if(!node){
    entries = Object.keys(fsRoot).map(k=>({key:k, val:fsRoot[k], icon:'💽'}));
  } else {
    entries = Object.keys(node.children||{}).map(k=>({key:k, val:node.children[k], icon: node.children[k].type==='folder' ? '📁' : '📄'}));
  }
  if(entries.length===0){
    mainEl.innerHTML = '<div style="color:#888;padding:10px;">Tato složka je prázdná.</div>';
    return;
  }
  entries.forEach(ent=>{
    const div = document.createElement('div');
    div.className = 'fs-item';
    div.innerHTML = '<div class="ic">'+ent.icon+'</div><div class="lbl">'+ent.key+'</div>';
    let holdT = null;
    div.addEventListener('click', ()=>{
      Sound.click();
      if(ent.val.type==='folder' || ent.val.type==='drive'){
        openExplorerAt(pathArr.concat([ent.key]));
      } else if(ent.val.app === 'browser'){
        openBrowser();
      }
    });
    div.addEventListener('contextmenu', (e)=>{ e.preventDefault(); showFsItemMenu(div, pathArr, ent, node); });
    div.addEventListener('touchstart', ()=>{
      holdT = setTimeout(()=>{ showFsItemMenu(div, pathArr, ent, node); holdT=null; }, 550);
    }, {passive:true});
    div.addEventListener('touchend', ()=>{ if(holdT) clearTimeout(holdT); });
    div.addEventListener('touchmove', ()=>{ if(holdT){clearTimeout(holdT); holdT=null;} });
    mainEl.appendChild(div);
  });
}

function showFsItemMenu(el, pathArr, ent, parentNode){
  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.style.display = 'block';
  const r = el.getBoundingClientRect();
  menu.style.left = r.left+'px'; menu.style.top = r.bottom+'px';
  menu.innerHTML = '<div class="cm-item" data-a="open">Otevřít</div><div class="cm-item" data-a="delete">Odstranit</div><div class="cm-sep"></div><div class="cm-item" data-a="props">Vlastnosti</div>';
  document.body.appendChild(menu);
  menu.addEventListener('click', (e)=>{
    const a = e.target.dataset.a;
    if(a==='open' && (ent.val.type==='folder'||ent.val.type==='drive')) openExplorerAt(pathArr.concat([ent.key]));
    if(a==='delete') tryDeleteEntry(pathArr, ent, parentNode);
    if(a==='props') alert(ent.key + '\nTyp: ' + (ent.val.type==='folder'?'Složka':(ent.val.type==='drive'?'Jednotka':'Soubor')) + (ent.val.system?'\n(Systémová položka)':''));
    menu.remove();
  });
  setTimeout(()=>document.addEventListener('click', function h(){ menu.remove(); document.removeEventListener('click',h); }), 10);
}

function tryDeleteEntry(pathArr, ent, parentNode){
  if(ent.val.system && !ent.val.unlocked){
    Sound.error();
    createWindow({ id:'err-'+Date.now(), title:'Chyba při odstraňování složky', icon:'⛔', width:320, height:200,
      content: '<div class="err-dialog"><div class="ic">⛔</div>'+
        '<b>Přístup odepřen</b><br><br>'+
        'Potřebujete oprávnění od <b>TrustedInstaller</b> k provedení této akce.<br><br>'+
        '<span style="font-size:11px;color:#666;">Tip: zkuste v příkazovém řádku převzít vlastnictví (takeown).</span></div>'
    });
    return;
  }
  if(confirm('Opravdu chcete přesunout "'+ent.key+'" do koše?')){
    const wasSystem = !!ent.val.system;
    delete parentNode.children[ent.key];
    Sound.click();
    if(wasSystem){
      corruptSystem('Odstranili jste systémovou složku "'+ent.key+'". Windows se může chovat nestabilně.');
    }
    // re-render explorer window if open
    const w = openWindows['explorer-win'];
    if(w){
      const mainEl = w.el.querySelector('#explorer-main');
      let node2;
      if(pathArr.length===0){ node2 = null; } else {
        let cur = { children: fsRoot };
        for(const p of pathArr){ cur = cur.children[p]; }
        node2 = cur;
      }
      populateExplorer(mainEl, pathArr, node2);
    }
  }
}

/* ============================================================
   PROHLÍŽEČ (Chromium Beta) – simulace, včetně falešného viru
   ============================================================ */
function openBrowser(){
  const wrap = document.createElement('div');
  wrap.style.height = '100%';
  wrap.innerHTML =
    '<div class="browser-toolbar">'+
      '<button id="br-back">←</button>'+
      '<input type="text" id="br-url" value="chromium://novy-panel">'+
      '<button id="br-go">Přejít</button>'+
    '</div>'+
    '<div class="browser-page" id="br-page"></div>';

  const w = createWindow({ id:'browser-win', title:'Chromium Beta', icon:'🌐', width:360, height:320, content: wrap });
  const page = wrap.querySelector('#br-page');
  const urlInput = wrap.querySelector('#br-url');

  function renderHome(){
    urlInput.value = 'chromium://novy-panel';
    page.innerHTML =
      '<h3>Nový panel</h3>'+
      '<p>Oblíbené odkazy:</p>'+
      '<p>🔗 <a data-go="search">Vyhledávač Bong</a></p>'+
      '<p>🔗 <a data-go="freestuff">stahnizdarma-antivirus.example</a></p>'+
      '<p>🔗 <a data-go="news">Zprávy dne</a></p>';
  }
  function renderSearch(){
    urlInput.value = 'bong.example/search';
    page.innerHTML =
      '<h3>Bong – vyhledávač</h3>'+
      '<p><input type="text" placeholder="Hledat..." style="width:80%;padding:6px;"> <button id="br-search-btn">Hledat</button></p>'+
      '<p style="margin-top:14px;">Doporučené výsledky:</p>'+
      '<p>🔗 <a data-go="freestuff">STÁHNOUT ZDARMA – Super Antivirus 2026!!!</a></p>'+
      '<p>🔗 <a data-go="news">Nejnovější zprávy ze světa IT</a></p>';
    const sb = page.querySelector('#br-search-btn');
    if(sb) sb.addEventListener('click', renderSearch);
  }
  function renderNews(){
    urlInput.value = 'zpravy.example/dnes';
    page.innerHTML = '<h3>Zprávy dne</h3><p>V simulovaném světě se dnes nic zajímavého nestalo.</p>';
  }
  function renderFreestuff(){
    urlInput.value = 'stahnizdarma-antivirus.example';
    page.innerHTML =
      '<h3>🎁 Super Antivirus 2026 ZDARMA!</h3>'+
      '<p>Klikněte na tlačítko níže pro okamžité stažení a ochranu vašeho počítače.</p>'+
      '<p><button class="win7-btn" id="br-download-btn" style="margin-top:6px;">⬇️ STÁHNOUT NYNÍ</button></p>'+
      '<p style="font-size:11px;color:#999;">(Toto je simulace nebezpečné stránky pro výukové účely.)</p>';
    const db = page.querySelector('#br-download-btn');
    if(db) db.addEventListener('click', triggerVirus);
  }
  function triggerVirus(){
    page.innerHTML =
      '<h3>Stahování...</h3><p>super-antivirus-2026-setup.exe (98 %)</p>'+
      '<div class="virus-banner">⚠️ VAROVÁNÍ: Byl detekován škodlivý soubor!</div>';
    Sound.error();
    setTimeout(()=>{
      virusActive = true;
      // virus "smaže" pár nesystémových položek a naruší systém
      try{
        const usersNode = fsRoot['C:'].children['Users'].children[LS.user].children;
        Object.keys(usersNode).forEach(k=>{ if(Math.random()<0.5) delete usersNode[k]; });
      } catch(e){}
      corruptSystem('Váš počítač byl napaden virem! Spusťte "removevirus" v příkazovém řádku nebo použijte Automatickou opravu.');
      page.innerHTML =
        '<div class="virus-banner">🦠 VIRUS AKTIVNÍ<br><br>Vaše soubory jsou poškozovány.<br>'+
        'Otevřete Příkazový řádek a napište: <b>removevirus</b><br>'+
        'nebo v Ovládacích panelech spusťte Automatickou opravu.</div>';
    }, 1600);
  }

  wrap.querySelector('#br-back').addEventListener('click', renderHome);
  wrap.querySelector('#br-go').addEventListener('click', ()=>{
    const v = urlInput.value.toLowerCase();
    if(v.includes('antivirus') || v.includes('freestuff')) renderFreestuff();
    else if(v.includes('bong') || v.includes('search')) renderSearch();
    else if(v.includes('zpravy') || v.includes('news')) renderNews();
    else renderHome();
  });
  page.addEventListener('click', (e)=>{
    const a = e.target.closest('[data-go]');
    if(!a) return;
    const g = a.dataset.go;
    if(g==='search') renderSearch();
    if(g==='freestuff') renderFreestuff();
    if(g==='news') renderNews();
  });

  renderHome();
}

/* ============================================================
   KOŠ
   ============================================================ */
function openRecycleBin(){
  createWindow({ id:'recyclebin-win', title:'Koš', icon:'🗑️', width:300, height:220,
    content: '<div style="padding:16px;color:#666;text-align:center;">Koš je prázdný.</div>' });
}

/* ============================================================
   OVLÁDACÍ PANELY
   ============================================================ */
function openControlPanel(){
  const content = document.createElement('div');
  content.className = 'cp-body';
  content.innerHTML =
    '<div class="cp-section">'+
      '<h3>👤 Uživatelské účty</h3>'+
      'Aktuální uživatel: <b id="cp-current-user"></b><br><br>'+
      '<label style="font-size:12px;">Nové heslo</label>'+
      '<input type="password" id="cp-new-pass" placeholder="Nové heslo">'+
      '<button class="win7-btn" id="cp-change-pass-btn" style="margin-top:8px;">Změnit heslo</button>'+
      '<div class="cp-msg" id="cp-msg"></div>'+
    '</div>'+
    '<div class="cp-section">'+
      '<h3>🖱️ Myš</h3>'+
      'Styl ukazatele myši:<br>'+
      '<div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;">'+
        '<button class="win7-btn" data-cursor="default" style="margin-top:0;">Normální ↖</button>'+
        '<button class="win7-btn" data-cursor="pointer" style="margin-top:0;">Ruka 👆</button>'+
        '<button class="win7-btn" data-cursor="crosshair" style="margin-top:0;">Zaměřovač ✛</button>'+
        '<button class="win7-btn" data-cursor="wait" style="margin-top:0;">Přesýpací hodiny ⏳</button>'+
      '</div>'+
      '<div class="cp-msg" id="cp-cursor-msg"></div>'+
    '</div>'+
    '<div class="cp-section">'+
      '<h3>♻️ Obnovit</h3>'+
      'Pokud počítač nefunguje správně, můžete jej opravit nebo obnovit do továrního nastavení.<br><br>'+
      '<button class="win7-btn" id="cp-repair-btn">🛠️ Automatická oprava</button><br>'+
      '<button class="win7-btn" id="cp-factory-btn" style="background:linear-gradient(#d94b4b,#a41f1f);border-color:#7a1414;">⚠️ Obnovit tovární nastavení</button>'+
      '<div class="cp-msg" id="cp-recovery-msg"></div>'+
    '</div>'+
    '<div class="cp-section">'+
      '<h3>📌 Hlavní panel a nabídka Start</h3>'+
      'Umožňuje upravit chování hlavního panelu (uzamčení, automatické skrývání).<br><br>'+
      '<button class="win7-btn" id="cp-taskbar-btn">Otevřít vlastnosti hlavního panelu</button>'+
    '</div>'+
    '<div class="cp-section">'+
      '<h3>🖥️ Systém</h3>'+
      'Windows 7 Simulace (webová verze)<br>Typ systému: 32bitový/64bitový (simulace)'+
    '</div>';
  createWindow({ id:'controlpanel-win', title:'Ovládací panely', icon:'⚙️', width:340, height:400, content });
  content.querySelector('#cp-current-user').textContent = LS.user;
  content.querySelector('#cp-change-pass-btn').addEventListener('click', ()=>{
    const np = content.querySelector('#cp-new-pass').value;
    LS.pass = np;
    content.querySelector('#cp-msg').textContent = 'Heslo bylo úspěšně změněno.';
    Sound.click();
  });
  content.querySelectorAll('[data-cursor]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      document.documentElement.style.cursor = btn.dataset.cursor;
      document.body.style.cursor = btn.dataset.cursor;
      content.querySelector('#cp-cursor-msg').textContent = 'Kurzor myši byl změněn.';
      Sound.click();
    });
  });
  content.querySelector('#cp-taskbar-btn').addEventListener('click', ()=>{
    openTaskbarProperties();
    Sound.click();
  });
  content.querySelector('#cp-repair-btn').addEventListener('click', ()=>{
    runAutomaticRepair(false);
  });
  content.querySelector('#cp-factory-btn').addEventListener('click', ()=>{
    if(confirm('Opravdu chcete obnovit tovární nastavení? Všechna data, uživatel a soubory budou smazány!')){
      factoryReset();
    }
  });
}

/* ============================================================
   AUTOMATICKÁ OPRAVA / TOVÁRNÍ NASTAVENÍ
   ============================================================ */
const repairStages = [
  'Diagnostika počítače...',
  'Hledání problémů...',
  'Kontrola systémových souborů...',
  'Obnovování poškozených složek...',
  'Odstraňování škodlivého softwaru...',
  'Dokončování opravy...'
];
function runAutomaticRepair(fromBoot, onDone){
  const screen = document.getElementById('repair-screen');
  const bar = document.getElementById('repair-progress');
  const log = document.getElementById('repair-log');
  const title = document.getElementById('repair-title');
  title.textContent = 'Automatická oprava';
  log.innerHTML = '';
  bar.style.width = '0%';
  if(fromBoot){
    desktop.style.display = 'none';
    document.getElementById('poweroff-screen').style.display = 'none';
  }
  screen.style.display = 'flex';
  let i = 0;
  function step(){
    if(i >= repairStages.length){
      healSystem(LS.user);
      const d = document.createElement('div'); d.textContent = 'Oprava byla úspěšně dokončena.';
      log.appendChild(d);
      setTimeout(()=>{
        screen.style.display = 'none';
        if(fromBoot){ showLogin(); }
        else { showGlitchToast('Systém byl opraven.'); }
        if(onDone) onDone();
      }, 800);
      return;
    }
    const d = document.createElement('div'); d.textContent = '✔ '+repairStages[i];
    log.appendChild(d);
    bar.style.width = Math.round(((i+1)/repairStages.length)*100)+'%';
    i++;
    setTimeout(step, 500+Math.random()*400);
  }
  setTimeout(step, 400);
}

function factoryReset(){
  Sound.error();
  localStorage.removeItem('win7_username');
  localStorage.removeItem('win7_password');
  localStorage.removeItem('win7_setup_done');
  location.reload();
}

/* ============================================================
   SPRÁVCE ÚLOH
   ============================================================ */
const fakeProcesses = [
  { name:'explorer.exe', desc:'Windows Explorer', mem:'24 328 K', core:true },
  { name:'dwm.exe', desc:'Desktop Window Manager', mem:'18 112 K' },
  { name:'svchost.exe', desc:'Host proces služby Windows', mem:'12 044 K' },
  { name:'audiodg.exe', desc:'Windows Audio Device Graph', mem:'9 512 K' },
  { name:'taskeng.exe', desc:'Plánovač úloh', mem:'3 220 K' },
  { name:'wmpnetwk.exe', desc:'Sdílení sítě Windows Media Player', mem:'4 004 K' },
  { name:'browser_sim.exe', desc:'Simulovaný prohlížeč', mem:'55 900 K' }
];
let taskMgrProcesses = null;

/* seznam programů, které lze spustit přes "Nový úkol" (Spustit...) */
const runnablePrograms = {
  'explorer.exe': { desc:'Windows Explorer', mem:'24 328 K', core:true, run: ()=>{
      desktop.classList.remove('no-explorer');
      Sound.startup();
  }},
  'explorer': null, // alias, řešeno níže
  'cmd.exe': { desc:'Příkazový řádek', mem:'2 210 K', run: openCmd },
  'cmd': null,
  'taskmgr.exe': { desc:'Správce úloh systému Windows', mem:'6 480 K', run: openTaskManager },
  'taskmgr': null,
  'notepad.exe': { desc:'Poznámkový blok', mem:'3 040 K', run: ()=>openTextFile('Bez názvu.txt') },
  'notepad': null
};

function openTaskManager(){
  if(!taskMgrProcesses) taskMgrProcesses = fakeProcesses.slice();
  // pokud proces Správce úloh ještě není v seznamu (a okno se právě otevírá), přidej ho
  if(!taskMgrProcesses.find(p=>p.name==='taskmgr.exe')){
    taskMgrProcesses.push({ name:'taskmgr.exe', desc:'Správce úloh systému Windows', mem:'6 480 K', core:'self' });
  }
  const content = document.createElement('div');
  content.className = 'tm-body';
  function render(){
    content.innerHTML =
      '<table class="tm-table"><thead><tr><th>Název procesu</th><th>Popis</th><th>Paměť</th></tr></thead><tbody id="tm-tbody"></tbody></table>'+
      '<div class="tm-actions"><button class="win7-btn" id="tm-newtask-btn" style="margin-right:auto;">Nový úkol...</button><button class="win7-btn" id="tm-end-btn">Ukončit proces</button></div>'+
      '<div class="tm-newtask" id="tm-newtask-panel">'+
        'Zadejte název programu, složky, dokumentu nebo internetového<br>zdroje, který chcete otevřít.<br><br>'+
        'Otevřít: <input type="text" id="tm-newtask-input" placeholder="např. cmd, explorer.exe"> '+
        '<button class="win7-btn" id="tm-newtask-ok" style="margin-top:0;">OK</button>'+
        '<div class="cp-msg" id="tm-newtask-msg"></div>'+
      '</div>';
    const tbody = content.querySelector('#tm-tbody');
    taskMgrProcesses.forEach((p,idx)=>{
      const tr = document.createElement('tr');
      tr.innerHTML = '<td>'+p.name+'</td><td>'+p.desc+'</td><td>'+p.mem+'</td>';
      tr.addEventListener('click', ()=>{
        content.querySelectorAll('tr').forEach(r=>r.classList.remove('selected'));
        tr.classList.add('selected');
        tr.dataset.idx = idx;
      });
      tr.dataset.idx = idx;
      tbody.appendChild(tr);
    });

    content.querySelector('#tm-end-btn').addEventListener('click', ()=>{
      const sel = content.querySelector('tr.selected');
      if(!sel){ alert('Vyberte proces ze seznamu.'); return; }
      const idx = parseInt(sel.dataset.idx,10);
      const proc = taskMgrProcesses[idx];

      if(proc.name==='explorer.exe'){
        // skutečné ukončení Explorer.exe - zmizí hl. panel a ikony, obrazovka zčerná
        Sound.error();
        taskMgrProcesses.splice(idx,1);
        desktop.classList.add('no-explorer');
        render();
        return;
      }
      if(proc.core==='self'){
        // ukončení Správce úloh sám sebe -> zavře se jeho okno
        Sound.close();
        taskMgrProcesses.splice(idx,1);
        closeWindow('taskmgr-win');
        return;
      }
      Sound.click();
      taskMgrProcesses.splice(idx,1);
      render();
    });

    content.querySelector('#tm-newtask-btn').addEventListener('click', ()=>{
      const panel = content.querySelector('#tm-newtask-panel');
      panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
      if(panel.style.display === 'block'){
        content.querySelector('#tm-newtask-input').focus();
      }
    });

    function submitNewTask(){
      const input = content.querySelector('#tm-newtask-input');
      const msg = content.querySelector('#tm-newtask-msg');
      let val = input.value.trim().toLowerCase();
      if(!val){ return; }
      // sjednocení aliasů bez přípony .exe
      const withExe = val.endsWith('.exe') ? val : val+'.exe';
      const prog = runnablePrograms[val] || runnablePrograms[withExe];
      if(prog){
        prog.run();
        if(!taskMgrProcesses.find(p=>p.name===withExe)){
          taskMgrProcesses.push({ name: withExe, desc: prog.desc, mem: prog.mem, core: prog.core });
        }
        msg.style.color = '#1a7a1a';
        msg.textContent = 'Program "'+withExe+'" byl spuštěn.';
        input.value = '';
        render();
      } else {
        msg.style.color = '#a41f1f';
        msg.textContent = 'Systém Windows nemůže najít soubor "'+input.value+'". Zkontrolujte název a zkuste to znovu.';
        Sound.error();
      }
    }
    content.querySelector('#tm-newtask-ok').addEventListener('click', submitNewTask);
    content.querySelector('#tm-newtask-input').addEventListener('keydown', e=>{ if(e.key==='Enter') submitNewTask(); });
  }
  render();
  createWindow({ id:'taskmgr-win', title:'Správce úloh systému Windows', icon:'📊', width:360, height:340, content });
}

/* ============================================================
   PŘÍKAZOVÝ ŘÁDEK (CMD)
   ============================================================ */
function openCmd(){
  const content = document.createElement('div');
  content.className = 'cmd-body';
  content.innerHTML =
    '<div id="cmd-log"></div>'+
    '<div id="cmd-inputline"><span id="cmd-prompt">C:\\Users\\'+LS.user+'&gt;</span><input type="text" id="cmd-input" autocomplete="off" autocapitalize="off" spellcheck="false"></div>';

  createWindow({ id:'cmd-win', title:'Příkazový řádek', icon:'<span class="cmd-icon-mini">&gt;_</span>', width:340, height:300, content });

  const log = content.querySelector('#cmd-log');
  const input = content.querySelector('#cmd-input');
  let curPath = ['C:','Users', LS.user];

  function pathStr(){ return curPath.join('\\')+'>'; }
  function printLine(txt){
    const d = document.createElement('div');
    d.textContent = txt;
    log.appendChild(d);
    content.scrollTop = content.scrollHeight;
  }
  function getNodeAt(pathArr){
    let cur = { children: fsRoot };
    for(let i=0;i<pathArr.length;i++){
      if(!cur.children || !cur.children[pathArr[i]]) return null;
      cur = cur.children[pathArr[i]];
    }
    return cur;
  }

  printLine('Microsoft Windows [Verze 6.1.7600] (simulace)');
  printLine('(c) Windows 7 Simulace. Všechna práva vyhrazena.');
  printLine('');
  printLine('Napište "help" pro seznam příkazů.');
  printLine('');

  input.addEventListener('keydown', (e)=>{
    if(e.key !== 'Enter') return;
    const raw = input.value;
    printLine(pathStr()+' '+raw);
    input.value = '';
    handleCmd(raw.trim());
    content.scrollTop = content.scrollHeight;
  });

  function handleCmd(raw){
    if(!raw){ return; }
    const parts = raw.split(' ');
    const cmd = parts[0].toLowerCase();
    const arg = parts.slice(1).join(' ');

    switch(cmd){
      case 'help':
        printLine('Dostupné příkazy:');
        printLine('  help        - zobrazí tento seznam příkazů');
        printLine('  info        - zobrazí informace o systému');
        printLine('  dir         - vypíše obsah aktuální složky');
        printLine('  cd <složka> - přepne do složky (cd .. pro nadřazenou)');
        printLine('  cls         - vymaže obrazovku');
        printLine('  takeown <složka>     - převezme vlastnictví složky (i podsložek)');
        printLine('  icacls <složka> /grant - udělí oprávnění (alias takeown)');
        printLine('  removevirus - odstraní virus a opraví systém');
        printLine('  exit        - zavře okno příkazového řádku');
        break;
      case 'info':
        printLine('Systémové informace:');
        printLine('  Název OS:        Windows 7 Simulace (webová)');
        printLine('  Verze:           6.1.7600 (simulace)');
        printLine('  Název počítače:  WIN7-PC');
        printLine('  Uživatel:        '+LS.user);
        printLine('  Architektura:    x64 (simulace)');
        break;
      case 'dir': {
        const node = getNodeAt(curPath);
        if(!node || !node.children){ printLine('Složku nelze zobrazit.'); break; }
        const keys = Object.keys(node.children);
        printLine(' Adresář: '+curPath.join('\\'));
        printLine('');
        if(keys.length===0) printLine('  (prázdné)');
        keys.forEach(k=>{
          const it = node.children[k];
          printLine('  '+(it.type==='folder'||it.type==='drive'?'<DIR>':'      ')+'   '+k+(it.system?'  [SYSTÉM]':''));
        });
        break;
      }
      case 'cd': {
        if(!arg){ printLine(curPath.join('\\')); break; }
        if(arg==='..'){
          if(curPath.length>1) curPath.pop();
          break;
        }
        const node = getNodeAt(curPath);
        if(node && node.children && node.children[arg] && (node.children[arg].type==='folder'||node.children[arg].type==='drive')){
          curPath.push(arg);
        } else {
          printLine('Systém nemůže najít zadanou cestu.');
        }
        break;
      }
      case 'cls':
        log.innerHTML = '';
        break;
      case 'takeown':
      case 'icacls': {
        // podporuje: takeown windows / takeown /f Windows / takeown /f Windows /r / icacls Windows /grant
        let target = arg
          .replace(/\/f/gi,'')
          .replace(/\/grant.*$/i,'')
          .replace(/\/r/gi,'')
          .replace(/"/g,'')
          .trim();
        if(!target){ printLine('Použití: takeown <NázevSložky>   (příklad: takeown Windows)'); break; }
        const node = getNodeAt(curPath);
        // 1) nejdřív hledej v aktuální složce (case-insensitive)
        let realKey = null, targetNode = null;
        if(node && node.children){
          realKey = Object.keys(node.children).find(k => k.toLowerCase() === target.toLowerCase());
          if(realKey) targetNode = node.children[realKey];
        }
        // 2) pokud nenalezeno, hledej kdekoliv v celém systému (např. "takeown Windows" z libovolné složky)
        if(!targetNode){
          const found = findNodeAnywhere(target.toLowerCase());
          if(found){ realKey = found.key; targetNode = found.node; }
        }
        if(targetNode){
          unlockRecursive(targetNode);
          printLine('ÚSPĚCH: Byl změněn vlastník souboru/adresáře "'+realKey+'"');
          printLine('a všech podadresářů/souborů na '+LS.user+'.');
        } else {
          printLine('SOUBOR NEBYL NALEZEN: Nelze najít zadaný soubor nebo adresář "'+target+'".');
        }
        break;
      }
      case 'removevirus':
        if(virusActive){
          virusActive = false;
          healSystem();
          printLine('Antivirová kontrola dokončena. Virus byl odstraněn a systém opraven.');
          Sound.click();
        } else {
          printLine('Nebyla nalezena žádná hrozba.');
        }
        break;
      case 'exit':
        closeWindow('cmd-win');
        break;
      default:
        printLine('"'+cmd+'" není rozpoznán jako vnitřní nebo externí příkaz.');
        printLine('Napište "help" pro seznam dostupných příkazů.');
    }
  }

  setTimeout(()=>input.focus(), 100);
}

/* ============================================================
   INICIALIZACE
   ============================================================ */
renderIcons();
boot();

})();
