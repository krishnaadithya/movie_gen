from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os
import requests
import base64
from PIL import Image
from io import BytesIO
import dotenv
import time
import replicate
from moviepy.editor import ImageClip, AudioFileClip, concatenate_videoclips, VideoFileClip
import json
from multiprocessing import Pool, cpu_count
import shutil
import uuid
from pathlib import Path
from tqdm import tqdm
import threading
import wave
import struct

# Load environment variables
dotenv.load_dotenv()

# Initialize FastAPI app
app = FastAPI(title="Movie Generator API", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure this for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Set up environment variables
os.environ["REPLICATE_API_TOKEN"] = os.getenv("REPLICATE_API_KEY")

# Create output directories
OUTPUT_DIR = Path("output")
OUTPUT_DIR.mkdir(exist_ok=True)

# Pydantic models
class StoryScene(BaseModel):
    scene_id: int
    heading: str
    text: str
    image_prompt: str

class Story(BaseModel):
    title: str
    age_group: str
    genre: str
    tone: str
    scenes: List[StoryScene]
    moral: Optional[str] = None

class StoryRequest(BaseModel):
    story_prompt: str
    style_prompt: Optional[str] = ""
    aspect_ratio: Optional[str] = "16:9"

class MovieGenerationRequest(BaseModel):
    session_id: str
    use_video_generator: Optional[bool] = False

class ImageDescription(BaseModel):
    subject: str
    image_description: str

# Store sessions in memory (use Redis/database in production)
sessions = {}

# Store generation status for each session
generation_status = {}

# System prompts
STORY_SYSTEM_PROMPT = """
You are a masterful children's and adult fiction storyteller. Your job is to create immersive, emotionally rich, and hyper-realistic stories based on a user's input image and/or description of a character.

The stories should be vivid and grounded in sensory details, imaginative world-building, and character-driven narratives. For children, keep vocabulary simple, include light moral lessons, and favor magical realism or gentle fantasy. For adults, adapt the tone and theme accordingly (e.g., introspective, adventurous, nostalgic).

You must structure each story in the following JSON format:

{
  "title": "Creative, age-appropriate title",
  "age_group": "e.g., 5-7",
  "genre": "Adventure, Mystery, Fantasy, etc.",
  "tone": "Whimsical, heartwarming, serious, etc.",
  "scenes": [
    {
      "scene_id": 1,
      "heading": "Scene 1 title",
      "text": "Scene description with sensory details, dialogue, and action",
      "image_prompt": "Using the style and aesthetics of the input image, generate an image of [scene description]. Should look like it belongs in the same environment."
    }
  ],
  "moral": "Optional moral if target audience is children"
}

Always:
- Use imagery-based writing: show, don't tell
- Keep the protagonist consistent with the provided image or description
- Match tone and genre to user preferences
- Limit story length to what's suitable for the given age group
- Ensure `image_prompt` is grounded in each scene's content, designed to visually match the tone and character from the uploaded image.
"""

IMAGE_DESCRIPTION_SYSTEM_PROMPT = """
You are an expert image analyzer. Your task is to analyze the provided image and output a simple JSON response with the following structure:

{
    "subject": "The main subject of the image a male, female, child, animal, object, etc.",
    "image_description": "A clear, detailed description of what you see in the image that an LLM can understand and work with"
}

Focus on:
1. Identifying if there are people in the image (man, woman, child, etc.) and describing them
2. Describing the overall scene, setting, and visual elements in a way that's useful for an LLM to understand and process
3. Being concise but comprehensive - include key details about composition, colors, lighting, and atmosphere

Keep the description factual and descriptive, avoiding interpretation or storytelling elements.
"""

# Utility functions
def image_to_data_uri(image: Image.Image) -> str:
    """Convert PIL Image to data URI"""
    buffered = BytesIO()
    image.save(buffered, format="JPEG")
    img_str = base64.b64encode(buffered.getvalue()).decode()
    return f"data:image/jpeg;base64,{img_str}"

def image_to_uri(path: str) -> str:
    """Convert image file to URI"""
    img = Image.open(path)
    buffered = BytesIO()
    img.save(buffered, format="JPEG")
    return f"data:image/jpeg;base64,{base64.b64encode(buffered.getvalue()).decode()}"

def llm_call(system_prompt: str, prompt: str, llm: str = "openai/gpt-4o", image=None) -> str:
    """Make LLM call with optional image input"""
    try:
        if image is not None:
            image_str = image_to_data_uri(image)
            input_data = {
                "prompt": prompt,
                "system_prompt": system_prompt,
                "image_input": [image_str]
            }
        else:
            input_data = {
                "prompt": prompt,
                "system_prompt": system_prompt,
            }
        
        output_text = ""
        for event in replicate.stream(llm, input=input_data):
            output_text += str(event)
        
        return output_text
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM call failed: {str(e)}")

def edit_image(image: Image.Image, prompt: str, aspect_ratio: str = "16:9") -> Image.Image:
    """Edit image using Flux API"""
    try:
        buffered = BytesIO()
        image.save(buffered, format="JPEG")
        image_str = base64.b64encode(buffered.getvalue()).decode()

        request = requests.post(
            'https://api.bfl.ai/v1/flux-kontext-pro',
            headers={
                'accept': 'application/json',
                'x-key': os.environ.get("FLUX_API_KEY"),
                'Content-Type': 'application/json',
                'aspect_ratio': aspect_ratio
            },
            json={
                'prompt': prompt,
                'input_image': image_str,
                'aspect_ratio': aspect_ratio
            },
        ).json()

        request_id = request["id"]
        polling_url = request["polling_url"]

        while True:
            time.sleep(0.5)
            result = requests.get(
                polling_url,
                headers={
                    'accept': 'application/json',
                    'x-key': os.environ.get("FLUX_API_KEY"),
                },
                params={'id': request_id},
            ).json()
            
            status = result["status"]
            
            if status == "Ready":
                break
            elif status in ["Error", "Failed"]:
                raise HTTPException(status_code=500, detail=f"Image generation failed: {result}")

        image_url = result['result']['sample']
        response = requests.get(image_url)
        return Image.open(BytesIO(response.content))
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Image editing failed: {str(e)}")

def generate_image(text: str, aspect_ratio: str = "16:9") -> str:
    """Generate image from text using Flux API"""
    try:
        request = requests.post(
            'https://api.bfl.ai/v1/flux-kontext-pro',
            headers={
                'accept': 'application/json',
                'x-key': os.environ.get("FLUX_API_KEY"),
                'Content-Type': 'application/json',
            },
            json={
                'prompt': text,
                'aspect_ratio': aspect_ratio
            },
        ).json()

        request_id = request["id"]
        polling_url = request["polling_url"]

        while True:
            time.sleep(0.5)
            result = requests.get(
                polling_url,
                headers={
                    'accept': 'application/json',
                    'x-key': os.environ.get("FLUX_API_KEY"),
                },
                params={'id': request_id}
            ).json()
            
            status = result['status']
            
            if status == 'Ready':
                image_url = result['result']['sample']
                response = requests.get(image_url)
                return Image.open(BytesIO(response.content))
            elif status in ['Error', 'Failed']:
                raise HTTPException(status_code=500, detail=f"Image generation failed: {result}")
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Image generation failed: {str(e)}")

def generate_audio(text: str, audio_path: str=None) -> str:
    """Generate audio from text"""
    try:
        output = replicate.run(
            "resemble-ai/chatterbox",
            input={
                "seed": 0,
                "prompt": text,
                "cfg_weight": 0.5,
                "temperature": 0.8,
                "exaggeration": 0.5,
                "audio_path": audio_path
            }
        )
        return output
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Audio generation failed: {str(e)}")

def save_audio(audio_url: str, filename: str) -> str:
    """Save audio from URL to file"""
    try:
        response = requests.get(audio_url)
        with open(filename, "wb") as f:
            f.write(response.content)
        return filename
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Audio saving failed: {str(e)}")

def generate_video_from_images_kling(image_path: str, prompt: str) -> str:
    """Generate video using Kling model"""
    try:
        input_params = {
            "mode": "standard",
            "prompt": prompt,
            "duration": 5,
            "start_image": image_to_uri(image_path),
            "negative_prompt": ""
        }
        
        output = replicate.run("kwaivgi/kling-v2.1", input=input_params)
        return output
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Video generation failed: {str(e)}")

def save_video(video_url: str, filename: str) -> str:
    """Save video from URL to file"""
    try:
        response = requests.get(video_url)
        with open(filename, "wb") as f:
            f.write(response.content)
        return filename
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Video saving failed: {str(e)}")

# Simple status tracking
def set_generation_status(session_id: str, status: str, completed: bool = False, error: str = None):
    """Set generation status for a session"""
    generation_status[session_id] = {
        "status": status,
        "completed": completed,
        "error": error
    }

# API Endpoints

@app.post("/upload-image/")
async def upload_image(file: UploadFile = File(...)):
    """Upload and analyze image"""
    try:
        # Generate session ID
        session_id = str(uuid.uuid4())
        
        # Create session directory
        session_dir = OUTPUT_DIR / session_id
        session_dir.mkdir(exist_ok=True)
        
        # Save uploaded image
        image_content = await file.read()
        image = Image.open(BytesIO(image_content))
        original_image_path = session_dir / "original_image.jpeg"
        image.save(original_image_path)
        
        # Analyze image
        image_description = llm_call(
            IMAGE_DESCRIPTION_SYSTEM_PROMPT,
            "Describe the image in detail",
            image=image
        )
        
        image_description_dict = json.loads(image_description)
        
        # Store session data
        sessions[session_id] = {
            "original_image_path": str(original_image_path),
            "image_description": image_description_dict,
            "image": image
        }
        
        return {
            "session_id": session_id,
            "image_description": image_description_dict
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Image upload failed: {str(e)}")

@app.post("/generate-story/")
async def generate_story(
    session_id: str = Form(...),
    story_prompt: str = Form(...),
    style_prompt: str = Form(""),
    aspect_ratio: str = Form("16:9")
):
    """Generate story from image and prompt"""
    try:
        if session_id not in sessions:
            raise HTTPException(status_code=404, detail="Session not found")
        
        session_data = sessions[session_id]
        image_description = session_data["image_description"]
        
        # Generate story
        full_story_prompt = f"A story about {image_description['image_description']} {story_prompt}"
        story_output = llm_call(STORY_SYSTEM_PROMPT, full_story_prompt)
        story_dict = json.loads(story_output)
        
        # Apply style if provided
        styled_image = session_data["image"]
        if style_prompt:
            final_style_prompt = f"Make the image look like {style_prompt}"
            styled_image = edit_image(session_data["image"], final_style_prompt, aspect_ratio)
            
            # Save styled image
            session_dir = Path(session_data["original_image_path"]).parent
            styled_image_path = session_dir / "styled_image.jpeg"
            styled_image.save(styled_image_path)
            sessions[session_id]["styled_image_path"] = str(styled_image_path)
            sessions[session_id]["styled_image"] = styled_image
        
        # Store story in session
        sessions[session_id]["story"] = story_dict
        sessions[session_id]["aspect_ratio"] = aspect_ratio
        
        return {"story": story_dict}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Story generation failed: {str(e)}")

@app.put("/update-story/")
async def update_story(
    session_id: str = Form(...),
    story: str = Form(...)
):
    """Update story content"""
    try:
        if session_id not in sessions:
            raise HTTPException(status_code=404, detail="Session not found")
        
        # Parse story JSON string
        story_dict = json.loads(story)
        
        # Update story in session
        sessions[session_id]["story"] = story_dict
        
        return {"message": "Story updated successfully", "story": story_dict}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Story update failed: {str(e)}")

@app.post("/generate-image/")
async def generate_image_endpoint(
    prompt: str = Form(...),
    aspect_ratio: str = Form("16:9")
):
    """Generate image from text prompt"""
    try:
        # Generate session ID
        session_id = str(uuid.uuid4())
        
        # Create session directory
        session_dir = OUTPUT_DIR / session_id
        session_dir.mkdir(exist_ok=True)
        
        # Generate image
        generated_image = generate_image(prompt)
        
        # Save generated image
        image_path = session_dir / "original_image.jpeg"
        generated_image.save(image_path)
        
        # Create fake image description for backend consistency
        image_description_dict = {
            "subject": "Generated image",
            "image_description": f"A generated image of: {prompt}"
        }
        
        # Store session data
        sessions[session_id] = {
            "original_image_path": str(image_path),
            "image_description": image_description_dict,
            "image": generated_image,
            "generated": True
        }
        
        # Return image URL for frontend display
        image_url = f"/download/{session_id}/original_image.jpeg"
        
        return {
            "session_id": session_id,
            "image_url": image_url,
            "message": "Image generated successfully"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Image generation failed: {str(e)}")

@app.post("/upload-audio/")
async def upload_audio(
    audio: UploadFile = File(...),
    session_id: str = Form(...)
):
    """Upload recorded audio file"""
    try:
        if session_id not in sessions:
            raise HTTPException(status_code=404, detail="Session not found")
        
        session_dir = Path(sessions[session_id]["original_image_path"]).parent
        
        # Save uploaded audio
        audio_content = await audio.read()
        audio_path = session_dir / "recorded_voice.wav"
        
        with open(audio_path, "wb") as f:
            f.write(audio_content)
        
        # Store audio path in session
        sessions[session_id]["recorded_audio_path"] = str(audio_path)
        
        return {
            "message": "Audio uploaded successfully",
            "audio_path": str(audio_path)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Audio upload failed: {str(e)}")

@app.post("/use-styled-as-base/")
async def use_styled_as_base(session_id: str = Form(...)):
    """Use the styled image as the new base image for further editing"""
    try:
        if session_id not in sessions:
            raise HTTPException(status_code=404, detail="Session not found")
        
        session_data = sessions[session_id]
        session_dir = Path(session_data["original_image_path"]).parent
        
        styled_image_path = session_dir / "styled_image.jpeg"
        
        if not styled_image_path.exists():
            raise HTTPException(status_code=404, detail="Styled image not found")
        
        # Load the styled image
        styled_image = Image.open(styled_image_path)
        
        # Update session data to use styled image as the base
        sessions[session_id]["image"] = styled_image
        sessions[session_id]["styled_image"] = styled_image
        
        return {"message": "Styled image is now set as base for further editing"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to set styled image as base: {str(e)}")

@app.get("/generation-status/{session_id}")
async def get_generation_status(session_id: str):
    """Check if asset generation is complete"""
    if session_id in generation_status:
        return generation_status[session_id]
    else:
        return {
            "status": "Not started",
            "completed": False,
            "error": None
        }

@app.post("/generate-assets/")
async def generate_assets(
    session_id: str = Form(...),
    audio_path: str = Form(None)
):
    """Generate images and audio for all scenes"""
    def generate_assets_background():
        try:
            print(f"Starting asset generation for session: {session_id}")
            set_generation_status(session_id, "Generating assets...")
            
            if session_id not in sessions:
                set_generation_status(session_id, "Error", True, "Session not found")
                return
            
            session_data = sessions[session_id]
            story = session_data["story"]
            start_image = session_data.get("styled_image", session_data["image"])
            aspect_ratio = session_data.get("aspect_ratio", "16:9")
            
            session_dir = Path(session_data["original_image_path"]).parent
            recorded_audio_path = session_data.get("recorded_audio_path", None)
            
            # Generate assets for each scene
            scene_assets = []
            current_image = start_image
            
            print(f"Generating assets for {len(story['scenes'])} scenes")
            
            for i, scene in enumerate(story["scenes"]):
                try:
                    print(f"Processing scene {i+1}/{len(story['scenes'])}: {scene['heading']}")

                    # -----------------
                    # AUDIO GENERATION
                    # -----------------
                    audio_path = session_dir / f"scene_{i}_audio.wav"
                    try:
                        audio_url = generate_audio(scene["text"], recorded_audio_path)
                        save_audio(audio_url, str(audio_path))
                        print(f"Audio saved: {audio_path}")
                    except Exception as audio_err:
                        print(f"Audio generation failed for scene {i}: {audio_err}. Creating silent placeholder.")
                        with wave.open(str(audio_path), 'w') as wf:
                            wf.setnchannels(1)
                            wf.setsampwidth(2)
                            wf.setframerate(16000)
                            silence = struct.pack('<h', 0)
                            for _ in range(16000):
                                wf.writeframes(silence)

                    # -----------------
                    # IMAGE GENERATION
                    # -----------------
                    image_path = session_dir / f"scene_{i}_image.jpeg"
                    try:
                        scene_image = edit_image(current_image, scene["image_prompt"], aspect_ratio)
                        scene_image.save(image_path)
                        print(f"Image saved: {image_path}")
                        current_image = scene_image
                    except Exception as img_err:
                        print(f"Image generation failed for scene {i}: {img_err}. Using previous image as fallback.")
                        current_image.save(image_path)

                    # Append asset info
                    scene_assets.append({
                        "scene_id": i,
                        "image_path": str(image_path),
                        "audio_path": str(audio_path)
                    })
                except Exception as loop_err:
                    # Catch any unexpected error so loop continues
                    print(f"Unexpected error in scene {i}: {loop_err}")
                    continue
            
            # Store assets in session
            sessions[session_id]["scene_assets"] = scene_assets
            
            set_generation_status(session_id, "Assets generated successfully!", True)
            print(f"Asset generation completed for session: {session_id}")
            
        except Exception as e:
            error_msg = f"Asset generation failed: {str(e)}"
            print(f"Asset generation error for session {session_id}: {error_msg}")
            set_generation_status(session_id, "Failed", True, error_msg)
    
    # Start generation in background
    thread = threading.Thread(target=generate_assets_background)
    thread.daemon = True
    thread.start()
    
    # Return immediately
    return {"message": "Asset generation started. This may take a minute or two...", "session_id": session_id}

@app.post("/generate-movie/")
async def generate_movie(request: MovieGenerationRequest):
    """Generate final movie"""
    try:
        if request.session_id not in sessions:
            raise HTTPException(status_code=404, detail="Session not found")
        
        session_data = sessions[request.session_id]
        scene_assets = session_data["scene_assets"]
        session_dir = Path(session_data["original_image_path"]).parent
        
        if request.use_video_generator:
            # Generate videos for each scene
            video_paths = []
            for asset in scene_assets:
                scene_id = asset["scene_id"]
                story_scene = session_data["story"]["scenes"][scene_id]
                
                video_url = generate_video_from_images_kling(
                    asset["image_path"], 
                    story_scene["text"]
                )
                
                video_path = session_dir / f"scene_{scene_id}_video.mp4"
                save_video(video_url, str(video_path))
                video_paths.append(str(video_path))
            
            # Stitch videos with audio
            final_movie_path = stitch_video_movie(
                video_paths, 
                [asset["audio_path"] for asset in scene_assets],
                str(session_dir)
            )
        else:
            # Create slideshow movie
            final_movie_path = stitch_image_movie(
                [asset["image_path"] for asset in scene_assets],
                [asset["audio_path"] for asset in scene_assets],
                str(session_dir)
            )
        
        return {"movie_path": final_movie_path}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Movie generation failed: {str(e)}")

@app.get("/download/{session_id}/{filename}")
async def download_file(session_id: str, filename: str):
    """Download generated files"""
    try:
        if session_id not in sessions:
            raise HTTPException(status_code=404, detail="Session not found")
        
        session_dir = Path(sessions[session_id]["original_image_path"]).parent
        file_path = session_dir / filename
        
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="File not found")
        
        return FileResponse(
            path=str(file_path),
            filename=filename,
            media_type='application/octet-stream'
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Download failed: {str(e)}")

def stitch_image_movie(image_paths: List[str], audio_paths: List[str], output_dir: str) -> str:
    """Create movie from images and audio"""
    try:
        clips = []
        
        for image_path, audio_path in zip(image_paths, audio_paths):
            audio_clip = AudioFileClip(audio_path)
            duration = audio_clip.duration
            
            image_clip = ImageClip(image_path).set_duration(duration)
            video_clip = image_clip.set_audio(audio_clip)
            clips.append(video_clip)
        
        final_movie = concatenate_videoclips(clips, method="compose")
        output_path = os.path.join(output_dir, "final_slideshow_movie.mp4")
        final_movie.write_videofile(output_path, fps=24)
        
        # Cleanup
        for clip in clips:
            clip.close()
        final_movie.close()
        
        return output_path
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Movie stitching failed: {str(e)}")

def stitch_video_movie(video_paths: List[str], audio_paths: List[str], output_dir: str) -> str:
    """Create movie from videos and audio"""
    try:
        clips = []
        
        for video_path, audio_path in zip(video_paths, audio_paths):
            video_clip = VideoFileClip(video_path)
            audio_clip = AudioFileClip(audio_path)
            
            # Adjust video duration to match audio
            if audio_clip.duration < video_clip.duration:
                video_clip = video_clip.subclip(0, audio_clip.duration)
            else:
                video_clip = video_clip.set_duration(audio_clip.duration)
            
            final_clip = video_clip.set_audio(audio_clip)
            clips.append(final_clip)
        
        final_movie = concatenate_videoclips(clips, method="compose")
        output_path = os.path.join(output_dir, "final_video_movie.mp4")
        final_movie.write_videofile(output_path, fps=24)
        
        # Cleanup
        for clip in clips:
            clip.close()
        final_movie.close()
        
        return output_path
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Video movie stitching failed: {str(e)}")

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}



if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)