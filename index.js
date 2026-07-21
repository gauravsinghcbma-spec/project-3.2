let categories = {};
let selectedCategoryId = null;
let pendingOrder = null;
let isAdmin = false; // State for admin mode
let currentUser = null;
let userCart = [];
let userFavorites = [];
let userOrders = [];

const defaultCatalog = {
    1: {
        id: 1, name: 'Spiritual Books', image: 'images/books.jpg', description: 'Sacred books and devotional items for spiritual growth.',
        products: [
            { name: 'Bhagavad Gita', image: 'images/bhagavad-gita.jpg', description: 'A timeless spiritual guide with divine teachings.', price: 250, quantity: 10 },
            { name: 'Srimad Bhagavatam', image: 'images/bhagavatam.jpg', description: 'A sacred scripture rich with stories and wisdom.', price: 480, quantity: 5 }
        ]
    },
    2: {
        id: 2, name: 'Clothing', image: 'images/clothing.jpg', description: 'Traditional and comfortable clothing for daily wear and festivals.',
        products: [
            { name: 'Dhoti', image: 'images/dhoti.jpg', description: 'Traditional dhoti made for comfort and simplicity.', price: 799, quantity: 20 },
            { name: 'Kurta', image: 'images/kurta.jpg', description: 'Soft cotton kurta with a classic style.', price: 999, quantity: 15 }
        ]
    },
    3: {
        id: 3, name: 'Pooja Items', image: 'images/pooja.jpg', description: 'Beautiful devotional items for daily worship and rituals.',
        products: [
            { name: 'Tilak Box', image: 'images/tilak-box.jpg', description: 'Elegant tilak box for everyday sacred use.', price: 399, quantity: 30 },
            { name: 'Diya', image: 'images/diya.jpg', description: 'Traditional diya for prayer and festive lighting.', price: 199, quantity: 50 }
        ]
    }
};

async function fetchCatalog() {
    try {
        const response = await fetch('/api/catalog');
        if (!response.ok) throw new Error('Failed to load catalog');
        categories = await response.json();
        const ids = Object.keys(categories);
        selectedCategoryId = ids.length > 0 ? Number(ids[0]) : null;
        renderCategoryBoxes();
        if (selectedCategoryId !== null) showCategory(selectedCategoryId);
    } catch (error) {
        console.error(error);
        showToast('Unable to load catalog. Using default data.', true);
        categories = defaultCatalog;
        const ids = Object.keys(categories);
        selectedCategoryId = ids.length > 0 ? Number(ids[0]) : null;
        renderCategoryBoxes();
        if (selectedCategoryId !== null) showCategory(selectedCategoryId);
    }
}
const menuCartCount = document.getElementById('menu-cart-count');
const userLoginOverlay = document.getElementById('user-login-overlay');
const userLoginContent = document.getElementById('user-login-content');
// DOM references used throughout the app
const productList = document.getElementById('product-list');
const mobileCategories = document.getElementById('mobile-categories');
const typeList = document.getElementById('type-list');
const searchInput = document.querySelector('.input-2');
const overlay = document.getElementById('overlay');
const modalCard = document.getElementById('modal-card');
const userStatus = document.getElementById('user-status');
const headerMenuBtn = document.getElementById('header-menu-btn');
const headerMenuDropdown = document.getElementById('header-menu-dropdown');
const menuLoginBtn = document.getElementById('menu-login-btn');
const menuSignupBtn = document.getElementById('menu-signup-btn');
const menuCartBtn = document.getElementById('menu-cart-btn');
const menuOrdersBtn = document.getElementById('menu-orders-btn');

// ==========================================
// ADMIN LOGIN LOGIC
// ==========================================
const adminBtn = document.getElementById('admin-btn');
const adminBorder = document.getElementById('admin-btn-border');
const adminFront = document.getElementById('admin-btn-front');
const adminBack = document.getElementById('admin-btn-back');
const loginOverlay = document.getElementById('login-overlay');
const welcomeOverlay = document.getElementById('welcome-overlay');
const passwordInput = document.getElementById('admin-password');
const loginSubmit = document.getElementById('login-submit');
const loginCancel = document.getElementById('login-cancel');
const loginTitle = document.getElementById('login-title');
const diagBox = document.querySelector('.diagonal-box');

adminBtn.addEventListener('click', () => {
    if (isAdmin) {
        // Toggle off Admin mode
        isAdmin = false;
        adminBtn.classList.remove('active');
        showToast("Logged out of Admin Mode");
        renderCategoryBoxes();
        showCategory(selectedCategoryId);
        return;
    }

    // Change to red
    adminBtn.classList.add('active');
    loginOverlay.classList.remove('hidden');
    passwordInput.value = '';
    diagBox.classList.remove('error-state');
    loginTitle.innerText = 'Admin Login';
    loginTitle.style.color = '#0b5fff';
});

loginCancel.addEventListener('click', () => {
    loginOverlay.classList.add('hidden');
    adminBtn.classList.remove('active');
});

loginSubmit.addEventListener('click', () => {
    if (passwordInput.value === '@MMM-VOICE-108@') { // Admin Password
        loginOverlay.classList.add('hidden');
        welcomeOverlay.classList.remove('hidden');

        // Welcome message disappears after 2 seconds
        setTimeout(() => {
            welcomeOverlay.classList.add('hidden');
            isAdmin = true;
            showToast("Admin Mode Activated");
            // Reload Main Content to show admin tools
            renderCategoryBoxes();
            showCategory(selectedCategoryId);
        }, 1500);
    } else {
        diagBox.classList.add('error-state');
        loginTitle.innerText = 'Wrong Password!';
        loginTitle.style.color = 'red';
        passwordInput.value = '';
    }
});

headerMenuBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    headerMenuDropdown.classList.toggle('hidden');
});

document.addEventListener('click', () => {
    headerMenuDropdown.classList.add('hidden');
});

headerMenuDropdown.addEventListener('click', (event) => {
    event.stopPropagation();
});

menuLoginBtn.addEventListener('click', () => {
    headerMenuDropdown.classList.add('hidden');
    if (currentUser) {
        logoutUser();
        return;
    }
    openUserLoginModal('login');
});

menuSignupBtn.addEventListener('click', () => {
    headerMenuDropdown.classList.add('hidden');
    openUserLoginModal('signup');
});

menuCartBtn.addEventListener('click', () => {
    headerMenuDropdown.classList.add('hidden');
    if (!currentUser) {
        showToast('Please login to view your cart', true);
        return;
    }
    openCartModal();
});

menuOrdersBtn.addEventListener('click', () => {
    headerMenuDropdown.classList.add('hidden');
    if (!currentUser) {
        showToast('Please login to view your order history', true);
        return;
    }
    openOrdersModal();
});

function openUserLoginModal(mode = 'login', message = '') {
    renderUserAuthModal(mode, message);
    userLoginOverlay.classList.remove('hidden');
}

