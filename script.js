// App data and state
const app = {
    products: [],
    cart: [],
    isOnline: true,
    categories: []
};

// DOM Elements
const productsGrid = document.getElementById('productsGrid');
const cartIcon = document.getElementById('cartIcon');
const cartCount = document.getElementById('cartCount');
const cartModal = document.getElementById('cartModal');
const closeModal = document.getElementById('closeModal');
const cartItems = document.getElementById('cartItems');
const cartTotal = document.getElementById('cartTotal');
const offlineIndicator = document.getElementById('offlineIndicator');
const notificationPrompt = document.getElementById('notificationPrompt');
const enableNotifications = document.getElementById('enableNotifications');
const toast = document.getElementById('toast');
const sortSelect = document.getElementById('sortSelect');
const categorySelect = document.getElementById('categorySelect');

// Initialize the app
function init() {
    fetchProducts();
    setupEventListeners();
    checkOnlineStatus();
    registerServiceWorker();
    checkNotificationPermission();
    
    // Load cart from localStorage
    const savedCart = localStorage.getItem('cart');
    if (savedCart) {
        app.cart = JSON.parse(savedCart);
        updateCartCount();
    }
    
    // Listen for online/offline events
    window.addEventListener('online', () => {
        app.isOnline = true;
        offlineIndicator.style.display = 'none';
        console.log('App is online');
    });
    
    window.addEventListener('offline', () => {
        app.isOnline = false;
        offlineIndicator.style.display = 'block';
        console.log('App is offline');
    });
}

// Fetch products from API or cache
async function fetchProducts() {
    try {
        // Try to fetch from network first
        const response = await fetch('https://fakestoreapi.com/products');
        app.products = await response.json();
        
        // Extract unique categories
        const categories = [...new Set(app.products.map(product => product.category))];
        app.categories = categories;
        
        // Cache the products for offline use
        if ('caches' in window) {
            caches.open('products-cache').then(cache => {
                cache.put('https://fakestoreapi.com/products', response);
            });
        }
        
        renderProducts();
    } catch (error) {
        console.error('Failed to fetch products:', error);
        
        // If network fails, try to get from cache
        if ('caches' in window) {
            caches.match('https://fakestoreapi.com/products')
                .then(response => {
                    if (response) {
                        return response.json();
                    }
                    throw new Error('No cached products found');
                })
                .then(products => {
                    app.products = products;
                    renderProducts();
                })
                .catch(() => {
                    // If no cache, show error
                    productsGrid.innerHTML = `
                        <div style="grid-column: 1 / -1; text-align: center; padding: 2rem;">
                            <p>Unable to load products. Please check your internet connection.</p>
                        </div>
                    `;
                });
        }
    }
}

