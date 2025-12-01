// ---- State + DOM refs ----
let allTasks = [];

const addTaskForm = document.getElementById('addTaskForm');
const titleInput = document.getElementById('taskTitle');
const descInput = document.getElementById('taskDescription');
const prioritySelect = document.getElementById('taskPriority');
const statusFilter = document.getElementById('statusFilter');

const todoTasks = document.getElementById('todoTasks');
const progressTasks = document.getElementById('progressTasks');
const doneTasks = document.getElementById('doneTasks');

const todoCount = document.getElementById('todoCount');
const progressCount = document.getElementById('progressCount');
const doneCount = document.getElementById('doneCount');

// ---- Utilities ----
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, function (c) {
        return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
}

function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleString();
}

function showLoading() {
    const el = document.getElementById('loadingOverlay');
    if (el) el.style.display = 'flex';
}
function hideLoading() {
    const el = document.getElementById('loadingOverlay');
    if (el) el.style.display = 'none';
}

// ---- API ----
async function fetchTasks() {
    try {
        showLoading();
        const res = await fetch('/api/tasks');
        const data = await res.json();
        allTasks = data.tasks || [];
        renderTasks();
    } catch (err) {
        console.error(err);
        alert('Failed to load tasks');
    } finally {
        hideLoading();
    }
}

async function createTaskAPI(taskData) {
    const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData)
    });
    if (!res.ok) throw new Error('Failed to create task');
    return res.json();
}

async function updateTaskStatusAPI(id, status) {
    const res = await fetch(`/api/tasks/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
    });
    if (!res.ok) throw new Error('Failed to update status');
    return res.json();
}

async function deleteTaskAPI(id) {
    const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete task');
    return res.json();
}

// ---- Rendering ----
function clearChildren(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
}

function renderTasks() {
    const filter = statusFilter ? statusFilter.value : 'ALL';

    clearChildren(todoTasks);
    clearChildren(progressTasks);
    clearChildren(doneTasks);

    const filtered = allTasks.filter(t => filter === 'ALL' ? true : t.status === filter);

    const todo = filtered.filter(t => t.status === 'TODO');
    const inprog = filtered.filter(t => t.status === 'IN_PROGRESS');
    const done = filtered.filter(t => t.status === 'DONE');

    todo.forEach(t => todoTasks.appendChild(createTaskCard(t)));
    inprog.forEach(t => progressTasks.appendChild(createTaskCard(t)));
    done.forEach(t => doneTasks.appendChild(createTaskCard(t)));

    todoCount.textContent = todo.length;
    progressCount.textContent = inprog.length;
    doneCount.textContent = done.length;
}

function createTaskCard(task) {
    const card = document.createElement('div');
    card.className = 'task-card';

    const title = document.createElement('div');
    title.className = 'task-header';
    title.innerHTML = `
        <div class="task-title">${escapeHtml(task.title)}</div>
        <span class="priority-badge priority-${(task.priority||'MEDIUM').toLowerCase()}">${escapeHtml(task.priority||'MEDIUM')}</span>
    `;

    const desc = document.createElement('div');
    desc.className = 'task-description';
    desc.textContent = task.description || '';

    const meta = document.createElement('div');
    meta.className = 'task-meta';
    meta.textContent = `Created: ${formatDate(task.created_at)}`;

    const actions = document.createElement('div');
    actions.className = 'task-actions';

    // Status button
    if (task.status === 'TODO') {
        const btn = document.createElement('button');
        btn.className = 'btn btn-secondary btn-sm';
        btn.textContent = '→ In Progress';
        btn.onclick = () => window.updateTaskStatus(task.id, 'IN_PROGRESS');
        actions.appendChild(btn);
    } else if (task.status === 'IN_PROGRESS') {
        const btn = document.createElement('button');
        btn.className = 'btn btn-success btn-sm';
        btn.textContent = '→ Done';
        btn.onclick = () => window.updateTaskStatus(task.id, 'DONE');
        actions.appendChild(btn);
    }

    // Delete button
    const del = document.createElement('button');
    del.className = 'btn btn-danger btn-sm';
    del.textContent = '🗑️ Delete';
    del.onclick = () => window.deleteTask(task.id);
    actions.appendChild(del);

    card.appendChild(title);
    card.appendChild(desc);
    card.appendChild(meta);
    card.appendChild(actions);

    return card;
}

// ---- Event handlers ----
if (addTaskForm) {
    addTaskForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = titleInput.value.trim();
        if (!title) return alert('Title is required');
        const payload = {
            title,
            description: descInput.value.trim(),
            priority: prioritySelect.value
        };
        try {
            showLoading();
            await createTaskAPI(payload);
            addTaskForm.reset();
            await fetchTasks();
        } catch (err) {
            console.error(err);
            alert('Failed to create task');
        } finally {
            hideLoading();
        }
    });
}

if (statusFilter) {
    statusFilter.addEventListener('change', () => renderTasks());
}

// Expose global helpers for inline onclicks
window.updateTaskStatus = async function(id, status) {
    try {
        showLoading();
        await updateTaskStatusAPI(id, status);
        await fetchTasks();
    } catch (err) {
        console.error(err);
        alert('Failed to update status');
    } finally {
        hideLoading();
    }
};

window.deleteTask = async function(id) {
    if (!confirm('Delete this task?')) return;
    try {
        showLoading();
        await deleteTaskAPI(id);
        await fetchTasks();
    } catch (err) {
        console.error(err);
        alert('Failed to delete task');
    } finally {
        hideLoading();
    }
};

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    fetchTasks();
});