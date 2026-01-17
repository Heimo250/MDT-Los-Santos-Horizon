// ==========================================
// 1. CONFIG & INIT
// ==========================================
const firebaseConfig = {
    // FÜGE HIER DEINE DATEN EIN
      apiKey: "AIzaSyD6I01je_MrT7KzeFE7BD1IGc4amukK_6Q",
  authDomain: "mdt-system-c18ea.firebaseapp.com",
  projectId: "mdt-system-c18ea",
  storageBucket: "mdt-system-c18ea.firebasestorage.app",
  messagingSenderId: "548167432149",
  appId: "1:548167432149:web:be1a0154c825faca622f5c"
};

// Schutz gegen mehrfaches Initialisieren
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

// Globale Variablen
let currentUser = null;
let selectedTags = [];
let currentReportFilter = 'ALL';

// ==========================================
// 2. AUTHENTIFICATION & THEME
// ==========================================
async function handleLogin() {
    const userVal = document.getElementById('login-user').value.trim();
    const passVal = document.getElementById('login-pass').value;

    if (!userVal || !passVal) return alert("Zugangsdaten fehlen.");

    try {
        const doc = await db.collection('users').doc(userVal).get();
        if (doc.exists && doc.data().password === passVal) {
            currentUser = doc.data();
            currentUser.username = doc.id;
            
            // UI Setup
            document.getElementById('login-screen').classList.add('hidden');
            document.getElementById('current-user-name').innerText = currentUser.username;
            document.getElementById('current-rank').innerText = `${currentUser.rank} | ${currentUser.department}`;
            document.getElementById('user-avatar').innerText = currentUser.username.charAt(0).toUpperCase();

            // Theme anwenden
            applyTheme(currentUser.department);
            
            // Start-Logik
            checkPermissions();
            startWantedListener();
            showPage('home');
        } else {
            alert("Zugriff verweigert: Ungültige Daten.");
        }
    } catch (error) {
        console.error("Login Error:", error);
        alert("Datenbank-Verbindungsfehler.");
    }
}

function applyTheme(dept) {
    const body = document.body;
    const header = document.getElementById('dept-header');
    const icon = document.querySelector('.header-icon');

    body.className = "flex h-screen text-sm"; // Reset
    
    if (dept === "MARSHAL") {
        body.classList.add("theme-marshal");
        header.innerText = "SAN ANDREAS MARSHAL SERVICE";
        header.classList.add("text-amber-500");
        icon.style.backgroundColor = "#d97706";
    } else if (dept === "DOJ") {
        body.classList.add("theme-doj");
        header.innerText = "DEPARTMENT OF JUSTICE";
        header.classList.add("text-purple-500");
        icon.style.backgroundColor = "#9333ea";
    } else {
        // Default LSPD
        header.innerText = "LOS SANTOS POLICE DEPARTMENT";
        icon.style.backgroundColor = "#3b82f6";
    }
}

function checkPermissions() {
    const rank = currentUser.rank;
    const dept = currentUser.department;

    // Reset visibility
    document.querySelectorAll('.judge-only, .ia-only, .command-only').forEach(el => el.classList.add('hidden'));

    // Command Logic
    if (rank.includes("Command") || rank === "Attorney General" || rank === "Chief Justice") {
        document.querySelectorAll('.command-only').forEach(el => el.classList.remove('hidden'));
    }

    // Judge Logic
    if (["Judge", "Chief Justice", "Attorney General"].includes(rank)) {
        document.querySelectorAll('.judge-only').forEach(el => el.classList.remove('hidden'));
    }

    // IA Logic
    if (rank === "Attorney General") {
        document.querySelectorAll('.ia-only').forEach(el => el.classList.remove('hidden'));
    }
}

