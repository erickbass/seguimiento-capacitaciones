// 1. SUPABASE CLOUD DATABASE INITIALIZATION
const SUPABASE_URL = 'https://pivngvqanpdwdqklpucw.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_8VIqmFG84Vvg2-eeIgpDsg_6s7tAJjP';

const supabase = (window.supabase && window.supabase.createClient) 
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

// IndexedDB Fallback / Local Cache
const localDb = new Dexie('intecap_capacita_db');
localDb.version(5).stores({
    events: '++id, numero_evento, nombre_evento, consultor, instructor, fecha_inicio, fecha_fin, estado_evento, contraparte',
    users: 'username, role, password',
    followups: '++id, numero_evento, date, user, note'
});

// Database Adapter (Conecta a Supabase en la nube con compatibilidad transparente)
const db = {
    events: {
        async toArray() {
            if (supabase) {
                try {
                    const { data: events, error } = await supabase.from('events').select('*').order('id', { ascending: false });
                    if (!error && events) {
                        // También obtener los followups asociados
                        const { data: followups } = await supabase.from('followups').select('*');
                        const fMap = {};
                        (followups || []).forEach(f => {
                            if (!fMap[f.numero_evento]) fMap[f.numero_evento] = [];
                            fMap[f.numero_evento].push(f);
                        });
                        return events.map(e => ({
                            ...e,
                            followups: fMap[e.numero_evento] || []
                        }));
                    }
                } catch (e) {
                    console.warn("Supabase fetch failed, falling back to localDb", e);
                }
            }
            return await localDb.events.toArray();
        },
        async get(id) {
            if (supabase) {
                try {
                    const { data, error } = await supabase.from('events').select('*').eq('id', id).single();
                    if (!error && data) {
                        const { data: followups } = await supabase.from('followups').select('*').eq('numero_evento', data.numero_evento);
                        return { ...data, followups: followups || [] };
                    }
                } catch (e) {
                    console.warn("Supabase get failed", e);
                }
            }
            return await localDb.events.get(id);
        },
        async add(eventData) {
            if (supabase) {
                try {
                    const { followups, ...cleanEvent } = eventData;
                    const { data, error } = await supabase.from('events').insert([cleanEvent]).select().single();
                    if (!error && data) return data.id;
                } catch (e) {
                    console.warn("Supabase add failed", e);
                }
            }
            return await localDb.events.add(eventData);
        },
        async update(id, updates) {
            if (supabase) {
                try {
                    const { followups, id: _id, ...cleanUpdates } = updates;
                    cleanUpdates.updated_at = new Date().toISOString();
                    await supabase.from('events').update(cleanUpdates).eq('id', id);
                } catch (e) {
                    console.warn("Supabase update failed", e);
                }
            }
            return await localDb.events.update(id, updates);
        },
        async delete(id) {
            if (supabase) {
                try {
                    const event = await this.get(id);
                    if (event && event.numero_evento) {
                        await supabase.from('followups').delete().eq('numero_evento', event.numero_evento);
                    }
                    await supabase.from('events').delete().eq('id', id);
                } catch (e) {
                    console.warn("Supabase delete failed", e);
                }
            }
            return await localDb.events.delete(id);
        },
        async clear() {
            if (supabase) {
                try {
                    await supabase.from('followups').delete().neq('id', 0);
                    await supabase.from('events').delete().neq('id', 0);
                } catch (e) {
                    console.warn("Supabase clear failed", e);
                }
            }
            return await localDb.events.clear();
        },
        async count() {
            if (supabase) {
                try {
                    const { count, error } = await supabase.from('events').select('*', { count: 'exact', head: true });
                    if (!error && typeof count === 'number') return count;
                } catch (e) {
                    console.warn("Supabase count failed", e);
                }
            }
            return await localDb.events.count();
        },
        where(field) {
            return {
                equals: (val) => ({
                    first: async () => {
                        if (supabase) {
                            try {
                                const { data, error } = await supabase.from('events').select('*').eq(field, val).maybeSingle();
                                if (!error && data) {
                                    const { data: followups } = await supabase.from('followups').select('*').eq('numero_evento', data.numero_evento);
                                    return { ...data, followups: followups || [] };
                                }
                            } catch (e) {
                                console.warn("Supabase where query failed", e);
                            }
                        }
                        return await localDb.events.where(field).equals(val).first();
                    }
                })
            };
        }
    },
    users: {
        async toArray() {
            if (supabase) {
                try {
                    const { data, error } = await supabase.from('users').select('*').order('username');
                    if (!error && data) return data;
                } catch (e) {
                    console.warn("Supabase users fetch failed", e);
                }
            }
            return await localDb.users.toArray();
        },
        async get(username) {
            if (supabase) {
                try {
                    const { data, error } = await supabase.from('users').select('*').eq('username', username).maybeSingle();
                    if (!error && data) return data;
                } catch (e) {
                    console.warn("Supabase user get failed", e);
                }
            }
            return await localDb.users.get(username);
        },
        async put(userObj) {
            if (supabase) {
                try {
                    await supabase.from('users').upsert([userObj], { onConflict: 'username' });
                } catch (e) {
                    console.warn("Supabase user put failed", e);
                }
            }
            return await localDb.users.put(userObj);
        },
        async delete(username) {
            if (supabase) {
                try {
                    await supabase.from('users').delete().eq('username', username);
                } catch (e) {
                    console.warn("Supabase user delete failed", e);
                }
            }
            return await localDb.users.delete(username);
        },
        where(field) {
            return {
                equals: (val) => ({
                    toArray: async () => {
                        if (supabase) {
                            try {
                                const { data, error } = await supabase.from('users').select('*').eq(field, val).order('username');
                                if (!error && data) return data;
                            } catch (e) {
                                console.warn("Supabase users where failed", e);
                            }
                        }
                        return await localDb.users.where(field).equals(val).toArray();
                    }
                })
            };
        }
    },
    followups: {
        async add(followupObj) {
            if (supabase) {
                try {
                    const { data, error } = await supabase.from('followups').insert([followupObj]).select().single();
                    if (!error && data) return data.id;
                } catch (e) {
                    console.warn("Supabase followup add failed", e);
                }
            }
            return await localDb.followups.add(followupObj);
        }
    }
};

// Create indexes to speed up participant queries
// Dexie supports multi-entry or compound indexes, but simple indexing is enough for our size.

// Global state variables
let excelDataRaw = null; // Stored parsed excel data waiting for mapping
let activeTab = 'dashboard';
let currentEditingEventId = null;
let charts = {}; // Store Chart.js instances
let currentRole = 'admin'; // 'admin' or 'consultor'
let currentUserName = 'Administrador';
let currentSubview = 'sin-participantes'; // default subview is now 'sin-participantes' (events with 0 participants)

// DOM Elements
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const mappingCard = document.getElementById('mapping-card');
const mappingForm = document.getElementById('mapping-form');
const toastEl = document.getElementById('toast');
const toastMessageEl = document.getElementById('toast-message');
const toastIconEl = document.getElementById('toast-icon');

// Navigation Elements
const views = document.querySelectorAll('.content-view');
const navItems = document.querySelectorAll('.nav-item');
const pageTitleEl = document.getElementById('page-title');

// 1.5 USER PROFILE AND SESSION SYSTEM
async function applySession(role, name) {
    currentRole = role;
    currentUserName = name;
    
    // Guardar en localStorage
    localStorage.setItem('session_role', role);
    localStorage.setItem('session_name', name);
    
    // Aplicar clase CSS para ocultación condicional
    if (role === 'admin') {
        document.body.classList.remove('role-consultant');
        document.body.classList.remove('role-supervisor');
    } else if (role === 'supervisor') {
        document.body.classList.remove('role-consultant');
        document.body.classList.add('role-supervisor');
    } else if (role === 'consultor') {
        document.body.classList.add('role-consultant');
        document.body.classList.remove('role-supervisor');
    }
    
    // Actualizar UI del perfil en barra lateral
    const usernameEl = document.getElementById('sidebar-username');
    const userroleEl = document.getElementById('sidebar-userrole');
    const avatarEl = document.getElementById('sidebar-avatar');
    
    if (usernameEl) usernameEl.textContent = name;
    
    let roleText = 'Consultor';
    if (role === 'admin') {
        roleText = 'Administrador';
    } else if (role === 'supervisor') {
        roleText = 'Supervisor';
    }
    if (userroleEl) userroleEl.textContent = roleText;
    
    if (avatarEl) {
        const parts = name.split(' ');
        let initials = 'A';
        if (role === 'admin') {
            initials = 'AD';
        } else if (role === 'supervisor') {
            initials = 'SV';
        } else if (parts.length >= 2) {
            initials = (parts[0][0] + parts[1][0]).toUpperCase();
        } else if (parts.length === 1) {
            initials = parts[0][0].toUpperCase();
        }
        avatarEl.textContent = initials;
    }
    
    // Ocultar pantalla de login
    const loginScreen = document.getElementById('login-screen');
    if (loginScreen) {
        loginScreen.classList.remove('active');
        loginScreen.style.display = 'none';
    }
    
    // Redirigir si no es admin y está en pestaña no permitida
    const hash = window.location.hash.substring(1) || 'dashboard';
    if (role !== 'admin' && (hash === 'importar' || hash === 'usuarios')) {
        window.location.hash = 'dashboard';
        switchView('dashboard');
    } else {
        switchView(hash);
    }
    
    await updateDatabaseStatusText();
}

