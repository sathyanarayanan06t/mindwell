import sqlite3
import pandas as pd
from fastapi import FastAPI, HTTPException, Depends
from pydantic import BaseModel
from datetime import datetime, timedelta
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional

import google.generativeai as genai
import json

app = FastAPI(title="MindWell API")

# Setup CORS to allow React UI to communicate with FastAPI
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_NAME = "mindwell.db"

def get_db():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()

class UserRegister(BaseModel):
    username: str
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

class DailyMetric(BaseModel):
    hours_sleep: float
    stress_level: int
    username: str

class ProfileUpdate(BaseModel):
    username: str
    age: int
    mobile_no: Optional[str] = None

class UserCredentialsUpdate(BaseModel):
    old_username: str
    current_password: str
    new_username: str
    new_password: str

class ScheduleCreate(BaseModel):
    username: str
    date: str
    title: str
    start_time: str
    end_time: str
    is_schedule_mode: int
    blocked_apps: Optional[str] = None

class ScheduleUpdateStatus(BaseModel):
    is_completed: int

class ScheduleFullUpdate(BaseModel):
    username: str
    date: str
    title: str
    start_time: str
    end_time: str
    is_schedule_mode: int
    blocked_apps: Optional[str] = None

class AssistantRequest(BaseModel):
    prompt: str
    username: str
    date: str


@app.post("/api/register")
def register(user: UserRegister, db: sqlite3.Connection = Depends(get_db)):
    try:
        cursor = db.cursor()
        cursor.execute("INSERT INTO users (username, password) VALUES (?, ?)", (user.username, user.password))
        db.commit()
        return {"message": "User registered successfully"}
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="Username already exists")

@app.post("/api/login")
def login(user: UserLogin, db: sqlite3.Connection = Depends(get_db)):
    cursor = db.cursor()
    cursor.execute("SELECT age FROM users WHERE username = ? AND password = ?", (user.username, user.password))
    db_user = cursor.fetchone()
    if db_user:
        return {"message": "Logged in successfully", "username": user.username, "age": db_user["age"]}
    else:
        raise HTTPException(status_code=401, detail="Invalid credentials")

@app.get("/api/logs/today")
def get_today_logs(db: sqlite3.Connection = Depends(get_db)):
    today = datetime.now().strftime("%Y-%m-%d")
    query = """
        SELECT category, SUM(duration_seconds) as total_seconds
        FROM app_logs
        WHERE date(timestamp) = ?
        GROUP BY category
    """
    df_logs = pd.read_sql_query(query, db, params=(today,))
    
    if df_logs.empty:
        return {"total_seconds": 0, "distribution": []}
    
    total_seconds = int(df_logs["total_seconds"].sum())
    distribution = df_logs.to_dict(orient="records")
    return {"total_seconds": total_seconds, "distribution": distribution}

@app.get("/api/logs/apps/today")
def get_today_apps(db: sqlite3.Connection = Depends(get_db)):
    today = datetime.now().strftime("%Y-%m-%d")
    query = """
        SELECT window_title as app_name, category, SUM(duration_seconds) as total_seconds
        FROM app_logs
        WHERE date(timestamp) = ?
        GROUP BY window_title
    """
    df_logs = pd.read_sql_query(query, db, params=(today,))
    
    if df_logs.empty:
        return {"apps": []}
        
    def clean_title(title):
        if not title: return "Unknown"
        parts = title.split('-')
        if len(parts) > 1:
            return parts[-1].strip()
        return title[:20] + '...' if len(title) > 20 else title

    df_logs["app_name"] = df_logs["app_name"].apply(clean_title)
    df_grouped = df_logs.groupby("app_name")["total_seconds"].sum().reset_index()
    df_grouped = df_grouped.sort_values(by="total_seconds", ascending=False).head(10)
    
    return {"apps": df_grouped.to_dict(orient="records")}

