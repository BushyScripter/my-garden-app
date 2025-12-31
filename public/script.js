/* --- CONFIGURATION & DATA MODELS --- */
const CONFIG = {
    ADSENSE_CLIENT_ID: "ca-pub-3438241188942945",
    MAX_REWARD: 50 // Maximum coins per task
};

const MAX_FREE_ITEMS = 3;
let token = localStorage.getItem('garden_token'); 
let gardenData = { 
    coins: 0, 
    unlockedItems: ["basic", "terra", "grape"], 
    plants: [], 
    habits: [] 
};
let isPremiumUser = false;
let isDeleteMode = false;
let editingPlantId = null;
let currentViewDate = new Date(); 
let currentShopTab = 'plants';

// --- VISUAL ASSETS (REBALANCED ECONOMY) ---
const PLANT_TYPES = {
    "basic": { name: "Basic Leaf", price: 0, isPremium: false, icon: "🌱", color: "#4CAF50" },
    "sun":   { name: "Sunflower", price: 100, isPremium: false, icon: "🌻", color: "#FFD700" },
    "tulip": { name: "Tulip",     price: 150, isPremium: false, icon: "🌷", color: "#FF69B4" },
    "cactus":{ name: "Cactus",    price: 250, isPremium: false, icon: "🌵", color: "#004D40" },
    "rose":  { name: "Wild Rose", price: 400, isPremium: true,  icon: "🌹", color: "#E91E63" },
    "fern":  { name: "Fern",      price: 500, isPremium: true,  icon: "🌿", color: "#2E7D32" },
    "bonsai":{ name: "Bonsai",    price: 500, isPremium: true,  icon: "🌳", color: "#558B2F" }, 
    "cherry":{ name: "Sakura",    price: 1000,isPremium: true,  icon: "🌸", color: "#F48FB1" } 
};

const VINE_TYPES = {
    "grape":     { name: "Grapes",     price: 0,  isPremium: false, icon: "🍇", color: "#9C27B0" },
    "tomato":    { name: "Tomatoes",   price: 150, isPremium: false, icon: "🍅", color: "#D50000" },
    "strawberry":{ name: "Strawberry", price: 250, isPremium: false, icon: "🍓", color: "#FF1744" },
    "blueberry": { name: "Blueberry",  price: 400, isPremium: true,  icon: "🫐", color: "#3F51B5" }
};

const POT_STYLES = {
    "terra":   { name: "Terra Cotta", price: 0,  isPremium: false, icon: "🏺", color: "#E65100" },
    "classic": { name: "Classic Blue",price: 100, isPremium: false, icon: "🔵", color: "#1E88E5" },
    "modern":  { name: "Modern Wht",  price: 200, isPremium: true,  icon: "⚪", color: "#F5F5F5" },
    "japan":   { name: "Zen Pot",     price: 250, isPremium: true,  icon: "⛩️", color: "#3E2723" },
    "gold":    { name: "Gold Pot",    price: 1000,isPremium: true,  icon: "👑", color: "#FFD700" }
};

let tempPlantState = { type: 'basic', pot: 'terra', mode: 'checklist', checklist: [], counterMax: 10, counterVal: 0 };
let tempHabitState = { type: 'grape' };


/* --- INITIALIZATION & EVENTS --- */
document.addEventListener('DOMContentLoaded', () => {
    const nc = document.getElementById('notification-container');
    if (nc && nc.showPopover) {
        nc.popover = "manual"; // Set as manual popover
        nc.showPopover();      // Push to Top Layer above all dialogs
    }
    setupEventListeners();
    initAuth();
    checkPurchaseSuccess();
    initCarousel();
});

function setupEventListeners() {
    const plantForm = document.getElementById('plant-form');
    if (plantForm) plantForm.addEventListener('submit', handlePlantSubmit);

    const habitForm = document.getElementById('habit-form');
    if (habitForm) habitForm.addEventListener('submit', handleHabitSubmit);
}

/* --- AUTHENTICATION & DATA LOADING --- */
async function initAuth() {
    if (token) {
        try {
            const res = await fetch('/api/load', { headers: { 'x-access-token': token } });
            if (res.ok) {
                const json = await res.json();
                gardenData = json.data;
                isPremiumUser = json.isPremium;
                updateAccountUI(true);
                renderAll();
                return;
            } else {
                token = null;
                localStorage.removeItem('garden_token');
            }
        } catch (e) { console.warn("Server offline, using local."); }
    }
    
    if (!localStorage.getItem('isGuest')) localStorage.setItem('isGuest', 'true');
    const local = localStorage.getItem('guestData');
    if (local) gardenData = JSON.parse(local);
    
    // Default Data Integrity
    if(!gardenData.plants) gardenData.plants = [];
    if(!gardenData.habits) gardenData.habits = [];
    if(!gardenData.unlockedItems) gardenData.unlockedItems = ["basic", "terra", "grape"];
    if(typeof gardenData.coins !== 'number') gardenData.coins = 0;

    updateAccountUI(false);
    renderAll();
}

async function saveData() {
    updateCoinDisplay();
    localStorage.setItem('guestData', JSON.stringify(gardenData));
    
    if (token) {
        try {
            // SECURE SYNC: Send data, update local with fixed server data
            const res = await fetch('/api/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-access-token': token },
                body: JSON.stringify(gardenData)
            });
            const json = await res.json();
            if(json.fixedData) {
                gardenData.coins = json.fixedData.coins;
                gardenData.unlockedItems = json.fixedData.unlockedItems;
                updateCoinDisplay();
            }
        } catch (e) { console.warn("Sync failed"); }
    }
}

/* --- FORM HANDLERS --- */
function handlePlantSubmit(e) {
    e.preventDefault();
    const title = document.getElementById('plant-title').value;

    const newPlant = {
        id: editingPlantId || Date.now(),
        title: title,
        type: tempPlantState.type,
        pot: tempPlantState.pot,
        taskMode: tempPlantState.mode,
        checklist: tempPlantState.checklist,
        counterMax: tempPlantState.counterMax,
        counterVal: tempPlantState.counterVal,
        completed: false
    };

    if(editingPlantId) {
        const idx = gardenData.plants.findIndex(p => p.id === editingPlantId);
        if(idx > -1) newPlant.completed = gardenData.plants[idx].completed; 
        gardenData.plants[idx] = newPlant;
    } else {
        gardenData.plants.push(newPlant);
    }
    
    saveData();
    renderPlants();
    document.getElementById('plant-dialog').close();
}

