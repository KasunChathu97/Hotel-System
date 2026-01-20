let ingredientHistory = JSON.parse(localStorage.getItem('ingredientHistory')) || [];

let bookingHistory = JSON.parse(localStorage.getItem('bookingHistory')) || [];

let rooms = JSON.parse(localStorage.getItem('rooms')) || [
    { id: 1, price: 4000, booked: false, customer: null },
    { id: 2, price: 4500, booked: false, customer: null },
    { id: 3, price: 5000, booked: false, customer: null },
    { id: 4, price: 5500, booked: false, customer: null },
    { id: 5, price: 6000, booked: false, customer: null },
];

let ingredients = JSON.parse(localStorage.getItem('ingredients')) || {};

let income = JSON.parse(localStorage.getItem('income')) || [];

let messageTimeoutId = null;

let editingReservationIndex = null;

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"]/g, c => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;'
    }[c]));
}

function formatDateTime(value) {
    if (!value) return '';
    const d = new Date(value);
    if (!isNaN(d)) return d.toLocaleString();
    // Fallback: if it's already a display string, show it as-is
    return String(value);
}

function getNextBookingId() {
    const key = 'bookingIdCounter';
    const current = parseInt(localStorage.getItem(key) || '0', 10);
    const next = Number.isFinite(current) ? current + 1 : 1;
    localStorage.setItem(key, String(next));
    return `B-${String(next).padStart(6, '0')}`;
}

function pad2(n) {
    return String(n).padStart(2, '0');
}

