// Global Variables
let transactions = [];
let userEmail = null;
// REMOVED: let db; (Because it is already defined in firebase-config.js)

// DOM Elements
const transactionForm = document.getElementById('transactionForm');
const searchInput = document.getElementById('searchInput');
const filterMonth = document.getElementById('filterMonth');
const incomeList = document.getElementById('incomeList');
const expenseList = document.getElementById('expenseList');
const totalIncomeEl = document.getElementById('totalIncome');
const totalExpenseEl = document.getElementById('totalExpense');
const balanceEl = document.getElementById('balance');
const syncStatusEl = document.getElementById('syncStatus');
const syncTextEl = document.getElementById('syncText');

// Edit Modal Elements
const editModal = document.getElementById('editModal');
const editForm = document.getElementById('editForm');
const closeEditModalBtn = document.querySelector('.close-edit-modal');

// Date Range Preview Elements
const previewBtn = document.getElementById('previewBtn');
const dateRangeModal = document.getElementById('dateRangeModal');
const closeModalBtn = document.querySelector('.close-modal');
const generatePreviewBtn = document.getElementById('generatePreviewBtn');
const previewResult = document.getElementById('previewResult');

// Action Buttons
const exportCsvBtn = document.getElementById('exportCsvBtn');
const exportPdfBtn = document.getElementById('exportPdfBtn');
const saveBackupBtn = document.getElementById('saveBackupBtn');
const loadBackupBtn = document.getElementById('loadBackupBtn');
const clearBtn = document.getElementById('clearBtn');
const loadBackupInput = document.createElement('input');
loadBackupInput.type = 'file';
loadBackupInput.accept = '.json';
loadBackupInput.style.display = 'none';
document.body.appendChild(loadBackupInput);

// ================= INITIALIZATION =================

// Initialize App
function initApp() {
    checkAuth();
    setupEventListeners();
}

// Check Authentication (Simple Prompt for Demo)
function checkAuth() {
    const storedEmail = localStorage.getItem('stitches_user_email');
    if (storedEmail) {
        userEmail = storedEmail;
        loadTransactions();
    } else {
        const email = prompt("Enter your email to access your ");
        if (email) {
            userEmail = email.trim();
            localStorage.setItem('stitches_user_email', userEmail);
            loadTransactions();
        } else {
            updateSyncStatus('Authentication required', 'error');
        }
    }
}

// Setup Event Listeners
function setupEventListeners() {
    // Form Submit
    transactionForm.addEventListener('submit', addTransaction);

    // Search & Filter
    searchInput.addEventListener('input', renderTransactions);
    filterMonth.addEventListener('change', renderTransactions);

    // Edit Modal
    closeEditModalBtn.addEventListener('click', () => editModal.classList.add('hidden'));
    editModal.addEventListener('click', (e) => {
        if (e.target === editModal) editModal.classList.add('hidden');
    });
    editForm.addEventListener('submit', updateTransaction);

    // Date Range Preview Modal
    previewBtn.addEventListener('click', () => dateRangeModal.classList.remove('hidden'));
    closeModalBtn.addEventListener('click', () => dateRangeModal.classList.add('hidden'));
    dateRangeModal.addEventListener('click', (e) => {
        if (e.target === dateRangeModal) dateRangeModal.classList.add('hidden');
    });
    generatePreviewBtn.addEventListener('click', generateDateRangePreview);

    // Action Buttons (These will work now!)
    exportCsvBtn.addEventListener('click', exportToCSV);
    exportPdfBtn.addEventListener('click', exportToPDF);
    saveBackupBtn.addEventListener('click', saveBackup);
    loadBackupBtn.addEventListener('click', () => loadBackupInput.click());
    loadBackupInput.addEventListener('change', loadBackup);
    clearBtn.addEventListener('click', clearAllData);
}

// ================= FIREBASE OPERATIONS =================

// Load Transactions
async function loadTransactions() {
    updateSyncStatus('Syncing...', '');
    try {
        // 'db' comes from firebase-config.js
        const snapshot = await db.collection('transactions')
            .orderBy('date', 'desc')
            .get();

        transactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        renderTransactions();
        updateSyncStatus('Synced', 'synced');
    } catch (error) {
        console.error("Error loading transactions:", error);
        updateSyncStatus('Error: ' + error.message, 'error');
    }
}

// Add Transaction
async function addTransaction(e) {
    e.preventDefault();
    updateSyncStatus('Saving...', '');

    const newTransaction = {
        description: document.getElementById('description').value,
        amount: parseFloat(document.getElementById('amount').value),
        type: document.getElementById('type').value,
        category: document.getElementById('category').value,
        date: document.getElementById('date').value,
        userEmail: userEmail,
        createdAt: new Date().toISOString()
    };

    try {
        await db.collection('transactions').add(newTransaction);
        transactionForm.reset();
        // Set default date back to today
        document.getElementById('date').valueAsDate = new Date();
        loadTransactions();
    } catch (error) {
        console.error("Error adding transaction:", error);
        updateSyncStatus('Save Failed', 'error');
    }
}

