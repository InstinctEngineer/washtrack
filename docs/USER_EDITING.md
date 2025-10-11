# User Management Documentation

## Overview

The User Management system in WashTrack allows administrators to view, create, and edit user accounts. This includes managing employee information, assigning locations and managers, and controlling user roles and permissions.

## Accessing User Management

- **Path**: `/admin/users`
- **Required Role**: Admin
- **Navigation**: Admin Dashboard → Users (sidebar)

## User Table Features

### Display Columns

The user table displays the following information for each user:

- **Employee ID**: Unique identifier (cannot be changed after creation)
- **Name**: Full name of the user
- **Email**: User's email address
- **Location**: Assigned wash location (or "Not Assigned")
- **Role**: User's role with color-coded badge
  - Employee (gray)
  - Manager (blue)
  - Finance (green)
  - Admin (red)
- **Manager**: Assigned manager (or "None")
- **Status**: Active or Inactive
- **Actions**: Edit button

### Filtering and Search

**Role Filter**:
- All Roles
- Employee
- Manager
- Finance
- Admin

**Status Filter**:
- All Status
- Active
- Inactive

**Search Box**:
- Search by name, email, or employee ID
- Real-time filtering as you type

### Sorting

Click on column headers to sort by:
- Employee ID
- Name
- Role

Click again to toggle between ascending and descending order.

## Creating Users

### Access

Click the "Create New User" button in the top right corner of the Users page.

### Required Information

1. **Employee ID*** (Required)
   - Must be unique
   - Alphanumeric characters only
   - Cannot be changed after creation
   - Example: EMP001, TECH042

2. **Full Name*** (Required)
   - Maximum 100 characters
   - User's full name

3. **Email*** (Required)
   - Must be a valid email format
   - Must be unique in the system
   - Used for login

4. **Location*** (Required)
   - Select from active locations
   - If no locations exist, create locations first

5. **Role*** (Required)
   - Employee (default)
   - Manager
   - Finance
   - Admin

6. **Manager** (Conditional)
   - Required for Employee and Manager roles
   - Optional for Finance and Admin roles
   - Select from users with Manager or Admin roles

### Temporary Password

When a user is created:
- A secure 12-character password is automatically generated
- The password is displayed once in a dialog
- Click "Copy Password" to copy it to clipboard
- ⚠️ Save this password - it won't be shown again
- User must change password on first login

### Validation Rules

- Employee ID must be alphanumeric only
- Employee ID must be unique
- Email must be unique
- Location must be selected
- Manager required for Employee and Manager roles
- All required fields must be filled

### Common Errors

**"Duplicate Employee ID"**
- Solution: Choose a different employee ID

**"Email Already In Use"**
- Solution: Use a different email address

**"Please create locations first"**
- Solution: Go to Locations page and create at least one location

**"No managers available"**
- Solution: First create a user with Manager or Admin role

## Editing Users

### Access

Click the "Edit" button (pencil icon) in the Actions column for any user.

### Editable Fields

1. **Employee ID**: Disabled (cannot be changed)

2. **Full Name**
   - Update user's name
   - Maximum 100 characters

3. **Email**
   - Update email address
   - Must be unique
   - Must be valid email format

4. **Location***
   - Change assigned location
   - Required field
   - Select from active locations

5. **Role***
   - Change user role
   - Requires confirmation dialog
   - Admins cannot change their own role

6. **Manager**
   - Required for Employee and Manager roles
   - Optional for Finance and Admin
   - Cannot select self as manager
   - Automatically cleared when role changes to Finance or Admin

7. **Status**
   - Toggle between Active and Inactive
   - Inactive users cannot log in

### Role Changes

When changing a user's role:
- A confirmation dialog appears
- Shows old role → new role
- Confirms permission changes
- Updates both users and user_roles tables

Example: "Change role from employee to manager? This affects user permissions."

### Location Changes

When an admin changes their own location:
- A confirmation dialog appears
- Shows old location → new location
- Warns about wash entry association changes

Example: "User's wash entries will now be associated with [New Location]"

### Security Restrictions

**Editing Own Account**:
- Warning banner: "⚠️ You are editing your own account"
- Cannot change own role (prevents self-demotion)
- Must confirm location changes

