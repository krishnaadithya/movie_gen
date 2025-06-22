// Global variables
let currentStep = 1;
let sessionId = null;
let currentStory = null;
let selectedMovieOption = null;
let currentImageSource = 'upload'; // 'upload' or 'generate'
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let recordingStartTime = null;
let recordingInterval = null;
let recordedAudioBlob = null;

// API base URL
const API_BASE_URL = 'http://localhost:8000';

// DOM elements
const imageUploadArea = document.getElementById('imageUploadArea');
const imageInput = document.getElementById('imageInput');
const imagePreview = document.getElementById('imagePreview');
const previewImg = document.getElementById('previewImg');
const changeImageBtn = document.getElementById('changeImageBtn');
const proceedToStyleBtn = document.getElementById('proceedToStyleBtn');
const originalImg = document.getElementById('originalImg');
const styledImg = document.getElementById('styledImg');
const stylePlaceholder = document.getElementById('stylePlaceholder');
const styledImageActions = document.getElementById('styledImageActions');
const useAsBaseBtn = document.getElementById('useAsBaseBtn');
const applyStyleBtn = document.getElementById('applyStyleBtn');
const proceedToStoryBtn = document.getElementById('proceedToStoryBtn');
const storyImagePreview = document.getElementById('storyImagePreview');
const generateStoryBtn = document.getElementById('generateStoryBtn');
const storyPrompt = document.getElementById('storyPrompt');
const stylePrompt = document.getElementById('stylePrompt');
const aspectRatio = document.getElementById('aspectRatio');

// Image generation elements
const sourceTabs = document.querySelectorAll('.source-tab');
const uploadSection = document.getElementById('uploadSection');
const generateSection = document.getElementById('generateSection');
const imagePrompt = document.getElementById('imagePrompt');
const generateImageBtn = document.getElementById('generateImageBtn');

// Audio recording elements
const recordBtn = document.getElementById('recordBtn');
const stopRecordBtn = document.getElementById('stopRecordBtn');
const recordingTime = document.getElementById('recordingTime');
const audioPreview = document.getElementById('audioPreview');
const audioPlayer = document.getElementById('audioPlayer');
const playRecordingBtn = document.getElementById('playRecordingBtn');
const deleteRecordingBtn = document.getElementById('deleteRecordingBtn');

// Story editor elements
const storyTitle = document.getElementById('storyTitle');
const storyGenre = document.getElementById('storyGenre');
const storyTone = document.getElementById('storyTone');
const storyMoral = document.getElementById('storyMoral');
const scenesContainer = document.getElementById('scenesContainer');
const generateAssetsBtn = document.getElementById('generateAssetsBtn');

// Progress elements
const progressCircle = document.getElementById('progressCircle');
const progressPercent = document.getElementById('progressPercent');
const progressStatus = document.getElementById('progressStatus');
const generationLog = document.getElementById('generationLog');
const assetsPreview = document.getElementById('assetsPreview');
const assetsGrid = document.getElementById('assetsGrid');

// Movie generation elements
const movieOptions = document.querySelectorAll('.option-card');
const createMovieBtn = document.getElementById('createMovieBtn');
const movieGeneration = document.getElementById('movieGeneration');
const movieResult = document.getElementById('movieResult');
const downloadMovieBtn = document.getElementById('downloadMovieBtn');

// Modal elements
const loadingOverlay = document.getElementById('loadingOverlay');
const loadingTitle = document.getElementById('loadingTitle');
const loadingDescription = document.getElementById('loadingDescription');
const errorModal = document.getElementById('errorModal');
const errorMessage = document.getElementById('errorMessage');

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    console.log('Movie Generator v2.0 - Simplified Progress Tracking');
    initializeEventListeners();
    updateUI();
});

