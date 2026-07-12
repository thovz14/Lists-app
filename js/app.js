const pb = new PocketBase('http://192.168.200.15:8090'); 

let currentListOwnerId = null;
let currentListId = null;
let currentListSlug = null;
let currentListShowAfgestreept = false;
let newListSlugTemp = null;
let currentGifts = [];
let currentCategories = ["Lijstje"];
let currentRecord = null;

async function init() {
    const path = window.location.pathname;
    const slug = path.replace(/^\/+|\/+$/g, '');

    setupEventListeners();
    updateAuthUI();

    pb.authStore.onChange(() => {
        updateAuthUI();
        if (currentListId) {
            // Herlaad de view zodat de beheerderknoppen direct verschijnen na inloggen
            loadList(currentListSlug);
        }
    });

    if (slug && slug !== 'index.html') {
        showView('loader-view');
        await loadList(slug);
    } else {
        showView('homepage-view');
    }
}

function showView(viewId) {
    const views = ['loader-view', 'homepage-view', 'list-view', 'error-view'];
    views.forEach(id => {
        document.getElementById(id).style.display = (id === viewId) ? 'block' : 'none';
    });
}

function closeModals() {
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.classList.remove('show');
        setTimeout(() => { modal.style.display = 'none'; }, 300);
    });
}

function openModal(id) {
    const modal = document.getElementById(id);
    modal.style.display = 'flex';
    setTimeout(() => { modal.classList.add('show'); }, 10);
}

function updateAuthUI() {
    const isLoggedIn = pb.authStore.isValid;
    const btnLogin = document.getElementById('btn-open-login');
    const userDiv = document.getElementById('logged-in-user');
    const userEmail = document.getElementById('user-email');

    if (isLoggedIn) {
        btnLogin.style.display = 'none';
        userDiv.style.display = 'flex';
        userEmail.innerText = pb.authStore.model.email;
        
        const navMyLists = document.getElementById('nav-my-lists');
        if (navMyLists) navMyLists.style.display = 'flex';
    } else {
        btnLogin.style.display = 'block';
        userDiv.style.display = 'none';
        
        const navMyLists = document.getElementById('nav-my-lists');
        if (navMyLists) navMyLists.style.display = 'none';
    }
}

function setupEventListeners() {
    document.getElementById('btn-open-login').addEventListener('click', () => openModal('modal-login'));
    document.getElementById('btn-logout').addEventListener('click', () => {
        pb.authStore.clear();
        window.location.reload();
    });
    document.getElementById('btn-confirm-login').addEventListener('click', loginWithWonderID);

    document.getElementById('username').addEventListener('keypress', e => { if (e.key === 'Enter') openCreateModal(); });
    document.getElementById('btn-open-create-modal').addEventListener('click', openCreateModal);
    document.getElementById('btn-confirm-create').addEventListener('click', createNewList);

    document.getElementById('btn-open-add-modal').addEventListener('click', () => {
        switchAddTab('search');
        document.getElementById('import-url').value = '';
        document.getElementById('import-error').style.display = 'none';
        openModal('modal-add-item');
    });
    
    document.getElementById('btn-do-import').addEventListener('click', importFromUrl);
    document.getElementById('import-url').addEventListener('keypress', e => { if (e.key === 'Enter') importFromUrl(); });
    document.getElementById('btn-confirm-add-item').addEventListener('click', addItem);
}

// Haal eigen lijstjes op en open de modal
window.openMyListsModal = async function() {
    if (!pb.authStore.isValid) return;
    try {
        const lists = await pb.collection('lists').getFullList({ filter: `owner = "${pb.authStore.model.id}"`, sort: '-created' });
        const container = document.getElementById('my-lists-container');
        
        if (lists.length === 0) {
            container.innerHTML = '<p class="text-light">Je hebt nog geen lijstjes gemaakt.</p>';
        } else {
            container.innerHTML = lists.map(l => `
                <a href="/${l.slug}" style="padding: 15px; border: 1px solid var(--border-color); border-radius: var(--radius-md); text-decoration: none; color: var(--text-main); font-weight: 600; background: var(--bg-color); display: flex; justify-content: space-between; align-items: center;">
                    <span>🎁 ${l.slug}</span>
                    <span class="text-primary">Naar lijstje ➔</span>
                </a>
            `).join('');
        }
        openModal('modal-my-lists');
    } catch(err) {
        console.error(err);
        alert('Kon lijstjes niet ophalen.');
    }
}

