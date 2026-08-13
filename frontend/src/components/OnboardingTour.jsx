import React, { useState } from "react";
import { Briefcase, Gauge, AppWindow, Sparkles, ChevronRight, ChevronLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const STEPS = [
  {
    icon: Sparkles,
    title: "Bienvenue sur MARCEL",
    text: "Votre plateforme de pilotage stratégique DSI : portefeuille projets, budget, ressources, gouvernance, Run et sécurité — tout au même endroit.",
  },
  {
    icon: Briefcase,
    title: "Pilotez votre portefeuille",
    text: "Le Portefeuille regroupe tous vos projets en tuiles avec statut RAG, budget et jalons. Le Budget suit CAPEX/OPEX, EAC et plan pluriannuel. Les Équipes et Ressources gèrent la capacité.",
  },
  {
    icon: Gauge,
    title: "Des indicateurs adaptés à chaque méthode",
    text: "La page Pilotage applique automatiquement les bons indicateurs : EVM (CPI/SPI) pour le waterfall, vélocité pour l'agile, predictability pour SAFe. Le cycle de vie avec gates Architecture/Sécurité s'intègre à votre gouvernance.",
  },
  {
    icon: AppWindow,
    title: "DSI 360° et IA",
    text: "Applications (APM), Run & Exploitation, Sécurité et Architecture complètent la vision. L'Agent IA PMO répond à vos questions et un rapport IA du portefeuille est généré chaque semaine.",
  },
];

export const OnboardingTour = () => {
  const { user } = useAuth();
  const storageKey = `marcel_onboarded_${user?.user_id}`;
  const [visible, setVisible] = useState(() => user?.user_id && !localStorage.getItem(storageKey));
  const [step, setStep] = useState(0);

  if (!visible) return null;

  const close = () => {
    localStorage.setItem(storageKey, "1");
    setVisible(false);
  };
  const s = STEPS[step];
  const Icon = s.icon;
  const last = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[90] bg-black/50 flex items-center justify-center p-4" data-testid="onboarding-tour">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-[#352c6e] px-7 py-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center mx-auto mb-4">
            <Icon size={26} className="text-white" />
          </div>
          <h2 className="font-heading text-xl font-extrabold text-white" data-testid="onboarding-title">{s.title}</h2>
        </div>
        <div className="p-7">
          <p className="text-sm text-zinc-600 leading-relaxed text-center min-h-[84px]">{s.text}</p>
          <div className="flex justify-center gap-1.5 my-4">
            {STEPS.map((_, i) => (
              <span key={i} className={`w-2 h-2 rounded-full ${i === step ? "bg-[#2e5fe8]" : "bg-zinc-200"}`} />
            ))}
          </div>
          <div className="flex items-center justify-between">
            <button onClick={close} data-testid="onboarding-skip-btn" className="text-xs text-zinc-400 hover:text-zinc-600">
              Passer la visite
            </button>
            <div className="flex gap-2">
              {step > 0 && (
                <button onClick={() => setStep((x) => x - 1)} data-testid="onboarding-prev-btn"
                  className="flex items-center gap-1 px-3.5 py-2 text-xs font-semibold text-zinc-500 border border-zinc-200 rounded-lg hover:bg-zinc-50">
                  <ChevronLeft size={13} /> Précédent
                </button>
              )}
              <button onClick={last ? close : () => setStep((x) => x + 1)} data-testid="onboarding-next-btn"
                className="flex items-center gap-1 px-4 py-2 text-xs font-bold bg-[#2e5fe8] text-white rounded-lg hover:bg-[#2450c8]">
                {last ? "C'est parti !" : "Suivant"} {!last && <ChevronRight size={13} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