function renderUserAuthModal(mode = 'login', message = '') {
    let title = 'User Login';
    let body = `
        <input type="text" id="auth-username" placeholder="Username" />
        <input type="password" id="auth-password" placeholder="Password" style="margin-top:10px;" />
        <div class="row" style="margin-top: 15px; gap: 0.5rem;">
            <button id="auth-submit">Login</button>
            <button id="auth-cancel" class="secondary">Cancel</button>
        </div>
        <p class="helper-text">New user? <button id="open-signup" class="link-btn">Create account</button></p>
        <p class="helper-text">Forgot password? <button id="open-reset" class="link-btn">Reset password</button></p>
    `;

    if (mode === 'signup') {
        title = 'Create Account';
        body = `
            <input type="text" id="auth-name" placeholder="Full Name" />
            <input type="text" id="auth-username" placeholder="Username" style="margin-top:10px;" />
            <input type="password" id="auth-password" placeholder="Password" style="margin-top:10px;" />
            <input type="password" id="auth-password-confirm" placeholder="Confirm Password" style="margin-top:10px;" />
            <div class="row" style="margin-top: 15px; gap: 0.5rem;">
                <button id="auth-submit">Create Account</button>
                <button id="auth-cancel" class="secondary">Back</button>
            </div>
            <p class="helper-text">Already have an account? <button id="open-login" class="link-btn">Login here</button></p>
        `;
    }

    if (mode === 'reset') {
        title = 'Reset Password';
        body = `
            <input type="text" id="auth-username" placeholder="Username" />
            <input type="password" id="auth-password" placeholder="New Password" style="margin-top:10px;" />
            <input type="password" id="auth-password-confirm" placeholder="Confirm New Password" style="margin-top:10px;" />
            <div class="row" style="margin-top: 15px; gap: 0.5rem;">
                <button id="auth-submit">Reset Password</button>
                <button id="auth-cancel" class="secondary">Back</button>
            </div>
            <p class="helper-text">Remembered it? <button id="open-login" class="link-btn">Login here</button></p>
        `;
    }

    userLoginContent.innerHTML = `
        <div class="row" style="justify-content: flex-end; margin-bottom: 10px;">
            <button id="user-auth-close" class="secondary" type="button">✕</button>
        </div>
        <h3 style="color: #0b5fff; margin-top:0;">${title}</h3>
        ${body}
        <p id="user-auth-error" class="error-text" style="display:${message ? 'block' : 'none'}; margin-top:10px;">${message}</p>
    `;

    document.getElementById('auth-cancel').addEventListener('click', () => {
        userLoginOverlay.classList.add('hidden');
    });
    const authCloseBtn = document.getElementById('user-auth-close');
    if (authCloseBtn) {
        authCloseBtn.addEventListener('click', () => {
            userLoginOverlay.classList.add('hidden');
        });
    }

    const authSubmit = document.getElementById('auth-submit');
    if (authSubmit) {
        authSubmit.type = 'button';
        authSubmit.addEventListener('click', async () => {
            const username = document.getElementById('auth-username').value.trim();
            const password = document.getElementById('auth-password').value.trim();

            if (!username || !password) {
                return showAuthError('Please enter both username and password.');
            }

            if (mode === 'login') {
                await performLogin(username, password);
                return;
            }

            const confirmPasswordElement = document.getElementById('auth-password-confirm');
            const confirmPassword = confirmPasswordElement ? confirmPasswordElement.value.trim() : '';
            if (!confirmPassword) {
                return showAuthError('Please confirm your password.');
            }
            if (password !== confirmPassword) {
                return showAuthError('Passwords do not match.');
            }

            if (mode === 'signup') {
                const nameInput = document.getElementById('auth-name');
                const name = nameInput ? nameInput.value.trim() || username : username;
                await performSignup(username, password, name);
                return;
            }

            if (mode === 'reset') {
                await performPasswordReset(username, password);
                return;
            }
        });
    }

    const openSignupBtn = document.getElementById('open-signup');
    if (openSignupBtn) {
        openSignupBtn.addEventListener('click', () => renderUserAuthModal('signup'));
    }

    const openResetBtn = document.getElementById('open-reset');
    if (openResetBtn) {
        openResetBtn.addEventListener('click', () => renderUserAuthModal('reset'));
    }

    const openLoginBtn = document.getElementById('open-login');
    if (openLoginBtn) {
        openLoginBtn.addEventListener('click', () => renderUserAuthModal('login'));
    }

    function showAuthError(text) {
        const errorElem = document.getElementById('user-auth-error');
        if (errorElem) {
            errorElem.innerText = text;
            errorElem.style.display = 'block';
        }
    }
}

async function performLogin(username, password) {
    try {
        const response = await fetch('/api/user-login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await response.json();
        if (!data.success) {
            const message = data.message || 'Login failed';
            return renderUserAuthModal('login', message);
        }
        currentUser = data.user;
        userFavorites = currentUser.favorites || [];
        userCart = currentUser.cart || [];
        userOrders = currentUser.orders || [];
        updateUserStatus();
        userLoginOverlay.classList.add('hidden');
        showToast('User logged in successfully');
        updateCartCount();
        renderCategoryBoxes();
        showCategory(selectedCategoryId);
    } catch (err) {
        console.error('User login failed:', err);
        renderUserAuthModal('login', 'Server error, please try again');
    }
}

async function performSignup(username, password, name) {
    try {
        const response = await fetch('/api/user-signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, name })
        });
        const data = await response.json();
        if (!data.success) {
            return renderUserAuthModal('signup', data.message || 'Could not create account');
        }
        currentUser = data.user;
        userFavorites = currentUser.favorites || [];
        userCart = currentUser.cart || [];
        userOrders = currentUser.orders || [];
        updateUserStatus();
        userLoginOverlay.classList.add('hidden');
        showToast('Account created and logged in');
        updateCartCount();
        renderCategoryBoxes();
        showCategory(selectedCategoryId);
    } catch (err) {
        console.error('Signup failed:', err);
        renderUserAuthModal('signup', 'Server error, please try again');
    }
}

async function performPasswordReset(username, password) {
    try {
        const response = await fetch('/api/user-reset', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await response.json();
        if (!data.success) {
            return renderUserAuthModal('reset', data.message || 'Could not reset password');
        }
        showToast('Password reset successfully. Please login.');
        renderUserAuthModal('login', 'Password updated. Please login.');
    } catch (err) {
        console.error('Password reset failed:', err);
        renderUserAuthModal('reset', 'Server error, please try again');
    }
}

function updateUserStatus() {
    // Always show only the user icon in header; do not display username directly
    userStatus.innerHTML = '<span class="user-icon">👤</span>';
    userStatus.title = currentUser ? currentUser.name : 'Login to continue';
    // Update greeting in the main search box instead of showing username in header
    if (searchInput) {
        searchInput.placeholder = currentUser ? `Hello, ${currentUser.name}` : 'Hare Krishna';
    }
    menuLoginBtn.textContent = currentUser ? 'Logout' : 'User Login';
    if (menuSignupBtn) {
        if (currentUser) menuSignupBtn.classList.add('hidden');
        else menuSignupBtn.classList.remove('hidden');
    }
}

function updateCartCount() {
    const totalCount = userCart.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    menuCartCount.textContent = totalCount;
}

function logoutUser() {
    currentUser = null;
    userCart = [];
    userFavorites = [];
    userOrders = [];
    updateUserStatus();
    updateCartCount();
    showToast('Logged out successfully');
}

function findProductByName(productName) {
    for (const categoryId in categories) {
        const category = categories[categoryId];
        for (const product of category.products) {
            if (product.name === productName) {
                return { product, categoryId };
            }
        }
    }
    return null;
}

function getProductImages(product) {
    if (!product) return ['SP2.jpeg'];
    if (Array.isArray(product.images) && product.images.length) return product.images;
    if (product.image) return [product.image];
    return ['SP2.jpeg'];
}

function getProductPrimaryImage(product) {
    return getProductImages(product)[0] || 'SP2.jpeg';
}

function renderStars(rating) {
    const clampRating = Math.max(0, Math.min(5, Number(rating) || 0));
    const fullStars = Math.floor(clampRating);
    const halfStar = clampRating - fullStars >= 0.5;
    let stars = '';
    for (let i = 0; i < fullStars; i += 1) stars += '★';
    if (halfStar) stars += '☆';
    while (stars.length < 5) stars += '☆';
    return `<span class="rating-stars">${stars}</span>`;
}

async function updateFavoriteOnServer(productName, action) {
    if (!currentUser) {
        showToast('Login to update favorites', true);
        return;
    }
    try {
        const response = await fetch('/api/user-favorite', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: currentUser.username, productName, action })
        });
        const result = await response.json();
        if (result.success) {
            userFavorites = result.favorites;
            currentUser.favorites = userFavorites;
            renderCategoryBoxes();
            showCategory(selectedCategoryId);
            showToast(action === 'add' ? 'Added to favorites' : 'Removed from favorites');
        } else {
            showToast(result.message || 'Could not update favorites', true);
        }
    } catch (err) {
        console.error('Favorite update failed', err);
        showToast('Could not update favorites', true);
    }
}

