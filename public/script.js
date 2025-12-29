/* --- CONFIGURATION & DATA MODELS --- */
const CONFIG = {
    ADSENSE_CLIENT_ID: "ca-pub-3438241188942945"
};

const MAX_FREE_ITEMS = 3;
let token = localStorage.getItem('garden_token'); 
let gardenData = { 
    coins: 50, 
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


/* --- AUTHENTICATION & DATA LOADING --- */

async function initAuth() {
    // 1. Check if user is logged in (Token exists)
    if (token) {
        try {
            // Fetch data from server
            const res = await fetch('/api/load', { 
                headers: { 'x-access-token': token } 
            });
            
            if (res.ok) {
                const json = await res.json();
                gardenData = json.data;
                isPremiumUser = json.isPremium;
                updateAccountUI(true);
                renderAll();
                return; // Exit, we loaded server data
            } else {
                // Token invalid or expired
                console.log("Session expired, reverting to guest.");
                token = null;
                localStorage.removeItem('garden_token');
            }
        } catch (e) {
            console.error("Server offline, loading local cache if available.");
        }
    }

    // 2. Fallback: Guest Mode (LocalStorage)
    // Always default to Guest if no token found
    if (!localStorage.getItem('isGuest')) {
        localStorage.setItem('isGuest', 'true');
    }
    
    const local = localStorage.getItem('guestData');
    if (local) {
        gardenData = JSON.parse(local);
    }
    
    // 3. Safety Check: Ensure data integrity
    if(!gardenData.coins && gardenData.coins !== 0) gardenData.coins = 50;
    if(!gardenData.plants) gardenData.plants = [];
    if(!gardenData.habits) gardenData.habits = [];
    if(!gardenData.unlockedItems) gardenData.unlockedItems = ["basic", "terra", "grape"];

    updateAccountUI(false);
    renderAll();
}

// --- SAVE DATA SYSTEM ---
async function saveData() {
    updateCoinDisplay(); // Visual Update

    // 1. Always save to LocalStorage (Backup/Guest)
    localStorage.setItem('guestData', JSON.stringify(gardenData));

    // 2. If Logged In, Sync to Server
    if (token) {
        try {
            await fetch('/api/sync', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-access-token': token 
                },
                body: JSON.stringify(gardenData)
            });
        } catch (e) {
            console.warn("Sync failed - saved locally.");
        }
    }
}


/* --- UI & NOTIFICATIONS --- */

function showNotification(message, icon = "✨") {
    const container = document.getElementById('notification-container');
    const toast = document.createElement('div');
    toast.className = 'garden-toast';
    toast.innerHTML = `<span style="font-size:1.2rem">${icon}</span> <span>${message}</span>`;

    // Add Particles
    for(let i=0; i<8; i++) {
        const p = document.createElement('div');
        p.className = 'toast-particle';
        const angle = Math.random() * Math.PI * 2;
        const dist = 30 + Math.random() * 20;
        p.style.setProperty('--tx', `${Math.cos(angle) * dist}px`);
        p.style.setProperty('--ty', `${Math.sin(angle) * dist}px`);
        p.style.left = '50%';
        p.style.top = '50%';
        p.style.background = Math.random() > 0.5 ? '#AEEA00' : '#FFD700'; 
        toast.appendChild(p);
    }

    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
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
        // GUEST MODE UI
        accBtn.innerText = "👤 Guest (Login)";
        accBtn.classList.remove('logged-in');
        if(premiumBtn) premiumBtn.style.display = 'block';
    }
    updateCoinDisplay();
}

/* --- NAVIGATION & DIALOGS --- */
function showPage(id) { 
    document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active')); 
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active')); 
    document.getElementById(id).classList.add('active'); 
}

function safeNavigate(pageId) { showPage(pageId); }
function safeAction(fn) { fn(); }

function handleAccountClick() {
    // FIX: Only show logout if actually logged in (has token)
    if (token) {
        if(confirm("Log out? Local data is saved, but you will need to log back in to sync.")) {
            token = null;
            localStorage.removeItem('garden_token');
            location.reload();
        }
    } else {
        // If Guest, open Login
        document.getElementById('auth-dialog').showModal();
    }
}

function toggleAuthMode() { 
    // In a real app, this toggles between Login/Register forms
    alert("Use the Login button to sign in, or Register via the API endpoint."); 
}

function continueAsGuest() {
    document.getElementById('auth-dialog').close();
    showNotification("Continued as Guest", "👤");
}