function initializeEventListeners() {
    // Image source tabs
    sourceTabs.forEach(tab => {
        tab.addEventListener('click', () => switchImageSource(tab.dataset.source));
    });

    // Image upload
    imageUploadArea.addEventListener('click', () => imageInput.click());
    imageUploadArea.addEventListener('dragover', handleDragOver);
    imageUploadArea.addEventListener('drop', handleDrop);
    imageInput.addEventListener('change', handleImageUpload);
    changeImageBtn.addEventListener('click', () => {
        if (currentImageSource === 'upload') {
            imageInput.click();
        } else {
            showGenerateSection();
        }
    });

    // Image generation
    generateImageBtn.addEventListener('click', handleImageGeneration);
    imagePrompt.addEventListener('input', validateStep1);

    // Audio recording
    recordBtn.addEventListener('click', startRecording);
    stopRecordBtn.addEventListener('click', stopRecording);
    playRecordingBtn.addEventListener('click', playRecording);
    deleteRecordingBtn.addEventListener('click', deleteRecording);

    // Style presets
    document.querySelectorAll('.style-preset').forEach(preset => {
        preset.addEventListener('click', () => {
            // Update active state
            document.querySelectorAll('.style-preset').forEach(p => p.classList.remove('active'));
            preset.classList.add('active');
            
            // Set style prompt
            stylePrompt.value = preset.dataset.style;
            validateStep2();
        });
    });

    // Form validation
    storyPrompt.addEventListener('input', validateStep3);
    stylePrompt.addEventListener('input', validateStep2);
    imageInput.addEventListener('change', validateStep1);

    // Navigation buttons
    proceedToStyleBtn.addEventListener('click', () => goToStep(2));
    applyStyleBtn.addEventListener('click', handleApplyStyle);
    useAsBaseBtn.addEventListener('click', handleUseAsBase);
    proceedToStoryBtn.addEventListener('click', () => goToStep(3));
    generateStoryBtn.addEventListener('click', handleGenerateStory);
    document.getElementById('backToStep1').addEventListener('click', () => goToStep(1));
    document.getElementById('backToStep2').addEventListener('click', () => goToStep(2));
    document.getElementById('backToStep3').addEventListener('click', () => goToStep(3));
    
    // Check if generateAssetsBtn exists before adding event listener
    if (generateAssetsBtn) {
        generateAssetsBtn.addEventListener('click', () => {
            console.log('Generate Assets button clicked!');
            handleGenerateAssets();
        });
    } else {
        console.error('generateAssetsBtn element not found!');
    }
    
    document.getElementById('backToStep5').addEventListener('click', () => goToStep(5));
    createMovieBtn.addEventListener('click', () => goToStep(6));

    // Movie options
    movieOptions.forEach(option => {
        option.addEventListener('click', () => selectMovieOption(option.dataset.option));
    });

    // Movie generation
    document.addEventListener('click', function(e) {
        if (e.target.closest('.option-card.selected')) {
            handleMovieGeneration();
        }
    });

    // Download and reset
    downloadMovieBtn.addEventListener('click', handleDownload);
    document.getElementById('createNewBtn').addEventListener('click', resetApplication);

    // Modal close
    document.getElementById('closeErrorModal').addEventListener('click', closeErrorModal);
    document.getElementById('closeErrorBtn').addEventListener('click', closeErrorModal);
}

// Image source switching
function switchImageSource(source) {
    currentImageSource = source;
    
    // Update tab styles
    sourceTabs.forEach(tab => {
        tab.classList.toggle('active', tab.dataset.source === source);
    });
    
    // Show/hide sections
    uploadSection.classList.toggle('active', source === 'upload');
    generateSection.classList.toggle('active', source === 'generate');
    
    // Clear any existing preview
    hideImagePreview();
    
    // Validate form
    validateStep1();
}

function showGenerateSection() {
    switchImageSource('generate');
    imagePrompt.focus();
}

function hideImagePreview() {
    imagePreview.style.display = 'none';
    previewImg.src = '';
    sessionId = null;
}

// Image generation
async function handleImageGeneration() {
    if (!imagePrompt.value.trim()) {
        showError('Please enter a description for the image you want to generate.');
        return;
    }

    showLoading('Generating image...', 'Creating your custom image based on the description');
    generateImageBtn.disabled = true;
    
    try {
        const formData = new FormData();
        formData.append('prompt', imagePrompt.value);
        formData.append('aspect_ratio', aspectRatio.value);

        const response = await fetch(`${API_BASE_URL}/generate-image/`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error('Image generation failed');
        }

        const data = await response.json();
        
        // Create a blob and display the image
        const imageResponse = await fetch(data.image_url);
        const imageBlob = await imageResponse.blob();
        const imageUrl = URL.createObjectURL(imageBlob);
        
        // Show preview
        previewImg.src = imageUrl;
        imagePreview.style.display = 'flex';
        
        // Store session data (simulate the upload flow)
        sessionId = data.session_id;
        
        validateStep1();
        hideLoading();
        generateImageBtn.disabled = false;
        
    } catch (error) {
        console.error('Image generation error:', error);
        showError('Failed to generate image. Please try again.');
        hideLoading();
        generateImageBtn.disabled = false;
    }
}