// Delete Transaction
async function deleteTransaction(id) {
    if (confirm('Are you sure you want to delete this transaction?')) {
        try {
            await db.collection('transactions').doc(id).delete();
            loadTransactions();
        } catch (error) {
            console.error("Error deleting:", error);
            updateSyncStatus('Delete Failed', 'error');
        }
    }
}

// Open Edit Modal
function openEditModal(id) {
    const transaction = transactions.find(t => t.id === id);
    if (!transaction) return;

    document.getElementById('editId').value = transaction.id;
    document.getElementById('editDescription').value = transaction.description;
    document.getElementById('editAmount').value = transaction.amount;
    document.getElementById('editType').value = transaction.type;
    document.getElementById('editCategory').value = transaction.category;
    document.getElementById('editDate').value = transaction.date;

    editModal.classList.remove('hidden');
}

// Update Transaction
async function updateTransaction(e) {
    e.preventDefault();
    const id = document.getElementById('editId').value;
    
    const updatedData = {
        description: document.getElementById('editDescription').value,
        amount: parseFloat(document.getElementById('editAmount').value),
        type: document.getElementById('editType').value,
        category: document.getElementById('editCategory').value,
        date: document.getElementById('editDate').value,
        updatedAt: new Date().toISOString()
    };

    try {
        await db.collection('transactions').doc(id).update(updatedData);
        editModal.classList.add('hidden');
        loadTransactions();
    } catch (error) {
        console.error("Error updating:", error);
        updateSyncStatus('Update Failed', 'error');
    }
}

// Clear All Data
async function clearAllData() {
    if (confirm('WARNING: This will delete ALL your transactions. This cannot be undone. Continue?')) {
        try {
            const batch = db.batch();
            transactions.forEach(t => {
                const docRef = db.collection('transactions').doc(t.id);
                batch.delete(docRef);
            });
            await batch.commit();
            transactions = [];
            renderTransactions();
            updateSyncStatus('All Data Cleared', 'synced');
        } catch (error) {
            console.error("Error clearing data:", error);
            updateSyncStatus('Clear Failed', 'error');
        }
    }
}

// ================= RENDERING & FILTERING =================

// Render Main Transactions
function renderTransactions() {
    const searchTerm = searchInput.value.toLowerCase();
    const monthFilter = filterMonth.value;

    // Filter Logic
    let filtered = transactions.filter(t => {
        // 1. Search Filter
        const matchesSearch = t.description.toLowerCase().includes(searchTerm) || 
                              t.category.toLowerCase().includes(searchTerm);
        
        // 2. Month Filter
        let matchesMonth = true;
        if (monthFilter === 'current') {
            const now = new Date();
            const tDate = new Date(t.date);
            matchesMonth = tDate.getMonth() === now.getMonth() && tDate.getFullYear() === now.getFullYear();
        } else if (monthFilter === 'last') {
            const now = new Date();
            const tDate = new Date(t.date);
            const lastMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
            const lastYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
            matchesMonth = tDate.getMonth() === lastMonth && tDate.getFullYear() === lastYear;
        }

        return matchesSearch && matchesMonth;
    });

    // Split Income and Expenses
    const incomeData = filtered.filter(t => t.type === 'income');
    const expenseData = filtered.filter(t => t.type === 'expense');

    // Render HTML
    incomeList.innerHTML = incomeData.length ? incomeData.map(createTransactionHTML).join('') : '<p class="empty-msg">No income found</p>';
    expenseList.innerHTML = expenseData.length ? expenseData.map(createTransactionHTML).join('') : '<p class="empty-msg">No expenses found</p>';

    // Update Totals
    const totalIncome = incomeData.reduce((sum, t) => sum + t.amount, 0);
    const totalExpense = expenseData.reduce((sum, t) => sum + t.amount, 0);
    
    totalIncomeEl.textContent = `₹${totalIncome.toFixed(2)}`;
    totalExpenseEl.textContent = `₹${totalExpense.toFixed(2)}`;
    balanceEl.textContent = `₹${(totalIncome - totalExpense).toFixed(2)}`;
}

// Create HTML for Transaction Item
function createTransactionHTML(t) {
    return `
        <div class="transaction-item ${t.type}">
            <div class="transaction-info">
                <h4>${t.description}</h4>
                <p>${formatDate(t.date)} • ${getCategoryEmoji(t.category)} ${t.category}</p>
            </div>
            <div class="transaction-amount">${t.type === 'income' ? '+' : '-'}₹${t.amount.toFixed(2)}</div>
            <div class="transaction-actions">
                <button class="btn-edit" onclick="openEditModal('${t.id}')"><i class="fas fa-edit"></i></button>
                <button class="btn-delete" onclick="deleteTransaction('${t.id}')"><i class="fas fa-trash"></i></button>
            </div>
        </div>
    `;
}

