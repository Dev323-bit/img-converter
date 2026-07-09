document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('file-input');
    const btnBrowse = document.getElementById('btn-browse');
    const workspace = document.getElementById('workspace');
    
    // Global controls
    const globalFormat = document.getElementById('global-format');
    const globalQuality = document.getElementById('global-quality');
    const globalQualityVal = document.getElementById('global-quality-val');
    const globalQualityWrapper = document.getElementById('global-quality-wrapper');
    const globalColorWrapper = document.getElementById('global-color-wrapper');
    const globalBgColor = document.getElementById('global-bg-color');
    const globalBgColorText = document.getElementById('global-bg-color-text');
    
    const btnClearAll = document.getElementById('btn-clear-all');
    const btnConvertAll = document.getElementById('btn-convert-all');
    
    // File grid
    const fileGrid = document.getElementById('file-grid');
    const fileCount = document.getElementById('file-count');
    
    // Bulk action panel
    const bulkFooter = document.getElementById('bulk-footer');
    const bulkConvertedCount = document.getElementById('bulk-converted-count');
    const bulkProgressBar = document.getElementById('bulk-progress-bar');
    const btnDownloadAll = document.getElementById('btn-download-all');
    
    // Modal
    const previewModal = document.getElementById('preview-modal');
    const modalBackdrop = document.getElementById('modal-backdrop');
    const btnCloseModal = document.getElementById('btn-close-modal');
    const modalFilename = document.getElementById('modal-filename');
    const modalImgOrig = document.getElementById('modal-img-orig');
    const modalImgConv = document.getElementById('modal-img-conv');
    const modalFormatOrig = document.getElementById('modal-format-orig');
    const modalSizeOrig = document.getElementById('modal-size-orig');
    const modalFormatConv = document.getElementById('modal-format-conv');
    const modalSizeConv = document.getElementById('modal-size-conv');
    
    const toastContainer = document.getElementById('toast-container');

    // App State
    let files = [];
    let avifSupported = false;
    let heicLibLoading = false;

    // Initialize support check
    checkAvifSupport().then(supported => {
        avifSupported = supported;
        if (!supported) {
            // Remove AVIF options from selectors
            const avifOptions = document.querySelectorAll('option[value="image/avif"]');
            avifOptions.forEach(opt => opt.remove());
        }
    });

    // Event Listeners for Drag and Drop
    ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.add('drag-active');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.remove('drag-active');
        }, false);
    });

    dropzone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const droppedFiles = dt.files;
        handleFiles(droppedFiles);
    });

    btnBrowse.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
        fileInput.value = ''; // Reset input to allow re-uploading same file
    });

    // Global Config Listeners
    globalFormat.addEventListener('change', (e) => {
        const targetFormat = e.target.value;
        toggleSlidersVisibility(targetFormat, 'global');
        
        // Update target format for all files that haven't been successfully converted yet
        files.forEach(f => {
            if (f.status !== 'success') {
                f.targetFormat = targetFormat;
            }
        });
        checkTransparencyLossAcrossAll();
        render();
    });

    globalQuality.addEventListener('input', (e) => {
        const q = e.target.value;
        globalQualityVal.textContent = `${q}%`;
        files.forEach(f => {
            if (f.status !== 'success') {
                f.quality = q;
            }
        });
    });

    // Sync Hex Color inputs
    globalBgColor.addEventListener('input', (e) => {
        globalBgColorText.value = e.target.value;
    });

    globalBgColorText.addEventListener('input', (e) => {
        let val = e.target.value;
        if (val.startsWith('#') && val.length === 7) {
            globalBgColor.value = val;
        } else if (val.length === 6) {
            globalBgColor.value = `#${val}`;
            e.target.value = `#${val}`;
        }
    });

    // Bulk actions
    btnClearAll.addEventListener('click', () => {
        // Revoke Object URLs to prevent memory leaks
        files.forEach(f => {
            if (f.origUrl) URL.revokeObjectURL(f.origUrl);
            if (f.convertedUrl) URL.revokeObjectURL(f.convertedUrl);
            if (f.thumbnailUrl) URL.revokeObjectURL(f.thumbnailUrl);
        });
        files = [];
        render();
        showToast('Cleared all files', 'info');
    });

    btnConvertAll.addEventListener('click', async () => {
        const pendingFiles = files.filter(f => f.status === 'pending' || f.status === 'error');
        if (pendingFiles.length === 0) {
            showToast('No pending files to convert', 'info');
            return;
        }

        btnConvertAll.disabled = true;
        btnClearAll.disabled = true;

        for (const fileItem of pendingFiles) {
            try {
                await convertSingleFile(fileItem);
            } catch (err) {
                console.error('Error in batch convert for file: ', fileItem.name, err);
            }
        }

        btnConvertAll.disabled = false;
        btnClearAll.disabled = false;
        render();
    });

    btnDownloadAll.addEventListener('click', downloadAllAsZip);

    // Modal close
    btnCloseModal.addEventListener('click', closeModal);
    modalBackdrop.addEventListener('click', closeModal);

    // Helper functions
    async function checkAvifSupport() {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            canvas.width = 1;
            canvas.height = 1;
            canvas.toBlob((blob) => {
                if (blob && blob.type === 'image/avif') {
                    resolve(true);
                } else {
                    resolve(false);
                }
            }, 'image/avif');
        });
    }

    function formatSupportsAlpha(mimeType) {
        return mimeType === 'image/png' || mimeType === 'image/webp' || mimeType === 'image/avif';
    }

    function getFormatLabel(mimeType) {
        const map = {
            'image/png': 'PNG',
            'image/jpeg': 'JPEG',
            'image/webp': 'WebP',
            'image/bmp': 'BMP',
            'image/avif': 'AVIF'
        };
        return map[mimeType] || mimeType.split('/')[1]?.toUpperCase() || 'IMG';
    }

    function getMimeExtension(mimeType) {
        const map = {
            'image/png': 'png',
            'image/jpeg': 'jpg',
            'image/webp': 'webp',
            'image/bmp': 'bmp',
            'image/avif': 'avif'
        };
        return map[mimeType] || 'img';
    }

    function formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    function toggleSlidersVisibility(mimeType, prefix) {
        const isLossy = mimeType === 'image/jpeg' || mimeType === 'image/webp' || mimeType === 'image/avif';
        
        if (prefix === 'global') {
            if (isLossy) {
                globalQualityWrapper.style.display = 'flex';
            } else {
                globalQualityWrapper.style.display = 'none';
            }
        }
    }

    function checkTransparencyLossAcrossAll() {
        // Show background fill color picker if at least one file has alpha transparency
        // and its target format does NOT support transparency.
        const lossyTrans = files.some(f => f.hasAlpha && !formatSupportsAlpha(f.targetFormat));
        if (lossyTrans) {
            globalColorWrapper.style.display = 'flex';
        } else {
            globalColorWrapper.style.display = 'none';
        }
    }

    // Lazy load heic2any
    function loadHeicLibrary() {
        return new Promise((resolve, reject) => {
            if (window.heic2any) {
                resolve();
                return;
            }
            if (heicLibLoading) {
                const interval = setInterval(() => {
                    if (window.heic2any) {
                        clearInterval(interval);
                        resolve();
                    }
                }, 100);
                return;
            }
            heicLibLoading = true;
            showToast('Loading HEIC/HEIF decoder module...', 'info');
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js';
            script.onload = () => {
                heicLibLoading = false;
                showToast('HEIC/HEIF decoder ready', 'success');
                resolve();
            };
            script.onerror = () => {
                heicLibLoading = false;
                showToast('Failed to load HEIC/HEIF decoder', 'error');
                reject(new Error('HEIC library load error'));
            };
            document.head.appendChild(script);
        });
    }

    // Scan for alpha channel
    function detectAlphaChannel(imgUrl) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const size = Math.min(img.naturalWidth, img.naturalHeight, 128); // downscale for speeds
                canvas.width = size;
                canvas.height = size;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, size, size);
                
                try {
                    const imgData = ctx.getImageData(0, 0, size, size);
                    const data = imgData.data;
                    for (let i = 3; i < data.length; i += 4) {
                        if (data[i] < 255) {
                            resolve(true);
                            return;
                        }
                    }
                    resolve(false);
                } catch (e) {
                    resolve(false);
                }
            };
            img.onerror = () => resolve(false);
            img.src = imgUrl;
        });
    }

    // Handles imported files
    async function handleFiles(uploadedFiles) {
        if (uploadedFiles.length === 0) return;
        
        showToast(`Adding ${uploadedFiles.length} file(s)...`, 'info');

        for (const file of uploadedFiles) {
            const ext = file.name.split('.').pop().toLowerCase();
            const isHEIC = ext === 'heic' || ext === 'heif' || file.type === 'image/heic' || file.type === 'image/heif';
            
            // Unique ID
            const id = Date.now() + Math.random().toString(36).substr(2, 9);
            
            const fileItem = {
                id,
                file,
                name: file.name,
                origSize: file.size,
                origFormat: file.type || `image/${ext}`,
                targetFormat: globalFormat.value,
                quality: globalQuality.value,
                hasAlpha: false,
                status: isHEIC ? 'decoding' : 'pending',
                errorMsg: '',
                convertedBlob: null,
                convertedSize: 0,
                convertedUrl: null,
                origUrl: isHEIC ? null : URL.createObjectURL(file),
                thumbnailUrl: isHEIC ? null : URL.createObjectURL(file),
                isHEIC: isHEIC
            };

            files.push(fileItem);
            render();

            if (isHEIC) {
                // Decode HEIC asynchronously
                decodeHeicFile(fileItem);
            } else {
                // Check transparency
                detectAlphaChannel(fileItem.origUrl).then(hasAlpha => {
                    fileItem.hasAlpha = hasAlpha;
                    checkTransparencyLossAcrossAll();
                    render();
                });
            }
        }
    }

    // Decode HEIC to transparent PNG
    async function decodeHeicFile(fileItem) {
        try {
            await loadHeicLibrary();
            const pngBlob = await heic2any({
                blob: fileItem.file,
                toType: 'image/png'
            });
            
            fileItem.origUrl = URL.createObjectURL(pngBlob);
            fileItem.thumbnailUrl = fileItem.origUrl;
            fileItem.origSize = pngBlob.size;
            fileItem.origFormat = 'image/png';
            fileItem.status = 'pending';
            
            const hasAlpha = await detectAlphaChannel(fileItem.origUrl);
            fileItem.hasAlpha = hasAlpha;
            
            checkTransparencyLossAcrossAll();
            showToast(`Decoded ${fileItem.name} successfully`, 'success');
        } catch (err) {
            console.error('HEIC Decode error:', err);
            fileItem.status = 'error';
            fileItem.errorMsg = 'Could not decode HEIC image locally.';
            showToast(`HEIC decode failed: ${fileItem.name}`, 'error');
        }
        render();
    }

    // Convert single file
    function convertSingleFile(fileItem) {
        return new Promise((resolve, reject) => {
            if (fileItem.status === 'decoding') {
                showToast(`Still decoding ${fileItem.name}. Please wait.`, 'info');
                reject(new Error('File is still decoding'));
                return;
            }

            fileItem.status = 'converting';
            fileItem.errorMsg = '';
            render();

            const img = new Image();
            img.src = fileItem.origUrl;

            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.naturalWidth;
                    canvas.height = img.naturalHeight;
                    const ctx = canvas.getContext('2d');

                    const targetMime = fileItem.targetFormat;
                    const supportsAlpha = formatSupportsAlpha(targetMime);

                    // Fill canvas with flat background color if target doesn't support alpha
                    if (!supportsAlpha) {
                        const bgColor = globalBgColor.value || '#ffffff';
                        ctx.fillStyle = bgColor;
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                    }

                    ctx.drawImage(img, 0, 0);

                    const q = fileItem.quality / 100;

                    canvas.toBlob((blob) => {
                        if (blob) {
                            fileItem.convertedBlob = blob;
                            fileItem.convertedSize = blob.size;
                            if (fileItem.convertedUrl) {
                                URL.revokeObjectURL(fileItem.convertedUrl);
                            }
                            fileItem.convertedUrl = URL.createObjectURL(blob);
                            fileItem.status = 'success';
                            resolve(fileItem);
                        } else {
                            throw new Error('Could not output canvas to blob.');
                        }
                        render();
                    }, targetMime, q);

                } catch (err) {
                    fileItem.status = 'error';
                    fileItem.errorMsg = err.message || 'Rendering error';
                    render();
                    reject(err);
                }
            };

            img.onerror = () => {
                fileItem.status = 'error';
                fileItem.errorMsg = 'Failed to load source image data';
                render();
                reject(new Error('Image load failed'));
            };
        });
    }

    // Zip and Download All
    async function downloadAllAsZip() {
        const successful = files.filter(f => f.status === 'success' && f.convertedBlob);
        if (successful.length === 0) return;

        btnDownloadAll.disabled = true;
        showToast('Creating ZIP archive...', 'info');

        const zip = new JSZip();

        successful.forEach(fileItem => {
            const ext = getMimeExtension(fileItem.targetFormat);
            // Replace extension
            const baseName = fileItem.name.substring(0, fileItem.name.lastIndexOf('.')) || fileItem.name;
            const newName = `${baseName}.${ext}`;
            zip.file(newName, fileItem.convertedBlob);
        });

        try {
            const zipContent = await zip.generateAsync({ type: 'blob' });
            const zipUrl = URL.createObjectURL(zipContent);
            const a = document.createElement('a');
            a.href = zipUrl;
            a.download = 'Aura-Converted-Images.zip';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(zipUrl);
            showToast('ZIP downloaded successfully!', 'success');
        } catch (err) {
            console.error('ZIP Error:', err);
            showToast('Failed to create ZIP package', 'error');
        } finally {
            btnDownloadAll.disabled = false;
        }
    }

    // Modal management
    function openPreview(fileItem) {
        modalFilename.textContent = fileItem.name;
        
        modalImgOrig.src = fileItem.origUrl;
        modalFormatOrig.textContent = getFormatLabel(fileItem.origFormat);
        modalSizeOrig.textContent = formatBytes(fileItem.origSize);

        modalImgConv.src = fileItem.convertedUrl;
        modalFormatConv.textContent = getFormatLabel(fileItem.targetFormat);
        modalSizeConv.textContent = formatBytes(fileItem.convertedSize);

        previewModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    function closeModal() {
        previewModal.classList.add('hidden');
        document.body.style.overflow = '';
        modalImgOrig.src = '';
        modalImgConv.src = '';
    }

    // Toast management
    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        let iconSvg = '';
        if (type === 'success') {
            iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
        } else if (type === 'error') {
            iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
        } else {
            iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
        }

        toast.innerHTML = `${iconSvg}<span>${message}</span>`;
        toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'toastSlideIn 0.3s reverse forwards';
            toast.addEventListener('animationend', () => toast.remove());
        }, 3500);
    }

    // Main Render Function
    function render() {
        if (files.length === 0) {
            workspace.classList.add('hidden');
            bulkFooter.classList.add('hidden');
            return;
        }

        workspace.classList.remove('hidden');
        fileCount.textContent = files.length;
        
        // Clear grid
        fileGrid.innerHTML = '';

        let convertedCount = 0;

        files.forEach(f => {
            const card = document.createElement('div');
            card.className = `file-card ${f.status}`;
            
            // Build size change badge
            let sizeChangeHtml = '';
            if (f.status === 'success') {
                convertedCount++;
                const diff = f.convertedSize - f.origSize;
                const pct = ((diff / f.origSize) * 100).toFixed(0);
                if (diff < 0) {
                    sizeChangeHtml = `<span class="down">${pct}% (${formatBytes(Math.abs(diff))} saved)</span>`;
                } else if (diff > 0) {
                    sizeChangeHtml = `<span class="up">+${pct}% (${formatBytes(diff)} larger)</span>`;
                } else {
                    sizeChangeHtml = '<span>Same size</span>';
                }
            }

            // Check transparency warning (target does not support alpha, but original has alpha)
            const transparencyLoss = f.hasAlpha && !formatSupportsAlpha(f.targetFormat);
            const transparencyBadge = f.hasAlpha ? `
                <div class="badge-transparency" title="${transparencyLoss ? 'Alpha channel will be flattened to background color' : 'Supports Alpha'}">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                        <circle cx="12" cy="12" r="10"/>
                    </svg>
                    <span>Alpha${transparencyLoss ? ' Loss' : ''}</span>
                </div>
            ` : '';

            // Thumbnail or loader
            let thumbHtml = '';
            if (f.status === 'decoding') {
                thumbHtml = `
                    <div class="card-thumbnail-container">
                        <div class="spinner"></div>
                    </div>`;
            } else {
                thumbHtml = `
                    <div class="card-thumbnail-container">
                        <img src="${f.thumbnailUrl || ''}" class="card-thumbnail" alt="Thumb">
                        <span class="thumbnail-format-badge">${getFormatLabel(f.origFormat)}</span>
                    </div>`;
            }

            // Quality override element
            const isLossy = f.targetFormat === 'image/jpeg' || f.targetFormat === 'image/webp' || f.targetFormat === 'image/avif';
            const qualityOverrideHtml = isLossy ? `
                <div class="card-option-group">
                    <label>Quality (${f.quality}%)</label>
                    <input type="range" class="range-slider card-slider" data-id="${f.id}" min="1" max="100" value="${f.quality}">
                </div>` : '';

            // Format override select list
            const formatOverrideHtml = `
                <div class="card-option-group">
                    <label>To</label>
                    <select class="select-input card-select" data-id="${f.id}">
                        <option value="image/png" ${f.targetFormat === 'image/png' ? 'selected' : ''}>PNG</option>
                        <option value="image/jpeg" ${f.targetFormat === 'image/jpeg' ? 'selected' : ''}>JPEG</option>
                        <option value="image/webp" ${f.targetFormat === 'image/webp' ? 'selected' : ''}>WebP</option>
                        <option value="image/bmp" ${f.targetFormat === 'image/bmp' ? 'selected' : ''}>BMP</option>
                        ${avifSupported ? `<option value="image/avif" ${f.targetFormat === 'image/avif' ? 'selected' : ''}>AVIF</option>` : ''}
                    </select>
                </div>
            `;

            // Status label
            let statusLabelHtml = '';
            if (f.status === 'pending') {
                statusLabelHtml = '<span class="status-label pending">Pending</span>';
            } else if (f.status === 'decoding') {
                statusLabelHtml = '<span class="status-label converting"><div class="spinner"></div> Decoding</span>';
            } else if (f.status === 'converting') {
                statusLabelHtml = '<span class="status-label converting"><div class="spinner"></div> Converting</span>';
            } else if (f.status === 'success') {
                statusLabelHtml = '<span class="status-label success">Ready</span>';
            } else if (f.status === 'error') {
                statusLabelHtml = `<span class="status-label error" title="${f.errorMsg}">Failed</span>`;
            }

            // Converted size metadata display
            const sizeDetails = f.status === 'success' 
                ? `${formatBytes(f.origSize)} &rarr; ${formatBytes(f.convertedSize)}` 
                : formatBytes(f.origSize);

            // Card DOM content
            card.innerHTML = `
                ${thumbHtml}
                <div class="card-info">
                    <span class="card-filename" title="${f.name}">${f.name}</span>
                    <div class="card-metadata">
                        <span class="size-detail">${sizeDetails}</span>
                        ${transparencyBadge}
                    </div>
                </div>
                
                <div class="card-options">
                    ${formatOverrideHtml}
                    ${qualityOverrideHtml}
                </div>

                <div class="card-status">
                    ${statusLabelHtml}
                    <span class="status-size-change">${sizeChangeHtml}</span>
                </div>

                <div class="card-actions">
                    <button class="btn-icon btn-preview" data-id="${f.id}" title="Preview Comparison" ${f.status === 'success' ? '' : 'disabled'}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                            <circle cx="12" cy="12" r="3"/>
                        </svg>
                    </button>
                    <button class="btn-icon btn-convert" data-id="${f.id}" title="Convert Image" ${f.status !== 'converting' && f.status !== 'decoding' ? '' : 'disabled'}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="23 4 23 10 17 10"/>
                            <polyline points="1 20 1 14 7 14"/>
                            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                        </svg>
                    </button>
                    <button class="btn-icon btn-download" data-id="${f.id}" title="Download Converted" ${f.status === 'success' ? '' : 'disabled'}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                            <polyline points="7 10 12 15 17 10"/>
                            <line x1="12" y1="15" x2="12" y2="3"/>
                        </svg>
                    </button>
                    <button class="btn-icon btn-delete" data-id="${f.id}" title="Remove file" ${f.status !== 'converting' ? '' : 'disabled'}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            <line x1="10" y1="11" x2="10" y2="17"/>
                            <line x1="14" y1="11" x2="14" y2="17"/>
                        </svg>
                    </button>
                </div>
            `;

            // Bind actions within the card
            // Target Format Select Change
            const selectEl = card.querySelector('.card-select');
            selectEl.addEventListener('change', (e) => {
                f.targetFormat = e.target.value;
                if (f.status === 'success') {
                    f.status = 'pending';
                    f.convertedBlob = null;
                    f.convertedSize = 0;
                    if (f.convertedUrl) URL.revokeObjectURL(f.convertedUrl);
                    f.convertedUrl = null;
                }
                checkTransparencyLossAcrossAll();
                render();
            });

            // Quality Override Slider Input
            const sliderEl = card.querySelector('.card-slider');
            if (sliderEl) {
                sliderEl.addEventListener('change', (e) => {
                    f.quality = e.target.value;
                    if (f.status === 'success') {
                        f.status = 'pending';
                        f.convertedBlob = null;
                        f.convertedSize = 0;
                        if (f.convertedUrl) URL.revokeObjectURL(f.convertedUrl);
                        f.convertedUrl = null;
                    }
                    render();
                });
            }

            // Action Buttons
            card.querySelector('.btn-preview').addEventListener('click', () => openPreview(f));
            card.querySelector('.btn-convert').addEventListener('click', () => convertSingleFile(f));
            card.querySelector('.btn-download').addEventListener('click', () => {
                const ext = getMimeExtension(f.targetFormat);
                const baseName = f.name.substring(0, f.name.lastIndexOf('.')) || f.name;
                const a = document.createElement('a');
                a.href = f.convertedUrl;
                a.download = `${baseName}.${ext}`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            });
            
            card.querySelector('.btn-delete').addEventListener('click', () => {
                if (f.origUrl) URL.revokeObjectURL(f.origUrl);
                if (f.convertedUrl) URL.revokeObjectURL(f.convertedUrl);
                if (f.thumbnailUrl) URL.revokeObjectURL(f.thumbnailUrl);
                files = files.filter(item => item.id !== f.id);
                checkTransparencyLossAcrossAll();
                render();
            });

            fileGrid.appendChild(card);
        });

        // Bulk footer rendering
        bulkFooter.classList.remove('hidden');
        bulkConvertedCount.textContent = `${convertedCount} of ${files.length} converted`;
        
        const percentComplete = (convertedCount / files.length) * 100;
        bulkProgressBar.style.width = `${percentComplete}%`;

        // Enable download all ZIP if there's at least one successful conversion
        btnDownloadAll.disabled = convertedCount === 0;
    }
});
