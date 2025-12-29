/* CONFIGURATION */
const CONFIG = {
    ADSENSE_CLIENT_ID: "ca-pub-3438241188942945"
};

const MAX_FREE_ITEMS = 3;
let token = null; 

let gardenData = { coins: 0, unlockedPlants: ["basic"], plants: [], habits: [] };
let isPremiumUser = false;
let isDeleteMode = false; 
let editingPlantId = null; 
let tempChecklist = []; 
let selectedPlantType = "basic"; 
let isRegistering = false;

// --- FIX 1: This missing variable was crashing your calendar ---
let currentViewDate = new Date(); 

const plantTypes = { "basic": { name: "Basic Leaf", price: 0, color: "var(--p-leaf-light)" }, "sun": { name: "Sunflower", price: 10, color: "var(--p-flower)" }, "rose": { name: "Wild Rose", price: 20, color: "var(--p-rose)" }, "cactus":{ name: "Cactus", price: 30, color: "var(--p-cactus)" } };

/* --- AUTH & NAVIGATION --- */

// 1. Initialize without forcing login
function initAuth() {
    const storedToken = localStorage.getItem('garden_token');
    const isGuest = localStorage.getItem('isGuest') === 'true';

    if (storedToken) {
        token = storedToken;
        updateAccountUI(); 
        loadData(); 
    } else if (isGuest) {
        loadData();
        updateAccountUI();
    } else {
        updateAccountUI();
    }
}

// 2. Gatekeeper function
function checkAuth() {
    if (token) return true;
    if (localStorage.getItem('isGuest') === 'true') return true;
    document.getElementById('auth-dialog').showModal();
    return false;
}

// 3. Safe Navigation Wrapper
function safeNavigate(pageId) {
    if(pageId === 'home') {
        showPage('home');
    } else {
        if(checkAuth()) {
            showPage(pageId);
        }
    }
}

// 4. Safe Action Wrapper
function safeAction(callback) {
    if(checkAuth()) {
        callback();
    }
}

function toggleAuthMode() { 
    isRegistering = !isRegistering; 
    document.getElementById('auth-title').innerText = isRegistering ? "Create Account" : "Login to Garden"; 
    document.getElementById('auth-submit-btn').innerText = isRegistering ? "Register" : "Login"; 
    document.getElementById('auth-toggle-text').innerText = isRegistering ? "Already have an account? Login" : "New here? Create Account"; 
}

/* --- UI UPDATES --- */

function updateAccountUI() {
    const accBtn = document.getElementById('account-btn');
    const premiumBtn = document.getElementById('premium-btn');
    const isGuest = localStorage.getItem('isGuest') === 'true'; 

    if (token) {
        document.getElementById('coin-display').style.opacity = "1";
        if (isPremiumUser) {
            accBtn.innerHTML = "👑 Premium Member";
            accBtn.className = "nav-btn account-btn premium";
            premiumBtn.style.display = "none";
        } else {
            accBtn.innerHTML = "👤 Account";
            accBtn.className = "nav-btn account-btn logged-in";
            premiumBtn.style.display = "block";
            premiumBtn.innerText = "👑 Go Premium";
        }
    } else if (isGuest) {
        accBtn.innerHTML = "👤 Guest Mode";
        accBtn.className = "nav-btn account-btn";
        premiumBtn.style.display = "none";
        document.getElementById('coin-display').style.opacity = "1"; 
    } else {
        accBtn.innerHTML = "👤 Login";
        accBtn.className = "nav-btn account-btn";
        premiumBtn.style.display = "none";
        document.getElementById('coin-display').style.opacity = "0";
    }
}

function handleAccountClick() {
    if (localStorage.getItem('isGuest') === 'true') {
        if(confirm("Exit Guest Mode and return to Login? (Your guest data will be lost)")) {
            logout();
        }
        return; 
    }

    if (!token) {
        document.getElementById('auth-dialog').showModal();
    } else {
        if(confirm("Log out of your account?")) {
            logout();
        }
    }
}

