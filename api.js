// api.js - Centralized API Handler
const CONFIG = {
    BASE_URL: 'https://script.google.com/macros/s/AKfycbw40HJB0edUo3T_uEXLF4fG-cW1Bl4vHuhng1VBlC2p6uby1BDOjvyBn3bZ-vGLHqk3gg/exec',
    GDRIVE_PROXY: 'https://lh3.googleusercontent.com/u/0/d/' // For thumbnails
};

const API = {
    async fetch(tab) {
        const res = await fetch(`${CONFIG.BASE_URL}?action=read&tab=${tab}`);
        return await res.json();
    },

    async post(tab, action, payload) {
        const res = await fetch(CONFIG.BASE_URL, {
            method: 'POST',
            body: JSON.stringify({ tab, action, payload })
        });
        return await res.json();
    },

    async uploadImage(file) {
        const reader = new FileReader();
        return new Promise((resolve) => {
            reader.onload = async () => {
                const base64 = reader.result.split(',')[1];
                const res = await fetch(CONFIG.BASE_URL, {
                    method: 'POST',
                    body: JSON.stringify({
                        action: 'upload',
                        payload: { base64, name: file.name, type: file.type }
                    })
                });
                resolve(await res.json());
            };
            reader.readAsDataURL(file);
        });
    }
};

export default API;
