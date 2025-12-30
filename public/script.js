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

// --- VISUAL ASSETS ---
const PLANT_TYPES = {
    "basic": { name: "Basic Leaf", price: 0, isPremium: false, icon: "🌱", color: "#4CAF50" },
    "sun":   { name: "Sunflower", price: 20, isPremium: false, icon: "🌻", color: "#FFD700" },
    "rose":  { name: "Wild Rose", price: 40, isPremium: true,  icon: "🌹", color: "#E91E63" },
    "cactus":{ name: "Cactus",    price: 30, isPremium: false, icon: "🌵", color: "#004D40" },
    "fern":  { name: "Fern",      price: 50, isPremium: true,  icon: "🌿", color: "#2E7D32" },
    "tulip": { name: "Tulip",     price: 35, isPremium: false, icon: "🌷", color: "#FF69B4" }
};
const VINE_TYPES = {
    "grape":     { name: "Grapes",     price: 0,  isPremium: false, icon: "🍇", color: "#9C27B0" },
    "tomato":    { name: "Tomatoes",   price: 25, isPremium: false, icon: "🍅", color: "#D50000" },
    "blueberry": { name: "Blueberry",  price: 40, isPremium: true,  icon: "🫐", color: "#3F51B5" },
    "strawberry":{ name: "Strawberry", price: 30, isPremium: false, icon: "🍓", color: "#FF1744" }
};
const POT_STYLES = {
    "terra":   { name: "Terra Cotta", price: 0,  isPremium: false, icon: "🏺", color: "#E65100" },
    "classic": { name: "Classic Blue",price: 15, isPremium: false, icon: "🔵", color: "#1E88E5" },
    "modern":  { name: "Modern Wht",  price: 25, isPremium: true,  icon: "⚪", color: "#F5F5F5" },
    "gold":    { name: "Gold Pot",    price: 100,isPremium: true,  icon: "👑", color: "#FFD700" }
};

let tempPlantState = { type: 'basic', pot: 'terra', mode: 'checklist', checklist: [], counterMax: 10, counterVal: 0 };
let tempHabitState = { type: 'grape' };


/* --- INITIALIZATION & EVENTS --- */
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    initAuth();
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
            await fetch('/api/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-access-token': token },
                body: JSON.stringify(gardenData)
            });
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
    document.getElementById(id).classList.add('active'); 
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
    // Reward scales with steps, maxing at 50
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
                gardenData.coins += rewardAmount;
                showNotification(`Complete! +${rewardAmount} Coins`, "🌟");
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

function getPlantSVG(stage, type, potStyle) {
    const potC = POT_STYLES[potStyle]?.color || POT_STYLES['terra'].color;
    const plantC = PLANT_TYPES[type]?.color || PLANT_TYPES['basic'].color;
    
    const pot = `<path d="M20,0 L80,0 L70,50 C70,60 30,60 30,50 Z" fill="${potC}" transform="translate(50,150)"/>`;
    let content = "";

    if (stage === 0) { // Seed
        content = `
            <circle cx="100" cy="155" r="4" fill="#5D4037" />
            <path d="M90,155 L110,155" stroke="#795548" stroke-width="2" />
        `;
    } 
    else if (stage === 1) { // Sprout
        content = `
            <path d="M100,155 Q100,140 100,135" stroke="#4CAF50" stroke-width="3" fill="none" />
            <path d="M100,135 Q90,125 85,130 M100,135 Q110,125 115,130" stroke="#4CAF50" stroke-width="2" fill="none" />
            <circle cx="85" cy="130" r="3" fill="#81C784" />
            <circle cx="115" cy="130" r="3" fill="#81C784" />
        `;
    } 
    else if (stage === 2) { // Seedling
        content = `
            <path d="M100,155 Q100,120 100,100" stroke="#388E3C" stroke-width="4" fill="none" />
            <path d="M100,120 Q80,100 70,110 Z" fill="#4CAF50" />
            <path d="M100,110 Q120,90 130,100 Z" fill="#4CAF50" />
            <path d="M100,140 Q115,130 120,135 Z" fill="#4CAF50" />
        `;
    } 
    else { // Mature
        content = `<path d="M100,155 Q95,100 100,70" stroke="#2E7D32" stroke-width="5" fill="none"/>`;
        if(type !== 'cactus') {
            content += `<path d="M100,130 Q70,110 60,120 Z" fill="#388E3C" /><path d="M100,110 Q130,90 140,100 Z" fill="#388E3C" />`;
        }
        switch(type) {
            case 'sun': 
                content += `<circle cx="100" cy="70" r="25" fill="#FFD700" stroke="#FFA000" stroke-width="2"/><circle cx="100" cy="70" r="10" fill="#3E2723" />`;
                break;
            case 'rose': 
                content += `<circle cx="100" cy="70" r="18" fill="#D81B60" /><path d="M90,70 Q100,60 110,70 Q100,80 90,70" fill="#F06292" opacity="0.7"/>`;
                break;
            case 'tulip': 
                content += `<path d="M85,55 Q100,90 115,55 Q100,100 85,55" fill="${plantC}" />`;
                break;
            case 'cactus': 
                content = `<rect x="80" y="80" width="40" height="75" rx="20" fill="#004D40" />`;
                content += `<line x1="85" y1="100" x2="80" y2="95" stroke="#fff" stroke-width="2"/><line x1="115" y1="120" x2="120" y2="115" stroke="#fff" stroke-width="2"/><line x1="90" y1="140" x2="85" y2="135" stroke="#fff" stroke-width="2"/>`;
                content += `<circle cx="100" cy="80" r="6" fill="#F06292"/>`;
                break;
            case 'fern': 
                content = `<path d="M100,155 Q80,100 60,80" stroke="#388E3C" stroke-width="3" fill="none"/><path d="M100,155 Q120,100 140,80" stroke="#388E3C" stroke-width="3" fill="none"/><path d="M100,155 Q100,100 100,60" stroke="#388E3C" stroke-width="3" fill="none"/>`;
                break;
            default: 
                content += `<circle cx="100" cy="70" r="20" fill="${plantC}"/>`;
                break;
        }
    }
    return `<svg viewBox="0 0 200 220" class="interactive-plant-svg">${pot}${content}</svg>`;
}

