require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static('public'));

// --- DATABASE CONFIG ---
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } 
});

// --- SECURITY CONSTANTS ---
const SECRET_KEY = process.env.JWT_SECRET || "my_super_secret_garden_key";
const YOUR_DOMAIN = 'https://my-garden-app.onrender.com'; // CHANGE TO LOCALHOST:3000 FOR TESTING

// --- ITEM DATABASE (Server Authority) ---
// We define prices here so the client cannot fake them.
const ITEM_PRICES = {
    // Plants
    "sun": 100, "tulip": 150, "cactus": 250, 
    "rose": 400, "fern": 500, "bonsai": 500, "cherry": 1000,
    // Vines
    "tomato": 150, "strawberry": 250, "blueberry": 400,
    // Pots
    "classic": 100, "modern": 200, "japan": 250, "gold": 1000
};

const MAX_TASK_REWARD = 50;

// --- MIDDLEWARE ---
const verifyToken = (req, res, next) => {
    const token = req.headers['x-access-token'];
    if (!token) return res.status(403).json({ error: "No token" });
    
    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) return res.status(500).json({ error: "Auth failed" });
        req.userId = decoded.id;
        next();
    });
};

// --- AUTH ROUTES ---
app.post('/api/register', async (req, res) => {
    const { email, password } = req.body;
    const hash = bcrypt.hashSync(password, 8);
    const defaultData = JSON.stringify({ 
        coins: 0, 
        unlockedItems: ["basic", "terra", "grape"], 
        plants: [], 
        habits: [] 
    });

    try {
        await pool.query(
            `INSERT INTO users (email, password, garden_data, is_premium) VALUES ($1, $2, $3, 0)`,
            [email, hash, defaultData]
        );
        res.json({ message: "User created" });
    } catch (e) {
        res.status(500).json({ error: "Email already exists" });
    }
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await pool.query(`SELECT * FROM users WHERE email = $1`, [email]);
        const user = result.rows[0];
        
        if (!user || !bcrypt.compareSync(password, user.password)) {
            return res.status(404).json({ error: "Invalid credentials" });
        }

        const token = jwt.sign({ id: user.id }, SECRET_KEY, { expiresIn: 86400 });
        
        // Auto-check premium on login
        let isPremium = user.is_premium === 1;
        if (user.stripe_customer_id) {
            const subs = await stripe.subscriptions.list({ customer: user.stripe_customer_id, status: 'active' });
            if (subs.data.length > 0 && !isPremium) {
                await pool.query(`UPDATE users SET is_premium = 1 WHERE id = $1`, [user.id]);
                isPremium = true;
            }
        }

        res.json({ auth: true, token, data: JSON.parse(user.garden_data), isPremium });
    } catch (e) {
        res.status(500).json({ error: "Server error" });
    }
});

app.get('/api/load', verifyToken, async (req, res) => {
    try {
        const result = await pool.query(`SELECT garden_data, is_premium FROM users WHERE id = $1`, [req.userId]);
        if (result.rows.length === 0) return res.status(404).json({ error: "User not found" });
        res.json({ data: JSON.parse(result.rows[0].garden_data), isPremium: result.rows[0].is_premium === 1 });
    } catch (e) { res.status(500).json({ error: "Error loading" }); }
});

// --- SECURE GAME ROUTES ---

// 1. SECURE SYNC
// Allows saving plants/habits layout, but REJECTS coins/inventory changes from client.
app.post('/api/sync', verifyToken, async (req, res) => {
    try {
        // 1. Get current Server Data
        const currentResult = await pool.query(`SELECT garden_data FROM users WHERE id = $1`, [req.userId]);
        const serverData = JSON.parse(currentResult.rows[0].garden_data);
        
        // 2. Get Client Data
        const clientData = req.body;

        // 3. MERGE: Keep Client's content (text, layout), Keep Server's Economy (coins, unlocks)
        const safeData = {
            ...clientData,
            coins: serverData.coins, // FORCE Server Value
            unlockedItems: serverData.unlockedItems // FORCE Server Value
        };

        // 4. Save
        await pool.query(`UPDATE users SET garden_data = $1 WHERE id = $2`, [JSON.stringify(safeData), req.userId]);
        res.json({ success: true, fixedData: safeData });
    } catch (e) { res.status(500).json({ error: "Sync failed" }); }
});