// Drag and drop handlers
function handleDragOver(e) {
    e.preventDefault();
    imageUploadArea.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
}

function handleDrop(e) {
    e.preventDefault();
    imageUploadArea.style.backgroundColor = '';
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type.startsWith('image/')) {
        handleImageFile(files[0]);
    }
}

function handleImageUpload(e) {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
        handleImageFile(file);
    }
}

async function handleImageFile(file) {
    // Show preview
    const reader = new FileReader();
    reader.onload = function(e) {
        previewImg.src = e.target.result;
        uploadSection.querySelector('.image-upload-area').style.display = 'none';
        imagePreview.style.display = 'flex';
    };
    reader.readAsDataURL(file);

    // Upload to server
    showLoading('Analyzing image...', 'Please wait while we analyze your image');
    try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${API_BASE_URL}/upload-image/`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error('Image upload failed');
        }

        const data = await response.json();
        sessionId = data.session_id;
        // Note: We don't display the image description in the UI anymore
        
        validateStep1();
        hideLoading();
    } catch (error) {
        console.error('Image upload error:', error);
        showError('Failed to upload image. Please try again.');
        hideLoading();
    }
}

function validateStep1() {
    const hasImage = sessionId !== null;
    const hasImagePrompt = currentImageSource === 'generate' && imagePrompt.value.trim().length > 0;
    
    // Enable proceed to style button if we have an image (uploaded or generated)
    if (proceedToStyleBtn) {
        proceedToStyleBtn.disabled = !hasImage;
    }
    
    // Enable generate image button if we have an image prompt
    if (generateImageBtn) {
        generateImageBtn.disabled = !hasImagePrompt;
    }
}

function validateStep2() {
    // Style step can proceed without applying style (optional)
    if (proceedToStoryBtn) {
        proceedToStoryBtn.disabled = false;
    }
}

function validateStep3() {
    const hasStoryPrompt = storyPrompt && storyPrompt.value.trim().length > 0;
    
    if (generateStoryBtn) {
        generateStoryBtn.disabled = !hasStoryPrompt;
    }
}

async function handleApplyStyle() {
    if (!stylePrompt.value.trim()) {
        showError('Please enter a style description.');
        return;
    }

    showLoading('Applying style...', 'Transforming your image with the selected style');
    applyStyleBtn.disabled = true;
    
    try {
        const formData = new FormData();
        formData.append('session_id', sessionId);
        formData.append('story_prompt', ''); // Empty for now, will be filled in step 3
        formData.append('style_prompt', stylePrompt.value);
        formData.append('aspect_ratio', aspectRatio.value);

        const response = await fetch(`${API_BASE_URL}/generate-story/`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error('Style application failed');
        }

        // Update the styled image display
        const styledImageUrl = `${API_BASE_URL}/download/${sessionId}/styled_image.jpeg?t=${Date.now()}`;
        styledImg.src = styledImageUrl;
        styledImg.style.display = 'block';
        stylePlaceholder.style.display = 'none';
        styledImageActions.style.display = 'block';
        
        // Enable proceed button
        proceedToStoryBtn.disabled = false;
        
        hideLoading();
        applyStyleBtn.disabled = false;
    } catch (error) {
        console.error('Style application error:', error);
        showError('Failed to apply style. Please try again.');
        hideLoading();
        applyStyleBtn.disabled = false;
    }
}

async function handleUseAsBase() {
    try {
        showLoading('Setting as base...', 'Preparing the styled image for further editing');
        
        // Call backend to update the base image
        const formData = new FormData();
        formData.append('session_id', sessionId);

        const response = await fetch(`${API_BASE_URL}/use-styled-as-base/`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error('Failed to set styled image as base');
        }
        
        // Move the styled image to be the new base (original) image
        const styledImageUrl = `${API_BASE_URL}/download/${sessionId}/styled_image.jpeg?t=${Date.now()}`;
        
        // Update the original image display
        originalImg.src = styledImageUrl;
        
        // Reset the styled image display
        styledImg.style.display = 'none';
        stylePlaceholder.style.display = 'block';
        styledImageActions.style.display = 'none';
        
        // Clear the style prompt for the next iteration
        stylePrompt.value = '';
        document.querySelectorAll('.style-preset').forEach(p => p.classList.remove('active'));
        
        // Update proceed button state
        proceedToStoryBtn.disabled = true;
        
        hideLoading();
        
    } catch (error) {
        console.error('Use as base error:', error);
        showError('Failed to set image as base. Please try again.');
        hideLoading();
    }
}

async function handleGenerateStory() {
    showLoading('Generating story...', 'Creating your personalized story based on the image');
    
    try {
        const formData = new FormData();
        formData.append('story_prompt', storyPrompt.value);
        formData.append('style_prompt', ''); // Style already applied in previous step
        formData.append('aspect_ratio', aspectRatio.value);
        formData.append('session_id', sessionId);

        const response = await fetch(`${API_BASE_URL}/generate-story/`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error('Story generation failed');
        }

        const data = await response.json();
        currentStory = data.story;
        
        populateStoryEditor();
        goToStep(4);
        hideLoading();
    } catch (error) {
        console.error('Story generation error:', error);
        showError('Failed to generate story. Please try again.');
        hideLoading();
    }
}

function populateStoryEditor() {
    storyTitle.value = currentStory.title || '';
    storyGenre.value = currentStory.genre || '';
    storyTone.value = currentStory.tone || '';
    storyMoral.value = currentStory.moral || '';

    // Clear existing scenes
    scenesContainer.innerHTML = '';

    // Add scenes
    currentStory.scenes.forEach((scene, index) => {
        const sceneCard = createSceneCard(scene, index);
        scenesContainer.appendChild(sceneCard);
    });
}

function createSceneCard(scene, index) {
    const card = document.createElement('div');
    card.className = 'scene-card';
    card.innerHTML = `
        <div class="scene-header">
            <div class="scene-number">${index + 1}</div>
            <div class="scene-heading">
                <input type="text" value="${scene.heading}" placeholder="Scene heading..." data-scene="${index}" data-field="heading">
            </div>
        </div>
        <div class="scene-content">
            <div class="scene-text">
                <label>Scene Description</label>
                <textarea rows="4" placeholder="Describe what happens in this scene..." data-scene="${index}" data-field="text">${scene.text}</textarea>
            </div>
            <div class="scene-prompt">
                <label>Image Prompt</label>
                <textarea rows="3" placeholder="Describe the visual for this scene..." data-scene="${index}" data-field="image_prompt">${scene.image_prompt}</textarea>
            </div>
        </div>
    `;

    // Add event listeners for scene editing
    const inputs = card.querySelectorAll('input, textarea');
    inputs.forEach(input => {
        input.addEventListener('input', updateStoryData);
    });

    return card;
}

function updateStoryData(e) {
    const sceneIndex = parseInt(e.target.dataset.scene);
    const field = e.target.dataset.field;
    const value = e.target.value;

    if (currentStory.scenes[sceneIndex]) {
        currentStory.scenes[sceneIndex][field] = value;
    }
}

async function handleGenerateAssets() {
    console.log('handleGenerateAssets called');
    console.log('sessionId:', sessionId);
    console.log('currentStory:', currentStory);
    
    if (!sessionId) {
        showError('No session found. Please start over.');
        return;
    }
    
    if (!currentStory) {
        showError('No story found. Please generate a story first.');
        return;
    }

    // Move to step 5 to show the generation progress
    goToStep(5);

    // Close any existing polling
    if (window.currentStatusPoll) {
        clearInterval(window.currentStatusPoll);
        window.currentStatusPoll = null;
    }

    // Show simple loading message
    addLogEntry('Starting asset generation...', 'info');
    addLogEntry('This may take a minute or two...', 'info');
    
    // Reset progress display
    updateProgress(0);
    progressStatus.textContent = 'Generating assets...';

    // Update story data from form
    currentStory.title = storyTitle.value;
    currentStory.genre = storyGenre.value;
    currentStory.tone = storyTone.value;
    currentStory.moral = storyMoral.value;

    // Update story on server
    try {
        addLogEntry('Updating story details...', 'info');
        const formData = new FormData();
        formData.append('story', JSON.stringify(currentStory));
        formData.append('session_id', sessionId);

        await fetch(`${API_BASE_URL}/update-story/`, {
            method: 'PUT',
            body: formData
        });
        addLogEntry('Story updated successfully', 'success');
    } catch (error) {
        console.error('Story update error:', error);
        addLogEntry('Story update failed, continuing with generation...', 'error');
    }

    // Upload recorded audio if available
    let audioPath = null;
    if (recordedAudioBlob) {
        try {
            addLogEntry('Uploading custom voice sample...', 'info');
            audioPath = await uploadRecordedAudio();
            if (audioPath) {
                addLogEntry('Voice sample uploaded successfully', 'success');
            }
        } catch (error) {
            console.error('Audio upload error:', error);
            addLogEntry('Voice sample upload failed, using default voice', 'error');
        }
    } else {
        addLogEntry('Using default AI voice for narration', 'info');
    }

    // Generate assets with real-time progress
    try {
        addLogEntry('Connecting to AI generation services...', 'info');
        console.log('Starting asset generation...');
        
        const formData = new FormData();
        formData.append('session_id', sessionId);
        if (audioPath) {
            formData.append('audio_path', audioPath);
        }

        addLogEntry('Sending generation request to server...', 'info');
        console.log('Sending request to generate-assets...');
        
        // Start asset generation (this returns immediately)
        const response = await fetch(`${API_BASE_URL}/generate-assets/`, {
            method: 'POST',
            body: formData
        });

        console.log('Response status:', response.status);
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Response error:', errorText);
            addLogEntry(`Server error: ${response.status}`, 'error');
            throw new Error(`Asset generation failed: ${errorText}`);
        }

        const data = await response.json();
        console.log('Asset generation started:', data);
        addLogEntry(data.message, 'success');
        
        // Start checking for completion
        checkGenerationStatus(sessionId);

    } catch (error) {
        console.error('Asset generation error:', error);
        addLogEntry(`Generation failed: ${error.message}`, 'error');
        showError('Failed to start asset generation. Please try again.');
    }
}

function checkGenerationStatus(sessionId) {
    console.log('Checking generation status for session:', sessionId);
    console.log('Using new simplified status checking (v2.0)');
    
    let checkCount = 0;
    const maxChecks = 60; // 5 minutes max (60 * 5 seconds)
    
    const statusInterval = setInterval(async () => {
        checkCount++;
        console.log(`Status check ${checkCount} for session ${sessionId}`);
        
        try {
            const statusUrl = `${API_BASE_URL}/generation-status/${sessionId}?t=${Date.now()}`;
            console.log('Fetching status from:', statusUrl);
            const response = await fetch(statusUrl, {
                cache: 'no-cache',
                headers: {
                    'Cache-Control': 'no-cache'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const statusData = await response.json();
            console.log('Generation status:', statusData);
            
            // Update status text
            if (progressStatus) {
                progressStatus.textContent = statusData.status;
            }
            
            // Check if completed
            if (statusData.completed) {
                clearInterval(statusInterval);
                updateProgress(100);
                
                if (statusData.error) {
                    addLogEntry(`Error: ${statusData.error}`, 'error');
                    showError(statusData.error);
                } else {
                    addLogEntry('All assets generated successfully!', 'success');
                    setTimeout(() => {
                        loadAssetsPreview(sessionId);
                    }, 1000);
                }
                return;
            }
            
            // Show periodic updates
            if (checkCount % 6 === 0) { // Every 30 seconds
                addLogEntry('Still generating assets...', 'info');
            }
            
            // Stop checking after max attempts
            if (checkCount >= maxChecks) {
                clearInterval(statusInterval);
                addLogEntry('Generation timeout reached. Please check the server.', 'error');
                showError('Asset generation is taking longer than expected. Please try again.');
            }
            
        } catch (error) {
            console.error('Status check error:', error);
            addLogEntry(`Status check error: ${error.message}`, 'error');
            
            // Stop checking on repeated errors
            if (checkCount > 3) {
                clearInterval(statusInterval);
                showError('Unable to check generation status. Please check your connection.');
            }
        }
    }, 5000); // Check every 5 seconds
    
    // Store interval reference
    window.currentStatusPoll = statusInterval;
}

async function loadAssetsPreview(sessionId) {
    try {
        // Get session data to show assets
        if (sessionId && currentStory) {
            // Create mock assets data for preview
            const assets = currentStory.scenes.map((scene, index) => ({
                scene_id: index,
                image_path: `scene_${index}_image.jpeg`,
                audio_path: `scene_${index}_audio.wav`
            }));
            
            showAssetsPreview(assets);
        }
    } catch (error) {
        console.error('Error loading assets preview:', error);
        addLogEntry('Failed to load asset previews', 'error');
    }
}

function updateProgress(percent) {
    console.log('Updating progress to:', percent);
    
    if (!progressCircle || !progressPercent || !progressStatus) {
        console.error('Progress elements not found!');
        return;
    }
    
    const circumference = 2 * Math.PI * 50; // radius = 50
    const offset = circumference - (percent / 100) * circumference;
    
    progressCircle.style.strokeDashoffset = offset;
    progressPercent.textContent = Math.round(percent) + '%';
    
    // Update status based on percentage
    if (percent < 20) {
        progressStatus.textContent = 'Initializing...';
    } else if (percent < 40) {
        progressStatus.textContent = 'Generating images...';
    } else if (percent < 70) {
        progressStatus.textContent = 'Creating audio...';
    } else if (percent < 90) {
        progressStatus.textContent = 'Processing scenes...';
    } else {
        progressStatus.textContent = 'Finalizing...';
    }
}

function addLogEntry(message, type = 'info') {
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.textContent = message;
    generationLog.appendChild(entry);
    generationLog.scrollTop = generationLog.scrollHeight;
}

function showAssetsPreview(assets) {
    assetsGrid.innerHTML = '';
    
    currentStory.scenes.forEach((scene, index) => {
        const asset = assets[index];
        const card = document.createElement('div');
        card.className = 'asset-card';
        
        // Get proper image URL for display
        const imageUrl = `${API_BASE_URL}/download/${sessionId}/scene_${index}_image.jpeg`;
        const audioUrl = `${API_BASE_URL}/download/${sessionId}/scene_${index}_audio.wav`;
        
        card.innerHTML = `
            <img src="${imageUrl}" alt="Scene ${index + 1}" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5YTNhZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlIExvYWRpbmcuLi48L3RleHQ+PC9zdmc+'">
            <h4>Scene ${index + 1}: ${scene.heading}</h4>
            <p>${scene.text.substring(0, 100)}${scene.text.length > 100 ? '...' : ''}</p>
            <div class="asset-actions">
                <button class="play-audio-btn" onclick="playAudio('${audioUrl}')">
                    <i class="fas fa-play"></i> Play Audio
                </button>
            </div>
        `;
        assetsGrid.appendChild(card);
    });

    // Reveal the assets preview section and scroll into view
    document.getElementById('assetsPreview').style.display = 'block';
    document.getElementById('createMovieBtn').disabled = false;

    // Smooth scroll to the preview so the user notices it
    document.getElementById('assetsPreview').scrollIntoView({ behavior: 'smooth' });
}

function selectMovieOption(option) {
    selectedMovieOption = option;
    movieOptions.forEach(card => card.classList.remove('selected'));
    document.querySelector(`[data-option="${option}"]`).classList.add('selected');
    
    // Auto-generate movie after selection
    setTimeout(() => {
        handleMovieGeneration();
    }, 1000);
}

async function handleMovieGeneration() {
    if (!selectedMovieOption) return;

    // Hide options and show generation
    document.querySelector('.movie-options').style.display = 'none';
    document.getElementById('movieActionButtons').style.display = 'none';
    movieGeneration.style.display = 'block';

    const useVideoGenerator = selectedMovieOption === 'video';
    const title = useVideoGenerator ? 'Generating AI Videos...' : 'Creating Slideshow...';
    const description = useVideoGenerator ? 
        'This may take 5-10 minutes as we generate AI videos for each scene' :
        'Creating your movie with images and audio narration';

    document.getElementById('generationTitle').textContent = title;
    document.getElementById('generationDescription').textContent = description;

    try {
        const response = await fetch(`${API_BASE_URL}/generate-movie/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                session_id: sessionId,
                use_video_generator: useVideoGenerator
            })
        });

        if (!response.ok) {
            throw new Error('Movie generation failed');
        }

        const data = await response.json();
        
        // Show success and setup video player
        movieGeneration.style.display = 'none';
        movieResult.style.display = 'block';
        
        // Setup video player
        setupVideoPlayer(data.movie_path);

    } catch (error) {
        console.error('Movie generation error:', error);
        showError('Failed to generate movie. Please try again.');
        movieGeneration.style.display = 'none';
        document.querySelector('.movie-options').style.display = 'grid';
        document.getElementById('movieActionButtons').style.display = 'flex';
    }
}