async function updateCartOnServer(productName, quantity, action) {
    if (!currentUser) {
        showToast('Login to update cart', true);
        return null;
    }
    try {
        const response = await fetch('/api/user-cart', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: currentUser.username, productName, quantity, action })
        });
        const result = await response.json();
        if (result.success) {
            userCart = result.cart;
            currentUser.cart = userCart;
            updateCartCount();
            return userCart;
        }
        showToast(result.message || 'Cart update failed', true);
        return null;
    } catch (err) {
        console.error('Cart update failed', err);
        showToast('Cart update failed', true);
        return null;
    }
}

async function addToCart(product, quantity = 1) {
    if (!currentUser) {
        showToast('Login to add items to cart', true);
        return;
    }
    await updateCartOnServer(product.name, quantity, 'add');
    renderCategoryBoxes();
}

async function removeFromCart(productName) {
    await updateCartOnServer(productName, 0, 'remove');
}

async function clearCart() {
    if (!currentUser) return;
    await updateCartOnServer('', 0, 'clear');
}

function openCartModal() {
    const cartItems = userCart || [];
    modalCard.innerHTML = `
        <h2>Your Cart</h2>
        <div class="cart-list"></div>
        <div class="row" style="justify-content: space-between; gap: 0.75rem; margin-top: 1rem;">
            <button id="clear-cart">Clear Cart</button>
            <button id="close-modal" class="secondary">Close</button>
        </div>
    `;
    overlay.classList.remove('hidden');

    const cartList = modalCard.querySelector('.cart-list');
    if (cartItems.length === 0) {
        cartList.innerHTML = '<p>Your cart is empty. Add a product to continue.</p>';
    } else {
        cartItems.forEach((item) => {
            const productRef = findProductByName(item.productName);
            const productDetails = productRef?.product || {};
            const price = productDetails.price || 0;
            const subtotal = price * item.quantity;
            const itemRow = document.createElement('div');
            itemRow.className = 'cart-item';
            itemRow.innerHTML = `
                <img src="${getProductPrimaryImage(productDetails)}" alt="${item.productName}" class="cart-thumb" />
                <div style="flex:1; min-width:0; margin-left:0.75rem;">
                    <strong style="display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${item.productName}</strong>
                    <p class="small" style="margin:6px 0 8px;">${productDetails.description || ''}</p>
                    <p class="small">Price: ₹${price} | Subtotal: ₹${subtotal}</p>
                </div>
                <div class="cart-actions" style="min-width:160px; display:flex; flex-direction:column; gap:8px; align-items:flex-end;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <button class="secondary qty-decr" type="button">−</button>
                        <span class="qty-count">${item.quantity}</span>
                        <button class="primary qty-incr" type="button">+</button>
                    </div>
                    <div style="display:flex; gap:6px;">
                        <button class="secondary remove-cart" type="button">Remove</button>
                        <button class="primary checkout-cart" type="button">Checkout</button>
                    </div>
                </div>
            `;

            const removeBtn = itemRow.querySelector('.remove-cart');
            const checkoutBtn = itemRow.querySelector('.checkout-cart');
            const incrBtn = itemRow.querySelector('.qty-incr');
            const decrBtn = itemRow.querySelector('.qty-decr');
            const qtyCount = itemRow.querySelector('.qty-count');

            removeBtn.addEventListener('click', async () => {
                await removeFromCart(item.productName);
                openCartModal();
            });

            incrBtn.addEventListener('click', async () => {
                const newQty = Number(item.quantity || 0) + 1;
                // animate the count briefly
                qtyCount.classList.add('qty-pulse');
                await updateCartOnServer(item.productName, newQty, 'update');
                setTimeout(() => openCartModal(), 180);
            });

            decrBtn.addEventListener('click', async () => {
                const newQty = Number(item.quantity || 0) - 1;
                qtyCount.classList.add('qty-pulse');
                if (newQty <= 0) {
                    await removeFromCart(item.productName);
                    setTimeout(() => openCartModal(), 180);
                } else {
                    await updateCartOnServer(item.productName, newQty, 'update');
                    setTimeout(() => openCartModal(), 180);
                }
            });

            checkoutBtn.addEventListener('click', () => {
                if (!productDetails) {
                    showToast('Product not available for checkout', true);
                    return;
                }
                pendingOrder = { product: productDetails, quantity: item.quantity, source: 'cart' };
                openPaymentModal(productDetails, item.quantity);
            });

            cartList.appendChild(itemRow);
        });
    }

    document.getElementById('clear-cart').addEventListener('click', async () => {
        await clearCart();
        openCartModal();
    });
    document.getElementById('close-modal').addEventListener('click', closeModal);
}

function openOrdersModal() {
    const orders = currentUser?.orders || [];
    modalCard.innerHTML = `
        <h2>Order History</h2>
        <div class="order-list"></div>
        <div class="row" style="justify-content: flex-end; gap: 0.75rem; margin-top: 1rem;">
            <button id="close-modal" class="secondary">Close</button>
        </div>
    `;
    overlay.classList.remove('hidden');

    const orderList = modalCard.querySelector('.order-list');
    if (orders.length === 0) {
        orderList.innerHTML = '<p>You have no orders yet.</p>';
    } else {
        orders.slice().reverse().forEach((order) => {
            const orderRow = document.createElement('div');
            orderRow.className = 'order-item';
            orderRow.innerHTML = `
                <div>
                    <strong>${order.productName}</strong>
                    <p class="small">Qty: ${order.quantity} | Amount: ₹${order.amount} | Status: ${order.status || 'COMPLETED'}</p>
                    <p class="small">Transaction: ${order.transactionId || 'N/A'} | Ref: ${order.referenceId || 'N/A'}</p>
                    <p class="rating-summary">Rating: ${order.rating ? '<span class="rating-stars">' + '★'.repeat(Math.min(5, order.rating)) + '</span>' : 'Not rated yet'}</p>
                </div>
                <div class="order-actions"></div>
            `;
            const actions = orderRow.querySelector('.order-actions');
            if (!order.rating) {
                const rateBtn = document.createElement('button');
                rateBtn.className = 'primary';
                rateBtn.innerText = 'Rate Product';
                rateBtn.addEventListener('click', () => openRateModal(order));
                actions.appendChild(rateBtn);
            }
            orderList.appendChild(orderRow);
        });
    }

    document.getElementById('close-modal').addEventListener('click', closeModal);
}

