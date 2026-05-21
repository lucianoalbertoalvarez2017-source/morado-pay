// ============================================================
// DASHBOARD — Conecta al backend y muestra datos reales del usuario
// ============================================================

let CURRENT_USER = null;
let CURRENT_BALANCE = 0;

// Cargar usuario actual del backend
async function loadUser() {
    try {
        const r = await fetch('/api/me', { credentials: 'same-origin' });
        if (r.status === 401) {
            window.location.href = '/index.html';
            return;
        }
        const { user } = await r.json();
        CURRENT_USER = user;
        CURRENT_BALANCE = user.balance || 0;
        applyUserToUI(user);
    } catch (err) {
        console.warn('No se pudo cargar el usuario', err);
    }
}

function applyUserToUI(u) {
    // Título "Hola, X 👋"
    const h1 = document.querySelector('.topbar h1');
    if (h1 && u.firstName) h1.textContent = `Hola, ${u.firstName} 👋`;

    // Avatar (foto de Google o iniciales)
    const initials = ((u.firstName || u.email || '').charAt(0) + (u.lastName || '').charAt(0)).toUpperCase();
    document.querySelectorAll('.avatar').forEach(a => {
        if (u.picture) {
            a.style.background = `url(${u.picture}) center/cover`;
            a.textContent = '';
        } else if (initials) {
            a.textContent = initials;
        }
    });

    // Nombre en sidebar
    const userBlock = document.querySelector('.sidebar-user strong');
    if (userBlock) userBlock.textContent = u.firstName ? `${u.firstName} ${u.lastName || ''}`.trim() : u.email;

    // Holder en cuenta US
    const holder = document.querySelector('.account-info dd');
    if (holder) holder.textContent = u.firstName ? `${u.firstName} ${u.lastName || ''}`.trim() : u.email;
}

// Cargar transacciones del backend
async function loadTransactions() {
    try {
        const r = await fetch('/api/transactions', { credentials: 'same-origin' });
        if (!r.ok) return;
        const { transactions } = await r.json();
        renderTransactions(transactions);
    } catch (err) {
        console.warn('No se cargaron las transacciones', err);
    }
}

function renderTransactions(txs) {
    const list = document.querySelector('.tx-list');
    if (!list) return;
    if (!txs.length) {
        list.innerHTML = `<p style="color: var(--text-dim); padding: 20px; text-align: center;">Aún no tenés transacciones.</p>`;
        return;
    }

    const iconClass = { send: '', receive: 'green', convert: '', card: '', crypto: 'orange' };
    const iconSymbol = { send: '↑', receive: '↓', convert: '⇄', card: '💳', crypto: '₿' };

    list.innerHTML = txs.map(t => {
        const date = new Date(t.timestamp).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' });
        const sign = t.type === 'receive' ? '+' : '-';
        const cls = t.type === 'receive' ? 'green' : '';
        return `
            <div class="tx-row">
                <div class="tx-icon ${iconClass[t.type] || ''}">${iconSymbol[t.type] || '?'}</div>
                <div class="tx-info">
                    <strong>${escapeHtml(t.description || t.type)}</strong>
                    <span>${escapeHtml(t.type)}</span>
                </div>
                <div class="tx-date">${date}</div>
                <div class="tx-amount ${cls}">${sign}$${t.amount.toFixed(2)}</div>
            </div>
        `;
    }).join('');
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// Actualizar saldo en la UI
function setBalance(amount) {
    CURRENT_BALANCE = amount;
    const el = document.getElementById('balance');
    if (el) el.textContent = amount.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Animación del balance al cargar
function animateBalance(target) {
    const el = document.getElementById('balance');
    if (!el) return;
    let cur = 0;
    const step = target / 40;
    const t = setInterval(() => {
        cur += step;
        if (cur >= target) { cur = target; clearInterval(t); }
        el.textContent = cur.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }, 25);
}

// Crear transacción
async function postTransaction(type, amount, description) {
    const r = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, amount, description }),
        credentials: 'same-origin',
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Error en transacción');
    setBalance(data.balance);
    loadTransactions();
    return data;
}

// ============================================================
// MODALS
// ============================================================

