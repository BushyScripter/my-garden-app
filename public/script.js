/* --- CONFIGURATION & DATA MODELS --- */
const CONFIG = {
    ADSENSE_CLIENT_ID: "ca-pub-3438241188942945"
};

const MAX_FREE_ITEMS = 3;
let token = null; 
let gardenData = { 
    coins: 50, // Start with some coins for testing
    unlockedItems: ["basic", "terra", "grape"], // Unified unlock list
    plants: [], 
    habits: [] 
};
let isPremiumUser = false;
let isDeleteMode = false;
let editingPlantId = null;
let currentViewDate = new Date(); // Calendar State
let currentShopTab = 'plants';

// --- VISUAL ASSETS (EASY TO ADD MORE) ---
// To add more: Copy a block, give it a unique ID, set price/premium, and define color/icon.

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

// Temp state for Plant Dialog
let tempPlantState = { type: 'basic', pot: 'terra', mode: 'checklist', checklist: [], counterMax: 10, counterVal: 0 };
let tempHabitState = { type: 'grape' };


/* --- AUTHENTICATION --- */
/* --- AUTHENTICATION & SAVING FIXES --- */

function initAuth() {
    const storedToken = localStorage.getItem('garden_token');
    // FIX: If no token is found, FORCE guest mode so saving works immediately
    if (!storedToken && localStorage.getItem('isGuest') !== 'true') {
        localStorage.setItem('isGuest', 'true');
    }

    const isGuest = localStorage.getItem('isGuest') === 'true';

    if (storedToken) {
        token = storedToken;
        loadData(); 
    } else if (isGuest) {
        loadData();
    }
    updateAccountUI();
}


// Helper to refresh coin UI
function updateCoinDisplay() {
    const el = document.getElementById('coin-count');
    if(el) {
        el.innerText = gardenData.coins;
        // Trigger little animation
        el.parentElement.classList.remove('coin-anim');
        void el.parentElement.offsetWidth; // trigger reflow
        el.parentElement.classList.add('coin-anim');
    }
}

function checkAuth() {
    if (token || localStorage.getItem('isGuest') === 'true') return true;
    document.getElementById('auth-dialog').showModal();
    return false;
}

function toggleAuthMode() { 
    // Simplified for brevity, same logic as before
    document.getElementById('auth-dialog').close();
    // In real app, toggle form visibility
    document.getElementById('auth-dialog').showModal();
}

/* --- DATA MANAGEMENT --- */
async function loadData() {
    if (localStorage.getItem('isGuest') === 'true') {
        const local = localStorage.getItem('guestData');
        if (local) gardenData = JSON.parse(local);
    } else {
        // Here you would fetch from server
        // For now, using default gardenData object
    }
    // Safety check for new fields
    if(!gardenData.unlockedItems) gardenData.unlockedItems = ["basic", "terra", "grape"];
    
    renderAll();
    updateAccountUI();
}

async function saveData() {
    // FIX: Ensure we have a valid object before saving
    if (!gardenData) return; 

    // Visual Update
    updateCoinDisplay();

    // Guest Save Logic
    if (localStorage.getItem('isGuest') === 'true') {
        localStorage.setItem('guestData', JSON.stringify(gardenData));
        console.log("Saved to LocalStorage:", gardenData); // Debug log
    } else if (token) {
        // Server Save Logic (Placeholder)
        // await fetch('/api/sync', { ... })
    }
}


/* --- UI & NAVIGATION --- */
function showPage(id) { 
    document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active')); 
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active')); 
    document.getElementById(id).classList.add('active'); 
}

function updateAccountUI() {
    const isGuest = localStorage.getItem('isGuest') === 'true';
    const accBtn = document.getElementById('account-btn');
    const premiumBtn = document.getElementById('premium-btn');
    
    if(token || isGuest) {
        document.getElementById('coin-display').style.opacity = "1";
        accBtn.innerText = isPremiumUser ? "👑 Premium" : (isGuest ? "👤 Guest" : "👤 Account");
        if(isPremiumUser) {
            accBtn.classList.add('premium');
            premiumBtn.style.display = 'none';
        }
    }
    document.getElementById('coin-count').innerText = gardenData.coins;
}

function toggleDeleteMode() {
    isDeleteMode = !isDeleteMode;
    document.body.classList.toggle('delete-mode', isDeleteMode);
    renderAll();
}

/* --- RENDERERS --- */
function renderAll() {
    renderPlants();
    renderHabits();
}

// --- PLANT LOGIC --- //

