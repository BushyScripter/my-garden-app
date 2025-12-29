/* --- CONFIG & STATE --- */
const MAX_FREE_ITEMS = 3;
let token = localStorage.getItem('garden_token'); 
let gardenData = { coins: 50, unlockedItems: ["basic", "terra", "grape"], plants: [], habits: [] };
let isPremiumUser = false;
let isDeleteMode = false;
let editingPlantId = null;
let currentViewDate = new Date(); 
let currentShopTab = 'plants';

// --- ASSETS ---
const PLANT_TYPES = {
    "basic": { name: "Basic Leaf", price: 0, isPremium: false, icon: "🌱", color: "#4CAF50" },
    "sun":   { name: "Sunflower", price: 20, isPremium: false, icon: "🌻", color: "#FFD700" },
    "rose":  { name: "Wild Rose", price: 40, isPremium: true,  icon: "🌹", color: "#E91E63" },
    "cactus":{ name: "Cactus",    price: 30, isPremium: false, icon: "🌵", color: "#004D40" },
    "fern":  { name: "Fern",      price: 50, isPremium: true,  icon: "🌿", color: "#2E7D32" },
    "tulip": { name: "Tulip",     price: 35, isPremium: false, icon: "🌷", color: "#FF69B4" }
};
const VINE_TYPES = {
    "grape":     { name: "Grapes",     price: 0,  icon: "🍇", color: "#9C27B0" },
    "tomato":    { name: "Tomatoes",   price: 25, isPremium: false, icon: "🍅", color: "#D50000" },
    "blueberry": { name: "Blueberry",  price: 40, isPremium: true, icon: "🫐", color: "#3F51B5" },
    "strawberry":{ name: "Strawberry", price: 30, isPremium: false, icon: "🍓", color: "#FF1744" }
};
const POT_STYLES = {
    "terra":   { name: "Terra Cotta", price: 0,  isPremium: false, icon: "🏺", color: "#E65100" },
    "classic": { name: "Classic Blue",price: 15, isPremium: false, icon: "🔵", color: "#1E88E5" },
    "modern":  { name: "Modern Wht",  price: 25, isPremium: true, icon: "⚪", color: "#F5F5F5" },
    "gold":    { name: "Gold Pot",    price: 100,isPremium: true, icon: "👑", color: "#FFD700" }
};

let tempPlantState = { type: 'basic', pot: 'terra', mode: 'checklist', checklist: [], counterMax: 10, counterVal: 0 };
let tempHabitState = { type: 'grape' };

/* --- AUTH & INIT --- */
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
    
    // Guest Fallback
    if (!localStorage.getItem('isGuest')) localStorage.setItem('isGuest', 'true');
    const local = localStorage.getItem('guestData');
    if (local) gardenData = JSON.parse(local);
    
    // Integrity Check
    if(!gardenData.plants) gardenData.plants = [];
    if(!gardenData.habits) gardenData.habits = [];
    if(!gardenData.unlockedItems) gardenData.unlockedItems = ["basic", "terra", "grape"];

    updateAccountUI(false);
    renderAll();
}

