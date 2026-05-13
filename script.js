```javascript
let transactions = [];
let userId = "shared_expense_tracker";

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    setDefaultDate();
    loadTransactions();
    syncTransactions();
});

// Default Date
function setDefaultDate() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('date').value = today;
}

// Event Listeners
function setupEventListeners() {

    document.getElementById('transactionForm')
        .addEventListener('submit', addTransaction);

    document.getElementById('searchInput')
        .addEventListener('input', filterAndRender);

    document.getElementById('filterMonth')
        .addEventListener('change', filterAndRender);

    document.getElementById('saveEditBtn')
        .addEventListener('click', saveEditedTransaction);

    document.getElementById('clearBtn')
        .addEventListener('click', clearAllData);
}

// ADD TRANSACTION
async function addTransaction(e) {

    e.preventDefault();

    const transaction = {
        description: document.getElementById('description').value.trim(),
        amount: parseFloat(document.getElementById('amount').value),
        type: document.getElementById('type').value,
        category: document.getElementById('category').value,
        date: document.getElementById('date').value,
        createdAt: new Date().toISOString()
    };

    try {

        const docRef = await db.collection('transactions').add(transaction);

        await db.collection('transactions')
            .doc(docRef.id)
            .update({
                id: docRef.id
            });

        document.getElementById('transactionForm').reset();

        setDefaultDate();

        updateSyncStatus('✅ Added Successfully', 'synced');

    } catch (err) {

        console.error(err);

        updateSyncStatus('❌ Add Failed', 'error');
    }
}

// LOAD TRANSACTIONS
async function loadTransactions() {

    updateSyncStatus('🔄 Loading...', '');

    try {

        const snapshot = await db.collection('transactions')
            .orderBy('date', 'desc')
            .get();

        transactions = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        renderTransactions(transactions);

        updateSummary();

        updateSyncStatus('✅ Synced', 'synced');

    } catch (err) {

        console.error(err);

        updateSyncStatus('❌ Load Failed', 'error');
    }
}

// LIVE SYNC
function syncTransactions() {

    db.collection('transactions')
        .onSnapshot(snapshot => {

            transactions = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            transactions.sort((a, b) =>
                new Date(b.date) - new Date(a.date)
            );

            renderTransactions(transactions);

            updateSummary();

        }, err => {

            console.error(err);

            updateSyncStatus('❌ Sync Failed', 'error');
        });
}

// RENDER TRANSACTIONS
function renderTransactions(data) {

    const incomeList = document.getElementById('incomeList');
    const expenseList = document.getElementById('expenseList');

    const incomeTotalEl = document.getElementById('incomeTotal');
    const expenseTotalEl = document.getElementById('expenseTotal');

    const incomes = data.filter(t => t.type === 'income');
    const expenses = data.filter(t => t.type === 'expense');

    incomeList.innerHTML = incomes.length
        ? incomes.map(t => createTransactionHTML(t, 'income')).join('')
        : '<p class="empty-msg">No income</p>';

    expenseList.innerHTML = expenses.length
        ? expenses.map(t => createTransactionHTML(t, 'expense')).join('')
        : '<p class="empty-msg">No expenses</p>';

    const incomeTotal = incomes.reduce((s, t) => s + t.amount, 0);

    const expenseTotal = expenses.reduce((s, t) => s + t.amount, 0);

    incomeTotalEl.textContent = `₹${incomeTotal.toFixed(2)}`;

    expenseTotalEl.textContent = `₹${expenseTotal.toFixed(2)}`;
}

// TRANSACTION HTML
function createTransactionHTML(t, type) {

    return `
        <div class="transaction-item ${type}">

            <div class="transaction-info">
                <h4>${t.description}</h4>

                <p>
                    📅 ${formatDate(t.date)} •
                    ${getCategoryEmoji(t.category)} ${t.category}
                </p>
            </div>

            <div class="transaction-amount">
                ${type === 'income' ? '+' : '-'}₹${t.amount.toFixed(2)}
            </div>

            <div class="transaction-actions">

                <button class="btn-edit"
                    onclick="openEditModal('${t.id}')">

                    <i class="fas fa-edit"></i>
                </button>

                <button class="btn-delete"
                    onclick="deleteTransaction('${t.id}')">

                    <i class="fas fa-trash"></i>
                </button>

            </div>

        </div>
    `;
}

// DELETE
async function deleteTransaction(id) {

    if (!confirm('Delete transaction?')) return;

    try {

        await db.collection('transactions')
            .doc(id)
            .delete();

        transactions = transactions.filter(t => t.id !== id);

        renderTransactions(transactions);

        updateSummary();

        updateSyncStatus('✅ Deleted', 'synced');

    } catch (err) {

        console.error(err);

        updateSyncStatus('❌ Delete Failed', 'error');
    }
}

// OPEN EDIT MODAL
function openEditModal(id) {

    const transaction = transactions.find(t => t.id === id);

    if (!transaction) return;

    document.getElementById('editId').value = transaction.id;
    document.getElementById('editDescription').value = transaction.description;
    document.getElementById('editAmount').value = transaction.amount;
    document.getElementById('editType').value = transaction.type;
    document.getElementById('editCategory').value = transaction.category;
    document.getElementById('editDate').value = transaction.date;

    openModal('editModal');
}

// SAVE EDIT
async function saveEditedTransaction() {

    const id = document.getElementById('editId').value;

    const updatedData = {
        description: document.getElementById('editDescription').value.trim(),
        amount: parseFloat(document.getElementById('editAmount').value),
        type: document.getElementById('editType').value,
        category: document.getElementById('editCategory').value,
        date: document.getElementById('editDate').value,
        updatedAt: new Date().toISOString()
    };

    try {

        await db.collection('transactions')
            .doc(id)
            .update(updatedData);

        transactions = transactions.map(t => {

            if (t.id === id) {
                return { ...t, ...updatedData };
            }

            return t;
        });

        renderTransactions(transactions);

        updateSummary();

        closeModal('editModal');

        updateSyncStatus('✅ Updated', 'synced');

    } catch (err) {

        console.error(err);

        alert('Update Failed');

        updateSyncStatus('❌ Update Failed', 'error');
    }
}

// FILTER
function filterAndRender() {

    const search = document.getElementById('searchInput')
        .value.toLowerCase();

    const filtered = transactions.filter(t => {

        return t.description.toLowerCase().includes(search) ||
            t.category.toLowerCase().includes(search);
    });

    renderTransactions(filtered);
}

// SUMMARY
function updateSummary() {

    const income = transactions
        .filter(t => t.type === 'income')
        .reduce((s, t) => s + t.amount, 0);

    const expense = transactions
        .filter(t => t.type === 'expense')
        .reduce((s, t) => s + t.amount, 0);

    const balance = income - expense;

    document.getElementById('totalIncome')
        .textContent = `₹${income.toFixed(2)}`;

    document.getElementById('totalExpense')
        .textContent = `₹${expense.toFixed(2)}`;

    document.getElementById('balance')
        .textContent = `₹${balance.toFixed(2)}`;
}

// CLEAR ALL
async function clearAllData() {

    if (!confirm('Delete ALL transactions?')) return;

    try {

        const snapshot = await db.collection('transactions').get();

        const batch = db.batch();

        snapshot.forEach(doc => {
            batch.delete(doc.ref);
        });

        await batch.commit();

        updateSyncStatus('✅ Cleared', 'synced');

    } catch (err) {

        console.error(err);

        updateSyncStatus('❌ Clear Failed', 'error');
    }
}

// DATE FORMAT
function formatDate(dateStr) {

    return new Date(dateStr).toLocaleDateString(
        'en-IN',
        {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        }
    );
}

// CATEGORY EMOJI
function getCategoryEmoji(cat) {

    const emojis = {

        food: '🍔',
        grocery: '🛒',
        vegetables: '🥦',
        beauty: '💄',

        transport: '🚗',
        shopping: '🛍️',
        bills: '📄',
        entertainment: '🎬',
        health: '🏥',
        salary: '💼',
        investment: '📈',
        other: '📦'
    };

    return emojis[cat] || '📦';
}

// MODAL
function openModal(id) {
    document.getElementById(id).classList.remove('hidden');
}

function closeModal(id) {
    document.getElementById(id).classList.add('hidden');
}

// STATUS
function updateSyncStatus(msg, status) {

    const el = document.getElementById('syncStatus');

    if (!el) return;

    document.getElementById('syncText').textContent = msg;

    el.className = 'sync-status ' + status;
}
```
