import { useState, useEffect } from 'react';
import { auth, db, loginConGoogle, logout } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { LogOut, Plus, BarChart3, Wallet, Settings, User } from 'lucide-react';
import ExpenseForm from './components/ExpenseForm';
import Dashboard from './components/Dashboard';
import AdminPanel from './components/AdminPanel';
import EntitiesManager from './components/EntitiesManager';

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || 'renzodogliotti@gmail.com';

function App() {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [vistaActiva, setVistaActiva] = useState('form');
  const [loginError, setLoginError] = useState('');

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

    return (
      <div className="flex h-[100dvh] items-center justify-center bg-zinc-900 p-6">
        <div className="bg-zinc-800 p-8 rounded-[2rem] shadow-2xl text-center w-full max-w-sm border border-zinc-700">
          <div className="bg-emerald-500 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/30">
            <Wallet color="white" size={32} />
          </div>
          <h1 className="text-3xl font-extrabold mb-2 text-white">Gasting</h1>
          <p className="text-zinc-400 mb-8 text-sm">Controlá tus números de forma inteligente.</p>
          <button 
            onClick={handleLogin}
            className="w-full bg-white text-zinc-900 font-bold py-4 rounded-2xl hover:bg-zinc-100 transition-all active:scale-95"
          >
            Continuar con Google
          </button>
          {loginError && (
            <p className="mt-4 text-sm font-medium text-red-300">{loginError}</p>
          )}
        </div>
      </div>
    );
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
        {vistaActiva === 'form' && <ExpenseForm user={user} />}
        {vistaActiva === 'dashboard' && <Dashboard user={user} />}
        {vistaActiva === 'profile' && <EntitiesManager user={user} />}
        {vistaActiva === 'admin' && isAdmin && <AdminPanel />}
      </main>

      {/* Navegación Inferior Flotante */}
      <div className="fixed bottom-6 left-0 right-0 px-6 max-w-md mx-auto pointer-events-none">
        <nav className="bg-zinc-900/90 backdrop-blur-lg border border-zinc-800 rounded-full flex justify-between items-center p-2 shadow-2xl pointer-events-auto">
          
          {/* Botón: Nuevo Gasto */}
          <button 
            onClick={() => setVistaActiva('form')}
            className={`flex-1 flex justify-center py-3 rounded-full transition-all ${vistaActiva === 'form' ? 'bg-zinc-800 text-emerald-400' : 'text-zinc-400 hover:text-white'}`}
          >
            <Plus size={24} strokeWidth={vistaActiva === 'form' ? 2.5 : 2} />
          </button>
          
          <div className="w-px h-8 bg-zinc-700"></div>
          
          {/* Botón: Dashboard Global */}
          <button 
            onClick={() => setVistaActiva('dashboard')}
            className={`flex-1 flex justify-center py-3 rounded-full transition-all ${vistaActiva === 'dashboard' ? 'bg-zinc-800 text-emerald-400' : 'text-zinc-400 hover:text-white'}`}
          >
            <BarChart3 size={24} strokeWidth={vistaActiva === 'dashboard' ? 2.5 : 2} />
          </button>

          <div className="w-px h-8 bg-zinc-700"></div>

          {/* Botón: Mis Entidades (Vehículos/Hogares) */}
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
