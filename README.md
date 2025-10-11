# WashTrack

An enterprise vehicle wash tracking and billing system with role-based access control.

## Quick Start

### Prerequisites
- Node.js 18+ and npm installed
- Lovable Cloud account (automatically configured)

### Environment Setup
The project uses Lovable Cloud for backend services. Environment variables are automatically configured in `.env`:
- `VITE_SUPABASE_URL` - Backend API URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` - Public API key

### Development

1. **Install dependencies:**
   ```sh
   npm install
   ```

2. **Start development server:**
   ```sh
   npm run dev
   ```

3. **Access the application:**
   - Open [http://localhost:8080](http://localhost:8080)
   - Login with admin credentials (create test users via admin dashboard)

### Build for Production

```sh
npm run build
npm run preview  # Test production build locally
```

## Project Structure

- `/src/components` - Reusable UI components
- `/src/pages` - Application pages and routes
- `/src/contexts` - React Context providers (auth, etc.)
- `/src/types` - TypeScript type definitions
- `/docs` - Project documentation

See [docs/FOLDER_STRUCTURE.md](docs/FOLDER_STRUCTURE.md) for detailed information.

## User Roles

- **Employee**: Track vehicle washes
- **Manager**: Approve requests, view team metrics
- **Finance**: Generate billing reports, approve orders
- **Admin**: Manage users, locations, system settings

## First-Time Setup

1. Sign in to the Lovable Cloud dashboard
2. Create an admin user account manually in the database
3. Use admin account to create additional users via the app

## Documentation

- [Project Overview](docs/PROJECT_OVERVIEW.md) - Architecture and features
- [Folder Structure](docs/FOLDER_STRUCTURE.md) - Code organization

## Technologies

- **Frontend**: React 18, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Lovable Cloud (Supabase)
- **Database**: PostgreSQL with Row Level Security
- **Auth**: Email/password with role-based access control

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/4c89b111-32da-4cc7-8587-e48461b167ef) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/4c89b111-32da-4cc7-8587-e48461b167ef) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
