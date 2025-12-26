import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

// Validate required environment variables
const requiredEnvVars = [
    'MONGO_URL',
    'JWT_SECRET',
    'FRONTEND_URL',
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:');
    missingVars.forEach(varName => console.error(`   - ${varName}`));
    console.error('\nPlease check your .env file and ensure all required variables are set.');
    process.exit(1);
}

console.log('✅ All required environment variables are present');

import express from 'express';
import helmet from 'helmet';
import connectDB from './config/db.js';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { apiLimiter } from './middleware/rateLimiter.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import friendRoutes from './routes/friendRoutes.js';
import groupRoutes from './routes/groupRoutes.js';
import expenseRoutes from './routes/expenseRoutes.js';
import settlementRoutes from './routes/settlementRoutes.js';
import activityRoutes from './routes/activityRoutes.js';
import upiSettlementRoutes from './routes/upiSettlementRoutes.js';


const app = express();

// Trust proxy - required when running behind Nginx reverse proxy
// This allows express-rate-limit to correctly identify users via X-Forwarded-For
if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
}

connectDB();

// Security middleware
app.use(helmet({
    contentSecurityPolicy: process.env.NODE_ENV === 'production',
    crossOriginEmbedderPolicy: process.env.NODE_ENV === 'production'
}));

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') ||
    ['http://localhost:5174', 'http://localhost:5173'];

app.use(cors({
    origin: allowedOrigins,
    credentials: true,
}));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Rate limiting
app.use('/api', apiLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/settlements', settlementRoutes);
app.use('/api/upi-settlements', upiSettlementRoutes);
app.use('/api/activities', activityRoutes);

// Start server with timeout configuration
const server = app.listen(8002, () => {
    console.log('Server is running on port 8002');
});

// Set request timeout to 30 seconds
server.timeout = 30000;

// Health check endpoint for deployment monitoring
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
    res.send('Hello from suhani')
})

export default app;