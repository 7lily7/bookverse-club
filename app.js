const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
// Transcribed from the club's attached annual reading list, 2026 section.
const titles = [
  ["The Backyard Bird Chronicles", "Outlive"],
  ["Love in the time of Cholera", "War Horse"],
  ["Something in the woods loves you", "To the Lighthouse"],
  ["All Passion Spent", "The City and its uncertain walls"],
  ["Why Fish Don’t Exist", "Watership Down"],
  ["Atonement", "Rebecca"],
  ["Perfume", "Butter"],
  ["The English Patient", "The Hound of Baskervilles"],
  ["The Odyssey", "Odyssey"],
  ["A Tree Grows in Brooklyn", "The Ocean would paint me blue"],
  ["The Correspondent", "The Tin Drum"],
  ["Hercule Poirot’s Christmas", "Mate"]
];
const books = titles.flatMap((pair, monthIndex) => pair.map((title, index) => ({ id: `${String(monthIndex+1).padStart(2,'0')}-${index+1}`, title, month: months[monthIndex], monthIndex })));
const palette = [
  ['#dfe8db','#e1b6a6','#6e8974','#fbf3e7','✿'],
  ['#eadbdc','#744d5d','#ba929c','#fff4ed','☾'],
  ['#d7e3e7','#617e8c','#9db4ba','#fff4e4','✧'],
  ['#f1dfcc','#bd8976','#d6aea0','#fff9ed','❋'],
  ['#e5e5d8','#687b68','#9baa87','#fff9e9','❀'],
  ['#e7dce9','#84698c','#b9a3bc','#fff6e9','✦'],
  ['#f2dfce','#a46e62','#d9b29d','#fff6e7','✷'],
  ['#dce5e6','#5d7986','#a7bec4','#fef6e8','✩']
];
const $ = (s) => document.querySelector(s);
const bookGrid = $('#bookGrid');
const monthPicker = $('#monthPicker');
const fileGrid = $('#fileGrid');
const statusEl = $('#libraryStatus');
const feedback = $('#dialogFeedback');
const config = window.BOOKVERSE_CONFIG || {};
const configured = Boolean(config.supabaseUrl && config.supabaseAnonKey && /^https:\/\//.test(config.supabaseUrl));
let supabase = null, member = null, uploadedFiles = [], activeMonth = 'all';

function escapeHTML(s) {return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function formatSize(bytes) {return bytes < 1024*1024 ? `${Math.max(1,Math.round(bytes/1024))} KB` : `${(bytes/(1024*1024)).toFixed(1)} MB`;}
function paintBooks() {
  const filtered = books.filter(b => activeMonth === 'all' || b.month === activeMonth);
  bookGrid.innerHTML = filtered.map((b) => {
    const p = palette[b.monthIndex % palette.length];
    return `<article class="book-card"><div class="book-art" style="--art-bg:${p[0]};--art-accent:${p[2]};--cover-bg:${p[1]};--cover-text:${p[3]}"><span class="art-doodle" aria-hidden="true">${p[4]}</span><div class="book-cover" aria-hidden="true"><span class="cover-decoration">❦</span><span class="cover-title">${escapeHTML(b.title)}</span></div></div><div class="book-info"><div class="book-meta">${escapeHTML(b.month)} · Book ${b.id.slice(-1)}</div><h3>${escapeHTML(b.title)}</h3><button type="button" class="book-action" data-find="${b.id}">Find shared files ↗</button></div></article>`;
  }).join('');
}
monthPicker.innerHTML += months.map(m=> `<button class="month" data-month="${m}" type="button">${m}</button>`).join('');
monthPicker.addEventListener('click', e=> {const btn=e.target.closest('[data-month]');if(!btn)return;activeMonth=btn.dataset.month;monthPicker.querySelectorAll('.month').forEach(x=>x.classList.toggle('active',x===btn));paintBooks();});
bookGrid.addEventListener('click', e=> {const btn=e.target.closest('[data-find]');if(!btn)return;const b=books.find(x=>x.id===btn.dataset.find);if(!b)return;$('#librarySearch').value=b.title;renderFiles();$('#shared-library').scrollIntoView({behavior:'smooth'});});
$('#uploadBook').innerHTML = books.map(b=>`<option value="${b.id}">${escapeHTML(b.month)} · ${escapeHTML(b.title)}</option>`).join('');
paintBooks();

function parseObject(obj) {
  // Names are: bookId--randomId--sanitizedOriginalName
  const match = /^([0-9]{2}-[12])--([a-f0-9-]+)--(.+)$/.exec(obj.name);
  if(!match) return null;
  const book=books.find(b=>b.id===match[1]); if(!book)return null;
  return {key:obj.name, book, original:match[3], size:obj.metadata?.size??0, created:obj.created_at||'', ext:match[3].split('.').pop().toUpperCase()};
}
function renderFiles() {
  const query=$('#librarySearch').value.trim().toLocaleLowerCase();
  const filtered = uploadedFiles.filter(f=>`${f.book.title} ${f.original} ${f.book.month}`.toLocaleLowerCase().includes(query));
  $('#fileCount').textContent = `${uploadedFiles.length} shared file${uploadedFiles.length===1?'':'s'}`;
  fileGrid.innerHTML = filtered.map((f,i)=> {
    const url=supabase.storage.from(config.bucket||'bookclub-files').getPublicUrl(f.key,{download:f.original}).data.publicUrl;
    const date=f.created?new Date(f.created).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):'Shared file';
    return `<article class="file-item"><div class="file-icon">${escapeHTML(f.ext.slice(0,5))}</div><div class="file-info"><strong title="${escapeHTML(f.original)}">${escapeHTML(f.original)}</strong><small>${escapeHTML(f.book.title)} · ${escapeHTML(date)}${f.size?' · '+formatSize(f.size):''}</small></div><a class="download-btn" href="${escapeHTML(url)}" aria-label="Download ${escapeHTML(f.original)}">↓ Download</a></article>`;
  }).join('');
  if(!filtered.length && uploadedFiles.length && query) statusEl.textContent='No matching files yet. Try another title or filename.';
  else if(!uploadedFiles.length && configured) statusEl.textContent='The shelf is waiting for its first shared book. Be the first to contribute!';
  else statusEl.textContent='';
}
$('#librarySearch').addEventListener('input',renderFiles);
async function loadFiles() {
  if(!supabase){ statusEl.textContent='The reading list is ready! File sharing is not yet connected. Follow the setup steps in README.md to activate uploads and downloads.';return; }
  statusEl.textContent='Opening the shared bookshelf...';
  try {
    let result=[];
    for(let offset=0;offset<500;offset+=100){
      const {data,error}=await supabase.storage.from(config.bucket||'bookclub-files').list('',{limit:100,offset,sortBy:{column:'created_at',order:'desc'}});
      if(error)throw error;
      result.push(...data);if(data.length<100)break;
    }
    uploadedFiles=result.map(parseObject).filter(Boolean).sort((a,b)=>b.created.localeCompare(a.created));
    renderFiles();
    if(result.length>=500)statusEl.textContent='Showing the newest 500 files.';
  } catch(e){ statusEl.textContent=`Could not load shared files: ${e.message}`; }
}
$('#refreshFiles').addEventListener('click',loadFiles);

const dialog=$('#clubDialog');
function setFeedback(message){feedback.textContent=message;}
function showDialog(){setFeedback('');dialog.showModal();}
document.querySelectorAll('[data-upload]').forEach(btn=>btn.addEventListener('click',()=>{showDialog();if(!member && !configured)setFeedback('Uploads will become available once the club owner connects Supabase.');}));
$('#accountButton').addEventListener('click',showDialog);
function syncMember(){
  $('#authPanel').hidden=Boolean(member);
  $('#signedPanel').hidden=!member;
  $('#signedEmail').textContent=member?.email||'';
}
$('#loginForm').addEventListener('submit', async e=> {
  e.preventDefault();
  if(!supabase){setFeedback('The file-sharing service has not been configured by the club owner.');return;}
  const btn=e.target.querySelector('button'); btn.disabled=true;btn.textContent='Sending...';
  try{const email=e.target.elements.email.value.trim();const {error}=await supabase.auth.signInWithOtp({email,options:{emailRedirectTo:location.origin+location.pathname}});if(error)throw error;setFeedback('Check your inbox for a sign-in link. If you are an invited member, you can upload after signing in.');}
  catch(err){setFeedback(err.message);}finally{btn.disabled=false;btn.textContent='Send sign-in link ↗';}
});
$('#signOut').addEventListener('click', async()=>{if(!supabase)return;await supabase.auth.signOut();member=null;syncMember();setFeedback('You have signed out.');});
$('#uploadForm').addEventListener('submit', async e=> {
  e.preventDefault();if(!supabase||!member){setFeedback('Please sign in first.');return;}
  const file=$('#uploadFile').files?.[0], bookId=$('#uploadBook').value;
  if(!file){setFeedback('Choose a book file first.');return;}
  if(!/\.(pdf|epub|docx|txt|mobi)$/i.test(file.name)){setFeedback('This file type is not supported.');return;}
  if(file.size>20*1024*1024){setFeedback('Please choose a file under 20 MB.');return;}
  const safeFileName=file.name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]/g,'_').replace(/^\.+/,'').slice(-110)||'book.pdf';
  const objectName=`${bookId}--${crypto.randomUUID()}--${safeFileName}`;
  const btn=$('#uploadSubmit');btn.disabled=true;btn.textContent='Uploading...';setFeedback('Uploading your file securely...');
  try {
    const {error}=await supabase.storage.from(config.bucket||'bookclub-files').upload(objectName,file,{upsert:false,contentType:file.type||'application/octet-stream',cacheControl:'3600'});
    if(error)throw error;
    $('#uploadFile').value='';setFeedback('Book uploaded! Your club can now download it.');await loadFiles();
  }catch(err){setFeedback(`Upload failed: ${err.message}. If you are not on the club member list, ask the organizer for access.`);}
  finally{btn.disabled=false;btn.textContent='Upload to the club ↗';}
});

async function initialize(){
  syncMember();
  if(!configured){await loadFiles();return;}
  try {
    const {createClient}=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    supabase=createClient(config.supabaseUrl,config.supabaseAnonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    const {data}=await supabase.auth.getUser();member=data.user;
    supabase.auth.onAuthStateChange((_event,session)=>{member=session?.user||null;syncMember();});
    syncMember();await loadFiles();
  }catch(err){statusEl.textContent=`File-sharing connection failed: ${err.message}`;}
}
initialize();

const navLinks=[...document.querySelectorAll('.nav-link')];
const observer=new IntersectionObserver(entries=>{entries.forEach(entry=>{if(entry.isIntersecting){navLinks.forEach(a=>a.classList.toggle('active',a.hash===`#${entry.target.id}`));}})},{rootMargin:'-90px 0px -65% 0px'});
document.querySelectorAll('main section[id]').forEach(x=>observer.observe(x));