// This function is now replaced by the enhanced version at the end of the file

function resetApplication() {
    // Reset all variables
    currentStep = 1;
    sessionId = null;
    currentStory = null;
    selectedMovieOption = null;
    currentImageSource = 'upload';
    recordedAudioBlob = null;

    // Reset form
    storyPrompt.value = '';
    stylePrompt.value = '';
    aspectRatio.value = '16:9';
    imagePrompt.value = '';

    // Reset image source tabs
    switchImageSource('upload');

    // Reset image upload
    uploadSection.querySelector('.image-upload-area').style.display = 'block';
    imagePreview.style.display = 'none';
    previewImg.src = '';
    
    // Reset styling elements
    originalImg.src = '';
    styledImg.src = '';
    styledImg.style.display = 'none';
    stylePlaceholder.style.display = 'block';
    styledImageActions.style.display = 'none';
    storyImagePreview.src = '';
    document.querySelectorAll('.style-preset').forEach(p => p.classList.remove('active'));

    // Reset audio recording
    deleteRecording();
    if (isRecording) {
        stopRecording();
    }

    // Reset story editor
    storyTitle.value = '';
    storyGenre.value = '';
    storyTone.value = '';
    storyMoral.value = '';
    scenesContainer.innerHTML = '';

    // Reset progress
    progressCircle.style.strokeDashoffset = '314';
    progressPercent.textContent = '0%';
    progressStatus.textContent = 'Starting...';
    generationLog.innerHTML = '';
    assetsPreview.style.display = 'none';
    assetsGrid.innerHTML = '';

    // Reset movie options
    movieOptions.forEach(card => card.classList.remove('selected'));
    movieGeneration.style.display = 'none';
    movieResult.style.display = 'none';
    document.querySelector('.movie-options').style.display = 'grid';
    document.getElementById('movieActionButtons').style.display = 'flex';

    // Reset video player
    document.getElementById('videoPlayerContainer').style.display = 'none';
    document.getElementById('moviePlayer').src = '';

    // Go to step 1
    goToStep(1);
    validateStep1();
}

