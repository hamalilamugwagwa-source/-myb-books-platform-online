// ========================================
// MYB - Creative Writing & Storytelling Platform
// Main Application JavaScript
// ========================================

// Global State Management
const AppState = {
    currentUser: null,
    currentBook: null,
    currentChapter: 1,
    books: [],
    userLibrary: [],
    purchasedBooks: [],
    readingProgress: {},
    darkMode: false
};

// ========================================
// Initialization
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

async function initializeApp() {
    // Load saved theme preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        AppState.darkMode = true;
        updateThemeIcon();
    }
    
    // Load saved user session
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        AppState.currentUser = JSON.parse(savedUser);
        updateAuthUI();
    }
    
    // Initialize event listeners
    initializeEventListeners();
    
    // Load initial data
    await loadBooks();
    await loadGenres();
    
    // Render homepage
    renderHomePage();
    
    // Handle initial route
    handleRoute();

    // Update admin UI visibility
    updateAdminUI();

    // If on admin page and admin, render it
    window.addEventListener('hashchange', () => {
        const hash = window.location.hash.slice(1);
        if (hash === 'admin') renderAdminPage();
    });
}

// ========================================
// Event Listeners
// ========================================

function initializeEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', handleNavClick);
    });
    
    // Theme toggle
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
    
    // Auth button
    document.getElementById('auth-btn').addEventListener('click', () => {
        if (AppState.currentUser) {
            logout();
        } else {
            openModal('auth-modal');
        }
    });
    
    // Auth tabs
    document.querySelectorAll('.auth-tab').forEach(tab => {
        tab.addEventListener('click', handleAuthTabClick);
    });
    
    // Auth forms
    document.getElementById('signin-form').addEventListener('submit', handleSignIn);
    document.getElementById('signup-form').addEventListener('submit', handleSignUp);
    
    // My Library tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', handleLibraryTabClick);
    });
    
    // Search functionality
    document.getElementById('nav-search-input').addEventListener('input', handleSearch);
    
    // Filter functionality
    const genreFilter = document.getElementById('genre-filter');
    const sortFilter = document.getElementById('sort-filter');
    const statusFilter = document.getElementById('status-filter');
    
    if (genreFilter) genreFilter.addEventListener('change', applyFilters);
    if (sortFilter) sortFilter.addEventListener('change', applyFilters);
    if (statusFilter) statusFilter.addEventListener('change', applyFilters);
    
    // Handle browser back/forward
    window.addEventListener('popstate', handleRoute);
    
    // Mobile menu toggle
    const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    if (mobileMenuToggle) {
        mobileMenuToggle.addEventListener('click', toggleMobileMenu);
    }
    
    // Newsletter form
    const newsletterForm = document.getElementById('newsletter-form');
    if (newsletterForm) {
        newsletterForm.addEventListener('submit', handleNewsletterSubmit);
    }

    // Admin: form and list handlers
    const adminForm = document.getElementById('admin-add-book-form');
    if (adminForm) {
        adminForm.addEventListener('submit', handleAdminAddBookSubmit);
        const cancelBtn = document.getElementById('admin-cancel-edit');
        if (cancelBtn) cancelBtn.addEventListener('click', () => { adminForm.reset(); delete adminForm.dataset.editId; delete adminForm.dataset.pdfUrl; const preview = document.getElementById('admin-book-cover-preview'); if (preview) preview.innerHTML = ''; const pdfPreview = document.getElementById('admin-book-pdf-preview'); if (pdfPreview) pdfPreview.innerHTML = ''; });

        const cover = document.getElementById('admin-book-cover');
        if (cover) cover.addEventListener('change', (e) => { const file = e.target.files[0]; const preview = document.getElementById('admin-book-cover-preview'); if (!file || !preview) return; readFileAsDataURL(file).then(dataUrl => { preview.innerHTML = `<img src="${dataUrl}" alt="cover">`; }).catch(() => { preview.innerHTML = ''; }); });

        const pdfEl = document.getElementById('admin-book-pdf');
        if (pdfEl) pdfEl.addEventListener('change', (e) => { const file = e.target.files[0]; const pdfPreview = document.getElementById('admin-book-pdf-preview'); if (!pdfPreview) return; if (!file) { pdfPreview.innerHTML = ''; return; } pdfPreview.innerHTML = `<i class="fas fa-file-pdf"></i> ${file.name}`; });
    }

    const adminList = document.getElementById('admin-books-list');
    if (adminList) {
        adminList.addEventListener('click', (e) => {
            const editBtn = e.target.closest('.btn-admin-edit');
            const delBtn = e.target.closest('.btn-admin-delete');
            if (editBtn) openEditServerBook(editBtn.dataset.id);
            if (delBtn && confirm('Delete this book?')) handleAdminDeleteBook(delBtn.dataset.id);
        });
    }
}

// ========================================
// Navigation & Routing
// ========================================

function handleNavClick(e) {
    e.preventDefault();
    const page = e.currentTarget.dataset.page;
    navigateTo(page);
}

function navigateTo(page) {
    // Update URL
    history.pushState({ page }, '', `#${page}`);
    
    // Update active nav link
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.dataset.page === page) {
            link.classList.add('active');
        }
    });
    
    // Hide all pages
    document.querySelectorAll('.page').forEach(p => {
        p.classList.remove('active');
    });
    
    // Show target page
    const targetPage = document.getElementById(`${page}-page`);
    if (targetPage) {
        targetPage.classList.add('active');
        
        // Load page-specific content
        switch(page) {
            case 'home':
                renderHomePage();
                break;
            case 'library':
                renderLibraryPage();
                break;
            case 'mylibrary':
                renderMyLibraryPage();
                break;
            case 'profile':
                renderProfilePage();
                break;
        }
    }
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function handleRoute() {
    const hash = window.location.hash.slice(1);
    const page = hash || 'home';
    
    // Check if it's a book detail page
    if (hash.startsWith('book/')) {
        const bookId = hash.split('/')[1];
        showBookDetail(bookId);
    } else if (hash.startsWith('read/')) {
        const parts = hash.split('/');
        const bookId = parts[1];
        const chapter = parseInt(parts[2]) || 1;
        showReader(bookId, chapter);
    } else {
        navigateTo(page);
    }
}

