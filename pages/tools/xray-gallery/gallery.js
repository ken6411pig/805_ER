'use strict';
(() => {
  const config=window.XRAY_SELECTION;
  const allItems=config?.items;
  const dialog=document.getElementById('viewer');
  if(!Array.isArray(allItems)||!allItems.length)return;
  const get=id=>document.getElementById(id);
  const gallery=get('gallery'),stage=get('stage'),canvas=get('canvas');
  const key='xray-gallery-hidden-images-v1'+(config.visibilityExportedAt?':'+config.visibilityExportedAt:'');
  let saved=config.hiddenIds||[],storageAvailable=true;
  try{
    const stored=localStorage.getItem(key);
    if(stored!==null){const parsed=JSON.parse(stored);if(Array.isArray(parsed))saved=parsed;}
  }catch{storageAvailable=false;}
  const visibility=window.XRAY_VISIBILITY.create(allItems,saved);
  let items=visibility.visible,cursor=0,zoom=1,opener=null,selecting=false;
  const pending=new Set();
  const cards=[...gallery.querySelectorAll('.tile')];
  const picks=[...gallery.querySelectorAll('[data-remove-id]')];
  function updateSelection(){
    get('selected-count').textContent=`已選 ${pending.size} 張`;
    get('remove-selected').disabled=pending.size===0;
  }
  function clearPicks(){pending.clear();for(const box of picks)box.checked=false;updateSelection();}
  function setSelecting(value){
    selecting=value;document.body.classList.toggle('selecting',value);
    get('selection-bar').hidden=!value;
    get('manage-menu').open=false;
    if(!value)clearPicks();
    else get('selection-bar').scrollIntoView({block:'nearest'});
  }
  function persist(){
    try{localStorage.setItem(key,JSON.stringify(visibility.hiddenIds));storageAvailable=true;}
    catch{storageAvailable=false;}
  }
  function applyVisibility(){
    const current=items[cursor]?.id;
    items=visibility.visible;
    for(const card of cards)card.hidden=visibility.isHidden(card.dataset.imageId);
    const removed=visibility.hiddenIds.length;
    get('restore-all').textContent=`恢復全部已移除圖片${removed?'（'+removed+'）':''}`;
    get('restore-all').disabled=removed===0;
    get('empty-gallery').hidden=items.length>0;
    get('storage-note').hidden=storageAvailable;
    if(dialog.open){
      const nextIndex=items.findIndex(item=>item.id===current);
      if(nextIndex<0)dialog.close();else{cursor=nextIndex;show();}
    }
  }
  get('start-selecting').addEventListener('click',()=>setSelecting(true));
  get('finish-selecting').addEventListener('click',()=>setSelecting(false));
  gallery.addEventListener('change',event=>{
    const box=event.target.closest('[data-remove-id]');
    if(!box||!selecting)return;
    if(box.checked)pending.add(box.dataset.removeId);else pending.delete(box.dataset.removeId);
    updateSelection();
  });
  get('remove-selected').addEventListener('click',()=>{
    const count=pending.size;if(!count)return;
    visibility.remove(pending);persist();clearPicks();applyVisibility();
    get('manage-status').textContent=`已移除 ${count} 張，可從管理圖片選單恢復。`;
    get('finish-selecting').focus({preventScroll:true});
  });
  function restore(){
    visibility.restoreAll();persist();clearPicks();applyVisibility();
    get('manage-menu').open=false;
    get('manage-status').textContent='已恢復全部圖片。';
  }
  get('restore-all').addEventListener('click',restore);
  get('empty-restore').addEventListener('click',restore);
  get('export-visible').addEventListener('click',()=>{
    const short=item=>({id:item.id,title:item.title,part:item.part,view:item.view,source:item.source,image:item.image,sourcePage:item.sourcePage});
    const payload={title:'正常 X 光圖庫：目前顯示與移除清單',version:1,scope:'display-gallery',exportedAt:new Date().toISOString(),items:items.map(short),removedIds:visibility.hiddenIds,removedItems:allItems.filter(item=>visibility.isHidden(item.id)).map(short)};
    const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download='X光圖庫-目前顯示與移除清單.json';a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);get('manage-menu').open=false;
  });
  document.addEventListener('click',event=>{if(!event.target.closest('#manage-menu'))get('manage-menu').open=false;});
  function resize(){
    if(!dialog.open)return;
    const photo=canvas.firstElementChild;if(!photo||!items[cursor])return;
    const padding=window.innerWidth<=650?[24,124]:[128,128];
    const ratio=items[cursor].displaySize[0]/items[cursor].displaySize[1];
    const base=Math.max(40,Math.min(stage.clientWidth-padding[0],(stage.clientHeight-padding[1])*ratio));
    photo.style.width=`${base*zoom}px`;canvas.classList.toggle('zoomed',zoom>1);
    get('zoom-out').disabled=zoom<=1;get('zoom-in').disabled=zoom>=4;
  }
  function setZoom(value){
    const x=(stage.scrollLeft+stage.clientWidth/2)/Math.max(1,stage.scrollWidth);
    const y=(stage.scrollTop+stage.clientHeight/2)/Math.max(1,stage.scrollHeight);
    zoom=Math.max(1,Math.min(4,value));resize();
    requestAnimationFrame(()=>{
      if(zoom===1){stage.scrollTop=0;stage.scrollLeft=0;}
      else{stage.scrollLeft=x*stage.scrollWidth-stage.clientWidth/2;stage.scrollTop=y*stage.scrollHeight-stage.clientHeight/2;}
    });
  }
  function show(){
    const item=items[cursor];if(!item)return;
    const photo=document.createElement('div');
    photo.className='radiograph'+(!item.thumbnail&&item.sprite?' sprite':'');
    photo.style.setProperty('--ratio',item.displaySize[0]/item.displaySize[1]);
    const preview=document.createElement('img');
    preview.src=item.thumbnail||item.image;preview.alt=item.title;preview.decoding='async';preview.draggable=false;
    get('viewer-title').textContent=item.title;
    photo.append(preview);canvas.replaceChildren(photo);zoom=1;stage.scrollTop=0;stage.scrollLeft=0;
    get('position').textContent=`第 ${cursor+1} 張，共 ${items.length} 張。${item.title}`;
    get('previous').disabled=items.length<2;get('next').disabled=items.length<2;resize();
    const status=get('image-status');status.hidden=true;
    if(!item.thumbnail)return;
    status.textContent='載入原圖…';status.hidden=false;photo.setAttribute('aria-busy','true');
    // This request starts only after opening or navigating to this image.
    const original=document.createElement('img');
    original.alt=item.title;original.decoding='async';original.draggable=false;
    original.onload=()=>{
      if(canvas.firstElementChild!==photo||!dialog.open)return;
      photo.classList.toggle('sprite',Boolean(item.sprite));
      photo.replaceChildren(original);photo.removeAttribute('aria-busy');status.hidden=true;
    };
    original.onerror=()=>{
      if(canvas.firstElementChild!==photo||!dialog.open)return;
      photo.removeAttribute('aria-busy');status.textContent='原圖載入失敗，請稍後重新開啟。';status.hidden=false;
    };
    original.src=item.image;
  }
  function next(delta){if(!items.length)return;cursor=(cursor+delta+items.length)%items.length;show();}
  gallery.addEventListener('click',event=>{
    const tile=event.target.closest('.tile-open');
    if(!tile||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||typeof dialog.showModal!=='function')return;
    event.preventDefault();
    const index=items.findIndex(item=>item.id===tile.dataset.imageId);if(index<0)return;
    cursor=index;opener=tile;dialog.showModal();document.body.style.overflow='hidden';show();get('close').focus({preventScroll:true});
  });
  get('close').addEventListener('click',()=>dialog.close());
  get('previous').addEventListener('click',()=>next(-1));get('next').addEventListener('click',()=>next(1));
  get('zoom-in').addEventListener('click',()=>setZoom(zoom+.5));get('zoom-out').addEventListener('click',()=>setZoom(zoom-.5));get('fit').addEventListener('click',()=>setZoom(1));
  canvas.addEventListener('dblclick',event=>{if(event.target.closest('.radiograph'))setZoom(zoom===1?2.5:1);});
  stage.addEventListener('click',event=>{if(event.target===canvas||event.target===stage)dialog.close();});
  stage.addEventListener('wheel',event=>{if(!(event.ctrlKey||event.metaKey))return;event.preventDefault();setZoom(zoom+(event.deltaY<0?.25:-.25));},{passive:false});
  dialog.addEventListener('close',()=>{document.body.style.overflow='';canvas.replaceChildren();get('image-status').hidden=true;opener?.focus({preventScroll:true});});
  document.addEventListener('keydown',event=>{
    if(dialog.open){
      if(event.key==='ArrowRight'){event.preventDefault();next(1);}
      else if(event.key==='ArrowLeft'){event.preventDefault();next(-1);}
      else if(event.key==='+'||event.key==='='){event.preventDefault();setZoom(zoom+.5);}
      else if(event.key==='-'){event.preventDefault();setZoom(zoom-.5);}
      else if(event.key==='0'){event.preventDefault();setZoom(1);}
    }else if(event.key==='Escape')setSelecting(false);
  });
  window.addEventListener('resize',resize);
  if(typeof ResizeObserver==='function')new ResizeObserver(resize).observe(stage);
  applyVisibility();updateSelection();
})();
