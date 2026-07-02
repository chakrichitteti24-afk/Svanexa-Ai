import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Route imports
import chatRouter from './routes/chat';
import analyzeRouter from './routes/analyze';
import healthSummaryRouter from './routes/health-summary';
import periodPredictionRouter from './routes/period-prediction';
import wellnessPlanRouter from './routes/wellness-plan';

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 8080;

const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
  'https://hersync.vercel.app',
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1 || origin.endsWith('.vercel.app') || origin.startsWith('http://localhost:')) {
      return callback(null, true);
    }
    
    // Fallback to allow during development
    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Public health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Authenticated route mounts
app.use('/api/chat', chatRouter);
app.use('/api/analyze', analyzeRouter);
app.use('/api/health-summary', healthSummaryRouter);
app.use('/api/period-prediction', periodPredictionRouter);
app.use('/api/wellness-plan', wellnessPlanRouter);

// Start server
app.listen(port, () => {
  console.log(`[Server]: HerSync Backend is running at http://localhost:${port}`);
});