function logout() {
    localStorage.removeItem('session_role');
    localStorage.removeItem('session_name');
    
    const loginScreen = document.getElementById('login-screen');
    if (loginScreen) {
        loginScreen.style.display = 'flex';
        loginScreen.classList.add('active');
    }
    
    populateLoginConsultantsList();
}

async function populateLoginConsultantsList() {
    const select = document.getElementById('login-consultor-select');
    const emptyMsg = document.getElementById('login-consultor-empty-msg');
    const consultantRadio = document.querySelector('input[name="login-role"][value="consultor"]');
    
    if (!select) return;
    
    // Cargar consultores existentes directamente de la tabla de usuarios
    const allUsers = await db.users.where('role').equals('consultor').toArray();
    const consultants = allUsers.map(u => u.username).filter(name => name !== 'No Asignado').sort();
    
    select.innerHTML = '';
    
    if (consultants.length === 0) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = 'No hay consultores cargados';
        select.appendChild(opt);
        
        if (emptyMsg) emptyMsg.style.display = 'block';
        if (consultantRadio) {
            consultantRadio.disabled = true;
            document.querySelector('input[name="login-role"][value="admin"]').checked = true;
            document.getElementById('login-consultor-group').style.display = 'none';
        }
    } else {
        if (emptyMsg) emptyMsg.style.display = 'none';
        if (consultantRadio) consultantRadio.disabled = false;
        
        consultants.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c;
            opt.textContent = c;
            select.appendChild(opt);
        });
    }
}

function initLoginListeners() {
    const roleRadios = document.querySelectorAll('input[name="login-role"]');
    const consultorGroup = document.getElementById('login-consultor-group');
    const loginForm = document.getElementById('login-form');
    const logoutBtn = document.getElementById('btn-logout');
    
    roleRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.value === 'consultor') {
                consultorGroup.style.display = 'block';
            } else {
                consultorGroup.style.display = 'none';
            }
        });
    });
    
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const selectedRoleEl = document.querySelector('input[name="login-role"]:checked');
            const selectedRole = selectedRoleEl ? selectedRoleEl.value : 'admin';
            const passwordInput = (document.getElementById('login-password-input').value || '').trim();
            
            try {
                if (selectedRole === 'admin') {
                    const adminUser = await db.users.get('Administrador');
                    const adminPassword = (adminUser && adminUser.password) ? adminUser.password : 'admin';
                    
                    if (passwordInput.toLowerCase() === 'admin' || passwordInput === adminPassword) {
                        await applySession('admin', 'Administrador');
                        showToast("Bienvenido, Administrador");
                    } else {
                        showToast("Contraseña incorrecta. Recuerda que la contraseña por defecto es 'admin'.", "error");
                    }
                } else if (selectedRole === 'supervisor') {
                    const supervisorUser = await db.users.get('Supervisor');
                    const supervisorPassword = (supervisorUser && supervisorUser.password) ? supervisorUser.password : 'supervisor';
                    
                    if (passwordInput.toLowerCase() === 'supervisor' || passwordInput === supervisorPassword) {
                        await applySession('supervisor', 'Supervisor');
                        showToast("Bienvenido, Supervisor");
                    } else {
                        showToast("Contraseña incorrecta. Recuerda que la contraseña por defecto es 'supervisor'.", "error");
                    }
                } else {
                    const selectedConsultor = document.getElementById('login-consultor-select').value;
                    if (!selectedConsultor) {
                        showToast("Por favor selecciona un consultor de la lista.", "warning");
                        return;
                    }
                    
                    const consultorUser = await db.users.get(selectedConsultor);
                    const consultorPassword = (consultorUser && consultorUser.password) ? consultorUser.password : '123';
                    
                    if (passwordInput === '123' || passwordInput === consultorPassword) {
                        await applySession('consultor', selectedConsultor);
                        showToast(`Bienvenido, ${selectedConsultor}`);
                    } else {
                        showToast("Contraseña incorrecta para el consultor seleccionado.", "error");
                    }
                }
            } catch (err) {
                console.error("Error en login:", err);
                // Fallback seguro de emergencia
                if (selectedRole === 'admin' && passwordInput.toLowerCase() === 'admin') {
                    await applySession('admin', 'Administrador');
                } else if (selectedRole === 'supervisor' && passwordInput.toLowerCase() === 'supervisor') {
                    await applySession('supervisor', 'Supervisor');
                } else {
                    showToast("Error al verificar credenciales.", "error");
                }
            }
        });
    }
    
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    }
}

// Initialize Lucide Icons
function initIcons() {
    if (window.lucide) {
        window.lucide.createIcons();
    }
}

// 2. TOAST NOTIFICATION SYSTEM
function showToast(message, type = 'success') {
    toastMessageEl.textContent = message;
    toastEl.className = `toast active ${type}`;
    
    // Set appropriate icon
    let iconName = 'check-circle';
    if (type === 'error') iconName = 'alert-triangle';
    if (type === 'warning') iconName = 'alert-circle';
    if (type === 'info') iconName = 'info';
    
    toastIconEl.setAttribute('data-lucide', iconName);
    initIcons();

    setTimeout(() => {
        toastEl.classList.remove('active');
    }, 4000);
}

// 3. NAVIGATION CONTROL
function switchView(viewId) {
    views.forEach(view => {
        view.classList.remove('active');
    });
    
    const targetView = document.getElementById(`view-${viewId}`);
    if (targetView) {
        targetView.classList.add('active');
    }

    navItems.forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('href') === `#${viewId}`) {
            item.classList.add('active');
        }
    });

    // Update Header Title
    const titles = {
        'dashboard': 'Panel de Control (Dashboard)',
        'eventos': 'Seguimiento de Eventos',
        'reportes': 'Reportes de Seguimiento',
        'importar': 'Importar Archivo de Excel',
        'usuarios': 'Gestión de Usuarios y Accesos'
    };
    pageTitleEl.textContent = titles[viewId] || 'Gestor de Capacitaciones';
    activeTab = viewId;

    if (viewId === 'dashboard') {
        renderDashboard();
    } else if (viewId === 'eventos') {
        renderEventsTable();
        populateFilterDropdowns();
    } else if (viewId === 'reportes') {
        renderReportView();
        populateReportFilters();
    } else if (viewId === 'usuarios') {
        renderUsersTable();
    }
}

// Handle routing via hash
window.addEventListener('hashchange', () => {
    const hash = window.location.hash.substring(1) || 'dashboard';
    // Validate hash
    if (['dashboard', 'eventos', 'importar', 'usuarios'].includes(hash)) {
        switchView(hash);
    }
});

// 4. THEME MANAGEMENT (LIGHT/DARK)
const themeBtn = document.getElementById('theme-btn');
const darkIcon = themeBtn.querySelector('.dark-icon');
const lightIcon = themeBtn.querySelector('.light-icon');

function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
        darkIcon.style.display = 'none';
        lightIcon.style.display = 'block';
    } else {
        document.body.classList.remove('dark-theme');
        darkIcon.style.display = 'block';
        lightIcon.style.display = 'none';
    }
}

themeBtn.addEventListener('click', () => {
    const isDark = document.body.classList.toggle('dark-theme');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    
    if (isDark) {
        darkIcon.style.display = 'none';
        lightIcon.style.display = 'block';
    } else {
        darkIcon.style.display = 'block';
        lightIcon.style.display = 'none';
    }
    
    // Re-render charts to adjust text colors
    if (activeTab === 'dashboard') {
        renderDashboard();
    }
});

