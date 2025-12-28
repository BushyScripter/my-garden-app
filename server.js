const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
// REPLACE THIS with your actual Stripe Secret Key (sk_test_...)
const stripe = require('stripe')('sk_test_51Gau3uJ7FqqjX2clEq3FNdUEQJPJaO75PgRaOu6kFY7lFq13LCTmRuiD0t6VI9GuJ1ZVB8xWV859s7ETFBB11nB700ffUkVhNL');

const app = express();
const PORT = process.env.PORT || 3000; // Use Render's port or 3000 locally
const SECRET_KEY = "my_super_secret_garden_key"; 

// Replace with your actual live URL when you deploy (e.g., https://my-app.onrender.com)
// If testing locally, keep http://localhost:3000
const YOUR_DOMAIN = 'https://digital-garden-xmmn.onrender.com/'; 

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// --- Database Setup ---
const db = new sqlite3.Database('./garden.db', (err) => {
    if (err) console.error(err.message);
    console.log('Connected to SQLite database.');
});

// User Table with Stripe fields
db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    password TEXT,
    garden_data TEXT,
    stripe_customer_id TEXT,
    is_premium INTEGER DEFAULT 0
)`);

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
        
        db.run(`INSERT INTO users (email, password, garden_data, stripe_customer_id) VALUES (?, ?, ?, ?)`, 
            [email, hashedPassword, defaultData, customer.id], 
            function(err) {
                if (err) return res.status(400).json({ error: "User already exists." });
                res.json({ message: "User created." });
            }
        );
    } catch (e) {
        res.status(500).json({ error: "Stripe creation failed" });
    }
});

app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, user) => {
        if (err || !user) return res.status(404).json({ error: "User not found." });
        
        const passwordIsValid = bcrypt.compareSync(password, user.password);
        if (!passwordIsValid) return res.status(401).json({ error: "Invalid password." });

        // Check Stripe status on login
        const isPremium = await checkStripeStatus(user);
        db.run(`UPDATE users SET is_premium = ? WHERE id = ?`, [isPremium ? 1 : 0, user.id]);

        const token = jwt.sign({ id: user.id }, SECRET_KEY, { expiresIn: 86400 });
        
        res.json({ 
            auth: true, 
            token: token, 
            data: JSON.parse(user.garden_data), 
            isPremium: isPremium 
        });
    });
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
app.post('/api/sync', verifyToken, (req, res) => {
    const dataString = JSON.stringify(req.body);
    db.run(`UPDATE users SET garden_data = ? WHERE id = ?`, [dataString, req.userId], (err) => {
        if (err) return res.status(500).send("Error saving.");
        res.json({ status: "Saved" });
    });
});

app.get('/api/sync', verifyToken, (req, res) => {
    db.get(`SELECT garden_data, is_premium FROM users WHERE id = ?`, [req.userId], (err, row) => {
        if (err) return res.status(500).send("Error loading.");
        res.json({ ...JSON.parse(row.garden_data), isPremium: row.is_premium === 1 });
    });
});

// --- STRIPE ROUTES ---
app.post('/api/create-checkout-session', verifyToken, (req, res) => {
    db.get(`SELECT stripe_customer_id FROM users WHERE id = ?`, [req.userId], async (err, user) => {
        try {
            const session = await stripe.checkout.sessions.create({
                customer: user.stripe_customer_id,
                line_items: [{
                    // REPLACE with your Stripe Price ID (price_...)
                    price: 'price_1SjRIwJ7FqqjX2clPxgwueTu', 
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
});

app.post('/api/create-portal-session', verifyToken, (req, res) => {
    db.get(`SELECT stripe_customer_id FROM users WHERE id = ?`, [req.userId], async (err, user) => {
        try {
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
});

app.listen(PORT, () => {
    console.log(`Server running on ${PORT}`);
});