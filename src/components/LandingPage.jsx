import { BarChart3, CarFront, CheckCircle2, CreditCard, Home, Mic, ReceiptText, Sparkles, Wallet } from 'lucide-react';

const benefits = [
  {
    icon: ReceiptText,
    title: 'Registrá sin fricción',
    text: 'Agregá gastos manualmente, por voz o desde un ticket, boleta o resumen de tarjeta.',
  },
  {
    icon: BarChart3,
    title: 'Entendé a dónde se va',
    text: 'Miralo por mes, categoría, subcategoría, moneda, auto, casa o tarjeta.',
  },
  {
    icon: CheckCircle2,
    title: 'Decisiones más claras',
    text: 'Detectá patrones, cuotas, servicios y gastos que se repiten antes de que pesen.',
  },
];

const quickActions = [
  { icon: ReceiptText, label: 'Manual', color: 'bg-zinc-900 text-white' },
  { icon: Mic, label: 'Voz', color: 'bg-emerald-500 text-white' },
  { icon: Sparkles, label: 'IA', color: 'bg-indigo-500 text-white' },
];

export default function LandingPage({ onLogin, loginError }) {
  return (
    <div className="min-h-[100dvh] bg-white text-zinc-950">
      <header className="sticky top-0 z-20 bg-white/85 backdrop-blur-md border-b border-zinc-100">
        <div className="max-w-6xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/icon.svg" alt="Gasting" className="w-10 h-10 rounded-2xl shadow-sm" />
            <span className="text-lg font-black tracking-tight">Gasting</span>
          </div>
          <button
            onClick={onLogin}
            className="px-4 py-3 rounded-full bg-zinc-900 text-white text-sm font-bold active:scale-95 transition-all"
          >
            Entrar
          </button>
        </div>
      </header>

      <main>
        <section className="max-w-6xl mx-auto px-5 pt-14 pb-12 md:pt-20 md:pb-16 grid md:grid-cols-[1fr_0.82fr] gap-10 items-center">
          <div>
            <h1 className="text-5xl md:text-7xl font-black tracking-tight leading-[0.95] max-w-3xl">
              Gasting
            </h1>
            <p className="mt-6 text-2xl md:text-3xl font-extrabold leading-tight text-zinc-900 max-w-2xl">
              Mejorá tu economía personal sabiendo exactamente en qué se va tu plata.
            </p>
            <p className="mt-5 text-base md:text-lg leading-8 text-zinc-600 max-w-xl">
              Una app simple para registrar gastos, ordenar autos, hogares y tarjetas, y convertir boletas o resúmenes en información útil para tomar mejores decisiones.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <button
                onClick={onLogin}
                className="px-6 py-4 rounded-2xl bg-emerald-500 text-white font-black shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
              >
                Empezar con Google
              </button>
              <a
                href="#beneficios"
                className="px-6 py-4 rounded-2xl bg-zinc-100 text-zinc-900 font-bold text-center active:scale-95 transition-all"
              >
                Ver beneficios
              </a>
            </div>
            {loginError && (
              <p className="mt-4 max-w-xl rounded-2xl bg-red-50 border border-red-100 px-4 py-3 text-sm font-medium text-red-700">
                {loginError}
              </p>
            )}
          </div>

          <div className="relative">
            <div className="mx-auto w-full max-w-[360px] rounded-[2.25rem] border border-zinc-200 bg-zinc-950 p-3 shadow-2xl shadow-zinc-900/20">
              <div className="rounded-[1.8rem] bg-zinc-50 overflow-hidden">
                <div className="px-5 pt-6 pb-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wider font-bold text-zinc-400">Este mes</p>
                    <p className="text-3xl font-black text-zinc-900">$ 42.860</p>
                  </div>
                  <div className="w-11 h-11 rounded-full bg-emerald-500 flex items-center justify-center text-white">
                    <Wallet size={22} />
                  </div>
                </div>

                <div className="px-5 pb-4 grid grid-cols-3 gap-2">
                  {quickActions.map((action) => {
                    const Icon = action.icon;
                    return (
                      <div key={action.label} className={`h-16 rounded-2xl ${action.color} flex flex-col items-center justify-center gap-1`}>
                        <Icon size={18} />
                        <span className="text-[11px] font-black">{action.label}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="px-5 pb-5 space-y-2">
                  {[
                    ['Supermercado', 'Alimentos', '$ 3.240'],
                    ['Nafta', 'Auto', '$ 2.100'],
                    ['Visa Itaú', 'Tarjeta', 'US$ 64'],
                    ['UTE', 'Casa', '$ 1.780'],
                  ].map(([title, subtitle, amount]) => (
                    <div key={title} className="flex items-center justify-between rounded-2xl bg-white border border-zinc-100 p-3">
                      <div>
                        <p className="font-bold text-zinc-900">{title}</p>
                        <p className="text-xs font-medium text-zinc-400">{subtitle}</p>
                      </div>
                      <p className="font-black text-zinc-900">{amount}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="beneficios" className="bg-zinc-950 text-white">
          <div className="max-w-6xl mx-auto px-5 py-14 md:py-20">
            <div className="max-w-2xl">
              <h2 className="text-3xl md:text-5xl font-black tracking-tight">Tu plata, ordenada como realmente vivís.</h2>
              <p className="mt-4 text-zinc-300 leading-7">
                No todos los gastos son iguales. Gasting te ayuda a separar lo general de lo que pertenece a tu auto, tu casa o tus tarjetas.
              </p>
            </div>

            <div className="mt-10 grid md:grid-cols-3 gap-4">
              {benefits.map((benefit) => {
                const Icon = benefit.icon;
                return (
                  <article key={benefit.title} className="rounded-3xl bg-white/7 border border-white/10 p-5">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-400/15 text-emerald-300 flex items-center justify-center">
                      <Icon size={23} />
                    </div>
                    <h3 className="mt-5 font-black text-xl">{benefit.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-zinc-300">{benefit.text}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-5 py-14 md:py-20">
          <div className="grid md:grid-cols-[0.9fr_1.1fr] gap-10 items-center">
            <div>
              <h2 className="text-3xl md:text-5xl font-black tracking-tight">Hecha para gastos reales, no para planillas perfectas.</h2>
              <p className="mt-4 text-zinc-600 leading-8">
                Cargá compras rápidas, servicios, combustible, cuotas y resúmenes. Después filtrá por fecha, moneda y destino para ver qué está pasando.
              </p>
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              {[
                [CarFront, 'Autos', 'Combustible, service, seguro y patente.'],
                [Home, 'Hogares', 'Servicios, alquiler, mantenimiento y cuentas.'],
                [CreditCard, 'Tarjetas', 'Bancos, cierres, vencimientos y cuotas.'],
              ].map(([Icon, title, text]) => (
                <div key={title} className="rounded-3xl border border-zinc-200 bg-zinc-50 p-5">
                  <Icon size={24} className="text-emerald-600" />
                  <h3 className="mt-4 font-black text-zinc-900">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-500">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
