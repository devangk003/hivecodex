# 🚀 HiveCodex: Real-Time Collaborative Coding Platform

HiveCodex is a full-stack web application designed to provide a real-time, collaborative coding environment with features inspired by platforms like Discord and Visual Studio Code. It allows developers to work together in rooms, edit files in a shared Monaco-based editor, chat, and manage their projects seamlessly.

## ✨ Features

* **Real-time Collaborative Editor**: Powered by Monaco Editor, the same editor used in VS Code, allowing multiple users to code in the same file simultaneously.
* **Discord-like UI/UX**: A familiar and intuitive interface with rooms, user panels, and activity status.
* **File Explorer**: A complete file and folder management system within each room.
* **Integrated Chat**: A real-time chat for each room to facilitate communication.
* **AI Assistant**: An integrated AI to help with code suggestions, debugging, and more.
* **User Presence**: See who's online, their status, and what they are working on.
* **Authentication**: Secure user registration and login.
* **Room Management**: Create public or private rooms for your projects.

## 🛠️ Tech Stack

### Frontend

* **Framework**: React with Vite
* **Language**: TypeScript
* **UI**: shadcn/ui, Tailwind CSS
* **State Management**: React Context API, TanStack Query
* **Routing**: React Router
* **Editor**: Monaco Editor
* **Real-time Communication**: Socket.IO Client

### Backend

* **Framework**: Express.js
* **Language**: TypeScript
* **Database**: MongoDB with Mongoose
* **Real-time Communication**: Socket.IO
* **Authentication**: JWT (JSON Web Tokens)
* **File Storage**: GridFS (for file uploads)

## 🏁 Getting Started

### Prerequisites

* Node.js (v18 or higher)
* npm (or your preferred package manager)
* MongoDB instance (local or cloud)

### Installation & Setup

1.  **Clone the repository:**

    ```bash
    git clone [https://github.com/devangk003/hivecodex.git](https://github.com/devangk003/hivecodex.git)
    cd hivecodex
    ```

2.  **Install backend dependencies:**

    ```bash
    cd backend
    npm install
    ```

3.  **Install frontend dependencies:**

    ```bash
    cd ../frontend
    npm install
    ```

4.  **Configure environment variables:**

    * In the `backend` directory, create a `.env` file from the `.env.example`.
    * In the `frontend` directory, create a `.env` file from the `.env.example`.

5.  **Run the application:**

    * In one terminal, start the backend server:

        ```bash
        cd backend
        npm run dev
        ```

    * In another terminal, start the frontend development server:

        ```bash
        cd ../frontend
        npm run dev
        ```

The application should now be running, with the frontend accessible at `http://localhost:8080` and the backend at `http://localhost:5000`.

## 📂 Project Structure
hivecodex/
├── backend/       # Node.js, Express, Socket.IO
│   ├── src/
│   └── package.json
├── frontend/      # React, Vite, Tailwind CSS
│   ├── src/
│   └── package.json
└── .gitignore     # Root gitignore


For more detailed information, please refer to the `README.md` files within the `frontend` and `backend` directories.