window.switchAddTab = function(tab) {
    document.getElementById('tab-search').classList.remove('active');
    document.getElementById('tab-manual').classList.remove('active');
    
    document.getElementById(`tab-${tab}`).classList.add('active');
    
    if (tab === 'search') {
        document.getElementById('view-search').style.display = 'block';
        document.getElementById('view-manual').style.display = 'none';
    } else {
        document.getElementById('view-search').style.display = 'none';
        document.getElementById('view-manual').style.display = 'block';
    }
}

window.updateFileName = function(input) {
    const span = input.nextElementSibling;
    if (input.files && input.files.length > 0) {
        span.innerHTML = `✅ ${input.files[0].name}`;
        span.style.color = 'var(--primary)';
    } else {
        span.innerHTML = `📸 Klik hier om een foto te kiezen`;
        span.style.color = '';
    }
}

// Slimme URL Import + Bol.com Fallback
async function importFromUrl() {
    let url = document.getElementById('import-url').value.trim();
    if (!url) return;
    
    if (!url.startsWith('http')) url = 'https://' + url;

    document.getElementById('import-loading').style.display = 'block';
    document.getElementById('import-error').style.display = 'none';

    try {
        const res = await fetch(`https://api.microlink.io?url=${encodeURIComponent(url)}`);
        const data = await res.json();
        
        document.getElementById('import-loading').style.display = 'none';
        
        if (data.status === 'success' && data.data) {
            let title = data.data.title || '';
            
            // Bol.com fallback als de titel alleen 'bol' of 'bol.com' is
            if (title.toLowerCase() === 'bol' || title.toLowerCase() === 'bol.com') {
                const match = url.match(/\/p\/([^\/]+)/);
                if (match && match[1]) {
                    title = match[1].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                }
            }

            document.getElementById('modal-item-title').value = title;
            document.getElementById('modal-item-url').value = url;
            
            if (data.data.image && data.data.image.url) {
                document.getElementById('modal-item-img-url').value = data.data.image.url;
            } else {
                document.getElementById('modal-item-img-url').value = '';
            }
            
            switchAddTab('manual');
        } else {
            document.getElementById('import-error').style.display = 'block';
        }
    } catch (err) {
        document.getElementById('import-loading').style.display = 'none';
        document.getElementById('import-error').style.display = 'block';
    }
}

async function loginWithWonderID() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    try {
        const btn = document.getElementById('btn-confirm-login');
        btn.innerText = 'Bezig...';
        await pb.collection('users').authWithPassword(email, password);
        closeModals();
        btn.innerText = 'Inloggen';
    } catch (err) {
        alert('Inloggen mislukt.');
        document.getElementById('btn-confirm-login').innerText = 'Inloggen';
    }
}

function openCreateModal() {
    if (!pb.authStore.isValid) {
        document.getElementById('login-warning').style.display = 'block';
        openModal('modal-login');
        return;
    }

    const slugInput = document.getElementById('username').value.trim().toLowerCase().replace(/[^a-z0-9-]/g, ''); 
    if (!slugInput) return alert('Vul eerst een naam in!');
    
    newListSlugTemp = slugInput;
    document.getElementById('modal-list-name').value = "wonderdev.nl/" + newListSlugTemp;
    
    openModal('modal-create-list');
}

async function createNewList() {
    const fileInput = document.getElementById('modal-profile-pic');
    try {
        const btn = document.getElementById('btn-confirm-create');
        btn.innerText = 'Lanceren...';
        btn.disabled = true;

        const formData = new FormData();
        formData.append('slug', newListSlugTemp);
        formData.append('owner', pb.authStore.model.id);
        formData.append('date', document.getElementById('modal-list-date').value);
        formData.append('occasion', document.getElementById('modal-list-occasion').value);
        formData.append('categories', JSON.stringify(["Lijstje"]));
        
        if (fileInput.files.length > 0) {
            formData.append('avatar', fileInput.files[0]);
        }

        await pb.collection('lists').create(formData);
        window.location.href = `/${newListSlugTemp}`;
    } catch (error) {
        alert('Fout! Bestaat deze naam al?');
        document.getElementById('btn-confirm-create').innerText = 'Lijstje lanceren 🚀';
        document.getElementById('btn-confirm-create').disabled = false;
    }
}

