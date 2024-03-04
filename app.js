const express = require("express");
const pg = require("pg");
require("dotenv").config("./");

const app = express();
app.use(express.json());
app.use(express.urlencoded({extended: true}));

const sequelize = new pg.Pool({
  user: process.env.DBUSER,
  password: process.env.DBPASS,
  host: process.env.DBHOST,
  port: process.env.DBPORT,
  database: process.env.DBNAME
});

async function init() {await sequelize.query("CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, balance INTEGER)").then(() => console.log("Users table created succesfully or had already existed")).catch(err => console.log(err));
await sequelize.query(`
  CREATE TABLE IF NOT EXISTS transactions (
    user_id INTEGER not null,
    amount INTEGER NOT NULL,
    action TEXT NOT NULL,
    ts TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
  )
`).then(() => console.log("Transactions table created succesfully or had already existed")).catch(err => console.log(err));
const amount = Math.floor(Math.random() * 10000) + 1;
await sequelize.query("INSERT INTO users (balance) VALUES ($1) RETURNING id", [amount]).then((res) => {
  console.log("User inserted succesfully");
  sequelize.query("INSERT INTO transactions (user_id, amount, action) VALUES ($1, $2, 'Creation')", [res.rows[0].id, amount]).then(() => {
    console.log("Transaction inserted succesfully");
  }).catch(err => console.log(err));
}).catch(err => console.log(err));}

init();

app.listen(process.env.MAINPORT || 8080, () => console.log("Server started on port", process.env.MAINPORT || 8080))

app.post("/withdraw", async (req, res) => {
  const { amount } = req.query;
  if (!amount) return res.sendStatus(400);

  try {
    const user = await sequelize.query(
      "UPDATE users SET balance = balance - $1 WHERE id = $2 RETURNING id",
      [amount, req.query.id]
    );
    if (!user.rowCount) {
      return res.sendStatus(404);
    }

    await sequelize.query(
      "INSERT INTO transactions (user_id, amount, action) VALUES ($1, $2, 'Withdraw')",
      [req.query.id, -amount]
    );
    res.sendStatus(200);
  } catch (err) {
    console.log(err);
    res.sendStatus(500);
  }
});


app.post("/deposit", async (req, res) => {
  const { amount } = req.query;
  if (!amount) return res.sendStatus(400);

  try {
    const user = await sequelize.query(
      "UPDATE users SET balance = balance + $1 WHERE id = $2 RETURNING id",
      [amount, req.query.id]
    );
    if (!user.rowCount) {
      return res.sendStatus(404);
    }

    await sequelize.query(
      "INSERT INTO transactions (user_id, amount, action) VALUES ($1, $2, 'Deposit')",
      [req.query.id, amount]
    );
    res.sendStatus(200);
  } catch (err) {
    console.log(err);
    res.sendStatus(500);
  }
});


app.get("/balance", async (req, res) => {
  try {
    const user = await sequelize.query(
      "SELECT balance FROM users WHERE id = $1",
      [req.query.id]
    );
    if (!user.rowCount) {
      return res.sendStatus(404);
    }
    res.send({ balance: user.rows[0].balance });
  } catch (err) {
    console.log("Error:", err);
    res.sendStatus(500);
  }
});

