// ==========================================================================
// DAPUR BATAGOR - PRE-ORDER LOGICAL SYSTEM (JS)
// Includes Real-time billing, WhatsApp formatting, and LocalStorage admin log.
// ==========================================================================

// Global state variables
let cheeseQty = 0;
let merconQty = 0;
const ITEM_PRICE = 15000; // Rp 15.000 per portion for both variants

// Target Seller WA Number (stored in LocalStorage or defaults)
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

// Orders log state
let ordersList = JSON.parse(localStorage.getItem('batagor_orders')) || [];

// DOM Element Selections
document.addEventListener('DOMContentLoaded', () => {
  // Init features
  initTheme();
  initBurgerMenu();
  initFormListeners();
  initSecretAdminTrigger();
});

// ==========================================================================
// 1. Theme Configuration (Dark / Light)
// ==========================================================================
function initTheme() {
  const themeToggle = document.getElementById('theme-toggle');
  const themeIcon = document.getElementById('theme-icon');

  // Set default theme or saved theme
  const savedTheme = localStorage.getItem('site_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme, themeIcon);

  themeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('site_theme', newTheme);
    updateThemeIcon(newTheme, themeIcon);
    showToast('Theme Changed', `Switched to ${newTheme} mode!`, 'success');
  });
}

function updateThemeIcon(theme, iconEl) {
  if (theme === 'dark') {
    iconEl.className = 'fa-solid fa-sun';
  } else {
    iconEl.className = 'fa-solid fa-moon';
  }
}

// ==========================================================================
// 2. Burger Menu (Mobile Nav)
// ==========================================================================
function initBurgerMenu() {
  const burger = document.getElementById('burger-menu');
  const navLinks = document.getElementById('nav-links');

  burger.addEventListener('click', () => {
    navLinks.classList.toggle('active');
    burger.classList.toggle('active');
  });

  // Close nav on click links
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('active');
      burger.classList.remove('active');
    });
  });

  // Navbar blur background on scroll
  const navbar = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }

    // Auto active link tracking based on scroll
    updateActiveLinkOnScroll();
  });
}

