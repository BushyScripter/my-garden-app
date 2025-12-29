const express = require('express');
const { Pool } = require('pg'); 
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
// Make sure to set STRIPE_SECRET_KEY in your Render/Heroku environment variables
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.JWT_SECRET || "my_super_secret_garden_key"; 

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
pool.query(`
    CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        garden_data TEXT,
        stripe_customer_id TEXT,
        is_premium BOOLEAN DEFAULT FALSE
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
        await pool.query(
            `INSERT INTO users (email, password, garden_data, stripe_customer_id, is_premium) VALUES ($1, $2, $3, $4, $5)`,
            [email, hashedPassword, defaultData, customer.id, false]
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
        let isPremium = user.is_premium;
        if(user.stripe_customer_id) {
            const subscriptions = await stripe.subscriptions.list({
                customer: user.stripe_customer_id,
                status: 'active',
                limit: 1
            });
            isPremium = subscriptions.data.length > 0;
            // Update DB if status changed
            if(isPremium !== user.is_premium) {
                await pool.query(`UPDATE users SET is_premium = $1 WHERE id = $2`, [isPremium, user.id]);
            }
        }

        const token = jwt.sign({ id: user.id }, SECRET_KEY, { expiresIn: 86400 }); // 24 hours
        
        // Return Auth Token + Data + Premium Status
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
            isPremium: row.is_premium 
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
                price: 'price_YOUR_ACTUAL_STRIPE_PRICE_ID', // <--- REPLACE THIS
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

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});