async function loadList(slug) {
    try {
        const record = await pb.collection('lists').getFirstListItem(`slug="${slug}"`, { expand: 'owner' });
        currentListId = record.id;
        currentListSlug = record.slug;
        currentListOwnerId = record.owner;
        currentListShowAfgestreept = record.showAfgestreept || false;
        currentRecord = record;
        
        // Parse categories safely
        if (record.categories) {
            currentCategories = typeof record.categories === 'string' ? JSON.parse(record.categories) : record.categories;
        } else {
            currentCategories = ["Lijstje"];
        }
        
        renderListProfile(record);
        await loadGifts(record.id);
        showView('list-view');
    } catch (error) {
        document.getElementById('error-message').innerText = `Het lijstje met link "/${slug}" bestaat niet.`;
        showView('error-view');
    }
}

function renderListProfile(record) {
    document.getElementById('profile-title').innerText = record.slug;
    
    const adminName = record.expand && record.expand.owner && record.expand.owner.username 
                      ? record.expand.owner.username 
                      : 'Onbekend';
    document.getElementById('profile-admin').innerHTML = `<span>👤</span> Beheerder: ${adminName}`;
    
    const picElement = document.getElementById('profile-pic-element');
    if (record.avatar) {
        const fileUrl = pb.files.getUrl(record, record.avatar);
        picElement.style.backgroundImage = `url('${fileUrl}')`;
        picElement.innerHTML = '';
    } else {
        picElement.style.backgroundImage = 'none';
        picElement.innerHTML = '🎁';
        picElement.style.display = 'flex';
        picElement.style.alignItems = 'center';
        picElement.style.justifyContent = 'center';
        picElement.style.fontSize = '4rem';
    }
    
    // Datum & Gelegenheid weergeven
    const listDate = record.date ? new Date(record.date).toLocaleDateString('nl-NL') : '';
    const listOccasion = record.occasion || '';
    const eventDiv = document.getElementById('profile-event-info');
    if (listDate || listOccasion) {
        eventDiv.innerHTML = `<p style="color: var(--primary); font-weight: 700; margin-top: 5px;"><span>🎉</span> ${listOccasion} ${listDate ? '- ' + listDate : ''}</p>`;
        eventDiv.style.display = 'block';
    } else {
        eventDiv.style.display = 'none';
    }
    
    if (pb.authStore.isValid && pb.authStore.model.id === currentListOwnerId) {
        document.getElementById('owner-add-section').style.display = 'flex';
        document.getElementById('owner-controls').style.display = 'flex';
    } else {
        document.getElementById('owner-add-section').style.display = 'none';
        document.getElementById('owner-controls').style.display = 'none';
    }
}

window.copyListLink = function() {
    navigator.clipboard.writeText(window.location.href);
    alert("Link gekopieerd!");
}

window.openEditListModal = function() {
    document.getElementById('edit-list-name').value = currentListSlug;
    document.getElementById('edit-show-afgestreept').checked = currentListShowAfgestreept;
    document.getElementById('edit-list-date').value = currentRecord.date ? currentRecord.date.split(' ')[0] : '';
    document.getElementById('edit-list-occasion').value = currentRecord.occasion || '';
    openModal('modal-edit-list');
}

window.saveListEdit = async function() {
    const newSlug = document.getElementById('edit-list-name').value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    const fileInput = document.getElementById('edit-profile-pic');
    const showAfgestreept = document.getElementById('edit-show-afgestreept').checked;
    const date = document.getElementById('edit-list-date').value;
    const occasion = document.getElementById('edit-list-occasion').value;
    
    if (!newSlug) return alert("Vul een naam in");

    try {
        const btn = document.getElementById('btn-confirm-edit-list');
        btn.innerText = 'Opslaan...';
        btn.disabled = true;

        const formData = new FormData();
        formData.append('slug', newSlug);
        formData.append('showAfgestreept', showAfgestreept);
        formData.append('date', date);
        formData.append('occasion', occasion);
        
        if (fileInput.files.length > 0) {
            formData.append('avatar', fileInput.files[0]);
        }

        await pb.collection('lists').update(currentListId, formData);
        
        if (newSlug !== currentListSlug) {
            window.location.href = `/${newSlug}`;
        } else {
            window.location.reload();
        }
    } catch(err) {
        alert("Fout bij opslaan. Bestaat deze naam al?");
        document.getElementById('btn-confirm-edit-list').innerText = 'Opslaan';
        document.getElementById('btn-confirm-edit-list').disabled = false;
    }
}

