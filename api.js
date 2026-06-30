/**
 * TC WEB LIVE - CENTRALIZED API ENGINE
 */
const CONFIG = {
    API_URL: "https://script.google.com/macros/s/AKfycbw40HJB0edUo3T_uEXLF4fG-cW1Bl4vHuhng1VBlC2p6uby1BDOjvyBn3bZ-vGLHqk3gg/exec",
    DRIVE_BASE: "https://lh3.googleusercontent.com/d/"
};

const API = {
    async get(tab) {
        const resp = await fetch(`${CONFIG.API_URL}?action=read&tab=${tab}`);
        return await resp.json();
    },

    async post(payload) {
        const resp = await fetch(CONFIG.API_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        return await resp.json();
    },

    // Helper Convert File ke Base64
    toBase64: (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    })
};
