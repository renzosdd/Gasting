import { useState, useEffect } from 'react';
import { auth, loginConGoogle, logout } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { LogOut, Plus, BarChart3, Wallet } from 'lucide-react';
import ExpenseForm from './components/ExpenseForm';
import Dashboard from './components/Dashboard';

function App() {
  const [user, setUser] = useState(null);
  const [vistaActiva, setVistaActiva] = useState('form');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  if (!user) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-zinc-900 p-6">
        <div className="bg-zinc-800 p-8 rounded-[2rem] shadow-2xl text-center w-full max-w-sm border border-zinc-700">
          <div className="bg-emerald-500 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/30">
            <Wallet color="white" size={32} />
          </div>
          <h1 className="text-3xl font-extrabold mb-2 text-white">Gasting</h1>
          <p className="text-zinc-400 mb-8 text-sm">Controlá tus números de forma inteligente.</p>
          <button 
            onClick={loginConGoogle}
            className="w-full bg-white text-zinc-900 font-bold py-4 rounded-2xl hover:bg-zinc-100 transition-all active:scale-95"
          >
            Continuar con Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto h-[100dvh] flex flex-col bg-zinc-50 relative">
      {/* Header Minimalista */}
      <header className="px-6 pt-10 pb-4 flex justify-between items-center z-10 bg-zinc-50/80 backdrop-blur-md sticky top-0">
        <div className="flex items-center gap-3">
          <img src={user.photoURL} alt="perfil" className="w-10 h-10 rounded-full shadow-sm" />
          <div>
            <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Hola,</p>
            <h2 className="font-bold text-zinc-800 leading-tight">
              {user.displayName.split(' ')[0]}
            </h2>
          </div>
        </div>
        <button onClick={logout} className="p-3 bg-white rounded-full text-zinc-400 hover:text-red-500 shadow-sm active:scale-90 transition-all">
          <LogOut size={18} />
        </button>
      </header>

      {/* Contenido */}
      <main className="flex-1 overflow-y-auto px-6 pb-32">
        {vistaActiva === 'form' ? <ExpenseForm user={user} /> : <Dashboard user={user} />}
      </main>

      {/* Navegación Inferior Flotante (Glassmorphism) */}
      <div className="fixed bottom-6 left-0 right-0 px-6 max-w-md mx-auto pointer-events-none">
        <nav className="bg-zinc-900/90 backdrop-blur-lg border border-zinc-800 rounded-full flex justify-between items-center p-2 shadow-2xl pointer-events-auto">
          <button 
            onClick={() => setVistaActiva('form')}
            className={`flex-1 flex justify-center py-3 rounded-full transition-all ${vistaActiva === 'form' ? 'bg-zinc-800 text-emerald-400' : 'text-zinc-400 hover:text-white'}`}
          >
            <Plus size={24} strokeWidth={vistaActiva === 'form' ? 2.5 : 2} />
          </button>
          <div className="w-px h-8 bg-zinc-700"></div>
          <button 
            onClick={() => setVistaActiva('dashboard')}
            className={`flex-1 flex justify-center py-3 rounded-full transition-all ${vistaActiva === 'dashboard' ? 'bg-zinc-800 text-emerald-400' : 'text-zinc-400 hover:text-white'}`}
          >
            <BarChart3 size={24} strokeWidth={vistaActiva === 'dashboard' ? 2.5 : 2} />
          </button>
        </nav>
      </div>
    </div>
  );
}

export default App;