window.deleteList = async function() {
    if (!confirm("Weet je zeker dat je dit lijstje wilt verwijderen? Dit verwijdert ook ALLE cadeaus op dit lijstje. Dit kan niet ongedaan worden gemaakt!")) return;
    try {
        // Eerst alle cadeaus ophalen en verwijderen
        const giftsToDelete = await pb.collection('gifts').getFullList({ filter: `listId = "${currentListId}"` });
        for (const gift of giftsToDelete) {
            await pb.collection('gifts').delete(gift.id);
        }
        
        // Daarna pas het lijstje verwijderen
        await pb.collection('lists').delete(currentListId);
        window.location.href = '/';
    } catch(err) {
        console.error(err);
        alert("Kon het lijstje (of de cadeaus) niet verwijderen");
    }
}

window.deleteGift = async function(giftId) {
    if (!confirm("Weet je zeker dat je dit cadeau wilt verwijderen?")) return;
    try {
        await pb.collection('gifts').delete(giftId);
        await loadGifts(currentListId);
    } catch(err) {
        alert("Fout bij verwijderen");
    }
}

window.openEditGiftModal = function(giftId) {
    const gift = currentGifts.find(g => g.id === giftId);
    if (!gift) return;
    
    document.getElementById('edit-gift-id').value = gift.id;
    document.getElementById('edit-gift-title').value = gift.title || '';
    document.getElementById('edit-gift-price').value = gift.price || '';
    document.getElementById('edit-gift-url').value = gift.shopUrl || '';
    
    const fileInput = document.getElementById('edit-gift-img');
    fileInput.value = '';
    
    const span = fileInput.nextElementSibling;
    span.innerHTML = '📸 Klik hier om een nieuwe foto te kiezen';
    span.style.color = '';
    
    openModal('modal-edit-gift');
}

window.saveGiftEdit = async function() {
    const giftId = document.getElementById('edit-gift-id').value;
    const title = document.getElementById('edit-gift-title').value.trim();
    const price = document.getElementById('edit-gift-price').value.trim();
    const url = document.getElementById('edit-gift-url').value.trim();
    const fileInput = document.getElementById('edit-gift-img');
    
    if (!title) return alert("Vul een titel in!");
    
    try {
        const btn = document.getElementById('btn-confirm-edit-gift');
        btn.innerText = 'Opslaan...';
        btn.disabled = true;
        
        const formData = new FormData();
        formData.append('title', title);
        formData.append('price', price);
        formData.append('shopUrl', url);
        
        if (fileInput.files.length > 0) {
            formData.append('image', fileInput.files[0]);
        }
        
        await pb.collection('gifts').update(giftId, formData);
        
        closeModals();
        btn.innerText = 'Opslaan';
        btn.disabled = false;
        
        await loadGifts(currentListId);
    } catch(err) {
        alert("Fout bij opslaan van cadeau.");
        document.getElementById('btn-confirm-edit-gift').innerText = 'Opslaan';
        document.getElementById('btn-confirm-edit-gift').disabled = false;
    }
}

window.addNewCategory = async function() {
    const catName = prompt("Hoe moet de nieuwe categorie heten?");
    if (!catName || catName.trim() === "") return;
    
    if (!currentCategories.includes(catName.trim())) {
        currentCategories.push(catName.trim());
        try {
            await pb.collection('lists').update(currentListId, {
                categories: currentCategories
            });
            await loadGifts(currentListId);
        } catch(err) {
            alert("Kon categorie niet opslaan");
        }
    }
}

window.deleteCategory = async function(catName) {
    if (currentCategories.length <= 1) {
        return alert("Je moet minimaal 1 categorie overhouden!");
    }
    if (!confirm(`Weet je zeker dat je de categorie '${catName}' wilt verwijderen? Eventuele cadeaus worden verplaatst naar de eerste categorie.`)) return;

    currentCategories = currentCategories.filter(c => c !== catName);
    const fallbackCat = currentCategories[0];
    
    try {
        const giftsToMove = currentGifts.filter(g => g.category === catName);
        for (const g of giftsToMove) {
            await pb.collection('gifts').update(g.id, { category: fallbackCat });
        }
        
        await pb.collection('lists').update(currentListId, {
            categories: currentCategories
        });
        
        await loadGifts(currentListId);
    } catch (err) {
        alert("Fout bij verwijderen van categorie.");
    }
}