@app.get("/api/metrics/burnout-score")
def get_burnout_score(username: str, db: sqlite3.Connection = Depends(get_db)):
    cursor = db.cursor()
    cursor.execute("SELECT hours_sleep, stress_level FROM daily_metrics WHERE username=? ORDER BY date DESC LIMIT 1", (username,))
    latest_metric = cursor.fetchone()
    
    cursor.execute("SELECT age FROM users WHERE username=?", (username,))
    user_data = cursor.fetchone()
    age = int(user_data["age"]) if user_data and user_data["age"] is not None else 25
    
    # Get completed schedules for today
    today_date = datetime.now().strftime("%Y-%m-%d")
    cursor.execute("SELECT COUNT(*) as comp_count FROM schedules WHERE username=? AND date=? AND is_completed=1", (username, today_date))
    comp_row = cursor.fetchone()
    completed_schedules = comp_row["comp_count"] if comp_row else 0
    
    burnout_score = 50 # Default middle score
    if latest_metric:
        sleep, stress = latest_metric["hours_sleep"], latest_metric["stress_level"]
        age_penalty = max(0, (age - 25) * 0.02) if age > 25 else 0
        base_score = (stress * 5) + ((7 - sleep) * 3)
        score = base_score * (1.0 + age_penalty)
        score -= (completed_schedules * 5) # reduce burnout based on completed schedules
        burnout_score = min(max(int(score), 0), 100)
    
    return {"burnout_score": burnout_score, "age": age, "completed_schedules": completed_schedules}

@app.get("/api/metrics/entropy")
def get_entropy_metrics(username: str, db: sqlite3.Connection = Depends(get_db)):
    cursor = db.cursor()
    # Check if table exists
    try:
        cursor.execute("SELECT mouse_entropy, typing_variance, lexical_diversity, switch_back_latency, burnout_coefficient FROM burnout_metrics WHERE username=? ORDER BY timestamp DESC LIMIT 1", (username,))
        row = cursor.fetchone()
        if row:
            return dict(row)
    except sqlite3.OperationalError:
        pass
    
    # Return defaults if not available
    return {
        "mouse_entropy": 0.0,
        "typing_variance": 0.0,
        "lexical_diversity": 1.0,
        "switch_back_latency": 0.0,
        "burnout_coefficient": 0.0
    }

@app.post("/api/metrics/daily")
def save_daily_metric(metric: DailyMetric, db: sqlite3.Connection = Depends(get_db)):
    cursor = db.cursor()
    today_date = datetime.now().strftime("%Y-%m-%d")
    
    cursor.execute("SELECT id FROM daily_metrics WHERE date=? AND username=?", (today_date, metric.username))
    if cursor.fetchone():
        cursor.execute("UPDATE daily_metrics SET hours_sleep=?, stress_level=? WHERE date=? AND username=?", 
                       (metric.hours_sleep, metric.stress_level, today_date, metric.username))
    else:
        cursor.execute("INSERT INTO daily_metrics (date, hours_sleep, stress_level, username) VALUES (?, ?, ?, ?)",
                       (today_date, metric.hours_sleep, metric.stress_level, metric.username))
    db.commit()
    return {"message": "Daily metrics saved successfully!"}

@app.get("/api/logs/live")
def get_live_log(db: sqlite3.Connection = Depends(get_db)):
    cursor = db.cursor()
    cursor.execute("SELECT window_title, category, timestamp FROM app_logs ORDER BY timestamp DESC LIMIT 1")
    last_log = cursor.fetchone()
    
    if last_log:
        return {"title": last_log["window_title"], "category": last_log["category"], "timestamp": last_log["timestamp"]}
    return {"message": "No activity logged yet."}

