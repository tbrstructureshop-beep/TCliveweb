/**
 * TC WEB LIVE - ENTERPRISE API ENGINE (HYBRID PERSISTENT CACHING)
 * Production Safe V2.3: Session Sync + Offline Fallback + Deduping
 */
const CONFIG = {
    API_URL: "https://script.google.com/macros/s/AKfycbw40HJB0edUo3T_uEXLF4fG-cW1Bl4vHuhng1VBlC2p6uby1BDOjvyBn3bZ-vGLHqk3gg/exec",
    DRIVE_BASE: "https://lh3.googleusercontent.com/d/",
    DB_NAME: "TCWebLiveDB",
    DB_STORE: "api_cache",
    DB_VERSION: 1,
    FETCH_TIMEOUT_MS: 90000 // 90 Detik batas waktu Google Apps Script
};

const API = {
    _pendingRequests: {}, 

    async _dbOp(action, tab, payload = null) {
        return new Promise((resolve) => {
            const req = indexedDB.open(CONFIG.DB_NAME, CONFIG.DB_VERSION);
            
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(CONFIG.DB_STORE)) {
                    db.createObjectStore(CONFIG.DB_STORE);
                }
            };
            
            req.onsuccess = (e) => {
                const db = e.target.result;
                try {
                    const tx = db.transaction(CONFIG.DB_STORE, "readwrite");
                    const store = tx.objectStore(CONFIG.DB_STORE);
                    let dbReq;
                    
                    if (action === "get") dbReq = store.get(tab);
                    else if (action === "set") dbReq = store.put(payload, tab);
                    else if (action === "delete") dbReq = store.delete(tab);

                    tx.oncomplete = () => {
                        db.close(); 
                        resolve(action === "get" ? dbReq.result : true);
                    };
                    tx.onerror = () => { db.close(); resolve(null); };
                } catch (err) { db.close(); resolve(null); }
            };
            req.onerror = () => resolve(null);
        });
    },

    async clearLocalCache(tab) {
        try {
            if (window.parent && window.parent.GLOBAL_CACHE) delete window.parent.GLOBAL_CACHE[tab];
            if (window.GLOBAL_CACHE) delete window.GLOBAL_CACHE[tab];
            if (window.parent && typeof window.parent.clearCache === 'function') window.parent.clearCache(tab);
            
            await API._dbOp("delete", tab);
            
            // 🚀 Hapus juga tanda sesi agar next get() wajib nembak server lagi
            sessionStorage.removeItem(`sync_${tab}`);
        } catch(e) {}
    },

    /**
     * SMART GET: Fresh on Refresh -> RAM -> Disk (with Offline Fallback)
     */
    async get(tab) {
        if (API._pendingRequests[tab]) return API._pendingRequests[tab];

        const fetchPromise = (async () => {
            let cacheStore = null;
            try { cacheStore = (window.parent && window.parent.GLOBAL_CACHE) ? window.parent.GLOBAL_CACHE : (window.GLOBAL_CACHE || {}); } catch (e) {}

            // 🚀 PENYELAMAT REFRESH: Cek apakah browser baru saja di-refresh / ditutup
            const sessionKey = `sync_${tab}`;
            const isFreshSession = !sessionStorage.getItem(sessionKey);

            // Jika BUKAN sesi baru (sudah ditarik di sesi ini), gunakan metode Super Cepat (Cache)
            if (!isFreshSession) {
                // 1. RAM Hit
                if (cacheStore && cacheStore[tab]) {
                    return { status: 'success', data: cacheStore[tab] };
                }
                // 2. DISK Hit
                const localData = await API._dbOp("get", tab);
                if (localData) {
                    if (cacheStore) cacheStore[tab] = localData; 
                    return { status: 'success', data: localData };
                }
            }

            // 3. JIKA SESI BARU (atau Cache Kosong): Nembak Langsung ke Server!
            try {
                console.log(`[SYNC] Menarik data TERBARU dari server untuk: ${tab}`);
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), CONFIG.FETCH_TIMEOUT_MS);

                const resp = await fetch(`${CONFIG.API_URL}?action=read&tab=${tab}`, { signal: controller.signal });
                clearTimeout(timeoutId);
                
                const result = await resp.json();

                if (result && result.status === 'success') {
                    if (cacheStore) cacheStore[tab] = result.data;
                    await API._dbOp("set", tab, result.data); // Simpan ke Hardisk
                    
                    // Tandai bahwa tab ini sudah ditarik paling baru di sesi ini
                    sessionStorage.setItem(sessionKey, 'true');
                }
                return result;

            } catch (e) { 
                // 🚀 PENGAMAN OFFLINE: Jika sedang refresh ternyata tidak ada sinyal internet, 
                // selamatkan aplikasi dengan mengambil data lama dari IndexedDB!
                const fallbackData = await API._dbOp("get", tab);
                if (fallbackData) {
                    console.warn(`[OFFLINE FALLBACK] Koneksi gagal. Menggunakan data offline untuk ${tab}`);
                    if (cacheStore) cacheStore[tab] = fallbackData;
                    return { status: 'success', data: fallbackData, isOffline: true };
                }

                if (e.name === 'AbortError') return { status: 'error', message: 'Server Timeout / Sinyal Terputus' };
                return { status: 'error', message: e.message || 'Gagal terhubung ke server' }; 
            } finally {
                delete API._pendingRequests[tab];
            }
        })();

        API._pendingRequests[tab] = fetchPromise;
        return fetchPromise;
    },

    async post(payload) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), CONFIG.FETCH_TIMEOUT_MS);

            const resp = await fetch(CONFIG.API_URL, {
                method: 'POST',
                body: JSON.stringify(payload),
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            
            const result = await resp.json();

            if (result && result.status === 'success') {
                if (typeof API.clearLocalCache === 'function') {
                    await API.clearLocalCache(payload.tab);
                } else {
                    await API._dbOp("delete", payload.tab);
                    sessionStorage.removeItem(`sync_${payload.tab}`);
                }
            }

            return result;
        } catch (e) {
            const msg = e.name === 'AbortError' ? 'Koneksi terputus (Timeout). Periksa sinyal internet.' : (e.message || 'System Error');
            return { status: 'error', message: msg };
        }
    },

    toBase64: (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    })
};
