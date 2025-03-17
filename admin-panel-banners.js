// admin-panel-banners.js - Script for banner management in Dtowin admin panel
import { auth, isUserHost, db, storage } from './firebase.js';
import { showNotification } from './admin-panel.js';
import { collection, addDoc, getDocs, getDoc, updateDoc, deleteDoc, doc, query, where, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.19.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/9.19.1/firebase-storage.js";

// DOM elements
const bannersContainer = document.getElementById('bannersContainer');
const bannerFormSection = document.getElementById('bannerFormSection');
const createBannerForm = document.getElementById('createBannerForm');
const headerCreateBannerBtn = document.getElementById('headerCreateBannerBtn');
const bannerFormTitle = document.getElementById('bannerFormTitle');
const cancelBannerButton = document.getElementById('cancelBannerButton');
const submitBannerButton = document.getElementById('submitBannerButton');

// Initialize banner management
export async function initBannersManagement() {
    try {
        console.log("Initializing banner management...");
        
        // Check if user is authenticated
        if (!auth.currentUser) {
            console.error("No authenticated user");
            window.location.href = "index.html";
            return;
        }
        
        // Check if user is host/admin
        const userIsHost = await isUserHost();
        
        if (!userIsHost) {
            showNotification("You don't have permissions to manage banners", "error");
            setTimeout(() => {
                window.location.href = "index.html";
            }, 3000);
            return;
        }
        
        // Set up event listeners
        setupEventListeners();
        
        // Load existing banners
        await loadBanners();
        
    } catch (error) {
        console.error("Error initializing banner management:", error);
        showNotification("Error loading banner management. Please try again.", "error");
    }
}

// Set up event listeners
function setupEventListeners() {
    console.log("Setting up event listeners...");
    
    // Create banner button
    if (headerCreateBannerBtn) {
        headerCreateBannerBtn.addEventListener('click', () => {
            resetBannerForm();
            showBannerForm();
        });
    } else {
        console.warn("Create Banner button not found");
    }
    
    // Cancel button
    if (cancelBannerButton) {
        cancelBannerButton.addEventListener('click', hideBannerForm);
    } else {
        console.warn("Cancel button not found");
    }
    
    // Form submission - Using the clean clone technique to prevent duplicate event listeners
    if (createBannerForm) {
        const clonedForm = createBannerForm.cloneNode(true);
        createBannerForm.parentNode.replaceChild(clonedForm, createBannerForm);
        
        // Update reference to the cloned form
        const updatedForm = document.getElementById('createBannerForm');
        updatedForm.addEventListener('submit', handleBannerFormSubmit);
        
        // Ensure submit button has type="submit"
        const submitBtn = document.getElementById('submitBannerButton');
        if (submitBtn && submitBtn.type !== 'submit') {
            submitBtn.type = 'submit';
        }
    } else {
        console.warn("Banner form not found");
    }
    
    // Image preview
    const bannerImagen = document.getElementById('bannerImagen');
    if (bannerImagen) {
        bannerImagen.addEventListener('change', handleBannerImagePreview);
    } else {
        console.warn("Banner image input not found");
    }
}

// Reset the banner form to its initial state
function resetBannerForm() {
    console.log("Resetting form");
    const form = document.getElementById('createBannerForm');
    if (form) {
        form.reset();
        
        // Reset button text and mode
        const submitBtn = document.getElementById('submitBannerButton');
        if (submitBtn) {
            submitBtn.textContent = 'Create Banner';
            submitBtn.dataset.editMode = 'false';
            delete submitBtn.dataset.bannerId;
        }
        
        // Reset form title
        if (bannerFormTitle) {
            bannerFormTitle.textContent = 'Create New Banner';
        }
        
        // Clear image preview
        const previews = form.querySelectorAll('.image-preview');
        previews.forEach(preview => preview.remove());
    } else {
        console.warn("Could not reset form because it doesn't exist");
    }
}

// Show the banner form
function showBannerForm() {
    console.log("Showing form");
    if (bannerFormSection) {
        bannerFormSection.classList.remove('hidden');
        // Scroll to form
        bannerFormSection.scrollIntoView({ behavior: 'smooth' });
    } else {
        console.warn("Form section not found");
    }
}

// Hide the banner form
function hideBannerForm() {
    console.log("Hiding form");
    if (bannerFormSection) {
        bannerFormSection.classList.add('hidden');
    } else {
        console.warn("Form section not found");
    }
}

// Handle banner image preview
function handleBannerImagePreview(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    console.log("Processing image preview:", file.name);
    
    // Check if it's an image
    if (!file.type.startsWith('image/')) {
        showNotification("File must be an image", "error");
        event.target.value = '';
        return;
    }
    
    // Check file size (max 5MB)
    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_SIZE) {
        showNotification("Image is too large. Maximum size is 5MB", "warning");
    }
    
    // Remove any existing preview
    const container = event.target.parentElement;
    const existingPreview = container.querySelector('.image-preview');
    if (existingPreview) {
        existingPreview.remove();
    }
    
    // Create preview element
    const reader = new FileReader();
    reader.onload = function(e) {
        const previewDiv = document.createElement('div');
        previewDiv.className = 'image-preview mt-2';
        previewDiv.innerHTML = `
            <p class="text-sm text-gray-600">Preview:</p>
            <img src="${e.target.result}" alt="Preview" class="h-32 object-cover rounded mt-1">
            <p class="text-xs text-gray-500">${file.name} (${(file.size / 1024).toFixed(1)} KB)</p>
        `;
        container.appendChild(previewDiv);
    };
    
    reader.onerror = function() {
        showNotification("Error generating preview", "error");
    };
    
    reader.readAsDataURL(file);
}

