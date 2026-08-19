import { differenceInDays, addDays, subDays, format, isWithinInterval, isSameDay } from 'date-fns';

export interface CycleEntry {
  id?: string;
  startDate: string; // yyyy-MM-dd
  endDate?: string | null; // yyyy-MM-dd
  flowIntensity?: 'spotting' | 'light' | 'medium' | 'heavy' | null;
  symptoms?: string[] | null;
  notes?: string;
}

export interface CheckInEntry {
  mood?: string;
  sleep?: number;
  water?: number;
  exercise?: number;
  stress?: number;
  acne?: number;
  hairFall?: string;
  bloating?: string;
  fatigue?: string;
  cramps?: string;
  cervicalMucus?: 'dry' | 'sticky' | 'creamy' | 'egg_white' | 'watery' | null;
  notes?: string;
}

export interface CycleAnalytics {
  avgCycleLength: number;
  avgPeriodDuration: number;
  variance: number;
  stdDev: number;
  consistencyScore: number;
  regularityStatus: 'Regular' | 'Moderate Variability' | 'Irregular (PCOS Pattern)' | 'Insufficient Data';
  clinicalCategory: 'Normal (21-35 days)' | 'Short (<21 days)' | 'Oligomenorrhea (>35 days)' | 'Needs More Data';
  trend: 'Stable' | 'Increasing' | 'Decreasing' | 'Unknown';
  totalCyclesLogged: number;
  shortestCycle: number;
  longestCycle: number;
}

export interface PredictionResult {
  earliestDate: Date;
  likelyDate: Date;
  latestDate: Date;
  confidenceScore: number;
  confidenceLabel: 'High' | 'Reliable' | 'Moderate' | 'Low';
  isPCOSMode: boolean;
  expectedPeriod: string;
  explanation: string;
}

export interface FertileWindowResult {
  predictedOvulationDate: Date;
  fertileWindowStart: Date;
  fertileWindowEnd: Date;
  pregnancyChanceToday: 'Peak' | 'High' | 'Medium' | 'Low';
  isOvulationToday: boolean;
  isFertileToday: boolean;
  ovulationCountdownDays: number;
  cervicalMucusGuide: string;
  fertilityMessage: string;
}

export type BiologicalPhaseName = 'Menstrual' | 'Follicular' | 'Ovulatory' | 'Luteal';

export interface PhaseHormoneState {
  estrogen: 'Low' | 'Rising' | 'Peak' | 'Moderate';
  progesterone: 'Low' | 'Low' | 'Low' | 'High (Dominant)';
  fshLh: 'Low' | 'Active' | 'LH Surge' | 'Low';
  testosterone: 'Low' | 'Moderate' | 'Slight Peak' | 'Low';
}

export interface PhaseDetails {
  phase: BiologicalPhaseName;
  title: string;
  subTitle: string;
  dayRangeText: string;
  currentDayInPhase: number;
  phaseDuration: number;
  progressPercent: number;
  energyLevel: 'Low (Restorative)' | 'Rising (High Stamina)' | 'Peak (High Vitality)' | 'Calm & Steady';
  insulinSensitivity: 'High (Optimal)' | 'Very High (Peak)' | 'Moderate' | 'Reduced (Higher Cravings)';
  hormones: PhaseHormoneState;
  bodyFeel: string;
  nutrition: {
    highlight: string;
    focusFoods: string[];
    avoidOrLimit: string[];
    pcosSpecific: string;
  };
  workout: {
    idealType: string;
    intensity: 'Gentle & Restorative' | 'Moderate to High' | 'Peak Intensity' | 'Moderate & Calming';
    suggestions: string[];
    pcosGuidance: string;
  };
  pcosSupport: {
    focus: string;
    supplements: string[];
    lifestyleTips: string[];
  };
  fertility: {
    conceptionChance: 'Peak' | 'High' | 'Medium' | 'Low';
    cervicalMucusExpectation: string;
    tip: string;
  };
}