async function loadGifts(listId) {
    try {
        const gifts = await pb.collection('gifts').getFullList({ filter: `listId = "${listId}"`, sort: 'order' });
        currentGifts = gifts;
        const wrapper = document.getElementById('categories-wrapper');
        const isOwner = (pb.authStore.isValid && pb.authStore.model.id === currentListOwnerId);
        
        wrapper.innerHTML = '';
        
        const catSelect = document.getElementById('modal-item-category');
        catSelect.innerHTML = currentCategories.map(c => `<option value="${c}">${c}</option>`).join('');

        for (const cat of currentCategories) {
            const catGifts = gifts.filter(g => g.category === cat || (!g.category && cat === currentCategories[0]));
            
            let itemsHTML = catGifts.map((gift) => {
                let priceText = gift.price ? gift.price : '';
                let webshopText = gift.shopUrl ? `<a href="${gift.shopUrl}" target="_blank">Bekijk in webshop ↗</a>` : ``;
                
                let imgSrcHtml = '🎁';
                if (gift.image) {
                    const fileUrl = pb.files.getUrl(gift, gift.image);
                    imgSrcHtml = `<img src="${fileUrl}" alt="cadeau">`;
                } else if (gift.imageUrl) {
                    imgSrcHtml = `<img src="${gift.imageUrl}" alt="cadeau">`;
                }

                let btnHtml = '';
                let deleteBtnHtml = '';
                
                if (isOwner) {
                    deleteBtnHtml = `
                        <button class="btn-cancel" onclick="openEditGiftModal('${gift.id}')" style="background:transparent; color:var(--text-main); padding: 5px; font-size: 1.2rem; border-radius: 50%; width: 40px; height: 40px; display:flex; justify-content:center; align-items:center;" title="Bewerken">✏️</button>
                        <button class="btn-cancel" onclick="deleteGift('${gift.id}')" style="background:transparent; color:var(--error-color); padding: 5px; font-size: 1.2rem; border-radius: 50%; width: 40px; height: 40px; display:flex; justify-content:center; align-items:center;" title="Verwijderen">🗑️</button>
                        <div class="drag-handle" style="cursor: grab; font-size: 1.5rem; color: var(--text-light); margin-left:10px;">⋮⋮</div>
                    `;
                    
                    if (currentListShowAfgestreept) {
                        if (gift.afgestreept) {
                            btnHtml = `<div style="background:var(--bg-color); padding:8px 16px; border-radius:100px; font-weight:bold; color:var(--primary);">✅ Gekocht door iemand!</div>`;
                        } else {
                            btnHtml = `<div style="padding:8px 16px; color:var(--text-light); font-weight:600;">Nog open</div>`;
                        }
                    } else {
                        btnHtml = `<div style="padding:8px 16px; color:var(--text-light); font-weight:600;">🤫 Verborgen status</div>`;
                    }
                } else {
                    if (gift.afgestreept) {
                        btnHtml = `<button class="btn-afstrepen afgestreept" onclick="toggleAfstrepen('${gift.id}', false)">✅ Gekocht (undo)</button>`;
                    } else {
                        btnHtml = `<button class="btn-afstrepen" onclick="toggleAfstrepen('${gift.id}', true)">☑ Afstrepen</button>`;
                    }
                }

                return `
                <div class="item-row ${gift.afgestreept ? 'item-done' : ''}" data-id="${gift.id}" style="align-items: flex-start;">
                    <div class="item-details" style="flex: 1;">
                        <h4 style="font-size: 1.25rem; margin-bottom: 5px;">${gift.title}</h4>
                        <p style="margin-bottom: 15px;">${priceText} ${webshopText}</p>
                        <div style="display:flex; align-items:center; gap: 10px; flex-wrap: wrap;">
                            ${btnHtml}
                            ${deleteBtnHtml}
                        </div>
                    </div>
                    <div class="item-img-large">
                        ${imgSrcHtml}
                    </div>
                </div>
                `;
            }).join('');

            if(catGifts.length === 0) itemsHTML = `<div class="empty-msg" style="text-align: center; color: var(--text-light); padding: 20px; border: 2px dashed var(--border-color); border-radius: 16px;">Geen cadeaus in ${cat}.</div>`;
            
            const catSection = document.createElement('div');
            catSection.className = 'category-section';
            catSection.style.marginBottom = '3rem';
            
            let deleteCatHtml = '';
            if (isOwner && currentCategories.length > 1) {
                deleteCatHtml = `<button onclick="deleteCategory('${cat.replace(/'/g, "\\'")}')" style="background:transparent; border:none; color:var(--error-color); cursor:pointer; font-size: 1.2rem; margin-left:15px; padding: 5px;" title="Categorie verwijderen">🗑️</button>`;
            }

            catSection.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 2px solid var(--border-color); padding-bottom:10px; margin-bottom:1.5rem;">
                    <h3 class="category-title" style="border:none; padding:0; margin:0;">${cat}</h3>
                    ${deleteCatHtml}
                </div>
                <div class="items-container" data-category="${cat}" style="display:flex; flex-direction:column; gap: 1.5rem;">
                    ${itemsHTML}
                </div>
            `;
            wrapper.appendChild(catSection);
        }

        if (isOwner && typeof Sortable !== 'undefined') {
            document.querySelectorAll('.items-container').forEach(container => {
                new Sortable(container, {
                    group: 'gifts',
                    handle: '.drag-handle',
                    animation: 150,
                    onAdd: function(evt) {
                        const emptyMsg = evt.to.querySelector('.empty-msg');
                        if (emptyMsg) emptyMsg.remove();
                    },
                    onRemove: function(evt) {
                        if (evt.from.children.length === 0) {
                            const catName = evt.from.getAttribute('data-category');
                            evt.from.innerHTML = `<div class="empty-msg" style="text-align: center; color: var(--text-light); padding: 20px; border: 2px dashed var(--border-color); border-radius: 16px;">Geen cadeaus in ${catName}.</div>`;
                        }
                    },
                    onEnd: async function(evt) {
                        const giftId = evt.item.getAttribute('data-id');
                        const newCategory = evt.to.getAttribute('data-category');
                        
                        try {
                            await pb.collection('gifts').update(giftId, { category: newCategory });
                            
                            const children = Array.from(evt.to.children);
                            for (let i = 0; i < children.length; i++) {
                                const id = children[i].getAttribute('data-id');
                                if (id) pb.collection('gifts').update(id, { order: i, category: newCategory }).catch(console.error);
                            }
                        } catch(err) {}
                    }
                });
            });
        }
    } catch (err) {
        console.error(err);
    }
}

window.toggleAfstrepen = async function(giftId, val) {
    try {
        await pb.collection('gifts').update(giftId, { afgestreept: val });
        await loadGifts(currentListId);
    } catch (err) {
        alert("Fout bij afstrepen. Staan de update permissies goed?");
    }
}

async function addItem() {
    if (!currentListId) return;

    const title = document.getElementById('modal-item-title').value.trim();
    const url = document.getElementById('modal-item-url').value.trim();
    const price = document.getElementById('modal-item-price').value.trim();
    const fileInput = document.getElementById('modal-item-img');
    const importedImgUrl = document.getElementById('modal-item-img-url').value;

    if (!title) return alert('Vul een titel in!');

    try {
        const btn = document.getElementById('btn-confirm-add-item');
        btn.innerText = 'Opslaan...';
        btn.disabled = true;

        const formData = new FormData();
        formData.append('listId', currentListId);
        formData.append('title', title);
        formData.append('shopUrl', url);
        formData.append('price', price);
        formData.append('category', document.getElementById('modal-item-category').value);
        
        // Stuur de imageUrl mee als tekst, zodat we geen complexe blob-downloads nodig hebben.
        if (importedImgUrl && fileInput.files.length === 0) {
            formData.append('imageUrl', importedImgUrl);
        }

        if (fileInput.files.length > 0) {
            formData.append('image', fileInput.files[0]);
        }

        await pb.collection('gifts').create(formData);
        
        // Reset velden
        document.getElementById('modal-item-title').value = '';
        document.getElementById('modal-item-url').value = '';
        document.getElementById('modal-item-price').value = '';
        document.getElementById('modal-item-img-url').value = '';
        fileInput.value = '';

        closeModals();
        btn.innerText = 'Cadeau opslaan';
        btn.disabled = false;
        
        await loadGifts(currentListId);
    } catch (error) {
        console.error("PocketBase Error Data:", error);
        alert('Fout bij opslaan. Details: ' + JSON.stringify(error.response?.data || error.data || error));
        document.getElementById('btn-confirm-add-item').innerText = 'Cadeau opslaan';
        document.getElementById('btn-confirm-add-item').disabled = false;
    }
}

window.addEventListener('DOMContentLoaded', init);

window.toggleMobileMenu = function() {
    const nav = document.getElementById('desktop-nav');
    const overlay = document.getElementById('mobile-overlay');
    if (nav.classList.contains('open')) {
        nav.classList.remove('open');
        overlay.classList.remove('open');
    } else {
        nav.classList.add('open');
        overlay.classList.add('open');
    }
}