@app.get("/api/user/profile")
def get_profile(username: str, db: sqlite3.Connection = Depends(get_db)):
    cursor = db.cursor()
    try:
        cursor.execute("SELECT age, mobile_no FROM users WHERE username=?", (username,))
        row = cursor.fetchone()
        if row:
            return {"age": row["age"], "mobile_no": row["mobile_no"] or ""}
    except sqlite3.OperationalError:
        cursor.execute("SELECT age FROM users WHERE username=?", (username,))
        row = cursor.fetchone()
        if row:
            return {"age": row["age"], "mobile_no": ""}
    return {"age": 25, "mobile_no": ""}

@app.put("/api/user/profile")
def update_profile(profile: ProfileUpdate, db: sqlite3.Connection = Depends(get_db)):
    cursor = db.cursor()
    try:
        cursor.execute("UPDATE users SET age=?, mobile_no=? WHERE username=?", 
                       (profile.age, profile.mobile_no, profile.username))
    except sqlite3.OperationalError:
        try:
            cursor.execute("ALTER TABLE users ADD COLUMN mobile_no TEXT")
        except sqlite3.OperationalError:
            pass
        cursor.execute("UPDATE users SET age=?, mobile_no=? WHERE username=?", 
                       (profile.age, profile.mobile_no, profile.username))
    
    db.commit()
    return {"message": "Profile updated successfully"}

@app.put("/api/user/credentials")
def update_credentials(req: UserCredentialsUpdate, db: sqlite3.Connection = Depends(get_db)):
    cursor = db.cursor()
    
    cursor.execute("SELECT password FROM users WHERE username=?", (req.old_username,))
    row = cursor.fetchone()
    if not row or row["password"] != req.current_password:
        raise HTTPException(status_code=400, detail="Incorrect current password")

    if req.new_username != req.old_username:
        cursor.execute("SELECT id FROM users WHERE username=?", (req.new_username,))
        row = cursor.fetchone()
        if row:
            raise HTTPException(status_code=400, detail="Username already exists")

    if req.new_password:
        cursor.execute("UPDATE users SET username=?, password=? WHERE username=?", (req.new_username, req.new_password, req.old_username))
    else:
        cursor.execute("UPDATE users SET username=? WHERE username=?", (req.new_username, req.old_username))

    # Cascade username changes
    if req.new_username != req.old_username:
        cursor.execute("UPDATE daily_metrics SET username=? WHERE username=?", (req.new_username, req.old_username))
        cursor.execute("UPDATE schedules SET username=? WHERE username=?", (req.new_username, req.old_username))
    
    db.commit()
    return {"message": "Credentials updated successfully"}

@app.get("/api/logs/history")
def get_history(date: str, db: sqlite3.Connection = Depends(get_db)):
    query_hist = """
        SELECT category, SUM(duration_seconds) as total_seconds
        FROM app_logs
        WHERE date(timestamp) = ?
        GROUP BY category
    """
    df_history = pd.read_sql_query(query_hist, db, params=(date,))
    
    if df_history.empty:
        return {"total_seconds": 0, "distribution": [], "date": date}
        
    total_seconds = int(df_history["total_seconds"].sum())
    distribution = df_history.to_dict(orient="records")
    return {"total_seconds": total_seconds, "distribution": distribution, "date": date}

@app.get("/api/logs/trends")
def get_trends(db: sqlite3.Connection = Depends(get_db)):
    query_trends = """
        SELECT date(timestamp) as log_date, category, SUM(duration_seconds) as total_seconds
        FROM app_logs
        GROUP BY log_date, category
        ORDER BY log_date ASC
    """
    df_trends = pd.read_sql_query(query_trends, db)
    
    if not df_trends.empty:
        df_trends['hours'] = df_trends['total_seconds'] / 3600
        return {"trends": df_trends.to_dict(orient="records")}
    return {"trends": []}

@app.get("/api/schedules")
def get_schedules(username: str, date: str, db: sqlite3.Connection = Depends(get_db)):
    cursor = db.cursor()
    cursor.execute("SELECT * FROM schedules WHERE username=? AND date=? ORDER BY start_time ASC", (username, date))
    rows = cursor.fetchall()
    return [dict(row) for row in rows]

