// Global Variables
let transactions = [];
// Note: 'db' is already defined in firebase-config.js - DO NOT redeclare it

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

// Global variables for date range filtering
let globalFromDate = '';
let globalToDate = '';

// ================= INITIALIZATION =================

// Initialize App - NO EMAIL AUTHENTICATION
function initApp() {
    // Wait a moment for firebase-config.js to load db
    if (typeof db === 'undefined') {
        console.log('Waiting for Firebase...');
        setTimeout(initApp, 500);
        return;
    }
    loadTransactions();
    setupEventListeners();
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
    
    // IMPORTANT: Prevent form submission on edit modal
    editForm.addEventListener('submit', (e) => {
        e.preventDefault();
        updateTransaction();
    });

    // Date Range Preview Modal
    previewBtn.addEventListener('click', () => dateRangeModal.classList.remove('hidden'));
    closeModalBtn.addEventListener('click', () => dateRangeModal.classList.add('hidden'));
    dateRangeModal.addEventListener('click', (e) => {
        if (e.target === dateRangeModal) dateRangeModal.classList.add('hidden');
    });
    generatePreviewBtn.addEventListener('click', generateDateRangePreview);

    // Action Buttons
    exportCsvBtn.addEventListener('click', exportToCSV);
    exportPdfBtn.addEventListener('click', exportToPDF);
    saveBackupBtn.addEventListener('click', saveBackup);
    loadBackupBtn.addEventListener('click', () => loadBackupInput.click());
    loadBackupInput.addEventListener('change', loadBackup);
    clearBtn.addEventListener('click', clearAllData);
}

// ================= FIREBASE OPERATIONS =================

// Load Transactions - NO EMAIL FILTER
async function loadTransactions() {
    updateSyncStatus('🔄 Syncing...', '');
    try {
        const snapshot = await db.collection('transactions')
            .orderBy('date', 'desc')
            .get();

        transactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        renderTransactions();
        updateSyncStatus('✅ Live synced', 'synced');
    } catch (error) {
        console.error("Error loading transactions:", error);
        updateSyncStatus('❌ Error: ' + error.message, 'error');
    }
}

// Add Transaction - NO EMAIL
async function addTransaction(e) {
    e.preventDefault();
    updateSyncStatus('💾 Saving...', '');

    const newTransaction = {
        description: document.getElementById('description').value,
        amount: parseFloat(document.getElementById('amount').value),
        type: document.getElementById('type').value,
        category: document.getElementById('category').value,
        date: document.getElementById('date').value,
        createdAt: new Date().toISOString()
    };

    try {
        await db.collection('transactions').add(newTransaction);
        transactionForm.reset();
        document.getElementById('date').valueAsDate = new Date();
        loadTransactions();
    } catch (error) {
        console.error("Error adding transaction:", error);
        updateSyncStatus('❌ Save Failed', 'error');
        alert('Failed to save. Check console for details.');
    }
}

// Delete Transaction - IMPROVED & FIXED VERSION
window.deleteTransaction = async function(id) {
    console.log('🗑️ Delete requested for ID:', id);
    
    // Find the transaction to show in confirmation
    const transaction = transactions.find(t => t.id === id);
    if (!transaction) {
        console.error('❌ Transaction not found:', id);
        alert('Transaction not found. Please refresh the page.');
        return;
    }
    
    // Show confirmation with transaction details
    const confirmMessage = `Delete this transaction?\n\n📝 ${transaction.description}\n💰 ₹${transaction.amount.toFixed(2)}\n📅 ${formatDate(transaction.date)}`;
    
    if (confirm(confirmMessage)) {
        try {
            updateSyncStatus('🗑️ Deleting...', '');
            
            // Remove from local array immediately for instant UI update
            const index = transactions.findIndex(t => t.id === id);
            if (index !== -1) {
                transactions.splice(index, 1);
                renderTransactions(); // Re-render immediately
            }
            
            // Delete from Firebase
            await db.collection('transactions').doc(id).delete();
            
            console.log('✅ Transaction deleted successfully:', id);
            updateSyncStatus('✅ Deleted', 'synced');
            
        } catch (error) {
            console.error('❌ Error deleting transaction:', error);
            
            // Revert local change if Firebase delete failed
            loadTransactions(); // Reload from Firebase to sync
            
            updateSyncStatus('❌ Delete Failed', 'error');
            alert('Failed to delete: ' + error.message);
        }
    }
};

