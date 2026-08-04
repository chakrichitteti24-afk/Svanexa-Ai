# SVANEXA AI

> **"Intelligent Wellness, Empowered by AI."**

Svanexa AI is a state-of-the-art, AI-powered women's wellness platform designed to provide personalized wellness guidance, secure health tracking, and intelligent insights. Built specifically to support general wellness, PCOS/PCOD management, and pregnancy tracking, Svanexa AI combines modern design aesthetics with high-performance engineering.

---

## 🌟 Key Features

### 📅 Cycle Tracker
- **Flo & Clue Style Precision:** Intuitive period start and end logging with continuous, connected range highlighting.
- **PCOS/PCOD & Irregular Cycle Support:** Intelligent prediction engine that adapts to variable cycle lengths (up to 90 days).
- **Multi-Mode Support:** Seamless switching between **General Wellness**, **PCOS/PCOD Care**, and **Pregnancy Tracking**.

### 🤖 AI Companion (Luna)
- **Empathetic AI Guidance:** Multi-lingual support in English, Hindi, and Telugu.
- **Personalized Wellness Insights:** Context-aware conversations based on daily check-ins, sleep quality, hydration, and stress levels.
- **Privacy-First:** Secure, encrypted, and user-controlled communication.

### 📝 Daily Check-In & Habit Tracking
- **Time-Slot Check-Ins:** Morning, Afternoon, and Evening slots for logging sleep duration, water intake (L), mood, stress, and exercise.
- **Streak & Consistency Rewards:** Automated streak calculation and Luna reaction badges to build long-term healthy habits.

### 🧴 Skin Health Tracker
- **Flare-Up & Acne Logging:** Track daily skin conditions, acne severity, and identify correlation between stress, sleep, and skin flare-ups.

### 📊 Reports & Analytics
- **Visual Health Summaries:** Interactive charts powered by Recharts visualizing sleep, mood trends, hydration levels, and cycle history.

---

## 🛠️ Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Framework** | Next.js 16 (App Router, Turbopack) |
| **Language** | TypeScript |
| **UI & Styling** | React 19, Tailwind CSS v4, Framer Motion, Lucide Icons |
| **Database & Auth** | Supabase (PostgreSQL, `@supabase/ssr`, Row Level Security) |
| **AI Integration** | Google Gemini API / Groq SDK |
| **State & Performance** | React Context (`useMemo`, `useCallback`), Optimistic UI |

---

## ⚡ Performance Architecture

Svanexa AI is engineered for high-concurrency production workloads:
- **1000+ Concurrent User Capacity:** Replaced heavy WebSocket `.subscribe()` listeners with a debounced focus-sync engine, eliminating Supabase connection limits.
- **60 FPS React Renders:** Context state and heavy computations are memoized (`useMemo`), preventing global re-render loops.
- **Optimistic UI Updates:** Daily task toggles and period logs instantly update the UI thread while silently synchronizing with Supabase in the background.

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: `v18.17.0` or higher
- **Package Manager**: `npm` (v9+)

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up Environment Variables:**
   Create a `.env.local` file in the `frontend` directory with your credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-supabase-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   GEMINI_API_KEY=your-google-gemini-api-key
   ```

3. **Run the Development Server:**
   ```bash
   npm run dev
   ```

4. **Open Svanexa AI:**
   Navigate to [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🔒 Security & Privacy

- **Row Level Security (RLS):** Supabase RLS policies guarantee users can strictly access only their own profile and health logs.
- **Authentication Persistence:** SSR cookie-based authentication ensures seamless login states across page refreshes and browser sessions.

---

## ⚠️ Medical Disclaimer

*Svanexa AI is a wellness tracking and educational tool designed for personal lifestyle management. It does not provide medical diagnoses, treatment advice, or clinical prescriptions. Always consult a qualified healthcare professional or doctor for medical advice regarding PCOS, PCOD, or pregnancy.*

---

© 2026 **Svanexa AI**. All rights reserved.
