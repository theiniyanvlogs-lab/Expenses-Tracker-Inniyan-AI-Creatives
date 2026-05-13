```javascript
let transactions = [];

// START APP
document.addEventListener('DOMContentLoaded', () => {

    setupEventListeners();

    setDefaultDate();

    loadTransactions();

    syncTransactions();
});

// DEFAULT DATE
function setDefaultDate() {

    const today =
        new Date().toISOString().split('T')[0];

    document.getElementById('date').value = today;
}

// EVENT LISTENERS
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

    document.getElementById('exportCsvBtn')
        .addEventListener('click', exportToCSV);

    document.getElementById('exportPdfBtn')
        .addEventListener('click', exportToPDF);

    document.getElementById('saveBackupBtn')
        .addEventListener('click', saveBackup);

    document.getElementById('loadBackupBtn')
        .addEventListener('click', loadBackup);
}

// ADD TRANSACTION
async function addTransaction(e) {

    e.preventDefault();

    const transaction = {

        description:
            document.getElementById('description')
            .value.trim(),

        amount:
            parseFloat(
                document.getElementById('amount')
                .value
            ),

        type:
            document.getElementById('type')
            .value,

        category:
            document.getElementById('category')
            .value,

        date:
            document.getElementById('date')
            .value,

        createdAt:
            new Date().toISOString()
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

        document.getElementById('transactionForm')
            .reset();

        setDefaultDate();

        updateSyncStatus(
            '✅ Transaction Added',
            'synced'
        );

    } catch (err) {

        console.error(err);

        updateSyncStatus(
            '❌ Add Failed',
            'error'
        );
    }
}

// LOAD TRANSACTIONS
async function loadTransactions() {

    updateSyncStatus(
        '🔄 Loading...',
        ''
    );

    try {

        const snapshot =
            await db.collection('transactions')
            .orderBy('date', 'desc')
            .get();

        transactions =
            snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

        renderTransactions(transactions);

        updateSummary();

        updateSyncStatus(
            '✅ Synced',
            'synced'
        );

    } catch (err) {

        console.error(err);

        updateSyncStatus(
            '❌ Load Failed',
            'error'
        );
    }
}

// LIVE SYNC
function syncTransactions() {

    db.collection('transactions')
        .onSnapshot(snapshot => {

            transactions =
                snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

            transactions.sort((a, b) =>
                new Date(b.date) -
                new Date(a.date)
            );

            renderTransactions(transactions);

            updateSummary();

        });
}

// RENDER
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
        : '<p class="empty-msg">No income</p>';

    expenseList.innerHTML =
        expenses.length
        ? expenses.map(t =>
            createTransactionHTML(t, 'expense')
          ).join('')
        : '<p class="empty-msg">No expenses</p>';

    const incomeTotal =
        incomes.reduce((s, t) =>
            s + t.amount, 0);

    const expenseTotal =
        expenses.reduce((s, t) =>
            s + t.amount, 0);

    incomeTotalEl.textContent =
        `₹${incomeTotal.toFixed(2)}`;

    expenseTotalEl.textContent =
        `₹${expenseTotal.toFixed(2)}`;
}

// CREATE HTML
function createTransactionHTML(t, type) {

    return `
        <div class="transaction-item ${type}">

            <div class="transaction-info">

                <h4>${t.description}</h4>

                <p>
                    📅 ${formatDate(t.date)}
                    •
                    ${getCategoryEmoji(t.category)}
                    ${t.category}
                </p>

            </div>

            <div class="transaction-amount">

                ${type === 'income'
                    ? '+'
                    : '-'
                }

                ₹${t.amount.toFixed(2)}

            </div>

            <div class="transaction-actions">

                <button
                    class="btn-edit"
                    onclick="openEditModal('${t.id}')"
                >
                    <i class="fas fa-edit"></i>
                </button>

                <button
                    class="btn-delete"
                    onclick="deleteTransaction('${t.id}')"
                >
                    <i class="fas fa-trash"></i>
                </button>

            </div>

        </div>
    `;
}

// DELETE
async function deleteTransaction(id) {

    if (!confirm('Delete Transaction?'))
        return;

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

        updateSyncStatus(
            '✅ Deleted',
            'synced'
        );

    } catch (err) {

        console.error(err);

        updateSyncStatus(
            '❌ Delete Failed',
            'error'
        );
    }
}

// OPEN EDIT
function openEditModal(id) {

    const transaction =
        transactions.find(t => t.id === id);

    if (!transaction) return;

    document.getElementById('editId')
        .value = transaction.id;

    document.getElementById('editDescription')
        .value = transaction.description;

    document.getElementById('editAmount')
        .value = transaction.amount;

    document.getElementById('editType')
        .value = transaction.type;

    document.getElementById('editCategory')
        .value = transaction.category;

    document.getElementById('editDate')
        .value = transaction.date;

    openModal('editModal');
}

// SAVE EDIT
async function saveEditedTransaction() {

    const id =
        document.getElementById('editId')
        .value;

    const updatedData = {

        description:
            document.getElementById('editDescription')
            .value.trim(),

        amount:
            parseFloat(
                document.getElementById('editAmount')
                .value
            ),

        type:
            document.getElementById('editType')
            .value,

        category:
            document.getElementById('editCategory')
            .value,

        date:
            document.getElementById('editDate')
            .value,

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

        updateSyncStatus(
            '✅ Updated',
            'synced'
        );

    } catch (err) {

        console.error(err);

        alert('Update Failed');

        updateSyncStatus(
            '❌ Update Failed',
            'error'
        );
    }
}

// FILTER
function filterAndRender() {

    const search =
        document.getElementById('searchInput')
        .value.toLowerCase();

    const filtered =
        transactions.filter(t =>

            t.description
            .toLowerCase()
            .includes(search)

            ||

            t.category
            .toLowerCase()
            .includes(search)
        );

    renderTransactions(filtered);
}

// SUMMARY
function updateSummary() {

    const income =
        transactions
        .filter(t => t.type === 'income')
        .reduce((s, t) =>
            s + t.amount, 0);

    const expense =
        transactions
        .filter(t => t.type === 'expense')
        .reduce((s, t) =>
            s + t.amount, 0);

    const balance =
        income - expense;

    document.getElementById('totalIncome')
        .textContent =
        `₹${income.toFixed(2)}`;

    document.getElementById('totalExpense')
        .textContent =
        `₹${expense.toFixed(2)}`;

    document.getElementById('balance')
        .textContent =
        `₹${balance.toFixed(2)}`;
}

// EXPORT CSV
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

// EXPORT PDF
function exportToPDF() {

    const { jsPDF } =
        window.jspdf;

    const doc =
        new jsPDF();

    doc.setFontSize(18);

    doc.text(
        'Expense Report',
        20,
        20
    );

    let y = 40;

    transactions.forEach(t => {

        doc.text(
            `${t.date} | ${t.description} | ₹${t.amount}`,
            20,
            y
        );

        y += 10;
    });

    doc.save('expense-report.pdf');
}

// SAVE BACKUP
function saveBackup() {

    const backup =
        JSON.stringify(
            transactions,
            null,
            2
        );

    const blob =
        new Blob([backup], {
            type: 'application/json'
        });

    const url =
        URL.createObjectURL(blob);

    const a =
        document.createElement('a');

    a.href = url;

    a.download =
        'expense-backup.json';

    a.click();
}

// LOAD BACKUP
function loadBackup() {

    const input =
        document.createElement('input');

    input.type = 'file';

    input.accept = '.json';

    input.onchange =
        async (e) => {

        const file =
            e.target.files[0];

        if (!file) return;

        const reader =
            new FileReader();

        reader.onload =
            async event => {

            try {

                const backupData =
                    JSON.parse(
                        event.target.result
                    );

                for (const t of backupData) {

                    await db.collection('transactions')
                        .add(t);
                }

                alert('Backup Loaded');

            } catch (err) {

                console.error(err);

                alert('Invalid Backup');
            }
        };

        reader.readAsText(file);
    };

    input.click();
}

// CLEAR ALL
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

        updateSyncStatus(
            '✅ Cleared',
            'synced'
        );

    } catch (err) {

        console.error(err);

        updateSyncStatus(
            '❌ Clear Failed',
            'error'
        );
    }
}

// DATE FORMAT
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

    document.getElementById(id)
        .classList.remove('hidden');
}

function closeModal(id) {

    document.getElementById(id)
        .classList.add('hidden');
}

// STATUS
function updateSyncStatus(msg, status) {

    const el =
        document.getElementById('syncStatus');

    if (!el) return;

    document.getElementById('syncText')
        .textContent = msg;

    el.className =
        'sync-status ' + status;
}
```