// 5. EXCEL PROCESSING UTILITIES
// Converts Excel Date serial number to JS Date String (YYYY-MM-DD)
function parseExcelDate(val) {
    if (!val) return '';
    
    // Check if it's a number (Excel Serial Date)
    if (typeof val === 'number') {
        // Excel serial date starting from Dec 30, 1899
        const date = new Date((val - 25569) * 86400 * 1000);
        // Adjust timezone offset
        const tzOffset = date.getTimezoneOffset() * 60000;
        const localDate = new Date(date.getTime() + tzOffset);
        
        return localDate.toISOString().split('T')[0];
    }
    
    // Check if it's already a date string (e.g. YYYY-MM-DD or DD/MM/YYYY)
    const dateStr = String(val).trim();
    
    // Match DD/MM/YYYY
    const dmyRegex = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/;
    const dmyMatch = dateStr.match(dmyRegex);
    if (dmyMatch) {
        const day = dmyMatch[1].padStart(2, '0');
        const month = dmyMatch[2].padStart(2, '0');
        const year = dmyMatch[3];
        return `${year}-${month}-${day}`;
    }
    
    // Match YYYY-MM-DD
    const ymdRegex = /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/;
    const ymdMatch = dateStr.match(ymdRegex);
    if (ymdMatch) {
        const year = ymdMatch[1];
        const month = ymdMatch[2].padStart(2, '0');
        const day = ymdMatch[3].padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    
    // Try native parser
    const parsed = Date.parse(dateStr);
    if (!isNaN(parsed)) {
        return new Date(parsed).toISOString().split('T')[0];
    }
    
    return dateStr; // Fallback
}

// Map participant status values to strict "Inscrito" or "No Inscrito"
function parseParticipantStatus(statusVal) {
    if (!statusVal) return 'No Inscrito';
    
    const str = String(statusVal).toLowerCase().trim();
    if (
        str.includes('no') ||
        str.includes('deser') ||
        str.includes('retir') ||
        str.includes('baja') ||
        str === '0' ||
        str === 'false'
    ) {
        return 'No Inscrito';
    }
    
    if (
        str.includes('inscrito') ||
        str.includes('si') ||
        str.includes('sí') ||
        str.includes('activo') ||
        str.includes('aprobado') ||
        str === '1' ||
        str === 'true'
    ) {
        return 'Inscrito';
    }
    
    // Default fallback
    return 'Inscrito';
}

// 6. EXCEL DRAG & DROP / UPLOAD HANDLER
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => dropZone.classList.add('dragover'), false);
});

['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => dropZone.classList.remove('dragover'), false);
});

dropZone.addEventListener('drop', handleDrop, false);
fileInput.addEventListener('change', handleFileSelect, false);

function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0) {
        processUploadedFile(files[0]);
    }
}

function handleFileSelect(e) {
    const files = e.target.files;
    if (files.length > 0) {
        processUploadedFile(files[0]);
    }
}

// Read the uploaded file with SheetJS
// Read the uploaded file with SheetJS and import immediately
function processUploadedFile(file) {
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            
            // Get first sheet name
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            
            // Convert to JSON (row objects) starting from row 4 (range: 3)
            // Using header: 1 to get raw arrays for exact column matching
            const dataRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, range: 3, defval: "" });
            
            if (dataRows.length <= 1) {
                showToast("El archivo de Excel parece estar vacío o no contiene datos válidos a partir de la fila 4.", "error");
                return;
            }
            
            showToast("Importando datos desde el archivo de Excel...", "info");
            
            showToast("Procesando e integrando datos del Excel...", "info");
            
            // 1. Marcar todos los eventos existentes como inactivos (archivados) antes de la fusión
            await db.events.toCollection().modify({ activo: false });
            
            let insertedCount = 0;
            let updatedCount = 0;
            const consultoresSet = new Set();
            
            // Start from index 1 (skipping row 4 header row)
            for (let i = 1; i < dataRows.length; ++i) {
                const row = dataRows[i];
                if (!row || row.length === 0) continue;
                
                const nombre_evento = String(row[5] || '').trim();
                const numero_evento = String(row[6] || '').trim();
                
                if (!nombre_evento && !numero_evento) continue;
                
                const fecha_inicio = parseExcelDate(row[7]);
                const fecha_fin = parseExcelDate(row[8]);
                const nombre_producto = String(row[10] || '').trim();
                
                const hombres_inscritos = parseInt(row[11]) || 0;
                const mujeres_inscritas = parseInt(row[12]) || 0;
                const total_inscritos = parseInt(row[13]) || 0;
                const no_inscritos = parseInt(row[16]) || 0; // Columna Q (No Inscritos)
                
                const cNombre = String(row[17] || '').trim();
                const cApellido = String(row[18] || '').trim();
                const consultor = `${cNombre} ${cApellido}`.trim() || 'No Asignado';
                
                const estado_evento = String(row[24] || 'No inscrito').trim();
                const contraparte = String(row[25] || '').trim() || 'No Asignada';
                const instructor = String(row[26] || '').trim() || 'No Asignado';
                
                if (consultor !== 'No Asignado') {
                    consultoresSet.add(consultor);
                }
                
                // Verificar si el evento ya existe en IndexedDB (por número de programa único)
                const existingEvent = await db.events.where('numero_evento').equals(numero_evento).first();
                
                if (existingEvent) {
                    // Actualizar campos manteniendo su historial de followups existente
                    await db.events.update(existingEvent.id, {
                        nombre_evento,
                        fecha_inicio,
                        fecha_fin,
                        nombre_producto,
                        hombres_inscritos,
                        mujeres_inscritas,
                        total_inscritos,
                        no_inscritos,
                        consultor,
                        estado_evento,
                        contraparte,
                        instructor,
                        activo: true // Reactivar en esta importación
                    });
                    updatedCount++;
                } else {
                    // Registrar nuevo evento
                    await db.events.add({
                        nombre_evento,
                        numero_evento,
                        fecha_inicio,
                        fecha_fin,
                        nombre_producto,
                        hombres_inscritos,
                        mujeres_inscritas,
                        total_inscritos,
                        no_inscritos,
                        consultor,
                        estado_evento,
                        contraparte,
                        instructor,
                        activo: true,
                        followups: []
                    });
                    insertedCount++;
                }
            }
            
            // Generar credenciales automáticas para nuevos consultores detectados
            for (const cName of consultoresSet) {
                if (cName.trim() !== '') {
                    const exists = await db.users.get(cName);
                    if (!exists) {
                        await db.users.put({
                            username: cName,
                            role: 'consultor',
                            password: '123'
                        });
                    }
                }
            }
            
            if (insertedCount > 0 || updatedCount > 0) {
                showToast(`¡Integración exitosa! Se añadieron ${insertedCount} eventos nuevos y se actualizaron ${updatedCount} existentes.`);
            } else {
                showToast("No se encontraron registros de eventos válidos para importar.", "warning");
            }
            
            // Update connection status
            await updateDatabaseStatusText();
            
            // Redirect
            switchView('dashboard');
            
        } catch (err) {
            console.error(err);
            showToast("Error al leer y procesar el archivo Excel. Revisa el formato.", "error");
        }
    };
    reader.readAsArrayBuffer(file);
}

// Update Database status text in sidebar
async function updateDatabaseStatusText() {
    const eventCount = await db.events.count();
    const dbStatusText = document.getElementById('db-status-text');
    const statusDot = document.querySelector('.db-status-badge .status-dot');
    const clearDbBtn = document.getElementById('btn-clear-db');
    
    if (eventCount > 0) {
        dbStatusText.textContent = `${eventCount} eventos cargados`;
        statusDot.className = "status-dot green";
        clearDbBtn.style.display = 'inline-flex';
    } else {
        dbStatusText.textContent = "Base de datos vacía";
        statusDot.className = "status-dot red";
        clearDbBtn.style.display = 'none';
    }
}

// Clear Database action
document.getElementById('btn-clear-db').addEventListener('click', async () => {
    if (confirm("¿Estás seguro de que deseas vaciar por completo la base de datos? Se borrarán todos los eventos cargados.")) {
        await db.events.clear();
        showToast("Base de datos limpiada correctamente.", "info");
        updateDatabaseStatusText();
        switchView('importar');
    }
});

