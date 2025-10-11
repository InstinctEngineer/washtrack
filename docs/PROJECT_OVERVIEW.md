# WashTrack - Project Overview

## Project Purpose
WashTrack is an enterprise billing system for a national vehicle wash service company. It replaces manual Google Sheets tracking with a secure, role-based web application that streamlines wash event tracking, supply request management, and billing report generation.

## Target Users

### Employees (50-100 users)
- Mark vehicles as washed at their assigned location
- View their wash history and statistics
- Submit supply requests

### Managers
- Approve supply requests for their location
- Oversee location operations
- View team performance metrics
- Generate location-specific reports

### Finance Team
- Generate monthly billing exports
- Approve supply orders across all locations
- View financial summaries and revenue reports
- Export data in Excel format for invoicing

### System Administrators
- Create and manage user accounts
- Manage location data
- Configure system settings
- Monitor system health and usage

## Problems This Solves

1. **Broken Google Sheets System**
   - Eliminates data corruption from concurrent editing
   - Prevents accidental deletions and overwrites
   - Provides structured data validation

2. **Eliminates O365 Licensing Costs**
   - No need for expensive Microsoft 365 subscriptions
   - Self-hosted solution with full control
   - Reduces ongoing operational expenses

3. **Prevents Data Entry Errors**
   - Form validation ensures data quality
   - Dropdown selections prevent typos
   - Required fields enforce completeness

4. **Automates Billing Workflows**
   - Automated monthly report generation
   - Excel export eliminates manual compilation
   - Audit trails for compliance

5. **Improves Security**
   - Role-based access control
   - Secure authentication
   - Activity logging and audit trails

## Core Features

### Phase 1 (Current - Foundation)
- ✅ User authentication with role-based access
- ✅ Secure database with Row Level Security
- ✅ Role-specific dashboards (Employee, Manager, Finance, Admin)
- ✅ Admin user creation interface
- ✅ Professional responsive layout

### Phase 2 (Next - Core Functionality)
- Vehicle wash event tracking
- Location management
- Supply request submission and approval workflow
- Multi-level approval chains

### Phase 3 (Future - Advanced Features)
- Monthly billing report generation
- Excel export functionality
- Advanced analytics and dashboards
- Email notifications
- Mobile app support

## Tech Stack

### Frontend
- **React 18** - Modern UI framework
- **TypeScript** - Type safety and better developer experience
- **Tailwind CSS** - Utility-first styling
- **shadcn/ui** - Accessible component library
- **React Router** - Client-side routing
- **React Query** - Server state management

### Backend (Lovable Cloud / Supabase)
- **PostgreSQL** - Relational database
- **Row Level Security** - Database-level access control
- **Supabase Auth** - User authentication
- **Supabase Storage** - File storage (future)
- **Edge Functions** - Serverless backend logic (future)

### Development Tools
- **Vite** - Fast build tool
- **ESLint** - Code linting
- **Zod** - Runtime validation
- **xlsx** - Excel file generation (future)

## Security Model

### Authentication
- Email/password authentication
- Admin-only user creation (no self-registration)
- Session management with automatic token refresh

### Authorization
- Role-based access control (RBAC)
- Four distinct roles: employee, manager, finance, admin
- Protected routes enforce role requirements
- Database RLS policies mirror frontend permissions

### Data Protection
- All user inputs validated with Zod schemas
- SQL injection prevention via Supabase client
- Encrypted data in transit (HTTPS)
- Encrypted data at rest (PostgreSQL encryption)

## Development Roadmap

**Q1 2025**: Foundation & Authentication ✅
**Q2 2025**: Core wash tracking and supply requests
**Q3 2025**: Billing reports and Excel export
**Q4 2025**: Mobile app and advanced analytics

## Success Metrics
- Replace Google Sheets completely
- Zero O365 license costs
- 50-100 active users
- < 2 second page load times
- 99.9% uptime
- Zero data loss incidents
