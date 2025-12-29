/* --- CONFIGURATION & DATA MODELS --- */
const MAX_FREE_ITEMS = 3;
let token = null; 
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


/* --- AUTHENTICATION & SAVING --- */
function initAuth() {
    const storedToken = localStorage.getItem('garden_token');
    
    // 1. Force Guest Mode if no token exists
    if (!storedToken && localStorage.getItem('isGuest') !== 'true') {
        localStorage.setItem('isGuest', 'true');
    }

    const isGuest = localStorage.getItem('isGuest') === 'true';

    // 2. Load Data
    if (storedToken) {
        token = storedToken;
        // In a real app, you would fetch from server here.
        // For now, we load from local or default.
        const saved = localStorage.getItem('guestData'); // Simulating server load from local for now
        if(saved) gardenData = JSON.parse(saved);
    } else if (isGuest) {
        const saved = localStorage.getItem('guestData');
        if (saved) {
            gardenData = JSON.parse(saved);
        } else {
            console.log("New Guest: Initializing default data.");
            saveData(); // Save the defaults immediately
        }
    }
    
    // 3. Safety Check
    if(!gardenData.habits) gardenData.habits = [];
    if(!gardenData.plants) gardenData.plants = [];
    if(!gardenData.unlockedItems) gardenData.unlockedItems = ["basic", "terra", "grape"];

    updateAccountUI();
    renderAll();
}

function checkAuth() {
    if (token || localStorage.getItem('isGuest') === 'true') return true;
    document.getElementById('auth-dialog').showModal();
    return false;
}

function saveData() {
    if (!gardenData) return;
    updateCoinDisplay();

    // Always save to LocalStorage for Guest Mode
    if (localStorage.getItem('isGuest') === 'true') {
        localStorage.setItem('guestData', JSON.stringify(gardenData));
        console.log("Saved Data:", gardenData);
    }
}

function handleAccountClick() {
    if (token || localStorage.getItem('isGuest') === 'true') {
        if(confirm("Log out and clear local data?")) {
            token = null;
            localStorage.removeItem('garden_token');
            localStorage.removeItem('isGuest');
            localStorage.removeItem('guestData'); // Clear data on logout
            location.reload();
        }
    } else {
        document.getElementById('auth-dialog').showModal();
    }
}

/* --- NAVIGATION --- */
function showPage(id) { 
    document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active')); 
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active')); 
    document.getElementById(id).classList.add('active'); 
}

function safeNavigate(pageId) {
    if (!checkAuth()) return;
    showPage(pageId);
}

function safeAction(actionFunction) {
    if (!checkAuth()) return;
    actionFunction();
}

function updateAccountUI() {
    const isGuest = localStorage.getItem('isGuest') === 'true';
    const accBtn = document.getElementById('account-btn');
    const premiumBtn = document.getElementById('premium-btn');
    
    if(token || isGuest) {
        document.getElementById('coin-display').style.opacity = "1";
        accBtn.innerText = isPremiumUser ? "👑 Premium" : (isGuest ? "👤 Guest" : "👤 Account");
        if(isPremiumUser) premiumBtn.style.display = 'none';
    }
    document.getElementById('coin-count').innerText = gardenData.coins;
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

/* --- PLANT LOGIC --- */
function openPlantDialog(id=null) {
    if(isDeleteMode) return;
    if(!checkAuth()) return;
    
    editingPlantId = id;
    if(id) {
        const p = gardenData.plants.find(x => x.id === id);
        document.getElementById('plant-title').value = p.title;
        tempPlantState = { type: p.type, pot: p.pot, mode: p.taskMode, checklist: [...p.checklist], counterMax: p.counterMax, counterVal: p.counterVal };
    } else {
        document.getElementById('plant-form').reset();
        tempPlantState = { type: 'basic', pot: 'terra', mode: 'checklist', checklist: [], counterMax: 10, counterVal: 0 };
    }

    renderSelector('plant-type-selector', PLANT_TYPES, 'type', tempPlantState.type);
    renderSelector('plant-pot-selector', POT_STYLES, 'pot', tempPlantState.pot);
    setTaskMode(tempPlantState.mode);
    document.getElementById('plant-dialog').showModal();
}

function closePlantDialog() { document.getElementById('plant-dialog').close(); }

function setTaskMode(mode) {
    tempPlantState.mode = mode;
    document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(mode === 'checklist' ? 'task-type-check' : 'task-type-count').classList.add('active');

    const container = document.getElementById('task-input-area');
    container.innerHTML = mode === 'checklist' ? 
        `<div class="checklist-add-row"><input type="text" id="new-task-input" placeholder="Add step..."><button type="button" class="btn-small" onclick="addChecklistItem()">Add</button></div><div class="checklist-container" id="dialog-checklist"></div>` :
        `<label>Target Count</label><div class="counter-input-group"><input type="number" id="counter-max-input" value="${tempPlantState.counterMax}" onchange="tempPlantState.counterMax=parseInt(this.value)"></div>`;
    
    if(mode === 'checklist') renderChecklistUI();
}

function addChecklistItem() {
    const val = document.getElementById('new-task-input').value;
    if(val) { tempPlantState.checklist.push({text: val, done: false}); renderChecklistUI(); document.getElementById('new-task-input').value = ''; }
}

function renderChecklistUI() {
    const c = document.getElementById('dialog-checklist');
    c.innerHTML = '';
    tempPlantState.checklist.forEach((t, i) => {
        c.innerHTML += `<div class="checklist-item"><input type="checkbox" ${t.done ? 'checked' : ''} onchange="toggleCheckItem(${i})"><span>${t.text}</span><button type="button" style="color:red; background:none; border:none;" onclick="delCheckItem(${i})">✕</button></div>`;
    });
}
function toggleCheckItem(i) { tempPlantState.checklist[i].done = !tempPlantState.checklist[i].done; }
function delCheckItem(i) { tempPlantState.checklist.splice(i, 1); renderChecklistUI(); }

document.getElementById('plant-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const title = document.getElementById('plant-title').value;
    let growth = 0;
    if(tempPlantState.mode === 'checklist') {
        const done = tempPlantState.checklist.filter(t => t.done).length;
        growth = (done === tempPlantState.checklist.length && done > 0) ? 2 : (done > 0 ? 1 : 0);
    } else {
        growth = (tempPlantState.counterVal >= tempPlantState.counterMax) ? 2 : (tempPlantState.counterVal > 0 ? 1 : 0);
    }

    const newPlant = {
        id: editingPlantId || Date.now(),
        title, ...tempPlantState, growth
    };

    if(editingPlantId) {
        const idx = gardenData.plants.findIndex(p => p.id === editingPlantId);
        gardenData.plants[idx] = newPlant;
    } else {
        gardenData.plants.push(newPlant);
    }
    saveData();
    renderPlants();
    closePlantDialog();
});

