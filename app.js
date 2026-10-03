// --- BASE DE DATOS LOCAL CON PERSISTENCIA (localStorage) ---
let currentRole = 'admin';

// Cargar datos guardados previamente en el dispositivo o usar los iniciales por defecto
let clients = JSON.parse(localStorage.getItem('prestapp_clients')) || [
    { id: 1, name: 'Juan Pérez', phone: '5491122334455', dni: '38123456', score: 'Excelente' },
    { id: 2, name: 'María Gómez', phone: '5491166778899', dni: '40987654', score: 'Bueno' }
];

let loans = JSON.parse(localStorage.getItem('prestapp_loans')) || [
    {
        id: 101,
        clientId: 1,
        amount: 50000,
        rate: 20,
        frequency: 'semanal',
        lateFeePerDay: 500,
        startDate: '2026-09-01',
        installments: [
            { number: 1, dueDate: '2026-09-08', amount: 15000, paid: true, paidDate: '2026-09-08', lateFee: 0 },
            { number: 2, dueDate: '2026-09-15', amount: 15000, paid: true, paidDate: '2026-09-15', lateFee: 0 },
            { number: 3, dueDate: '2026-09-22', amount: 15000, paid: false, paidDate: null, lateFee: 500 },
            { number: 4, dueDate: '2026-09-29', amount: 15000, paid: false, paidDate: null, lateFee: 0 }
        ]
    }
];

let pawns = JSON.parse(localStorage.getItem('prestapp_pawns')) || [
    { id: 1, clientId: 2, item: 'Teléfono Samsung S21', appraisedValue: 120000, loanAmount: 40000, status: 'En Custodia' }
];

// Cola de tareas realizadas sin conexión a internet
let offlineQueue = JSON.parse(localStorage.getItem('prestapp_offline_queue')) || [];

// Guardar estado actual en el dispositivo
function saveToLocalStorage() {
    localStorage.setItem('prestapp_clients', JSON.stringify(clients));
    localStorage.setItem('prestapp_loans', JSON.stringify(loans));
    localStorage.setItem('prestapp_pawns', JSON.stringify(pawns));
    localStorage.setItem('prestapp_offline_queue', JSON.stringify(offlineQueue));
}

// --- INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', () => {
    renderDashboard();
    renderLoans();
    renderPawns();
    renderClients();
    populateClientSelect();
    updateOnlineStatus();
});

// --- CAMBIO DE VISTA Y ROLES ---
function setRole(role) {
    currentRole = role;
    document.getElementById('role-admin-btn').className = role === 'admin' 
        ? 'px-3 py-1 rounded text-xs font-semibold bg-indigo-600 text-white shadow' 
        : 'px-3 py-1 rounded text-xs font-semibold text-indigo-300';
    
    document.getElementById('role-cobrador-btn').className = role === 'cobrador' 
        ? 'px-3 py-1 rounded text-xs font-semibold bg-indigo-600 text-white shadow' 
        : 'px-3 py-1 rounded text-xs font-semibold text-indigo-300';

    document.getElementById('admin-metrics').style.display = role === 'admin' ? 'grid' : 'none';
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active', 'bg-indigo-600', 'text-white'));
    
    document.getElementById(`view-${tabId}`).classList.remove('hidden');
    document.getElementById(`tab-${tabId}`).classList.add('active', 'bg-indigo-600', 'text-white');
}