function goToStep(step) {
    // Hide all steps
    document.querySelectorAll('.step-content').forEach(content => {
        content.classList.remove('active');
    });

    // Show target step
    document.getElementById(`step-${step}`).classList.add('active');

    // Update progress bar
    document.querySelectorAll('.progress-step').forEach(progressStep => {
        progressStep.classList.remove('active');
    });
    
    for (let i = 1; i <= step; i++) {
        document.querySelector(`[data-step="${i}"]`).classList.add('active');
    }

    currentStep = step;
    
    // Handle step-specific setup
    if (step === 2) {
        // Set up styling step with current image
        const originalImageUrl = `${API_BASE_URL}/download/${sessionId}/original_image.jpeg?t=${Date.now()}`;
        originalImg.src = originalImageUrl;
        
        // Reset styled image display
        styledImg.style.display = 'none';
        stylePlaceholder.style.display = 'block';
        styledImageActions.style.display = 'none';
        
        proceedToStoryBtn.disabled = true; // Require user interaction
        validateStep2();
    } else if (step === 3) {
        // Set up story prompt step with current image (styled or original)
        const imageUrl = `${API_BASE_URL}/download/${sessionId}/styled_image.jpeg?t=${Date.now()}`;
        
        // Try styled image first, fallback to original
        const img = new Image();
        img.onload = () => {
            storyImagePreview.src = imageUrl;
        };
        img.onerror = () => {
            storyImagePreview.src = `${API_BASE_URL}/download/${sessionId}/original_image.jpeg?t=${Date.now()}`;
        };
        img.src = imageUrl;
        
        validateStep3();
    } else if (step === 5) {
        // Generate assets step - reset progress display
        progressCircle.style.strokeDashoffset = '314';
        progressPercent.textContent = '0%';
        progressStatus.textContent = 'Ready to generate...';
        generationLog.innerHTML = '';
        assetsPreview.style.display = 'none';
        assetsGrid.innerHTML = '';
        
        // Add initial log entry to show the step is active
        setTimeout(() => {
            addLogEntry('Asset generation step loaded', 'info');
        }, 100);
    }
}

