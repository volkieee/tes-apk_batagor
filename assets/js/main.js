// ========================================================================
// DAPUR BATAGOR - PRE-ORDER LOGICAL SYSTEM (JS)
// Single-Page View Transition Mode with Live Receipt & WhatsApp Integration
// ==========================================================================

// Global state variables
let originalQty = 0;
let cheeseQty = 0;
const ITEM_PRICE = 15000;
const DEFAULT_SELLER_WA = '6285921214331';

// Firebase Firestore safe dynamic helper
async function saveOrderToFirestore(order) {
  try {
    const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js');
    const { db } = await import('../../src/config/firebase-config.js');
    await setDoc(doc(db, 'orders', String(order.id)), order);
    console.log('Order successfully synced to Firestore:', order.id);
  } catch (err) {
    console.warn('Firestore sync failed or offline (order saved locally):', err);
  }
}

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

// Update quantity display in the preorder form
function updateQuantityDisplay() {
  const valOriginal = document.getElementById('val-original-qty');
  const btnOriginalMinus = document.getElementById('btn-original-minus');
  if (valOriginal) valOriginal.textContent = originalQty;
  if (btnOriginalMinus) btnOriginalMinus.disabled = (originalQty <= 0);

  const valCheese = document.getElementById('val-cheese-qty');
  const btnCheeseMinus = document.getElementById('btn-cheese-minus');
  if (valCheese) valCheese.textContent = cheeseQty;
  if (btnCheeseMinus) btnCheeseMinus.disabled = (cheeseQty <= 0);
}

// Global variant select helper (called from menu buttons or global clicks)
window.selectVariant = function (type) {
  const section = document.getElementById('preorder');
  if (section) {
    section.scrollIntoView({ behavior: 'smooth' });
  }

  if (type === 'original') {
    originalQty++;
    updateQuantityDisplay();
    showToast('Item Ditambahkan', '1 Porsi Batagor Original ditambahkan ke formulir.', 'success');
  } else if (type === 'cheese') {
    cheeseQty++;
    updateQuantityDisplay();
    showToast('Item Ditambahkan', '1 Porsi Batagor Keju ditambahkan ke formulir.', 'success');
  }
};

// DOM Initialization
document.addEventListener('DOMContentLoaded', () => {
  initBurgerMenu();
  initFormListeners();
  initQuantityControls();
  initSecretAdminTrigger();
  initMenuCardsDelegation();
  updateQuantityDisplay();
});

// ==========================================================================
// 1. Menu Cards Event Delegation
// ==========================================================================
function initMenuCardsDelegation() {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-add-order');
    if (!btn) return;
    
    // Check which card it belongs to
    const card = btn.closest('.menu-card');
    if (card && card.classList.contains('card-original')) {
      window.selectVariant('original');
    } else if (card && card.classList.contains('card-cheese')) {
      window.selectVariant('cheese');
    } else if (btn.textContent.toLowerCase().includes('original')) {
      window.selectVariant('original');
    } else if (btn.textContent.toLowerCase().includes('keju') || btn.textContent.toLowerCase().includes('cheese')) {
      window.selectVariant('cheese');
    }
  });
}

// ==========================================================================
// 2. Quantity Controls (+ / -) in Pre-order Form
// ==========================================================================
function initQuantityControls() {
  const btnOriginalMinus = document.getElementById('btn-original-minus');
  const btnOriginalPlus = document.getElementById('btn-original-plus');
  const btnCheeseMinus = document.getElementById('btn-cheese-minus');
  const btnCheesePlus = document.getElementById('btn-cheese-plus');

  if (btnOriginalMinus) {
    btnOriginalMinus.addEventListener('click', () => {
      if (originalQty > 0) {
        originalQty--;
        updateQuantityDisplay();
      }
    });
  }

  if (btnOriginalPlus) {
    btnOriginalPlus.addEventListener('click', () => {
      if (originalQty < 25) {
        originalQty++;
        updateQuantityDisplay();
      }
    });
  }

  if (btnCheeseMinus) {
    btnCheeseMinus.addEventListener('click', () => {
      if (cheeseQty > 0) {
        cheeseQty--;
        updateQuantityDisplay();
      }
    });
  }

  if (btnCheesePlus) {
    btnCheesePlus.addEventListener('click', () => {
      if (cheeseQty < 25) {
        cheeseQty++;
        updateQuantityDisplay();
      }
    });
  }
}

