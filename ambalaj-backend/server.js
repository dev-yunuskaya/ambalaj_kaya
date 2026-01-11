import express from "express";
import sqlite3 from "sqlite3";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const db = new sqlite3.Database("./ambalaj.db", (err) => {
    if (err) console.error(err);
    else {
        console.log("DB connected");
        db.run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, email TEXT UNIQUE, password TEXT)`);
        db.run(`CREATE TABLE IF NOT EXISTS prices (user_id INTEGER, key TEXT, value TEXT, PRIMARY KEY(user_id, key))`);
    }
});

const authenticate = (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "No token" });
    jwt.verify(token, process.env.JWT_SECRET || "secret", (err, user) => {
        if (err) return res.status(403).json({ error: "Invalid token" });
        req.user = user;
        next();
    });
};

app.post("/api/register", async (req, res) => {
    const { email, password } = req.body;
    const hash = await bcrypt.hash(password, 10);
    db.run("INSERT INTO users (email, password) VALUES (?, ?)", [email, hash], function(err) {
        if (err) return res.status(400).json({ error: "User exists" });
        res.json({ token: jwt.sign({ id: this.lastID }, process.env.JWT_SECRET || "secret") });
    });
});

app.post("/api/login", async (req, res) => {
    const { email, password } = req.body;
    db.get("SELECT * FROM users WHERE email = ?", [email], async (err, user) => {
        if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ error: "Invalid" });
        res.json({ token: jwt.sign({ id: user.id }, process.env.JWT_SECRET || "secret") });
    });
});

app.get("/api/prices", authenticate, (req, res) => {
    db.all("SELECT key, value FROM prices WHERE user_id = ?", [req.user.id], (err, rows) => {
        const prices = {};
        rows.forEach(row => prices[row.key] = row.value);
        res.json(prices);
    });
});

app.post("/api/prices", authenticate, (req, res) => {
    const { prices } = req.body;
    db.serialize(() => {
        db.run("DELETE FROM prices WHERE user_id = ?", [req.user.id]);
        Object.entries(prices).forEach(([key, value]) => {
            db.run("INSERT INTO prices (user_id, key, value) VALUES (?, ?, ?)", [req.user.id, key, value]);
        });
        res.json({ success: true });
    });
});

app.post("/api/calculate", authenticate, (req, res) => {
    // Basit hesaplama, frontend mantığını buraya taşı
    res.json({ totalPrice: "100.00" }); // Placeholder
});

app.listen(3000, () => console.log("Server on 3000"));
