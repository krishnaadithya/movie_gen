# AI Movie Generator

A sophisticated web application that transforms images and story prompts into complete AI-generated movies with visuals, narration, and cinematic experiences.

## ✨ Features

- **Image-Based Story Generation**: Upload any image and get a personalized story
- **Interactive Story Editor**: Review and edit generated stories before production
- **AI Asset Generation**: Automatic creation of scene images and audio narration
- **Dual Movie Modes**: 
  - **Slideshow Mode**: Fast image-based movies with audio
  - **Video Mode**: Full AI-generated videos using advanced models
- **Beautiful Modern UI**: Responsive design with step-by-step workflow
- **Real-time Progress**: Visual feedback during asset and movie generation

## 🎬 How It Works

### Step 1: Upload & Prompt
1. Upload an image (JPG, PNG, GIF)
2. Describe the kind of story you want
3. Optionally specify visual style and aspect ratio

### Step 2: Edit Story
1. Review the AI-generated story
2. Edit scenes, descriptions, and image prompts
3. Customize title, genre, tone, and moral

### Step 3: Generate Assets
1. AI generates images for each scene
2. Text-to-speech creates audio narration
3. Preview all generated assets

### Step 4: Create Movie
1. Choose between slideshow or video generation
2. AI stitches everything into a complete movie
3. Download your finished film

## 🚀 Quick Start

### Prerequisites

- Python 3.8+
- Node.js (for development)
- API keys for:
  - [Replicate](https://replicate.com/) (for LLM and video generation)
  - [Flux API](https://docs.bfl.ai/) (for image generation)
  - [Black Forest Labs](https://huggingface.co/black-forest-labs) (for image editing)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd movie_gen
   ```

2. **Install Python dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env
   # Edit .env with your API keys
   ```

4. **Start the backend server**
   ```bash
   python main.py
   ```

5. **Open the web application**
   - Open `index.html` in your browser
   - Or serve it using a local server:
   ```bash
   python -m http.server 3000
   ```

## 📋 Required Dependencies

```bash
pip install fastapi uvicorn python-dotenv pillow requests replicate moviepy python-multipart
```

## 🔧 API Endpoints

### Core Endpoints
- `POST /upload-image/` - Upload and analyze image
- `POST /generate-story/` - Generate story from image + prompt
- `PUT /update-story/` - Update story content
- `POST /generate-assets/` - Generate images and audio
- `POST /generate-movie/` - Create final movie
- `GET /download/{session_id}/{filename}` - Download files

### Utility Endpoints
- `GET /health` - Health check

## 🎨 UI Components

### Modern Design Features
- **Gradient Backgrounds**: Beautiful color transitions
- **Step-by-Step Progress**: Visual progress indicator
- **Drag & Drop Upload**: Intuitive file handling
- **Real-time Validation**: Form validation and feedback
- **Loading States**: Smooth loading animations
- **Error Handling**: User-friendly error messages
- **Responsive Design**: Works on all devices

### Color Scheme
- Primary: `#6366f1` (Indigo)
- Secondary: `#8b5cf6` (Purple)
- Success: `#10b981` (Emerald)
- Background: Clean whites and grays

## 🏗️ Architecture

### Backend (FastAPI)
- **Session Management**: Unique sessions for each user
- **File Management**: Organized output directories
- **API Integration**: Multiple AI service providers
- **Error Handling**: Comprehensive error management
- **Async Processing**: Non-blocking operations

### Frontend (Vanilla JS)
- **Step Management**: Multi-step workflow
- **State Management**: Client-side session handling
- **API Communication**: RESTful API calls
- **Real-time Updates**: Progress tracking and feedback
- **Responsive UI**: Mobile-first design

### File Structure
```
movie_gen/
├── main.py              # FastAPI backend
├── index.html           # Main web interface
├── style.css            # UI styling
├── script.js            # Frontend logic
├── env.example          # Environment template
├── README.md            # Documentation
└── output/              # Generated files
    └── {session_id}/    # User sessions
        ├── original_image.jpeg
        ├── styled_image.jpeg
        ├── scene_*_image.jpeg
        ├── scene_*_audio.wav
        └── final_movie.mp4
```

## 🔐 Environment Variables

```bash
REPLICATE_API_KEY=your_replicate_key
FLUX_API_KEY=your_flux_key  
BFL_API_KEY=your_bfl_key
```

## 📱 Usage Examples

### Example 1: Children's Story
1. Upload: Photo of a child with a pet
2. Prompt: "A magical adventure where they discover a hidden forest"
3. Style: "Watercolor illustration"
4. Result: Whimsical animated story with moral lessons

### Example 2: Adult Drama
1. Upload: Portrait photo
2. Prompt: "A mystery thriller about uncovering family secrets"
3. Style: "Film noir"
4. Result: Dramatic slideshow with suspenseful narration

## 🛠️ Development

### Running in Development Mode
```bash
# Backend with auto-reload
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Frontend with live server (optional)
python -m http.server 3000
```

### API Testing
Use the FastAPI automatic docs at `http://localhost:8000/docs`

## 🚨 Troubleshooting

### Common Issues

1. **API Key Errors**
   - Ensure all API keys are set in `.env`
   - Check API key validity and quotas

2. **CORS Issues**
   - Make sure the frontend is served from the same origin
   - Or configure CORS settings in `main.py`

3. **File Upload Issues**
   - Check file size limits (default 10MB)
   - Ensure supported image formats

4. **Generation Timeouts**
   - Video generation can take 5-10 minutes
   - Check API service status

### Debug Mode
Set `DEBUG=True` in `.env` for detailed error messages.

## 📄 License

This project is open source and available under the MIT License.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 🎯 Future Enhancements

- [ ] User authentication and saved projects
- [ ] Multiple video styles and templates
- [ ] Batch processing for multiple images
- [ ] Advanced audio customization
- [ ] Social sharing features
- [ ] Cloud storage integration
- [ ] Mobile app version

---

**Built with ❤️ using FastAPI, Vanilla JavaScript, and cutting-edge AI APIs** 