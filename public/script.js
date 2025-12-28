/* CONFIGURATION */
const CONFIG = {
    // Put your AdSense ID here if you have one
    ADSENSE_CLIENT_ID: "ca-pub-YOUR_ID_HERE"
};

const MAX_FREE_ITEMS = 3;
let token = null; 
let gardenData = { coins: 0, unlockedPlants: ["basic"], plants: [], habits: [] };
let isPremiumUser = false; // Tracks if user paid
let isDeleteMode = false; let editingPlantId = null; let tempChecklist = []; let selectedPlantType = "basic"; let isRegistering = false;

const plantTypes = { "basic": { name: "Basic Leaf", price: 0, color: "var(--p-leaf-light)" }, "sun": { name: "Sunflower", price: 10, color: "var(--p-flower)" }, "rose": { name: "Wild Rose", price: 20, color: "var(--p-rose)" }, "cactus":{ name: "Cactus", price: 30, color: "var(--p-cactus)" } };

/* --- AUTH & API --- */
function initAuth() {
    const storedToken = localStorage.getItem('garden_token');
    if(storedToken) {
        token = storedToken;
        loadData();
    } else {
        document.getElementById('auth-dialog').showModal();
    }
}
function toggleAuthMode() { isRegistering = !isRegistering; document.getElementById('auth-title').innerText = isRegistering ? "Create Account" : "Login to Garden"; document.getElementById('auth-submit-btn').innerText = isRegistering ? "Register" : "Login"; document.getElementById('auth-toggle-text').innerText = isRegistering ? "Already have an account? Login" : "New here? Create Account"; }

// --- FETCH WRAPPER (This is the critical fix) ---
async function apiCall(endpoint, method, body = null) {
    const headers = { 'Content-Type': 'application/json' };
    if(token) headers['x-access-token'] = token;
    
    try {
        // NOTE: We use relative path '/api/...' so it works on Localhost AND Render
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
            isPremiumUser = res.isPremium; // Capture status
            updatePremiumUI();
            document.getElementById('auth-dialog').close();
            renderAll();
            updateCoinDisplay();
        }
    }
});

function logout() { localStorage.removeItem('garden_token'); location.reload(); }

async function saveData() {
    updateCoinDisplay();
    await apiCall('sync', 'POST', gardenData);
}
async function loadData() {
    const res = await apiCall('sync', 'GET');
    if(res) { 
        gardenData = res; 
        isPremiumUser = res.isPremium;
        updatePremiumUI();
        renderAll(); 
        updateCoinDisplay(); 
    }
}

