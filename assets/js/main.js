import { doc, setDoc } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import { db } from '../src/config/firebase-config.js';

// ========================================================================
// DAPUR BATAGOR - PRE-ORDER LOGICAL SYSTEM (JS)
// Single-Page View Transition Mode with Live Receipt & WhatsApp Integration
// ==========================================================================

let originalQty = 0;
let cheeseQty = 0;
const ITEM_PRICE = 15000;
const DEFAULT_SELLER_WA = '6285921214331';

function getSellerWANumber() {
  let number = (localStorage.getItem('seller_wa_number') || DEFAULT_SELLER_WA).replace(/[^0-9]/g, '');
  if (number.startsWith('0')) {
    number = '62' + number.substring(1);
  } else if (!number.startsWith('62')) {
    number = '62' + number;
  }
  return number;
}

function buildWhatsAppUrl(message) {
  const phone = getSellerWANumber();
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
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

function constructWhatsAppMessage(order) {
  let itemsBreakdown = '';
  if (order.original > 0) {
    itemsBreakdown += `- *${order.original} porsi* Batagor Original (Rp ${(order.original * ITEM_PRICE).toLocaleString('id-ID')})\n`;
  }
  if (order.cheese > 0) {
    itemsBreakdown += `- *${order.cheese} porsi* Batagor Keju (Rp ${(order.cheese * ITEM_PRICE).toLocaleString('id-ID')})\n`;
  }

  const classLine = order.role === 'Siswa' ? `*Kelas:* ${order.classRoom}\n` : '';

  return `*PRE-ORDER BATAGOR-IN* 🥟
--------------------------------------------
*Nama:* ${order.name}
*Status:* ${order.role}
${classLine}--------------------------------------------
*Rincian Pesanan:*
${itemsBreakdown}
*Catatan:* ${order.notes || '-'}
--------------------------------------------
*Total Tagihan:* Rp ${order.total.toLocaleString('id-ID')}
--------------------------------------------
_Halo kak, saya ingin mengonfirmasi pesanan Batagor-in saya di atas. Terima kasih!_ 🙏`;
}

// DOM Initialization
document.addEventListener('DOMContentLoaded', () => {
  initBurgerMenu();
  initFormListeners();
  initSecretAdminTrigger();
  initNavBackButton();
});

// ==========================================================================
// 1. Burger Menu & Navbar Scroll
// ==========================================================================
function initBurgerMenu() {
  const burger = document.getElementById('burger-menu');
  const navLinks = document.getElementById('nav-links');

  if (burger && navLinks) {
    burger.addEventListener('click', () => {
      navLinks.classList.toggle('active');
      burger.classList.toggle('active');
    });

    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('active');
        burger.classList.remove('active');
      });
    });
  }

  const navbar = document.getElementById('navbar');
  if (navbar) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 50) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }
      updateActiveLinkOnScroll();
    });
  }
}

function updateActiveLinkOnScroll() {
  if (document.body.classList.contains('checkout-active')) return;

  const sections = document.querySelectorAll('section');
  const navLinks = document.querySelectorAll('.nav-link');
  let currentSec = 'hero';

  sections.forEach(sec => {
    const secTop = sec.offsetTop - 150;
    if (window.scrollY >= secTop) {
      currentSec = sec.getAttribute('id');
    }
  });

  navLinks.forEach(link => {
    link.classList.remove('active');
    if (link.getAttribute('href') === `#${currentSec}`) {
      link.classList.add('active');
    }
  });
}

function initNavBackButton() {
  const navBackBtn = document.getElementById('nav-btn-back-to-form');
  if (navBackBtn) {
    navBackBtn.addEventListener('click', () => {
      exitCheckoutView();
    });
  }
}