// ==========================================
// 3. NAVIGATION & UI
// ==========================================
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    
    const target = document.getElementById('page-' + pageId);
    const nav = document.getElementById('nav-' + pageId);
    
    if (target) target.classList.remove('hidden');
    if (nav) nav.classList.add('active');

    // Data Load Triggers
    if (pageId === 'reports') loadReports();
    if (pageId === 'employees') renderEmployeePanel();
    if (pageId === 'calculator') loadLaws();
    if (pageId === 'court') loadCourtRecords();
    if (pageId === 'ia') loadIACases();
}

function closeModal() {
    const modals = ['modal-person', 'modal-vehicle', 'modal-report', 'modal-court', 'modal-ia'];
    modals.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
    
    // Reset Tags
    selectedTags = [];
    document.querySelectorAll('.tag-btn').forEach(btn => {
        btn.classList.remove('bg-blue-600', 'bg-red-600', 'text-white', 'shadow-lg', 'border-transparent');
    });
    
    // Clear Inputs
    document.querySelectorAll('input, textarea').forEach(i => i.value = '');
}

// ==========================================
// 4. PERSONS & TAGS
// ==========================================
function toggleTag(btn) {
    const tag = btn.getAttribute('data-tag');
    if (selectedTags.includes(tag)) {
        selectedTags = selectedTags.filter(t => t !== tag);
        btn.classList.remove('bg-blue-600', 'bg-red-600', 'text-white', 'shadow-lg', 'border-transparent');
    } else {
        selectedTags.push(tag);
        if (tag === 'Wanted') {
            btn.classList.add('bg-red-600', 'text-white', 'shadow-lg', 'border-transparent');
        } else {
            btn.classList.add('bg-blue-600', 'text-white', 'shadow-lg', 'border-transparent');
        }
    }
}