function handleHabitSubmit(e) {
    e.preventDefault();
    gardenData.habits.push({
        id: Date.now(),
        title: document.getElementById('habit-title').value,
        type: tempHabitState.type,
        history: {}
    });
    saveData();
    renderHabits();
    document.getElementById('habit-dialog').close();
}

/* --- UI NOTIFICATIONS --- */
function showNotification(message, icon = "✨") {
    const container = document.getElementById('notification-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'garden-toast';
    toast.innerHTML = `<span style="font-size:1.2rem">${icon}</span> <span>${message}</span>`;
    
    for(let i=0; i<8; i++) {
        const p = document.createElement('div');
        p.className = 'toast-particle';
        const angle = Math.random() * Math.PI * 2;
        const dist = 30 + Math.random() * 20;
        p.style.setProperty('--tx', `${Math.cos(angle) * dist}px`);
        p.style.setProperty('--ty', `${Math.sin(angle) * dist}px`);
        p.style.left = '50%'; p.style.top = '50%';
        p.style.background = Math.random() > 0.5 ? '#AEEA00' : '#FFD700';
        toast.appendChild(p);
    }
    container.appendChild(toast);
    setTimeout(() => { toast.classList.add('fade-out'); setTimeout(() => toast.remove(), 300); }, 3000);
}

function updateCoinDisplay() {
    const el = document.getElementById('coin-count');
    if(el) {
        el.innerText = gardenData.coins;
        el.parentElement.classList.remove('coin-anim');
        void el.parentElement.offsetWidth; 
        el.parentElement.classList.add('coin-anim');
    }
}

function updateAccountUI(isLoggedIn) {
    const accBtn = document.getElementById('account-btn');
    const premiumBtn = document.getElementById('premium-btn');
    if(token) {
        accBtn.innerText = isPremiumUser ? "👑 Premium" : "👤 Account";
        accBtn.classList.add('logged-in');
        if(isPremiumUser) premiumBtn.style.display = 'none';
    } else {
        accBtn.innerText = "👤 Login";
        accBtn.classList.remove('logged-in');
        if(premiumBtn) premiumBtn.style.display = 'block';
    }
    updateCoinDisplay();
}

/* --- NAVIGATION & ACTIONS --- */
function showPage(id) { 
    document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active')); 
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active')); 
    
    const page = document.getElementById(id);
    if(page) page.classList.add('active'); 
    
    const btn = document.getElementById(`btn-${id}`);
    if(btn) btn.classList.add('active');
}

function safeNavigate(id) { showPage(id); }
function safeAction(fn) { fn(); }

function handleAccountClick() {
    if (token) {
        if(confirm("Log out?")) {
            token = null; localStorage.removeItem('garden_token'); location.reload();
        }
    } else {
        document.getElementById('auth-dialog').showModal();
    }
}
function toggleAuthMode() { alert("Use API endpoints to register."); }
function continueAsGuest() { document.getElementById('auth-dialog').close(); }

async function performLogin() {
    const email = document.getElementById('auth-email').value;
    const pass = document.getElementById('auth-pass').value;
    try {
        const res = await fetch('/api/login', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({email, password: pass})
        });
        const json = await res.json();
        if(json.auth) {
            token = json.token;
            localStorage.setItem('garden_token', token);
            gardenData = json.data;
            isPremiumUser = json.isPremium;
            document.getElementById('auth-dialog').close();
            updateAccountUI(true);
            renderAll();
            showNotification("Welcome back!", "👋");
        } else { showNotification(json.error || "Login Failed", "⚠️"); }
    } catch(e) { showNotification("Server Error", "🚫"); }
}

async function performRegister() {
    const email = document.getElementById('auth-email').value;
    const pass = document.getElementById('auth-pass').value;
    try {
        const res = await fetch('/api/register', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({email, password: pass})
        });
        if(res.ok) showNotification("Account created! Login now.", "✅");
        else showNotification("Failed", "⚠️");
    } catch(e) { showNotification("Server Error", "🚫"); }
}

/* --- RENDERERS & LOGIC --- */
function renderAll() { renderPlants(); renderHabits(); }

// --- PLANT LOGIC ---
function calculateReward(plant) {
    let steps = 0;
    if (plant.taskMode === 'counter') {
        steps = plant.counterMax;
    } else {
        steps = plant.checklist ? plant.checklist.length : 0;
    }
    return Math.min(Math.max(steps, 1), CONFIG.MAX_REWARD);
}

function openPlantDialog(id=null) {
    if(isDeleteMode) return;
    if(!isPremiumUser && !id && gardenData.plants.length >= MAX_FREE_ITEMS) return document.getElementById('premium-dialog').showModal();
    editingPlantId = id;
    if(id) {
        const p = gardenData.plants.find(x => x.id === id);
        document.getElementById('plant-title').value = p.title;
        tempPlantState = { type: p.type, pot: p.pot||'terra', mode: p.taskMode||'checklist', checklist: JSON.parse(JSON.stringify(p.checklist||[])), counterMax: p.counterMax||10, counterVal: p.counterVal||0 };
    } else {
        document.getElementById('plant-form').reset();
        tempPlantState = { type: 'basic', pot: 'terra', mode: 'checklist', checklist: [], counterMax: 10, counterVal: 0 };
    }
    renderSelector('plant-type-selector', PLANT_TYPES, 'type', tempPlantState.type);
    renderSelector('plant-pot-selector', POT_STYLES, 'pot', tempPlantState.pot);
    setTaskMode(tempPlantState.mode);
    document.getElementById('plant-dialog').showModal();
}

