# Client Management Guide

## Overview

This guide explains how to create, manage, and configure clients in the WashTrack multi-client system. A "client" is a company (trucking company, fleet operator, construction company, etc.) whose vehicles you wash at your locations.

## Table of Contents

1. [Creating a New Client](#creating-a-new-client)
2. [Assigning Clients to Locations](#assigning-clients-to-locations)
3. [Setting Client-Specific Rates](#setting-client-specific-rates)
4. [Managing Client Contracts](#managing-client-contracts)
5. [Client Contacts](#client-contacts)
6. [Client Notes & Communication](#client-notes--communication)
7. [Billing Configuration](#billing-configuration)
8. [Deactivating Clients](#deactivating-clients)

---

## Creating a New Client

### Step 1: Access Client Management
- Navigate to Admin Dashboard → Client Management
- Click "Add New Client" button

### Step 2: Basic Information

**Required Fields:**
- **Client Code**: Unique identifier (e.g., "ABC123", "SWIFT", "ACME")
  - Keep it short (3-8 characters)
  - Use client's company initials or commonly used abbreviation
  - Once set, cannot be changed (used in reports and invoices)

- **Client Name**: Display name (e.g., "ABC Trucking Inc.")
  - This appears in dropdowns and employee interfaces

**Optional but Recommended:**
- **Legal Business Name**: Full legal entity name for contracts
- **Industry**: Select from dropdown (trucking, construction, delivery, rental, etc.)

### Step 3: Contact Information

**Primary Contact:**
- Name, email, phone of main point of contact
- Used for operational communications

**Billing Contact:**
- Name, email, phone of accounts payable person
- Invoices will be sent to this email
- Can be same as primary contact

### Step 4: Billing Address
Enter complete billing address:
- Street address
- City, State, ZIP
- Country (defaults to USA)

**Note:** This address appears on invoices.

### Step 5: Business Details

**Tax ID / EIN:**
- Optional but recommended for proper invoicing
- Keep confidential, only visible to admin/finance roles

**Payment Terms:** Select from dropdown
- Net 15: Payment due in 15 days
- **Net 30**: Most common, payment due in 30 days
- Net 45: Payment due in 45 days
- Net 60: Payment due in 60 days
- Due on Receipt: Payment due immediately
- Prepaid: Client pays in advance

**Credit Limit:** (Optional)
- Maximum outstanding balance allowed
- System will alert when exceeded
- Leave blank for no limit

### Step 6: Contract Details

**Contract Number:** (Optional)
- Your internal contract reference number

**Contract Start Date:** Date contract begins

**Contract End Date:** Date contract expires

**Auto Renew:**
- ☑ Checked: Contract automatically renews at end date
- ☐ Unchecked: Contract expires and requires manual renewal

### Step 7: Billing Configuration

**Invoice Frequency:** How often to bill this client
- **Monthly**: Most common, invoiced at end of each month
- Bi-Weekly: Every 2 weeks
- Weekly: Every week
- Quarterly: Every 3 months
- Per Wash: Invoice immediately after each wash (rare)

**Discount Percentage:** (Optional)
- Percentage discount applied to ALL invoices
- Example: 5% discount for high-volume clients
- Enter as number (e.g., "5" for 5%)

**Requires PO Number:**
- ☑ Checked: Client requires purchase order numbers on invoices
- ☐ Unchecked: No PO numbers required

### Step 8: Save Client
- Click "Create Client"
- Client is now created but NOT yet active at any locations
- Next step: Assign client to locations (see next section)

---

## Assigning Clients to Locations

After creating a client, you must assign them to one or more locations where you'll service their vehicles.

### Step 1: Access Client-Location Assignment
- Admin Dashboard → Client Management → Select Client
- Click "Manage Locations" tab

### Step 2: Assign to Location
- Click "Add Location"
- Select location from dropdown
- Configure location-specific settings

### Location-Specific Settings

**Is Primary Location:**
- ☑ Checked: This is the client's main/preferred location
- Used for reporting and defaults
- Only ONE primary location per client

**Priority Level:**
- **Standard**: Normal priority (most common)
- Low: Low priority client
- High: High priority client (gets preference)
- VIP: VIP client (highest priority)

**Rate Multiplier:**
- Location-specific rate adjustment
- **1.0**: Standard rates (default)
- **1.2**: 20% higher than standard (for remote locations)
- **0.8**: 20% discount (for preferred locations)
- Example: If base rate is $50 and multiplier is 1.2, charged rate is $60

**Is Active:**
- ☑ Checked: Client is currently serviced at this location
- ☐ Unchecked: Client is no longer serviced here (historical record)

### Step 3: Save Assignment
- Click "Save"
- Employees at this location can now see this client's vehicles

### Multiple Locations Example

**ABC Trucking is serviced at:**
- **Location A** (Primary, Standard priority, 1.0 multiplier)
- **Location B** (Secondary, High priority, 1.1 multiplier)
- **Location C** (Inactive, was serviced 2020-2023)

Employees at Location A and B can see ABC Trucking vehicles.
Employees at Location C cannot see ABC Trucking vehicles.

---

## Setting Client-Specific Rates

Clients can have custom rates that override base vehicle type rates.

### When to Use Custom Rates

**Use custom rates when:**
- Client negotiated special pricing
- Long-term contract with fixed rates
- Volume discount pricing
- Promotional pricing for new clients

**Don't use custom rates if:**
- Client pays standard rates (use base rates)
- Only location-based adjustment needed (use rate multiplier)

### Step 1: Access Rate Management
- Admin Dashboard → Client Management → Select Client
- Click "Rates" tab
- Click "Add Custom Rate"

### Step 2: Configure Rate

**Vehicle Type:** Select from dropdown
- Semi-Truck, Box Truck, Van, etc.

**Custom Rate:** Enter dollar amount
- Overrides base rate for this client
- Example: Base rate is $60, but this client pays $50

**Effective Date:** When this rate starts
- Usually contract start date
- Can set future-dated rates

**Expiration Date:** (Optional)
- When this rate ends
- Leave blank for no expiration
- Useful for promotional periods

### Step 3: Save Rate
- Click "Save"
- Rate is now active for this client
- All future wash entries use this rate

### Rate Priority Logic

When calculating wash charge, system uses (in order):
1. **Vehicle-specific custom rate** (if set on individual vehicle)
2. **Client-vehicle type rate** (what you just configured)
3. **Location rate multiplier** (from client-location assignment)
4. **Base rate** (from vehicle types table)

### Example Rate Configuration

**Standard Rates:**
- Semi-Truck: $60
- Box Truck: $35
- Van: $25

**ABC Trucking Custom Rates:**
- Semi-Truck: $50 (negotiated discount)
- Box Truck: $35 (uses standard rate, no custom rate set)
- Van: $20 (negotiated discount)

**Location B Rate Multiplier: 1.2**

**Final rates for ABC Trucking at Location B:**
- Semi-Truck: $50 × 1.2 = $60
- Box Truck: $35 × 1.2 = $42
- Van: $20 × 1.2 = $24

---

## Managing Client Contracts

### Viewing Contract Status
- Admin Dashboard → Client Management
- Contracts tab shows all clients with contract end dates

### Contract Expiration Alerts
System alerts when:
- Contract expires in 30 days (warning)
- Contract expires in 7 days (urgent)
- Contract has expired (critical)

### Renewing Contracts

**If Auto-Renew is ON:**
- No action required
- Contract automatically renews for same term
- Update contract_end_date if term changes

**If Auto-Renew is OFF:**
- Navigate to client
- Click "Renew Contract"
- Update contract end date
- Review and update rates if needed
- Save changes

### Terminating Contracts
1. Navigate to client
2. Set contract_end_date to termination date
3. Change account_status to "inactive"
4. Deactivate client at all locations
5. Document reason in client notes

---

## Client Contacts

Clients can have multiple contacts for different purposes.

### Adding Contacts

**Step 1:** Client Management → Select Client → Contacts Tab

**Step 2:** Click "Add Contact"

**Step 3:** Enter contact information:
- Name
- Title/Position
- Email
- Phone
- Contact Type:
  - **Primary**: Main point of contact
  - **Billing**: Accounts payable
  - **Operations**: Day-to-day operations
  - **Emergency**: After-hours contact
  - **Other**: Any other type

**Step 4:** Save

### Best Practices

**Always have at minimum:**
- 1 Primary contact
- 1 Billing contact (can be same person)

**Recommended:**
- Operations contact for scheduling
- Emergency contact for urgent issues

### Updating Contacts
- Edit existing contact to update information
- Deactivate old contacts (don't delete for historical record)
- Mark contact as inactive when person leaves company

---

## Client Notes & Communication

Track all client interactions in the notes system.

### Creating Notes

**Step 1:** Client Management → Select Client → Notes Tab

**Step 2:** Click "Add Note"

**Step 3:** Enter note details:
- Note text (required)
- Note type:
  - **General**: Regular communication
  - **Billing**: Payment or invoice issues
  - **Complaint**: Client complaint
  - **Compliment**: Positive feedback
  - **Contract**: Contract discussions
  - **Important**: Critical information

**Step 4:** (Optional) Pin note to top for visibility

**Step 5:** Save

### Note Type Guidelines

**Use "Important" for:**
- Special instructions
- Rate exceptions
- Contract terms
- Access restrictions

**Use "Billing" for:**
- Payment issues
- Invoice disputes
- Payment plan arrangements

**Use "Complaint" for:**
- Service quality issues
- Damaged vehicles
- Employee conduct issues

**Use "Compliment" for:**
- Positive feedback
- Testimonials
- Employee recognition

### Pinned Notes
- Important notes can be pinned to top
- Visible on client dashboard
- Use sparingly for critical info only

---

## Billing Configuration

### Payment Terms

**Set appropriate terms based on:**
- Client size (larger = longer terms)
- Payment history (reliable = longer terms)
- Industry standards
- Credit check results

**Net 30 is standard** for most clients.

### Invoice Frequency

**Monthly (Recommended):**
- One invoice per month
- Easier for clients to process
- Standard in industry

**Bi-Weekly or Weekly:**
- For clients who prefer frequent billing
- Cash flow management
- Smaller invoices

**Quarterly:**
- Large clients with established relationships
- Lower administrative overhead
- Higher invoice amounts

**Per Wash:**
- Rarely used
- For clients who need immediate invoices
- Higher administrative work

### Credit Limits

**When to set credit limits:**
- New clients (start with low limit)
- Clients with payment issues
- High-risk industries

**When NOT to set:**
- Established clients with good payment history
- Prepaid clients
- Large, stable companies

### Discount Configuration

**Volume discounts:**
- 3-5% for 100+ washes/month
- 5-10% for 500+ washes/month

**Promotional discounts:**
- Set expiration date
- Document reason in notes

---

## Deactivating Clients

### When to Deactivate

Deactivate a client when:
- Contract has ended
- Client no longer needs services
- Moving to competitor
- Business closed
- Payment issues unresolved

### Deactivation Process

**Step 1:** Complete all outstanding washes
- Ensure all recent washes are recorded

**Step 2:** Generate final invoice
- Bill for all services through end date

**Step 3:** Update client status
- Set account_status to "inactive"
- Or "collections" if payment issues

**Step 4:** Deactivate at all locations
- Go to each location assignment
- Set is_active = false
- Set deactivated_at timestamp

**Step 5:** Document in notes
- Record reason for deactivation
- Document outstanding balance if any
- Note who authorized deactivation

### Effects of Deactivation

**Employees:**
- Can no longer see client's vehicles
- Cannot add wash entries for this client

**Admins:**
- Can still view historical data
- Can still generate past reports
- Client appears in "Inactive Clients" list

**Billing:**
- No future invoices generated
- Past invoices remain in system
- Outstanding balance tracking continues

### Reactivating Clients

To reactivate a client:
1. Update account_status to "active"
2. Reactivate at desired locations
3. Review and update rates
4. Add note documenting reactivation
5. Notify relevant employees

---

## Common Scenarios

### Scenario 1: New Trucking Company

**Setup Process:**
1. Create client: "Swift Transport"
2. Set payment terms: Net 30
3. Assign to Location A (primary)
4. Set custom rates (if negotiated)
5. Add primary and billing contacts
6. Create welcome note with special instructions

### Scenario 2: Multi-Location Client

**Setup Process:**
1. Create client: "ABC Nationwide"
2. Assign to multiple locations:
   - Location A (primary, 1.0 multiplier)
   - Location B (1.1 multiplier, remote)
   - Location C (1.2 multiplier, premium)
3. Set different priority levels per location
4. Configure custom rates applicable to all locations

### Scenario 3: Seasonal Client

**Setup Process:**
1. Create client: "Summer Construction"
2. Set contract dates: April 1 - October 31
3. Set auto_renew: true (renews annually)
4. Set invoice_frequency: monthly
5. Add note about seasonal nature
6. Deactivate after October 31, reactivate March 1

### Scenario 4: Client Switching Locations

**Process:**
1. Keep original location assignment
2. Set is_active = false on old location
3. Set deactivated_at timestamp
4. Add new location assignment
5. Set new location as primary if needed
6. Add note documenting the change

---

## Troubleshooting

### Problem: Employee Can't See Client's Vehicles

**Check:**
1. Is client assigned to employee's location?
2. Is client_location assignment active?
3. Is client account_status "active"?
4. Is client's is_active flag true?

### Problem: Wrong Rates Being Applied

**Check:**
1. Custom rate effective dates
2. Custom rate expiration dates
3. Location rate multiplier
4. Vehicle-specific custom rate

**Rate Priority:**
1. Vehicle custom rate
2. Client-vehicle type rate
3. Location multiplier
4. Base rate

### Problem: Invoice Going to Wrong Contact

**Check:**
1. Client's billing_contact_email field
2. Billing contact record is active
3. Email address is correct format

---

## Best Practices Summary

✅ **DO:**
- Use clear, consistent client codes
- Document all rate negotiations in notes
- Keep contact information up-to-date
- Set appropriate credit limits for new clients
- Review contracts 30 days before expiration
- Document all client communications

❌ **DON'T:**
- Change client codes after creation
- Delete client records (deactivate instead)
- Skip billing contact information
- Set rates without documentation
- Forget to assign clients to locations
- Delete contact records (deactivate instead)

---

## Quick Reference

### Required Fields
- ✅ client_code
- ✅ client_name
- ✅ At least one location assignment
- ✅ At least one contact (primary or billing)

### Recommended Fields
- Legal business name
- Tax ID
- Complete billing address
- Payment terms
- Contract dates

### Optional Fields
- Credit limit
- Discount percentage
- Custom rates
- Multiple contacts
- Client notes

---

## Need Help?

**For questions about:**
- Technical implementation → See MULTI_CLIENT_ARCHITECTURE.md
- Database structure → See migration files
- Billing process → See billing documentation (TBD)
- Access permissions → See role documentation
