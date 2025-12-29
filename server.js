const express = require('express');
const { Pool } = require('pg'); 
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();
const PORT = process.env.PORT || 3000;
// SECURITY FIX: Use env var, fallback to dev key only locally
const SECRET_KEY = process.env.JWT_SECRET || "dev_secret_key_change_in_prod"; 

const YOUR_DOMAIN = 'https://digitalgardentracker.com'; 

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// --- Database Connection ---
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } 
});

// Initialize Table (Ensure is_premium is INTEGER)
pool.query(`
    CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        garden_data TEXT,
        stripe_customer_id TEXT,
        is_premium INTEGER DEFAULT 0
    )
`).catch(err => console.error("DB Setup Error:", err));

// --- Middleware ---
const verifyToken = (req, res, next) => {
    const token = req.headers['x-access-token'];
    if (!token) return res.status(403).json({ auth: false, message: 'No token.' });
    
    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) return res.status(500).json({ auth: false, message: 'Bad token.' });
        req.userId = decoded.id;
        next();
    });
};

// --- Auth Routes ---
app.post('/api/register', async (req, res) => {
    const { email, password } = req.body;
    const hashedPassword = bcrypt.hashSync(password, 8);
    const defaultData = JSON.stringify({ 
        coins: 50, unlockedItems: ["basic", "terra", "grape"], plants: [], habits: [] 
    });

    try {
        const customer = await stripe.customers.create({ email: email });
        // FIX: Explicitly inserting 0 for is_premium
        await pool.query(
            `INSERT INTO users (email, password, garden_data, stripe_customer_id, is_premium) VALUES ($1, $2, $3, $4, $5)`,
            [email, hashedPassword, defaultData, customer.id, 0]
        );
        res.json({ message: "User created." });
    } catch (e) {
        if (e.code === '23505') return res.status(400).json({ error: "Email exists." });
        res.status(500).json({ error: "Register failed" });
    }
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await pool.query(`SELECT * FROM users WHERE email = $1`, [email]);
        const user = result.rows[0];

        if (!user || !bcrypt.compareSync(password, user.password)) {
            return res.status(401).json({ error: "Invalid credentials." });
        }

        // --- Premium Sync Logic ---
        // 1 = True, 0 = False
        let isPremiumInt = user.is_premium; 
        
        if(user.stripe_customer_id) {
            const subs = await stripe.subscriptions.list({
                customer: user.stripe_customer_id,
                status: 'active',
                limit: 1
            });
            const hasSub = subs.data.length > 0;
            const newStatus = hasSub ? 1 : 0;
            
            if(newStatus !== isPremiumInt) {
                await pool.query(`UPDATE users SET is_premium = $1 WHERE id = $2`, [newStatus, user.id]);
                isPremiumInt = newStatus;
            }
        }

        const token = jwt.sign({ id: user.id }, SECRET_KEY, { expiresIn: 86400 });
        
        res.json({ 
            auth: true, 
            token: token, 
            data: JSON.parse(user.garden_data), 
            isPremium: isPremiumInt === 1 // Send Boolean to Frontend
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Login error" });
    }
});

// --- Data Routes ---
app.post('/api/sync', verifyToken, async (req, res) => {
    try {
        await pool.query(`UPDATE users SET garden_data = $1 WHERE id = $2`, [JSON.stringify(req.body), req.userId]);
        res.json({ status: "Saved" });
    } catch (e) { res.status(500).send("Save Error"); }
});

app.get('/api/load', verifyToken, async (req, res) => {
    try {
        const result = await pool.query(`SELECT garden_data, is_premium FROM users WHERE id = $1`, [req.userId]);
        const row = result.rows[0];
        if(!row) return res.status(404).send("User not found");
        res.json({ data: JSON.parse(row.garden_data), isPremium: row.is_premium === 1 });
    } catch (e) { res.status(500).send("Load Error"); }
});

// --- Stripe ---
app.post('/api/create-checkout-session', verifyToken, async (req, res) => {
    try {
        const result = await pool.query(`SELECT stripe_customer_id FROM users WHERE id = $1`, [req.userId]);
        const session = await stripe.checkout.sessions.create({
            customer: result.rows[0].stripe_customer_id,
            line_items: [{ price: 'price_YOUR_PRICE_ID_HERE', quantity: 1 }],
            mode: 'subscription',
            success_url: `${YOUR_DOMAIN}/?success=true`,
            cancel_url: `${YOUR_DOMAIN}/?canceled=true`,
        });
        res.json({ url: session.url });
    } catch (e) { res.status(500).json({ error: "Stripe Error" }); }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));