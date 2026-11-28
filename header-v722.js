(()=>{
const init=()=>{const header=document.querySelector('.site-header'), actions=header?.querySelector('.nav-actions'), avatar=document.getElementById('accountButton');if(!actions||!avatar)return;
const menu=document.createElement('div');menu.className='bv722-menu';menu.hidden=true;menu.id='bv722-menu';actions.append(menu);
const mq=matchMedia('(max-width: 1050px)');
const account=document.createElement('button');account.type='button';account.textContent='Account / Sign out';account.onclick=()=>{close();avatar.click()};menu.append(account);
const toggle=document.createElement('button');toggle.type='button';toggle.className='avatar bv722-toggle';toggle.setAttribute('aria-label','Account menu');toggle.setAttribute('aria-controls',menu.id);toggle.setAttribute('aria-expanded','false');toggle.innerHTML=avatar.innerHTML;actions.append(toggle);
function close(){menu.hidden=true;toggle.setAttribute('aria-expanded','false')}
toggle.onclick=()=>{menu.hidden=!menu.hidden;toggle.setAttribute('aria-expanded',String(!menu.hidden));if(!menu.hidden)menu.querySelector('button:not([hidden])')?.focus()};
const moved=new Map();function sync(){for(const el of actions.querySelectorAll(':scope > .bv72-entry,:scope > .admin-entry')){if(mq.matches){moved.set(el,true);menu.insertBefore(el,account)}}if(!mq.matches){for(const el of moved.keys())actions.insertBefore(el,toggle);moved.clear();close()}}
new MutationObserver(sync).observe(actions,{childList:true});mq.addEventListener('change',sync);sync();document.addEventListener('click',e=>{if(!menu.contains(e.target)&&!toggle.contains(e.target))close()});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!menu.hidden){close();toggle.focus()}});menu.addEventListener('click',e=>{if(e.target.closest('button'))close()});};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();})();
