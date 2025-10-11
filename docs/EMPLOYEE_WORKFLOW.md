# Employee Wash Entry Workflow

## Overview
The employee dashboard provides a streamlined interface for tracking vehicle washes throughout the week. This document explains how employees use the system and common issues they might encounter.

## Daily Workflow

### 1. Accessing the Dashboard
- Navigate to the Employee Dashboard from the sidebar
- You'll see a week view with columns for Monday through Sunday
- Today's date is highlighted with a blue border

### 2. Recording a Vehicle Wash

#### Using the Search Autocomplete
1. Click on the search input for the day you're recording
2. Start typing the vehicle number
3. A dropdown will appear showing matching vehicles:
   - Vehicles starting with your input appear first
   - Vehicles containing your input appear next
   - Vehicles from your home location are prioritized at the top
   - Each result shows: Vehicle number, type, and home location

4. Click on a vehicle from the dropdown OR type the complete number and press Enter/click Add

#### What Happens When You Add a Wash
- The system validates the vehicle exists and is active
- Checks if the vehicle was already washed on that date
- Creates a wash entry with your ID and location
- Updates the vehicle's last seen location and date
- Shows a success message
- Adds the entry to the day's list

### 3. Managing Entries

#### Viewing Your Entries
- Each day shows all vehicles you've washed
- Entries display:
  - Vehicle number
  - Vehicle type
  - Time the entry was created

#### Deleting Entries
- You can only delete entries created **today**
- Click the X button next to an entry to remove it
- Past entries cannot be deleted (security measure)

#### Daily Count
- Each day shows a count of vehicles washed
- Helps you track your daily productivity

### 4. Week Navigation

#### Moving Between Weeks
- **Previous Week**: Click the left arrow to view past weeks
- **Current Week**: Click to jump back to the current week
- **Next Week**: Click the right arrow to plan ahead

#### Week Cutoff
- Some dates may show "Entry Closed" badge
- This prevents entries for dates before the payroll cutoff
- You cannot add washes for closed dates

## Autocomplete Search Behavior

### How It Works
1. **Debounced Search**: The system waits 300ms after you stop typing before searching
2. **Smart Matching**:
   - First priority: Vehicles starting with your input
   - Second priority: Vehicles containing your input anywhere
   - Prioritizes vehicles from your assigned location
3. **Results Limit**: Shows up to 20 matching vehicles
4. **Real-time Filtering**: Updates as you type

### Search Tips
- Type just a few characters to see results
- If you know the exact number, type it fully and press Enter
- Results from your home location appear at the top
- The dropdown closes automatically after selection

### Empty Results
- If "No vehicles found" appears:
  - Check your spelling
  - Verify the vehicle is in the system (contact admin)
  - Try typing the full vehicle number anyway

## Common Issues and Solutions

### Issue: "Contact admin to assign your location"
**Cause**: Your user account doesn't have a location assigned  
**Solution**: Contact your administrator to assign you to a location

### Issue: "Vehicle already washed on [date]"
**Cause**: Someone (possibly you) already recorded a wash for this vehicle on this date  
**Solution**: 
- Check if you already added this vehicle today
- The system prevents duplicate washes on the same day
- If this is an error, contact your manager or admin

### Issue: "Vehicle not found in system"
**Cause**: The vehicle number doesn't exist in the database  
**Solution**: 
- Double-check the vehicle number for typos
- Verify the vehicle has been added to the system
- Contact admin to add the vehicle if needed

### Issue: Cannot delete an entry
**Cause**: Entries can only be deleted on the same day they were created  
**Solution**: 
- Past entries are locked for data integrity
- Contact your manager or admin if you need to remove an old entry

### Issue: "Entry Closed" on a date
**Cause**: The date is before the payroll cutoff  
**Solution**: 
- You cannot add entries for dates before the cutoff
- This ensures accurate payroll processing
- Contact finance if there's a legitimate error

### Issue: Network error or timeout
**Cause**: Connection issue with the backend  
**Solution**:
- Check your internet connection
- Try refreshing the page
- Contact IT support if the issue persists

## Best Practices

### Accurate Entry
- Record washes immediately or at the end of your shift
- Double-check vehicle numbers before submitting
- Don't rely on memory - record as you work

### Using the Interface
- Use the autocomplete for faster entry
- Take advantage of keyboard shortcuts (Enter to submit)
- Review your daily count to ensure accuracy

### Data Quality
- If you notice a typo, delete and re-enter (same day only)
- Report any systematic issues to your manager
- Keep your location assignment up to date

## Mobile Usage

### Responsive Design
- On mobile, days stack vertically
- Autocomplete dropdown is full-width
- Larger touch targets for easy tapping
- Sticky header for easy navigation

### Mobile Tips
- Rotate to landscape for better week overview
- Use the native keyboard for vehicle number entry
- Tap outside dropdown to close it

## Performance Metrics

### Week Summary Card
- Shows total vehicles washed this week
- Updates in real-time as you add entries
- Use for personal performance tracking

### Future Features (Coming Soon)
- Historical performance charts
- Comparison with team averages
- Monthly summaries
- Badge achievements

## Technical Details

### Data Validation
- Vehicle must exist and be active
- Cannot wash same vehicle twice on same day (database constraint)
- Employee must have an assigned location
- Dates cannot be before system cutoff

### Data Updates
- Last seen location updates when you wash a vehicle
- Last seen date tracks most recent wash
- All changes are logged with timestamps
- Real-time updates across sessions

## Getting Help

### Support Channels
1. **Immediate Issues**: Contact your supervisor
2. **System Errors**: Reach out to IT support
3. **Data Corrections**: Contact payroll/finance department
4. **Feature Requests**: Submit through your manager

### Reporting Bugs
When reporting issues, include:
- What you were trying to do
- The exact error message
- The vehicle number (if applicable)
- The date and time
- Screenshots if possible
