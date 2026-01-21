# Launcher Build Configuration

## Overview
The launcher build system now supports variable filenames through environment variables.

## Usage

### Method 1: Using the default version (v1)
```bash
npm run build-launcher
```
This will use the version specified in `.env` file (default: v1)

### Method 2: Specify version via command line
```bash
npm run build-launcher:version --version=v2
```

### Method 3: Set environment variable directly
```bash
LAUNCHER_VERSION=v2 npm run build-launcher
```

### Method 4: Update .env file
Edit the `.env` file and change:
```
LAUNCHER_VERSION=v2
```
Then run:
```bash
npm run build-launcher
```

## Output Files
The build will generate the following files in the `dist/` directory:
- `launcher-core-{VERSION}.js`
- `launcher-{VERSION}.js`
- `launcher.css`

Where `{VERSION}` is the value you specified (e.g., v1, v2, v3, etc.)

## Examples
```bash
# Build with version v1 (default)
npm run build-launcher

# Build with version v2
npm run build-launcher:version --version=v2

# Build with version v3
LAUNCHER_VERSION=v3 npm run build-launcher

# Build with custom version
LAUNCHER_VERSION=2024-01 npm run build-launcher
```