function openPlantDialog(id=null) {
    if(isDeleteMode) return;
    if(!checkAuth()) return;
    
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
        // New Plant Defaults
        if(!isPremiumUser && gardenData.plants.length >= MAX_FREE_ITEMS) {
            document.getElementById('premium-dialog').showModal();
            return;
        }
        document.getElementById('plant-form').reset();
        tempPlantState = { type: 'basic', pot: 'terra', mode: 'checklist', checklist: [], counterMax: 10, counterVal: 0 };
    }

    renderSelector('plant-type-selector', PLANT_TYPES, 'type', tempPlantState.type);
    renderSelector('plant-pot-selector', POT_STYLES, 'pot', tempPlantState.pot);
    setTaskMode(tempPlantState.mode); // This renders the task inputs
    
    document.getElementById('plant-dialog').showModal();
}

// Switch between Checklist and Counter inputs
function setTaskMode(mode) {
    tempPlantState.mode = mode;
    document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(mode === 'checklist' ? 'task-type-check' : 'task-type-count').classList.add('active');

    const container = document.getElementById('task-input-area');
    container.innerHTML = '';

    if(mode === 'checklist') {
        container.innerHTML = `
            <div class="checklist-add-row">
                <input type="text" id="new-task-input" placeholder="Add step...">
                <button type="button" class="btn-small" onclick="addChecklistItem()">Add</button>
            </div>
            <div class="checklist-container" id="dialog-checklist"></div>
        `;
        renderChecklistUI();
    } else {
        container.innerHTML = `
            <label>Target Count (e.g., Pages, Minutes)</label>
            <div class="counter-input-group">
                <input type="number" id="counter-max-input" value="${tempPlantState.counterMax}" onchange="tempPlantState.counterMax=parseInt(this.value)">
            </div>
        `;
    }
}

// Visual Selector Renderer (Used for Shop AND Create)
function renderSelector(containerId, sourceData, stateKey, currentVal) {
    const c = document.getElementById(containerId);
    c.innerHTML = '';
    
    for(const [key, item] of Object.entries(sourceData)) {
        const isUnlocked = gardenData.unlockedItems.includes(key) || item.price === 0;
        const isLockedPremium = item.isPremium && !isPremiumUser;
        
        const card = document.createElement('div');
        let classes = 'select-card';
        if(currentVal === key) classes += ' selected';
        if(!isUnlocked) classes += ' locked';
        
        card.className = classes;
        
        let badges = '';
        if(item.isPremium) badges += `<span class="premium-crown">👑</span>`;
        if(!isUnlocked) badges += `<span class="lock-badge">🔒</span>`;

        card.innerHTML = `
            ${badges}
            <div class="card-icon" style="color:${item.color}">${item.icon}</div>
            <div class="card-name">${item.name}</div>
        `;

        card.onclick = () => {
            if(!isUnlocked) { alert("Unlock this in the Shop first!"); return; }
            if(isLockedPremium) { document.getElementById('premium-dialog').showModal(); return; }
            
            // Update State
            if(containerId.includes('plant')) tempPlantState[stateKey] = key;
            else tempHabitState[stateKey] = key;
            
            renderSelector(containerId, sourceData, stateKey, key); // Re-render to show selection
        };
        c.appendChild(card);
    }
}

// Save Plant Logic
document.getElementById('plant-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const title = document.getElementById('plant-title').value;
    
    // Growth Logic
    let growth = 0;
    if(tempPlantState.mode === 'checklist') {
        const total = tempPlantState.checklist.length;
        const done = tempPlantState.checklist.filter(t => t.done).length;
        if(total > 0 && done === total) growth = 2; // Full bloom
        else if (done > 0) growth = 1;
    } else {
        // Counter logic
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

// Checklist Helpers
function addChecklistItem() {
    const val = document.getElementById('new-task-input').value;
    if(val) {
        tempPlantState.checklist.push({text: val, done: false});
        renderChecklistUI();
        document.getElementById('new-task-input').value = '';
    }
}
function renderChecklistUI() {
    const c = document.getElementById('dialog-checklist');
    c.innerHTML = '';
    tempPlantState.checklist.forEach((t, i) => {
        const d = document.createElement('div');
        d.className = 'checklist-item';
        d.innerHTML = `
            <input type="checkbox" ${t.done ? 'checked' : ''} onchange="toggleCheckItem(${i})">
            <span>${t.text}</span>
            <button type="button" style="color:red; background:none; border:none;" onclick="delCheckItem(${i})">✕</button>
        `;
        c.appendChild(d);
    });
}
function toggleCheckItem(i) { tempPlantState.checklist[i].done = !tempPlantState.checklist[i].done; }
function delCheckItem(i) { tempPlantState.checklist.splice(i, 1); renderChecklistUI(); }

// --- HABIT LOGIC (VINES) --- //

function openHabitDialog() {
    if(isDeleteMode) return;
    if(!checkAuth()) return;
    
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
        type: tempHabitState.type, // Uses the selection from grid
        history: {}
    });
    
    saveData();
    renderHabits();
    document.getElementById('habit-dialog').close();
});

