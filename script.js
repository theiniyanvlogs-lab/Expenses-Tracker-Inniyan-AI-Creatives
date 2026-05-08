// Global variables
let transactions = [];
let userId = null;

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    generateUserId();
    loadTransactions();
    setupEventListeners();
    setDefaultDate();
});

// Generate unique user ID for multi-device sync
function generateUserId() {
    let storedId = localStorage.getItem('expenseTrackerUserId');
    if (!storedId) {
        storedId = 'user_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('expenseTrackerUserId', storedId);
    }
    userId = storedId;
    console.log('User ID:', userId);
}

// Set default date to today
function setDefaultDate() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('date').value = today;
}

// Setup event listeners
function setupEventListeners() {
    document.getElementById('transactionForm').addEventListener('submit', addTransaction);
    document.getElementById('searchInput').addEventListener('input', filterTransactions);
    document.getElementById('filterMonth').addEventListener('change', filterTransactions);
    document.getElementById('exportBtn').addEventListener('click', exportToCSV);
    document.getElementById('clearBtn').addEventListener('click', clearAllData);
    
    // Real-time sync listener
    syncTransactions();
}

// Add transaction
async function addTransaction(e) {
    e.preventDefault();
    
    const description = document.getElementById('description').value;
    const amount = parseFloat(document.getElementById('amount').value);
    const type = document.getElementById('type').value;
    const category = document.getElementById('category').value;
    const date = document.getElementById('date').value;
    
    const transaction = {
        id: Date.now().toString(),
        userId: userId,
        description,
        amount,
        type,
        category,
        date,
        createdAt: new Date().toISOString()
    };
    
    try {
        // Save to Firebase
        await db.collection('transactions').add(transaction);
        
        // Clear form
        document.getElementById('transactionForm').reset();
        setDefaultDate();
        
        // Show success
        updateSyncStatus('✅ Transaction added!', 'synced');
        
    } catch (error) {
        console.error('Error adding transaction:', error);
        updateSyncStatus('❌ Error saving transaction', 'error');
    }
}

// Load transactions from Firebase
async function loadTransactions() {
    try {
        updateSyncStatus('🔄 Loading transactions...', '');
        
        const snapshot = await db.collection('transactions')
            .where('userId', '==', userId)
            .orderBy('date', 'desc')
            .get();
        
        transactions = [];
        snapshot.forEach(doc => {
            transactions.push({ id: doc.id, ...doc.data() });
        });
        
        renderTransactions();
        updateSummary();
        updateSyncStatus('✅ Synced with cloud', 'synced');
        
    } catch (error) {
        console.error('Error loading transactions:', error);
        updateSyncStatus('❌ Sync error - check Firebase config', 'error');
    }
}

// Real-time sync
function syncTransactions() {
    db.collection('transactions')
        .where('userId', '==', userId)
        .onSnapshot(snapshot => {
            transactions = [];
            snapshot.forEach(doc => {
                transactions.push({ id: doc.id, ...doc.data() });
            });
            transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
            renderTransactions();
            updateSummary();
            updateSyncStatus('✅ Live synced', 'synced');
        }, error => {
            console.error('Sync error:', error);
            updateSyncStatus('❌ Sync failed', 'error');
        });
}

// Render transactions
function renderTransactions(filteredTransactions = null) {
    const list = document.getElementById('transactionsList');
    const data = filteredTransactions || transactions;
    
    if (data.length === 0) {
        list.innerHTML = '<p style="text-align:center;color:#999;padding:40px;">No transactions yet. Add your first one!</p>';
        return;
    }
    
    list.innerHTML = data.map(t => `
        <div class="transaction-item ${t.type}">
            <div class="transaction-info">
                <h4>${t.description}</h4>
                <p>📅 ${formatDate(t.date)} • ${getCategoryEmoji(t.category)} ${t.category}</p>
            </div>
            <div class="transaction-amount">
                ${t.type === 'income' ? '+' : '-'}₹${t.amount.toFixed(2)}
            </div>
            <div class="transaction-actions">
                <button class="btn-delete" onclick="deleteTransaction('${t.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
}

// Delete transaction
async function deleteTransaction(id) {
    if (!confirm('Delete this transaction?')) return;
    
    try {
        await db.collection('transactions').doc(id).delete();
        updateSyncStatus('✅ Transaction deleted', 'synced');
    } catch (error) {
        console.error('Error deleting:', error);
        updateSyncStatus('❌ Delete failed', 'error');
    }
}

// Update summary
function updateSummary() {
    const income = transactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
    
    const expense = transactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);
    
    const balance = income - expense;
    
    document.getElementById('totalIncome').textContent = `₹${income.toFixed(2)}`;
    document.getElementById('totalExpense').textContent = `₹${expense.toFixed(2)}`;
    document.getElementById('balance').textContent = `₹${balance.toFixed(2)}`;
}

// Filter transactions
function filterTransactions() {
    const search = document.getElementById('searchInput').value.toLowerCase();
    const monthFilter = document.getElementById('filterMonth').value;
    
    let filtered = transactions.filter(t => {
        const matchesSearch = t.description.toLowerCase().includes(search) ||
                             t.category.toLowerCase().includes(search);
        
        let matchesMonth = true;
        if (monthFilter === 'current') {
            const now = new Date();
            const tDate = new Date(t.date);
            matchesMonth = tDate.getMonth() === now.getMonth() && 
                          tDate.getFullYear() === now.getFullYear();
        } else if (monthFilter === 'last') {
            const now = new Date();
            const tDate = new Date(t.date);
            const lastMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
            const lastYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
            matchesMonth = tDate.getMonth() === lastMonth && tDate.getFullYear() === lastYear;
        }
        
        return matchesSearch && matchesMonth;
    });
    
    renderTransactions(filtered);
}

// Export to CSV
function exportToCSV() {
    const headers = ['Date', 'Description', 'Category', 'Type', 'Amount'];
    const rows = transactions.map(t => [
        t.date,
        t.description,
        t.category,
        t.type,
        t.amount
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expenses_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
}

// Clear all data
async function clearAllData() {
    if (!confirm('⚠️ Delete ALL transactions? This cannot be undone!')) return;
    
    try {
        const snapshot = await db.collection('transactions')
            .where('userId', '==', userId)
            .get();
        
        const batch = db.batch();
        snapshot.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        
        updateSyncStatus('✅ All data cleared', 'synced');
    } catch (error) {
        console.error('Error clearing:', error);
        updateSyncStatus('❌ Clear failed', 'error');
    }
}

// Helper functions
function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getCategoryEmoji(category) {
    const emojis = {
        food: '🍔',
        transport: '🚗',
        shopping: '🛍️',
        bills: '📄',
        entertainment: '🎬',
        health: '🏥',
        salary: '💼',
        investment: '📈',
        other: '📦'
    };
    return emojis[category] || '📦';
}

function updateSyncStatus(message, status) {
    const statusEl = document.getElementById('syncStatus');
    const textEl = document.getElementById('syncText');
    textEl.textContent = message;
    statusEl.className = 'sync-status ' + status;
}