@app.post("/api/schedules")
def create_schedule(schedule: ScheduleCreate, db: sqlite3.Connection = Depends(get_db)):
    cursor = db.cursor()
    
    # 1. Fetch existing schedules
    cursor.execute("SELECT start_time, end_time FROM schedules WHERE username=? AND date=?", (schedule.username, schedule.date))
    existing = cursor.fetchall()
    
    fmt = "%H:%M"
    try:
        new_start = datetime.strptime(schedule.start_time, fmt)
        new_end = datetime.strptime(schedule.end_time, fmt)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid time format. Use HH:MM")

    if new_start >= new_end:
        raise HTTPException(status_code=400, detail="Start time must be before end time")

    now = datetime.now()
    today_str = now.strftime("%Y-%m-%d")
    if schedule.date == today_str:
        if new_start.time() < now.time():
            raise HTTPException(status_code=400, detail="Cannot schedule a task before the current time")
    elif schedule.date < today_str:
        raise HTTPException(status_code=400, detail="Cannot schedule a task on a past date")

    for row in existing:
        e_start = datetime.strptime(row["start_time"], fmt)
        e_end = datetime.strptime(row["end_time"], fmt)
        
        # Determine overlap
        # Two intervals overlap if max(start1, start2) < min(end1, end2)
        if max(new_start, e_start) < min(new_end, e_end):
            raise HTTPException(status_code=400, detail="Schedule overlaps with an existing one")
        
        # Enforce 5 minute break AFTER an existing schedule, or BEFORE an existing schedule
        # So we check if the gap is < 5 minutes
        if new_start >= e_end and (new_start - e_end).total_seconds() < 300:
            raise HTTPException(status_code=400, detail="Must have at least a 5-minute break after the previous schedule")
        if e_start >= new_end and (e_start - new_end).total_seconds() < 300:
            raise HTTPException(status_code=400, detail="Must have at least a 5-minute break before the next schedule")

    try:
        cursor.execute("INSERT INTO schedules (username, date, title, start_time, end_time, is_schedule_mode, is_completed, blocked_apps) VALUES (?, ?, ?, ?, ?, ?, 0, ?)",
                       (schedule.username, schedule.date, schedule.title, schedule.start_time, schedule.end_time, schedule.is_schedule_mode, schedule.blocked_apps))
    except sqlite3.OperationalError:
        cursor.execute("ALTER TABLE schedules ADD COLUMN blocked_apps TEXT")
        cursor.execute("INSERT INTO schedules (username, date, title, start_time, end_time, is_schedule_mode, is_completed, blocked_apps) VALUES (?, ?, ?, ?, ?, ?, 0, ?)",
                       (schedule.username, schedule.date, schedule.title, schedule.start_time, schedule.end_time, schedule.is_schedule_mode, schedule.blocked_apps))
    db.commit()
    return {"message": "Schedule created successfully"}

@app.put("/api/schedules/{schedule_id}/status")
def update_schedule_status(schedule_id: int, update: ScheduleUpdateStatus, db: sqlite3.Connection = Depends(get_db)):
    cursor = db.cursor()
    cursor.execute("UPDATE schedules SET is_completed=? WHERE id=?", (update.is_completed, schedule_id))
    db.commit()
    return {"message": "Schedule status updated"}

