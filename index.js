const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
require("dotenv").config();
const { MongoClient, ServerApiVersion } = require("mongodb");
const app = express();
const port = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === "production";

app.use(
  cors({
    origin: function (origin, callback) {
      if (
        !origin ||
        origin === "http://localhost:5173" ||
        /^http:\/\/[a-z0-9-]+\.localhost:5173$/.test(origin)
      ) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Authorization", "Content-Type"],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.whnyl.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
async function run() {
  try {
    // collections
    const userCollection = client.db("9AmSolution").collection("users");
    // root api
    app.get("/", (req, res) => {
      res.send("9 AM Solution server is running");
    });
    // verify accesss token
    app.post("/auth/verify-token", async (req, res) => {
      const token = req.cookies["Auth-token"];
      console.log(token);
      if (!token) {
        return res.send({ success: false, message: "No token provided" });
      }

      jwt.verify(
        token,
        process.env.ACCESS_TOKEN_SECRET,
        async (err, decoded) => {
          if (err) {
            return res.status(401).json({ message: "Invalid token" });
          }

          const user = await userCollection.findOne({
            username: decoded.username,
          });

          if (!user) {
            return res.status(401).json({ message: "User not found" });
          }

          // Return only safe user info
          const safeUser = {
            username: user.username,
            shops: user.shops,
          };

          res.json({ user: safeUser });
        }
      );
    });

    // users api for sign up
    app.post("/users", async (req, res) => {
      const user = req.body;
      const { username, shops = [] } = user;
      const existingUser = await userCollection.findOne({ username });
      if (existingUser) {
        return res.send({ message: "User already exists", insertedId: null });
      }
      const existingShop = await userCollection
        .find({ shops: { $in: shops } })
        .project({ shops: 1 })
        .toArray();
      const existingShopNames = existingShop.flatMap((p) => p.shops);
      const duplicates = shops.filter((shop) =>
        existingShopNames.includes(shop)
      );
      if (duplicates.length > 0) {
        return res.send({
          message: `${duplicates.join(", ")} already exists`,
          insertedId: null,
        });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });
    // user api for sign in
    app.post("/auth/signin", async (req, res) => {
      const { username, password, remember } = req.body;
      const result = await userCollection.findOne({ username });
      if (!result) {
        return res.status(401).json({
          success: false,
          field: "username",
          message: "User does not exist",
        });
      }
      if (result.password !== password) {
        return res.status(401).json({
          success: false,
          field: "password",
          message: "Incorrect password",
        });
      }
      userData = {
        username: result.username,
        shops: result.shops,
      };
      const tokenPayload = {
        username: result.username,
      };
      const expiresIn = remember ? "7d" : "30m";
      const token = jwt.sign(tokenPayload, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: expiresIn,
      });
      res
        .cookie("Auth-token", token, {
          httpOnly: false,
          secure: isProduction, // true for HTTPS in production
          sameSite: isProduction ? "None" : "Lax", // "None" allows cross-site in prod
          domain: ".localhost", // <- SHARE COOKIE WITH SUBDOMAINS
          path: "/", // <- share across entire site
          maxAge: remember ? 7 * 24 * 60 * 60 * 1000 : 30 * 60 * 1000, // 7 days or 30 mins
        })
        .send({ success: true, user: userData });

      // res
      //   .cookie("Auth-token", token, {
      //     httpOnly: true,
      //     secure: isProduction,
      //     sameSite: isProduction ? "None" : "Lax",
      //     maxAge: remember ? 7 * 24 * 60 * 60 * 1000 : 30 * 60 * 1000,
      //   })
      //   .send({ success: true, user: userData });
    });
    // user api for sign out
    app.post("/auth/signout", (req, res) => {
      res
        .clearCookie("Auth-token", {
          httpOnly: true,
          secure: isProduction,
          sameSite: isProduction ? "None" : "Lax",
          path: "/",
        })
        .json({ success: true, message: "Signed out successfully" });

      // res
      //   .clearCookie("Auth-token", {
      //     httpOnly: true,
      //     secure: isProduction,
      //     sameSite: isProduction ? "None" : "Lax",
      //   })
      //   .json({ success: true, message: "Signed out successfully" });
    });
  } finally {
  }
}
run();

app.listen(port, () => {});