// --- RENDERS PRINCIPALES ---
function renderDashboard() {
    // 1. Cálculos de métricas generales (Capital, Ganancias y Empeños)
    let totalCapital = loans.reduce((acc, l) => acc + l.amount, 0);
    let totalProfit = loans.reduce((acc, l) => acc + (l.amount * (l.rate / 100)), 0);
    let totalPawns = pawns.reduce((acc, p) => acc + p.appraisedValue, 0);

    if (document.getElementById('stat-capital')) document.getElementById('stat-capital').innerText = `$${totalCapital.toLocaleString()}`;
    if (document.getElementById('stat-profit')) document.getElementById('stat-profit').innerText = `$${totalProfit.toLocaleString()}`;
    if (document.getElementById('stat-pawns')) document.getElementById('stat-pawns').innerText = `$${totalPawns.toLocaleString()}`;

    // 2. Obtener la fecha actual local en formato AAAA-MM-DD
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;

    // 3. Recopilar todas las cuotas no pagadas
    let unpaidInstallments = [];
    loans.forEach(loan => {
        const client = clients.find(c => c.id === loan.clientId);
        loan.installments.forEach(inst => {
            if (!inst.paid) {
                unpaidInstallments.push({
                    loanId: loan.id,
                    clientName: client ? client.name : 'Cliente',
                    clientPhone: client ? client.phone : '',
                    number: inst.number,
                    dueDate: inst.dueDate,
                    amount: inst.amount,
                    lateFee: inst.lateFee || 0,
                    totalToPay: inst.amount + (inst.lateFee || 0)
                });
            }
        });
    });

    // 4. Filtrar: Vencen Hoy vs Próximos Vencimientos
    const todayDue = unpaidInstallments.filter(i => i.dueDate === todayStr);
    const nextDue = unpaidInstallments
        .filter(i => i.dueDate > todayStr)
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

    // 5. Renderizar "VENCEN HOY"
    const todayContainer = document.getElementById('today-due-container');
    const todayBadge = document.getElementById('badge-today-count');
    
    if (todayBadge) todayBadge.innerText = todayDue.length;
    if (todayContainer) {
        todayContainer.innerHTML = '';

        if (todayDue.length === 0) {
            todayContainer.innerHTML = `
                <div class="text-center py-8 text-gray-400 text-xs">
                    <i class="fa-solid fa-circle-check text-green-500 text-3xl mb-2 block"></i>
                    <p class="font-medium">¡Al día! No hay vencimientos para hoy.</p>
                </div>`;
        } else {
            todayDue.forEach(item => {
                todayContainer.innerHTML += `
                    <div class="p-3 bg-red-50 rounded-lg border border-red-200 flex justify-between items-center shadow-sm">
                        <div>
                            <strong class="text-sm text-gray-800 block">${item.clientName}</strong>
                            <span class="text-xs text-red-600 font-bold">Cuota ${item.number} • Hoy: $${item.totalToPay.toLocaleString()}</span>
                        </div>
                        <div class="flex space-x-1.5">
                            <button onclick="payInstallment(${item.loanId}, ${item.number})" class="bg-green-600 text-white px-2.5 py-1.5 rounded text-xs hover:bg-green-700 font-bold shadow">
                                <i class="fa-solid fa-check mr-1"></i>Cobrar
                            </button>
                            <button onclick="sendWAReminder('${item.clientPhone}', '${item.clientName}', ${item.number}, ${item.totalToPay}, '${item.dueDate}')" class="bg-emerald-500 text-white px-2 py-1.5 rounded text-xs hover:bg-emerald-600">
                                <i class="fa-brands fa-whatsapp"></i>
                            </button>
                        </div>
                    </div>`;
            });
        }
    }

    // 6. Renderizar "PRÓXIMOS VENCIMIENTOS"
    const nextContainer = document.getElementById('next-due-container');
    const nextBadge = document.getElementById('badge-next-count');
    
    if (nextBadge) nextBadge.innerText = nextDue.length;
    if (nextContainer) {
        nextContainer.innerHTML = '';

        if (nextDue.length === 0) {
            nextContainer.innerHTML = `
                <div class="text-center py-8 text-gray-400 text-xs">
                    <p>No hay próximos vencimientos registrados a futuro.</p>
                </div>`;
        } else {
            nextDue.forEach(item => {
                nextContainer.innerHTML += `
                    <div class="p-3 bg-gray-50 rounded-lg border border-gray-200 flex justify-between items-center">
                        <div>
                            <strong class="text-sm text-gray-800 block">${item.clientName}</strong>
                            <span class="text-xs text-gray-500">Cuota ${item.number} • Vence: <strong class="text-indigo-600">${item.dueDate}</strong></span>
                        </div>
                        <div class="text-right">
                            <span class="text-sm font-bold text-gray-800 block">$${item.totalToPay.toLocaleString()}</span>
                            <button onclick="sendWAReminder('${item.clientPhone}', '${item.clientName}', ${item.number}, ${item.totalToPay}, '${item.dueDate}')" class="text-emerald-600 text-xs hover:underline font-medium">
                                <i class="fa-brands fa-whatsapp mr-1"></i>Avisar
                            </button>
                        </div>
                    </div>`;
            });
        }
    }
}

