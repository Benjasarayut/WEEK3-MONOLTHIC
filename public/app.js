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
// Ready-to-submit indicator element will be managed dynamically

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

// ---- Ready state (client-side, persisted in localStorage) ----
function isTaskReady(id) {
    try {
        return localStorage.getItem(`task_ready_${id}`) === '1';
    } catch (e) {
        return false;
    }
}

function setTaskReady(id, ready) {
    try {
        if (ready) localStorage.setItem(`task_ready_${id}`, '1');
        else localStorage.removeItem(`task_ready_${id}`);
    } catch (e) {
        console.warn('Could not persist ready state', e);
    }
}

function renderReadyIndicator() {
    const header = document.querySelector('header');
    if (!header) return;
    const inprog = allTasks.filter(t => t.status === 'IN_PROGRESS');
    const readyCount = inprog.filter(t => isTaskReady(t.id)).length;

    let el = document.getElementById('readyIndicator');
    if (!el) {
        el = document.createElement('div');
        el.id = 'readyIndicator';
        el.style.marginTop = '8px';
        el.style.fontWeight = '600';
        el.style.color = 'rgba(255,255,255,0.95)';
        header.appendChild(el);
    }

    if (inprog.length === 0) {
        el.textContent = 'ไม่มีงานในสถานะ In Progress';
        return;
    }

    el.textContent = `In Progress ready: ${readyCount} / ${inprog.length}`;

    // notify when all in-progress tasks are ready
    if (inprog.length > 0 && readyCount === inprog.length) {
        showToast('ทุกงานใน In Progress พร้อมส่งแล้ว 🎉');
    }
}

function showToast(message, timeout = 4000) {
    const t = document.createElement('div');
    t.className = 'app-toast';
    t.textContent = message;
    Object.assign(t.style, {
        position: 'fixed',
        right: '20px',
        bottom: '20px',
        background: 'rgba(0,0,0,0.85)',
        color: 'white',
        padding: '12px 16px',
        borderRadius: '8px',
        boxShadow: '0 6px 20px rgba(0,0,0,0.3)',
        zIndex: 2000,
        fontWeight: 600,
    });
    document.body.appendChild(t);
    setTimeout(() => {
        t.style.transition = 'opacity 0.4s';
        t.style.opacity = '0';
    }, timeout - 400);
    setTimeout(() => t.remove(), timeout);
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

    // Setup drag and drop after rendering
    setupDragAndDrop();
    // Update ready indicator after rendering tasks
    renderReadyIndicator();
}

function createTaskCard(task) {
    const card = document.createElement('div');
    card.className = 'task-card';
    card.draggable = true;
    card.dataset.taskId = task.id;

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
        // Ready checkbox
        const readyWrap = document.createElement('div');
        readyWrap.style.display = 'flex';
        readyWrap.style.alignItems = 'center';
        readyWrap.style.gap = '8px';

        const readyCheckbox = document.createElement('input');
        readyCheckbox.type = 'checkbox';
        readyCheckbox.checked = isTaskReady(task.id);
        readyCheckbox.id = `ready_chk_${task.id}`;
        readyCheckbox.onchange = (e) => {
            setTaskReady(task.id, e.target.checked);
            renderReadyIndicator();
        };

        const readyLabel = document.createElement('label');
        readyLabel.setAttribute('for', `ready_chk_${task.id}`);
        readyLabel.textContent = 'พร้อมส่ง';
        readyLabel.style.fontSize = '12px';
        readyLabel.style.fontWeight = '700';

        readyWrap.appendChild(readyCheckbox);
        readyWrap.appendChild(readyLabel);
        actions.appendChild(readyWrap);

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

    // Drag event listeners
    card.addEventListener('dragstart', (e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('taskId', task.id);
        card.classList.add('dragging');
    });

    card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
    });

    return card;
}

// ---- Drag and Drop Setup ----
function setupDragAndDrop() {
    const columns = [todoTasks, progressTasks, doneTasks];
    const statusMap = {
        'todoTasks': 'TODO',
        'progressTasks': 'IN_PROGRESS',
        'doneTasks': 'DONE'
    };

    columns.forEach(column => {
        column.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            column.classList.add('drag-over');
        });

        column.addEventListener('dragleave', () => {
            column.classList.remove('drag-over');
        });

        column.addEventListener('drop', async (e) => {
            e.preventDefault();
            column.classList.remove('drag-over');
            const taskId = e.dataTransfer.getData('taskId');
            const newStatus = statusMap[column.id];

            if (taskId && newStatus) {
                try {
                    showLoading();
                    await updateTaskStatusAPI(taskId, newStatus);
                    await fetchTasks();
                } catch (err) {
                    console.error(err);
                    alert('Failed to move task');
                } finally {
                    hideLoading();
                }
            }
        });
    });
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
    setupDragAndDrop();
});