@app.put("/api/schedules/{schedule_id}")
def update_schedule(schedule_id: int, schedule: ScheduleFullUpdate, db: sqlite3.Connection = Depends(get_db)):
    cursor = db.cursor()
    
    fmt = "%H:%M"
    try:
        new_start = datetime.strptime(schedule.start_time, fmt)
        new_end = datetime.strptime(schedule.end_time, fmt)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid time format. Use HH:MM")

    if new_start >= new_end:
        raise HTTPException(status_code=400, detail="Start time must be before end time")

    now = datetime.now()
    today_str = now.strftime("%Y-%m-%d")
    if schedule.date == today_str:
        if new_start.time() < now.time():
            raise HTTPException(status_code=400, detail="Cannot schedule a task before the current time")
    elif schedule.date < today_str:
        raise HTTPException(status_code=400, detail="Cannot schedule a task on a past date")

    cursor.execute("SELECT id, start_time, end_time FROM schedules WHERE username=? AND date=? AND id!=?", (schedule.username, schedule.date, schedule_id))
    existing = cursor.fetchall()
    
    for row in existing:
        e_start = datetime.strptime(row["start_time"], fmt)
        e_end = datetime.strptime(row["end_time"], fmt)
        if max(new_start, e_start) < min(new_end, e_end):
            raise HTTPException(status_code=400, detail="Schedule overlaps with an existing one")
        if new_start >= e_end and (new_start - e_end).total_seconds() < 300:
            raise HTTPException(status_code=400, detail="Must have at least a 5-minute break after the previous schedule")
        if e_start >= new_end and (e_start - new_end).total_seconds() < 300:
            raise HTTPException(status_code=400, detail="Must have at least a 5-minute break before the next schedule")

    try:
        cursor.execute("UPDATE schedules SET title=?, start_time=?, end_time=?, is_schedule_mode=?, date=?, blocked_apps=? WHERE id=?",
                       (schedule.title, schedule.start_time, schedule.end_time, schedule.is_schedule_mode, schedule.date, schedule.blocked_apps, schedule_id))
    except sqlite3.OperationalError:
        cursor.execute("ALTER TABLE schedules ADD COLUMN blocked_apps TEXT")
        cursor.execute("UPDATE schedules SET title=?, start_time=?, end_time=?, is_schedule_mode=?, date=?, blocked_apps=? WHERE id=?",
                       (schedule.title, schedule.start_time, schedule.end_time, schedule.is_schedule_mode, schedule.date, schedule.blocked_apps, schedule_id))
    db.commit()
    return {"message": "Schedule updated successfully"}

@app.delete("/api/schedules/{schedule_id}")
def delete_schedule(schedule_id: int, db: sqlite3.Connection = Depends(get_db)):
    cursor = db.cursor()
    cursor.execute("DELETE FROM schedules WHERE id=?", (schedule_id,))
    db.commit()
    return {"message": "Schedule deleted successfully"}

import re