/* --- AUTH ACTIONS --- */
async function performLogin() {
    const email = document.getElementById('auth-email').value;
    const pass = document.getElementById('auth-pass').value;
    
    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({email, password: pass})
        });
        const json = await res.json();
        
        if(json.auth) {
            token = json.token;
            localStorage.setItem('garden_token', token);
            // Overwrite local gardenData with Server Data upon login
            gardenData = json.data;
            isPremiumUser = json.isPremium;
            
            document.getElementById('auth-dialog').close();
            updateAccountUI(true);
            renderAll();
            showNotification("Welcome back!", "👋");
        } else {
            showNotification(json.error || "Login Failed", "⚠️");
        }
    } catch(e) { showNotification("Server Error", "🚫"); }
}

async function performRegister() {
    const email = document.getElementById('auth-email').value;
    const pass = document.getElementById('auth-pass').value;
    
    try {
        const res = await fetch('/api/register', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({email, password: pass})
        });
        if(res.ok) {
            showNotification("Account created! Please Log In.", "✅");
        } else {
            const json = await res.json();
            showNotification(json.error || "Failed", "⚠️");
        }
    } catch(e) { showNotification("Server Error", "🚫"); }
}


/* --- RENDERERS --- */
function renderAll() {
    renderPlants();
    renderHabits();
}

// --- PLANT LOGIC --- //
function openPlantDialog(id=null) {
    if(isDeleteMode) return;
    
    if(!isPremiumUser && !id && gardenData.plants.length >= MAX_FREE_ITEMS) {
        document.getElementById('premium-dialog').showModal();
        return;
    }

    editingPlantId = id;
    if(id) {
        const p = gardenData.plants.find(x => x.id === id);
        document.getElementById('plant-title').value = p.title;
        tempPlantState = { 
            type: p.type, 
            pot: p.pot || 'terra', 
            mode: p.taskMode || 'checklist', 
            checklist: JSON.parse(JSON.stringify(p.checklist || [])), 
            counterMax: p.counterMax || 10, 
            counterVal: p.counterVal || 0 
        };
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
        // Calculate Progress
        let progress = 0;
        let progressText = "";
        if(plant.taskMode === 'counter') {
            progress = (plant.counterVal / plant.counterMax) * 100;
            progressText = `${plant.counterVal} / ${plant.counterMax}`;
        } else {
            const total = plant.checklist.length;
            const done = plant.checklist.filter(t=>t.done).length;
            progress = total === 0 ? 0 : (done/total)*100;
            progressText = `${done} / ${total}`;
        }
        
        // Update Growth Stage
        if(progress >= 100) plant.growth = 2; else if(progress > 0) plant.growth = 1; else plant.growth = 0;

        const card = document.createElement('div');
        card.className = 'potted-plant-card';
        
        // --- MOBILE FIX: SEPARATE CLICK AREAS ---
        
        // 1. Edit/View Area (Top part of card)
        const clickArea = document.createElement('div');
        clickArea.className = 'plant-click-area';
        clickArea.onclick = () => { 
            if(isDeleteMode) {
                if(confirm("Delete Project?")) { 
                    gardenData.plants = gardenData.plants.filter(p=>p.id!==plant.id); 
                    saveData(); 
                    renderPlants(); 
                }
            } else {
                openPlantDialog(plant.id);
            }
        };

        clickArea.innerHTML = `
            <div class="plant-visual-container">${getPlantSVG(plant.growth, plant.type, plant.pot)}</div>
            <div class="plant-info" style="pointer-events:none;"> 
                <h3>${plant.title}</h3>
                <div class="progress-bar-container"><div class="progress-bar-fill" style="width:${Math.min(progress,100)}%"></div></div>
                <div style="font-size:0.7rem; color:#aaa; margin-top:4px;">${progressText}</div>
            </div>
        `;
        
        // 2. Action Button (Bottom part of card)
        let actionBtnHTML = "";
        if(plant.taskMode === 'counter' && !isDeleteMode) {
            const btn = document.createElement('button');
            btn.className = 'plant-action-btn';
            btn.innerHTML = `<span>💧</span> Grow (+1)`;
            btn.onclick = (e) => {
                e.stopPropagation(); // Stop dialog from opening
                plant.counterVal++;
                gardenData.coins++;
                showNotification("+1 Coin!", "🪙");
                
                // Shake Animation
                const svg = card.querySelector('.interactive-plant-svg');
                if(svg) { svg.style.animation = 'plantShake 0.5s ease'; setTimeout(()=> svg.style.animation = '', 500); }
                
                saveData();
                renderPlants();
            };
            actionBtnHTML = btn;
        } else if (plant.taskMode === 'checklist' && !isDeleteMode) {
            const btn = document.createElement('button');
            btn.className = 'plant-action-btn';
            btn.innerHTML = `<span>📝</span> View List`;
            btn.onclick = (e) => { e.stopPropagation(); openPlantDialog(plant.id); };
            actionBtnHTML = btn;
        }

        card.appendChild(clickArea);
        if(actionBtnHTML) card.appendChild(actionBtnHTML);
        container.appendChild(card);
    });
}

