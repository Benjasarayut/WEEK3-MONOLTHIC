const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const app = express();

app.use(express.json());
app.use(express.static('public'));

const db = new sqlite3.Database('./database/tasks.db');

// GET all tasks
app.get('/api/tasks', (req, res) => {
    db.all('SELECT * FROM tasks', [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json({ tasks: rows });
        }
    });
});

// POST create task
app.post('/api/tasks', (req, res) => {
    const { title, description, priority } = req.body;
    db.run(
        'INSERT INTO tasks (title, description, priority) VALUES (?, ?, ?)',
        [title, description, priority],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
            } else {
                // Return the created task row
                db.get('SELECT * FROM tasks WHERE id = ?', [this.lastID], (err2, row) => {
                    if (err2) {
                        res.status(500).json({ error: err2.message });
                    } else {
                        res.status(201).json(row);
                    }
                });
            }
        }
    );
});

// GET single task
app.get('/api/tasks/:id', (req, res) => {
    const id = req.params.id;
    db.get('SELECT * FROM tasks WHERE id = ?', [id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Task not found' });
        res.json(row);
    });
});

// PATCH update task status
app.patch('/api/tasks/:id/status', (req, res) => {
    const id = req.params.id;
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'Missing status in request body' });

    db.run(
        'UPDATE tasks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [status, id],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            if (this.changes === 0) return res.status(404).json({ error: 'Task not found' });
            db.get('SELECT * FROM tasks WHERE id = ?', [id], (err2, row) => {
                if (err2) return res.status(500).json({ error: err2.message });
                res.json(row);
            });
        }
    );
});

// DELETE task
app.delete('/api/tasks/:id', (req, res) => {
    const id = req.params.id;
    db.run('DELETE FROM tasks WHERE id = ?', [id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Task not found' });
        res.json({ success: true });
    });
});

app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});