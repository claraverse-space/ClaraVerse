#!/usr/bin/env python3
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import sqlite3

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
DATABASE = "app.db"

def init_db():
    conn = sqlite3.connect(DATABASE)
    c = conn.cursor()
    c.execute("CREATE TABLE IF NOT EXISTS test (id INTEGER PRIMARY KEY AUTOINCREMENT, value TEXT)")
    c.execute("SELECT COUNT(*) FROM test")
    count = c.fetchone()[0]
    if count == 0:
        c.execute("INSERT INTO test (value) VALUES ('Hello from SQLite')")
        conn.commit()
    conn.close()

init_db()

@app.get("/test")
def read_test():
    conn = sqlite3.connect(DATABASE)
    c = conn.cursor()
    c.execute("SELECT id, value FROM test LIMIT 1")
    row = c.fetchone()
    conn.close()
    if row:
        return JSONResponse(content={"id": row[0], "value": row[1]})
    return JSONResponse(content={"error": "No data found"})

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
