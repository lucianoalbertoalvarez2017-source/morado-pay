// ============================================================
// SIGNUP — Navegación de pasos + Google Sign-In + API
// ============================================================

let currentStep = 1;

// Callback que llama Google después del login
window.handleGoogleSignIn = async function(response) {
    try {
        const r = await fetch('/api/google-auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ credential: response.credential }),
            credentials: 'same-origin',
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'Error en Google Auth');

        // Cuenta creada/iniciada — al dashboard
        window.location.href = '/dashboard.html';
    } catch (err) {
        alert('No se pudo iniciar con Google: ' + err.message);
    }
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

async function finishSignup() {
    // Validar que ambos archivos estén subidos
    const doc = document.getElementById('docFile').files[0];
    const selfie = document.getElementById('selfieFile').files[0];

    if (!doc || !selfie) {
        alert('Subí ambos archivos: documento + selfie.');
        return;
    }

    // Llamar al backend con todos los datos recopilados
    const body = {
        email:     document.getElementById('email').value,
        password:  document.getElementById('password').value,
        firstName: document.getElementById('firstName').value,
        lastName:  document.getElementById('lastName').value,
        country:   document.getElementById('country').value,
        phone:     document.getElementById('phone').value,
        dob:       document.getElementById('dob').value,
        job:       document.getElementById('job').value,
    };

    try {
        const r = await fetch('/api/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            credentials: 'same-origin',
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'Error al crear cuenta');

        // Mostrar email en paso 4 y avanzar
        document.getElementById('finalEmail').textContent = body.email;
        goToStep(4);
    } catch (err) {
        alert('No se pudo crear la cuenta: ' + err.message);
    }
}