// --- SECURE BUYING ---
async function handleBuyItem(key, item) {
    if(gardenData.coins < item.price) return showNotification("Not enough coins", "🚫");

    if(token) {
        try {
            const res = await fetch('/api/buy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-access-token': token },
                body: JSON.stringify({ itemId: key })
            });
            const json = await res.json();
            
            if(json.success) {
                gardenData.coins = json.coins;
                gardenData.unlockedItems = json.unlockedItems;
                showNotification(`Bought ${item.name}!`, "🛍️");
                renderShopTab(currentShopTab);
                updateCoinDisplay();
            } else {
                showNotification(json.error || "Purchase Failed", "🚫");
            }
        } catch(e) { showNotification("Network Error", "🚫"); }
    } else {
        // Guest fallback
        gardenData.coins -= item.price;
        gardenData.unlockedItems.push(key);
        saveData();
        showNotification(`Bought ${item.name}!`, "🛍️");
        renderShopTab(currentShopTab);
    }
}

// --- SECURE REWARD ---
async function claimReward(plantId, amount) {
    gardenData.coins += amount;
    updateCoinDisplay();
    showNotification(`Complete! +${amount} Coins`, "🌟");

    if(token) {
        try {
            const res = await fetch('/api/reward', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-access-token': token },
                body: JSON.stringify({ plantId, amount })
            });
            const json = await res.json();
            if(json.success) gardenData.coins = json.coins; 
            updateCoinDisplay();
        } catch(e) { console.error("Reward sync failed"); }
    }
}

function renderPlants() {
    const container = document.getElementById('garden-grid-container');
    container.innerHTML = '';
    
    gardenData.plants.forEach(plant => {
        let progress = 0;
        
        if(plant.taskMode === 'counter') {
            if(plant.counterMax > 0) progress = (plant.counterVal / plant.counterMax) * 100;
        } else {
            const done = plant.checklist.filter(t=>t.done).length;
            if(plant.checklist.length > 0) progress = (done / plant.checklist.length) * 100;
        }
        
        let stage = 0;
        if(progress >= 100) stage = 3;
        else if(progress >= 50) stage = 2;
        else if(progress >= 25) stage = 1;
        
        plant.visualStage = stage;
        plant.progress = progress;

        const isCurrentlyComplete = (progress >= 100);
        const rewardAmount = calculateReward(plant);

        if (!!plant.completed !== isCurrentlyComplete) {
            if (isCurrentlyComplete) {
                claimReward(plant.id, rewardAmount);
            } else {
                gardenData.coins = Math.max(0, gardenData.coins - rewardAmount);
            }
            plant.completed = isCurrentlyComplete;
            saveData();
        }
    });

    gardenData.plants.forEach(plant => {
        let label = "";
        if(plant.taskMode === 'counter') {
            label = `${plant.counterVal} / ${plant.counterMax}`;
        } else {
            const done = plant.checklist.filter(t=>t.done).length;
            label = `${done} / ${plant.checklist.length}`;
        }

        const card = document.createElement('div');
        card.className = 'potted-plant-card';
        
        const clickArea = document.createElement('div');
        clickArea.className = 'plant-click-area';
        clickArea.onclick = () => {
            if(isDeleteMode) { 
                if(confirm("Delete this plant?")) { 
                    gardenData.plants = gardenData.plants.filter(p=>p.id!==plant.id); 
                    saveData(); 
                    renderPlants(); 
                }
            } else openPlantDialog(plant.id);
        };

        const svgContent = getPlantSVG(plant.visualStage, plant.type, plant.pot);

        clickArea.innerHTML = `
            <div class="plant-visual-container">${svgContent}</div>
            <div class="plant-info">
                <h3>${plant.title.replace(/</g, "&lt;")}</h3>
                <div class="progress-bar-container">
                    <div class="progress-bar-fill" style="width:${Math.min(plant.progress,100)}%; background:${plant.progress>=100?'var(--coin)':'var(--p-leaf-lime)'}"></div>
                </div>
                <div style="font-size:0.7rem; color:#aaa; margin-top:4px;">${label}</div>
            </div>`;
        
        let btnHTML = null;
        if(plant.taskMode === 'counter' && !isDeleteMode) {
            if (plant.counterVal < plant.counterMax) {
                const btn = document.createElement('button');
                btn.className = 'plant-action-btn';
                btn.type = 'button';
                btn.innerHTML = `<span>💧</span> Grow`;
                btn.onclick = (e) => {
                    e.stopPropagation();
                    if (plant.counterVal < plant.counterMax) {
                        plant.counterVal++;
                        saveData(); 
                        renderPlants();
                    }
                };
                btnHTML = btn;
            } else {
                const doneBadge = document.createElement('div');
                doneBadge.className = 'plant-action-btn';
                doneBadge.style.background = 'gold';
                doneBadge.style.color = 'black';
                doneBadge.innerHTML = '✅ Done';
                btnHTML = doneBadge;
            }
        } else if (plant.taskMode === 'checklist' && !isDeleteMode) {
            const btn = document.createElement('button');
            btn.className = 'plant-action-btn';
            btn.type = 'button';
            btn.innerHTML = `<span>📝</span> View List`;
            btn.onclick = (e) => { e.stopPropagation(); openPlantDialog(plant.id); };
            btnHTML = btn;
        }

        card.appendChild(clickArea);
        if(btnHTML) card.appendChild(btnHTML);
        container.appendChild(card);
    });
}