function openRateModal(order) {
    modalCard.innerHTML = `
        <h2>Rate ${order.productName}</h2>
        <p class="small">How was your experience with this product?</p>
        <div class="rating-choice">
            <button data-rating="1">★</button>
            <button data-rating="2">★</button>
            <button data-rating="3">★</button>
            <button data-rating="4">★</button>
            <button data-rating="5">★</button>
        </div>
        <div class="row">
            <button id="save-rating">Save Rating</button>
            <button id="cancel-rate" class="secondary">Cancel</button>
        </div>
    `;

    let selectedRating = 5;
    const ratingButtons = [...modalCard.querySelectorAll('.rating-choice button')];
    ratingButtons.forEach((button) => {
        button.addEventListener('click', () => {
            selectedRating = Number(button.dataset.rating);
            ratingButtons.forEach((btn) => btn.classList.toggle('active', btn === button));
        });
    });
    ratingButtons[ratingButtons.length - 1].classList.add('active');

    document.getElementById('save-rating').addEventListener('click', async () => {
        const success = await rateOrderInServer(order.transactionId, selectedRating);
        if (success) {
            openOrdersModal();
        }
    });
    document.getElementById('cancel-rate').addEventListener('click', closeModal);
}

// ==========================================
// RENDERING LOGIC
// ==========================================

function getFilteredCategories() {
    const query = searchInput.value.trim().toLowerCase();
    if (!query) return Object.values(categories);
    return Object.values(categories).filter((category) => {
        const categoryText = `${category.name} ${category.description}`.toLowerCase();
        const matchesCategory = categoryText.includes(query);
        const matchesProducts = category.products.some((product) => {
            const productText = `${product.name} ${product.description}`.toLowerCase();
            return productText.includes(query);
        });
        return matchesCategory || matchesProducts;
    });
}

function renderCategoryBoxes() {
    productList.innerHTML = '';
    mobileCategories.innerHTML = '';
    const filteredCategories = getFilteredCategories();

    filteredCategories.forEach((category) => {
        const box = document.createElement('div');
        box.className = 'product';
        box.id = category.id;
        if (category.id === selectedCategoryId) box.classList.add('selected');

        // Only edit button on the outside, squared off by CSS
        // Find this section in renderCategoryBoxes and replace it with:
        let adminHtml = isAdmin ? `
    <div class="admin-actions">
        <button onclick="openCategoryForm(${category.id}, event)">+</button>
    </div>
` : '';

        box.innerHTML = `
            ${adminHtml}
            <img src="${category.image}" alt="${category.name}" onerror="this.onerror=null;this.src='SP2.jpeg'" />
            <strong>${category.name}</strong>
        `;
        box.addEventListener('click', () => showCategory(category.id));
        productList.appendChild(box);

        const mobileChip = document.createElement('button');
        mobileChip.className = 'mobile-chip';
        mobileChip.innerHTML = `
            <img src="${category.image}" alt="${category.name}" onerror="this.onerror=null;this.src='SP2.jpeg'" />
            <span>${category.name}</span>
        `;
        if (category.id === selectedCategoryId) mobileChip.classList.add('active');
        mobileChip.addEventListener('click', () => showCategory(category.id));
        mobileCategories.appendChild(mobileChip);
    });

    // Add Category button if Admin
    if (isAdmin && !searchInput.value.trim()) {
        const addCatBox = document.createElement('div');
        addCatBox.className = 'product';
        addCatBox.style.backgroundColor = 'rgba(11, 95, 255, 0.2)';
        addCatBox.style.border = '2px dashed #0b5fff';
        addCatBox.innerHTML = `<strong>+ Add Category</strong>`;
        addCatBox.addEventListener('click', () => openCategoryForm());
        productList.appendChild(addCatBox);
    }
}

function showCategory(id) {
    if (!categories[id]) return; // Fallback if category deleted
    selectedCategoryId = id;
    renderCategoryBoxes();

    const category = categories[id];
    typeList.innerHTML = '';

    const heading = document.createElement('div');
    heading.className = 'types-of-product';
    heading.style.width = '100%';
    heading.style.height = 'auto';
    heading.style.backgroundColor = '#FFFFFF';
    heading.style.color = 'black';

    const query = searchInput.value.trim().toLowerCase();
    if (query) {
        heading.innerHTML = `<h3>Search Results</h3><p>Items matching "${query}"</p>`;
    } else {
        heading.innerHTML = `<h3>${category.name}</h3><p>${category.description}</p>`;
    }
    typeList.appendChild(heading);

    // Add Product Card for Admin
    if (isAdmin && !query) {
        const addProductCard = document.createElement('div');
        addProductCard.className = 'types-of-product add-product-card';
        addProductCard.innerHTML = `<div>+ Add Product</div>`;
        addProductCard.addEventListener('click', () => openProductForm(id));
        typeList.appendChild(addProductCard);
    }

    const visibleProducts = query
        ? Object.values(categories).flatMap((cat) =>
            cat.products
                .filter((product) => {
                    const productText = `${product.name} ${product.description}`.toLowerCase();
                    return productText.includes(query);
                })
                .map((product, index) => ({ ...product, categoryId: cat.id, index: index, categoryName: cat.name }))
        )
        : category.products.map((product, index) => ({ ...product, categoryId: category.id, index: index, categoryName: category.name }));

    if (visibleProducts.length === 0 && !isAdmin) {
        const emptyState = document.createElement('div');
        emptyState.className = 'types-of-product';
        emptyState.style.width = '100%';
        emptyState.style.height = 'auto';
        emptyState.innerHTML = `<p>No matching products found.</p>`;
        typeList.appendChild(emptyState);
        return;
    }

    visibleProducts.forEach((product) => {
        const card = document.createElement('div');
        card.className = 'types-of-product';

        // Only edit button on the card, square.
        // Find this section in showCategory and replace it with:
        let adminHtml = isAdmin ? `
            <div class="admin-actions">
                <button onclick="openProductForm(${product.categoryId}, ${product.index}, event)">+</button>
            </div>
            ` : '';

        card.innerHTML = `
            ${adminHtml}
            <img src="${getProductPrimaryImage(product)}" alt="${product.name}" onerror="this.onerror=null;this.src='SP2.jpeg'" />
            <strong>${product.name}</strong>
            <p>${product.description}</p>
            <p class="small">Category: ${product.categoryName} | Qty: ${product.quantity || 'N/A'}</p>
            <div class="price">₹${product.price}</div>
            <div class="product-actions">
                <button class="product-action-btn add-to-cart">Add to Cart</button>
                <button class="product-action-btn favorite-toggle">${userFavorites.includes(product.name) ? '★ Favorite' : '☆ Favorite'}</button>
            </div>
        `;

        // Clicking the whole card opens standard flow based on user role
        if (isAdmin) {
            card.addEventListener('click', () => openProductForm(product.categoryId, product.index));
        } else {
            card.addEventListener('click', () => openProductModal(product));
        }

        const addToCartButton = card.querySelector('.add-to-cart');
        const favoriteToggle = card.querySelector('.favorite-toggle');

        addToCartButton?.addEventListener('click', (event) => {
            event.stopPropagation();
            addToCart(product, 1);
        });

        favoriteToggle?.addEventListener('click', (event) => {
            event.stopPropagation();
            if (!currentUser) {
                showToast('Please login to save favorites', true);
                return;
            }
            const action = userFavorites.includes(product.name) ? 'remove' : 'add';
            updateFavoriteOnServer(product.name, action);
        });

        typeList.appendChild(card);
    });
}

