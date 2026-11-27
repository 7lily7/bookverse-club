(()=>{
const seen=new WeakSet();
function scan(){
 for(const old of document.querySelectorAll('#classicGrid img[data-classic-cover]')){
  if(seen.has(old))continue;
  const id=old.dataset.classicCover;if(!/^\d+$/.test(id))continue;
  const img=document.createElement('img');seen.add(img);
  img.className='classic-real-cover';img.dataset.classicCover=id;img.alt=old.alt;img.hidden=true;img.decoding='async';
  const parent=old.parentElement;old.replaceWith(img);
  img.addEventListener('load',()=>{if(img.naturalWidth>1){img.hidden=false;parent.classList.add('has-real-cover')}},{once:true});
  img.addEventListener('error',()=>{img.hidden=true;parent.classList.remove('has-real-cover')},{once:true});
  img.src=new URL('assets/books/'+id+'.jpg?v=705',document.baseURI).href;
 }
}
let queued=false;function schedule(){if(queued)return;queued=true;queueMicrotask(()=>{queued=false;scan()})}
new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});scan();
})();
