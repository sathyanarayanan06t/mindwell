import React from 'react';
import Dashboard from './components/Dashboard';
import Orb from './components/ReactBits/Orb';

function App() {
  return (
    <Orb
      hoverIntensity={3.28}
      rotateOnHover={false}
      hue={260}
      forceHoverState={false}
      backgroundColor="#0d0d10"
    >
      <Dashboard user="Demo" />
    </Orb>
  );
}

export default App;
