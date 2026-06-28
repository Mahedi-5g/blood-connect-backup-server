const express = require("express");
const cors = require("cors");
require("dotenv").config();

const { MongoClient, ServerApiVersion, ObjectId, } = require("mongodb");

const app = express();
const port = 5000;

app.use(cors());
app.use(express.json());

const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
});

async function run() {
    try {
        await client.connect();

        console.log("MongoDB Connected");

        const database = client.db("bloodConnect_db");
        const requestCollection = database.collection("requests-data");

        app.get("/featured-requests", async (req, res) => {
            const result = await requestCollection
                .find()
                .limit(3)
                .toArray();

            res.send(result);
        });

        app.get("/requests", async (req, res) => {
            const result = await requestCollection.find().toArray();
            res.send(result);
        });

        app.get('/requests/:id',  async (req, res) => {
            const { id } = req.params;

            const result = await requestCollection.findOne({ _id: new ObjectId(id) })
            res.send(result);

        });

    } catch (err) {
        console.error(err);
    }
}

run();

app.get("/", (req, res) => {
    res.send("Blood Connect API Running...");
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});