let transactions = [];
let userId = null;

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    generateUserId();
    loadTransactions();
    setupEventListeners();
    setDefaultDate();
});

// Generate fixed userId for cross-device sync
function generateUserId() {
    let storedId = localStorage.getItem('expenseTrackerUserId');
    if (!storedId) {
        storedId = 'user_shared_expenses';
        localStorage.setItem('expenseTrackerUserId', storedId);
    }
    userId = storedId;
    console.log('✅ User ID:', userId);
}

// Set default date to today
function setDefaultDate() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('date').value = today;
}

// Setup all event listeners
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

// Add new transaction to Firebase
async function addTransaction(e) {
    e.preventDefault();
    
    const transaction = {
        id: Date.now().toString(),
        userId: userId,
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
        console.error('Error adding transaction:', err);
        updateSyncStatus('❌ Error saving', 'error');
    }
}

// Load transactions from Firebase
async function loadTransactions() {
    updateSyncStatus('🔄 Loading...', '');
    try {
        const snapshot = await db.collection('transactions')
            .where('userId', '==', userId)
            .orderBy('date', 'desc')
            .get();
        
        transactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderTransactions(transactions);
        updateSummary();
        updateSyncStatus('✅ Synced with cloud', 'synced');
    } catch (err) {
        console.error('Error loading transactions:', err);
        updateSyncStatus('❌ Sync error', 'error');
    }
}

// Real-time sync listener
function syncTransactions() {
    db.collection('transactions')
        .where('userId', '==', userId)
        .onSnapshot(snapshot => {
            transactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
            renderTransactions(transactions);
            updateSummary();
            updateSyncStatus('✅ Live synced', 'synced');
        }, error => {
            console.error('Sync error:', error);
            updateSyncStatus('❌ Sync failed', 'error');
        });
}

// Render transactions in separate columns
function renderTransactions(data) {
    const incomeList = document.getElementById('incomeList');
    const expenseList = document.getElementById('expenseList');
    const incomeTotalEl = document.getElementById('incomeTotal');
    const expenseTotalEl = document.getElementById('expenseTotal');

    const incomes = data.filter(t => t.type === 'income');
    const expenses = data.filter(t => t.type === 'expense');

    incomeList.innerHTML = incomes.length 
        ? incomes.map(t => createTransactionHTML(t, 'income')).join('') 
        : '<p class="empty-msg">No income yet</p>';
    
    expenseList.innerHTML = expenses.length 
        ? expenses.map(t => createTransactionHTML(t, 'expense')).join('') 
        : '<p class="empty-msg">No expenses yet</p>';

    const incomeTotal = incomes.reduce((sum, t) => sum + t.amount, 0);
    const expenseTotal = expenses.reduce((sum, t) => sum + t.amount, 0);
    
    incomeTotalEl.textContent = `₹${incomeTotal.toFixed(2)}`;
    expenseTotalEl.textContent = `₹${expenseTotal.toFixed(2)}`;
}

// Create HTML for a single transaction item
function createTransactionHTML(t, type) {
    return `
        <div class="transaction-item ${type}">
            <div class="transaction-info">
                <h4>${t.description}</h4>
                <p>📅 ${formatDate(t.date)} • ${getCategoryEmoji(t.category)} ${t.category}</p>
            </div>
            <div class="transaction-amount">
                ${type === 'income' ? '+' : '-'}₹${t.amount.toFixed(2)}
            </div>
            <button class="btn-delete" onclick="deleteTransaction('${t.id}')">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `;
}

// Filter and render transactions
function filterAndRender() {
    const search = document.getElementById('searchInput').value.toLowerCase();
    const monthFilter = document.getElementById('filterMonth').value;
    
    let filtered = transactions.filter(t => {
        const matchSearch = t.description.toLowerCase().includes(search) || 
                           t.category.toLowerCase().includes(search);
        
        let matchMonth = true;
        if (monthFilter === 'current') {
            const now = new Date();
            const tDate = new Date(t.date);
            matchMonth = tDate.getMonth() === now.getMonth() && 
                        tDate.getFullYear() === now.getFullYear();
        } else if (monthFilter === 'last') {
            const now = new Date();
            const tDate = new Date(t.date);
            const lastMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
            const lastYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
            matchMonth = tDate.getMonth() === lastMonth && tDate.getFullYear() === lastYear;
        }
        
        return matchSearch && matchMonth;
    });
    
    renderTransactions(filtered);
}

