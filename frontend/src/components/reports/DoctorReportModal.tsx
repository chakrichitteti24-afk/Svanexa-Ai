'use client';

import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Printer,
  Download,
  X,
  CalendarHeart,
  Activity,
  Droplets,
  Moon,
  AlertCircle,
  ShieldCheck,
  Stethoscope,
  Heart,
  Clock,
  Sparkles,
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';

interface DoctorReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  userName: string;
  userMode: 'general' | 'pcos' | 'pregnancy';
  dob?: string;
  dailyLogs: any[];
  cycleLogs: any[];
  skinLogs: any[];
}

export function DoctorReportModal({
  isOpen,
  onClose,
  userName,
  userMode,
  dob,
  dailyLogs = [],
  cycleLogs = [],
  skinLogs = [],
}: DoctorReportModalProps) {
  const reportRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const todayStr = format(new Date(), 'MMMM d, yyyy');

  // Compute Cycle Metrics
  const validCycles = Array.isArray(cycleLogs) ? cycleLogs : [];
  const cycleLengths: number[] = [];
  for (let i = 0; i < validCycles.length - 1; i++) {
    const diff = differenceInDays(
      new Date(validCycles[i].start_date),
      new Date(validCycles[i + 1].start_date)
    );
    if (diff >= 15 && diff <= 120) {
      cycleLengths.push(diff);
    }
  }

  const avgCycleLength =
    cycleLengths.length > 0
      ? Math.round(cycleLengths.reduce((a, b) => a + b, 0) / cycleLengths.length)
      : null;

  const cycleVariance =
    cycleLengths.length > 1
      ? Math.round(
          Math.sqrt(
            cycleLengths.reduce((acc, val) => acc + Math.pow(val - (avgCycleLength || 28), 2), 0) /
              cycleLengths.length
          )
        )
      : 0;

  const regularityStatus =
    cycleVariance <= 3
      ? 'Regular (Low Variance)'
      : cycleVariance <= 7
      ? 'Moderate Variance'
      : 'Irregular (High Variance / PCOS Pattern)';

  // Compute Daily Vitals Averages
  const totalDays = dailyLogs.length;
  const avgSleep =
    totalDays > 0
      ? (dailyLogs.reduce((acc, curr) => acc + Number(curr.sleep || 0), 0) / totalDays).toFixed(1)
      : '0.0';
  const avgWater =
    totalDays > 0
      ? (dailyLogs.reduce((acc, curr) => acc + Number(curr.water || 0), 0) / totalDays).toFixed(1)
      : '0.0';
  const avgStress =
    totalDays > 0
      ? (dailyLogs.reduce((acc, curr) => acc + Number(curr.stress || 0), 0) / totalDays).toFixed(1)
      : '0.0';

  // Compute Symptom Frequencies from cycle logs & daily logs
  const symptomCounts: Record<string, number> = {};
  validCycles.forEach(c => {
    if (Array.isArray(c.symptoms)) {
      c.symptoms.forEach((s: string) => {
        symptomCounts[s] = (symptomCounts[s] || 0) + 1;
      });
    }
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm overflow-y-auto print:p-0 print:bg-white print:static">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          className="w-full max-w-4xl bg-card border border-border/60 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] print:max-h-none print:border-none print:shadow-none print:bg-white print:text-black print:rounded-none"
        >
          {/* Top Bar (Hidden on Print) */}
          <div className="p-4 sm:p-5 border-b border-border/40 bg-secondary/30 flex items-center justify-between print:hidden">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-pink-500/10 border border-pink-500/20 text-pink-400">
                <Stethoscope className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">Doctor-Ready Clinical Summary</h2>
                <p className="text-xs text-muted-foreground">
                  Ready to print or export as PDF for your gynecologist or endocrinologist
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrint}
                className="px-4 py-2 rounded-full bg-gradient-to-r from-pink-500 to-violet-500 hover:opacity-95 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-pink-500/20 transition-all active:scale-95 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print / Save PDF</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-full hover:bg-secondary/60 text-muted-foreground transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Report Body (Printable Area) */}
          <div
            ref={reportRef}
            className="p-6 sm:p-10 overflow-y-auto space-y-8 print:p-0 print:space-y-6 print:text-black"
          >
            {/* Header / Hospital Grade Title */}
            <div className="border-b-2 border-border/60 pb-6 print:border-gray-300">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-extrabold uppercase tracking-widest text-pink-400 print:text-pink-600">
                      Svanexa AI Medical Health Record
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-secondary/50 text-foreground print:bg-gray-100 print:text-black border border-border/40">
                      Confidential
                    </span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground print:text-black tracking-tight">
                    Comprehensive Health & Cycle Summary
                  </h1>
                </div>

                <div className="text-left sm:text-right text-xs text-muted-foreground print:text-gray-600 space-y-0.5">
                  <p className="font-semibold text-foreground print:text-black">
                    Date Generated: {todayStr}
                  </p>
                  <p>Observation Window: Last 90 Days</p>
                  <p>System: Svanexa Clinical Intelligence v2.4</p>
                </div>
              </div>

              {/* Patient Demographics Card */}
              <div className="mt-6 p-4 rounded-2xl bg-secondary/20 border border-border/30 print:bg-gray-50 print:border-gray-200 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-muted-foreground print:text-gray-500 block text-[11px]">
                    Patient Name
                  </span>
                  <span className="font-bold text-foreground print:text-black text-sm capitalize">
                    {userName || 'User'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground print:text-gray-500 block text-[11px]">
                    Clinical Focus
                  </span>
                  <span className="font-bold text-foreground print:text-black text-sm uppercase">
                    {userMode === 'pcos' ? 'PCOS / PCOD Management' : userMode === 'pregnancy' ? 'Prenatal Care' : 'General Wellness'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground print:text-gray-500 block text-[11px]">
                    Date of Birth
                  </span>
                  <span className="font-bold text-foreground print:text-black text-sm">
                    {dob || 'Not specified'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground print:text-gray-500 block text-[11px]">
                    Total Health Logs
                  </span>
                  <span className="font-bold text-pink-400 print:text-pink-600 text-sm">
                    {totalDays} Check-Ins Recorded
                  </span>
                </div>
              </div>
            </div>

            {/* 1. Menstrual & Endocrine Cycle Assessment */}
            <div className="space-y-3">
              <h3 className="text-base font-bold text-foreground print:text-black flex items-center gap-2">
                <CalendarHeart className="w-4 h-4 text-pink-400 print:text-pink-600" />
                1. Menstrual & Ovulatory Biomarkers
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl bg-secondary/15 border border-border/20 print:bg-gray-50 print:border-gray-200 space-y-1">
                  <p className="text-[11px] text-muted-foreground print:text-gray-500 font-medium">
                    Average Cycle Length
                  </p>
                  <p className="text-2xl font-bold text-foreground print:text-black">
                    {avgCycleLength ? `${avgCycleLength} Days` : 'Insufficient Data'}
                  </p>
                  <p className="text-[10px] text-muted-foreground print:text-gray-500">
                    Clinical Normal: 21–35 days
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-secondary/15 border border-border/20 print:bg-gray-50 print:border-gray-200 space-y-1">
                  <p className="text-[11px] text-muted-foreground print:text-gray-500 font-medium">
                    Cycle Regularity Status
                  </p>
                  <p className="text-base font-bold text-foreground print:text-black truncate">
                    {regularityStatus}
                  </p>
                  <p className="text-[10px] text-muted-foreground print:text-gray-500">
                    Standard deviation: ±{cycleVariance} days
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-secondary/15 border border-border/20 print:bg-gray-50 print:border-gray-200 space-y-1">
                  <p className="text-[11px] text-muted-foreground print:text-gray-500 font-medium">
                    Cycles Tracked
                  </p>
                  <p className="text-2xl font-bold text-pink-400 print:text-pink-600">
                    {validCycles.length}
                  </p>
                  <p className="text-[10px] text-muted-foreground print:text-gray-500">
                    Last recorded: {validCycles[0]?.start_date || 'N/A'}
                  </p>
                </div>
              </div>

              {/* Cycle Log Table */}
              {validCycles.length > 0 && (
                <div className="overflow-x-auto border border-border/30 rounded-2xl print:border-gray-200">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-secondary/40 print:bg-gray-100 text-muted-foreground print:text-gray-600 uppercase text-[10px]">
                      <tr>
                        <th className="p-3">Period Start Date</th>
                        <th className="p-3">Period End Date</th>
                        <th className="p-3">Flow Intensity</th>
                        <th className="p-3">Logged Symptoms</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/20 print:divide-gray-200">
                      {validCycles.slice(0, 5).map((c, i) => (
                        <tr key={i} className="hover:bg-secondary/10">
                          <td className="p-3 font-semibold text-foreground print:text-black">
                            {c.start_date}
                          </td>
                          <td className="p-3 text-muted-foreground print:text-gray-600">
                            {c.end_date || c.start_date}
                          </td>
                          <td className="p-3 capitalize text-pink-400 print:text-pink-600 font-medium">
                            {c.flow_intensity || 'Moderate'}
                          </td>
                          <td className="p-3 text-muted-foreground print:text-gray-600">
                            {Array.isArray(c.symptoms) && c.symptoms.length > 0
                              ? c.symptoms.join(', ')
                              : 'None reported'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* 2. Vitals & Lifestyle Baselines */}
            <div className="space-y-3">
              <h3 className="text-base font-bold text-foreground print:text-black flex items-center gap-2">
                <Activity className="w-4 h-4 text-violet-400 print:text-violet-600" />
                2. Lifestyle & Vitals Consistency
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3.5 rounded-2xl bg-secondary/15 border border-border/20 print:bg-gray-50 print:border-gray-200">
                  <span className="text-[11px] text-muted-foreground print:text-gray-500 block">
                    Avg Sleep
                  </span>
                  <span className="text-xl font-bold text-foreground print:text-black">
                    {avgSleep}h / night
                  </span>
                </div>
                <div className="p-3.5 rounded-2xl bg-secondary/15 border border-border/20 print:bg-gray-50 print:border-gray-200">
                  <span className="text-[11px] text-muted-foreground print:text-gray-500 block">
                    Avg Daily Water
                  </span>
                  <span className="text-xl font-bold text-foreground print:text-black">
                    {avgWater} Liters
                  </span>
                </div>
                <div className="p-3.5 rounded-2xl bg-secondary/15 border border-border/20 print:bg-gray-50 print:border-gray-200">
                  <span className="text-[11px] text-muted-foreground print:text-gray-500 block">
                    Stress Score Avg
                  </span>
                  <span className="text-xl font-bold text-foreground print:text-black">
                    {avgStress} / 10
                  </span>
                </div>
                <div className="p-3.5 rounded-2xl bg-secondary/15 border border-border/20 print:bg-gray-50 print:border-gray-200">
                  <span className="text-[11px] text-muted-foreground print:text-gray-500 block">
                    Skin Logs
                  </span>
                  <span className="text-xl font-bold text-foreground print:text-black">
                    {skinLogs.length} Entries
                  </span>
                </div>
              </div>
            </div>

            {/* 3. Clinical Observation & Physician Notes Section */}
            <div className="space-y-3 pt-2">
              <h3 className="text-base font-bold text-foreground print:text-black flex items-center gap-2">
                <Stethoscope className="w-4 h-4 text-emerald-400 print:text-emerald-600" />
                3. Physician Notes & Recommendations
              </h3>

              <div className="p-5 rounded-2xl border-2 border-dashed border-border/50 print:border-gray-300 min-h-[120px] text-xs text-muted-foreground print:text-gray-400">
                <p className="italic">
                  Physician observations, diagnostic blood work orders, or medication adjustments:
                </p>
              </div>
            </div>

            {/* Footer Disclaimer */}
            <div className="pt-6 border-t border-border/30 print:border-gray-200 flex flex-col sm:flex-row items-center justify-between text-[10px] text-muted-foreground print:text-gray-500 gap-2">
              <p>Generated by Svanexa AI — Endocrine & Menstrual Wellness Intelligence</p>
              <p>For clinical decision support only. Not a standalone diagnostic substitute.</p>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
