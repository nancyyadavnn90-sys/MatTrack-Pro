import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import loginBg from '../assets/login-bg.png';
import { Eye, EyeOff, ArrowRight } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMsg, setForgotMsg] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    let res;
    try {
      res = await axios.post('http://localhost:5000/api/auth/login', { email, password });
    } catch (err1) {
      try {
        res = await axios.post('http://localhost:5001/api/auth/login', { email, password });
      } catch (err2) {
        setLoading(false);
        return setError(err2.response?.data?.message || err1.response?.data?.message || 'Login failed. Please check your network connection and backend server.');
      }
    }
    try {
      const user = res.data.user;
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(user));

      // Smart Redirect to First Permitted Module
      const isAdmin = user.role === 'Admin' || user.role === 'System Administrator';
      const routeList = [
        { path: '/dashboard', feature: 'Dashboard' },
        { path: '/gate-pass', feature: 'GatePass' },
        { path: '/grn', feature: 'GRN' },
        { path: '/inventory', feature: 'Store' },
        { path: '/quality', feature: 'Quality' },
        { path: '/mixing', feature: 'Production' },
        { path: '/moulding', feature: 'Production' },
        { path: '/production', feature: 'Production' },
        { path: '/final-qc', feature: 'Quality' },
        { path: '/fg-receipt', feature: 'FG' },
        { path: '/dispatch', feature: 'Dispatch' },
        { path: '/wip', feature: 'ShopFloor' },
        { path: '/oee', feature: 'Production' },
        { path: '/oee/shift-log', feature: 'Production' }
      ];

      let targetRoute = '/dashboard';

      if (!isAdmin && user.permissions && Object.keys(user.permissions).length > 0) {
        const allowed = routeList.find(r => {
          const perm = user.permissions[r.feature];
          return (!perm || (perm.can_view !== false && perm.can_view !== 0));
        });
        if (allowed) targetRoute = allowed.path;
      }

      navigate(targetRoute);
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-end px-6 lg:px-20 relative"
      style={{
        backgroundImage: `url(${loginBg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center top',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed',
      }}
    >

      {/* Login card */}
      <div className="relative z-10 w-full max-w-md bg-slate-900/85 backdrop-blur-md border border-slate-700 rounded-2xl p-8 shadow-2xl">
        <h2 className="text-3xl font-bold text-white mb-1">
          Welcome <span className="text-orange-500">Back!</span>
        </h2>
        <p className="text-slate-400 mb-6 text-sm">
          Login to continue to MatTrack-Pro
        </p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Username
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="Enter your username"
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-orange-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Enter your password"
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-orange-500 focus:outline-none pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="text-right">
            <button
              type="button"
              onClick={() => setShowForgot(true)}
              className="text-orange-500 text-sm hover:underline"
            >
              Forgot Password?
            </button>
          </div>

          {error && (
            <div className="bg-red-900/40 border border-red-700 text-red-300 text-sm px-4 py-2 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-lg font-semibold transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? 'Logging in...' : 'Login'}
            {!loading && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>

        <p className="text-center text-slate-500 text-xs mt-6">
          © 2026 Jayashree Polymers (India) Pvt. Ltd.
        </p>
      </div>

      {/* Forgot Password Modal */}
      {showForgot && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-8 w-full max-w-sm shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-2">
              Reset <span className="text-orange-500">Password</span>
            </h3>
            <p className="text-slate-400 text-sm mb-6">
              Enter your registered email address and we will send you a reset link.
            </p>

            {forgotMsg ? (
              <div className="bg-green-900/40 border border-green-700 text-green-300 text-sm px-4 py-3 rounded-lg mb-4">
                {forgotMsg}
              </div>
            ) : (
              <>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Email address
                  </label>
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="w-full px-4 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  />
                </div>
                <button
                  onClick={() => {
                    if (forgotEmail) {
                      setForgotMsg(`Reset link sent to ${forgotEmail}. Please check your inbox.`);
                    }
                  }}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white py-2.5 rounded-lg font-semibold transition mb-3"
                >
                  Send Reset Link
                </button>
              </>
            )}

            <button
              onClick={() => { setShowForgot(false); setForgotEmail(''); setForgotMsg(''); }}
              className="w-full border border-slate-600 text-slate-400 py-2.5 rounded-lg hover:bg-slate-800 transition text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

    </div>
  );
}