// 8. DASHBOARD GRAPHICS AND STATS
async function renderDashboard() {
    let events = await db.events.toArray();
    
    // Filtrar eventos por consultor si tiene rol consultor
    if (currentRole === 'consultor') {
        events = events.filter(e => e.consultor === currentUserName);
    }
    
    const totalEvents = events.length;
    
    if (totalEvents === 0) {
        document.getElementById('kpi-total-eventos').textContent = '0';
        document.getElementById('kpi-total-inscritos').textContent = '0';
        document.getElementById('kpi-total-no-inscritos').textContent = '0';
        
        clearCharts();
        return;
    }
    
    // Calcular agregaciones de participantes y eventos sin inscritos
    let totalInscritos = 0;
    let eventosSinParticipantes = 0;
    
    events.forEach(e => {
        const totalInscr = e.total_inscritos || 0;
        totalInscritos += totalInscr;
        
        const estado = String(e.estado_evento || '').toUpperCase();
        const isInProgressOrFinalized = estado.includes('PROCESO') || 
                                        estado.includes('CURSO') || 
                                        estado.includes('EJECUCION') || 
                                        estado.includes('EJECUCIÓN') || 
                                        estado.includes('TERMINADO') || 
                                        estado.includes('FINALIZADO');
        
        if (totalInscr === 0 && isInProgressOrFinalized) {
            eventosSinParticipantes++;
        }
    });
    
    // Populate KPI values
    document.getElementById('kpi-total-eventos').textContent = totalEvents;
    document.getElementById('kpi-total-inscritos').textContent = totalInscritos;
    document.getElementById('kpi-total-no-inscritos').textContent = eventosSinParticipantes;
    
    // Load Charts
    renderEventTypeDistributionChart(events);
}

function clearCharts() {
    Object.keys(charts).forEach(key => {
        if (charts[key]) {
            charts[key].destroy();
        }
    });
    charts = {};
}

// Chart 1: Event Type Distribution by Product Name (Column K)
function renderEventTypeDistributionChart(events) {
    const ctx = document.getElementById('chart-participantes').getContext('2d');
    
    if (charts['participants']) {
        charts['participants'].destroy();
    }
    
    const counts = {};
    
    events.forEach(e => {
        const product = String(e.nombre_producto || 'Sin Producto Especificado').trim();
        counts[product] = (counts[product] || 0) + 1;
    });
    
    const labels = [];
    const data = [];
    const colors = [];
    
    // Premium color palette for dynamic numbers of products
    const palette = [
        '#3B82F6', // Blue
        '#008A4B', // Intecap Green
        '#EC4899', // Pink
        '#F59E0B', // Amber
        '#8B5CF6', // Purple
        '#10B981', // Emerald
        '#EF4444', // Red
        '#06B6D4', // Cyan
        '#F43F5E', // Rose
        '#14B8A6'  // Teal
    ];
    
    let colorIdx = 0;
    Object.keys(counts).forEach(key => {
        labels.push(key);
        data.push(counts[key]);
        colors.push(palette[colorIdx % palette.length]);
        colorIdx++;
    });
    
    const isDark = document.body.classList.contains('dark-theme');
    const textThemeColor = isDark ? '#94A3B8' : '#64748B';
    const cardBgColor = isDark ? '#1E293B' : '#FFFFFF';
    
    charts['participants'] = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels.map((label, idx) => `${label} (${data[idx]})`),
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderColor: cardBgColor,
                borderWidth: 3,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: textThemeColor,
                        font: { family: 'Inter', weight: 500 }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const idx = context.dataIndex;
                            const cleanLabel = labels[idx]; // Usar etiqueta limpia original
                            const val = context.raw;
                            const total = data.reduce((a, b) => a + b, 0);
                            const pct = ((val / total) * 100).toFixed(1);
                            return ` ${cleanLabel}: ${val} (${pct}%)`;
                        }
                    }
                }
            },
            cutout: '65%'
        }
    });
}

// 9. EVENTS DATA TABLE & FILTERS
const eventsTableBody = document.getElementById('events-table-body');
const searchFilter = document.getElementById('filter-search');
const consultorFilter = document.getElementById('filter-consultor');
const instructorFilter = document.getElementById('filter-instructor');
const fechaInicioFilter = document.getElementById('filter-fecha-inicio');
const fechaFinFilter = document.getElementById('filter-fecha-fin');
const showingTextEl = document.getElementById('table-showing-text');

// Populate filter select options dynamically from the DB
async function populateFilterDropdowns() {
    let events = await db.events.toArray();
    
    if (currentRole === 'consultor') {
        events = events.filter(e => e.consultor === currentUserName);
    }
    
    // Save current values to restore them
    const currentConsultor = consultorFilter.value;
    const currentInstructor = instructorFilter.value;
    
    // Extract unique consultants and instructors
    const consultants = [...new Set(events.map(e => e.consultor).filter(Boolean))].sort();
    const instructors = [...new Set(events.map(e => e.instructor).filter(Boolean))].sort();
    
    // Rebuild Consultant select options
    consultorFilter.innerHTML = '<option value="">Todos los consultores</option>';
    consultants.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c;
        consultorFilter.appendChild(opt);
    });
    
    // Rebuild Instructor select options
    instructorFilter.innerHTML = '<option value="">Todos los instructores</option>';
    instructors.forEach(ins => {
        const opt = document.createElement('option');
        opt.value = ins;
        opt.textContent = ins;
        instructorFilter.appendChild(opt);
    });
    
    // Restore values
    consultorFilter.value = currentConsultor;
    instructorFilter.value = currentInstructor;
}

// Listeners for filters
[searchFilter, consultorFilter, instructorFilter, fechaInicioFilter, fechaFinFilter].forEach(el => {
    el.addEventListener('input', () => renderEventsTable());
});

document.getElementById('btn-reset-filters').addEventListener('click', () => {
    searchFilter.value = '';
    consultorFilter.value = '';
    instructorFilter.value = '';
    fechaInicioFilter.value = '';
    fechaFinFilter.value = '';
    renderEventsTable();
});