@app.post("/api/assistant/schedule")
def ai_assistant_schedule(req: AssistantRequest, db: sqlite3.Connection = Depends(get_db)):
    import os
    # We use environment variables instead of hardcoded keys to keep your key safe on GitHub!
    GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "YOUR_API_KEY_HERE")
    
    if not GEMINI_API_KEY or GEMINI_API_KEY == "YOUR_API_KEY_HERE":
        return {
            "suggestion": "Please add your Gemini API key in api.py to use the true Smart Assistant!",
            "parsed": None
        }

    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel('gemini-2.5-flash')
    
    # Fetch existing schedules to give LLM context
    cursor = db.cursor()
    cursor.execute("SELECT id, title, start_time, end_time, is_schedule_mode, is_completed, blocked_apps FROM schedules WHERE username=? AND date=? ORDER BY start_time ASC", (req.username, req.date))
    existing_schedules = cursor.fetchall()
    
    existing_text = "\n".join([f"ID: {r['id']}, Title: '{r['title']}', Time: {r['start_time']}-{r['end_time']}, Mode: {'Focus' if r['is_schedule_mode'] else 'Normal'}, Done: {bool(r['is_completed'])}, Blocked Apps: {r['blocked_apps']}" for r in existing_schedules])
    if not existing_text: existing_text = "No schedules yet."

    sys_prompt = f"""You are a smart scheduling assistant for the MindWell app.
Analyze the user's prompt and extract the scheduling details.
Current Schedules for today:
{existing_text}

Return ONLY a valid JSON object with the following keys:
- action (string): "create", "update", or "delete". Example: "mark as done" -> update. "enable youtube" -> update. "remove" -> delete.
- target_ids (list of integers): If action is update/delete, identify the ID(s) of the schedules they are referring to from the Current Schedules list. Use [] for "create".
- create_details (object): ONLY if action is "create", provide {{ "title": string, "duration_mins": int, "is_schedule_mode": int, "start_time": string or null }}. Title must strictly use user's explicit name if provided (e.g. "name it X").
- update_details (object): ONLY if action is "update", provide the fields to change. Possible keys: "title", "start_time", "end_time", "is_schedule_mode" (1 or 0), "is_completed" (1 or 0), "blocked_apps" (string). ONLY include keys that are explicitly being changed. Example: if they say "enable youtube in task X", copy the existing blocked apps string for task X, remove 'youtube', and provide the updated string in "blocked_apps".
"""
    try:
        response = model.generate_content(f"{sys_prompt}\nUser prompt: {req.prompt}")
        text = response.text.strip()
        if text.startswith("```json"):
            text = text[7:-3]
        elif text.startswith("```"):
            text = text[3:-3]
            
        data = json.loads(text)
        action = data.get("action", "create")
        target_ids = data.get("target_ids", [])
        
    except Exception as e:
        return {"suggestion": f"AI Parsing error: {str(e)}", "parsed": None}

    if action == "update":
        if target_ids:
            update_details = data.get("update_details", {})
            if not update_details:
                return {"suggestion": "I couldn't figure out what you wanted to update.", "parsed": None, "action_taken": False}
                
            for tid in target_ids:
                # Fetch current
                cursor.execute("SELECT * FROM schedules WHERE id=?", (tid,))
                curr = cursor.fetchone()
                if not curr: continue
                
                # Update fields
                u_title = update_details.get("title", curr["title"])
                u_start = update_details.get("start_time", curr["start_time"])
                u_end = update_details.get("end_time", curr["end_time"])
                u_mode = update_details.get("is_schedule_mode", curr["is_schedule_mode"])
                u_comp = update_details.get("is_completed", curr["is_completed"])
                u_apps = update_details.get("blocked_apps", curr["blocked_apps"])
                
                cursor.execute("""
                    UPDATE schedules 
                    SET title=?, start_time=?, end_time=?, is_schedule_mode=?, is_completed=?, blocked_apps=?
                    WHERE id=?
                """, (u_title, u_start, u_end, u_mode, u_comp, u_apps, tid))
            db.commit()
            return {"suggestion": f"Done! I've updated your selected task(s).", "parsed": None, "action_taken": True}
        else:
            return {"suggestion": "I couldn't find the task you wanted to update.", "parsed": None, "action_taken": False}

    if action == "delete":
        if target_ids:
            for tid in target_ids:
                cursor.execute("DELETE FROM schedules WHERE id=?", (tid,))
            db.commit()
            return {"suggestion": "I've deleted the task(s) as requested!", "parsed": None, "action_taken": True}
        else:
            return {"suggestion": "I couldn't find the task you wanted to delete.", "parsed": None, "action_taken": False}

    # CREATE LOGIC
    c_details = data.get("create_details", {})
    raw_title = c_details.get("title")
    title = (raw_title or "Smart Task").title()
    duration_mins = c_details.get("duration_mins", 60)
    is_schedule_mode = c_details.get("is_schedule_mode", 1)
    req_start_time = c_details.get("start_time")

    now = datetime.now()
    today_str = now.strftime("%Y-%m-%d")
    
    has_explicit_time = False
    if req_start_time:
        try:
            dt = datetime.strptime(req_start_time, "%H:%M")
            start_hour = dt.hour
            start_min = dt.minute
            has_explicit_time = True
        except:
            pass
            
    if not has_explicit_time:
        if req.date == today_str:
            start_hour = now.hour + 1
            start_min = 0
        else:
            start_hour = 9
            start_min = 0
            
        # Find a free slot
        current_time = datetime.strptime(f"{start_hour:02d}:{start_min:02d}", "%H:%M")
        
        for row in existing_schedules:
            e_start = datetime.strptime(row["start_time"], "%H:%M")
            e_end = datetime.strptime(row["end_time"], "%H:%M")
            
            # buffer before existing task: 5 mins, buffer after: 15 mins
            e_start = e_start - timedelta(minutes=5)
            e_end = e_end + timedelta(minutes=15)
            
            proposed_end = current_time + timedelta(minutes=duration_mins)
            
            if max(current_time, e_start) < min(proposed_end, e_end):
                current_time = e_end
                
        start_hour = current_time.hour
        start_min = current_time.minute

    start_time_obj = datetime.strptime(f"{start_hour:02d}:{start_min:02d}", "%H:%M")
    schedules_to_create = []
    
    # Break into chunks of 25 min work + 5 min break if duration >= 45
    if duration_mins >= 45:
        remaining = duration_mins
        curr_time = start_time_obj
        part = 1
        while remaining > 0:
            chunk = min(25, remaining)
            end_time_obj = curr_time + timedelta(minutes=chunk)
            
            schedules_to_create.append({
                "title": f"{title} (Part {part})",
                "start_time": curr_time.strftime("%H:%M"),
                "end_time": end_time_obj.strftime("%H:%M"),
                "is_schedule_mode": is_schedule_mode,
                "date": req.date,
                "blocked_apps": "youtube,game,netflix,instagram,facebook,twitter,tiktok,whatsapp,valorant,steam,epic games,roblox,minecraft,riot client,league of legends" if is_schedule_mode else ""
            })
            
            remaining -= chunk
            if remaining > 0:
                curr_time = end_time_obj + timedelta(minutes=5) # 5 min break
            part += 1
    else:
        end_time_obj = start_time_obj + timedelta(minutes=duration_mins)
        schedules_to_create.append({
            "title": title,
            "start_time": start_time_obj.strftime("%H:%M"),
            "end_time": end_time_obj.strftime("%H:%M"),
            "is_schedule_mode": is_schedule_mode,
            "date": req.date,
            "blocked_apps": "youtube,game,netflix,instagram,facebook,twitter,tiktok,whatsapp,valorant,steam,epic games,roblox,minecraft,riot client,league of legends" if is_schedule_mode else ""
        })
        
    # Check if ANY of the chunks overlap
    overlap = False
    fmt = "%H:%M"
    for sch in schedules_to_create:
        n_s = datetime.strptime(sch["start_time"], fmt)
        n_e = datetime.strptime(sch["end_time"], fmt)
        for row in existing_schedules:
            e_s = datetime.strptime(row["start_time"], fmt)
            e_e = datetime.strptime(row["end_time"], fmt)
            if max(n_s, e_s) < min(n_e, e_e):
                overlap = True
                break
        if overlap: break
            
    if overlap:
        suggestion = f"I tried to schedule '{title}', but there is an overlap. Please specify a different time."
        parsed = None
    else:
        if len(schedules_to_create) > 1:
            end_t = schedules_to_create[-1]["end_time"]
            start_t = schedules_to_create[0]["start_time"]
            suggestion = f"I broke '{title}' into {len(schedules_to_create)} sessions with 5-min breaks! It runs from {start_t} to {end_t}. Mode: {'Focus' if is_schedule_mode else 'Normal'}. Add this?"
        else:
            suggestion = f"I suggest scheduling '{title}' from {schedules_to_create[0]['start_time']} to {schedules_to_create[0]['end_time']}. Mode: {'Focus' if is_schedule_mode else 'Normal'}. Add this?"
        
        parsed = schedules_to_create
        
    return {
        "suggestion": suggestion,
        "parsed": parsed,
        "action_taken": False
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api:app", host="127.0.0.1", port=8000, reload=True)