function updateActiveLinkOnScroll() {
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

// ==========================================================================
// 3. Pre-order Form Logics & Calculations
// ==========================================================================
function initFormListeners() {
  const inputName = document.getElementById('input-name');
  const inputClass = document.getElementById('input-class');
  const classContainer = document.getElementById('class-input-container');
  const inputNotes = document.getElementById('input-notes');

  const radioSiswa = document.getElementById('role-siswa');
  const radioGuru = document.getElementById('role-guru');
  const radioStaf = document.getElementById('role-staf');

  // Preview elements
  const previewName = document.getElementById('preview-name');
  const previewRole = document.getElementById('preview-role');
  const previewClass = document.getElementById('preview-class');
  const previewClassRow = document.getElementById('preview-class-row');

  // Role radio toggle listener
  const roles = [radioSiswa, radioGuru, radioStaf];
  roles.forEach(radio => {
    radio.addEventListener('change', () => {
      const selectedRole = document.querySelector('input[name="user-role"]:checked').value;
      previewRole.textContent = selectedRole;

      if (selectedRole === 'Siswa') {
        classContainer.classList.add('active');
        inputClass.setAttribute('required', 'true');
        previewClassRow.style.display = 'flex';
        updateClassPreview();
      } else {
        classContainer.classList.remove('active');
        inputClass.removeAttribute('required');
        previewClassRow.style.display = 'none';
        inputClass.value = '';
      }
      validateCheckoutButton();
    });
  });

  // Input value change preview updates
  inputName.addEventListener('input', () => {
    previewName.textContent = inputName.value.trim() || '-';
    validateCheckoutButton();
  });

  inputClass.addEventListener('input', updateClassPreview);

  function updateClassPreview() {
    previewClass.textContent = inputClass.value.trim() || '-';
    validateCheckoutButton();
  }

  // Quantity Counter Buttons Configuration
  // Cheese
  const btnCheeseMinus = document.getElementById('btn-cheese-minus');
  const btnCheesePlus = document.getElementById('btn-cheese-plus');
  const valCheeseQty = document.getElementById('val-cheese-qty');

  btnCheeseMinus.addEventListener('click', () => {
    if (cheeseQty > 0) {
      cheeseQty--;
      valCheeseQty.textContent = cheeseQty;
      updateOrderSummary();
    }
  });

  btnCheesePlus.addEventListener('click', () => {
    if (cheeseQty < 25) {
      cheeseQty++;
      valCheeseQty.textContent = cheeseQty;
      updateOrderSummary();
    }
  });

  // Mercon
  const btnMerconMinus = document.getElementById('btn-mercon-minus');
  const btnMerconPlus = document.getElementById('btn-mercon-plus');
  const valMerconQty = document.getElementById('val-mercon-qty');

  btnMerconMinus.addEventListener('click', () => {
    if (merconQty > 0) {
      merconQty--;
      valMerconQty.textContent = merconQty;
      updateOrderSummary();
    }
  });

  btnMerconPlus.addEventListener('click', () => {
    if (merconQty < 25) {
      merconQty++;
      valMerconQty.textContent = merconQty;
      updateOrderSummary();
    }
  });

  // Main Submit pre-order checkout trigger
  const btnSubmitOrder = document.getElementById('btn-submit-order');
  btnSubmitOrder.addEventListener('click', () => {
    // Form and Qty verification before submit
    const name = inputName.value.trim();
    const role = document.querySelector('input[name="user-role"]:checked').value;
    const classRoom = role === 'Siswa' ? inputClass.value.trim() : '-';
    const notes = inputNotes.value.trim();

    if (!name) {
      showToast('Data Kurang', 'Silakan isi nama Anda terlebih dahulu.', 'error');
      inputName.focus();
      return;
    }
    if (role === 'Siswa' && !classRoom) {
      showToast('Data Kurang', 'Siswa wajib mengisi kelas.', 'error');
      inputClass.focus();
      return;
    }
    if (cheeseQty + merconQty <= 0) {
      showToast('Item Kosong', 'Silakan pilih minimal 1 porsi Batagor.', 'error');
      return;
    }

    // Process order save and redirect
    const totalCost = (cheeseQty + merconQty) * ITEM_PRICE;
    const timestamp = Date.now();
    const dateFormatted = getFormattedDate();

    // Create Order Object
    const newOrder = {
      id: timestamp,
      name: name,
      role: role,
      classRoom: classRoom,
      cheese: cheeseQty,
      mercon: merconQty,
      total: totalCost,
      notes: notes || '-',
      date: dateFormatted,
      status: 'Pending'
    };

    // Save order in local database
    ordersList.unshift(newOrder);
    localStorage.setItem('batagor_orders', JSON.stringify(ordersList));

    // Buka WhatsApp langsung ke nomor penjual dengan pesan sudah terisi
    const waMessageText = constructWhatsAppMessage(newOrder);
    const waUrl = buildWhatsAppUrl(waMessageText);

    window.location.href = waUrl;
  });
}

// Global variant select helper called directly from Menu cards
window.selectVariant = function (type) {
  const section = document.getElementById('preorder');
  section.scrollIntoView({ behavior: 'smooth' });

  if (type === 'cheese') {
    cheeseQty++;
    document.getElementById('val-cheese-qty').textContent = cheeseQty;
  } else if (type === 'mercon') {
    merconQty++;
    document.getElementById('val-mercon-qty').textContent = merconQty;
  }
  updateOrderSummary();
  showToast('Item Ditambahkan', `Varian Batagor ${type === 'cheese' ? 'Cheese' : 'Mercon'} dimasukkan ke form pre-order.`, 'success');
};

// Reset preorder form data back to default states
function resetPreorderForm() {
  document.getElementById('input-name').value = '';
  document.getElementById('input-class').value = '';
  document.getElementById('input-notes').value = '';

  document.getElementById('role-siswa').checked = true;
  document.getElementById('class-input-container').classList.add('active');
  document.getElementById('input-class').setAttribute('required', 'true');
  document.getElementById('preview-class-row').style.display = 'flex';

  cheeseQty = 0;
  merconQty = 0;
  document.getElementById('val-cheese-qty').textContent = '0';
  document.getElementById('val-mercon-qty').textContent = '0';

  document.getElementById('preview-name').textContent = '-';
  document.getElementById('preview-class').textContent = '-';
  document.getElementById('preview-role').textContent = 'Siswa';

  updateOrderSummary();
}

// Live calculation & details render of selected items
function updateOrderSummary() {
  const summaryList = document.getElementById('summary-items-list');
  const summaryTotal = document.getElementById('summary-total-price');

  // Update minus buttons status
  document.getElementById('btn-cheese-minus').disabled = cheeseQty <= 0;
  document.getElementById('btn-mercon-minus').disabled = merconQty <= 0;

  summaryList.innerHTML = '';
  let subtotalText = '';

  if (cheeseQty === 0 && merconQty === 0) {
    summaryList.innerHTML = `
      <div style="text-align: center; color: var(--text-muted); font-size: 0.9rem; padding: 1rem 0;">
        Belum ada item terpilih. Silakan klik + pada varian batagor.
      </div>
    `;
  } else {
    if (cheeseQty > 0) {
      subtotalText += `
        <div class="summary-item subtotal">
          <span>${cheeseQty}x Batagor Cheese</span>
          <span>Rp ${(cheeseQty * ITEM_PRICE).toLocaleString('id-ID')}</span>
        </div>
      `;
    }
    if (merconQty > 0) {
      subtotalText += `
        <div class="summary-item subtotal">
          <span>${merconQty}x Batagor Mercon</span>
          <span>Rp ${(merconQty * ITEM_PRICE).toLocaleString('id-ID')}</span>
        </div>
      `;
    }
    summaryList.innerHTML = subtotalText;
  }

  const total = (cheeseQty + merconQty) * ITEM_PRICE;
  summaryTotal.textContent = `Rp ${total.toLocaleString('id-ID')}`;

  validateCheckoutButton();
}

// Form validation criteria checker
function validateCheckoutButton() {
  const nameVal = document.getElementById('input-name').value.trim();
  const roleVal = document.querySelector('input[name="user-role"]:checked').value;
  const classVal = document.getElementById('input-class').value.trim();
  const totalItems = cheeseQty + merconQty;

  const btnSubmit = document.getElementById('btn-submit-order');

  let isValid = true;

  if (!nameVal) isValid = false;
  if (roleVal === 'Siswa' && !classVal) isValid = false;
  if (totalItems <= 0) isValid = false;

  btnSubmit.disabled = !isValid;
}

// Helper date time stamp formatter
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

// Formulate formatted message text block for WhatsApp redirection API
function constructWhatsAppMessage(order) {
  let itemsBreakdown = '';
  if (order.cheese > 0) {
    itemsBreakdown += `- *${order.cheese} porsi* Batagor Cheese (Rp ${(order.cheese * ITEM_PRICE).toLocaleString('id-ID')})\n`;
  }
  if (order.mercon > 0) {
    itemsBreakdown += `- *${order.mercon} porsi* Batagor Mercon (Rp ${(order.mercon * ITEM_PRICE).toLocaleString('id-ID')})\n`;
  }

  const classLine = order.role === 'Siswa' ? `*Kelas:* ${order.classRoom}\n` : '';

  return `*PRE-ORDER BATAGOR JOSHUA* 🥟
--------------------------------------------
*Nama:* ${order.name}
*Status:* ${order.role}
${classLine}--------------------------------------------
*Rincian Pesanan:*
${itemsBreakdown}
*Catatan:* ${order.notes}
--------------------------------------------
*Total Tagihan:* Rp ${order.total.toLocaleString('id-ID')}
--------------------------------------------
_Mohon konfirmasi pesanan Anda dengan mengirim pesan ini. Terima kasih!_ 🙏`;
}

// ==========================================================================
// 4. Secret Admin Access Trigger (ikon tersembunyi + modal password)
// ==========================================================================
const ADMIN_PASSWORDS = ['admin', 'joshua'];

function initSecretAdminTrigger() {
  const secretBtn = document.getElementById('admin-secret-btn');
  const gateModal = document.getElementById('admin-gate-modal');
  const gateForm = document.getElementById('admin-gate-form');
  const gatePassword = document.getElementById('admin-gate-password');
  const btnCloseGate = document.getElementById('btn-close-admin-gate');

  if (!secretBtn || !gateModal || !gateForm) return;

  const openGateModal = () => {
    gateModal.classList.add('active');
    gatePassword.value = '';
    setTimeout(() => gatePassword.focus(), 100);
  };

  const closeGateModal = () => {
    gateModal.classList.remove('active');
    gatePassword.value = '';
  };

  secretBtn.addEventListener('click', openGateModal);

  btnCloseGate.addEventListener('click', closeGateModal);

  gateModal.addEventListener('click', (e) => {
    if (e.target === gateModal) closeGateModal();
  });

  gateForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const password = gatePassword.value.trim();

    if (ADMIN_PASSWORDS.includes(password)) {
      sessionStorage.setItem('is_admin', 'true');
      closeGateModal();
      showToast('Akses Diterima', 'Mengalihkan ke dashboard penjual...', 'success');
      setTimeout(() => {
        window.location.href = 'admin.html';
      }, 800);
    } else {
      showToast('Akses Ditolak', 'Kata sandi salah!', 'error');
      gatePassword.value = '';
      gatePassword.focus();
    }
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