// Render the main table
async function renderEventsTable() {
    let events = await db.events.toArray();
    
    if (currentRole === 'consultor') {
        events = events.filter(e => e.consultor === currentUserName);
    }
    
    if (events.length === 0) {
        eventsTableBody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center text-muted py-5">
                    No hay datos disponibles. Carga un archivo de Excel para comenzar.
                </td>
            </tr>
        `;
        showingTextEl.textContent = 'Mostrando 0 de 0 eventos';
        return;
    }
    
    // Apply filters in JS
    const searchVal = searchFilter.value.toLowerCase().trim();
    const consultorVal = consultorFilter.value;
    const instructorVal = instructorFilter.value;
    const dateStartVal = fechaInicioFilter.value;
    const dateEndVal = fechaFinFilter.value;
    
    let filteredEvents = events.filter(e => {
        // Excluir eventos archivados (inactivos) que no pertenecen a la importación actual
        if (e.activo === false) {
            return false;
        }
        
        // Search filter (name, number, instructor)
        if (searchVal) {
            const num = (e.numero_evento || '').toLowerCase();
            const name = (e.nombre_evento || '').toLowerCase();
            const inst = (e.instructor || '').toLowerCase();
            if (!num.includes(searchVal) && !name.includes(searchVal) && !inst.includes(searchVal)) {
                return false;
            }
        }
        
        // Consultant filter
        if (consultorVal && e.consultor !== consultorVal) {
            return false;
        }
        
        // Instructor filter
        if (instructorVal && e.instructor !== instructorVal) {
            return false;
        }
        
        // Date filters
        if (dateStartVal && e.fecha_inicio && e.fecha_inicio < dateStartVal) {
            return false;
        }
        if (dateEndVal && e.fecha_fin && e.fecha_fin > dateEndVal) {
            return false;
        }
        
        // Subview filter (Con participantes vs Sin participantes/Cero)
        const totalInscr = e.total_inscritos || 0;
        
        if (currentSubview === 'con-participantes') {
            if (totalInscr === 0) {
                return false;
            }
        } else if (currentSubview === 'sin-participantes') {
            if (totalInscr > 0) {
                return false;
            }
            // Solo incluir eventos 'En Curso' o 'Finalizados' (excluir próximos y sin fecha)
            if (!e.fecha_inicio || !e.fecha_fin) {
                return false;
            }
            const today = new Date().toISOString().split('T')[0];
            if (today < e.fecha_inicio) {
                return false;
            }
        }
        
        return true;
    });
    
    // Format and render table rows
    if (filteredEvents.length === 0) {
        eventsTableBody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center text-muted py-4">
                    Ningún evento coincide con los filtros aplicados.
                </td>
            </tr>
        `;
        showingTextEl.textContent = `Mostrando 0 de ${events.length} eventos`;
        return;
    }
    
    showingTextEl.textContent = `Mostrando ${filteredEvents.length} de ${events.length} eventos`;
    eventsTableBody.innerHTML = '';
    
    // Process row by row
    for (const event of filteredEvents) {
        const total = event.total_inscritos || 0;
        const isInscrito = total > 0;
        
        // Event Status calculation based on Dates
        const today = new Date().toISOString().split('T')[0];
        let dateStatusBadge = '';
        
        if (event.fecha_inicio && event.fecha_fin) {
            if (today < event.fecha_inicio) {
                dateStatusBadge = '<span class="badge badge-warning">Próximo</span>';
            } else if (today > event.fecha_fin) {
                dateStatusBadge = '<span class="badge badge-info">Finalizado</span>';
            } else {
                dateStatusBadge = '<span class="badge badge-success">En Curso</span>';
            }
        } else {
            dateStatusBadge = '<span class="badge">Sin Fecha</span>';
        }
        
        // Progress display: Shows total enrolled if active, or "No Inscrito"
        let progressHTML = '';
        if (isInscrito) {
            progressHTML = `
                <span class="font-semibold" style="color: var(--color-success);" title="Hombres: ${event.hombres_inscritos} | Mujeres: ${event.mujeres_inscritas}">${total} Inscritos</span>
            `;
        } else {
            progressHTML = `
                <span class="text-muted">No Inscrito</span>
            `;
        }
        
        const tr = document.createElement('tr');
        
        // Resaltar eventos según días transcurridos e inscribir alertas condicionales
        let alertBadgeHTML = '';
        let daysPassedText = '';
        let hasAlert = false;
        
        if (total === 0 && event.fecha_inicio) {
            const msInDay = 24 * 60 * 60 * 1000;
            const startMs = new Date(event.fecha_inicio).getTime();
            const todayMs = new Date(today).getTime();
            const daysSinceStart = Math.floor((todayMs - startMs) / msInDay);
            
            if (daysSinceStart >= 7) {
                const isFinalizado = (event.estado_evento || '').toLowerCase().includes('finalizado');
                hasAlert = true;
                
                if (daysSinceStart >= 7 && daysSinceStart <= 14) {
                    // Alerta Amarilla
                    tr.className = 'row-alert-warning';
                    alertBadgeHTML = ' <span class="badge" style="background-color: #ffc107; color: #000; margin-left: 8px; font-size: 0.65rem; padding: 2px 6px; font-weight:700;">ADVERTENCIA</span>';
                    daysPassedText = `<span style="color: #dca000; font-size: 0.75rem; font-weight: 700; display: block; margin-top: 4px;">Inició hace ${daysSinceStart} días</span>`;
                } else if (daysSinceStart >= 15) {
                    if (isFinalizado) {
                        // Alerta Roja (CRÍTICO)
                        tr.className = 'row-alert-overdue';
                        alertBadgeHTML = ' <span class="badge badge-danger" style="margin-left: 8px; font-size: 0.65rem; padding: 2px 6px;">CRÍTICO</span>';
                        
                        if (event.fecha_fin) {
                            const endMs = new Date(event.fecha_fin).getTime();
                            const daysSinceEnd = Math.floor((todayMs - endMs) / msInDay);
                            daysPassedText = `<span class="text-danger" style="font-size: 0.75rem; font-weight: 700; display: block; margin-top: 4px;">Finalizó hace ${daysSinceEnd} días</span>`;
                        } else {
                            daysPassedText = `<span class="text-danger" style="font-size: 0.75rem; font-weight: 700; display: block; margin-top: 4px;">Inició hace ${daysSinceStart} días</span>`;
                        }
                    } else {
                        // Alerta Naranja (ALERTA)
                        tr.className = 'row-alert-orange';
                        alertBadgeHTML = ' <span class="badge" style="background-color: #fd7e14; color: white; margin-left: 8px; font-size: 0.65rem; padding: 2px 6px; font-weight:700;">ALERTA</span>';
                        daysPassedText = `<span style="color: #fd7e14; font-size: 0.75rem; font-weight: 700; display: block; margin-top: 4px;">Inició hace ${daysSinceStart} días</span>`;
                    }
                }
            }
        }
        
        tr.innerHTML = `
            <td class="font-bold">${event.numero_evento || 'N/A'}</td>
            <td class="event-title-cell">${event.nombre_evento || 'Sin Nombre'}${alertBadgeHTML}</td>
            <td>${event.contraparte || 'No Asignada'}</td>
            <td>${event.consultor || 'N/A'}</td>
            <td>${event.instructor || 'N/A'}</td>
            <td>
                <div class="text-sm">
                    <strong>Ini:</strong> ${formatUIDate(event.fecha_inicio)}<br>
                    <strong>Fin:</strong> ${formatUIDate(event.fecha_fin)}
                    ${daysPassedText}
                </div>
            </td>
            <td>${progressHTML}</td>
            <td>${dateStatusBadge}</td>
            <td class="text-center">
                <button class="btn btn-secondary btn-sm btn-view-event" data-id="${event.id}">
                    <i data-lucide="eye"></i>
                    <span>Ver</span>
                </button>
            </td>
        `;
        
        eventsTableBody.appendChild(tr);
    }
    
    // Add event listeners to "Ver" buttons
    document.querySelectorAll('.btn-view-event').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const eventId = parseInt(e.currentTarget.getAttribute('data-id'));
            openEventDetailModal(eventId);
        });
    });


    
    initIcons();
}

// Format date YYYY-MM-DD to DD/MM/YYYY for UI (safe method)
function formatUIDate(dateStr) {
    if (!dateStr) return 'N/A';
    try {
        const str = String(dateStr);
        const parts = str.split('-');
        if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        return str;
    } catch (e) {
        console.error("Error formatting date:", e);
        return String(dateStr);
    }
}

// 10. MODAL: DETAILS AND PARTICIPANTS
const modalDetail = document.getElementById('modal-event-detail');
const modalTitle = document.getElementById('modal-event-title');
const modalSubtitle = document.getElementById('modal-event-subtitle');
const modalParticipantsBody = document.getElementById('modal-participants-body');
const participantSearch = document.getElementById('participant-search');

// Modal Tabs logic
const tabButtons = document.querySelectorAll('.modal-tab-btn');
const tabContents = document.querySelectorAll('.modal-tab-content');

tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        tabButtons.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        
        btn.classList.add('active');
        const targetTab = document.getElementById(btn.getAttribute('data-target'));
        if (targetTab) {
            targetTab.classList.add('active');
        }
    });
});

async function openEventDetailModal(eventId) {
    const event = await db.events.get(eventId);
    if (!event) {
        showToast("No se pudo cargar el evento.", "error");
        return;
    }
    
    // Verificación de seguridad: los consultores solo ven sus propios eventos
    if (currentRole === 'consultor' && event.consultor !== currentUserName) {
        showToast("No tienes permisos para ver este evento.", "error");
        return;
    }
    
    currentEditingEventId = eventId;
    
    // Reset tab view
    tabButtons.forEach(b => b.classList.remove('active'));
    tabContents.forEach(c => c.classList.remove('active'));
    tabButtons[0].classList.add('active');
    document.getElementById('tab-participantes').classList.add('active');
    
    // Load Title
    modalTitle.textContent = event.nombre_evento;
    modalSubtitle.textContent = `N° Programa: ${event.numero_evento} | Consultor: ${event.consultor}`;
    
    // Tab 1: Render Participant Statistics
    document.getElementById('detail-product-name').textContent = event.nombre_producto || 'Sin Especificar';
    document.getElementById('detail-contraparte').textContent = event.contraparte || 'No Asignada';
    document.getElementById('detail-event-status').textContent = event.estado_evento || 'No inscrito';
    document.getElementById('detail-instructor-name').textContent = event.instructor || 'No Asignado';
    
    // Tab 2: Populate Edit Form fields
    document.getElementById('edit-event-id').value = event.id;
    document.getElementById('edit-event-name').value = event.nombre_evento;
    document.getElementById('edit-event-number').value = event.numero_evento;
    document.getElementById('edit-event-producto').value = event.nombre_producto || '';
    document.getElementById('edit-event-contraparte').value = event.contraparte || '';
    document.getElementById('edit-event-consultor').value = event.consultor;
    document.getElementById('edit-event-instructor').value = event.instructor;
    document.getElementById('edit-event-start').value = event.fecha_inicio || '';
    document.getElementById('edit-event-end').value = event.fecha_fin || '';
    document.getElementById('edit-event-hombres').value = event.hombres_inscritos || 0;
    document.getElementById('edit-event-mujeres').value = event.mujeres_inscritas || 0;
    document.getElementById('edit-event-estado').value = event.estado_evento || 'No inscrito';
    
    // Tab 3: Render Followups Timeline
    renderFollowupsTimeline(event);
    
    // Show Modal
    modalDetail.classList.add('active');
}

// Close Modals
document.getElementById('btn-close-modal').addEventListener('click', () => {
    modalDetail.classList.remove('active');
    currentEditingEventId = null;
    renderEventsTable();
});

// Hide modal on background click
modalDetail.addEventListener('click', (e) => {
    if (e.target === modalDetail) {
        modalDetail.classList.remove('active');
        currentEditingEventId = null;
        renderEventsTable();
    }
});

