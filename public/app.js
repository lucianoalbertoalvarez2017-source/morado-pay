// ============================================================
// MORADO PAY — Lógica del landing + login real
// ============================================================

function openLogin() {
    document.getElementById('loginModal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeLogin() {
    document.getElementById('loginModal').classList.remove('active');
    document.body.style.overflow = '';
}

// Login con email + password (POST al backend)
async function doLogin(event) {
    event.preventDefault();
    const form = event.target;
    const email = form.querySelector('input[type=email]').value;
    const password = form.querySelector('input[type=password]').value;
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    const originalText = btn.textContent;
    btn.textContent = 'Entrando...';
    try {
        const r = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
            credentials: 'same-origin',
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'Error al iniciar sesión');
        window.location.href = '/dashboard.html';
    } catch (err) {
        alert(err.message);
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

// Smooth scroll para anchors
document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
        const target = document.querySelector(a.getAttribute('href'));
        if (target) {
            e.preventDefault();
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });
});

// Cerrar modal con ESC
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeLogin();
});