// 2. SECURE BUY
app.post('/api/buy', verifyToken, async (req, res) => {
    const { itemId } = req.body;
    const price = ITEM_PRICES[itemId];

    if (!price) return res.status(400).json({ error: "Invalid Item" });

    try {
        // Load Data
        const result = await pool.query(`SELECT garden_data FROM users WHERE id = $1`, [req.userId]);
        let data = JSON.parse(result.rows[0].garden_data);

        // Validation
        if (data.unlockedItems.includes(itemId)) return res.status(400).json({ error: "Already owned" });
        if (data.coins < price) return res.status(400).json({ error: "Insufficient funds" });

        // Transaction
        data.coins -= price;
        data.unlockedItems.push(itemId);

        // Save
        await pool.query(`UPDATE users SET garden_data = $1 WHERE id = $2`, [JSON.stringify(data), req.userId]);
        res.json({ success: true, coins: data.coins, unlockedItems: data.unlockedItems });

    } catch (e) { res.status(500).json({ error: "Transaction failed" }); }
});

// 3. SECURE REWARD
app.post('/api/reward', verifyToken, async (req, res) => {
    const { plantId, amount } = req.body;
    
    // Server-side Cap
    const safeAmount = Math.min(amount, MAX_TASK_REWARD);
    if (safeAmount <= 0) return res.json({ success: false });

    try {
        const result = await pool.query(`SELECT garden_data FROM users WHERE id = $1`, [req.userId]);
        let data = JSON.parse(result.rows[0].garden_data);

        // (Optional: Verify plant completion here for stricter security)
        // For now, we trust the "Completion" event but validate the "Amount" cap.
        
        data.coins += safeAmount;

        await pool.query(`UPDATE users SET garden_data = $1 WHERE id = $2`, [JSON.stringify(data), req.userId]);
        res.json({ success: true, coins: data.coins });

    } catch (e) { res.status(500).json({ error: "Reward failed" }); }
});

// --- STRIPE ---
app.post('/api/create-checkout-session', verifyToken, async (req, res) => {
    try {
        const userQuery = await pool.query(`SELECT email, stripe_customer_id FROM users WHERE id = $1`, [req.userId]);
        const user = userQuery.rows[0];
        
        let customerId = user.stripe_customer_id;
        if (!customerId) {
            const customer = await stripe.customers.create({ email: user.email });
            customerId = customer.id;
            await pool.query(`UPDATE users SET stripe_customer_id = $1 WHERE id = $2`, [customerId, req.userId]);
        }

        const session = await stripe.checkout.sessions.create({
            customer: customerId,
            line_items: [{ price: 'price_1QkW5mRu43u4t718k2q1gXyP', quantity: 1 }], // UPDATE THIS ID
            mode: 'subscription',
            success_url: `${YOUR_DOMAIN}/?success=true`,
            cancel_url: `${YOUR_DOMAIN}/?canceled=true`,
        });

        res.json({ url: session.url });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/verify-premium', verifyToken, async (req, res) => {
    try {
        const result = await pool.query(`SELECT stripe_customer_id, is_premium FROM users WHERE id = $1`, [req.userId]);
        const user = result.rows[0];
        if (!user || !user.stripe_customer_id) return res.json({ isPremium: false });

        const subscriptions = await stripe.subscriptions.list({ customer: user.stripe_customer_id, status: 'active', limit: 1 });
        const isPremium = subscriptions.data.length > 0;

        if (!!user.is_premium !== isPremium) {
            await pool.query(`UPDATE users SET is_premium = $1 WHERE id = $2`, [isPremium ? 1 : 0, req.userId]);
        }
        res.json({ isPremium: isPremium });
    } catch (e) { res.status(500).json({ error: "Verify failed" }); }
});

app.listen(3000, () => console.log('Server running on port 3000'));