// Handle banner form submission
async function handleBannerFormSubmit(event) {
    event.preventDefault();
    console.log("Handling banner form submission");
    
    // Get form data
    const nombre = document.getElementById('bannerNombre').value.trim();
    const descripcion = document.getElementById('bannerDescripcion').value.trim();
    const url = document.getElementById('bannerUrl').value.trim();
    const orden = parseInt(document.getElementById('bannerOrden').value) || 1;
    const visible = document.getElementById('bannerVisible').checked;
    const bannerImagen = document.getElementById('bannerImagen');
    
    console.log("Form data:", { nombre, url, orden, visible });
    
    // Form validation
    if (!nombre) {
        showNotification("Banner name is required", "error");
        return;
    }
    
    // Verify the image is valid
    const imageFile = bannerImagen && bannerImagen.files.length > 0 ? bannerImagen.files[0] : null;
    const submitBtn = document.getElementById('submitBannerButton');
    const isEditMode = submitBtn && submitBtn.dataset.editMode === 'true';
    
    if (!imageFile && !isEditMode) {
        showNotification("You must select an image for the banner", "error");
        return;
    }
    
    if (imageFile && !imageFile.type.startsWith('image/')) {
        showNotification("File must be a valid image", "error");
        return;
    }
    
    // Check if we're in edit mode
    const bannerId = submitBtn ? submitBtn.dataset.bannerId : null;
    
    console.log("Mode:", isEditMode ? "Edit" : "Create", "ID:", bannerId);
    
    // Show loading state
    if (submitBtn) {
        submitBtn.disabled = true;
        const originalButtonText = submitBtn.textContent;
        submitBtn.innerHTML = '<div class="inline-block spinner rounded-full h-5 w-5 border-t-2 border-b-2 border-white mr-2"></div> Processing...';
    }
    
    try {
        // Prepare banner data
        const bannerData = {
            nombre,
            descripcion,
            url,
            orden,
            visible
        };
        
        let result;
        
        if (isEditMode && bannerId) {
            // Update existing banner
            console.log("Updating existing banner:", bannerId);
            result = await updateBanner(bannerId, bannerData, imageFile);
            showNotification("Banner updated successfully", "success");
        } else {
            // Create new banner
            console.log("Creating new banner");
            result = await createBanner(bannerData, imageFile);
            showNotification("Banner created successfully", "success");
        }
        
        console.log("Operation completed:", result);
        
        // Reset form and hide
        resetBannerForm();
        hideBannerForm();
        
        // Reload banners list
        await loadBanners();
        
    } catch (error) {
        console.error("Error processing banner:", error);
        showNotification(error.message || "Error processing banner", "error");
    } finally {
        // Restore button
        const submitButton = document.getElementById('submitBannerButton');
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = isEditMode ? 'Update Banner' : 'Create Banner';
        }
    }
}

