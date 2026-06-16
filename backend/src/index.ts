import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { requireAuth } from './middleware/auth';

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

// CORS configuration - support both dynamic dev environments and Vercel production origin
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://hersync.vercel.app',
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1 || origin.endsWith('.vercel.app')) {
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
app.use('/api/chat', requireAuth, chatRouter);
app.use('/api/analyze', requireAuth, analyzeRouter);
app.use('/api/health-summary', requireAuth, healthSummaryRouter);
app.use('/api/period-prediction', requireAuth, periodPredictionRouter);
app.use('/api/wellness-plan', requireAuth, wellnessPlanRouter);

// Start server
app.listen(port, () => {
  console.log(`[Server]: HerSync Backend is running at http://localhost:${port}`);
});
