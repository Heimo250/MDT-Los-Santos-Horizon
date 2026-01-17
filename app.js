console.log("SYSTEM STARTET... LADE MODULE");

// --- CONFIG ---
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

// --- LOGIN ---
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
            initDashboard();
            showPage('home');
        } else { alert("Falsche Daten."); }
    } catch (e) { alert("Login Fehler: " + e.message); }
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
    if (rank.includes("Command") || rank === "Attorney General") document.querySelectorAll('.command-only').forEach(el => el.classList.remove('hidden'));
    if (["Judge", "Chief Justice", "Attorney General"].includes(rank)) document.querySelectorAll('.judge-only').forEach(el => el.classList.remove('hidden'));
    if (rank === "Attorney General") document.querySelectorAll('.ia-only').forEach(el => el.classList.remove('hidden'));
}

// --- NAV ---
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    
    const target = document.getElementById('page-' + pageId);
    if (target) target.classList.remove('hidden');
    const nav = document.getElementById('nav-' + pageId);
    if (nav) nav.classList.add('active');
    
    if (pageId === 'home') initDashboard();
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
    document.querySelectorAll('.tag-btn').forEach(btn => btn.classList.remove('bg-blue-600', 'bg-red-600', 'text-white', 'shadow-lg'));
    document.querySelectorAll('input, textarea').forEach(i => i.value = '');
}

// --- PERSONEN ---
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
    const resDiv = document.getElementById('person-results');
    if (!resDiv) return;

    const term = input.value.trim().toLowerCase();
    resDiv.innerHTML = "<p class='text-slate-500'>Suche...</p>";

    try {
        let query = db.collection('persons');
        if (term.length > 0) query = query.where('searchKey', '>=', term).where('searchKey', '<=', term + '\uf8ff');
        
        const snap = await query.limit(10).get();
        resDiv.innerHTML = "";
        if (snap.empty) { resDiv.innerHTML = "<p class='text-slate-500 text-center'>Keine Treffer.</p>"; return; }

        snap.forEach(doc => {
            const p = doc.data();
            const isWanted = p.tags && p.tags.includes('Wanted');
            const border = isWanted ? "border-red-500" : "border-slate-600";
            resDiv.innerHTML += `
                <div class="glass-panel p-4 rounded border-l-4 ${border} hover:bg-slate-800 cursor-pointer group" onclick="viewProfile('${doc.id}')">
                    <div class="flex justify-between">
                        <div><h4 class="font-bold text-white">${p.firstname} ${p.lastname}</h4><p class="text-xs text-slate-400">Geb: ${p.dob}</p></div>
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
    
    document.getElementById('p-id-display').innerText = "ID: " + doc.id;
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

    const vList = document.getElementById('p-vehicle-list');
    if(vList) {
        vList.innerHTML = "<span class='text-xs text-slate-500 animate-pulse'>Suche...</span>";
        db.collection('vehicles').where('ownerId', '==', doc.id).get().then(snap => {
            vList.innerHTML = snap.empty ? "<span class='text-xs text-slate-500'>Keine KFZ</span>" : "";
            snap.forEach(vDoc => {
                const v = vDoc.data();
                vList.innerHTML += `<div class="bg-slate-900 p-2 rounded border border-slate-700 mb-1 flex justify-between"><span class="text-yellow-500 font-bold text-xs">${v.plate}</span><span class="text-[10px] text-slate-400">${v.model}</span></div>`;
            });
        });
    }

    const rList = document.getElementById('p-report-list');
    if(rList) {
        rList.innerHTML = "<span class='text-xs text-slate-500 animate-pulse'>Lade Akten...</span>";
        try {
            rList.innerHTML = "";
            const crSnap = await db.collection('criminal_records').where('suspectId', '==', doc.id).orderBy('timestamp', 'desc').get();
            if(!crSnap.empty) {
                rList.innerHTML += "<div class='text-[10px] text-red-500 font-bold mb-1'>STRAFAKTEN</div>";
                crSnap.forEach(rDoc => {
                    const r = rDoc.data();
                    rList.innerHTML += `<div class="bg-red-900/20 p-2 rounded border-l-2 border-red-500 mb-2 cursor-pointer" onclick="alert('${r.content.replace(/\n/g, "\\n")}')"><div class="text-[10px] text-slate-400">${r.date}</div><div class="text-xs text-white font-bold">${r.title}</div></div>`;
                });
            }
            const rSnap = await db.collection('reports').orderBy('timestamp', 'desc').limit(50).get();
            let found = false;
            rSnap.forEach(rDoc => {
                const r = rDoc.data();
                if ((r.subject && r.subject.includes(p.lastname)) || (r.content && r.content.includes(p.lastname))) {
                    if(!found) { rList.innerHTML += "<div class='text-[10px] text-blue-500 font-bold mb-1 mt-2'>BERICHTE</div>"; found=true; }
                    rList.innerHTML += `<div class="bg-slate-900 p-2 rounded border-l-2 border-blue-500 mb-1 cursor-pointer" onclick="alert('${r.content.replace(/\n/g, "\\n")}')"><div class="text-[10px] text-slate-400">${r.deptPrefix}</div><div class="text-xs text-slate-300 truncate">${r.subject}</div></div>`;
                }
            });
            if(crSnap.empty && !found) rList.innerHTML = "<span class='text-xs text-slate-500'>Keine Einträge.</span>";
        } catch(e) { console.error(e); }
    }
}

// --- VEHICLES ---
async function liveSearchOwner(query) {
    const dropdown = document.getElementById('owner-dropdown');
    if (!query || query.length < 2) { dropdown.classList.add('hidden'); return; }
    try {
        const snap = await db.collection('persons').where('searchKey', '>=', query.toLowerCase()).where('searchKey', '<=', query.toLowerCase() + '\uf8ff').limit(5).get();
        dropdown.innerHTML = "";
        dropdown.classList.remove('hidden');
        dropdown.style.zIndex = "100";

        if (snap.empty) { dropdown.innerHTML = "<div class='p-2 text-xs text-slate-500'>Nichts gefunden</div>"; return; }
        snap.forEach(doc => {
            const p = doc.data();
            const div = document.createElement('div');
            div.className = "p-2 hover:bg-slate-700 cursor-pointer text-xs bg-slate-900 text-white border-b border-slate-700";
            div.innerText = `${p.firstname} ${p.lastname}`;
            div.onclick = () => {
                document.getElementById('v-owner-id').value = doc.id;
                document.getElementById('selected-owner-display').innerText = `Halter: ${p.firstname} ${p.lastname}`;
                dropdown.classList.add('hidden');
            };
            dropdown.appendChild(div);
        });
    } catch(e) { console.error(e); }
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
    if (term.length === 0) { div.innerHTML = "<p class='text-slate-500 text-center'>Kennzeichen eingeben...</p>"; return; }

    try {
        const snap = await db.collection('vehicles').where('plate', '>=', term).where('plate', '<=', term + '\uf8ff').limit(10).get();
        div.innerHTML = "";
        if (snap.empty) { div.innerHTML = "<p class='text-slate-500 text-center'>Kein Fahrzeug.</p>"; return; }

        for (const doc of snap.docs) {
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
                    <p class="text-xs text-blue-400 mt-2 cursor-pointer" onclick="showPage('persons'); setTimeout(() => {document.getElementById('search-person-input').value='${ownerName.split(' ')[1]||''}'; searchPerson()}, 500)">👤 ${ownerName}</p>
                </div>`;
        }
    } catch (e) { console.error(e); }
}