// ==========================================================================
// 2. Pre-order Form Logics & Single-Page Transition
// ==========================================================================
function initFormListeners() {
  const preorderForm = document.getElementById('preorder-form');
  if (!preorderForm) return;

  const inputName = document.getElementById('input-name');
  const inputClass = document.getElementById('input-class');
  const classContainer = document.getElementById('class-input-container');
  const inputOtherRole = document.getElementById('input-other-role');
  const otherRoleContainer = document.getElementById('other-role-input-container');
  const inputNotes = document.getElementById('input-notes');

  const radioSiswa = document.getElementById('role-siswa');
  const radioGuru = document.getElementById('role-guru');
  const radioStaf = document.getElementById('role-staf');
  const radioLainnya = document.getElementById('role-lainnya');

  const roles = [radioSiswa, radioGuru, radioStaf, radioLainnya];
  roles.forEach(radio => {
    if (!radio) return;
    radio.addEventListener('change', () => {
      const selectedRole = document.querySelector('input[name="user-role"]:checked').value;
      const isOtherRole = selectedRole === 'Lainnya';

      if (isOtherRole) {
        otherRoleContainer.classList.add('active');
        inputOtherRole.setAttribute('required', 'true');
      } else {
        otherRoleContainer.classList.remove('active');
        inputOtherRole.removeAttribute('required');
        inputOtherRole.value = '';
      }

      if (selectedRole === 'Siswa') {
        classContainer.classList.add('active');
        inputClass.setAttribute('required', 'true');
      } else {
        classContainer.classList.remove('active');
        inputClass.removeAttribute('required');
        inputClass.value = '';
      }
    });
  });

  // Quantity Counters: Original
  const btnOriginalMinus = document.getElementById('btn-original-minus');
  const btnOriginalPlus = document.getElementById('btn-original-plus');
  const valOriginalQty = document.getElementById('val-original-qty');

  if (btnOriginalMinus && btnOriginalPlus && valOriginalQty) {
    btnOriginalMinus.addEventListener('click', () => {
      if (originalQty > 0) {
        originalQty--;
        valOriginalQty.textContent = originalQty;
        btnOriginalMinus.disabled = originalQty <= 0;
      }
    });

    btnOriginalPlus.addEventListener('click', () => {
      if (originalQty < 25) {
        originalQty++;
        valOriginalQty.textContent = originalQty;
        btnOriginalMinus.disabled = false;
      }
    });
  }

  // Quantity Counters: Cheese
  const btnCheeseMinus = document.getElementById('btn-cheese-minus');
  const btnCheesePlus = document.getElementById('btn-cheese-plus');
  const valCheeseQty = document.getElementById('val-cheese-qty');

  if (btnCheeseMinus && btnCheesePlus && valCheeseQty) {
    btnCheeseMinus.addEventListener('click', () => {
      if (cheeseQty > 0) {
        cheeseQty--;
        valCheeseQty.textContent = cheeseQty;
        btnCheeseMinus.disabled = cheeseQty <= 0;
      }
    });

    btnCheesePlus.addEventListener('click', () => {
      if (cheeseQty < 25) {
        cheeseQty++;
        valCheeseQty.textContent = cheeseQty;
        btnCheeseMinus.disabled = false;
      }
    });
  }

  // Next Button Trigger -> Transisi ke Ringkasan Saja (Elemen lain menghilang)
  const btnNextOrder = document.getElementById('btn-next-order');
  if (btnNextOrder) {
    btnNextOrder.addEventListener('click', () => {
      if (!preorderForm.reportValidity()) return;

      const name = inputName.value.trim();
      const selectedRole = document.querySelector('input[name="user-role"]:checked').value;
      const role = selectedRole === 'Lainnya' ? inputOtherRole.value.trim() : selectedRole;
      const classRoom = role === 'Siswa' ? inputClass.value.trim() : '-';
      const notes = inputNotes.value.trim();

      if (!name) {
        showToast('Data Kurang', 'Silakan isi nama Anda terlebih dahulu.', 'error');
        inputName.focus();
        return;
      }

      if (selectedRole === 'Siswa' && !classRoom) {
        showToast('Data Kurang', 'Siswa wajib mengisi kelas.', 'error');
        inputClass.focus();
        return;
      }

      if (selectedRole === 'Lainnya' && !role) {
        showToast('Data Kurang', 'Silakan isi status Anda.', 'error');
        inputOtherRole.focus();
        return;
      }

      if (originalQty + cheeseQty <= 0) {
        showToast('Porsi Kosong', 'Silakan pilih minimal 1 porsi Batagor.', 'error');
        return;
      }

      const orderData = {
        id: Date.now(),
        name: name,
        role: role,
        classRoom: classRoom,
        original: originalQty,
        cheese: cheeseQty,
        total: (originalQty + cheeseQty) * ITEM_PRICE,
        notes: notes || '-',
        date: getFormattedDate(),
        status: 'Pending'
      };

      showCheckoutView(orderData);
    });
  }
}

