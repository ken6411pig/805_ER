'use strict';
(() => {
  function create(allItems, savedIds=[]) {
    const known=new Set(allItems.map(item=>item.id));
    const hidden=new Set((Array.isArray(savedIds)?savedIds:[]).filter(id=>known.has(id)));
    return {
      get visible(){return allItems.filter(item=>!hidden.has(item.id));},
      get hiddenIds(){return [...hidden];},
      isHidden(id){return hidden.has(id);},
      remove(ids){for(const id of ids)if(known.has(id))hidden.add(id);},
      restoreAll(){hidden.clear();}
    };
  }
  globalThis.XRAY_VISIBILITY={create};
})();