// ==========================================
// USER MODALS (Order & Payment)
// ==========================================

function openProductModal(product) {
    if (isAdmin) return;

    const images = getProductImages(product);
    modalCard.innerHTML = `
        <h2>${product.name}</h2>
        <div class="product-gallery">
            <button id="gallery-prev" class="secondary" type="button">◀</button>
            <div class="gallery-frame">
                <img id="gallery-image" src="${images[0]}" alt="${product.name}" onerror="this.onerror=null;this.src='SP2.jpeg'" />
            </div>
            <button id="gallery-next" class="secondary" type="button">▶</button>
        </div>
        <div class="product-gallery-controls">
            <button id="zoom-in" class="secondary">Zoom +</button>
            <button id="zoom-out" class="secondary">Zoom −</button>
        </div>
        <p id="gallery-desc">${product.description}</p>
        <p class="small">Available Quantity: ${product.quantity || 'N/A'}</p>
        <div class="row">
            <strong>Price: ₹${product.price}</strong>
            <input type="number" id="quantity" min="1" max="${product.quantity || 20}" value="1" />
        </div>
        <div class="row">
            <button id="place-order">Order Now</button>
            <button id="add-to-cart">Add to Cart</button>
            <button id="close-modal" class="secondary">Close</button>
        </div>
    `;
    overlay.classList.remove('hidden');

    const galleryImages = images.slice();
    let galleryIndex = 0;
    const galleryImg = document.getElementById('gallery-image');
    let scale = 1;

    function showGalleryIndex(i) {
        galleryIndex = (i + galleryImages.length) % galleryImages.length;
        galleryImg.src = galleryImages[galleryIndex] || 'SP2.jpeg';
        scale = 1;
        galleryImg.style.transform = `scale(${scale})`;
    }

    document.getElementById('gallery-prev').addEventListener('click', (e) => { e.stopPropagation(); showGalleryIndex(galleryIndex - 1); });
    document.getElementById('gallery-next').addEventListener('click', (e) => { e.stopPropagation(); showGalleryIndex(galleryIndex + 1); });
    document.getElementById('zoom-in').addEventListener('click', (e) => { e.stopPropagation(); scale = Math.min(3, scale + 0.25); galleryImg.style.transform = `scale(${scale})`; });
    document.getElementById('zoom-out').addEventListener('click', (e) => { e.stopPropagation(); scale = Math.max(1, scale - 0.25); galleryImg.style.transform = `scale(${scale})`; });

    // Touch / swipe support
    let touchStartX = 0;
    galleryImg.addEventListener('touchstart', (ev) => { touchStartX = ev.touches[0].clientX; });
    galleryImg.addEventListener('touchend', (ev) => {
        const diff = (ev.changedTouches[0].clientX - touchStartX);
        if (diff > 50) showGalleryIndex(galleryIndex - 1);
        else if (diff < -50) showGalleryIndex(galleryIndex + 1);
    });

    document.getElementById('place-order').addEventListener('click', () => {
        const quantity = Number(document.getElementById('quantity').value || 1);
        pendingOrder = { product, quantity };
        openPaymentModal(product, quantity);
    });
    document.getElementById('add-to-cart').addEventListener('click', async () => {
        const quantity = Number(document.getElementById('quantity').value || 1);
        if (!currentUser) {
            showToast('Please login to add items to cart', true);
            return;
        }
        await addToCart(product, quantity);
        showToast('Item added to cart');
        closeModal();
    });
    document.getElementById('close-modal').addEventListener('click', closeModal);
}

function openPaymentModal(product, quantity) {
    const totalAmount = product.price * quantity;
    window.currentOrder = { product, quantity, totalAmount };
    window.currentTransaction = null;
    
    modalCard.innerHTML = `
        <h3>💳 UPI Payment</h3>
        <p class="small" style="color: #2196F3;"><strong>✓ Real Payment via UPI</strong></p>
        
        <div style="border: 1px solid #ddd; padding: 15px; border-radius: 8px; background: #f9f9f9; margin: 15px 0;">
            <p><strong>📦 Order Summary:</strong></p>
            <p style="margin: 5px 0;">Product: <strong>${product.name}</strong></p>
            <p style="margin: 5px 0;">Quantity: <strong>${quantity}</strong></p>
            <p style="margin: 5px 0;">Price: <strong>₹${product.price} × ${quantity}</strong></p>
            <hr style="margin: 10px 0; border: none; border-top: 1px solid #ddd;">
            <p style="margin: 5px 0; font-size: 1.2em;"><strong>Total Amount: ₹${totalAmount}</strong></p>
        </div>

        <div style="text-align: center; margin: 15px 0;">
            <p style="margin: 10px 0;"><strong>📱 Payment via UPI</strong></p>
            <p style="margin: 10px 0; color: #666; font-size: 0.9em;">Scan QR code or click UPI Link to pay</p>
            <div id="qr-code-container" style="background: white; padding: 10px; border-radius: 8px; display: inline-block; border: 1px solid #ddd;">
                <img id="qr-code" src="" alt="UPI QR Code" style="width: 200px; height: 200px;">
            </div>
            <div style="margin-top:10px;">
                <!-- PhonePe option removed: use UPI QR or link and verify by reference -->
            </div>
            <p style="margin: 10px 0; color: #666; font-size: 0.85em;">UPI ID: <strong>g47128163@oksbi</strong> (pay only to this UPI ID)</p>
        </div>

        <div style="margin: 15px 0;">
            <p style="margin: 10px 0;"><strong>After Payment:</strong></p>
            <p style="margin: 5px 0; color: #666; font-size: 0.9em;">You will get a Transaction Reference ID in your bank app or SMS. Enter the exact reference for this payment.</p>
            <input type="text" id="ref-id" placeholder="Enter exact transaction reference shown in SMS or UPI app" style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 4px; margin: 10px 0; font-size: 0.9em;">
            <p style="margin: 5px 0; color: #999; font-size: 0.85em;">📋 This must match the transaction reference from your bank or UPI app for this order.</p>
            <p id="payment-reference-hint" style="margin: 5px 0; color: #e53935; font-size: 0.9em; font-weight: bold;"></p>
            <div id="payment-loading" class="payment-loading hidden">Please wait payment is verifying.</div>
            <p id="transaction-id-display" class="small" style="margin-top:8px; color:#333; font-weight:bold;"></p>
        </div>

        <div class="row">
            <button id="verify-payment" style="background: linear-gradient(135deg, #4CAF50, #45a049); border: none; cursor: pointer; flex: 1;">✓ Verify Payment</button>
            <button id="close-modal" class="secondary" style="flex: 1;">Cancel</button>
        </div>
    `;

    // Load UPI QR Code
    loadUPIQRCode(product, quantity, totalAmount);

    document.getElementById('verify-payment').addEventListener('click', () => verifyUPIPayment(product, quantity, totalAmount));
    document.getElementById('close-modal').addEventListener('click', closeModal);
    // PhonePe removed: no provider redirect button
}

// PhonePe integration removed. Server-side webhooks remain, but client will
// use UPI QR + manual verification flow only.