// Render products to the grid
function renderProducts() {
    productsGrid.innerHTML = '';
    
    let filteredProducts = [...app.products];
    
    // Apply category filter
    const selectedCategory = categorySelect.value;
    if (selectedCategory !== 'all') {
        filteredProducts = filteredProducts.filter(product => 
            product.category === selectedCategory
        );
    }
    
    // Apply sorting
    const sortOption = sortSelect.value;
    if (sortOption === 'price-asc') {
        filteredProducts.sort((a, b) => a.price - b.price);
    } else if (sortOption === 'price-desc') {
        filteredProducts.sort((a, b) => b.price - a.price);
    } else if (sortOption === 'name') {
        filteredProducts.sort((a, b) => a.title.localeCompare(b.title));
    }
    
    if (filteredProducts.length === 0) {
        productsGrid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 2rem;">
                <p>No products found in this category.</p>
            </div>
        `;
        return;
    }
    
    filteredProducts.forEach(product => {
        // Generate a random discount for demonstration
        const hasDiscount = Math.random() > 0.5;
        const discountPercent = hasDiscount ? Math.floor(Math.random() * 30) + 10 : 0;
        const discountedPrice = hasDiscount 
            ? (product.price * (1 - discountPercent/100)).toFixed(2) 
            : product.price;
        
        const productCard = document.createElement('div');
        productCard.className = 'product-card';
        productCard.innerHTML = `
            ${hasDiscount ? `<div class="product-badge">-${discountPercent}%</div>` : ''}
            <img src="${product.image}" alt="${product.title}" class="product-image">
            <div class="product-info">
                <h3 class="product-title">${product.title.substring(0, 50)}...</h3>
                <div class="product-rating">
                    ${generateStarRating(product.rating.rate)}
                    <span>(${product.rating.count})</span>
                </div>
                <div class="product-price">
                    <span class="current-price">$${discountedPrice}</span>
                    ${hasDiscount ? `
                        <span class="original-price">$${product.price}</span>
                        <span class="discount">Save ${discountPercent}%</span>
                    ` : ''}
                </div>
                <button class="add-to-cart" data-id="${product.id}">
                    <i class="fas fa-shopping-cart"></i> Add to Cart
                </button>
            </div>
        `;
        productsGrid.appendChild(productCard);
    });
    
    // Add event listeners to add-to-cart buttons
    document.querySelectorAll('.add-to-cart').forEach(button => {
        button.addEventListener('click', (e) => {
            const productId = parseInt(e.target.closest('button').getAttribute('data-id'));
            addToCart(productId);
        });
    });
}

// Generate star rating HTML
function generateStarRating(rating) {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    let stars = '';
    
    for (let i = 0; i < fullStars; i++) {
        stars += '<i class="fas fa-star"></i>';
    }
    
    if (hasHalfStar) {
        stars += '<i class="fas fa-star-half-alt"></i>';
    }
    
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    for (let i = 0; i < emptyStars; i++) {
        stars += '<i class="far fa-star"></i>';
    }
    
    return stars;
}

// Add product to cart
function addToCart(productId) {
    const product = app.products.find(p => p.id === productId);
    if (!product) return;
    
    const existingItem = app.cart.find(item => item.id === productId);
    
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        app.cart.push({
            id: product.id,
            title: product.title,
            price: product.price,
            image: product.image,
            quantity: 1
        });
    }
    
    updateCartCount();
    saveCart();
    
    // Show added to cart feedback
    showToast(`${product.title.substring(0, 30)}... added to your cart`);
}

// Update cart count indicator
function updateCartCount() {
    const totalItems = app.cart.reduce((total, item) => total + item.quantity, 0);
    cartCount.textContent = totalItems;
}

// Save cart to localStorage
function saveCart() {
    localStorage.setItem('cart', JSON.stringify(app.cart));
}

// Setup event listeners
function setupEventListeners() {
    cartIcon.addEventListener('click', () => {
        showCart();
    });
    
    closeModal.addEventListener('click', () => {
        cartModal.style.display = 'none';
    });
    
    enableNotifications.addEventListener('click', () => {
        requestNotificationPermission();
    });
    
    sortSelect.addEventListener('change', () => {
        renderProducts();
    });
    
    categorySelect.addEventListener('change', () => {
        renderProducts();
    });
    
    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === cartModal) {
            cartModal.style.display = 'none';
        }
    });
}

// Show cart modal
function showCart() {
    cartItems.innerHTML = '';
    
    if (app.cart.length === 0) {
        cartItems.innerHTML = '<p>Your cart is empty. Start shopping to add items!</p>';
        cartTotal.textContent = '';
    } else {
        let total = 0;
        
        app.cart.forEach(item => {
            const itemTotal = item.price * item.quantity;
            total += itemTotal;
            
            const cartItem = document.createElement('div');
            cartItem.className = 'cart-item';
            cartItem.innerHTML = `
                <div style="display: flex; align-items: center; margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 1px solid #eee;">
                    <img src="${item.image}" alt="${item.title}" style="width: 60px; height: 60px; object-fit: contain; margin-right: 1rem;">
                    <div style="flex: 1;">
                        <h4 style="margin-bottom: 0.5rem;">${item.title.substring(0, 40)}...</h4>
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <span>$${item.price} x ${item.quantity}</span>
                            </div>
                            <div style="font-weight: bold;">$${itemTotal.toFixed(2)}</div>
                        </div>
                    </div>
                    <button class="remove-from-cart" data-id="${item.id}" style="background: none; border: none; color: #ef4444; cursor: pointer; margin-left: 0.5rem;">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            cartItems.appendChild(cartItem);
        });
        
        cartTotal.textContent = `Total: $${total.toFixed(2)}`;
        
        // Add event listeners to remove buttons
        document.querySelectorAll('.remove-from-cart').forEach(button => {
            button.addEventListener('click', (e) => {
                const productId = parseInt(e.target.closest('button').getAttribute('data-id'));
                removeFromCart(productId);
            });
        });
    }
    
    cartModal.style.display = 'flex';
}

// Remove item from cart
function removeFromCart(productId) {
    app.cart = app.cart.filter(item => item.id !== productId);
    updateCartCount();
    saveCart();
    showCart();
}

// Check online status
function checkOnlineStatus() {
    app.isOnline = navigator.onLine;
    if (!app.isOnline) {
        offlineIndicator.style.display = 'block';
    }
}

// Register service worker
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js').then(registration => {
                console.log('SW registered: ', registration);
            }).catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
        });
    }
}

// Check notification permission
function checkNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        notificationPrompt.style.display = 'block';
    }
}

// Request notification permission
function requestNotificationPermission() {
    if ('Notification' in window) {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                notificationPrompt.style.display = 'none';
                showNotification('Notifications enabled', 'You will now receive updates about new products and offers.');
                
                // In a real app, you would subscribe to push notifications here
                // subscribeToPushNotifications();
            }
        });
    }
}

// Show notification
function showNotification(title, body) {
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body, icon: '/icon-192x192.png' });
    }
}

// Show toast message
function showToast(message) {
    toast.textContent = message;
    toast.style.display = 'block';
    
    setTimeout(() => {
        toast.style.display = 'none';
    }, 3000);
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', init);