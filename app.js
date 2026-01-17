console.log("SYSTEM STARTET... LADE MODULE");

// ==========================================
// 1. CONFIG & SETUP
// ==========================================
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

// ==========================================
// 2. LOGIN & THEME
// ==========================================
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
            
            if(document.getElementById('current-user-name')) document.getElementById('current-user-name').innerText = currentUser.username;
            if(document.getElementById('current-rank')) document.getElementById('current-rank').innerText = `${currentUser.rank}`;
            if(document.getElementById('user-avatar')) document.getElementById('user-avatar').innerText = currentUser.username.charAt(0).toUpperCase();

            applyTheme(currentUser.department);
            checkPermissions();
            
            startWantedListener();
            initDashboard();
            initDispatchMonitor();
            updateMyStatus('10-8');

            showPage('home');
        } else {
            alert("Falsche Daten.");
        }
    } catch (error) { alert("Login Fehler: " + error.message); }
}

function applyTheme(dept) {
    const header = document.getElementById('dept-header');
    const icon = document.querySelector('.header-icon');
    document.body.classList.remove("theme-marshal", "theme-doj", "theme-ia");
    
    if (dept === "MARSHAL") {
        document.body.classList.add("theme-marshal");
        if(header) { header.innerText = "MARSHAL SERVICE"; header.className = "text-amber-500 font-bold tracking-widest uppercase text-sm hidden md:block"; }
        if(icon) icon.style.backgroundColor = "#d97706";
    } else if (dept === "DOJ") {
        document.body.classList.add("theme-doj");
        if(header) { header.innerText = "DEPT. OF JUSTICE"; header.className = "text-purple-500 font-bold tracking-widest uppercase text-sm hidden md:block"; }
        if(icon) icon.style.backgroundColor = "#9333ea";
    } else {
        if(header) { header.innerText = "LSPD POLICE DEPT"; header.className = "text-blue-400 font-bold tracking-widest uppercase text-sm hidden md:block"; }
        if(icon) icon.style.backgroundColor = "#3b82f6";
    }
}

function checkPermissions() {
    const rank = currentUser.rank;
    document.querySelectorAll('.judge-only, .ia-only, .command-only').forEach(el => el.classList.add('hidden'));
    if (rank.includes("Command") || rank === "Attorney General") document.querySelectorAll('.command-only').forEach(el => el.classList.remove('hidden'));
    if (["Judge", "Chief Justice", "Attorney General"].includes(rank)) document.querySelectorAll('.judge-only').forEach(el => el.classList.remove('hidden'));
    if (rank === "Attorney General") document.querySelectorAll('.ia-only').forEach(el => el.classList.remove('hidden'));
}

// ==========================================
// 3. NAVIGATION
// ==========================================
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    
    const target = document.getElementById('page-' + pageId);
    if (target) target.classList.remove('hidden');
    
    const nav = document.getElementById('nav-' + pageId);
    if (nav) nav.classList.add('active');

    if (pageId === 'home') initDashboard();
    if (pageId === 'dispatch') initDispatchMonitor();
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

// ==========================================
// 4. PERSONEN
// ==========================================
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
        if (term.length > 0) query = query.where('searchKey', '>=', term).where('searchKey', '<=', term + '\uf8ff');
        const snapshot = await query.limit(10).get();
        resultsDiv.innerHTML = "";
        if (snapshot.empty) { resultsDiv.innerHTML = "<p class='text-slate-500 col-span-3 text-center'>Keine Treffer.</p>"; return; }

        snapshot.forEach(doc => {
            const p = doc.data();
            const isWanted = p.tags && p.tags.includes('Wanted');
            const borderClass = isWanted ? "border-red-500" : "border-slate-600";
            resultsDiv.innerHTML += `
                <div class="glass-panel p-4 rounded border-l-4 ${borderClass} hover:bg-slate-800 transition cursor-pointer group" onclick="viewProfile('${doc.id}')">
                    <div class="flex justify-between items-start">
                        <div><h4 class="font-bold text-lg text-white">${p.firstname} ${p.lastname}</h4><p class="text-xs text-slate-400">Geb: ${p.dob}</p></div>
                        ${isWanted ? '🚨' : ''}
                    </div>
                </div>`;
        });
    } catch (e) { console.error(e); }
}

