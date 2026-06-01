/**
 * Photo Manager UI Component
 * Complete photo management: upload, compress, reorder, describe
 * 
 * Fase 6: Sistema de Fotos - Camera + Gallery + Múltiplas Fotos
 */

import { ImageCompressor, PhotoUtils } from '../services/photoService.js';

/**
 * PhotoManager UI Component
 */
export class PhotoManager {
  constructor(containerSelector, onPhotosChange = null) {
    this.container = document.querySelector(containerSelector);
    this.photos = [];
    this.onPhotosChange = onPhotosChange;
    this.compressor = new ImageCompressor();
    this.draggedPhoto = null;

    this.init();
  }

  async init() {
    console.log('📸 Initializing Photo Manager');

    this.createUI();
    this.attachEventListeners();

    console.log('✅ Photo Manager initialized');
  }

  /**
   * Create UI structure
   */
  createUI() {
    this.container.innerHTML = `
      <div class="photo-manager">
        <div class="photo-header">
          <h4>Fotos do Relatório</h4>
          <span class="photo-count">0 fotos</span>
        </div>

        <div class="photo-controls">
          <button id="cameraBtn" class="btn btn-photo" title="Tirar foto com câmera">
            📷 Câmera
          </button>
          <button id="galleryBtn" class="btn btn-photo" title="Selecionar da galeria">
            🖼️ Galeria
          </button>
          <input 
            id="cameraInput" 
            type="file" 
            accept="image/*" 
            capture="environment"
            style="display: none;"
          />
          <input 
            id="galleryInput" 
            type="file" 
            accept="image/*"
            multiple
            style="display: none;"
          />
        </div>

        <div id="photoStatus" class="photo-status hidden"></div>

        <div id="photosList" class="photos-list"></div>

        <div class="photo-info">
          <small>
            💡 Dica: Arraste as fotos para reordenar<br>
            📸 Compressão automática<br>
            🔄 Clique em "Editar" para adicionar descrição
          </small>
        </div>

        <!-- Photo Detail Modal -->
        <div id="photoDetailModal" class="modal hidden" role="dialog" aria-modal="true">
          <div class="modal-body modal-photo">
            <button id="closePhotoModal" class="close-btn">✕</button>
            <div class="photo-detail-content">
              <img id="photoImage" src="" alt="Foto" class="detail-photo" />
              <textarea 
                id="photoDescription" 
                class="photo-desc-input" 
                placeholder="Descrição da foto (opcional)"
                rows="3"
              ></textarea>
              <div class="photo-meta">
                <span id="photoMeta"></span>
              </div>
              <button id="savePhotoDescBtn" class="btn btn-primary">Salvar Descrição</button>
            </div>
          </div>
        </div>

        <style>
          .photo-manager {
            padding: 12px;
            background: #fafafa;
            border-radius: 8px;
            border: 1px solid #eee;
          }

          .photo-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
            padding-bottom: 8px;
            border-bottom: 1px solid #e0e0e0;
          }

          .photo-header h4 {
            margin: 0;
            font-size: 14px;
            font-weight: 600;
          }

          .photo-count {
            font-size: 12px;
            color: #999;
          }

          .photo-controls {
            display: flex;
            gap: 8px;
            margin-bottom: 12px;
            flex-wrap: wrap;
          }

          .btn-photo {
            flex: 1;
            min-width: 100px;
            padding: 8px 10px;
            background: #2196f3;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 600;
            font-size: 13px;
            transition: all 0.2s;
          }

          .btn-photo:hover {
            background: #1976d2;
            transform: translateY(-1px);
          }

          .btn-photo:active {
            transform: translateY(0);
          }

          .photo-status {
            padding: 8px;
            margin-bottom: 8px;
            border-radius: 6px;
            font-size: 12px;
            background: #e8f5e9;
            border: 1px solid #4caf50;
            color: #2e7d32;
          }

          .photo-status.hidden {
            display: none;
          }

          .photo-status.error {
            background: #ffebee;
            border-color: #f44336;
            color: #c62828;
          }

          .photo-status.warning {
            background: #fff3e0;
            border-color: #ff9800;
            color: #e65100;
          }

          .photos-list {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
            gap: 8px;
            margin-bottom: 12px;
          }

          .photo-item {
            position: relative;
            aspect-ratio: 1;
            background: white;
            border: 2px solid #e0e0e0;
            border-radius: 8px;
            overflow: hidden;
            cursor: grab;
            transition: all 0.2s;
          }

          .photo-item:hover {
            border-color: #2196f3;
            box-shadow: 0 2px 8px rgba(33, 150, 243, 0.2);
          }

          .photo-item.dragging {
            opacity: 0.6;
            border-color: #2196f3;
          }

          .photo-item.drag-over {
            background: #e3f2fd;
            border-color: #2196f3;
          }

          .photo-thumbnail {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }

          .photo-item-overlay {
            position: absolute;
            inset: 0;
            display: flex;
            align-items: flex-end;
            justify-content: space-between;
            gap: 4px;
            padding: 4px;
            background: rgba(0,0,0,0.3);
            opacity: 0;
            transition: opacity 0.2s;
          }

          .photo-item:hover .photo-item-overlay {
            opacity: 1;
          }

          .photo-item-actions {
            display: flex;
            gap: 4px;
          }

          .photo-item-btn {
            background: white;
            border: none;
            width: 28px;
            height: 28px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
          }

          .photo-item-btn:hover {
            background: #f44336;
            color: white;
          }

          .photo-info {
            padding: 8px;
            background: white;
            border-radius: 6px;
            font-size: 12px;
            color: #666;
            line-height: 1.4;
          }

          .modal {
            position: fixed;
            inset: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(0,0,0,0.5);
            z-index: 1000;
          }

          .modal.hidden {
            display: none;
          }

          .modal-body {
            width: 90%;
            max-width: 500px;
            background: white;
            border-radius: 12px;
            padding: 16px;
            max-height: 90vh;
            overflow: auto;
            position: relative;
          }

          .modal-photo {
            max-width: 600px;
          }

          .close-btn {
            position: absolute;
            top: 8px;
            right: 8px;
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            color: #999;
            padding: 0;
            z-index: 10;
          }

          .close-btn:hover {
            color: #333;
          }

          .photo-detail-content {
            display: grid;
            gap: 12px;
            padding-top: 20px;
          }

          .detail-photo {
            width: 100%;
            max-height: 400px;
            object-fit: contain;
            border-radius: 8px;
          }

          .photo-desc-input {
            padding: 8px;
            border: 1px solid #e0e0e0;
            border-radius: 6px;
            font-family: inherit;
            font-size: 13px;
            resize: vertical;
          }

          .photo-desc-input:focus {
            outline: none;
            border-color: #2196f3;
            background: #f0f8ff;
          }

          .photo-meta {
            padding: 8px;
            background: #f5f5f5;
            border-radius: 6px;
            font-size: 12px;
            color: #666;
          }

          .btn {
            padding: 8px 12px;
            border: none;
            border-radius: 6px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
          }

          .btn-primary {
            background: #2196f3;
            color: white;
          }

          .btn-primary:hover {
            background: #1976d2;
          }

          @media (max-width: 768px) {
            .photos-list {
              grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
            }

            .photo-controls {
              gap: 6px;
            }

            .btn-photo {
              min-width: 80px;
              padding: 6px 8px;
              font-size: 12px;
            }
          }
        </style>
      </div>
    `;
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    const cameraBtn = this.container.querySelector('#cameraBtn');
    const galleryBtn = this.container.querySelector('#galleryBtn');
    const cameraInput = this.container.querySelector('#cameraInput');
    const galleryInput = this.container.querySelector('#galleryInput');
    const closeModal = this.container.querySelector('#closePhotoModal');
    const modal = this.container.querySelector('#photoDetailModal');

    cameraBtn.addEventListener('click', () => cameraInput.click());
    galleryBtn.addEventListener('click', () => galleryInput.click());

    cameraInput.addEventListener('change', (e) => this.handleCameraCapture(e));
    galleryInput.addEventListener('change', (e) => this.handleGallerySelect(e));

    closeModal.addEventListener('click', () => modal.classList.add('hidden'));
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.add('hidden');
    });
  }

  /**
   * Handle camera capture
   */
  async handleCameraCapture(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    await this.processImage(file);
    e.target.value = ''; // Reset input
  }

  /**
   * Handle gallery select (multiple)
   */
  async handleGallerySelect(e) {
    const files = e.target.files;
    if (!files) return;

    this.showStatus(`Processando ${files.length} foto(s)...`, 'info');

    for (const file of files) {
      await this.processImage(file);
    }

    e.target.value = ''; // Reset input
  }

  /**
   * Process and compress image
   */
  async processImage(file) {
    try {
      this.showStatus(`Comprimindo ${file.name}...`, 'info');

      // Compress
      const compressed = await this.compressor.compress(file);

      // Convert to data URL
      const dataUrl = await ImageCompressor.blobToDataURL(compressed.blob);

      // Create photo object
      const photo = PhotoUtils.createPhotoObject(dataUrl, '', {
        originalName: file.name,
        originalSize: file.size,
        compressedSize: compressed.size,
        reduction: compressed.reduction
      });

      // Add to list
      this.photos.push(photo);
      this.renderPhotos();

      this.showStatus(
        `✅ ${file.name} adicionada (${compressed.reduction}% redução)`,
        'success'
      );

      // Notify parent
      if (this.onPhotosChange) {
        this.onPhotosChange(this.photos);
      }
    } catch (error) {
      console.error('Error processing image:', error.message);
      this.showStatus(`❌ Erro ao processar ${file.name}`, 'error');
    }
  }

  /**
   * Render photos list
   */
  renderPhotos() {
    const list = this.container.querySelector('#photosList');
    const count = this.container.querySelector('.photo-count');
    const sorted = PhotoUtils.sortPhotos(this.photos);

    list.innerHTML = '';
    count.textContent = `${this.photos.length} foto(s)`;

    for (const photo of sorted) {
      const div = document.createElement('div');
      div.className = 'photo-item';
      div.draggable = true;
      div.dataset.photoId = photo.id;

      div.innerHTML = `
        <img src="${photo.data}" alt="Foto" class="photo-thumbnail" />
        <div class="photo-item-overlay">
          <span style="color: white; font-size: 11px;">#${sorted.indexOf(photo) + 1}</span>
          <div class="photo-item-actions">
            <button class="photo-item-btn btn-edit" title="Editar">✎</button>
            <button class="photo-item-btn btn-delete" title="Excluir">✕</button>
          </div>
        </div>
      `;

      // Edit button
      div.querySelector('.btn-edit').addEventListener('click', (e) => {
        e.stopPropagation();
        this.openPhotoDetail(photo);
      });

      // Delete button
      div.querySelector('.btn-delete').addEventListener('click', (e) => {
        e.stopPropagation();
        this.deletePhoto(photo.id);
      });

      // Drag handlers
      div.addEventListener('dragstart', (e) => this.handleDragStart(e, photo));
      div.addEventListener('dragover', (e) => this.handleDragOver(e));
      div.addEventListener('drop', (e) => this.handleDrop(e, photo));
      div.addEventListener('dragleave', (e) => this.handleDragLeave(e));

      list.appendChild(div);
    }
  }

  /**
   * Drag handlers
   */
  handleDragStart(e, photo) {
    this.draggedPhoto = photo;
    e.currentTarget.classList.add('dragging');
  }

  handleDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
  }

  handleDragLeave(e) {
    e.currentTarget.classList.remove('drag-over');
  }

  handleDrop(e, targetPhoto) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');

    if (!this.draggedPhoto || this.draggedPhoto.id === targetPhoto.id) return;

    const fromIndex = this.photos.findIndex(p => p.id === this.draggedPhoto.id);
    const toIndex = this.photos.findIndex(p => p.id === targetPhoto.id);

    this.photos = PhotoUtils.reorderPhotos(this.photos, fromIndex, toIndex);
    this.renderPhotos();

    if (this.onPhotosChange) {
      this.onPhotosChange(this.photos);
    }

    this.draggedPhoto = null;
  }

  /**
   * Open photo detail modal
   */
  openPhotoDetail(photo) {
    const modal = this.container.querySelector('#photoDetailModal');
    const image = this.container.querySelector('#photoImage');
    const description = this.container.querySelector('#photoDescription');
    const meta = this.container.querySelector('#photoMeta');
    const saveBtn = this.container.querySelector('#savePhotoDescBtn');

    image.src = photo.data;
    description.value = photo.description || '';
    meta.textContent = `Tamanho: ${PhotoUtils.formatFileSize(photo.size)} | 
                        ${new Date(photo.timestamp).toLocaleString()}`;

    saveBtn.onclick = () => this.savePhotoDescription(photo, description.value);

    modal.classList.remove('hidden');
  }

  /**
   * Save photo description
   */
  savePhotoDescription(photo, description) {
    const index = this.photos.findIndex(p => p.id === photo.id);
    if (index >= 0) {
      this.photos[index].description = description;
      this.renderPhotos();

      if (this.onPhotosChange) {
        this.onPhotosChange(this.photos);
      }

      this.showStatus('✅ Descrição salva', 'success');
      this.container.querySelector('#photoDetailModal').classList.add('hidden');
    }
  }

  /**
   * Delete photo
   */
  deletePhoto(photoId) {
    const confirm = window.confirm('Remover essa foto?');
    if (!confirm) return;

    this.photos = this.photos.filter(p => p.id !== photoId);
    this.renderPhotos();

    if (this.onPhotosChange) {
      this.onPhotosChange(this.photos);
    }

    this.showStatus('✅ Foto removida', 'success');
  }

  /**
   * Show status message
   */
  showStatus(message, type = 'info') {
    const status = this.container.querySelector('#photoStatus');
    status.textContent = message;
    status.className = `photo-status ${type}`;
    status.classList.remove('hidden');

    if (type === 'success' || type === 'info') {
      setTimeout(() => status.classList.add('hidden'), 3000);
    }
  }

  /**
   * Get all photos
   */
  getPhotos() {
    return this.photos;
  }

  /**
   * Set photos
   */
  setPhotos(photos) {
    this.photos = photos;
    this.renderPhotos();
  }

  /**
   * Clear all photos
   */
  clearPhotos() {
    this.photos = [];
    this.renderPhotos();
  }

  /**
   * Get total size
   */
  getTotalSize() {
    return PhotoUtils.getTotalSize(this.photos);
  }
}

export default PhotoManager;