// ========================================
// Data Loading Functions
// ========================================

async function loadBooks() {
    try {
        const response = await fetch('tables/books?limit=100');
        const data = await response.json();
        AppState.books = data.data || [];
        return AppState.books;
    } catch (error) {
        console.error('Error loading books:', error);
        AppState.books = [];
        return [];
    }
}

async function loadGenres() {
    // Extract unique genres from books
    const genres = [...new Set(AppState.books.map(book => book.genre).filter(Boolean))];
    
    // Populate genre filter
    const genreFilter = document.getElementById('genre-filter');
    if (genreFilter) {
        genres.forEach(genre => {
            const option = document.createElement('option');
            option.value = genre;
            option.textContent = genre;
            genreFilter.appendChild(option);
        });
    }
    
    return genres;
}

async function loadChapters(bookId) {
    try {
        const response = await fetch(`tables/chapters?limit=100`);
        const data = await response.json();
        const chapters = (data.data || []).filter(ch => ch.book_id === bookId);
        return chapters.sort((a, b) => a.chapter_number - b.chapter_number);
    } catch (error) {
        console.error('Error loading chapters:', error);
        return [];
    }
}

async function loadUserPurchases() {
    if (!AppState.currentUser) return [];
    
    try {
        const response = await fetch('tables/purchases?limit=100');
        const data = await response.json();
        const purchases = (data.data || []).filter(p => p.user_id === AppState.currentUser.id);
        AppState.purchasedBooks = purchases.map(p => p.book_id);
        return purchases;
    } catch (error) {
        console.error('Error loading purchases:', error);
        return [];
    }
}

async function loadReadingProgress() {
    if (!AppState.currentUser) return {};
    
    try {
        const response = await fetch('tables/reading_progress?limit=100');
        const data = await response.json();
        const progress = (data.data || []).filter(p => p.user_id === AppState.currentUser.id);
        
        const progressMap = {};
        progress.forEach(p => {
            progressMap[p.book_id] = p;
        });
        
        AppState.readingProgress = progressMap;
        return progressMap;
    } catch (error) {
        console.error('Error loading reading progress:', error);
        return {};
    }
}

// ========================================
// Home Page Rendering
// ========================================

function renderHomePage() {
    renderFeaturedBooks();
    renderTrendingBooks();
    renderGenres();
    updateStatsDisplay();
}

function renderFeaturedBooks() {
    const container = document.getElementById('featured-books');
    if (!container) return;

    const isAdmin = !!(AppState.currentUser && (AppState.currentUser.role === 'admin' || AppState.token));

    if (!AppState.currentUser && !isAdmin) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-lock"></i><h3>Sign in to access books</h3><p>Please sign in to view available books.</p></div>';
        return;
    }

    const featuredBooks = AppState.books
        .filter(book => book.featured && (isAdmin || book.published))
        .slice(0, 6);

    container.innerHTML = featuredBooks.length > 0
        ? featuredBooks.map(book => createBookCard(book)).join('')
        : '<div class="empty-state"><i class="fas fa-book"></i><h3>No featured books yet</h3><p>Check back soon for amazing stories!</p></div>';
}

function renderTrendingBooks() {
    const container = document.getElementById('trending-books');
    if (!container) return;

    const isAdmin = !!(AppState.currentUser && (AppState.currentUser.role === 'admin' || AppState.token));

    if (!AppState.currentUser && !isAdmin) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-fire"></i><h3>Sign in to view trending books</h3></div>';
        return;
    }

    const trendingBooks = [...AppState.books]
        .filter(b => isAdmin || b.published)
        .sort((a, b) => (b.reads || 0) - (a.reads || 0))
        .slice(0, 6);

    container.innerHTML = trendingBooks.length > 0
        ? trendingBooks.map(book => createBookCard(book)).join('')
        : '<div class="empty-state"><i class="fas fa-fire"></i><h3>No trending books yet</h3></div>';
}

function renderGenres() {
    const container = document.getElementById('genres-grid');
    if (!container) return;
    
    const genres = [
        { name: 'Romance', icon: 'fa-heart', count: '25K+' },
        { name: 'Fantasy', icon: 'fa-dragon', count: '18K+' },
        { name: 'Mystery', icon: 'fa-mask', count: '15K+' },
        { name: 'Sci-Fi', icon: 'fa-rocket', count: '12K+' },
        { name: 'Thriller', icon: 'fa-bolt', count: '10K+' },
        { name: 'Horror', icon: 'fa-ghost', count: '8K+' }
    ];
    
    container.innerHTML = genres.map(genre => `
        <div class="genre-card" onclick="filterByGenre('${genre.name}')">
            <i class="fas ${genre.icon}"></i>
            <h3>${genre.name}</h3>
            <p>${genre.count} Stories</p>
        </div>
    `).join('');
}

// ========================================
// Library Page Rendering
// ========================================

function renderLibraryPage() {
    applyFilters();
}