async function savePerson() {
    const firstname = document.getElementById('p-firstname').value;
    const lastname = document.getElementById('p-lastname').value;
    if(!lastname) return alert("Name fehlt.");
    const docId = `${firstname}_${lastname}`.toLowerCase().replace(/\s/g, '');
    const searchKey = (firstname + " " + lastname).toLowerCase();

    try {
        await db.collection('persons').doc(docId).set({
            firstname, lastname, searchKey, 
            dob: document.getElementById('p-dob').value,
            height: document.getElementById('p-height').value,
            tags: selectedTags,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        alert("Gespeichert."); closeModal(); document.getElementById('search-person-input').value = lastname; searchPerson(); 
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

// ==========================================
// 5. FAHRZEUGE
// ==========================================
async function liveSearchOwner(query) {
    const dropdown = document.getElementById('owner-dropdown');
    if (!query || query.length < 2) { dropdown.classList.add('hidden'); return; }
    try {
        const snap = await db.collection('persons').where('searchKey', '>=', query.toLowerCase()).where('searchKey', '<=', query.toLowerCase() + '\uf8ff').limit(5).get();
        dropdown.innerHTML = ""; dropdown.classList.remove('hidden'); dropdown.style.zIndex = "100";
        if (snap.empty) { dropdown.innerHTML = "<div class='p-2 text-xs text-slate-500'>Nichts gefunden</div>"; return; }
        snap.forEach(doc => {
            const p = doc.data();
            const div = document.createElement('div');
            div.className = "p-2 hover:bg-slate-700 cursor-pointer text-xs bg-slate-900 text-white border-b border-slate-700";
            div.innerText = `${p.firstname} ${p.lastname}`;
            div.onclick = () => { document.getElementById('v-owner-id').value = doc.id; document.getElementById('selected-owner-display').innerText = `Halter: ${p.firstname} ${p.lastname}`; dropdown.classList.add('hidden'); };
            dropdown.appendChild(div);
        });
    } catch(e) { console.error(e); }
}

async function saveVehicle() {
    const plate = document.getElementById('v-plate').value.toUpperCase();
    if (!plate) return alert("Kennzeichen fehlt.");
    await db.collection('vehicles').doc(plate).set({
        plate, model: document.getElementById('v-model').value, color: document.getElementById('v-color').value,
        ownerId: document.getElementById('v-owner-id').value, createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    alert("Fahrzeug registriert."); closeModal();
}

async function searchVehicle() {
    const input = document.getElementById('search-vehicle-input');
    const div = document.getElementById('vehicle-results');
    if (!input || !div) return;
    const term = input.value.trim().toUpperCase();
    if (term.length === 0) { div.innerHTML = "<p class='text-slate-500 col-span-3 text-center'>Kennzeichen eingeben...</p>"; return; }
    try {
        const snap = await db.collection('vehicles').where('plate', '>=', term).where('plate', '<=', term + '\uf8ff').limit(10).get();
        div.innerHTML = "";
        if (snap.empty) { div.innerHTML = "<p class='text-slate-500 col-span-3 text-center'>Kein Fahrzeug.</p>"; return; }
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

// ==========================================
// 6. REPORTS
// ==========================================
async function openReportModal() {
    const prefix = currentUser.department === "MARSHAL" ? "LSMS" : "LSPD";
    const visual = document.getElementById('report-card-visual');
    const header = document.getElementById('r-header-title');
    if(prefix === "LSMS") { visual.className = "glass-panel p-8 w-[800px] border-t-4 border-amber-500"; header.classList.add('text-amber-500'); }
    else { visual.className = "glass-panel p-8 w-[800px] border-t-4 border-blue-500"; header.classList.add('text-blue-500'); }
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
        author: currentUser.username, rank: currentUser.rank, location: document.getElementById('r-location').value,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    alert("Archiviert."); closeModal(); loadReports();
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
                 <div class="flex justify-between"><span class="text-xs font-bold ${color.split(' ')[1]} border border-current px-1 rounded">${r.deptPrefix}</span><span class="text-xs text-slate-500">${r.timestamp ? r.timestamp.toDate().toLocaleDateString() : ''}</span></div>
                 <h4 class="font-bold text-slate-200">${r.subject}</h4>
                 <p class="text-xs text-slate-400">Von: ${r.author} (${r.rank})</p>
            </div>`;
    });
}
function filterReports(filter) { currentReportFilter = filter; loadReports(); }

// ==========================================
// 7. LISTENERS
// ==========================================
function startWantedListener() {
    db.collection('persons').where('tags', 'array-contains', 'Wanted').onSnapshot(snap => {
        const tbody = document.getElementById('wanted-list-body');
        if(document.getElementById('stat-wanted-count')) document.getElementById('stat-wanted-count').innerText = snap.size;
        if(!tbody) return;
        tbody.innerHTML = "";
        snap.forEach(doc => {
            const p = doc.data();
            tbody.innerHTML += `<tr class="hover:bg-slate-800/50 transition border-b border-slate-800"><td class="p-4 font-bold text-white">${p.firstname} ${p.lastname}</td><td class="text-red-400 font-mono text-xs">GESUCHT</td><td class="text-right p-4"><button onclick="showPage('persons'); setTimeout(() => { document.getElementById('search-person-input').value = '${p.lastname}'; searchPerson(); }, 500);" class="text-xs bg-slate-700 px-3 py-1 rounded">Akte</button></td></tr>`;
        });
    });
}

// ==========================================
// 8. LAWS (GESETZE)
// ==========================================

const LAWS = [

    { id: "§1", de: "Geschwindigkeitsüberschreitung (16 km/h über)", en: "Speeding (10 mph over)", text: "Exceeding the posted speed limit by up to 10 mph in any zone.", jail: 0, fine: 250 },
{ id: "§2", de: "Geschwindigkeitsüberschreitung (24 km/h über)", en: "Speeding (15 mph over)", text: "Exceeding the posted speed limit by 11–15 mph.", jail: 0, fine: 400 },
{ id: "§3", de: "Geschwindigkeitsüberschreitung (32 km/h über)", en: "Speeding (20 mph over)", text: "Exceeding the posted speed limit by 16–20 mph.", jail: 0, fine: 600 },
{ id: "§4", de: "Geschwindigkeitsüberschreitung (40 km/h über)", en: "Speeding (25 mph over)", text: "Exceeding the posted speed limit by 21–25 mph.", jail: 0, fine: 900 },
{ id: "§5", de: "Geschwindigkeitsüberschreitung in Schulzone", en: "Speeding in School Zone", text: "Any speeding violation within a school zone.", jail: 0, fine: 1200 },
{ id: "§6", de: "Rücksichtsloses Fahren", en: "Reckless Driving", text: "Driving in a manner that endangers others.", jail: 2, fine: 1500 },
{ id: "§7", de: "Fahren unter Alkoholeinfluss Stufe 1", en: "DUI Level 1", text: "BAC 0.08–0.15.", jail: 5, fine: 2000 },
{ id: "§8", de: "Fahren unter Alkoholeinfluss Stufe 2", en: "DUI Level 2", text: "BAC 0.16–0.20.", jail: 10, fine: 4000 },
{ id: "§9", de: "Fahren unter Alkoholeinfluss Stufe 3", en: "DUI Level 3", text: "BAC over 0.20.", jail: 20, fine: 8000 },
{ id: "§10", de: "Unfallflucht (Sachschaden)", en: "Hit and Run (Property)", text: "Fleeing the scene of an accident involving property damage.", jail: 3, fine: 2500 },
{ id: "§11", de: "Unfallflucht (Verletzung)", en: "Hit and Run (Injury)", text: "Fleeing the scene of an accident involving injury.", jail: 15, fine: 10000 },
{ id: "§12", de: "Unfallflucht (Tödlich)", en: "Hit and Run (Fatal)", text: "Fleeing the scene of an accident resulting in death.", jail: 60, fine: 50000 },
{ id: "§13", de: "Rotlichtverstoß", en: "Running Red Light", text: "Failing to stop at a red traffic signal.", jail: 0, fine: 300 },
{ id: "§14", de: "Stoppschildverstoß", en: "Running Stop Sign", text: "Failing to stop at a stop sign.", jail: 0, fine: 200 },
{ id: "§15", de: "Illegales Wendemanöver", en: "Illegal U-Turn", text: "Performing a U-turn where prohibited.", jail: 0, fine: 250 },
{ id: "§16", de: "Vorfahrtverletzung", en: "Failure to Yield", text: "Failing to yield the right of way.", jail: 0, fine: 350 },
{ id: "§17", de: "Kein Sicherheitsgurt", en: "No Seatbelt", text: "Not wearing a seatbelt while driving.", jail: 0, fine: 100 },
{ id: "§18", de: "Illegales Parken", en: "Illegal Parking", text: "Parking in a prohibited area.", jail: 0, fine: 150 },
{ id: "§19", de: "Fahren ohne Führerschein", en: "Driving Without License", text: "Operating a vehicle without a valid driver’s license.", jail: 1, fine: 1000 },
{ id: "§20", de: "Abgelaufene Zulassung", en: "Expired Registration", text: "Driving a vehicle with expired registration.", jail: 0, fine: 500 },
{ id: "§21", de: "Keine Versicherung", en: "No Insurance", text: "Operating a vehicle without valid insurance.", jail: 0, fine: 1500 },
{ id: "§22", de: "Straßenrennen", en: "Street Racing", text: "Participating in an unauthorized street race.", jail: 5, fine: 3000 },
{ id: "§23", de: "Flucht vor Polizei", en: "Evading Police", text: "Fleeing or attempting to flee from law enforcement.", jail: 10, fine: 5000 },
{ id: "§24", de: "Falschfahrt", en: "Wrong Way Driving", text: "Driving against the designated traffic direction.", jail: 2, fine: 2000 },
{ id: "§25", de: "Geschwindigkeit Autobahn (48+ km/h über)", en: "Speeding Highway (30+)", text: "Excessive speeding on a highway.", jail: 1, fine: 1500 },
{ id: "§26", de: "Kein Licht", en: "No Headlights", text: "Driving at night without headlights.", jail: 0, fine: 200 },
{ id: "§27", de: "Zu nah auffahren", en: "Tailgating", text: "Following another vehicle too closely.", jail: 0, fine: 300 },
{ id: "§28", de: "Illegales Spurwechsel", en: "Illegal Lane Change", text: "Changing lanes without proper signaling.", jail: 0, fine: 250 },
{ id: "§29", de: "Fahren auf Gehweg", en: "Driving on Sidewalk", text: "Driving a vehicle on a pedestrian sidewalk.", jail: 1, fine: 1000 },
{ id: "§30", de: "Fahrzeugmanipulation", en: "Vehicle Tampering", text: "Tampering with a vehicle’s locks or engine.", jail: 2, fine: 1500 },
{ id: "§31", de: "Frevel an Fahrzeug", en: "Joyriding", text: "Using a vehicle without permission but without intent to steal.", jail: 4, fine: 2000 },
{ id: "§32", de: "Fahrzeugdiebstahl", en: "Grand Theft Auto", text: "Stealing a motor vehicle.", jail: 8, fine: 5000 },
{ id: "§33", de: "Autoraub", en: "Carjacking", text: "Stealing a vehicle from an occupant using force.", jail: 20, fine: 15000 },
{ id: "§34", de: "Fahrzeugdiebstahlring", en: "Vehicle Theft Ring", text: "Operating an organized vehicle theft ring.", jail: 30, fine: 30000 },
{ id: "§35", de: "Alkoholunfall mit Verletzung", en: "DUI Causing Injury", text: "Driving under the influence resulting in injury.", jail: 25, fine: 20000 },
{ id: "§36", de: "Wut am Steuer mit Angriff", en: "Road Rage Assault", text: "Assault committed during a road rage incident.", jail: 10, fine: 8000 },
{ id: "§37", de: "Illegale Umbauten", en: "Illegal Modifications", text: "Vehicle modifications violating regulations.", jail: 0, fine: 1000 },
{ id: "§38", de: "Kein Kennzeichen", en: "No License Plate", text: "Operating a vehicle without license plates.", jail: 1, fine: 2000 },
{ id: "§39", de: "Falsches Kennzeichen", en: "Fake Plates", text: "Using counterfeit or stolen license plates.", jail: 5, fine: 5000 },
{ id: "§40", de: "Geschwindigkeit Baustelle", en: "Speeding Construction Zone", text: "Speeding in a construction or work zone.", jail: 0, fine: 1000 },
{ id: "§41", de: "Unkontrolliertes Überqueren", en: "Jaywalking", text: "Crossing the street outside designated crosswalks.", jail: 0, fine: 100 },
{ id: "§42", de: "Fahrradverstoß", en: "Bicycle Violation", text: "Violating bicycle traffic laws.", jail: 0, fine: 150 },
{ id: "§43", de: "Motorrad ohne Helm", en: "Motorcycle No Helmet", text: "Operating a motorcycle without a helmet.", jail: 0, fine: 200 },
{ id: "§44", de: "LKW Überladung", en: "Truck Overload", text: "Operating an overloaded commercial truck.", jail: 0, fine: 800 },
{ id: "§45", de: "Busspurverstoß", en: "Bus Lane Violation", text: "Using a bus lane without authorization.", jail: 0, fine: 400 },
{ id: "§46", de: "HOV-Spur Missbrauch", en: "HOV Lane Abuse", text: "Using a high-occupancy vehicle lane alone.", jail: 0, fine: 500 },
{ id: "§47", de: "Illegale Folierung", en: "Tinted Windows Illegal", text: "Using window tint beyond legal limits.", jail: 0, fine: 300 },
{ id: "§48", de: "Auspuffverstoß", en: "Exhaust Violation", text: "Operating a vehicle with illegal exhaust modifications.", jail: 0, fine: 600 },
{ id: "§49", de: "Handy am Steuer", en: "Phone While Driving", text: "Using a mobile phone while driving.", jail: 0, fine: 250 },
{ id: "§50", de: "Kindersitzverstoß", en: "Child Seat Violation", text: "Failing to use proper child restraints.", jail: 0, fine: 400 },
{ id: "§51", de: "Dragster-Rennen", en: "Drag Racing", text: "Participating in drag racing on public roads.", jail: 6, fine: 4000 },
{ id: "§52", de: "Illegales Geländefahren", en: "Off-Road Illegal", text: "Driving off-road within city limits.", jail: 2, fine: 1500 },
{ id: "§53", de: "Fahren auf Standstreifen", en: "Emergency Lane Drive", text: "Driving on the emergency shoulder.", jail: 1, fine: 1000 },
{ id: "§54", de: "Kein Blinker", en: "No Turn Signal", text: "Turning without using turn signals.", jail: 0, fine: 150 },
{ id: "§55", de: "Doppeltes Parken", en: "Double Parking", text: "Blocking traffic by double parking.", jail: 0, fine: 200 },
{ id: "§56", de: "Nicht Vorrang Fußgänger", en: "Yield to Pedestrian Fail", text: "Failing to yield to pedestrians.", jail: 0, fine: 300 },
{ id: "§57", de: "Illegales Rückwärtsfahren", en: "Reverse Illegal", text: "Improper or excessive reversing on a roadway.", jail: 0, fine: 250 },
{ id: "§58", de: "Durchbrennen", en: "Burnout", text: "Performing vehicle burnouts.", jail: 1, fine: 800 },
{ id: "§59", de: "Fahrzeugwechsel bei Flucht", en: "Vehicle Swap Evade", text: "Switching vehicles to evade police.", jail: 12, fine: 6000 },
{ id: "§60", de: "Reifenzerstörer Schaden", en: "Spike Strip Damage", text: "Damaging police spike strips.", jail: 3, fine: 3000 },
{ id: "§61", de: "Hubschrauber Tiefflug illegal", en: "Helicopter Low Fly", text: "Flying a helicopter too low over a city.", jail: 5, fine: 5000 },
{ id: "§62", de: "Flugzeug in No-Fly-Zone", en: "Plane No Fly Zone", text: "Flying an aircraft in restricted airspace.", jail: 10, fine: 15000 },
{ id: "§63", de: "Bootsgeschwindigkeitsüberschreitung", en: "Boat Speed Limit", text: "Exceeding speed limits on waterways.", jail: 0, fine: 500 },
{ id: "§64", de: "U-Boot illegal", en: "Submarine Illegal Use", text: "Operating a submarine without authorization.", jail: 8, fine: 10000 },
{ id: "§65", de: "Taxameter Manipulation", en: "Taxi Meter Tamper", text: "Tampering with a taxi meter.", jail: 2, fine: 2000 },
{ id: "§66", de: "Limousinenservice Betrug", en: "Limo Service Fraud", text: "Operating a fake limousine service.", jail: 3, fine: 2500 },
{ id: "§67", de: "ÖPNV Vandalismus", en: "Public Transport Vandalism", text: "Vandalizing buses or trains.", jail: 1, fine: 1500 },
{ id: "§68", de: "Fahrrad auf Autobahn", en: "Bicycle on Highway", text: "Cycling on a highway.", jail: 0, fine: 300 },
{ id: "§69", de: "Scooter auf Gehweg", en: "Scooter Sidewalk", text: "Riding an electric scooter on a sidewalk.", jail: 0, fine: 200 },
{ id: "§70", de: "Parkuhr Betrug", en: "Parking Meter Fraud", text: "Tampering with a parking meter.", jail: 0, fine: 500 },
{ id: "§71", de: "Besitz einer illegalen Waffe", en: "Illegal Weapon Possession", text: "Possession of an unregistered or illegal weapon.", jail: 5, fine: 5000 },
{ id: "§72", de: "Führen einer Waffe ohne Lizenz", en: "Carrying Weapon Without License", text: "Carrying a firearm without a valid weapons license.", jail: 4, fine: 4000 },
{ id: "§73", de: "Illegale Waffenmodifikation", en: "Illegal Weapon Modification", text: "Modifying a weapon in a prohibited manner.", jail: 6, fine: 6000 },
{ id: "§74", de: "Verkauf illegaler Waffen", en: "Illegal Weapon Sales", text: "Selling illegal or unregistered weapons.", jail: 12, fine: 12000 },
{ id: "§75", de: "Waffenschmuggel", en: "Weapon Smuggling", text: "Smuggling weapons across borders.", jail: 20, fine: 25000 },
{ id: "§76", de: "Besitz einer schweren Waffe", en: "Heavy Weapon Possession", text: "Possession of heavy or military-grade weapons.", jail: 25, fine: 30000 },
{ id: "§77", de: "Benutzung einer Waffe im öffentlichen Raum", en: "Discharging Weapon in Public", text: "Firing a weapon in a public place.", jail: 10, fine: 8000 },
{ id: "§78", de: "Bedrohung mit einer Waffe", en: "Threatening With Weapon", text: "Threatening another person with a weapon.", jail: 8, fine: 7000 },
{ id: "§79", de: "Schusswaffengebrauch mit Verletzung", en: "Weapon Use Causing Injury", text: "Using a weapon causing bodily injury.", jail: 18, fine: 20000 },
{ id: "§80", de: "Schusswaffengebrauch mit Todesfolge", en: "Weapon Use Causing Death", text: "Using a weapon resulting in death.", jail: 60, fine: 100000 },
{ id: "§81", de: "Besitz von Munition ohne Erlaubnis", en: "Illegal Ammunition Possession", text: "Possession of ammunition without authorization.", jail: 3, fine: 3000 },
{ id: "§82", de: "Herstellung von Waffen", en: "Weapon Manufacturing", text: "Manufacturing weapons without authorization.", jail: 20, fine: 25000 },
{ id: "§83", de: "Waffenhandel organisiert", en: "Organized Weapon Trafficking", text: "Operating an organized weapons trafficking ring.", jail: 35, fine: 50000 },
{ id: "§84", de: "Verlust einer Dienstwaffe", en: "Loss of Service Weapon", text: "Negligent loss of an official service weapon.", jail: 6, fine: 6000 },
{ id: "§85", de: "Diebstahl einer Waffe", en: "Weapon Theft", text: "Stealing a firearm or weapon.", jail: 10, fine: 10000 },
{ id: "§86", de: "Besitz gestohlener Waffe", en: "Possession of Stolen Weapon", text: "Possessing a stolen weapon.", jail: 8, fine: 8000 },
{ id: "§87", de: "Verkauf an Minderjährige", en: "Selling Weapons to Minors", text: "Selling or giving weapons to minors.", jail: 15, fine: 20000 },
{ id: "§88", de: "Waffe im Sperrgebiet", en: "Weapon in Restricted Area", text: "Carrying a weapon in a restricted area.", jail: 7, fine: 7000 },
{ id: "§89", de: "Nicht gesicherte Waffe", en: "Unsafe Weapon Storage", text: "Failure to safely store a weapon.", jail: 2, fine: 2000 },
{ id: "§90", de: "Besitz einer verbotenen Waffe", en: "Prohibited Weapon Possession", text: "Possession of a prohibited weapon type.", jail: 20, fine: 30000 },
{ id: "§91", de: "Sprengstoffbesitz", en: "Explosive Possession", text: "Possession of explosives without permit.", jail: 25, fine: 40000 },
{ id: "§92", de: "Sprengstoffherstellung", en: "Explosive Manufacturing", text: "Manufacturing explosives illegally.", jail: 40, fine: 60000 },
{ id: "§93", de: "Sprengstoffanschlag", en: "Explosive Attack", text: "Using explosives to cause damage or harm.", jail: 80, fine: 150000 },
{ id: "§94", de: "Molotowcocktail Besitz", en: "Molotov Possession", text: "Possession of a Molotov cocktail.", jail: 15, fine: 20000 },
{ id: "§95", de: "Waffenlieferung an Kriminelle", en: "Supplying Weapons to Criminals", text: "Supplying weapons to known criminals.", jail: 25, fine: 35000 },
{ id: "§96", de: "Waffenbesitz unter Drogeneinfluss", en: "Weapon Under Influence", text: "Possessing a weapon while under influence.", jail: 6, fine: 6000 },
{ id: "§97", de: "Waffenhandel international", en: "International Arms Trafficking", text: "International trafficking of weapons.", jail: 50, fine: 100000 },
{ id: "§98", de: "Waffe auf Demonstration", en: "Weapon at Protest", text: "Carrying a weapon during a demonstration.", jail: 10, fine: 12000 },
{ id: "§99", de: "Automatische Waffen", en: "Automatic Weapons", text: "Possession or use of automatic firearms.", jail: 30, fine: 60000 },
{ id: "§100", de: "Verwendung Schalldämpfer", en: "Suppressor Use", text: "Using or possessing a suppressor.", jail: 12, fine: 15000 },
{ id: "§101", de: "Illegale Waffenlagerung", en: "Illegal Weapon Cache", text: "Maintaining an illegal weapon cache.", jail: 20, fine: 30000 },
{ id: "§102", de: "Waffenlieferung Gefängnis", en: "Weapon Smuggling into Prison", text: "Smuggling weapons into a correctional facility.", jail: 25, fine: 40000 },
{ id: "§103", de: "Waffe in öffentlichem Gebäude", en: "Weapon in Public Building", text: "Carrying a weapon inside a public building.", jail: 8, fine: 8000 },
{ id: "§104", de: "Bedrohung staatlicher Stellen", en: "Threatening Government with Weapon", text: "Threatening government officials with a weapon.", jail: 35, fine: 70000 },
{ id: "§105", de: "Militärwaffen Besitz", en: "Military Weapon Possession", text: "Possession of military-grade weapons.", jail: 45, fine: 90000 },
{ id: "§106", de: "Schwarzmarkt Waffenhandel", en: "Black Market Weapons", text: "Trading weapons on the black market.", jail: 40, fine: 80000 },
{ id: "§107", de: "Waffenlieferung Terrororganisation", en: "Supplying Terrorist Weapons", text: "Supplying weapons to terrorist organizations.", jail: 90, fine: 200000 },
{ id: "§108", de: "Illegaler Waffenexport", en: "Illegal Weapon Export", text: "Exporting weapons illegally.", jail: 50, fine: 100000 },
{ id: "§109", de: "Illegale Waffenauktion", en: "Illegal Weapon Auction", text: "Hosting or participating in illegal weapon auctions.", jail: 20, fine: 30000 },
{ id: "§110", de: "Waffentransport ohne Sicherung", en: "Unsafe Weapon Transport", text: "Transporting weapons without proper safety measures.", jail: 4, fine: 4000 },
{ id: "§111", de: "Besitz geringer Mengen Drogen", en: "Minor Drug Possession", text: "Possession of small quantities of illegal drugs.", jail: 1, fine: 1000 },
{ id: "§112", de: "Besitz mittlerer Mengen Drogen", en: "Drug Possession", text: "Possession of moderate quantities of illegal drugs.", jail: 3, fine: 3000 },
{ id: "§113", de: "Besitz großer Mengen Drogen", en: "Major Drug Possession", text: "Possession of large quantities of illegal drugs.", jail: 8, fine: 10000 },
{ id: "§114", de: "Drogenkonsum in Öffentlichkeit", en: "Public Drug Use", text: "Using illegal drugs in public.", jail: 1, fine: 1500 },
{ id: "§115", de: "Drogenhandel gering", en: "Minor Drug Dealing", text: "Selling small quantities of drugs.", jail: 5, fine: 6000 },
{ id: "§116", de: "Drogenhandel", en: "Drug Dealing", text: "Selling illegal drugs.", jail: 10, fine: 15000 },
{ id: "§117", de: "Schwerer Drogenhandel", en: "Major Drug Trafficking", text: "Large-scale trafficking of drugs.", jail: 25, fine: 40000 },
{ id: "§118", de: "Drogenimport", en: "Drug Importation", text: "Importing illegal drugs.", jail: 30, fine: 50000 },
{ id: "§119", de: "Drogenexport", en: "Drug Exportation", text: "Exporting illegal drugs.", jail: 30, fine: 50000 },
{ id: "§120", de: "Herstellung von Drogen", en: "Drug Manufacturing", text: "Manufacturing illegal drugs.", jail: 35, fine: 60000 },
{ id: "§121", de: "Drogenlabor Betrieb", en: "Operating Drug Lab", text: "Operating an illegal drug laboratory.", jail: 40, fine: 75000 },
{ id: "§122", de: "Besitz von Drogenutensilien", en: "Drug Paraphernalia", text: "Possession of drug-related equipment.", jail: 0, fine: 800 },
{ id: "§123", de: "Drogenverkauf an Minderjährige", en: "Selling Drugs to Minors", text: "Selling drugs to minors.", jail: 30, fine: 60000 },
{ id: "§124", de: "Drogenbesitz im Fahrzeug", en: "Drugs in Vehicle", text: "Possession of drugs inside a vehicle.", jail: 2, fine: 2500 },
{ id: "§125", de: "Drogen unter Bewährung", en: "Drug Offense on Probation", text: "Drug offenses committed while on probation.", jail: 6, fine: 7000 },
{ id: "§126", de: "Drogen unter Bewährung schwer", en: "Major Drug Offense on Probation", text: "Serious drug crimes while on probation.", jail: 15, fine: 20000 },
{ id: "§127", de: "Fahren unter Drogeneinfluss", en: "Driving Under Influence of Drugs", text: "Operating a vehicle while under influence of drugs.", jail: 5, fine: 4000 },
{ id: "§128", de: "Drogenhandel organisiert", en: "Organized Drug Trafficking", text: "Operating an organized drug trafficking ring.", jail: 45, fine: 90000 },
{ id: "§129", de: "Drogenfinanzierung", en: "Drug Financing", text: "Financing drug production or trafficking.", jail: 35, fine: 70000 },
{ id: "§130", de: "Geldwäsche durch Drogen", en: "Drug Money Laundering", text: "Laundering money from drug crimes.", jail: 30, fine: 80000 },
{ id: "§131", de: "Besitz synthetischer Drogen", en: "Synthetic Drug Possession", text: "Possession of synthetic drugs.", jail: 6, fine: 8000 },
{ id: "§132", de: "Herstellung synthetischer Drogen", en: "Synthetic Drug Manufacturing", text: "Manufacturing synthetic drugs.", jail: 40, fine: 90000 },
{ id: "§133", de: "Vertrieb synthetischer Drogen", en: "Synthetic Drug Distribution", text: "Distributing synthetic drugs.", jail: 30, fine: 70000 },
{ id: "§134", de: "Drogenkurier", en: "Drug Courier", text: "Transporting drugs for others.", jail: 12, fine: 20000 },
{ id: "§135", de: "Drogenlager", en: "Drug Storage Facility", text: "Maintaining a drug storage location.", jail: 20, fine: 35000 },
{ id: "§136", de: "Drogenverkauf im großen Stil", en: "Large Scale Drug Sales", text: "Selling drugs in very large quantities.", jail: 50, fine: 120000 },
{ id: "§137", de: "Drogen in staatlicher Einrichtung", en: "Drugs in Government Facility", text: "Possession of drugs in a government building.", jail: 8, fine: 12000 },
{ id: "§138", de: "Drogenhandel international", en: "International Drug Trafficking", text: "International trafficking of drugs.", jail: 60, fine: 150000 },
{ id: "§139", de: "Drogen an Gefangene", en: "Supplying Drugs to Prisoners", text: "Supplying drugs to inmates.", jail: 25, fine: 40000 },
{ id: "§140", de: "Drogen in Schule", en: "Drugs at School", text: "Possession or sale of drugs at a school.", jail: 20, fine: 30000 },
{ id: "§141", de: "Drogenrausch mit Gewalt", en: "Drug-Induced Violence", text: "Committing violent acts under drug influence.", jail: 15, fine: 25000 },
{ id: "§142", de: "Zwang zum Drogenkonsum", en: "Forced Drug Use", text: "Forcing another person to consume drugs.", jail: 35, fine: 60000 },
{ id: "§143", de: "Drogenbesitz im Sperrgebiet", en: "Drugs in Restricted Area", text: "Possession of drugs in restricted areas.", jail: 6, fine: 9000 },
{ id: "§144", de: "Medikamentenmissbrauch", en: "Prescription Drug Abuse", text: "Abuse of prescription medication.", jail: 3, fine: 3000 },
{ id: "§145", de: "Illegaler Medikamentenhandel", en: "Illegal Prescription Drug Trade", text: "Illegal trading of prescription drugs.", jail: 12, fine: 18000 },
{ id: "§146", de: "Drogenproduktion Plantage", en: "Drug Plantation", text: "Operating a drug-growing plantation.", jail: 30, fine: 50000 },
{ id: "§147", de: "Drogen unter Waffenbesitz", en: "Drugs with Weapon Possession", text: "Possessing drugs while armed.", jail: 18, fine: 30000 },
{ id: "§148", de: "Drogenflucht vor Polizei", en: "Drug Evasion", text: "Attempting to flee police while carrying drugs.", jail: 10, fine: 15000 },
{ id: "§149", de: "Drogen in großen Mengen Fahrzeug", en: "Drugs Transport Vehicle", text: "Transporting large quantities of drugs by vehicle.", jail: 22, fine: 40000 },
{ id: "§150", de: "Drogenkartell Mitgliedschaft", en: "Drug Cartel Membership", text: "Being a member of a drug cartel.", jail: 70, fine: 200000 },
{ id: "§151", de: "Diebstahl geringwertiger Sache", en: "Petty Theft", text: "Stealing property of low value.", jail: 1, fine: 500 },
{ id: "§152", de: "Diebstahl", en: "Theft", text: "Unlawfully taking another person's property.", jail: 3, fine: 2000 },
{ id: "§153", de: "Schwerer Diebstahl", en: "Grand Theft", text: "Stealing high-value property.", jail: 8, fine: 8000 },
{ id: "§154", de: "Einbruch", en: "Burglary", text: "Unlawful entry into a building to commit a crime.", jail: 10, fine: 10000 },
{ id: "§155", de: "Bewaffneter Einbruch", en: "Armed Burglary", text: "Burglary while armed.", jail: 18, fine: 20000 },
{ id: "§156", de: "Raub", en: "Robbery", text: "Taking property using force or intimidation.", jail: 15, fine: 15000 },
{ id: "§157", de: "Schwerer Raub", en: "Aggravated Robbery", text: "Robbery with severe violence or weapons.", jail: 30, fine: 40000 },
{ id: "§158", de: "Autoraub", en: "Carjacking", text: "Stealing a vehicle from a person using force.", jail: 25, fine: 30000 },
{ id: "§159", de: "Taschendiebstahl", en: "Pickpocketing", text: "Stealing items directly from another person.", jail: 2, fine: 1500 },
{ id: "§160", de: "Ladendiebstahl", en: "Shoplifting", text: "Stealing goods from a store.", jail: 1, fine: 1000 },
{ id: "§161", de: "Fahrzeugdiebstahl", en: "Vehicle Theft", text: "Stealing a motor vehicle.", jail: 8, fine: 10000 },
{ id: "§162", de: "Diebstahl aus Fahrzeug", en: "Theft from Vehicle", text: "Stealing items from a vehicle.", jail: 3, fine: 2500 },
{ id: "§163", de: "Fahrraddiebstahl", en: "Bicycle Theft", text: "Stealing a bicycle.", jail: 1, fine: 800 },
{ id: "§164", de: "Diebstahl staatlichen Eigentums", en: "Theft of Government Property", text: "Stealing government-owned property.", jail: 12, fine: 15000 },
{ id: "§165", de: "Sachbeschädigung gering", en: "Minor Vandalism", text: "Minor damage to property.", jail: 0, fine: 600 },
{ id: "§166", de: "Sachbeschädigung", en: "Vandalism", text: "Damaging another person's property.", jail: 2, fine: 2000 },
{ id: "§167", de: "Schwere Sachbeschädigung", en: "Aggravated Vandalism", text: "Severe or extensive property damage.", jail: 6, fine: 8000 },
{ id: "§168", de: "Brandstiftung gering", en: "Minor Arson", text: "Setting a small fire causing limited damage.", jail: 10, fine: 12000 },
{ id: "§169", de: "Brandstiftung", en: "Arson", text: "Intentionally setting property on fire.", jail: 25, fine: 30000 },
{ id: "§170", de: "Schwere Brandstiftung", en: "Aggravated Arson", text: "Arson causing major damage or risk to life.", jail: 45, fine: 70000 },
{ id: "§171", de: "Hehlerei", en: "Possession of Stolen Goods", text: "Possessing or reselling stolen property.", jail: 5, fine: 5000 },
{ id: "§172", de: "Betrug gering", en: "Minor Fraud", text: "Committing small-scale fraud.", jail: 1, fine: 1200 },
{ id: "§173", de: "Betrug", en: "Fraud", text: "Deceiving others for financial gain.", jail: 6, fine: 8000 },
{ id: "§174", de: "Schwerer Betrug", en: "Aggravated Fraud", text: "Large-scale or organized fraud.", jail: 15, fine: 25000 },
{ id: "§175", de: "Versicherungsbetrug", en: "Insurance Fraud", text: "Defrauding insurance companies.", jail: 8, fine: 12000 },
{ id: "§176", de: "Kreditkartenbetrug", en: "Credit Card Fraud", text: "Illegal use of credit cards.", jail: 7, fine: 10000 },
{ id: "§177", de: "Identitätsdiebstahl", en: "Identity Theft", text: "Stealing another person’s identity.", jail: 10, fine: 15000 },
{ id: "§178", de: "Einbruch in Fahrzeug", en: "Vehicle Burglary", text: "Breaking into a vehicle to steal property.", jail: 6, fine: 6000 },
{ id: "§179", de: "Tresordiebstahl", en: "Safe Theft", text: "Stealing a safe or its contents.", jail: 12, fine: 20000 },
{ id: "§180", de: "Raubüberfall auf Geschäft", en: "Store Robbery", text: "Robbing a commercial establishment.", jail: 20, fine: 30000 },
{ id: "§181", de: "Raubüberfall auf Bank", en: "Bank Robbery", text: "Robbing a bank.", jail: 40, fine: 80000 },
{ id: "§182", de: "Raubüberfall auf Geldtransport", en: "Armored Truck Robbery", text: "Robbing an armored money transport.", jail: 50, fine: 100000 },
{ id: "§183", de: "Erpressung gering", en: "Minor Extortion", text: "Extorting small sums through threats.", jail: 4, fine: 5000 },
{ id: "§184", de: "Erpressung", en: "Extortion", text: "Extorting money or goods through threats.", jail: 12, fine: 20000 },
{ id: "§185", de: "Schwere Erpressung", en: "Aggravated Extortion", text: "Large-scale or violent extortion.", jail: 25, fine: 40000 },
{ id: "§186", de: "Betrug mit öffentlichen Mitteln", en: "Public Funds Fraud", text: "Misusing or stealing public funds.", jail: 18, fine: 30000 },
{ id: "§187", de: "Sachbeschädigung an Infrastruktur", en: "Infrastructure Damage", text: "Damaging public infrastructure.", jail: 15, fine: 25000 },
{ id: "§188", de: "Zerstörung kritischer Infrastruktur", en: "Critical Infrastructure Sabotage", text: "Sabotaging critical infrastructure.", jail: 40, fine: 90000 },
{ id: "§189", de: "Plünderung", en: "Looting", text: "Stealing during emergencies or riots.", jail: 20, fine: 35000 },
{ id: "§190", de: "Organisierte Eigentumskriminalität", en: "Organized Property Crime", text: "Organized large-scale property crime.", jail: 35, fine: 60000 },
{ id: "§191", de: "Körperverletzung gering", en: "Minor Assault", text: "Causing minor physical harm to another person.", jail: 2, fine: 2000 },
{ id: "§192", de: "Körperverletzung", en: "Assault", text: "Causing bodily harm to another person.", jail: 5, fine: 5000 },
{ id: "§193", de: "Schwere Körperverletzung", en: "Aggravated Assault", text: "Causing serious bodily injury.", jail: 15, fine: 20000 },
{ id: "§194", de: "Körperverletzung mit Waffe", en: "Assault with Weapon", text: "Assault using a weapon.", jail: 20, fine: 30000 },
{ id: "§195", de: "Totschlag", en: "Manslaughter", text: "Killing another person without premeditation.", jail: 40, fine: 80000 },
{ id: "§196", de: "Mord", en: "Murder", text: "Premeditated killing of another person.", jail: 90, fine: 150000 },
{ id: "§197", de: "Versuchter Mord", en: "Attempted Murder", text: "Attempt to commit murder.", jail: 70, fine: 120000 },
{ id: "§198", de: "Entführung", en: "Kidnapping", text: "Unlawfully abducting a person.", jail: 45, fine: 70000 },
{ id: "§199", de: "Geiselnahme", en: "Hostage Taking", text: "Taking hostages to force demands.", jail: 60, fine: 100000 },
{ id: "§200", de: "Freiheitsberaubung", en: "False Imprisonment", text: "Unlawfully restraining a person.", jail: 8, fine: 10000 },
{ id: "§201", de: "Bedrohung", en: "Threats", text: "Threatening harm to another person.", jail: 3, fine: 3000 },
{ id: "§202", de: "Nötigung", en: "Coercion", text: "Forcing someone to act against their will.", jail: 6, fine: 8000 },
{ id: "§203", de: "Stalking", en: "Stalking", text: "Repeatedly harassing or following a person.", jail: 5, fine: 6000 },
{ id: "§204", de: "Häusliche Gewalt", en: "Domestic Violence", text: "Violence within a domestic relationship.", jail: 12, fine: 15000 },
{ id: "§205", de: "Misshandlung Schutzbefohlener", en: "Abuse of Dependent", text: "Abusing a dependent person.", jail: 18, fine: 25000 },
{ id: "§206", de: "Folter", en: "Torture", text: "Inflicting severe pain intentionally.", jail: 50, fine: 90000 },
{ id: "§207", de: "Vergewaltigung", en: "Rape", text: "Sexual assault without consent.", jail: 80, fine: 150000 },
{ id: "§208", de: "Sexuelle Nötigung", en: "Sexual Coercion", text: "Forcing sexual acts through threats.", jail: 40, fine: 70000 },
{ id: "§209", de: "Sexueller Übergriff", en: "Sexual Assault", text: "Non-consensual sexual contact.", jail: 25, fine: 40000 },
{ id: "§210", de: "Missbrauch Minderjähriger", en: "Child Abuse", text: "Abusing a minor.", jail: 90, fine: 200000 },
{ id: "§211", de: "Menschenhandel", en: "Human Trafficking", text: "Trading or exploiting human beings.", jail: 80, fine: 180000 },
{ id: "§212", de: "Zwangsprostitution", en: "Forced Prostitution", text: "Forcing individuals into prostitution.", jail: 70, fine: 150000 },
{ id: "§213", de: "Bandenkriminalität", en: "Gang Activity", text: "Participation in organized gang crime.", jail: 25, fine: 40000 },
{ id: "§214", de: "Bewaffnete Bande", en: "Armed Gang Membership", text: "Membership in an armed gang.", jail: 35, fine: 60000 },
{ id: "§215", de: "Aufruhr", en: "Riot", text: "Participating in a violent disturbance.", jail: 15, fine: 25000 },
{ id: "§216", de: "Landfriedensbruch", en: "Public Disorder", text: "Severe disturbance of public peace.", jail: 10, fine: 15000 },
{ id: "§217", de: "Widerstand gegen Vollstreckung", en: "Resisting Arrest", text: "Resisting law enforcement.", jail: 4, fine: 4000 },
{ id: "§218", de: "Angriff auf Beamte", en: "Assault on Officer", text: "Assaulting a law enforcement officer.", jail: 20, fine: 30000 },
{ id: "§219", de: "Bestechung", en: "Bribery", text: "Offering or accepting bribes.", jail: 10, fine: 20000 },
{ id: "§220", de: "Korruption", en: "Corruption", text: "Abuse of power for personal gain.", jail: 25, fine: 50000 },
{ id: "§221", de: "Amtsmissbrauch", en: "Abuse of Office", text: "Misuse of official authority.", jail: 15, fine: 30000 },
{ id: "§222", de: "Falschaussage", en: "False Testimony", text: "Providing false statements to authorities.", jail: 6, fine: 8000 },
{ id: "§223", de: "Meineid", en: "Perjury", text: "Lying under oath.", jail: 20, fine: 40000 },
{ id: "§224", de: "Justizbehinderung", en: "Obstruction of Justice", text: "Interfering with judicial proceedings.", jail: 12, fine: 20000 },
{ id: "§225", de: "Beweismittelmanipulation", en: "Evidence Tampering", text: "Altering or destroying evidence.", jail: 15, fine: 25000 },
{ id: "§226", de: "Gefangenenbefreiung", en: "Prison Break Assistance", text: "Assisting a prisoner to escape.", jail: 30, fine: 60000 },
{ id: "§227", de: "Ausbruch aus Haft", en: "Prison Escape", text: "Escaping from lawful custody.", jail: 20, fine: 30000 },
{ id: "§228", de: "Fluchthilfe", en: "Aiding Escape", text: "Helping a fugitive evade capture.", jail: 15, fine: 25000 },
{ id: "§229", de: "Falsche Identität", en: "False Identity", text: "Using a false identity.", jail: 5, fine: 6000 },
{ id: "§230", de: "Urkundenfälschung", en: "Forgery", text: "Creating or using forged documents.", jail: 10, fine: 15000 },
{ id: "§231", de: "Cyberkriminalität gering", en: "Minor Cybercrime", text: "Minor digital offenses.", jail: 3, fine: 4000 },
{ id: "§232", de: "Cyberkriminalität", en: "Cybercrime", text: "Serious digital criminal activity.", jail: 12, fine: 20000 },
{ id: "§233", de: "Hacking staatlicher Systeme", en: "Government System Hacking", text: "Hacking government systems.", jail: 30, fine: 60000 },
{ id: "§234", de: "Identitätsbetrug digital", en: "Digital Identity Fraud", text: "Online identity fraud.", jail: 8, fine: 12000 },
{ id: "§235", de: "Datenmanipulation", en: "Data Manipulation", text: "Manipulating digital data illegally.", jail: 10, fine: 15000 },
{ id: "§236", de: "Sabotage", en: "Sabotage", text: "Deliberate destruction to disrupt systems.", jail: 40, fine: 90000 },
{ id: "§237", de: "Terroristische Handlung", en: "Terrorist Act", text: "Committing acts of terrorism.", jail: 120, fine: 300000 },
{ id: "§238", de: "Terrorfinanzierung", en: "Terror Financing", text: "Financing terrorist activities.", jail: 80, fine: 200000 },
{ id: "§239", de: "Terrororganisation Mitgliedschaft", en: "Terror Organization Membership", text: "Membership in a terrorist organization.", jail: 100, fine: 250000 },
{ id: "§240", de: "Kriegsverbrechen", en: "War Crimes", text: "Crimes committed during war.", jail: 150, fine: 500000 },
{ id: "§241", de: "Verbrechen gegen die Menschlichkeit", en: "Crimes Against Humanity", text: "Severe crimes against civilians.", jail: 200, fine: 1000000 },
{ id: "§242", de: "Spionage", en: "Espionage", text: "Spying against the state.", jail: 80, fine: 200000 },
{ id: "§243", de: "Hochverrat", en: "High Treason", text: "Acts to overthrow the state.", jail: 200, fine: 1000000 },
{ id: "§244", de: "Staatsgefährdung", en: "Endangering the State", text: "Actions endangering national security.", jail: 120, fine: 300000 },
{ id: "§245", de: "Illegale Grenzübertritte", en: "Illegal Border Crossing", text: "Crossing borders illegally.", jail: 6, fine: 8000 },
{ id: "§246", de: "Menschenhandel über Grenze", en: "Cross-Border Human Trafficking", text: "Human trafficking across borders.", jail: 90, fine: 250000 },
{ id: "§247", de: "Schleusung", en: "Smuggling People", text: "Smuggling people illegally.", jail: 25, fine: 50000 },
{ id: "§248", de: "Falsche Staatsangehörigkeit", en: "False Citizenship", text: "Claiming false citizenship.", jail: 8, fine: 12000 },
{ id: "§249", de: "Wahlbetrug", en: "Election Fraud", text: "Manipulating election results.", jail: 30, fine: 60000 },
{ id: "§250", de: "Amtsanmaßung", en: "Impersonating Official", text: "Impersonating a government official.", jail: 6, fine: 9000 },
{ id: "§251", de: "Illegale Versammlung", en: "Illegal Assembly", text: "Participating in an illegal gathering.", jail: 3, fine: 4000 },
{ id: "§252", de: "Aufruf zu Gewalt", en: "Incitement to Violence", text: "Encouraging violent acts.", jail: 12, fine: 20000 },
{ id: "§253", de: "Hasskriminalität", en: "Hate Crime", text: "Crimes motivated by hatred.", jail: 25, fine: 40000 },
{ id: "§254", de: "Diskriminierende Gewalt", en: "Discriminatory Violence", text: "Violence based on discrimination.", jail: 35, fine: 60000 },
{ id: "§255", de: "Verletzung der Menschenwürde", en: "Violation of Human Dignity", text: "Severe violation of human dignity.", jail: 50, fine: 100000 },
{ id: "§256", de: "Verschwörung", en: "Criminal Conspiracy", text: "Planning serious crimes with others.", jail: 20, fine: 35000 },
{ id: "§257", de: "Beihilfe", en: "Aiding and Abetting", text: "Assisting in the commission of crimes.", jail: 10, fine: 15000 },
{ id: "§258", de: "Strafvereitelung", en: "Obstruction After the Fact", text: "Helping offenders evade punishment.", jail: 12, fine: 20000 },
{ id: "§259", de: "Unbefugter Start", en: "Unauthorized Takeoff", text: "Starten eines Luftfahrzeugs ohne Genehmigung oder Lizenz.", jail: 8, fine: 8000 },
{ id: "§260", de: "Fliegen ohne Pilotenlizenz", en: "Flying Without License", text: "Betrieb eines Flugzeugs oder Helikopters ohne gültige Fluglizenz.", jail: 15, fine: 12000 },
{ id: "§261", de: "Verstoß gegen Sperrgebiet", en: "Violation of No-Fly Zone", text: "Eindringen in eine militärische oder städtische No-Fly-Zone.", jail: 20, fine: 18000 },
{ id: "§262", de: "Tiefflug über Stadtgebiet", en: "Low Altitude Flight over City", text: "Fliegen unter der erlaubten Mindesthöhe über bebautem Gebiet.", jail: 10, fine: 10000 },
{ id: "§263", de: "Rücksichtsloses Flugverhalten", en: "Reckless Aerial Maneuvers", text: "Gefährdende Flugmanöver (Loopings, scharfe Kurven etc.) in bewohntem Gebiet.", jail: 12, fine: 15000 },
{ id: "§264", de: "Illegale Landung auf Straße", en: "Illegal Landing on Public Road", text: "Landung eines Helikopters oder Flugzeugs auf öffentlicher Straße oder Parkplatz.", jail: 18, fine: 20000 },
{ id: "§265", de: "Flucht nach Luftunfall", en: "Aerial Hit and Run", text: "Verlassen des Unfallorts nach Kollision in der Luft oder am Boden.", jail: 25, fine: 30000 },
{ id: "§266", de: "Schmuggel per Luftfahrzeug", en: "Smuggling via Aircraft", text: "Transport illegaler Güter (Drogen, Waffen) mit Flugzeug oder Helikopter.", jail: 50, fine: 60000 },
{ id: "§267", de: "Angriff aus der Luft", en: "Aerial Assault", text: "Abfeuern von Schusswaffen oder Abwerfen von Gegenständen aus einem Luftfahrzeug.", jail: 40, fine: 45000 },
{ id: "§268", de: "Unbefugter Drohnenbetrieb", en: "Unauthorized Drone Operation", text: "Betrieb einer Drohne ohne Registrierung oder in verbotenen Zonen.", jail: 5, fine: 4000 },
{ id: "§269", de: "Drohnen-Spionage", en: "Drone Spying / Surveillance", text: "Einsatz einer Drohne zur unbefugten Überwachung von Personen oder Grundstücken.", jail: 10, fine: 8000 },
{ id: "§270", de: "Fehlender Flugplan", en: "Failure to File Flight Plan", text: "Start ohne vorherige Einreichung eines Flugplans bei kontrolliertem Luftraum.", jail: 6, fine: 5000 },
{ id: "§271", de: "Störung der Flugsicherung", en: "Interfering with Air Traffic Control", text: "Funkstörung, falsche Angaben oder Behinderung der Luftverkehrskontrolle.", jail: 30, fine: 35000 },
{ id: "§272", de: "Luft-Frevel / Joyriding", en: "Aerial Joyriding", text: "Unbefugtes Übernehmen und Fliegen eines Luftfahrzeugs ohne Diebstahlsabsicht.", jail: 12, fine: 12000 },
{ id: "§273", de: "Luftfahrzeugdiebstahl", en: "Aerial Grand Theft Auto (Air)", text: "Diebstahl eines Helikopters, Flugzeugs oder anderer Luftfahrzeuge.", jail: 25, fine: 30000 },
{ id: "§274", de: "Verursachung Luftkollision", en: "Mid-Air Collision Caused", text: "Fahrlässiges oder vorsätzliches Verursachen einer Kollision in der Luft.", jail: 60, fine: 70000 },
{ id: "§275", de: "Fliegen unter Einfluss", en: "Aerial DUI", text: "Betrieb eines Luftfahrzeugs unter Alkohol- oder Drogeneinfluss.", jail: 30, fine: 40000 },
{ id: "§276", de: "Illegales Fallschirmspringen", en: "Illegal Parachute Jump", text: "Absprung aus einem Luftfahrzeug über verbotenem Gebiet oder ohne Genehmigung.", jail: 8, fine: 7000 },
{ id: "§277", de: "Verstoß Luftwerbung", en: "Aerial Advertising Violation", text: "Werbebanner oder -flüge ohne behördliche Erlaubnis.", jail: 4, fine: 3000 },
{ id: "§278", de: "Eindringen Militärluftraum", en: "Flying in Restricted Airspace (Military)", text: "Eindringen in militärisches Sperrgebiet oder Luftraumklasse R.", jail: 40, fine: 50000 },
{ id: "§279", de: "Laserpointer auf Flugzeug", en: "Laser Pointing at Aircraft", text: "Bestrahlen eines Luftfahrzeugs mit Laserpointer oder starkem Licht.", jail: 15, fine: 15000 },
{ id: "§280", de: "Luftkriminalitäts-Organisation", en: "Organized Aerial Crime Syndicate", text: "Leitung oder Beteiligung an organisierter Kriminalität mit Luftfahrzeugen.", jail: 90, fine: 90000 },
{ id: "§281", de: "Führen eines Bootes ohne Bootsführerschein", en: "Operating Boat Without License", text: "Betrieb eines motorisierten Wasserfahrzeugs ohne gültigen Bootsführerschein oder Sportbootführerschein.", jail: 3, fine: 2500 },
{ id: "§282", de: "Geschwindigkeitsüberschreitung auf dem Wasser (>48 km/h)", en: "Speeding on Water (over 30 knots)", text: "Überschreiten der zulässigen Höchstgeschwindigkeit auf Binnengewässern oder Küstengebieten.", jail: 2, fine: 1800 },
{ id: "§283", de: "Rücksichtsloses Führen eines Wasserfahrzeugs", en: "Reckless Operation of Vessel", text: "Gefährdendes Manövrieren eines Bootes, Jetskis oder anderer Wasserfahrzeuge (z. B. enge Kreise um Schwimmer).", jail: 6, fine: 5000 },
{ id: "§284", de: "Führen unter Alkoholeinfluss Stufe 1", en: "Boating Under Influence (BUI) Level 1", text: "BAC 0.08–0.15 beim Führen eines Wasserfahrzeugs.", jail: 8, fine: 6000 },
{ id: "§285", de: "Führen unter Alkoholeinfluss Stufe 2", en: "Boating Under Influence (BUI) Level 2", text: "BAC über 0.15 oder starke Beeinträchtigung beim Führen eines Wasserfahrzeugs.", jail: 15, fine: 12000 },
{ id: "§286", de: "Unfallflucht auf dem Wasser (Sachschaden)", en: "Hit and Run on Water (Property)", text: "Verlassen des Unfallorts nach Kollision mit einem anderen Boot oder einer Boje (Sachschaden).", jail: 5, fine: 4000 },
{ id: "§287", de: "Unfallflucht auf dem Wasser (Verletzung)", en: "Hit and Run on Water (Injury)", text: "Flucht nach Kollision mit Personenschaden.", jail: 20, fine: 18000 },
{ id: "§288", de: "Unfallflucht auf dem Wasser (Todesfall)", en: "Hit and Run on Water (Fatal)", text: "Flucht nach tödlichem Unfall auf dem Wasser.", jail: 60, fine: 50000 },
{ id: "§289", de: "Illegales Anlegen / Festmachen", en: "Illegal Mooring / Docking", text: "Anlegen an privatem Steg, Sperrgebiet oder Naturschutzgebiet ohne Erlaubnis.", jail: 1, fine: 1200 },
{ id: "§290", de: "Behinderung der Schifffahrtswege", en: "Waterway Obstruction", text: "Blockieren von Fahrrinnen, Häfen oder Rettungswegen durch Boot oder Treibgut.", jail: 4, fine: 3000 },
{ id: "§291", de: "Illegales Bootsrennen", en: "Illegal Water Racing", text: "Teilnahme an nicht genehmigten Rennen oder Geschwindigkeitswettbewerben auf dem Wasser.", jail: 10, fine: 8000 },
{ id: "§292", de: "Schmuggel per Wasserfahrzeug", en: "Smuggling via Vessel", text: "Transport illegaler Güter (Drogen, Waffen, Personen) mit Boot oder Yacht.", jail: 50, fine: 60000 },
{ id: "§293", de: "Seeräuberei / Bewaffnetes Entern", en: "Piracy / Armed Boarding", text: "Gewaltsames Entern eines anderen Wasserfahrzeugs mit Waffe.", jail: 80, fine: 75000 },
{ id: "§294", de: "Unterlassene Hilfeleistung auf See", en: "Failure to Render Assistance", text: "Nicht-Hilfeleistung bei Seenot oder Unfall in der Nähe.", jail: 12, fine: 10000 },
{ id: "§295", de: "Jetski in Sperrgebiet", en: "Operating Jetski in Restricted Area", text: "Fahren mit Jetski in Badezonen, Häfen oder Naturschutzgebieten.", jail: 4, fine: 3500 },
{ id: "§296", de: "Schießen vom Boot aus", en: "Discharging Firearm from Vessel", text: "Abfeuern von Schusswaffen von einem Wasserfahrzeug aus.", jail: 25, fine: 25000 },
{ id: "§297", de: "Illegale gewerbliche Fischerei", en: "Illegal Commercial Fishing", text: "Fischen ohne Lizenz oder in geschützten Zonen mit Netzen / Fallen.", jail: 8, fine: 7000 },
{ id: "§298", de: "Wasserfahrzeugdiebstahl", en: "Vessel Theft", text: "Diebstahl eines Bootes, Jetskis oder einer Yacht.", jail: 15, fine: 15000 },
{ id: "§299", de: "Fahren ohne Zulassung", en: "Operating Vessel Without Registration", text: "Betrieb eines nicht zugelassenen oder nicht gekennzeichneten Wasserfahrzeugs.", jail: 3, fine: 2500 },
{ id: "§300", de: "Verunreinigung durch Wasserfahrzeug", en: "Pollution from Vessel", text: "Einleiten von Öl, Kraftstoff, Müll oder Abwässern ins Wasser.", jail: 10, fine: 12000 },
{ id: "§301", de: "Verstoß gegen Wellenreiten-Regeln", en: "Wake Surfing Violation", text: "Wellenreiten (Wake Surfing) zu nah an Ufer, Schwimmern oder anderen Booten.", jail: 2, fine: 1800 },
{ id: "§302", de: "Keine Rettungswesten an Bord", en: "No Life Jackets On Board", text: "Nichtmitführen ausreichender Rettungswesten für alle Personen an Bord.", jail: 1, fine: 1000 },
{ id: "§303", de: "Minderjähriger Bootsführer", en: "Underage Operation of Vessel", text: "Führen eines motorisierten Wasserfahrzeugs unter 16 Jahren (oder ohne Aufsicht).", jail: 4, fine: 3000 },
{ id: "§304", de: "Hafen-/Steg-Hausfriedensbruch", en: "Harbor / Dock Trespassing", text: "Unbefugtes Betreten privater Yachthäfen oder Stege.", jail: 2, fine: 1500 },
{ id: "§305", de: "Illegale U-Boot-Nutzung", en: "Illegal Submarine Operation", text: "Betrieb oder Besitz eines nicht zugelassenen Tauchbootes / Mini-U-Boots.", jail: 40, fine: 50000 },
{ id: "§306", de: "Angriff aus dem Wasser auf Luftfahrzeug", en: "Aerial Assault from Vessel", text: "Beschießen oder Bedrohen eines Helikopters / Flugzeugs von einem Boot aus.", jail: 50, fine: 60000 },
{ id: "§307", de: "Organisierter See-Schmuggelring", en: "Organized Maritime Smuggling Ring", text: "Leitung oder maßgebliche Beteiligung an organisierter Schmuggeloperation per Schiff.", jail: 90, fine: 90000 },
{ id: "§308", de: "Fehlende Navigationslichter", en: "Failure to Display Navigation Lights", text: "Fahren bei Dunkelheit oder schlechter Sicht ohne Positionslichter.", jail: 2, fine: 1500 },
{ id: "§309", de: "Behinderung Seenotrettung", en: "Interfering with Marine Rescue", text: "Behinderung oder Gefährdung von Rettungskräften auf dem Wasser.", jail: 15, fine: 15000 },
{ id: "§310", de: "Maritimer Terrorismus", en: "Maritime Terrorism", text: "Vorsätzliche Gefährdung von Schiffen, Häfen oder Personen durch Sprengstoff, Rammen o. Ä.", jail: 120, fine: 90000 },

    
];

let cart = [];
function loadLaws(searchTerm = "") {
    const list = document.getElementById('law-list');
    if(!list) return;
    list.innerHTML = "";
    const term = searchTerm.toLowerCase();
    const filtered = LAWS.filter(l => l.id.toLowerCase().includes(term) || l.de.toLowerCase().includes(term) || (l.text && l.text.toLowerCase().includes(term)));
    if(filtered.length === 0) { list.innerHTML = "<div class='text-slate-500 text-xs p-2'>Kein Gesetz gefunden.</div>"; return; }
    const displayList = (term === "") ? filtered.slice(0, 50) : filtered;
    displayList.forEach(l => {
        list.innerHTML += `
            <div class="p-3 hover:bg-slate-700 cursor-pointer border-b border-slate-700/50 group" onclick="addToCart('${l.id}')">
                <div class="flex justify-between items-center mb-1"><span class="font-bold text-blue-400 text-xs bg-blue-900/20 px-1 rounded border border-blue-900">${l.id}</span><span class="text-green-400 font-mono font-bold">$${l.fine}</span></div>
                <div class="font-bold text-sm text-slate-200">${l.de}</div>
                <div class="text-[10px] text-slate-500 truncate group-hover:whitespace-normal group-hover:text-slate-300 transition-colors">${l.text || l.en}</div>
                ${l.jail > 0 ? `<div class="text-[10px] text-red-500 mt-1 font-bold">Haftzeit: ${l.jail} HE</div>` : ''}
            </div>`;
    });
    if(term === "" && LAWS.length > 50) list.innerHTML += "<div class='text-center text-[10px] text-slate-600 p-2 italic'>... tippe um mehr zu suchen ...</div>";
}
function addToCart(id) { const item = LAWS.find(l => l.id === id); if(item) { cart.push(item); renderCart(); } }
function renderCart() {
    const cartDiv = document.getElementById('calc-cart');
    if (cart.length === 0) { cartDiv.innerHTML = "<p class='text-slate-500 text-center italic mt-10 text-xs'>Klicke links auf Gesetze</p>"; updateTotal(); return; }
    cartDiv.innerHTML = "";
    cart.map((c, i) => {
        cartDiv.innerHTML += `
        <div class="flex justify-between items-center text-xs p-2 border-b border-slate-700 bg-slate-800/30 mb-1 rounded">
            <div class="flex flex-col"><span class="font-bold text-slate-300">${c.de}</span><span class="text-[10px] text-slate-500">${c.id}</span></div>
            <div class="flex items-center gap-3"><span class="text-green-500">$${c.fine}</span>${c.jail > 0 ? `<span class="text-red-500 border border-red-900 px-1 rounded">${c.jail} HE</span>` : ''}<button onclick="cart.splice(${i},1);renderCart()" class="text-slate-500 hover:text-red-500 font-bold px-2">✕</button></div>
        </div>`;
    });
    updateTotal();
}
function updateTotal() {
    let sum = cart.reduce((a, b) => a + (b.fine || 0), 0);
    let jail = cart.reduce((a, b) => a + (b.jail || 0), 0);
    const perc = document.getElementById('calc-percent').value / 100;
    document.getElementById('calc-total').innerText = "$" + (sum * perc).toFixed(0);
    document.getElementById('calc-jail').value = jail;
}

// ==========================================
// 9. EMPLOYEES
// ==========================================
async function renderEmployeePanel() {
    const list = document.getElementById('employee-list'); if(!list) return;
    const snap = await db.collection('users').get();
    list.innerHTML = "";
    snap.forEach(doc => {
        const u = doc.data();
        list.innerHTML += `<div class="flex justify-between p-2 bg-slate-800/50 mb-1 rounded border border-slate-700 items-center"><div><span class="font-bold text-blue-400">${doc.id}</span> <span class="text-xs text-slate-500">(${u.rank})</span></div><button onclick="removeUser('${doc.id}')" class="text-red-500 text-xs">Entfernen</button></div>`;
    });
}
async function uiRegisterEmployee() {
    const u = document.getElementById('m-user').value; const p = document.getElementById('m-pass').value; const d = document.getElementById('m-dept').value; const r = document.getElementById('m-rank').value;
    if(!u || !p) return alert("Daten fehlen.");
    await db.collection('users').doc(u).set({ password: p, department: d, rank: r });
    alert("Angelegt."); renderEmployeePanel();
}
async function removeUser(id) { if(confirm("Löschen?")) { await db.collection('users').doc(id).delete(); renderEmployeePanel(); } }

// ==========================================
// 10. SPECIAL
// ==========================================
async function loadCourtRecords() {
    const list = document.getElementById('court-record-list'); if(!list) return;
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

// ==========================================
// 11. NEUE STRAFAKTEN (RECORDS)
// ==========================================
async function liveSearchSuspectRecord(query) {
    const dropdown = document.getElementById('record-suspect-dropdown');
    if (!query || query.length < 2) { dropdown.classList.add('hidden'); return; }
    try {
        const snapshot = await db.collection('persons').where('searchKey', '>=', query.toLowerCase()).where('searchKey', '<=', query.toLowerCase() + '\uf8ff').limit(5).get();
        dropdown.innerHTML = ""; dropdown.classList.remove('hidden'); dropdown.style.zIndex = "9999"; 
        if (snapshot.empty) { dropdown.innerHTML = "<div class='p-3 text-xs text-slate-500'>Keine Person gefunden.</div>"; return; }
        snapshot.forEach(doc => {
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
// 12. DASHBOARD / BOLO
// ==========================================
let boloUnsubscribe = null;
function initDashboard() {
    if(boloUnsubscribe) boloUnsubscribe();
    const list = document.getElementById('bolo-list'); if(!list) return;
    if(currentUser) document.getElementById('dash-user-name').innerText = currentUser.username;
    boloUnsubscribe = db.collection('bolos').orderBy('timestamp', 'desc').limit(20).onSnapshot(snapshot => {
        list.innerHTML = "";
        if(snapshot.empty) { list.innerHTML = "<div class='text-center text-slate-600 py-10 italic'>Keine aktiven Meldungen. Ruhige Schicht! ☕</div>"; return; }
        snapshot.forEach(doc => {
            const b = doc.data();
            let borderClass = "border-blue-500", bgClass = "bg-slate-800/50", icon = "ℹ️";
            if (b.priority === 'high') { borderClass = "border-red-600"; bgClass = "bg-red-900/20"; icon = "🚨"; } 
            else if (b.priority === 'warn') { borderClass = "border-yellow-500"; bgClass = "bg-yellow-900/10"; icon = "⚠️"; }
            const canDelete = (currentUser.username === b.author || currentUser.rank.includes('Command') || currentUser.rank === 'Attorney General');
            const deleteBtn = canDelete ? `<button onclick="deleteBOLO('${doc.id}')" class="text-slate-500 hover:text-red-500 ml-3" title="Löschen">✕</button>` : '';
            const time = b.timestamp ? b.timestamp.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '';
            list.innerHTML += `
                <div class="glass-panel p-3 rounded border-l-4 ${borderClass} ${bgClass} flex gap-3 relative animate-fadeIn">
                    <div class="text-2xl pt-1">${icon}</div>
                    <div class="flex-1">
                        <div class="flex justify-between items-start"><h4 class="font-bold text-slate-200 text-sm">${b.title}</h4><div class="flex items-center"><span class="text-[10px] font-mono text-slate-400 mr-2">${time} Uhr</span>${deleteBtn}</div></div>
                        <p class="text-xs text-slate-300 mt-1 whitespace-pre-wrap">${b.content}</p>
                        <p class="text-[10px] text-slate-500 mt-2 text-right">Meldung von: ${b.author}</p>
                    </div>
                </div>`;
        });
    });
}
async function saveBOLO() {
    const title = document.getElementById('bolo-title').value; const content = document.getElementById('bolo-content').value; const priority = document.getElementById('bolo-priority').value;
    if(!title || !content) return alert("Bitte Betreff und Text eingeben.");
    try { await db.collection('bolos').add({ title, content, priority, author: currentUser.username, timestamp: firebase.firestore.FieldValue.serverTimestamp() }); document.getElementById('bolo-title').value = ""; document.getElementById('bolo-content').value = ""; } catch(e) { console.error(e); }
}
async function deleteBOLO(id) { if(confirm("Löschen?")) await db.collection('bolos').doc(id).delete(); }

// ==========================================
// 13. STATUS / DISPATCH
// ==========================================
async function updateMyStatus(newStatus) {
    if(!currentUser || !currentUser.username) return;
    const indicator = document.getElementById('status-indicator');
    if(indicator) {
        if(newStatus === '10-8') indicator.className = "h-2 w-2 rounded-full bg-green-500 shadow-[0_0_10px_#22c55e]";
        else if(newStatus === '10-6') indicator.className = "h-2 w-2 rounded-full bg-yellow-500 shadow-[0_0_10px_#eab308]";
        else indicator.className = "h-2 w-2 rounded-full bg-red-500";
    }
    try { await db.collection('users').doc(currentUser.username).set({ status: newStatus, lastStatusChange: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true }); } catch(e) { console.error("Status Update Fehler:", e); }
}

let dispatchUnsubscribe = null;
function initDispatchMonitor() {
    if(dispatchUnsubscribe) dispatchUnsubscribe();
    const listLSPD = document.getElementById('dispatch-list-lspd'); const listLSMS = document.getElementById('dispatch-list-lsms');
    if(!listLSPD || !listLSMS) return; 
    dispatchUnsubscribe = db.collection('users').onSnapshot(snapshot => {
        listLSPD.innerHTML = ""; listLSMS.innerHTML = ""; let cLSPD = 0, cLSMS = 0;
        snapshot.forEach(doc => {
            const u = doc.data(); const unitName = doc.id;
            if (!u.status || u.status === '10-7') return;
            let colorClass = "text-green-500 border-green-500/30 bg-green-900/10";
            if(u.status === '10-6') colorClass = "text-yellow-500 border-yellow-500/30 bg-yellow-900/10";
            const html = `
                <div class="flex justify-between items-center p-3 rounded border border-slate-700 bg-slate-800 mb-2 animate-fadeIn shadow-sm">
                    <div class="font-bold text-white text-sm pl-2">${unitName}</div>
                    <div class="px-3 py-1 rounded text-xs font-mono font-bold border ${colorClass}">${u.status}</div>
                </div>`;
            if (u.department === 'MARSHAL' || u.department === 'LSMS' || (u.department && u.department.includes('Marshal'))) { listLSMS.innerHTML += html; cLSMS++; } else { listLSPD.innerHTML += html; cLSPD++; }
        });
        if(document.getElementById('count-lspd')) document.getElementById('count-lspd').innerText = cLSPD;
        if(document.getElementById('count-lsms')) document.getElementById('count-lsms').innerText = cLSMS;
    });
}

console.log("SYSTEM GELADEN: ENDE");