// --- ADDED FUNCTION: OPEN HABIT DIALOG ---
function openHabitDialog() {
    if(isDeleteMode) return;
    // Check limit for non-premium users
    if(!isPremiumUser && gardenData.habits.length >= MAX_FREE_ITEMS) {
        return document.getElementById('premium-dialog').showModal();
    }
    
    document.getElementById('habit-form').reset();
    tempHabitState = { type: 'grape' }; // Reset to default
    renderSelector('habit-type-selector', VINE_TYPES, 'type', tempHabitState.type);
    document.getElementById('habit-dialog').showModal();
}

/* --- HABITS WITH FRUIT VISUALS --- */
function renderHabits() {
    const c = document.getElementById('habits-container');
    const { days, monthName } = getMonthData(currentViewDate);
    document.getElementById('calendar-month-label').innerText = monthName;
    c.innerHTML = '';
    
    if(!gardenData.habits.length) { c.innerHTML = `<div style="text-align:center; padding:40px; color:#aaa; background:rgba(0,0,0,0.2); border-radius:20px;">🍇<br>No habits yet.</div>`; return; }

    gardenData.habits.forEach(h => {
        const card = document.createElement('div');
        card.className = 'habit-calendar-card';
        if(isDeleteMode) { card.style.borderColor = '#ff4444'; card.onclick = () => { if(confirm("Delete habit?")) { gardenData.habits = gardenData.habits.filter(x=>x.id!==h.id); saveData(); renderHabits(); }}; }
        
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

function getHabitFruitSVG(type, isDone) {
    if (!isDone) {
        return `<path d="M0,10 Q-6,0 0,-10 Q6,0 0,10 Z" fill="#2E7D32" stroke="#1B5E20"/>`; // Leaf bud
    }

    let fruitContent = "";
    switch(type) {
        case 'tomato':
            fruitContent = `<circle r="12" fill="#D50000"/><path d="M0,-10 L-4,-14 M0,-10 L4,-14 M0,-10 L0,-15" stroke="#2E7D32" stroke-width="2"/>`;
            break;
        case 'blueberry':
            fruitContent = `<circle r="10" fill="#3F51B5"/><path d="M-3,-6 L3,-6 M0,-9 L0,-3" stroke="#1A237E" stroke-width="1.5"/>`;
            break;
        case 'strawberry':
            fruitContent = `<path d="M0,14 Q-12,0 -9,-10 L9,-10 Q12,0 0,14" fill="#FF1744"/><path d="M-9,-10 L0,-14 L9,-10" fill="#2E7D32"/>`;
            break;
        case 'grape': // Grape cluster
        default:
            fruitContent = `<circle cx="-5" cy="-8" r="5" fill="#9C27B0"/><circle cx="5" cy="-8" r="5" fill="#9C27B0"/><circle cx="0" cy="0" r="5" fill="#9C27B0"/><circle cx="-5" cy="8" r="5" fill="#9C27B0"/><circle cx="5" cy="8" r="5" fill="#9C27B0"/><circle cx="0" cy="15" r="4" fill="#9C27B0"/>`;
            break;
    }
    
    return `<g class="bloom-group"><g class="particle-burst"><circle cx="0" cy="0" r="2" fill="white"/><circle cx="0" cy="0" r="2" fill="gold"/></g>${fruitContent}</g>`;
}

function toggleHabit(id, date) {
    if(isDeleteMode) return;
    const h = gardenData.habits.find(x=>x.id==id);
    if(h.history[date]) { 
        delete h.history[date]; 
        if(gardenData.coins > 0) gardenData.coins--; 
    }
    else { 
        h.history[date] = true; 
        gardenData.coins++; 
        showNotification("Habit Done! +1 Coin", "🔥"); 
    }
    saveData(); renderHabits();
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
            // STRICT PREMIUM CHECK: Cannot even buy/select if premium items are clicked
            if (item.isPremium && !isPremiumUser) {
                return document.getElementById('premium-dialog').showModal();
            }

            if(gardenData.coins >= item.price) {
                gardenData.coins -= item.price; gardenData.unlockedItems.push(key); saveData(); renderShopTab(tab); showNotification(`Bought ${item.name}!`, "🛍️");
            } else showNotification("Not enough coins", "🚫");
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
async function startCheckout() { alert("Redirecting to Stripe..."); }