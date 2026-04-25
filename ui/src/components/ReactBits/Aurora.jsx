import React, { useEffect } from 'react';
import './Aurora.css';

export default function Aurora({ children, colorStops = ["#5e17eb", "#ff4444", "#33b5e5"] }) {
  useEffect(() => {
    document.documentElement.style.setProperty("--color-1", colorStops[0]);
    document.documentElement.style.setProperty("--color-2", colorStops[1]);
    document.documentElement.style.setProperty("--color-3", colorStops[2]);
  }, [colorStops]);

  return (
    <div className="aurora-container">
      <div className="aurora-hero">
        <div className="aurora-layer aurora-1"></div>
        <div className="aurora-layer aurora-2"></div>
        <div className="aurora-layer aurora-3"></div>
      </div>
      <div className="aurora-content">
        {children}
      </div>
    </div>
  );
}