async function loadUPIQRCode(product, quantity, totalAmount) {
    if (!product || !window.currentOrder) {
        showToast('Unable to start payment. Please close and try again.', true);
        closeModal();
        return;
    }

    const verifyBtn = document.getElementById('verify-payment');
    if (verifyBtn) verifyBtn.disabled = true;

    try {
        const response = await fetch('/api/create-upi-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                amount: totalAmount,
                productName: product.name,
                quantity,
                username: currentUser?.username || null
            })
        });

        if (!response.ok) throw new Error('Failed to generate QR code');
        const data = await response.json();

        // Store transaction ID for verification
        window.currentTransaction = data;

        // Display transaction ID prominently so user can cross-check in their bank app
        const txDisplay = document.getElementById('transaction-id-display');
        if (txDisplay) txDisplay.textContent = `Transaction ID: ${data.transactionId} — use this when checking your bank/UPI app`;

        if (verifyBtn) verifyBtn.disabled = false;

        // Display QR code
        document.getElementById('qr-code').src = data.qrCode;
        document.getElementById('qr-code').style.cursor = 'pointer';
        
        // Make QR code clickable for direct UPI link
        document.getElementById('qr-code').addEventListener('click', () => {
            window.location.href = data.upiLink;
        });

        const hint = document.getElementById('payment-reference-hint');
        if (hint) {
            hint.textContent = 'Enter the UPI transaction reference shown in your bank app or SMS after payment.';
        }

    } catch (error) {
        console.error('QR code error:', error);
        showToast('Failed to load UPI QR code. Please try again.', true);
    }
}

async function verifyUPIPayment(product, quantity, totalAmount) {
    const referenceId = document.getElementById('ref-id').value.replace(/\s+/g, '').toUpperCase();

    if (!window.currentTransaction || !window.currentTransaction.transactionId) {
        showToast('Payment session expired. Please restart the order.', true);
        return;
    }

    if (!referenceId) {
        showToast('Please enter your Transaction Reference ID', true);
        return;
    }

    const validRefPattern = /^[A-Z0-9]{6,30}$/;
    if (!validRefPattern.test(referenceId)) {
        showToast('Enter a valid UPI transaction reference ID (letters and numbers only).', true);
        return;
    }

    try {
        const verifyBtn = document.getElementById('verify-payment');
        const closeBtn = document.getElementById('close-modal');
        const loadingElem = document.getElementById('payment-loading');
        if (verifyBtn) verifyBtn.disabled = true;
        if (closeBtn) closeBtn.disabled = true;
        if (loadingElem) loadingElem.classList.remove('hidden');

        const response = await fetch('/api/verify-upi-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                transactionId: window.currentTransaction.transactionId,
                referenceId: referenceId,
                amount: window.currentTransaction.amount,
                productName: window.currentTransaction.productName,
                quantity,
                username: currentUser?.username
            })
        });

        const verifyData = await response.json();
        if (loadingElem) loadingElem.classList.add('hidden');
        if (verifyBtn) verifyBtn.disabled = false;
        if (closeBtn) closeBtn.disabled = false;

        if (verifyData.pending) {
            // Show message that verification is in progress and owner will contact later
            showPendingVerificationModal(product, quantity, totalAmount, referenceId, window.currentTransaction.transactionId);
            return;
        }

        if (verifyData.success) {
            // Payment verified! Now process order
            pendingOrder = { product, quantity, source: pendingOrder?.source || 'direct' };
            if (currentUser && pendingOrder.source === 'cart') {
                await removeFromCart(product.name);
            }
            const orderRecord = {
                transactionId: window.currentTransaction.transactionId,
                referenceId,
                productName: product.name,
                amount: totalAmount,
                quantity,
                status: 'COMPLETED',
                createdAt: verifyData.verifiedAt || new Date().toISOString()
            };
            if (currentUser) {
                currentUser.orders = currentUser.orders || [];
                currentUser.orders.push(orderRecord);
                userOrders = currentUser.orders;
            }
            const success = await processOrderAndDecreaseQuantity();
            if (success) {
                    showUPIPaymentSuccessModal(product, quantity, totalAmount, referenceId, window.currentTransaction.transactionId);
                    // Also show diagonal success box with quick send options
                    if (diagBox) {
                        const message = `Payment successful. Product: ${product.name} | Amount: ₹${totalAmount} | Reference: ${referenceId} | Transaction: ${window.currentTransaction.transactionId}`;
                        diagBox.classList.remove('error-state');
                        diagBox.innerHTML = `
                            <div style="padding:12px; color:#fff;">
                                <strong style="display:block;">Payment Successful</strong>
                                <p style="margin:8px 0; font-size:0.9em;">${message}</p>
                                <div style="display:flex; gap:8px; margin-top:8px;">
                                    <button id="diag-send-phone" class="primary">Send to Phone</button>
                                    <button id="diag-send-email" class="primary">Send to Email</button>
                                </div>
                            </div>
                        `;
                        diagBox.classList.add('show-diag');
                        const diagPhone = document.getElementById('diag-send-phone');
                        const diagEmail = document.getElementById('diag-send-email');
                        if (diagPhone) diagPhone.addEventListener('click', () => { window.location.href = `sms:7906424387?body=${encodeURIComponent(message)}`; });
                        if (diagEmail) diagEmail.addEventListener('click', () => { window.location.href = `mailto:gauravsingha.cbm@gmail.com?subject=Order%20Confirmation&body=${encodeURIComponent(message)}`; });
                    }
            }
        } else {
            const message = verifyData.message || verifyData.error || 'Payment verification failed. Please check the reference ID and try again.';
            showToast(`Payment verification failed: ${message}`, true);
        }
    } catch (error) {
        const verifyBtn = document.getElementById('verify-payment');
        const closeBtn = document.getElementById('close-modal');
        const loadingElem = document.getElementById('payment-loading');
        if (loadingElem) loadingElem.classList.add('hidden');
        if (verifyBtn) verifyBtn.disabled = false;
        if (closeBtn) closeBtn.disabled = false;
        console.error('Verification error:', error);
        showToast('Verification failed. Please try again.', true);
    }
}

function showUPIPaymentSuccessModal(product, quantity, totalAmount, referenceId, transactionId) {
    const message = `Hello! Payment successful via UPI! Product: ${product.name}, Quantity: ${quantity}, Amount: ₹${totalAmount}, Reference ID: ${referenceId}`;
    
    modalCard.innerHTML = `
        <h3 style="color: #4CAF50;">✓ Payment Successful</h3>
        <div style="text-align: center; margin: 20px 0;">
            <p style="font-size: 3em;">✓</p>
            <p style="color: #4CAF50; font-weight: bold; font-size: 1.2em;">Payment Received & Verified!</p>
        </div>
        
        <div style="border: 2px solid #4CAF50; padding: 15px; border-radius: 8px; background: #f0fff4; margin: 15px 0;">
            <p style="margin: 5px 0;"><strong>✓ Order Confirmed!</strong></p>
            <p style="margin: 5px 0; color: #666;">Your order has been placed successfully.</p>
            <hr style="margin: 10px 0; border: none; border-top: 1px solid #ddd;">
            <p style="margin: 5px 0;"><strong>Transaction ID:</strong> ${transactionId}</p>
            <p style="margin: 5px 0;"><strong>Reference ID:</strong> ${referenceId}</p>
            <p style="margin: 5px 0;"><strong>Amount Paid:</strong> ₹${totalAmount}</p>
            <p style="margin: 5px 0;"><strong>Product:</strong> ${product.name}</p>
            <p style="margin: 5px 0;"><strong>Quantity:</strong> ${quantity}</p>
            <p style="margin: 5px 0; color: #2196F3;"><strong>Status:</strong> COMPLETED ✓</p>
        </div>

        <div class="row">
            <button id="send-phone">📱 Send to Phone</button>
            <button id="send-email">📧 Send to Email</button>
        </div>
        <div class="row" style="display:block; margin-top:1rem;">
            <p><strong>Order Message:</strong></p>
            <textarea id="message-copy" rows="3" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">${message}</textarea>
        </div>
        <div class="row">
            <button id="copy-message">Copy Message</button>
            <button id="close-modal" class="secondary">Close</button>
        </div>
    `;

    document.getElementById('send-phone').addEventListener('click', () => {
        window.location.href = `sms:7906424387?body=${encodeURIComponent(message)}`;
        closeModal();
    });
    document.getElementById('send-email').addEventListener('click', () => {
        window.location.href = `mailto:gauravsingha.cbm@gmail.com?subject=Order%20Confirmation&body=${encodeURIComponent(message)}`;
        closeModal();
    });
    document.getElementById('copy-message').addEventListener('click', async () => {
        const textArea = document.getElementById('message-copy');
        textArea.select();
        await navigator.clipboard.writeText(textArea.value);
        showToast('Message copied to clipboard');
    });
    document.getElementById('close-modal').addEventListener('click', closeModal);
}

