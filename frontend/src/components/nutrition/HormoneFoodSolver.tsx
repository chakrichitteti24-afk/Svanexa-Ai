'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Utensils,
  Sparkles,
  Clock,
  CheckCircle2,
  ChevronRight,
  Flame,
  Droplets,
  Heart,
  Zap,
  Coffee,
  X,
} from 'lucide-react';

export type CravingCategory =
  | 'sugar'
  | 'energy'
  | 'cramps'
  | 'bloating'
  | 'pcos_glucose';

interface FoodItem {
  id: string;
  category: CravingCategory;
  title: string;
  emoji: string;
  prepTime: string;
  cravingMatch: string;
  hormoneBenefit: string;
  ingredients: string[];
  instructions: string;
  clinicalWhy: string;
  caloriesApprox?: string;
}

const HORMONE_FOODS: FoodItem[] = [
  // Sugar & Sweet Cravings
  {
    id: 'sweet-1',
    category: 'sugar',
    title: 'Cinnamon Dark Chocolate Chia Bowl',
    emoji: '🍫',
    prepTime: '3 Mins',
    cravingMatch: 'Milk chocolate, cookies, or sugary pastry',
    hormoneBenefit: 'Crushes sweet cravings + Prevents insulin spike',
    ingredients: [
      '2 tbsp Chia seeds',
      '1/2 cup Unsweetened almond or coconut milk',
      '1 tbsp Raw 85%+ dark cacao powder',
      '1/2 tsp Ceylon cinnamon',
      '1 tsp Pure maple syrup or stevia',
    ],
    instructions: 'Whisk all ingredients in a bowl or small glass. Let sit for 3–5 minutes to thicken into a rich pudding.',
    clinicalWhy: 'Ceylon cinnamon mimics insulin to stabilize blood glucose curves, while magnesium in raw cacao calms uterine spasms and curbs dopaminergic cravings.',
    caloriesApprox: '~140 kcal',
  },
  {
    id: 'sweet-2',
    category: 'sugar',
    title: 'Apple Slices with Sea Salt Almond Butter',
    emoji: '🍎',
    prepTime: '2 Mins',
    cravingMatch: 'Candy, gummy sweets, or caramel',
    hormoneBenefit: 'Slow-release fructose with healthy fats',
    ingredients: [
      '1 Crisp green or honeycrisp apple (sliced)',
      '1.5 tbsp Creamy unsalted almond butter',
      'Pinch of flaky sea salt',
      '1 tsp Hemp hearts or flax seeds (optional)',
    ],
    instructions: 'Slice the apple and spread rich almond butter over slices. Sprinkle with sea salt and hemp hearts.',
    clinicalWhy: 'Pectin fiber in apples pairs with mono-unsaturated fats in almonds to slow glucose absorption by over 40%, preventing rebound hypoglycemia.',
    caloriesApprox: '~185 kcal',
  },

  // Energy & Brain-Fog
  {
    id: 'energy-1',
    category: 'energy',
    title: 'Avocado Wild Salmon Sourdough Crunch',
    emoji: '🥑',
    prepTime: '4 Mins',
    cravingMatch: 'Afternoon 3 PM slump, brain fog, fatigue',
    hormoneBenefit: 'Omega-3 neuro-protection & sustained ATP energy',
    ingredients: [
      '1 slice Toasted sourdough or sprouted rye bread',
      '1/2 Ripe avocado (mashed with lemon juice)',
      '2 oz Smoked wild salmon or 1 soft-boiled egg',
      'Pinch of red pepper flakes and black sesame seeds',
    ],
    instructions: 'Toast bread to golden crispness. Spread creamy avocado, layer smoked salmon on top, and season with lemon and seeds.',
    clinicalWhy: 'Wild salmon DHA/EPA fatty acids cross the blood-brain barrier to reduce micro-glial neuro-inflammation, clearing luteal brain fog quickly.',
    caloriesApprox: '~230 kcal',
  },
  {
    id: 'energy-2',
    category: 'energy',
    title: 'Iced Cinnamon Maca Matcha Latte',
    emoji: '🍵',
    prepTime: '2 Mins',
    cravingMatch: 'Heavy sugary coffee or energy drinks',
    hormoneBenefit: 'L-theanine focused calm without cortisol surge',
    ingredients: [
      '1 tsp Ceremonial grade matcha powder',
      '1/2 tsp Organic Maca root powder',
      '3/4 cup Oat milk or cashew milk',
      '1/4 tsp Ground cinnamon',
      'Ice cubes',
    ],
    instructions: 'Froth matcha and maca with 2 oz warm water until smooth. Pour over ice and cold plant milk. Dust with cinnamon.',
    clinicalWhy: 'L-theanine in matcha stimulates alpha brain waves for calm mental clarity while Maca supports adrenal balance without spiking cortisol.',
    caloriesApprox: '~65 kcal',
  },

  // Cramps & PMS Aches
  {
    id: 'cramps-1',
    category: 'cramps',
    title: 'Golden Ginger Turmeric Anti-Cramp Elixir',
    emoji: '🫚',
    prepTime: '3 Mins',
    cravingMatch: 'Menstrual pelvic cramps, lower back pain',
    hormoneBenefit: 'Natural COX-2 inhibitor & muscle relaxant',
    ingredients: [
      '1 cup Warm unsweetened almond or oat milk',
      '1/2 tsp Ground turmeric + pinch of black pepper',
      '1/2 tsp Fresh grated ginger or ground ginger',
      '1/4 tsp Cardamom',
      '1 tsp Raw honey (optional)',
    ],
    instructions: 'Whisk spices into steaming warm milk until golden and frothy. Sip slowly while applying gentle abdominal warmth.',
    clinicalWhy: 'Gingerol and curcumin act as potent natural anti-inflammatories by inhibiting pro-inflammatory prostaglandins ($PGE_2$) responsible for uterine contractions.',
    caloriesApprox: '~50 kcal',
  },
  {
    id: 'cramps-2',
    category: 'cramps',
    title: 'Warm Salted Edamame with Sesame',
    emoji: '🫛',
    prepTime: '4 Mins',
    cravingMatch: 'Salty snacks, potato chips, fast food',
    hormoneBenefit: 'Plant isoflavones + Muscle-relaxing Magnesium',
    ingredients: [
      '1 cup Steamed organic edamame pods',
      '1/2 tsp Coarse pink Himalayan sea salt',
      '1/2 tsp Toasted sesame oil & sesame seeds',
    ],
    instructions: 'Microwave or steam frozen edamame pods for 3 minutes. Toss with sesame oil and coarse sea salt.',
    clinicalWhy: 'Delivers 18g of clean plant protein and 100mg of magnesium to alleviate menstrual muscle spasms while satisfying salty cravings.',
    caloriesApprox: '~150 kcal',
  },

  // Bloating & Water Retention
  {
    id: 'bloating-1',
    category: 'bloating',
    title: 'Spearmint Cucumber Hormone Hydration',
    emoji: '🥒',
    prepTime: '2 Mins',
    cravingMatch: 'Heavy water retention, puffiness, soda cravings',
    hormoneBenefit: 'Anti-androgen & natural potassium fluid flush',
    ingredients: [
      '1 cup Brewed spearmint tea (chilled or warm)',
      '1/2 cup Cucumber ribbons or thin slices',
      'Fresh mint leaves',
      'Squeeze of fresh lime juice',
    ],
    instructions: 'Steep spearmint tea, pour over fresh cucumber ribbons and ice. Squeeze lime for a zesty, crisp digestive tonic.',
    clinicalWhy: 'Spearmint is clinically documented to reduce free testosterone in women with PCOS, while cucumber’s caffeic acid flushes interstitial sodium bloat.',
    caloriesApprox: '~10 kcal',
  },

  // PCOS Blood Sugar & Hormonal Balance
  {
    id: 'pcos-1',
    category: 'pcos_glucose',
    title: 'Berry Inositol Protein Power Smoothie',
    emoji: '🫐',
    prepTime: '3 Mins',
    cravingMatch: 'Milkshakes, sweet breakfast, post-workout refuel',
    hormoneBenefit: 'Insulin receptor sensitization & ovarian support',
    ingredients: [
      '1 scoop Clean plant or grass-fed whey protein (20g+)',
      '1/2 cup Wild frozen blueberries or raspberries',
      '1 tbsp Ground flaxseeds (lignans)',
      '1 cup Unsweetened almond milk',
      '1 scoop Myo-Inositol powder (optional)',
    ],
    instructions: 'Blend on high speed until creamy, thick, and vibrant violet. Top with a few hemp seeds.',
    clinicalWhy: 'Anthocyanins in wild berries combined with lignans in ground flaxseeds promote healthy Phase-2 estrogen clearance and flatline insulin surges.',
    caloriesApprox: '~210 kcal',
  },
];