function renderPlants() {
    const container = document.getElementById('garden-grid-container');
    container.innerHTML = '';
    gardenData.plants.forEach(plant => {
        const potConfig = POT_STYLES[plant.pot] || POT_STYLES['terra'];
        const typeConfig = PLANT_TYPES[plant.type] || PLANT_TYPES['basic'];
        
        let progress = 0;
        if(plant.taskMode === 'counter') progress = (plant.counterVal / plant.counterMax) * 100;
        else progress = plant.checklist.length ? (plant.checklist.filter(t=>t.done).length / plant.checklist.length)*100 : 0;
        
        // SVG Construction
        const potSVG = `<path d="M20,0 L80,0 L70,50 C70,60 30,60 30,50 Z" fill="${potConfig.color}" transform="translate(50,150)"/>`;
        let plantBody = `<circle cx="100" cy="150" r="5" fill="#8D6E63"/>`; // Seed
        if(plant.growth === 1) plantBody = `<path d="M100,150 Q100,120 90,110" stroke="#4CAF50" stroke-width="3" fill="none"/><circle cx="90" cy="110" r="8" fill="#81C784"/>`;
        if(plant.growth === 2) {
             plantBody = `<path d="M100,150 Q100,100 100,70" stroke="#2E7D32" stroke-width="4" fill="none"/><circle cx="100" cy="70" r="20" fill="${typeConfig.color}"/>`;
        }

        const card = document.createElement('div');
        card.className = 'potted-plant-card';
        card.innerHTML = `
            <div class="plant-visual-container"><svg viewBox="0 0 200 220" class="interactive-plant-svg">${potSVG}${plantBody}</svg></div>
            <div class="plant-info"><h3>${plant.title}</h3><div class="progress-bar-container"><div class="progress-bar-fill" style="width:${progress}%"></div></div></div>`;
        
        card.onclick = () => isDeleteMode ? (confirm("Delete?") && (gardenData.plants = gardenData.plants.filter(p=>p.id!==plant.id), saveData(), renderPlants())) : openPlantDialog(plant.id);
        container.appendChild(card);
    });
}

/* --- HABIT / VINE LOGIC (UPDATED) --- */
function openHabitDialog() {
    if(isDeleteMode || !checkAuth()) return;
    document.getElementById('habit-form').reset();
    tempHabitState = { type: 'grape' };
    renderSelector('habit-type-selector', VINE_TYPES, 'type', 'grape');
    document.getElementById('habit-dialog').showModal();
}

document.getElementById('habit-form').addEventListener('submit', (e) => {
    e.preventDefault();
    gardenData.habits.push({ id: Date.now(), title: document.getElementById('habit-title').value, type: tempHabitState.type, history: {} });
    saveData();
    renderHabits();
    document.getElementById('habit-dialog').close();
});

