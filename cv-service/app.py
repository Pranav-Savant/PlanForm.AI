from fastapi import FastAPI, UploadFile, File
import shutil
import os
from parser.preprocess import process_floorplan

app = FastAPI()

UPLOAD_DIR = "temp_uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@app.post("/parse-floorplan")
async def parse_floorplan(file: UploadFile = File(...)):
    file_path = os.path.join(UPLOAD_DIR, file.filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    result = process_floorplan(file_path)

    return result