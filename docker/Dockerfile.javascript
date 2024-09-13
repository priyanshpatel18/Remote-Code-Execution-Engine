FROM node:22-alpine

# Create a non-root user
RUN addgroup -S codeuser && adduser -S -G codeuser codeuser

WORKDIR /usr/src/app

# Set permissions for the working directory
RUN chown -R codeuser:codeuser /usr/src/app

# Switch to the non-root user
USER codeuser

# Set the default command to keep the container running
CMD ["tail", "-f", "/dev/null"]