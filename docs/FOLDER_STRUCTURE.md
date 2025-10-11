# WashTrack - Folder Structure

This document explains the organization of the WashTrack codebase.

## Root Structure

```
washtrack/
├── docs/                    # Project documentation
├── public/                  # Static assets
├── src/                     # Source code
├── supabase/               # Supabase configuration
├── index.html              # HTML entry point
├── package.json            # Dependencies
├── tailwind.config.ts      # Tailwind CSS configuration
├── tsconfig.json           # TypeScript configuration
└── vite.config.ts          # Vite build configuration
```

## Source Code Structure (`/src`)

### `/src/components`
Reusable UI components used throughout the application.

**Key Files:**
- `Layout.tsx` - Main application layout with navigation
- `ProtectedRoute.tsx` - Route wrapper for authentication/authorization
- `ui/` - shadcn/ui component library (Button, Card, Input, etc.)

**Usage Example:**
```tsx
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
```

### `/src/contexts`
React Context providers for global state management.

**Key Files:**
- `AuthContext.tsx` - Authentication state and user profile management

**What it provides:**
- Current user session
- User profile with role information
- Sign out functionality
- Loading states

**Usage Example:**
```tsx
import { useAuth } from '@/contexts/AuthContext';

function MyComponent() {
  const { userProfile, signOut } = useAuth();
  // ...
}
```

### `/src/pages`
Top-level page components corresponding to routes.

**Key Files:**
- `Login.tsx` - Authentication page
- `EmployeeDashboard.tsx` - Employee role homepage
- `ManagerDashboard.tsx` - Manager role homepage
- `FinanceDashboard.tsx` - Finance role homepage
- `AdminDashboard.tsx` - Admin role homepage
- `CreateUser.tsx` - Admin page for creating new users
- `Unauthorized.tsx` - Access denied page
- `NotFound.tsx` - 404 error page

**Naming Convention:**
- Page components use PascalCase
- File names match component names
- One page per file

### `/src/lib`
Utility functions and helper code.

**Key Files:**
- `utils.ts` - Common utilities (classNames helper, etc.)

**Purpose:**
- Shared logic that doesn't fit in components
- Pure functions without side effects
- Type-safe helpers

### `/src/hooks`
Custom React hooks for reusable logic.

**Key Files:**
- `use-mobile.tsx` - Responsive breakpoint detection
- `use-toast.ts` - Toast notification system

**Usage Example:**
```tsx
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from '@/hooks/use-toast';
```

### `/src/types`
TypeScript type definitions and interfaces.

**Key Files:**
- `database.ts` - Database table types (User, Location, etc.)

**Purpose:**
- Centralized type definitions
- Ensures type safety across the app
- Matches database schema

**Usage Example:**
```tsx
import { User, UserRole } from '@/types/database';
```

### `/src/integrations/supabase`
Auto-generated Supabase client configuration.

**Key Files:**
- `client.ts` - Configured Supabase client instance
- `types.ts` - Auto-generated database types

**⚠️ Important:**
These files are auto-generated. Do not edit manually.

**Usage Example:**
```tsx
import { supabase } from '@/integrations/supabase/client';
```

## Documentation (`/docs`)

### Purpose
Comprehensive project documentation for developers and stakeholders.

**Key Files:**
- `PROJECT_OVERVIEW.md` - High-level project description
- `FOLDER_STRUCTURE.md` - This file
- `README.md` - Quick start guide (in root directory)

**When to Update:**
- Add new major features
- Change architecture decisions
- Onboard new team members

## Supabase Configuration (`/supabase`)

### Purpose
Backend configuration and database migrations.

**Key Files:**
- `config.toml` - Supabase project configuration
- `migrations/` - Database schema changes (auto-managed)

**⚠️ Important:**
Migrations are managed by Lovable Cloud. Do not edit manually.

## Path Aliases

The project uses TypeScript path aliases for cleaner imports:

```tsx
// Instead of: import { Button } from '../../../../components/ui/button'
import { Button } from '@/components/ui/button'
```

**Configured in:**
- `tsconfig.json` - TypeScript path resolution
- `vite.config.ts` - Build-time path resolution

## Component Organization Best Practices

### When to Create a New Component
- Logic is reused in 3+ places
- Component exceeds 200 lines
- Distinct visual or functional unit

### When to Create a New Page
- New route in the application
- Distinct user workflow
- Role-specific view

### When to Create a New Hook
- State logic used in multiple components
- Complex stateful behavior
- Side effects that need cleanup

### When to Create a New Type
- Database table representation
- API response structure
- Shared domain models

## Import Order Convention

Follow this order for cleaner code:

```tsx
// 1. External libraries
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// 2. Internal components
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';

// 3. Contexts and hooks
import { useAuth } from '@/contexts/AuthContext';

// 4. Types
import { User } from '@/types/database';

// 5. Utils and config
import { supabase } from '@/integrations/supabase/client';
```

## File Naming Conventions

- **Components**: PascalCase (`Layout.tsx`, `CreateUser.tsx`)
- **Utilities**: camelCase (`utils.ts`, `formatDate.ts`)
- **Hooks**: kebab-case with `use-` prefix (`use-mobile.tsx`)
- **Types**: camelCase (`database.ts`, `api.ts`)
- **Pages**: PascalCase matching component (`Login.tsx`)

## Future Additions

As the project grows, consider adding:

- `/src/services/` - API service layers
- `/src/utils/` - More utility functions
- `/src/constants/` - Application constants
- `/src/schemas/` - Zod validation schemas
- `/src/styles/` - Global style utilities