// Open Edit Modal - MAKE GLOBAL
window.openEditModal = function(id) {
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

// Update Transaction - FIXED
async function updateTransaction() {
    const id = document.getElementById('editId').value;
    
    if (!id) {
        alert('Error: No transaction ID found');
        return;
    }
    
    const updatedData = {
        description: document.getElementById('editDescription').value,
        amount: parseFloat(document.getElementById('editAmount').value),
        type: document.getElementById('editType').value,
        category: document.getElementById('editCategory').value,
        date: document.getElementById('editDate').value,
        updatedAt: new Date().toISOString()
    };

    try {
        // Use update() to modify existing document
        await db.collection('transactions').doc(id).update(updatedData);
        
        editModal.classList.add('hidden');
        editForm.reset();
        loadTransactions();
        updateSyncStatus('✅ Updated', 'synced');
    } catch (error) {
        console.error("Error updating:", error);
        updateSyncStatus('❌ Update Failed', 'error');
        alert('Failed to update. Error: ' + error.message);
    }
}

// Clear All Data
async function clearAllData() {
    if (confirm('⚠️ WARNING: This will delete ALL your transactions. This cannot be undone. Continue?')) {
        try {
            updateSyncStatus('🗑️ Clearing...', '');
            
            const batch = db.batch();
            transactions.forEach(t => {
                const docRef = db.collection('transactions').doc(t.id);
                batch.delete(docRef);
            });
            await batch.commit();
            
            transactions = [];
            renderTransactions();
            updateSyncStatus('✅ All data cleared', 'synced');
        } catch (error) {
            console.error("Error clearing data:", error);
            updateSyncStatus('❌ Clear Failed', 'error');
            alert('Failed to clear data: ' + error.message);
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
            <div class="transaction-amount">
                ${t.type === 'income' ? '+' : '-'}₹${t.amount.toFixed(2)}
            </div>
            <div class="transaction-actions">
                <button class="btn-edit" onclick="openEditModal('${t.id}')" title="Edit">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-delete" onclick="deleteTransaction('${t.id}')" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
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
    if (!dateString) return '';
    const date = new Date(dateString + 'T00:00:00');
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

// ================= DATE RANGE PREVIEW =================

function generateDateRangePreview() {
    const fromDate = document.getElementById('fromDate').value;
    const toDate = document.getElementById('toDate').value;

    if (!fromDate || !toDate) {
        alert("⚠️ Please select both From and To dates.");
        return;
    }

    const start = new Date(fromDate + 'T00:00:00');
    const end = new Date(toDate + 'T00:00:00');
    end.setHours(23, 59, 59, 999);

    const filtered = transactions.filter(t => {
        const tDate = new Date(t.date + 'T00:00:00');
        return tDate >= start && tDate <= end;
    });

    previewResult.classList.remove('hidden');
    
    const incomeData = filtered.filter(t => t.type === 'income');
    const expenseData = filtered.filter(t => t.type === 'expense');

    const previewHTML = `
        <h3 style="text-align:center; color:#667eea; margin-bottom:20px;">
            📅 Preview: ${formatDate(fromDate)} to ${formatDate(toDate)}
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

    previewResult.innerHTML = previewHTML;
    dateRangeModal.classList.add('hidden');
}

// ================= EXPORT & BACKUP =================

// Export to PDF - IMPROVED VERSION with date range & totals
function exportToPDF() {
    // Filter transactions based on selected date range
    let filteredTransactions = [...transactions];
    let dateRangeText = 'All Time';
    
    // Check if date range is selected
    const fromDateInput = document.getElementById('fromDate')?.value;
    const toDateInput = document.getElementById('toDate')?.value;
    
    if (fromDateInput && toDateInput) {
        globalFromDate = fromDateInput;
        globalToDate = toDateInput;
    }
    
    if (globalFromDate && globalToDate) {
        const start = new Date(globalFromDate + 'T00:00:00');
        const end = new Date(globalToDate + 'T00:00:00');
        end.setHours(23, 59, 59, 999);
        
        filteredTransactions = transactions.filter(t => {
            const tDate = new Date(t.date + 'T00:00:00');
            return tDate >= start && tDate <= end;
        });
        
        dateRangeText = `${formatDate(globalFromDate)} to ${formatDate(globalToDate)}`;
    }
    
    if (filteredTransactions.length === 0) {
        alert("⚠️ No transactions to export for the selected period!");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // ===== HEADER =====
    doc.setFontSize(22);
    doc.setTextColor(102, 126, 234);
    doc.text("Stitches by S: Financial Report", 105, 20, { align: 'center' });
    
    // Date range
    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.text(`Period: ${dateRangeText}`, 105, 28, { align: 'center' });
    doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, 105, 34, { align: 'center' });

    // ===== SUMMARY BOX =====
    const incomeTotal = filteredTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
        
    const expenseTotal = filteredTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);
        
    const netBalance = incomeTotal - expenseTotal;

    // Draw summary box background
    doc.setFillColor(248, 249, 250);
    doc.roundedRect(14, 40, 182, 25, 3, 3, 'F');
    
    // Summary text
    doc.setFontSize(11);
    doc.setTextColor(67, 233, 123); // Green for income
    doc.text(`Total Income: Rs. ${incomeTotal.toFixed(2)}`, 20, 48);
    
    doc.setTextColor(250, 112, 154); // Pink for expense
    doc.text(`Total Expenses: Rs. ${expenseTotal.toFixed(2)}`, 20, 56);
    
    doc.setTextColor(102, 126, 234); // Blue for balance
    doc.text(`Net Balance: Rs. ${netBalance.toFixed(2)}`, 20, 64);

    // Transaction count
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Transactions: ${filteredTransactions.length}`, 140, 48);

    // ===== TABLE =====
    const tableData = filteredTransactions.map(t => [
        formatDate(t.date),
        t.description,
        t.category.charAt(0).toUpperCase() + t.category.slice(1),
        t.type === 'income' ? `+${t.amount.toFixed(2)}` : `-${t.amount.toFixed(2)}`
    ]);

    doc.autoTable({
        startY: 72,
        head: [['Date', 'Description', 'Category', 'Amount']],
        body: tableData,
        theme: 'grid',
        headStyles: { 
            fillColor: [102, 126, 234],
            textColor: 255,
            fontStyle: 'bold',
            fontSize: 9
        },
        styles: { 
            fontSize: 8,
            cellPadding: 3
        },
        alternateRowStyles: {
            fillColor: [250, 250, 250]
        },
        // Color code income/expense in amount column
        didParseCell: function(data) {
            if (data.section === 'body' && data.column.index === 3) {
                const text = data.cell.raw;
                if (text && text.startsWith('+')) {
                    data.cell.styles.textColor = [67, 233, 123]; // Green for income
                    data.cell.styles.fontStyle = 'bold';
                } else if (text && text.startsWith('-')) {
                    data.cell.styles.textColor = [250, 112, 154]; // Pink for expense
                }
            }
        }
    });

    // ===== FOOTER TOTALS =====
    const finalY = doc.lastAutoTable.finalY + 5;
    
    // Draw footer box
    doc.setFillColor(240, 240, 240);
    doc.roundedRect(14, finalY, 182, 20, 3, 3, 'F');
    
    doc.setFontSize(10);
    doc.text(`Income: Rs. ${incomeTotal.toFixed(2)}`, 20, finalY + 8);
    doc.text(`Expenses: Rs. ${expenseTotal.toFixed(2)}`, 20, finalY + 15);
    doc.text(`Net: Rs. ${netBalance.toFixed(2)}`, 120, finalY + 12);

    // ===== PAGE FOOTER =====
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`Page ${i} of ${pageCount}`, 105, 290, { align: 'center' });
        doc.text('Powered by iniyan.talkies', 105, 295, { align: 'center' });
    }

    // Save PDF
    const fileName = globalFromDate && globalToDate 
        ? `StitchesByS_Report_${globalFromDate}_to_${globalToDate}.pdf`
        : `StitchesByS_Report_${new Date().toISOString().split('T')[0]}.pdf`;
    
    doc.save(fileName);
    updateSyncStatus('📄 PDF exported!', 'synced');
}

// Export to CSV
function exportToCSV() {
    if (transactions.length === 0) {
        alert("⚠️ No transactions to export!");
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
    link.setAttribute("download", `transactions_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    updateSyncStatus('📊 CSV exported!', 'synced');
}

// Save Backup (JSON) - FIXED
function saveBackup() {
    const backupData = {
        version: "1.0",
        exportDate: new Date().toISOString(),
        transactions: transactions
    };
    
    const dataStr = "text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `stitches_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    
    updateSyncStatus('💾 Backup saved!', 'synced');
}

// Load Backup (JSON) - FIXED
function loadBackup(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(event) {
        try {
            const backupData = JSON.parse(event.target.result);
            
            // Check if it's the new format or old format
            let importedData;
            if (backupData.transactions && Array.isArray(backupData.transactions)) {
                importedData = backupData.transactions;
            } else if (Array.isArray(backupData)) {
                importedData = backupData;
            } else {
                throw new Error("Invalid backup file format");
            }

            if (importedData.length === 0) {
                alert("⚠️ No transactions found in backup file");
                return;
            }

            if (!confirm(`⚠️ This will import ${importedData.length} transactions. Continue?`)) {
                return;
            }

            updateSyncStatus('📂 Importing...', '');
            
            const batch = db.batch();
            let count = 0;

            importedData.forEach(item => {
                // Validate required fields
                if (!item.date || !item.amount || !item.type) {
                    console.warn("Skipping invalid transaction:", item);
                    return;
                }

                const docRef = db.collection('transactions').doc();
                batch.set(docRef, {
                    description: item.description || '',
                    amount: parseFloat(item.amount),
                    type: item.type,
                    category: item.category || 'other',
                    date: item.date,
                    createdAt: item.createdAt || new Date().toISOString()
                });
                count++;
            });

            await batch.commit();
            alert(`✅ Successfully imported ${count} transactions!`);
            loadTransactions();
            updateSyncStatus('✅ Import complete', 'synced');
        } catch (error) {
            console.error("Load backup error:", error);
            alert("❌ Error loading backup: " + error.message);
            updateSyncStatus('❌ Import failed', 'error');
        }
        
        // Reset input
        e.target.value = ''; 
    };
    reader.readAsText(file);
}

// ================= UTILITIES =================

function updateSyncStatus(message, statusClass) {
    syncTextEl.textContent = message;
    syncStatusEl.className = `sync-status ${statusClass}`;
}

// Initialize on Load
document.addEventListener('DOMContentLoaded', initApp);
