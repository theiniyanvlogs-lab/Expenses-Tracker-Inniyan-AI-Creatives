let transactions = [];
let userId = null;

document.addEventListener('DOMContentLoaded', () => {
    generateUserId();
    loadTransactions();
    setupEventListeners();
    setDefaultDate();
});

function generateUserId() {
    let storedId = localStorage.getItem('expenseTrackerUserId');
    if (!storedId) {
        storedId = 'user_shared_expenses'; // Fixed ID for cross-device sync
        localStorage.setItem('expenseTrackerUserId', storedId);
    }
    userId = storedId;
}

function setDefaultDate() {
    document.getElementById('date').value = new Date().toISOString().split('T')[0];
}

function setupEventListeners() {
    document.getElementById('transactionForm').addEventListener('submit', addTransaction);
    document.getElementById('searchInput').addEventListener('input', filterAndRender);
    document.getElementById('filterMonth').addEventListener('change', filterAndRender);
    document.getElementById('exportCsvBtn').addEventListener('click', exportToCSV);
    document.getElementById('exportPdfBtn').addEventListener('click', exportToPDF);
    document.getElementById('clearBtn').addEventListener('click', clearAllData);
    
    document.getElementById('previewBtn').addEventListener('click', () => openModal('dateRangeModal'));
    document.querySelector('.close-modal').addEventListener('click', () => closeModal('dateRangeModal'));
    document.getElementById('generatePreviewBtn').addEventListener('click', generateDatePreview);
    
    syncTransactions();
}

async function addTransaction(e) {
    e.preventDefault();
    const transaction = {
        id: Date.now().toString(),
        userId,
        description: document.getElementById('description').value,
        amount: parseFloat(document.getElementById('amount').value),
        type: document.getElementById('type').value,
        category: document.getElementById('category').value,
        date: document.getElementById('date').value,
        createdAt: new Date().toISOString()
    };
    try {
        await db.collection('transactions').add(transaction);
        document.getElementById('transactionForm').reset();
        setDefaultDate();
        updateSyncStatus('✅ Transaction added!', 'synced');
    } catch (err) {
        updateSyncStatus('❌ Error saving', 'error');
    }
}

async function loadTransactions() {
    updateSyncStatus('🔄 Loading...', '');
    try {
        const snapshot = await db.collection('transactions').where('userId', '==', userId).orderBy('date', 'desc').get();
        transactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderTransactions(transactions);
        updateSummary();
        updateSyncStatus('✅ Synced with cloud', 'synced');
    } catch (err) {
        updateSyncStatus('❌ Sync error', 'error');
    }
}

function syncTransactions() {
    db.collection('transactions').where('userId', '==', userId)
        .onSnapshot(snapshot => {
            transactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
            renderTransactions(transactions);
            updateSummary();
            updateSyncStatus('✅ Live synced', 'synced');
        }, () => updateSyncStatus('❌ Sync failed', 'error'));
}

function renderTransactions(data) {
    const incomeList = document.getElementById('incomeList');
    const expenseList = document.getElementById('expenseList');
    const incomeTotalEl = document.getElementById('incomeTotal');
    const expenseTotalEl = document.getElementById('expenseTotal');

    const incomes = data.filter(t => t.type === 'income');
    const expenses = data.filter(t => t.type === 'expense');

    incomeList.innerHTML = incomes.length ? incomes.map(t => createTransactionHTML(t, 'income')).join('') : '<p class="empty-msg">No income yet</p>';
    expenseList.innerHTML = expenses.length ? expenses.map(t => createTransactionHTML(t, 'expense')).join('') : '<p class="empty-msg">No expenses yet</p>';

    incomeTotalEl.textContent = `₹${incomes.reduce((s, t) => s + t.amount, 0).toFixed(2)}`;
    expenseTotalEl.textContent = `₹${expenses.reduce((s, t) => s + t.amount, 0).toFixed(2)}`;
}

function createTransactionHTML(t, type) {
    return `
        <div class="transaction-item ${type}">
            <div class="transaction-info">
                <h4>${t.description}</h4>
                <p>📅 ${formatDate(t.date)} • ${getCategoryEmoji(t.category)} ${t.category}</p>
            </div>
            <div class="transaction-amount">${type === 'income' ? '+' : '-'}₹${t.amount.toFixed(2)}</div>
            <button class="btn-delete" onclick="deleteTransaction('${t.id}')"><i class="fas fa-trash"></i></button>
        </div>
    `;
}

