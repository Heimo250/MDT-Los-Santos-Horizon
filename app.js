console.log("SYSTEM STARTET...");

// --- 1. CONFIG ---
const firebaseConfig = {
    apiKey: "AIzaSyD6I01je_MrT7KzeFE7BD1IGc4amukK_6Q",
    authDomain: "mdt-system-c18ea.firebaseapp.com",
    projectId: "mdt-system-c18ea",
    storageBucket: "mdt-system-c18ea.firebasestorage.app",
    messagingSenderId: "548167432149",
    appId: "1:548167432149:web:be1a0154c825faca622f5c"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

let currentUser = null;
let selectedTags = [];
let currentReportFilter = 'ALL';

// --- 2. LOGIN ---
async function handleLogin() {
    const userVal = document.getElementById('login-user').value.trim();
    const passVal = document.getElementById('login-pass').value;

    if (!userVal || !passVal) return alert("Daten fehlen.");

    try {
        const doc = await db.collection('users').doc(userVal).get();
        if (doc.exists && doc.data().password === passVal) {
            currentUser = doc.data();
            currentUser.username = doc.id;
            
            document.getElementById('login-screen').classList.add('hidden');
            document.getElementById('current-user-name').innerText = currentUser.username;
            document.getElementById('current-rank').innerText = `${currentUser.rank}`;
            document.getElementById('user-avatar').innerText = currentUser.username.charAt(0).toUpperCase();

            applyTheme(currentUser.department);
            checkPermissions();
            startWantedListener();
            showPage('home');
        } else {
            alert("Falsche Daten.");
        }
    } catch (error) { alert("Login Fehler: " + error.message); }
}

function applyTheme(dept) {
    const header = document.getElementById('dept-header');
    const icon = document.querySelector('.header-icon');
    document.body.className = "flex h-screen text-sm"; 
    
    if (dept === "MARSHAL") {
        document.body.classList.add("theme-marshal");
        header.innerText = "MARSHAL SERVICE";
        header.classList.add("text-amber-500");
        icon.style.backgroundColor = "#d97706";
    } else if (dept === "DOJ") {
        document.body.classList.add("theme-doj");
        header.innerText = "DEPT. OF JUSTICE";
        header.classList.add("text-purple-500");
        icon.style.backgroundColor = "#9333ea";
    } else {
        header.innerText = "LSPD POLICE DEPT";
        icon.style.backgroundColor = "#3b82f6";
    }
}

function checkPermissions() {
    const rank = currentUser.rank;
    document.querySelectorAll('.judge-only, .ia-only, .command-only').forEach(el => el.classList.add('hidden'));

    if (rank.includes("Command") || rank === "Attorney General") 
        document.querySelectorAll('.command-only').forEach(el => el.classList.remove('hidden'));
    
    if (["Judge", "Chief Justice", "Attorney General"].includes(rank)) 
        document.querySelectorAll('.judge-only').forEach(el => el.classList.remove('hidden'));
    
    if (rank === "Attorney General") 
        document.querySelectorAll('.ia-only').forEach(el => el.classList.remove('hidden'));
}

// --- 3. UI ---
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    
    const target = document.getElementById('page-' + pageId);
    if (target) target.classList.remove('hidden');
    
    const nav = document.getElementById('nav-' + pageId);
    if (nav) nav.classList.add('active');

    if (pageId === 'reports') loadReports();
    if (pageId === 'employees') renderEmployeePanel();
    if (pageId === 'calculator') loadLaws();
    if (pageId === 'court') loadCourtRecords();
    if (pageId === 'ia') loadIACases();
}

