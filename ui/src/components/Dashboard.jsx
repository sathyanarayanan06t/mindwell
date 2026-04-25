import React, { useState, useEffect } from 'react';
import {
  BarChart2,
  CheckSquare,
  Timer,
  Settings,
  History as HistoryIcon,
  LogOut,
  Activity,
  Moon,
  Sun,
  Calendar,
  Edit2,
  Trash2,
  Eye,
  Bot,
  Send
} from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { MobileTimePicker } from '@mui/x-date-pickers/MobileTimePicker';
import { renderTimeViewClock } from '@mui/x-date-pickers/timeViewRenderers';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import dayjs from 'dayjs';
import api from '../api';
import SpotlightCard from './ReactBits/SpotlightCard';
import DrowsinessTab from './DrowsinessTab';

const COLORS = {
  Productive: '#00C851',
  Distracted: '#ff4444',
  Neutral: '#33b5e5',
  Unknown: '#888888'
};

function Dashboard({ user, onLogout, onUpdateUser }) {
  const [activeTab, setActiveTab] = useState('progress');
  const [age, setAge] = useState(25);
  const [mobile_no, setMobileNo] = useState('');
  
  useEffect(() => {
    document.body.className = 'dark-mode';
    api.get(`/user/profile?username=${user}`)
      .then(res => {
        if (res.data) {
          if (res.data.age) setAge(res.data.age);
          if (res.data.mobile_no) setMobileNo(res.data.mobile_no);
        }
      })
      .catch(console.error);
  }, [user]);

  const renderContent = () => {
    switch (activeTab) {
      case 'progress': return <ProgressTab username={user} age={age} />;
      case 'schedule': return <ScheduleTab username={user} />;
      case 'checkin': return <CheckInTab username={user} />;
      case 'live': return <LiveSessionTab />;
      case 'history': return <HistoryTab />;
      case 'drowsiness': return <DrowsinessTab onRedirectToSchedule={() => setActiveTab('schedule')} />;
      case 'settings': return <SettingsTab user={user} age={age} setAge={setAge} onLogout={onLogout} onUpdateUser={onUpdateUser} />;
      default: return null;
    }
  };

  return (
    <div className="dashboard-layout dark-theme">
      <nav className="sidebar">
        <div className="sidebar-header">
          <Activity className="brand-icon" size={32} />
          <h2>MindWell</h2>
        </div>
        <div className="nav-links">
          <NavLink icon={<BarChart2 />} label="Progress" id="progress" active={activeTab} set={setActiveTab} />
          <NavLink icon={<Calendar />} label="Schedule Tracker" id="schedule" active={activeTab} set={setActiveTab} />
          <NavLink icon={<CheckSquare />} label="Daily Check-In" id="checkin" active={activeTab} set={setActiveTab} />
          <NavLink icon={<Timer />} label="Live Session" id="live" active={activeTab} set={setActiveTab} />
          <NavLink icon={<HistoryIcon />} label="History" id="history" active={activeTab} set={setActiveTab} />
          <NavLink icon={<Eye />} label="Drowsiness Detector" id="drowsiness" active={activeTab} set={setActiveTab} />
          <NavLink icon={<Settings />} label="Settings" id="settings" active={activeTab} set={setActiveTab} />
        </div>
        <div className="sidebar-footer">
          <div className="user-info">
            <div className="avatar">{user.charAt(0).toUpperCase()}</div>
            <span>{user}</span>
          </div>
          <button onClick={onLogout} className="logout-btn">
            <LogOut size={18} /> Logout
          </button>
        </div>
      </nav>
      <main className="main-content">
        <header className="topbar">
          <h1>Welcome back, {user} 🧘</h1>
        </header>
        <div className="content-area">
          {renderContent()}
        </div>
      </main>
    </div>
  );
}

function NavLink({ icon, label, id, active, set }) {
  return (
    <button className={`nav-link ${active === id ? 'active' : ''}`} onClick={() => set(id)}>
      {icon} <span>{label}</span>
    </button>
  );
}