// --- MASTERPIECE PLANT SVG GENERATOR ---
function getPlantSVG(stage, type, potStyle) {
    const potC = POT_STYLES[potStyle]?.color || POT_STYLES['terra'].color;
    const plantC = PLANT_TYPES[type]?.color || PLANT_TYPES['basic'].color;
    
    let potShape = "";
    
    // Unique Pot shape for "Japanese" style
    if(potStyle === 'japan') {
        potShape = `
            <defs>
                <linearGradient id="potGrad-${potStyle}" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" style="stop-color:${potC};stop-opacity:1" />
                    <stop offset="100%" style="stop-color:#1a1110;stop-opacity:0.8" />
                </linearGradient>
            </defs>
            <rect x="30" y="25" width="140" height="40" fill="url(#potGrad-${potStyle})" rx="5" transform="translate(0,135)"/>
            <rect x="40" y="65" width="15" height="10" fill="${potC}" transform="translate(0,135)"/>
            <rect x="145" y="65" width="15" height="10" fill="${potC}" transform="translate(0,135)"/>
            <rect x="25" y="20" width="150" height="8" fill="${potC}" stroke="#1a1110" stroke-width="0.5" transform="translate(0,135)"/>
        `;
    } else {
        // Standard Tapered Pot
        potShape = `
            <defs>
                <linearGradient id="potGrad-${potStyle}" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" style="stop-color:${potC};stop-opacity:1" />
                    <stop offset="80%" style="stop-color:${potC};stop-opacity:1" />
                    <stop offset="100%" style="stop-color:#3e2723;stop-opacity:0.6" />
                </linearGradient>
            </defs>
            <path d="M30,50 L20,0 L80,0 L70,50 C70,60 30,60 30,50 Z" fill="url(#potGrad-${potStyle})" transform="translate(50,150)"/>
            <rect x="68" y="150" width="64" height="8" fill="${potC}" stroke="#3e2723" stroke-width="0.5"/>
        `;
    }
    
    let content = "";

    switch(type) {
        case 'bonsai': // Bonsai Tree
            if (stage === 0) { // Seed
                content = `<circle cx="100" cy="155" r="3" fill="#5D4037"/><path d="M90,155 L110,155" stroke="#795548"/>`;
            } else if (stage === 1) { // Sapling
                content = `<path d="M100,155 Q100,135 105,130" stroke="#795548" stroke-width="4" fill="none"/><circle cx="105" cy="130" r="8" fill="#558B2F" opacity="0.8"/>`;
            } else if (stage === 2) { // Shaping
                content = `<path d="M100,155 Q100,120 80,110 Q90,100 110,90" stroke="#5D4037" stroke-width="6" fill="none"/><circle cx="80" cy="110" r="12" fill="#558B2F"/><circle cx="110" cy="90" r="10" fill="#558B2F"/>`;
            } else { // Mature
                content = `<path d="M100,155 C100,140 80,140 70,120 C60,100 90,100 100,80 C110,60 140,70 150,90" stroke="#4E342E" stroke-width="12" fill="none" stroke-linecap="round"/><circle cx="70" cy="120" r="20" fill="#33691E"/><circle cx="100" cy="80" r="25" fill="#558B2F"/><circle cx="150" cy="90" r="18" fill="#33691E"/><circle cx="90" cy="130" r="15" fill="#558B2F" opacity="0.8"/>`;
            }
            break;

        case 'cherry': // Sakura
            if (stage === 0) { 
                content = `<circle cx="100" cy="155" r="2" fill="#3E2723"/><path d="M90,155 L110,155" stroke="#795548"/>`;
            } else if (stage === 1) { 
                content = `<path d="M100,155 L100,120" stroke="#5D4037" stroke-width="3"/><path d="M100,140 L110,130" stroke="#5D4037" stroke-width="2"/><circle cx="110" cy="130" r="3" fill="#F8BBD0"/>`;
            } else if (stage === 2) { 
                content = `<path d="M100,155 L100,100" stroke="#4E342E" stroke-width="4"/><path d="M100,130 L70,110" stroke="#4E342E" stroke-width="3"/><path d="M100,110 L130,90" stroke="#4E342E" stroke-width="3"/><circle cx="70" cy="110" r="8" fill="#F48FB1"/><circle cx="130" cy="90" r="8" fill="#F48FB1"/>`;
            } else { 
                content = `<path d="M100,155 L100,90" stroke="#3E2723" stroke-width="6"/><path d="M100,120 Q60,110 50,90" stroke="#3E2723" stroke-width="4" fill="none"/><path d="M100,110 Q140,100 150,80" stroke="#3E2723" stroke-width="4" fill="none"/><g fill="#F06292" opacity="0.9"><circle cx="50" cy="90" r="15"/><circle cx="150" cy="80" r="15"/><circle cx="100" cy="70" r="20"/><circle cx="80" cy="100" r="10"/><circle cx="120" cy="90" r="12"/><circle cx="100" cy="50" r="15"/></g><circle cx="60" cy="140" r="3" fill="#F8BBD0" opacity="0.6"/>`;
            }
            break;

        case 'sun': // Sunflower
            if (stage === 0) { 
                content = `<path d="M100,155 Q105,150 100,145 Q95,150 100,155 Z" fill="#3E2723" /><path d="M100,145 L100,155" stroke="#fff" stroke-width="0.5"/>`;
            } else if (stage === 1) { 
                content = `<path d="M100,155 L100,135" stroke="#8BC34A" stroke-width="3"/><ellipse cx="92" cy="135" rx="8" ry="4" fill="#8BC34A" transform="rotate(-15 92 135)"/><ellipse cx="108" cy="135" rx="8" ry="4" fill="#8BC34A" transform="rotate(15 108 135)"/>`;
            } else if (stage === 2) { 
                content = `<path d="M100,155 Q105,120 100,90" stroke="#689F38" stroke-width="4" fill="none"/><path d="M100,110 Q80,100 75,110 Q80,120 100,115" fill="#8BC34A"/><path d="M100,130 Q120,120 125,130 Q120,140 100,135" fill="#8BC34A"/><circle cx="100" cy="90" r="8" fill="#43A047"/>`;
            } else { 
                content = `<path d="M100,155 L100,80" stroke="#558B2F" stroke-width="5"/><path d="M100,120 Q70,100 60,115 Q70,130 100,125" fill="#689F38"/><path d="M100,100 Q130,80 140,95 Q130,110 100,105" fill="#689F38"/><g transform="translate(100,60)"><circle r="30" fill="#FDD835"/><path d="M0,0 L0,-35" stroke="#FBC02D" stroke-width="8" transform="rotate(0)"/><path d="M0,0 L0,-35" stroke="#FBC02D" stroke-width="8" transform="rotate(45)"/><path d="M0,0 L0,-35" stroke="#FBC02D" stroke-width="8" transform="rotate(90)"/><path d="M0,0 L0,-35" stroke="#FBC02D" stroke-width="8" transform="rotate(135)"/><path d="M0,0 L0,-35" stroke="#FBC02D" stroke-width="8" transform="rotate(180)"/><path d="M0,0 L0,-35" stroke="#FBC02D" stroke-width="8" transform="rotate(225)"/><path d="M0,0 L0,-35" stroke="#FBC02D" stroke-width="8" transform="rotate(270)"/><path d="M0,0 L0,-35" stroke="#FBC02D" stroke-width="8" transform="rotate(315)"/><circle r="15" fill="#3E2723"/><circle r="12" fill="none" stroke="#5D4037" stroke-dasharray="2"/></g>`;
            }
            break;

        case 'cactus':
            if (stage === 0) {
                content = `<circle cx="90" cy="153" r="1.5" fill="#333"/><circle cx="100" cy="155" r="1.5" fill="#333"/><circle cx="110" cy="152" r="1.5" fill="#333"/><path d="M80,155 L120,155" stroke="#E0E0E0" stroke-width="2"/>`;
            } else if (stage === 1) {
                content = `<circle cx="100" cy="150" r="10" fill="#2E7D32" stroke="#1B5E20" stroke-width="1"/><path d="M100,140 L100,142 M95,145 L95,147 M105,145 L105,147" stroke="#fff" stroke-width="1"/>`;
            } else if (stage === 2) {
                content = `<path d="M90,155 L90,110 Q90,100 100,100 Q110,100 110,110 L110,155 Z" fill="#2E7D32" stroke="#1B5E20" /><line x1="95" y1="105" x2="95" y2="155" stroke="#4CAF50" stroke-width="2" opacity="0.4"/><line x1="105" y1="105" x2="105" y2="155" stroke="#4CAF50" stroke-width="2" opacity="0.4"/><path d="M90,120 L88,118 M110,130 L112,128 M90,140 L88,138" stroke="#fff" stroke-width="1.5"/>`;
            } else {
                content = `<path d="M92,155 L92,80 Q92,70 100,70 Q108,70 108,80 L108,155 Z" fill="#1B5E20" stroke="#004D40"/><path d="M92,110 Q70,110 70,95 Q70,85 78,85 L92,95" fill="#1B5E20" stroke="#004D40"/><path d="M108,100 Q130,100 130,85 Q130,75 122,75 L108,85" fill="#1B5E20" stroke="#004D40"/><line x1="97" y1="75" x2="97" y2="155" stroke="#4CAF50" stroke-width="2" opacity="0.3"/><line x1="103" y1="75" x2="103" y2="155" stroke="#4CAF50" stroke-width="2" opacity="0.3"/><g stroke="#fff" stroke-width="1"><line x1="92" y1="90" x2="90" y2="88"/><line x1="108" y1="120" x2="110" y2="118"/><line x1="70" y1="85" x2="68" y2="83"/><line x1="130" y1="75" x2="132" y2="73"/></g><circle cx="100" cy="70" r="5" fill="#F06292"/>`;
            }
            break;

        case 'rose':
            if (stage === 0) { 
                content = `<circle cx="100" cy="153" r="4" fill="#D84315"/><path d="M100,149 L100,147" stroke="#5D4037"/><path d="M90,155 L110,155" stroke="#795548"/>`;
            } else if (stage === 1) { 
                content = `<path d="M100,155 Q105,140 100,135" stroke="#8D6E63" stroke-width="2" fill="none"/><path d="M100,145 L105,142" stroke="#5D4037" stroke-width="1"/><path d="M100,135 Q90,130 92,125 Q95,130 100,135" fill="#4CAF50"/>`;
            } else if (stage === 2) { 
                content = `<path d="M100,155 L100,110" stroke="#3E2723" stroke-width="3"/><path d="M100,130 L80,115" stroke="#3E2723" stroke-width="2"/><path d="M100,120 L120,110" stroke="#3E2723" stroke-width="2"/><circle cx="100" cy="105" r="5" fill="#C2185B"/><path d="M80,115 Q70,110 75,105 Q85,110 80,115" fill="#388E3C"/><path d="M120,110 Q130,105 125,100 Q115,105 120,110" fill="#388E3C"/>`;
            } else { 
                content = `<path d="M100,155 L100,90" stroke="#33691E" stroke-width="3"/><path d="M100,120 L75,110" stroke="#33691E" stroke-width="2"/><path d="M100,140 L125,130" stroke="#33691E" stroke-width="2"/><path d="M75,110 Q65,105 70,100 Q80,105 75,110 Z" fill="#2E7D32"/><path d="M125,130 Q135,125 130,120 Q120,125 125,130 Z" fill="#2E7D32"/><g transform="translate(100,80)"><circle r="18" fill="#D81B60"/><path d="M0,-5 Q10,-15 15,0 Q5,10 0,5" fill="#F06292" opacity="0.8"/><path d="M0,-5 Q-10,-15 -15,0 Q-5,10 0,5" fill="#AD1457" opacity="0.8"/><path d="M0,0 Q5,-8 10,0 Q5,8 0,0" fill="#880E4F"/></g>`;
            }
            break;

        case 'fern':
            if (stage === 0) { 
                content = `<path d="M95,155 Q90,150 95,148 Q100,150 100,152 Q100,150 105,148 Q110,150 105,155 Z" fill="#66BB6A"/><path d="M90,155 L110,155" stroke="#795548"/>`;
            } else if (stage === 1) { 
                content = `<path d="M100,155 Q100,135 105,135 Q115,135 115,145 Q115,150 110,150 Q108,150 108,148" fill="none" stroke="#558B2F" stroke-width="4" stroke-linecap="round"/>`;
            } else if (stage === 2) { 
                content = `<path d="M100,155 Q90,120 70,110" stroke="#4CAF50" stroke-width="2" fill="none"/><path d="M100,155 Q110,130 120,125" stroke="#4CAF50" stroke-width="2" fill="none"/><circle cx="70" cy="110" r="3" fill="#66BB6A"/><circle cx="120" cy="125" r="3" fill="#66BB6A"/>`;
            } else { 
                content = `<g stroke="#2E7D32" stroke-width="1.5" fill="none"><path d="M100,155 Q80,100 50,90" /><path d="M100,155 Q120,100 150,90" /><path d="M100,155 Q95,90 95,60" /><path d="M100,155 Q105,90 105,60" /></g><path d="M75,120 Q65,115 75,110" fill="#4CAF50"/><path d="M125,120 Q135,115 125,110" fill="#4CAF50"/><path d="M95,100 Q85,95 95,90" fill="#4CAF50"/><path d="M105,100 Q115,95 105,90" fill="#4CAF50"/>`;
            }
            break;

        case 'tulip':
            if (stage === 0) { 
                content = `<path d="M92,155 Q88,140 100,135 Q112,140 108,155 Z" fill="#D7CCC8" stroke="#8D6E63"/><path d="M95,155 L95,160 M100,155 L100,162 M105,155 L105,160" stroke="#FFF8E1" stroke-width="1"/>`;
            } else if (stage === 1) { 
                content = `<path d="M100,155 L100,130" stroke="#81C784" stroke-width="8" stroke-linecap="round"/>`;
            } else if (stage === 2) { 
                content = `<path d="M100,155 Q85,130 80,110" fill="none" stroke="#66BB6A" stroke-width="6"/><path d="M100,155 Q115,130 120,110" fill="none" stroke="#66BB6A" stroke-width="6"/><path d="M100,155 L100,100" stroke="#81C784" stroke-width="4"/><ellipse cx="100" cy="100" rx="6" ry="10" fill="${plantC}" opacity="0.7"/>`;
            } else { 
                content = `<path d="M100,155 L100,90" stroke="#4CAF50" stroke-width="5"/><path d="M100,155 Q70,110 60,80" fill="none" stroke="#66BB6A" stroke-width="6"/><path d="M100,155 Q130,110 140,80" fill="none" stroke="#66BB6A" stroke-width="6"/><path d="M85,60 Q85,90 100,90 Q115,90 115,60 Q115,40 100,40 Q85,40 85,60" fill="${plantC}"/><path d="M90,60 Q100,45 110,60" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="2"/>`;
            }
            break;

        default: // Basic
            if (stage === 0) {
                content = `<circle cx="100" cy="155" r="4" fill="#5D4037" /><path d="M90,155 L110,155" stroke="#795548" stroke-width="2" />`;
            } else if (stage === 1) {
                content = `<path d="M100,155 Q100,140 100,135" stroke="#4CAF50" stroke-width="3" fill="none" /><ellipse cx="92" cy="135" rx="6" ry="3" fill="#81C784" transform="rotate(-15 92 135)"/><ellipse cx="108" cy="135" rx="6" ry="3" fill="#81C784" transform="rotate(15 108 135)"/>`;
            } else if (stage === 2) {
                content = `<path d="M100,155 Q100,120 100,110" stroke="#388E3C" stroke-width="4" fill="none" /><ellipse cx="85" cy="120" rx="10" ry="5" fill="#4CAF50" transform="rotate(-30 85 120)"/><ellipse cx="115" cy="110" rx="10" ry="5" fill="#4CAF50" transform="rotate(30 115 110)"/>`;
            } else {
                content = `<path d="M100,155 Q95,100 100,70" stroke="#2E7D32" stroke-width="5" fill="none"/><path d="M100,130 Q70,110 60,120 Z" fill="#388E3C" /><path d="M100,110 Q130,90 140,100 Z" fill="#388E3C" /><circle cx="100" cy="70" r="20" fill="${plantC}" stroke="#fff" stroke-width="1"/>`;
            }
            break;
    }

    return `<svg viewBox="0 0 200 220" class="interactive-plant-svg">${potShape}${content}</svg>`;
}

