const express = require('express');
const { Pool } = require('pg'); 
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
// Make sure to set STRIPE_SECRET_KEY in your Render/Heroku environment variables
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.JWT_SECRET; 

const YOUR_DOMAIN = 'https://digitalgardentracker.com'; // Change to your actual URL

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// --- Database Connection (Postgres) ---
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } 
});

// Initialize Database Table
// Note: Even if we say BOOLEAN here, if the table already exists as INTEGER, it stays INTEGER.
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


// --- Helper: Verify JWT Token ---
const verifyToken = (req, res, next) => {
    const token = req.headers['x-access-token'];
    if (!token) return res.status(403).json({ auth: false, message: 'No token provided.' });
    
    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) return res.status(500).json({ auth: false, message: 'Failed to authenticate token.' });
        req.userId = decoded.id;
        next();
    });
};


// --- Auth Routes ---
app.post('/api/register', async (req, res) => {
    const { email, password } = req.body;
    const hashedPassword = bcrypt.hashSync(password, 8);
    
    // Default starting data for new users
    const defaultData = JSON.stringify({ 
        coins: 50, 
        unlockedItems: ["basic", "terra", "grape"], 
        plants: [], 
        habits: [] 
    });

    try {
        // Create Stripe Customer
        const customer = await stripe.customers.create({ email: email });
        
        // Save User to DB
        // FIX: We send '0' instead of 'false' to satisfy the INTEGER column type
        await pool.query(
            `INSERT INTO users (email, password, garden_data, stripe_customer_id, is_premium) VALUES ($1, $2, $3, $4, $5)`,
            [email, hashedPassword, defaultData, customer.id, 0]
        );
        res.json({ message: "User created." });
    } catch (e) {
        if (e.code === '23505') return res.status(400).json({ error: "Email already exists." });
        console.error(e);
        res.status(500).json({ error: "Registration failed" });
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

        // Check Stripe Subscription Status on Login
        // We assume 1 is true, 0 is false
        let isPremiumBool = user.is_premium === 1; 
        
        if(user.stripe_customer_id) {
            const subscriptions = await stripe.subscriptions.list({
                customer: user.stripe_customer_id,
                status: 'active',
                limit: 1
            });
            const stripeSaysPremium = subscriptions.data.length > 0;
            
            // Update DB if status changed
            if(stripeSaysPremium !== isPremiumBool) {
                // FIX: Convert boolean back to 1 or 0 for the database update
                await pool.query(`UPDATE users SET is_premium = $1 WHERE id = $2`, [stripeSaysPremium ? 1 : 0, user.id]);
                isPremiumBool = stripeSaysPremium;
            }
        }

        const token = jwt.sign({ id: user.id }, SECRET_KEY, { expiresIn: 86400 }); // 24 hours
        
        // Return Auth Token + Data + Premium Status (as boolean for the frontend)
        res.json({ 
            auth: true, 
            token: token, 
            data: JSON.parse(user.garden_data), 
            isPremium: isPremiumBool 
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Login error" });
    }
});

// --- Data Sync Routes ---

// SAVE: Overwrite server data with client data
app.post('/api/sync', verifyToken, async (req, res) => {
    const dataString = JSON.stringify(req.body); // Client sends full gardenData object
    try {
        await pool.query(`UPDATE users SET garden_data = $1 WHERE id = $2`, [dataString, req.userId]);
        res.json({ status: "Saved" });
    } catch (e) {
        console.error("Save Error:", e);
        res.status(500).send("Error saving data.");
    }
});

// LOAD: Get data from server
app.get('/api/load', verifyToken, async (req, res) => {
    try {
        const result = await pool.query(`SELECT garden_data, is_premium FROM users WHERE id = $1`, [req.userId]);
        const row = result.rows[0];
        if (!row) return res.status(404).send("User not found.");
        
        res.json({ 
            data: JSON.parse(row.garden_data), 
            isPremium: row.is_premium === 1 // Convert 1/0 to true/false for frontend
        });
    } catch (e) {
        console.error("Load Error:", e);
        res.status(500).send("Error loading data.");
    }
});

// --- Stripe Routes ---
app.post('/api/create-checkout-session', verifyToken, async (req, res) => {
    try {
        const result = await pool.query(`SELECT stripe_customer_id FROM users WHERE id = $1`, [req.userId]);
        const user = result.rows[0];
        
        const session = await stripe.checkout.sessions.create({
            customer: user.stripe_customer_id,
            line_items: [{
                price: 'price_1SjRIwJ7FqqjX2clPxgwueTu', // <--- REPLACE THIS
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
// --- NEW ROUTE: Force Check Premium Status ---
app.get('/api/verify-premium', verifyToken, async (req, res) => {
    try {
        // 1. Get user's Stripe ID
        const result = await pool.query(`SELECT stripe_customer_id, is_premium FROM users WHERE id = $1`, [req.userId]);
        const user = result.rows[0];

        if (!user || !user.stripe_customer_id) {
            return res.json({ isPremium: false });
        }

        // 2. Ask Stripe for active subscriptions
        const subscriptions = await stripe.subscriptions.list({
            customer: user.stripe_customer_id,
            status: 'active',
            limit: 1
        });

        const isPremium = subscriptions.data.length > 0;

        // 3. Update Database if changed
        if (!!user.is_premium !== isPremium) {
            await pool.query(`UPDATE users SET is_premium = $1 WHERE id = $2`, [isPremium ? 1 : 0, req.userId]);
        }

        // 4. Tell Frontend
        res.json({ isPremium: isPremium });

    } catch (e) {
        console.error("Verify Error:", e);
        res.status(500).json({ error: "Verification failed" });
    }
});
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});