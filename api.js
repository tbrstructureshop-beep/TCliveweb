const API_URL = "https://script.google.com/macros/s/AKfycbw40HJB0edUo3T_uEXLF4fG-cW1Bl4vHuhng1VBlC2p6uby1BDOjvyBn3bZ-vGLHqk3gg/exec";

const IndustrialAPI = {
    // Standardized GET
    async fetch(action) {
        const response = await fetch(`${API_URL}?action=${action}`);
        return await response.json();
    },

    // Standardized POST
    async submit(action, data) {
        const response = await fetch(`${API_URL}?action=${action}`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        return await response.json();
    },

    // Drive Thumbnail Helper
    getImg(id) {
        return id ? `https://lh3.googleusercontent.com/d/${id}` : 'https://via.placeholder.com/150?text=No+Image';
    }
};
