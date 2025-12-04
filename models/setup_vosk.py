#!/usr/bin/env python3
"""Download and setup Vosk model for Lylyt"""

import os
import requests
import zipfile
from pathlib import Path

def download_file(url, destination):
    print("Downloading Vosk model...")
    response = requests.get(url, stream=True)
    response.raise_for_status()
    
    total = int(response.headers.get('content-length', 0))
    downloaded = 0
    
    with open(destination, 'wb') as f:
        for chunk in response.iter_content(chunk_size=8192):
            if chunk:
                f.write(chunk)
                downloaded += len(chunk)
                if total > 0:
                    percent = (downloaded / total) * 100
                    print(f"\rProgress: {percent:.1f}%", end='')
    print("\nDownload complete!")

def main():
    print("Lylyt - Setting up Vosk STT Model")
    print("=" * 60)
    
    # Small English model (40MB) - good for mobile
    model_url = "https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip"
    model_zip = Path("vosk-model.zip")
    
    print("\nDownloading Vosk small English model (40MB)...")
    download_file(model_url, model_zip)
    
    print("\nExtracting model...")
    with zipfile.ZipFile(model_zip, 'r') as zip_ref:
        zip_ref.extractall("vosk_model")
    
    print("Model extracted to vosk_model/")
    
    # Copy to Android assets
    android_assets = Path("../android/app/src/main/assets/vosk")
    android_assets.mkdir(parents=True, exist_ok=True)
    
    # Find the extracted model directory
    import shutil
    model_dir = list(Path("vosk_model").glob("vosk-model-*"))[0]
    
    # Copy model files
    dest_model = android_assets / "model"
    if dest_model.exists():
        shutil.rmtree(dest_model)
    shutil.copytree(model_dir, dest_model)
    
    print(f"Model copied to: {dest_model}")
    
    # Cleanup
    model_zip.unlink()
    shutil.rmtree("vosk_model")
    
    print("\nSuccess! Vosk model ready for offline STT")
    print("Size:", sum(f.stat().st_size for f in dest_model.rglob('*') if f.is_file()) / 1024 / 1024, "MB")

if __name__ == "__main__":
    main()