/* --- IMPROVED HABIT LOGIC (REDONE) --- */

function renderHabits() {
    const container = document.getElementById('habits-container');
    const { days, monthName } = getMonthData(currentViewDate);
    
    // Update Month Title
    const monthLabel = document.getElementById('calendar-month-label');
    if(monthLabel) monthLabel.innerText = monthName;
    
    container.innerHTML = '';

    // Empty State
    if (!gardenData.habits || gardenData.habits.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding:40px; color:#aaa; background:rgba(0,0,0,0.2); border-radius:20px;">
                <div style="font-size:3rem; margin-bottom:10px;">🍇</div>
                <div>No habits planted yet.</div>
                <div style="font-size:0.8rem; margin-top:5px;">Click the Grape icon to start!</div>
            </div>`;
        return;
    }

    gardenData.habits.forEach(habit => {
        const streak = Object.keys(habit.history).length; // Simple streak calc
        
        const card = document.createElement('div');
        card.className = 'habit-calendar-card';
        
        // Delete Mode Click Handler
        if(isDeleteMode) {
            card.onclick = () => { 
                if(confirm(`Delete habit "${habit.title}"?`)) { 
                    gardenData.habits = gardenData.habits.filter(h => h.id !== habit.id); 
                    saveData(); 
                    renderHabits(); 
                }
            };
            card.style.borderColor = '#ff4444';
        }

        const header = `
            <div class="habit-header">
                <h3>${habit.title}</h3>
                <span class="habit-streak-badge">🔥 ${streak} Days</span>
            </div>`;

        // --- SVG VINE GENERATION ---
        const cols = 7;
        const rowHeight = 70; // More space for animation
        const colWidth = 50;
        const svgHeight = Math.ceil(days.length / cols) * rowHeight + 20;
        
        let pathD = "";
        let nodesHTML = "";
        
        days.forEach((day, i) => {
            const row = Math.floor(i / cols);
            const col = i % cols;
            
            // Snake Layout: Even rows go Left->Right, Odd rows go Right->Left
            const isEvenRow = row % 2 === 0;
            const x = isEvenRow ? (col * colWidth) + 30 : ((cols - 1 - col) * colWidth) + 30;
            const y = (row * rowHeight) + 30;
            
            // Calculate Vine Path (Bezier Curves)
            if (i === 0) {
                pathD += `M ${x} ${y}`;
            } else {
                const prevRow = Math.floor((i-1) / cols);
                const prevCol = (i-1) % cols;
                const isPrevEven = prevRow % 2 === 0;
                const px = isPrevEven ? (prevCol * colWidth) + 30 : ((cols - 1 - prevCol) * colWidth) + 30;
                const py = (prevRow * rowHeight) + 30;
                
                // Curve control points for smooth vine
                pathD += ` C ${px} ${py + 40}, ${x} ${y - 40}, ${x} ${y}`;
            }

            // Visual Logic
            const isDone = habit.history[day];
            const isFuture = new Date(day) > new Date();
            const color = VINE_TYPES[habit.type]?.color || '#9C27B0';
            
            // 1. Define Visuals
            let visual = "";
            
            if (isDone) {
                // Completed: Bloom + Particles
                const shape = `<circle r="12" fill="${color}" stroke="white" stroke-width="1"/>`; // Fruit
                const particles = `
                    <g class="particle-burst">
                        <circle cx="0" cy="0" r="2" fill="${color}"/>
                        <circle cx="0" cy="0" r="2" fill="#fff"/>
                        <circle cx="0" cy="0" r="2" fill="gold"/>
                        <circle cx="0" cy="0" r="2" fill="${color}"/>
                        <circle cx="0" cy="0" r="2" fill="#fff"/>
                        <circle cx="0" cy="0" r="2" fill="gold"/>
                    </g>`;
                visual = `<g class="bloom-group">${particles}${shape}</g>`;
            } else {
                // Not Done: Closed Pod
                visual = `<path d="M0,10 Q-6,0 0,-10 Q6,0 0,10 Z" fill="#2E7D32" stroke="#1B5E20" stroke-width="1" />`;
            }

            // 2. Interaction
            // If it's a future date, disable click. If Delete Mode, disable toggle.
            const clickAction = (isFuture || isDeleteMode) ? '' : `onclick="toggleHabit('${habit.id}', '${day}')"`;
            const opacity = isFuture ? 0.3 : 1;

            nodesHTML += `
                <g transform="translate(${x},${y})" class="pod-group" ${clickAction} style="opacity:${opacity}">
                    <rect x="-25" y="-25" width="50" height="50" class="hit-box" />
                    
                    <g class="visual-content">
                        ${visual}
                    </g>
                    
                    <text y="28" class="calendar-day-label">${day.split('-')[2]}</text>
                </g>`;
        });

        // Assemble SVG
        const svgContent = `
            <svg class="vine-calendar-svg" viewBox="0 0 ${cols * colWidth + 20} ${svgHeight}">
                <path d="${pathD}" fill="none" stroke="#388E3C" stroke-width="3" stroke-linecap="round"/>
                ${nodesHTML}
            </svg>`;

        card.innerHTML = header + `<div class="calendar-grid-container">${svgContent}</div>`;
        container.appendChild(card);
    });
}

function toggleHabit(id, date) {
    if(isDeleteMode) return; // Don't toggle if in delete mode
    
    const habit = gardenData.habits.find(h => h.id == id);
    if (!habit) return;

    if (habit.history[date]) {
        // UNCHECK: Remove coin, remove history
        delete habit.history[date];
        // Prevent negative coins
        if(gardenData.coins > 0) gardenData.coins--;
    } else {
        // CHECK: Add coin, add history
        habit.history[date] = true;
        gardenData.coins++;
    }
    
    saveData();
    renderHabits();
}

function changeMonth(offset) {
    currentViewDate.setMonth(currentViewDate.getMonth() + offset);
    renderHabits();
}

// --- PLANT RENDERER (Updated for Pots/Visuals) --- //
function getPlantSVG(growth, type, potStyle) {
    const potConfig = POT_STYLES[potStyle] || POT_STYLES['terra'];
    const plantConfig = PLANT_TYPES[type] || PLANT_TYPES['basic'];
    
    // Pot SVG
    const potSVG = `<path d="M20,0 L80,0 L70,50 C70,60 30,60 30,50 Z" fill="${potConfig.color}" transform="translate(50,150)"/>`;
    
    // Plant SVG
    let plantSVG = "";
    if(growth === 0) {
        plantSVG = `<circle cx="100" cy="150" r="5" fill="#8D6E63"/>`; // Seed
    } else if (growth === 1) {
        plantSVG = `<path d="M100,150 Q100,120 90,110" stroke="#4CAF50" stroke-width="3" fill="none"/><circle cx="90" cy="110" r="8" fill="#81C784"/>`; // Sprout
    } else {
        // Bloomed - Custom by Type
        const stem = `<path d="M100,150 Q100,100 100,70" stroke="#2E7D32" stroke-width="4" fill="none"/>`;
        let flower = `<circle cx="100" cy="70" r="15" fill="${plantConfig.color}"/>`; // Default
        
        if(type === 'sun') flower = `<circle cx="100" cy="70" r="20" fill="#FFD700"/><circle cx="100" cy="70" r="8" fill="#5D4037"/>`;
        if(type === 'rose') flower = `<circle cx="100" cy="70" r="15" fill="#E91E63"/><path d="M95,70 Q100,60 105,70" stroke="#fff" fill="none" opacity="0.5"/>`;
        if(type === 'cactus') flower = `<rect x="85" y="80" width="30" height="70" rx="15" fill="#004D40"/><line x1="85" y1="100" x2="80" y2="95" stroke="#fff"/>`;
        if(type === 'fern') flower = `<path d="M100,150 Q70,100 60,120 M100,150 Q130,100 140,120 M100,150 Q100,80 100,60" stroke="#2E7D32" stroke-width="4" fill="none"/>`;
        
        plantSVG = stem + flower;
    }

    return `<svg viewBox="0 0 200 220" class="interactive-plant-svg">${potSVG}${plantSVG}</svg>`;
}

function renderPlants() {
    const container = document.getElementById('garden-grid-container');
    container.innerHTML = '';
    
    gardenData.plants.forEach(plant => {
        // Handle Counter logic vs Checklist logic
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
        
        const card = document.createElement('div');
        card.className = 'potted-plant-card';
        card.onclick = () => { if(isDeleteMode) { gardenData.plants = gardenData.plants.filter(p=>p.id!==plant.id); saveData(); renderPlants(); } else openPlantDialog(plant.id); };
        
        card.innerHTML = `
            <div class="plant-visual-container">${getPlantSVG(plant.growth, plant.type, plant.pot)}</div>
            <div class="plant-info">
                <h3>${plant.title}</h3>
                <div class="progress-bar-container"><div class="progress-bar-fill" style="width:${progress}%"></div></div>
                <div style="font-size:0.7rem; color:#aaa; margin-top:4px;">${progressText}</div>
            </div>`;
        
        container.appendChild(card);
    });
}


// --- UNIFIED SHOP LOGIC --- //

function openShopDialog() {
    if(!checkAuth()) return;
    renderShopTab('plants'); // Default tab
    document.getElementById('shop-dialog').showModal();
}

function renderShopTab(tab) {
    currentShopTab = tab;
    // Update Tab UI
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => { if(b.innerText.toLowerCase().includes(tab.slice(0,3))) b.classList.add('active'); });

    const container = document.getElementById('shop-grid-container');
    container.innerHTML = '';
    container.className = 'selection-grid'; // Re-use the grid style

    // Select Data Source
    let dataSource = {};
    if(tab === 'plants') dataSource = PLANT_TYPES;
    if(tab === 'vines')  dataSource = VINE_TYPES;
    if(tab === 'pots')   dataSource = POT_STYLES;

    for(const [key, item] of Object.entries(dataSource)) {
        if(item.price === 0) continue; // Don't show free defaults in shop
        
        const isOwned = gardenData.unlockedItems.includes(key);
        const card = document.createElement('div');
        card.className = isOwned ? 'select-card selected' : 'select-card';
        
        let badges = '';
        if(item.isPremium) badges += `<span class="premium-crown">👑</span>`;

        card.innerHTML = `
            ${badges}
            <div class="card-icon" style="color:${item.color}">${item.icon}</div>
            <div class="card-name">${item.name}</div>
            ${isOwned ? '<span style="font-size:0.7rem;">Owned</span>' : `<div class="shop-price-tag">${item.price} 🪙</div>`}
        `;

        if(!isOwned) {
            card.onclick = () => buyItem(key, item.price);
        }
        
        container.appendChild(card);
    }
}

function buyItem(key, price) {
    if(gardenData.coins >= price) {
        gardenData.coins -= price;
        gardenData.unlockedItems.push(key);
        saveData();
        renderShopTab(currentShopTab); // Re-render to show "Owned"
        alert(`Purchased ${key}!`);
    } else {
        alert("Not enough coins!");
    }
}


/* --- UTILS --- */
function getMonthData(date) {
    const year = date.getFullYear();
    const month = date.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const monthName = date.toLocaleDateString('default', { month: 'long', year: 'numeric' });
    const days = [];
    // Offset correction
    for (let i = 1; i <= daysInMonth; i++) {
        const d = new Date(year, month, i);
        const offset = d.getTimezoneOffset() * 60000;
        days.push(new Date(d.getTime() - offset).toISOString().split('T')[0]);
    }
    return { days, monthName };
}

function calculateStreak(history) {
    // Simplified streak logic
    let streak = 0;
    // (Existing logic can be pasted here if you need perfect streak calc, 
    // but for UI visualization this is sufficient)
    return { current: Object.keys(history).length }; 
}

// Payment Redirects
async function startCheckout() {
    // API Call placeholder
    alert("Redirecting to Stripe...");
}
/* --- MISSING HELPER FUNCTIONS --- */

function safeNavigate(pageId) {
    if (!checkAuth()) return; // Stop if not logged in
    showPage(pageId);
}

function handlePremiumClick() {
    // Open the premium dialog
    document.getElementById('premium-dialog').showModal();
}

function handleAccountClick() {
    // If logged in, maybe show account details? For now, just open auth.
    // If you want a logout, you can add that logic here.
    if (token || localStorage.getItem('isGuest') === 'true') {
        if(confirm("Log out?")) {
            token = null;
            localStorage.removeItem('garden_token');
            localStorage.removeItem('isGuest');
            location.reload();
        }
    } else {
        document.getElementById('auth-dialog').showModal();
    }
}

function closePlantDialog() {
    document.getElementById('plant-dialog').close();
}

function safeAction(actionFunction) {
    if (!checkAuth()) return;
    actionFunction();
}
// Load it up!
document.addEventListener('DOMContentLoaded', initAuth);