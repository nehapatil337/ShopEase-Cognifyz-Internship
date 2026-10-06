const express = require("express");
const path = require("path");
const rateLimit = require("express-rate-limit");
const cron = require("node-cron");

const { sql, poolPromise } = require("./db");
const {
    registerUser,
    loginUser,
    authenticateToken
} = require("./auth");

const app = express();
const PORT = 3000;


// ==================================================
// TASK 8 - REQUEST LOGGING MIDDLEWARE
// ==================================================

app.use((req, res, next) => {
    const currentTime = new Date().toLocaleString();

    console.log(
        `[${currentTime}] ${req.method} ${req.url}`
    );

    next();
});


// ==================================================
// GENERAL MIDDLEWARE
// ==================================================

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));


// ==================================================
// HOME PAGE
// ==================================================

app.get("/", (req, res) => {
    res.render("index.ejs");
});


// ==================================================
// TASK 2 - REGISTER USER
// ==================================================

app.post("/register", async (req, res) => {

    const {
        name,
        email,
        phone,
        password,
        confirmPassword
    } = req.body;

    if (
        !name ||
        !email ||
        !phone ||
        !password ||
        !confirmPassword
    ) {
        return res.send("All fields are required.");
    }

    if (password.length < 6) {
        return res.send(
            "Password must be at least 6 characters."
        );
    }

    if (password !== confirmPassword) {
        return res.send("Passwords do not match.");
    }

    try {

        const user = await registerUser(
            name,
            email,
            phone,
            password
        );

        res.render("result.ejs", {
            name: user.name,
            email: user.email
        });

    } catch (error) {

        console.error(error);

        res.send(error.message);
    }
});


// ==================================================
// TASK 6 - LOGIN API
// ==================================================

app.post("/api/auth/login", async (req, res) => {

    const {
        email,
        password
    } = req.body;

    if (!email || !password) {

        return res.status(400).json({
            message: "Email and password are required."
        });
    }

    try {

        const result = await loginUser(
            email,
            password
        );

        res.json({
            message: "Login successful!",
            token: result.token,
            user: result.user
        });

    } catch (error) {

        res.status(401).json({
            message: error.message
        });
    }
});


// ==================================================
// USERS FROM DATABASE
// ==================================================

app.get("/users", async (req, res) => {

    try {

        const pool = await poolPromise;

        const result = await pool.request().query(`
            SELECT
                Id,
                Name,
                Email,
                Phone,
                CreatedAt
            FROM Users
            ORDER BY Id DESC
        `);

        res.render("users.ejs", {
            users: result.recordset
        });

    } catch (error) {

        console.error(error);

        res.status(500).send(
            "Unable to load users."
        );
    }
});


// ==================================================
// PRODUCTS - GET ALL
// ==================================================

app.get("/api/products", async (req, res) => {

    try {

        const pool = await poolPromise;

        const result = await pool.request().query(`
            SELECT
                Id AS id,
                Name AS name,
                Price AS price,
                Category AS category
            FROM Products
            ORDER BY Id DESC
        `);

        res.json(result.recordset);

    } catch (error) {

        console.error(error);

        res.status(500).json({
            message: "Unable to fetch products."
        });
    }
});


// ==================================================
// GET PRODUCT BY ID
// ==================================================

app.get("/api/products/:id", async (req, res) => {

    try {

        const pool = await poolPromise;

        const result = await pool
            .request()
            .input(
                "id",
                sql.Int,
                req.params.id
            )
            .query(`
                SELECT
                    Id AS id,
                    Name AS name,
                    Price AS price,
                    Category AS category
                FROM Products
                WHERE Id = @id
            `);

        if (result.recordset.length === 0) {

            return res.status(404).json({
                message: "Product not found."
            });
        }

        res.json(result.recordset[0]);

    } catch (error) {

        console.error(error);

        res.status(500).json({
            message: "Unable to fetch product."
        });
    }
});


// ==================================================
// ADD PRODUCT - PROTECTED
// ==================================================

app.post(
    "/api/products",
    authenticateToken,
    async (req, res) => {

        const {
            name,
            price,
            category
        } = req.body;

        if (
            !name ||
            price === undefined ||
            !category
        ) {

            return res.status(400).json({
                message:
                    "Name, price and category are required."
            });
        }

        try {

            const pool = await poolPromise;

            const result = await pool
                .request()
                .input(
                    "name",
                    sql.NVarChar(150),
                    name
                )
                .input(
                    "price",
                    sql.Decimal(10, 2),
                    price
                )
                .input(
                    "category",
                    sql.NVarChar(100),
                    category
                )
                .query(`
                    INSERT INTO Products
                    (
                        Name,
                        Price,
                        Category
                    )
                    OUTPUT
                        INSERTED.Id AS id,
                        INSERTED.Name AS name,
                        INSERTED.Price AS price,
                        INSERTED.Category AS category
                    VALUES
                    (
                        @name,
                        @price,
                        @category
                    )
                `);

            res.status(201).json({
                message:
                    "Product added successfully!",
                product:
                    result.recordset[0]
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                message:
                    "Unable to add product."
            });
        }
    }
);


