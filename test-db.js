const { poolPromise } = require("./db");

async function testDatabase() {
    try {
        const pool = await poolPromise;

        const result = await pool.request().query(
            "SELECT DB_NAME() AS DatabaseName"
        );

        console.log("Connected database:", result.recordset[0].DatabaseName);
    } catch (error) {
        console.error("Test failed:", error.message);
    }
}

testDatabase();