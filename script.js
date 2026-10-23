import { supabase } from './supabaseClient.js';

/* PEPE KUN - Dynamic Storefront, Multi-Category Collections & Auth Script */

(function () {
  'use strict';

  // State Management
  let cart = JSON.parse(localStorage.getItem('pepe_cart') || '[]');
  let products = [];
  let primaryCategories = [];
  let collectionCategories = [];
  let currentUser = null;
  let selectedColor = null;
  let selectedSize = null;
  let selectedSizePrice = null;
  let modalCurrentQty = 1; // Tracks the quantity chosen in the modal

  // Helper Function for Generating Dynamic Price HTML
  function getPriceDisplayHTML(prod, sizePriceOverride = null) {
    let sellingPrice = sizePriceOverride !== null ? sizePriceOverride : parseFloat(prod.price || 0);
    let originalPrice = parseFloat(prod.original_price || 0);
    let discountPercent = parseFloat(prod.discount || prod.discount_percentage || 0);

    if (discountPercent > 0) {
      if (originalPrice <= sellingPrice) {
        originalPrice = sellingPrice / (1 - (discountPercent / 100));
      }
      return `
        <div class="flex flex-wrap items-center gap-2 mt-0.5">
            <span class="text-gray-900 font-bold text-2xl">₹${sellingPrice.toFixed(2)}</span>
            <span class="text-gray-300 text-lg line-through">₹${originalPrice.toFixed(2)}</span>
            <span class="bg-orange-100 text-orange-600 text-xs font-bold px-2 py-1 rounded-md whitespace-nowrap">👋 ${discountPercent}% OFF</span>
        </div>
      `;
    } else if (originalPrice > sellingPrice && originalPrice > 0) {
      let calculatedDiscount = Math.round(((originalPrice - sellingPrice) / originalPrice) * 100);
      if (calculatedDiscount > 0) {
          return `
            <div class="flex flex-wrap items-center gap-2 mt-0.5">
                <span class="text-gray-900 font-bold text-2xl">₹${sellingPrice.toFixed(2)}</span>
                <span class="text-gray-300 text-lg line-through">₹${originalPrice.toFixed(2)}</span>
                <span class="bg-orange-100 text-orange-600 text-xs font-bold px-2 py-1 rounded-md whitespace-nowrap">👋 ${calculatedDiscount}% OFF</span>
            </div>
          `;
      }
    }
    return `<span class="text-gray-900 font-bold text-2xl">₹${sellingPrice.toFixed(2)}</span>`;
  }

  // Auth Session Check & Sync Cart
  async function checkUserSession() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      currentUser = user;

      if (user) {
        const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
        const displayName = profile?.full_name || user.email?.split('@')[0] || 'Account';

        const loginBtn = document.getElementById('auth-login-btn');
        if (loginBtn) { loginBtn.textContent = displayName; loginBtn.href = 'account.html'; }

        const mobileLoginBtn = document.getElementById('mobile-auth-btn');
        if (mobileLoginBtn) { mobileLoginBtn.textContent = displayName; mobileLoginBtn.href = 'account.html'; }

        await fetchUserCartFromSupabase();
      } else {
        updateCartUI();
      }
    } catch (err) {
      console.error('Error checking user session:', err);
      updateCartUI();
    }
  }

  async function fetchUserCartFromSupabase() {
    if (!currentUser) return;
    try {
      const { data, error } = await supabase.from('cart').select('*, products(*)').eq('user_id', currentUser.id);
      if (error) throw error;
      if (data) {
        cart = data.map(item => {
          let finalPrice = item.products.price;
          let sizes = [];
          try {
            sizes = Array.isArray(item.products.sizes) ? item.products.sizes : JSON.parse(item.products.sizes || '[]');
          } catch (e) {
            if (typeof item.products.sizes === 'string') sizes = item.products.sizes.split(',').map(s => s.trim()).filter(Boolean);
          }
          if (item.selected_size) {
            const matchedSize = sizes.find(s => s.includes(':') && s.split(':')[0].trim() === item.selected_size);
            if (matchedSize) finalPrice = parseFloat(matchedSize.split(':')[1].trim());
          }
          return {
            ...item.products,
            price: finalPrice,
            quantity: item.quantity,
            cart_id: item.id,
            selected_color: item.selected_color || null,
            selected_size: item.selected_size || null
          };
        });
        updateCartUI();
      }
    } catch (err) {
      console.error('Error fetching Supabase cart:', err);
    }
  }

  // Cart Functions
  function updateCartUI() {
    const count = cart.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
    ['cart-count', 'cart-count-mobile'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = count;
    });
    localStorage.setItem('pepe_cart', JSON.stringify(cart));
  }

  function selectColor(color, btnElement) {
    selectedColor = color;
    document.querySelectorAll('.color-btn').forEach(btn => {
      btn.className = "color-btn border border-gray-300 text-gray-700 bg-white rounded-full px-5 py-2 text-sm font-medium hover:border-gray-400 transition-all";
    });
    if (btnElement) {
      btnElement.className = "color-btn border-2 border-gray-900 bg-white text-gray-900 rounded-full px-5 py-2 text-sm font-bold transition-all";
    }
  }

  function selectSize(sizeName, sizePrice, btnElement, productObj = null) {
    selectedSize = sizeName;
    selectedSizePrice = sizePrice;
    
    document.querySelectorAll('.size-btn').forEach(btn => {
      btn.className = "size-btn border border-gray-300 text-gray-700 bg-white rounded-full px-5 py-2 text-sm font-medium hover:border-gray-400 transition-all";
    });
    
    if (btnElement) {
      btnElement.className = "size-btn border-2 border-gray-900 bg-white text-gray-900 rounded-full px-5 py-2 text-sm font-bold transition-all";
    }

    const priceContainer = document.getElementById('modal-price');
    if (priceContainer && productObj) {
        priceContainer.innerHTML = getPriceDisplayHTML(productObj, sizePrice);
    }
  }

  // Quantity updates within the modal
  window.updateModalQty = function(change) {
      modalCurrentQty += change;
      if (modalCurrentQty < 1) modalCurrentQty = 1;
      const disp = document.getElementById('modal-qty-display');
      if (disp) disp.textContent = modalCurrentQty;
  };

  // Accordion Toggle
  window.toggleAccordion = function(id, btnElement) {
      const content = document.getElementById(id);
      const icon = btnElement.querySelector('svg');
      if (content.classList.contains('hidden')) {
          content.classList.remove('hidden');
          icon.classList.add('rotate-180');
      } else {
          content.classList.add('hidden');
          icon.classList.remove('rotate-180');
      }
  };

  async function addToCart(productId, sourceBtnId = null, chosenColor = null, chosenSize = null) {
    const product = products.find(p => String(p.id) === String(productId));
    if (!product && !currentUser) return false;

    let availableColors = [];
    try { availableColors = Array.isArray(product?.colors) ? product.colors : JSON.parse(product?.colors || '[]'); } 
    catch (e) { if (typeof product?.colors === 'string') availableColors = product.colors.split(',').map(c => c.trim()).filter(Boolean); }

    let availableSizes = [];
    try { availableSizes = Array.isArray(product?.sizes) ? product.sizes : JSON.parse(product?.sizes || '[]'); } 
    catch (e) { if (typeof product?.sizes === 'string') availableSizes = product.sizes.split(',').map(s => s.trim()).filter(Boolean); }

    if (availableColors.length > 1 && !chosenColor) {
      if(!document.getElementById('product-modal').classList.contains('flex')) openProductModal(productId);
      alert('Please select a color option.');
      return false;
    }

    if (availableSizes.length > 1 && !chosenSize) {
      if(!document.getElementById('product-modal').classList.contains('flex')) openProductModal(productId);
      alert('Please select a size option.');
      return false;
    }

    const targetBtnId = sourceBtnId || `btn-${productId}`;
    const btn = document.getElementById(targetBtnId);
    let originalText = '';
    if (btn) {
      originalText = btn.textContent;
      btn.textContent = 'Adding...';
      btn.disabled = true;
    }

    try {
      let finalPrice = product.price;
      if (selectedSizePrice !== null && chosenSize === selectedSize) {
        finalPrice = selectedSizePrice;
      } else if (chosenSize) {
        const matchedSize = availableSizes.find(s => s.includes(':') && s.split(':')[0].trim() === chosenSize);
        if (matchedSize) finalPrice = parseFloat(matchedSize.split(':')[1].trim());
      }

      // Quantity Logic (Read from modal if added from modal, otherwise default 1)
      const qtyToAdd = (sourceBtnId === 'modal-add-cart-btn' || sourceBtnId === 'modal-buy-now-btn') ? modalCurrentQty : 1;

      const existingIndex = cart.findIndex(p =>
        String(p.id) === String(productId) && 
        p.selected_color === (chosenColor || null) &&
        p.selected_size === (chosenSize || null)
      );
      
      if (existingIndex > -1) {
        cart[existingIndex].quantity = (Number(cart[existingIndex].quantity) || 0) + qtyToAdd;
        cart[existingIndex].price = finalPrice; 
      } else if (product) {
        cart.push({ 
          ...product, 
          price: finalPrice, 
          quantity: qtyToAdd, 
          selected_color: chosenColor || null, 
          selected_size: chosenSize || null 
        });
      }
      updateCartUI();

      if (currentUser) {
        let query = supabase.from('cart').select('id, quantity').eq('user_id', currentUser.id).eq('product_id', productId);
        query = chosenColor ? query.eq('selected_color', chosenColor) : query.is('selected_color', null);
        query = chosenSize ? query.eq('selected_size', chosenSize) : query.is('selected_size', null);

        const { data: existingItem, error: fetchErr } = await query.maybeSingle();
        if (fetchErr) throw fetchErr;

        if (existingItem) {
          const newQty = (Number(existingItem.quantity) || 0) + qtyToAdd;
          await supabase.from('cart').update({ quantity: newQty, updated_at: new Date().toISOString() }).eq('id', existingItem.id);
        } else {
          await supabase.from('cart').insert([{
              user_id: currentUser.id,
              product_id: productId,
              quantity: qtyToAdd,
              selected_color: chosenColor || null,
              selected_size: chosenSize || null
          }]);
        }
      }

      if (btn) {
        btn.textContent = 'Added ✓';
        setTimeout(() => { btn.textContent = originalText; btn.disabled = false; }, 1200);
      }
      
      // Reset modal qty after add
      if(sourceBtnId === 'modal-add-cart-btn') {
          modalCurrentQty = 1;
          document.getElementById('modal-qty-display').textContent = '1';
      }
      return true;
    } catch (err) {
      console.error('Error adding item to cart:', err);
      if (btn) { btn.textContent = originalText; btn.disabled = false; }
      return false;
    }
  }

  async function buyNow(productId, sourceBtnId = null, chosenColor = null, chosenSize = null) {
    const success = await addToCart(productId, sourceBtnId, chosenColor, chosenSize);
    if (success !== false) window.location.href = 'checkout.html';
  }

  // Modal Open Logic (App-like layout)
  function openProductModal(productId) {
    const prod = products.find(p => String(p.id) === String(productId));
    if (!prod) return;

    // Reset State
    selectedColor = null;
    selectedSize = null; 
    selectedSizePrice = null;
    modalCurrentQty = 1;

    const modal = document.getElementById('product-modal');
    const container = document.getElementById('modal-content-container');
    const title = document.getElementById('modal-title');
    const price = document.getElementById('modal-price');
    const shortDesc = document.getElementById('modal-short-desc');
    const longDesc = document.getElementById('acc-details');
    const specsList = document.getElementById('modal-specs-list');
    const addCartBtn = document.getElementById('modal-add-cart-btn');
    const buyNowModalBtn = document.getElementById('modal-buy-now-btn');
    const qtyDisplay = document.getElementById('modal-qty-display');
    const stickyImg = document.getElementById('modal-sticky-img');
    const stockStatus = document.getElementById('modal-stock-status');
    
    // Selectors
    const sizesContainer = document.getElementById('modal-sizes-container');
    const sizesOptions = document.getElementById('modal-size-options');
    const colorsContainer = document.getElementById('modal-colors-container');
    const colorsOptions = document.getElementById('modal-color-options');

    if(qtyDisplay) qtyDisplay.textContent = modalCurrentQty;
    if(stockStatus) stockStatus.textContent = prod.sold_out ? 'Sold Out' : 'In Stock & Ready to Ship';

    let images = [];
    try { images = Array.isArray(prod.images) ? prod.images : JSON.parse(prod.images || '[]'); } 
    catch (e) { images = [prod.images || 'https://via.placeholder.com/300']; }

    if(stickyImg && images.length > 0) stickyImg.src = images[0];

    const specs = Array.isArray(prod.specifications) ? prod.specifications : JSON.parse(prod.specifications || '[]');

    // Setup Colors
    let colors = [];
    try { colors = Array.isArray(prod.colors) ? prod.colors : JSON.parse(prod.colors || '[]'); } 
    catch (e) { if (typeof prod.colors === 'string') colors = prod.colors.split(',').map(c => c.trim()).filter(Boolean); }

    if (colors.length === 1) selectedColor = colors[0];

    if (colorsContainer && colorsOptions) {
      if (colors.length > 0) {
        colorsContainer.classList.remove('hidden');
        colorsOptions.innerHTML = colors.map((color, idx) => {
            const isSelected = colors.length === 1 || idx === 0; // default first
            if(isSelected) selectedColor = color;
            return `
            <button type="button" 
                  onclick="selectColor('${color}', this)"
                  class="color-btn ${isSelected ? 'border-2 border-gray-900 bg-white text-gray-900 font-bold' : 'border border-gray-300 text-gray-700 bg-white font-medium'} rounded-full px-5 py-2 text-sm hover:border-gray-400 transition-all">
              ${color}
            </button>
          `;
        }).join('');
      } else {
        colorsContainer.classList.add('hidden');
      }
    }

    // Setup Sizes
    let sizes = [];
    try { sizes = Array.isArray(prod.sizes) ? prod.sizes : JSON.parse(prod.sizes || '[]'); } 
    catch (e) { if (typeof prod.sizes === 'string') sizes = prod.sizes.split(',').map(s => s.trim()).filter(Boolean); }

    if (sizesContainer && sizesOptions) {
      if (sizes.length > 0) {
        sizesContainer.classList.remove('hidden');
        sizesOptions.innerHTML = sizes.map((sizeString, idx) => {
            let sizeName = sizeString;
            let sizePrice = Math.max(0, parseFloat(prod.price || 0));

            if (sizeString.includes(':')) {
                const parts = sizeString.split(':');
                sizeName = parts[0].trim();
                sizePrice = Math.max(0, parseFloat(parts[1].trim() || 0));
            }
            
            const isSelected = idx === 0; // Default first
            if (isSelected) {
                selectedSize = sizeName;
                selectedSizePrice = sizePrice;
            }

            return `
              <button type="button" 
                      onclick="selectSize('${sizeName}', ${sizePrice}, this, ${JSON.stringify(prod).replace(/"/g, '&quot;')})"
                      class="size-btn ${isSelected ? 'border-2 border-gray-900 bg-white text-gray-900 font-bold' : 'border border-gray-300 text-gray-700 bg-white font-medium'} rounded-full px-5 py-2 text-sm hover:border-gray-400 transition-all">
                ${sizeName}
              </button>
            `;
        }).join('');
      } else {
        sizesContainer.classList.add('hidden');
      }
    }

    // Swipe Track
    const modalSwipeTrack = document.getElementById('modal-swipe-track');
    if (modalSwipeTrack) {
      modalSwipeTrack.innerHTML = images.map((img) => `
          <div class="min-w-full h-full flex-none snap-center flex items-center justify-center">
              <img src="${img}" class="w-full h-full object-cover">
          </div>
      `).join('');
      modalSwipeTrack.scrollLeft = 0;
    }
    
    const dotsContainer = document.getElementById('modal-dots');
    if(dotsContainer && images.length > 1) {
        dotsContainer.innerHTML = images.map((_, i) => `<span class="w-1.5 h-1.5 rounded-full transition-all duration-300 ${i === 0 ? 'bg-gray-800 scale-125' : 'bg-gray-400'}"></span>`).join('');
        modalSwipeTrack.onscroll = (e) => {
            const actIdx = Math.round(e.target.scrollLeft / e.target.clientWidth);
            Array.from(dotsContainer.children).forEach((d, i) => {
                d.className = `w-1.5 h-1.5 rounded-full transition-all duration-300 ${i === actIdx ? 'bg-gray-800 scale-125' : 'bg-gray-400'}`;
            });
        };
    } else if (dotsContainer) {
        dotsContainer.innerHTML = '';
    }

    if (title) title.textContent = prod.title;
    if (shortDesc) shortDesc.textContent = "Tired of gifts that are forgotten? Give a gift that lasts a lifetime! Handcrafted premium plush toys, made for hugs & happy memories.";
    if (longDesc) longDesc.innerHTML = `<p>${prod.description || 'Made with quality materials, this plush companion is soft to touch and built to last. Whether it’s a birthday gift, holiday present, or a special treat for yourself.'}</p>`;

    if (price) {
      let activePrice = selectedSizePrice !== null ? selectedSizePrice : parseFloat(prod.price || 0);
      price.innerHTML = getPriceDisplayHTML(prod, activePrice);
    }

    if (specsList) {
      if(specs.length > 0) {
          // Splitting arrays into nice 2-column key-value looking structure if possible
          specsList.innerHTML = specs.map(s => {
              const text = s.includes(':') ? `<span class="block text-xs font-bold uppercase tracking-wide text-gray-400 mb-0.5">${s.split(':')[0]}</span><span class="font-medium text-gray-900">${s.split(':')[1]}</span>` : `<span class="font-medium text-gray-900">${s}</span>`;
              return `<li>${text}</li>`;
          }).join('');
      } else {
          specsList.innerHTML = `
              <li><span class="block text-xs font-bold uppercase tracking-wide text-gray-400 mb-0.5">Material</span><span class="font-medium text-gray-900">Premium Plush Fabric</span></li>
              <li><span class="block text-xs font-bold uppercase tracking-wide text-gray-400 mb-0.5">Filling</span><span class="font-medium text-gray-900">Polyester Fibre</span></li>
              <li><span class="block text-xs font-bold uppercase tracking-wide text-gray-400 mb-0.5">Age</span><span class="font-medium text-gray-900">3+ Years</span></li>
              <li><span class="block text-xs font-bold uppercase tracking-wide text-gray-400 mb-0.5">Care</span><span class="font-medium text-gray-900">Spot Clean Only</span></li>
          `;
      }
    }

    if (addCartBtn) addCartBtn.onclick = () => addToCart(prod.id, 'modal-add-cart-btn', selectedColor, selectedSize);
    if (buyNowModalBtn) buyNowModalBtn.onclick = () => buyNow(prod.id, 'modal-buy-now-btn', selectedColor, selectedSize);

    [addCartBtn, buyNowModalBtn].forEach(btn => {
      if (!btn) return;
      const soldOut = Boolean(prod.sold_out);
      btn.disabled = soldOut;
      btn.style.opacity = soldOut ? '0.45' : '';
      if(soldOut) btn.textContent = 'Sold Out';
    });

    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
      setTimeout(() => {
          modal.classList.remove('opacity-0');
          container.classList.remove('translate-y-full');
      }, 10);
      document.body.style.overflow = 'hidden';
    }
  }

  function closeModal() {
    const modal = document.getElementById('product-modal');
    const container = document.getElementById('modal-content-container');
    if (!modal) return;
    
    modal.classList.add('opacity-0');
    if(container) container.classList.add('translate-y-full');
    
    setTimeout(() => {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
      document.body.style.overflow = 'auto';
    }, 300);
  }

  // --- Category / Page Logic (No Changes required from your previous code) ---
  
  async function loadCategoriesAndCollections() {
    const catGrid = document.getElementById('category-grid');
    const colGrid = document.getElementById('collection-grid');

    const skeletonHTML = Array(5).fill(`
      <div class="flex-none w-40 md:w-52 snap-start bg-white rounded-3xl p-4 shadow-sm border border-gray-100 animate-pulse text-center">
        <div class="w-full aspect-square rounded-2xl bg-gray-200 mb-3 border border-gray-100"></div>
        <div class="h-4 bg-gray-200 rounded w-3/4 mx-auto mt-2"></div>
      </div>
    `).join('');

    if (catGrid) catGrid.innerHTML = skeletonHTML;
    if (colGrid) colGrid.innerHTML = skeletonHTML;

    try {
      const { data: categoriesData, error: catError } = await supabase.from('categories').select('*').order('created_at', { ascending: true });
      if (catError) throw catError;
      const allCats = categoriesData || [];
      collectionCategories = allCats.filter(c => c.section === 'sub' || c.type === 'collection');
      primaryCategories = allCats.filter(c => !collectionCategories.includes(c));

      renderCategoryRow('category-grid', primaryCategories, 'No categories found.');
      renderCategoryRow('collection-grid', collectionCategories, 'New collections coming soon.');
    } catch (err) { console.error('Error loading categories:', err); }
  }

  function renderCategoryRow(containerId, list, emptyMessage) {
    const row = document.getElementById(containerId);
    if (!row) return;

    if (list.length === 0) {
      row.innerHTML = `<p class="text-gray-500 w-full text-center py-6">${emptyMessage}</p>`;
      return;
    }

    row.innerHTML = list.map(cat => {
      const safeName = String(cat.name).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      const img = cat.image_url ? `<img src="${cat.image_url}" alt="${cat.name}" draggable="false" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">` : `<div class="w-full h-full flex items-center justify-center text-5xl">🧸</div>`;

      return `
        <div onclick="showCategoryProducts('${cat.id}', '${safeName}')"
             class="flex-none w-40 md:w-52 snap-start group cursor-pointer bg-white rounded-3xl shadow-sm border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 text-center select-none overflow-hidden flex flex-col">
            <div class="w-full aspect-square bg-gray-50 overflow-hidden relative border-b border-gray-100">${img}</div>
            <div class="p-4 pt-3 mt-auto"><h3 class="text-base md:text-lg font-semibold text-gray-900 group-hover:text-pink-500 transition-colors truncate">${cat.name}</h3></div>
        </div>`;
    }).join('');
  }

  async function showCategoryProducts(categoryId, categoryName) {
    const categoriesSection = document.getElementById('categories');
    const collectionsSection = document.getElementById('collections-section');
    const productSection = document.getElementById('product-display');
    const productGrid = document.getElementById('product-grid');
    const categoryTitle = document.getElementById('current-category-title');

    if (categoryTitle) categoryTitle.textContent = categoryName;

    if (categoriesSection && productSection) {
      categoriesSection.classList.add('hidden');
      if (collectionsSection) collectionsSection.classList.add('hidden');
      productSection.classList.remove('hidden');
      setTimeout(() => {
        productSection.classList.remove('opacity-0');
        productSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 10);
    }

    let categoryProds = [];
    try {
      const { data: junctionData } = await supabase.from('product_categories').select('products(*)').eq('category_id', categoryId);
      if (junctionData && junctionData.length > 0) categoryProds = junctionData.map(j => j.products).filter(Boolean);
      else {
        const { data } = await supabase.from('products').select('*').or(`category_id.eq.${categoryId},category_ids.cs.{"${categoryId}"}`);
        categoryProds = data || [];
      }
    } catch (e) { console.error('Error fetching category products:', e); }

    categoryProds.forEach(p => { if (!products.some(existing => existing.id === p.id)) products.push(p); });

    if (productGrid) {
      if (categoryProds.length === 0) {
        productGrid.innerHTML = `<p class="col-span-full w-full text-center text-gray-500 py-8">No products found in this category.</p>`;
      } else {
        productGrid.innerHTML = categoryProds.map(prod => {
          let imagesArr = [];
          try { imagesArr = Array.isArray(prod.images) ? prod.images : JSON.parse(prod.images || '[]'); } 
          catch (e) { imagesArr = [prod.images || 'https://via.placeholder.com/300']; }

          let priceDisplayHTML = `<p class="text-pink-500 font-bold text-base md:text-lg">₹${parseFloat(prod.price||0).toFixed(2)}</p>`;

          return `
            <div onclick="openProductModal('${prod.id}')" class="product-card min-w-0 w-64 md:w-72 flex-shrink-0 snap-center bg-white rounded-[1.5rem] md:rounded-[2rem] shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-gray-100 flex flex-col relative group overflow-hidden cursor-pointer">
                <div class="relative w-full aspect-square bg-[#FDFBF7] overflow-hidden group/slider rounded-t-[1.5rem] md:rounded-t-[2rem]">
                    <div class="flex overflow-x-auto overflow-y-hidden snap-x snap-mandatory h-full w-full no-scrollbar relative z-10 touch-pan-x">
                        <div class="min-w-full h-full flex-none snap-center flex items-center justify-center p-3 md:p-6">
                            <img src="${imagesArr[0]}" alt="${prod.title}" class="max-w-full max-h-full object-contain transition-transform duration-500 group-hover/slider:scale-105">
                        </div>
                    </div>
                </div>
                <div class="p-4 md:p-5 flex flex-col flex-grow border-t border-gray-50 relative z-20 bg-white">
                    <h3 class="font-semibold text-gray-900 group-hover:text-pink-500 transition-colors text-sm md:text-lg line-clamp-2 leading-tight z-10 mb-1 break-words">${prod.title}</h3>
                    <div class="mb-2">${priceDisplayHTML}</div>
                    <div class="grid grid-cols-2 gap-2 mt-auto z-10">
                        <button onclick="event.stopPropagation(); addToCart('${prod.id}')" class="w-full bg-gray-100 text-gray-800 py-2.5 rounded-xl text-xs font-semibold hover:bg-gray-200 transition-all flex justify-center items-center">Add to Cart</button>
                        <button onclick="event.stopPropagation(); buyNow('${prod.id}')" class="w-full bg-brand-900 text-white py-2.5 rounded-xl text-xs font-semibold hover:bg-pink-500 transition-all shadow-md flex justify-center items-center">Buy Now</button>
                    </div>
                </div>
            </div>
          `;
        }).join('');
      }
    }
  }

  function hideProducts() {
    const section = document.getElementById('product-display');
    const collectionsSection = document.getElementById('collections-section');
    if (!section) return;
    section.classList.add('opacity-0');
    setTimeout(() => {
      section.classList.add('hidden');
      document.getElementById('categories')?.classList.remove('hidden');
      if (collectionsSection) collectionsSection.classList.remove('hidden');
      document.getElementById('categories')?.scrollIntoView({ behavior: 'smooth' });
    }, 300);
  }

  async function loadCutestPepesShowcase() {
    const track = document.getElementById('cutest-pepes-track');
    if (!track) return;
    try {
      let { data: promoProducts } = await supabase.from('products').select('*').eq('is_bestseller', true);
      if (!promoProducts || promoProducts.length === 0) {
        const { data: fallbackProds } = await supabase.from('products').select('*').limit(6);
        promoProducts = fallbackProds || [];
      }
      if (promoProducts.length === 0) return;
      promoProducts.forEach(p => { if (!products.some(existing => existing.id === p.id)) products.push(p); });

      const cardsHTML = promoProducts.map(prod => {
        let imagesArr = [];
        try { imagesArr = Array.isArray(prod.images) ? prod.images : JSON.parse(prod.images || '[]'); } 
        catch (e) { imagesArr = [prod.images || '1.png']; }

        return `
          <div onclick="openProductModal('${prod.id}')" class="product-card min-w-0 w-64 md:w-72 flex-shrink-0 bg-white rounded-[1.5rem] shadow-sm hover:-translate-y-1 transition-all duration-300 border border-gray-100 flex flex-col relative group cursor-pointer">
              <div class="relative w-full aspect-square bg-[#FDFBF7] rounded-t-[1.5rem] overflow-hidden p-4">
                  <img src="${imagesArr[0]}" alt="${prod.title}" class="w-full h-full object-contain">
              </div>
              <div class="p-4 flex flex-col flex-grow border-t border-gray-50">
                  <h3 class="font-semibold text-gray-900 text-sm md:text-lg line-clamp-1">${prod.title}</h3>
                  <p class="text-pink-500 font-bold text-base mt-1">₹${parseFloat(prod.price||0).toFixed(2)}</p>
                  <button class="mt-4 w-full bg-brand-900 text-white py-2.5 rounded-xl text-xs font-semibold hover:bg-pink-500">View Product</button>
              </div>
          </div>
        `;
      }).join('');

      track.innerHTML = cardsHTML + cardsHTML;
      setInterval(() => { track.scrollLeft += 1; if (track.scrollLeft >= track.scrollWidth / 2) track.scrollLeft = 0; }, 20);
    } catch (err) { console.error('Error loading showcase:', err); }
  }

  // Bind Globals
  window.showCategoryProducts = showCategoryProducts;
  window.hideProducts = hideProducts;
  window.openProductModal = openProductModal;
  window.closeModal = closeModal;
  window.addToCart = addToCart;
  window.buyNow = buyNow;
  window.selectColor = selectColor;
  window.selectSize = selectSize;

  document.addEventListener('DOMContentLoaded', () => {
    checkUserSession();
    loadCategoriesAndCollections();
    loadCutestPepesShowcase();
  });
})();