export interface LatePeriodAnalysis {
  isDelayed: boolean;
  daysLate: number;
  currentCycleDay: number;
  likelyDueDate: Date;
  severity: 'Mild Delay (1-5 days)' | 'Moderate Delay (6-14 days)' | 'Significant Delay (15+ days)' | 'On Track';
  potentialCauses: string[];
  pcosExplanation: string;
  actionPlan: string[];
}

export interface HealthScoreResult {
  score: number | null;
  category: 'Excellent' | 'Good' | 'Moderate' | 'Needs Attention' | 'Insufficient Data';
  insights: string[];
  strengths: string[];
  areasToImprove: string[];
}

export class CycleIntelligenceEngine {
  cycles: CycleEntry[];
  checkIns: Record<string, CheckInEntry>;
  hasPCOS: boolean;

  constructor(cycles: CycleEntry[], checkIns: Record<string, CheckInEntry> = {}, hasPCOS: boolean = false) {
    this.cycles = [...cycles]
      .filter(c => !!c.startDate)
      .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
      .slice(0, 12);
    this.checkIns = checkIns;
    this.hasPCOS = hasPCOS;
  }

  /**
   * Calculates lengths between successive cycle start dates.
   * Filters out biologically impossible lengths (< 15 days or > 120 days).
   */
  getCycleLengths(): number[] {
    const lengths: number[] = [];
    for (let i = 0; i < this.cycles.length - 1; i++) {
      const currentStart = new Date(this.cycles[i].startDate);
      const prevStart = new Date(this.cycles[i + 1].startDate);
      const diff = differenceInDays(currentStart, prevStart);
      if (diff >= 18 && diff <= 120) {
        lengths.push(diff);
      }
    }
    return lengths;
  }

  /**
   * Calculates menstrual flow duration in days.
   */
  getPeriodDurations(): number[] {
    const durations: number[] = [];
    for (const c of this.cycles) {
      if (c.endDate) {
        const diff = differenceInDays(new Date(c.endDate), new Date(c.startDate)) + 1;
        if (diff >= 1 && diff <= 14) {
          durations.push(diff);
        }
      }
    }
    return durations.length > 0 ? durations : [5];
  }

  /**
   * Performs clinical and statistical analytics on user cycle history.
   */
  analyzeCycles(): CycleAnalytics {
    const lengths = this.getCycleLengths();
    const durations = this.getPeriodDurations();

    const defaultAvgCycle = this.hasPCOS ? 35 : 28;
    const defaultPeriodDuration = 5;

    if (lengths.length === 0) {
      const avgDuration = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : defaultPeriodDuration;
      return {
        avgCycleLength: defaultAvgCycle,
        avgPeriodDuration: avgDuration,
        variance: 0,
        stdDev: 0,
        consistencyScore: this.hasPCOS ? 60 : 80,
        regularityStatus: 'Insufficient Data',
        clinicalCategory: 'Needs More Data',
        trend: 'Unknown',
        totalCyclesLogged: this.cycles.length,
        shortestCycle: defaultAvgCycle,
        longestCycle: defaultAvgCycle,
      };
    }

    // Weighted average: Gives recent cycles slightly higher relevance
    let weightedSum = 0;
    let weightTotal = 0;
    lengths.forEach((len, idx) => {
      const weight = Math.max(1, lengths.length - idx);
      weightedSum += len * weight;
      weightTotal += weight;
    });
    const avgCycleLength = Math.round(weightedSum / weightTotal);
    const avgPeriodDuration = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);

    // Standard deviation and variance
    const variance = lengths.reduce((acc, val) => acc + Math.pow(val - avgCycleLength, 2), 0) / lengths.length;
    const stdDev = Math.round(Math.sqrt(variance) * 10) / 10;

    let consistencyScore = Math.max(20, Math.min(100, Math.round(100 - stdDev * 4.5)));
    if (this.hasPCOS) {
      // PCOS adjustments
      consistencyScore = Math.min(95, consistencyScore + 8);
    }

