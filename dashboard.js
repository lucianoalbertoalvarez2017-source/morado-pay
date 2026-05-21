// ============================================================
// DASHBOARD — Lógica de modals + interacciones + datos Google
// ============================================================

// Si hay datos de usuario en sessionStorage (vinieron por Google), aplícalos
(function applyUserData() {
    const raw = sessionStorage.getItem('user');
    if (!raw) return;
    try {
        const u = JSON.parse(raw);
        // Título "Hola, X 👋"
        const h1 = document.querySelector('.topbar h1');
        if (h1 && u.firstName) h1.textContent = `Hola, ${u.firstName} 👋`;
        // Avatar (iniciales)
        const initials = ((u.firstName || '').charAt(0) + (u.lastName || '').charAt(0)).toUpperCase();
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
        if (userBlock && u.name) userBlock.textContent = u.name;
        // Holder en cuenta US
        const holder = document.querySelector('.account-info dd');
        if (holder && u.name) holder.textContent = u.name;
    } catch (e) {
        console.warn('No se pudo cargar el usuario', e);
    }
})();


const modals = {
    send: `
        <h2>Enviar dinero</h2>
        <label>Destinatario (email o usuario)
            <input type="text" placeholder="alguien@email.com">
        </label>
        <label>Monto USD
            <input type="number" placeholder="100.00" min="1">
        </label>
        <label>Nota (opcional)
            <input type="text" placeholder="Pago por...">
        </label>
        <button class="btn-primary btn-lg btn-full" onclick="confirmAction('Enviado ✓')">Enviar</button>
    `,
    receive: `
        <h2>Recibir dinero</h2>
        <p style="color: var(--text-dim); margin-bottom: 20px;">
            Compartí estos datos con quien te va a pagar:
        </p>
        <div style="background: var(--bg); padding: 16px; border-radius: 10px; margin-bottom: 16px; font-family: monospace; font-size: 14px; line-height: 1.8;">
            <strong>Beneficiario:</strong> Lucia Morado<br>
            <strong>Account:</strong> 8421 7593 2046 1208<br>
            <strong>Routing ACH:</strong> 026073150<br>
            <strong>Routing Wire:</strong> 026073008<br>
            <strong>Banco:</strong> Community Federal Savings
        </div>
        <button class="btn-primary btn-lg btn-full" onclick="confirmAction('Copiado ✓'); navigator.clipboard.writeText('8421 7593 2046 1208')">
            📋 Copiar al portapapeles
        </button>
    `,
    convert: `
        <h2>Convertir USD a tu moneda</h2>
        <label>Monto USD
            <input type="number" id="convertAmount" placeholder="100.00" min="1" oninput="updateConvert()">
        </label>
        <label>Convertir a
            <select id="convertTo" onchange="updateConvert()" style="display: block; width: 100%; margin-top: 6px; padding: 12px 16px; background: var(--bg); border: 1px solid var(--border); border-radius: 10px; color: var(--text); font-size: 15px;">
                <option value="ARS,1355">🇦🇷 Pesos argentinos (ARS)</option>
                <option value="MXN,17.42">🇲🇽 Pesos mexicanos (MXN)</option>
                <option value="COP,4021">🇨🇴 Pesos colombianos (COP)</option>
                <option value="BRL,5.12">🇧🇷 Reales brasileños (BRL)</option>
            </select>
        </label>
        <div style="background: var(--bg); padding: 16px; border-radius: 10px; margin-bottom: 16px;">
            <div style="color: var(--text-dim); font-size: 13px; margin-bottom: 4px;">Vas a recibir:</div>
            <div id="convertResult" style="font-size: 28px; font-weight: 800; color: var(--green);">$0.00</div>
            <div style="color: var(--text-mute); font-size: 12px; margin-top: 4px;">Comisión 1% incluida</div>
        </div>
        <button class="btn-primary btn-lg btn-full" onclick="confirmAction('Convertido ✓')">Confirmar conversión</button>
    `,
    crypto: `
        <h2>Retirar en cripto</h2>
        <label>Monto USD
            <input type="number" placeholder="100.00" min="10">
        </label>
        <label>Cripto
            <select style="display: block; width: 100%; margin-top: 6px; padding: 12px 16px; background: var(--bg); border: 1px solid var(--border); border-radius: 10px; color: var(--text); font-size: 15px;">
                <option>USDT (TRC20) — recomendado</option>
                <option>USDT (ERC20)</option>
                <option>USDC (ERC20)</option>
                <option>BTC</option>
            </select>
        </label>
        <label>Wallet
            <input type="text" placeholder="TXa7vK2p... o 0x...">
        </label>
        <button class="btn-primary btn-lg btn-full" onclick="confirmAction('Retiro iniciado ✓')">Retirar</button>
    `,
};

function openModal(type) {
    document.getElementById('modalContent').innerHTML = modals[type];
    document.getElementById('actionModal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    document.getElementById('actionModal').classList.remove('active');
    document.body.style.overflow = '';
}

function confirmAction(msg) {
    document.getElementById('modalContent').innerHTML = `
        <div style="text-align: center; padding: 20px 0;">
            <div style="width: 80px; height: 80px; background: var(--green); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; font-size: 40px;">✓</div>
            <h2 style="margin-bottom: 8px;">${msg}</h2>
            <p style="color: var(--text-dim);">La operación se completó correctamente.</p>
            <button class="btn-primary btn-lg btn-full" style="margin-top: 24px;" onclick="closeModal()">Listo</button>
        </div>
    `;
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

// Animación del balance al cargar
window.addEventListener('load', () => {
    const target = 12847.50;
    const el = document.getElementById('balance');
    let cur = 0;
    const step = target / 40;
    const t = setInterval(() => {
        cur += step;
        if (cur >= target) { cur = target; clearInterval(t); }
        el.textContent = cur.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }, 25);
});
