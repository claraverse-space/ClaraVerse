import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional
from diffusers import StableDiffusionPipeline, StableDiffusionXLPipeline, DiffusionPipeline
from diffusers.loaders import LoraLoaderMixin
import torch

# Set up cache directory for models
MODEL_CACHE = os.path.expanduser("~/.cache/clara_diffusers")
os.makedirs(MODEL_CACHE, exist_ok=True)

router = APIRouter()

# Supported models and LoRA (extend as needed)
SD_MODELS = {
    "sd1.5": "runwayml/stable-diffusion-v1-5",
    "sdxl": "stabilityai/stable-diffusion-xl-base-1.0",
}

LORA_WEIGHTS = {
    # Example: "lora_name": "path_or_hf_repo"
}

# --- Schemas ---
class ModelListResponse(BaseModel):
    models: List[str]

class LoraListResponse(BaseModel):
    loras: List[str]

class DownloadModelRequest(BaseModel):
    model_name: str

class DownloadModelResponse(BaseModel):
    status: str
    model_path: str

class GenerateRequest(BaseModel):
    prompt: str
    model_name: str = Field(..., description="Model key, e.g. 'sd1.5' or 'sdxl'")
    lora_name: Optional[str] = Field(None, description="LoRA key if any")
    negative_prompt: Optional[str] = None
    steps: int = 30
    guidance_scale: float = 7.5
    width: int = 512
    height: int = 512
    seed: Optional[int] = None
    sampler: Optional[str] = None  # Not all samplers are supported in diffusers
    scheduler: Optional[str] = None  # Not all schedulers are supported in diffusers

class GenerateResponse(BaseModel):
    image_base64: str
    info: dict

# --- Helper functions ---
def get_model_path(model_key: str) -> str:
    if model_key not in SD_MODELS:
        raise HTTPException(status_code=404, detail="Model not supported")
    return SD_MODELS[model_key]

def get_lora_path(lora_key: str) -> str:
    if lora_key not in LORA_WEIGHTS:
        raise HTTPException(status_code=404, detail="LoRA not supported")
    return LORA_WEIGHTS[lora_key]

# --- Endpoints ---
@router.get("/models", response_model=ModelListResponse)
def list_models():
    """List supported base models."""
    return {"models": list(SD_MODELS.keys())}

@router.get("/lora", response_model=LoraListResponse)
def list_loras():
    """List available LoRA weights."""
    return {"loras": list(LORA_WEIGHTS.keys())}

@router.post("/download", response_model=DownloadModelResponse)
def download_model(req: DownloadModelRequest):
    """Download a model from HuggingFace if not already cached."""
    model_id = get_model_path(req.model_name)
    try:
        # Download model (no actual inference)
        _ = DiffusionPipeline.from_pretrained(model_id, cache_dir=MODEL_CACHE, local_files_only=False)
        return {"status": "downloaded", "model_path": os.path.join(MODEL_CACHE, model_id.replace('/', os.sep))}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to download model: {str(e)}")

@router.post("/generate", response_model=GenerateResponse)
def generate_image(req: GenerateRequest):
    """Generate an image using the specified model and config."""
    model_id = get_model_path(req.model_name)
    lora_id = get_lora_path(req.lora_name) if req.lora_name else None
    try:
        # Select pipeline
        if req.model_name == "sdxl":
            pipe = StableDiffusionXLPipeline.from_pretrained(model_id, cache_dir=MODEL_CACHE, torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32)
        else:
            pipe = StableDiffusionPipeline.from_pretrained(model_id, cache_dir=MODEL_CACHE, torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32)
        # Move to GPU if available
        if torch.cuda.is_available():
            pipe = pipe.to("cuda")
        # Apply LoRA if provided
        if lora_id:
            if not isinstance(pipe, LoraLoaderMixin):
                raise HTTPException(status_code=400, detail="This pipeline does not support LoRA loading.")
            pipe.load_lora_weights(lora_id)
        # Set seed
        generator = torch.Generator(device=pipe.device)
        if req.seed is not None:
            generator = generator.manual_seed(req.seed)
        # Generate
        result = pipe(
            prompt=req.prompt,
            negative_prompt=req.negative_prompt,
            num_inference_steps=req.steps,
            guidance_scale=req.guidance_scale,
            width=req.width,
            height=req.height,
            generator=generator
        )
        # Convert to base64
        import base64
        from io import BytesIO
        img = result.images[0]
        buffered = BytesIO()
        img.save(buffered, format="PNG")
        img_b64 = base64.b64encode(buffered.getvalue()).decode()
        return GenerateResponse(
            image_base64=img_b64,
            info={
                "model": req.model_name,
                "lora": req.lora_name,
                "steps": req.steps,
                "guidance_scale": req.guidance_scale,
                "width": req.width,
                "height": req.height,
                "seed": req.seed,
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Image generation failed: {str(e)}")

@router.get("/device")
def get_device():
    import torch
    return {"device": "cuda" if torch.cuda.is_available() else "cpu"} 