    let regularityStatus: CycleAnalytics['regularityStatus'] = 'Regular';
    if (stdDev > 8 || avgCycleLength > 38) {
      regularityStatus = 'Irregular (PCOS Pattern)';
    } else if (stdDev > 3.5) {
      regularityStatus = 'Moderate Variability';
    }

    let clinicalCategory: CycleAnalytics['clinicalCategory'] = 'Normal (21-35 days)';
    if (avgCycleLength < 21) {
      clinicalCategory = 'Short (<21 days)';
    } else if (avgCycleLength > 35) {
      clinicalCategory = 'Oligomenorrhea (>35 days)';
    }

    let trend: CycleAnalytics['trend'] = 'Stable';
    if (lengths.length >= 3) {
      const r = lengths.slice(0, 3);
      if (r[0] > r[1] + 2 && r[1] > r[2] + 2) trend = 'Increasing';
      else if (r[0] < r[1] - 2 && r[1] < r[2] - 2) trend = 'Decreasing';
    }

    return {
      avgCycleLength,
      avgPeriodDuration,
      variance: Math.round(variance),
      stdDev,
      consistencyScore,
      regularityStatus,
      clinicalCategory,
      trend,
      totalCyclesLogged: this.cycles.length,
      shortestCycle: Math.min(...lengths),
      longestCycle: Math.max(...lengths),
    };
  }

  /**
   * Predicts the upcoming period window with PCOS adaptive variance and symptom correlation.
   */
  predictNextPeriod(): PredictionResult | null {
    if (this.cycles.length === 0) return null;

    const analytics = this.analyzeCycles();
    const lastStart = new Date(this.cycles[0].startDate);
    const likelyDate = addDays(lastStart, analytics.avgCycleLength);

    // Adaptive forecast window based on individual cycle variance
    let windowDays = Math.max(2, Math.round(Math.sqrt(analytics.variance)));
    if (this.hasPCOS) {
      windowDays = Math.max(4, windowDays + 3);
    }

    const recentCheckIns = this.getRecentCheckIns(5);
    const hasPrePeriodSymptoms = recentCheckIns.some(
      c =>
        c.cramps === 'moderate' ||
        c.cramps === 'severe' ||
        c.bloating === 'moderate' ||
        c.bloating === 'severe'
    );

    let earliestDate = subDays(likelyDate, windowDays);
    let latestDate = addDays(likelyDate, windowDays);

    const today = new Date();
    if (hasPrePeriodSymptoms && today < earliestDate && differenceInDays(earliestDate, today) <= 4) {
      earliestDate = today;
    }

    let confidence = 95;
    if (this.cycles.length < 2) confidence -= 30;
    else if (this.cycles.length < 4) confidence -= 15;

    confidence -= Math.round(analytics.stdDev * 3);
    if (this.hasPCOS) confidence -= 10;

    confidence = Math.max(25, Math.min(98, confidence));

    let confidenceLabel: PredictionResult['confidenceLabel'] = 'Moderate';
    if (confidence >= 85) confidenceLabel = 'High';
    else if (confidence >= 70) confidenceLabel = 'Reliable';
    else if (confidence < 50) confidenceLabel = 'Low';

    const expectedPeriod = `${format(earliestDate, 'MMM d')} – ${format(latestDate, 'MMM d, yyyy')}`;

    let explanation = `Forecast calculated from your last ${this.cycles.length} logged cycle${this.cycles.length > 1 ? 's' : ''}`;
    if (this.hasPCOS) {
      explanation += ` with PCOS-adaptive variance calibration (±${windowDays} days)`;
    }
    if (hasPrePeriodSymptoms) {
      explanation += ` and recent PMS symptom logging`;
    }
    explanation += '.';

    return {
      earliestDate,
      likelyDate,
      latestDate,
      confidenceScore: confidence,
      confidenceLabel,
      isPCOSMode: this.hasPCOS,
      expectedPeriod,
      explanation,
    };
  }

  /**
   * Predicts ovulation day and the 6-day fertile window.
   * In human biology, the luteal phase averages ~14 days (12-16 days).
   * Therefore Ovulation = (Cycle Length - 14 days).
   */
  predictOvulationAndFertility(referenceDate: Date = new Date()): FertileWindowResult | null {
    if (this.cycles.length === 0) return null;

    const analytics = this.analyzeCycles();
    const lastStart = new Date(this.cycles[0].startDate);

    // Ovulation occurs approximately 14 days before the next expected period
    const ovulationDayOffset = Math.max(10, analytics.avgCycleLength - 14);
    const predictedOvulationDate = addDays(lastStart, ovulationDayOffset);

    // Fertile window: 5 days prior to ovulation + ovulation day + 1 day post
    const fertileWindowStart = subDays(predictedOvulationDate, 5);
    const fertileWindowEnd = addDays(predictedOvulationDate, 1);

    const isOvulationToday = isSameDay(referenceDate, predictedOvulationDate);
    const isFertileToday = isWithinInterval(referenceDate, {
      start: fertileWindowStart,
      end: fertileWindowEnd,
    });

    const diffToOvulation = differenceInDays(predictedOvulationDate, referenceDate);

    let pregnancyChanceToday: FertileWindowResult['pregnancyChanceToday'] = 'Low';
    if (isOvulationToday || diffToOvulation === 1 || diffToOvulation === 2) {
      pregnancyChanceToday = 'Peak';
    } else if (isFertileToday) {
      pregnancyChanceToday = 'High';
    } else if (diffToOvulation === -1 || diffToOvulation === 6) {
      pregnancyChanceToday = 'Medium';
    }

    let cervicalMucusGuide = 'Sticky or dry mucus. Low sperm motility.';
    if (pregnancyChanceToday === 'Peak') {
      cervicalMucusGuide = 'Clear, stretchy, egg-white consistency (EWCM). Optimal for sperm survival.';
    } else if (pregnancyChanceToday === 'High') {
      cervicalMucusGuide = 'Watery or creamy cervical fluid. Sperm-friendly.';
    }

    let fertilityMessage = '';
    if (isOvulationToday) {
      fertilityMessage = '🌟 Today is your predicted Ovulation Day! Peak fertility for conception.';
    } else if (isFertileToday) {
      fertilityMessage = `✨ You are currently inside your fertile window (~${Math.max(0, diffToOvulation)}d until ovulation).`;
    } else if (diffToOvulation > 0) {
      fertilityMessage = `Fertile window expected in ${diffToOvulation - 5 > 0 ? diffToOvulation - 5 : 1} days.`;
    } else {
      fertilityMessage = 'Post-ovulatory luteal phase. Low probability of conception.';
    }

    return {
      predictedOvulationDate,
      fertileWindowStart,
      fertileWindowEnd,
      pregnancyChanceToday,
      isOvulationToday,
      isFertileToday,
      ovulationCountdownDays: diffToOvulation,
      cervicalMucusGuide,
      fertilityMessage,
    };
  }

  /**
   * Clinical 4-Phase Biological Engine.
   * Returns exact hormonal, nutritional, workout, and PCOS recommendations for today.
   */
  getCurrentPhaseDetails(currentCycleDay: number): PhaseDetails {
    const analytics = this.analyzeCycles();
    const cycleLen = analytics.avgCycleLength;
    const periodDur = analytics.avgPeriodDuration;

    const ovulationDay = Math.max(10, cycleLen - 14);
    const follicularEndDay = Math.max(periodDur + 1, ovulationDay - 3);
    const ovulatoryEndDay = Math.min(cycleLen - 1, ovulationDay + 2);

    let phase: BiologicalPhaseName = 'Follicular';
    let title = 'Follicular Phase';
    let subTitle = 'Rising Energy & Cognitive Clarity';
    let dayRangeText = `Days ${periodDur + 1} – ${follicularEndDay}`;
    let currentDayInPhase = 1;
    let phaseDuration = Math.max(1, follicularEndDay - periodDur);
    let energyLevel: PhaseDetails['energyLevel'] = 'Rising (High Stamina)';
    let insulinSensitivity: PhaseDetails['insulinSensitivity'] = 'Very High (Peak)';
    let hormones: PhaseHormoneState = {
      estrogen: 'Rising',
      progesterone: 'Low',
      fshLh: 'Active',
      testosterone: 'Moderate',
    };
    let bodyFeel =
      'As estrogen progressively rises, brain fog lifts, metabolism runs efficiently, and physical stamina climbs.';

    let nutrition: PhaseDetails['nutrition'] = {
      highlight: 'High-protein meals, sprouted greens & fermented foods to support developing follicles.',
      focusFoods: ['Salmon & wild fish', 'Broccoli & cruciferous vegetables', 'Kimchi / Sauerkraut', 'Quinoa', 'Avocado'],
      avoidOrLimit: ['Refined white sugars', 'Ultra-processed seed oils', 'Excessive caffeine'],
      pcosSpecific: 'Optimal phase for carbohydrate tolerance. Pair complex carbs with protein to keep insulin flat.',
    };

    let workout: PhaseDetails['workout'] = {
      idealType: 'Progressive Resistance & Strength Training',
      intensity: 'Moderate to High',
      suggestions: ['Barbell/Dumbbell lifts', 'Running / Cardio intervals', 'Vinyasa flow yoga'],
      pcosGuidance: 'High insulin sensitivity makes this the best window for building lean muscle mass.',
    };

    let pcosSupport: PhaseDetails['pcosSupport'] = {
      focus: 'Follicular maturation & estrogen metabolism',
      supplements: ['Myo-Inositol (40:1 ratio)', 'Vitamin D3 + K2', 'CoQ10', 'B-Complex'],
      lifestyleTips: ['Morning sunlight exposure for circadian rhythm', 'Prioritize 8 hours of sleep for FSH signaling'],
    };

    let fertility: PhaseDetails['fertility'] = {
      conceptionChance: 'Medium',
      cervicalMucusExpectation: 'Transitioning from creamy to watery.',
      tip: 'Egg follicles are maturing. Keep stress low to avoid delayed ovulation.',
    };

    // 1. Menstrual Phase
    if (currentCycleDay <= periodDur) {
      phase = 'Menstrual';
      title = 'Menstrual Phase';
      subTitle = 'Rest, Renewal & Hormone Reset';
      dayRangeText = `Days 1 – ${periodDur}`;
      currentDayInPhase = currentCycleDay;
      phaseDuration = periodDur;
      energyLevel = 'Low (Restorative)';
      insulinSensitivity = 'High (Optimal)';
      hormones = {
        estrogen: 'Low',
        progesterone: 'Low',
        fshLh: 'Low',
        testosterone: 'Low',
      };
      bodyFeel =
        'Hormone levels are at baseline. The uterine lining is shedding. You may experience lower physical energy, cramping, or fatigue.';
      nutrition = {
        highlight: 'Iron-replenishing, anti-inflammatory & warming foods to soothe uterine muscles.',
        focusFoods: ['Warm bone broths / lentil soups', 'Spinach & dark leafy greens', 'Beetroot', 'Ginger tea', 'Dark chocolate (85%)'],
        avoidOrLimit: ['Iced drinks & cold salads', 'High sodium (worsens bloating)', 'Excess alcohol'],
        pcosSpecific: 'Drink warm spearmint & ginger tea to relieve pelvic inflammation and support androgen detox.',
      };
      workout = {
        idealType: 'Gentle Restorative Movement',
        intensity: 'Gentle & Restorative',
        suggestions: ['Slow mindful walking', 'Gentle Yin yoga', 'Pelvic floor stretching'],
        pcosGuidance: 'Avoid strenuous HIIT workouts right now to prevent unnecessary cortisol spikes.',
      };
      pcosSupport = {
        focus: 'Cramp relief, iron restoration & pelvic comfort',
        supplements: ['Magnesium Bisglycinate (300mg)', 'Iron + Vitamin C', 'Omega-3 Fish Oil', 'Turmeric/Curcumin'],
        lifestyleTips: ['Use a warm heating pad', 'Stay hydrated with warm water & electrolytes'],
      };
      fertility = {
        conceptionChance: 'Low',
        cervicalMucusExpectation: 'Menstrual flow present.',
        tip: 'Focus on rest and cellular recovery.',
      };
    }
    // 2. Ovulatory Phase
    else if (currentCycleDay > follicularEndDay && currentCycleDay <= ovulatoryEndDay) {
      phase = 'Ovulatory';
      title = 'Ovulatory Phase';
      subTitle = 'Peak Fertility, Confidence & Vitality';
      dayRangeText = `Days ${follicularEndDay + 1} – ${ovulatoryEndDay}`;
      currentDayInPhase = Math.max(1, currentCycleDay - follicularEndDay);
      phaseDuration = Math.max(1, ovulatoryEndDay - follicularEndDay);
      energyLevel = 'Peak (High Vitality)';
      insulinSensitivity = 'Very High (Peak)';
      hormones = {
        estrogen: 'Peak',
        progesterone: 'Low',
        fshLh: 'LH Surge',
        testosterone: 'Slight Peak',
      };
      bodyFeel =
        'Estrogen peaks and LH surges to release an egg. Social confidence, libido, verbal articulation, and endurance reach their zenith.';
      nutrition = {
        highlight: 'Antioxidant-dense, fiber-rich foods to assist the liver in filtering peak estrogen.',
        focusFoods: ['Berries (blueberries, raspberries)', 'Asparagus', 'Flaxseeds & chia seeds', 'Wild caught salmon', 'Citrus fruits'],
        avoidOrLimit: ['Heavy fried foods', 'Excess refined sugars'],
        pcosSpecific: 'Cruciferous veggies (broccoli sprouts) contain DIM, which aids healthy estrogen metabolism.',
      };
      workout = {
        idealType: 'Peak Intensity / Strength & HIIT',
        intensity: 'Peak Intensity',
        suggestions: ['High-Intensity Interval Training (HIIT)', 'Personal record strength lifts', 'Fast-paced running/cycling'],
        pcosGuidance: 'Your joint laxity is slightly higher due to peak estrogen—focus on good lifting form.',
      };
      pcosSupport = {
        focus: 'Promoting clean ovulation and balanced LH signaling',
        supplements: ['Myo-Inositol', 'Zinc Picolinate', 'Selenium', 'NAC (N-Acetyl Cysteine)'],
        lifestyleTips: ['Track basal body temperature (BBT) & LH surge strips if planning conception'],
      };
      fertility = {
        conceptionChance: 'Peak',
        cervicalMucusExpectation: 'Stretchy, transparent, raw egg-white consistency (EWCM).',
        tip: 'Prime 48-hour conception window. Sperm can survive up to 5 days in fertile fluid.',
      };
    }
    // 3. Luteal Phase
    else if (currentCycleDay > ovulatoryEndDay) {
      phase = 'Luteal';
      title = 'Luteal Phase';
      subTitle = 'Progesterone Elevation & Mindful Calming';
      dayRangeText = `Days ${ovulatoryEndDay + 1} – ${cycleLen}`;
      currentDayInPhase = Math.max(1, currentCycleDay - ovulatoryEndDay);
      phaseDuration = Math.max(1, cycleLen - ovulatoryEndDay);
      energyLevel = 'Calm & Steady';
      insulinSensitivity = 'Reduced (Higher Cravings)';
      hormones = {
        estrogen: 'Moderate',
        progesterone: 'High (Dominant)',
        fshLh: 'Low',
        testosterone: 'Low',
      };
      bodyFeel =
        'Progesterone warms basal body temperature and slows digestion. Insulin sensitivity drops slightly, causing carb cravings and PMS.';
      nutrition = {
        highlight: 'Complex slow-burning carbs, magnesium & vitamin B6 to naturally soothe PMS and cravings.',
        focusFoods: ['Sweet potatoes & roasted squash', 'Pumpkin & sunflower seeds', 'Brown rice / Oats', 'Dark chocolate', 'Bananas'],
        avoidOrLimit: ['Excess caffeine (exacerbates breast tenderness)', 'High refined sodium', 'Sugary snacks on an empty stomach'],
        pcosSpecific: 'Always buffer carbohydrates with protein & healthy fats to avoid reactive hypoglycemia spikes.',
      };
      workout = {
        idealType: 'Pilates, Incline Walking & Moderate Resistance',
        intensity: 'Moderate & Calming',
        suggestions: ['Mat or Reformer Pilates', 'Incline treadmill / nature walks', 'Moderate tempo strength training'],
        pcosGuidance: 'High-intensity workouts during late luteal can over-elevate cortisol and worsen sleep quality.',
      };
      pcosSupport = {
        focus: 'Progesterone support, blood sugar balance & mood stabilization',
        supplements: ['Magnesium Glycinate (nighttime)', 'Vitamin B6 (P-5-P)', 'L-Theanine / Ashwagandha', 'Spearmint Tea'],
        lifestyleTips: ['Wind down screen time 1 hour before bed', 'Prioritize stress reduction and journaling'],
      };
      fertility = {
        conceptionChance: 'Low',
        cervicalMucusExpectation: 'Drying up, thick or cloudy.',
        tip: 'Progesterone is maintaining the endometrial lining for potential implantation.',
      };
    }

    const progressPercent = Math.min(100, Math.round((currentDayInPhase / phaseDuration) * 100));

    return {
      phase,
      title,
      subTitle,
      dayRangeText,
      currentDayInPhase,
      phaseDuration,
      progressPercent,
      energyLevel,
      insulinSensitivity,
      hormones,
      bodyFeel,
      nutrition,
      workout,
      pcosSupport,
      fertility,
    };
  }

  /**
   * Diagnostic analyzer for Late / Delayed Periods.
   * Provides empathetic, clinically backed guidance without breaking UI.
   */
  getLatePeriodAnalysis(currentCycleDay: number): LatePeriodAnalysis {
    const analytics = this.analyzeCycles();
    const cycleLen = analytics.avgCycleLength;
    const isDelayed = currentCycleDay > cycleLen;
    const daysLate = isDelayed ? currentCycleDay - cycleLen : 0;
    const lastStart = this.cycles.length > 0 ? new Date(this.cycles[0].startDate) : new Date();
    const likelyDueDate = addDays(lastStart, cycleLen);

    let severity: LatePeriodAnalysis['severity'] = 'On Track';
    if (daysLate >= 15) severity = 'Significant Delay (15+ days)';
    else if (daysLate >= 6) severity = 'Moderate Delay (6-14 days)';
    else if (daysLate >= 1) severity = 'Mild Delay (1-5 days)';

    const potentialCauses = [
      'Elevated Stress / Cortisol (suppresses GnRH and delays ovulation)',
      'Delayed or Anovulatory Cycle (hallmark of PCOS / hormonal variance)',
      'Sleep Disruption, Travel, or Circadian rhythm shifts',
      'Recent illness, medication, or sudden caloric restriction',
      'Early Pregnancy (if sexually active during the fertile window)',
    ];

    let pcosExplanation =
      'In PCOS, elevated androgens or insulin resistance can delay the LH surge needed for egg release. This extends the follicular phase, causing the period to arrive later than average.';
    if (!this.hasPCOS) {
      pcosExplanation =
        'Even in regular cycles, occasional delayed ovulation occurs naturally 1–2 times a year due to acute stress, lifestyle changes, or sleep deficit.';
    }

    const actionPlan = [
      'Take a home pregnancy test if you were sexually active during your fertile window.',
      'Prioritize restorative sleep (8+ hours) and gentle walking to lower cortisol levels.',
      'Maintain steady blood sugar with protein, fiber, and warm herbal teas (spearmint/chamomile).',
      daysLate >= 14
        ? 'Since your period is over 2 weeks late, consider consulting your OB-GYN or endocrinologist for a hormonal evaluation.'
        : 'Continue logging daily symptoms—your body may be gearing up for a delayed cycle.',
    ];

    return {
      isDelayed,
      daysLate,
      currentCycleDay,
      likelyDueDate,
      severity,
      potentialCauses,
      pcosExplanation,
      actionPlan,
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

  /**
   * Calculates a holistic hormonal and lifestyle health score out of 100.
   */
  calculateHealthScore(): HealthScoreResult {
    const analytics = this.analyzeCycles();
    const recentLogs = this.getRecentCheckIns(30);

    if (this.cycles.length === 0 && recentLogs.length < 3) {
      return {
        score: null,
        category: 'Insufficient Data',
        insights: ['Log your periods and daily habits to unlock your personalized Hormonal Health Index.'],
        strengths: [],
        areasToImprove: ['Complete daily check-ins for sleep, hydration, and mood.'],
      };
    }

    let score = 95;
    const insights: string[] = [];
    const strengths: string[] = [];
    const areasToImprove: string[] = [];

    // Cycle Regularity Component (30% weight)
    if (analytics.regularityStatus === 'Irregular (PCOS Pattern)') {
      score -= 15;
      insights.push('Cycle variability detected. Targeted insulin and cortisol balancing can help stabilize ovulation.');
      areasToImprove.push('Focus on consistent sleep times and low-GI nutrition to support cycle regularity.');
    } else if (analytics.regularityStatus === 'Regular') {
      strengths.push('Consistent cycle regularity indicates steady ovarian and pituitary signaling.');
    }

    // Daily Habit Analysis (70% weight)
    if (recentLogs.length >= 3) {
      const avgSleep = recentLogs.reduce((a, b) => a + (b.sleep || 7), 0) / recentLogs.length;
      const avgStress = recentLogs.reduce((a, b) => a + (b.stress || 4), 0) / recentLogs.length;
      const avgWater = recentLogs.reduce((a, b) => a + (b.water || 1.8), 0) / recentLogs.length;
      const avgExercise = recentLogs.reduce((a, b) => a + (b.exercise || 20), 0) / recentLogs.length;

      if (avgSleep >= 7.5) {
        strengths.push('Excellent sleep hygiene supports optimal nighttime LH and growth hormone release.');
      } else if (avgSleep < 6.5) {
        score -= 10;
        areasToImprove.push('Aim for 7.5+ hours of sleep. Chronic sleep debt impairs insulin sensitivity.');
      }

      if (avgStress <= 4) {
        strengths.push('Low stress baseline promotes healthy progesterone production in the luteal phase.');
      } else if (avgStress >= 7) {
        score -= 12;
        areasToImprove.push('High stress detected. Consider 5 minutes of breathwork to avoid cortisol-induced ovulation delays.');
      }

      if (avgWater >= 2.0) {
        strengths.push('Great hydration habits aid estrogen detoxification and reduce PMS bloating.');
      } else if (avgWater < 1.5) {
        score -= 6;
        areasToImprove.push('Increase daily water intake to 2.0L - 2.5L to support cervical fluid and reduce cramps.');
      }

      if (avgExercise >= 25) {
        strengths.push('Regular physical activity improves cellular insulin sensitivity.');
      }
    }

    score = Math.max(20, Math.min(100, Math.round(score)));

    let category: HealthScoreResult['category'] = 'Excellent';
    if (score < 60) category = 'Needs Attention';
    else if (score < 75) category = 'Moderate';
    else if (score < 90) category = 'Good';

    if (insights.length === 0) {
      insights.push('Your cycle markers and daily habits reflect strong hormonal harmony.');
    }

    return { score, category, insights, strengths, areasToImprove };
  }
}
