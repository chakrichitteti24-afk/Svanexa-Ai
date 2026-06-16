import { differenceInDays, addDays, subDays, format } from 'date-fns';

export interface CycleEntry {
  startDate: string;
  endDate: string;
  notes?: string;
}

export interface CheckInEntry {
  mood: string;
  sleep: number;
  water: number;
  exercise: number;
  stress: number;
  acne: number;
  hairFall: string;
  bloating: string;
  fatigue: string;
  cramps: string;
  notes?: string;
}

export interface PredictionResult {
  earliestDate: Date;
  likelyDate: Date;
  latestDate: Date;
  confidenceScore: number;
  confidenceLabel: string;
  isPCOSMode: boolean;
  message: string;
  expectedPeriod: string;
  explanation: string;
}

export interface CycleAnalytics {
  avgCycleLength: number;
  avgPeriodDuration: number;
  variance: number;
  consistencyScore: number;
  regularityStatus: 'Stable' | 'Irregular' | 'Highly Irregular' | 'Not Enough Data';
  trend: 'Stable' | 'Increasing' | 'Decreasing' | 'Unknown';
}

export interface HealthScoreResult {
  score: number | null;
  category: 'Excellent' | 'Good' | 'Moderate' | 'Needs Attention' | 'Insufficient Data';
  insights: string[];
}

export class CycleIntelligenceEngine {
  cycles: CycleEntry[];
  checkIns: Record<string, CheckInEntry>;
  hasPCOS: boolean;

  constructor(cycles: CycleEntry[], checkIns: Record<string, CheckInEntry> = {}, hasPCOS: boolean = false) {
    // Limit to last 12 cycles for Prediction Engine V2
    this.cycles = [...cycles]
      .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
      .slice(0, 12);
    this.checkIns = checkIns;
    this.hasPCOS = hasPCOS;
  }

  getCycleLengths(): number[] {
    const lengths: number[] = [];
    for (let i = 0; i < this.cycles.length - 1; i++) {
      lengths.push(differenceInDays(new Date(this.cycles[i].startDate), new Date(this.cycles[i + 1].startDate)));
    }
    return lengths;
  }

  getPeriodDurations(): number[] {
    return this.cycles.map(c => differenceInDays(new Date(c.endDate), new Date(c.startDate)) + 1);
  }

