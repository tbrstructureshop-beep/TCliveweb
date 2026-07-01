/**
 * TC WEB LIVE - SMART API ENGINE (CACHING ENABLED)
 * Optimization: Parent-State Persistence Logic
 */
const CONFIG = {
    API_URL: "https://script.google.com/macros/s/AKfycbw40HJB0edUo3T_uEXLF4fG-cW1Bl4vHuhng1VBlC2p6uby1BDOjvyBn3bZ-vGLHqk3gg/exec",
    DRIVE_BASE: "https://lh3.googleusercontent.com/d/"
};

const API = {
    /**
     * SMART GET: Cek Gudang Parent sebelum nembak ke Server
     */
    async get(tab) {
        let cacheStore = null;

        // Proteksi: Cek akses ke parent untuk menghindari Cross-Origin error
        try {
            cacheStore = (window.parent && window.parent.GLOBAL_CACHE) ? window.parent.GLOBAL_CACHE : null;
        } catch (e) {
            cacheStore = null; // Buka tab direct (tanpa shell)
        }

        // 1. HIT: Ambil dari Memori Parent (Instan 0ms)
        if (cacheStore && cacheStore[tab]) {
            console.log(`%c[CACHE] Data ${tab} restored from Parent Node`, "color: #0ea5e9; font-weight: bold; border-left: 3px solid #0ea5e9; padding-left: 5px;");
            return { status: 'success', data: cacheStore[tab] };
        }

        // 2. MISS: Fetch dari Google Apps Script
        try {
            console.log(`%c[API] Fetching ${tab} from Remote Server...`, "color: #f59e0b; font-weight: bold;");
            const resp = await fetch(`${CONFIG.API_URL}?action=read&tab=${tab}`);
            const result = await resp.json();

            // 3. Simpan ke Gudang Parent untuk request berikutnya
            if (result.status === 'success' && cacheStore) {
                window.parent.GLOBAL_CACHE[tab] = result.data;
            }

            return result;
        } catch (e) {
            console.error(`[SYSTEM_ERROR] Fetch failed for ${tab}:`, e);
            return { status: 'error' };
        }
    },

    /**
     * SMART POST: Kirim data & Invalidate Cache otomatis
     */
    async post(payload) {
        try {
            console.log(`%c[TRANSACTION] Initiating POST to: ${payload.tab}`, "color: #3b82f6; font-weight: bold;");
            const resp = await fetch(CONFIG.API_URL, {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            const result = await resp.json();

            // 4. INVALIDATION: Jika sukses, hapus cache di Parent agar data tidak basi
            if (result.status === 'success') {
                try {
                    if (window.parent && window.parent.clearCache) {
                        window.parent.clearCache(payload.tab);
                        console.log(`%c[CACHE] Memory invalidated for ${payload.tab}`, "color: #ef4444; font-style: italic;");
                    }
                } catch (e) { /* Tab dibuka direct, abaikan */ }
            }

            return result;
        } catch (e) {
            console.error(`[SYSTEM_ERROR] Transaction failed:`, e);
            return { status: 'error' };
        }
    },

    /**
     * UTILS: File to Base64 Converter
     */
    toBase64: (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    })
};
