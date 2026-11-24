#!/bin/bash

# Load environment variables from .env file if it exists
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

# Set default version if not specified
LAUNCHER_VERSION=${LAUNCHER_VERSION:-v1}

echo "Building launcher with version: $LAUNCHER_VERSION"

# Create dist directory
mkdir -p ./dist

# Compile TypeScript files
echo "Compiling TypeScript files..."
tsc --skipLibCheck --noEmitOnError false bootstrap/launcher-core.ts --outfile bootstrap/launcher-core-${LAUNCHER_VERSION}.js
tsc --skipLibCheck --noEmitOnError false bootstrap/launcher.ts --outfile bootstrap/launcher.js

# Minify JavaScript files
echo "Minifying JavaScript files..."
minify bootstrap/launcher-core-${LAUNCHER_VERSION}.js > dist/launcher-core-${LAUNCHER_VERSION}.js
minify bootstrap/launcher.js > dist/launcher.js

# Minify CSS files
echo "Minifying CSS files..."
minify bootstrap/launcher.css bootstrap/animate.min.css > dist/launcher.css

echo "Build complete! Files generated:"
echo "  - dist/launcher-core-${LAUNCHER_VERSION}.js"
echo "  - dist/launcher.js"
echo "  - dist/launcher.css"