// Edit Event Details Submit
document.getElementById('form-edit-evento').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = parseInt(document.getElementById('edit-event-id').value);
    const numero_evento = document.getElementById('edit-event-number').value.trim();
    const nombre_evento = document.getElementById('edit-event-name').value.trim();
    const nombre_producto = document.getElementById('edit-event-producto').value.trim();
    const contraparte = document.getElementById('edit-event-contraparte').value.trim();
    const consultor = document.getElementById('edit-event-consultor').value.trim();
    const instructor = document.getElementById('edit-event-instructor').value.trim();
    const fecha_inicio = document.getElementById('edit-event-start').value;
    const fecha_fin = document.getElementById('edit-event-end').value;
    const hombres_inscritos = parseInt(document.getElementById('edit-event-hombres').value) || 0;
    const mujeres_inscritas = parseInt(document.getElementById('edit-event-mujeres').value) || 0;
    const estado_evento = document.getElementById('edit-event-estado').value;
    
    // Auto-calculate total
    const total_inscritos = hombres_inscritos + mujeres_inscritas;
    
    try {
        await db.events.update(id, {
            numero_evento,
            nombre_evento,
            nombre_producto,
            contraparte,
            consultor,
            instructor,
            fecha_inicio,
            fecha_fin,
            hombres_inscritos,
            mujeres_inscritas,
            total_inscritos,
            estado_evento
        });
        showToast("Datos del evento actualizados correctamente.");
        modalDetail.classList.remove('active');
        currentEditingEventId = null;
        renderEventsTable();
        populateFilterDropdowns();
    } catch (err) {
        console.error(err);
        showToast("Error al guardar los cambios del evento.", "error");
    }
});

// Delete Event button
document.getElementById('btn-delete-evento').addEventListener('click', async (e) => {
    e.preventDefault();
    if (!currentEditingEventId) return;
    
    if (confirm("¿Estás completamente seguro de que deseas eliminar este evento? Esta acción no se puede deshacer.")) {
        try {
            await db.events.delete(currentEditingEventId);
            showToast("Evento eliminado con éxito.", "info");
            modalDetail.classList.remove('active');
            currentEditingEventId = null;
            renderEventsTable();
            populateFilterDropdowns();
            updateDatabaseStatusText();
        } catch (err) {
            console.error(err);
            showToast("Error al eliminar el evento.", "error");
        }
    }
});

// 11. MANUAL CREATION OF A NEW EVENT
const modalCreate = document.getElementById('modal-create-event');
const btnAddEvento = document.getElementById('btn-add-evento');
const btnCancelCreate = document.getElementById('btn-cancel-create');

btnAddEvento.addEventListener('click', () => {
    modalCreate.classList.add('active');
});

btnCancelCreate.addEventListener('click', () => {
    modalCreate.classList.remove('active');
    document.getElementById('form-create-evento').reset();
});

document.getElementById('btn-close-create-modal').addEventListener('click', () => {
    modalCreate.classList.remove('active');
    document.getElementById('form-create-evento').reset();
});

document.getElementById('form-create-evento').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const nombre_evento = document.getElementById('create-event-name').value.trim();
    const numero_evento = document.getElementById('create-event-number').value.trim();
    const nombre_producto = document.getElementById('create-event-producto').value.trim();
    const contraparte = document.getElementById('create-event-contraparte').value.trim();
    const consultor = document.getElementById('create-event-consultor').value.trim();
    const instructor = document.getElementById('create-event-instructor').value.trim();
    const fecha_inicio = document.getElementById('create-event-start').value;
    const fecha_fin = document.getElementById('create-event-end').value;
    const hombres_inscritos = parseInt(document.getElementById('create-event-hombres').value) || 0;
    const mujeres_inscritas = parseInt(document.getElementById('create-event-mujeres').value) || 0;
    const estado_evento = document.getElementById('create-event-estado').value;
    
    // Auto-calculate total
    const total_inscritos = hombres_inscritos + mujeres_inscritas;
    
    try {
        await db.events.add({
            nombre_evento,
            numero_evento,
            nombre_producto,
            contraparte,
            consultor,
            instructor,
            fecha_inicio,
            fecha_fin,
            hombres_inscritos,
            mujeres_inscritas,
            total_inscritos,
            estado_evento
        });
        
        showToast("Nuevo evento de capacitación creado con éxito.");
        modalCreate.classList.remove('active');
        document.getElementById('form-create-evento').reset();
        
        renderEventsTable();
        populateFilterDropdowns();
        updateDatabaseStatusText();
    } catch (err) {
        console.error(err);
        showToast("Error al guardar el nuevo evento.", "error");
    }
});

// 12. GENERATE AND DOWNLOAD RECOMMENDATION EXCEL TEMPLATE MATCHING EXACT FORMAT
document.getElementById('btn-download-template').addEventListener('click', () => {
    try {
        const aoa = [
            ["", "", "", "", "", "INTECAP - SERVICIOS EMPRESARIALES - REGION OCCIDENTE"],
            ["", "", "", "", "", "Plantilla de Control y Seguimiento de Capacitaciones"],
            [],
            [
                "", "", "", "", "", // A-E
                "Nombre del Evento", // F
                "Numero de Programa", // G
                "Fecha de Inicio", // H
                "Fecha de Finalizacion", // I
                "", // J
                "Nombre de Producto", // K
                "Hombres inscritos", // L
                "Mujeres Inscritas", // M
                "Total de Inscritos", // N
                "", "", "", // O-Q
                "Nombre de Consultor Responsable", // R
                "Apellidos de Consultor responsable", // S
                "", "", "", "", "", // T-X
                "Estado del evento", // Y
                "Empresa atendida (Contraparte)", // Z
                "Instructor encargado" // AA
            ],
            ["", "", "", "", "", "Curso de Excel Financiero", "2026-SE-001", "2026-08-15", "2026-08-30", "", "Ofimática", 10, 15, 25, "", "", "", "Erick", "Aguilar", "", "", "", "", "", "Inscrito", "Banco Industrial, S.A.", "Carlos Mérida"],
            ["", "", "", "", "", "Taller de Comunicación Asertiva", "2026-SE-002", "2026-09-01", "2026-09-10", "", "Desarrollo Humano", 0, 0, 0, "", "", "", "Sofia", "Castillo", "", "", "", "", "", "No Inscrito", "Supermercados La Torre", "Roberto Cabrera"],
            ["", "", "", "", "", "Seminario de Agile Frameworks", "2026-SE-003", "2026-08-20", "2026-09-05", "", "Gestión de Proyectos", 8, 12, 20, "", "", "", "Erick", "Aguilar", "", "", "", "", "", "Inscrito", "Cervecería Centro Americana", "Julio César Soto"]
        ];
        
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Control_Capacitaciones");
        
        // Export file
        XLSX.writeFile(wb, "plantilla_control_capacitaciones.xlsx");
        showToast("Plantilla de ejemplo descargada con éxito.");
    } catch (err) {
        console.error(err);
        showToast("Error al generar la plantilla de Excel.", "error");
    }
});

// Initialize default administrator user in IndexedDB
async function initUsers() {
    try {
        const adminUser = await db.users.get('Administrador');
        if (!adminUser) {
            await db.users.put({
                username: 'Administrador',
                role: 'admin',
                password: 'admin'
            });
        }
        const supervisorUser = await db.users.get('Supervisor');
        if (!supervisorUser) {
            await db.users.put({
                username: 'Supervisor',
                role: 'supervisor',
                password: 'supervisor'
            });
        }
        await db.users.delete('Erick Aguilar');
    } catch (err) {
        console.error("Error inicializando usuarios:", err);
    }
}