// ==========================================================================
// 3. Burger Menu & Navbar Scroll
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
// 4. Pre-order Form Logics & Single-Page Transition
// ==========================================================================
function initFormListeners() {
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
      const selectedRadio = document.querySelector('input[name="user-role"]:checked');
      const selectedRole = selectedRadio ? selectedRadio.value : 'Siswa';
      const isOtherRole = selectedRole === 'Lainnya';

      if (isOtherRole) {
        otherRoleContainer.classList.add('active');
        if (inputOtherRole) inputOtherRole.setAttribute('required', 'true');
      } else {
        otherRoleContainer.classList.remove('active');
        if (inputOtherRole) {
          inputOtherRole.removeAttribute('required');
          inputOtherRole.value = '';
        }
      }

      if (selectedRole === 'Siswa') {
        classContainer.classList.add('active');
        if (inputClass) inputClass.setAttribute('required', 'true');
      } else {
        classContainer.classList.remove('active');
        if (inputClass) {
          inputClass.removeAttribute('required');
          inputClass.value = '';
        }
      }
    });
  });

  // Next Button Trigger -> Transisi ke Ringkasan Saja (Elemen lain menghilang)
  const btnNextOrder = document.getElementById('btn-next-order');
  if (btnNextOrder) {
    btnNextOrder.addEventListener('click', (e) => {
      e.preventDefault();

      const name = inputName ? inputName.value.trim() : '';
      const selectedRadio = document.querySelector('input[name="user-role"]:checked');
      const selectedRole = selectedRadio ? selectedRadio.value : 'Siswa';
      const otherRoleVal = inputOtherRole ? inputOtherRole.value.trim() : '';
      const role = selectedRole === 'Lainnya' ? otherRoleVal : selectedRole;
      const classRoom = (role === 'Siswa' && inputClass) ? inputClass.value.trim() : '-';
      const notes = inputNotes ? inputNotes.value.trim() : '';

      if (!name) {
        showToast('Data Kurang', 'Silakan isi nama lengkap Anda terlebih dahulu.', 'error');
        if (inputName) inputName.focus();
        return;
      }

      if (selectedRole === 'Siswa' && !classRoom) {
        showToast('Data Kurang', 'Siswa wajib mengisi kelas Anda.', 'error');
        if (inputClass) inputClass.focus();
        return;
      }

      if (selectedRole === 'Lainnya' && !role) {
        showToast('Data Kurang', 'Silakan sebutkan status Anda di sekolah.', 'error');
        if (inputOtherRole) inputOtherRole.focus();
        return;
      }

      if (originalQty + cheeseQty <= 0) {
        showToast('Porsi Kosong', 'Silakan pilih minimal 1 porsi Batagor (Original / Keju).', 'error');
        const selector = document.querySelector('.variant-card-selector');
        if (selector) selector.scrollIntoView({ behavior: 'smooth', block: 'center' });
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

// ==========================================================================
// 5. Render Dedicated Summary & Screen Transition
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
    btnConfirmWA.addEventListener('click', () => {
      btnConfirmWA.disabled = true;
      btnConfirmWA.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Membuka WhatsApp...';

      // Simpan riwayat pesanan ke localStorage (sinkron, cepat)
      let ordersList = JSON.parse(localStorage.getItem('batagor_orders')) || [];
      ordersList.unshift(order);
      localStorage.setItem('batagor_orders', JSON.stringify(ordersList));

      // Simpan ke Firestore di background — TIDAK ditunggu agar cepat
      saveOrderToFirestore(order);

      const waText = constructWhatsAppMessage(order);
      const waUrl = buildWhatsAppUrl(waText);

      // Buka WA langsung (tab baru), tetap di halaman ringkasan
      const newTab = window.open(waUrl, '_blank');
      if (!newTab || newTab.closed || typeof newTab.closed === 'undefined') {
        // Popup diblokir: fallback langsung redirect
        window.location.href = waUrl;
        return;
      }

      showToast('Pesanan Terkirim!', 'Membuka WhatsApp di tab baru...', 'success');

      // Setelah WA terbuka, kembali ke halaman utama setelah jeda singkat
      setTimeout(() => {
        resetPreorderForm();
        exitCheckoutView();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 1200);
    });
  }

  // Simpan draft ke sessionStorage (backup untuk ringkasan.html standalone)
  sessionStorage.setItem('batagor_draft_order', JSON.stringify(order));

  // Aktifkan mode layar ringkasan (hilangkan elemen lain dengan transisi mulus)
  document.body.classList.add('checkout-active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetPreorderForm() {
  const inputName = document.getElementById('input-name');
  const inputClass = document.getElementById('input-class');
  const inputOtherRole = document.getElementById('input-other-role');
  const inputNotes = document.getElementById('input-notes');
  const radioSiswa = document.getElementById('role-siswa');
  const otherRoleContainer = document.getElementById('other-role-input-container');
  const classContainer = document.getElementById('class-input-container');

  if (inputName) inputName.value = '';
  if (inputClass) inputClass.value = '';
  if (inputOtherRole) inputOtherRole.value = '';
  if (inputNotes) inputNotes.value = '';
  if (radioSiswa) radioSiswa.checked = true;

  if (otherRoleContainer) otherRoleContainer.classList.remove('active');
  if (classContainer) classContainer.classList.add('active');

  originalQty = 0;
  cheeseQty = 0;
  updateQuantityDisplay();

  sessionStorage.removeItem('batagor_draft_order');
  localStorage.removeItem('batagor_draft_order');
}

function exitCheckoutView() {
  document.body.classList.remove('checkout-active');
  const section = document.getElementById('hero') || document.getElementById('preorder');
  if (section) {
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

// ==========================================================================
// 6. Secret Admin Access Trigger
// ==========================================================================
function initSecretAdminTrigger() {
  const secretBtn = document.getElementById('admin-secret-btn');
  if (!secretBtn) return;
  secretBtn.addEventListener('click', () => {
    window.location.href = 'pages/admin/admin.html';
  });
}

// ==========================================================================
// 7. Toast Notification System
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
