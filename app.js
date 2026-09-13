const storageKey = 'todo-webapp-items';
const categoryStorageKey = 'todo-webapp-categories';

const todoForm = document.getElementById('todo-form');
const todoInput = document.getElementById('todo-input');
const todoPriority = document.getElementById('todo-priority');
const todoCategory = document.getElementById('todo-category');
const todoList = document.getElementById('todo-list');
const validationMessage = document.getElementById('todo-validation-message');
const categoryForm = document.getElementById('category-form');
const categoryInput = document.getElementById('category-input');
const categoryNav = document.getElementById('todo-category-nav');
const filterButtons = document.querySelectorAll('[data-filter]');
const deleteCategoryButton = document.getElementById('delete-category-button');
const expandedTaskIds = new Set();

let tasks = loadTasks();
let categories = loadCategories();
let editingTaskId = null;
let currentFilter = 'all';
let currentCategory = 'all';

function normalizeCategories(values) {
  const normalized = values
    .map((value) => String(value).trim())
    .filter((value) => value.length > 0)
    .filter((value, index, array) => array.indexOf(value) === index);

  if (normalized.length === 0) {
    return ['Today'];
  }

  if (!normalized.some((value) => value.toLowerCase() === 'today')) {
    normalized.unshift('Today');
  }

  return normalized.filter((value, index, array) => array.indexOf(value) === index);
}

function normalizeTask(task) {
  return {
    id: task.id,
    text: task.text || '',
    completed: Boolean(task.completed),
    priority: ['high', 'medium', 'low'].includes(task.priority) ? task.priority : 'medium',
    category: task.category || 'Today',
    subtasks: Array.isArray(task.subtasks)
      ? task.subtasks.map((subtask) => ({
          id: subtask.id || Date.now() + Math.random(),
          text: subtask.text || '',
          completed: Boolean(subtask.completed),
        }))
      : [],
  };
}

function loadTasks() {
  try {
    const storedTasks = JSON.parse(localStorage.getItem(storageKey));
    const normalizedTasks = Array.isArray(storedTasks) ? storedTasks : [];
    return normalizedTasks.map(normalizeTask);
  } catch (error) {
    console.error('Could not load tasks from localStorage:', error);
    return [];
  }
}

function loadCategories() {
  try {
    const storedCategories = JSON.parse(localStorage.getItem(categoryStorageKey));
    const normalizedCategories = Array.isArray(storedCategories) ? storedCategories : ['Today'];
    return normalizeCategories(normalizedCategories);
  } catch (error) {
    console.error('Could not load categories from localStorage:', error);
    return ['Today'];
  }
}

function saveTasks() {
  localStorage.setItem(storageKey, JSON.stringify(tasks));
}