function showPendingVerificationModal(product, quantity, totalAmount, referenceId, transactionId) {
    const displayName = currentUser?.name || 'Guest User';
    const message = `We have received your payment details and will verify your payment shortly. Reference ID: ${referenceId} | Product: ${product.name} | Transaction: ${transactionId}`;
    modalCard.innerHTML = `
        <h3 style="color: #FFA000;">⏳ Payment Submitted for Verification</h3>
        <div style="text-align: center; margin: 20px 0;">
            <p style="font-size: 2.5em;">⏳</p>
            <p style="color: #FFA000; font-weight: bold; font-size: 1.1em;">We will verify your payment and later contact you soon.</p>
        </div>
        <div style="border: 1px solid #ffd54f; padding: 12px; border-radius: 8px; background: #fff8e1; margin: 10px 0;">
            <p style="margin:6px 0;"><strong>Name:</strong> ${displayName}</p>
            <p style="margin:6px 0;"><strong>Transaction ID:</strong> ${transactionId}</p>
            <p style="margin:6px 0;"><strong>Reference ID:</strong> ${referenceId}</p>
            <p style="margin:6px 0;"><strong>Product:</strong> ${product.name}</p>
            <p style="margin:6px 0;"><strong>Quantity:</strong> ${quantity}</p>
            <p style="margin:6px 0;"><strong>Amount:</strong> ₹${totalAmount}</p>
        </div>
        <div style="margin-top:8px;">
            <p class="small">You will be contacted once we complete verification. Keep this reference for your records.</p>
        </div>
        <div class="row" style="margin-top:12px; gap: 10px;">
            <button id="proceed-further" class="primary">Proceed Further</button>
            <button id="close-modal" class="secondary">Close</button>
        </div>
    `;

    document.getElementById('proceed-further').addEventListener('click', () => {
        showVerificationSendBox(displayName, referenceId, product, quantity, totalAmount, transactionId);
    });
    document.getElementById('close-modal').addEventListener('click', closeModal);
}

function showVerificationSendBox(name, referenceId, product, quantity, totalAmount, transactionId) {
    const messageBody = `Name: ${name}\nReference ID: ${referenceId}\nProduct: ${product.name}\nQuantity: ${quantity}\nAmount: ₹${totalAmount}\nTransaction ID: ${transactionId}`;
    modalCard.innerHTML = `
        <h3 style="color: #1976D2;">📨 Send Verification Details</h3>
        <div style="border: 1px solid #bbdefb; padding: 14px; border-radius: 10px; background: #e3f2fd; margin: 10px 0;">
            <p style="margin: 6px 0;"><strong>Name:</strong> ${name}</p>
            <p style="margin: 6px 0;"><strong>Reference ID:</strong> ${referenceId}</p>
            <p style="margin: 6px 0;"><strong>Product:</strong> ${product.name}</p>
            <p style="margin: 6px 0;"><strong>Quantity:</strong> ${quantity}</p>
            <p style="margin: 6px 0;"><strong>Amount:</strong> ₹${totalAmount}</p>
            <p style="margin: 6px 0;"><strong>Transaction ID:</strong> ${transactionId}</p>
        </div>
        <textarea id="verification-message-body" rows="6" style="width:100%; padding:10px; border:1px solid #90caf9; border-radius:8px;">${messageBody}</textarea>
        <div class="row" style="margin-top:12px; gap: 10px;">
            <button id="send-by-phone" class="primary">Send by Phone</button>
            <button id="send-by-email" class="primary">Send by Email</button>
        </div>
        <div class="row" style="margin-top:12px; gap: 10px;">
            <button id="copy-verification-message">Copy Message</button>
            <button id="close-modal" class="secondary">Close</button>
        </div>
    `;

    const phoneButton = document.getElementById('send-by-phone');
    const emailButton = document.getElementById('send-by-email');
    const copyButton = document.getElementById('copy-verification-message');
    const textArea = document.getElementById('verification-message-body');

    if (phoneButton) {
        phoneButton.addEventListener('click', () => {
            window.location.href = `sms:7906424387?body=${encodeURIComponent(textArea.value)}`;
            closeModal();
        });
    }
    if (emailButton) {
        emailButton.addEventListener('click', () => {
            window.location.href = `mailto:gauravsingha.cbm@gmail.com?subject=Order%20Verification&body=${encodeURIComponent(textArea.value)}`;
            closeModal();
        });
    }
    if (copyButton) {
        copyButton.addEventListener('click', async () => {
            await navigator.clipboard.writeText(textArea.value);
            showToast('Verification message copied to clipboard');
        });
    }
    document.getElementById('close-modal').addEventListener('click', closeModal);
}

async function processOrderAndDecreaseQuantity() {
    if (!pendingOrder || !pendingOrder.product || !pendingOrder.quantity) {
        showToast('No valid order found to process.', true);
        return false;
    }

    // Find the product in categories and decrease quantity
    let productFound = false;
    for (let categoryId in categories) {
        const category = categories[categoryId];
        for (let i = 0; i < category.products.length; i++) {
            const product = category.products[i];
            if (product.name === pendingOrder.product.name && 
                product.price === pendingOrder.product.price) {
                // Found the product - decrease quantity
                const newQuantity = product.quantity - pendingOrder.quantity;
                if (newQuantity >= 0) {
                    categories[categoryId].products[i].quantity = newQuantity;
                    productFound = true;
                    break;
                } else {
                    showToast('Not enough quantity available', true);
                    return false;
                }
            }
        }
        if (productFound) break;
    }
    
    if (productFound) {
        // Persist the updated catalog to database
        await persistCatalog();
        showToast('Order confirmed! Quantity updated.');
        return true;
    } else {
        showToast('Could not find product to update quantity', true);
        return false;
    }
}

function closeModal() {
    overlay.classList.add('hidden');
    modalCard.innerHTML = '';
}

overlay.addEventListener('click', (event) => {
    if (event.target === overlay) closeModal();
});


// ==========================================
// ADMIN C.R.U.D OPERATIONS
// ==========================================