function filterAndRender() {
    const search = document.getElementById('searchInput').value.toLowerCase();
    const monthFilter = document.getElementById('filterMonth').value;
    let filtered = transactions.filter(t => {
        const matchSearch = t.description.toLowerCase().includes(search) || t.category.toLowerCase().includes(search);
        let matchMonth = true;
        if (monthFilter === 'current') {
            const now = new Date(); const d = new Date(t.date);
            matchMonth = d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        } else if (monthFilter === 'last') {
            const now = new Date(); const d = new Date(t.date);
            const lastMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
            const lastYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
            matchMonth = d.getMonth() === lastMonth && d.getFullYear() === lastYear;
        }
        return matchSearch && matchMonth;
    });
    renderTransactions(filtered);
}

function updateSummary() {
    const inc = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const exp = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    document.getElementById('totalIncome').textContent = `₹${inc.toFixed(2)}`;
    document.getElementById('totalExpense').textContent = `₹${exp.toFixed(2)}`;
    document.getElementById('balance').textContent = `₹${(inc - exp).toFixed(2)}`;
}

async function deleteTransaction(id) {
    if (!confirm('Delete this transaction?')) return;
    try {
        await db.collection('transactions').doc(id).delete();
        updateSyncStatus('✅ Deleted', 'synced');
    } catch (err) { updateSyncStatus('❌ Delete failed', 'error'); }
}

function exportToCSV() {
    const headers = ['Date', 'Description', 'Category', 'Type', 'Amount'];
    const rows = transactions.map(t => [t.date, t.description, t.category, t.type, t.amount]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `expenses_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
}

function exportToPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(18); doc.text('Expense Tracker Report', 14, 20);
    doc.setFontSize(12); doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 30);
    
    const tableColumn = ["Date", "Description", "Category", "Type", "Amount"];
    const tableRows = transactions.map(t => [
        t.date, t.description, t.category, t.type === 'income' ? 'Income' : 'Expense', `₹${t.amount.toFixed(2)}`
    ]);

    doc.autoTable({
        head: [tableColumn], body: tableRows, startY: 40, theme: 'grid',
        headStyles: { fillColor: [102, 126, 234] }
    });
    doc.save('expenses_report.pdf');
}

function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

function generateDatePreview() {
    const from = document.getElementById('fromDate').value;
    const to = document.getElementById('toDate').value;
    if (!from || !to) { alert('Please select both dates'); return; }

    const filtered = transactions.filter(t => t.date >= from && t.date <= to);
    const resultDiv = document.getElementById('previewResult');
    resultDiv.classList.remove('hidden');
    resultDiv.innerHTML = `<h3 style="text-align:center;margin-bottom:20px;color:#667eea;">📅 Preview: ${formatDate(from)} to ${formatDate(to)}</h3>`;
    
    const tempDiv = document.createElement('div');
    tempDiv.className = 'columns-wrapper preview-columns';
    tempDiv.innerHTML = `
        <div class="column income-column"><h3><i class="fas fa-arrow-down"></i> Income</h3><div id="previewIncome"></div><div class="column-total">Total: <span id="previewIncomeTotal"></span></div></div>
        <div class="column expense-column"><h3><i class="fas fa-arrow-up"></i> Expenses</h3><div id="previewExpense"></div><div class="column-total">Total: <span id="previewExpenseTotal"></span></div></div>
    `;
    resultDiv.appendChild(tempDiv);

    const incomes = filtered.filter(t => t.type === 'income');
    const expenses = filtered.filter(t => t.type === 'expense');

    document.getElementById('previewIncome').innerHTML = incomes.map(t => createTransactionHTML(t, 'income')).join('') || '<p class="empty-msg">No income</p>';
    document.getElementById('previewExpense').innerHTML = expenses.map(t => createTransactionHTML(t, 'expense')).join('') || '<p class="empty-msg">No expenses</p>';
    document.getElementById('previewIncomeTotal').textContent = `₹${incomes.reduce((s,t)=>s+t.amount,0).toFixed(2)}`;
    document.getElementById('previewExpenseTotal').textContent = `₹${expenses.reduce((s,t)=>s+t.amount,0).toFixed(2)}`;
    
    closeModal('dateRangeModal');
}

async function clearAllData() {
    if (!confirm('⚠️ Delete ALL transactions?')) return;
    try {
        const snapshot = await db.collection('transactions').where('userId', '==', userId).get();
        const batch = db.batch();
        snapshot.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        updateSyncStatus('✅ All data cleared', 'synced');
    } catch (err) { updateSyncStatus('❌ Clear failed', 'error'); }
}

function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getCategoryEmoji(cat) {
    return {food:'🍔',transport:'🚗',shopping:'🛍️',bills:'📄',entertainment:'🎬',health:'🏥',salary:'💼',investment:'📈',other:'📦'}[cat] || '📦';
}

function updateSyncStatus(msg, status) {
    const el = document.getElementById('syncStatus');
    document.getElementById('syncText').textContent = msg;
    el.className = 'sync-status ' + status;
}