function saveCategories() {
  localStorage.setItem(categoryStorageKey, JSON.stringify(categories));
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showValidation(message) {
  validationMessage.textContent = message;
  validationMessage.hidden = !message;
}

function clearValidation() {
  validationMessage.textContent = '';
  validationMessage.hidden = true;
}

function getCategoryTasks() {
  return currentCategory === 'all'
    ? tasks
    : tasks.filter((task) => (task.category || 'Today') === currentCategory);
}

function getVisibleTasks() {
  const categoryFilteredTasks = getCategoryTasks();

  if (currentFilter === 'active') {
    return categoryFilteredTasks.filter((task) => !task.completed);
  }

  if (currentFilter === 'completed') {
    return categoryFilteredTasks.filter((task) => task.completed);
  }

  return categoryFilteredTasks;
}

function updateFilterButtons() {
  filterButtons.forEach((button) => {
    const isActive = button.dataset.filter === currentFilter;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });
}

function renderCategoryOptions() {
  const options = categories
    .map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`)
    .join('');

  todoCategory.innerHTML = options;

  if (categories.includes('Today')) {
    todoCategory.value = 'Today';
  } else {
    todoCategory.value = categories[0] || 'Today';
  }
}

function renderCategoryButtons() {
  const buttons = [
    { id: 'all', label: 'All tasks' },
    ...categories.map((category) => ({ id: category, label: category })),
  ];

  categoryNav.innerHTML = buttons
    .map((button) => {
      const isActive = currentCategory === button.id;
      const buttonId = button.id.toLowerCase().replace(/\s+/g, '-');

      return `
        <button
          type="button"
          class="category-btn ${isActive ? 'active' : ''}"
          data-category="${button.id}"
          data-testid="todo-category-button-${buttonId}"
          aria-pressed="${String(isActive)}"
        >
          ${escapeHtml(button.label)}
        </button>
      `;
    })
    .join('');
}

function updateCategorySummary() {
  const { total, completed, left, percentLeft } = getCategoryProgress();
  const progressFill = document.getElementById('todo-progress-fill');
  const tasksLeftCount = document.querySelector('[data-testid="todo-tasks-left-count"]');
  const tasksDoneCount = document.querySelector('[data-testid="todo-tasks-done-count"]');
  const progressLabel = document.querySelector('[data-testid="todo-progress-label"]');
  const progressDetail = document.querySelector('[data-testid="todo-progress-detail"]');

  if (progressFill) {
    progressFill.style.width = `${Math.min(percentLeft, 100)}%`;
  }

  if (tasksLeftCount) {
    tasksLeftCount.textContent = `Tasks left: ${left}`;
  }

  if (tasksDoneCount) {
    tasksDoneCount.textContent = `Done: ${completed}`;
  }

  if (progressLabel) {
    progressLabel.textContent = `${Math.round(percentLeft)}% left to complete`;
  }

  if (progressDetail) {
    progressDetail.textContent = `${completed} of ${total} tasks completed`;
  }
}

function getCategoryProgress() {
  const categoryTasks = getCategoryTasks();
  const total = categoryTasks.length;
  const completed = categoryTasks.filter((task) => task.completed).length;
  const left = total - completed;
  const percentLeft = total === 0 ? 0 : (left / total) * 100;

  return { total, completed, left, percentLeft };
}

function renderTasks() {
  const visibleTasks = getVisibleTasks();

  if (visibleTasks.length === 0) {
    let emptyMessage = 'No tasks yet. Add one above.';

    if (currentFilter === 'active') {
      emptyMessage = 'No active tasks. Add a new task to get started.';
    }

    if (currentFilter === 'completed') {
      emptyMessage = 'No completed tasks yet.';
    }

    if (currentCategory !== 'all') {
      emptyMessage = `No tasks in the ${currentCategory} category.`;
    }

    todoList.innerHTML = `<li class="empty-state" data-testid="todo-empty-state">${emptyMessage}</li>`;
    updateFilterButtons();
    renderCategoryButtons();
    updateCategorySummary();
    return;
  }

  todoList.innerHTML = visibleTasks
    .map((task) => {
      const isEditing = editingTaskId === task.id;
      const taskCategory = task.category || 'Today';
      const priorityKey = task.priority || 'medium';

      if (isEditing) {
        return `
          <li class="todo-item ${task.completed ? 'completed' : ''}" data-id="${task.id}" data-testid="todo-item-${task.id}">
            <label class="todo-label">
              <input
                type="checkbox"
                data-action="toggle"
                data-testid="todo-toggle-${task.id}"
                ${task.completed ? 'checked' : ''}
              />
              <div class="edit-task-fields">
                <input
                  type="text"
                  class="edit-input"
                  value="${escapeHtml(task.text)}"
                  data-action="edit-input"
                  data-testid="todo-edit-input-${task.id}"
                />
                <div class="task-selectors">
                  <div class="field-group">
                    <label for="edit-priority-${task.id}">Priority</label>
                    <select id="edit-priority-${task.id}" class="edit-select" data-action="edit-priority" data-testid="todo-edit-priority-${task.id}">
                      <option value="high" ${priorityKey === 'high' ? 'selected' : ''}>High</option>
                      <option value="medium" ${priorityKey === 'medium' ? 'selected' : ''}>Medium</option>
                      <option value="low" ${priorityKey === 'low' ? 'selected' : ''}>Low</option>
                    </select>
                  </div>
                  <div class="field-group">
                    <label for="edit-category-${task.id}">Category</label>
                    <select id="edit-category-${task.id}" class="edit-select" data-action="edit-category" data-testid="todo-edit-category-${task.id}">
                      ${categories
                        .map(
                          (category) =>
                            `<option value="${escapeHtml(category)}" ${taskCategory === category ? 'selected' : ''}>${escapeHtml(category)}</option>`
                        )
                        .join('')}
                    </select>
                  </div>
                </div>
              </div>
            </label>
            <div class="task-actions">
              <button type="button" class="save-btn" data-action="save-edit" data-testid="todo-save-edit-${task.id}">Save</button>
              <button type="button" class="cancel-btn" data-action="cancel-edit" data-testid="todo-cancel-edit-${task.id}">Cancel</button>
              <button type="button" class="delete-btn" data-action="delete" data-testid="todo-delete-button-${task.id}">Delete</button>
            </div>
          </li>
        `;
      }

      const expanded = expandedTaskIds.has(task.id);
      const subtasksMarkup = Array.isArray(task.subtasks) && task.subtasks.length > 0
        ? task.subtasks
            .map(
              (subtask) => `
                <li class="subtask-item ${subtask.completed ? 'completed' : ''}" data-testid="todo-subtask-item-${task.id}-${subtask.id}">
                  <label class="subtask-label">
                    <input
                      type="checkbox"
                      data-action="toggle-subtask"
                      data-id="${subtask.id}"
                      ${subtask.completed ? 'checked' : ''}
                      data-testid="todo-subtask-toggle-${task.id}-${subtask.id}"
                    />
                    <span class="subtask-text">${escapeHtml(subtask.text)}</span>
                  </label>
                  <button
                    type="button"
                    class="subtask-delete-btn"
                    data-action="delete-subtask"
                    data-id="${subtask.id}"
                    data-testid="todo-delete-subtask-${task.id}-${subtask.id}"
                  >
                    Delete
                  </button>
                </li>
              `
            )
            .join('')
        : '<li class="empty-state" data-testid="todo-empty-subtasks-${task.id}">No subtasks yet.</li>';

      return `
        <li class="todo-item ${task.completed ? 'completed' : ''}" data-id="${task.id}" data-testid="todo-item-${task.id}">
          <label class="todo-label">
            <input
              type="checkbox"
              data-action="toggle"
              data-testid="todo-toggle-${task.id}"
              ${task.completed ? 'checked' : ''}
            />
            <div class="task-content">
              <span class="todo-text">${escapeHtml(task.text)}</span>
              <div class="task-meta">
                <span class="priority-badge ${priorityKey}" data-testid="todo-priority-badge-${task.id}">${escapeHtml(priorityKey)}</span>
                <span class="category-badge" data-testid="todo-category-badge-${task.id}">${escapeHtml(taskCategory)}</span>
              </div>
              <div class="task-details">
                <button
                  type="button"
                  class="subtask-toggle-btn"
                  data-action="toggle-subtasks"
                  data-testid="todo-toggle-subtasks-${task.id}"
                >
                  ${expanded ? 'Hide subtasks' : 'Show subtasks'} (${task.subtasks ? task.subtasks.length : 0})
                </button>
                ${expanded ? `
                  <div class="subtask-panel">
                    <div class="subtask-form">
                      <input
                        type="text"
                        placeholder="Add subtask"
                        data-action="subtask-input"
                        data-testid="todo-subtask-input-${task.id}"
                      />
                      <button
                        type="button"
                        class="subtask-add-btn"
                        data-action="add-subtask"
                        data-testid="todo-add-subtask-${task.id}"
                      >
                        Add
                      </button>
                    </div>
                    <ul class="subtask-list">
                      ${subtasksMarkup}
                    </ul>
                  </div>
                ` : ''}
              </div>
            </div>
          </label>
          <div class="task-actions">
            <button type="button" class="action-btn" data-action="edit" data-testid="todo-edit-button-${task.id}">Edit</button>
            <button type="button" class="delete-btn" data-action="delete" data-testid="todo-delete-button-${task.id}">Delete</button>
          </div>
        </li>
      `;
    })
    .join('');

  updateFilterButtons();
  renderCategoryButtons();
  updateCategorySummary();
}

function addTask(text, priority, category) {
  const trimmedText = text.trim();
  const normalizedPriority = priority || 'medium';
  const normalizedCategory = category || 'Today';

  if (!trimmedText) {
    showValidation('Please enter a task before adding it.');
    return;
  }

  if (!['high', 'medium', 'low'].includes(normalizedPriority)) {
    showValidation('Please choose a valid priority.');
    return;
  }

  if (!categories.includes(normalizedCategory)) {
    categories = normalizeCategories([...categories, normalizedCategory]);
    saveCategories();
  }

  tasks.push({
    id: Date.now() + Math.random(),
    text: trimmedText,
    completed: false,
    priority: normalizedPriority,
    category: normalizedCategory,
    subtasks: [],
  });

  clearValidation();
  saveTasks();
  renderCategoryOptions();
  renderTasks();
}

function toggleTask(taskId, completed) {
  tasks = tasks.map((task) => {
    if (task.id !== taskId) {
      return task;
    }

    const subtasks = (task.subtasks || []).map((subtask) => ({ ...subtask, completed }));

    return {
      ...task,
      completed,
      subtasks,
    };
  });

  saveTasks();
  renderTasks();
}

function updateTask(taskId, nextText, nextPriority, nextCategory) {
  const trimmedText = nextText.trim();
  const normalizedPriority = nextPriority || 'medium';
  const normalizedCategory = nextCategory || 'Today';

  if (!trimmedText) {
    showValidation('Task text cannot be empty.');
    return;
  }

  if (!['high', 'medium', 'low'].includes(normalizedPriority)) {
    showValidation('Please choose a valid priority.');
    return;
  }

  if (!categories.includes(normalizedCategory)) {
    categories = normalizeCategories([...categories, normalizedCategory]);
    saveCategories();
  }

  tasks = tasks.map((task) =>
    task.id === taskId
      ? { ...task, text: trimmedText, priority: normalizedPriority, category: normalizedCategory }
      : task
  );

  editingTaskId = null;
  clearValidation();
  saveTasks();
  saveCategories();
  renderCategoryOptions();
  renderTasks();
}

function deleteTask(taskId) {
  tasks = tasks.filter((task) => task.id !== taskId);

  if (editingTaskId === taskId) {
    editingTaskId = null;
  }

  clearValidation();
  saveTasks();
  renderTasks();
}

function addCategory(name) {
  const trimmedName = name.trim();

  if (!trimmedName) {
    showValidation('Category name cannot be empty.');
    return;
  }

  if (categories.some((category) => category.toLowerCase() === trimmedName.toLowerCase())) {
    showValidation('This category already exists.');
    return;
  }

  categories = normalizeCategories([...categories, trimmedName]);
  currentCategory = trimmedName;
  saveCategories();
  renderCategoryOptions();
  renderCategoryButtons();
  renderTasks();
  clearValidation();
  categoryInput.value = '';
  categoryInput.focus();
}

function deleteSelectedCategory() {
  if (currentCategory === 'all' || currentCategory === 'Today') {
    showValidation('You cannot delete All tasks or Today.');
    return;
  }

  const confirmed = window.confirm(
    `Are you sure you want to delete the "${currentCategory}" category? All tasks in this category will be moved to Today.`
  );

  if (!confirmed) {
    return;
  }

  categories = categories.filter((category) => category !== currentCategory);
  tasks = tasks.map((task) =>
    task.category === currentCategory ? { ...task, category: 'Today' } : task
  );
  currentCategory = 'all';
  saveTasks();
  saveCategories();
  renderCategoryOptions();
  renderCategoryButtons();
  renderTasks();
  clearValidation();
}

function addSubtask(taskId, subtaskText) {
  const trimmedText = subtaskText.trim();

  if (!trimmedText) {
    showValidation('Subtask text cannot be empty.');
    return;
  }

  tasks = tasks.map((task) => {
    if (task.id !== taskId) {
      return task;
    }

    return {
      ...task,
      subtasks: [...(task.subtasks || []), { id: Date.now() + Math.random(), text: trimmedText, completed: false }],
    };
  });

  clearValidation();
  saveTasks();
  renderTasks();
}

function toggleSubtask(taskId, subtaskId, completed) {
  tasks = tasks.map((task) => {
    if (task.id !== taskId) {
      return task;
    }

    const subtasks = (task.subtasks || []).map((subtask) =>
      subtask.id === subtaskId ? { ...subtask, completed } : subtask
    );

    const areAllSubtasksCompleted = subtasks.length > 0 && subtasks.every((subtask) => subtask.completed);

    return {
      ...task,
      subtasks,
      completed: areAllSubtasksCompleted,
    };
  });

  saveTasks();
  renderTasks();
}

function deleteSubtask(taskId, subtaskId) {
  tasks = tasks.map((task) => {
    if (task.id !== taskId) {
      return task;
    }

    const subtasks = (task.subtasks || []).filter((subtask) => subtask.id !== subtaskId);
    const allSubtasksCompleted = subtasks.length > 0 && subtasks.every((subtask) => subtask.completed);

    return {
      ...task,
      subtasks,
      completed: subtasks.length > 0 ? allSubtasksCompleted : false,
    };
  });

  saveTasks();
  renderTasks();
}

todoForm.addEventListener('submit', (event) => {
  event.preventDefault();
  addTask(todoInput.value, todoPriority.value, todoCategory.value);
  todoInput.value = '';
  todoPriority.value = 'medium';
  renderCategoryOptions();
  todoInput.focus();
});

categoryForm.addEventListener('submit', (event) => {
  event.preventDefault();
  addCategory(categoryInput.value);
});

deleteCategoryButton.addEventListener('click', () => {
  deleteSelectedCategory();
});

categoryNav.addEventListener('click', (event) => {
  const categoryButton = event.target.closest('[data-category]');

  if (!categoryButton) {
    return;
  }

  currentCategory = categoryButton.dataset.category;
  editingTaskId = null;
  clearValidation();
  renderTasks();
});

filterButtons.forEach((button) => {
  button.addEventListener('click', () => {
    currentFilter = button.dataset.filter;
    editingTaskId = null;
    clearValidation();
    renderTasks();
  });
});

todoList.addEventListener('change', (event) => {
  const checkbox = event.target.closest('[data-action="toggle"]');

  if (checkbox) {
    const item = checkbox.closest('.todo-item');
    const taskId = Number(item.dataset.id);
    toggleTask(taskId, checkbox.checked);
    return;
  }

  const subtaskCheckbox = event.target.closest('[data-action="toggle-subtask"]');

  if (!subtaskCheckbox) {
    return;
  }

  const taskItem = subtaskCheckbox.closest('.todo-item');
  const taskId = Number(taskItem.dataset.id);
  const subtaskId = Number(subtaskCheckbox.dataset.id);
  toggleSubtask(taskId, subtaskId, subtaskCheckbox.checked);
});

todoList.addEventListener('click', (event) => {
  const toggleSubtasksButton = event.target.closest('[data-action="toggle-subtasks"]');

  if (toggleSubtasksButton) {
    const item = toggleSubtasksButton.closest('.todo-item');
    const taskId = Number(item.dataset.id);

    if (expandedTaskIds.has(taskId)) {
      expandedTaskIds.delete(taskId);
    } else {
      expandedTaskIds.add(taskId);
    }

    renderTasks();
    return;
  }

  const addSubtaskButton = event.target.closest('[data-action="add-subtask"]');

  if (addSubtaskButton) {
    const item = addSubtaskButton.closest('.todo-item');
    const taskId = Number(item.dataset.id);
    const subtaskInput = item.querySelector('[data-action="subtask-input"]');

    if (subtaskInput) {
      addSubtask(taskId, subtaskInput.value);
      subtaskInput.value = '';
    }

    return;
  }

  const deleteSubtaskButton = event.target.closest('[data-action="delete-subtask"]');

  if (deleteSubtaskButton) {
    const item = deleteSubtaskButton.closest('.todo-item');
    const taskId = Number(item.dataset.id);
    const subtaskId = Number(deleteSubtaskButton.dataset.id);
    deleteSubtask(taskId, subtaskId);
    return;
  }

  const editButton = event.target.closest('[data-action="edit"]');

  if (editButton) {
    const item = editButton.closest('.todo-item');
    editingTaskId = Number(item.dataset.id);
    clearValidation();
    renderTasks();
    const input = todoList.querySelector('[data-action="edit-input"]');

    if (input) {
      input.focus();
      input.select();
    }

    return;
  }

  const saveButton = event.target.closest('[data-action="save-edit"]');

  if (saveButton) {
    const item = saveButton.closest('.todo-item');
    const taskId = Number(item.dataset.id);
    const editInput = item.querySelector('[data-action="edit-input"]');
    const editPriority = item.querySelector('[data-action="edit-priority"]');
    const editCategory = item.querySelector('[data-action="edit-category"]');
    updateTask(taskId, editInput.value, editPriority.value, editCategory.value);
    return;
  }

  const cancelButton = event.target.closest('[data-action="cancel-edit"]');

  if (cancelButton) {
    editingTaskId = null;
    clearValidation();
    renderTasks();
    return;
  }

  const deleteButton = event.target.closest('[data-action="delete"]');

  if (!deleteButton) {
    return;
  }

  const item = deleteButton.closest('.todo-item');
  const taskId = Number(item.dataset.id);
  deleteTask(taskId);
});

todoList.addEventListener('keydown', (event) => {
  const editInput = event.target.closest('[data-action="edit-input"]');

  if (editInput && event.key === 'Enter') {
    const item = editInput.closest('.todo-item');
    const taskId = Number(item.dataset.id);
    const editPriority = item.querySelector('[data-action="edit-priority"]');
    const editCategory = item.querySelector('[data-action="edit-category"]');
    updateTask(taskId, editInput.value, editPriority.value, editCategory.value);
    return;
  }

  const subtaskInput = event.target.closest('[data-action="subtask-input"]');

  if (subtaskInput && event.key === 'Enter') {
    const item = subtaskInput.closest('.todo-item');
    const taskId = Number(item.dataset.id);
    addSubtask(taskId, subtaskInput.value);
    subtaskInput.value = '';
  }
});

renderCategoryOptions();
renderCategoryButtons();
renderTasks();
