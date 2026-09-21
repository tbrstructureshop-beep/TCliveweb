/**
 * TC WEB LIVE - ENTERPRISE API ENGINE (HYBRID PERSISTENT CACHING)
 * Optimization: Memory (RAM) + IndexedDB (Disk) Logic
 */
const CONFIG = {
    API_URL: "https://script.google.com/macros/s/AKfycbw40HJB0edUo3T_uEXLF4fG-cW1Bl4vHuhng1VBlC2p6uby1BDOjvyBn3bZ-vGLHqk3gg/exec",
    DRIVE_BASE: "https://lh3.googleusercontent.com/d/",
    DB_NAME: "TCWebLiveDB",
    DB_STORE: "api_cache",
    DB_VERSION: 1
};

const API = {
    async _dbOp(action, tab, payload = null) {
        return new Promise((resolve) => {
            const req = indexedDB.open(CONFIG.DB_NAME, CONFIG.DB_VERSION);
            req.onupgradeneeded = (e) => e.target.result.createObjectStore(CONFIG.DB_STORE);
            req.onsuccess = (e) => {
                const db = e.target.result;
                const tx = db.transaction(CONFIG.DB_STORE, "readwrite");
                const store = tx.objectStore(CONFIG.DB_STORE);
                
                if (action === "get") {
                    const getReq = store.get(tab);
                    getReq.onsuccess = () => resolve(getReq.result);
                } else if (action === "set") {
                    store.put(payload, tab);
                    resolve(true);
                } else if (action === "delete") {
                    store.delete(tab);
                    resolve(true);
                }
            };
            req.onerror = () => resolve(null);
        });
    },

    async clearLocalCache(tab) {
        try {
            if (window.parent && window.parent.GLOBAL_CACHE) delete window.parent.GLOBAL_CACHE[tab];
            if (window.GLOBAL_CACHE) delete window.GLOBAL_CACHE[tab];
            if (window.parent && typeof window.parent.clearCache === 'function') window.parent.clearCache(tab);
            await this._dbOp("delete", tab);
            console.log(`%c[CACHE_PURGED] ${tab} Destroyed from RAM & Disk`, "color: #ef4444; font-weight: bold;");
        } catch(e) {}
    },

    /**
     * SMART GET: Memory -> Disk (IndexedDB) -> Remote Server
     */
    async get(tab) {
        let cacheStore = null;
        try { cacheStore = (window.parent && window.parent.GLOBAL_CACHE) ? window.parent.GLOBAL_CACHE : null; } catch (e) {}

        // 1. HIT LEVEL 1: RAM
        if (cacheStore && cacheStore[tab]) {
            console.log(`%c[RAM_CACHE] ${tab} Restored`, "color: #0ea5e9; font-weight: bold;");
            return { status: 'success', data: cacheStore[tab] };
        }

        // 2. HIT LEVEL 2: IndexedDB
        const localData = await this._dbOp("get", tab);
        if (localData) {
            console.log(`%c[DISK_CACHE] ${tab} Restored from IndexedDB`, "color: #10b981; font-weight: bold;");
            if (cacheStore) cacheStore[tab] = localData; 
            return { status: 'success', data: localData };
        }

        // 3. MISS: Fetch Server
        try {
            console.log(`%c[API_FETCH] ${tab} from Server...`, "color: #f59e0b; font-weight: bold;");
            const resp = await fetch(`${CONFIG.API_URL}?action=read&tab=${tab}`);
            const result = await resp.json();

            if (result.status === 'success') {
                if (cacheStore) cacheStore[tab] = result.data;
                await this._dbOp("set", tab, result.data);
            }
            return result;
        } catch (e) { return { status: 'error' }; }
    },

    /**
     * SMART POST: Kirim data & Invalidate Hybrid Cache
     */
    async post(payload) {
        try {
            console.log(`%c[TRANSACTION] Initiating POST: ${payload.tab}`, "color: #3b82f6; font-weight: bold;");
            const resp = await fetch(CONFIG.API_URL, {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            const result = await resp.json();

            if (result.status === 'success') {
                // 🚀 PAKSA EKSEKUSI PEMBUNUH CACHE SETELAH POST BERHASIL
                await this.clearLocalCache(payload.tab);
                console.log(`%c[CACHE_PURGE] ${payload.tab} Cache invalidated`, "color: #ef4444; font-style: italic;");
            }

            return result;
        } catch (e) {
            console.error(`[SYSTEM_ERROR] Transaction failed:`, e);
            return { status: 'error' };
        }
    },

    toBase64: (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    })
};