function applyFilters() {
    const genreFilter = document.getElementById('genre-filter')?.value || '';
    const sortFilter = document.getElementById('sort-filter')?.value || 'popular';
    const statusFilter = document.getElementById('status-filter')?.value || '';
    const searchQuery = document.getElementById('nav-search-input')?.value.toLowerCase() || '';

    const isAdmin = !!(AppState.currentUser && (AppState.currentUser.role === 'admin' || AppState.token));
    if (!AppState.currentUser && !isAdmin) {
        const container = document.getElementById('library-books');
        if (container) container.innerHTML = '<div class="empty-state"><i class="fas fa-lock"></i><h3>Sign in to browse the library</h3><p>Please sign in to access books.</p></div>';
        return;
    }
    let filteredBooks = [...AppState.books].filter(b => isAdmin || b.published);

    
    // Apply genre filter
    if (genreFilter) {
        filteredBooks = filteredBooks.filter(book => book.genre === genreFilter);
    }
    
    // Apply status filter
    if (statusFilter) {
        filteredBooks = filteredBooks.filter(book => book.status === statusFilter);
    }
    
    // Apply search filter
    if (searchQuery) {
        filteredBooks = filteredBooks.filter(book =>
            book.title.toLowerCase().includes(searchQuery) ||
            book.author.toLowerCase().includes(searchQuery) ||
            (book.genre && book.genre.toLowerCase().includes(searchQuery))
        );
    }
    
    // Apply sorting
    switch(sortFilter) {
        case 'popular':
            filteredBooks.sort((a, b) => (b.reads || 0) - (a.reads || 0));
            break;
        case 'recent':
            filteredBooks.sort((a, b) => new Date(b.published_date) - new Date(a.published_date));
            break;
        case 'rating':
            filteredBooks.sort((a, b) => (b.rating || 0) - (a.rating || 0));
            break;
        case 'title':
            filteredBooks.sort((a, b) => a.title.localeCompare(b.title));
            break;
    }
    
    const container = document.getElementById('library-books');
    if (container) {
        container.innerHTML = filteredBooks.length > 0
            ? filteredBooks.map(book => createBookCard(book)).join('')
            : '<div class="empty-state"><i class="fas fa-search"></i><h3>No books found</h3><p>Try adjusting your filters</p></div>';
    }
}

function filterByGenre(genre) {
    navigateTo('library');
    setTimeout(() => {
        const genreFilter = document.getElementById('genre-filter');
        if (genreFilter) {
            genreFilter.value = genre;
            applyFilters();
        }
    }, 100);
}

// ========================================
// Book Card Component
// ========================================

// ========================================
// Admin Pages and Actions
// ========================================

function renderAdminPage() {
    const page = document.getElementById('admin-page');
    if (!page) return;

    const isAdmin = !!(AppState.currentUser && (AppState.currentUser.role === 'admin' || AppState.token));
    if (!isAdmin) {
        page.innerHTML = `<div class="container"><div class="empty-state"><i class="fas fa-user-lock"></i><h3>Access denied</h3><p>Sign in as admin to access this page.</p></div></div>`;
        return;
    }

    // set admin username display if needed
    // load server books and render
    renderAdminBooks();
}

async function renderAdminBooks() {
    try {
        const resp = await fetch('/tables/books?limit=200');
        if (!resp.ok) throw new Error('Failed to load');
        const data = await resp.json();
        const books = data.data || [];
        AppState.books = books; // keep in sync

        const container = document.getElementById('admin-books-list');
        if (!container) return;

        container.innerHTML = books.length === 0 ? '<div class="empty-state"><h3>No books on platform</h3></div>' : books.map(b => `
            <div class="book-card" style="position:relative;padding:10px;">
                <img src="${b.cover_url}" class="book-cover" style="width:84px;height:126px;object-fit:cover;border-radius:6px;float:left;margin-right:10px;" onerror="this.src='https://via.placeholder.com/84x126?text=Cover'">
                <div class="book-info">
                    <h4 style="margin:0">${b.title}</h4>
                    <div style="color:var(--text-secondary);font-size:0.9rem">by ${b.author}</div>
                    <div class="controls" style="margin-top:6px;">
                        ${b.pdf_url ? `<a class="btn-outline" href="${b.pdf_url}" target="_blank" style="margin-right:6px;"><i class="fas fa-file-pdf"></i> PDF</a>` : ''}
                        ${b.published ? `<span class="badge" style="background:var(--primary-orange);color:white;padding:.25rem .5rem;border-radius:6px;margin-right:6px;font-size:.8rem;">Published</span>` : `<span class="badge" style="background:#ddd;color:#333;padding:.25rem .5rem;border-radius:6px;margin-right:6px;font-size:.8rem;">Draft</span>`}
                        <button class="btn-outline btn-admin-edit" data-id="${b.id}">Edit</button>
                        <button class="btn-outline btn-admin-delete" data-id="${b.id}">Delete</button>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (err) {
        console.error('Error rendering admin books:', err);
    }
}

async function handleAdminAddBookSubmit(e) {
    e.preventDefault();
    if (!AppState.token) return showToast('Sign in as admin to manage books', 'error');

    const form = e.currentTarget;
    const editId = form.dataset.editId;
    const title = document.getElementById('admin-book-title').value.trim();
    const author = document.getElementById('admin-book-author').value.trim();
    const genre = document.getElementById('admin-book-genre').value.trim();
    const price = parseFloat(document.getElementById('admin-book-price').value) || 0;
    const synopsis = document.getElementById('admin-book-synopsis').value.trim();
    const coverInput = document.getElementById('admin-book-cover');
    const pdfInput = document.getElementById('admin-book-pdf');
    const published = !!document.getElementById('admin-book-published').checked;

    let coverData = '';
    if (coverInput && coverInput.files && coverInput.files[0]) {
        try { coverData = await readFileAsDataURL(coverInput.files[0]); } catch (err) { console.error(err); }
    }
    let pdfData = '';
    if (pdfInput && pdfInput.files && pdfInput.files[0]) {
        try { pdfData = await readFileAsDataURL(pdfInput.files[0]); } catch (err) { console.error(err); }
    }

    let cover_url = coverData || 'https://via.placeholder.com/200x300?text=Book+Cover';
    let pdf_url = form.dataset.pdfUrl || '';

    try {
        if (coverData && coverData.startsWith('data:')) {
            const up = await fetch('/upload', { method:'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + AppState.token }, body: JSON.stringify({ filename: `${title.replace(/\s+/g,'_')}.png`, data: coverData }) });
            const upjson = await up.json();
            cover_url = upjson.url || cover_url;
        }

        if (pdfData && pdfData.startsWith('data:')) {
            const up = await fetch('/upload', { method:'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + AppState.token }, body: JSON.stringify({ filename: `${title.replace(/\s+/g,'_')}.pdf`, data: pdfData }) });
            const upjson = await up.json();
            pdf_url = upjson.url || pdf_url;
        }

        const payload = { title, author, genre, price, synopsis, cover_url, pdf_url, published };

        if (editId) {
            const resp = await fetch(`/tables/books/${editId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + AppState.token }, body: JSON.stringify(payload) });
            if (!resp.ok) throw new Error('Update failed');
            showToast('Book updated', 'success');
        } else {
            const resp = await fetch('/tables/books', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + AppState.token }, body: JSON.stringify(payload) });
            if (!resp.ok) throw new Error('Create failed');
            showToast('Book created', 'success');
        }

        form.reset(); delete form.dataset.editId; delete form.dataset.pdfUrl;
        const preview = document.getElementById('admin-book-cover-preview'); if (preview) preview.innerHTML = '';
        const pdfPreview = document.getElementById('admin-book-pdf-preview'); if (pdfPreview) pdfPreview.innerHTML = '';
        await renderAdminBooks();
        await loadBooks(); renderHomePage(); applyFilters();
    } catch (err) {
        console.error(err);
        showToast('Failed to save book', 'error');
    }
}

