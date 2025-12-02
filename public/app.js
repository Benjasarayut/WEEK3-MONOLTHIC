// ---- State + DOM refs ----
let allTasks = [];
let currentSearch = '';

const addTaskForm = document.getElementById('addTaskForm');
const titleInput = document.getElementById('taskTitle');
const descInput = document.getElementById('taskDescription');
const prioritySelect = document.getElementById('taskPriority');
const statusFilter = document.getElementById('statusFilter');
const linkInput = document.getElementById('taskLink');
const assigneesInput = document.getElementById('taskAssignees');

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

let _lastReadyToastAt = 0;
let _readyAlertShown = false;

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
        const now = Date.now();
        if (now - _lastReadyToastAt > 10000) {
            _lastReadyToastAt = now;
            showToast('ทุกงานใน In Progress พร้อมส่งแล้ว 🎉');
        }
    }
}

function renderHeaderSummary() {
    const header = document.querySelector('header');
    if (!header) return;
    let summary = document.getElementById('headerSummary');
    const counts = {
        TODO: allTasks.filter(t => t.status === 'TODO').length,
        IN_PROGRESS: allTasks.filter(t => t.status === 'IN_PROGRESS').length,
        DONE: allTasks.filter(t => t.status === 'DONE').length
    };
    if (!summary) {
        summary = document.createElement('div');
        summary.id = 'headerSummary';
        summary.style.marginTop = '12px';
        summary.style.display = 'flex';
        summary.style.gap = '12px';
        summary.style.justifyContent = 'center';
        header.appendChild(summary);
    }
    summary.innerHTML = `
        <div class="hdr-badge hdr-todo">📝 ${counts.TODO}</div>
        <div class="hdr-badge hdr-progress">🔄 ${counts.IN_PROGRESS}</div>
        <div class="hdr-badge hdr-done">✅ ${counts.DONE}</div>
    `;
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

    const searchTerm = currentSearch ? currentSearch.trim().toLowerCase() : '';
    const filtered = allTasks.filter(t => {
        const statusMatch = filter === 'ALL' ? true : t.status === filter;
        if (!statusMatch) return false;
        if (!searchTerm) return true;
        const inTitle = t.title && t.title.toLowerCase().includes(searchTerm);
        const inDesc = t.description && t.description.toLowerCase().includes(searchTerm);
        return inTitle || inDesc;
    });

    const todo = filtered.filter(t => t.status === 'TODO');
    const inprog = filtered.filter(t => t.status === 'IN_PROGRESS');
    const done = filtered.filter(t => t.status === 'DONE');

    if (todo.length === 0) {
        const ph = document.createElement('div');
        ph.className = 'empty-placeholder';
        ph.textContent = searchTerm ? 'ไม่มีงานที่ตรงกับการค้นหาใน To Do' : 'ไม่มีงานใน To Do';
        todoTasks.appendChild(ph);
    } else {
        todo.forEach(t => todoTasks.appendChild(createTaskCard(t)));
    }

    if (inprog.length === 0) {
        const ph = document.createElement('div');
        ph.className = 'empty-placeholder';
        ph.textContent = searchTerm ? 'ไม่มีงานที่ตรงกับการค้นหาใน In Progress' : 'ไม่มีงานใน In Progress';
        progressTasks.appendChild(ph);
    } else {
        inprog.forEach(t => progressTasks.appendChild(createTaskCard(t)));
    }

    if (done.length === 0) {
        const ph = document.createElement('div');
        ph.className = 'empty-placeholder';
        ph.textContent = searchTerm ? 'ไม่มีงานที่ตรงกับการค้นหาใน Done' : 'ไม่มีงานใน Done';
        doneTasks.appendChild(ph);
    } else {
        done.forEach(t => doneTasks.appendChild(createTaskCard(t)));
    }

    todoCount.textContent = todo.length;
    progressCount.textContent = inprog.length;
    doneCount.textContent = done.length;

    // Setup drag and drop after rendering
    setupDragAndDrop();
    // Update ready indicator after rendering tasks
    renderReadyIndicator();
    // Update header summary badges
    renderHeaderSummary();
}