function handlePremiumClick() {
    if (!token) {
        alert("Please create an account to subscribe to Premium!");
        document.getElementById('auth-dialog').showModal();
        return;
    }
    if(isPremiumUser) {
        openCustomerPortal();
    } else {
        startCheckout();
    }
}

// --- FETCH WRAPPER ---
async function apiCall(endpoint, method, body = null) {
    const headers = { 'Content-Type': 'application/json' };
    if(token) headers['x-access-token'] = token;
    
    try {
        const res = await fetch(`/api/${endpoint}`, {
            method: method,
            headers: headers,
            body: body ? JSON.stringify(body) : null
        });
        return await res.json();
    } catch(err) { console.error("API Error", err); return null; }
}

document.getElementById('auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-pass').value;

    if(isRegistering) {
        const res = await apiCall('register', 'POST', { email, password });
        if(res.error) alert(res.error);
        else { alert("Account created! Please login."); toggleAuthMode(); }
    } else {
        const res = await apiCall('login', 'POST', { email, password });
        if(res.error) alert(res.error);
        else {
            token = res.token;
            localStorage.setItem('garden_token', token);
            gardenData = res.data;
            isPremiumUser = res.isPremium;
            document.getElementById('auth-dialog').close();
            
            updateAccountUI();
            renderAll();
            updateCoinDisplay();
            showPage('home'); 
        }
    }
});

function logout() { 
    localStorage.removeItem('garden_token'); 
    localStorage.removeItem('isGuest'); 
    location.reload(); 
}

async function saveData() {
    updateCoinDisplay();

    if (localStorage.getItem('isGuest') === 'true') {
        localStorage.setItem('guestData', JSON.stringify(gardenData));
        return;
    }

    await apiCall('sync', 'POST', gardenData);
}

async function loadData() {
    if (localStorage.getItem('isGuest') === 'true') {
        const local = localStorage.getItem('guestData');
        if (local) {
            gardenData = JSON.parse(local);
            if (!gardenData.plants) gardenData.plants = [];
            if (!gardenData.habits) gardenData.habits = [];
            if (!gardenData.unlockedPlants) gardenData.unlockedPlants = ["basic"];
        }
        
        updateAccountUI(); 
        renderAll(); 
        updateCoinDisplay();
        return;
    }

    const res = await apiCall('sync', 'GET');
    
    if (res && res.error) {
        logout(); 
        return;
    }

    if(res) { 
        gardenData = res; 
        isPremiumUser = res.isPremium;
        updateAccountUI(); 
        renderAll(); 
        updateCoinDisplay(); 
    }
}

// Payment Functions
async function startCheckout() {
    const res = await apiCall('create-checkout-session', 'POST');
    if (res && res.url) window.location.href = res.url;
    else alert("Checkout Error.");
}
async function openCustomerPortal() {
    const res = await apiCall('create-portal-session', 'POST');
    if (res && res.url) window.location.href = res.url;
    else alert("Portal Error.");
}

/* --- STANDARD LOGIC --- */
function updateCoinDisplay() {
    document.getElementById('coin-count').innerText = gardenData.coins;
    const container = document.getElementById('coin-display');
    container.classList.remove('coin-anim'); void container.offsetWidth; container.classList.add('coin-anim');
}

function initAdSense() {
    const container = document.getElementById('adsense-container');
    if(CONFIG.ADSENSE_CLIENT_ID && CONFIG.ADSENSE_CLIENT_ID !== "YOUR_ID_HERE") {
        container.innerHTML = `<ins class="adsbygoogle" style="display:block; width: 728px; height: 90px;" data-ad-client="${CONFIG.ADSENSE_CLIENT_ID}" data-ad-slot="1234567890" data-ad-format="auto" data-full-width-responsive="true"></ins>`;
        try { (adsbygoogle = window.adsbygoogle || []).push({}); } catch(e) {}
    }
}

