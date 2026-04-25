import React, { useRef, useEffect, useState } from 'react';
import './Squares.css';

export default function Squares({ 
  direction = 'right',
  speed = 0.5,
  borderColor = 'rgba(255, 255, 255, 0.1)',
  squareSize = 40,
  hoverFillColor = 'rgba(94, 23, 235, 0.4)',
  children
}) {
  const canvasRef = useRef(null);
  const requestRef = useRef(null);
  const numSquaresX = useRef();
  const numSquaresY = useRef();
  const gridOffset = useRef({ x: 0, y: 0 });
  const [hoveredSquare, setHoveredSquare] = useState(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      numSquaresX.current = Math.ceil(canvas.width / squareSize) + 1;
      numSquaresY.current = Math.ceil(canvas.height / squareSize) + 1;
    };

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    const drawGrid = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const startX = Math.floor(gridOffset.current.x / squareSize) * squareSize;
      const startY = Math.floor(gridOffset.current.y / squareSize) * squareSize;

      for (let x = -1; x <= numSquaresX.current; x++) {
        for (let y = -1; y <= numSquaresY.current; y++) {
          const sqX = startX + x * squareSize;
          const sqY = startY + y * squareSize;

          if (
            hoveredSquare &&
            Math.abs(sqX - hoveredSquare.x * squareSize) < squareSize * 0.1 &&
            Math.abs(sqY - hoveredSquare.y * squareSize) < squareSize * 0.1
          ) {
            ctx.fillStyle = hoverFillColor;
            ctx.fillRect(sqX, sqY, squareSize, squareSize);
          }

          ctx.strokeStyle = borderColor;
          ctx.strokeRect(sqX, sqY, squareSize, squareSize);
        }
      }

      ctx.save();
      // Add a fading mask at edges
      const gradient = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, 0,
        canvas.width / 2, canvas.height / 2, canvas.width / 1.2
      );
      gradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      
      ctx.globalCompositeOperation = 'destination-in';
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    };

    const updateAnimation = () => {
      let effectiveSpeed = Math.max(speed, 0.1);
      switch (direction) {
        case 'diagonal':
          gridOffset.current.x = (gridOffset.current.x - effectiveSpeed) % squareSize;
          gridOffset.current.y = (gridOffset.current.y - effectiveSpeed) % squareSize;
          break;
        case 'up':
          gridOffset.current.y = (gridOffset.current.y - effectiveSpeed) % squareSize;
          break;
        case 'right':
          gridOffset.current.x = (gridOffset.current.x + effectiveSpeed) % squareSize;
          break;
        case 'down':
          gridOffset.current.y = (gridOffset.current.y + effectiveSpeed) % squareSize;
          break;
        case 'left':
          gridOffset.current.x = (gridOffset.current.x - effectiveSpeed) % squareSize;
          break;
        default:
          break;
      }

      drawGrid();
      requestRef.current = requestAnimationFrame(updateAnimation);
    };

    const handleMouseMove = (event) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;

      const startX = Math.floor(gridOffset.current.x / squareSize) * squareSize;
      const startY = Math.floor(gridOffset.current.y / squareSize) * squareSize;

      const hoveredSquareX = Math.floor((mouseX - startX) / squareSize);
      const hoveredSquareY = Math.floor((mouseY - startY) / squareSize);

      setHoveredSquare({ x: hoveredSquareX, y: hoveredSquareY });
    };

    const handleMouseLeave = () => {
      setHoveredSquare(null);
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);

    requestRef.current = requestAnimationFrame(updateAnimation);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(requestRef.current);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [direction, speed, borderColor, hoverFillColor, hoveredSquare, squareSize]);

  return (
    <div className="squares-container">
      <canvas ref={canvasRef} className="squares-canvas"></canvas>
      <div className="squares-content">
        {children}
      </div>
    </div>
  );
}