const CRAVING_CATEGORIES = [
  { id: 'sugar' as CravingCategory, label: 'Sweet & Sugar', emoji: '🍫' },
  { id: 'energy' as CravingCategory, label: 'Energy & Brain Fog', emoji: '⚡' },
  { id: 'cramps' as CravingCategory, label: 'Cramps & PMS', emoji: '🌸' },
  { id: 'bloating' as CravingCategory, label: 'Anti-Bloat', emoji: '🥒' },
  { id: 'pcos_glucose' as CravingCategory, label: 'PCOS Glucose', emoji: '🥑' },
];

export function HormoneFoodSolver({ currentPhase }: { currentPhase?: string }) {
  const [activeCategory, setActiveCategory] = useState<CravingCategory>('sugar');
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);

  const filteredFoods = HORMONE_FOODS.filter(f => f.category === activeCategory);

  return (
    <div className="w-full space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-pink-500/10 border border-pink-500/20 text-pink-400">
            <Utensils className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
              <span>What Should I Eat Right Now?</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-pink-500/15 text-pink-300 border border-pink-500/30">
                Hormone & Craving Solver
              </span>
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Instant 3-minute snacks & smart swaps that balance your hormones & flatten glucose spikes
            </p>
          </div>
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
        {CRAVING_CATEGORIES.map(cat => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setActiveCategory(cat.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 ${
              activeCategory === cat.id
                ? 'bg-gradient-to-r from-pink-500 to-violet-500 text-white shadow-md shadow-pink-500/20 font-bold'
                : 'bg-secondary/30 hover:bg-secondary/50 text-muted-foreground border border-border/30'
            }`}
          >
            <span>{cat.emoji}</span>
            <span>{cat.label}</span>
          </button>
        ))}
      </div>

      {/* Food Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {filteredFoods.map(food => (
          <motion.div
            key={food.id}
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-2xl bg-card/60 border border-border/40 backdrop-blur-md hover:border-pink-500/30 transition-all flex flex-col justify-between gap-3 group"
          >
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">{food.emoji}</span>
                  <div>
                    <h4 className="text-xs font-bold text-foreground group-hover:text-pink-300 transition-colors">
                      {food.title}
                    </h4>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3 text-pink-400" />
                      <span>{food.prepTime}</span>
                      {food.caloriesApprox && (
                        <span>• {food.caloriesApprox}</span>
                      )}
                    </p>
                  </div>
                </div>

                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shrink-0 font-medium">
                  Smart Swap
                </span>
              </div>

              {/* Craving Match Pill */}
              <div className="p-2 rounded-xl bg-secondary/20 border border-border/20 text-[11px] text-muted-foreground">
                <span className="font-semibold text-foreground">Craving: </span>
                <span>{food.cravingMatch}</span>
              </div>

              {/* Hormone Benefit */}
              <p className="text-xs font-medium text-pink-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 shrink-0 text-pink-400" />
                <span>{food.hormoneBenefit}</span>
              </p>
            </div>

            <div className="pt-2 border-t border-border/20 flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">
                {food.ingredients.length} ingredients
              </span>
              <button
                type="button"
                onClick={() => setSelectedFood(food)}
                className="text-xs font-bold text-pink-400 hover:text-pink-300 flex items-center gap-1 transition-colors cursor-pointer"
              >
                <span>View Recipe & Why</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Recipe Modal Drawer */}
      <AnimatePresence>
        {selectedFood && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-card border border-border/60 rounded-3xl shadow-2xl overflow-hidden space-y-4 p-5 sm:p-6 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-start justify-between gap-3 border-b border-border/30 pb-3">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{selectedFood.emoji}</span>
                  <div>
                    <h3 className="text-base font-bold text-foreground">
                      {selectedFood.title}
                    </h3>
                    <p className="text-xs text-pink-400 font-semibold">
                      {selectedFood.hormoneBenefit}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedFood(null)}
                  className="p-1.5 rounded-full hover:bg-secondary/60 text-muted-foreground transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Ingredients */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider text-[10px] text-muted-foreground">
                  🛒 Ingredients (3-Minute Prep)
                </h4>
                <ul className="space-y-1.5 text-xs text-foreground bg-secondary/15 p-3 rounded-2xl border border-border/25">
                  {selectedFood.ingredients.map((ing, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-pink-400 shrink-0 mt-0.5" />
                      <span>{ing}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Preparation */}
              <div className="space-y-1.5">
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider text-[10px] text-muted-foreground">
                  👩‍🍳 Quick Preparation
                </h4>
                <p className="text-xs text-foreground/90 bg-secondary/15 p-3 rounded-2xl border border-border/25 leading-relaxed">
                  {selectedFood.instructions}
                </p>
              </div>

              {/* Clinical Endocrinology Why */}
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-pink-950/30 to-purple-950/30 border border-pink-500/25 space-y-1">
                <h4 className="text-xs font-bold text-pink-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-pink-400" />
                  Why This Balances Your Hormones Right Now:
                </h4>
                <p className="text-[11px] text-foreground/85 leading-relaxed">
                  {selectedFood.clinicalWhy}
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedFood(null)}
                  className="w-full py-2.5 rounded-full bg-gradient-to-r from-pink-500 to-violet-500 hover:opacity-95 text-white font-bold text-xs shadow-md shadow-pink-500/20 transition-all active:scale-95 cursor-pointer"
                >
                  Got It, Thanks Luna! 🌸
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
