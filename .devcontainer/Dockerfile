FROM mcr.microsoft.com/devcontainers/python:3.11-bullseye

# Install Node.js for frontend development
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && npm install -g npm@latest

# Install additional tools
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    git \
    vim \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# The vscode user already exists in the base image, so we don't need to create it
# Just ensure the workspace directory exists
WORKDIR /workspace

# Install Claude Code CLI globally
RUN npm install -g @anthropic-ai/claude-code


# Switch to the existing vscode user
USER vscode