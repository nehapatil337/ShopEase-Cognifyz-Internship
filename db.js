const sql = require("mssql/msnodesqlv8");

const config = {
    server: "SWAPI\\SQLEXPRESS",
    database: "ShopEaseDB",
    driver: "ODBC Driver 18 for SQL Server",

    options: {
        trustedConnection: true,
        trustServerCertificate: true
    }
};

const poolPromise = new sql.ConnectionPool(config)
    .connect()
    .then(pool => {
        console.log("Connected to ShopEaseDB successfully!");
        return pool;
    })
    .catch(error => {
        console.error("Database connection failed:", error);
        throw error;
    });

module.exports = {
    sql,
    poolPromise
};