function renderLoans() {
    const container = document.getElementById('loans-list');
    if (!container) return;
    container.innerHTML = '';

    if (loans.length === 0) {
        container.innerHTML = `
            <div class="bg-white p-8 rounded-xl shadow text-center text-gray-400">
                <i class="fa-solid fa-folder-open text-4xl mb-2"></i>
                <p>No hay préstamos registrados.</p>
            </div>`;
        return;
    }

    loans.forEach(loan => {
        const client = clients.find(c => c.id === loan.clientId);
        const paidInstallments = loan.installments.filter(i => i.paid).length;
        const totalInstallments = loan.installments.length;
        const isCompleted = paidInstallments === totalInstallments;

        // Lista de cuotas formateadas
        let installmentsHTML = loan.installments.map(inst => `
            <div class="flex justify-between items-center text-xs p-2 ${inst.paid ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-700'} rounded border mb-1">
                <span>Cuota ${inst.number} (${inst.dueDate}): <strong>$${(inst.amount + (inst.lateFee || 0)).toLocaleString()}</strong></span>
                ${inst.paid 
                    ? '<span class="font-bold text-green-600"><i class="fa-solid fa-check mr-1"></i>Pagada</span>' 
                    : `<button onclick="payInstallment(${loan.id},${inst.number})" class="bg-indigo-600 hover:bg-indigo-700 text-white px-2 py-0.5 rounded text-[10px]">Cobrar</button>`
                }
            </div>
        `).join('');

        container.innerHTML += `
            <div class="bg-white p-5 rounded-xl shadow border border-gray-100 mb-4">
                <div class="flex justify-between items-start border-b pb-3 mb-3">
                    <div>
                        <h3 class="font-bold text-gray-800 text-base">${client ? client.name : 'Cliente Desconocido'}</h3>
                        <p class="text-xs text-gray-500">Monto: <strong class="text-gray-800">$${loan.amount.toLocaleString()}</strong> | Tasa: ${loan.rate}% | Mod: ${loan.frequency}</p>
                    </div>
                    <div class="flex items-center space-x-2">
                        <span class="text-xs px-2.5 py-1 rounded-full font-bold ${isCompleted ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}">
                            ${isCompleted ? 'Finalizado' : `${paidInstallments}/${totalInstallments} Pagadas`}
                        </span>
                        <!-- BOTONES EDITAR / ELIMINAR -->
                        <button onclick="openEditLoanModal(${loan.id})" class="text-indigo-600 hover:text-indigo-800 text-sm p-1.5 rounded hover:bg-indigo-50" title="Editar Préstamo">
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button onclick="deleteLoan(${loan.id})" class="text-red-500 hover:text-red-700 text-sm p-1.5 rounded hover:bg-red-50" title="Eliminar Préstamo">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </div>

                <div class="mt-2">
                    <p class="text-xs font-semibold text-gray-500 uppercase mb-2">Desglose de Cuotas:</p>
                    <div class="max-h-48 overflow-y-auto pr-1">
                        ${installmentsHTML}
                    </div>
                </div>
            </div>`;
    });
}

function renderPawns() {
    const list = document.getElementById('pawns-list');
    list.innerHTML = '';
    pawns.forEach(p => {
        const client = clients.find(c => c.id === p.clientId);
        const card = document.createElement('div');
        card.className = "bg-white p-4 rounded-xl shadow border border-gray-100";
        card.innerHTML = `
            <div class="flex justify-between items-center mb-2">
                <span class="text-xs font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded">${p.status}</span>
                <i class="fa-solid fa-gem text-amber-500"></i>
            </div>
            <h4 class="font-bold text-gray-800">${p.item}</h4>
            <p class="text-xs text-gray-500 mt-1">Cliente: ${client ? client.name : ''}</p>
            <div class="mt-3 pt-2 border-t text-xs flex justify-between">
                <span>Tasación: <strong>$${p.appraisedValue}</strong></span>
                <span class="text-indigo-600">Prestado: <strong>$${p.loanAmount}</strong></span>
            </div>
        `;
        list.appendChild(card);
    });
}

function renderClients() {
    const container = document.getElementById('clients-list');
    if (!container) return;
    container.innerHTML = '';

    if (clients.length === 0) {
        container.innerHTML = `
            <div class="bg-white p-8 rounded-xl shadow text-center text-gray-400 col-span-2">
                <i class="fa-solid fa-users-slash text-4xl mb-2"></i>
                <p>No hay clientes registrados.</p>
            </div>`;
        return;
    }

    clients.forEach(client => {
        const clientLoans = loans.filter(l => l.clientId === client.id);

        let loansHTML = clientLoans.map(loan => {
            const paidCount = loan.installments.filter(i => i.paid).length;
            const totalCount = loan.installments.length;
            return `
                <div class="p-2.5 bg-gray-50 rounded border border-gray-200 text-xs mb-2 flex justify-between items-center">
                    <div>
                        <strong class="text-gray-800 block">$${loan.amount.toLocaleString()} (${loan.rate}%) - ${loan.frequency}</strong>
                        <span class="text-gray-500">Progreso: ${paidCount}/${totalCount} cuotas</span>
                    </div>
                    <div class="flex space-x-1">
                        <button onclick="openEditLoanModal(${loan.id})" class="text-indigo-600 hover:text-indigo-800 p-1 rounded hover:bg-indigo-100" title="Editar">
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button onclick="deleteLoan(${loan.id})" class="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-100" title="Eliminar">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </div>`;
        }).join('');

        if (clientLoans.length === 0) {
            loansHTML = `<p class="text-xs text-gray-400 italic">Sin historial de préstamos.</p>`;
        }

        container.innerHTML += `
            <div class="bg-white p-5 rounded-xl shadow border border-gray-100">
                <div class="flex justify-between items-start mb-3 border-b pb-2">
                    <div>
                        <h3 class="font-bold text-gray-800 text-base">${client.name}</h3>
                        <p class="text-xs text-gray-500"><i class="fa-solid fa-phone mr-1"></i>${client.phone || 'Sin Teléfono'} | DNI: ${client.dni || 'N/A'}</p>
                    </div>
                    <a href="https://wa.me/${client.phone}" target="_blank" class="bg-emerald-500 hover:bg-emerald-600 text-white text-xs px-2.5 py-1 rounded-lg flex items-center shadow-sm">
                        <i class="fa-brands fa-whatsapp mr-1"></i>Chat
                    </a>
                </div>

                <div class="mt-3">
                    <p class="text-xs font-semibold text-gray-500 uppercase mb-2">Historial de Préstamos:</p>
                    ${loansHTML}
                </div>
            </div>`;
    });
}

