
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight, Activity, CalendarHeart, Sparkles, Droplets } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-6 py-4 flex items-center justify-between border-b border-border/40 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-pink-500" />
          <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-500 to-violet-500">
            HerSync AI
          </span>
        </div>
        <nav className="hidden md:flex gap-6">
          <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Features</a>
          <a href="#testimonials" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Testimonials</a>
          <a href="#faq" className="text-sm text-muted-foreground hover:text-foreground transition-colors">FAQ</a>
        </nav>
        <Link href="/login">
          <Button className="bg-gradient-to-r from-pink-600 to-violet-600 hover:from-pink-500 hover:to-violet-500 text-white border-0">
            Go to App
          </Button>
        </Link>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="py-24 px-6 md:px-12 text-center relative overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-pink-500/20 rounded-full blur-[120px] -z-10 pointer-events-none" />
          
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 max-w-4xl mx-auto">
            Your AI Companion for <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-violet-500">
              PCOS & PCOD Wellness
            </span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
            Track your cycle, monitor skin health, manage stress, and get personalized insights from your dedicated AI wellness companion.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup">
              <Button size="lg" className="rounded-full bg-foreground text-background hover:bg-foreground/90 h-14 px-8 text-lg font-medium group">
                Start Tracking Free
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-24 px-6 md:px-12 bg-secondary/30">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Everything you need to stay in sync</h2>
              <p className="text-muted-foreground text-lg">Holistic tracking designed specifically for PCOS and PCOD management.</p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8">
              <div className="bg-background p-8 rounded-3xl border border-border/50 hover:border-pink-500/50 transition-colors">
                <div className="h-12 w-12 bg-pink-500/10 rounded-2xl flex items-center justify-center mb-6">
                  <Activity className="h-6 w-6 text-pink-500" />
                </div>
                <h3 className="text-xl font-bold mb-3">Symptom Tracking</h3>
                <p className="text-muted-foreground">Log daily mood, sleep, water intake, acne severity, and stress levels to identify personal patterns.</p>
              </div>
              
              <div className="bg-background p-8 rounded-3xl border border-border/50 hover:border-violet-500/50 transition-colors">
                <div className="h-12 w-12 bg-violet-500/10 rounded-2xl flex items-center justify-center mb-6">
                  <CalendarHeart className="h-6 w-6 text-violet-500" />
                </div>
                <h3 className="text-xl font-bold mb-3">Cycle Prediction</h3>
                <p className="text-muted-foreground">Advanced tracking that learns your unique irregular cycles common with PCOS to better predict your next period.</p>
              </div>
              
              <div className="bg-background p-8 rounded-3xl border border-border/50 hover:border-blue-500/50 transition-colors">
                <div className="h-12 w-12 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6">
                  <Sparkles className="h-6 w-6 text-blue-500" />
                </div>
                <h3 className="text-xl font-bold mb-3">AI Companion</h3>
                <p className="text-muted-foreground">Chat with an empathetic AI assistant trained to provide general wellness tips and emotional support.</p>
              </div>
            </div>
          </div>
        </section>

        {/* AI Companion Preview */}
        <section className="py-24 px-6 md:px-12 relative">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-12">
            <div className="flex-1">
              <h2 className="text-3xl md:text-5xl font-bold mb-6">Always there when you need support</h2>
              <p className="text-lg text-muted-foreground mb-8">
                Dealing with PCOS can be overwhelming. HerSync AI provides a judgment-free space to ask questions, vent about symptoms, and receive motivational guidance in multiple languages including English, Hindi, and Telugu.
              </p>
              <ul className="space-y-4 mb-8">
                {['Customizable personality', 'Multilingual support', 'Empathy-first responses', 'Privacy-focused (local storage)'].map((item, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <div className="h-6 w-6 rounded-full bg-green-500/20 flex items-center justify-center text-green-500">✓</div>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <Link href="/signup">
                <Button variant="outline" className="rounded-full">Meet Your AI Companion</Button>
              </Link>
            </div>
            <div className="flex-1 w-full max-w-md bg-card border border-border/50 rounded-3xl p-6 shadow-2xl relative">
              <div className="absolute -top-4 -right-4 bg-violet-500 text-white text-xs font-bold px-3 py-1 rounded-full animate-bounce">
                Try it inside!
              </div>
              <div className="flex gap-4 mb-6 items-end">
                <div className="bg-primary text-primary-foreground p-4 rounded-2xl rounded-br-none text-sm w-3/4 ml-auto">
                  {"I'm feeling really bloated today and my acne is flaring up. It's so frustrating."}
                </div>
              </div>
              <div className="flex gap-4 items-start">
                <div className="bg-muted p-4 rounded-2xl rounded-bl-none text-sm w-5/6">
                  {"I completely understand how frustrating that can be. Bloating and acne flare-ups are very common with PCOS due to hormonal fluctuations. Make sure you're drinking plenty of water today. Would you like some gentle stretching exercises that might help relieve the bloating?"}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section id="testimonials" className="py-24 px-6 md:px-12 bg-secondary/20">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold mb-12 text-center">Loved by women taking control</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { name: 'Sarah M.', role: 'PCOS Warrior', quote: "The AI companion is honestly life-changing. It's like having a supportive friend who actually understands what I'm going through." },
                { name: 'Priya K.', role: 'Student', quote: "I love that I can chat in Hindi. It makes it so much easier to express how I'm really feeling during my difficult days." },
                { name: 'Emily R.', role: 'Marketing Mgr', quote: "The daily check-ins finally helped me see the correlation between my sleep hours and my acne flare-ups." }
              ].map((t, i) => (
                <div key={i} className="bg-background p-6 rounded-2xl border border-border/40">
                  <div className="flex gap-1 text-yellow-500 mb-4">
                    {'★★★★★'.split('').map((star, j) => <span key={j}>{star}</span>)}
                  </div>
                  <p className="italic text-muted-foreground mb-6">{`"${t.quote}"`}</p>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-gradient-to-br from-pink-400 to-violet-500 rounded-full flex items-center justify-center text-white font-bold">
                      {t.name[0]}
                    </div>
                    <div>
                      <div className="font-semibold">{t.name}</div>
                      <div className="text-xs text-muted-foreground">{t.role}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="py-12 px-6 border-t border-border/40 text-center text-muted-foreground">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Sparkles className="h-5 w-5 text-pink-500" />
          <span className="font-bold text-foreground">HerSync AI</span>
        </div>
        <p className="max-w-md mx-auto text-sm mb-6">
          Empowering women with PCOS and PCOD to understand their bodies and reclaim their wellness journey.
        </p>
        <p className="text-xs opacity-60">
          Disclaimer: HerSync AI is a wellness tracking tool and not a replacement for professional medical advice.
        </p>
        <div className="mt-8 text-xs">
          © {new Date().getFullYear()} HerSync AI. Built for wellness.
        </div>
      </footer>
    </div>
  );
}
