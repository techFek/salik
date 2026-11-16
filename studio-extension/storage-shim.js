// Studio autosaves through window.storage ({get,set,delete} returning {value}); here it lives in chrome.storage.local.
(function(){
  if(typeof chrome === 'undefined' || !chrome.storage || window.storage) return;
  const area = chrome.storage.local;
  window.storage = {
    async get(key){ const o = await area.get(key); return o[key] === undefined ? null : { key, value: o[key] }; },
    async set(key, value){ await area.set({ [key]: value }); return { key, value }; },
    async delete(key){ await area.remove(key); return { key, deleted: true }; }
  };
})();
