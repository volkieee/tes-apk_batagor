// ==========================================================================
// DAPUR BATAGOR - standalone SELLER PORTAL LOGIC (admin.js)
// Manages authentication, local orders logging, statistics, and settings.
// ==========================================================================

// Global state variables
const ITEM_PRICE = 15000;
let sellerWANumber = localStorage.getItem('seller_wa_number') || '6285921214331';
let ordersList = JSON.parse(localStorage.getItem('batagor_orders')) || [];

document.addEventListener('DOMContentLoaded', () => {
  initAdminAuth();
  initAdminDashboard();
  initModal();
});

// ==========================================================================
// 1. Authentication Manager
// ==========================================================================
function initAdminAuth() {
  const loginScreen = document.getElementById('admin-login-screen');
  const dashboardView = document.getElementById('admin-dashboard-view');
  const loginForm = document.getElementById('admin-login-form');
  const passwordInput = document.getElementById('admin-password');
  const btnLogout = document.getElementById('btn-logout');

  // Check existing session authorization
  if (sessionStorage.getItem('is_admin') === 'true') {
    loginScreen.style.display = 'none';
    dashboardView.style.display = 'block';
    refreshAdminTable();
  }

  // Handle Login submission
  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const password = passwordInput.value.trim();

    if (password === 'admin' || password === 'joshua') {
      sessionStorage.setItem('is_admin', 'true');
      loginScreen.style.display = 'none';
      dashboardView.style.display = 'block';
      passwordInput.value = '';

      showToast('Akses Diterima', 'Selamat datang kembali, Penjual!', 'success');
      refreshAdminTable();
    } else {
      showToast('Akses Ditolak', 'PIN / Kata sandi salah!', 'error');
      passwordInput.value = '';
      passwordInput.focus();
    }
  });

  // Handle Logout
  btnLogout.addEventListener('click', () => {
    if (confirm('Apakah Anda yakin ingin keluar dari panel admin?')) {
      sessionStorage.removeItem('is_admin');
      dashboardView.style.display = 'none';
      loginScreen.style.display = 'flex';
      showToast('Keluar', 'Anda telah log out dari panel penjual.', 'success');
    }
  });
}

// ==========================================================================
// 2. Dashboard Calculators & Table Populator
// ==========================================================================
function initAdminDashboard() {
  const btnExport = document.getElementById('btn-export-orders');

  btnExport.addEventListener('click', () => {
    if (ordersList.length === 0) {
      showToast('Log Kosong', 'Belum ada pesanan masuk untuk diekspor.', 'error');
      return;
    }

    let summaryText = `*REKAP PESANAN BATAGOR JOSHUA*\nTanggal Rekap: ${getFormattedDate()}\n====================================\n\n`;
    let totalIncome = 0;
    let pendingCount = 0;

    ordersList.forEach((ord, idx) => {
      const classPart = ord.role === 'Siswa' ? ` (${ord.classRoom})` : ` (${ord.role})`;
      summaryText += `${idx + 1}. *${ord.name}*${classPart}\n`;
      if (ord.cheese > 0) summaryText += `   - Cheese: ${ord.cheese} porsi\n`;
      if (ord.mercon > 0) summaryText += `   - Mercon: ${ord.mercon} porsi\n`;
      if (ord.notes !== '-') summaryText += `   - Catatan: "${ord.notes}"\n`;
      summaryText += `   - Status: [${ord.status.toUpperCase()}] | Total: Rp ${ord.total.toLocaleString('id-ID')}\n\n`;

      totalIncome += ord.total;
      if (ord.status === 'Pending') pendingCount++;
    });

    summaryText += `====================================\n`;
    summaryText += `*Total Pesanan:* ${ordersList.length} Order (${pendingCount} Pending)\n`;
    summaryText += `*Estimasi Pendapatan:* Rp ${totalIncome.toLocaleString('id-ID')}\n`;

    // Copy summary report to clipboard
    navigator.clipboard.writeText(summaryText)
      .then(() => {
        showToast('Rekap Disalin!', 'Seluruh rekap pesanan disalin ke clipboard Anda.', 'success');
      })
      .catch(err => {
        showToast('Gagal Salin', 'Tidak dapat menyalin ke clipboard.', 'error');
        console.error(err);
      });
  });
}

