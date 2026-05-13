let transactions = [];

document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    setDefaultDate();
    loadTransactions();
    syncTransactions();
});

function setDefaultDate() {

    const today = new Date().toISOString().split('T')[0];

    const dateInput = document.getElementById('date');

    if (dateInput) {
        dateInput.value = today;
    }
}

function setupEventListeners() {

    const form = document.getElementById('transactionForm');

    if (form) {
        form.addEventListener('submit', addTransaction);
    }

    const searchInput = document.getElementById('searchInput');

    if (searchInput) {
        searchInput.addEventListener('input', filterAndRender);
    }

    const filterMonth = document.getElementById('filterMonth');

    if (filterMonth) {
        filterMonth.addEventListener('change', filterAndRender);
    }

    const saveEditBtn = document.getElementById('saveEditBtn');

    if (saveEditBtn) {
        saveEditBtn.addEventListener('click', saveEditedTransaction);
    }

    const clearBtn = document.getElementById('clearBtn');

    if (clearBtn) {
        clearBtn.addEventListener('click', clearAllData);
    }

    const exportCsvBtn = document.getElementById('exportCsvBtn');

    if (exportCsvBtn) {
        exportCsvBtn.addEventListener('click', exportToCSV);
    }

    const exportPdfBtn = document.getElementById('exportPdfBtn');

    if (exportPdfBtn) {
        exportPdfBtn.addEventListener('click', exportToPDF);
    }

    const saveBackupBtn = document.getElementById('saveBackupBtn');

    if (saveBackupBtn) {
        saveBackupBtn.addEventListener('click', saveBackup);
    }

    const loadBackupBtn = document.getElementById('loadBackupBtn');

    if (loadBackupBtn) {
        loadBackupBtn.addEventListener('click', loadBackup);
    }
}

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

        const docRef =
            await db.collection('transactions')
            .add(transaction);

        await db.collection('transactions')
            .doc(docRef.id)
            .update({
                id: docRef.id
            });

        document.getElementById('transactionForm').reset();

        setDefaultDate();

        updateSyncStatus('Transaction Added', 'synced');

    } catch (err) {

        console.error(err);

        updateSyncStatus('Add Failed', 'error');
    }
}

async function loadTransactions() {

    updateSyncStatus('Loading...', '');

    try {

        const snapshot =
            await db.collection('transactions')
            .orderBy('date', 'desc')
            .get();

        transactions = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        renderTransactions(transactions);

        updateSummary();

        updateSyncStatus('Synced', 'synced');

    } catch (err) {

        console.error(err);

        updateSyncStatus('Load Failed', 'error');
    }
}

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
        });
}

function renderTransactions(data) {

    const incomeList =
        document.getElementById('incomeList');

    const expenseList =
        document.getElementById('expenseList');

    const incomeTotalEl =
        document.getElementById('incomeTotal');

    const expenseTotalEl =
        document.getElementById('expenseTotal');

    const incomes =
        data.filter(t => t.type === 'income');

    const expenses =
        data.filter(t => t.type === 'expense');

    incomeList.innerHTML =
        incomes.length
        ? incomes.map(t =>
            createTransactionHTML(t, 'income')
          ).join('')
        : '<p>No income</p>';

    expenseList.innerHTML =
        expenses.length
        ? expenses.map(t =>
            createTransactionHTML(t, 'expense')
          ).join('')
        : '<p>No expenses</p>';

    const incomeTotal =
        incomes.reduce((s, t) =>
            s + t.amount, 0);

    const expenseTotal =
        expenses.reduce((s, t) =>
            s + t.amount, 0);

    incomeTotalEl.textContent =
        'Rs.' + incomeTotal.toFixed(2);

    expenseTotalEl.textContent =
        'Rs.' + expenseTotal.toFixed(2);
}

function createTransactionHTML(t, type) {

    let sign = '-';

    if (type === 'income') {
        sign = '+';
    }

    return `
        <div class="transaction-item ${type}">

            <div class="transaction-info">

                <h4>${t.description}</h4>

                <p>
                    DATE:
                    ${formatDate(t.date)}
                    -
                    ${t.category}
                </p>

            </div>

            <div class="transaction-amount">
                ${sign} Rs.${t.amount.toFixed(2)}
            </div>

            <div class="transaction-actions">

                <button onclick="openEditModal('${t.id}')">
                    Edit
                </button>

                <button onclick="deleteTransaction('${t.id}')">
                    Delete
                </button>

            </div>

        </div>
    `;
}

async function deleteTransaction(id) {

    if (!confirm('Delete Transaction?')) return;

    try {

        await db.collection('transactions')
            .doc(id)
            .delete();

        transactions =
            transactions.filter(t =>
                t.id !== id
            );

        renderTransactions(transactions);

        updateSummary();

        updateSyncStatus('Deleted', 'synced');

    } catch (err) {

        console.error(err);

        updateSyncStatus('Delete Failed', 'error');
    }
}

function openEditModal(id) {

    const transaction =
        transactions.find(t => t.id === id);

    if (!transaction) return;

    document.getElementById('editId').value =
        transaction.id;

    document.getElementById('editDescription').value =
        transaction.description;

    document.getElementById('editAmount').value =
        transaction.amount;

    document.getElementById('editType').value =
        transaction.type;

    document.getElementById('editCategory').value =
        transaction.category;

    document.getElementById('editDate').value =
        transaction.date;

    openModal('editModal');
}