// --- OPEN HABIT DIALOG (Added back) ---
function openHabitDialog() {
    if(isDeleteMode) return;
    if(!isPremiumUser && gardenData.habits.length >= MAX_FREE_ITEMS) {
        return document.getElementById('premium-dialog').showModal();
    }
    document.getElementById('habit-form').reset();
    tempHabitState = { type: 'grape' };
    renderSelector('habit-type-selector', VINE_TYPES, 'type', tempHabitState.type);
    document.getElementById('habit-dialog').showModal();
}

// --- RENDER HABITS (Added back) ---
function renderHabits() {
    const c = document.getElementById('habits-container');
    const { days, monthName } = getMonthData(currentViewDate);
    document.getElementById('calendar-month-label').innerText = monthName;
    c.innerHTML = '';
    
    if(!gardenData.habits.length) { 
        c.innerHTML = `<div style="text-align:center; padding:40px; color:#aaa; background:rgba(0,0,0,0.2); border-radius:20px;">🍇<br>No habits yet.</div>`; 
        return; 
    }

    gardenData.habits.forEach(h => {
        const card = document.createElement('div');
        card.className = 'habit-calendar-card';
        if(isDeleteMode) { 
            card.style.borderColor = '#ff4444'; 
            card.onclick = () => { 
                if(confirm("Delete habit?")) { 
                    gardenData.habits = gardenData.habits.filter(x=>x.id!==h.id); 
                    saveData(); 
                    renderHabits(); 
                }
            }; 
        }
        
        let pathD = "", nodes = "";
        const cols = 7, rowH = 70, colW = 50;
        days.forEach((day, i) => {
            const row = Math.floor(i/cols), col = i%cols;
            const x = (row%2===0 ? col : (cols-1-col)) * colW + 30;
            const y = row * rowH + 30;
            
            if(i===0) pathD += `M ${x} ${y}`;
            else {
                const prevRow = Math.floor((i-1)/cols);
                const px = (prevRow%2===0 ? (i-1)%cols : (cols-1-((i-1)%cols))) * colW + 30;
                pathD += ` C ${px} ${(prevRow*rowH)+70}, ${x} ${y-40}, ${x} ${y}`;
            }
            
            const isDone = h.history[day];
            const visual = getHabitFruitSVG(h.type, isDone);
            const opacity = (new Date(day) > new Date()) ? 0.3 : 1;
            const click = (new Date(day) > new Date() || isDeleteMode) ? '' : `onclick="toggleHabit('${h.id}','${day}')"`;
            
            nodes += `<g transform="translate(${x},${y})" class="pod-group" ${click} style="opacity:${opacity}"><rect x="-25" y="-25" width="50" height="50" class="hit-box"/><g class="visual-content">${visual}</g><text y="28" class="calendar-day-label">${day.split('-')[2]}</text></g>`;
        });
        
        card.innerHTML = `<div class="habit-header"><h3>${h.title.replace(/</g, "&lt;")}</h3><span class="habit-streak-badge">🔥 ${Object.keys(h.history).length}</span></div><div class="calendar-grid-container"><svg class="vine-calendar-svg" viewBox="0 0 ${cols*colW+20} ${Math.ceil(days.length/cols)*rowH+20}"><path d="${pathD}" fill="none" stroke="#388E3C" stroke-width="3"/>${nodes}</svg></div>`;
        c.appendChild(card);
    });
}