// --- LOGICA DE COBRO Y PERSISTENCIA OFFLINE ---
function payInstallment(loanId, installmentNumber) {
    const loan = loans.find(l => l.id === loanId);
    if (loan) {
        const inst = loan.installments.find(i => i.number === installmentNumber);
        if (inst) {
            inst.paid = true;
            inst.paidDate = new Date().toISOString().split('T')[0];

            // Si no hay conexión, registrar acción en la cola offline
            if (!navigator.onLine) {
                offlineQueue.push({
                    type: 'PAYMENT',
                    loanId: loanId,
                    installmentNumber: installmentNumber,
                    timestamp: new Date().toISOString()
                });
            }

            saveToLocalStorage(); // Se guarda localmente siempre

            const statusMsg = navigator.onLine ? '¡Pago registrado con éxito!' : '¡Pago registrado localmente (Modo Offline)!';
            alert(statusMsg);

            renderDashboard();
            renderLoans();
            updateOnlineStatus();
        }
    }
}

function sendWAReminder(phone, name, cuota, amount, dueDate) {
    let template = document.getElementById('wa-template').value;
    let message = template
        .replace('{NOMBRE}', name)
        .replace('{CUOTA}', cuota)
        .replace('{MONTO}', amount)
        .replace('{FECHA}', dueDate);

    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
}

// --- MODALES Y FORMULARIOS ---
function openLoanModal() {
    document.getElementById('modal-loan').classList.remove('hidden');
}

function closeLoanModal() {
    document.getElementById('modal-loan').classList.add('hidden');
}

function populateClientSelect() {
    const select = document.getElementById('loan-client-select');
    if (!select) return;
    select.innerHTML = '<option value="new">+ Crear Nuevo Cliente</option>';
    clients.forEach(c => {
        select.innerHTML += `<option value="${c.id}">${c.name} (DNI: ${c.dni})</option>`;
    });
    toggleInlineClientForm(select.value);
}

function toggleInlineClientForm(val) {
    const fields = document.getElementById('inline-client-fields');
    if (fields) fields.style.display = val === 'new' ? 'block' : 'none';
}

function handleCreateLoan(e) {
    e.preventDefault();
    let clientId = document.getElementById('loan-client-select').value;

    if (clientId === 'new') {
        const newName = document.getElementById('new-client-name').value;
        const newPhone = document.getElementById('new-client-phone').value;
        const newDni = document.getElementById('new-client-dni').value;

        if (!newName) return alert('Ingrese el nombre del nuevo cliente');

        const newClient = {
            id: clients.length + 1,
            name: newName,
            phone: newPhone,
            dni: newDni,
            score: 'Excelente'
        };
        clients.push(newClient);
        clientId = newClient.id;
        populateClientSelect();
    } else {
        clientId = parseInt(clientId);
    }

    const amount = parseFloat(document.getElementById('loan-amount').value);
    const rate = parseFloat(document.getElementById('loan-rate').value);
    const installmentsCount = parseInt(document.getElementById('loan-installments').value);
    const lateFee = parseFloat(document.getElementById('loan-late-fee').value);
    const freq = document.getElementById('loan-freq').value;

    const totalToReturn = amount + (amount * (rate / 100));
    const installmentAmount = totalToReturn / installmentsCount;

    // Determinar días a sumar según la frecuencia elegida
    let daysToAdd = 7;
    if (freq === 'diario') daysToAdd = 1;
    if (freq === 'semanal') daysToAdd = 7;
    if (freq === 'quincenal') daysToAdd = 15;
    if (freq === 'mensual') daysToAdd = 30;

    let generatedInstallments = [];
    let today = new Date();

    for (let i = 1; i <= installmentsCount; i++) {
        today.setDate(today.getDate() + daysToAdd);
        generatedInstallments.push({
            number: i,
            dueDate: today.toISOString().split('T')[0],
            amount: Math.round(installmentAmount),
            paid: false,
            paidDate: null,
            lateFee: 0
        });
    }

    const newLoan = {
        id: loans.length + 101,
        clientId: clientId,
        amount: amount,
        rate: rate,
        frequency: freq,
        lateFeePerDay: lateFee,
        startDate: new Date().toISOString().split('T')[0],
        installments: generatedInstallments
    };

    loans.push(newLoan);

    // Si no hay conexión, registrar préstamo en la cola offline
    if (!navigator.onLine) {
        offlineQueue.push({
            type: 'CREATE_LOAN',
            loanData: newLoan,
            timestamp: new Date().toISOString()
        });
    }

    saveToLocalStorage(); // Se guarda localmente

    closeLoanModal();
    renderDashboard();
    renderLoans();
    renderClients();
    updateOnlineStatus();

    const statusMsg = navigator.onLine ? '¡Préstamo registrado exitosamente!' : '¡Préstamo registrado localmente (Modo Offline)!';
    alert(statusMsg);
}

