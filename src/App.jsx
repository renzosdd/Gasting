import { useState, useEffect } from 'react';
import { auth, db, loginConGoogle, logout } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { BarChart3, LogOut, Settings, User, X } from 'lucide-react';
import ExpenseForm from './components/ExpenseForm';
import AdminPanel from './components/AdminPanel';
import EntitiesManager from './components/EntitiesManager';
import LandingPage from './components/LandingPage';
import Home from './components/Home';

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || 'renzodogliotti@gmail.com';

function App() {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [vistaActiva, setVistaActiva] = useState('home');
  const [loginError, setLoginError] = useState('');
  const [expenseModal, setExpenseModal] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAdmin(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const cargarAdmin = async () => {
      try {
        const email = user.email?.toLowerCase();
        const adminByUid = await getDoc(doc(db, 'admins', user.uid));
        const adminByEmail = email ? await getDoc(doc(db, 'admins', email)) : null;
        setIsAdmin(adminByUid.exists() || Boolean(adminByEmail?.exists()) || user.email === ADMIN_EMAIL);
      } catch (error) {
        console.error('No se pudo cargar el rol admin:', error);
        setIsAdmin(user.email === ADMIN_EMAIL);
      }
    };

    cargarAdmin();
  }, [user]);

  if (!user) {
    const handleLogin = async () => {
      setLoginError('');

      try {
        await loginConGoogle();
      } catch (error) {
        console.error('Error al iniciar sesión:', error);
        if (error.code === 'auth/unauthorized-domain') {
          setLoginError('Este dominio todavía no está autorizado en Firebase Authentication.');
          return;
        }
        setLoginError('No se pudo iniciar sesión. Probá de nuevo en unos segundos.');
      }
    };

    return <LandingPage onLogin={handleLogin} loginError={loginError} />;
  }

  return (
    <div className="max-w-md mx-auto h-[100dvh] flex flex-col bg-zinc-50 relative">
      {/* Header Minimalista */}
      <header className="px-6 pt-10 pb-4 flex justify-between items-center z-10 bg-zinc-50/80 backdrop-blur-md sticky top-0">
        <div className="flex items-center gap-3">
          {user.photoURL ? (
            <img src={user.photoURL} alt="perfil" className="w-10 h-10 rounded-full shadow-sm" />
          ) : (
            <div className="w-10 h-10 rounded-full shadow-sm bg-zinc-200 flex items-center justify-center text-zinc-500">
              <User size={18} />
            </div>
          )}
          <div>
            <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Hola,</p>
            <h2 className="font-bold text-zinc-800 leading-tight">
              {(user.displayName || user.email || 'Usuario').split(' ')[0]}
            </h2>
          </div>
        </div>
        <button onClick={logout} className="p-3 bg-white rounded-full text-zinc-400 hover:text-red-500 shadow-sm active:scale-90 transition-all">
          <LogOut size={18} />
        </button>
      </header>

      {/* Contenido Principal */}
      <main className="flex-1 overflow-y-auto px-6 pb-32">
        {vistaActiva === 'home' && (
          <Home
            user={user}
            onAddExpense={(mode) => setExpenseModal(mode)}
          />
        )}
        {vistaActiva === 'profile' && <EntitiesManager user={user} />}
        {vistaActiva === 'admin' && isAdmin && <AdminPanel user={user} />}
      </main>

      {expenseModal && (
        <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm flex items-end justify-center px-3 pb-3">
          <div className="w-full max-w-md max-h-[92vh] overflow-y-auto rounded-[2rem] bg-zinc-50 p-4 shadow-2xl animate-in slide-in-from-bottom-6 fade-in duration-300">
            <div className="sticky top-0 z-10 -mx-4 -mt-4 mb-2 bg-zinc-50/90 backdrop-blur-md px-4 pt-4 pb-2 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-600">Nuevo gasto</p>
                <h2 className="text-xl font-black text-zinc-900">
                  {expenseModal === 'voice' ? 'Cargar por voz' : expenseModal === 'document' ? 'Cargar con IA' : 'Cargar manual'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setExpenseModal(null)}
                className="w-10 h-10 rounded-full bg-white border border-zinc-100 text-zinc-500 flex items-center justify-center"
              >
                <X size={18} />
              </button>
            </div>
            <ExpenseForm
              user={user}
              initialAction={expenseModal}
              onSaved={() => setExpenseModal(null)}
            />
          </div>
        </div>
      )}

      {/* Navegación Inferior Flotante */}
      <div className="fixed bottom-6 left-0 right-0 px-6 max-w-md mx-auto pointer-events-none">
        <nav className="bg-zinc-900/90 backdrop-blur-lg border border-zinc-800 rounded-full flex justify-between items-center p-2 shadow-2xl pointer-events-auto">
          
          <button 
            onClick={() => setVistaActiva('home')}
            className={`flex-1 flex justify-center py-3 rounded-full transition-all ${vistaActiva === 'home' ? 'bg-zinc-800 text-emerald-400' : 'text-zinc-400 hover:text-white'}`}
          >
            <BarChart3 size={24} strokeWidth={vistaActiva === 'home' ? 2.5 : 2} />
          </button>
          
          <div className="w-px h-8 bg-zinc-700"></div>

          <button 
            onClick={() => setVistaActiva('profile')}
            className={`flex-1 flex justify-center py-3 rounded-full transition-all ${vistaActiva === 'profile' ? 'bg-zinc-800 text-emerald-400' : 'text-zinc-400 hover:text-white'}`}
          >
            <User size={24} strokeWidth={vistaActiva === 'profile' ? 2.5 : 2} />
          </button>

          {/* Botón: Admin (Solo visible para ADMIN_EMAIL) */}
          {isAdmin && (
            <>
              <div className="w-px h-8 bg-zinc-700"></div>
              <button 
                onClick={() => setVistaActiva('admin')}
                className={`flex-1 flex justify-center py-3 rounded-full transition-all ${vistaActiva === 'admin' ? 'bg-zinc-800 text-emerald-400' : 'text-zinc-400 hover:text-white'}`}
              >
                <Settings size={24} strokeWidth={vistaActiva === 'admin' ? 2.5 : 2} />
              </button>
            </>
          )}
          
        </nav>
      </div>
    </div>
  );
}

export default App;
