// ==========================================================================
// ADMIN - DASHBOARD MODULE
// Manages table population, stats calculation, and order actions.
// ==========================================================================

import { showToast } from '../UI/ui.js';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, deleteDoc } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import { db } from '../database/firebase-config.js';

let ordersList = [];
let hasLoadedOrders = false;

/**
 * Initializes the main dashboard functionalities like the export button.
 */
export function initAdminDashboard() {
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

    navigator.clipboard.writeText(summaryText)
      .then(() => showToast('Rekap Disalin!', 'Seluruh rekap pesanan disalin ke clipboard Anda.', 'success'))
      .catch(err => {
        showToast('Gagal Salin', 'Tidak dapat menyalin ke clipboard.', 'error');
        console.error(err);
      });
  });
}

/**
 * Refreshes the admin table and statistics from localStorage.
 */
export function refreshAdminTable() {
  const tableBody = document.getElementById('orders-table-body');
  const emptyState = document.getElementById('table-empty-state');
  const statOrders = document.getElementById('stat-total-orders');
  const statRevenue = document.getElementById('stat-total-revenue');
  const statRatio = document.getElementById('stat-variant-ratio');

  let totalRevenue = 0, totalCheese = 0, totalMercon = 0;
  tableBody.innerHTML = '';

  if (ordersList.length === 0) {
    emptyState.style.display = 'flex';
  } else {
    emptyState.style.display = 'none';
    ordersList.forEach((ord, index) => {
      totalRevenue += ord.total;
      totalCheese += ord.cheese;
      totalMercon += ord.mercon;

      let statusClass = ord.status === 'Paid' ? 'status-paid' : ord.status === 'Delivered' ? 'status-delivered' : 'status-pending';
      let detailsString = '';
      if (ord.mercon > 0) detailsString += `<div>Mercon: <strong>${ord.mercon}</strong></div>`;
      if (ord.cheese > 0) detailsString += `<div>Cheese: <strong>${ord.cheese}</strong></div>`;

      const rowHtml = `
        <tr>
          <td data-label="No">${index + 1}</td>
          <td data-label="Waktu" style="font-size: 0.8rem; color: var(--text-muted); white-space: nowrap;">${ord.date || '-'}</td>
          <td data-label="Nama & Kelas"><strong>${ord.name}</strong><div style="font-size: 0.75rem; color: var(--text-muted)">${ord.role} ${ord.classRoom !== '-' ? `| ${ord.classRoom}` : ''}</div></td>
          <td data-label="Detail Pesanan"><div class="order-detail-list">${detailsString}</div></td>
          <td data-label="Catatan" style="max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${ord.notes}">${ord.notes}</td>
          <td data-label="Total"><strong>Rp ${ord.total.toLocaleString('id-ID')}</strong></td>
          <td data-label="Status"><span class="order-badge-status ${statusClass}" style="cursor: pointer;" data-order-id="${ord.id}" data-action="cycle-status"><i class="fa-solid ${ord.status === 'Pending' ? 'fa-spinner' : ord.status === 'Paid' ? 'fa-cash-register' : 'fa-circle-check'}"></i> ${ord.status}</span></td>
          <td data-label="Aksi"><button class="admin-action-btn btn-delete" data-order-id="${ord.id}" data-action="delete-order" title="Hapus order"><i class="fa-solid fa-trash-can"></i></button></td>
        </tr>`;
      tableBody.insertAdjacentHTML('beforeend', rowHtml);
    });
  }

  statOrders.textContent = ordersList.length;
  statRevenue.textContent = `Rp ${totalRevenue.toLocaleString('id-ID')}`;
  statRatio.textContent = `${totalCheese} C / ${totalMercon} M`;
}

/**
 * Handles clicks on the table for actions like cycling status or deleting orders.
 * @param {Event} e The click event.
 */
export function handleTableActions(e) {
  const target = e.target.closest('[data-action]');
  if (!target) return;

  const action = target.dataset.action;
  const id = Number(target.dataset.orderId);
  const index = ordersList.findIndex(o => o.id === id);

  if (index === -1) return;

  if (action === 'cycle-status') {
    const states = ['Pending', 'Paid', 'Delivered'];
    const currentIdx = states.indexOf(ordersList[index].status);
    const nextIdx = (currentIdx + 1) % states.length;
    ordersList[index].status = states[nextIdx];
    updateDoc(doc(db, 'orders', String(ordersList[index].id)), { status: ordersList[index].status })
      .catch(error => console.error('Firestore status update failed:', error));
    showToast('Status Diubah', `Pesanan ${ordersList[index].name} diubah menjadi ${states[nextIdx]}`, 'success');
  } else if (action === 'delete-order') {
    if (!confirm('Apakah Anda yakin ingin menghapus catatan pesanan ini?')) return;
    ordersList = ordersList.filter(o => o.id !== id);
    deleteDoc(doc(db, 'orders', String(id)))
      .catch(error => console.error('Firestore order delete failed:', error));
    showToast('Order Dihapus', 'Pesanan berhasil dihapus dari log lokal.', 'success');
  }

  refreshAdminTable();
}

export function listenForOrders() {
  requestBrowserNotifications();

  const ordersQuery = query(collection(db, 'orders'), orderBy('id', 'desc'));
  onSnapshot(ordersQuery, snapshot => {
    const newOrderChanges = hasLoadedOrders
      ? snapshot.docChanges().filter(change => change.type === 'added')
      : [];

    ordersList = snapshot.docs.map(orderDoc => ({ id: orderDoc.id, ...orderDoc.data() }));
    refreshAdminTable();

    newOrderChanges.forEach(change => {
      notifyNewOrder({ id: change.doc.id, ...change.doc.data() });
    });
    hasLoadedOrders = true;
  }, error => {
    console.error('Firestore orders listener failed:', error);
    showToast('Gagal Memuat Order', 'Periksa aturan dan koneksi Firestore.', 'error');
  });
}

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

function requestBrowserNotifications() {
  if (!('Notification' in window) || Notification.permission !== 'default') return;

  Notification.requestPermission().catch(error => {
    console.warn('Browser notification permission was not granted:', error);
  });
}

function notifyNewOrder(order) {
  const itemCount = (order.cheese || 0) + (order.mercon || 0);
  const total = Number(order.total || 0).toLocaleString('id-ID');
  const message = `${itemCount} porsi - Rp ${total}`;

  showToast('Order Baru Masuk', `${order.name || 'Pelanggan'}: ${message}`, 'success');

  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const browserNotification = new Notification('Order Baru Masuk - Batagor', {
    body: `${order.name || 'Pelanggan'} memesan ${message}.`,
    icon: '../img/batagor_cheese.png',
    tag: `batagor-order-${order.id}`
  });

  browserNotification.onclick = () => {
    window.focus();
    browserNotification.close();
  };
}