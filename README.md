Week 3 – Monolithic Architecture Task Board Application

ENGSE207 — Software Architecture

📌 Overview

โปรเจกต์นี้เป็นการพัฒนา Task Board Application ด้วยสถาปัตยกรรม Monolithic Architecture โดยรวมทุกส่วน—Frontend, Backend, Database—ไว้ใน Codebase เดียว และ Deploy แบบรวมเป็นแอปเดียว

Users สามารถ:

ดูรายการ Tasks ทั้งหมดในรูปแบบ Kanban Board

เพิ่มงานใหม่

ย้ายงาน (TODO → IN_PROGRESS → DONE)

ลบงาน

ค้นหาด้วยฟิลเตอร์ Status

```

🧱 Architecture — Monolithic
┌─────────────────────────────────────┐
│   Monolithic Application            │
│   (Single Process, Single Codebase) │
│                                     │
│  ┌───────────────────────────────┐  │
│  │ Frontend: HTML/CSS/JavaScript │  │
│  └───────────────────────────────┘  │
│                                     │
│  ┌───────────────────────────────┐  │
│  │ Backend: Express.js            │  │
│  └───────────────────────────────┘  │
│                                     │
│  ┌───────────────────────────────┐  │
│  │ Database: SQLite               │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```
🚀 Tech Stack

Node.js + Express.js — Backend API

SQLite3 — Local lightweight database

HTML + CSS + Vanilla JS — Frontend UI

Nodemon — Auto-reload server

```
🗂️ Project Structure
week3-monolithic/
├── server.js
├── package.json
├── database/
│   ├── schema.sql
│   └── tasks.db
├── public/
│   ├── index.html
│   ├── style.css
│   └── app.js
├── .gitignore
└── README.md
```
⚙️ Installation & Setup
1️⃣ Clone หรือสร้างโฟลเดอร์
```
mkdir week3-monolithic && cd week3-monolithic
npm init -y
```
2️⃣ Install Dependencies
```
npm install express sqlite3
npm install --save-dev nodemon
```
3️⃣ สร้างโครงสร้างไฟล์
```
mkdir public database
touch server.js database/schema.sql
touch public/index.html public/style.css public/app.js
```
4️⃣ Setup Database
```
cd database
sqlite3 tasks.db < schema.sql
cd ..
```
5️⃣ Run Server

เพิ่ม script ใน package.json
```
"scripts": {
    "dev": "nodemon server.js"
}
```

รันเลย
```
npm run dev
```

เปิดเว็บ
👉 http://localhost:3000
```
🧩 Database Schema
CREATE TABLE tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'TODO',
    priority TEXT DEFAULT 'MEDIUM',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```
🔌 API Endpoints
```
Method	Endpoint	Description
GET	/api/tasks	Get all tasks
GET	/api/tasks/:id	Get single task
POST	/api/tasks	Create task
PUT	/api/tasks/:id	Update task
DELETE	/api/tasks/:id	Delete task
PATCH	/api/tasks/:id/status	Update only status
```
🧪 Testing Guide
Test ด้วย Browser / Thunder Client / Postman

ดู tasks ทั้งหมด:
GET http://localhost:3000/api/tasks

เพิ่มงานใหม่:
POST http://localhost:3000/api/tasks
Body:
```
{
  "title": "New Task",
  "description": "Details",
  "priority": "HIGH"
}
```

ตรวจสอบ UI:

แสดง tasks

เพิ่ม/ลบ task

ย้าย status

Filter tasks

