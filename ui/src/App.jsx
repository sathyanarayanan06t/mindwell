import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';

function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const savedUser = sessionStorage.getItem('username');
    if (savedUser) {
        setUser(savedUser);
    }
  }, []);

  const handleLogin = (username) => {
    setUser(username);
    sessionStorage.setItem('username', username);
  };

  const handleLogout = () => {
    setUser(null);
    sessionStorage.removeItem('username');
  };

  const handleUpdateUser = (newUsername) => {
    setUser(newUsername);
    sessionStorage.setItem('username', newUsername);
  };

  return (
    <Router>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" /> : <Auth onLogin={handleLogin} />} />
        <Route path="/*" element={user ? <Dashboard user={user} onLogout={handleLogout} onUpdateUser={handleUpdateUser} /> : <Navigate to="/login" />} />
      </Routes>
    </Router>
  );
}

export default App;
