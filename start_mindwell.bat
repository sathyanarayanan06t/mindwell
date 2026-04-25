@echo off
echo Starting MindWell Services...

echo Starting API Server...
start cmd /k "python api.py"

echo Starting Tracker Script...
start cmd /k "python tracker.py"

echo Starting React UI Frontend...
start cmd /k "cd ui && npm run dev"

echo All services attempt to start in new windows!
echo Once you're done, you can just close the command prompt windows to stop them.