// Helper: Category Emojis
function getCategoryEmoji(cat) {
    const emojis = {
        food: '🍔', transport: '🚗', shopping: '🛍️', bills: '📄', 
        entertainment: '🎬', health: '🏥', salary: '💼', investment: '📈', 
        other: '📦', vegetables: '🥬', provision: '🛒', petrol: '⛽', hotel: '🏨', beauty: '💄'
    };
    return emojis[cat] || '📦';
}

// Helper: Format Date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ================= DATE RANGE PREVIEW =================

function generateDateRangePreview() {
    const fromDate = document.getElementById('fromDate').value;
    const toDate = document.getElementById('toDate').value;

    if (!fromDate || !toDate) {
        alert("Please select both From and To dates.");
        return;
    }

    const start = new Date(fromDate);
    const end = new Date(toDate);
    end.setHours(23, 59, 59, 999); // Include the whole end day

    const filtered = transactions.filter(t => {
        const tDate = new Date(t.date);
        return tDate >= start && tDate <= end;
    });

    // Render Preview Section
    previewResult.classList.remove('hidden');
    
    const incomeData = filtered.filter(t => t.type === 'income');
    const expenseData = filtered.filter(t => t.type === 'expense');

    const previewHTML = `
        <h3 style="text-align:center; color:#667eea; margin-bottom:20px;">
            Preview: ${formatDate(fromDate)} to ${formatDate(toDate)}
        </h3>
        <div class="preview-columns">
            <div class="column income-column">
                <h3><i class="fas fa-arrow-down"></i> Income</h3>
                ${incomeData.length ? incomeData.map(createTransactionHTML).join('') : '<p class="empty-msg">No income</p>'}
                <div class="column-total">Total: ₹${incomeData.reduce((s,t)=>s+t.amount,0).toFixed(2)}</div>
            </div>
            <div class="column expense-column">
                <h3><i class="fas fa-arrow-up"></i> Expenses</h3>
                ${expenseData.length ? expenseData.map(createTransactionHTML).join('') : '<p class="empty-msg">No expenses</p>'}
                <div class="column-total">Total: ₹${expenseData.reduce((s,t)=>s+t.amount,0).toFixed(2)}</div>
            </div>
        </div>
    `;

    // Insert into the preview container
    previewResult.innerHTML = previewHTML;
    
    // Close Modal
    dateRangeModal.classList.add('hidden');
}

// ================= EXPORT & BACKUP =================

// Export to PDF
function exportToPDF() {
    if (transactions.length === 0) {
        alert("No transactions to export!");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(20);
    doc.text("Expense Report", 14, 20);
    doc.setFontSize(12);
    doc.text(`User: ${userEmail}`, 14, 30);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, 36);

    const tableData = transactions.map(t => [
        formatDate(t.date),
        t.description,
        t.category,
        t.type === 'income' ? `+${t.amount}` : `-${t.amount}`
    ]);

    doc.autoTable({
        startY: 45,
        head: [['Date', 'Description', 'Category', 'Amount']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [102, 126, 234] }
    });

    doc.save(`Expense_Report_${new Date().toISOString().split('T')[0]}.pdf`);
}

// Export to CSV
function exportToCSV() {
    if (transactions.length === 0) {
        alert("No transactions to export!");
        return;
    }

    let csvContent = "text/csv;charset=utf-8,";
    csvContent += "Date,Description,Category,Type,Amount\n";

    transactions.forEach(t => {
        const row = `${t.date},"${t.description}",${t.category},${t.type},${t.amount}`;
        csvContent += row + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "transactions.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Save Backup (JSON)
function saveBackup() {
    const dataStr = "text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(transactions));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}

// Load Backup (JSON)
function loadBackup(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(event) {
        try {
            const importedData = JSON.parse(event.target.result);
            if (!Array.isArray(importedData)) throw new Error("Invalid format");

            const batch = db.batch();
            let count = 0;

            importedData.forEach(item => {
                // Add userEmail to imported items if missing
                item.userEmail = userEmail;
                const docRef = db.collection('transactions').doc();
                batch.set(docRef, item);
                count++;
            });

            await batch.commit();
            alert(`Successfully restored ${count} transactions!`);
            loadTransactions();
        } catch (error) {
            alert("Error loading backup: " + error.message);
        }
    };
    reader.readAsText(file);
    // Reset input so same file can be selected again
    e.target.value = ''; 
}

// ================= UTILITIES =================

function updateSyncStatus(message, statusClass) {
    syncTextEl.textContent = message;
    syncStatusEl.className = `sync-status ${statusClass}`;
}

// Initialize on Load
document.addEventListener('DOMContentLoaded', initApp);
