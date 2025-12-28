const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
const PORT = 3000;
const SECRET_KEY = "my_super_secret_garden_key"; 

app.use(cors());
app.use(express.json());
app.use(express.static('public')); // This lets us see index.html

// --- Database Setup ---
const db = new sqlite3.Database('./garden.db', (err) => {
    if (err) console.error(err.message);
    console.log('Connected to the SQLite database.');
});

// Create Users Table
db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    password TEXT,
    garden_data TEXT
)`);

// --- Auth Routes ---
app.post('/api/register', (req, res) => {
    const { email, password } = req.body;
    const hashedPassword = bcrypt.hashSync(password, 8);
    // Default empty garden
    const defaultData = JSON.stringify({ coins: 0, unlockedPlants: ["basic"], plants: [], habits: [] });

    db.run(`INSERT INTO users (email, password, garden_data) VALUES (?, ?, ?)`, 
        [email, hashedPassword, defaultData], 
        function(err) {
            if (err) return res.status(400).json({ error: "User already exists." });
            res.json({ message: "User created." });
        }
    );
});

app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    db.get(`SELECT * FROM users WHERE email = ?`, [email], (err, user) => {
        if (err || !user) return res.status(404).json({ error: "User not found." });
        const passwordIsValid = bcrypt.compareSync(password, user.password);
        if (!passwordIsValid) return res.status(401).json({ error: "Invalid password." });
        const token = jwt.sign({ id: user.id }, SECRET_KEY, { expiresIn: 86400 }); 
        res.json({ auth: true, token: token, data: JSON.parse(user.garden_data) });
    });
});

// --- Data Routes ---
const verifyToken = (req, res, next) => {
    const token = req.headers['x-access-token'];
    if (!token) return res.status(403).json({ auth: false, message: 'No token provided.' });
    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) return res.status(500).json({ auth: false, message: 'Failed to authenticate token.' });
        req.userId = decoded.id;
        next();
    });
};

app.post('/api/sync', verifyToken, (req, res) => {
    const dataString = JSON.stringify(req.body);
    db.run(`UPDATE users SET garden_data = ? WHERE id = ?`, [dataString, req.userId], (err) => {
        if (err) return res.status(500).send("Error saving data.");
        res.json({ status: "Saved" });
    });
});

app.get('/api/sync', verifyToken, (req, res) => {
    db.get(`SELECT garden_data FROM users WHERE id = ?`, [req.userId], (err, row) => {
        if (err) return res.status(500).send("Error loading data.");
        res.json(JSON.parse(row.garden_data));
    });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});