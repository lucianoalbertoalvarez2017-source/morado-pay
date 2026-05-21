// ============================================================
// MORADO PAY — Lógica del landing
// ============================================================

function openLogin() {
    document.getElementById('loginModal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeLogin() {
    document.getElementById('loginModal').classList.remove('active');
    document.body.style.overflow = '';
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