// --- REPORTS ---
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
        reportId: id, deptPrefix: id.split('-')[0], subject: subj, content,
        author: currentUser.username, rank: currentUser.rank,
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

// --- LISTENERS ---
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
                    <td class="text-right p-4"><button onclick="showPage('persons'); setTimeout(() => { document.getElementById('search-person-input').value = '${p.lastname}'; searchPerson(); }, 500);" class="text-xs bg-slate-700 px-3 py-1 rounded">Akte</button></td>
                </tr>`;
        });
    });
}

// --- EMPLOYEES & LAWS ---
const LAWS = [
    { id: "§1", name: "Speeding", price: 500, jail: 0 },
    { id: "§2", name: "Körperverletzung", price: 2500, jail: 10 },
    { id: "§3", name: "Mord", price: 50000, jail: 120 },
];
let cart = [];

function loadLaws() {
    document.getElementById('law-list').innerHTML = LAWS.map(l => `
        <div class="p-2 hover:bg-slate-700 cursor-pointer flex justify-between text-xs" onclick="addToCart('${l.id}')"><span>${l.name}</span> <span class="text-green-400">$${l.price}</span></div>`).join('');
}
function addToCart(id) { cart.push(LAWS.find(l => l.id === id)); renderCart(); }
function renderCart() {
    document.getElementById('calc-cart').innerHTML = cart.map((c, i) => `<div class="flex justify-between text-xs p-1 border-b border-slate-700"><span>${c.name}</span> <button onclick="cart.splice(${i},1);renderCart()" class="text-red-500">x</button></div>`).join('');
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
        list.innerHTML += `<div class="flex justify-between p-2 bg-slate-800/50 mb-1 rounded border border-slate-700 items-center"><div><span class="font-bold text-blue-400">${doc.id}</span> <span class="text-xs text-slate-500">(${u.rank})</span></div><button onclick="removeUser('${doc.id}')" class="text-red-500 text-xs">Entfernen</button></div>`;
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
async function removeUser(id) { if(confirm("Löschen?")) { await db.collection('users').doc(id).delete(); renderEmployeePanel(); } }

// --- SPECIAL DEPARTMENTS ---
async function loadCourtRecords() {
    const list = document.getElementById('court-record-list');
    if(!list) return;
    const snap = await db.collection('court_records').orderBy('timestamp', 'desc').get();
    list.innerHTML = "";
    snap.forEach(doc => {
        const c = doc.data();
        list.innerHTML += `<div class="glass-panel p-4 border-l-4 ${c.status==='OPEN' ? 'border-green-500' : 'border-slate-600'}"><span class="font-bold text-purple-400">${c.title}</span> <span class="text-xs bg-slate-900 px-2 rounded">${c.status}</span><p class="text-xs text-slate-400 mt-2">${c.decision ? c.decision.substring(0,100) : ''}...</p><button onclick="openCourtModal('${doc.id}')" class="text-xs mt-2 text-purple-400 underline">Bearbeiten</button></div>`;
    });
}
function openCourtModal() { document.getElementById('modal-court').classList.remove('hidden'); }
async function saveCourtRecord() {
    await db.collection('court_records').add({ title: document.getElementById('c-title').value, decision: document.getElementById('c-decision').value, status: document.getElementById('c-status').value, judge: currentUser.username, timestamp: firebase.firestore.FieldValue.serverTimestamp() });
    alert("Gespeichert."); closeModal(); loadCourtRecords();
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
    await db.collection('internal_affairs').add({ target_officer: document.getElementById('ia-target').value, reason: document.getElementById('ia-reason').value, creator: currentUser.username, timestamp: firebase.firestore.FieldValue.serverTimestamp() });
    alert("IA Fall angelegt."); closeModal(); loadIACases();
}

// --- NEW CRIMINAL RECORDS ---
async function liveSearchSuspectRecord(query) {
    const dropdown = document.getElementById('record-suspect-dropdown');
    if (!query || query.length < 2) { dropdown.classList.add('hidden'); return; }
    try {
        const snap = await db.collection('persons').where('searchKey', '>=', query.toLowerCase()).where('searchKey', '<=', query.toLowerCase() + '\uf8ff').limit(5).get();
        dropdown.innerHTML = "";
        dropdown.classList.remove('hidden');
        dropdown.style.zIndex = "9999"; 
        
        if (snap.empty) { dropdown.innerHTML = "<div class='p-3 text-xs text-slate-500'>Keine Person gefunden.</div>"; return; }
        snap.forEach(doc => {
            const p = doc.data();
            const div = document.createElement('div');
            div.className = "p-3 hover:bg-blue-600 cursor-pointer border-b border-slate-700 text-sm bg-slate-900 text-white font-bold flex justify-between";
            div.innerHTML = `<span>${p.firstname} ${p.lastname}</span> <span class="text-slate-400 font-mono text-xs">${p.dob}</span>`;
            div.onclick = () => selectSuspectForRecord(doc.id, `${p.firstname} ${p.lastname}`);
            dropdown.appendChild(div);
        });
    } catch (e) { console.error(e); }
}

function selectSuspectForRecord(id, name) {
    document.getElementById('record-suspect-dropdown').classList.add('hidden');
    document.getElementById('record-step-1').classList.add('hidden');
    document.getElementById('record-step-2').classList.remove('hidden');

    document.getElementById('record-suspect-name').innerText = name;
    document.getElementById('record-suspect-id').value = id;
    document.getElementById('record-signature').innerText = currentUser.username;
    
    const now = new Date();
    const isoString = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0,16);
    document.getElementById('record-time').value = isoString;
    const dateStr = now.toLocaleDateString('de-DE');
    const timeStr = now.toLocaleTimeString('de-DE', {hour: '2-digit', minute:'2-digit'});

    document.getElementById('record-content').value = `TATORT, DATUM UND UHRZEIT:\nPLZ ____, am ${dateStr} um ${timeStr} Uhr\n\nBESCHLAGNAHMTE GEGENSTÄNDE:\n- \n\nSACHVERHALT:\nWas ist passiert?:\n\n\nBETEILIGTE BEAMTE:\n- \n\nZEUGEN:\n/\n\nRECHTE VERLESEN:\nDurch ${currentUser.username} am ${dateStr} um ${timeStr} Uhr.\n\nVERMERKE:\n[ ] Kooperativ\n[ ] Nicht Kooperativ`;
}

function resetRecordForm() {
    document.getElementById('record-step-2').classList.add('hidden');
    document.getElementById('record-step-1').classList.remove('hidden');
    document.getElementById('record-suspect-search').value = "";
    document.getElementById('record-title').value = "";
}

async function saveCriminalRecord() {
    const suspectId = document.getElementById('record-suspect-id').value;
    const suspectName = document.getElementById('record-suspect-name').innerText;
    const title = document.getElementById('record-title').value;
    const content = document.getElementById('record-content').value;
    const timeVal = document.getElementById('record-time').value;

    if (!title || content.length < 10) return alert("Bitte ausfüllen.");

    try {
        await db.collection('criminal_records').add({
            suspectId, suspectName, title, content,
            date: timeVal, officer: currentUser.username, officerRank: currentUser.rank, department: currentUser.department,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        alert("Akte angelegt.");
        resetRecordForm();
    } catch (e) { alert("Fehler: " + e.message); }
}

// ==========================================
// 11. DASHBOARD / BOLO SYSTEM (LIVE)
// ==========================================

// Wird beim Starten aufgerufen, um den Live-Listener zu aktivieren
let boloUnsubscribe = null;

function initDashboard() {
    // Falls schon ein Listener läuft, stoppen (verhindert doppelte Einträge)
    if(boloUnsubscribe) boloUnsubscribe();

    const list = document.getElementById('bolo-list');
    if(!list) return;

    // UI Update Name
    if(currentUser) document.getElementById('dash-user-name').innerText = currentUser.username;

    // LIVE VERBINDUNG zur Datenbank
    boloUnsubscribe = db.collection('bolos').orderBy('timestamp', 'desc').limit(20)
        .onSnapshot(snapshot => {
            list.innerHTML = "";
            
            if(snapshot.empty) {
                list.innerHTML = "<div class='text-center text-slate-600 py-10 italic'>Keine aktiven Meldungen. Ruhige Schicht! ☕</div>";
                return;
            }

            snapshot.forEach(doc => {
                const b = doc.data();
                
                // Farben je nach Priorität
                let borderClass = "border-blue-500";
                let bgClass = "bg-slate-800/50";
                let icon = "ℹ️";
                
                if (b.priority === 'high') {
                    borderClass = "border-red-600";
                    bgClass = "bg-red-900/20";
                    icon = "🚨";
                } else if (b.priority === 'warn') {
                    borderClass = "border-yellow-500";
                    bgClass = "bg-yellow-900/10";
                    icon = "⚠️";
                }

                // Lösch-Button nur für den Ersteller oder Command
                const canDelete = (currentUser.username === b.author || currentUser.rank.includes('Command') || currentUser.rank === 'Attorney General');
                const deleteBtn = canDelete ? `<button onclick="deleteBOLO('${doc.id}')" class="text-slate-500 hover:text-red-500 ml-3" title="Löschen">✕</button>` : '';

                const time = b.timestamp ? b.timestamp.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '';

                list.innerHTML += `
                    <div class="glass-panel p-3 rounded border-l-4 ${borderClass} ${bgClass} flex gap-3 relative animate-fadeIn">
                        <div class="text-2xl pt-1">${icon}</div>
                        <div class="flex-1">
                            <div class="flex justify-between items-start">
                                <h4 class="font-bold text-slate-200 text-sm">${b.title}</h4>
                                <div class="flex items-center">
                                    <span class="text-[10px] font-mono text-slate-400 mr-2">${time} Uhr</span>
                                    ${deleteBtn}
                                </div>
                            </div>
                            <p class="text-xs text-slate-300 mt-1 whitespace-pre-wrap">${b.content}</p>
                            <p class="text-[10px] text-slate-500 mt-2 text-right">Meldung von: ${b.author}</p>
                        </div>
                    </div>`;
            });
        });
}

async function saveBOLO() {
    const title = document.getElementById('bolo-title').value;
    const content = document.getElementById('bolo-content').value;
    const priority = document.getElementById('bolo-priority').value;

    if(!title || !content) return alert("Bitte Betreff und Text eingeben.");

    try {
        await db.collection('bolos').add({
            title, content, priority,
            author: currentUser.username,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Felder leeren
        document.getElementById('bolo-title').value = "";
        document.getElementById('bolo-content').value = "";
    } catch(e) { console.error(e); }
}

async function deleteBOLO(id) {
    if(confirm("Diese Meldung löschen?")) {
        await db.collection('bolos').doc(id).delete();
    }
}

console.log("SYSTEM GELADEN: ENDE");
