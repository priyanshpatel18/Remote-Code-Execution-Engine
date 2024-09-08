# Express Prisma API

This repository contains a basic Express server setup using Prisma ORM with TypeScript. It includes CRUD operations for managing users and API documentation with Swagger.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [API Documentation](#api-documentation)

## Features

- RESTful API endpoints
- CRUD operations for models
- Integration with Swagger for API documentation

## Installation

To set up the project, follow these steps:

1. **Clone the repository**

   ```bash
   git clone --branch express-prisma-api-base https://github.com/priyanshpatel18/backend
   ```

2. **Navigate to the project directory**

   ```bash
   cd backend
   ```

3. **Install pnpm (If not installed)**

   ```bash
   npm install -g pnpm
   ```

4. **Install Dependencies**

   ```bash
   pnpm install
   ```

5. **Setup Environment Variables**

   Create a `.env` file in the root directory of the project with the following content:

   ```env
   PORT=3000
   DATABASE_URL=<YOUR_DB_URL>
   ```

6. **Setup Prisma**

   Ensure you have a Prisma database setup. Run the following command to generate Prisma client:

   ```bash
   npx prisma generate
   ```

## Usage

1. **Run the Server**

   ```bash
   pnpm start
   ```

2. **Access the Server**

   - **Health Check**: Open your browser or use a tool like curl or Postman to access the health endpoint at [http://localhost:3000/health](http://localhost:3000/health).
   - **API Documentation**: Access the Swagger documentation at [http://localhost:3000/api-docs](http://localhost:3000/api-docs).

## API Documentation

The API endpoints are documented using Swagger. You can view the documentation at [http://localhost:3000/api-docs](http://localhost:3000/api-docs). The documentation includes:

- **`GET /users`**: Retrieves a list of all users.
- **`GET /users/:id`**: Retrieves a user by ID.
- **`POST /users`**: Creates a new user.
- **`PUT /users/:id`**: Updates a user by ID.
- **`DELETE /users/:id`**: Deletes a user by ID.
