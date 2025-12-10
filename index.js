import express from 'express';
import connectDB from './config/db.js';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import friendRoutes from './routes/friendRoutes.js';
import groupRoutes from './routes/groupRoutes.js';
import expenseRoutes from './routes/expenseRoutes.js';
import settlementRoutes from './routes/settlementRoutes.js';
import activityRoutes from './routes/activityRoutes.js';


const app = express();
dotenv.config();
connectDB();

// CORS configuration
app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:5174'], // Allow both Vite ports
    credentials: true, // Allow cookies to be sent
}));

app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/settlements', settlementRoutes);
app.use('/api/activities', activityRoutes);

app.listen(8002, () => {
    console.log('Server is running on port 8002');
});

app.get('/', (req, res)=>{
    res.send('Hello from suhani')
})

export default app;