function renderAll() { renderPlants(); renderHabits(); }

const toLocalISO = (date) => { 
    const offset = date.getTimezoneOffset() * 60000; 
    return new Date(date.getTime() - offset).toISOString().split('T')[0]; 
};

/* --- PLANTS LOGIC --- */
function getPlantSVG(growthStage, type) {
    const potColor = "var(--p-pot-terra)"; const pot = `<path d="M10,0 L90,0 L80,60 C80,70 20,70 20,60 Z" fill="${potColor}" transform="translate(50,160)"/>`;
    let plant = `<circle cx="100" cy="160" r="5" fill="var(--p-leaf-lime)"/>`;
    if (growthStage === 1) { plant = `<g transform="translate(100,160)"><path d="M0,0 Q5,-30 0,-60" stroke="var(--p-leaf-mid)" stroke-width="4" fill="none"/><circle cx="0" cy="-60" r="10" fill="var(--p-leaf-light)"/></g>`; } 
    else if (growthStage >= 2) {
        let bloom = ''; if(type === 'sun') bloom = `<circle cx="0" cy="-110" r="25" fill="${plantTypes.sun.color}"/><circle cx="0" cy="-110" r="10" fill="#5D4037"/>`; else if (type === 'rose') bloom = `<circle cx="0" cy="-110" r="20" fill="${plantTypes.rose.color}"/><path d="M-10,-110 Q0,-130 10,-110" stroke="white" fill="none" opacity="0.3"/>`; else if (type === 'cactus') bloom = `<rect x="-15" y="-120" width="30" height="60" rx="15" fill="${plantTypes.cactus.color}"/><line x1="-15" y1="-100" x2="-20" y2="-105" stroke="white"/><line x1="15" y1="-80" x2="20" y2="-85" stroke="white"/>`; else bloom = `<circle cx="0" cy="-100" r="20" fill="var(--p-leaf-mid)"/><circle cx="0" cy="-110" r="8" fill="var(--p-flower)"/>`;
        plant = `<g transform="translate(100,160)"><path d="M0,0 Q-10,-50 0,-100" stroke="var(--p-leaf-dark)" stroke-width="5" fill="none"/>${bloom}</g>`;
    } return `<svg class="interactive-plant-svg" viewBox="0 0 200 230">${pot}${plant}</svg>`;
}

function renderPlants() {
    const container = document.getElementById('garden-grid-container'); container.innerHTML = '';
    gardenData.plants.forEach(plant => {
        const total = plant.tasks ? plant.tasks.length : 0; const done = plant.tasks ? plant.tasks.filter(t => t.done).length : 0; const pct = total === 0 ? 0 : (done / total) * 100; const stage = Math.min(plant.growth, 2);
        const card = document.createElement('div'); card.className = 'potted-plant-card'; card.onclick = () => handlePlantClick(plant.id);
        card.innerHTML = `<div class="watering-can-anim">🚿</div><div class="plant-visual-container">${getPlantSVG(plant.growth, plant.type)}</div><div class="plant-info"><span class="growth-badge">${["Seed", "Sprout", "Bloom"][stage]}</span><h3>${plant.title}</h3><div class="progress-bar-container"><div class="progress-bar-fill" style="width:${pct}%"></div></div><div style="font-size:0.7rem; color:#aaa; margin-top:4px;">${done}/${total} Tasks</div></div>`;
        container.appendChild(card);
    });
}

/* --- VINE CALENDAR LOGIC (NEW) --- */

// 1. Navigation
function changeMonth(offset) {
    currentViewDate.setMonth(currentViewDate.getMonth() + offset);
    renderHabits();
}

