#!/bin/bash

# Set base directory
BASE_DIR="/home/mscollins/wafapi"

# Create directory structure
mkdir -p $BASE_DIR/{backend/templates,frontend/assets}

# Navigate to backend and set up Python virtual environment
cd $BASE_DIR/backend
python3 -m venv venv

# Activate venv and install initial packages
source venv/bin/activate
pip install --upgrade pip
pip install flask requests flask-cors

# Create placeholder files
touch app.py cli_generator.py waf_api_handler.py config.py
touch ../frontend/index.html ../frontend/app.js ../frontend/style.css
touch ../README.md

# Confirm setup
echo "✅ Project structure created at $BASE_DIR"
echo "✅ Python virtual environment initialized in $BASE_DIR/backend/venv"
echo "✅ Flask and dependencies installed"
