import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Car } from 'lucide-react';

const Login = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();
    const userData = { id: 1, name: "Alex Rivera", email: email || "alex@driveclique.com" };
    onLogin(userData);
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <Car className="w-16 h-16 mx-auto text-red-500 mb-4" />
          <h1 className="text-5xl font-bold">DriveClique</h1>
          <p className="text-zinc-400 mt-2">Connect. Drive. Repeat.</p>
        </div>

        <div className="bg-zinc-900 rounded-3xl p-10">
          <h2 className="text-3xl font-bold mb-8 text-center">Sign In</h2>

          <form onSubmit={handleLogin} className="space-y-6">
            <input 
              type="email" 
              placeholder="Email address" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-black border border-zinc-700 rounded-2xl px-6 py-4 focus:outline-none focus:border-red-600"
              required 
            />
            <button 
              type="submit" 
              className="w-full bg-red-600 hover:bg-red-700 py-4 rounded-2xl font-semibold text-lg transition"
            >
              Sign In
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;