async function renderUsersTable() {
    const usersTableBody = document.getElementById('users-table-body');
    if (!usersTableBody) return;
    
    try {
        const allUsers = await db.users.toArray();
        usersTableBody.innerHTML = '';
        
        if (allUsers.length === 0) {
            usersTableBody.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center text-muted py-4">No hay usuarios registrados.</td>
                </tr>
            `;
            return;
        }
        
        allUsers.forEach(user => {
            const tr = document.createElement('tr');
            
            let roleBadge = '';
            if (user.role === 'admin') {
                roleBadge = '<span class="badge badge-success">Administrador</span>';
            } else if (user.role === 'supervisor') {
                roleBadge = '<span class="badge badge-warning" style="background-color: var(--color-warning); color: #000;">Supervisor</span>';
            } else {
                roleBadge = '<span class="badge badge-info">Consultor</span>';
            }
            
            tr.innerHTML = `
                <td><strong>${user.username}</strong></td>
                <td>${roleBadge}</td>
                <td>
                    <input type="text" class="input-password-edit" id="pwd-${user.username.replace(/\s+/g, '_')}" value="${user.password}" style="width: 140px; padding: 8px 12px; border-radius: var(--border-radius-sm); border: 1px solid var(--border-color); background-color: var(--bg-app); color: var(--text-main); font-size: 0.85rem; font-weight: 600;">
                </td>
                <td class="text-center" style="white-space: nowrap;">
                    <button class="btn btn-primary btn-sm btn-save-user-data" data-username="${user.username}">
                        <i data-lucide="save"></i>
                        <span>Guardar</span>
                    </button>
                </td>
            `;
            usersTableBody.appendChild(tr);
        });
        
        // Add save event listeners
        document.querySelectorAll('.btn-save-user-data').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const username = e.currentTarget.getAttribute('data-username');
                const pwdInputId = `pwd-${username.replace(/\s+/g, '_')}`;
                const newPassword = document.getElementById(pwdInputId).value.trim();
                
                if (!newPassword) {
                    showToast("La contraseña no puede estar vacía.", "warning");
                    return;
                }
                
                try {
                    const userRecord = await db.users.get(username);
                    if (userRecord) {
                        userRecord.password = newPassword;
                        await db.users.put(userRecord);
                        showToast(`Datos de ${username} actualizados con éxito.`);
                    }
                } catch (err) {
                    console.error(err);
                    showToast("Error al guardar los datos del usuario.", "error");
                }
            });
        });
        
        initIcons();
        
    } catch (err) {
        console.error("Error rendering users table:", err);
    }
}

// Utility to convert File to Base64
const fileToBase64 = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
});

// Utility to normalize string (lowercase, remove accents/diacritics, trim)
function normalizeString(str) {
    if (!str) return '';
    return str.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

// Render the followups timeline inside the modal
function renderFollowupsTimeline(event) {
    const timelineList = document.getElementById('followup-timeline-list');
    if (!timelineList) return;
    
    timelineList.innerHTML = '';
    const followups = event.followups || [];
    
    if (followups.length === 0) {
        timelineList.innerHTML = `
            <div class="text-muted text-center py-4" style="font-size: 0.85rem;">
                No hay seguimientos registrados para este evento.
            </div>
        `;
        return;
    }
    
    // Sort followups by date descending (newest first)
    const sortedFollowups = [...followups].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    sortedFollowups.forEach(item => {
        const itemDate = new Date(item.date).toLocaleString();
        
        let evidenceHTML = '';
        if (item.evidence) {
            if (item.evidence.startsWith('data:application/pdf')) {
                evidenceHTML = `
                    <div class="timeline-evidence">
                        <button type="button" class="evidence-pdf-btn btn-view-pdf-evidence" data-evidence="${item.id}">
                            <i data-lucide="file-text"></i>
                            <span>Ver PDF de Evidencia</span>
                        </button>
                    </div>
                `;
            } else {
                evidenceHTML = `
                    <div class="timeline-evidence">
                        <img src="${item.evidence}" class="evidence-preview-img btn-view-img-evidence" data-evidence="${item.id}" alt="Evidencia de seguimiento">
                    </div>
                `;
            }
        }
        
        const timelineItem = document.createElement('div');
        timelineItem.className = 'timeline-item';
        timelineItem.innerHTML = `
            <div class="timeline-header">
                <span class="timeline-user"><i data-lucide="user" style="width: 12px; height: 12px; display: inline; vertical-align: middle; margin-right: 4px;"></i>${item.user}</span>
                <span class="timeline-date">${itemDate}</span>
            </div>
            <div class="timeline-note">${item.note}</div>
            ${evidenceHTML}
        `;
        timelineList.appendChild(timelineItem);
    });
    
    // Attach preview event listeners
    document.querySelectorAll('.btn-view-img-evidence').forEach(img => {
        img.addEventListener('click', (e) => {
            const id = parseInt(e.currentTarget.getAttribute('data-evidence'));
            const fup = followups.find(f => f.id === id);
            if (fup && fup.evidence) {
                const w = window.open();
                w.document.write(`<title>Evidencia de Seguimiento</title><img src="${fup.evidence}" style="max-width: 100%; height: auto; display: block; margin: auto; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">`);
            }
        });
    });
    
    document.querySelectorAll('.btn-view-pdf-evidence').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = parseInt(e.currentTarget.getAttribute('data-evidence'));
            const fup = followups.find(f => f.id === id);
            if (fup && fup.evidence) {
                const w = window.open();
                w.document.write(`<title>Evidencia PDF</title><iframe src="${fup.evidence}" width="100%" height="100%" style="border:none; position:fixed; top:0; left:0; bottom:0; right:0;"></iframe>`);
            }
        });
    });
    
    initIcons();
}

// Handle adding a new followup
document.getElementById('form-add-followup').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentEditingEventId) {
        showToast("No hay ningún evento seleccionado para agregar seguimiento.", "error");
        return;
    }
    
    const note = document.getElementById('followup-note').value.trim();
    const evidenceInput = document.getElementById('followup-evidence');
    
    let evidenceBase64 = '';
    if (evidenceInput.files.length > 0) {
        try {
            const file = evidenceInput.files[0];
            evidenceBase64 = await fileToBase64(file);
        } catch (err) {
            console.error("Error converting file to Base64:", err);
            showToast("Error al procesar la evidencia cargada.", "error");
            return;
        }
    }
    
    try {
        const event = await db.events.get(currentEditingEventId);
        if (!event) {
            showToast("No se encontró el evento correspondiente.", "error");
            return;
        }
        
        const newFollowup = {
            numero_evento: event.numero_evento,
            date: new Date().toISOString(),
            user: currentUserName,
            note: note,
            evidence: evidenceBase64
        };
        
        await db.followups.add(newFollowup);
        
        // Actualizar el array local del evento para renderizado inmediato
        event.followups = event.followups || [];
        event.followups.push(newFollowup);
        
        showToast("Seguimiento registrado con éxito en la nube.");
        
        // Reset form
        document.getElementById('form-add-followup').reset();
        
        // Re-render
        renderFollowupsTimeline(event);
    } catch (err) {
        console.error(err);
        showToast("Error al guardar el seguimiento.", "error");
    }
});

// Render Report View
async function renderReportView() {
    try {
        const events = await db.events.toArray();
        const searchVal = document.getElementById('report-search').value.toLowerCase().trim();
        const consultorVal = document.getElementById('report-consultor').value;
        const contraparteVal = document.getElementById('report-contraparte').value;
        const tbody = document.getElementById('report-table-body');
        
        if (!tbody) return;
        tbody.innerHTML = '';
        

        
        // 1. Gather all followups and associate with event info
        let reportRows = [];
        events.forEach(e => {
            // Apply security: consultors only see their own event followups
            if (currentRole === 'consultor' && e.consultor !== currentUserName) {
                return;
            }
            
            const followups = e.followups || [];
            followups.forEach(f => {
                reportRows.push({
                    id: f.id,
                    date: f.date,
                    user: f.user,
                    note: f.note,
                    evidence: f.evidence,
                    numero_evento: e.numero_evento,
                    nombre_evento: e.nombre_evento,
                    contraparte: e.contraparte,
                    consultor: e.consultor,
                    instructor: e.instructor,
                    activo: e.activo !== false
                });
            });
        });
        
        // 2. Apply filters
        let filteredRows = reportRows.filter(r => {
            // Search filter
            if (searchVal) {
                const num = r.numero_evento.toLowerCase();
                const name = r.nombre_evento.toLowerCase();
                const note = r.note.toLowerCase();
                if (!num.includes(searchVal) && !name.includes(searchVal) && !note.includes(searchVal)) {
                    return false;
                }
            }
            // Consultor filter
            if (currentRole !== 'consultor' && consultorVal && r.consultor !== consultorVal) {
                return false;
            }
            // Contraparte filter
            if (contraparteVal && r.contraparte !== contraparteVal) {
                return false;
            }
            return true;
        });
        
        // Sort by date descending
        filteredRows.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        // 3. Render table
        if (filteredRows.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" class="text-center text-muted py-4">No se encontraron registros de seguimiento con los filtros aplicados.</td>
                </tr>
            `;
            document.getElementById('report-showing-text').textContent = "Mostrando 0 registros";
            return;
        }
        
        document.getElementById('report-showing-text').textContent = `Mostrando ${filteredRows.length} registro(s) de seguimiento`;
        
        filteredRows.forEach(row => {
            const itemDate = new Date(row.date).toLocaleString();
            let evidenceHTML = '<span class="text-muted" style="font-size:0.8rem;">Sin evidencia</span>';
            
            if (row.evidence) {
                if (row.evidence.startsWith('data:application/pdf')) {
                    evidenceHTML = `
                        <button type="button" class="btn btn-secondary btn-sm btn-report-pdf" data-id="${row.id}" style="padding: 4px 8px; font-size: 0.75rem;">
                            <i data-lucide="file-text" style="width: 12px; height: 12px; display: inline; vertical-align: middle;"></i> PDF
                        </button>
                    `;
                } else {
                    evidenceHTML = `
                        <img src="${row.evidence}" class="btn-report-img" data-id="${row.id}" style="width: 32px; height: 32px; object-fit: cover; border-radius: 4px; cursor: pointer; border: 1px solid var(--border-color);" alt="Miniatura">
                    `;
                }
            }
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="font-bold">${row.numero_evento}</td>
                <td>${row.nombre_evento}</td>
                <td>${row.contraparte}</td>
                <td>${row.consultor}</td>
                <td>${row.instructor || 'N/A'}</td>
                <td>${itemDate}</td>
                <td><span style="font-weight:600; font-size:0.8rem;">${row.user}</span></td>
                <td style="max-width: 250px; white-space: normal; word-wrap: break-word;">${row.note}</td>
                <td class="text-center">${evidenceHTML}</td>
            `;
            tbody.appendChild(tr);
        });
        
        // 4. Attach event listeners for evidence preview in report
        document.querySelectorAll('.btn-report-img').forEach(img => {
            img.addEventListener('click', (e) => {
                const id = parseInt(img.getAttribute('data-id'));
                const row = filteredRows.find(r => r.id === id);
                if (row && row.evidence) {
                    const w = window.open();
                    w.document.write(`<title>Evidencia</title><img src="${row.evidence}" style="max-width: 100%; height: auto; display: block; margin: auto; border-radius: 8px;">`);
                }
            });
        });
        
        document.querySelectorAll('.btn-report-pdf').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(btn.getAttribute('data-id'));
                const row = filteredRows.find(r => r.id === id);
                if (row && row.evidence) {
                    const w = window.open();
                    w.document.write(`<title>Evidencia PDF</title><iframe src="${row.evidence}" width="100%" height="100%" style="border:none; position:fixed; top:0; left:0;"></iframe>`);
                }
            });
        });
        
        initIcons();
        
    } catch (err) {
        console.error("Error rendering report view:", err);
    }
}

// Populate Report Filters Dropdowns dynamically
async function populateReportFilters() {
    try {
        const events = await db.events.toArray();
        const consultorDropdown = document.getElementById('report-consultor');
        const contraparteDropdown = document.getElementById('report-contraparte');
        
        if (!consultorDropdown || !contraparteDropdown) return;
        
        // Save current selections
        const savedConsultor = consultorDropdown.value;
        const savedContraparte = contraparteDropdown.value;
        
        consultorDropdown.innerHTML = '<option value="">Todos los Consultores</option>';
        contraparteDropdown.innerHTML = '<option value="">Todas las Empresas</option>';
        
        const consultores = new Set();
        const contrapartes = new Set();
        
        events.forEach(e => {
            if (e.consultor && e.consultor !== 'No Asignado') {
                consultores.add(e.consultor);
            }
            if (e.contraparte && e.contraparte !== 'No Asignada') {
                contrapartes.add(e.contraparte);
            }
        });
        
        // Populate consultores
        [...consultores].sort().forEach(c => {
            const opt = document.createElement('option');
            opt.value = c;
            opt.textContent = c;
            consultorDropdown.appendChild(opt);
        });
        
        // Populate contrapartes
        [...contrapartes].sort().forEach(cp => {
            const opt = document.createElement('option');
            opt.value = cp;
            opt.textContent = cp;
            contraparteDropdown.appendChild(opt);
        });
        
        // Restore selections
        consultorDropdown.value = savedConsultor;
        contraparteDropdown.value = savedContraparte;
    } catch (err) {
        console.error("Error populating report filters:", err);
    }
}

// Export Report to Excel using SheetJS
async function exportReportToExcel() {
    try {
        const events = await db.events.toArray();
        const searchVal = document.getElementById('report-search').value.toLowerCase().trim();
        const consultorVal = document.getElementById('report-consultor').value;
        const contraparteVal = document.getElementById('report-contraparte').value;
        
        // 1. Gather filtered rows
        let reportRows = [];
        events.forEach(e => {
            if (currentRole === 'consultor' && e.consultor !== currentUserName) {
                return;
            }
            const followups = e.followups || [];
            followups.forEach(f => {
                reportRows.push({
                    id: f.id,
                    date: f.date,
                    user: f.user,
                    note: f.note,
                    numero_evento: e.numero_evento,
                    nombre_evento: e.nombre_evento,
                    contraparte: e.contraparte,
                    consultor: e.consultor,
                    instructor: e.instructor,
                    activo: e.activo !== false
                });
            });
        });
        
        let filteredRows = reportRows.filter(r => {
            if (searchVal) {
                const num = r.numero_evento.toLowerCase();
                const name = r.nombre_evento.toLowerCase();
                const note = r.note.toLowerCase();
                if (!num.includes(searchVal) && !name.includes(searchVal) && !note.includes(searchVal)) {
                    return false;
                }
            }
            if (currentRole !== 'consultor' && consultorVal && r.consultor !== consultorVal) {
                return false;
            }
            if (contraparteVal && r.contraparte !== contraparteVal) {
                return false;
            }
            return true;
        });
        
        if (filteredRows.length === 0) {
            showToast("No hay registros para exportar en este reporte.", "warning");
            return;
        }
        
        // Sort newest first
        filteredRows.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        // 2. Prepare worksheet AOA
        const header = [
            "N° Programa (Evento)",
            "Nombre del Evento",
            "Contraparte (Empresa)",
            "Consultor Responsable",
            "Instructor Asignado",
            "Fecha Registro Seguimiento",
            "Usuario que Registró",
            "Detalles del Compromiso / Acción",
            "Estado del Evento"
        ];
        
        const rows = filteredRows.map(r => [
            r.numero_evento,
            r.nombre_evento,
            r.contraparte,
            r.consultor,
            r.instructor || "N/A",
            new Date(r.date).toLocaleString(),
            r.user,
            r.note,
            r.activo ? "Activo" : "Archivado"
        ]);
        
        const aoa = [
            ["INTECAP - REGION OCCIDENTE", "", "", "", "", "", "", "", ""],
            ["INFORME DINÁMICO DE SEGUIMIENTOS DE CAPACITACIONES", "", "", "", "", "", "", "", ""],
            [`Generado el: ${new Date().toLocaleString()} por ${currentUserName}`, "", "", "", "", "", "", "", ""],
            [], // Empty row
            header,
            ...rows
        ];
        
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Bitacora_Seguimientos");
        
        XLSX.writeFile(wb, `Reporte_Seguimientos_${new Date().toISOString().split('T')[0]}.xlsx`);
        showToast("Reporte Excel descargado con éxito.");
    } catch (err) {
        console.error("Error exporting report to Excel:", err);
        showToast("Error al generar el reporte Excel.", "error");
    }
}

// 13. APP STARTUP INITIALIZATION
document.addEventListener('DOMContentLoaded', async () => {
    await initUsers();
    initTheme();
    initIcons();
    initLoginListeners();
    
    // Verificar si hay sesión guardada en localStorage
    const savedRole = localStorage.getItem('session_role');
    const savedName = localStorage.getItem('session_name');
    
    if (savedRole && savedName) {
        await applySession(savedRole, savedName);
    } else {
        // Mostrar pantalla de login
        const loginScreen = document.getElementById('login-screen');
        if (loginScreen) {
            loginScreen.classList.add('active');
        }
        await populateLoginConsultantsList();
    }
    
    await updateDatabaseStatusText();
    
    // Subview Tab listeners for event table subviews
    document.querySelectorAll('.subview-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault(); // Evitar comportamientos por defecto del botón
            document.querySelectorAll('.subview-tab').forEach(t => t.classList.remove('active'));
            e.currentTarget.classList.add('active');
            currentSubview = e.currentTarget.getAttribute('data-subview');
            renderEventsTable();
        });
    });
    
    // Report Filters Listeners
    document.getElementById('report-search').addEventListener('input', renderReportView);
    document.getElementById('report-consultor').addEventListener('change', renderReportView);
    document.getElementById('report-contraparte').addEventListener('change', renderReportView);
    document.getElementById('btn-export-report').addEventListener('click', exportReportToExcel);

});

// Set active navigation button state initially if user visits manual links
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
        const hash = item.getAttribute('href').substring(1);
        switchView(hash);
    });
});