// --- CONTROLADOR DE ESTADO OFFLINE / ONLINE Y SINCRONIZADOR ---
function updateOnlineStatus() {
    const statusContainer = document.getElementById('connection-status');
    const statusDot = document.getElementById('connection-dot');
    const statusText = document.getElementById('connection-status-text');

    if (!statusContainer || !statusText) return;

    if (navigator.onLine) {
        statusContainer.className = "flex items-center bg-green-900/80 text-green-300 px-3 py-1.5 rounded-lg border border-green-700 text-xs font-semibold space-x-2";
        statusDot.className = "w-2 h-2 rounded-full bg-green-400 animate-pulse";
        
        if (offlineQueue.length > 0) {
            statusText.innerText = `Sincronizando (${offlineQueue.length})...`;
            syncOfflineData();
        } else {
            statusText.innerText = "En Línea";
        }
    } else {
        statusContainer.className = "flex items-center bg-amber-900/80 text-amber-300 px-3 py-1.5 rounded-lg border border-amber-700 text-xs font-semibold space-x-2";
        statusDot.className = "w-2 h-2 rounded-full bg-amber-400 animate-ping";
        statusText.innerText = `Modo Offline (${offlineQueue.length} pend.)`;
    }
}

function syncOfflineData() {
    if (offlineQueue.length === 0) return;

    // Simulación de envío de datos al servidor remoto
    setTimeout(() => {
        const syncedItemsCount = offlineQueue.length;
        offlineQueue = []; // Vaciar la cola tras sincronizar
        saveToLocalStorage();
        updateOnlineStatus();
        alert(`¡Internet restablecido! Se sincronizaron automáticamente ${syncedItemsCount} operaciones registradas sin conexión.`);
    }, 1500);
}

// Escuchar eventos automáticos de red
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);

// ==========================================
// FUNCIONES PARA EDITAR Y ELIMINAR PRÉSTAMOS
// ==========================================

// 1. Abrir Modal de Edición con datos cargados
function openEditLoanModal(loanId) {
    const loan = loans.find(l => l.id === loanId);
    if (!loan) return;

    document.getElementById('edit-loan-id').value = loan.id;
    document.getElementById('edit-loan-amount').value = loan.amount;
    document.getElementById('edit-loan-rate').value = loan.rate;
    document.getElementById('edit-loan-freq').value = loan.frequency;
    document.getElementById('edit-loan-late-fee').value = loan.lateFee || 0;

    const modal = document.getElementById('modal-edit-loan');
    if (modal) modal.classList.remove('hidden');
}

// 2. Cerrar Modal de Edición
function closeEditLoanModal() {
    const modal = document.getElementById('modal-edit-loan');
    if (modal) modal.classList.add('hidden');
}

// 3. Guardar Cambios del Préstamo Editado
function handleSaveEditLoan(event) {
    event.preventDefault();

    const loanId = parseInt(document.getElementById('edit-loan-id').value);
    const amount = parseFloat(document.getElementById('edit-loan-amount').value);
    const rate = parseFloat(document.getElementById('edit-loan-rate').value);
    const frequency = document.getElementById('edit-loan-freq').value;
    const lateFee = parseFloat(document.getElementById('edit-loan-late-fee').value) || 0;

    const loan = loans.find(l => l.id === loanId);
    if (!loan) return;

    // Actualizar datos del préstamo
    loan.amount = amount;
    loan.rate = rate;
    loan.frequency = frequency;
    loan.lateFee = lateFee;

    // Recalcular monto base por cuota no pagada si cambió el monto o la tasa
    const totalWithInterest = amount + (amount * (rate / 100));
    const installmentAmount = Math.round(totalWithInterest / loan.installments.length);

    loan.installments.forEach(inst => {
        if (!inst.paid) {
            inst.amount = installmentAmount;
            inst.lateFee = lateFee;
        }
    });

    // Guardar en localStorage si usas almacenamiento local
    if (typeof saveToLocalStorage === 'function') {
        saveToLocalStorage();
    }

    closeEditLoanModal();

    // Actualizar todas las vistas
    renderDashboard();
    renderLoans();
    renderClients();

    alert('Préstamo actualizado correctamente.');
}

