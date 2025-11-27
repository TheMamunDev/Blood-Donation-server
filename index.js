const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
const port = process.env.PORT || 3000;
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
console.log(JWT_SECRET);
function verifyToken(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer '))
    return res
      .status(401)
      .json({ success: false, message: 'No token provided' });

  const token = header.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('DECODED:', decoded);
    req.user = decoded;
    console.log('DECODED:', decoded);
    next();
  } catch (err) {
    return res.status(401).send({ message: 'Unauthorized access' });
  }
}

const db = client.db('Blood');
const donersCollections = db.collection('doners');

async function runGetStarted() {
  try {
    await client.connect();
    app.post('/blood-request', verifyToken, async (req, res) => {
      console.log('API called');
      console.log('Data from API body:', req.body);
      try {
        const data = req.body;
        data.unitsNeeded = parseInt(data.unitsNeeded);
        data.createdAt = new Date();
        data.status = 'Open';
        const result = await donersCollections.insertOne(data);
        if (result.acknowledged && result.insertedId) {
          // console.log('Inserted ID:', result.insertedId.toString());
          res.send({
            success: true,
            message: 'Blood request submitted successfully!',
            requestId: result.insertedId,
          });
        } else {
          res.status(500).send({
            success: false,
            message: 'Failed to submit request: Acknowledgment error.',
          });
        }
      } catch (error) {
        console.error(error);
        res.status(500).send({
          success: false,
          message:
            'Failed to submit request. Check server logs for detailed error (e.g., validation failure).',
        });
      }
    });

    app.get('/my-request/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      console.log(email);
      const result = await donersCollections
        .find({ userEmail: email })
        .sort({ createdAt: -1 })
        .toArray();
      res.send(result);
    });

    app.get('/blood-request/:id', async (req, res) => {
      const id = req.params.id;

      if (!ObjectId.isValid(id)) {
        return res.send(null);
      }
      const result = await donersCollections.findOne({
        _id: new ObjectId(id),
      });

      res.send(result);
    });

    app.get('/blood-requests', async (req, res) => {
      const result = await donersCollections
        .find({ status: 'Open' })
        .sort({ priority: -1, createdAt: -1 })
        .toArray();

      res.send(result);
    });

    app.get('/featured-request', async (req, res) => {
      const result = await donersCollections
        .find()
        .limit(6)
        .sort({ createdAt: -1 })
        .toArray();

      res.send(result);
    });

    app.patch('/blood-request/close/:id', async (req, res) => {
      const id = req.params.id;

      if (!ObjectId.isValid(id)) {
        return res.send({ success: false, message: 'Invalid ID' });
      }
      const result = await donersCollections.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            status: 'Closed',
            updatedAt: new Date(),
          },
        }
      );
      res.send({
        success: true,
        message: 'Request closed successfully',
      });
    });

    app.delete('/blood-request/:id', async (req, res) => {
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

    await client.db('admin').command({ ping: 1 });
    console.log('Connected to MongoDB!');
  } finally {
  }
}

runGetStarted().catch(console.dir);

app.get('/', (req, res) => {
  res.send('This is Blood Hub Project Server');
});

app.listen(port, () => {
  console.log('Blood Hub Server is running at', port);
});
