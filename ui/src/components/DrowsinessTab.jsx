import React, { useRef, useState, useEffect } from 'react';
import Webcam from 'react-webcam';
import * as tf from '@tensorflow/tfjs';
import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection';
import SpotlightCard from './ReactBits/SpotlightCard';

const DrowsinessTab = ({ onRedirectToSchedule }) => {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [model, setModel] = useState(null);
  const [drowsinessStatus, setDrowsinessStatus] = useState('Awake');
  const [earValue, setEarValue] = useState(0);
  const closedEyesFramesCounter = useRef(0);
  const EAR_THRESHOLD = 0.25;
  const CLOSED_EYES_FRAMES_THRESHOLD = 20;

  useEffect(() => {
    const loadModel = async () => {
      await tf.setBackend('webgl');
      const loadedModel = await faceLandmarksDetection.createDetector(
        faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh,
        {
          runtime: 'tfjs',
          maxFaces: 1,
        }
      );
      setModel(loadedModel);
    };
    loadModel();
  }, []);

  const distance = (p1, p2) => {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
  };

  const calculateEAR = (eye) => {
    const p1 = eye[0];
    const p2 = eye[1];
    const p3 = eye[2];
    const p4 = eye[3];
    const p5 = eye[4];
    const p6 = eye[5];

    const v1 = distance(p2, p6);
    const v2 = distance(p3, p5);
    const h = distance(p1, p4);

    return (v1 + v2) / (2.0 * h);
  };

  const detectDrowsiness = async () => {
    if (
      typeof webcamRef.current !== 'undefined' &&
      webcamRef.current !== null &&
      webcamRef.current.video.readyState === 4 &&
      model
    ) {
      const video = webcamRef.current.video;
      const videoWidth = webcamRef.current.video.videoWidth;
      const videoHeight = webcamRef.current.video.videoHeight;
      webcamRef.current.video.width = videoWidth;
      webcamRef.current.video.height = videoHeight;
      canvasRef.current.width = videoWidth;
      canvasRef.current.height = videoHeight;

      const faces = await model.estimateFaces(video);

      if (faces.length > 0) {
        const keypoints = faces[0].keypoints;
        const leftEyeIndices = [33, 160, 158, 133, 153, 144];
        const rightEyeIndices = [362, 385, 387, 263, 373, 380];

        const leftEye = leftEyeIndices.map(i => keypoints[i]);
        const rightEye = rightEyeIndices.map(i => keypoints[i]);

        const leftEAR = calculateEAR(leftEye);
        const rightEAR = calculateEAR(rightEye);
        const avgEAR = (leftEAR + rightEAR) / 2.0;

        setEarValue(avgEAR);

        if (avgEAR < EAR_THRESHOLD) {
          closedEyesFramesCounter.current += 1;
          if (closedEyesFramesCounter.current >= CLOSED_EYES_FRAMES_THRESHOLD) {
            setDrowsinessStatus('Drowsy');
            handleDrowsyAlert();
          }
        } else {
          closedEyesFramesCounter.current = 0;
          setDrowsinessStatus('Awake');
        }
      }
    }
  };

  useEffect(() => {
    let interval = null;
    if (isDetecting) {
      interval = setInterval(() => {
        detectDrowsiness();
      }, 100);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isDetecting, model]);

  const handleDrowsyAlert = () => {
    setIsDetecting(false);
    const userRes = window.confirm("Drowsiness Detected! You seem tired. Would you like to take a break and reschedule your tasks?");
    if (userRes) {
      onRedirectToSchedule();
    } else {
      setIsDetecting(true);
      closedEyesFramesCounter.current = 0;
      setDrowsinessStatus('Awake');
    }
  };

  return (
    <div className="tab-container animate-fade-in">
      <h2>Drowsiness Detector</h2>
      <p>Monitor your alertness and get reminders to take breaks.</p>
      
      <div className="grid-2 mt-4">
        <SpotlightCard className="glass flex-center-col timer-card">
          <h3>Camera Feed</h3>
          <div style={{ position: 'relative', width: '100%', maxWidth: '400px', height: '300px', borderRadius: '12px', overflow: 'hidden', background: '#000' }}>
            <Webcam
              ref={webcamRef}
              muted={true}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover'
              }}
            />
            <canvas
              ref={canvasRef}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                zIndex: 9
              }}
            />
          </div>
          <div className="timer-controls mt-3">
            <button className="btn" onClick={() => setIsDetecting(!isDetecting)}>
              {isDetecting ? 'Stop Detection' : 'Start Detection'}
            </button>
          </div>
        </SpotlightCard>

        <SpotlightCard className="glass flex-center-col" style={{ alignItems: 'center' }}>
          <h3>Status</h3>
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <h1 style={{ fontSize: '3rem', color: drowsinessStatus === 'Awake' ? '#00C851' : '#ff4444' }}>
              {drowsinessStatus}
            </h1>
            <p className="mt-3" style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--text-light)' }}>
              EAR Value: {earValue.toFixed(2)}
            </p>
            <p className="mt-2 text-muted text-sm">
              Model: {model ? 'Loaded' : 'Loading...'}
            </p>
          </div>
        </SpotlightCard>
      </div>
    </div>
  );
};

export default DrowsinessTab;