function updateUI() {
    validateStep1();
    validateStep2();
    validateStep3();
}

function showLoading(title, description) {
    loadingTitle.textContent = title;
    loadingDescription.textContent = description;
    loadingOverlay.classList.add('active');
}

function hideLoading() {
    loadingOverlay.classList.remove('active');
}

function showError(message) {
    errorMessage.textContent = message;
    errorModal.classList.add('active');
}

function closeErrorModal() {
    errorModal.classList.remove('active');
}

// Audio playback functionality
function playAudio(audioUrl) {
    const audio = new Audio(audioUrl);
    audio.play().catch(error => {
        console.error('Audio playback failed:', error);
        showError('Failed to play audio. Please check your browser settings.');
    });
}

// Video player setup
function setupVideoPlayer(moviePath) {
    const videoContainer = document.getElementById('videoPlayerContainer');
    const videoPlayer = document.getElementById('moviePlayer');
    const videoTitle = document.getElementById('videoTitle');
    const videoDuration = document.getElementById('videoDuration');
    const watchOnlineBtn = document.getElementById('watchOnlineBtn');
    
    if (moviePath) {
        // Extract filename from path
        const filename = moviePath.split('/').pop();
        const videoUrl = `${API_BASE_URL}/download/${sessionId}/${filename}`;
        
        // Setup video player
        videoPlayer.src = videoUrl;
        videoTitle.textContent = currentStory.title || 'Your Movie';
        
        // Show video container and watch button
        videoContainer.style.display = 'block';
        watchOnlineBtn.style.display = 'inline-flex';
        
        // Setup watch online button
        watchOnlineBtn.onclick = () => {
            videoContainer.scrollIntoView({ behavior: 'smooth' });
            videoPlayer.play();
        };
        
        // Update duration when video loads
        videoPlayer.addEventListener('loadedmetadata', () => {
            const duration = Math.floor(videoPlayer.duration);
            const minutes = Math.floor(duration / 60);
            const seconds = duration % 60;
            videoDuration.textContent = `Duration: ${minutes}:${seconds.toString().padStart(2, '0')}`;
        });
    }
}