// Update summary cards
function updateSummary() {
    const inc = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const exp = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const balance = inc - exp;
    
    document.getElementById('totalIncome').textContent = `₹${inc.toFixed(2)}`;
    document.getElementById('totalExpense').textContent = `₹${exp.toFixed(2)}`;
    document.getElementById('balance').textContent = `₹${balance.toFixed(2)}`;
}

// Delete a transaction
async function deleteTransaction(id) {
    if (!confirm('Delete this transaction?')) return;
    try {
        await db.collection('transactions').doc(id).delete();
        updateSyncStatus('✅ Deleted', 'synced');
    } catch (err) {
        console.error('Error deleting:', err);
        updateSyncStatus('❌ Delete failed', 'error');
    }
}

// ✅ FINAL: Export to CSV with perfect alignment
function exportToCSV() {
    const incomes = transactions.filter(t => t.type === 'income');
    const expenses = transactions.filter(t => t.type === 'expense');
    const incomeTotal = incomes.reduce((sum, t) => sum + t.amount, 0);
    const expenseTotal = expenses.reduce((sum, t) => sum + t.amount, 0);
    const balance = incomeTotal - expenseTotal;

    let csv = [];
    
    // INCOME SECTION
    csv.push('INCOME TRANSACTIONS');
    csv.push('Date,Description,Category,Amount');
    incomes.forEach(t => {
        const desc = t.description.replace(/"/g, '""').replace(/\n/g, ' ');
        csv.push(`${t.date},"${desc}",${t.category},${t.amount.toFixed(2)}`);
    });
    csv.push('');
    csv.push(`TOTAL INCOME,,,₹${incomeTotal.toFixed(2)}`);
    csv.push('');
    csv.push('');
    
    // EXPENSE SECTION
    csv.push('EXPENSE TRANSACTIONS');
    csv.push('Date,Description,Category,Amount');
    expenses.forEach(t => {
        const desc = t.description.replace(/"/g, '""').replace(/\n/g, ' ');
        csv.push(`${t.date},"${desc}",${t.category},${t.amount.toFixed(2)}`);
    });
    csv.push('');
    csv.push(`TOTAL EXPENSES,,,₹${expenseTotal.toFixed(2)}`);
    csv.push('');
    csv.push('');
    
    // SUMMARY SECTION
    csv.push('SUMMARY');
    csv.push(`Total Income,₹${incomeTotal.toFixed(2)}`);
    csv.push(`Total Expenses,₹${expenseTotal.toFixed(2)}`);
    csv.push(`Balance,₹${balance.toFixed(2)}`);
    csv.push(`Total Transactions,${transactions.length}`);

    const csvContent = csv.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expenses_report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

// ✅ FINAL: Export to PDF with perfect alignment - numbers stay inside borders
function exportToPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    const incomes = transactions.filter(t => t.type === 'income');
    const expenses = transactions.filter(t => t.type === 'expense');
    const incomeTotal = incomes.reduce((sum, t) => sum + t.amount, 0);
    const expenseTotal = expenses.reduce((sum, t) => sum + t.amount, 0);
    const balance = incomeTotal - expenseTotal;

    // Title
    doc.setFontSize(22);
    doc.setTextColor(102, 126, 234);
    doc.text('Expense Tracker Report', 105, 15, { align: 'center' });
    
    doc.setFontSize(11);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, 105, 22, { align: 'center' });

    let currentY = 35;

    // INCOME SECTION
    doc.setFontSize(14);
    doc.setTextColor(67, 233, 123);
    doc.text('INCOME TRANSACTIONS', 14, currentY);
    currentY += 8;
    
    const tableColumn = ["Date", "Description", "Category", "Amount"];
    const incomeTableRows = incomes.map(t => [
        t.date,
        t.description.length > 35 ? t.description.substring(0, 32) + '...' : t.description,
        t.category,
        `₹${t.amount.toFixed(2)}`
    ]);

    doc.autoTable({
        head: [tableColumn],
        body: incomeTableRows,
        startY: currentY,
        theme: 'striped',
        headStyles: { 
            fillColor: [67, 233, 123], 
            textColor: 255,
            fontStyle: 'bold',
            halign: 'center'
        },
        styles: { 
            fontSize: 9, 
            cellPadding: 3, 
            overflow: 'linebreak',
            lineWidth: 0.1
        },
        columnStyles: {
            0: { cellWidth: 28, halign: 'center' },
            1: { cellWidth: 75 },
            2: { cellWidth: 35, halign: 'center' },
            3: { halign: 'right', fontStyle: 'bold', cellWidth: 38 }
        },
        margin: { left: 14, right: 14 }
    });

    currentY = doc.lastAutoTable.finalY + 6;
    doc.setFontSize(11);
    doc.setTextColor(67, 233, 123);
    doc.text(`Total Income: ₹${incomeTotal.toFixed(2)}`, 14, currentY);
    currentY += 15;

    // EXPENSE SECTION
    doc.setFontSize(14);
    doc.setTextColor(250, 112, 154);
    doc.text('EXPENSE TRANSACTIONS', 14, currentY);
    currentY += 8;
    
    const expenseTableRows = expenses.map(t => [
        t.date,
        t.description.length > 35 ? t.description.substring(0, 32) + '...' : t.description,
        t.category,
        `₹${t.amount.toFixed(2)}`
    ]);

    doc.autoTable({
        head: [tableColumn],
        body: expenseTableRows,
        startY: currentY,
        theme: 'striped',
        headStyles: { 
            fillColor: [250, 112, 154], 
            textColor: 255,
            fontStyle: 'bold',
            halign: 'center'
        },
        styles: { 
            fontSize: 9, 
            cellPadding: 3, 
            overflow: 'linebreak',
            lineWidth: 0.1
        },
        columnStyles: {
            0: { cellWidth: 28, halign: 'center' },
            1: { cellWidth: 75 },
            2: { cellWidth: 35, halign: 'center' },
            3: { halign: 'right', fontStyle: 'bold', cellWidth: 38 }
        },
        margin: { left: 14, right: 14 }
    });

    currentY = doc.lastAutoTable.finalY + 6;
    doc.setFontSize(11);
    doc.setTextColor(250, 112, 154);
    doc.text(`Total Expenses: ₹${expenseTotal.toFixed(2)}`, 14, currentY);
    currentY += 15;

    // SUMMARY SECTION - FIXED: Numbers stay inside borders
    doc.setFontSize(14);
    doc.setTextColor(102, 126, 234);
    doc.text('SUMMARY', 14, currentY);
    currentY += 8;
    
    const summaryData = [
        ['Total Income', `₹${incomeTotal.toFixed(2)}`],
        ['Total Expenses', `₹${expenseTotal.toFixed(2)}`],
        ['Balance', `₹${balance.toFixed(2)}`],
        ['Total Transactions', `${transactions.length}`]
    ];

    doc.autoTable({
        body: summaryData,
        startY: currentY,
        theme: 'grid',
        styles: { 
            fontSize: 10, 
            cellPadding: 6,
            halign: 'left',
            lineWidth: 0.2,
            fillColor: [255, 255, 255]
        },
        columnStyles: {
            0: { 
                fontStyle: 'bold', 
                cellWidth: 100,
                fillColor: [245, 248, 255],
                halign: 'left',
                textColor: [50, 50, 50]
            },
            1: { 
                fontStyle: 'bold', 
                halign: 'right', 
                cellWidth: 70,
                fillColor: [245, 248, 255],
                textColor: [50, 50, 50]
            }
        },
        margin: { left: 14, right: 14 },
        tableWidth: 'auto'
    });

    // Footer with Powered by @IAC
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(9);
        doc.setTextColor(150, 150, 150);
        doc.text(`Powered by @IAC - Page ${i} of ${pageCount}`, 105, 290, { align: 'center' });
    }

    doc.save('expense_report.pdf');
}

// Modal functions
function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

// Generate date range preview
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

// Clear all data
async function clearAllData() {
    if (!confirm('⚠️ Delete ALL transactions?')) return;
    try {
        const snapshot = await db.collection('transactions').where('userId', '==', userId).get();
        const batch = db.batch();
        snapshot.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        updateSyncStatus('✅ All data cleared', 'synced');
    } catch (err) {
        console.error('Error clearing:', err);
        updateSyncStatus('❌ Clear failed', 'error');
    }
}

// Format date
function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Get category emoji
function getCategoryEmoji(cat) {
    const emojis = {
        food: '🍔', transport: '🚗', shopping: '🛍️', bills: '📄',
        entertainment: '🎬', health: '🏥', salary: '💼', investment: '📈', other: '📦'
    };
    return emojis[cat] || '📦';
}

// Update sync status
function updateSyncStatus(msg, status) {
    const el = document.getElementById('syncStatus');
    document.getElementById('syncText').textContent = msg;
    el.className = 'sync-status ' + status;
}