// ==================================================
// UPDATE PRODUCT - PROTECTED
// ==================================================

app.put(
    "/api/products/:id",
    authenticateToken,
    async (req, res) => {

        const {
            name,
            price,
            category
        } = req.body;

        if (
            !name ||
            price === undefined ||
            !category
        ) {

            return res.status(400).json({
                message:
                    "Name, price and category are required."
            });
        }

        try {

            const pool = await poolPromise;

            const result = await pool
                .request()
                .input(
                    "id",
                    sql.Int,
                    req.params.id
                )
                .input(
                    "name",
                    sql.NVarChar(150),
                    name
                )
                .input(
                    "price",
                    sql.Decimal(10, 2),
                    price
                )
                .input(
                    "category",
                    sql.NVarChar(100),
                    category
                )
                .query(`
                    UPDATE Products
                    SET
                        Name = @name,
                        Price = @price,
                        Category = @category
                    OUTPUT
                        INSERTED.Id AS id,
                        INSERTED.Name AS name,
                        INSERTED.Price AS price,
                        INSERTED.Category AS category
                    WHERE Id = @id
                `);

            if (result.recordset.length === 0) {

                return res.status(404).json({
                    message:
                        "Product not found."
                });
            }

            res.json({
                message:
                    "Product updated successfully!",
                product:
                    result.recordset[0]
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                message:
                    "Unable to update product."
            });
        }
    }
);


// ==================================================
// DELETE PRODUCT - PROTECTED
// ==================================================

app.delete(
    "/api/products/:id",
    authenticateToken,
    async (req, res) => {

        try {

            const pool = await poolPromise;

            const result = await pool
                .request()
                .input(
                    "id",
                    sql.Int,
                    req.params.id
                )
                .query(`
                    DELETE FROM Products
                    OUTPUT
                        DELETED.Id AS id,
                        DELETED.Name AS name
                    WHERE Id = @id
                `);

            if (result.recordset.length === 0) {

                return res.status(404).json({
                    message:
                        "Product not found."
                });
            }

            res.json({
                message:
                    "Product deleted successfully!",
                product:
                    result.recordset[0]
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                message:
                    "Unable to delete product."
            });
        }
    }
);


// ==================================================
// TASK 7 - RATE LIMITING
// ==================================================

const externalApiLimiter = rateLimit({

    windowMs: 60 * 1000,

    max: 10,

    message: {
        message:
            "Too many requests. Please try again after one minute."
    }
});


// ==================================================
// TASK 7 - EXTERNAL API
// ==================================================

app.get(
    "/api/external-products",
    externalApiLimiter,
    async (req, res, next) => {

        try {

            const response = await fetch(
                "https://dummyjson.com/products?limit=10"
            );

            if (!response.ok) {

                return res.status(
                    response.status
                ).json({
                    message:
                        "External API request failed."
                });
            }

            const data =
                await response.json();

            res.json({

                message:
                    "External API data fetched successfully.",

                products:
                    data.products
            });

        } catch (error) {

            next(error);
        }
    }
);


// ==================================================
// TASK 7 - OAUTH INFORMATION
// ==================================================

app.get(
    "/api/oauth-info",
    (req, res) => {

        res.json({

            concept:
                "OAuth 2.0",

            purpose:
                "OAuth allows an application to access resources on behalf of a user without sharing the user's password.",

            basicFlow: [
                "User Authorization",
                "Authorization Code",
                "Access Token",
                "API Access"
            ]
        });
    }
);


// ==================================================
// TASK 8 - BACKGROUND TASK
// ==================================================

// Runs every 5 minutes
cron.schedule("*/5 * * * *", async () => {

    try {

        const pool =
            await poolPromise;

        const result =
            await pool.request().query(`
                SELECT COUNT(*) AS totalProducts
                FROM Products
            `);

        console.log(
            `[BACKGROUND TASK] Total products: ${result.recordset[0].totalProducts}`
        );

    } catch (error) {

        console.error(
            "[BACKGROUND TASK ERROR]",
            error.message
        );
    }
});


// ==================================================
// TASK 8 - ERROR HANDLING MIDDLEWARE
// ==================================================

app.use(
    (error, req, res, next) => {

        console.error(
            "Server Error:",
            error
        );

        res.status(500).json({

            message:
                "Something went wrong on the server."
        });
    }
);


// ==================================================
// START SERVER
// ==================================================

app.listen(
    PORT,
    () => {

        console.log(
            `ShopEase server is running at http://localhost:${PORT}`
        );

        console.log(
            "Background task is active and runs every 5 minutes."
        );
    }
);