const modals = {
    send: `
        <h2>Enviar dinero</h2>
        <label>Destinatario
            <input type="text" id="sendTo" placeholder="alguien@email.com">
        </label>
        <label>Monto USD
            <input type="number" id="sendAmount" placeholder="100.00" min="1" step="0.01">
        </label>
        <label>Nota
            <input type="text" id="sendNote" placeholder="Pago por...">
        </label>
        <button class="btn-primary btn-lg btn-full" onclick="doSend()">Enviar</button>
    `,
    receive: `
        <h2>Recibir dinero</h2>
        <p class="modal-desc">Compartí estos datos con quien te va a pagar:</p>
        <div class="receive-info">
            <strong>Beneficiario:</strong> <span id="rcvHolder">—</span><br>
            <strong>Account:</strong> 8421 7593 2046 1208<br>
            <strong>Routing ACH:</strong> 026073150<br>
            <strong>Routing Wire:</strong> 026073008<br>
            <strong>Banco:</strong> Community Federal Savings
        </div>
        <button class="btn-primary btn-lg btn-full" onclick="confirmAction('Datos copiados ✓'); navigator.clipboard.writeText('8421 7593 2046 1208')">
            📋 Copiar account number
        </button>
    `,
    convert: `
        <h2>Convertir USD</h2>
        <label>Monto USD
            <input type="number" id="convertAmount" placeholder="100.00" min="1" step="0.01" oninput="updateConvert()">
        </label>
        <label>Convertir a
            <select id="convertTo" class="select-styled" onchange="updateConvert()">
                <option value="ARS,1355">🇦🇷 Pesos argentinos (ARS)</option>
                <option value="MXN,17.42">🇲🇽 Pesos mexicanos (MXN)</option>
                <option value="COP,4021">🇨🇴 Pesos colombianos (COP)</option>
                <option value="BRL,5.12">🇧🇷 Reales brasileños (BRL)</option>
            </select>
        </label>
        <div class="convert-result">
            <div class="convert-label">Vas a recibir:</div>
            <div id="convertResult" class="convert-amount">$0.00</div>
            <div class="convert-fee">Comisión 1% incluida</div>
        </div>
        <button class="btn-primary btn-lg btn-full" onclick="doConvert()">Confirmar conversión</button>
    `,
    crypto: `
        <h2>Retirar en cripto</h2>
        <label>Monto USD
            <input type="number" id="cryptoAmount" placeholder="100.00" min="10" step="0.01">
        </label>
        <label>Cripto
            <select id="cryptoType" class="select-styled">
                <option>USDT (TRC20)</option>
                <option>USDT (ERC20)</option>
                <option>USDC (ERC20)</option>
                <option>BTC</option>
            </select>
        </label>
        <label>Wallet
            <input type="text" id="cryptoWallet" placeholder="TXa7vK2p... o 0x...">
        </label>
        <button class="btn-primary btn-lg btn-full" onclick="doCrypto()">Retirar</button>
    `,
};

function openModal(type) {
    document.getElementById('modalContent').innerHTML = modals[type];
    document.getElementById('actionModal').classList.add('active');
    document.body.style.overflow = 'hidden';
    if (type === 'receive' && CURRENT_USER) {
        const h = document.getElementById('rcvHolder');
        if (h) h.textContent = `${CURRENT_USER.firstName || ''} ${CURRENT_USER.lastName || ''}`.trim() || CURRENT_USER.email;
    }
}

function closeModal() {
    document.getElementById('actionModal').classList.remove('active');
    document.body.style.overflow = '';
}

function confirmAction(msg) {
    document.getElementById('modalContent').innerHTML = `
        <div class="success-state">
            <div class="success-circle">✓</div>
            <h2>${escapeHtml(msg)}</h2>
            <p>La operación se completó correctamente.</p>
            <button class="btn-primary btn-lg btn-full" onclick="closeModal()">Listo</button>
        </div>
    `;
}

async function doSend() {
    const to = document.getElementById('sendTo').value;
    const amt = parseFloat(document.getElementById('sendAmount').value);
    const note = document.getElementById('sendNote').value;
    if (!to || !amt || amt <= 0) return alert('Llená todos los campos.');
    if (amt > CURRENT_BALANCE) return alert('Saldo insuficiente.');
    try {
        await postTransaction('send', amt, `→ ${to} · ${note}`);
        confirmAction('Enviado ✓');
    } catch (err) { alert(err.message); }
}

async function doConvert() {
    const amt = parseFloat(document.getElementById('convertAmount').value);
    const sel = document.getElementById('convertTo').value;
    const [currency] = sel.split(',');
    if (!amt || amt <= 0) return alert('Ingresá un monto.');
    if (amt > CURRENT_BALANCE) return alert('Saldo insuficiente.');
    try {
        await postTransaction('convert', amt, `→ ${currency}`);
        confirmAction('Convertido ✓');
    } catch (err) { alert(err.message); }
}

async function doCrypto() {
    const amt = parseFloat(document.getElementById('cryptoAmount').value);
    const cripto = document.getElementById('cryptoType').value;
    const wallet = document.getElementById('cryptoWallet').value;
    if (!amt || amt < 10) return alert('Mínimo $10.');
    if (!wallet) return alert('Ingresá tu wallet.');
    if (amt > CURRENT_BALANCE) return alert('Saldo insuficiente.');
    try {
        await postTransaction('crypto', amt, `${cripto} → ${wallet.slice(0, 8)}...`);
        confirmAction('Retiro iniciado ✓');
    } catch (err) { alert(err.message); }
}

function updateConvert() {
    const amount = parseFloat(document.getElementById('convertAmount').value) || 0;
    const [currency, rateStr] = document.getElementById('convertTo').value.split(',');
    const rate = parseFloat(rateStr);
    const result = (amount * rate * 0.99).toFixed(2);
    const formatted = parseFloat(result).toLocaleString('es', { minimumFractionDigits: 2 });
    document.getElementById('convertResult').textContent = `$ ${formatted} ${currency}`;
}

function copyAccount() {
    const text = document.getElementById('acctNumber').textContent;
    navigator.clipboard.writeText(text);
    alert('Copiado: ' + text);
}

// ESC cierra modal
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
});

// Init
window.addEventListener('load', async () => {
    await loadUser();
    if (CURRENT_BALANCE > 0) {
        animateBalance(CURRENT_BALANCE);
    } else {
        setBalance(0);
    }
    await loadTransactions();
});
