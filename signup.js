// ============================================================
// SIGNUP — Navegación de pasos + Google Sign-In + uploads
// ============================================================

let currentStep = 1;

// Callback que llama Google después del login
window.handleGoogleSignIn = function(response) {
    // El JWT viene en response.credential
    const payload = JSON.parse(atob(response.credential.split('.')[1]));
    // payload tiene: email, name, given_name, family_name, picture, sub, etc.

    // Guardar datos en sessionStorage para usar en dashboard
    sessionStorage.setItem('user', JSON.stringify({
        email: payload.email,
        name: payload.name,
        firstName: payload.given_name,
        lastName: payload.family_name,
        picture: payload.picture,
        provider: 'google'
    }));

    // Pre-llenar paso 1 (si vuelve atrás) y saltar al paso 2
    const emailInput = document.getElementById('email');
    if (emailInput) emailInput.value = payload.email;

    // Ir al paso 2
    goToStep(2);

    // Pre-llenar paso 2 (después de que se muestre)
    setTimeout(() => {
        const fn = document.getElementById('firstName');
        const ln = document.getElementById('lastName');
        if (fn && payload.given_name) fn.value = payload.given_name;
        if (ln && payload.family_name) ln.value = payload.family_name;
    }, 100);
};

function goToStep(n) {
    // Validar paso 1: passwords match
    if (currentStep === 1 && n === 2) {
        const p1 = document.getElementById('password').value;
        const p2 = document.getElementById('password2').value;
        if (p1 !== p2) {
            alert('Las contraseñas no coinciden.');
            return;
        }
    }

    // Esconder paso actual, mostrar siguiente
    document.querySelector(`.step-panel[data-panel="${currentStep}"]`).classList.remove('active');
    document.querySelector(`.step-panel[data-panel="${n}"]`).classList.add('active');

    // Actualizar barra de progreso
    document.querySelectorAll('.progress-step').forEach((s, i) => {
        const step = i + 1;
        s.classList.remove('active', 'done');
        if (step < n) s.classList.add('done');
        if (step === n) s.classList.add('active');
    });
    document.querySelectorAll('.progress-line').forEach((l, i) => {
        l.classList.toggle('done', i + 1 < n);
    });

    currentStep = n;
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function onFilePicked(input, previewId) {
    const file = input.files[0];
    if (!file) return;

    const preview = document.getElementById(previewId);
    const area = input.closest('.upload-area');
    area.classList.add('has-file');

    if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = e => {
            preview.innerHTML = `<img src="${e.target.result}" alt="preview">`;
        };
        reader.readAsDataURL(file);
    } else {
        preview.innerHTML = `<div class="filename">✓ ${file.name}</div>`;
    }
}

function finishSignup() {
    // Validar que ambos archivos estén subidos
    const doc = document.getElementById('docFile').files[0];
    const selfie = document.getElementById('selfieFile').files[0];

    if (!doc || !selfie) {
        alert('Subí ambos archivos: documento + selfie.');
        return;
    }

    // Mostrar email en paso 4
    const email = document.getElementById('email').value || 'tu email';
    document.getElementById('finalEmail').textContent = email;

    goToStep(4);
}
