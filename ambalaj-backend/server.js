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

// SQLite veritabanını başlat
const db = new sqlite3.Database("./ambalaj.db", (err) => {
    if (err) {
        console.error("Veritabanı bağlantı hatası:", err.message);
    } else {
        console.log("SQLite veritabanına bağlandı");
        initializeDatabase();
    }
});

// Veritabanı tablolarını oluştur
function initializeDatabase() {
    db.serialize(() => {
        // Kullanıcılar tablosu
        db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

        // Kullanıcı fiyatları tablosu
        db.run(`CREATE TABLE IF NOT EXISTS user_prices (
      user_id INTEGER PRIMARY KEY,
      prices_data TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )`);

        // Hesaplama geçmişi tablosu
        db.run(`CREATE TABLE IF NOT EXISTS calculations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      input_data TEXT NOT NULL,
      result_data TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )`);

        console.log("Veritabanı tabloları hazır");
    });
}

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

// Middleware: Token Kontrol
const authenticateToken = (req, res, next) => {
    const token = req.headers["authorization"]?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Token gerekli" });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: "Token geçersiz" });
        req.user = user;
        next();
    });
};

// Kullanıcı Kayıt
app.post("/api/auth/register", async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: "Email ve şifre gerekli" });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        db.run(
            "INSERT INTO users (email, password) VALUES (?, ?)",
            [email, hashedPassword],
            function (err) {
                if (err) {
                    if (err.code === "SQLITE_CONSTRAINT_UNIQUE") {
                        return res
                            .status(400)
                            .json({ error: "Bu email zaten kayıtlı" });
                    }
                    console.error("Kayıt hatası:", err);
                    return res.status(500).json({ error: "Sunucu hatası" });
                }

                const token = jwt.sign({ id: this.lastID }, JWT_SECRET);
                res.json({ token, user: { id: this.lastID, email: email } });
            }
        );
    } catch (error) {
        console.error("Kayıt hatası:", error);
        res.status(500).json({ error: "Sunucu hatası" });
    }
});

// Giriş
app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: "Email ve şifre gerekli" });
    }

    try {
        db.get(
            "SELECT * FROM users WHERE email = ?",
            [email],
            async (err, user) => {
                if (err) {
                    console.error("Giriş hatası:", err);
                    return res.status(500).json({ error: "Sunucu hatası" });
                }

                if (!user) {
                    return res
                        .status(401)
                        .json({ error: "Kullanıcı bulunamadı" });
                }

                const validPassword = await bcrypt.compare(
                    password,
                    user.password
                );

                if (!validPassword) {
                    return res.status(401).json({ error: "Şifre yanlış" });
                }

                const token = jwt.sign({ id: user.id }, JWT_SECRET);
                res.json({ token, user: { id: user.id, email: user.email } });
            }
        );
    } catch (error) {
        console.error("Giriş hatası:", error);
        res.status(500).json({ error: "Sunucu hatası" });
    }
});

// Fiyatları Kaydet
app.post("/api/prices", authenticateToken, async (req, res) => {
    const { prices } = req.body;

    if (!prices) {
        return res.status(400).json({ error: "Fiyatlar gerekli" });
    }

    try {
        db.run(
            'INSERT OR REPLACE INTO user_prices (user_id, prices_data, updated_at) VALUES (?, ?, datetime("now"))',
            [req.user.id, JSON.stringify(prices)],
            function (err) {
                if (err) {
                    console.error("Fiyat kaydetme hatası:", err);
                    return res
                        .status(500)
                        .json({ error: "Fiyatlar kaydedilemedi" });
                }
                res.json({ success: true });
            }
        );
    } catch (error) {
        console.error("Fiyat kaydetme hatası:", error);
        res.status(500).json({ error: "Fiyatlar kaydedilemedi" });
    }
});

// Fiyatları Getir
app.get("/api/prices", authenticateToken, async (req, res) => {
    try {
        db.get(
            "SELECT prices_data FROM user_prices WHERE user_id = ?",
            [req.user.id],
            (err, row) => {
                if (err) {
                    console.error("Fiyat getirme hatası:", err);
                    return res
                        .status(500)
                        .json({ error: "Fiyatlar alınamadı" });
                }

                const prices = row ? JSON.parse(row.prices_data) : {};
                res.json(prices);
            }
        );
    } catch (error) {
        console.error("Fiyat getirme hatası:", error);
        res.status(500).json({ error: "Fiyatlar alınamadı" });
    }
});