function getMonthData(date) {
    const year = date.getFullYear();
    const month = date.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const monthName = date.toLocaleDateString('default', { month: 'long', year: 'numeric' });
    
    // Generate YYYY-MM-DD strings for every day in the month
    const days = [];
    for (let i = 1; i <= daysInMonth; i++) {
        // Handle timezone offset to ensure we get local YYYY-MM-DD
        const d = new Date(year, month, i);
        days.push(toLocalISO(d));
    }
    return { days, monthName };
}

// 2. High Score & Streak Calculation
function calculateStreak(history) {
    // Sort dates
    const dates = Object.keys(history).sort();
    if (dates.length === 0) return { current: 0, best: 0 };

    let current = 0;
    let best = 0;
    let temp = 0;
    
    // Calculate Best
    for (let i = 0; i < dates.length; i++) {
        if (i > 0) {
            const prev = new Date(dates[i-1]);
            const curr = new Date(dates[i]);
            const diff = (curr - prev) / (1000 * 60 * 60 * 24);
            if (diff === 1) temp++;
            else temp = 1;
        } else {
            temp = 1;
        }
        if (temp > best) best = temp;
    }

    // Calculate Current (working backwards from today)
    const today = toLocalISO(new Date());
    const yesterday = new Date(); 
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = toLocalISO(yesterday);

    if (history[today]) {
        current = 1;
        let checkDate = new Date();
        while (true) {
            checkDate.setDate(checkDate.getDate() - 1);
            if (history[toLocalISO(checkDate)]) current++;
            else break;
        }
    } else if (history[yStr]) {
        let checkDate = new Date();
        checkDate.setDate(checkDate.getDate() - 1); // start yesterday
        while (true) {
            if (history[toLocalISO(checkDate)]) current++;
            else break;
            checkDate.setDate(checkDate.getDate() - 1);
        }
    } else {
        current = 0;
    }

    return { current, best };
}

