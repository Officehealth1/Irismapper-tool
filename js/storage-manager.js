// IndexedDB Storage Manager for Iris Mapper Pro
// Preserves original image quality and complete application state

class StorageManager {
    constructor() {
        this.dbName = 'IrisMapperProDB';
        this.dbVersion = 1;
        this.db = null;
        this.storeName = 'savedProjects';
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => {
                console.error('Failed to open IndexedDB:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log('IndexedDB initialized successfully');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Create object store if it doesn't exist
                if (!db.objectStoreNames.contains(this.storeName)) {
                    const objectStore = db.createObjectStore(this.storeName, { 
                        keyPath: 'id', 
                        autoIncrement: true 
                    });

                    // Create indexes for efficient querying
                    objectStore.createIndex('userId', 'userId', { unique: false });
                    objectStore.createIndex('timestamp', 'timestamp', { unique: false });
                    objectStore.createIndex('projectName', 'projectName', { unique: false });
                }
            };
        });
    }

    async saveProject(projectData) {
        if (!this.db) await this.init();

        const user = firebase.auth().currentUser;
        if (!user) {
            throw new Error('User must be authenticated to save projects');
        }

        // Complete project state to save
        const projectToSave = {
            userId: user.uid,
            userEmail: user.email,
            timestamp: Date.now(),
            projectName: projectData.projectName || `Project ${new Date().toLocaleString()}`,
            
            // Original image data - NO COMPRESSION
            originalImage: projectData.originalImage, // Blob or base64
            
            // Complete application state
            applicationState: {
                // Current view settings
                currentEye: projectData.currentEye,
                isDualView: projectData.isDualView,
                
                // Image adjustments (all sliders)
                adjustments: {
                    exposure: projectData.adjustments.exposure,
                    contrast: projectData.adjustments.contrast,
                    saturation: projectData.adjustments.saturation,
                    hue: projectData.adjustments.hue,
                    shadows: projectData.adjustments.shadows,
                    highlights: projectData.adjustments.highlights,
                    temperature: projectData.adjustments.temperature,
                    sharpness: projectData.adjustments.sharpness
                },
                
                // Map overlay state
                mapState: {
                    selectedMap: projectData.selectedMap,
                    mapOpacity: projectData.mapOpacity,
                    mapColor: projectData.mapColor,
                    mapPosition: {
                        x: projectData.mapPosition?.x || 0,
                        y: projectData.mapPosition?.y || 0,
                        scale: projectData.mapPosition?.scale || 1,
                        rotation: projectData.mapPosition?.rotation || 0
                    }
                },
                
                // Canvas transformations
                imageTransform: {
                    zoom: projectData.imageTransform?.zoom || 1,
                    rotation: projectData.imageTransform?.rotation || 0,
                    offsetX: projectData.imageTransform?.offsetX || 0,
                    offsetY: projectData.imageTransform?.offsetY || 0
                },
                
                // Notes for the image
                notes: projectData.notes || '',
                
                // Additional metadata
                metadata: {
                    fileName: projectData.fileName,
                    fileSize: projectData.fileSize,
                    imageDimensions: projectData.imageDimensions,
                    lastModified: Date.now()
                }
            },
            
            // Thumbnail for quick preview (small, can be compressed)
            thumbnail: projectData.thumbnail
        };

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const objectStore = transaction.objectStore(this.storeName);
            const request = objectStore.add(projectToSave);

            request.onsuccess = () => {
                console.log('Project saved successfully with ID:', request.result);
                resolve(request.result);
            };

            request.onerror = () => {
                console.error('Failed to save project:', request.error);
                reject(request.error);
            };
        });
    }

    async loadProject(projectId) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const objectStore = transaction.objectStore(this.storeName);
            const request = objectStore.get(projectId);

            request.onsuccess = () => {
                const project = request.result;
                if (project) {
                    console.log('Project loaded successfully:', projectId);
                    resolve(project);
                } else {
                    reject(new Error('Project not found'));
                }
            };

            request.onerror = () => {
                console.error('Failed to load project:', request.error);
                reject(request.error);
            };
        });
    }

    async getUserProjects(limit = 50) {
        if (!this.db) await this.init();

        const user = firebase.auth().currentUser;
        if (!user) {
            return [];
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const objectStore = transaction.objectStore(this.storeName);
            const index = objectStore.index('userId');
            const request = index.getAll(user.uid);

            request.onsuccess = () => {
                let projects = request.result;
                // Sort by timestamp (newest first)
                projects.sort((a, b) => b.timestamp - a.timestamp);
                // Apply limit
                if (limit && projects.length > limit) {
                    projects = projects.slice(0, limit);
                }
                resolve(projects);
            };

            request.onerror = () => {
                console.error('Failed to get user projects:', request.error);
                reject(request.error);
            };
        });
    }

    async deleteProject(projectId) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const objectStore = transaction.objectStore(this.storeName);
            const request = objectStore.delete(projectId);

            request.onsuccess = () => {
                console.log('Project deleted successfully:', projectId);
                resolve();
            };

            request.onerror = () => {
                console.error('Failed to delete project:', request.error);
                reject(request.error);
            };
        });
    }

    async updateProject(projectId, updates) {
        if (!this.db) await this.init();

        const project = await this.loadProject(projectId);
        
        // Merge updates with existing project
        const updatedProject = {
            ...project,
            ...updates,
            applicationState: {
                ...project.applicationState,
                ...(updates.applicationState || {}),
                metadata: {
                    ...project.applicationState.metadata,
                    lastModified: Date.now()
                }
            }
        };

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const objectStore = transaction.objectStore(this.storeName);
            const request = objectStore.put(updatedProject);

            request.onsuccess = () => {
                console.log('Project updated successfully:', projectId);
                resolve(request.result);
            };

            request.onerror = () => {
                console.error('Failed to update project:', request.error);
                reject(request.error);
            };
        });
    }

    async updateProjectName(projectId, newName) {
        return this.updateProject(projectId, { projectName: newName });
    }

    async getStorageUsage() {
        if (!this.db) await this.init();

        const user = firebase.auth().currentUser;
        if (!user) return { used: 0, projects: 0 };

        const projects = await this.getUserProjects(null); // Get all projects
        let totalSize = 0;

        projects.forEach(project => {
            // Estimate size (rough calculation)
            const projectString = JSON.stringify(project);
            totalSize += projectString.length;
        });

        return {
            used: totalSize,
            usedMB: (totalSize / (1024 * 1024)).toFixed(2),
            projects: projects.length,
            available: await this.getAvailableSpace()
        };
    }

    async getAvailableSpace() {
        if ('storage' in navigator && 'estimate' in navigator.storage) {
            const estimate = await navigator.storage.estimate();
            return {
                quota: estimate.quota,
                usage: estimate.usage,
                available: estimate.quota - estimate.usage,
                availableGB: ((estimate.quota - estimate.usage) / (1024 * 1024 * 1024)).toFixed(2)
            };
        }
        return null;
    }

    // Helper function to create thumbnail
    async createThumbnail(imageBlob, maxWidth = 200) {
        return new Promise((resolve) => {
            const img = new Image();
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            img.onload = () => {
                const scale = maxWidth / img.width;
                canvas.width = maxWidth;
                canvas.height = img.height * scale;
                
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                
                canvas.toBlob((blob) => {
                    resolve(blob);
                }, 'image/jpeg', 0.7);
            };
            
            img.src = URL.createObjectURL(imageBlob);
        });
    }
}

// Export for use in main application
window.StorageManager = StorageManager;