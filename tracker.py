import sqlite3
import time
import datetime
import pygetwindow as gw
import pyautogui
import threading
import math
import collections
import statistics

try:
    import pynput.mouse as pmouse
    import pynput.keyboard as pkeyboard
except ImportError:
    pmouse = None
    pkeyboard = None

DB_NAME = "mindwell.db"

# Globals for Entropy Gap
mouse_vectors = []
last_mouse_pos = None

key_intervals = []
last_key_time = None

typed_words = []
current_word = []

prev_category = None
waiting_for_productive_keystroke = False
switch_start_time = None
latest_switch_latency = None

def init_db():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    # Create the tables if they do not exist
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password TEXT,
            age INTEGER DEFAULT 25
        )
    ''')
    try:
        cursor.execute("ALTER TABLE users ADD COLUMN age INTEGER DEFAULT 25")
    except sqlite3.OperationalError:
        pass
    try:
        cursor.execute("ALTER TABLE users ADD COLUMN blocked_keywords TEXT")
    except sqlite3.OperationalError:
        pass
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS app_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp DATETIME,
            window_title TEXT,
            category TEXT,
            duration_seconds INTEGER
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS daily_metrics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date DATE,
            hours_sleep INTEGER,
            stress_level INTEGER,
            username TEXT
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS schedules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT,
            date DATE,
            title TEXT,
            start_time TEXT,
            end_time TEXT,
            is_schedule_mode INTEGER,
            is_completed INTEGER DEFAULT 0
        )
    ''')
    try:
        cursor.execute("ALTER TABLE schedules ADD COLUMN blocked_apps TEXT")
    except sqlite3.OperationalError:
        pass
        
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS burnout_metrics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp DATETIME,
            mouse_entropy REAL,
            typing_variance REAL,
            lexical_diversity REAL,
            switch_back_latency REAL,
            burnout_coefficient REAL,
            username TEXT
        )
    ''')
    conn.commit()
    conn.close()

def categorize_window(title):
    if not title:
        return "Unknown"
    title_lower = title.lower()
    productive_keywords = ["code", "studio", "word", "excel", "powerpoint", "jupyter", "github", "stackoverflow"]
    
    if "youtube" in title_lower:
        if "shorts" in title_lower:
            return "Distracted"
        else:
            return "Neutral"

    distraction_keywords = ["game", "netflix", "instagram", "facebook", "twitter", "tiktok", "whatsapp", "valorant", "steam", "epic games", "roblox", "minecraft", "riot client", "league of legends", "smash karts", "poki", "crazygames", "unblocked games", "io games"]

    for kw in productive_keywords:
        if kw in title_lower:
            return "Productive"
    
    for kw in distraction_keywords:
        if kw in title_lower:
            return "Distracted"
        
    return "Neutral"

def on_move(x, y):
    global last_mouse_pos, mouse_vectors
    if last_mouse_pos is not None:
        dx = x - last_mouse_pos[0]
        dy = y - last_mouse_pos[1]
        if dx != 0 or dy != 0:
            angle = math.atan2(dy, dx)
            direction = int((angle + math.pi) / (math.pi / 4)) % 8
            dist = math.hypot(dx, dy)
            speed_bin = 0 if dist < 5 else (1 if dist < 20 else 2)
            mouse_vectors.append((direction, speed_bin))
    last_mouse_pos = (x, y)

def on_press(key):
    global last_key_time, key_intervals
    global waiting_for_productive_keystroke, switch_start_time, latest_switch_latency
    global current_word, typed_words

    now = time.time()
    
    if waiting_for_productive_keystroke:
        latest_switch_latency = now - switch_start_time
        waiting_for_productive_keystroke = False
        print(f"[{datetime.datetime.now()}] First meaningful keystroke detected! Switch-back latency: {latest_switch_latency:.2f}s")

    if last_key_time is not None:
        key_intervals.append(now - last_key_time)
    last_key_time = now

    try:
        if hasattr(key, 'char') and key.char is not None:
            if key.char.isspace():
                if current_word:
                    typed_words.append("".join(current_word).lower())
                    current_word = []
            else:
                current_word.append(key.char)
        elif key == pkeyboard.Key.space or key == pkeyboard.Key.enter:
            if current_word:
                typed_words.append("".join(current_word).lower())
                current_word = []
    except Exception:
        pass

def calculate_and_store_entropy():
    global mouse_vectors, key_intervals, typed_words, latest_switch_latency
    
    if not mouse_vectors:
        h_mouse = 0.0
    else:
        counts = collections.Counter(mouse_vectors)
        total = len(mouse_vectors)
        h_mouse = -sum((c/total) * math.log2(c/total) for c in counts.values())
        
    if len(key_intervals) > 1:
        typing_var = statistics.variance(key_intervals)
    else:
        typing_var = 0.0
        
    if typed_words:
        lex_div = len(set(typed_words)) / len(typed_words)
    else:
        lex_div = 1.0
        
    switch_lat = latest_switch_latency if latest_switch_latency is not None else 0.0
    
    # Beta: Burnout Coefficient
    beta = (h_mouse * 0.5) + (typing_var * 10) + ((1.0 - lex_div) * 5) + (min(switch_lat, 60) * 0.1)
    
    # Clear buffers
    mouse_vectors.clear()
    key_intervals.clear()
    typed_words.clear()
    
    try:
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        
        username = "default"
        cursor.execute("SELECT username FROM users ORDER BY id DESC LIMIT 1")
        row = cursor.fetchone()
        if row:
            username = row[0]
            
        cursor.execute("""
            INSERT INTO burnout_metrics 
            (timestamp, mouse_entropy, typing_variance, lexical_diversity, switch_back_latency, burnout_coefficient, username)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (datetime.datetime.now(), h_mouse, typing_var, lex_div, switch_lat, beta, username))
        conn.commit()
        conn.close()
        print(f"[{datetime.datetime.now()}] Burnout Metrics Calculated -> Beta: {beta:.2f} (Mouse H: {h_mouse:.2f}, Type Var: {typing_var:.2f}, Lex Div: {lex_div:.2f}, Latency: {switch_lat:.2f}s)")
    except Exception as e:
        print(f"Failed to store metrics: {e}")

def main():
    global prev_category, waiting_for_productive_keystroke, switch_start_time
    init_db()
    
    if pmouse and pkeyboard:
        mouse_listener = pmouse.Listener(on_move=on_move)
        keyboard_listener = pkeyboard.Listener(on_press=on_press)
        mouse_listener.start()
        keyboard_listener.start()
        print("Pynput listeners started for Entropy tracking.")
    else:
        print("Warning: pynput not installed. Entropy tracking disabled.")

    print("Tracker started. Logging active window every 10 seconds...")
    last_log_time = time.time()
    last_entropy_time = time.time()
    
    try:
        while True:
            # fetch the active foreground window
            window = gw.getActiveWindow()
            title = window.title if window else "Unknown"
            category = categorize_window(title)
            
            # Switch-back latency logic
            if prev_category == "Distracted" and category == "Productive" and not waiting_for_productive_keystroke:
                waiting_for_productive_keystroke = True
                switch_start_time = time.time()
                print(f"[{datetime.datetime.now()}] Switched from Distracted -> Productive. Awaiting first keystroke...")
            
            prev_category = category
            
            now = time.time()
            if now - last_log_time >= 10:
                timestamp = datetime.datetime.now()
                duration_seconds = 10
                
                # Log to sqlite
                conn = sqlite3.connect(DB_NAME)
                cursor = conn.cursor()
                cursor.execute(
                    "INSERT INTO app_logs (timestamp, window_title, category, duration_seconds) VALUES (?, ?, ?, ?)",
                    (timestamp, title, category, duration_seconds)
                )
                
                # Check active schedules for schedule mode blocking
                today_str = timestamp.strftime("%Y-%m-%d")
                time_str = timestamp.strftime("%H:%M")
                cursor.execute("SELECT is_schedule_mode, blocked_apps FROM schedules WHERE date=? AND start_time<=? AND end_time>=? AND is_schedule_mode=1 AND is_completed=0", (today_str, time_str, time_str))
                active_schedule = cursor.fetchone()
                
                conn.commit()
                conn.close()
                
                print(f"[{timestamp}] Logged: {title} | {category} | {duration_seconds}s")
                
                is_blocking = False
                title_lower = title.lower()
                if active_schedule:
                    blocked_apps_str = active_schedule[1]
                    if blocked_apps_str is not None:
                        blocked_kws = [k.strip().lower() for k in blocked_apps_str.split(',') if k.strip()]
                        if any(kw in title_lower for kw in blocked_kws):
                            is_blocking = True
                    else:
                        if category == "Distracted":
                            is_blocking = True

                if is_blocking:
                    print(f"[{timestamp}] SCHEDULE BLOCK: Distracting app detected: {title}. Blocking it!")
                    browser_keywords = ["chrome", "edge", "firefox", "brave", "opera"]
                    is_browser = any(b in title_lower for b in browser_keywords)
                    if is_browser:
                        print("--> It's a browser, sending Ctrl+W to close active tab.")
                        pyautogui.hotkey('ctrl', 'w')
                    else:
                        print("--> Not a browser, minimizing the window.")
                        if window:
                            window.minimize()
                
                last_log_time = now

            if now - last_entropy_time >= 60:
                calculate_and_store_entropy()
                last_entropy_time = now

            # Sleep briefly to not max out CPU, but fast enough to detect window switches
            time.sleep(1)
            
    except KeyboardInterrupt:
        print("\nTracker stopped by user.")
    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    main()
