const express = require('express');
const { Pool } = require('pg'); // Changed from sqlite3 to pg
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
// Ensure you have your STRIPE key in Render Environment Variables!
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = "my_super_secret_garden_key"; 

// Update this if you have a custom domain
const YOUR_DOMAIN = 'https://digitalgardentracker.com'; 

app.use(cors());
app.use(express.json());
app.use(express.static('public'));



// --- Database Connection (Postgres) ---
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false // Required for Render
    }
});

// Create Table (Postgres Syntax)
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


// --- Helper: Sync Subscription Status ---
async function checkStripeStatus(user) {
    if (!user.stripe_customer_id) return false;
    try {
        const subscriptions = await stripe.subscriptions.list({
            customer: user.stripe_customer_id,
            status: 'active',
            limit: 1
        });
        return subscriptions.data.length > 0;
    } catch (e) {
        console.error("Stripe Sync Error:", e);
        return false;
    }
}

// --- Auth Routes ---
app.post('/api/register', async (req, res) => {
    const { email, password } = req.body;
    const hashedPassword = bcrypt.hashSync(password, 8);
    const defaultData = JSON.stringify({ coins: 0, unlockedPlants: ["basic"], plants: [], habits: [] });

    try {
        const customer = await stripe.customers.create({ email: email });
        
        // Postgres uses $1, $2 syntax instead of ?
        await pool.query(
            `INSERT INTO users (email, password, garden_data, stripe_customer_id) VALUES ($1, $2, $3, $4)`,
            [email, hashedPassword, defaultData, customer.id]
        );
        res.json({ message: "User created." });
    } catch (e) {
        if (e.code === '23505') { // Postgres error code for "Unique Violation" (Duplicate email)
            return res.status(400).json({ error: "User already exists." });
        }
        console.error(e);
        res.status(500).json({ error: "Registration failed" });
    }
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    
    try {
        const result = await pool.query(`SELECT * FROM users WHERE email = $1`, [email]);
        const user = result.rows[0]; // Postgres returns rows in an array

        if (!user) return res.status(404).json({ error: "User not found." });
        
        const passwordIsValid = bcrypt.compareSync(password, user.password);
        if (!passwordIsValid) return res.status(401).json({ error: "Invalid password." });

        // Check Stripe status
        const isPremium = await checkStripeStatus(user);
        await pool.query(`UPDATE users SET is_premium = $1 WHERE id = $2`, [isPremium ? 1 : 0, user.id]);

        const token = jwt.sign({ id: user.id }, SECRET_KEY, { expiresIn: 86400 });
        
        res.json({ 
            auth: true, 
            token: token, 
            data: JSON.parse(user.garden_data), 
            isPremium: isPremium 
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Login error" });
    }
});

// --- Middleware ---
const verifyToken = (req, res, next) => {
    const token = req.headers['x-access-token'];
    if (!token) return res.status(403).json({ auth: false, message: 'No token provided.' });
    
    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) return res.status(500).json({ auth: false, message: 'Failed to authenticate token.' });
        req.userId = decoded.id;
        next();
    });
};

// --- Data Routes ---
app.post('/api/sync', verifyToken, async (req, res) => {
    const dataString = JSON.stringify(req.body);
    try {
        await pool.query(`UPDATE users SET garden_data = $1 WHERE id = $2`, [dataString, req.userId]);
        res.json({ status: "Saved" });
    } catch (e) {
        res.status(500).send("Error saving.");
    }
});

app.get('/api/sync', verifyToken, async (req, res) => {
    try {
        const result = await pool.query(`SELECT garden_data, is_premium FROM users WHERE id = $1`, [req.userId]);
        const row = result.rows[0];
        if (!row) return res.status(500).send("Error loading.");
        res.json({ ...JSON.parse(row.garden_data), isPremium: row.is_premium === 1 });
    } catch (e) {
        res.status(500).send("Error loading.");
    }
});

// --- STRIPE ROUTES ---
app.post('/api/create-checkout-session', verifyToken, async (req, res) => {
    try {
        const result = await pool.query(`SELECT stripe_customer_id FROM users WHERE id = $1`, [req.userId]);
        const user = result.rows[0];
        
        const session = await stripe.checkout.sessions.create({
            customer: user.stripe_customer_id,
            line_items: [{
                // REPLACE with your Live Price ID when ready
                price: 'price_YOUR_PRICE_ID_HERE', 
                quantity: 1,
            }],
            mode: 'subscription',
            success_url: `${YOUR_DOMAIN}/?success=true`,
            cancel_url: `${YOUR_DOMAIN}/?canceled=true`,
        });
        res.json({ url: session.url });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Checkout failed" });
    }
});

app.post('/api/create-portal-session', verifyToken, async (req, res) => {
    try {
        const result = await pool.query(`SELECT stripe_customer_id FROM users WHERE id = $1`, [req.userId]);
        const user = result.rows[0];
        
        const portalSession = await stripe.billingPortal.sessions.create({
            customer: user.stripe_customer_id,
            return_url: YOUR_DOMAIN,
        });
        res.json({ url: portalSession.url });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Portal failed" });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on ${PORT}`);
});