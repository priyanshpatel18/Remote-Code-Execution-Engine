FROM gcc:13.3

# Create a non-root user
RUN addgroup --gid 1001 codeuser && \
  adduser --disabled-password --gecos '' --uid 1001 --gid 1001 codeuser

WORKDIR /usr/src/app

# Set permissions for the working directory
RUN chown -R codeuser:codeuser /usr/src/app

# Switch to the non-root user
USER codeuser

# Set the default command to keep the container running
CMD ["tail", "-f", "/dev/null"]