function toLocalDateInputValue(dateObj) {
    const d = new Date(dateObj);
    if (isNaN(d)) return '';
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function toLocalTimeInputValue(dateObj) {
    const d = new Date(dateObj);
    if (isNaN(d)) return '';
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function setFlashMessage(msg, color = 'green') {
    try {
        sessionStorage.setItem('flashMessage', JSON.stringify({ msg, color }));
    } catch {
        // ignore
    }
}

function consumeFlashMessage() {
    try {
        const raw = sessionStorage.getItem('flashMessage');
        if (!raw) return;
        sessionStorage.removeItem('flashMessage');
        const payload = JSON.parse(raw);
        if (payload?.msg) showMessage(payload.msg, payload.color || 'green');
    } catch {
        // ignore
    }
}

function getOrCreateMessageDiv() {
    let messageDiv = document.getElementById('message');
    if (messageDiv) return messageDiv;

    messageDiv = document.createElement('div');
    messageDiv.id = 'message';
    messageDiv.className = 'message';

    const navbarMount = document.getElementById('navbar');
    if (navbarMount) {
        navbarMount.insertAdjacentElement('afterend', messageDiv);
    } else {
        document.body.insertAdjacentElement('afterbegin', messageDiv);
    }

    return messageDiv;
}

function showMessage(msg, color = "green") {
    const messageDiv = getOrCreateMessageDiv();
    messageDiv.style.color = color;
    messageDiv.textContent = msg;

    if (messageTimeoutId) {
        clearTimeout(messageTimeoutId);
    }
    messageTimeoutId = setTimeout(() => {
        messageDiv.textContent = '';
        messageTimeoutId = null;
    }, 5000); // disappears after 5 seconds
}

function isRoomAvailable(roomId, time = new Date()) {
    return !bookingHistory.some(b =>
        b.room === roomId &&
        b.type === "RESERVE" &&
        time >= new Date(b.checkIn) &&
        time <= new Date(b.checkOut)
    );
}

function saveData() {
    localStorage.setItem('rooms', JSON.stringify(rooms));
    localStorage.setItem('ingredients', JSON.stringify(ingredients));
    localStorage.setItem('income', JSON.stringify(income));
    localStorage.setItem('ingredientHistory', JSON.stringify(ingredientHistory));
    localStorage.setItem('bookingHistory', JSON.stringify(bookingHistory));
}

function initEditBookingPage() {
    const form = document.getElementById('editBookingForm');
    if (!form) return;

    const indexEl = document.getElementById('editBookingIndex');
    const nameEl = document.getElementById('editCustomerName');
    const customerIdEl = document.getElementById('editCustomerId');
    const roomEl = document.getElementById('editRoomNumber');
    const dateEl = document.getElementById('editDate');
    const startEl = document.getElementById('editStartTime');

    const params = new URLSearchParams(window.location.search);
    const indexRaw = params.get('index');
    const index = indexRaw != null ? parseInt(indexRaw, 10) : NaN;
    if (!Number.isFinite(index)) {
        showMessage('Invalid edit link', 'red');
        return;
    }

    const b = bookingHistory[index];
    if (!b) {
        showMessage('Booking not found', 'red');
        return;
    }

    if (b.type !== 'RESERVE') {
        showMessage('Only RESERVE entries can be edited', 'red');
        return;
    }

    if (indexEl) indexEl.value = String(index);
    if (nameEl) nameEl.value = b.customer || '';
    if (customerIdEl) customerIdEl.value = b.customerId || '';

    if (roomEl) {
        roomEl.innerHTML = '<option value="">Select Room Number</option>';
        rooms.forEach(r => {
            const opt = document.createElement('option');
            opt.value = String(r.id);
            opt.textContent = `Room ${r.id}`;
            roomEl.appendChild(opt);
        });
        roomEl.value = String(b.room ?? '');
    }

    if (b.checkIn) {
        const inDt = new Date(b.checkIn);
        if (!isNaN(inDt)) {
            if (dateEl) dateEl.value = toLocalDateInputValue(inDt);
            if (startEl) startEl.value = toLocalTimeInputValue(inDt);
        }
    }

    // End Time removed from the form.
}

function saveEditedBooking() {
    const indexEl = document.getElementById('editBookingIndex');
    const nameEl = document.getElementById('editCustomerName');
    const customerIdEl = document.getElementById('editCustomerId');
    const roomEl = document.getElementById('editRoomNumber');
    const dateEl = document.getElementById('editDate');
    const startEl = document.getElementById('editStartTime');

    const index = indexEl?.value != null ? parseInt(indexEl.value, 10) : NaN;
    if (!Number.isFinite(index)) {
        showMessage('Invalid booking index', 'red');
        return;
    }

    const existing = bookingHistory[index];
    if (!existing || existing.type !== 'RESERVE') {
        showMessage('Booking not found', 'red');
        return;
    }

    const name = (nameEl?.value || '').trim();
    const customerId = (customerIdEl?.value || '').trim();
    const roomId = parseInt(roomEl?.value || '', 10);
    const date = dateEl?.value;
    const start = startEl?.value;

    if (!name || !customerId || !Number.isFinite(roomId) || !date || !start) {
        showMessage('Please fill all fields', 'red');
        return;
    }

    const inTime = new Date(`${date}T${start}`);
    // Default stay duration: 24 hours (no End Time entry)
    const outTime = new Date(inTime.getTime() + 24 * 60 * 60 * 1000);
    if (isNaN(inTime) || isNaN(outTime)) {
        showMessage('Invalid date/time', 'red');
        return;
    }

    const conflict = bookingHistory.some((b, idx) =>
        idx !== index &&
        b &&
        b.type === 'RESERVE' &&
        b.room === roomId &&
        (
            inTime < new Date(b.checkOut) &&
            outTime > new Date(b.checkIn)
        )
    );

    if (conflict) {
        showMessage('This room is already reserved for the selected date/time', 'red');
        return;
    }

    bookingHistory[index] = {
        ...existing,
        room: roomId,
        customer: name,
        customerId,
        checkIn: inTime.toISOString(),
        checkOut: outTime.toISOString(),
    };

    saveData();
    setFlashMessage('Reservation updated successfully');
    window.location.href = 'room.html';
}

function loadRooms() {
    const roomDiv = document.getElementById('rooms');
    const roomSelect = document.getElementById('roomSelect');
    const roomNumberSelect = document.getElementById('room-number');
    const checkoutSelect = document.getElementById('checkoutRoom');
    const availabilityDateEl = document.getElementById('availabilityDate');
    const availabilityLabelEl = document.getElementById('availabilityLabel');

    if (!roomDiv && !roomSelect && !roomNumberSelect && !checkoutSelect) return;

    if (roomDiv) {
        roomDiv.innerHTML = '';
        roomDiv.classList.add('room-list');
    }
    if (roomSelect) roomSelect.innerHTML = '';
    if (roomNumberSelect) roomNumberSelect.innerHTML = '<option value="">Select Room Number</option>';
    if (checkoutSelect) checkoutSelect.innerHTML = '';

    const now = new Date();
    const todayISO = now.toISOString().slice(0, 10);
    let dateStr = availabilityDateEl?.value;

    // Disallow past dates in the picker
    if (availabilityDateEl) {
        availabilityDateEl.min = todayISO;
    }

    // Some browsers/edits can leave an invalid sentinel like 0001-01-01.
    if (dateStr === '0001-01-01') {
        dateStr = '';
    }

    // Default to today's date on first load if empty.
    if (availabilityDateEl && !dateStr) {
        availabilityDateEl.value = todayISO;
        dateStr = todayISO;
    }

    // If a past date is somehow set, force it back to today.
    if (availabilityDateEl && dateStr && dateStr < todayISO) {
        availabilityDateEl.value = todayISO;
        dateStr = todayISO;
    }

    // If a date is selected, we check the whole day window (00:00 → 23:59)
    let windowStart = now;
    let windowEnd = now;
    if (dateStr) {
        windowStart = new Date(`${dateStr}T00:00:00`);
        windowEnd = new Date(`${dateStr}T23:59:59.999`);

        if (isNaN(windowStart) || isNaN(windowEnd)) {
            if (availabilityDateEl) availabilityDateEl.value = todayISO;
            windowStart = new Date(`${todayISO}T00:00:00`);
            windowEnd = new Date(`${todayISO}T23:59:59.999`);
        }

        if (availabilityLabelEl) {
            availabilityLabelEl.textContent = `Showing availability for: ${windowStart.toLocaleDateString()}`;
        }
    } else {
        if (availabilityLabelEl) {
            availabilityLabelEl.textContent = '';
        }
    }

    rooms.forEach(room => {
        const conflicts = bookingHistory
            .filter(b => b.room === room.id && b.type === "RESERVE")
            .filter(b => {
                const inTime = new Date(b.checkIn);
                const outTime = new Date(b.checkOut);
                return inTime < windowEnd && outTime > windowStart;
            })
            .sort((a, b) => new Date(a.checkIn) - new Date(b.checkIn));

        const available = conflicts.length === 0;
        const activeBooking = conflicts[0];

        const untilText = (!available && activeBooking?.checkOut)
            ? `until ${new Date(activeBooking.checkOut).toLocaleString()}`
            : '';

        if (roomDiv) {
            roomDiv.innerHTML += `
                <div class="room-item ${available ? 'room-item--available' : 'room-item--occupied'}">
                    <div class="room-item__title">Room ${room.id}</div>
                    <div class="room-item__meta">
                        <span class="badge ${available ? 'badge--available' : 'badge--occupied'}">${available ? 'Available' : 'Occupied'}</span>
                        ${untilText ? `<span class="room-item__detail">${untilText}</span>` : ''}
                    </div>
                </div>
            `;
        }

        // ✅ Allow reservation ONLY if available
        if (available) {
            if (roomSelect) {
                roomSelect.innerHTML += `<option value="${room.id}">Room ${room.id}</option>`;
            }
            if (roomNumberSelect) {
                roomNumberSelect.innerHTML += `<option value="${room.id}">Room ${room.id}</option>`;
            }
        }

        // ✅ Allow checkout ONLY if currently occupied (right now)
        const occupiedNow = bookingHistory.some(b =>
            b.room === room.id &&
            b.type === "RESERVE" &&
            now >= new Date(b.checkIn) &&
            now <= new Date(b.checkOut)
        );

        if (checkoutSelect && occupiedNow) {
            checkoutSelect.innerHTML += `<option value="${room.id}">Room ${room.id}</option>`;
        }
    });
}

function showRoomBookingHistory() {
    const table = document.getElementById('roomBookingHistory');
    if (!table) return;

    const emptyEl = document.getElementById('roomBookingHistoryEmpty');
    const tbody = table.querySelector('tbody') || table.appendChild(document.createElement('tbody'));
    tbody.innerHTML = '';
    if (emptyEl) emptyEl.textContent = '';

    const checkedOut = bookingHistory
        .map((b, index) => ({ b, index }))
        .filter(({ b }) => b && b.type === 'CHECKOUT')
        .sort((a, b) => {
            const aId = String(a.b.bookingId || '').trim();
            const bId = String(b.b.bookingId || '').trim();

            // Missing IDs go to the end.
            if (!aId && !bId) return 0;
            if (!aId) return 1;
            if (!bId) return -1;

            // Numeric-aware ordering (covers legacy formats too).
            const aNumMatch = aId.match(/\d+/);
            const bNumMatch = bId.match(/\d+/);
            const aNum = aNumMatch ? parseInt(aNumMatch[0], 10) : NaN;
            const bNum = bNumMatch ? parseInt(bNumMatch[0], 10) : NaN;
            if (Number.isFinite(aNum) && Number.isFinite(bNum) && aNum !== bNum) {
                return aNum - bNum;
            }

            return aId.localeCompare(bId, undefined, { numeric: true, sensitivity: 'base' });
        });

    if (checkedOut.length === 0) {
        if (emptyEl) emptyEl.textContent = 'No checked-out rooms yet.';

        const prevBtn = document.getElementById('roomHistoryPrevBtn');
        const nextBtn = document.getElementById('roomHistoryNextBtn');
        const pageEl = document.getElementById('roomHistoryPageIndicator');
        if (prevBtn) prevBtn.disabled = true;
        if (nextBtn) nextBtn.disabled = true;
        if (pageEl) pageEl.textContent = '';

        return;
    }

    // Pagination (10 per page) for the standalone history page when buttons exist.
    const perPage = 10;
    const prevBtn = document.getElementById('roomHistoryPrevBtn');
    const nextBtn = document.getElementById('roomHistoryNextBtn');
    const pageEl = document.getElementById('roomHistoryPageIndicator');
    const usingPager = !!(prevBtn && nextBtn);

    const currentPage = usingPager ? (window.__roomHistoryPage || 0) : 0;
    const totalPages = Math.max(1, Math.ceil(checkedOut.length / perPage));
    const safePage = Math.min(Math.max(0, currentPage), totalPages - 1);
    if (usingPager) window.__roomHistoryPage = safePage;

    const start = safePage * perPage;
    const end = start + perPage;

    if (usingPager) {
        prevBtn.disabled = safePage <= 0;
        nextBtn.disabled = safePage >= totalPages - 1;
    }

    if (pageEl) {
        pageEl.textContent = `Page ${safePage + 1} of ${totalPages}`;
    }

    checkedOut.slice(start, end).forEach(({ b, index }) => {
        const actionHtml = `
            <div class="history-actions">
                <button type="button" class="history-action" onclick="viewBooking(${index})">View</button>
                <button type="button" class="history-action history-action--danger" onclick="deleteBooking(${index})">Delete</button>
            </div>
        `;

        tbody.innerHTML += `
            <tr>
                <td>${escapeHtml(b.bookingId || '')}</td>
                <td>${escapeHtml(b.room ?? '')}</td>
                <td>${escapeHtml(b.customer || '')}</td>
                <td>${escapeHtml(b.customerId || '')}</td>
                <td>${escapeHtml(formatDateTime(b.checkIn))}</td>
                <td>${escapeHtml(formatDateTime(b.checkOut))}</td>
                <td>${b.amount != null ? escapeHtml(`Rs.${b.amount}`) : ''}</td>
                <td>${actionHtml}</td>
            </tr>
        `;
    });
}

function changeRoomBookingHistoryPage(delta) {
    const next = (window.__roomHistoryPage || 0) + Number(delta || 0);
    window.__roomHistoryPage = Number.isFinite(next) ? next : 0;
    showRoomBookingHistory();
}

function clearRoomBookingHistory() {
    const modal = getOrCreateClearHistoryModal();
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
}

function confirmClearHistoryModal() {
    const before = bookingHistory.length;
    bookingHistory = bookingHistory.filter(b => !(b && b.type === 'CHECKOUT'));
    const removed = before - bookingHistory.length;

    window.__roomHistoryPage = 0;
    saveData();
    showRoomBookingHistory();
    showBookingHistory();
    showMessage(removed ? `Cleared ${removed} history record(s)` : 'No history records to clear');
    closeClearHistoryModal();
}

function closeClearHistoryModal() {
    const modal = document.getElementById('clearHistoryModal');
    if (!modal) return;
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
}

function getOrCreateClearHistoryModal() {
    let modal = document.getElementById('clearHistoryModal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'clearHistoryModal';
    modal.className = 'modal-overlay';
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = `
        <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="clearHistoryModalTitle">
            <div class="modal-header">
                <h3 id="clearHistoryModalTitle" class="modal-title" style="display:flex; justify-content:center; align-items:center; margin:auto;">Clear History</h3>
            </div>
            <div class="modal-body" style="text-align:center;">
                <p class="modal-text">Are you sure you want to clear all Room Booking History records? This cannot be undone.</p>
            </div>
            <div class="modal-actions modal-actions--center" style="display:flex; justify-content:center; gap:16px; margin-top:20px;">
                <button type="button" class="btn btn-secondary" style="min-width:100px;" onclick="closeClearHistoryModal()">Cancel</button>
                <button type="button" class="btn btn-danger" style="min-width:100px;" onclick="confirmClearHistoryModal()">Clear</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    return modal;
}

function checkoutBooking(index) {
    const activeBooking = bookingHistory[index];
    if (!activeBooking) return;
    if (activeBooking.type !== 'RESERVE') {
        showMessage('Only RESERVE entries can be checked out', 'red');
        return;
    }

    const now = new Date();
    const nowISO = now.toISOString();

    const inDt = new Date(activeBooking.checkIn);
    const outDt = new Date(activeBooking.checkOut);
    if (isNaN(inDt) || isNaN(outDt)) {
        showMessage('Invalid booking date/time', 'red');
        return;
    }

    if (!(now >= inDt && now <= outDt)) {
        showMessage('This booking is not active right now', 'red');
        return;
    }

    const ok = confirm(`Checkout Room ${activeBooking.room} for ${activeBooking.customer || 'customer'}?`);
    if (!ok) return;

    const roomId = Number(activeBooking.room);
    const room = rooms.find(r => r.id === roomId);
    const amount = room?.price ?? 0;
    const receiptNo = "R-" + Date.now();

    bookingHistory.push({
        type: "CHECKOUT",
        room: roomId,
        customer: activeBooking.customer,
        customerId: activeBooking.customerId,
        amount: amount,
        checkIn: activeBooking.checkIn,
        checkOut: nowISO,
        createdAtISO: nowISO,
        date: now.toLocaleString()
    });

    // End stay immediately
    activeBooking.checkOut = nowISO;

    income.push({
        dateISO: nowISO,
        amount: amount
    });

    const receiptEl = document.getElementById('receipt');
    if (receiptEl) {
        receiptEl.innerHTML = `
            <h3>Hotel Receipt</h3>
            <p><strong>Receipt No:</strong> ${receiptNo}</p>
            <p><strong>Date:</strong> ${now.toLocaleString()}</p>
            <p><strong>Start Time:</strong> ${escapeHtml(formatDateTime(activeBooking.checkIn))}</p>
            <p><strong>End Time:</strong> ${escapeHtml(now.toLocaleString())}</p>
            <p><strong>Customer:</strong> ${escapeHtml(activeBooking.customer || '')}</p>
            <p><strong>Room:</strong> ${escapeHtml(roomId)}</p>
            <p><strong>Amount:</strong> Rs.${escapeHtml(amount)}</p>
            <hr>
            <p>Thank you for staying with us!</p>
        `;
    }

    saveData();
    loadRooms();
    showRoomBookingHistory();
    showBookingHistory();
    showTodayArrivalsDepartures();
    showReservationCalendar();
    showIncome();
    showMessage('Checked out successfully');
}

// -----------------------------
// Checkout & Issue Receipt (by Booking ID / Customer ID)
// -----------------------------

let selectedReceiptRef = null; // { index: number, type: 'RESERVE' | 'CHECKOUT' }

function formatRs(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '';
    // Avoid trailing .00 for whole numbers
    const text = Number.isInteger(n) ? String(n) : n.toFixed(2);
    return `Rs.${text}`;
}

function getRoomFee(roomId) {
    const id = Number(roomId);
    const room = rooms.find(r => r.id === id);
    return room && Number.isFinite(room.price) ? Number(room.price) : 0;
}

function normalizeLineItems(raw) {
    if (!Array.isArray(raw)) return [];
    return raw
        .map(item => {
            if (!item || typeof item !== 'object') return null;
            const name = String(item.name ?? item.title ?? item.item ?? '').trim();
            const qtyRaw = item.qty ?? item.quantity ?? 1;
            const qty = Number.isFinite(Number(qtyRaw)) && Number(qtyRaw) > 0 ? Number(qtyRaw) : 1;
            const priceRaw = item.price ?? item.unitPrice ?? item.amount;
            const price = Number.isFinite(Number(priceRaw)) ? Number(priceRaw) : NaN;
            if (!name || !Number.isFinite(price)) return null;
            const total = price * qty;
            return { name, qty, price, total };
        })
        .filter(Boolean);
}

function getBookingLineItems(booking) {
    if (!booking || typeof booking !== 'object') return [];

    const candidateArrays = [
        booking.lineItems,
        booking.items,
        booking.extras,
        booking.foodItems,
        booking.juiceItems,
        booking.foodAndJuiceItems,
    ];

    for (const arr of candidateArrays) {
        const normalized = normalizeLineItems(arr);
        if (normalized.length) return normalized;
    }

    // Optional numeric totals, if a future “food/juice counting” feature stores them.
    const foodTotal = Number(booking.foodTotal);
    const juiceTotal = Number(booking.juiceTotal);
    const extrasTotal = Number(booking.extrasTotal);
    const synthetic = [];
    if (Number.isFinite(foodTotal) && foodTotal > 0) synthetic.push({ name: 'Food', qty: 1, price: foodTotal, total: foodTotal });
    if (Number.isFinite(juiceTotal) && juiceTotal > 0) synthetic.push({ name: 'Juices', qty: 1, price: juiceTotal, total: juiceTotal });
    if (Number.isFinite(extrasTotal) && extrasTotal > 0) synthetic.push({ name: 'Extras', qty: 1, price: extrasTotal, total: extrasTotal });
    return synthetic;
}

function calculateChargesForBooking(booking) {
    const roomFee = booking?.roomAmount != null ? Number(booking.roomAmount) : getRoomFee(booking?.room);
    const foodAmount = booking?.foodAmount != null ? Number(booking.foodAmount) : 0;
    const items = getBookingLineItems(booking);
    const extrasTotal = booking?.extrasAmount != null
        ? Number(booking.extrasAmount)
        : items.reduce((sum, it) => sum + (Number.isFinite(it.total) ? it.total : 0), 0);

    const totalFromAmount = Number(booking?.amount);
    const total = Number.isFinite(totalFromAmount)
        ? totalFromAmount
        : ((Number.isFinite(roomFee) ? roomFee : 0) + (Number.isFinite(foodAmount) ? foodAmount : 0) + (Number.isFinite(extrasTotal) ? extrasTotal : 0));

    return {
        roomFee: Number.isFinite(roomFee) ? roomFee : 0,
        foodAmount: Number.isFinite(foodAmount) ? foodAmount : 0,
        extrasTotal: Number.isFinite(extrasTotal) ? extrasTotal : 0,
        total: Number.isFinite(total) ? total : 0,
        items,
    };
}

function getBookingSortTime(b) {
    if (!b) return 0;
    const iso = b.createdAtISO || b.checkOut || b.checkIn;
    const t = iso ? new Date(iso).getTime() : 0;
    return Number.isFinite(t) ? t : 0;
}

function findLatestBookingByCustomerId(customerId) {
    const id = String(customerId || '').trim();
    if (!id) return null;

    const candidates = bookingHistory
        .map((b, index) => ({ b, index }))
        .filter(({ b }) => b && String(b.customerId || '').trim() === id)
        .sort((a, b) => getBookingSortTime(b.b) - getBookingSortTime(a.b));

    if (!candidates.length) return null;

    // For payment, prefer an active RESERVE. Otherwise fall back to latest CHECKOUT.
    const reserve = candidates.find(x => x.b.type === 'RESERVE');
    const checkout = candidates.find(x => x.b.type === 'CHECKOUT');
    return reserve || checkout || candidates[0];
}

function renderReceiptHtml(booking, issuedOverride = null) {
    if (!booking) return '';

    const type = booking.type || '';
    const statusText = type === 'CHECKOUT' ? 'ISSUED' : 'PENDING';

    const bookingId = escapeHtml(booking.bookingId || '');
    const receiptNo = escapeHtml(issuedOverride?.receiptNo || booking.receiptNo || '');

    const room = escapeHtml(booking.room ?? '');
    const customer = escapeHtml(booking.customer || '');
    const customerId = escapeHtml(booking.customerId || '');
    const checkIn = escapeHtml(formatDateTime(booking.checkIn));
    const checkOut = escapeHtml(formatDateTime(issuedOverride?.checkOutISO || booking.checkOut));

    const issuedAt = issuedOverride?.issuedAtISO
        ? escapeHtml(formatDateTime(issuedOverride.issuedAtISO))
        : escapeHtml(booking.createdAtISO ? formatDateTime(booking.createdAtISO) : (booking.date || ''));

    const charges = calculateChargesForBooking({ ...booking, amount: issuedOverride?.amount ?? booking.amount });
    const roomFeeText = formatRs(Number.isFinite(charges.roomFee) ? charges.roomFee : 0);
    const foodText = formatRs(Number.isFinite(charges.foodAmount) ? charges.foodAmount : 0);
    const extrasText = formatRs(Number.isFinite(charges.extrasTotal) ? charges.extrasTotal : 0);
    const overrideAmount = issuedOverride?.amount;
    const totalValue = Number.isFinite(Number(overrideAmount))
        ? Number(overrideAmount)
        : (Number.isFinite(charges.total) ? charges.total : 0);
    const totalText = formatRs(totalValue);

    const itemsHtml = charges.items.length
        ? `
            <div style="margin-top: 10px;">
                <div style="font-weight: 700; margin-bottom: 6px;">Food & Juices</div>
                <ul style="margin: 0; padding-left: 18px;">
                    ${charges.items.map(it => `
                        <li>${escapeHtml(it.name)} × ${escapeHtml(it.qty)} — ${escapeHtml(formatRs(it.total))}</li>
                    `).join('')}
                </ul>
            </div>
        `
        : '';

    return `
        <h3 class="receipt-title">Hotel Receipt</h3>
        <div class="receipt-grid receipt-grid--single">
            <div class="receipt-kv"><span class="receipt-label">Status:</span><span class="receipt-value">${escapeHtml(statusText)}</span></div>
            <div class="receipt-kv"><span class="receipt-label">Issued At:</span><span class="receipt-value">${issuedAt}</span></div>
            <div class="receipt-kv"><span class="receipt-label">Receipt No:</span><span class="receipt-value">${receiptNo}</span></div>
            <div class="receipt-kv"><span class="receipt-label">Booking ID:</span><span class="receipt-value">${bookingId}</span></div>
            <div class="receipt-kv"><span class="receipt-label">Customer Name:</span><span class="receipt-value">${customer}</span></div>
            <div class="receipt-kv"><span class="receipt-label">Customer ID:</span><span class="receipt-value">${customerId}</span></div>
            <div class="receipt-kv"><span class="receipt-label">Room Number:</span><span class="receipt-value">${room}</span></div>
            <div class="receipt-kv"><span class="receipt-label">Check-in:</span><span class="receipt-value">${checkIn}</span></div>
            <div class="receipt-kv"><span class="receipt-label">Check-out:</span><span class="receipt-value">${checkOut}</span></div>
            <div class="receipt-kv"><span class="receipt-label">Room Fee:</span><span class="receipt-value">${escapeHtml(roomFeeText)}</span></div>
            <div class="receipt-kv"><span class="receipt-label">Food Fee:</span><span class="receipt-value">${escapeHtml(foodText)}</span></div>
            <div class="receipt-kv"><span class="receipt-label">Extras Fee:</span><span class="receipt-value">${escapeHtml(extrasText)}</span></div>
            <div class="receipt-kv receipt-kv--total"><span class="receipt-label">Total Amount:</span><span class="receipt-value">${escapeHtml(totalText)}</span></div>
        </div>
        ${itemsHtml}
        <div class="receipt-footer">Thank you for staying with us!</div>
    `;
}

function renderReceipt(booking, issuedOverride = null) {
    const receiptEl = document.getElementById('receipt');
    if (!receiptEl) return;
    receiptEl.innerHTML = booking ? renderReceiptHtml(booking, issuedOverride) : '';
}

function getOrCreatePayReceiptModal() {
    let modal = document.getElementById('payReceiptModal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'payReceiptModal';
    modal.className = 'modal-overlay';
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = `
        <div class="modal-card" role="dialog" aria-modal="true" aria-label="Hotel Receipt">
            <div class="modal-body">
                <div id="payReceiptModalBody" class="receipt-card"></div>
            </div>
            <div class="modal-actions">
                <button type="button" class="history-action" onclick="printPayReceiptModal()">Print</button>
                <button type="button" class="history-action" onclick="closePayReceiptModal()">Close</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    return modal;
}

function openPayReceiptModal(receiptHtml) {
    const modal = getOrCreatePayReceiptModal();
    const body = document.getElementById('payReceiptModalBody');
    if (body) body.innerHTML = receiptHtml || '';

    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');

    const onBackdropClick = (e) => {
        if (e.target === modal) closePayReceiptModal();
    };
    modal.addEventListener('mousedown', onBackdropClick, { once: true });

    const onKeyDown = (e) => {
        if (e.key === 'Escape') closePayReceiptModal();
    };
    document.addEventListener('keydown', onKeyDown, { once: true });
}

function closePayReceiptModal() {
    const modal = document.getElementById('payReceiptModal');
    if (!modal) return;
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
}

function printHtmlInNewWindow(html) {
    const w = window.open('', '_blank', 'width=900,height=650');
    if (!w) {
        showMessage('Pop-up blocked. Please allow pop-ups to print.', 'red');
        return;
    }

    w.document.open();
    w.document.write(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>Receipt</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
            <link rel="stylesheet" href="style.css" />
            <style>
                body { background: #fff; padding: 16px; }
                .receipt-card { margin-top: 0; }
            </style>
        </head>
        <body>
            <div class="receipt-card">${html || ''}</div>
            <script>
                window.focus();
                window.print();
            <\/script>
        </body>
        </html>
    `);
    w.document.close();
}

function printPayReceiptModal() {
    const body = document.getElementById('payReceiptModalBody');
    const html = body?.innerHTML || '';
    if (!html.trim()) {
        showMessage('No receipt to print.', 'red');
        return;
    }
    printHtmlInNewWindow(html);
}

function previewPayReceipt() {
    const summaryEl = document.getElementById('checkoutSummary');
    const customerId = (document.getElementById('receiptCustomerId')?.value || '').trim();

    if (!summaryEl) return;
    if (!customerId) {
        selectedReceiptRef = null;
        summaryEl.innerHTML = '';
        return;
    }

    const found = findLatestBookingByCustomerId(customerId);
    if (!found) {
        selectedReceiptRef = null;
        summaryEl.innerHTML = '';
        return;
    }

    selectedReceiptRef = { index: found.index, type: found.b.type === 'CHECKOUT' ? 'CHECKOUT' : 'RESERVE' };

    const booking = found.b;
    if (booking?.type === 'CHECKOUT') {
        summaryEl.innerHTML = `
            <div style="font-weight: 700; text-align: center; margin-top: 8px;">The bill has already been paid</div>
        `;
        return;
    }

    const charges = calculateChargesForBooking(booking);
    const extrasText = charges.extrasTotal ? formatRs(charges.extrasTotal) : '';

    summaryEl.innerHTML = `
        <div class="receipt-grid">
            <div class="receipt-row"><span class="receipt-label">Customer:</span><span>${escapeHtml(booking.customer || '')}</span></div>
            <div class="receipt-row"><span class="receipt-label">Customer ID:</span><span>${escapeHtml(booking.customerId || '')}</span></div>
            <div class="receipt-row"><span class="receipt-label">Room:</span><span>${escapeHtml(booking.room ?? '')}</span></div>
            <div class="receipt-row"><span class="receipt-label">Room Fee:</span><span>${escapeHtml(formatRs(charges.roomFee))}</span></div>
            <div class="receipt-row"><span class="receipt-label">Extras:</span><span>${escapeHtml(extrasText)}</span></div>
            <div class="receipt-row"><span class="receipt-label">Total Amount:</span><span>${escapeHtml(formatRs(charges.total))}</span></div>
        </div>
    `;
}

function findReceiptForPayment() {
    const customerId = (document.getElementById('receiptCustomerId')?.value || '').trim();
    if (!customerId) {
        showMessage('Enter Customer ID Number', 'red');
        return;
    }

    const found = findLatestBookingByCustomerId(customerId);
    const summaryEl = document.getElementById('checkoutSummary');

    if (!found) {
        selectedReceiptRef = null;
        if (summaryEl) summaryEl.innerHTML = '';
        showMessage('No matching booking found', 'red');
        return;
    }

    selectedReceiptRef = { index: found.index, type: found.b.type === 'CHECKOUT' ? 'CHECKOUT' : 'RESERVE' };

    const booking = found.b;

    const findBtn = document.getElementById('findReceiptBtn');
    const backBtn = document.getElementById('receiptBackBtn');
    const payBtn = document.getElementById('receiptPayBtn');

    if (findBtn) findBtn.style.display = 'none';
    if (backBtn) backBtn.style.display = '';

    const idGroup = document.getElementById('receiptCustomerIdGroup');
    if (idGroup) idGroup.style.display = 'none';

    // If the booking is already in Room Booking History (CHECKOUT) and not in Room Booking Details,
    // show a paid message instead of Amount Details.
    if (booking?.type === 'CHECKOUT') {
        if (summaryEl) {
            summaryEl.innerHTML = `
                <div style="font-weight: 800; text-align: center;">The bill has already been paid</div>
            `;
        }

        if (payBtn) payBtn.style.display = 'none';
        return;
    }

    if (payBtn) payBtn.style.display = '';

    const charges = calculateChargesForBooking(booking);

    const customerName = booking.customer || '';
    const customerIdText = booking.customerId || '';
    const roomText = booking.room ?? '';

    // Show the requested summary + allow manual entry of charges (only for RESERVE)
    if (summaryEl) {
        const roomFeeDefault = charges.roomFee;
        const foodDefault = 0;
        const extrasDefault = charges.extrasTotal;
        const totalDefault = (Number.isFinite(roomFeeDefault) ? roomFeeDefault : 0)
            + (Number.isFinite(foodDefault) ? foodDefault : 0)
            + (Number.isFinite(extrasDefault) ? extrasDefault : 0);

        summaryEl.innerHTML = `
            <div style="font-weight: 1000; text-align: center; margin-bottom: 18px;">Amount Details</div>

            <div class="receipt-row" style="flex-wrap: wrap; gap: 12px; justify-content: space-between;">
                <span><strong>Customer Name:</strong> ${escapeHtml(customerName)}</span>
                <span><strong>Customer ID:</strong> ${escapeHtml(customerIdText)}</span>
                <span><strong>Room Number:</strong> ${escapeHtml(roomText)}</span>
            </div>

            <div class="reservation-form" style="gap: 12px; margin-top: 12px;">
                <div class="form-group">
                    <label for="manualRoomFee">Room Fee:</label>
                    <input type="number" id="manualRoomFee" class="form-control" min="0" step="100" value="${escapeHtml(roomFeeDefault)}" oninput="updateManualTotal()">
                </div>

                <div class="form-group">
                    <label for="manualFood">Food Fee:</label>
                    <input type="number" id="manualFood" class="form-control" min="0" step="100" value="${escapeHtml(foodDefault)}" oninput="updateManualTotal()">
                </div>

                <div class="form-group">
                    <label for="manualExtras">Extras Fee:</label>
                    <input type="number" id="manualExtras" class="form-control" min="0" step="100" value="${escapeHtml(extrasDefault)}" oninput="updateManualTotal()">
                </div>

                <div class="form-group">
                    <label for="manualTotal">Total Amount:</label>
                    <input type="text" id="manualTotal" class="form-control" value="${escapeHtml(formatRs(totalDefault))}" readonly>
                </div>
            </div>
        `;
    }

    // Ensure total reflects any defaults
    updateManualTotal();
}

function getManualChargeValue(id) {
    const raw = document.getElementById(id)?.value;
    const n = raw != null && String(raw).trim() !== '' ? Number(raw) : 0;
    return Number.isFinite(n) && n >= 0 ? n : 0;
}

function updateManualTotal() {
    const totalEl = document.getElementById('manualTotal');
    if (!totalEl) return;
    const roomFee = getManualChargeValue('manualRoomFee');
    const food = getManualChargeValue('manualFood');
    const extras = getManualChargeValue('manualExtras');
    const total = roomFee + food + extras;
    totalEl.value = formatRs(total);
}

function resetReceiptCheckout() {
    const idEl = document.getElementById('receiptCustomerId');
    const summaryEl = document.getElementById('checkoutSummary');
    if (idEl) idEl.value = '';
    if (summaryEl) summaryEl.innerHTML = '';
    selectedReceiptRef = null;

    const idGroup = document.getElementById('receiptCustomerIdGroup');
    if (idGroup) idGroup.style.display = '';

    const findBtn = document.getElementById('findReceiptBtn');
    const backBtn = document.getElementById('receiptBackBtn');
    const payBtn = document.getElementById('receiptPayBtn');
    if (findBtn) findBtn.style.display = '';
    if (backBtn) backBtn.style.display = 'none';
    if (payBtn) payBtn.style.display = 'none';
}

function payAndShowReceipt() {
    if (!selectedReceiptRef) {
        showMessage('Find the receipt first', 'red');
        return;
    }

    const booking = bookingHistory[selectedReceiptRef.index];
    if (!booking) {
        showMessage('Booking not found', 'red');
        return;
    }

    // If already paid, just show the receipt modal.
    if (booking.type === 'CHECKOUT') {
        openPayReceiptModal(renderReceiptHtml(booking));
        showMessage('Receipt already issued for this customer');
        return;
    }

    if (booking.type !== 'RESERVE') {
        showMessage('Only RESERVE bookings can be checked out', 'red');
        return;
    }

    const now = new Date();
    const nowISO = now.toISOString();
    const receiptNo = `R-${Date.now()}`;
    const bookingId = booking.bookingId || getNextBookingId();

    const parseDisplayedRs = (raw) => {
        const text = String(raw ?? '').trim();
        if (!text) return NaN;
        // Accept formats like "Rs.2000", "2000", "2,000"
        const cleaned = text.replace(/Rs\.?/gi, '').replace(/,/g, '').trim();
        const n = Number(cleaned);
        return Number.isFinite(n) ? n : NaN;
    };

    // Manual amounts entered by user
    const roomFee = getManualChargeValue('manualRoomFee');
    const foodAmount = getManualChargeValue('manualFood');
    const extrasAmount = getManualChargeValue('manualExtras');
    let totalAmount = roomFee + foodAmount + extrasAmount;

    // Fallback: if inputs are missing/zero but UI shows a total, use it.
    const displayedTotal = parseDisplayedRs(document.getElementById('manualTotal')?.value);
    if (totalAmount === 0 && Number.isFinite(displayedTotal) && displayedTotal > 0) {
        totalAmount = displayedTotal;
    }

    if (!Number.isFinite(totalAmount) || totalAmount < 0) {
        showMessage('Please enter valid amounts', 'red');
        return;
    }

    const checkoutRecord = {
        type: 'CHECKOUT',
        bookingId,
        receiptNo,
        room: booking.room,
        customer: booking.customer,
        customerId: booking.customerId,
        roomAmount: roomFee,
        foodAmount,
        extrasAmount,
        amount: totalAmount,
        checkIn: booking.checkIn,
        checkOut: nowISO,
        createdAtISO: nowISO,
        date: now.toLocaleString(),
    };

    // Move RESERVE -> CHECKOUT
    bookingHistory.splice(selectedReceiptRef.index, 1);
    bookingHistory.push(checkoutRecord);

    income.push({ dateISO: nowISO, amount: totalAmount });
    saveData();

    loadRooms();
    showBookingHistory();
    showRoomBookingHistory();
    showTodayArrivalsDepartures();
    showReservationCalendar();
    showIncome();

    selectedReceiptRef = { index: bookingHistory.length - 1, type: 'CHECKOUT' };

    openPayReceiptModal(renderReceiptHtml(checkoutRecord, { amount: totalAmount, receiptNo, issuedAtISO: nowISO, checkOutISO: nowISO }));
    showMessage('Payment successful');
}

function findReceiptBooking() {
    const customerId = (document.getElementById('receiptCustomerId')?.value || '').trim();

    if (!customerId) {
        showMessage('Enter Customer ID Number', 'red');
        return;
    }

    const candidates = bookingHistory
        .map((b, index) => ({ b, index }))
        .filter(({ b }) => {
            if (!b) return false;
            return String(b.customerId || '').trim() === customerId;
        })
        .sort((a, b) => getBookingSortTime(b.b) - getBookingSortTime(a.b));

    if (candidates.length === 0) {
        selectedReceiptRef = null;
        renderReceipt(null);
        showMessage('No matching booking found', 'red');
        return;
    }

    // Prefer CHECKOUT record (already issued) if present
    const best = candidates.find(x => x.b.type === 'CHECKOUT') || candidates.find(x => x.b.type === 'RESERVE') || candidates[0];
    selectedReceiptRef = { index: best.index, type: best.b.type === 'CHECKOUT' ? 'CHECKOUT' : 'RESERVE' };

    // Suggest amount if empty
    const amountEl = document.getElementById('receiptAmount');
    if (amountEl && !amountEl.value) {
        const roomId = Number(best.b.room);
        const room = rooms.find(r => r.id === roomId);
        if (room && Number.isFinite(room.price)) amountEl.value = String(room.price);
    }

    renderReceipt(best.b);
}

function renderReceipt(booking, issuedOverride = null) {
    const receiptEl = document.getElementById('receipt');
    if (!receiptEl) return;

    if (!booking) {
        receiptEl.innerHTML = '';
        return;
    }

    const type = booking.type || '';
    const statusText = type === 'CHECKOUT' ? 'ISSUED' : 'PENDING';

    const bookingId = escapeHtml(booking.bookingId || '');
    const receiptNo = escapeHtml(issuedOverride?.receiptNo || booking.receiptNo || '');

    const room = escapeHtml(booking.room ?? '');
    const customer = escapeHtml(booking.customer || '');
    const customerId = escapeHtml(booking.customerId || '');
    const checkIn = escapeHtml(formatDateTime(booking.checkIn));
    const checkOut = escapeHtml(formatDateTime(issuedOverride?.checkOutISO || booking.checkOut));

    const amountValue = issuedOverride?.amount != null
        ? issuedOverride.amount
        : (booking.amount != null ? booking.amount : null);

    const amountText = amountValue != null && amountValue !== ''
        ? `Rs.${escapeHtml(amountValue)}`
        : '';

    const issuedAt = issuedOverride?.issuedAtISO
        ? escapeHtml(formatDateTime(issuedOverride.issuedAtISO))
        : escapeHtml(booking.createdAtISO ? formatDateTime(booking.createdAtISO) : (booking.date || ''));

    receiptEl.innerHTML = `
        <h3 class="receipt-title">Hotel Receipt</h3>
        <div class="receipt-grid">
            <div class="receipt-row"><span class="receipt-label">Status:</span><span>${escapeHtml(statusText)}</span></div>
            <div class="receipt-row"><span class="receipt-label">Issued At:</span><span>${issuedAt}</span></div>
            <div class="receipt-row"><span class="receipt-label">Receipt No:</span><span>${receiptNo}</span></div>
            <div class="receipt-row"><span class="receipt-label">Booking ID:</span><span>${bookingId}</span></div>
            <div class="receipt-row"><span class="receipt-label">Customer:</span><span>${customer}</span></div>
            <div class="receipt-row"><span class="receipt-label">Customer ID:</span><span>${customerId}</span></div>
            <div class="receipt-row"><span class="receipt-label">Room:</span><span>${room}</span></div>
            <div class="receipt-row"><span class="receipt-label">Check-in:</span><span>${checkIn}</span></div>
            <div class="receipt-row"><span class="receipt-label">Check-out:</span><span>${checkOut}</span></div>
            <div class="receipt-row"><span class="receipt-label">Amount:</span><span>${amountText}</span></div>
        </div>
        <div class="receipt-footer">Thank you for staying with us!</div>
    `;
}

function issueReceipt() {
    if (!selectedReceiptRef) {
        showMessage('Find the booking first (Booking ID or Customer ID)', 'red');
        return;
    }

    const booking = bookingHistory[selectedReceiptRef.index];
    if (!booking) {
        showMessage('Booking not found', 'red');
        return;
    }

    if (booking.type === 'CHECKOUT') {
        renderReceipt(booking);
        showMessage('Receipt already issued for this booking');
        return;
    }

    if (booking.type !== 'RESERVE') {
        showMessage('Only RESERVE bookings can be checked out', 'red');
        return;
    }

    // Amount is auto-calculated: Room Fee + optional extras (food/juices/etc.)
    const amountRaw = document.getElementById('receiptAmount')?.value;
    let amount = amountRaw != null && String(amountRaw).trim() !== '' ? Number(amountRaw) : NaN;
    if (!Number.isFinite(amount)) {
        const charges = calculateChargesForBooking(booking);
        amount = charges.total;
    }
    if (!Number.isFinite(amount) || amount < 0) {
        showMessage('Unable to calculate a valid amount', 'red');
        return;
    }

    const now = new Date();
    const nowISO = now.toISOString();
    const receiptNo = `R-${Date.now()}`;

    const reserveBookingId = booking.bookingId || getNextBookingId();

    const checkoutRecord = {
        type: 'CHECKOUT',
        bookingId: reserveBookingId,
        receiptNo,
        room: booking.room,
        customer: booking.customer,
        customerId: booking.customerId,
        amount,
        checkIn: booking.checkIn,
        checkOut: nowISO,
        createdAtISO: nowISO,
        date: now.toLocaleString(),
    };

    // Remove from Room Booking Details (RESERVE list)
    bookingHistory.splice(selectedReceiptRef.index, 1);

    // Add to Room Booking History (CHECKOUT list)
    bookingHistory.push(checkoutRecord);

    income.push({ dateISO: nowISO, amount });

    saveData();

    // Refresh all related UI across pages
    loadRooms();
    showBookingHistory();
    showRoomBookingHistory();
    showTodayArrivalsDepartures();
    showReservationCalendar();
    showIncome();

    // Point selection to the newly added CHECKOUT record
    selectedReceiptRef = { index: bookingHistory.length - 1, type: 'CHECKOUT' };
    renderReceipt(checkoutRecord, { amount, receiptNo, issuedAtISO: nowISO, checkOutISO: nowISO });
    showMessage('Receipt issued successfully');
}

function printReceipt() {
    const receiptEl = document.getElementById('receipt');
    if (!receiptEl || !receiptEl.innerHTML.trim()) {
        showMessage('No receipt to print. Find or issue a receipt first.', 'red');
        return;
    }

    const html = receiptEl.innerHTML;
    const w = window.open('', '_blank', 'width=900,height=650');
    if (!w) {
        showMessage('Pop-up blocked. Please allow pop-ups to print.', 'red');
        return;
    }

    w.document.open();
    w.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8" />
            <title>Receipt</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
            <link rel="stylesheet" href="style.css">
            <style>
                body { background: #fff; padding: 20px; }
                .receipt-card { border: 1px solid #ccc; border-radius: 10px; padding: 16px; }
            </style>
        </head>
        <body>
            <div class="receipt-card">${html}</div>
            <script>
                window.onload = function () { window.print(); };
            <\/script>
        </body>
        </html>
    `);
    w.document.close();
}

function clearAvailabilityDate() {
    const availabilityDateEl = document.getElementById('availabilityDate');
    if (availabilityDateEl) availabilityDateEl.value = '';
    loadRooms();
}

function reserveRoom() {
    const nameEl = document.getElementById('customerName');
    const name = (nameEl?.value || '').trim();

    const customerIdEl = document.getElementById('customerId');
    const customerId = (customerIdEl?.value || '').trim();

    const roomIdRaw = document.getElementById('roomSelect')?.value || document.getElementById('room-number')?.value;
    const roomId = parseInt(roomIdRaw, 10);

    if (!customerId) {
        showMessage("Please enter Customer Identification Number", "red");
        return;
    }

    const checkInEl = document.getElementById('checkIn');
    const checkOutEl = document.getElementById('checkOut');

    let checkIn = checkInEl?.value || '';
    let checkOut = checkOutEl?.value || '';

    // Support the model: date + start-time (no End Time)
    if (!checkIn || !checkOut) {
        const date = document.getElementById('date')?.value;
        const start = document.getElementById('start-time')?.value;

        if (date && start) {
            const inTime = new Date(`${date}T${start}`);
            // Default stay duration: 24 hours
            const outTime = new Date(inTime.getTime() + 24 * 60 * 60 * 1000);
            checkIn = inTime.toISOString();
            checkOut = outTime.toISOString();
        }
    }

    if (!name || !customerId || !Number.isFinite(roomId) || !checkIn || !checkOut) {
        showMessage("Please fill all fields", "red");
        return;
    }

    const inTime = new Date(checkIn);
    const outTime = new Date(checkOut);

    if (!(inTime instanceof Date) || isNaN(inTime) || !(outTime instanceof Date) || isNaN(outTime)) {
        showMessage("Invalid date/time", "red");
        return;
    }

    if (outTime <= inTime) {
        showMessage("Check-out must be after check-in", "red");
        return;
    }

    // ❌ Time overlap check
    const conflict = bookingHistory.some((b, idx) =>
        b.room === roomId &&
        b.type === "RESERVE" &&
        idx !== editingReservationIndex &&
        (
            inTime < new Date(b.checkOut) &&
            outTime > new Date(b.checkIn)
        )
    );

    if (conflict) {
        showMessage("This room is already reserved for the selected date/time", "red");
        return;
    }

    if (editingReservationIndex != null) {
        const existing = bookingHistory[editingReservationIndex];
        if (!existing || existing.type !== 'RESERVE') {
            editingReservationIndex = null;
        }
    }

    // Get phone number from form
    const customerPhoneEl = document.getElementById('customerPhone');
    const customerPhone = (customerPhoneEl?.value || '').trim();

    if (editingReservationIndex != null) {
        bookingHistory[editingReservationIndex] = {
            ...bookingHistory[editingReservationIndex],
            bookingId: bookingHistory[editingReservationIndex]?.bookingId || getNextBookingId(),
            type: "RESERVE",
            room: roomId,
            customer: name,
            customerId,
            customerPhone,
            checkIn: checkIn,
            checkOut: checkOut,
        };
    } else {
        const createdAtISO = new Date().toISOString();
        bookingHistory.push({
            bookingId: getNextBookingId(),
            type: "RESERVE",
            room: roomId,
            customer: name,
            customerId,
            customerPhone,
            checkIn: checkIn,
            checkOut: checkOut,
            createdAtISO,
            date: new Date(createdAtISO).toLocaleString()
        });
    }

    saveData();
    loadRooms();
    showBookingHistory();

    if (editingReservationIndex != null) {
        showMessage("Reservation updated successfully");
    } else {
        showMessage("Room reserved successfully");
    }

    // Clear Room Reservation form fields after submission
    if (nameEl) nameEl.value = '';
    if (customerIdEl) customerIdEl.value = '';
    if (customerPhoneEl) customerPhoneEl.value = '';
    const roomNumberEl = document.getElementById('room-number');
    if (roomNumberEl) roomNumberEl.selectedIndex = 0;
    const dateEl = document.getElementById('date');
    if (dateEl) dateEl.value = '';
    const startTimeEl = document.getElementById('start-time');
    if (startTimeEl) startTimeEl.value = '';

    editingReservationIndex = null;

}

function viewBooking(index) {
    const b = bookingHistory[index];
    if (!b) return;

    openViewModal(b);
}

function getOrCreateViewModal() {
    let modal = document.getElementById('viewModal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'viewModal';
    modal.className = 'modal-overlay';
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = `
        <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="viewModalTitle">
            <div class="modal-header">
                <h3 id="viewModalTitle" class="modal-title">View Booking</h3>
                <!-- Close button removed -->
            </div>

            <div class="modal-body">
                <div class="reservation-form" style="gap: 12px;">
                    <div class="form-group">
                        <label for="viewBookingId">Booking ID:</label>
                        <input type="text" id="viewBookingId" class="form-control" disabled>
                    </div>

                    <div class="form-group">
                        <label for="viewBookingCreatedAt">Date & Time:</label>
                        <input type="text" id="viewBookingCreatedAt" class="form-control" disabled>
                    </div>

                    <div class="form-group">
                        <label for="viewBookingType">Type:</label>
                        <input type="text" id="viewBookingType" class="form-control" disabled>
                    </div>

                    <div class="form-group">
                        <label for="viewBookingRoom">Room:</label>
                        <input type="text" id="viewBookingRoom" class="form-control" disabled>
                    </div>

                    <div class="form-group">
                        <label for="viewBookingCustomer">Customer:</label>
                        <input type="text" id="viewBookingCustomer" class="form-control" disabled>
                    </div>

                    <div class="form-group">
                        <label for="viewBookingCustomerId">Customer ID:</label>
                        <input type="text" id="viewBookingCustomerId" class="form-control" disabled>
                    </div>
                    <div class="form-group">
                        <label for="viewBookingCustomerPhone">Phone Number:</label>
                        <input type="text" id="viewBookingCustomerPhone" class="form-control" disabled>
                    </div>

                    <div class="form-group">
                        <label for="viewBookingCheckIn">Check-in:</label>
                        <input type="text" id="viewBookingCheckIn" class="form-control" disabled>
                    </div>

                    <div class="form-group" id="viewBookingCheckOutGroup" style="display:none;">
                        <label for="viewBookingCheckOut">Check-out:</label>
                        <input type="text" id="viewBookingCheckOut" class="form-control" disabled>
                    </div>
                    <div class="form-group" id="viewBookingAmountGroup" style="display:none;">
                        <label for="viewBookingAmount">Amount:</label>
                        <input type="text" id="viewBookingAmount" class="form-control" disabled>
                    </div>
                </div>
            </div>

            <div class="modal-actions">
                <button type="button" class="history-action" onclick="closeViewModal()">Close</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    return modal;
}

function openViewModal(booking) {
    const modal = getOrCreateViewModal();
    if (!modal) {
        // Last-resort fallback
        alert('Unable to open view modal');
        return;
    }

    const setValue = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.value = value;
    };

    const createdAt = booking.createdAtISO ? formatDateTime(booking.createdAtISO) : (booking.date || '');
    const type = booking.type || '';
    const roomText = booking.room != null ? `Room ${booking.room}` : '';
    const checkInText = booking.checkIn ? formatDateTime(booking.checkIn) : '';
    const checkOutText = booking.checkOut ? formatDateTime(booking.checkOut) : '';

    let amountText = booking.amount != null && booking.amount !== '' ? `Rs.${booking.amount}` : '';
    if (!amountText && booking.room != null) {
        const roomId = Number(booking.room);
        const room = rooms.find(r => r.id === roomId);
        if (room && Number.isFinite(room.price)) amountText = `Rs.${room.price}`;
    }

    setValue('viewBookingId', booking.bookingId || '');
    setValue('viewBookingCreatedAt', createdAt);
    setValue('viewBookingType', type);
    setValue('viewBookingRoom', roomText);
    setValue('viewBookingCustomer', booking.customer || '');
    setValue('viewBookingCustomerId', booking.customerId || '');
    setValue('viewBookingCustomerPhone', booking.customerPhone || '');
    setValue('viewBookingCheckIn', checkInText);
    // Show Check-out and Amount only for CHECKOUT type
    const checkOutGroup = document.getElementById('viewBookingCheckOutGroup');
    const amountGroup = document.getElementById('viewBookingAmountGroup');
    if (booking.type === 'CHECKOUT') {
        if (checkOutGroup) checkOutGroup.style.display = '';
        if (amountGroup) amountGroup.style.display = '';
        setValue('viewBookingCheckOut', checkOutText);
        setValue('viewBookingAmount', amountText);
    } else {
        if (checkOutGroup) checkOutGroup.style.display = 'none';
        if (amountGroup) amountGroup.style.display = 'none';
    }
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');

    // Close when clicking outside the card
    const onBackdropClick = (e) => {
        if (e.target === modal) closeViewModal();
    };
    modal.addEventListener('mousedown', onBackdropClick, { once: true });

    // Close on Escape
    const onKeyDown = (e) => {
        if (e.key === 'Escape') closeViewModal();
    };
    document.addEventListener('keydown', onKeyDown, { once: true });
}

function closeViewModal() {
    const modal = document.getElementById('viewModal');
    if (!modal) return;
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
}

function editBooking(index) {
    const b = bookingHistory[index];
    if (!b) return;
    if (b.type !== 'RESERVE') {
        showMessage('Only RESERVE entries can be edited', 'red');
        return;
    }

    openEditModal(index);
}

function openEditModal(index) {
    const modal = document.getElementById('editModal');
    if (!modal) {
        // Fallback (if modal markup is missing for some reason)
        window.location.href = `edit-booking.html?index=${encodeURIComponent(index)}`;
        return;
    }

    const b = bookingHistory[index];
    if (!b || b.type !== 'RESERVE') return;

    const indexEl = document.getElementById('editModalIndex');
    const bookingIdEl = document.getElementById('editModalBookingId');
    const nameEl = document.getElementById('editModalCustomerName');
    const customerIdEl = document.getElementById('editModalCustomerId');
    const roomEl = document.getElementById('editModalRoomNumber');
    const dateEl = document.getElementById('editModalDate');
    const startEl = document.getElementById('editModalStartTime');
    const phoneEl = document.getElementById('editModalCustomerPhone');

    if (indexEl) indexEl.value = String(index);
    if (bookingIdEl) bookingIdEl.value = b.bookingId || '';
    if (nameEl) nameEl.value = b.customer || '';
    if (customerIdEl) customerIdEl.value = b.customerId || '';
    if (phoneEl) phoneEl.value = b.customerPhone || '';

    if (roomEl) {
        roomEl.innerHTML = '<option value="">Select Room Number</option>';
        rooms.forEach(r => {
            const opt = document.createElement('option');
            opt.value = String(r.id);
            opt.textContent = `Room ${r.id}`;
            roomEl.appendChild(opt);
        });
        roomEl.value = String(b.room ?? '');
    }

    if (b.checkIn) {
        const inDt = new Date(b.checkIn);
        if (!isNaN(inDt)) {
            if (dateEl) dateEl.value = toLocalDateInputValue(inDt);
            if (startEl) startEl.value = toLocalTimeInputValue(inDt);
        }
    }

    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');

    // Close when clicking outside the card
    const onBackdropClick = (e) => {
        if (e.target === modal) closeEditModal();
    };
    modal.addEventListener('mousedown', onBackdropClick, { once: true });

    // Close on Escape
    const onKeyDown = (e) => {
        if (e.key === 'Escape') closeEditModal();
    };
    document.addEventListener('keydown', onKeyDown, { once: true });

    if (nameEl) nameEl.focus();
}

function closeEditModal() {
    const modal = document.getElementById('editModal');
    if (!modal) return;
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
}

function saveEditModal() {
    const indexEl = document.getElementById('editModalIndex');
    const nameEl = document.getElementById('editModalCustomerName');
    const customerIdEl = document.getElementById('editModalCustomerId');
    const roomEl = document.getElementById('editModalRoomNumber');
    const dateEl = document.getElementById('editModalDate');
    const startEl = document.getElementById('editModalStartTime');
    const phoneEl = document.getElementById('editModalCustomerPhone');

    const index = indexEl?.value != null ? parseInt(indexEl.value, 10) : NaN;
    if (!Number.isFinite(index)) {
        showMessage('Invalid booking index', 'red');
        return;
    }

    const existing = bookingHistory[index];
    if (!existing || existing.type !== 'RESERVE') {
        showMessage('Booking not found', 'red');
        return;
    }

    const name = (nameEl?.value || '').trim();
    const customerId = (customerIdEl?.value || '').trim();
    const customerPhone = (phoneEl?.value || '').trim();
    const roomId = parseInt(roomEl?.value || '', 10);
    const date = dateEl?.value;
    const start = startEl?.value;

    if (!name || !customerId || !customerPhone || !Number.isFinite(roomId) || !date || !start) {
        showMessage('Please fill all fields', 'red');
        return;
    }

    const inTime = new Date(`${date}T${start}`);
    const outTime = new Date(inTime.getTime() + 24 * 60 * 60 * 1000);
    if (isNaN(inTime) || isNaN(outTime)) {
        showMessage('Invalid date/time', 'red');
        return;
    }

    const conflict = bookingHistory.some((b, idx) =>
        idx !== index &&
        b &&
        b.type === 'RESERVE' &&
        b.room === roomId &&
        (
            inTime < new Date(b.checkOut) &&
            outTime > new Date(b.checkIn)
        )
    );

    if (conflict) {
        showMessage('This room is already reserved for the selected date/time', 'red');
        return;
    }

    bookingHistory[index] = {
        ...existing,
        room: roomId,
        customer: name,
        customerId,
        customerPhone,
        checkIn: inTime.toISOString(),
        checkOut: outTime.toISOString(),
    };

    saveData();
    loadRooms();
    showBookingHistory();
    showTodayArrivalsDepartures();
    showReservationCalendar();
    showIncome();
    closeEditModal();
    showMessage('Reservation updated successfully');
}

function deleteBooking(index) {
    openDeleteModal(index);
}

let pendingDeleteBooking = null;

function getOrCreateDeleteModal() {
    let modal = document.getElementById('deleteModal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'deleteModal';
    modal.className = 'modal-overlay';
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = `
        <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="deleteModalTitle">
            <div class="modal-header">
                <h3 id="deleteModalTitle" class="modal-title" style="display:flex; justify-content:center; align-items:center; margin:auto;">Delete Booking</h3>
                <!-- Close button removed -->
            </div>

            <div class="modal-body" style="text-align:center;">
                <p id="deleteModalText" class="modal-text"></p>
            </div>

            <div class="modal-actions modal-actions--center" style="display:flex; justify-content:center; gap:16px; margin-top:20px;">
                <button type="button" class="btn btn-secondary" style="min-width:100px;" onclick="closeDeleteModal()">Cancel</button>
                <button type="button" class="btn btn-danger" style="min-width:100px;" onclick="confirmDeleteModal()">Delete</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    return modal;
}

function openDeleteModal(index) {
    const b = bookingHistory[index];
    if (!b) return;

    pendingDeleteBooking = {
        index,
        bookingId: b.bookingId || null,
    };

    const modal = getOrCreateDeleteModal();
    const textEl = document.getElementById('deleteModalText');
    if (textEl) {
        textEl.textContent = 'Are you sure you want to delete this booking?';
    }

    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');

    const onBackdropClick = (e) => {
        if (e.target === modal) closeDeleteModal();
    };
    modal.addEventListener('mousedown', onBackdropClick, { once: true });

    const onKeyDown = (e) => {
        if (e.key === 'Escape') closeDeleteModal();
    };
    document.addEventListener('keydown', onKeyDown, { once: true });
}

function closeDeleteModal() {
    const modal = document.getElementById('deleteModal');
    if (!modal) return;
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
    pendingDeleteBooking = null;
}

function confirmDeleteModal() {
    if (!pendingDeleteBooking) return;

    const { index, bookingId } = pendingDeleteBooking;
    let deleteIndex = index;

    if (bookingId) {
        const current = bookingHistory[index];
        if (!current || current.bookingId !== bookingId) {
            deleteIndex = bookingHistory.findIndex(b => b && b.bookingId === bookingId);
        }
    }

    if (deleteIndex == null || deleteIndex < 0 || !bookingHistory[deleteIndex]) {
        closeDeleteModal();
        showMessage('Booking not found', 'red');
        return;
    }

    bookingHistory.splice(deleteIndex, 1);
    saveData();

    // Refresh UI safely across pages
    loadRooms();
    showBookingHistory();
    showTodayArrivalsDepartures();
    showReservationCalendar();
    showIncome();
    showRoomBookingHistory();

    closeDeleteModal();
    showMessage('Deleted successfully');
}

function checkout() {
    const roomId = parseInt(document.getElementById('checkoutRoom').value);
    if (!Number.isFinite(roomId)) {
        showMessage('Please select a room to checkout', 'red');
        return;
    }

    const now = new Date();

    // Find an active reservation for this room (occupied right now)
    const activeIndex = [...bookingHistory]
        .map((b, idx) => ({ b, idx }))
        .reverse()
        .find(({ b }) => {
            if (!b || b.type !== 'RESERVE' || b.room !== roomId) return false;
            if (!b.checkIn || !b.checkOut) return false;
            const inDt = new Date(b.checkIn);
            const outDt = new Date(b.checkOut);
            if (isNaN(inDt) || isNaN(outDt)) return false;
            return now >= inDt && now <= outDt;
        })?.idx;

    if (activeIndex == null) {
        showMessage('No active booking found for this room', 'red');
        return;
    }

    checkoutBooking(activeIndex);
}

function addIngredient() {
    const nameEl = document.getElementById('ingredientName');
    const qtyEl = document.getElementById('ingredientQty');
    const name = String(nameEl?.value || '').trim();
    const qtyRaw = qtyEl?.value;
    const qty = Number(qtyRaw);

    if (!name) {
        showMessage('Enter ingredient name', 'red');
        return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
        showMessage('Enter a valid quantity', 'red');
        return;
    }

    const current = Number(ingredients[name]);
    const currentQty = Number.isFinite(current) && current > 0 ? current : 0;
    ingredients[name] = currentQty + qty;

    ingredientHistory.push({
        name,
        qty,
        type: 'ADD',
        date: new Date().toLocaleString()
    });

    saveData();
    showIngredients();

    if (nameEl) nameEl.value = '';
    if (qtyEl) qtyEl.value = '';
}

function removeIngredient() {
    const nameEl = document.getElementById('ingredientName');
    const qtyEl = document.getElementById('ingredientQty');
    const name = String(nameEl?.value || '').trim();
    const qtyRaw = qtyEl?.value;
    const qty = Number(qtyRaw);

    if (!name) {
        showMessage('Enter ingredient name', 'red');
        return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
        showMessage('Enter a valid quantity', 'red');
        return;
    }

    const current = Number(ingredients[name]);
    const currentQty = Number.isFinite(current) ? current : 0;
    if (!(currentQty > 0)) {
        showMessage('Ingredient not found in stock', 'red');
        return;
    }
    if (qty > currentQty) {
        showMessage('Not enough stock to remove that quantity', 'red');
        return;
    }

    ingredients[name] = currentQty - qty;

    ingredientHistory.push({
        name,
        qty,
        type: 'REMOVE',
        date: new Date().toLocaleString()
    });

    if (ingredients[name] <= 0) {
        delete ingredients[name];
    }

    saveData();
    showIngredients();

    if (nameEl) nameEl.value = '';
    if (qtyEl) qtyEl.value = '';
}

function showIngredients() {
    const list = document.getElementById('ingredientList'); // legacy
    const lowStockDiv = document.getElementById('lowStock');
    const historyList = document.getElementById('ingredientHistory'); // legacy

    const stockTable = document.getElementById('ingredientStockTable');
    const historyTable = document.getElementById('ingredientHistoryTable');
    const historyEmpty = document.getElementById('ingredientHistoryEmpty');

    if (!lowStockDiv) return;

    if (list) list.innerHTML = '';
    if (historyList) historyList.innerHTML = '';
    lowStockDiv.innerHTML = '';
    if (historyEmpty) historyEmpty.textContent = '';

    const entries = Object.keys(ingredients || {})
        .map((name) => {
            const trimmed = String(name ?? '').trim();
            if (!trimmed) return null;
            const qty = Number(ingredients[name]);
            const safeQty = Number.isFinite(qty) ? qty : 0;
            return { name: trimmed, qty: safeQty };
        })
        .filter(Boolean)
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

    const lowStockThreshold = 5;
    const low = entries.filter(e => e.qty <= lowStockThreshold);

    // Stock render
    if (stockTable) {
        const tbody = stockTable.querySelector('tbody') || stockTable.appendChild(document.createElement('tbody'));
        tbody.innerHTML = '';

        if (!entries.length) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="3">No ingredients in stock.</td>
                </tr>
            `;
        } else {
            entries.forEach(e => {
                const isLow = e.qty <= lowStockThreshold;
                const statusClass = isLow ? 'kitchen-status kitchen-status--low' : 'kitchen-status kitchen-status--ok';
                const statusText = isLow ? 'Low Stock' : 'In Stock';
                tbody.innerHTML += `
                    <tr>
                        <td>${escapeHtml(e.name)}</td>
                        <td>${escapeHtml(String(e.qty))}</td>
                        <td><span class="${statusClass}">${escapeHtml(statusText)}</span></td>
                    </tr>
                `;
            });
        }
    } else if (list) {
        // Legacy list fallback
        entries.forEach(e => {
            list.innerHTML += `<li>${escapeHtml(e.name)}: ${escapeHtml(String(e.qty))}</li>`;
        });
    }

    // Low stock alert
    if (low.length) {
        lowStockDiv.innerHTML = `
            <div class="kitchen-alert">
                <div class="kitchen-alert__title">⚠ Low stock</div>
                <ul class="kitchen-alert__list">
                    ${low.map(e => `<li>${escapeHtml(e.name)} (Qty: ${escapeHtml(String(e.qty))})</li>`).join('')}
                </ul>
            </div>
        `;
    }

    // History render
    const historyRows = Array.isArray(ingredientHistory) ? ingredientHistory.slice(-20).reverse() : [];
    if (historyTable) {
        const tbody = historyTable.querySelector('tbody') || historyTable.appendChild(document.createElement('tbody'));
        tbody.innerHTML = '';

        if (!historyRows.length) {
            if (historyEmpty) historyEmpty.textContent = 'No ingredient history yet.';
        } else {
            historyRows.forEach(h => {
                const date = escapeHtml(h?.date || '');
                const type = escapeHtml(h?.type || '');
                const name = escapeHtml(String(h?.name || '').trim());
                const qty = escapeHtml(String(h?.qty ?? ''));
                tbody.innerHTML += `
                    <tr>
                        <td>${date}</td>
                        <td>${type}</td>
                        <td>${name}</td>
                        <td>${qty}</td>
                    </tr>
                `;
            });
        }
    } else if (historyList) {
        historyRows.forEach(h => {
            historyList.innerHTML += `<li>${escapeHtml(h?.date || '')} - ${escapeHtml(h?.type || '')} ${escapeHtml(String(h?.qty ?? ''))} ${escapeHtml(h?.name || '')}</li>`;
        });
    }
}

function showIncome() {
    const dailySpan = document.getElementById('dailyIncome');
    const monthlySpan = document.getElementById('monthlyIncome');

    if (!dailySpan || !monthlySpan) return;

    const toLocalYmd = (d) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const toLocalYm = (d) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        return `${year}-${month}`;
    };

    const parseIncomeAmount = (raw) => {
        if (raw == null) return NaN;
        if (typeof raw === 'number') return raw;
        const cleaned = String(raw).replace(/Rs\.?/gi, '').replace(/,/g, '').trim();
        const n = Number(cleaned);
        return Number.isFinite(n) ? n : NaN;
    };

    const now = new Date();
    const todayStr = toLocalYmd(now);
    const monthStr = toLocalYm(now);

    let dailyTotal = 0;
    let monthlyTotal = 0;

    const normalized = Array.isArray(income) ? income.map((i, idx) => ({ i, idx })) : [];
    const entries = [];

    normalized.forEach(({ i }) => {
        if (!i || typeof i !== 'object') return;

        const dateValue = i.dateISO || i.date;
        if (!dateValue) return;
        const d = new Date(dateValue);
        if (isNaN(d)) return;

        const amount = parseIncomeAmount(i.amount);
        if (!Number.isFinite(amount)) return;

        const dayKey = toLocalYmd(d);
        const monthKey = toLocalYm(d);

        if (dayKey === todayStr) dailyTotal += amount;
        if (monthKey === monthStr) monthlyTotal += amount;

        entries.push({ d, dayKey, monthKey, amount });
    });

    dailySpan.textContent = Number.isFinite(dailyTotal) ? String(Math.round(dailyTotal * 100) / 100) : '0';
    monthlySpan.textContent = Number.isFinite(monthlyTotal) ? String(Math.round(monthlyTotal * 100) / 100) : '0';

    // Selected day income + records
    const dayInput = document.getElementById('incomeDayInput');
    const selectedDaySpan = document.getElementById('selectedDayIncome');
    const selectedDayCaption = document.getElementById('selectedDayCaption');
    const dayRecordsTable = document.getElementById('dailyIncomeRecordsTable');
    const dayRecordsEmpty = document.getElementById('dailyIncomeRecordsEmpty');

    if (dayInput) {
        if (!dayInput.value) {
            // Default to today for convenience
            dayInput.value = todayStr;
        }
        if (window.__incomeSelectedDay && window.__incomeSelectedDay !== dayInput.value) {
            dayInput.value = window.__incomeSelectedDay;
        }
    }

    const selectedDayKey = (dayInput && dayInput.value) ? String(dayInput.value) : todayStr;
    window.__incomeSelectedDay = selectedDayKey;

    if (selectedDayCaption) {
        selectedDayCaption.textContent = selectedDayKey ? selectedDayKey : '';
    }

    if (selectedDaySpan || dayRecordsTable) {
        const dayEntries = entries
            .filter(e => e.dayKey === selectedDayKey)
            .sort((a, b) => b.d.getTime() - a.d.getTime());

        const dayTotal = dayEntries.reduce((sum, e) => sum + (Number.isFinite(e.amount) ? e.amount : 0), 0);
        if (selectedDaySpan) {
            selectedDaySpan.textContent = Number.isFinite(dayTotal) ? String(Math.round(dayTotal * 100) / 100) : '0';
        }

        if (dayRecordsTable) {
            const tbody = dayRecordsTable.querySelector('tbody') || dayRecordsTable.appendChild(document.createElement('tbody'));
            tbody.innerHTML = '';
            if (dayRecordsEmpty) dayRecordsEmpty.textContent = '';

            if (!dayEntries.length) {
                if (dayRecordsEmpty) dayRecordsEmpty.textContent = 'No records for the selected day.';
            } else {
                dayEntries.forEach(e => {
                    const amountText = formatRs(e.amount) || `Rs.${e.amount}`;
                    tbody.innerHTML += `
                        <tr>
                            <td>${escapeHtml(formatDateTime(e.d.toISOString()))}</td>
                            <td>${escapeHtml(amountText)}</td>
                        </tr>
                    `;
                });
            }
        }
    }

    // Monthly totals table
    const monthlyTable = document.getElementById('monthlyIncomeTable');
    const monthlyEmpty = document.getElementById('monthlyIncomeEmpty');
    if (monthlyTable) {
        const tbody = monthlyTable.querySelector('tbody') || monthlyTable.appendChild(document.createElement('tbody'));
        tbody.innerHTML = '';
        if (monthlyEmpty) monthlyEmpty.textContent = '';

        const map = new Map();
        entries.forEach(e => {
            const curr = map.get(e.monthKey) || { total: 0, count: 0 };
            curr.total += e.amount;
            curr.count += 1;
            map.set(e.monthKey, curr);
        });

        const months = Array.from(map.entries())
            .map(([monthKey, v]) => ({ monthKey, total: v.total, count: v.count }))
            .sort((a, b) => b.monthKey.localeCompare(a.monthKey));

        if (!months.length) {
            if (monthlyEmpty) monthlyEmpty.textContent = 'No income records yet.';
        } else {
            months.forEach(m => {
                const totalText = formatRs(m.total) || `Rs.${m.total}`;
                tbody.innerHTML += `
                    <tr>
                        <td>${escapeHtml(m.monthKey)}</td>
                        <td>${escapeHtml(totalText)}</td>
                        <td>${escapeHtml(String(m.count))}</td>
                    </tr>
                `;
            });
        }
    }

    // This month records view
    const recordsTable = document.getElementById('monthlyIncomeRecordsTable');
    const recordsEmpty = document.getElementById('monthlyIncomeRecordsEmpty');
    if (recordsTable) {
        const tbody = recordsTable.querySelector('tbody') || recordsTable.appendChild(document.createElement('tbody'));
        tbody.innerHTML = '';
        if (recordsEmpty) recordsEmpty.textContent = '';

        const thisMonth = entries
            .filter(e => e.monthKey === monthStr)
            .sort((a, b) => b.d.getTime() - a.d.getTime());

        if (!thisMonth.length) {
            if (recordsEmpty) recordsEmpty.textContent = 'No records for this month.';
        } else {
            thisMonth.forEach(e => {
                const amountText = formatRs(e.amount) || `Rs.${e.amount}`;
                tbody.innerHTML += `
                    <tr>
                        <td>${escapeHtml(formatDateTime(e.d.toISOString()))}</td>
                        <td>${escapeHtml(amountText)}</td>
                    </tr>
                `;
            });
        }
    }
}

function applyIncomeDayFilter() {
    const dayInput = document.getElementById('incomeDayInput');
    if (!dayInput) return;
    window.__incomeSelectedDay = String(dayInput.value || '').trim();
    showIncome();
}

function openIncomeRecordsModal() {
    const modal = document.getElementById('incomeRecordsModal');
    if (!modal) return;

    // Ensure the table is populated with the latest data.
    showIncome();

    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');

    const onBackdropClick = (e) => {
        if (e.target === modal) closeIncomeRecordsModal();
    };
    modal.addEventListener('mousedown', onBackdropClick, { once: true });

    const onKeyDown = (e) => {
        if (e.key === 'Escape') closeIncomeRecordsModal();
    };
    document.addEventListener('keydown', onKeyDown, { once: true });
}

function closeIncomeRecordsModal() {
    const modal = document.getElementById('incomeRecordsModal');
    if (!modal) return;
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
}

function showBookingHistory() {
    const el = document.getElementById('bookingHistory');
    if (!el) return;

    const rows = bookingHistory
        .map((b, index) => ({ b, index }))
        .filter(({ b }) => b && b.type !== 'CHECKOUT')
        .slice(-10)
        .reverse()
        .map(({ b, index }) => {
            const createdAt = b.createdAtISO ? formatDateTime(b.createdAtISO) : (b.date || '');
            const bookingId = escapeHtml(b.bookingId || '');
            const type = b.type || '';
            const room = Number.isFinite(b.room) ? b.room : '';
            const customer = escapeHtml(b.customer || '');

            const customerId = escapeHtml(b.customerId || '');
            const checkInText = b.checkIn ? escapeHtml(formatDateTime(b.checkIn)) : '';

            const badgeClass = type === 'RESERVE'
                ? 'history-badge--reserve'
                : (type === 'CHECKOUT' ? 'history-badge--checkout' : 'history-badge--default');

            const typeHtml = `<span class="history-badge ${badgeClass}">${escapeHtml(type)}</span>`;
            const actionHtml = `
                <div class="history-actions">
                    <button type="button" class="history-action" onclick="viewBooking(${index})">View</button>
                    <button type="button" class="history-action" onclick="editBooking(${index})">Edit</button>
                    <button type="button" class="history-action history-action--danger" onclick="deleteBooking(${index})">Delete</button>
                </div>
            `;

            const customerPhone = escapeHtml(b.customerPhone || '');
            return { createdAt, bookingId, typeHtml, room, customer, customerPhone, customerId, checkInText, actionHtml };
        });

    if (el.tagName === 'TABLE') {
        const tbody = el.querySelector('tbody') || el.appendChild(document.createElement('tbody'));
        tbody.innerHTML = '';
        rows.forEach(r => {
            tbody.innerHTML += `
                <tr>
                    <td>${r.bookingId}</td>
                    <td>${escapeHtml(r.createdAt)}</td>
                    <td>${r.typeHtml}</td>
                    <td>${escapeHtml(r.room)}</td>
                    <td>${r.customer}</td>
                    <td>${r.customerPhone}</td>
                    <td>${r.customerId}</td>
                    <td>${r.checkInText}</td>
                    <td>${r.actionHtml}</td>
                </tr>
            `;
        });
        return;
    }

    // Fallback for older UL layout
    el.innerHTML = '';
    el.classList.add('history-list');
    rows.forEach(r => {
        el.innerHTML += `
            <li class="history-item">
                <div class="history-item__top">
                    ${r.typeHtml}
                    <span class="history-date">${escapeHtml(r.createdAt)}</span>
                </div>
                <div class="history-item__main">
                    <div class="history-title">Room ${escapeHtml(r.room)} • ${r.customer}</div>
                    ${r.bookingId ? `<div class="history-detail">Booking ID: ${r.bookingId}</div>` : ''}
                    ${r.customerId ? `<div class="history-detail">Customer ID: ${r.customerId}</div>` : ''}
                    ${r.checkInText ? `<div class="history-detail">Check-in: ${r.checkInText}</div>` : ''}
                </div>
            </li>
        `;
    });
}

function showTodayArrivalsDepartures() {
    const arrivalsList = document.getElementById('todayArrivals');
    const departuresList = document.getElementById('todayDepartures');

    if (!arrivalsList || !departuresList) return;

    arrivalsList.innerHTML = '';
    departuresList.innerHTML = '';

    const today = new Date().toISOString().slice(0, 10);

    bookingHistory.forEach(b => {
        if (b.type === "RESERVE") {
            const checkInDate = b.checkIn.slice(0, 10);
            const checkOutDate = b.checkOut.slice(0, 10);

            if (checkInDate === today) {
                arrivalsList.innerHTML += `
                    <li>
                        Room ${b.room} – ${b.customer}
                        (${new Date(b.checkIn).toLocaleTimeString()})
                    </li>
                `;
            }

            if (checkOutDate === today) {
                departuresList.innerHTML += `
                    <li>
                        Room ${b.room} – ${b.customer}
                        (${new Date(b.checkOut).toLocaleTimeString()})
                    </li>
                `;
            }
        }
    });

    if (!arrivalsList.innerHTML) arrivalsList.innerHTML = "<li>No arrivals today</li>";
    if (!departuresList.innerHTML) departuresList.innerHTML = "<li>No departures today</li>";
}

function showReservationCalendar() {
    const tableBody = document.querySelector('#reservationCalendar tbody');
    if (!tableBody) return;
    tableBody.innerHTML = '';

    rooms.forEach(room => {
        const row = document.createElement('tr');

        // Room number column
        const roomCell = document.createElement('td');
        roomCell.textContent = `Room ${room.id}`;
        row.appendChild(roomCell);

        // Reservations column
        const resCell = document.createElement('td');
        const roomReservations = bookingHistory.filter(b => b.room === room.id && b.type === "RESERVE");

        if (roomReservations.length === 0) {
            resCell.innerHTML = 'No reservations';
        } else {
            roomReservations.forEach(b => {
                resCell.innerHTML += `
                    <p>
                        ${b.customer}: 
                        ${new Date(b.checkIn).toLocaleString()} → 
                        ${new Date(b.checkOut).toLocaleString()}
                    </p>
                `;
            });
        }

        row.appendChild(resCell);
        tableBody.appendChild(row);
    });
}

async function injectNavbar() {
    const mount = document.getElementById('navbar');
    if (!mount) return;

    try {
        const res = await fetch('nav.html', { cache: 'no-store' });
        if (!res.ok) throw new Error(`Failed to load nav.html (${res.status})`);
        mount.innerHTML = await res.text();
        setActiveNavbarLink(mount);
    } catch (e) {
        // If the site is opened without a web server (file://), fetch may fail.
        console.warn(e);

        // Fallback: render a basic navbar so the UI still works.
        mount.innerHTML = `
            <nav class="nav" aria-label="Main navigation">
                <div class="nav__brand">
                    <div class="nav__company">kandy kaviyan</div>
                    <div class="nav__details">
                        <div class="nav__address">peradeniya rd, Kandy.</div>
                        <div class="nav__phone">0773309991</div>
                    </div>
                </div>
                <div class="nav__links">
                    <a href="index.html">Home</a>
                    <a href="room.html">Room</a>
                    <a href="income.html">Income</a>
                    <a href="kitchen-ingredients.html">Kitchen Ingredients</a>
                </div>
                <div class="nav__logo" aria-label="Company logo">
                    <img src="image/logo.png" alt="kandy kaviyan" />
                </div>
            </nav>
        `;
        setActiveNavbarLink(mount);
    }
}

async function injectSiteHeader() {
    const mount = document.getElementById('siteHeader');
    if (!mount) return;

    try {
        const res = await fetch('header.html', { cache: 'no-store' });
        if (!res.ok) throw new Error(`Failed to load header.html (${res.status})`);
        mount.innerHTML = await res.text();
    } catch (e) {
        // If the site is opened without a web server (file://), fetch may fail.
        console.warn(e);

        // Fallback: render a basic header so the UI still works.
        mount.innerHTML = `
            <header class="company-header" role="banner">
                <div class="company-header__inner">
                    <div class="company-title" aria-label="Company name">
                        <div class="company-name">kandy kaviyan</div>
                    </div>
                    <div class="company-meta company-meta--right" aria-label="Contact details">
                        <div class="company-line">Phone: 0773309991</div>
                        <div class="company-line">peradeniya rd, Kandy.</div>
                    </div>
                </div>
            </header>
        `;
    }
}

function setActiveNavbarLink(scope = document) {
    const links = scope.querySelectorAll('.nav a[href]');
    if (!links.length) return;

    const current = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();

    links.forEach(a => {
        a.removeAttribute('aria-current');
        const href = (a.getAttribute('href') || '').toLowerCase();
        if (href && current.endsWith(href)) {
            a.setAttribute('aria-current', 'page');
        }
    });
}

function init() {
    Promise.allSettled([
        injectNavbar(),
    ]).finally(() => {
        setupBottomNavbarOnScroll();
    });

    consumeFlashMessage();

    loadRooms();
    showIngredients();
    showRoomBookingHistory();
    showBookingHistory();
    showTodayArrivalsDepartures();
    showReservationCalendar();
    showIncome();

    initEditBookingPage();
}

init();

function setupBottomNavbarOnScroll() {
    const topNav = document.querySelector('.nav:not(.nav--bottom)');
    if (!topNav) return;

    // Avoid duplicating if script is loaded twice
    if (document.querySelector('.nav.nav--bottom')) return;

    const bottomNav = topNav.cloneNode(true);
    bottomNav.classList.add('nav--bottom');
    document.body.appendChild(bottomNav);

    // Ensure active link is highlighted in the cloned navbar too
    setActiveNavbarLink(bottomNav);

    const toggle = () => {
        const shouldShow = window.scrollY > 1;
        document.body.classList.toggle('is-scrolled', shouldShow);
    };

    toggle();

    let ticking = false;
    window.addEventListener('scroll', () => {
        if (ticking) return;
        ticking = true;
        window.requestAnimationFrame(() => {
            toggle();
            ticking = false;
        });
    }, { passive: true });
}





