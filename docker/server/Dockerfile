FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

# Update and install necessary dependencies for multiple languages
RUN apt-get update \
  && apt-get upgrade -y \
  && apt-get install -y \
  # Install Python
  python3 python3-pip \
  # Install C and C++ compilers
  build-essential \
  # Install Java
  default-jdk \
  # Install Node.js from NodeSource
  curl \
  && curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
  && apt-get install -y nodejs \
  # Install pnpm for Node.js/TypeScript project management
  && npm install -g pnpm \
  && npm install -g typescript \
  # Clean up
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

# Set the default working directory
WORKDIR /app

# Copy the package.json and package-lock.json files
COPY package*.json ./
COPY pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy the rest of the application code
COPY . .

# Expose the application port
EXPOSE 8080

RUN pnpm run build

# Create a non-root user for better security
RUN useradd -ms /bin/bash codeuser
USER codeuser

# Run the server
CMD ["pnpm", "start"]