async function saveData() {
    updateCoinDisplay();
    localStorage.setItem('guestData', JSON.stringify(gardenData)); // Always backup locally
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

/* --- UI NOTIFICATIONS --- */
function showNotification(message, icon = "✨") {
    const container = document.getElementById('notification-container');
    const toast = document.createElement('div');
    toast.className = 'garden-toast';
    toast.innerHTML = `<span style="font-size:1.2rem">${icon}</span> <span>${message}</span>`;
    
    // Particles
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

/* --- NAVIGATION --- */
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

/* --- AUTH ACTIONS --- */
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

/* --- RENDERERS --- */
function renderAll() { renderPlants(); renderHabits(); }

// --- PLANT LOGIC ---
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
        // Stats
        let progress = 0, label = "";
        if(plant.taskMode === 'counter') {
            progress = (plant.counterVal / plant.counterMax) * 100;
            label = `${plant.counterVal} / ${plant.counterMax}`;
        } else {
            const done = plant.checklist.filter(t=>t.done).length;
            progress = plant.checklist.length ? (done/plant.checklist.length)*100 : 0;
            label = `${done} / ${plant.checklist.length}`;
        }
        if(progress >= 100) plant.growth = 2; else if(progress > 0) plant.growth = 1; else plant.growth = 0;

        // Card Construction
        const card = document.createElement('div');
        card.className = 'potted-plant-card';
        
        // 1. Click Area (Edit)
        const clickArea = document.createElement('div');
        clickArea.className = 'plant-click-area';
        clickArea.onclick = () => {
            if(isDeleteMode) { 
                if(confirm("Delete?")) { gardenData.plants = gardenData.plants.filter(p=>p.id!==plant.id); saveData(); renderPlants(); }
            } else openPlantDialog(plant.id);
        };
        clickArea.innerHTML = `
            <div class="plant-visual-container">${getPlantSVG(plant.growth, plant.type, plant.pot)}</div>
            <div class="plant-info" style="pointer-events:none;">
                <h3>${plant.title}</h3>
                <div class="progress-bar-container"><div class="progress-bar-fill" style="width:${Math.min(progress,100)}%"></div></div>
                <div style="font-size:0.7rem; color:#aaa; margin-top:4px;">${label}</div>
            </div>`;
        
        // 2. Action Button (Grow)
        let btnHTML = "";
        if(plant.taskMode === 'counter' && !isDeleteMode) {
            const btn = document.createElement('button');
            btn.className = 'plant-action-btn';
            btn.innerHTML = `<span>💧</span> Grow (+1)`;
            btn.onclick = (e) => {
                e.stopPropagation();
                plant.counterVal++; gardenData.coins++; 
                showNotification("+1 Coin!", "🪙");
                saveData(); renderPlants();
            };
            btnHTML = btn;
        } else if (plant.taskMode === 'checklist' && !isDeleteMode) {
            const btn = document.createElement('button');
            btn.className = 'plant-action-btn';
            btn.innerHTML = `<span>📝</span> View List`;
            btn.onclick = (e) => { e.stopPropagation(); openPlantDialog(plant.id); };
            btnHTML = btn;
        }

        card.appendChild(clickArea);
        if(btnHTML) card.appendChild(btnHTML);
        container.appendChild(card);
    });
}

function getPlantSVG(growth, type, potStyle) {
    const potC = POT_STYLES[potStyle] || POT_STYLES['terra'];
    const plantC = PLANT_TYPES[type] || PLANT_TYPES['basic'];
    const pot = `<path d="M20,0 L80,0 L70,50 C70,60 30,60 30,50 Z" fill="${potC.color}" transform="translate(50,150)"/>`;
    let body = "";
    if(growth===0) body = `<circle cx="100" cy="150" r="5" fill="#8D6E63"/>`;
    else if(growth===1) body = `<path d="M100,150 Q100,120 90,110" stroke="#4CAF50" stroke-width="3" fill="none"/><circle cx="90" cy="110" r="8" fill="#81C784"/>`;
    else {
        body = `<path d="M100,150 Q100,100 100,70" stroke="#2E7D32" stroke-width="4" fill="none"/>`;
        if(type==='sun') body += `<circle cx="100" cy="70" r="20" fill="#FFD700"/><circle cx="100" cy="70" r="8" fill="#5D4037"/>`;
        else if(type==='rose') body += `<circle cx="100" cy="70" r="15" fill="#E91E63"/><path d="M95,70 Q100,60 105,70" stroke="#fff" fill="none" opacity="0.5"/>`;
        else if(type==='cactus') body = `<rect x="85" y="80" width="30" height="70" rx="15" fill="#004D40"/><line x1="85" y1="100" x2="80" y2="95" stroke="#fff"/>` + pot; 
        else body += `<circle cx="100" cy="70" r="15" fill="${plantC.color}"/>`;
    }
    return `<svg viewBox="0 0 200 220" class="interactive-plant-svg">${pot}${body}</svg>`;
}

// --- HABITS ---
function openHabitDialog() {
    if(isDeleteMode) return;
    if(!isPremiumUser && (!gardenData.habits || gardenData.habits.length >= MAX_FREE_ITEMS)) return document.getElementById('premium-dialog').showModal();
    document.getElementById('habit-form').reset();
    tempHabitState = { type: 'grape' };
    renderSelector('habit-type-selector', VINE_TYPES, 'type', 'grape');
    document.getElementById('habit-dialog').showModal();
}
document.getElementById('habit-form').addEventListener('submit', (e) => {
    e.preventDefault();
    if(!gardenData.habits) gardenData.habits = [];
    gardenData.habits.push({ id: Date.now(), title: document.getElementById('habit-title').value, type: tempHabitState.type, history: {} });
    saveData(); renderHabits(); document.getElementById('habit-dialog').close();
});