async function searchPerson() {
    const input = document.getElementById('search-person-input');
    const resultsDiv = document.getElementById('person-results');
    
    // Sicherheitscheck: Existieren die Elemente?
    if (!input || !resultsDiv) return console.error("Suchfeld nicht gefunden!");

    const term = input.value.trim().toLowerCase();

    // Reset bei leerem Feld
    if (term.length === 0) {
        resultsDiv.innerHTML = "<p class='text-slate-500 col-span-3 text-center'>Geben Sie einen Namen ein...</p>";
        return;
    }

    try {
        // Suche starten
        const snapshot = await db.collection('persons')
            .where('lastname', '>=', term)
            .where('lastname', '<=', term + '\uf8ff')
            .limit(10).get();

        resultsDiv.innerHTML = "";

        if (snapshot.empty) {
            resultsDiv.innerHTML = "<p class='text-slate-500 col-span-3 text-center'>Keine Einträge gefunden.</p>";
            return;
        }

        snapshot.forEach(doc => {
            const p = doc.data();
            const isWanted = p.tags && p.tags.includes('Wanted');
            
            resultsDiv.innerHTML += `
                <div class="glass-panel p-4 rounded border-l-4 ${isWanted ? 'border-red-500' : 'border-slate-600'} hover:bg-slate-800 transition cursor-pointer relative group" onclick="viewProfile('${doc.id}')">
                    <div class="flex justify-between items-start">
                        <div>
                            <h4 class="font-bold text-lg text-white">${p.firstname} ${p.lastname}</h4>
                            <p class="text-xs text-slate-400 font-mono">Geb: ${p.dob}</p>
                        </div>
                        ${isWanted ? '<span class="animate-pulse text-xl">🚨</span>' : ''}
                    </div>
                    <div class="flex gap-1 mt-3 flex-wrap">
                        ${p.tags ? p.tags.map(t => `<span class="px-2 py-0.5 rounded text-[10px] bg-slate-900 border border-slate-700 ${t==='Wanted' ? 'text-red-500 font-bold border-red-900': 'text-slate-400'}">${t}</span>`).join('') : ''}
                    </div>
                </div>`;
        });
    } catch (e) {
        console.error("Such-Fehler:", e);
        // Tipp: Firebase Index Fehler wird hier in der Konsole (F12) angezeigt!
        if(e.message.includes("requires an index")) alert("Datenbank-Index fehlt! Bitte Konsole (F12) prüfen und Link anklicken.");
    }
}
async function savePerson() {
    const pData = {
        firstname: document.getElementById('p-firstname').value,
        lastname: document.getElementById('p-lastname').value,
        dob: document.getElementById('p-dob').value,
        height: document.getElementById('p-height').value,
        tags: selectedTags,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    if(!pData.lastname) return alert("Nachname fehlt.");
    
    const docId = `${pData.firstname}_${pData.lastname}`.toLowerCase();
    await db.collection('persons').doc(docId).set(pData, { merge: true });
    alert("Person gespeichert.");
    closeModal();
    searchPerson();
}

// ==========================================
// 5. VEHICLES
// ==========================================
async function liveSearchOwner(query) {
    if (query.length < 2) return;
    const dropdown = document.getElementById('owner-dropdown');
    const snapshot = await db.collection('persons').where('lastname', '>=', query.toLowerCase()).limit(5).get();
    
    dropdown.innerHTML = "";
    dropdown.classList.remove('hidden');
    
    snapshot.forEach(doc => {
        const p = doc.data();
        const div = document.createElement('div');
        div.className = "p-2 hover:bg-slate-700 cursor-pointer border-b border-slate-700 text-xs";
        div.innerText = `${p.firstname} ${p.lastname}`;
        div.onclick = () => {
            document.getElementById('v-owner-id').value = doc.id;
            document.getElementById('selected-owner-display').innerText = `Besitzer: ${p.firstname} ${p.lastname}`;
            dropdown.classList.add('hidden');
        };
        dropdown.appendChild(div);
    });
}

async function saveVehicle() {
    const plate = document.getElementById('v-plate').value.toUpperCase();
    if (!plate) return alert("Kennzeichen fehlt.");
    
    await db.collection('vehicles').doc(plate).set({
        plate: plate,
        model: document.getElementById('v-model').value,
        color: document.getElementById('v-color').value,
        ownerId: document.getElementById('v-owner-id').value,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    alert("Fahrzeug registriert.");
    closeModal();
}

aasync function searchVehicle() {
    const input = document.getElementById('search-vehicle-input');
    const div = document.getElementById('vehicle-results');
    
    if (!input || !div) return;
    const term = input.value.trim().toUpperCase(); // Kennzeichen sind immer Groß

    if (term.length === 0) {
        div.innerHTML = "<p class='text-slate-500 col-span-3 text-center'>Kennzeichen eingeben...</p>";
        return;
    }

    const snapshot = await db.collection('vehicles').where('plate', '>=', term).where('plate', '<=', term + '\uf8ff').limit(10).get();
    div.innerHTML = "";
    
    if (snapshot.empty) {
        div.innerHTML = "<p class='text-slate-500 col-span-3 text-center'>Kein Fahrzeug gefunden.</p>";
        return;
    }

    snapshot.forEach(async doc => {
        const v = doc.data();
        // Besitzer Name laden (optional, aber schick)
        let ownerName = "Unbekannt";
        if(v.ownerId) {
            const oDoc = await db.collection('persons').doc(v.ownerId).get();
            if(oDoc.exists) ownerName = `${oDoc.data().firstname} ${oDoc.data().lastname}`;
        }

        div.innerHTML += `
            <div class="glass-panel p-4 rounded border-l-4 border-yellow-500 hover:bg-slate-800 transition">
                <div class="flex justify-between items-center mb-2">
                    <span class="bg-yellow-500 text-black font-bold px-2 py-0.5 rounded text-sm font-mono">${v.plate}</span>
                    <span class="text-xs text-slate-400">${v.model || 'Fahrzeug'}</span>
                </div>
                <p class="text-xs text-slate-300">Farbe: <span class="text-white">${v.color}</span></p>
                <p class="text-xs text-blue-400 mt-2 font-bold cursor-pointer hover:underline" onclick="showPage('persons'); setTimeout(() => {document.getElementById('search-person-input').value='${ownerName.split(' ')[1]}'; searchPerson()}, 500)">
                    👤 ${ownerName}
                </p>
            </div>`;
    });
}

// ==========================================
// 6. REPORTS & NUMBERS
// ==========================================
async function openReportModal() {
    const prefix = currentUser.department === "MARSHAL" ? "LSMS" : "LSPD";
    const visual = document.getElementById('report-card-visual');
    const header = document.getElementById('r-header-title');
    
    // Visuals anpassen
    if(prefix === "LSMS") {
        visual.className = "glass-panel p-8 w-[800px] max-h-[95vh] flex flex-col border-t-4 border-amber-500";
        header.classList.add('text-amber-500');
    } else {
        visual.className = "glass-panel p-8 w-[800px] max-h-[95vh] flex flex-col border-t-4 border-blue-500";
        header.classList.add('text-blue-500');
    }

    // ID Generieren
    const snap = await db.collection('reports').get();
    const id = `${prefix}-${String(snap.size + 1000).padStart(4, '0')}`;
    
    document.getElementById('r-id-preview').innerText = id;
    document.getElementById('r-officers').value = currentUser.username;
    
    // Vorlage
    let tpl = "SITUATION:\n\n\nMASSNAHMEN:\n\n\nERGEBNIS:"; 
    if(currentUser.rank.includes("Detektiv")) tpl = "ERMITTLUNGSPROTOKOLL\n\nTATVERDACHT:\n\nBEWEISE:\n\nVERLAUF:";
    document.getElementById('r-content').value = tpl;

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
        content: content,
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
    document.getElementById('stat-report-count').innerText = snap.size; // Simple Stat

    snap.forEach(doc => {
        const r = doc.data();
        if (currentReportFilter !== 'ALL' && r.deptPrefix !== currentReportFilter) return;

        const isMarshal = r.deptPrefix === "LSMS";
        const color = isMarshal ? "border-amber-600 text-amber-500" : "border-blue-600 text-blue-400";

        list.innerHTML += `
            <div class="glass-panel p-3 rounded border-l-4 ${color.split(' ')[0]} hover:bg-slate-800 cursor-pointer">
                 <div class="flex justify-between">
                     <span class="text-xs font-bold ${color.split(' ')[1]} border border-current px-1 rounded">${r.deptPrefix}</span>
                     <span class="text-xs text-slate-500 font-mono">${r.timestamp ? r.timestamp.toDate().toLocaleDateString() : ''}</span>
                 </div>
                 <h4 class="font-bold text-slate-200">${r.subject}</h4>
                 <p class="text-xs text-slate-400">Von: ${r.author} (${r.rank})</p>
            </div>
        `;
    });
}

function filterReports(filter) {
    currentReportFilter = filter;
    loadReports();
}

// ==========================================
// 7. WANTED LISTENER & CALCULATOR
// ==========================================
function startWantedListener() {
    db.collection('persons').where('tags', 'array-contains', 'Wanted').onSnapshot(snap => {
        const tbody = document.getElementById('wanted-list-body');
        if(document.getElementById('stat-wanted-count')) {
            document.getElementById('stat-wanted-count').innerText = snap.size;
        }
        tbody.innerHTML = "";
        
        snap.forEach(doc => {
            const p = doc.data();
            // HIER WAR DER FEHLER: Der Button braucht einen onclick-Befehl
            tbody.innerHTML += `
                <tr class="hover:bg-slate-800/50 transition border-b border-slate-800">
                    <td class="p-4 font-bold text-white">
                        ${p.firstname} ${p.lastname}
                        <span class="block text-[10px] text-slate-500 font-normal">${p.alias || ''}</span>
                    </td>
                    <td class="text-red-400 font-mono text-xs uppercase tracking-wider">Gesucht</td>
                    <td class="font-mono text-slate-400 text-xs">Aktuell</td>
                    <td class="text-right p-4">
                        <button onclick="showPage('persons'); setTimeout(() => { document.getElementById('search-person-input').value = '${p.lastname}'; searchPerson(); }, 500);" 
                        class="text-xs bg-slate-700 hover:bg-slate-600 text-white px-3 py-1 rounded transition">
                            Akte öffnen
                        </button>
                    </td>
                </tr>`;
        });
    });
}

// Simulierter Rechner (Daten)
const LAWS = [
    { id: "§1", name: "Speeding", price: 500, jail: 0 },
    { id: "§2", name: "Körperverletzung", price: 2500, jail: 10 },
    { id: "§3", name: "Mord", price: 50000, jail: 120 },
];
let cart = [];

function loadLaws() {
    const div = document.getElementById('law-list');
    div.innerHTML = LAWS.map(l => `
        <div class="p-2 hover:bg-slate-700 cursor-pointer flex justify-between text-xs" onclick="addToCart('${l.id}')">
            <span>${l.name}</span> <span class="text-green-400">$${l.price}</span>
        </div>
    `).join('');
}

function addToCart(id) {
    const law = LAWS.find(l => l.id === id);
    cart.push(law);
    renderCart();
}

function renderCart() {
    const div = document.getElementById('calc-cart');
    div.innerHTML = cart.map((c, i) => `
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

// ==========================================
// 8. EMPLOYEE MANAGEMENT
// ==========================================
async function renderEmployeePanel() {
    const list = document.getElementById('employee-list');
    const snap = await db.collection('users').get();
    list.innerHTML = "";
    
    snap.forEach(doc => {
        const u = doc.data();
        // Hier könnte man deine detaillierte Berechtigungs-Prüfung einbauen
        list.innerHTML += `
            <div class="flex justify-between p-2 bg-slate-800/50 mb-1 rounded border border-slate-700 items-center">
                <div><span class="font-bold text-blue-400">${doc.id}</span> <span class="text-xs text-slate-500">(${u.rank})</span></div>
                <button onclick="removeUser('${doc.id}')" class="text-red-500 text-xs hover:underline">Entfernen</button>
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

async function viewProfile(personId) {
    // 1. Modal öffnen
    const modal = document.getElementById('modal-person');
    modal.classList.remove('hidden');
    
    // 2. Daten laden
    const doc = await db.collection('persons').doc(personId).get();
    if (!doc.exists) return alert("Fehler: Akte nicht gefunden.");
    
    const p = doc.data();
    
    // 3. Formular befüllen (Read-Only Modus simulieren oder bearbeitbar lassen)
    document.getElementById('p-firstname').value = p.firstname;
    document.getElementById('p-lastname').value = p.lastname;
    document.getElementById('p-dob').value = p.dob;
    document.getElementById('p-height').value = p.height;
    
    // 4. Tags setzen
    selectedTags = p.tags || []; // Globale Variable setzen
    document.querySelectorAll('.tag-btn').forEach(btn => {
        const tag = btn.getAttribute('data-tag');
        // Reset Style
        btn.classList.remove('bg-blue-600', 'bg-red-600', 'text-white', 'shadow-lg');
        
        // Set Style wenn Tag aktiv
        if (selectedTags.includes(tag)) {
            if (tag === 'Wanted') btn.classList.add('bg-red-600', 'text-white', 'shadow-lg');
            else btn.classList.add('bg-blue-600', 'text-white', 'shadow-lg');
        }
    });
    
    // Optional: Ändere den "Speichern" Button zu "Aktualisieren"
    // (Hier lassen wir es einfach, da savePerson() mit merge:true arbeitet und somit updated)
}

async function removeUser(id) {
    if(confirm("Löschen?")) {
        await db.collection('users').doc(id).delete();
        renderEmployeePanel();
    }
}

// Dummy Functions für Court/IA (der Vollständigkeit halber)
async function loadCourtRecords() { /* Wie im vorherigen Chat implementiert */ }
async function saveCourtRecord() { /* Wie im vorherigen Chat implementiert */ }
async function loadIACases() { /* Wie im vorherigen Chat implementiert */ }
async function saveIACase() { /* Wie im vorherigen Chat implementiert */ }