// Create a new banner
async function createBanner(bannerData, imageFile) {
    try {
        console.log("Creating banner with data:", bannerData);
        
        const user = auth.currentUser;
        
        if (!user) {
            throw new Error("You must be logged in to create a banner");
        }
        
        // Check if user is host
        const userIsHost = await isUserHost();
        
        if (!userIsHost) {
            throw new Error("Only the host can create banners");
        }
        
        if (!imageFile) {
            throw new Error("Image is required to create a banner");
        }
        
        // Upload image first
        console.log("Uploading image to Storage...");
        const fileName = `banners_${Date.now()}_${imageFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const storageRef = ref(storage, `banners/${fileName}`);
        
        // Create blob to avoid CORS issues
        const arrayBuffer = await imageFile.arrayBuffer();
        const blob = new Blob([arrayBuffer], { type: imageFile.type });
        
        // Upload to Firebase Storage
        await uploadBytes(storageRef, blob);
        const imageUrl = await getDownloadURL(storageRef);
        
        console.log("Image uploaded, URL:", imageUrl);
        
        // Add banner to Firestore
        const bannerWithMetadata = {
            ...bannerData,
            imageUrl,
            createdBy: user.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };
        
        console.log("Saving banner to Firestore...");
        const bannerRef = await addDoc(collection(db, "banners"), bannerWithMetadata);
        
        return {
            id: bannerRef.id,
            success: true
        };
    } catch (error) {
        console.error("Error creating banner:", error);
        throw error;
    }
}

// Update an existing banner
async function updateBanner(bannerId, bannerData, imageFile) {
    try {
        console.log("Updating banner:", bannerId, "with data:", bannerData);
        
        const user = auth.currentUser;
        
        if (!user) {
            throw new Error("You must be logged in to update a banner");
        }
        
        // Check if user is host
        const userIsHost = await isUserHost();
        
        if (!userIsHost) {
            throw new Error("Only the host can update banners");
        }
        
        // Get banner reference
        const bannerRef = doc(db, "banners", bannerId);
        const bannerSnap = await getDoc(bannerRef);
        
        if (!bannerSnap.exists()) {
            throw new Error("Banner doesn't exist");
        }
        
        const currentBanner = bannerSnap.data();
        
        // Prepare data for update
        const updateData = {
            ...bannerData,
            updatedAt: serverTimestamp(),
            updatedBy: user.uid
        };
        
        // Keep current image URL if no new image is provided
        if (!imageFile) {
            updateData.imageUrl = currentBanner.imageUrl;
        } else {
            // Upload new image
            console.log("Uploading new image...");
            
            // Delete previous image if exists
            if (currentBanner.imageUrl) {
                try {
                    console.log("Deleting previous image...");
                    const urlPath = currentBanner.imageUrl.split('?')[0];
                    const fileName = urlPath.split('/').pop();
                    if (fileName) {
                        const storagePath = `banners/${fileName}`;
                        const oldImageRef = ref(storage, storagePath);
                        await deleteObject(oldImageRef).catch(error => {
                            console.warn("Error deleting previous image, it may not exist anymore:", error);
                        });
                    }
                } catch (error) {
                    console.warn("Error processing previous image URL:", error);
                    // Continue with update even if deletion fails
                }
            }
            
            // Upload new image
            const fileName = `banners_${Date.now()}_${imageFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
            const storageRef = ref(storage, `banners/${fileName}`);
            
            // Create blob to avoid CORS issues
            const arrayBuffer = await imageFile.arrayBuffer();
            const blob = new Blob([arrayBuffer], { type: imageFile.type });
            
            // Upload to Firebase Storage
            await uploadBytes(storageRef, blob);
            const imageUrl = await getDownloadURL(storageRef);
            
            updateData.imageUrl = imageUrl;
            console.log("New image uploaded, URL:", imageUrl);
        }
        
        // Update document
        await updateDoc(bannerRef, updateData);
        
        return {
            id: bannerId,
            success: true
        };
    } catch (error) {
        console.error("Error updating banner:", error);
        throw error;
    }
}