// --- HABIT VISUALS (Missing function added back) ---
function getHabitFruitSVG(type, isDone) {
    if (!isDone) {
        return `<path d="M0,10 Q-6,0 0,-10 Q6,0 0,10 Z" fill="#2E7D32" stroke="#1B5E20"/>`; // Leaf bud
    }

    let fruitContent = "";
    switch(type) {
        case 'tomato':
            fruitContent = `<circle r="12" fill="#D50000"/><circle cx="4" cy="-4" r="3" fill="white" opacity="0.3"/><path d="M0,-10 L-4,-14 M0,-10 L4,-14 M0,-10 L0,-15" stroke="#2E7D32" stroke-width="2"/>`;
            break;
        case 'blueberry':
            fruitContent = `<circle r="10" fill="#3F51B5"/><circle cx="3" cy="-3" r="2.5" fill="white" opacity="0.3"/><path d="M-3,-6 L3,-6 M0,-9 L0,-3" stroke="#1A237E" stroke-width="1.5"/>`;
            break;
        case 'strawberry':
            fruitContent = `<path d="M0,14 Q-12,0 -9,-10 L9,-10 Q12,0 0,14" fill="#FF1744"/><circle cx="2" cy="0" r="1" fill="#FFEB3B" opacity="0.6"/><circle cx="-2" cy="5" r="1" fill="#FFEB3B" opacity="0.6"/><path d="M-9,-10 L0,-14 L9,-10" fill="#2E7D32"/>`;
            break;
        case 'grape': 
        default:
            fruitContent = `<circle cx="-5" cy="-8" r="5" fill="#9C27B0"/><circle cx="5" cy="-8" r="5" fill="#9C27B0"/><circle cx="0" cy="0" r="5" fill="#9C27B0"/><circle cx="-5" cy="8" r="5" fill="#9C27B0"/><circle cx="5" cy="8" r="5" fill="#9C27B0"/><circle cx="0" cy="15" r="4" fill="#9C27B0"/><circle cx="2" cy="2" r="2" fill="white" opacity="0.3"/>`;
            break;
    }
    
    return `<g class="bloom-group"><g class="particle-burst"><circle cx="0" cy="0" r="2" fill="white"/><circle cx="0" cy="0" r="2" fill="gold"/></g>${fruitContent}</g>`;
}

