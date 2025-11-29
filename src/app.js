const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.q9crcyr.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: false,
    deprecationErrors: true,
  },
});

const JWT_SECRET = process.env.JWT_SECRET || 'test_secret_123';

function verifyToken(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer '))
    return res
      .status(401)
      .json({ success: false, message: 'No token provided' });

  const token = header.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).send({ message: 'Unauthorized access' });
  }
}

async function connectDB() {
  if (!client.topology) {
    await client.connect();
    console.log('MongoDB connected (Vercel serverless)');
  }
}

const db = client.db('Blood');
const donersCollections = db.collection('doners');

app.get('/', (req, res) => {
  res.send('Blood Hub Project Server Running on Vercel');
});

app.post('/blood-request', verifyToken, async (req, res) => {
  await connectDB();
  const data = req.body;
  data.unitsNeeded = parseInt(data.unitsNeeded);
  data.createdAt = new Date();
  data.status = 'Open';
  if (req.user.email !== data.userEmail) {
    return res.status(403).json({ message: 'Forbidden access' });
  }
  const result = await donersCollections.insertOne(data);
  res.send({
    success: true,
    message: 'Blood request submitted successfully!',
    requestId: result.insertedId,
  });
});

app.get('/my-request/:email', verifyToken, async (req, res) => {
  await connectDB();
  const email = req.params.email;
  if (req.user.email !== email) {
    return res.status(403).json({ message: 'Forbidden access' });
  }

  const result = await donersCollections
    .find({ userEmail: email })
    .sort({ createdAt: -1 })
    .toArray();

  res.send(result);
});

app.get('/blood-request/:id', async (req, res) => {
  await connectDB();
  const id = req.params.id;
  if (!ObjectId.isValid(id)) return res.send(null);

  const result = await donersCollections.findOne({
    _id: new ObjectId(id),
  });

  res.send(result);
});

app.get('/blood-requests', async (req, res) => {
  await connectDB();
  const result = await donersCollections
    .find({ status: 'Open' })
    .sort({ priority: -1, createdAt: -1 })
    .toArray();

  res.send(result);
});

app.get('/featured-request', async (req, res) => {
  await connectDB();
  const result = await donersCollections
    .find()
    .limit(6)
    .sort({ createdAt: -1 })
    .toArray();

  res.send(result);
});

app.patch('/blood-request/close/:id', verifyToken, async (req, res) => {
  await connectDB();
  const id = req.params.id;

  if (!ObjectId.isValid(id)) {
    return res.send({ success: false, message: 'Invalid ID' });
  }

  await donersCollections.updateOne(
    { _id: new ObjectId(id) },
    {
      $set: { status: 'Closed', updatedAt: new Date() },
    }
  );

  res.send({
    success: true,
    message: 'Request closed successfully',
  });
});

app.delete('/blood-request/:id', verifyToken, async (req, res) => {
  await connectDB();
  const id = req.params.id;

  if (!ObjectId.isValid(id)) {
    return res.send({ success: false, message: 'Invalid ID' });
  }

  await donersCollections.deleteOne({ _id: new ObjectId(id) });

  res.send({
    success: true,
    message: 'Request deleted successfully!',
  });
});

module.exports = app;
