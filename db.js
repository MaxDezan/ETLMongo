const { MongoClient } = require('mongodb');

const URI = process.env.MONGO_URI;
const DB_NAME = process.env.MONGO_DB || 'pesquisa';

let clientPromise;

function getClient() {
    if (!clientPromise) {
        const client = new MongoClient(URI, {
            serverSelectionTimeoutMS: 8000,
        });
        clientPromise = client.connect();
    }
    return clientPromise;
}

async function getDb() {
    const client = await getClient();
    return client.db(DB_NAME);
}

async function closeDb() {
    if (clientPromise) {
        const client = await clientPromise;
        await client.close();
        clientPromise = null;
    }
}

module.exports = { getDb, closeDb, DB_NAME };