// --- TOGGLE HABIT (Missing function added back) ---
async function toggleHabit(id, date) {
    if(isDeleteMode) return;
    const h = gardenData.habits.find(x => x.id == id);
    if(h.history[date]) { 
        delete h.history[date]; 
        // No coin deduction on undo
    }
    else { 
        h.history[date] = true; 
        await claimReward('habit', 1); 
    }
    saveData(); 
    renderHabits();
}

function openShopDialog() { renderShopTab('plants'); document.getElementById('shop-dialog').showModal(); }
function renderShopTab(tab) {
    currentShopTab = tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.innerText.toLowerCase().includes(tab.slice(0,3))));
    const c = document.getElementById('shop-grid-container');
    c.innerHTML = '';
    const src = tab==='plants' ? PLANT_TYPES : (tab==='vines' ? VINE_TYPES : POT_STYLES);
    
    Object.entries(src).forEach(([key, item]) => {
        if(item.price === 0) return;
        const owned = gardenData.unlockedItems.includes(key);
        const div = document.createElement('div');
        div.className = `select-card ${owned?'selected':''}`;
        div.innerHTML = `${item.isPremium?'<span class="premium-crown">👑</span>':''}<div class="card-icon" style="color:${item.color}">${item.icon}</div><div class="card-name">${item.name}</div>${owned?'<span>Owned</span>':`<div class="shop-price-tag">${item.price} 🪙</div>`}`;
        
        div.onclick = () => {
            if(owned) return;
            if (item.isPremium && !isPremiumUser) {
                return document.getElementById('premium-dialog').showModal();
            }
            handleBuyItem(key, item);
        };
        c.appendChild(div);
    });
}