// --- PLANT SVG GENERATOR ---
function getPlantSVG(growth, type, potStyle) {
    const potConfig = POT_STYLES[potStyle] || POT_STYLES['terra'];
    const plantConfig = PLANT_TYPES[type] || PLANT_TYPES['basic'];
    
    const potSVG = `<path d="M20,0 L80,0 L70,50 C70,60 30,60 30,50 Z" fill="${potConfig.color}" transform="translate(50,150)"/>`;
    
    let plantSVG = "";
    if(growth === 0) {
        plantSVG = `<circle cx="100" cy="150" r="5" fill="#8D6E63"/>`; // Seed
    } else if (growth === 1) {
        plantSVG = `<path d="M100,150 Q100,120 90,110" stroke="#4CAF50" stroke-width="3" fill="none"/><circle cx="90" cy="110" r="8" fill="#81C784"/>`; // Sprout
    } else {
        const stem = `<path d="M100,150 Q100,100 100,70" stroke="#2E7D32" stroke-width="4" fill="none"/>`;
        let flower = `<circle cx="100" cy="70" r="15" fill="${plantConfig.color}"/>`; 
        
        if(type === 'sun') flower = `<circle cx="100" cy="70" r="20" fill="#FFD700"/><circle cx="100" cy="70" r="8" fill="#5D4037"/>`;
        if(type === 'rose') flower = `<circle cx="100" cy="70" r="15" fill="#E91E63"/><path d="M95,70 Q100,60 105,70" stroke="#fff" fill="none" opacity="0.5"/>`;
        if(type === 'cactus') flower = `<rect x="85" y="80" width="30" height="70" rx="15" fill="#004D40"/><line x1="85" y1="100" x2="80" y2="95" stroke="#fff"/>`;
        if(type === 'fern') flower = `<path d="M100,150 Q70,100 60,120 M100,150 Q130,100 140,120 M100,150 Q100,80 100,60" stroke="#2E7D32" stroke-width="4" fill="none"/>`;
        
        plantSVG = stem + flower;
    }
    return `<svg viewBox="0 0 200 220" class="interactive-plant-svg">${potSVG}${plantSVG}</svg>`;
}
// --- MISSING PLANT SAVE LOGIC ---
document.getElementById('plant-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const title = document.getElementById('plant-title').value;
    
    // Calculate Growth Stage based on inputs
    let growth = 0;
    if(tempPlantState.mode === 'checklist') {
        const total = tempPlantState.checklist.length;
        const done = tempPlantState.checklist.filter(t => t.done).length;
        if(total > 0 && done === total) growth = 2; 
        else if (done > 0) growth = 1;
    } else {
        const pct = tempPlantState.counterVal / tempPlantState.counterMax;
        if(pct >= 1) growth = 2;
        else if (pct > 0) growth = 1;
    }

    const newPlant = {
        id: editingPlantId || Date.now(),
        title: title,
        type: tempPlantState.type,
        pot: tempPlantState.pot,
        taskMode: tempPlantState.mode,
        checklist: tempPlantState.checklist,
        counterMax: tempPlantState.counterMax,
        counterVal: tempPlantState.counterVal,
        growth: growth
    };

    if(editingPlantId) {
        const idx = gardenData.plants.findIndex(p => p.id === editingPlantId);
        gardenData.plants[idx] = newPlant;
    } else {
        gardenData.plants.push(newPlant);
    }
    
    saveData();
    renderPlants();
    document.getElementById('plant-dialog').close();
});
// --- HABIT LOGIC --- //
function openHabitDialog() {
    if(isDeleteMode) return;
    if(!isPremiumUser && (!gardenData.habits || gardenData.habits.length >= MAX_FREE_ITEMS)) {
        document.getElementById('premium-dialog').showModal();
        return;
    }
    document.getElementById('habit-form').reset();
    tempHabitState = { type: 'grape' };
    renderSelector('habit-type-selector', VINE_TYPES, 'type', 'grape');
    document.getElementById('habit-dialog').showModal();
}

document.getElementById('habit-form').addEventListener('submit', (e) => {
    e.preventDefault();
    if(!gardenData.habits) gardenData.habits = [];
    gardenData.habits.push({
        id: Date.now(),
        title: document.getElementById('habit-title').value,
        type: tempHabitState.type,
        history: {}
    });
    saveData();
    renderHabits();
    document.getElementById('habit-dialog').close();
});