  analyzeCycles(): CycleAnalytics {
    const lengths = this.getCycleLengths();
    const durations = this.getPeriodDurations();

    if (lengths.length === 0) {
      return {
        avgCycleLength: 28,
        avgPeriodDuration: durations.length > 0 ? durations[0] : 5,
        variance: 0,
        consistencyScore: 0,
        regularityStatus: 'Not Enough Data',
        trend: 'Unknown'
      };
    }

    const avgCycleLength = Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length);
    const avgPeriodDuration = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);

    // Variance & Standard Deviation
    const variance = lengths.reduce((acc, val) => acc + Math.pow(val - avgCycleLength, 2), 0) / lengths.length;
    const stdDev = Math.sqrt(variance);

    // Consistency Score (0-100)
    let consistencyScore = Math.max(0, 100 - (stdDev * 5));
    if (this.hasPCOS) consistencyScore = Math.min(100, consistencyScore + 10); // Adjust curve for PCOS expectations

    let regularityStatus: CycleAnalytics['regularityStatus'] = 'Stable';
    if (stdDev > 7) regularityStatus = 'Highly Irregular';
    else if (stdDev > 3) regularityStatus = 'Irregular';

    // Trend Detection (last 3-4 cycles)
    let trend: CycleAnalytics['trend'] = 'Stable';
    if (lengths.length >= 3) {
      const recent = lengths.slice(0, 3); // lengths are newest first (index 0 is most recent gap)
      if (recent[0] > recent[1] && recent[1] > recent[2]) trend = 'Increasing';
      else if (recent[0] < recent[1] && recent[1] < recent[2]) trend = 'Decreasing';
    }

    return {
      avgCycleLength,
      avgPeriodDuration,
      variance,
      consistencyScore: Math.round(consistencyScore),
      regularityStatus,
      trend
    };
  }

  predictNextPeriod(): PredictionResult | null {
    if (this.cycles.length === 0) return null;

    const analytics = this.analyzeCycles();
    const lastStart = new Date(this.cycles[0].startDate);
    
    // Base prediction
    const likelyDate = addDays(lastStart, analytics.avgCycleLength);
    
    // Window calculation
    let windowDays = Math.max(2, Math.round(Math.sqrt(analytics.variance)));
    if (this.hasPCOS) {
      windowDays += 4; // Wider window for PCOS V2
    }
    
    // Symptom-based adjustment (e.g., severe cramps/bloating today might pull date closer)
    const recentCheckIns = this.getRecentCheckIns(5);
    const hasPrePeriodSymptoms = recentCheckIns.some(c => 
      c.cramps === 'moderate' || c.cramps === 'severe' || 
      c.bloating === 'moderate' || c.bloating === 'severe'
    );
    
    let earliestDate = subDays(likelyDate, windowDays);
    let latestDate = addDays(likelyDate, windowDays);

    if (hasPrePeriodSymptoms) {
      const today = new Date();
      if (today < earliestDate && differenceInDays(earliestDate, today) <= 5) {
        earliestDate = today;
      }
    }

    // Confidence Calculation V2
    let confidence = 100;
    
    // Data size impact
    if (this.cycles.length < 3) {
      confidence -= 35;
    } else if (this.cycles.length < 6) {
      confidence -= 15;
    }
    
    // Variance impact
    confidence -= Math.round(Math.sqrt(analytics.variance) * 4);
    
    // PCOS Adjustment (More variability, lower confidence, no medical certainty)
    if (this.hasPCOS) {
      confidence -= 15;
    }

    // Stress & Sleep factors (recent check-ins average stress > 7 deducts confidence)
    if (recentCheckIns.length > 0) {
      const avgSleep = recentCheckIns.reduce((sum, c) => sum + c.sleep, 0) / recentCheckIns.length;
      const avgStress = recentCheckIns.reduce((sum, c) => sum + c.stress, 0) / recentCheckIns.length;
      if (avgSleep < 6.0) confidence -= 5;
      if (avgStress > 7) confidence -= 8;
    }

    confidence = Math.max(10, Math.min(99, confidence)); // Limit max confidence to 99% (never 100% certain)

    let confidenceLabel = 'Moderate';
    if (confidence >= 85) confidenceLabel = 'High';
    else if (confidence >= 70) confidenceLabel = 'Reliable';
    else if (confidence < 50) confidenceLabel = 'Low';

    // Format Expected Period Window
    const formatStr = 'MMM d';
    const expectedPeriod = `${format(earliestDate, formatStr)} - ${format(latestDate, 'MMM d, yyyy')}`;

    // Explanation Construction
    let explanation = `Based on your last ${this.cycles.length} logged cycle${this.cycles.length > 1 ? 's' : ''}`;
    if (hasPrePeriodSymptoms) {
      explanation += " and recent physical symptoms";
    }
    if (this.hasPCOS) {
      explanation += ". Adjusted for PCOS-related variability (confidence lowered, wider forecast window)";
    }
    explanation += ".";

    const message = `Expected Period: ${expectedPeriod} (${confidence}% confidence). ${explanation}`;

    return {
      earliestDate,
      likelyDate,
      latestDate,
      confidenceScore: confidence,
      confidenceLabel,
      isPCOSMode: this.hasPCOS,
      message,
      expectedPeriod,
      explanation
    };
  }

  getRecentCheckIns(days: number): CheckInEntry[] {
    const today = new Date();
    const recent: CheckInEntry[] = [];
    for (let i = 0; i < days; i++) {
      const d = format(subDays(today, i), 'yyyy-MM-dd');
      if (this.checkIns[d]) recent.push(this.checkIns[d]);
    }
    return recent;
  }

  calculateHealthScore(): HealthScoreResult {
    const analytics = this.analyzeCycles();
    const recentLogs = this.getRecentCheckIns(30);
    
    if (this.cycles.length === 0 && recentLogs.length < 3) {
      return {
        score: null,
        category: 'Insufficient Data',
        insights: ["Not enough data yet."]
      };
    }
    
    let score = 100;
    const insights: string[] = [];

    // Cycle Penalty
    if (analytics.regularityStatus === 'Highly Irregular') {
      score -= 20;
      insights.push("High cycle variability detected.");
    } else if (analytics.regularityStatus === 'Irregular') {
      score -= 10;
    }

    // Tracking Penalty
    if (recentLogs.length < 5) {
      score -= 15;
      insights.push("Need more daily logs for an accurate health score.");
    } else {
      // Calculate averages
      const avgSleep = recentLogs.reduce((a, b) => a + b.sleep, 0) / recentLogs.length;
      const avgStress = recentLogs.reduce((a, b) => a + b.stress, 0) / recentLogs.length;
      const avgWater = recentLogs.reduce((a, b) => a + b.water, 0) / recentLogs.length;
      const avgExercise = recentLogs.reduce((a, b) => a + b.exercise, 0) / recentLogs.length;

      if (avgSleep < 6.5) {
        score -= 10;
        insights.push("Sleep average is below recommended levels. Poor sleep affects hormonal balance.");
      }
      if (avgStress > 7) {
        score -= 10;
        insights.push("Stress levels are persistently high, which can delay ovulation.");
      }
      if (avgWater < 1.5) {
        score -= 5;
        insights.push("Water intake is low. Hydration is key for managing bloating.");
      }
      if (avgExercise < 15) {
        score -= 5;
        insights.push("Increasing daily movement can help regulate PCOS symptoms.");
      }

      // Symptom correlations
      const severeCramps = recentLogs.filter(l => l.cramps === 'severe').length;
      if (severeCramps >= 3) {
        score -= 10;
        insights.push("Frequent severe cramps detected. Consider discussing this with a healthcare professional.");
      }
    }

    score = Math.max(0, Math.min(100, Math.round(score)));

    let category: HealthScoreResult['category'] = 'Excellent';
    if (score < 60) category = 'Needs Attention';
    else if (score < 75) category = 'Moderate';
    else if (score < 90) category = 'Good';

    if (insights.length === 0) {
      insights.push("Your wellness indicators are looking great! Keep maintaining these habits.");
    }

    return { score, category, insights };
  }
}
