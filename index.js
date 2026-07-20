let categories = {};
let selectedCategoryId = null;
let pendingOrder = null;
let isAdmin = false; // State for admin mode

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

async function persistCatalog() {
    try {
        const response = await fetch('/api/catalog', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(categories)
        });
        if (!response.ok) throw new Error('Failed to save catalog');
        categories = await response.json();
    } catch (error) {
        console.error(error);
        showToast('Could not save admin changes. Try again.', true);
    }
}

const productList = document.getElementById('product-list');
const typeList = document.getElementById('type-list');
const mobileCategories = document.getElementById('mobile-categories');
const overlay = document.getElementById('overlay');
const modalCard = document.getElementById('modal-card');
const searchInput = document.querySelector('.input-2');

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
    if (passwordInput.value === 'admin123') { // Admin Password
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
            <img src="${category.image}" alt="${category.name}" />
            <strong>${category.name}</strong>
        `;
        box.addEventListener('click', () => showCategory(category.id));
        productList.appendChild(box);

        const mobileChip = document.createElement('button');
        mobileChip.className = 'mobile-chip';
        mobileChip.innerHTML = `
            <img src="${category.image}" alt="${category.name}" />
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
            <img src="${product.image}" alt="${product.name}" />
            <strong>${product.name}</strong>
            <p>${product.description}</p>
            <p class="small">Category: ${product.categoryName} | Qty: ${product.quantity || 'N/A'}</p>
            <div class="price">₹${product.price}</div>
        `;

        // Clicking the whole card opens standard flow based on user role
        if (isAdmin) {
            card.addEventListener('click', () => openProductForm(product.categoryId, product.index));
        } else {
            card.addEventListener('click', () => openProductModal(product));
        }
        typeList.appendChild(card);
    });
}

// ==========================================
// USER MODALS (Order & Payment)
// ==========================================

function openProductModal(product) {
    if (isAdmin) return;

    modalCard.innerHTML = `
        <h2>${product.name}</h2>
        <img src="${product.image}" alt="${product.name}" />
        <p>${product.description}</p>
        <p class="small">Available Quantity: ${product.quantity || 'N/A'}</p>
        <div class="row">
            <strong>Price: ₹${product.price}</strong>
            <input type="number" id="quantity" min="1" max="${product.quantity || 20}" value="1" />
        </div>
        <div class="row">
            <button id="place-order">Place Order</button>
            <button id="close-modal" class="secondary">Close</button>
        </div>
    `;
    overlay.classList.remove('hidden');

    document.getElementById('place-order').addEventListener('click', () => {
        const quantity = Number(document.getElementById('quantity').value || 1);
        pendingOrder = { product, quantity };
        openPaymentModal(product, quantity);
    });
    document.getElementById('close-modal').addEventListener('click', closeModal);
}

function openPaymentModal(product, quantity) {
    const totalAmount = product.price * quantity;
    modalCard.innerHTML = `
        <h3>Payment</h3>
        <p class="small">Please scan the QR code to pay.</p>
        <div class="qr-box"><img src="QrCode.jpeg" style="width:100%; height:auto;" alt="QR Code"></div>
        <p><strong>Product:</strong> ${product.name}</p>
        <p><strong>Quantity:</strong> ${quantity}</p>
        <p><strong>Total Amount:</strong> ₹${totalAmount}</p>
        <div class="row">
            <button id="done-payment">Done</button>
            <button id="close-modal" class="secondary">Close</button>
        </div>
    `;
    document.getElementById('done-payment').addEventListener('click', openPhoneModal);
    document.getElementById('close-modal').addEventListener('click', closeModal);
}

function openPhoneModal() {
    const message = `Hello! This person has made a payment of ₹${pendingOrder.product.price * pendingOrder.quantity} for ${pendingOrder.product.name} with quantity ${pendingOrder.quantity}.`;
    modalCard.innerHTML = `
        <h3>Thank You</h3>
        <p>We will contact you soon after verifying your payment details.</p>
        <p class="small">Choose how you want to receive the order message.</p>
        <div class="row">
            <button id="send-phone">Send to Phone</button>
            <button id="send-email">Send to Email</button>
        </div>
        <div class="row" style="display:block; margin-top:1rem;">
            <p><strong>Message:</strong></p>
            <textarea id="message-copy" rows="4">${message}</textarea>
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
            <label>Image URL/Path</label>
            <input type="text" id="prod-img" value="${prod.image}" placeholder="e.g. images/product.jpg"/>
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
        const updatedProd = {
            name: document.getElementById('prod-name').value,
            image: document.getElementById('prod-img').value,
            description: document.getElementById('prod-desc').value,
            price: Number(document.getElementById('prod-price').value),
            quantity: Number(document.getElementById('prod-qty').value)
        };

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

searchInput.addEventListener('keyup', () => {
    renderCategoryBoxes();
    if (selectedCategoryId) showCategory(selectedCategoryId);
});

// Init
fetchCatalog();