function renderHabits() {
    const container = document.getElementById('habits-container');
    const { days, monthName } = getMonthData(currentViewDate);
    document.getElementById('calendar-month-label').innerText = monthName;
    container.innerHTML = '';

    if (!gardenData.habits || gardenData.habits.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:40px; color:#aaa; background:rgba(0,0,0,0.2); border-radius:20px;">🍇<br>No habits yet.</div>`;
        return;
    }

    gardenData.habits.forEach(habit => {
        const streak = Object.keys(habit.history).length;
        const card = document.createElement('div');
        card.className = 'habit-calendar-card';
        if(isDeleteMode) { card.style.borderColor = '#ff4444'; card.onclick = () => { if(confirm("Delete?")) { gardenData.habits=gardenData.habits.filter(h=>h.id!==habit.id); saveData(); renderHabits(); }}; }

        const header = `<div class="habit-header"><h3>${habit.title}</h3><span class="habit-streak-badge">🔥 ${streak} Days</span></div>`;

        // SVG Gen
        const cols = 7; const rowHeight = 70; const colWidth = 50;
        const svgHeight = Math.ceil(days.length / cols) * rowHeight + 20;
        let pathD = ""; let nodesHTML = "";
        
        days.forEach((day, i) => {
            const row = Math.floor(i / cols); const col = i % cols;
            const isEvenRow = row % 2 === 0;
            const x = isEvenRow ? (col * colWidth) + 30 : ((cols - 1 - col) * colWidth) + 30;
            const y = (row * rowHeight) + 30;
            
            if (i === 0) pathD += `M ${x} ${y}`;
            else {
                const prevRow = Math.floor((i-1)/cols); const prevCol = (i-1)%cols;
                const px = (prevRow%2===0) ? (prevCol*colWidth)+30 : ((cols-1-prevCol)*colWidth)+30;
                pathD += ` C ${px} ${(prevRow*rowHeight)+70}, ${x} ${y-40}, ${x} ${y}`;
            }

            const isDone = habit.history[day];
            const isFuture = new Date(day) > new Date();
            const color = VINE_TYPES[habit.type]?.color || '#9C27B0';
            
            let visual = isDone 
                ? `<g class="bloom-group"><g class="particle-burst"><circle cx="0" cy="0" r="2" fill="${color}"/><circle cx="0" cy="0" r="2" fill="gold"/></g><circle r="12" fill="${color}" stroke="white" stroke-width="1"/></g>`
                : `<path d="M0,10 Q-6,0 0,-10 Q6,0 0,10 Z" fill="#2E7D32" stroke="#1B5E20" stroke-width="1" />`;

            const clickAction = (isFuture || isDeleteMode) ? '' : `onclick="toggleHabit('${habit.id}', '${day}')"`;
            
            nodesHTML += `
                <g transform="translate(${x},${y})" class="pod-group" ${clickAction} style="opacity:${isFuture?0.3:1}">
                    <rect x="-25" y="-25" width="50" height="50" class="hit-box" />
                    <g class="visual-content">${visual}</g>
                    <text y="28" class="calendar-day-label">${day.split('-')[2]}</text>
                </g>`;
        });

        card.innerHTML = header + `<div class="calendar-grid-container"><svg class="vine-calendar-svg" viewBox="0 0 ${cols*colWidth+20} ${svgHeight}"><path d="${pathD}" fill="none" stroke="#388E3C" stroke-width="3" stroke-linecap="round"/>${nodesHTML}</svg></div>`;
        container.appendChild(card);
    });
}

function toggleHabit(id, date) {
    if(isDeleteMode) return;
    const habit = gardenData.habits.find(h => h.id == id);
    if (habit.history[date]) {
        delete habit.history[date];
        if(gardenData.coins > 0) gardenData.coins--;
    } else {
        habit.history[date] = true;
        gardenData.coins++;
        showNotification("Habit Complete!", "🔥");
    }
    saveData();
    renderHabits();
}
function changeMonth(offset) { currentViewDate.setMonth(currentViewDate.getMonth() + offset); renderHabits(); }

// --- UNIFIED SHOP LOGIC --- //
function openShopDialog() {
    renderShopTab('plants'); 
    document.getElementById('shop-dialog').showModal();
}

