# HiveCodex - Backend

This directory contains the backend services for the HiveCodex application, built with Node.js, Express, and TypeScript. It handles user authentication, real-time communication via WebSockets, file management, and database interactions.

## ✨ Features

* **RESTful API**: For user management, room creation, and file operations.
* **WebSocket Server**: Using Socket.IO for real-time collaboration, chat, and presence.
* **MongoDB Integration**: With Mongoose for data modeling and persistence.
* **GridFS File Storage**: For efficient storage and retrieval of user-uploaded files and project assets.
* **JWT Authentication**: Secure, token-based authentication for all protected routes.
* **AI Service Integration**: Connects to the Gemini AI for code suggestions and chat assistance.

## 🛠️ Tech Stack

* **Framework**: Express.js
* **Language**: TypeScript
* **Database**: MongoDB & Mongoose
* **Real-time**: Socket.IO
* **Authentication**: JWT, bcryptjs
* **File Storage**: GridFS
* **Validation**: express-validator
* **AI**: `@google/generative-ai`

## 🏁 Getting Started

### Prerequisites

* Node.js (v18 or higher)
* npm
* A running MongoDB instance

### Installation & Setup

1.  **Navigate to the backend directory:**

    ```bash
    cd backend
    ```

2.  **Install dependencies:**

    ```bash
    npm install
    ```

3.  **Create an environment file:**

    Copy the contents of `.env.example` to a new file named `.env` and fill in the required values.

    ```
    MONGO_URI=your_mongodb_connection_string
    JWT_SECRET=your_jwt_secret
    PORT=5000
    GEMINI_API_KEY=your_gemini_api_key
    ```

4.  **Run the development server:**

    ```bash
    npm run dev
    ```

    The server will be running on the port specified in your `.env` file (defaults to 5000).

## 🚀 Available Scripts

* `npm run build`: Compiles the TypeScript code to JavaScript in the `dist` directory.
* `npm run dev`: Starts the development server with hot-reloading using `nodemon` and `ts-node`.
* `npm run start`: Starts the production server from the compiled code in `dist`.

## 📂 Folder Structure
backend/
└── src/
├── auth/         # Authentication logic (JWT, passwords)
├── config/       # Configuration constants
├── database/     # MongoDB models and GridFS setup
├── routes/       # Express API routes
├── services/     # Business logic (AI service, etc.)
├── socket/       # Socket.IO handlers
├── types/        # TypeScript type definitions
├── utils/        # Helper functions
└── server.ts     # Main application entry point


## 🔐 API Endpoints

A brief overview of the available API endpoints:

* **Auth**: `POST /api/auth/register`, `POST /api/auth/login`
* **Users**: `GET /api/users/:userId/profile`, `GET /api/user/rooms`
* **Rooms**: `GET /api/rooms`, `POST /api/rooms`, `GET /api/rooms/:roomId`, `POST /api/rooms/:roomId/join`
* **Files**: `GET /api/files/:fileId/content`, `PUT /api/files/:fileId/content`, `POST /api/rooms/:roomId/files`
* **AI**: `POST /api/ai/suggestions`, `POST /api/ai/chat`