// Enhanced download functionality
function handleDownload() {
    const filename = selectedMovieOption === 'video' ? 'final_video_movie.mp4' : 'final_slideshow_movie.mp4';
    const downloadUrl = `${API_BASE_URL}/download/${sessionId}/${filename}`;
    
    // Create download link
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `${currentStory.title || 'movie'}_${selectedMovieOption}.mp4`;
    
    // Add some visual feedback
    const originalText = downloadMovieBtn.innerHTML;
    downloadMovieBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Downloading...';
    downloadMovieBtn.disabled = true;
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    // Reset button after a delay
    setTimeout(() => {
        downloadMovieBtn.innerHTML = originalText;
        downloadMovieBtn.disabled = false;
    }, 2000);
}

// Audio Recording Functions
async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        
        mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
        };
        
        mediaRecorder.onstop = () => {
            recordedAudioBlob = new Blob(audioChunks, { type: 'audio/wav' });
            const audioUrl = URL.createObjectURL(recordedAudioBlob);
            audioPlayer.src = audioUrl;
            audioPreview.style.display = 'block';
            
            // Stop all tracks to free the microphone
            stream.getTracks().forEach(track => track.stop());
        };
        
        mediaRecorder.start();
        isRecording = true;
        recordingStartTime = Date.now();
        
        // Update UI
        recordBtn.style.display = 'none';
        stopRecordBtn.style.display = 'inline-flex';
        stopRecordBtn.disabled = false;
        recordingTime.style.display = 'inline-block';
        document.body.classList.add('recording');
        
        // Start timer
        recordingInterval = setInterval(updateRecordingTime, 1000);
        
    } catch (error) {
        console.error('Error starting recording:', error);
        showError('Could not access microphone. Please check your permissions.');
    }
}