**Manager Requirements**:
- Employees and Managers must have a manager assigned
- Finance and Admin roles don't require managers
- Manager field automatically cleared when promoting to Finance or Admin

### Validation Rules

- Name, email, and location are required
- Email must be unique (if changed)
- Valid email format required
- Manager required for Employee and Manager roles
- Cannot select self as manager

### Common Errors

**"Validation Error"**
- Check that all required fields are filled
- Verify email format is correct
- Ensure manager is assigned for appropriate roles

**"Email already in use"**
- The new email is already registered to another user
- Use a different email address

**"Cannot change own role"**
- Admins cannot demote themselves
- Another admin must change your role

## User Status

### Active Status

- User can log in
- Can perform their role-based actions
- Appears in manager and location assignments

### Inactive Status

- User cannot log in
- Historical data preserved (wash entries, etc.)
- Still appears in system records
- Can be reactivated later

### Deactivating vs. Deleting

- WashTrack uses deactivation instead of deletion
- Preserves historical data integrity
- Wash entries remain associated with deactivated users
- Can reactivate users if they return

## Role-Based Permissions

### Employee
- Can log wash entries
- View own wash history
- Cannot access admin features

### Manager
- All employee permissions
- View reports for their location
- Cannot modify system settings

### Finance
- View all wash entries and reports
- Generate financial reports
- Cannot modify users or system settings

### Admin
- Full system access
- User management
- Location management
- Vehicle management
- System settings

## Integration with Other Features

### Locations
- Users are assigned to locations
- Location assignment affects where wash entries are recorded
- Changing location updates future wash entry associations

### Managers
- Managers can be assigned to multiple employees
- Managers can view reports for their assigned employees
- Manager hierarchy is maintained in the system

### Wash Entries
- All wash entries are linked to the user who created them
- Location on wash entry comes from user's assigned location
- Historical wash entries remain unchanged when user location changes

## Best Practices

### Creating Users

1. **Plan your employee IDs**: Use a consistent format (e.g., EMP001, MGR001)
2. **Verify email addresses**: Ensure they're correct before creating
3. **Assign locations**: Make sure locations exist before creating users
4. **Set up managers first**: Create manager accounts before employee accounts
5. **Save passwords securely**: Copy and store temporary passwords safely

### Editing Users

1. **Verify changes**: Double-check before saving, especially role changes
2. **Communicate changes**: Inform users about role or location changes
3. **Update in batches**: Make multiple related changes at once
4. **Check dependencies**: Ensure managers exist before assigning them

### User Lifecycle

1. **Onboarding**: Create user → Assign location → Assign manager → Provide credentials
2. **Changes**: Update location/role as needed → Notify user
3. **Offboarding**: Deactivate user → Preserve historical data

## Troubleshooting

### Cannot Create User

**Issue**: "Please create locations first"
- **Solution**: Go to Locations page and create at least one location

**Issue**: "No managers available"
- **Solution**: Create a user with Manager or Admin role first

**Issue**: "Duplicate Employee ID"
- **Solution**: Check existing users and choose a unique employee ID

### Cannot Edit User

**Issue**: "Cannot change own role"
- **Solution**: Have another admin change your role

**Issue**: Email already in use
- **Solution**: Use a different email or check if user already exists

### Validation Errors

**Issue**: "Manager is required"
- **Solution**: Select a manager for Employee or Manager roles

**Issue**: Location not assigned
- **Solution**: Select a location from the dropdown

## Security Notes

### Role Storage

- Roles are stored in the `user_roles` table (secure)
- The `users.role` column is kept in sync for backward compatibility
- Always use the `user_roles` table for role checks in code

### Password Security

- Temporary passwords are randomly generated (12 characters)
- Include uppercase, lowercase, numbers, and special characters
- Users must change password on first login
- Passwords are not stored in plain text

### Permission Validation

- All user modifications require admin role
- Role changes are validated server-side
- Admins cannot demote themselves
- User cannot select themselves as their own manager

## Future Enhancements

Planned features for user management:

- **Bulk user import**: CSV upload for creating multiple users
- **Password reset**: Admin-initiated password reset
- **User activity logs**: Track user actions and changes
- **Profile pictures**: Avatar upload for users
- **Department/team assignment**: Organize users into groups
- **Email notifications**: Automatic notifications for role/location changes
