import 'dotenv/config';
import mongoose from 'mongoose';
import app from './app.js';

const port = Number(process.env.PORT) || 3000;
const MONGODB_URI = process.env.MONGODB_URI;

async function startServer(): Promise<void> {
    if(!MONGODB_URI) {
        throw new Error('MONGODB_URI is missing');
    }

    await mongoose.connect(MONGODB_URI);

    console.log('Connected to MongoDB Atlas');

    app.listen(port, () => {
        console.log(`Server is running on http://localhost:${port}`);
    });
}

startServer().catch((error: unknown) => {
    console.log("Failed to start server: ", error);
    process.exit(1);
});