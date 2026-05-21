// ============================================================
// MORADO PAY — Backend Express + Upstash Redis
// ============================================================

import express from 'express';
import { Redis } from '@upstash/redis';
import bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// ============ Upstash Redis ============
const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';

// ============ Helpers de sesión ============
function signToken(email) {
    const payload = `${email}:${Date.now()}`;
    const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
    return Buffer.from(`${payload}:${sig}`).toString('base64url');
}

function verifyToken(token) {
    try {
        const decoded = Buffer.from(token, 'base64url').toString('utf8');
        const idx = decoded.lastIndexOf(':');
        if (idx < 0) return null;
        const payload = decoded.slice(0, idx);
        const sig = decoded.slice(idx + 1);
        const expected = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
        if (sig !== expected) return null;
        const [email, ts] = payload.split(':');
        return { email, timestamp: parseInt(ts) };
    } catch {
        return null;
    }
}

function setSession(res, email) {
    const token = signToken(email);
    res.cookie('token', token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 30 * 24 * 3600 * 1000,
    });
}

async function requireAuth(req, res, next) {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: 'No autorizado' });
    const session = verifyToken(token);
    if (!session) return res.status(401).json({ error: 'Sesión inválida' });
    const user = await redis.get(`user:${session.email}`);
    if (!user) return res.status(401).json({ error: 'Usuario no existe' });
    req.user = user;
    next();
}

function safeUser(user) {
    const { passwordHash, ...rest } = user;
    return rest;
}

// ============ API: Auth ============
app.post('/api/signup', async (req, res) => {
    const { email, password, firstName, lastName, country, phone, dob, job } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Faltan email o contraseña' });
    if (password.length < 8) return res.status(400).json({ error: 'Contraseña muy corta (mín 8)' });

    const existing = await redis.get(`user:${email}`);
    if (existing) return res.status(409).json({ error: 'Ya existe una cuenta con ese email' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = {
        email,
        passwordHash,
        firstName: firstName || '',
        lastName: lastName || '',
        country: country || '',
        phone: phone || '',
        dob: dob || '',
        job: job || '',
        balance: 0,
        provider: 'password',
        createdAt: Date.now(),
    };
    await redis.set(`user:${email}`, user);

    setSession(res, email);
    res.json({ ok: true, user: safeUser(user) });
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Faltan credenciales' });

    const user = await redis.get(`user:${email}`);
    if (!user) return res.status(401).json({ error: 'Credenciales inválidas' });
    if (!user.passwordHash) return res.status(401).json({ error: 'Esta cuenta usa Google. Iniciá con Google.' });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Credenciales inválidas' });

    setSession(res, email);
    res.json({ ok: true, user: safeUser(user) });
});

app.post('/api/google-auth', async (req, res) => {
    const { credential } = req.body || {};
    if (!credential) return res.status(400).json({ error: 'Falta credential' });

    const parts = credential.split('.');
    if (parts.length !== 3) return res.status(400).json({ error: 'JWT inválido' });

    let payload;
    try {
        payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    } catch {
        return res.status(400).json({ error: 'No se pudo decodificar el JWT' });
    }

    if (GOOGLE_CLIENT_ID && payload.aud !== GOOGLE_CLIENT_ID) {
        return res.status(401).json({ error: 'Audience del JWT no coincide' });
    }
    if (payload.exp && payload.exp * 1000 < Date.now()) {
        return res.status(401).json({ error: 'JWT expirado' });
    }
    if (!payload.email_verified) {
        return res.status(401).json({ error: 'Email no verificado por Google' });
    }

    const email = payload.email;
    let user = await redis.get(`user:${email}`);

    if (!user) {
        user = {
            email,
            passwordHash: null,
            firstName: payload.given_name || '',
            lastName: payload.family_name || '',
            picture: payload.picture || '',
            googleId: payload.sub,
            country: '',
            balance: 12847.50,  // saldo demo inicial
            provider: 'google',
            createdAt: Date.now(),
        };
        await redis.set(`user:${email}`, user);
    }

    setSession(res, email);
    res.json({ ok: true, user: safeUser(user) });
});

app.post('/api/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ ok: true });
});

app.get('/api/me', requireAuth, (req, res) => {
    res.json({ user: safeUser(req.user) });
});

// ============ API: Transacciones ============
app.get('/api/transactions', requireAuth, async (req, res) => {
    const list = await redis.lrange(`tx:${req.user.email}`, 0, 49);
    const txs = list.map(t => typeof t === 'string' ? JSON.parse(t) : t);
    res.json({ transactions: txs });
});

app.post('/api/transactions', requireAuth, async (req, res) => {
    const { type, amount, description } = req.body || {};
    if (!type || !amount) return res.status(400).json({ error: 'Faltan campos' });

    const tx = {
        id: crypto.randomUUID(),
        type,                       // 'send' | 'receive' | 'convert' | 'crypto' | 'card'
        amount: parseFloat(amount),
        description: description || '',
        timestamp: Date.now(),
    };

    // Actualizar saldo
    const sign = (type === 'receive') ? 1 : -1;
    const newBalance = (req.user.balance || 0) + sign * tx.amount;
    const updated = { ...req.user, balance: newBalance };
    await redis.set(`user:${req.user.email}`, updated);

    // Guardar transacción
    await redis.lpush(`tx:${req.user.email}`, tx);
    await redis.ltrim(`tx:${req.user.email}`, 0, 199);  // máximo 200 txs

    res.json({ ok: true, transaction: tx, balance: newBalance });
});

// ============ Health check ============
app.get('/api/health', (req, res) => {
    res.json({ ok: true, time: Date.now() });
});

// ============ Debug: prueba Upstash directamente ============
app.get('/api/debug', async (req, res) => {
    const result = {
        env: {
            UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL ? 'SET (' + process.env.UPSTASH_REDIS_REST_URL.slice(0, 30) + '...)' : 'MISSING',
            UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN ? 'SET (length ' + process.env.UPSTASH_REDIS_REST_TOKEN.length + ', starts with ' + process.env.UPSTASH_REDIS_REST_TOKEN.slice(0, 6) + '...)' : 'MISSING',
            GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ? 'SET' : 'MISSING',
            NODE_ENV: process.env.NODE_ENV || 'not set',
        },
        tests: {},
    };

    // Test 1: SET
    try {
        await redis.set('debug:test', 'hello-' + Date.now());
        result.tests.set = 'OK';
    } catch (e) {
        result.tests.set = 'FAIL: ' + e.message;
    }

    // Test 2: GET
    try {
        const v = await redis.get('debug:test');
        result.tests.get = 'OK (value: ' + v + ')';
    } catch (e) {
        result.tests.get = 'FAIL: ' + e.message;
    }

    // Test 3: DEL
    try {
        await redis.del('debug:test');
        result.tests.del = 'OK';
    } catch (e) {
        result.tests.del = 'FAIL: ' + e.message;
    }

    res.json(result);
});

// ============ Static (frontend) ============
app.use(express.static(path.join(__dirname, 'public')));

// SPA fallback - cualquier ruta no-API sirve index.html
app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============ Start ============
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✦ Morado Pay corriendo en puerto ${PORT}`);
    if (!process.env.UPSTASH_REDIS_REST_URL) {
        console.warn('⚠ UPSTASH_REDIS_REST_URL no configurado. Auth y DB no van a funcionar.');
    }
});
