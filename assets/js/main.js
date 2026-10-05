// ========================================================================
// DAPUR BATAGOR - PRE-ORDER LOGICAL SYSTEM (JS)
// Includes real-time validation, variant counters, and redirect to dedicated summary page.
// ==========================================================================

// Global state variables
let originalQty = 0;
let cheeseQty = 0;
const ITEM_PRICE = 15000; // Rp 15.000 per portion for both variants

// DOM Element Selections
document.addEventListener('DOMContentLoaded', () => {
  // Init features
  initBurgerMenu();
  initFormListeners();
  initSecretAdminTrigger();
  restoreDraftIfPresent();
});

// ==========================================================================
// 1. Burger Menu (Mobile Nav)
// ==========================================================================
function initBurgerMenu() {
  const burger = document.getElementById('burger-menu');
  const navLinks = document.getElementById('nav-links');

  if (burger && navLinks) {
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
  }

  // Navbar blur background on scroll
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
// 2. Pre-order Form Logics & Multi-Page Redirect
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

  // Role radio toggle listener
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

  // Quantity Counter Buttons Configuration
  // Original
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

  // Cheese
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

  // Next Button -> Alihkan ke Halaman Khusus Ringkasan
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
        showToast('Porsi Kosong', 'Silakan pilih minimal 1 porsi Batagor (Original / Keju).', 'error');
        return;
      }

      // Siapkan draft pesanan
      const draftOrder = {
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

      // Simpan ke storage untuk diambil oleh ringkasan.html
      sessionStorage.setItem('batagor_draft_order', JSON.stringify(draftOrder));
      localStorage.setItem('batagor_draft_order', JSON.stringify(draftOrder));

      // Berikan efek transisi sebelum beralih
      btnNextOrder.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menyiapkan Ringkasan...';
      btnNextOrder.disabled = true;

      setTimeout(() => {
        window.location.href = 'ringkasan.html';
      }, 350);
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

// Restore data jika user kembali dari halaman ringkasan untuk mengedit
function restoreDraftIfPresent() {
  const rawDraft = sessionStorage.getItem('batagor_draft_order') || localStorage.getItem('batagor_draft_order');
  if (!rawDraft) return;

  try {
    const draft = JSON.parse(rawDraft);
    if (!draft) return;

    const inputName = document.getElementById('input-name');
    const inputClass = document.getElementById('input-class');
    const inputOtherRole = document.getElementById('input-other-role');
    const inputNotes = document.getElementById('input-notes');

    if (inputName && draft.name) inputName.value = draft.name;
    if (inputNotes && draft.notes && draft.notes !== '-') inputNotes.value = draft.notes;

    if (draft.role === 'Siswa') {
      const radioSiswa = document.getElementById('role-siswa');
      if (radioSiswa) radioSiswa.checked = true;
      if (inputClass && draft.classRoom && draft.classRoom !== '-') {
        inputClass.value = draft.classRoom;
      }
    } else if (draft.role === 'Guru') {
      const radioGuru = document.getElementById('role-guru');
      if (radioGuru) radioGuru.checked = true;
      const classContainer = document.getElementById('class-input-container');
      if (classContainer) classContainer.classList.remove('active');
    } else if (draft.role === 'Staf / Karyawan') {
      const radioStaf = document.getElementById('role-staf');
      if (radioStaf) radioStaf.checked = true;
      const classContainer = document.getElementById('class-input-container');
      if (classContainer) classContainer.classList.remove('active');
    } else if (draft.role) {
      const radioLainnya = document.getElementById('role-lainnya');
      if (radioLainnya) radioLainnya.checked = true;
      const otherContainer = document.getElementById('other-role-input-container');
      if (otherContainer) otherContainer.classList.add('active');
      if (inputOtherRole) inputOtherRole.value = draft.role;
      const classContainer = document.getElementById('class-input-container');
      if (classContainer) classContainer.classList.remove('active');
    }

    if (draft.original) {
      originalQty = Number(draft.original);
      const valOriginal = document.getElementById('val-original-qty');
      const btnOriginalMinus = document.getElementById('btn-original-minus');
      if (valOriginal) valOriginal.textContent = originalQty;
      if (btnOriginalMinus) btnOriginalMinus.disabled = originalQty <= 0;
    }

    if (draft.cheese) {
      cheeseQty = Number(draft.cheese);
      const valCheese = document.getElementById('val-cheese-qty');
      const btnCheeseMinus = document.getElementById('btn-cheese-minus');
      if (valCheese) valCheese.textContent = cheeseQty;
      if (btnCheeseMinus) btnCheeseMinus.disabled = cheeseQty <= 0;
    }
  } catch (e) {
    console.warn('Failed restoring draft order', e);
  }
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

// ==========================================================================
// 3. Secret Admin Access Trigger
// ==========================================================================
function initSecretAdminTrigger() {
  const secretBtn = document.getElementById('admin-secret-btn');
  if (!secretBtn) return;
  secretBtn.addEventListener('click', () => {
    window.location.href = 'pages/admin/admin.html';
  });
}

// ==========================================================================
// 4. Toast Notification System
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