async function saveEditedTransaction() {

    const id =
        document.getElementById('editId').value;

    const updatedData = {

        description:
            document.getElementById('editDescription')
            .value.trim(),

        amount:
            parseFloat(
                document.getElementById('editAmount').value
            ),

        type:
            document.getElementById('editType').value,

        category:
            document.getElementById('editCategory').value,

        date:
            document.getElementById('editDate').value,

        updatedAt:
            new Date().toISOString()
    };

    try {

        await db.collection('transactions')
            .doc(id)
            .update(updatedData);

        transactions =
            transactions.map(t => {

                if (t.id === id) {
                    return {
                        ...t,
                        ...updatedData
                    };
                }

                return t;
            });

        renderTransactions(transactions);

        updateSummary();

        closeModal('editModal');

        updateSyncStatus('Updated', 'synced');

    } catch (err) {

        console.error(err);

        alert('Update Failed');

        updateSyncStatus('Update Failed', 'error');
    }
}

function filterAndRender() {

    const search =
        document.getElementById('searchInput')
        .value.toLowerCase();

    const filtered =
        transactions.filter(t =>

            t.description.toLowerCase().includes(search)

            ||

            t.category.toLowerCase().includes(search)
        );

    renderTransactions(filtered);
}

function updateSummary() {

    const income =
        transactions
        .filter(t => t.type === 'income')
        .reduce((s, t) => s + t.amount, 0);

    const expense =
        transactions
        .filter(t => t.type === 'expense')
        .reduce((s, t) => s + t.amount, 0);

    const balance = income - expense;

    document.getElementById('totalIncome')
        .textContent = 'Rs.' + income.toFixed(2);

    document.getElementById('totalExpense')
        .textContent = 'Rs.' + expense.toFixed(2);

    document.getElementById('balance')
        .textContent = 'Rs.' + balance.toFixed(2);
}

function exportToCSV() {

    let csv =
        'Description,Amount,Type,Category,Date\n';

    transactions.forEach(t => {

        csv +=
            `${t.description},${t.amount},${t.type},${t.category},${t.date}\n`;
    });

    const blob =
        new Blob([csv], {
            type: 'text/csv'
        });

    const url =
        URL.createObjectURL(blob);

    const a =
        document.createElement('a');

    a.href = url;

    a.download = 'transactions.csv';

    a.click();
}

function exportToPDF() {

    const jsPDFClass =
        window.jspdf.jsPDF;

    const doc =
        new jsPDFClass();

    doc.setFontSize(18);

    doc.text('Expense Report', 20, 20);

    let y = 40;

    transactions.forEach(t => {

        doc.text(
            `${t.date} | ${t.description} | Rs.${t.amount}`,
            20,
            y
        );

        y += 10;
    });

    doc.save('expense-report.pdf');
}

function saveBackup() {

    const backupData = {
        exportDate: new Date().toISOString(),
        totalTransactions: transactions.length,
        transactions: transactions
    };

    const blob =
        new Blob(
            [JSON.stringify(backupData, null, 2)],
            {
                type: 'application/json'
            }
        );

    const url =
        URL.createObjectURL(blob);

    const a =
        document.createElement('a');

    a.href = url;

    a.download = 'expense_backup.json';

    a.click();
}

function loadBackup() {

    const input =
        document.createElement('input');

    input.type = 'file';

    input.accept = '.json';

    input.onchange = async (e) => {

        const file = e.target.files[0];

        if (!file) return;

        const reader =
            new FileReader();

        reader.onload = async (event) => {

            try {

                const backup =
                    JSON.parse(event.target.result);

                const transactionsData =
                    backup.transactions || backup;

                if (!Array.isArray(transactionsData)) {

                    alert('Invalid backup file');

                    return;
                }

                for (const t of transactionsData) {

                    const transaction = {

                        description:
                            t.description || '',

                        amount:
                            Number(t.amount) || 0,

                        type:
                            t.type || 'expense',

                        category:
                            t.category || 'other',

                        date:
                            t.date || '',

                        createdAt:
                            t.createdAt ||
                            new Date().toISOString()
                    };

                    await db.collection('transactions')
                        .add(transaction);
                }

                alert('Backup Loaded Successfully');

            } catch (err) {

                console.error(err);

                alert('Invalid Backup File');
            }
        };

        reader.readAsText(file);
    };

    input.click();
}

async function clearAllData() {

    if (!confirm('Delete ALL?'))
        return;

    try {

        const snapshot =
            await db.collection('transactions')
            .get();

        const batch =
            db.batch();

        snapshot.forEach(doc => {

            batch.delete(doc.ref);
        });

        await batch.commit();

        updateSyncStatus('Cleared', 'synced');

    } catch (err) {

        console.error(err);

        updateSyncStatus('Clear Failed', 'error');
    }
}

function formatDate(dateStr) {

    return new Date(dateStr)
        .toLocaleDateString(
            'en-IN',
            {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
            }
        );
}

function openModal(id) {

    document.getElementById(id)
        .classList.remove('hidden');
}

function closeModal(id) {

    document.getElementById(id)
        .classList.add('hidden');
}

function updateSyncStatus(msg, status) {

    const el =
        document.getElementById('syncStatus');

    if (!el) return;

    const text =
        document.getElementById('syncText');

    if (text) {
        text.textContent = msg;
    }

    el.className =
        'sync-status ' + status;
}