async function openEditServerBook(id) {
    try {
        await loadBooks();
        const book = (AppState.books || []).find(b => String(b.id) === String(id));
        if (!book) return showToast('Book not found', 'error');

        document.getElementById('admin-book-title').value = book.title || '';
        document.getElementById('admin-book-author').value = book.author || '';
        document.getElementById('admin-book-genre').value = book.genre || '';
        document.getElementById('admin-book-price').value = book.price || '';
        document.getElementById('admin-book-synopsis').value = book.synopsis || '';

        const preview = document.getElementById('admin-book-cover-preview');
        if (preview) preview.innerHTML = `<img src="${book.cover_url}" alt="cover">`;

        const pdfPreview = document.getElementById('admin-book-pdf-preview');
        if (pdfPreview) pdfPreview.innerHTML = book.pdf_url ? `<a href="${book.pdf_url}" target="_blank"><i class="fas fa-file-pdf"></i> View PDF</a>` : '';

        const form = document.getElementById('admin-add-book-form');
        if (form) { form.dataset.editId = id; form.dataset.pdfUrl = book.pdf_url || ''; }

        document.getElementById('admin-book-published').checked = !!book.published;
        // scroll to form
        navigateTo('admin');
        window.scrollTo({ top: 200, behavior: 'smooth' });
    } catch (err) {
        console.error('Edit open failed', err);
    }
}

async function handleAdminDeleteBook(id) {
    if (!AppState.token) return showToast('Sign in as admin to delete', 'error');
    try {
        const resp = await fetch(`/tables/books/${id}`, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + AppState.token } });
        if (!resp.ok) {
            const j = await resp.json().catch(() => ({}));
            return showToast(j.error || 'Delete failed', 'error');
        }
        showToast('Book deleted', 'success');
        await renderAdminBooks();
        await loadBooks(); renderHomePage(); applyFilters();
    } catch (err) {
        console.error('Delete error', err);
        showToast('Failed to delete', 'error');
    }
}