function createTaskCard(task) {
    const card = document.createElement('div');
    card.className = 'task-card';
    card.draggable = true;
    card.dataset.taskId = task.id;
    // If task is DONE, lock interactions and prevent dragging
    if (task.status === 'DONE') {
        card.draggable = false;
        card.classList.add('done-locked');
    }

    const title = document.createElement('div');
    title.className = 'task-header';
    title.innerHTML = `
        <div class="task-title">${escapeHtml(task.title)}</div>
        <span class="priority-badge priority-${(task.priority||'MEDIUM').toLowerCase()}">${escapeHtml(task.priority||'MEDIUM')}</span>
    `;

    const desc = document.createElement('div');
    desc.className = 'task-description';
    desc.textContent = task.description || '';

    // Link display
    if (task.link) {
        const linkEl = document.createElement('div');
        linkEl.className = 'task-link';
        const a = document.createElement('a');
        a.href = task.link;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = task.link;
        linkEl.appendChild(a);
        card.appendChild(linkEl);
    }

    const meta = document.createElement('div');
    meta.className = 'task-meta';
    meta.textContent = `Created: ${formatDate(task.created_at)}`;

    const actions = document.createElement('div');
    actions.className = 'task-actions';

    // Assignees display (show initials)
    if (task.assignees) {
        const assWrap = document.createElement('div');
        assWrap.className = 'assignees-wrap';
        assWrap.style.display = 'flex';
        assWrap.style.gap = '6px';
        assWrap.style.alignItems = 'center';
        try {
            let list = task.assignees;
            if (typeof list === 'string') {
                // try parse JSON
                try { list = JSON.parse(list); } catch (e) { list = list.split(',').map(s=>s.trim()).filter(Boolean); }
            }
            (list || []).slice(0,5).forEach(name => {
                const av = document.createElement('div');
                av.className = 'assignee-avatar';
                av.textContent = String(name).trim().split(' ').map(s=>s[0]||'')[0].toUpperCase();
                av.title = name;
                assWrap.appendChild(av);
            });
            if ((Array.isArray(list) && list.length > 5) || (typeof list === 'string' && list.split(',').length > 5)) {
                const more = document.createElement('div');
                more.className = 'assignee-more';
                more.textContent = `+${(Array.isArray(list)?list.length: (String(list).split(',').length)) - 5}`;
                assWrap.appendChild(more);
            }
            // insert assignees before actions
            card.insertBefore(assWrap, actions);
        } catch (e) {
            // ignore
        }
    }

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
            // Toggle Done button in the same actions area
            try {
                const parent = readyWrap.parentElement || actions;
                const doneBtn = parent.querySelector('button.btn-success');
                if (doneBtn) doneBtn.disabled = !e.target.checked;
            } catch (er) {
                // ignore
            }
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
        if (isTaskReady(task.id)) {
            btn.onclick = () => window.updateTaskStatus(task.id, 'DONE');
        } else {
            btn.disabled = true;
            btn.title = 'กด "พร้อมส่ง" ก่อนจึงจะทำเครื่องหมายเป็น Done';
        }
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

    // Click to open task details modal (ignore clicks on buttons/inputs)
    card.addEventListener('click', (e) => {
        const target = e.target;
        if (target.closest('button') || target.closest('input') || target.closest('a')) return;
        openTaskModal(task);
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
                // Prevent moving tasks that are already DONE
                const taskObj = allTasks.find(t => String(t.id) === String(taskId));
                if (taskObj && taskObj.status === 'DONE') {
                    alert('ไม่สามารถย้ายงานที่เป็น DONE ได้');
                    return;
                }
                // If moving IN_PROGRESS task to DONE, require ready flag
                if (taskObj && taskObj.status === 'IN_PROGRESS' && newStatus === 'DONE' && !isTaskReady(taskId)) {
                    if (!_readyAlertShown) {
                        alert('กด "พร้อมส่ง" ก่อนจึงจะสามารถย้ายงานไปยัง Done ได้');
                        _readyAlertShown = true;
                    }
                    return;
                }
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

// ---- Modal (Task Details) ----
function openTaskModal(task) {
    closeTaskModal();
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'taskModalOverlay';

    const modal = document.createElement('div');
    modal.className = 'modal';

    const header = document.createElement('div');
    header.className = 'modal-header';
    header.innerHTML = `<h3>${escapeHtml(task.title)}</h3>`;

    const body = document.createElement('div');
    body.className = 'modal-body';
    body.innerHTML = `
        <p><strong>คำอธิบาย:</strong></p>
        <p>${escapeHtml(task.description || '')}</p>
        <p><strong>สถานะ:</strong> ${escapeHtml(task.status)}</p>
        <p><strong>ความสำคัญ:</strong> ${escapeHtml(task.priority || 'MEDIUM')}</p>
        <p><strong>สร้างเมื่อ:</strong> ${escapeHtml(task.created_at || '')}</p>
        <p><strong>อัปเดต:</strong> ${escapeHtml(task.updated_at || '')}</p>
        ${task.link ? `<p><strong>Link:</strong> <a href="${escapeHtml(task.link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(task.link)}</a></p>` : ''}
        ${task.assignees ? `<p><strong>Assignees:</strong> ${escapeHtml(Array.isArray(task.assignees)?task.assignees.join(', '): task.assignees)}</p>` : ''}
    `;

    const actions = document.createElement('div');
    actions.className = 'modal-actions';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'btn btn-secondary';
    closeBtn.textContent = 'ปิด';
    closeBtn.onclick = closeTaskModal;
    actions.appendChild(closeBtn);

    modal.appendChild(header);
    modal.appendChild(body);
    modal.appendChild(actions);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // click outside to close
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeTaskModal();
    });
}

function closeTaskModal() {
    const existing = document.getElementById('taskModalOverlay');
    if (existing) existing.remove();
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
            // optional link + assignees
            if (linkInput && linkInput.value.trim()) payload.link = linkInput.value.trim();
            if (assigneesInput && assigneesInput.value.trim()) {
                // store as array by splitting commas and trimming
                payload.assignees = assigneesInput.value.split(',').map(s => s.trim()).filter(Boolean);
            }
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
        // If moving into IN_PROGRESS or DONE, ensure ready flag is reset appropriately
        if (status === 'IN_PROGRESS' || status === 'DONE') setTaskReady(id, false);

        showLoading();
        await updateTaskStatusAPI(id, status);
        await fetchTasks();

        // After reloading tasks, purge any ready flags that belong to non-IN_PROGRESS tasks
        purgeReadyFlags();
        renderTasks();
    } catch (err) {
        console.error(err);
        alert('Failed to update status');
    } finally {
        hideLoading();
    }
};

function purgeReadyFlags() {
    try {
        allTasks.forEach(t => {
            if (t.status !== 'IN_PROGRESS' && isTaskReady(t.id)) {
                setTaskReady(t.id, false);
            }
        });
    } catch (e) {
        console.warn('Error purging ready flags', e);
    }
}

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

    // Search input wiring
    const searchInput = document.getElementById('taskSearch');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            currentSearch = e.target.value || '';
            renderTasks();
        });
    }

    // Keyboard shortcut: press '/' to focus search
    document.addEventListener('keydown', (e) => {
        const active = document.activeElement;
        const isTyping = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable);
        if (e.key === '/' && !isTyping) {
            e.preventDefault();
            if (searchInput) searchInput.focus();
        }
    });
});