function openCategoryForm(categoryId = null, event = null) {
    if (event) event.stopPropagation();

    const isEdit = categoryId !== null;
    const cat = isEdit ? categories[categoryId] : { name: '', image: '', description: '' };

    modalCard.innerHTML = `
        <h2>${isEdit ? 'Edit Category' : 'Add New Category'}</h2>
        <div class="row" style="display:block;">
            <label>Name</label>
            <input type="text" id="cat-name" value="${cat.name}" />
        </div>
        <div class="row" style="display:block;">
            <label>Image URL/Path</label>
            <input type="text" id="cat-img" value="${cat.image}" placeholder="e.g. images/new.jpg" />
        </div>
        <div class="row" style="display:block;">
            <label>Description</label>
            <textarea id="cat-desc" rows="3">${cat.description}</textarea>
        </div>
        <div class="row">
            <button id="save-cat">Save</button>
            ${isEdit ? `<button id="delete-cat" style="background-color: #ff4757; color: white;">Delete</button>` : ''}
            <button id="close-modal" class="secondary">Cancel</button>
        </div>
    `;
    overlay.classList.remove('hidden');

document.getElementById('save-cat').addEventListener('click', async () => {
            const newName = document.getElementById('cat-name').value;
            const newImg = document.getElementById('cat-img').value;
            const newDesc = document.getElementById('cat-desc').value;

            if (isEdit) {
                categories[categoryId].name = newName;
                categories[categoryId].image = newImg;
                categories[categoryId].description = newDesc;
                showToast("Category Updated");
            } else {
                const newId = Date.now();
                categories[newId] = { id: newId, name: newName, image: newImg, description: newDesc, products: [] };
                selectedCategoryId = newId;
                showToast("Category Added");
            }
            closeModal();
            await persistCatalog();
            renderCategoryBoxes();
            showCategory(selectedCategoryId);
    });

    if (isEdit) {
        document.getElementById('delete-cat').addEventListener('click', () => {
            deleteCategory(categoryId);
            closeModal();
        });
    }

    document.getElementById('close-modal').addEventListener('click', closeModal);
}

async function deleteCategory(categoryId) {
    if (confirm('Are you sure you want to delete this entire category and its products?')) {
        delete categories[categoryId];
        showToast("Category Deleted", true);
        const keys = Object.keys(categories);
        selectedCategoryId = keys.length > 0 ? Number(keys[0]) : null;
        await persistCatalog();
        renderCategoryBoxes();
        if (selectedCategoryId !== null) showCategory(selectedCategoryId);
        else typeList.innerHTML = '';
    }
}

function openProductForm(categoryId, productIndex = null, event = null) {
    if (event) event.stopPropagation();

    const isEdit = productIndex !== null;
    const prod = isEdit ? categories[categoryId].products[productIndex] : { name: '', image: '', description: '', price: '', quantity: '' };

    modalCard.innerHTML = `
        <h2>${isEdit ? 'Edit Product' : 'Add New Product'}</h2>
        <div class="row" style="display:block;">
            <label>Name</label>
            <input type="text" id="prod-name" value="${prod.name}" />
        </div>
        <div class="row" style="display:block;">
            <label>Image URLs (one per line)</label>
            <textarea id="prod-imgs" rows="2" placeholder="https://... or images/file.jpg">${(prod.images && prod.images.join('\n')) || (prod.image || '')}</textarea>
        </div>
        <div class="row" style="display:block;">
            <label>Upload From Device (you can select multiple)</label>
            <input type="file" id="prod-image-file" accept="image/*" multiple />
        </div>
        <div class="row" style="display:block;">
            <label>Description</label>
            <textarea id="prod-desc" rows="2">${prod.description}</textarea>
        </div>
        <div class="row" style="display:flex; gap:10px;">
            <div style="flex:1">
                <label>Price (₹)</label>
                <input type="number" id="prod-price" value="${prod.price}" />
            </div>
            <div style="flex:1">
                <label>Quantity</label>
                <input type="number" id="prod-qty" value="${prod.quantity}" />
            </div>
        </div>
        <div class="row">
            <button id="save-prod">Save Product</button>
            ${isEdit ? `<button id="delete-prod" style="background-color: #ff4757; color: white;">Delete</button>` : ''}
            <button id="close-modal" class="secondary">Cancel</button>
        </div>
    `;
    overlay.classList.remove('hidden');

    document.getElementById('save-prod').addEventListener('click', async () => {
        const imagesField = document.getElementById('prod-imgs').value;
        const fileInput = document.getElementById('prod-image-file');
        const updatedProd = {
            name: document.getElementById('prod-name').value,
            images: [],
            description: document.getElementById('prod-desc').value,
            price: Number(document.getElementById('prod-price').value),
            quantity: Number(document.getElementById('prod-qty').value)
        };

        const saveAndClose = async () => {
            if (isEdit) {
                categories[categoryId].products[productIndex] = updatedProd;
                showToast("Product Updated");
            } else {
                categories[categoryId].products.push(updatedProd);
                showToast("Product Added");
            }
            closeModal();
            await persistCatalog();
            showCategory(categoryId);
        };

        // Collect images from textarea (one per line)
        if (imagesField && imagesField.trim()) {
            const lines = imagesField.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
            updatedProd.images = updatedProd.images.concat(lines);
        }

        // If files selected, read all and append as data URLs
        if (fileInput && fileInput.files && fileInput.files.length > 0) {
            const readFileAsDataURL = (file) => new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
            try {
                const promises = Array.from(fileInput.files).map(f => readFileAsDataURL(f));
                const dataUrls = await Promise.all(promises);
                updatedProd.images = updatedProd.images.concat(dataUrls);
            } catch (err) {
                console.error('File read error', err);
                showToast('Could not read uploaded images', true);
            }
        }

        // Fallback: if no images but old single image exists, keep it
        if ((!updatedProd.images || updatedProd.images.length === 0) && prod.image) {
            updatedProd.images = [prod.image];
        }

        // If product had a legacy single `image` property, ensure compatibility
        if (updatedProd.images && updatedProd.images.length === 1) {
            // keep both `image` and `images` for backward compatibility
            updatedProd.image = updatedProd.images[0];
        }

        await saveAndClose();
    });

    if (isEdit) {
        document.getElementById('delete-prod').addEventListener('click', () => {
            deleteProduct(categoryId, productIndex);
            closeModal();
        });
    }

    document.getElementById('close-modal').addEventListener('click', closeModal);
}

function deleteProduct(categoryId, productIndex) {
    if (confirm('Are you sure you want to delete this product?')) {
        categories[categoryId].products.splice(productIndex, 1);
        showToast("Product Deleted", true);
        persistCatalog().then(() => showCategory(categoryId));
    }
}

// ==========================================
// UTILS & INITIALIZATION
// ==========================================

function showToast(message, isError = false) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${isError ? 'error' : ''}`;
    toast.innerText = message;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

async function persistCatalog() {
    try {
        const response = await fetch('/api/catalog', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(categories)
        });
        if (!response.ok) {
            showToast('Failed to persist catalog on server', true);
            return null;
        }
        const data = await response.json();
        showToast('Catalog saved');
        return data;
    } catch (err) {
        console.error('persistCatalog error:', err);
        showToast('Could not save catalog. Check server logs.', true);
        return null;
    }
}

searchInput.addEventListener('keyup', () => {
    renderCategoryBoxes();
    if (selectedCategoryId) showCategory(selectedCategoryId);
});

// Init
fetchCatalog();