function renderHabits() {
    const c = document.getElementById('habits-container');
    const { days, monthName } = getMonthData(currentViewDate);
    document.getElementById('calendar-month-label').innerText = monthName;
    c.innerHTML = '';
    
    if(!gardenData.habits.length) { c.innerHTML = `<div style="text-align:center; padding:40px; color:#aaa; background:rgba(0,0,0,0.2); border-radius:20px;">🍇<br>No habits yet.</div>`; return; }

    gardenData.habits.forEach(h => {
        const card = document.createElement('div');
        card.className = 'habit-calendar-card';
        if(isDeleteMode) { card.style.borderColor = '#ff4444'; card.onclick = () => { if(confirm("Delete?")) { gardenData.habits = gardenData.habits.filter(x=>x.id!==h.id); saveData(); renderHabits(); }}; }
        
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
            const color = VINE_TYPES[h.type]?.color || '#9C27B0';
            const visual = isDone ? `<g class="bloom-group"><g class="particle-burst"><circle cx="0" cy="0" r="2" fill="${color}"/><circle cx="0" cy="0" r="2" fill="gold"/></g><circle r="12" fill="${color}" stroke="white" stroke-width="1"/></g>` : `<path d="M0,10 Q-6,0 0,-10 Q6,0 0,10 Z" fill="#2E7D32" stroke="#1B5E20"/>`;
            const opacity = (new Date(day) > new Date()) ? 0.3 : 1;
            const click = (new Date(day) > new Date() || isDeleteMode) ? '' : `onclick="toggleHabit('${h.id}','${day}')"`;
            
            nodes += `<g transform="translate(${x},${y})" class="pod-group" ${click} style="opacity:${opacity}"><rect x="-25" y="-25" width="50" height="50" class="hit-box"/><g class="visual-content">${visual}</g><text y="28" class="calendar-day-label">${day.split('-')[2]}</text></g>`;
        });
        
        card.innerHTML = `<div class="habit-header"><h3>${h.title}</h3><span class="habit-streak-badge">🔥 ${Object.keys(h.history).length}</span></div><div class="calendar-grid-container"><svg class="vine-calendar-svg" viewBox="0 0 ${cols*colW+20} ${Math.ceil(days.length/cols)*rowH+20}"><path d="${pathD}" fill="none" stroke="#388E3C" stroke-width="3"/>${nodes}</svg></div>`;
        c.appendChild(card);
    });
}

function toggleHabit(id, date) {
    if(isDeleteMode) return;
    const h = gardenData.habits.find(x=>x.id==id);
    if(h.history[date]) { delete h.history[date]; if(gardenData.coins>0) gardenData.coins--; }
    else { h.history[date] = true; gardenData.coins++; showNotification("Habit Done!", "🔥"); }
    saveData(); renderHabits();
}
function changeMonth(d) { currentViewDate.setMonth(currentViewDate.getMonth()+d); renderHabits(); }

// --- SHOP ---
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
        if(!owned) div.onclick = () => {
            if(gardenData.coins >= item.price) {
                gardenData.coins -= item.price; gardenData.unlockedItems.push(key); saveData(); renderShopTab(tab); showNotification(`Bought ${item.name}!`, "🛍️");
            } else showNotification("Not enough coins", "🚫");
        };
        c.appendChild(div);
    });
}

// --- UTILS ---
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
        c.innerHTML += `<div class="checklist-item"><input type="checkbox" ${t.done?'checked':''} onchange="tempPlantState.checklist[${i}].done=!tempPlantState.checklist[${i}].done"><span>${t.text}</span><button style="color:red;background:none;border:none;" onclick="tempPlantState.checklist.splice(${i},1);renderChecklistUI()">✕</button></div>`;
    });
}
function getMonthData(d) {
    const m = d.getMonth(), y = d.getFullYear();
    const days = [];
    const dim = new Date(y, m+1, 0).getDate();
    for(let i=1; i<=dim; i++) days.push(new Date(y, m, i).toISOString().split('T')[0]);
    return { days, monthName: d.toLocaleDateString('default', {month:'long', year:'numeric'}) };
}
function closePlantDialog() { document.getElementById('plant-dialog').close(); }
function handlePremiumClick() { document.getElementById('premium-dialog').showModal(); }
async function startCheckout() { alert("Redirecting to Stripe..."); }

document.addEventListener('DOMContentLoaded', initAuth);