// 3. The SVG Drawer (Replaces old renderHabits)
function renderHabits() {
    const container = document.getElementById('habits-container');
    // --- FIX 2: Ensure getMonthData doesn't crash ---
    const { days, monthName } = getMonthData(currentViewDate);
    
    // Update Header
    const monthLabel = document.getElementById('calendar-month-label');
    if(monthLabel) monthLabel.innerText = monthName;
    
    container.innerHTML = '';

    if (!gardenData.habits || gardenData.habits.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:40px; color:#aaa;">No habits yet.<br>Click the 🍇 button to start.</div>`;
        return;
    }

    gardenData.habits.forEach(habit => {
        const stats = calculateStreak(habit.history);
        
        // Card Setup
        const card = document.createElement('div');
        card.className = 'habit-calendar-card';
        if (isDeleteMode) card.onclick = () => deleteHabit(habit.id);

        // Header (Title + Score)
        const header = `
            <div class="habit-header">
                <h3>${habit.title}</h3>
                <div style="display:flex; gap:10px;">
                    <span class="habit-streak-badge">🔥 ${stats.current}</span>
                    <span class="habit-streak-badge" style="background:rgba(255,255,255,0.1)">🏆 Best: ${stats.best}</span>
                </div>
            </div>`;

        // SVG Calculation
        const cols = 7;
        const rowHeight = 60;
        const colWidth = 50;
        const svgHeight = Math.ceil(days.length / cols) * rowHeight + 20;
        
        // Generate Vine Path
        let pathD = "";
        const points = [];

        days.forEach((day, i) => {
            const row = Math.floor(i / cols);
            const col = i % cols;
            
            // Snake Logic: Even rows L->R, Odd rows R->L
            const isEvenRow = row % 2 === 0;
            const x = isEvenRow ? (col * colWidth) + 30 : ((cols - 1 - col) * colWidth) + 30;
            const y = (row * rowHeight) + 30;
            
            points.push({x, y, date: day});

            if (i === 0) pathD += `M ${x} ${y}`;
            else {
                const prev = points[i-1];
                pathD += ` C ${prev.x} ${prev.y + 30}, ${x} ${y - 30}, ${x} ${y}`;
            }
        });

        // Generate Nodes (Pods/Fruits)
        let nodesHTML = "";
        points.forEach((pt) => {
            const isDone = habit.history[pt.date];
            
            // Determine Graphic
            let content = "";
            if (isDone) {
                // BLOOMED FRUIT
                let shape = "";
                if (habit.type === 'tomato') {
                    shape = `<circle r="12" fill="var(--f-tomato)" /><path d="M-8,-8 L0,-12 L8,-8 L0,0 Z" fill="var(--p-leaf-dark)" />`;
                } else if (habit.type === 'sun') {
                     shape = `<circle r="14" fill="#FFD700" /><circle r="6" fill="#5D4037" /><circle r="2" fill="#fff" opacity="0.3" cx="2" cy="-2"/>`;
                } else {
                    shape = `
                        <circle cx="-5" cy="-5" r="5" fill="var(--f-grape)"/>
                        <circle cx="5" cy="-5" r="5" fill="var(--f-grape)"/>
                        <circle cx="0" cy="5" r="5" fill="var(--f-grape)"/>
                        <path d="M0,-10 L0,-15" stroke="var(--p-leaf-mid)" stroke-width="2"/>
                    `;
                }
                content = `<g class="bloom-group">${shape}</g>`;
            } else {
                // UNOPENED POD
                content = `<path class="pod-shape" d="M0,10 Q-8,0 0,-12 Q8,0 0,10 Z" />`;
            }

            // Click Handler
            const todayDate = new Date();
            const thisDate = new Date(pt.date);
            const isFuture = thisDate > todayDate;
            const clickAttr = (isFuture || isDeleteMode) ? '' : `onclick="toggleHabit('${habit.id}', '${pt.date}')"`;
            const opacity = isFuture ? '0.3' : '1';

            nodesHTML += `
                <g transform="translate(${pt.x},${pt.y})" class="pod-group" ${clickAttr} style="opacity:${opacity}">
                    ${content}
                    <text y="25" class="calendar-day-label">${pt.date.split('-')[2]}</text>
                </g>
            `;
        });

        const svgContent = `
            <svg class="vine-calendar-svg" viewBox="0 0 ${cols * colWidth + 20} ${svgHeight}">
                <path d="${pathD}" fill="none" stroke="var(--p-leaf-dark)" stroke-width="3" stroke-linecap="round" />
                ${nodesHTML}
            </svg>
        `;

        card.innerHTML = header + `<div class="calendar-grid-container">` + svgContent + `</div>`;
        container.appendChild(card);
    });
}

// 4. Toggle Logic (Consolidated)
function toggleHabit(id, date) {
    if (isDeleteMode) return;
    
    const habit = gardenData.habits.find(h => h.id == id);
    if (!habit) return;

    if (habit.history[date]) {
        if (gardenData.coins > 0) {
            delete habit.history[date];
            gardenData.coins--; 
        } else {
            alert("🌱 Nature Balance: You spent the coin earned from this habit! You cannot undo it now.");
            return; 
        }
    } else {
        habit.history[date] = true;
        gardenData.coins++; 
    }
    
    saveData();
    renderHabits();
}

function deleteHabit(id) {
    if(confirm("Remove this vine completely?")) {
        gardenData.habits = gardenData.habits.filter(h => h.id !== id);
        saveData();
        renderHabits();
    }
}

