import sqlite3
import os

db_path = r'd:\Projects\Programming_Projects\Dicoding-Gen-AI\Dicoding-GenAI-Webapps\ktem_app_data\user_data\sql.db'
print(f"Checking: {db_path}")
print(f"Exists: {os.path.exists(db_path)}")

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# List tables
cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = cursor.fetchall()
print(f"\nTables: {tables}")

for table_name in tables:
    table = table_name[0]
    try:
        cursor.execute(f"SELECT * FROM {table} LIMIT 3")
        rows = cursor.fetchall()
        if rows:
            cursor.execute(f"PRAGMA table_info({table})")
            cols = cursor.fetchall()
            col_names = [c[1] for c in cols]
            print(f"\n=== {table} ===")
            print(f"Columns: {col_names}")
            for row in rows:
                print(f"  {row}")
    except Exception as e:
        print(f"Error reading {table}: {e}")

conn.close()
