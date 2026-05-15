import { BarChart3, CarFront, CheckCircle2, CreditCard, Home, Mic, ReceiptText, ShieldCheck, Sparkles, TrendingDown, Wallet } from 'lucide-react';

const benefits = [
  {
    icon: ReceiptText,
    title: 'Cargá gastos en segundos',
    text: 'Manual, por voz o desde tickets, facturas y resúmenes. Menos planilla, más hábito.',
  },
  {
    icon: BarChart3,
    title: 'Encontrá fugas de plata',
    text: 'Separá por mes, categoría, moneda, auto, casa o tarjeta para ver qué pesa de verdad.',
  },
  {
    icon: CheckCircle2,
    title: 'Llegá más tranquilo a fin de mes',
    text: 'Anticipá cuotas, servicios y gastos repetidos antes de que se conviertan en sorpresa.',
  },
];

const outcomes = [
  'Saber cuánto gastaste este mes sin abrir una planilla.',
  'Separar gastos personales, casa, auto y tarjetas sin mezclar todo.',
  'Convertir boletas y resúmenes en datos que podés revisar.',
  'Tomar decisiones con números reales, no con sensación de culpa.',
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
              Dejá de preguntarte “¿en qué se me fue la plata?”.
            </p>
            <p className="mt-5 text-base md:text-lg leading-8 text-zinc-600 max-w-xl">
              Gasting ordena tus gastos cotidianos, tus tarjetas, tu casa y tu auto en un solo lugar, para que puedas mirar el mes con claridad y ajustar antes de llegar tarde.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <button
                onClick={onLogin}
                className="px-6 py-4 rounded-2xl bg-emerald-500 text-white font-black shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
              >
                Empezar a ordenar mis gastos
              </button>
              <a
                href="#beneficios"
                className="px-6 py-4 rounded-2xl bg-zinc-100 text-zinc-900 font-bold text-center active:scale-95 transition-all"
              >
                Ver cómo ayuda
              </a>
            </div>
            <div className="mt-7 grid sm:grid-cols-2 gap-3 max-w-xl">
              {outcomes.slice(0, 2).map(item => (
                <div key={item} className="flex items-start gap-2 text-sm font-semibold text-zinc-600">
                  <CheckCircle2 size={18} className="text-emerald-500 shrink-0 mt-0.5" />
                  <span>{item}</span>
                </div>
              ))}
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
              <h2 className="text-3xl md:text-5xl font-black tracking-tight">Una app para recuperar control, no para castigarte.</h2>
              <p className="mt-4 text-zinc-300 leading-7">
                La economía personal mejora cuando tenés información simple, a tiempo y separada de forma útil. Gasting está pensada para eso.
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
              <h2 className="text-3xl md:text-5xl font-black tracking-tight">Hecha para gastos reales, no para meses ideales.</h2>
              <p className="mt-4 text-zinc-600 leading-8">
                Cargá compras rápidas, servicios, combustible, cuotas y resúmenes. Después filtrá por fecha, moneda y destino para ver qué está pasando antes de tomar decisiones.
              </p>
              <div className="mt-6 space-y-3">
                {outcomes.slice(2).map(item => (
                  <div key={item} className="flex items-start gap-3 rounded-2xl bg-zinc-50 border border-zinc-200 p-4">
                    <TrendingDown size={20} className="text-emerald-600 shrink-0 mt-0.5" />
                    <p className="text-sm font-semibold text-zinc-700">{item}</p>
                  </div>
                ))}
              </div>
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

        <section className="max-w-6xl mx-auto px-5 pb-14 md:pb-20">
          <div className="rounded-[2rem] bg-zinc-50 border border-zinc-200 p-6 md:p-8 grid md:grid-cols-[0.75fr_1fr] gap-6 items-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <ShieldCheck size={28} />
            </div>
            <div>
              <h2 className="text-2xl md:text-4xl font-black tracking-tight text-zinc-900">Tus datos se revisan antes de guardarse.</h2>
              <p className="mt-3 text-zinc-600 leading-7">
                Cuando usás voz o documentos, Gasting prepara sugerencias editables. Vos confirmás qué se guarda, corregís categorías y descartás lo que no corresponde.
              </p>
            </div>
          </div>
        </section>

        <section className="bg-emerald-500 text-white">
          <div className="max-w-6xl mx-auto px-5 py-12 md:py-16 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="max-w-2xl">
              <h2 className="text-3xl md:text-5xl font-black tracking-tight">Empezá con el próximo gasto.</h2>
              <p className="mt-4 text-emerald-50 leading-7">
                No necesitás cargar tu vida entera de una vez. Registrá lo que gastás hoy y empezá a ver patrones esta semana.
              </p>
            </div>
            <button
              onClick={onLogin}
              className="px-6 py-4 rounded-2xl bg-white text-emerald-700 font-black shadow-lg shadow-emerald-900/10 active:scale-95 transition-all"
            >
              Entrar con Google
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
