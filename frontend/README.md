# HiveCodex - Frontend

This is the frontend for the HiveCodex application, a real-time collaborative coding platform. It's built with React, Vite, and TypeScript, and styled with Tailwind CSS and shadcn/ui.

## ✨ Features

* **Modern React Stack**: Built with Vite for a fast development experience.
* **Type Safety**: Fully written in TypeScript.
* **Component-Based UI**: A rich set of reusable components from `shadcn/ui`.
* **Real-time Interactivity**: Seamless communication with the backend via Socket.IO for live updates.
* **Collaborative Editor**: Integrated Monaco Editor with real-time cursor tracking and text synchronization.
* **Client-Side State Management**: Efficient data fetching and caching with TanStack Query.
* **Protected Routes**: Secure routing for authenticated users.

## 🛠️ Tech Stack

* **Framework**: React (with Vite)
* **Language**: TypeScript
* **UI Library**: shadcn/ui
* **Styling**: Tailwind CSS
* **State Management**: TanStack Query, React Context
* **Routing**: React Router DOM
* **Editor**: Monaco Editor
* **Real-time**: Socket.IO Client

## 🏁 Getting Started

### Prerequisites

* Node.js (v18 or higher)
* npm

### Installation & Setup

1.  **Navigate to the frontend directory:**

    ```bash
    cd frontend
    ```

2.  **Install dependencies:**

    ```bash
    npm install
    ```

3.  **Create an environment file:**

    Copy the contents of `.env.example` to a new file named `.env`.

    ```
    VITE_API_BASE_URL=http://localhost:5000/api
    VITE_SOCKET_URL=http://localhost:5000
    ```

4.  **Run the development server:**

    ```bash
    npm run dev
    ```

    The frontend will be available at `http://localhost:8080`.

## 🚀 Available Scripts

* `npm run dev`: Starts the Vite development server.
* `npm run build`: Builds the application for production.
* `npm run lint`: Lints the codebase using ESLint.
* `npm run format`: Formats the code using Prettier.

## 📂 Folder Structure
frontend/
└── src/
├── components/    # Reusable UI components
│   ├── ui/        # shadcn/ui components
│   ├── ...
├── contexts/      # React Context providers
├── hooks/         # Custom React hooks
├── lib/           # API clients, utility functions
├── pages/         # Page components for routing
├── services/      # Client-side services (socket, etc.)
├── types/         # TypeScript type definitions
├── App.tsx        # Main application component
└── main.tsx       # Application entry point