// Logic
function showPage(id) { document.querySelectorAll('.page-section').forEach(s=>s.classList.remove('active')); document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active')); document.getElementById(id).classList.add('active'); if(isDeleteMode) toggleDeleteMode(); }
function toggleDeleteMode() { isDeleteMode=!isDeleteMode; document.body.classList.toggle('delete-mode', isDeleteMode); document.getElementById('delete-mode-btn').classList.toggle('delete-mode-active', isDeleteMode); document.getElementById('delete-mode-btn-2').classList.toggle('delete-mode-active', isDeleteMode); renderHabits(); }

function openPlantDialog(id=null) { 
    if(isDeleteMode)return; 
    if(!checkAuth()) return; 
    if(!id && !isPremiumUser && gardenData.plants.length>=MAX_FREE_ITEMS){document.getElementById('premium-dialog').showModal();return;} 
    const d=document.getElementById('plant-dialog'); editingPlantId=id; tempChecklist=[]; selectedPlantType="basic"; 
    if(id){ const p=gardenData.plants.find(x=>x.id===id); document.getElementById('plant-title').value=p.title; selectedPlantType=p.type||"basic"; tempChecklist=JSON.parse(JSON.stringify(p.tasks||[])); } else { document.getElementById('plant-form').reset(); } 
    renderPlantTypeSelector(); renderChecklistUI(); d.showModal(); 
}
function closePlantDialog() { document.getElementById('plant-dialog').close(); editingPlantId=null; }

document.getElementById('plant-form').addEventListener('submit', (e)=>{ e.preventDefault(); const title=document.getElementById('plant-title').value; const allDone=tempChecklist.length>0 && tempChecklist.every(t=>t.done); const prev=editingPlantId?gardenData.plants.find(p=>p.id===editingPlantId).growth:0; let next=prev; if(allDone && prev<2){ next++; gardenData.coins+=5; } if(editingPlantId){ const p=gardenData.plants.find(x=>x.id===editingPlantId); p.title=title; p.type=selectedPlantType; p.tasks=tempChecklist; p.growth=next; }else{ gardenData.plants.push({id:Date.now(), title, growth:next, type:selectedPlantType, tasks:tempChecklist}); } saveData(); renderPlants(); closePlantDialog(); });

function renderChecklistUI() { const c=document.getElementById('dialog-checklist'); c.innerHTML=''; tempChecklist.forEach((t,i)=>{ const d=document.createElement('div'); d.className=`checklist-item ${t.done?'done':''}`; d.innerHTML=`<input type="checkbox" ${t.done?'checked':''} onchange="toggleTempTask(${i})"><span>${t.text}</span><button type="button" style="background:none;border:none;color:#f55;cursor:pointer;" onclick="removeTempTask(${i})">✕</button>`; c.appendChild(d); }); }
function addChecklistItem(){ const i=document.getElementById('new-task-input'); if(i.value.trim()){ tempChecklist.push({text:i.value, done:false}); i.value=''; renderChecklistUI(); } }
function toggleTempTask(i){ tempChecklist[i].done=!tempChecklist[i].done; renderChecklistUI(); }
function removeTempTask(i){ tempChecklist.splice(i,1); renderChecklistUI(); }
function handlePlantClick(id) { if(isDeleteMode) { gardenData.plants=gardenData.plants.filter(p=>p.id!==id); saveData(); renderPlants(); } else openPlantDialog(id); }
function renderPlantTypeSelector() { const c=document.getElementById('plant-type-selector'); c.innerHTML=''; for(const [k,v] of Object.entries(plantTypes)){ if(gardenData.unlockedPlants.includes(k)){ const d=document.createElement('div'); d.className=`shop-item unlocked ${selectedPlantType===k?'selected':''}`; d.innerHTML=`<div style="font-size:1.5rem; color:${v.color}">✿</div><div>${v.name}</div>`; d.onclick=()=>{selectedPlantType=k;renderPlantTypeSelector();}; c.appendChild(d); } } }

function openHabitDialog() { 
    if(isDeleteMode)return; 
    if(!checkAuth()) return; 
    
    // Safety check for habits array
    const currentHabits = gardenData.habits || [];

    if(!isPremiumUser && currentHabits.length>=MAX_FREE_ITEMS){
        document.getElementById('premium-dialog').showModal();
        return;
    } 
    document.getElementById('habit-form').reset(); 
    document.getElementById('habit-dialog').showModal(); 
}

// --- FIX 3: Consolidated Habit Submission (Removed Duplicate) ---
document.getElementById('habit-form').addEventListener('submit', (e) => { 
    e.preventDefault(); 
    
    // Ensure the habits array exists
    if (!gardenData.habits) {
        gardenData.habits = [];
    }

    const newHabit = {
        id: Date.now(), 
        title: document.getElementById('habit-title').value, 
        type: document.getElementById('habit-type').value, 
        history: {}
    };

    gardenData.habits.push(newHabit); 

    saveData(); 
    renderHabits(); 
    document.getElementById('habit-dialog').close(); 
});


function openShopDialog() { 
    if(!checkAuth()) return; 
    const c=document.getElementById('shop-grid-container'); c.innerHTML=''; for(const [k,v] of Object.entries(plantTypes)){ if(k==='basic')continue; const u=gardenData.unlockedPlants.includes(k); const d=document.createElement('div'); d.className=`shop-item ${u?'unlocked':''}`; d.innerHTML=`<span class="shop-price">${v.price}🪙</span><span class="owned-badge">Owned</span><div style="font-size:2rem; color:${v.color}">✿</div><div>${v.name}</div>`; if(!u) d.onclick=()=>buyItem(k,v.price); c.appendChild(d); } document.getElementById('shop-dialog').showModal(); 
}
function buyItem(k,p){ if(gardenData.coins>=p){ gardenData.coins-=p; gardenData.unlockedPlants.push(k); saveData(); openShopDialog(); }else{alert("Need more coins!");} }

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('success')) {
        alert("🎉 Premium Activated! Please refresh to see changes.");
        window.history.replaceState({}, document.title, "/");
    }
    initAuth(); initAdSense();
    const c=document.getElementById('bg-particles-container'); for(let i=0;i<15;i++){ const e=document.createElement('div'); e.innerHTML=`<svg class="leaf-particle" viewBox="0 0 24 24"><path d="M17,8C8,10 5.9,16.17 3.82,21.34L5.71,22L6.66,19.7C8.5,15 13,12 19,10H17V8H17M21.9,9C17,7 15,3 13,3H11V5H13C15,5 17,7 17.76,8.3C14,7 11,4 9,2H7V4H9C11,4 13,6 13.4,7.7C11.5,6 9.5,5 7.5,5C5.5,5 3.5,6 1.5,8V10C3.5,8 5.5,7 7.5,7C9.5,7 11.5,8 13.1,9.3C11.5,10.3 9.8,11.5 8,13C4.5,15.7 1.8,19.4 2,22H4C3.8,19.6 6.4,16 9.6,13.5C11,12.3 12.5,11.3 14,10.6C14.8,12 15.5,13.5 16,15H18C17.5,13.3 16.7,11.6 15.7,10C20,11 22,14 22,14V12C22,12 20,10 21.9,9Z"/></svg>`; const s=e.firstChild; s.style.width=s.style.height=`${Math.random()*40+20}px`; s.style.left=`${Math.random()*100}%`; s.style.top=`${Math.random()*100}%`; c.appendChild(s); }
    const guestBtn = document.getElementById('guest-btn');

    if (guestBtn) {
        guestBtn.addEventListener('click', () => {
            document.getElementById('auth-dialog').close();
            localStorage.setItem('isGuest', 'true');
            localStorage.removeItem('token'); 
            if (!localStorage.getItem('guestData')) {
                const starterData = { 
                    coins: 0, 
                    unlockedPlants: ["basic"], 
                    plants: [], 
                    habits: [] 
                };
                localStorage.setItem('guestData', JSON.stringify(starterData));
            }
            loadData();
            showPage('home');
            document.getElementById('coin-count').innerText = "0 (Guest)";
        });
    }
});