function createBookCard(book) {
    const rating = book.rating || 0;
    const reads = formatNumber(book.reads || 0);
    const likes = formatNumber(book.likes || 0);
    
    return `
        <div class="book-card" onclick="showBookDetail('${book.id}')">
            ${book.featured ? '<div class="book-badge">Featured</div>' : ''}
            <img src="${book.cover_url}" alt="${book.title}" class="book-cover" onerror="this.src='https://via.placeholder.com/200x300?text=Book+Cover'">
            <div class="book-info">
                <h3 class="book-title">${book.title}</h3>
                <p class="book-author">by ${book.author}</p>
                <div class="book-meta">
                    <span class="book-rating">
                        <i class="fas fa-star"></i> ${rating.toFixed(1)}
                    </span>
                    <span>
                        <i class="fas fa-eye"></i> ${reads}
                    </span>
                    <span>
                        <i class="fas fa-heart"></i> ${likes}
                    </span>
                </div>
                ${book.tags && book.tags.length > 0 ? `
                    <div class="book-tags">
                        ${book.tags.slice(0, 3).map(tag => `<span class="tag">${tag}</span>`).join('')}
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

// ========================================
// Book Detail Page
// ========================================

async function showBookDetail(bookId) {
    const book = AppState.books.find(b => b.id === bookId);
    if (!book) {
        showToast('Book not found', 'error');
        return;
    }

    const isAdmin = !!(AppState.currentUser && (AppState.currentUser.role === 'admin' || AppState.token));
    if (!AppState.currentUser && !isAdmin) {
        showToast('Please sign in to view book details', 'error');
        openModal('auth-modal');
        return;
    }

    AppState.currentBook = book;
    
    // Increment view count
    incrementBookViews(bookId);
    
    // Update URL
    history.pushState({ page: 'book-detail', bookId }, '', `#book/${bookId}`);
    
    // Show book detail page
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('book-detail-page').classList.add('active');
    
    // Load chapters
    const chapters = await loadChapters(bookId);
    
    // Check if user has purchased this book
    const isPurchased = AppState.purchasedBooks.includes(bookId);
    
    // Get reading progress
    const progress = AppState.readingProgress[bookId];
    const currentChapter = progress ? progress.current_chapter : 1;
    
    // Render book detail
    const container = document.getElementById('book-detail-content');
    container.innerHTML = `
        <div>
            <img src="${book.cover_url}" alt="${book.title}" class="book-detail-cover" onerror="this.src='https://via.placeholder.com/300x450?text=Book+Cover'">
        </div>
        <div class="book-detail-info">
            <div class="book-detail-header">
                <h1>${book.title}</h1>
                <p class="author">by ${book.author}</p>
            </div>
            
            <div class="book-detail-stats">
                <div class="book-detail-stat">
                    <strong><i class="fas fa-star"></i> ${(book.rating || 0).toFixed(1)}</strong>
                    <span>Rating</span>
                </div>
                <div class="book-detail-stat">
                    <strong><i class="fas fa-eye"></i> ${formatNumber(book.reads || 0)}</strong>
                    <span>Reads</span>
                </div>
                <div class="book-detail-stat">
                    <strong><i class="fas fa-heart"></i> ${formatNumber(book.likes || 0)}</strong>
                    <span>Likes</span>
                </div>
                <div class="book-detail-stat">
                    <strong><i class="fas fa-book"></i> ${chapters.length}</strong>
                    <span>Chapters</span>
                </div>
            </div>
            
            <div class="book-detail-actions">
                <button class="btn-primary btn-large" onclick="showReader('${book.id}', ${currentChapter})">
                    <i class="fas fa-book-reader"></i>
                    ${progress ? 'Continue Reading' : 'Read Online FREE'}
                </button>
                ${!isPurchased ? `
                    <button class="btn-outline btn-large" onclick="initiatePayment('${book.id}')">
                        <i class="fas fa-download"></i>
                        Download
                    </button>
                    <span class="price-tag">
                        <i class="fas fa-tag"></i>
                        ZMW ${(book.price || 0).toFixed(2)}
                    </span>
                ` : `
                    <button class="btn-outline btn-large" onclick="downloadBook('${book.id}')">
                        <i class="fas fa-download"></i>
                        Download (Purchased)
                    </button>
                `}
                <button class="btn-icon" onclick="toggleBookLike('${book.id}')" title="Add to Favorites" style="width: 50px; height: 50px; font-size: 1.2rem;">
                    <i class="fas fa-heart"></i>
                </button>
            </div>
            
            <div class="book-detail-synopsis">
                <h3>Synopsis</h3>
                <p>${book.synopsis || 'No description available.'}</p>
            </div>

            <div class="book-detail-comments">
                <h3><i class="fas fa-comments"></i> Comments</h3>
                <div id="comments-list-${book.id}"></div>
                ${AppState.currentUser ? `
                    <form id="comment-form-${book.id}" style="margin-top:1rem;">
                        <textarea name="comment" placeholder="Write a comment..." rows="3" required></textarea>
                        <button type="submit" class="btn-primary" style="margin-top:.5rem;">Post Comment</button>
                    </form>
                ` : '<p style="color:var(--text-secondary);">Sign in to comment</p>'}
            </div>

            ${chapters.length > 0 ? `
                <div class="book-detail-chapters">
                    <h3><i class="fas fa-list"></i> Chapters</h3>
                    <div class="chapters-list">
                        ${chapters.map(chapter => `
                            <div class="chapter-item" onclick="showReader('${book.id}', ${chapter.chapter_number})">
                                <div>
                                    <div class="chapter-title">Chapter ${chapter.chapter_number}: ${chapter.title}</div>
                                    <div class="chapter-meta">${formatNumber(chapter.word_count || 0)} words</div>
                                </div>
                                <i class="fas fa-chevron-right"></i>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
        </div>
    `;

    // Load comments
    loadComments(bookId);

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ========================================
// Comments
// ========================================

async function loadComments(bookId) {
    try {
        const response = await fetch(`tables/comments?book_id=${bookId}`);
        const data = await response.json();
        const comments = (data.data || []).filter(c => c.book_id === bookId);
        renderComments(bookId, comments);
    } catch (error) {
        console.error('Error loading comments:', error);
    }
}

function renderComments(bookId, comments) {
    const container = document.getElementById(`comments-list-${bookId}`);
    if (!container) return;
    container.innerHTML = comments.length > 0 ? comments.map(c => `
        <div class="comment" style="border-bottom:1px solid var(--border);padding:1rem 0;">
            <div style="font-weight:500;">${c.user_name}</div>
            <div style="color:var(--text-secondary);font-size:0.9rem;margin-bottom:.5rem;">${new Date(c.created_at).toLocaleDateString()}</div>
            <p>${c.comment}</p>
        </div>
    `).join('') : '<p style="color:var(--text-secondary);">No comments yet.</p>';
}

// ========================================
// Reader Interface
// ========================================

async function showReader(bookId, chapterNumber = 1) {
    const book = AppState.books.find(b => b.id === bookId);
    if (!book) return;
    
    const chapters = await loadChapters(bookId);
    const chapter = chapters.find(ch => ch.chapter_number === chapterNumber);
    
    if (!chapter) {
        showToast('Chapter not found', 'error');
        return;
    }
    
    AppState.currentBook = book;
    AppState.currentChapter = chapterNumber;
    
    // Update URL
    history.pushState({ page: 'reader', bookId, chapterNumber }, '', `#read/${bookId}/${chapterNumber}`);
    
    // Show reader page
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('reader-page').classList.add('active');
    
    // Render reader
    const container = document.getElementById('reader-container');
    container.innerHTML = `
        <div class="reader-header">
            <button class="btn-outline" onclick="history.back()">
                <i class="fas fa-arrow-left"></i>
                Back to Book
            </button>
            <div class="reader-controls">
                <button class="btn-icon" onclick="toggleTheme()">
                    <i class="fas fa-adjust"></i>
                </button>
                <button class="btn-icon" onclick="addBookmark()">
                    <i class="fas fa-bookmark"></i>
                </button>
            </div>
        </div>
        
        <div class="reader-content">
            <h1>${book.title}</h1>
            <h2>Chapter ${chapter.chapter_number}: ${chapter.title}</h2>
            ${formatChapterContent(chapter.content || 'No content available.')}
        </div>
        
        <div class="reader-navigation">
            ${chapterNumber > 1 ? `
                <button class="btn-outline" onclick="showReader('${bookId}', ${chapterNumber - 1})">
                    <i class="fas fa-chevron-left"></i>
                    Previous Chapter
                </button>
            ` : '<div></div>'}
            
            ${chapterNumber < chapters.length ? `
                <button class="btn-primary" onclick="showReader('${bookId}', ${chapterNumber + 1})">
                    Next Chapter
                    <i class="fas fa-chevron-right"></i>
                </button>
            ` : '<div></div>'}
        </div>
    `;
    
    // Save reading progress
    saveReadingProgress(bookId, chapterNumber);
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function formatChapterContent(content) {
    // Split content into paragraphs
    const paragraphs = content.split('\n\n').filter(p => p.trim());
    return paragraphs.map(p => `<p>${p}</p>`).join('');
}

async function saveReadingProgress(bookId, chapterNumber) {
    if (!AppState.currentUser) return;
    
    try {
        const existing = AppState.readingProgress[bookId];
        
        if (existing) {
            // Update existing progress
            await fetch(`tables/reading_progress/${existing.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    current_chapter: chapterNumber,
                    last_read: new Date().toISOString()
                })
            });
        } else {
            // Create new progress entry
            const response = await fetch('tables/reading_progress', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: AppState.currentUser.id,
                    book_id: bookId,
                    current_chapter: chapterNumber,
                    last_read: new Date().toISOString()
                })
            });
            const data = await response.json();
            AppState.readingProgress[bookId] = data;
        }
    } catch (error) {
        console.error('Error saving reading progress:', error);
    }
}

// ========================================
// My Library Page
// ========================================

async function renderMyLibraryPage() {
    if (!AppState.currentUser) {
        document.getElementById('reading-books').innerHTML = renderLoginPrompt();
        document.getElementById('purchased-books').innerHTML = renderLoginPrompt();
        document.getElementById('favorites-books').innerHTML = renderLoginPrompt();
        return;
    }
    
    await loadReadingProgress();
    await loadUserPurchases();
    
    // Render currently reading
    const readingBooks = Object.keys(AppState.readingProgress).map(bookId => {
        return AppState.books.find(b => b.id === bookId);
    }).filter(Boolean);
    
    document.getElementById('reading-books').innerHTML = readingBooks.length > 0
        ? readingBooks.map(book => createBookCard(book)).join('')
        : '<div class="empty-state"><i class="fas fa-book-reader"></i><h3>No books in progress</h3><p>Start reading to see books here</p></div>';
    
    // Render purchased books
    const purchased = AppState.purchasedBooks.map(bookId => {
        return AppState.books.find(b => b.id === bookId);
    }).filter(Boolean);
    
    document.getElementById('purchased-books').innerHTML = purchased.length > 0
        ? purchased.map(book => createBookCard(book)).join('')
        : '<div class="empty-state"><i class="fas fa-shopping-bag"></i><h3>No purchased books</h3><p>Download books to read offline</p></div>';
    
    // Render favorites (placeholder)
    document.getElementById('favorites-books').innerHTML = '<div class="empty-state"><i class="fas fa-heart"></i><h3>No favorites yet</h3><p>Mark books as favorites to see them here</p></div>';
}

function handleLibraryTabClick(e) {
    const tab = e.currentTarget.dataset.tab;
    
    // Update active tab
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    e.currentTarget.classList.add('active');
    
    // Show corresponding content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${tab}-content`).classList.add('active');
}

function renderLoginPrompt() {
    return `
        <div class="empty-state">
            <i class="fas fa-user-lock"></i>
            <h3>Sign in to access your library</h3>
            <button class="btn-primary" onclick="openModal('auth-modal')">
                <i class="fas fa-sign-in-alt"></i>
                Sign In
            </button>
        </div>
    `;
}

// ========================================
// Profile Page
// ========================================

function renderProfilePage() {
    const container = document.getElementById('profile-card');
    
    if (!AppState.currentUser) {
        container.innerHTML = renderLoginPrompt();
        return;
    }
    
    const user = AppState.currentUser;
    const initial = user.username.charAt(0).toUpperCase();
    const readingCount = Object.keys(AppState.readingProgress).length;
    const purchasedCount = AppState.purchasedBooks.length;
    
    container.innerHTML = `
        <div class="profile-header">
            <div class="profile-avatar">${initial}</div>
            <div class="profile-info">
                <h2>${user.username}</h2>
                <p class="profile-bio">${user.email}</p>
                <p class="profile-bio">${user.bio || 'Book lover and avid reader'}</p>
            </div>
        </div>
        
        <div class="profile-stats">
            <div class="profile-stat">
                <strong>${readingCount}</strong>
                <span>Reading</span>
            </div>
            <div class="profile-stat">
                <strong>${purchasedCount}</strong>
                <span>Purchased</span>
            </div>
            <div class="profile-stat">
                <strong>0</strong>
                <span>Reviews</span>
            </div>
        </div>
        
        <button class="btn-outline btn-block" onclick="logout()">
            <i class="fas fa-sign-out-alt"></i>
            Sign Out
        </button>
    `;
}

// ========================================
// Authentication
// ========================================

function handleAuthTabClick(e) {
    const tab = e.currentTarget.dataset.tab;
    
    // Update active tab
    document.querySelectorAll('.auth-tab').forEach(t => {
        t.classList.remove('active');
    });
    e.currentTarget.classList.add('active');
    
    // Show corresponding form
    document.querySelectorAll('.auth-form').forEach(form => {
        form.classList.remove('active');
    });
    document.getElementById(`${tab}-form`).classList.add('active');
}

async function handleSignIn(e) {
    e.preventDefault();
    
    const email = document.getElementById('signin-email').value;
    const password = document.getElementById('signin-password').value;
    
    try {
        // First, try server admin login (username may be admin)
        try {
            const resp = await fetch('/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: email, password }) });
            if (resp.ok) {
                const js = await resp.json();
                AppState.token = js.token;
                localStorage.setItem('myb_token', js.token);
                AppState.currentUser = { username: js.username, role: js.role };
                localStorage.setItem('currentUser', JSON.stringify(AppState.currentUser));

                closeModal('auth-modal');
                updateAuthUI();
                updateAdminUI();
                showToast('Signed in as admin', 'success');

                // refresh data
                await loadBooks();
                await loadUserPurchases();
                await loadReadingProgress();
                return;
            }
        } catch (err) {
            // server may be down, continue to local auth
            console.warn('Server login failed, falling back to local users');
        }

        // Check if user exists locally
        const response = await fetch('tables/users?limit=100');
        const data = await response.json();
        const user = (data.data || []).find(u => u.email === email);
        
        if (user) {
            // In production, verify password properly
            AppState.currentUser = user;
            localStorage.setItem('currentUser', JSON.stringify(user));
            
            closeModal('auth-modal');
            updateAuthUI();
            showToast('Welcome back!', 'success');
            
            // Reload user data
            await loadUserPurchases();
            await loadReadingProgress();
        } else {
            showToast('Invalid email or password', 'error');
        }
    } catch (error) {
        console.error('Error signing in:', error);
        showToast('Error signing in. Please try again.', 'error');
    }
}

async function handleSignUp(e) {
    e.preventDefault();
    
    const username = document.getElementById('signup-username').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    
    try {
        // Check if email already exists
        const response = await fetch('tables/users?limit=100');
        const data = await response.json();
        const existingUser = (data.data || []).find(u => u.email === email);
        
        if (existingUser) {
            showToast('Email already registered', 'error');
            return;
        }
        
        // Create new user
        const newUserResponse = await fetch('tables/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username,
                email,
                password, // In production, hash the password
                joined_date: new Date().toISOString()
            })
        });
        
        const newUser = await newUserResponse.json();
        AppState.currentUser = newUser;
        localStorage.setItem('currentUser', JSON.stringify(newUser));
        
        closeModal('auth-modal');
        updateAuthUI();
        showToast('Account created successfully!', 'success');
    } catch (error) {
        console.error('Error signing up:', error);
        showToast('Error creating account. Please try again.', 'error');
    }
}

function logout() {
    AppState.currentUser = null;
    AppState.purchasedBooks = [];
    AppState.readingProgress = {};
    localStorage.removeItem('currentUser');
    
    updateAuthUI();
    navigateTo('home');
    showToast('Signed out successfully', 'success');
}

function updateAuthUI() {
    const authBtn = document.getElementById('auth-btn');
    
    if (AppState.currentUser) {
        authBtn.innerHTML = `<i class="fas fa-user-circle"></i> ${AppState.currentUser.username}`;
    } else {
        authBtn.innerHTML = `<i class="fas fa-sign-in-alt"></i> Sign In`;
    }
}

function updateAdminUI() {
    const isAdmin = !!(AppState.currentUser && (AppState.currentUser.role === 'admin' || AppState.token));
    const navAdmin = document.getElementById('nav-admin');
    if (navAdmin) navAdmin.style.display = isAdmin ? '' : 'none';

    // If the user is on admin page and not admin, redirect away
    const hash = window.location.hash.slice(1);
    if (hash === 'admin' && !isAdmin) navigateTo('home');
}

// ========================================
// Payment System
// ========================================

function initiatePayment(bookId) {
    if (!AppState.currentUser) {
        showToast('Please sign in to purchase books', 'error');
        openModal('auth-modal');
        return;
    }
    
    const book = AppState.books.find(b => b.id === bookId);
    if (!book) return;
    
    const container = document.getElementById('payment-container');
    container.innerHTML = `
        <div class="payment-header">
            <h2>Complete Your Purchase</h2>
            <p>Download "${book.title}" for offline reading</p>
            <div class="payment-amount">$${(book.price || 0).toFixed(2)}</div>
        </div>
        
        <div class="payment-methods">
            <div class="payment-method active" data-method="card">
                <i class="fab fa-cc-stripe"></i>
                <div>Credit Card</div>
            </div>
            <div class="payment-method" data-method="paypal">
                <i class="fab fa-paypal"></i>
                <div>PayPal</div>
            </div>
        </div>
        
        <form id="payment-form">
            <div class="form-group">
                <label>Card Number</label>
                <input type="text" placeholder="1234 5678 9012 3456" required>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div class="form-group">
                    <label>Expiry Date</label>
                    <input type="text" placeholder="MM/YY" required>
                </div>
                <div class="form-group">
                    <label>CVV</label>
                    <input type="text" placeholder="123" required>
                </div>
            </div>
            
            <button type="submit" class="btn-primary btn-block">
                <i class="fas fa-lock"></i>
                Complete Purchase
            </button>
        </form>
        
        <p style="text-align: center; color: var(--text-tertiary); font-size: 0.85rem; margin-top: 1rem;">
            <i class="fas fa-shield-alt"></i> Secure payment powered by Stripe
        </p>
    `;
    
    // Handle payment method selection
    document.querySelectorAll('.payment-method').forEach(method => {
        method.addEventListener('click', function() {
            document.querySelectorAll('.payment-method').forEach(m => m.classList.remove('active'));
            this.classList.add('active');
        });
    });
    
    // Handle payment submission
    document.getElementById('payment-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await processPayment(bookId, book.price);
    });
    
    openModal('payment-modal');
}

async function processPayment(bookId, amount) {
    try {
        // Simulate payment processing
        showToast('Processing payment...', 'success');
        
        // Create purchase record
        const response = await fetch('tables/purchases', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: AppState.currentUser.id,
                book_id: bookId,
                amount: amount,
                payment_method: 'credit_card',
                purchase_date: new Date().toISOString()
            })
        });
        
        if (response.ok) {
            AppState.purchasedBooks.push(bookId);
            closeModal('payment-modal');
            showToast('Purchase successful! You can now download the book.', 'success');
            
            // Refresh book detail page
            setTimeout(() => {
                showBookDetail(bookId);
            }, 1000);
        } else {
            showToast('Payment failed. Please try again.', 'error');
        }
    } catch (error) {
        console.error('Error processing payment:', error);
        showToast('Payment error. Please try again.', 'error');
    }
}

function downloadBook(bookId) {
    const book = AppState.books.find(b => b.id === bookId);
    if (!book) return;
    
    showToast(`Downloading "${book.title}"...`, 'success');
    
    // Simulate download
    setTimeout(() => {
        showToast('Download complete!', 'success');
    }, 2000);
}

// ========================================
// Theme Toggle
// ========================================

function toggleTheme() {
    AppState.darkMode = !AppState.darkMode;
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('theme', AppState.darkMode ? 'dark' : 'light');
    updateThemeIcon();
}

function updateThemeIcon() {
    const icon = document.querySelector('#theme-toggle i');
    if (icon) {
        icon.className = AppState.darkMode ? 'fas fa-sun' : 'fas fa-moon';
    }
}

// ========================================
// Search Functionality
// ========================================

function handleSearch(e) {
    const query = e.target.value.toLowerCase();
    
    if (query.length > 0) {
        // If not on library page, navigate there
        const currentPage = document.querySelector('.page.active');
        if (currentPage.id !== 'library-page') {
            navigateTo('library');
        }
        
        // Apply search filter
        setTimeout(() => {
            applyFilters();
        }, 100);
    }
}

// ========================================
// Modal Functions
// ========================================

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// ========================================
// Toast Notifications
// ========================================

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <div class="toast-content">
            <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'} toast-icon"></i>
            <span>${message}</span>
        </div>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// ========================================
// Utility Functions
// ========================================

function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

function addBookmark() {
    showToast('Bookmark added!', 'success');
}

function toggleMobileMenu() {
    // Mobile menu functionality
    const navMenu = document.querySelector('.nav-menu');
    if (navMenu) {
        navMenu.classList.toggle('active');
    }
}

// ========================================
// Newsletter Subscription
// ========================================

function handleNewsletterSubmit(e) {
    e.preventDefault();
    const emailInput = e.target.querySelector('input[type="email"]');
    const email = emailInput.value;
    
    // Simulate newsletter subscription
    showToast('Thank you for subscribing! Check your email for confirmation.', 'success');
    emailInput.value = '';
    
    // In production, send to backend
    console.log('Newsletter subscription:', email);
}

// ========================================
// Enhanced Book Features
// ========================================

// Add view count when book is viewed
async function incrementBookViews(bookId) {
    try {
        const book = AppState.books.find(b => b.id === bookId);
        if (book) {
            const newReads = (book.reads || 0) + 1;
            await fetch(`tables/books/${bookId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reads: newReads })
            });
            book.reads = newReads;
        }
    } catch (error) {
        console.error('Error incrementing views:', error);
    }
}

// Like/Unlike book functionality
async function toggleBookLike(bookId) {
    if (!AppState.currentUser) {
        showToast('Please sign in to like books', 'error');
        openModal('auth-modal');
        return;
    }
    
    try {
        const book = AppState.books.find(b => b.id === bookId);
        if (book) {
            const newLikes = (book.likes || 0) + 1;
            await fetch(`tables/books/${bookId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ likes: newLikes })
            });
            book.likes = newLikes;
            showToast('Added to favorites!', 'success');
            
            // Refresh current view
            const currentPage = document.querySelector('.page.active');
            if (currentPage.id === 'book-detail-page') {
                showBookDetail(bookId);
            }
        }
    } catch (error) {
        console.error('Error liking book:', error);
        showToast('Failed to like book', 'error');
    }
}

// Update total books stat
function updateStatsDisplay() {
    const totalBooksElement = document.getElementById('total-books-stat');
    if (totalBooksElement && AppState.books.length > 0) {
        totalBooksElement.textContent = formatNumber(AppState.books.length) + '+';
    }
}

// ========================================
// Global Error Handling
// ========================================

window.addEventListener('error', (e) => {
    console.error('Global error:', e.error);
});

window.addEventListener('unhandledrejection', (e) => {
    console.error('Unhandled promise rejection:', e.reason);
});
