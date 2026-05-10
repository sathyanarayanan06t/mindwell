import React, { useRef, useState } from 'react';
import './SpotlightCard.css';

export default function SpotlightCard({ children, className = '', spotlightColor = "rgba(123, 66, 245, 0.15)", style = {} }) {
  const divRef = useRef(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);

  const handleMouseMove = (e) => {
    if (!divRef.current) return;
    const rect = divRef.current.getBoundingClientRect();
    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <div 
      ref={divRef} 
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setOpacity(1)}
      onMouseLeave={() => setOpacity(0)}
      className={`spotlight-wrapper card ${className}`}
      style={style}
    >
      <div 
        className="spotlight-effect"
        style={{
           opacity,
           background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, ${spotlightColor}, transparent 40%)`
        }}
      />
      <div className="spotlight-content">
        {children}
      </div>
    </div>
  );
}