// 4. Eliminar Préstamo
function deleteLoan(loanId) {
    const loan = loans.find(l => l.id === loanId);
    if (!loan) return;

    const client = clients.find(c => c.id === loan.clientId);
    const clientName = client ? client.name : 'este cliente';

    const confirmDelete = confirm(`¿Estás seguro de que deseas eliminar el préstamo de $${loan.amount.toLocaleString()} de ${clientName}? Esta acción no se puede deshacer.`);

    if (confirmDelete) {
        // Filtrar y remover el préstamo del arreglo global
        loans = loans.filter(l => l.id !== loanId);

        // Guardar en localStorage si usas almacenamiento local
        if (typeof saveToLocalStorage === 'function') {
            saveToLocalStorage();
        }

        // Actualizar las vistas
        renderDashboard();
        renderLoans();
        renderClients();

        alert('Préstamo eliminado con éxito.');
    }
}

// --- FUNCION PARA ACTUALIZAR EL SIMULADOR EN TIEMPO REAL ---
function updateSimulation() {
    const amountEl = document.getElementById('loan-amount');
    const rateEl = document.getElementById('loan-rate');
    const instEl = document.getElementById('loan-installments');
    const freqEl = document.getElementById('loan-freq');

    const amount = amountEl ? (parseFloat(amountEl.value) || 0) : 0;
    const rate = rateEl ? (parseFloat(rateEl.value) || 0) : 0;
    const installments = instEl ? (parseInt(instEl.value) || 1) : 1;
    const freq = freqEl ? freqEl.value : 'semanal';

    const interest = amount * (rate / 100);
    const total = amount + interest;
    const installmentAmount = installments > 0 ? Math.round(total / installments) : Math.round(total);

    // Buscar y actualizar los elementos del panel azul
    // Se prueban los IDs más comunes por si en tu HTML varían
    const elTotal = document.getElementById('sim-total') || document.getElementById('preview-total');
    const elCapital = document.getElementById('sim-capital') || document.getElementById('preview-capital');
    const elInterest = document.getElementById('sim-interest') || document.getElementById('preview-interest');
    const elInstallment = document.getElementById('sim-installment') || document.getElementById('preview-installment');
    const elPlan = document.getElementById('sim-plan') || document.getElementById('preview-plan');

    if (elTotal) elTotal.innerText = `$${Math.round(total).toLocaleString()}`;
    if (elCapital) elCapital.innerText = `$${Math.round(amount).toLocaleString()}`;
    if (elInterest) elInterest.innerText = `$${Math.round(interest).toLocaleString()}`;
    if (elInstallment) elInstallment.innerText = `$${installmentAmount.toLocaleString()}`;
    if (elPlan) elPlan.innerText = `${installments} cuotas ${freq}es`;
}
// --- LÓGICA DEL SIMULADOR Y PRESUPUESTO ---
function calculateSimulation() {
    // 1. Lectura de campos del formulario del simulador
    const clientNameInput = document.getElementById('sim-client-name');
    const amountInput = document.getElementById('sim-amount');
    const rateInput = document.getElementById('sim-rate');
    const installmentsInput = document.getElementById('sim-installments');
    const freqInput = document.getElementById('sim-freq');

    const clientName = (clientNameInput && clientNameInput.value.trim() !== '') ? clientNameInput.value : 'Consumidor Final';
    const amount = amountInput ? (parseFloat(amountInput.value) || 0) : 0;
    const rate = rateInput ? (parseFloat(rateInput.value) || 0) : 0;
    const installments = installmentsInput ? (parseInt(installmentsInput.value) || 1) : 1;
    const freq = freqInput ? freqInput.value : 'semanal';

    // 2. Cálculos financieros
    const interest = amount * (rate / 100);
    const total = amount + interest;
    const installmentVal = installments > 0 ? Math.round(total / installments) : Math.round(total);

    // 3. Mapeo de frecuencias a texto
    const freqTextMap = {
        'diario': 'diarias',
        'semanal': 'semanales',
        'quincenal': 'quincenales',
        'mensual': 'mensuales'
    };
    const freqLabel = freqTextMap[freq] || 'semanales';

    // 4. Actualización de la tarjeta azul
    const elClient = document.getElementById('sim-res-client-display');
    const elTotal = document.getElementById('sim-res-total');
    const elCapital = document.getElementById('sim-res-capital');
    const elProfit = document.getElementById('sim-res-profit');
    const elInstallmentVal = document.getElementById('sim-res-installment-val');
    const elPlanText = document.getElementById('sim-res-plan-text');

    if (elClient) elClient.innerText = clientName;
    if (elTotal) elTotal.innerText = `$${Math.round(total).toLocaleString()}`;
    if (elCapital) elCapital.innerText = `$${Math.round(amount).toLocaleString()}`;
    if (elProfit) elProfit.innerText = `$${Math.round(interest).toLocaleString()}`;
    if (elInstallmentVal) elInstallmentVal.innerText = `$${installmentVal.toLocaleString()}`;
    if (elPlanText) elPlanText.innerText = `${installments} cuotas ${freqLabel}`;
}