/* --- PREMIUM UI LOGIC --- */
function updatePremiumUI() {
    const btn = document.querySelector('.premium-btn-header');
    if (isPremiumUser) {
        btn.innerText = "⭐ Manage Sub";
        btn.onclick = openCustomerPortal;
        btn.style.background = "linear-gradient(135deg, #E91E63, #9C27B0)";
    } else {
        btn.innerText = "👑 Go Premium";
        btn.onclick = startCheckout;
        btn.style.background = "linear-gradient(135deg, #FFD700, #FFA000)";
    }
}
async function startCheckout() {
    const res = await apiCall('create-checkout-session', 'POST');
    if (res && res.url) window.location.href = res.url;
    else alert("Checkout Error. Check server console.");
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
const toLocalISO = (date) => { const offset = date.getTimezoneOffset() * 60000; return new Date(date.getTime() - offset).toISOString().split('T')[0]; };

// Plants
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

// Habits
function getHabitStats(history) {
    let curr = 0; for(let i=0; i<365; i++) { const d=new Date(); d.setDate(new Date().getDate()-i); const k=toLocalISO(d); if(i===0 && !history[k]) continue; if(history[k]) curr++; else break; }
    let max=0; let t=1; const keys=Object.keys(history).sort(); if(keys.length>0) { max=1; for(let i=1;i<keys.length;i++){ if((new Date(keys[i])-new Date(keys[i-1]))/(86400000)===1) t++; else t=1; if(t>max) max=t; }}
    return { current: curr, max: max, total: keys.length };
}
function renderHabits() {
    const container = document.getElementById('habits-container'); container.innerHTML = ''; const dates=[]; for(let i=6; i>=0; i--){ const d=new Date(); d.setDate(new Date().getDate()-i); dates.push(toLocalISO(d)); }
    gardenData.habits.forEach(habit => {
        const stats = getHabitStats(habit.history); const row = document.createElement('div'); row.className = 'habit-row'; if(isDeleteMode) row.onclick = () => deleteHabit(habit.id);
        let svg = `<path d="M0,70 Q100,20 200,70 T400,70 T600,70 T800,70" fill="none" stroke="#5D4037" stroke-width="4"/>`;
        dates.forEach((d, i) => { const done=habit.history[d]; const x=50+(i*110); const y=i%2===0?80:60; svg+=`<g class="fruit-group" onclick="toggleHabit('${habit.id}', '${d}')"><line x1="${x}" y1="70" x2="${x}" y2="${y}" stroke="#5D4037" stroke-width="2"/><circle cx="${x}" cy="${y}" r="14" fill="${habit.type==='tomato'?'var(--f-tomato)':'var(--f-grape)'}" class="fruit-circle ${done?'fruit-collected':'fruit-uncollected'}" /><text x="${x}" y="${y+30}" class="day-label">${d.slice(8,10)}</text></g>`; });
        row.innerHTML = `<div class="habit-info"><h3 class="habit-title">${habit.title}</h3><div class="habit-stats"><div class="stat-item"><span class="${stats.current>0?'fire-active':''}">🔥</span> Streak: <span class="stat-val">${stats.current}</span></div><div class="stat-item"><span>🏆</span> Best: <span class="stat-val">${stats.max}</span></div><div class="stat-item"><span>📅</span> Total: <span class="stat-val">${stats.total}</span></div></div></div><div class="vine-container"><svg class="vine-svg" viewBox="0 0 800 140" preserveAspectRatio="xMidYMid meet">${svg}</svg></div>`;
        container.appendChild(row);
    });
}

// Logic
function showPage(id) { document.querySelectorAll('.page-section').forEach(s=>s.classList.remove('active')); document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active')); document.getElementById(id).classList.add('active'); if(isDeleteMode) toggleDeleteMode(); }
function toggleDeleteMode() { isDeleteMode=!isDeleteMode; document.body.classList.toggle('delete-mode', isDeleteMode); document.getElementById('delete-mode-btn').classList.toggle('delete-mode-active', isDeleteMode); document.getElementById('delete-mode-btn-2').classList.toggle('delete-mode-active', isDeleteMode); renderHabits(); }

// LIMIT CHECK ADDED HERE
function openPlantDialog(id=null) { 
    if(isDeleteMode)return; 
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

// LIMIT CHECK ADDED HERE
function openHabitDialog() { 
    if(isDeleteMode)return; 
    if(!isPremiumUser && gardenData.habits.length>=MAX_FREE_ITEMS){document.getElementById('premium-dialog').showModal();return;} 
    document.getElementById('habit-form').reset(); document.getElementById('habit-dialog').showModal(); 
}
document.getElementById('habit-form').addEventListener('submit', (e)=>{ e.preventDefault(); gardenData.habits.push({id:Date.now(), title:document.getElementById('habit-title').value, type:document.getElementById('habit-type').value, history:{}}); saveData(); renderHabits(); document.getElementById('habit-dialog').close(); });
function toggleHabit(id,d){ if(isDeleteMode)return; const h=gardenData.habits.find(x=>x.id==id); if(h){ if(h.history[d]){ delete h.history[d]; gardenData.coins=Math.max(0,gardenData.coins-1); } else { h.history[d]=true; gardenData.coins++; } saveData(); renderHabits(); } }
function deleteHabit(id){ gardenData.habits=gardenData.habits.filter(h=>h.id!==id); saveData(); renderHabits(); }

function openShopDialog() { const c=document.getElementById('shop-grid-container'); c.innerHTML=''; for(const [k,v] of Object.entries(plantTypes)){ if(k==='basic')continue; const u=gardenData.unlockedPlants.includes(k); const d=document.createElement('div'); d.className=`shop-item ${u?'unlocked':''}`; d.innerHTML=`<span class="shop-price">${v.price}🪙</span><span class="owned-badge">Owned</span><div style="font-size:2rem; color:${v.color}">✿</div><div>${v.name}</div>`; if(!u) d.onclick=()=>buyItem(k,v.price); c.appendChild(d); } document.getElementById('shop-dialog').showModal(); }
function buyItem(k,p){ if(gardenData.coins>=p){ gardenData.coins-=p; gardenData.unlockedPlants.push(k); saveData(); openShopDialog(); }else{alert("Need more coins!");} }

document.addEventListener('DOMContentLoaded', () => {
    // Check if coming back from Stripe
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('success')) {
        alert("🎉 Premium Activated! Please refresh to see changes.");
        window.history.replaceState({}, document.title, "/");
    }
    initAuth(); initAdSense();
    const c=document.getElementById('bg-particles-container'); for(let i=0;i<15;i++){ const e=document.createElement('div'); e.innerHTML=`<svg class="leaf-particle" viewBox="0 0 24 24"><path d="M17,8C8,10 5.9,16.17 3.82,21.34L5.71,22L6.66,19.7C8.5,15 13,12 19,10H17V8H17M21.9,9C17,7 15,3 13,3H11V5H13C15,5 17,7 17.76,8.3C14,7 11,4 9,2H7V4H9C11,4 13,6 13.4,7.7C11.5,6 9.5,5 7.5,5C5.5,5 3.5,6 1.5,8V10C3.5,8 5.5,7 7.5,7C9.5,7 11.5,8 13.1,9.3C11.5,10.3 9.8,11.5 8,13C4.5,15.7 1.8,19.4 2,22H4C3.8,19.6 6.4,16 9.6,13.5C11,12.3 12.5,11.3 14,10.6C14.8,12 15.5,13.5 16,15H18C17.5,13.3 16.7,11.6 15.7,10C20,11 22,14 22,14V12C22,12 20,10 21.9,9Z"/></svg>`; const s=e.firstChild; s.style.width=s.style.height=`${Math.random()*40+20}px`; s.style.left=`${Math.random()*100}%`; s.style.top=`${Math.random()*100}%`; c.appendChild(s); }
});