function renderShopTab(tab) {
    currentShopTab = tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => { if(b.innerText.toLowerCase().includes(tab.slice(0,3))) b.classList.add('active'); });

    const container = document.getElementById('shop-grid-container');
    container.innerHTML = '';
    container.className = 'selection-grid'; 

    let dataSource = {};
    if(tab === 'plants') dataSource = PLANT_TYPES;
    if(tab === 'vines')  dataSource = VINE_TYPES;
    if(tab === 'pots')   dataSource = POT_STYLES;

    for(const [key, item] of Object.entries(dataSource)) {
        if(item.price === 0) continue;
        const isOwned = gardenData.unlockedItems.includes(key);
        const card = document.createElement('div');
        card.className = isOwned ? 'select-card selected' : 'select-card';
        let badges = item.isPremium ? `<span class="premium-crown">👑</span>` : '';

        card.innerHTML = `
            ${badges}
            <div class="card-icon" style="color:${item.color}">${item.icon}</div>
            <div class="card-name">${item.name}</div>
            ${isOwned ? '<span style="font-size:0.7rem;">Owned</span>' : `<div class="shop-price-tag">${item.price} 🪙</div>`}
        `;

        if(!isOwned) card.onclick = () => buyItem(key, item.price);
        container.appendChild(card);
    }
}

function buyItem(key, price) {
    if(gardenData.coins >= price) {
        gardenData.coins -= price;
        gardenData.unlockedItems.push(key);
        saveData();
        renderShopTab(currentShopTab); 
        showNotification(`Purchased ${key}!`, "🛍️");
    } else {
        showNotification("Not enough coins!", "🚫");
    }
}

// --- UTILS & FORM HANDLERS ---
function renderSelector(containerId, sourceData, stateKey, currentVal) {
    const c = document.getElementById(containerId);
    c.innerHTML = '';
    for(const [key, item] of Object.entries(sourceData)) {
        const isUnlocked = gardenData.unlockedItems.includes(key) || item.price === 0;
        const isLockedPremium = item.isPremium && !isPremiumUser;
        const card = document.createElement('div');
        card.className = `select-card ${currentVal === key ? 'selected' : ''} ${!isUnlocked ? 'locked' : ''}`;
        
        let badges = '';
        if(item.isPremium) badges += `<span class="premium-crown">👑</span>`;
        if(!isUnlocked) badges += `<span class="lock-badge">🔒</span>`;

        card.innerHTML = `${badges}<div class="card-icon" style="color:${item.color}">${item.icon}</div><div class="card-name">${item.name}</div>`;

        card.onclick = () => {
            if(!isUnlocked) { showNotification("Unlock in Shop!", "🔒"); return; }
            if(isLockedPremium) { document.getElementById('premium-dialog').showModal(); return; }
            if(containerId.includes('plant')) tempPlantState[stateKey] = key;
            else tempHabitState[stateKey] = key;
            renderSelector(containerId, sourceData, stateKey, key);
        };
        c.appendChild(card);
    }
}

function setTaskMode(mode) {
    tempPlantState.mode = mode;
    document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(mode === 'checklist' ? 'task-type-check' : 'task-type-count').classList.add('active');
    const container = document.getElementById('task-input-area');
    container.innerHTML = '';

    if(mode === 'checklist') {
        container.innerHTML = `<div class="checklist-add-row"><input type="text" id="new-task-input" placeholder="Add step..."><button type="button" class="btn-small" onclick="addChecklistItem()">Add</button></div><div class="checklist-container" id="dialog-checklist"></div>`;
        renderChecklistUI();
    } else {
        container.innerHTML = `<label>Target Count</label><div class="counter-input-group"><input type="number" id="counter-max-input" value="${tempPlantState.counterMax}" onchange="tempPlantState.counterMax=parseInt(this.value)"></div>`;
    }
}

function addChecklistItem() {
    const val = document.getElementById('new-task-input').value;
    if(val) { tempPlantState.checklist.push({text: val, done: false}); renderChecklistUI(); document.getElementById('new-task-input').value = ''; }
}
function renderChecklistUI() {
    const c = document.getElementById('dialog-checklist');
    c.innerHTML = '';
    tempPlantState.checklist.forEach((t, i) => {
        c.innerHTML += `<div class="checklist-item"><input type="checkbox" ${t.done?'checked':''} onchange="tempPlantState.checklist[${i}].done=!tempPlantState.checklist[${i}].done"><span>${t.text}</span><button type="button" style="color:red;background:none;border:none;" onclick="tempPlantState.checklist.splice(${i},1);renderChecklistUI()">✕</button></div>`;
    });
}
function closePlantDialog() { document.getElementById('plant-dialog').close(); }
function handlePremiumClick() { document.getElementById('premium-dialog').showModal(); }
async function startCheckout() { alert("Redirecting to Stripe (Config Required in server.js)"); }

// Load it up!
document.addEventListener('DOMContentLoaded', initAuth);