// Global variant select helper called directly from Menu cards
window.selectVariant = function (type) {
  const section = document.getElementById('preorder');
  if (section) {
    section.scrollIntoView({ behavior: 'smooth' });
  }

  if (type === 'original') {
    originalQty++;
    const valOriginal = document.getElementById('val-original-qty');
    const btnOriginalMinus = document.getElementById('btn-original-minus');
    if (valOriginal) valOriginal.textContent = originalQty;
    if (btnOriginalMinus) btnOriginalMinus.disabled = false;
    showToast('Item Ditambahkan', '1 Porsi Batagor Original ditambahkan ke formulir.', 'success');
  } else if (type === 'cheese') {
    cheeseQty++;
    const valCheese = document.getElementById('val-cheese-qty');
    const btnCheeseMinus = document.getElementById('btn-cheese-minus');
    if (valCheese) valCheese.textContent = cheeseQty;
    if (btnCheeseMinus) btnCheeseMinus.disabled = false;
    showToast('Item Ditambahkan', '1 Porsi Batagor Keju ditambahkan ke formulir.', 'success');
  }
};

// ==========================================================================
// 3. Render Dedicated Summary & Screen Transition
// ==========================================================================
function showCheckoutView(order) {
  const receiptContainer = document.getElementById('inline-receipt-container');
  if (!receiptContainer) return;

  let itemsHtml = '';
  if (order.original > 0) {
    itemsHtml += `
      <div class="receipt-item-row">
        <div class="item-name-col">
          <span class="item-title">Batagor Original</span>
          <span class="item-subtitle">${order.original} porsi × Rp ${ITEM_PRICE.toLocaleString('id-ID')}</span>
        </div>
        <div class="item-price-col">
          Rp ${(order.original * ITEM_PRICE).toLocaleString('id-ID')}
        </div>
      </div>
    `;
  }
  if (order.cheese > 0) {
    itemsHtml += `
      <div class="receipt-item-row">
        <div class="item-name-col">
          <span class="item-title">Batagor Keju</span>
          <span class="item-subtitle">${order.cheese} porsi × Rp ${ITEM_PRICE.toLocaleString('id-ID')}</span>
        </div>
        <div class="item-price-col">
          Rp ${(order.cheese * ITEM_PRICE).toLocaleString('id-ID')}
        </div>
      </div>
    `;
  }

  const classRow = order.role === 'Siswa'
    ? `<div class="receipt-info-row">
         <span class="info-label"><i class="fa-solid fa-chalkboard"></i> Kelas</span>
         <span class="info-value">${order.classRoom || '-'}</span>
       </div>`
    : '';

  const notesRow = order.notes && order.notes !== '-'
    ? `<div class="receipt-info-row">
         <span class="info-label"><i class="fa-solid fa-message"></i> Catatan Khusus</span>
         <span class="info-value">${order.notes}</span>
       </div>`
    : '';

  receiptContainer.innerHTML = `
    <div class="digital-receipt-card">
      <div class="receipt-header">
        <div class="receipt-header-left">
          <span class="receipt-badge"><i class="fa-solid fa-receipt"></i> INVOICE PRE-ORDER</span>
          <h2 class="receipt-order-id">#BTG-${String(order.id).slice(-6)}</h2>
          <span class="receipt-date"><i class="fa-regular fa-clock"></i> ${order.date}</span>
        </div>
        <div class="receipt-header-right">
          <span class="status-pill status-ready">
            <i class="fa-solid fa-circle-dot"></i> Siap Dikonfirmasi
          </span>
        </div>
      </div>

      <div class="receipt-section">
        <h4 class="receipt-section-title"><i class="fa-solid fa-user-check"></i> Data Pemesan</h4>
        <div class="receipt-info-grid">
          <div class="receipt-info-row">
            <span class="info-label"><i class="fa-solid fa-id-badge"></i> Nama Lengkap</span>
            <span class="info-value highlight">${order.name}</span>
          </div>
          <div class="receipt-info-row">
            <span class="info-label"><i class="fa-solid fa-graduation-cap"></i> Status</span>
            <span class="info-value">${order.role}</span>
          </div>
          ${classRow}
          ${notesRow}
        </div>
      </div>

      <div class="receipt-section">
        <h4 class="receipt-section-title"><i class="fa-solid fa-utensils"></i> Rincian Menu Pesanan</h4>
        <div class="receipt-items-table">
          ${itemsHtml}
        </div>
        <div class="receipt-total-row">
          <span>Total Pembayaran</span>
          <span class="total-amount">Rp ${order.total.toLocaleString('id-ID')}</span>
        </div>
      </div>

      <div class="receipt-footer-instructions">
        <div class="instruction-box">
          <i class="fa-solid fa-shield-halved"></i>
          <div>
            <strong>Langkah Terakhir:</strong>
            <p>Klik tombol hijau di bawah untuk mengirim data pesanan Anda langsung ke WhatsApp penjual dengan format otomatis.</p>
          </div>
        </div>

        <div class="receipt-actions">
          <button type="button" class="btn-checkout" id="btn-confirm-wa">
            <i class="fa-brands fa-whatsapp"></i> Kirim Order via WhatsApp
          </button>
          <button type="button" class="btn-summary-back" id="btn-edit-order-back">
            <i class="fa-solid fa-arrow-left"></i> Kembali ke Formulir
          </button>
        </div>
      </div>
    </div>
  `;

  // Listener tombol kembali
  const btnEditBack = document.getElementById('btn-edit-order-back');
  if (btnEditBack) {
    btnEditBack.addEventListener('click', () => {
      exitCheckoutView();
    });
  }

  // Listener tombol WhatsApp
  const btnConfirmWA = document.getElementById('btn-confirm-wa');
  if (btnConfirmWA) {
    btnConfirmWA.addEventListener('click', async () => {
      btnConfirmWA.disabled = true;
      btnConfirmWA.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menghubungkan ke WhatsApp...';

      let ordersList = JSON.parse(localStorage.getItem('batagor_orders')) || [];
      ordersList.unshift(order);
      localStorage.setItem('batagor_orders', JSON.stringify(ordersList));

      try {
        await setDoc(doc(db, 'orders', String(order.id)), order);
      } catch (err) {
        console.warn('Firestore sync failed or offline:', err);
      }

      showToast('Pesanan Terkirim!', 'Membuka aplikasi WhatsApp...', 'success');

      const waText = constructWhatsAppMessage(order);
      const waUrl = buildWhatsAppUrl(waText);

      setTimeout(() => {
        window.location.href = waUrl;
      }, 1000);
    });
  }

  // Aktifkan mode layar ringkasan (hilangkan elemen lain dengan transisi mulus)
  document.body.classList.add('checkout-active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function exitCheckoutView() {
  document.body.classList.remove('checkout-active');
  const section = document.getElementById('preorder');
  if (section) {
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

// ==========================================================================
// 4. Secret Admin Access Trigger
// ==========================================================================
function initSecretAdminTrigger() {
  const secretBtn = document.getElementById('admin-secret-btn');
  if (!secretBtn) return;
  secretBtn.addEventListener('click', () => {
    window.location.href = 'pages/admin/admin.html';
  });
}

// ==========================================================================
// 5. Toast Notification System
// ==========================================================================
let toastTimeout;
function showToast(title, desc, type = 'success') {
  const toast = document.getElementById('toast-notif');
  const tIcon = document.getElementById('toast-icon');
  const tTitle = document.getElementById('toast-title');
  const tDesc = document.getElementById('toast-desc');

  if (!toast) return;

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