function renderHabits() {
    const container = document.getElementById('habits-container');
    const { days, monthName } = getMonthData(currentViewDate);
    document.getElementById('calendar-month-label').innerText = monthName;
    container.innerHTML = '';

    if (!gardenData.habits.length) {
        container.innerHTML = `<div style="text-align:center; padding:40px; color:#aaa;">No habits yet. Click the 🍇 button.</div>`;
        return;
    }

    gardenData.habits.forEach(habit => {
        const card = document.createElement('div');
        card.className = 'habit-calendar-card';
        if(isDeleteMode) card.onclick = () => { if(confirm("Delete Vine?")) { gardenData.habits = gardenData.habits.filter(h=>h.id!==habit.id); saveData(); renderHabits(); }};

        const stats = { current: Object.keys(habit.history).length }; // Simple streak
        const header = `<div class="habit-header"><h3>${habit.title}</h3><span class="habit-streak-badge">🔥 ${stats.current}</span></div>`;

        // Draw Vine
        const cols = 7; const rowHeight = 60; const colWidth = 50;
        let pathD = ""; let nodesHTML = "";
        
        days.forEach((day, i) => {
            const row = Math.floor(i / cols); const col = i % cols;
            const x = (row % 2 === 0 ? col : (cols - 1 - col)) * colWidth + 30;
            const y = row * rowHeight + 30;

            if (i === 0) pathD += `M ${x} ${y}`;
            else {
                const prevRow = Math.floor((i-1)/cols); const prevCol = (i-1)%cols;
                const px = (prevRow % 2 === 0 ? prevCol : (cols - 1 - prevCol)) * colWidth + 30;
                pathD += ` C ${px} ${(prevRow*rowHeight)+60}, ${x} ${y-30}, ${x} ${y}`;
            }

            const isDone = habit.history[day];
            const color = VINE_TYPES[habit.type]?.color || '#9C27B0';
            
            // Visuals
            let visual = `<path class="pod-shape" d="M0,10 Q-6,0 0,-10 Q6,0 0,10 Z" />`; // Default Pod
            if (isDone) {
                 visual = `<g class="bloom-group">
                    <g class="particle-burst">${Array(6).fill(`<circle cx="0" cy="0" r="2" fill="${color}"/>`).join('')}</g>
                    <circle r="12" fill="${color}" />
                 </g>`;
            }

            const isFuture = new Date(day) > new Date();
            const clickAttr = (isFuture || isDeleteMode) ? '' : `onclick="toggleHabit('${habit.id}', '${day}')"`;
            
            nodesHTML += `
                <g transform="translate(${x},${y})" class="pod-group" ${clickAttr} style="opacity:${isFuture?0.3:1}">
                    <rect x="-25" y="-25" width="50" height="50" class="hit-box" />
                    <g class="visual-content">${visual}</g>
                    <text y="28" class="calendar-day-label">${day.split('-')[2]}</text>
                </g>`;
        });

        card.innerHTML = header + `<div class="calendar-grid-container"><svg class="vine-calendar-svg" viewBox="0 0 ${cols*colWidth+20} ${Math.ceil(days.length/cols)*rowHeight+20}"><path d="${pathD}" fill="none" stroke="#2E7D32" stroke-width="3"/>${nodesHTML}</svg></div>`;
        container.appendChild(card);
    });
}

function toggleHabit(id, date) {
    const habit = gardenData.habits.find(h => h.id == id);
    if (!habit) return;

    if (habit.history[date]) {
        delete habit.history[date];
        gardenData.coins = Math.max(0, gardenData.coins - 1);
    } else {
        habit.history[date] = true;
        gardenData.coins++;
    }
    saveData();
    renderHabits();
}

/* --- UTILS --- */
function getMonthData(date) {
    const year = date.getFullYear(); const month = date.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];
    for (let i = 1; i <= daysInMonth; i++) {
        const d = new Date(year, month, i);
        days.push(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0]);
    }
    return { days, monthName: date.toLocaleDateString('default', { month: 'long', year: 'numeric' }) };
}

function renderSelector(containerId, data, key, current) {
    const c = document.getElementById(containerId);
    c.innerHTML = '';
    Object.entries(data).forEach(([k, item]) => {
        const d = document.createElement('div');
        d.className = `select-card ${current===k?'selected':''} ${gardenData.unlockedItems.includes(k)||item.price==0?'':'locked'}`;
        d.innerHTML = `<div class="card-icon" style="color:${item.color}">${item.icon}</div><div class="card-name">${item.name}</div>`;
        d.onclick = () => {
             if(!gardenData.unlockedItems.includes(k) && item.price > 0) return alert("Locked!");
             if(containerId.includes('plant')) tempPlantState[key] = k; else tempHabitState[key] = k;
             renderSelector(containerId, data, key, k);
        };
        c.appendChild(d);
    });
}

function changeMonth(offset) {
    currentViewDate.setMonth(currentViewDate.getMonth() + offset);
    renderHabits();
}
function handlePremiumClick() { document.getElementById('premium-dialog').showModal(); }
function openShopDialog() { document.getElementById('shop-dialog').showModal(); }

// INIT
document.addEventListener('DOMContentLoaded', initAuth);