function closeModal() {
    ['modal-person', 'modal-vehicle', 'modal-report', 'modal-court', 'modal-ia'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
    selectedTags = [];
    document.querySelectorAll('.tag-btn').forEach(btn => {
        btn.classList.remove('bg-blue-600', 'bg-red-600', 'text-white', 'shadow-lg');
    });
    document.querySelectorAll('input, textarea').forEach(i => i.value = '');
}

// --- 4. PERSONEN ---
function toggleTag(btn) {
    const tag = btn.getAttribute('data-tag');
    if (selectedTags.includes(tag)) {
        selectedTags = selectedTags.filter(t => t !== tag);
        btn.classList.remove('bg-blue-600', 'bg-red-600', 'text-white', 'shadow-lg');
    } else {
        selectedTags.push(tag);
        if (tag === 'Wanted') btn.classList.add('bg-red-600', 'text-white', 'shadow-lg');
        else btn.classList.add('bg-blue-600', 'text-white', 'shadow-lg');
    }
}

async function searchPerson() {
    const input = document.getElementById('search-person-input');
    const resultsDiv = document.getElementById('person-results');
    if (!resultsDiv) return;

    const term = input.value.trim().toLowerCase();
    resultsDiv.innerHTML = "<p class='text-slate-500'>Suche...</p>";

    try {
        let query = db.collection('persons');
        if (term.length > 0) {
            query = query.where('searchKey', '>=', term).where('searchKey', '<=', term + '\uf8ff');
        }

        const snapshot = await query.limit(10).get();
        resultsDiv.innerHTML = "";

        if (snapshot.empty) {
            resultsDiv.innerHTML = "<p class='text-slate-500 col-span-3 text-center'>Keine Treffer.</p>";
            return;
        }

        snapshot.forEach(doc => {
            const p = doc.data();
            const isWanted = p.tags && p.tags.includes('Wanted');
            const borderClass = isWanted ? "border-red-500" : "border-slate-600";
            
            resultsDiv.innerHTML += `
                <div class="glass-panel p-4 rounded border-l-4 ${borderClass} hover:bg-slate-800 transition cursor-pointer group" onclick="viewProfile('${doc.id}')">
                    <div class="flex justify-between items-start">
                        <div>
                            <h4 class="font-bold text-lg text-white">${p.firstname} ${p.lastname}</h4>
                            <p class="text-xs text-slate-400">Geb: ${p.dob}</p>
                        </div>
                        ${isWanted ? '🚨' : ''}
                    </div>
                </div>`;
        });
    } catch (e) { console.error(e); if(e.code==='failed-precondition') alert("Index fehlt! Siehe Konsole."); }
}

async function savePerson() {
    const firstname = document.getElementById('p-firstname').value;
    const lastname = document.getElementById('p-lastname').value;
    if(!lastname) return alert("Name fehlt.");
    
    const docId = `${firstname}_${lastname}`.toLowerCase().replace(/\s/g, '');
    const pData = {
        firstname, lastname,
        searchKey: lastname.toLowerCase(), 
        dob: document.getElementById('p-dob').value,
        height: document.getElementById('p-height').value,
        tags: selectedTags,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    try {
        await db.collection('persons').doc(docId).set(pData, { merge: true });
        alert("Gespeichert.");
        closeModal();
        document.getElementById('search-person-input').value = lastname;
        searchPerson(); 
    } catch (e) { alert(e.message); }
}

async function viewProfile(personId) {
    const modal = document.getElementById('modal-person');
    if(modal) modal.classList.remove('hidden');
    
    const doc = await db.collection('persons').doc(personId).get();
    if (!doc.exists) return;
    const p = doc.data();
    
    document.getElementById('p-firstname').value = p.firstname;
    document.getElementById('p-lastname').value = p.lastname;
    document.getElementById('p-dob').value = p.dob;
    document.getElementById('p-height').value = p.height;
    
    selectedTags = p.tags || []; 
    document.querySelectorAll('.tag-btn').forEach(btn => {
        const tag = btn.getAttribute('data-tag');
        btn.classList.remove('bg-blue-600', 'bg-red-600', 'text-white', 'shadow-lg');
        if (selectedTags.includes(tag)) {
            if (tag === 'Wanted') btn.classList.add('bg-red-600', 'text-white', 'shadow-lg');
            else btn.classList.add('bg-blue-600', 'text-white', 'shadow-lg');
        }
    });
}

// --- 5. FAHRZEUGE ---
async function liveSearchOwner(query) {
    const dropdown = document.getElementById('owner-dropdown');
    
    // Wenn weniger als 2 Zeichen getippt: Ausblenden
    if (!query || query.length < 2) {
        dropdown.classList.add('hidden');
        dropdown.innerHTML = "";
        return;
    }

    try {
        // FIX: Wir suchen jetzt im 'searchKey' (kleingeschrieben), damit er "Muster" auch findet, wenn man "muster" tippt.
        const snapshot = await db.collection('persons')
            .where('searchKey', '>=', query.toLowerCase())
            .where('searchKey', '<=', query.toLowerCase() + '\uf8ff')
            .limit(5).get();
        
        dropdown.innerHTML = "";
        dropdown.classList.remove('hidden');
        
        if (snapshot.empty) {
            dropdown.innerHTML = "<div class='p-2 text-xs text-slate-500 bg-slate-800'>Keine Person gefunden</div>";
            return;
        }

        snapshot.forEach(doc => {
            const p = doc.data();
            const div = document.createElement('div');
            // Styling für die Liste
            div.className = "p-3 hover:bg-blue-600 cursor-pointer border-b border-slate-700 text-xs bg-slate-900 text-white font-bold";
            div.innerText = `${p.firstname} ${p.lastname}`;
            
            // Klick auf einen Namen
            div.onclick = () => {
                document.getElementById('v-owner-id').value = doc.id;
                document.getElementById('selected-owner-display').innerText = `Besitzer gewählt: ${p.firstname} ${p.lastname}`;
                document.getElementById('selected-owner-display').className = "text-green-400 font-bold text-sm mt-2";
                
                // Dropdown schließen und Suchfeld leeren
                dropdown.classList.add('hidden');
                document.getElementById('v-owner-search').value = ""; 
            };
            dropdown.appendChild(div);
        });
    } catch (e) {
        console.error("Owner Search Error:", e);
    }
}
async function saveVehicle() {
    const plate = document.getElementById('v-plate').value.toUpperCase();
    if (!plate) return alert("Kennzeichen fehlt.");
    
    await db.collection('vehicles').doc(plate).set({
        plate,
        model: document.getElementById('v-model').value,
        color: document.getElementById('v-color').value,
        ownerId: document.getElementById('v-owner-id').value,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    alert("Fahrzeug registriert.");
    closeModal();
}

async function searchVehicle() {
    const input = document.getElementById('search-vehicle-input');
    const div = document.getElementById('vehicle-results');
    if (!input || !div) return;

    const term = input.value.trim().toUpperCase();
    if (term.length === 0) {
        div.innerHTML = "<p class='text-slate-500 col-span-3 text-center'>Kennzeichen eingeben...</p>";
        return;
    }

    try {
        const snapshot = await db.collection('vehicles')
            .where('plate', '>=', term).where('plate', '<=', term + '\uf8ff')
            .limit(10).get();
            
        div.innerHTML = "";
        if (snapshot.empty) {
            div.innerHTML = "<p class='text-slate-500 col-span-3 text-center'>Kein Fahrzeug.</p>";
            return;
        }

        for (const doc of snapshot.docs) {
            const v = doc.data();
            let ownerName = "Unbekannt";
            if(v.ownerId) {
                const oDoc = await db.collection('persons').doc(v.ownerId).get();
                if(oDoc.exists) ownerName = `${oDoc.data().firstname} ${oDoc.data().lastname}`;
            }

            div.innerHTML += `
                <div class="glass-panel p-4 rounded border-l-4 border-yellow-500 hover:bg-slate-800 transition">
                    <span class="bg-yellow-500 text-black font-bold px-2 text-sm">${v.plate}</span>
                    <span class="text-xs text-slate-400 ml-2">${v.model}</span>
                    <p class="text-xs text-blue-400 mt-2 cursor-pointer" onclick="showPage('persons'); setTimeout(() => {document.getElementById('search-person-input').value='${ownerName.split(' ')[1]||''}'; searchPerson()}, 500)">
                        👤 ${ownerName}
                    </p>
                </div>`;
        }
    } catch (e) { console.error(e); }
}

// --- 6. REPORTS ---
async function openReportModal() {
    const prefix = currentUser.department === "MARSHAL" ? "LSMS" : "LSPD";
    const visual = document.getElementById('report-card-visual');
    const header = document.getElementById('r-header-title');
    
    if(prefix === "LSMS") {
        visual.className = "glass-panel p-8 w-[800px] border-t-4 border-amber-500";
        header.classList.add('text-amber-500');
    } else {
        visual.className = "glass-panel p-8 w-[800px] border-t-4 border-blue-500";
        header.classList.add('text-blue-500');
    }

    const snap = await db.collection('reports').get();
    const id = `${prefix}-${String(snap.size + 1000).padStart(4, '0')}`;
    
    document.getElementById('r-id-preview').innerText = id;
    document.getElementById('r-officers').value = currentUser.username;
    document.getElementById('r-content').value = "SITUATION:\n\n\nMASSNAHMEN:\n\n\nERGEBNIS:"; 
    document.getElementById('modal-report').classList.remove('hidden');
}

async function saveReport() {
    const id = document.getElementById('r-id-preview').innerText;
    const content = document.getElementById('r-content').value;
    const subj = document.getElementById('r-subject').value;
    
    if(!subj) return alert("Betreff fehlt.");

    await db.collection('reports').doc(id).set({
        reportId: id,
        deptPrefix: id.split('-')[0],
        subject: subj,
        content,
        author: currentUser.username,
        rank: currentUser.rank,
        location: document.getElementById('r-location').value,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    alert("Archiviert.");
    closeModal();
    loadReports();
}

async function loadReports() {
    const list = document.getElementById('report-list');
    const query = db.collection('reports').orderBy('timestamp', 'desc').limit(20);
    const snap = await query.get();
    list.innerHTML = "";
    if(document.getElementById('stat-report-count')) document.getElementById('stat-report-count').innerText = snap.size; 

    snap.forEach(doc => {
        const r = doc.data();
        if (currentReportFilter !== 'ALL' && r.deptPrefix !== currentReportFilter) return;
        const color = r.deptPrefix === "LSMS" ? "border-amber-600 text-amber-500" : "border-blue-600 text-blue-400";

        list.innerHTML += `
            <div class="glass-panel p-3 rounded border-l-4 ${color.split(' ')[0]} hover:bg-slate-800 cursor-pointer">
                 <div class="flex justify-between">
                     <span class="text-xs font-bold ${color.split(' ')[1]} border border-current px-1 rounded">${r.deptPrefix}</span>
                     <span class="text-xs text-slate-500">${r.timestamp ? r.timestamp.toDate().toLocaleDateString() : ''}</span>
                 </div>
                 <h4 class="font-bold text-slate-200">${r.subject}</h4>
                 <p class="text-xs text-slate-400">Von: ${r.author} (${r.rank})</p>
            </div>`;
    });
}

function filterReports(filter) {
    currentReportFilter = filter;
    loadReports();
}

// --- 7. LISTENERS ---
function startWantedListener() {
    db.collection('persons').where('tags', 'array-contains', 'Wanted').onSnapshot(snap => {
        const tbody = document.getElementById('wanted-list-body');
        if(document.getElementById('stat-wanted-count')) document.getElementById('stat-wanted-count').innerText = snap.size;
        if(!tbody) return;
        tbody.innerHTML = "";
        
        snap.forEach(doc => {
            const p = doc.data();
            tbody.innerHTML += `
                <tr class="hover:bg-slate-800/50 transition border-b border-slate-800">
                    <td class="p-4 font-bold text-white">${p.firstname} ${p.lastname}</td>
                    <td class="text-red-400 font-mono text-xs">GESUCHT</td>
                    <td class="text-right p-4">
                        <button onclick="showPage('persons'); setTimeout(() => { document.getElementById('search-person-input').value = '${p.lastname}'; searchPerson(); }, 500);" 
                        class="text-xs bg-slate-700 px-3 py-1 rounded">Akte</button>
                    </td>
                </tr>`;
        });
    });
}

// --- 8. EMPLOYEES & LAWS ---
const LAWS = [
    { id: "§1", name: "Speeding", price: 500, jail: 0 },
    { id: "§2", name: "Körperverletzung", price: 2500, jail: 10 },
    { id: "§3", name: "Mord", price: 50000, jail: 120 },
];
let cart = [];

function loadLaws() {
    document.getElementById('law-list').innerHTML = LAWS.map(l => `
        <div class="p-2 hover:bg-slate-700 cursor-pointer flex justify-between text-xs" onclick="addToCart('${l.id}')">
            <span>${l.name}</span> <span class="text-green-400">$${l.price}</span>
        </div>
    `).join('');
}

function addToCart(id) {
    cart.push(LAWS.find(l => l.id === id));
    renderCart();
}

function renderCart() {
    document.getElementById('calc-cart').innerHTML = cart.map((c, i) => `
        <div class="flex justify-between text-xs p-1 border-b border-slate-700">
            <span>${c.name}</span> <button onclick="cart.splice(${i},1);renderCart()" class="text-red-500">x</button>
        </div>
    `).join('');
    updateTotal();
}

function updateTotal() {
    let sum = cart.reduce((a, b) => a + b.price, 0);
    let jail = cart.reduce((a, b) => a + b.jail, 0);
    const perc = document.getElementById('calc-percent').value / 100;
    document.getElementById('calc-total').innerText = "$" + (sum * perc).toFixed(0);
    document.getElementById('calc-jail').value = jail;
}

async function renderEmployeePanel() {
    const list = document.getElementById('employee-list');
    const snap = await db.collection('users').get();
    list.innerHTML = "";
    snap.forEach(doc => {
        const u = doc.data();
        list.innerHTML += `
            <div class="flex justify-between p-2 bg-slate-800/50 mb-1 rounded border border-slate-700 items-center">
                <div><span class="font-bold text-blue-400">${doc.id}</span> <span class="text-xs text-slate-500">(${u.rank})</span></div>
                <button onclick="removeUser('${doc.id}')" class="text-red-500 text-xs">Entfernen</button>
            </div>`;
    });
}

async function uiRegisterEmployee() {
    const u = document.getElementById('m-user').value;
    const p = document.getElementById('m-pass').value;
    const d = document.getElementById('m-dept').value;
    const r = document.getElementById('m-rank').value;
    if(!u || !p) return alert("Daten fehlen.");
    await db.collection('users').doc(u).set({ password: p, department: d, rank: r });
    alert("Angelegt.");
    renderEmployeePanel();
}

async function removeUser(id) {
    if(confirm("Löschen?")) {
        await db.collection('users').doc(id).delete();
        renderEmployeePanel();
    }
}

// --- 9. COURT & IA ---
async function loadCourtRecords() {
    const list = document.getElementById('court-record-list');
    if(!list) return;
    const snap = await db.collection('court_records').orderBy('timestamp', 'desc').get();
    list.innerHTML = "";
    snap.forEach(doc => {
        const c = doc.data();
        list.innerHTML += `
            <div class="glass-panel p-4 border-l-4 ${c.status==='OPEN' ? 'border-green-500' : 'border-slate-600'}">
                <span class="font-bold text-purple-400">${c.title}</span> <span class="text-xs bg-slate-900 px-2 rounded">${c.status}</span>
                <p class="text-xs text-slate-400 mt-2">${c.decision ? c.decision.substring(0,100) : ''}...</p>
                <button onclick="openCourtModal('${doc.id}')" class="text-xs mt-2 text-purple-400 underline">Bearbeiten</button>
            </div>`;
    });
}

function openCourtModal() { document.getElementById('modal-court').classList.remove('hidden'); }

async function saveCourtRecord() {
    await db.collection('court_records').add({
        title: document.getElementById('c-title').value,
        decision: document.getElementById('c-decision').value,
        status: document.getElementById('c-status').value,
        judge: currentUser.username,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    alert("Gespeichert.");
    closeModal();
    loadCourtRecords();
}

async function loadIACases() {
    if(currentUser.rank !== "Attorney General") return;
    const list = document.getElementById('ia-case-list');
    const snap = await db.collection('internal_affairs').orderBy('timestamp', 'desc').get();
    list.innerHTML = "";
    snap.forEach(doc => {
        const c = doc.data();
        list.innerHTML += `<div class="glass-panel p-4 border-l-4 border-red-600"><h4 class="font-bold text-red-500">${c.target_officer}</h4><p class="text-xs text-slate-300">${c.reason}</p></div>`;
    });
}

function openIAModal() { document.getElementById('modal-ia').classList.remove('hidden'); }

async function saveIACase() {
    await db.collection('internal_affairs').add({
        target_officer: document.getElementById('ia-target').value,
        reason: document.getElementById('ia-reason').value,
        creator: currentUser.username,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    alert("IA Fall angelegt.");
    closeModal();
    loadIACases();
}

console.log("APP JS ENDE ERREICHT");
