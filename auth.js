const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { sql, poolPromise } = require("./db");


// Secret key for creating JWT tokens
const JWT_SECRET = "ShopEaseSecretKey2026";


// ==========================
// REGISTER USER
// ==========================

async function registerUser(name, email, phone, password) {

    const pool = await poolPromise;

    // Check if email already exists
    const existingUser = await pool
        .request()
        .input("email", sql.NVarChar(150), email)
        .query(`
            SELECT Id
            FROM Users
            WHERE Email = @email
        `);


    if (existingUser.recordset.length > 0) {

        throw new Error(
            "Email is already registered."
        );

    }


    // Hash password
    const passwordHash =
        await bcrypt.hash(password, 10);


    // Insert user into database
    const result = await pool
        .request()
        .input("name", sql.NVarChar(100), name)
        .input("email", sql.NVarChar(150), email)
        .input("phone", sql.NVarChar(20), phone)
        .input(
            "passwordHash",
            sql.NVarChar(255),
            passwordHash
        )
        .query(`
            INSERT INTO Users
            (
                Name,
                Email,
                Phone,
                PasswordHash
            )
            OUTPUT
                INSERTED.Id AS id,
                INSERTED.Name AS name,
                INSERTED.Email AS email
            VALUES
            (
                @name,
                @email,
                @phone,
                @passwordHash
            )
        `);


    return result.recordset[0];
}


// ==========================
// LOGIN USER
// ==========================

async function loginUser(email, password) {

    const pool = await poolPromise;


    // Find user
    const result = await pool
        .request()
        .input("email", sql.NVarChar(150), email)
        .query(`
            SELECT
                Id,
                Name,
                Email,
                PasswordHash
            FROM Users
            WHERE Email = @email
        `);


    if (result.recordset.length === 0) {

        throw new Error(
            "Invalid email or password."
        );

    }


    const user = result.recordset[0];


    // Compare password with hashed password
    const passwordMatch =
        await bcrypt.compare(
            password,
            user.PasswordHash
        );


    if (!passwordMatch) {

        throw new Error(
            "Invalid email or password."
        );

    }


    // Create JWT token
    const token = jwt.sign(
        {
            id: user.Id,
            email: user.Email,
            name: user.Name
        },
        JWT_SECRET,
        {
            expiresIn: "1h"
        }
    );


    return {
        token,
        user: {
            id: user.Id,
            name: user.Name,
            email: user.Email
        }
    };
}


// ==========================
// AUTHORIZATION MIDDLEWARE
// ==========================

function authenticateToken(req, res, next) {

    const authHeader =
        req.headers["authorization"];


    if (!authHeader) {

        return res.status(401).json({
            message:
                "Access denied. Please login first."
        });

    }


    const token =
        authHeader.split(" ")[1];


    if (!token) {

        return res.status(401).json({
            message:
                "Invalid authorization format."
        });

    }


    try {

        const decoded =
            jwt.verify(
                token,
                JWT_SECRET
            );


        req.user = decoded;

        next();

    }

    catch (error) {

        return res.status(403).json({
            message:
                "Invalid or expired token."
        });

    }

}


module.exports = {
    registerUser,
    loginUser,
    authenticateToken
};