// Hesaplama
app.post("/api/calculate", authenticateToken, async (req, res) => {
    const {
        width,
        height,
        weight,
        quantity,
        westage,
        paperType,
        printing,
        printingColor,
        frontCellophane,
        backCellophane,
        cutting,
        pasting,
        boxPerPaper,
    } = req.body;

    try {
        // Fiyatları veritabanından al
        db.get(
            "SELECT prices_data FROM user_prices WHERE user_id = ?",
            [req.user.id],
            (err, row) => {
                if (err) {
                    console.error("Fiyat getirme hatası:", err);
                    return res
                        .status(500)
                        .json({ error: "Hesaplama yapılamadı" });
                }

                const prices = row ? JSON.parse(row.prices_data) : {};

                const getPrice = (key) => {
                    if (!key) return 0;
                    return parseFloat(prices[key]) || 0;
                };

                // Hesaplama mantığı
                const calculateTotalWeight = (w, h, wg) => (w * h * wg) / 10000;
                const totalWeight = calculateTotalWeight(width, height, weight);

                const typePrice = getPrice(paperType);
                const paperPrice =
                    ((totalWeight * typePrice) / 1000) * (1 + westage / 100);

                let firstThousand = 0,
                    afterThousand = 0;

                if (printing === "big-printing") {
                    firstThousand = getPrice("firstThousandBigPrinting");
                    afterThousand = getPrice("afterThousandBigPrinting");
                } else if (printing === "medium-printing") {
                    firstThousand = getPrice("firstThousandMediumPrinting");
                    afterThousand = getPrice("afterThousandMediumPrinting");
                } else if (printing === "small-printing") {
                    firstThousand = getPrice("firstThousandSmallPrinting");
                    afterThousand = getPrice("afterThousandSmallPrinting");
                }

                const printingPrice =
                    (firstThousand +
                        afterThousand * ((quantity - 1000) / 1000)) /
                    printingColor;

                const frontCellophanePrice =
                    frontCellophane === null ? 0 : getPrice(frontCellophane);
                const backCellophanePrice =
                    backCellophane === null ? 0 : getPrice(backCellophane);
                const cellophanePrice =
                    ((frontCellophanePrice * width * height) / 10000 +
                        (backCellophanePrice * width * height) / 10000) *
                    quantity;

                let cuttingPrice = 0;
                if (cutting !== null && cutting !== 0) {
                    const firstCut = getPrice(
                        cutting === "big-cutting"
                            ? "firstThousandBigCutting"
                            : "firstThousandSmallCutting"
                    );
                    const afterCut = getPrice(
                        cutting === "big-cutting"
                            ? "afterThousandBigCutting"
                            : "afterThousandSmallCutting"
                    );
                    cuttingPrice =
                        firstCut + afterCut * ((quantity - 1000) / 1000);
                }

                const boxQuantity = boxPerPaper * quantity;

                let pastingPrice = 0;
                if (pasting !== null && pasting !== 0) {
                    const firstPasting = getPrice(
                        pasting === "side-pasting"
                            ? "firstThousandSidePasting"
                            : "firstThousandSideBySidePasting"
                    );
                    const afterPasting = getPrice(
                        pasting === "side-pasting"
                            ? "afterThousandSidePasting"
                            : "afterThousandSideBySidePasting"
                    );

                    if (boxQuantity >= 10000) {
                        pastingPrice =
                            firstPasting +
                            afterPasting * ((boxQuantity - 10000) / 1000);
                    } else {
                        pastingPrice = firstPasting;
                    }
                }

                const totalPaper = paperPrice * quantity;
                const totalPrice =
                    totalPaper +
                    printingPrice +
                    cellophanePrice +
                    cuttingPrice +
                    pastingPrice;

                const result = {
                    totalWeight: totalWeight.toFixed(2),
                    paperPrice: paperPrice.toFixed(3),
                    totalPaper: totalPaper.toFixed(2),
                    printingPrice: printingPrice.toFixed(2),
                    cellophanePrice: cellophanePrice.toFixed(2),
                    cuttingPrice: cuttingPrice.toFixed(2),
                    pastingPrice: pastingPrice.toFixed(2),
                    unitPrice: (totalPrice / (quantity * boxPerPaper)).toFixed(
                        2
                    ),
                    totalPrice: totalPrice.toFixed(2),
                };

                res.json(result);
            }
        );
    } catch (error) {
        console.error("Hesaplama hatası:", error);
        res.status(500).json({ error: "Hesaplama yapılamadı" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server ${PORT} portunda çalışıyor`);
});