// Ejecutar el cálculo automático al cargar
document.addEventListener('DOMContentLoaded', () => {
    calculateSimulation();
});
// --- FUNCIONES DEL SIMULADOR (AGREGAR AL FINAL DE APP.JS) ---

function shareSimulationWhatsApp() {
    const clientNameInput = document.getElementById('sim-client-name');
    const amountInput = document.getElementById('sim-amount');
    const rateInput = document.getElementById('sim-rate');
    const installmentsInput = document.getElementById('sim-installments');
    const freqInput = document.getElementById('sim-freq');

    const clientName = (clientNameInput && clientNameInput.value.trim() !== '') ? clientNameInput.value : 'Cliente';
    const amount = amountInput ? (parseFloat(amountInput.value) || 0) : 0;
    const rate = rateInput ? (parseFloat(rateInput.value) || 0) : 0;
    const installments = installmentsInput ? (parseInt(installmentsInput.value) || 1) : 1;
    const freq = freqInput ? freqInput.value : 'semanal';

    const total = amount + (amount * (rate / 100));
    const installmentVal = installments > 0 ? Math.round(total / installments) : Math.round(total);

    const freqTextMap = { 'diario': 'diarias', 'semanal': 'semanales', 'quincenal': 'quincenales', 'mensual': 'mensuales' };
    const freqLabel = freqTextMap[freq] || 'semanales';

    const message = `Hola *${clientName}*, te comparto el presupuesto solicitado:\n\n` +
                    `• *Monto del préstamo:* $${amount.toLocaleString()}\n` +
                    `• *Plan de pago:* ${installments} cuotas ${freqLabel} de $${installmentVal.toLocaleString()}\n` +
                    `• *Total a pagar:* $${Math.round(total).toLocaleString()}\n\n` +
                    `Quedamos a disposición para gestionar tu solicitud.`;

    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`, '_blank');
}

function downloadSimulationCard() {
    const card = document.getElementById('sim-result-card');
    if (!card) return;

    if (typeof html2canvas === 'undefined') {
        alert('Para descargar la imagen, asegúrate de incluir la librería html2canvas en tu HTML.');
        return;
    }

    html2canvas(card).then(canvas => {
        const link = document.createElement('a');
        link.download = 'presupuesto-prestamo.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
    });
}

function convertSimulationToLoan() {
    const clientNameInput = document.getElementById('sim-client-name');
    const amountInput = document.getElementById('sim-amount');
    const rateInput = document.getElementById('sim-rate');
    const installmentsInput = document.getElementById('sim-installments');
    const freqInput = document.getElementById('sim-freq');

    // Abre el modal de préstamo si existe la función
    if (typeof openLoanModal === 'function') {
        openLoanModal();
    }

    // Completa los campos del modal con los datos actuales del simulador
    setTimeout(() => {
        const loanClient = document.getElementById('loan-client-name') || document.getElementById('loan-client');
        const loanAmount = document.getElementById('loan-amount');
        const loanRate = document.getElementById('loan-rate');
        const loanInstallments = document.getElementById('loan-installments');
        const loanFreq = document.getElementById('loan-freq');

        if (loanClient && clientNameInput) loanClient.value = clientNameInput.value;
        if (loanAmount && amountInput) loanAmount.value = amountInput.value;
        if (loanRate && rateInput) loanRate.value = rateInput.value;
        if (loanInstallments && installmentsInput) loanInstallments.value = installmentsInput.value;
        if (loanFreq && freqInput) loanFreq.value = freqInput.value;
    }, 100);
}
 // ==========================================
// LISTENER DIRECTO PARA BOTONES DEL SIMULADOR
// ==========================================
document.addEventListener('click', function (e) {
    // Detectar botón "Enviar Texto" / WhatsApp
    const btnWhatsApp = e.target.closest('button') && (
        e.target.closest('button').innerText.includes('Enviar Texto') || 
        e.target.closest('button').querySelector('.fa-whatsapp')
    ) ? e.target.closest('button') : null;

    if (btnWhatsApp) {
        e.preventDefault();
        const clientNameInput = document.getElementById('sim-client-name');
        const amountInput = document.getElementById('sim-amount');
        const rateInput = document.getElementById('sim-rate');
        const installmentsInput = document.getElementById('sim-installments');
        const freqInput = document.getElementById('sim-freq');

        const clientName = (clientNameInput && clientNameInput.value.trim() !== '') ? clientNameInput.value : 'Cliente';
        const amount = amountInput ? (parseFloat(amountInput.value) || 0) : 0;
        const rate = rateInput ? (parseFloat(rateInput.value) || 0) : 0;
        const installments = installmentsInput ? (parseInt(installmentsInput.value) || 1) : 1;
        const freq = freqInput ? freqInput.value : 'semanal';

        const total = amount + (amount * (rate / 100));
        const installmentVal = installments > 0 ? Math.round(total / installments) : Math.round(total);

        const freqTextMap = { 'diario': 'diarias', 'semanal': 'semanales', 'quincenal': 'quincenales', 'mensual': 'mensuales' };
        const freqLabel = freqTextMap[freq] || 'semanales';

        const message = `Hola *${clientName}*, te comparto el presupuesto solicitado:\n\n` +
                        `• *Monto del préstamo:* $${amount.toLocaleString()}\n` +
                        `• *Plan de pago:* ${installments} cuotas ${freqLabel} de $${installmentVal.toLocaleString()}\n` +
                        `• *Total a pagar:* $${Math.round(total).toLocaleString()}\n\n` +
                        `Quedamos a disposición para gestionar tu solicitud.`;

        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`, '_blank');
        return;
    }

    // Detectar botón "Descargar Imagen"
    const btnDownload = e.target.closest('button') && (
        e.target.closest('button').innerText.includes('Descargar Imagen') || 
        e.target.closest('button').querySelector('.fa-download')
    ) ? e.target.closest('button') : null;

    if (btnDownload) {
        e.preventDefault();
        const card = document.getElementById('sim-result-card') || document.querySelector('.bg-indigo-900') || document.querySelector('.bg-blue-900');
        
        if (typeof html2canvas === 'undefined') {
            alert('Para descargar la imagen de la tarjeta, necesitas la librería html2canvas integrada en tu HTML.');
            return;
        }

        if (card) {
            html2canvas(card).then(canvas => {
                const link = document.createElement('a');
                link.download = 'presupuesto-prestamo.png';
                link.href = canvas.toDataURL('image/png');
                link.click();
            });
        } else {
            alert('No se encontró la tarjeta para descargar.');
        }
        return;
    }

    // Detectar botón "Crear Préstamo"
    const btnCreateLoan = e.target.closest('button') && (
        e.target.closest('button').innerText.includes('Crear Préstamo') || 
        e.target.closest('button').querySelector('.fa-file-circle-plus')
    ) ? e.target.closest('button') : null;

    if (btnCreateLoan) {
        e.preventDefault();
        // Abre el modal llamando a la función existente o quitando la clase hidden
        const modal = document.getElementById('modal-loan') || document.getElementById('modal-prestamo');
        if (modal) {
            modal.classList.remove('hidden');
        } else if (typeof openLoanModal === 'function') {
            openLoanModal();
        }

        // Copia los valores del simulador al formulario de nuevo préstamo
        const clientNameInput = document.getElementById('sim-client-name');
        const amountInput = document.getElementById('sim-amount');
        const rateInput = document.getElementById('sim-rate');
        const installmentsInput = document.getElementById('sim-installments');
        const freqInput = document.getElementById('sim-freq');

        setTimeout(() => {
            const loanClient = document.getElementById('loan-client-name') || document.getElementById('loan-client');
            const loanAmount = document.getElementById('loan-amount');
            const loanRate = document.getElementById('loan-rate');
            const loanInstallments = document.getElementById('loan-installments');
            const loanFreq = document.getElementById('loan-freq');

            if (loanClient && clientNameInput) loanClient.value = clientNameInput.value;
            if (loanAmount && amountInput) loanAmount.value = amountInput.value;
            if (loanRate && rateInput) loanRate.value = rateInput.value;
            if (loanInstallments && installmentsInput) loanInstallments.value = installmentsInput.value;
            if (loanFreq && freqInput) loanFreq.value = freqInput.value;
        }, 100);
        return;
    }
});