function renderSelector(id, data, key, cur) {
    const c = document.getElementById(id); c.innerHTML = '';
    Object.entries(data).forEach(([k, item]) => {
        const locked = !gardenData.unlockedItems.includes(k) && item.price > 0;
        const div = document.createElement('div');
        div.className = `select-card ${cur===k?'selected':''} ${locked?'locked':''}`;
        div.innerHTML = `${item.isPremium?'<span class="premium-crown">👑</span>':''}${locked?'<span class="lock-badge">🔒</span>':''}<div class="card-icon" style="color:${item.color}">${item.icon}</div><div class="card-name">${item.name}</div>`;
        div.onclick = () => {
            if(locked) return showNotification("Unlock in Shop!", "🔒");
            if(item.isPremium && !isPremiumUser) return document.getElementById('premium-dialog').showModal();
            if(id.includes('plant')) tempPlantState[key]=k; else tempHabitState[key]=k;
            renderSelector(id, data, key, k);
        };
        c.appendChild(div);
    });
}
function setTaskMode(m) {
    tempPlantState.mode = m;
    document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(m==='checklist'?'task-type-check':'task-type-count').classList.add('active');
    const c = document.getElementById('task-input-area');
    if(m==='checklist') {
        c.innerHTML = `<div class="checklist-add-row"><input type="text" id="new-task-input" placeholder="Step..."><button type="button" class="btn-small" onclick="addChecklistItem()">Add</button></div><div class="checklist-container" id="dialog-checklist"></div>`;
        renderChecklistUI();
    } else c.innerHTML = `<label>Goal</label><div class="counter-input-group"><input type="number" value="${tempPlantState.counterMax}" onchange="tempPlantState.counterMax=parseInt(this.value)"></div>`;
}
function addChecklistItem() { const v = document.getElementById('new-task-input').value; if(v) { tempPlantState.checklist.push({text:v, done:false}); renderChecklistUI(); document.getElementById('new-task-input').value=''; }}
function renderChecklistUI() {
    const c = document.getElementById('dialog-checklist'); c.innerHTML = '';
    tempPlantState.checklist.forEach((t, i) => {
        c.innerHTML += `<div class="checklist-item"><input type="checkbox" ${t.done?'checked':''} onchange="tempPlantState.checklist[${i}].done=!tempPlantState.checklist[${i}].done"><span>${t.text.replace(/</g,"&lt;")}</span><button style="color:red;background:none;border:none;" onclick="tempPlantState.checklist.splice(${i},1);renderChecklistUI()">✕</button></div>`;
    });
}
function getMonthData(d) {
    const m = d.getMonth(), y = d.getFullYear();
    const days = [];
    const dim = new Date(y, m+1, 0).getDate();
    for(let i=1; i<=dim; i++) days.push(new Date(y, m, i).toISOString().split('T')[0]);
    return { days, monthName: d.toLocaleDateString('default', {month:'long', year:'numeric'}) };
}
function changeMonth(d) { currentViewDate.setMonth(currentViewDate.getMonth()+d); renderHabits(); }
function closePlantDialog() { document.getElementById('plant-dialog').close(); }
function handlePremiumClick() { document.getElementById('premium-dialog').showModal(); }
function toggleDeleteMode() { 
    isDeleteMode = !isDeleteMode; 
    document.querySelectorAll('#delete-mode-btn, #delete-mode-btn-2').forEach(b => b.classList.toggle('delete-mode-active'));
    showNotification(isDeleteMode ? "Remove Mode ON" : "Remove Mode OFF", "🗑️");
    renderAll();
}
async function startCheckout() {
    if(!token) return showNotification("Please login first!", "🔒");
    showNotification("Redirecting to Stripe...", "⏳");
    try {
        const res = await fetch('/api/create-checkout-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-access-token': token }
        });
        const json = await res.json();
        if(json.url) {
            window.location.href = json.url;
        } else {
            showNotification("Checkout Error", "🚫");
        }
    } catch(e) {
        console.error(e);
        showNotification("Connection Failed", "🚫");
    }
}

async function checkPurchaseSuccess() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'true' && token) {
        showNotification("Verifying purchase...", "⏳");
        try {
            const res = await fetch('/api/verify-premium', { headers: { 'x-access-token': token } });
            const json = await res.json();
            if (json.isPremium) {
                isPremiumUser = true;
                updateAccountUI(true);
                showNotification("Premium Activated! Thank you! 👑", "🌟");
                renderAll();
            }
        } catch (e) { console.error(e); }
        window.history.replaceState({}, document.title, "/");
    }
    if (params.get('canceled') === 'true') {
        showNotification("Purchase canceled", "🚫");
        window.history.replaceState({}, document.title, "/");
    }
}

/* --- HOME PAGE CAROUSEL LOGIC --- */
let currentSlideIndex = 0;
let slideInterval;
const AUTO_SLIDE_DELAY = 5000;

function initCarousel() {
    const track = document.getElementById('carousel-track');
    if (!track) return;
    
    const slides = document.querySelectorAll('.carousel-slide');
    const dotsContainer = document.getElementById('carousel-dots');
    const prevBtn = document.getElementById('prev-slide');
    const nextBtn = document.getElementById('next-slide');

    slides.forEach((_, i) => {
        const dot = document.createElement('div');
        dot.className = `dot ${i === 0 ? 'active' : ''}`;
        dot.onclick = () => goToSlide(i);
        dotsContainer.appendChild(dot);
    });

    prevBtn.onclick = () => { prevSlide(); resetTimer(); };
    nextBtn.onclick = () => { nextSlide(); resetTimer(); };

    updateCarouselUI();
    startTimer();
}

function updateCarouselUI() {
    const track = document.getElementById('carousel-track');
    const slides = document.querySelectorAll('.carousel-slide');
    const dots = document.querySelectorAll('.dot');

    track.style.transform = `translateX(-${currentSlideIndex * 100}%)`;

    slides.forEach((s, i) => {
        if (i === currentSlideIndex) s.classList.add('active-slide');
        else s.classList.remove('active-slide');
    });

    dots.forEach((d, i) => {
        if (i === currentSlideIndex) d.classList.add('active');
        else d.classList.remove('active');
    });
}

function nextSlide() {
    const total = document.querySelectorAll('.carousel-slide').length;
    currentSlideIndex = (currentSlideIndex + 1) % total;
    updateCarouselUI();
}

function prevSlide() {
    const total = document.querySelectorAll('.carousel-slide').length;
    currentSlideIndex = (currentSlideIndex - 1 + total) % total;
    updateCarouselUI();
}

function goToSlide(index) {
    currentSlideIndex = index;
    updateCarouselUI();
    resetTimer();
}

function startTimer() {
    clearInterval(slideInterval);
    slideInterval = setInterval(nextSlide, AUTO_SLIDE_DELAY);
}

function resetTimer() {
    clearInterval(slideInterval);
    startTimer();
}