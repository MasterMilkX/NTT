import os
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
os.environ.setdefault("OMP_NUM_THREADS", "2")
os.environ.setdefault("MKL_NUM_THREADS", "2")
os.environ.setdefault("OPENBLAS_NUM_THREADS", "2")

import torch
from fastapi import FastAPI
from pydantic import BaseModel
from transformers import AutoTokenizer, AutoModelForCausalLM

MODEL_PATH = "../../llama_npctt-v1/"

torch.set_num_threads(2)
torch.set_num_interop_threads(1)

tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH, use_fast=True)
if tokenizer.pad_token is None:
    tokenizer.pad_token = tokenizer.eos_token

model = AutoModelForCausalLM.from_pretrained(
    MODEL_PATH,
    torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
    device_map="auto",
)
model.eval()

app = FastAPI()

class GenReq(BaseModel):
    prompt: str
    max_new_tokens: int = 128

@app.post("/generate")
def generate(req: GenReq):
    enc = tokenizer(req.prompt, return_tensors="pt").to(model.device)
    with torch.no_grad():
        out = model.generate(
            **enc,
            max_new_tokens=req.max_new_tokens,
            do_sample=True,
            temperature=0.7,
            top_p=0.9,
            eos_token_id=tokenizer.eos_token_id,
        )
    text = tokenizer.decode(out[0], skip_special_tokens=True)
    return {"text": text[len(req.prompt):].strip()}



# lazy loading
import threading
MODEL_READY = False
_lock = threading.Lock()

def _load_model():
    global MODEL_READY, tokenizer, model
    # ... load tokenizer/model here ...
    MODEL_READY = True

@app.on_event("startup")
def startup():
    threading.Thread(target=_load_model, daemon=True).start()

@app.get("/health")
def health():
    return {"ok": True, "model_ready": MODEL_READY}