// Load and display banners
async function loadBanners() {
    try {
        if (!bannersContainer) {
            console.log("Banners container not found");
            return;
        }
        
        console.log("Loading banners...");
        
        // Show loading spinner
        bannersContainer.innerHTML = '<div class="flex justify-center py-8"><div class="spinner rounded-full h-8 w-8 border-t-2 border-b-2 border-orange-500"></div></div>';
        
        // Get banners from Firestore
        const bannersCollection = collection(db, "banners");
        const bannersQuery = query(bannersCollection, orderBy("orden", "asc"));
        const bannersSnapshot = await getDocs(bannersQuery);
        
        // Check if we have banners
        if (bannersSnapshot.empty) {
            console.log("No banners available");
            bannersContainer.innerHTML = '<p class="text-center text-gray-600 py-4">No banners available. Create your first banner.</p>';
            return;
        }
        
        console.log(`Found ${bannersSnapshot.size} banners`);
        
        // Convert to array
        const banners = [];
        bannersSnapshot.forEach(doc => {
            banners.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        // Create grid of banner cards
        let html = '<div class="grid grid-cols-1 md:grid-cols-2 gap-6">';
        
        banners.forEach(banner => {
            // Calculate date
            const fecha = banner.createdAt ? new Date(banner.createdAt.seconds * 1000) : new Date();
            const fechaFormateada = fecha.toLocaleDateString();
            
            // Status (visible/hidden)
            const estado = banner.visible !== false ? 
                '<span class="bg-green-100 text-green-600 py-1 px-2 rounded text-xs">Visible</span>' : 
                '<span class="bg-red-100 text-red-600 py-1 px-2 rounded text-xs">Hidden</span>';
            
            html += `
                <div class="bg-white rounded-lg shadow overflow-hidden" data-banner-id="${banner.id}">
                    <div class="relative">
                        <img src="${banner.imageUrl}" alt="${banner.nombre}" class="w-full h-48 object-cover">
                        <div class="absolute top-2 right-2 flex space-x-1">
                            <span class="bg-gray-800 bg-opacity-75 text-white py-1 px-2 rounded text-xs">Order: ${banner.orden}</span>
                            ${estado}
                        </div>
                    </div>
                    <div class="p-4">
                        <h3 class="font-bold text-lg mb-1">${banner.nombre}</h3>
                        <p class="text-gray-600 text-sm mb-2">${banner.descripcion || 'No description'}</p>
                        
                        <div class="flex justify-between items-center text-sm text-gray-500 mt-3">
                            <div class="truncate mr-2">
                                <span class="text-blue-500 font-medium">URL:</span> 
                                <a href="${banner.url}" target="_blank" class="hover:underline truncate">${banner.url || '#'}</a>
                            </div>
                            <span>Created: ${fechaFormateada}</span>
                        </div>
                        
                        <div class="mt-4 flex justify-end space-x-2 border-t pt-3">
                            <button class="text-blue-500 hover:text-blue-700 toggle-banner-visibility-btn" title="${banner.visible !== false ? 'Hide banner' : 'Show banner'}">
                                <i class="fas fa-eye${banner.visible !== false ? '' : '-slash'}"></i>
                            </button>
                            <button class="text-orange-500 hover:text-orange-700 edit-banner-btn" title="Edit banner">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="text-red-500 hover:text-red-700 delete-banner-btn" title="Delete banner">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        
        bannersContainer.innerHTML = html;
        
        // Add event listeners to action buttons
        addBannerEventListeners();
        
        console.log("Banners loaded successfully");
        
    } catch (error) {
        console.error("Error loading banners:", error);
        bannersContainer.innerHTML = '<p class="text-center text-red-500 py-4">Error loading banners. Please try again.</p>';
    }
}

// Add event listeners to banner cards
function addBannerEventListeners() {
    // Visibility toggle buttons
    document.querySelectorAll('.toggle-banner-visibility-btn').forEach(button => {
        button.addEventListener('click', async function() {
            const bannerCard = this.closest('[data-banner-id]');
            const bannerId = bannerCard.dataset.bannerId;
            
            try {
                // Get current data
                const bannerRef = doc(db, "banners", bannerId);
                const bannerSnap = await getDoc(bannerRef);
                
                if (!bannerSnap.exists()) {
                    showNotification("Banner not found", "error");
                    return;
                }
                
                const bannerData = bannerSnap.data();
                const newVisibility = bannerData.visible === false ? true : false;
                
                // Show loading
                const originalHtml = this.innerHTML;
                this.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                this.disabled = true;
                
                // Update visibility
                await updateDoc(bannerRef, {
                    visible: newVisibility,
                    updatedAt: serverTimestamp()
                });
                
                // Update UI
                const icon = this.querySelector('i');
                if (newVisibility) {
                    icon.className = 'fas fa-eye';
                    // Update status label
                    const statusLabel = bannerCard.querySelector('.absolute > span:last-child');
                    if (statusLabel) {
                        statusLabel.className = 'bg-green-100 text-green-600 py-1 px-2 rounded text-xs';
                        statusLabel.textContent = 'Visible';
                    }
                } else {
                    icon.className = 'fas fa-eye-slash';
                    // Update status label
                    const statusLabel = bannerCard.querySelector('.absolute > span:last-child');
                    if (statusLabel) {
                        statusLabel.className = 'bg-red-100 text-red-600 py-1 px-2 rounded text-xs';
                        statusLabel.textContent = 'Hidden';
                    }
                }
                
                this.title = newVisibility ? 'Hide banner' : 'Show banner';
                this.disabled = false;
                
                showNotification(`Banner ${newVisibility ? 'shown' : 'hidden'} successfully`, "success");
                
            } catch (error) {
                console.error("Error changing visibility:", error);
                showNotification("Error changing banner visibility", "error");
                
                // Restore button
                this.innerHTML = originalHtml;
                this.disabled = false;
            }
        });
    });
    
    // Edit buttons
    document.querySelectorAll('.edit-banner-btn').forEach(button => {
        button.addEventListener('click', async function() {
            const bannerId = this.closest('[data-banner-id]').dataset.bannerId;
            
            try {
                await loadBannerForEdit(bannerId);
            } catch (error) {
                console.error("Error loading banner for edit:", error);
                showNotification("Error loading banner for edit", "error");
            }
        });
    });
    
    // Delete buttons
    document.querySelectorAll('.delete-banner-btn').forEach(button => {
        button.addEventListener('click', async function() {
            const bannerCard = this.closest('[data-banner-id]');
            const bannerId = bannerCard.dataset.bannerId;
            const bannerName = bannerCard.querySelector('h3').textContent;
            
            if (confirm(`Are you sure you want to delete the banner "${bannerName}"?`)) {
                try {
                    // Show loading
                    const originalHtml = this.innerHTML;
                    this.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                    this.disabled = true;
                    
                    await deleteBanner(bannerId);
                    
                    // Remove card from UI
                    bannerCard.remove();
                    
                    showNotification("Banner deleted successfully", "success");
                    
                    // If no banners left, show message
                    if (document.querySelectorAll('[data-banner-id]').length === 0) {
                        bannersContainer.innerHTML = '<p class="text-center text-gray-600 py-4">No banners available. Create your first banner.</p>';
                    }
                    
                } catch (error) {
                    console.error("Error deleting banner:", error);
                    showNotification(error.message || "Error deleting banner", "error");
                    
                    // Restore button
                    this.innerHTML = originalHtml;
                    this.disabled = false;
                }
            }
        });
    });
}

// Load banner data for editing
async function loadBannerForEdit(bannerId) {
    try {
        console.log("Loading banner for edit:", bannerId);
        
        // Get banner data
        const bannerRef = doc(db, "banners", bannerId);
        const bannerSnap = await getDoc(bannerRef);
        
        if (!bannerSnap.exists()) {
            throw new Error("Banner not found for editing");
        }
        
        const banner = bannerSnap.data();
        console.log("Banner data:", banner);
        
        // Fill form with banner data
        document.getElementById('bannerNombre').value = banner.nombre || '';
        document.getElementById('bannerDescripcion').value = banner.descripcion || '';
        document.getElementById('bannerUrl').value = banner.url || '';
        document.getElementById('bannerOrden').value = banner.orden || 1;
        document.getElementById('bannerVisible').checked = banner.visible !== false;
        
        // Show current image
        if (banner.imageUrl) {
            const container = document.getElementById('bannerImagen').parentElement;
            const previewDiv = document.createElement('div');
            previewDiv.className = 'image-preview mt-2';
            previewDiv.innerHTML = `
                <p class="text-sm text-gray-600">Current image:</p>
                <img src="${banner.imageUrl}" alt="Current image" class="h-32 object-cover rounded mt-1">
                <p class="text-xs text-gray-500">Upload new image to replace (optional)</p>
            `;
            container.appendChild(previewDiv);
        }
        
        // Update form title and button
        const formTitleEl = document.getElementById('bannerFormTitle');
        if (formTitleEl) formTitleEl.textContent = 'Edit Banner';
        
        const submitBtn = document.getElementById('submitBannerButton');
        if (submitBtn) {
            submitBtn.textContent = 'Update Banner';
            submitBtn.dataset.editMode = 'true';
            submitBtn.dataset.bannerId = bannerId;
        }
        
        // Show form
        showBannerForm();
        
        console.log("Banner loaded for editing successfully");
        
    } catch (error) {
        console.error("Error loading banner for edit:", error);
        throw error;
    }
}

// Delete a banner
async function deleteBanner(bannerId) {
    try {
        console.log("Deleting banner:", bannerId);
        
        const user = auth.currentUser;
        
        if (!user) {
            throw new Error("You must be logged in to delete a banner");
        }
        
        // Check if user is host
        const userIsHost = await isUserHost();
        
        if (!userIsHost) {
            throw new Error("Only the host can delete banners");
        }
        
        // Get banner data for image deletion
        const bannerRef = doc(db, "banners", bannerId);
        const bannerSnap = await getDoc(bannerRef);
        
        if (!bannerSnap.exists()) {
            throw new Error("Banner doesn't exist");
        }
        
        const bannerData = bannerSnap.data();
        
        // Delete image from storage if exists
        if (bannerData.imageUrl) {
            try {
                console.log("Deleting banner image...");
                const urlPath = bannerData.imageUrl.split('?')[0];
                const fileName = urlPath.split('/').pop();
                if (fileName) {
                    const storagePath = `banners/${fileName}`;
                    const imageRef = ref(storage, storagePath);
                    await deleteObject(imageRef).catch(error => {
                        console.warn("Error deleting image, it may not exist anymore:", error);
                    });
                }
            } catch (error) {
                console.warn("Error deleting image:", error);
                // Continue with deletion anyway
            }
        }
        
        // Delete banner document
        await deleteDoc(bannerRef);
        
        console.log("Banner deleted successfully");
        
        return {
            success: true
        };
    } catch (error) {
        console.error("Error deleting banner:", error);
        throw error;
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initBannersManagement);

// Export functions
export {
    loadBanners,
    initBannersManagement
};
