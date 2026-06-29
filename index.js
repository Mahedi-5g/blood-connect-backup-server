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
        const userCollection = database.collection("user");

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

        app.get('/requests/:id', async (req, res) => {
            const { id } = req.params;

            const result = await requestCollection.findOne({ _id: new ObjectId(id) })
            res.send(result);

        });


        app.get('/my-requests', async (req, res) => {
            const { email, limit } = req.query;
            const query = { requesterEmail: email };
            const limitNum = parseInt(limit) || 3;

            const result = await requestCollection
                .find(query)
                .sort({ createdAt: -1 })
                .limit(limitNum)
                .toArray();

            res.send(result);
        })


        app.get('/my-requests-full', async (req, res) => {
            const { email, status, page, limit } = req.query;

            let query = { requesterEmail: email };
            if (status && status !== 'all') {
                query.status = status;
            }

            const pageNum = parseInt(page) || 1;
            const limitNum = parseInt(limit) || 5;
            const skipNum = (pageNum - 1) * limitNum;

            const totalItems = await requestCollection.countDocuments(query);
            const totalPages = Math.ceil(totalItems / limitNum);

            const requests = await requestCollection
                .find(query)
                .sort({ createdAt: -1 })
                .skip(skipNum)
                .limit(limitNum)
                .toArray();

            res.send({
                requests, totalPages, currentPage: pageNum,
                totalItems
            });
        })


        app.get('/users/status', async (req, res) => {
            const { email } = req.query;
            const user = await database.collection("users").findOne({ email: email });
            res.send({ status: user.status || "active" });

        });

        app.get('/search-donors', async (req, res) => {

            const { bloodGroup, district, upazila } = req.query;
            let query = {};

            if (bloodGroup) {
                query.bloodGroup = bloodGroup;
            }
            if (district) {
                query.district = { $regex: new RegExp(district, "i") };
            }
            if (upazila) {
                query.upazila = { $regex: new RegExp(upazila, "i") };
            }

            query.status = { $ne: "blocked" };

            const result = await database.collection("user")
                .find(query)
                .project({ password: 0, salt: 0 })
                .toArray();
            res.send(result);
        });

        app.get('/admin/stats', async (req, res) => {
            const totalUsers = await userCollection.estimatedDocumentCount();
            const totalRequests = await donationRequestsCollection.estimatedDocumentCount();
            const fundingData = await fundingCollection.aggregate([
                { $group: { _id: null, total: { $sum: "$amount" } } }
            ]).toArray();
            const totalFunding = fundingData[0]?.total || 450;

            res.send({
                totalUsers,
                totalRequests,
                totalFunding
            });
        });

        app.post('/requests', async (req, res) => {
            const newRequest = req.body;
            const user = await database.collection("users").findOne({ email: newRequest.requesterEmail });
            if (user && user.status === "blocked") {
                return res.status(403).send({ success: false, message: "Blocked users are not allowed to create requests!" });
            }

            const finalDoc = {
                ...newRequest,
                status: "pending",
                createdAt: new Date()
            };

            const result = await requestCollection.insertOne(finalDoc);
            res.status(201).send({ success: true, insertedId: result.insertedId });

        });


        app.patch('/requests/:id', async (req, res) => {
            const id = req.params.id;
            const { status, donorName, donorEmail } = req.body;

            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    status: status,
                    ...(donorName && { donorName }),
                    ...(donorEmail && { donorEmail })
                }
            };

            const result = await requestCollection.updateOne(filter, updateDoc);

            if (result.matchedCount === 0) {
                return res.status(404).send({ message: "Donation request not found" });
            }

            res.send({ success: true, message: `Status successfully updated to ${status}` });

        });


        app.patch("/user/update-profile", async (req, res) => {
            const { email } = req.query;
            const updatedData = req.body;

            const filter = { email: email };
            const updateDoc = {
                $set: {
                    name: updatedData.name,
                    bloodGroup: updatedData.bloodGroup,
                    district: updatedData.district,
                    upazila: updatedData.upazila,
                },
            };
            const result = await userCollection.updateOne(filter, updateDoc);

            res.send(result);
        });


        app.delete('/requests/:id', async (req, res) => {
            const id = req.params.id;

            const query = { _id: new ObjectId(id) };
            const result = await requestCollection.deleteOne(query);

            if (result.deletedCount === 0) {
                return res.status(404).send({ message: "Request not found to delete" });
            }

            res.send({ success: true, message: "Request deleted successfully" });

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