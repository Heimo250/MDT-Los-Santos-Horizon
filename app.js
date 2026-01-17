// ==========================================
// 1. CONFIG & INIT
// ==========================================
const firebaseConfig = {
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
    
    if (!resultsDiv) return;

    // Wir suchen nach dem kleingeschriebenen Begriff
    const term = input.value.trim().toLowerCase();

    try {
        let query = db.collection('persons');

        // Nur filtern, wenn auch was getippt wurde
        if (term.length > 0) {
            // Wir suchen im neuen Feld 'searchKey' statt 'lastname'
            query = query.where('searchKey', '>=', term)
                         .where('searchKey', '<=', term + '\uf8ff');
        }

        const snapshot = await query.limit(10).get();
        resultsDiv.innerHTML = "";

        if (snapshot.empty) {
            resultsDiv.innerHTML = "<p class='text-slate-500 col-span-3 text-center'>Keine Einträge gefunden.</p>";
            return;
        }

        snapshot.forEach(doc => {
            const p = doc.data();
            const isWanted = p.tags && p.tags.includes('Wanted');
            const borderClass = isWanted ? "border-red-500" : "border-slate-600";
            
            resultsDiv.innerHTML += `
                <div class="glass-panel p-4 rounded border-l-4 ${borderClass} hover:bg-slate-800 transition cursor-pointer relative group" onclick="viewProfile('${doc.id}')">
                    <div class="flex justify-between items-start">
                        <div>
                            <h4 class="font-bold text-lg text-white">${p.firstname} ${p.lastname}</h4>
                            <p class="text-xs text-slate-400 font-mono">Geb: ${p.dob} | ${p.height}cm</p>
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
        if(e.code === 'failed-precondition') {
             alert("ACHTUNG: Firebase Index fehlt! Öffne die Konsole (F12) und klicke auf den Link in der Fehlermeldung.");
        }
    }
}

// A. PERSON SPEICHERN (Mit Such-Hilfe)
async function savePerson() {
    const firstname = document.getElementById('p-firstname').value;
    const lastname = document.getElementById('p-lastname').value;
    
    // Validierung
    if(!lastname) return alert("Nachname fehlt.");
    
    const pData = {
        firstname: firstname,
        lastname: lastname,
        // WICHTIG: Wir erstellen ein Feld extra für die Suche in Kleinschrift
        searchKey: lastname.toLowerCase(), 
        dob: document.getElementById('p-dob').value,
        height: document.getElementById('p-height').value,
        tags: selectedTags,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    // Doc-ID erstellen (z.B. max_mustermann)
    const docId = `${firstname}_${lastname}`.toLowerCase().replace(/\s/g, '');
    
    try {
        await db.collection('persons').doc(docId).set(pData, { merge: true });
        alert("Person gespeichert!");
        closeModal();
        // Leere das Suchfeld und lade die Liste neu
        document.getElementById('search-person-input').value = lastname;
        searchPerson(); 
    } catch (e) {
        console.error("Speicherfehler:", e);
        alert("Fehler beim Speichern: " + e.message);
    }
}

async function viewProfile(personId) {
    // 1. Modal öffnen
    const modal = document.getElementById('modal-person');
    modal.classList.remove('hidden');
    
    // 2. Daten laden
    const doc = await db.collection('persons').doc(personId).get();
    if (!doc.exists) return alert("Fehler: Akte nicht gefunden.");
    
    const p = doc.data();
    
    // 3. Formular befüllen
    document.getElementById('p-firstname').value = p.firstname;
    document.getElementById('p-lastname').value = p.lastname;
    document.getElementById('p-dob').value = p.dob;
    document.getElementById('p-height').value = p.height;
    
    // 4. Tags setzen
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

async function searchVehicle() {
    const input = document.getElementById('search-vehicle-input');
    const div = document.getElementById('vehicle-results');
    
    if (!input || !div) return;
    const term = input.value.trim().toUpperCase();

    if (term.length === 0) {
        div.innerHTML = "<p class='text-slate-500 col-span-3 text-center'>Kennzeichen eingeben...</p>";
        return;
    }

    const snapshot = await db.collection('vehicles')
        .where('plate', '>=', term)
        .where('plate', '<=', term + '\uf8ff')
        .limit(10).get();
        
    div.innerHTML = "";
    
    if (snapshot.empty) {
        div.innerHTML = "<p class='text-slate-500 col-span-3 text-center'>Kein Fahrzeug gefunden.</p>";
        return;
    }

    // ACHTUNG: Hier async nutzen, da wir drinnen warten (await)
    snapshot.forEach(async doc => {
        const v = doc.data();
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
                <p class="text-xs text-blue-400 mt-2 font-bold cursor-pointer hover:underline" onclick="showPage('persons'); setTimeout(() => {document.getElementById('search-person-input').value='${ownerName.split(' ')[1] || ''}'; searchPerson()}, 500)">
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
    
    document.getElementById('r-id-preview
