import React, { useState } from 'react';
import api from '../api';
import Orb from './ReactBits/Orb';

function Auth({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      if (isLogin) {
        const res = await api.post('/login', { username, password });
        onLogin(res.data.username);
      } else {
        await api.post('/register', { username, password });
        setIsLogin(true);
        setError('Registered successfully. Please log in.');
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'An error occurred');
    }
  };

  return (
    <Orb
      hoverIntensity={isLogin ? 3.28 : 3.28}
      rotateOnHover={false}
      hue={260} /* Adjusts colors to the purple/blue theme */
      forceHoverState={!isLogin}
      backgroundColor="#0d0d10"
    >
      <div className="auth-card">
        <h1 className="auth-title">MindWell</h1>
        <p className="auth-subtitle">AI-Driven Proactive Burnout Prediction</p>

        {error && <div style={{ color: error.includes('Registered') ? '#00C851' : '#ff4444', marginBottom: '1rem', textAlign: 'center', fontSize: '0.9rem' }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label>Username</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              placeholder="Enter your username"
              autoComplete="off"
            />
          </div>
          <div className="input-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="Enter your password"
              autoComplete="new-password"
            />
          </div>
          <button type="submit" className="btn">
            {isLogin ? 'Log In' : 'Register'}
          </button>
        </form>

        <div className="auth-switch">
          {isLogin ? (
            <>Don't have an account? <span onClick={() => setIsLogin(false)}>Register here</span></>
          ) : (
            <>Already have an account? <span onClick={() => setIsLogin(true)}>Log in here</span></>
          )}
        </div>
      </div>
    </Orb>
  );
}

export default Auth;