function refreshAdminTable() {
  // Reload current orders from localStorage (handles cases where orders were added in another tab)
  ordersList = JSON.parse(localStorage.getItem('batagor_orders')) || [];

  const tableBody = document.getElementById('orders-table-body');
  const emptyState = document.getElementById('table-empty-state');
  const statOrders = document.getElementById('stat-total-orders');
  const statRevenue = document.getElementById('stat-total-revenue');
  const statRatio = document.getElementById('stat-variant-ratio');

  let totalRevenue = 0;
  let totalCheese = 0;
  let totalMercon = 0;

  tableBody.innerHTML = '';

  if (ordersList.length === 0) {
    emptyState.style.display = 'flex';
  } else {
    emptyState.style.display = 'none';

    ordersList.forEach((ord, index) => {
      totalRevenue += ord.total;
      totalCheese += ord.cheese;
      totalMercon += ord.mercon;

      let statusClass = 'status-pending';
      if (ord.status === 'Paid') statusClass = 'status-paid';
      if (ord.status === 'Delivered') statusClass = 'status-delivered';

      let detailsString = '';
      if (ord.cheese > 0) detailsString += `<div>Cheese: <strong>${ord.cheese}</strong></div>`;
      if (ord.mercon > 0) detailsString += `<div>Mercon: <strong>${ord.mercon}</strong></div>`;

      const rowHtml = `
        <tr>
          <td>${index + 1}</td>
          <td style="font-size: 0.8rem; color: var(--text-muted); white-space: nowrap;">${ord.date || '-'}</td>
          <td>
            <strong>${ord.name}</strong>
            <div style="font-size: 0.75rem; color: var(--text-muted)">
              ${ord.role} ${ord.classRoom !== '-' ? `| ${ord.classRoom}` : ''}
            </div>
          </td>
          <td>${detailsString}</td>
          <td style="max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${ord.notes}">${ord.notes}</td>
          <td><strong>Rp ${ord.total.toLocaleString('id-ID')}</strong></td>
          <td>
            <span class="order-badge-status ${statusClass}" style="cursor: pointer;" onclick="cycleOrderStatus(${ord.id})">
              <i class="fa-solid ${ord.status === 'Pending' ? 'fa-spinner' : ord.status === 'Paid' ? 'fa-cash-register' : 'fa-circle-check'}"></i>
              ${ord.status}
            </span>
          </td>
          <td>
            <button class="admin-action-btn btn-delete" onclick="deleteOrder(${ord.id})" title="Hapus order">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </td>
        </tr>
      `;
      tableBody.insertAdjacentHTML('beforeend', rowHtml);
    });
  }

  statOrders.textContent = ordersList.length;
  statRevenue.textContent = `Rp ${totalRevenue.toLocaleString('id-ID')}`;
  statRatio.textContent = `${totalCheese} C / ${totalMercon} M`;
}

// Cycle status Pending -> Paid -> Delivered
window.cycleOrderStatus = function (id) {
  const index = ordersList.findIndex(o => o.id === id);
  if (index !== -1) {
    const states = ['Pending', 'Paid', 'Delivered'];
    const currentIdx = states.indexOf(ordersList[index].status);
    const nextIdx = (currentIdx + 1) % states.length;

    ordersList[index].status = states[nextIdx];
    localStorage.setItem('batagor_orders', JSON.stringify(ordersList));
    refreshAdminTable();
    showToast('Status Diubah', `Pesanan ${ordersList[index].name} diubah menjadi ${states[nextIdx]}`, 'success');
  }
};

// Delete order
window.deleteOrder = function (id) {
  if (confirm('Apakah Anda yakin ingin menghapus catatan pesanan ini?')) {
    ordersList = ordersList.filter(o => o.id !== id);
    localStorage.setItem('batagor_orders', JSON.stringify(ordersList));
    refreshAdminTable();
    showToast('Order Dihapus', 'Pesanan berhasil dihapus dari log lokal.', 'success');
  }
};

// Date formatter helper
function getFormattedDate() {
  const d = new Date();
  const pad = (n) => n.toString().padStart(2, '0');

  const day = pad(d.getDate());
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const month = months[d.getMonth()];
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());

  return `${day} ${month}, ${hours}:${minutes}`;
}

// ==========================================================================
// 3. Settings Modal Config
// ==========================================================================
function initModal() {
  const btnSettings = document.getElementById('btn-settings-modal');
  const modal = document.getElementById('settings-modal');
  const btnClose = document.getElementById('btn-close-modal');
  const btnSave = document.getElementById('btn-save-wa');
  const inputWa = document.getElementById('input-wa-number');

  // Load wa number
  inputWa.value = sellerWANumber;

  btnSettings.addEventListener('click', () => {
    modal.classList.add('active');
  });

  btnClose.addEventListener('click', () => {
    modal.classList.remove('active');
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.remove('active');
    }
  });

  btnSave.addEventListener('click', () => {
    let rawNumber = inputWa.value.trim().replace(/[^0-9]/g, '');

    if (rawNumber.length < 9) {
      showToast('Nomor Salah', 'Silakan masukkan nomor WhatsApp yang valid.', 'error');
      return;
    }

    if (rawNumber.startsWith('0')) {
      rawNumber = '62' + rawNumber.substring(1);
    } else if (!rawNumber.startsWith('62')) {
      rawNumber = '62' + rawNumber;
    }

    sellerWANumber = rawNumber;
    localStorage.setItem('seller_wa_number', sellerWANumber);
    inputWa.value = sellerWANumber;

    modal.classList.remove('active');
    showToast('Pengaturan Disimpan', `Nomor WA penerima diubah menjadi ${sellerWANumber}`, 'success');
  });
}

// ==========================================================================
// 4. Toast Notification Manager
// ==========================================================================
let toastTimeout;
function showToast(title, desc, type = 'success') {
  const toast = document.getElementById('toast-notif');
  const tIcon = document.getElementById('toast-icon');
  const tTitle = document.getElementById('toast-title');
  const tDesc = document.getElementById('toast-desc');

  clearTimeout(toastTimeout);

  tTitle.textContent = title;
  tDesc.textContent = desc;

  if (type === 'success') {
    tIcon.className = 'toast-icon success';
    tIcon.innerHTML = '<i class="fa-solid fa-circle-check"></i>';
    toast.style.borderColor = 'var(--accent-green)';
  } else {
    tIcon.className = 'toast-icon error';
    tIcon.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i>';
    toast.style.borderColor = 'var(--accent-mercon)';
  }

  toast.classList.add('show');

  toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 4000);
}