// ============== PROGRESS TAB ==============
function ProgressTab({ username }) {
  const [logs, setLogs] = useState({ distribution: [], total_seconds: 0 });
  const [burnout, setBurnout] = useState({ burnout_score: 0, age: 25 });
  const [entropy, setEntropy] = useState({ burnout_coefficient: 0, mouse_entropy: 0, typing_variance: 0, lexical_diversity: 1, switch_back_latency: 0 });

  useEffect(() => {
    const fetchData = () => {
      api.get('/logs/today').then(res => setLogs(res.data)).catch(console.error);
      if (username) {
        api.get(`/metrics/burnout-score?username=${username}`).then(res => setBurnout(res.data)).catch(console.error);
        api.get(`/metrics/entropy?username=${username}`).then(res => setEntropy(res.data)).catch(console.error);
      }
    };
    fetchData();
    const inv = setInterval(fetchData, 3000); // Fast live polling
    return () => clearInterval(inv);
  }, [username]);

  const totalHrs = Math.floor(logs.total_seconds / 3600);
  const totalMins = Math.floor((logs.total_seconds % 3600) / 60);

  // Simplified custom gauge
  const getBurnoutColor = (score) => {
    if (score < 40) return '#00C851';
    if (score < 70) return '#ffbb33';
    return '#ff4444';
  };

  return (
    <div className="tab-container animate-fade-in">
      <h2>Analytics Hub</h2>
      <div className="grid-2-1">
        <SpotlightCard className="glass">
          <h3>Screen Time Distribution</h3>
          {logs.distribution.length === 0 ? (
            <p className="text-muted">No activity logged for today yet. Make sure tracker.py is running!</p>
          ) : (
            <>
              <div className="metric-large">
                <span className="metric-value">{totalHrs}h {totalMins}m</span>
                <span className="metric-label">Total Active Time Today</span>
              </div>
              <div className="chart-container" style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={logs.distribution} dataKey="total_seconds" nameKey="category" cx="50%" cy="50%" outerRadius={100} label>
                      {logs.distribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[entry.category] || COLORS.Unknown} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </SpotlightCard>
        <SpotlightCard className="glass flex-center-col" style={{ alignItems: 'flex-start' }}>
          <h3 style={{ marginBottom: '1.5rem', alignSelf: 'center' }}>Burnout Risk Score</h3>
          <div style={{ width: '100%' }}>
            <div className="flex-between" style={{ marginBottom: '0.8rem' }}>
              <span style={{ fontSize: '1rem', fontWeight: 600, color: '#aaa' }}>Current Risk</span>
              <span style={{ fontSize: '1.4rem', fontWeight: 800, color: getBurnoutColor(burnout.burnout_score || 0) }}>
                {Math.round(burnout.burnout_score || 0)}%
              </span>
            </div>

            <div style={{ width: '100%', height: '24px', background: 'var(--border-dark)', borderRadius: '12px', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${Math.max(0, Math.min(100, burnout.burnout_score || 0))}%`,
                  background: getBurnoutColor(burnout.burnout_score || 0),
                  transition: 'width 0.5s ease-out, background-color 0.5s ease'
                }}
              />
            </div>
          </div>
          <p className="text-center w-full mt-4" style={{ fontSize: '0.9rem' }}>
            Score is adjusted based on {burnout.age || 25} yrs old resilient factors. Keep it under 40%.
          </p>
        </SpotlightCard>
      </div>

      <div className="grid-2 mt-4 animate-fade-in" style={{ animationDelay: '0.2s' }}>
        <SpotlightCard className="glass">
          <h3>The Entropy Gap (Live)</h3>
          <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '15px' }}>
            Tracking mechanical entropy and semantic compression to predict burnout.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <div style={{ background: 'var(--bg-glass)', padding: '15px', borderRadius: '12px', display: 'flex', flexDirection: 'column' }}>
              <span className="metric-label" style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Burnout Coefficient (β)</span>
              <span className="metric-value" style={{ fontSize: '1.4rem', fontWeight: 'bold' }}>{entropy?.burnout_coefficient?.toFixed(2) || '0.00'}</span>
            </div>
            <div style={{ background: 'var(--bg-glass)', padding: '15px', borderRadius: '12px', display: 'flex', flexDirection: 'column' }}>
              <span className="metric-label" style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Mouse Entropy (H)</span>
              <span className="metric-value" style={{ fontSize: '1.4rem', fontWeight: 'bold' }}>{entropy?.mouse_entropy?.toFixed(2) || '0.00'}</span>
            </div>
            <div style={{ background: 'var(--bg-glass)', padding: '15px', borderRadius: '12px', display: 'flex', flexDirection: 'column' }}>
              <span className="metric-label" style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Typing Variance</span>
              <span className="metric-value" style={{ fontSize: '1.4rem', fontWeight: 'bold' }}>{entropy?.typing_variance?.toFixed(2) || '0.00'}</span>
            </div>
            <div style={{ background: 'var(--bg-glass)', padding: '15px', borderRadius: '12px', display: 'flex', flexDirection: 'column' }}>
              <span className="metric-label" style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Lexical Diversity</span>
              <span className="metric-value" style={{ fontSize: '1.4rem', fontWeight: 'bold' }}>{(entropy?.lexical_diversity * 100)?.toFixed(1) || '100.0'}%</span>
            </div>
          </div>
        </SpotlightCard>

        <SpotlightCard className="glass flex-center-col" style={{ justifyContent: 'center' }}>
           <h3 style={{ alignSelf: 'flex-start', marginBottom: '10px' }}>Context-Reload Penalty</h3>
           <div className="metric-large" style={{ margin: 'auto' }}>
             <span className="metric-value" style={{ fontSize: '3rem', color: 'var(--primary)' }}>{entropy?.switch_back_latency?.toFixed(1) || '0.0'}s</span>
             <span className="metric-label">Switch-Back Latency</span>
           </div>
           <p className="text-center w-full mt-4" style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '80%' }}>
             Time from switching off a distracting app back to work before your first meaningful keystroke. A higher penalty indicates cognitive fatigue.
           </p>
        </SpotlightCard>
      </div>
    </div>
  );
}

// ============== CHECK-IN TAB ==============
function CheckInTab({ username }) {
  const [sleep, setSleep] = useState(7);
  const [stress, setStress] = useState(5);
  const [msg, setMsg] = useState('');

  const submitMetrics = async (e) => {
    e.preventDefault();
    try {
      await api.post('/metrics/daily', { hours_sleep: sleep, stress_level: stress, username });
      setMsg('Daily metrics saved successfully!');
      setTimeout(() => setMsg(''), 3000);
    } catch (err) {
      setMsg('Error saving metrics.');
    }
  };

  return (
    <div className="tab-container animate-fade-in">
      <h2>Daily Wellness Check</h2>
      <p>Take a moment to reflect on your well-being.</p>
      <SpotlightCard className="glass form-card">
        <form onSubmit={submitMetrics}>
          {msg && <div className="alert success">{msg}</div>}
          <div className="input-group">
            <label>Hours of Sleep: {sleep} hr(s)</label>
            <input type="range" min="0" max="14" step="0.5" value={sleep} onChange={e => setSleep(parseFloat(e.target.value))} />
          </div>
          <div className="input-group">
            <label>Subjective Stress Level: {stress} (1=low, 10=high)</label>
            <input type="range" min="1" max="10" step="1" value={stress} onChange={e => setStress(parseInt(e.target.value))} />
          </div>
          <button type="submit" className="btn full-width mt-3">Save Metrics</button>
        </form>
      </SpotlightCard>
    </div>
  );
}

// ============== LIVE SESSION TAB ==============
function LiveSessionTab() {
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [liveLog, setLiveLog] = useState(null);
  const [appStats, setAppStats] = useState([]);

  useEffect(() => {
    let interval;
    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    } else if (timeLeft === 0) {
      setIsRunning(false);
    }
    return () => clearInterval(interval);
  }, [isRunning, timeLeft]);

  useEffect(() => {
    const fetchLive = () => {
      api.get('/logs/live').then(res => setLiveLog(res.data)).catch(console.error);
      api.get('/logs/apps/today').then(res => setAppStats(res.data.apps || [])).catch(console.error);
    };
    fetchLive();
    const inv = setInterval(fetchLive, 5000);
    return () => clearInterval(inv);
  }, []);

  const mins = String(Math.floor(timeLeft / 60)).padStart(2, '0');
  const secs = String(timeLeft % 60).padStart(2, '0');

  return (
    <div className="tab-container animate-fade-in">
      <h2>Focus Hub</h2>
      <div className="grid-2-1">
        <SpotlightCard className="glass flex-center-col timer-card">
          <h3>Deep Work Timer</h3>
          <div className="timer-display">{mins}:{secs}</div>
          <div className="timer-controls">
            <button className="btn" onClick={() => setIsRunning(true)}>Start</button>
            <button className="btn outline" onClick={() => setIsRunning(false)}>Pause</button>
            <button className="btn outline" onClick={() => { setIsRunning(false); setTimeLeft(25 * 60); }}>Reset</button>
          </div>
        </SpotlightCard>
        <SpotlightCard className="glass">
          <h3>Live App Activity</h3>
          <button className="btn outline btn-sm mb-3" onClick={() => api.get('/logs/live').then(res => setLiveLog(res.data))}>Refresh</button>
          {liveLog && liveLog.title ? (
            <div className="live-activity-box" style={{ borderLeftColor: COLORS[liveLog.category] || COLORS.Unknown }}>
              <h4 className="ellipsis">{liveLog.title}</h4>
              <p style={{ color: COLORS[liveLog.category] || COLORS.Unknown }}>
                <strong>Category: {liveLog.category}</strong>
              </p>
              <small className="text-muted">Last Updated: {liveLog.timestamp}</small>
            </div>
          ) : (
            <p className="text-muted">No activity logged yet.</p>
          )}
        </SpotlightCard>
      </div>

      <SpotlightCard className="glass">
        <h3>App Usage vs Time (Today)</h3>
        {appStats.length === 0 ? (
          <p className="text-muted">No app activity logged yet.</p>
        ) : (
          <div className="chart-container" style={{ height: 350, marginTop: '20px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={appStats} margin={{ left: 40, right: 30, top: 20, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.1} vertical={false} />
                <XAxis dataKey="app_name" type="category" tick={{ fontSize: 12 }} interval={0} angle={-45} textAnchor="end" height={80} />
                <YAxis type="number" tickFormatter={(val) => `${Math.round(val / 60)}m`} />
                <Tooltip formatter={(value) => [`${Math.round(value / 60)} mins`, 'Time']} />
                <Legend verticalAlign="top" height={36} />
                <Bar dataKey="total_seconds" name="Time Used" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </SpotlightCard>
    </div>
  );
}

// ============== HISTORY TAB ==============
function HistoryTab() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [hist, setHist] = useState({ distribution: [], total_seconds: 0 });
  const [trends, setTrends] = useState([]);

  useEffect(() => {
    api.get(`/logs/history?date=${date}`).then(res => setHist(res.data)).catch(console.error);
  }, [date]);

  useEffect(() => {
    api.get('/logs/trends').then(res => setTrends(res.data.trends)).catch(console.error);
  }, []);

  return (
    <div className="tab-container animate-fade-in">
      <h2>Activity History</h2>

      <SpotlightCard className="glass mb-4">
        <div className="flex-between">
          <h3>Daily Summary</h3>
          <input type="date" className="date-picker input" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        {hist.distribution.length === 0 ? (
          <p className="text-muted mt-2">No activity logged for {date}.</p>
        ) : (
          <div className="chart-container" style={{ height: 300, marginTop: '20px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={hist.distribution} dataKey="total_seconds" nameKey="category" cx="50%" cy="50%" outerRadius={100} label>
                  {hist.distribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[entry.category] || COLORS.Unknown} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </SpotlightCard>

      <SpotlightCard className="glass">
        <h3>Trends Over Time</h3>
        {trends.length === 0 ? <p className="text-muted">No trend data available.</p> : (
          <div className="chart-container" style={{ height: 350, marginTop: '20px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trends}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="log_date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="hours" stackId="a" fill="#5e17eb" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </SpotlightCard>
    </div>
  );
}

// ============== SETTINGS TAB ==============
function SettingsTab({ user, age, setAge, onLogout, onUpdateUser }) {
  const [msg, setMsg] = useState('');

  const [newUsername, setNewUsername] = useState(user);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [credMsg, setCredMsg] = useState('');

  const updateProfile = async (e) => {
    e.preventDefault();
    try {
      await api.put('/user/profile', { username: user, age });
      setMsg('Profile updated!');
      setTimeout(() => setMsg(''), 3000);
    } catch (err) {
      setMsg('Error updating profile.');
    }
  };

  const updateCredentials = async (e) => {
    e.preventDefault();
    if (!newUsername.trim() || !currentPassword.trim()) {
      setCredMsg('Username and Current Password are required');
      return;
    }
    try {
      await api.put('/user/credentials', {
        old_username: user,
        current_password: currentPassword,
        new_username: newUsername,
        new_password: newPassword
      });
      setCredMsg('Credentials updated successfully!');
      if (newUsername !== user) {
        onUpdateUser(newUsername);
      }
      setNewPassword('');
      setTimeout(() => setCredMsg(''), 3000);
    } catch (err) {
      setCredMsg(err.response?.data?.detail || 'Error updating credentials');
    }
  };

  return (
    <div className="tab-container animate-fade-in">
      <h2>Settings & Profile</h2>
      <div className="grid-2 mt-4">
        <SpotlightCard className="glass">
          <form onSubmit={updateProfile}>
            <h3>Profile Details</h3>
            {msg && <div className="alert success">{msg}</div>}
            <div className="input-group">
              <label>Your Age</label>
              <input type="number" min="10" max="120" value={age} onChange={e => setAge(parseInt(e.target.value))} required className="input" />
            </div>
            <button type="submit" className="btn mt-4">Save Profile Info</button>
          </form>
        </SpotlightCard>

        <SpotlightCard className="glass">
          <form onSubmit={updateCredentials}>
            <h3>Account Settings</h3>
            {credMsg && <div className="alert mt-3" style={{ padding: '10px', borderRadius: '8px', background: credMsg.includes('Error') || credMsg.includes('empty') ? 'rgba(255,68,68,0.1)' : 'rgba(0,200,81,0.1)', color: credMsg.includes('Error') || credMsg.includes('empty') ? '#ff4444' : '#00C851' }}>{credMsg}</div>}

            <div className="input-group mt-3">
              <label>Username</label>
              <input type="text" className="input" value={newUsername} onChange={e => setNewUsername(e.target.value)} required />
            </div>

            <div className="input-group mt-3">
              <label>Current Password</label>
              <input type="password" className="input" placeholder="Required for any account changes" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required />
            </div>

            <div className="input-group mt-3">
              <label>New Password (Optional)</label>
              <input type="password" className="input" placeholder="Leave blank to keep current password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
            </div>

            <button type="submit" className="btn outline mt-4 w-full">Update Login Info</button>
          </form>
        </SpotlightCard>
      </div>
    </div>
  );
}

const defaultDistractions = ["youtube", "game", "netflix", "instagram", "facebook", "twitter", "tiktok", "whatsapp", "valorant", "steam", "epic games", "roblox", "minecraft", "riot client", "league of legends"];

// ============== SCHEDULE TAB ==============
function ScheduleTab({ username }) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [schedules, setSchedules] = useState([]);

  const [scheduleIdToEdit, setScheduleIdToEdit] = useState(null);
  const [title, setTitle] = useState('');
  const [startTime, setStartTime] = useState(null);
  const [endTime, setEndTime] = useState(null);
  const [scheduleDate, setScheduleDate] = useState(new Date().toISOString().split('T')[0]);
  const [isScheduleMode, setIsScheduleMode] = useState(false);
  const [blockedApps, setBlockedApps] = useState(defaultDistractions);
  const [msg, setMsg] = useState({ text: '', type: '' });
  
  const [aiPrompt, setAiPrompt] = useState('');
  const [chatLog, setChatLog] = useState([{ sender: 'ai', text: 'Hi! Tell me what you want to schedule.' }]);
  const [pendingSchedule, setPendingSchedule] = useState(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  const fetchSchedules = () => {
    api.get(`/schedules?username=${username}&date=${date}`).then(res => setSchedules(res.data)).catch(console.error);
  };

  const handleAiSubmit = async (e) => {
    e.preventDefault();
    if (!aiPrompt.trim()) return;
    
    const userMsg = { sender: 'user', text: aiPrompt };
    setChatLog(prev => [...prev, userMsg]);
    setAiPrompt('');
    setIsAiLoading(true);
    
    try {
      const res = await api.post('/assistant/schedule', { prompt: userMsg.text, username, date });
      const aiMsg = { sender: 'ai', text: res.data.suggestion };
      setChatLog(prev => [...prev, aiMsg]);
      if (res.data.parsed) {
        setPendingSchedule(res.data.parsed);
      } else {
        setPendingSchedule(null);
      }
      
      if (res.data.action_taken) {
          fetchSchedules();
      }
    } catch (err) {
      setChatLog(prev => [...prev, { sender: 'ai', text: 'Sorry, I encountered an error.' }]);
    } finally {
      setIsAiLoading(false);
    }
  };

  const confirmAiSchedule = async () => {
    if (!pendingSchedule) return;
    setIsAiLoading(true);
    try {
      if (Array.isArray(pendingSchedule)) {
        for (const sch of pendingSchedule) {
          await api.post('/schedules', { ...sch, username });
        }
      } else {
        await api.post('/schedules', { ...pendingSchedule, username });
      }
      fetchSchedules();
      setChatLog(prev => [...prev, { sender: 'ai', text: 'Awesome! I have added it to your schedule.' }]);
      setPendingSchedule(null);
    } catch (err) {
      const detail = err.response?.data?.detail;
      const errorText = typeof detail === 'string' ? detail : (Array.isArray(detail) ? detail[0].msg : 'Error saving schedule');
      setChatLog(prev => [...prev, { sender: 'ai', text: errorText }]);
    } finally {
      setIsAiLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedules();
  }, [username, date]);

  const saveSchedule = async (e) => {
    e.preventDefault();
    if (!startTime || !endTime) {
      setMsg({ text: 'Please select start and end times', type: 'error' });
      return;
    }

    const formattedStart = startTime.format('HH:mm');
    const formattedEnd = endTime.format('HH:mm');
    const today = dayjs().format('YYYY-MM-DD');

    if (scheduleDate === today) {
      if (startTime.isBefore(dayjs(), 'minute')) {
        setMsg({ text: 'Cannot schedule a task before the current time', type: 'error' });
        setTimeout(() => setMsg({ text: '', type: '' }), 4000);
        return;
      }
    } else if (scheduleDate < today) {
      setMsg({ text: 'Cannot schedule a task on a past date', type: 'error' });
      setTimeout(() => setMsg({ text: '', type: '' }), 4000);
      return;
    }

    try {
      if (scheduleIdToEdit) {
        await api.put(`/schedules/${scheduleIdToEdit}`, {
          username,
          date: scheduleDate,
          title,
          start_time: formattedStart,
          end_time: formattedEnd,
          is_schedule_mode: isScheduleMode ? 1 : 0,
          blocked_apps: isScheduleMode ? blockedApps.join(',') : ''
        });
        setMsg({ text: 'Schedule updated!', type: 'success' });
      } else {
        await api.post('/schedules', {
          username,
          date: scheduleDate,
          title,
          start_time: formattedStart,
          end_time: formattedEnd,
          is_schedule_mode: isScheduleMode ? 1 : 0,
          blocked_apps: isScheduleMode ? blockedApps.join(',') : ''
        });
        setMsg({ text: 'Schedule created!', type: 'success' });
      }
      setTitle(''); setStartTime(null); setEndTime(null); setIsScheduleMode(false); setScheduleIdToEdit(null); setBlockedApps(defaultDistractions);
      fetchSchedules();
      setTimeout(() => setMsg({ text: '', type: '' }), 3000);
    } catch (err) {
      setMsg({ text: err.response?.data?.detail || 'Error saving schedule', type: 'error' });
      setTimeout(() => setMsg({ text: '', type: '' }), 4000);
    }
  };

  const toggleComplete = async (id, currentStatus) => {
    try {
      await api.put(`/schedules/${id}/status`, { is_completed: currentStatus ? 0 : 1 });
      fetchSchedules();
    } catch (err) {
      console.error(err);
    }
  };

  const handleEdit = (sch) => {
    setScheduleIdToEdit(sch.id);
    setTitle(sch.title);
    setStartTime(dayjs(`${sch.date}T${sch.start_time}`));
    setEndTime(dayjs(`${sch.date}T${sch.end_time}`));
    setScheduleDate(sch.date);
    setIsScheduleMode(Boolean(sch.is_schedule_mode));
    setBlockedApps(sch.blocked_apps ? sch.blocked_apps.split(',') : defaultDistractions);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this schedule?")) return;
    try {
      await api.delete(`/schedules/${id}`);
      fetchSchedules();
      setMsg({ text: 'Schedule deleted', type: 'success' });
      setTimeout(() => setMsg({ text: '', type: '' }), 3000);
      if (scheduleIdToEdit === id) {
        setTitle(''); setStartTime(null); setEndTime(null); setIsScheduleMode(false); setScheduleIdToEdit(null); setBlockedApps(defaultDistractions);
      }
    } catch (err) {
      setMsg({ text: 'Error deleting schedule', type: 'error' });
    }
  };

  const muiTheme = createTheme({
    palette: {
      mode: 'dark',
      primary: {
        main: '#5e17eb',
      },
    },
  });

  return (
    <ThemeProvider theme={muiTheme}>
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <div className="tab-container animate-fade-in">
          <div className="flex-between">
            <h2>Schedule Tracker</h2>
            <input type="date" className="date-picker input" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <p>Plan your day with 5-minute stress-free breaks in between.</p>

          <div className="grid-2 mt-4">
            <SpotlightCard className="glass form-card">
              <form onSubmit={saveSchedule}>
                <h3>{scheduleIdToEdit ? 'Edit Schedule' : 'Add New Schedule'}</h3>
                {msg.text && <div className="alert" style={{ background: msg.type === 'error' ? 'rgba(255,68,68,0.2)' : 'rgba(0,200,81,0.2)', color: msg.type === 'error' ? '#ff4444' : '#00C851', marginBottom: '1rem', padding: '0.8rem', borderRadius: '8px' }}>{msg.text}</div>}
                <div className="input-group">
                  <label>Title</label>
                  <input type="text" className="input" value={title} onChange={e => setTitle(e.target.value)} required placeholder="e.g., Math Study" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div className="input-group" style={{ margin: 0 }}>
                    <label>Start Time</label>
                    <div style={{ background: 'var(--bg-glass)', borderRadius: '8px', padding: '4px' }}>
                      <MobileTimePicker
                        value={startTime}
                        onChange={(newValue) => setStartTime(newValue)}
                        viewRenderers={{ hours: renderTimeViewClock, minutes: renderTimeViewClock, seconds: renderTimeViewClock }}
                        slotProps={{
                          textField: {
                            fullWidth: true, size: 'small', variant: 'standard',
                            InputProps: { disableUnderline: true, style: { paddingLeft: '8px', paddingRight: '8px' } }
                          }
                        }}
                      />
                    </div>
                  </div>
                  <div className="input-group" style={{ margin: 0 }}>
                    <label>End Time</label>
                    <div style={{ background: 'var(--bg-glass)', borderRadius: '8px', padding: '4px' }}>
                      <MobileTimePicker
                        value={endTime}
                        onChange={(newValue) => setEndTime(newValue)}
                        viewRenderers={{ hours: renderTimeViewClock, minutes: renderTimeViewClock, seconds: renderTimeViewClock }}
                        slotProps={{
                          textField: {
                            fullWidth: true, size: 'small', variant: 'standard',
                            InputProps: { disableUnderline: true, style: { paddingLeft: '8px', paddingRight: '8px' } }
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>
                <div className="input-group mt-3">
                  <label>Schedule Date</label>
                  <input type="date" className="input" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} required />
                </div>
                <div className="flex-between toggle-row mt-3 mb-3">
                  <span>Enable Schedule Mode (Blocks Distractions)</span>
                  <button type="button" className={`toggle-btn ${isScheduleMode ? 'on' : 'off'}`} onClick={() => setIsScheduleMode(!isScheduleMode)}>
                    <div className="toggle-circle"></div>
                  </button>
                </div>

                {isScheduleMode && (
                  <div className="input-group mb-3" style={{ border: '1px solid var(--border-dark)', padding: '15px', borderRadius: '12px', background: 'var(--bg-glass)' }}>
                    <label style={{ marginBottom: '5px', display: 'block', fontSize: '1rem', fontWeight: 600 }}>Specify Blocked Apps</label>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '15px' }}>Uncheck any apps you want to leave open for this schedule.</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {defaultDistractions.map(app => (
                        <div
                          key={app}
                          onClick={() => {
                            if (blockedApps.includes(app)) {
                              setBlockedApps(blockedApps.filter(a => a !== app));
                            } else {
                              setBlockedApps([...blockedApps, app]);
                            }
                          }}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '20px',
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            background: blockedApps.includes(app) ? 'var(--primary-color)' : 'transparent',
                            border: `1px solid ${blockedApps.includes(app) ? 'var(--primary-color)' : 'var(--border-light)'}`,
                            color: blockedApps.includes(app) ? '#fff' : 'var(--text-light)',
                            textTransform: 'capitalize',
                            transition: 'all 0.2s',
                            userSelect: 'none'
                          }}
                        >
                          {app} {blockedApps.includes(app) ? '🛡️' : ''}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="submit" className="btn full-width mt-3">{scheduleIdToEdit ? 'Update Schedule' : 'Add Schedule'}</button>
                  {scheduleIdToEdit && (
                    <button type="button" className="btn outline mt-3" onClick={() => { setScheduleIdToEdit(null); setTitle(''); setStartTime(null); setEndTime(null); setIsScheduleMode(false); setBlockedApps(defaultDistractions); setScheduleDate(date); }}>Cancel</button>
                  )}
                </div>
              </form>
            </SpotlightCard>

            <SpotlightCard className="glass">
              <h3>Your Schedule for {date}</h3>
              {schedules.length === 0 ? (
                <p className="text-muted mt-3">No schedules planned for this date.</p>
              ) : (
                <div className="schedule-list mt-3" style={{ maxHeight: '350px', overflowY: 'auto', paddingRight: '5px' }}>
                  {schedules.map(sch => (
                    <div key={sch.id} style={{
                      padding: '1rem',
                      marginBottom: '10px',
                      borderRadius: '12px',
                      background: 'var(--bg-glass)',
                      borderLeft: sch.is_schedule_mode ? '4px solid #5e17eb' : '4px solid #aaa',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      opacity: sch.is_completed ? 0.6 : 1,
                      transition: 'opacity 0.3s'
                    }}>
                      <div style={{ flex: 1 }}>
                        <h4 style={{ margin: 0, textDecoration: sch.is_completed ? 'line-through' : 'none', color: sch.is_completed ? '#888' : '#ffffff' }}>{sch.title}</h4>
                        <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: sch.is_completed ? '#666' : '#d0d0d0', textDecoration: sch.is_completed ? 'line-through' : 'none' }}>
                          {sch.start_time} - {sch.end_time} {sch.is_schedule_mode && ' 🛡️'}
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleEdit(sch)}
                          style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                          title="Edit"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(sch.id)}
                          style={{ background: 'transparent', border: 'none', color: '#ff4444', cursor: 'pointer', padding: '4px' }}
                          title="Delete"
                        >
                          <Trash2 size={18} />
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleComplete(sch.id, sch.is_completed)}
                          style={{
                            background: sch.is_completed ? '#00C851' : 'rgba(255, 255, 255, 0.05)',
                            border: sch.is_completed ? 'none' : '2px solid rgba(255, 255, 255, 0.4)',
                            color: sch.is_completed ? '#fff' : 'rgba(255, 255, 255, 0.15)',
                            borderRadius: '50%',
                            width: '28px',
                            height: '28px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            transition: 'all 0.3s'
                          }}
                        >
                          ✓
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SpotlightCard>
          </div>

          {/* AI Assistant Section */}
          <SpotlightCard className="glass mt-4">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
              <Bot size={24} color="#5e17eb" />
              <h3 style={{ margin: 0 }}>Smart Assistant</h3>
            </div>
            
            <div style={{ background: 'var(--bg-glass)', borderRadius: '12px', padding: '15px', height: '250px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {chatLog.map((log, i) => (
                <div key={i} style={{
                  alignSelf: log.sender === 'user' ? 'flex-end' : 'flex-start',
                  background: log.sender === 'user' ? '#5e17eb' : 'rgba(255, 255, 255, 0.1)',
                  padding: '10px 15px',
                  borderRadius: '12px',
                  maxWidth: '80%',
                  color: '#fff',
                  borderBottomRightRadius: log.sender === 'user' ? '2px' : '12px',
                  borderBottomLeftRadius: log.sender === 'ai' ? '2px' : '12px'
                }}>
                  {log.text}
                </div>
              ))}
              {isAiLoading && (
                <div style={{ alignSelf: 'flex-start', background: 'rgba(255, 255, 255, 0.1)', padding: '10px 15px', borderRadius: '12px', maxWidth: '80%', color: '#aaa', borderBottomLeftRadius: '2px' }}>
                  Typing...
                </div>
              )}
            </div>

            {pendingSchedule && (
              <div style={{ background: 'rgba(94, 23, 235, 0.15)', border: '1px solid #5e17eb', borderRadius: '12px', padding: '15px', marginTop: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxHeight: '200px', overflowY: 'auto' }}>
                <div>
                  {Array.isArray(pendingSchedule) ? pendingSchedule.map((sch, i) => (
                    <div key={i} style={{ marginBottom: i < pendingSchedule.length - 1 ? '10px' : 0 }}>
                      <h4 style={{ margin: '0 0 5px 0' }}>{sch.title}</h4>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: '#d0d0d0' }}>{sch.start_time} - {sch.end_time} {sch.is_schedule_mode ? '🛡️ Focus Mode' : 'Normal Mode'}</p>
                    </div>
                  )) : (
                    <>
                      <h4 style={{ margin: '0 0 5px 0' }}>{pendingSchedule.title}</h4>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: '#d0d0d0' }}>{pendingSchedule.start_time} - {pendingSchedule.end_time} {pendingSchedule.is_schedule_mode ? '🛡️ Focus Mode' : 'Normal Mode'}</p>
                    </>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '10px', alignSelf: 'flex-start' }}>
                  <button onClick={() => setPendingSchedule(null)} className="btn outline btn-sm">Cancel</button>
                  <button onClick={confirmAiSchedule} className="btn btn-sm" disabled={isAiLoading}>Confirm</button>
                </div>
              </div>
            )}

            <form onSubmit={handleAiSubmit} style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
              <input
                type="text"
                className="input"
                style={{ flex: 1 }}
                placeholder="e.g. Schedule 2 hours of Deep Work from 10am"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                disabled={isAiLoading}
              />
              <button type="submit" className="btn" style={{ padding: '0 15px' }} disabled={isAiLoading || !aiPrompt.trim()}>
                <Send size={18} />
              </button>
            </form>
          </SpotlightCard>

        </div>
      </LocalizationProvider>
    </ThemeProvider>
  );
}

export default Dashboard;