function stopRecording() {
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
        isRecording = false;
        
        // Update UI
        recordBtn.style.display = 'inline-flex';
        stopRecordBtn.style.display = 'none';
        recordingTime.style.display = 'none';
        document.body.classList.remove('recording');
        
        // Clear timer
        if (recordingInterval) {
            clearInterval(recordingInterval);
            recordingInterval = null;
        }
    }
}

function updateRecordingTime() {
    if (recordingStartTime) {
        const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        recordingTime.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
}

function playRecording() {
    if (audioPlayer.src) {
        audioPlayer.play();
    }
}

function deleteRecording() {
    recordedAudioBlob = null;
    audioPlayer.src = '';
    audioPreview.style.display = 'none';
    recordingTime.textContent = '00:00';
}

// Upload recorded audio to server
async function uploadRecordedAudio() {
    if (!recordedAudioBlob || !sessionId) {
        return null;
    }
    
    try {
        const formData = new FormData();
        formData.append('audio', recordedAudioBlob, 'recorded_voice.wav');
        formData.append('session_id', sessionId);
        
        const response = await fetch(`${API_BASE_URL}/upload-audio/`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error('Audio upload failed');
        }
        
        const data = await response.json();
        return data.audio_path;
        
    } catch (error) {
        console.error('Audio upload error:', error);
        return null;
    }
} 